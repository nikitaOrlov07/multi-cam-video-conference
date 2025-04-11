class VideoConference {
    constructor(conferenceId, userName) {
        this.conferenceId = conferenceId;
        this.userName = userName;
        this.connection = null;
        this.room = null;
        this.localTracks = {
            audio: null,
            video: []
        };
        this.remoteTracks = new Map();
        this.deviceConfig = null;
        this.participants = new Map();
        this.userCounts = new Map();
        this.userVisibility = new Map();
        this.updateUserCount = this.updateUserCount.bind(this);
        this.userUpdateInterval = null;
        this.processedParticipants = new Set();
        this.reconnecting = false;  // Add this flag to track reconnections
        this.myParticipantId = null; // Track the user's own participant ID

        // Add a map to track display names to section IDs
        this.displayNameToSectionMap = new Map();
        // Properties to track camera ordering
        this.cameraOrderMap = new Map(); // Maps deviceId to order
        this.orderedCameraContainers = new Map(); // Maps order to container element
    }
    async loadAllUserCameraConfigurations() {
        try {
            const response = await fetch(`/api/conference/devices/configuration/${this.conferenceId}`);
            if (!response.ok) {
                throw new Error('Failed to load all camera configurations');
            }

            const deviceConfigs = await response.json();

            console.log("AFTER RESPONSE")
            console.log("Response ", deviceConfigs)

            // Process each user's configuration
            deviceConfigs.forEach(config => {
                const userName = config.userName;
                const gridRows = config.gridRows || 2;
                const gridCols = config.gridCols || 2;

                // Parse camera configurations if they exist
                if (config.cameraConfiguration) {
                    try {
                        const cameras = JSON.parse(config.cameraConfiguration);

                        // Store order and grid information for each camera
                        cameras.forEach(camera => {
                            // Store with userName+deviceId as the key to avoid conflicts across users
                            const key = `${userName}_${camera.deviceId}`;
                            this.cameraOrderMap.set(key, {
                                order: camera.order,
                                gridRows: gridRows,
                                gridCols: gridCols
                            });
                        });

                        // Also store grid config by username for easier access
                        this.cameraOrderMap.set(`${userName}_gridConfig`, {
                            gridRows: gridRows,
                            gridCols: gridCols
                        });
                    } catch (e) {
                        console.error(`Error parsing camera config for ${userName}:`, e);
                    }
                }
            });

            console.log('Loaded camera configurations for all users:', this.cameraOrderMap);
            return true;
        } catch (error) {
            console.error('Error loading all camera configurations:', error);
            this.showError('Ошибка загрузки конфигураций камер всех пользователей');
            return false;
        }
    }

    updateUserCount(userName) {
        try {
            // Skip if we're reconnecting and the user is the local user
            if (this.reconnecting && userName === this.userName) {
                console.log('Skipping user count update for reconnecting user');
                return Promise.resolve(this.userCounts.get(userName) || 1);
            }

            // Important change: Don't process the local user in backend updates
            // This prevents the local user from being removed during user count updates
            if (userName === this.userName) {
                // Just ensure there's a count for the local user
                if (!this.userCounts.has(userName)) {
                    this.userCounts.set(userName, 1);
                }
                this.updateUsersList();
                return Promise.resolve(this.userCounts.get(userName));
            }

            return fetch(`/conference/updateUserJoinCount?userName=${encodeURIComponent(userName)}&conferenceId=${this.conferenceId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to update user count');
                    }
                    return response.json().catch(() => 0);
                })
                .then(count => {
                    // Update the count
                    this.userCounts.set(userName, count);
                    this.updateUsersList();
                    return count;
                })
                .catch(error => {
                    console.error('Error updating user count:', error);
                    this.showError('Ошибка обновления количества пользователей');
                    return null;
                });
        } catch (error) {
            console.error('Error updating user count:', error);
            this.showError('Ошибка обновления количества пользователей');
            return Promise.resolve(null);
        }
    }

    isUserAlreadyInConference(userName) {
        // Check from participants Map instead of just the DOM
        for (const participant of this.participants.values()) {
            if (participant.displayName === userName) {
                return true;
            }
        }
        return false;
    }

    startUserCountUpdates() {
        if (this.userUpdateInterval) {
            clearInterval(this.userUpdateInterval);
        }

        this.userUpdateInterval = setInterval(() => {
            this.userCounts.forEach((_, userName) => {
                this.updateUserCount(userName).then(count => {
                    if (count !== null) {
                        this.userCounts.set(userName, count);
                        this.updateUsersList();
                    }
                });
            });
        }, 60000);
    }

    async onConnectionSuccess(options) {
        try {
            console.log('Connection established successfully=====================');
            await this.updateUserCount();
            this.room = this.connection.initJitsiConference(this.conferenceId, options);

            // Needed for proper user identification during reconnection
            this.room.on(JitsiMeetJS.events.conference.ENDPOINT_MESSAGE_RECEIVED,
                (participant, message) => this.onEndpointMessageReceived(participant, message));

            this.room.on(JitsiMeetJS.events.conference.TRACK_ADDED,
                track => this.onRemoteTrackAdded(track));
            this.room.on(JitsiMeetJS.events.conference.TRACK_REMOVED,
                track => this.onRemoteTrackRemoved(track));
            this.room.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED,
                () => this.onConferenceJoined());
            this.room.on(JitsiMeetJS.events.conference.USER_JOINED,
                (id, user) => this.onUserJoined(id, user));
            this.room.on(JitsiMeetJS.events.conference.USER_LEFT,
                (id) => this.onUserLeft(id));

            // Send proper identity information on joining
            this.room.setDisplayName(this.userName);

            await this.room.join();

            // Store user's own participant ID
            this.myParticipantId = this.room.myUserId();
            console.log(`My participant ID: ${this.myParticipantId}`);

            // REMOVE THIS LINE: This is causing the error since BridgeChannel isn't initialized yet
            // this.sendIdentityMessage();

            const participants = this.room.getParticipants();
            participants.forEach(participant => {
                this.onUserJoined(participant.getId(), participant);
            });

            document.getElementById('loading').style.display = 'none';
        } catch (error) {
            console.error('Conference connection error:', error);
            this.showError('Conference connection error');
            document.getElementById('loading').style.display = 'none';
        }
    }

    sendIdentityMessage() {
        if (this.room && this.room.getBridgeChannel && this.room.getBridgeChannel()) {
            try {
                const message = {
                    type: 'identity',
                    userName: this.userName,
                    timestamp: Date.now()
                };
                this.room.sendEndpointMessage('', {identity: message});
                console.log('Identity message sent successfully');
            } catch (error) {
                console.warn('Failed to send identity message, will retry in 2 seconds', error);
                // Retry after a delay
                setTimeout(() => this.sendIdentityMessage(), 2000);
            }
        } else {
            console.warn('BridgeChannel not ready, will retry in 2 seconds');
            // Retry after a delay
            setTimeout(() => this.sendIdentityMessage(), 2000);
        }
    }

    onEndpointMessageReceived(participant, message) {
        if (message && message.identity && message.identity.type === 'identity') {
            const participantId = participant.getId();
            const userName = message.identity.userName;

            console.log(`Received identity from ${participantId}: ${userName}`);

            // Update the participant's display name
            if (this.participants.has(participantId)) {
                const existingParticipant = this.participants.get(participantId);
                existingParticipant.displayName = userName;

                // Update any display names in the UI
                const section = document.querySelector(`[data-participant-id="${participantId}"]`);
                if (section) {
                    const nameDiv = section.querySelector('.participant-name');
                    if (nameDiv) {
                        nameDiv.textContent = userName;
                    }
                }
            }
        }

        // Add this new handler for track requests
        if (message && message.trackRequest && message.trackRequest.type === 'track_request') {
            console.log(`Received track request from ${message.trackRequest.requesterId}`);

            // Re-share all local tracks
            this.localTracks.video.forEach(async track => {
                try {
                    if (this.room && !track.isDisposed()) {
                        console.log(`Re-sharing local track ${track.getId()}`);
                        // First remove track if it exists
                        await this.room.removeTrack(track);
                        // Then add it again to trigger sharing
                        await this.room.addTrack(track);
                    }
                } catch (error) {
                    console.error('Error re-sharing track:', error);
                }
            });
        }
    }

    onUserLeft(id) {
        console.log('User left:', id);
        const participant = this.participants.get(id);

        // Critical change: Never remove the local user
        // Protect the local user from being removed
        if (participant && participant.displayName === this.userName) {
            console.log('Ignoring user left event for local user');
            return;
        }

        if (participant) {
            const displayName = participant.displayName;
            const currentCount = this.userCounts.get(displayName);

            if (currentCount > 1) {
                this.userCounts.set(displayName, currentCount - 1);
            }

            this.updateUsersList();
            this.participants.delete(id);

            const remainingParticipants = Array.from(this.participants.values())
                .filter(p => p.displayName === displayName);

            if (remainingParticipants.length === 0) {
                // Only remove the section if no participants with the same display name remain
                if (this.displayNameToSectionMap.has(displayName)) {
                    const sectionId = this.displayNameToSectionMap.get(displayName);
                    const section = document.querySelector(`[data-participant-id="${sectionId}"]`);
                    if (section) {
                        section.remove();
                    }
                    this.displayNameToSectionMap.delete(displayName);
                }
            }
        }

        if (this.remoteTracks.has(id)) {
            this.remoteTracks.get(id).forEach(track => track.dispose());
            this.remoteTracks.delete(id);
        }
    }

    updateUsersList() {
        const usersListElement = document.getElementById('users-list');
        usersListElement.innerHTML = '';

        // Create a set of unique usernames from participants
        const uniqueUsers = new Set();
        this.participants.forEach(participant => {
            uniqueUsers.add(participant.displayName);
        });

        // Make sure local user is included
        uniqueUsers.add(this.userName);

        // Update counts for each unique user
        uniqueUsers.forEach(userName => {
            if (!this.userCounts.has(userName)) {
                // Initialize with 1 if not present
                this.userCounts.set(userName, 1);
            }
        });

        // Critical change: Always ensure the local user is in the participants map
        if (!this.participants.has("local")) {
            this.participants.set("local", {
                id: "local",
                displayName: this.userName,
                tracks: new Map()
            });
        }

        this.userCounts.forEach((count, userName) => {
            // Ensure the local user is always shown
            if (!uniqueUsers.has(userName) && userName !== this.userName) {
                return;
            }

            const isVisible = this.userVisibility.get(userName) !== false;
            const isLocalUser = userName === this.userName;

            // Add "(You)" label for the local user
            const displayName = isLocalUser ? `${userName} (You)` : userName;

            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
        <label class="user-checkbox">
            <input type="checkbox"
                   data-username="${userName}"
                   ${isVisible ? 'checked' : ''}>
            <span>${displayName}</span>
        </label>
        <span class="user-count">${count}</span>
    `;

            const checkbox = userItem.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                this.toggleUserVisibility(userName, e.target.checked);
            });

            usersListElement.appendChild(userItem);
        });
    }

    toggleUserVisibility(userName, isVisible) {
        this.userVisibility.set(userName, isVisible);

        // Находим все секции с данным userName
        const sections = document.querySelectorAll('.participant-section');
        sections.forEach(section => {
            const sectionName = section.querySelector('.participant-name').textContent;
            if (sectionName === userName) {
                if (isVisible) {
                    section.classList.remove('hidden');
                } else {
                    section.classList.add('hidden');
                }
            }
        });
    }
    updateSectionLayout(section) {
        if (!section) return;

        const camerasContainer = section.querySelector('.cameras-container');
        if (!camerasContainer) return;

        const videoWrappers = camerasContainer.querySelectorAll('.video-wrapper');
        const count = videoWrappers.length;

        // Set the section size attribute based on camera count
        section.setAttribute('data-size', Math.min(4, Math.ceil(count / 2)));

        // Get username from the section
        const displayName = section.querySelector('.participant-name').textContent;

        // Find grid configuration for this user
        let gridRows = 2; // Default
        let gridCols = 2; // Default

        // Look for stored grid configuration
        for (const [key, config] of this.cameraOrderMap.entries()) {
            if (key.startsWith(`${displayName}_`) && config.gridRows && config.gridCols) {
                gridRows = config.gridRows;
                gridCols = config.gridCols;
                break;
            }
        }

        // Apply grid layout
        camerasContainer.style.gridTemplateRows = `repeat(${gridRows}, 1fr)`;
        camerasContainer.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;

        // Set placement for each camera based on its order
        videoWrappers.forEach(wrapper => {
            const order = wrapper.getAttribute('data-camera-order') || 999;

            // Calculate grid position (row and column) based on order
            // For example: with 2x2 grid, order 1 is at (0,0), order 2 at (0,1), order 3 at (1,0), etc.
            const col = (order - 1) % gridCols;
            const row = Math.floor((order - 1) / gridCols);

            // Apply grid position
            wrapper.style.gridRow = `${row + 1}`;
            wrapper.style.gridColumn = `${col + 1}`;
        });

        // Hide placeholder if we have videos
        if (count > 0) {
            const placeholder = camerasContainer.querySelector('.no-camera-placeholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
        }
    }


    onRemoteTrackRemoved(track) {
        if (track.isLocal()) {
            return;
        }

        const participantId = track.getParticipantId();
        const trackId = track.getId();

        const section = document.querySelector(`[data-participant-id*="${participantId}"]`);
        if (section) {
            const wrapper = document.querySelector(`[data-track-id="${trackId}"]`);
            if (wrapper) {
                wrapper.remove();
                this.updateSectionLayout(section);

                // Show the placeholder if no video tracks remain
                const camerasContainer = section.querySelector('.cameras-container');
                if (camerasContainer) {
                    const videoWrappers = camerasContainer.querySelectorAll('.video-wrapper');
                    if (videoWrappers.length === 0) {
                        let placeholder = camerasContainer.querySelector('.no-camera-placeholder');

                        if (!placeholder) {
                            // Create placeholder if it doesn't exist
                            placeholder = document.createElement('div');
                            placeholder.className = 'no-camera-placeholder';
                            placeholder.innerHTML = `
                            <div class="camera-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 7c0-1.1-.9-2-2-2H6L0 11v4h4v2c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-2h4v-4l-4-4z"/>
                                    <line x1="1" y1="1" x2="23" y2="23" stroke="red"/>
                                </svg>
                            </div>
                            <p>No camera available</p>
                        `;
                            placeholder.style.display = 'flex';
                            placeholder.style.flexDirection = 'column';
                            placeholder.style.alignItems = 'center';
                            placeholder.style.justifyContent = 'center';
                            placeholder.style.height = '100%';
                            placeholder.style.color = '#999';
                            placeholder.style.fontSize = '14px';
                            placeholder.style.backgroundColor = '#2a2a2a';
                            placeholder.style.borderRadius = '8px';
                            placeholder.style.padding = '20px';

                            camerasContainer.appendChild(placeholder);
                        } else {
                            placeholder.style.display = 'flex';
                        }
                    }
                }
            }
        }

        if (this.remoteTracks.has(participantId)) {
            const tracks = this.remoteTracks.get(participantId);
            if (tracks.has(trackId)) {
                tracks.delete(trackId);
            }

            if (tracks.size === 0) {
                this.remoteTracks.delete(participantId);

                // Only remove section if no other participants with same display name
                const participant = this.participants.get(participantId);
                if (participant) {
                    const displayName = participant.displayName;
                    const remainingParticipants = Array.from(this.participants.values())
                        .filter(p => p.displayName === displayName && p.id !== participantId);

                    if (remainingParticipants.length === 0) {
                        if (this.displayNameToSectionMap.has(displayName)) {
                            const sectionId = this.displayNameToSectionMap.get(displayName);
                            const section = document.querySelector(`[data-participant-id="${sectionId}"]`);
                            if (section) {
                                section.remove();
                            }
                            this.displayNameToSectionMap.delete(displayName);
                        }
                    }
                }
            }
        }
    }

    // Modified to return the main section ID for a display name
    getParticipantSection(displayName) {
        if (this.displayNameToSectionMap.has(displayName)) {
            const sectionId = this.displayNameToSectionMap.get(displayName);
            const section = document.querySelector(`[data-participant-id="${sectionId}"]`);
            if (section) {
                return section;
            }
        }
        return null;
    }

    createParticipantSection(participantId, displayName) {
        // First check if we already have a section for this display name
        let section = this.getParticipantSection(displayName);

        if (section) {
            console.log(`Using existing section for ${displayName}`);
            // Update participant IDs list in existing section
            return section;
        }

        if (displayName === 'Участник') {
            console.log(`Skipping section creation for default participant: ${participantId}`);
            return null;
        }

        // Important change: Special handling for the local user
        // Always use "local" as the participant ID for the local user
        const isLocalUser = displayName === this.userName;
        const sectionId = isLocalUser ? "local" : participantId;

        section = document.createElement('div');
        section.className = 'participant-section';
        if (this.userVisibility.get(displayName.split(' (')[0]) === false) {
            section.classList.add('hidden');
        }
        section.setAttribute('data-participant-id', sectionId);
        section.setAttribute('data-size', '1');

        const nameDiv = document.createElement('div');
        nameDiv.className = 'participant-name';
        nameDiv.textContent = displayName;

        const camerasContainer = document.createElement('div');
        camerasContainer.className = 'cameras-container';

        // Look for grid configuration for this user
        let gridRows = 2; // Default
        let gridCols = 2; // Default

        // Check if we have specific grid config for this user
        const gridConfigKey = `${displayName}_gridConfig`;
        if (this.cameraOrderMap.has(gridConfigKey)) {
            const config = this.cameraOrderMap.get(gridConfigKey);
            gridRows = config.gridRows || gridRows;
            gridCols = config.gridCols || gridCols;
        }

        // Apply grid configuration
        camerasContainer.style.gridTemplateRows = `repeat(${gridRows}, 1fr)`;
        camerasContainer.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;

        // Add a placeholder for users without cameras
        const noCameraPlaceholder = document.createElement('div');
        noCameraPlaceholder.className = 'no-camera-placeholder';
        noCameraPlaceholder.innerHTML = `
    <div class="camera-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 7c0-1.1-.9-2-2-2H6L0 11v4h4v2c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-2h4v-4l-4-4z"/>
            <line x1="1" y1="1" x2="23" y2="23" stroke="red"/>
        </svg>
    </div>
    <p>No camera available</p>
`;
        noCameraPlaceholder.style.display = 'flex';
        noCameraPlaceholder.style.flexDirection = 'column';
        noCameraPlaceholder.style.alignItems = 'center';
        noCameraPlaceholder.style.justifyContent = 'center';
        noCameraPlaceholder.style.height = '100%';
        noCameraPlaceholder.style.color = '#999';
        noCameraPlaceholder.style.fontSize = '14px';
        noCameraPlaceholder.style.backgroundColor = '#2a2a2a';
        noCameraPlaceholder.style.borderRadius = '8px';
        noCameraPlaceholder.style.padding = '20px';
        noCameraPlaceholder.style.gridColumn = `1 / span ${gridCols}`; // Span across all columns
        noCameraPlaceholder.style.gridRow = `1 / span ${gridRows}`;   // Span across all rows

        camerasContainer.appendChild(noCameraPlaceholder);

        section.appendChild(nameDiv);
        section.appendChild(camerasContainer);
        document.getElementById('video-container').appendChild(section);

        // If this is the local user, ensure they're in the participants map
        if (isLocalUser) {
            // Add/update the local user in the participants map
            this.participants.set("local", {
                id: "local",
                displayName: this.userName,
                tracks: new Map()
            });

            // Always ensure the local user has a count
            if (!this.userCounts.has(this.userName)) {
                this.userCounts.set(this.userName, 1);
            }
        }

        // Save this section as the main one for this display name
        this.displayNameToSectionMap.set(displayName, sectionId);

        return section;
    }

    // Обновим инициализацию камер
    createVideoPreview(track, label, index) {
        // Use "local" as the participant ID for local tracks
        let section = document.querySelector(`[data-participant-id="local"]`);

        if (!section) {
            section = this.createParticipantSection('local', this.userName);

            // Make sure section was created successfully
            if (!section) {
                console.error('Failed to create section for local user');
                return;
            }
        }

        const camerasContainer = section.querySelector('.cameras-container');
        if (!camerasContainer) {
            console.error('No cameras container found in section');
            return;
        }

        // Hide the no-camera placeholder if it exists
        const placeholder = camerasContainer.querySelector('.no-camera-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        wrapper.setAttribute('data-track-id', track.getId());

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        track.attach(video);

        // Get device information from the track to find the order
        let deviceId = '';
        if (typeof track.getDeviceId === 'function') {
            deviceId = track.getDeviceId();
        } else {
            // Try to get from original stream or use track ID as fallback
            deviceId = track.getId();
        }

        // Check if we have ordering information
        const orderKey = `${this.userName}_${deviceId}`;
        let cameraOrder = null;
        let gridConfig = null;

        if (this.cameraOrderMap.has(orderKey)) {
            const config = this.cameraOrderMap.get(orderKey);
            cameraOrder = config.order;
            wrapper.setAttribute('data-camera-order', cameraOrder);

            // Get grid configuration
            gridConfig = {
                gridRows: config.gridRows || 2,
                gridCols: config.gridCols || 2
            };
        } else {
            cameraOrder = index + 1;
            wrapper.setAttribute('data-camera-order', cameraOrder);
        }

        const cameraLabel = document.createElement('div');
        cameraLabel.className = 'camera-label';

        // Use order in label if available
        if (cameraOrder !== null) {
            cameraLabel.textContent = `${label || 'Камера'} ${cameraOrder}`;
        } else {
            cameraLabel.textContent = `${label || 'Камера'} ${index + 1}`;
        }

        wrapper.appendChild(video);
        wrapper.appendChild(cameraLabel);

        // Append the wrapper
        camerasContainer.appendChild(wrapper);

        // Apply grid layout
        this.updateSectionLayout(section);
    }


    isValidVideoTrack(track) {
        if (!track || track.getType() !== 'video') {
            console.log("Track is not a video track");
            return false;
        }

        const stream = track.getOriginalStream();
        if (!stream || stream.getVideoTracks().length === 0) {
            console.log("Track has no video tracks in stream");
            return false;
        }

        // Additional check for active state
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0 && !videoTracks[0].enabled) {
            console.log("Video track is disabled");
            return false;
        }

        const deviceName = (typeof track.getDeviceName === 'function')
            ? track.getDeviceName()
            : '';

        if (deviceName.includes('Камера')) {
            console.log(`Skipping camera with generic name: ${deviceName}`);
            return false;
        }

        return true;
    }

    onRemoteTrackAdded(track) {
        if (track.isLocal()) {
            return;
        }

        const participantId = track.getParticipantId();

        // Initialize track map for this participant if not exists
        if (!this.remoteTracks.has(participantId)) {
            this.remoteTracks.set(participantId, new Map());
        }

        // Store the track
        this.remoteTracks.get(participantId).set(track.getId(), track);

        if (track.getType() === 'video') {
            // Check if the video track is valid
            if (!this.isValidVideoTrack(track)) {
                console.log(`Skipping invalid video track from participant ${participantId}`);
                return;
            }

            const participant = this.participants.get(participantId);
            if (!participant) {
                console.error(`No participant found for ID ${participantId}`);
                return;
            }

            const displayName = participant.displayName || 'Участник';

            // Try to get the existing section for this display name
            let section = this.getParticipantSection(displayName);

            // If no section exists, create a new one
            if (!section) {
                section = this.createParticipantSection(participantId, displayName);

                // Check if section creation was successful
                if (!section) {
                    console.log(`Unable to create section for ${displayName} with ID ${participantId}, skipping track addition`);
                    return;
                }
            }

            const camerasContainer = section.querySelector('.cameras-container');
            if (!camerasContainer) {
                console.error(`No cameras container found for participant ${participantId} with name ${displayName}`);
                return;
            }

            // Hide the no-camera placeholder if it exists
            const placeholder = camerasContainer.querySelector('.no-camera-placeholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.setAttribute('data-track-id', track.getId());

            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;

            // Don't append the video to the DOM yet
            track.attach(video);

            // Get device information from the track
            let deviceId = '';
            if (typeof track.getDeviceId === 'function') {
                deviceId = track.getDeviceId();
            } else {
                // Try to extract from source or use track ID as fallback
                deviceId = track.getId();
            }

            // Check if we have ordering information for this camera
            const orderKey = `${displayName}_${deviceId}`;
            let cameraOrder = null;

            if (this.cameraOrderMap.has(orderKey)) {
                cameraOrder = this.cameraOrderMap.get(orderKey).order;
                wrapper.setAttribute('data-camera-order', cameraOrder);
            } else {
                // If no specific order is found, assign next available position
                const existingWrappers = camerasContainer.querySelectorAll('.video-wrapper');
                cameraOrder = existingWrappers.length + 1;
                wrapper.setAttribute('data-camera-order', cameraOrder);
            }

            // Create a promise to check if video has dimensions after attaching
            const checkVideoDimensions = new Promise((resolve, reject) => {
                // Set timeout to prevent hanging if metadata never loads
                const timeout = setTimeout(() => {
                    reject('Video metadata loading timed out');
                }, 5000);

                video.addEventListener('loadedmetadata', () => {
                    clearTimeout(timeout);
                    if (video.videoWidth === 0 || video.videoHeight === 0) {
                        reject('Video has zero dimensions');
                    } else {
                        resolve();
                    }
                });
            });

            // Only add the video to the DOM after we've confirmed it has dimensions
            checkVideoDimensions.then(() => {
                const label = document.createElement('div');
                label.className = 'camera-label';

                // Use order in label if available
                if (cameraOrder !== null) {
                    label.textContent = `Камера ${cameraOrder}`;
                } else {
                    label.textContent = `Камера ${camerasContainer.querySelectorAll('.video-wrapper').length + 1}`;
                }

                wrapper.appendChild(video);
                wrapper.appendChild(label);

                camerasContainer.appendChild(wrapper);

                this.updateSectionLayout(section);

                video.play().catch(error => {
                    console.error('Video playback error:', error);
                    wrapper.remove();
                    this.updateSectionLayout(section);

                    // Show placeholder again if no other videos
                    if (camerasContainer.querySelectorAll('.video-wrapper').length === 0) {
                        if (placeholder) {
                            placeholder.style.display = 'flex';
                        }
                    }
                });
            }).catch(error => {
                console.log(`Skipping invalid video track: ${error}`);
                track.detach(video);
                // Make sure to clean up the track in our remoteTracks map
                if (this.remoteTracks.has(participantId)) {
                    this.remoteTracks.get(participantId).delete(track.getId());
                }

                // Show placeholder again if no other videos
                if (camerasContainer.querySelectorAll('.video-wrapper').length === 0) {
                    if (placeholder) {
                        placeholder.style.display = 'flex';
                    }
                }
            });
        } else if (track.getType() === 'audio') {
            const audio = document.createElement('audio');
            track.attach(audio);
            audio.play().catch(error => {
                console.error('Audio playback error:', error);
            });
        }
    }

    // Обновим инициализацию камер
    async initializeDevices() {
        try {
            // Check for the special case of a page refresh/reconnection
            const storedUserId = sessionStorage.getItem('conferenceUserId');
            const storedConferenceId = sessionStorage.getItem('conferenceId');

            if (storedUserId === this.userName && storedConferenceId === this.conferenceId) {
                this.reconnecting = true;
                console.log('Detected reconnection, handling accordingly');
            }

            // Always store current user and conference ID
            sessionStorage.setItem('conferenceUserId', this.userName);
            sessionStorage.setItem('conferenceId', this.conferenceId);

            // If reconnecting and already showing in users list, don't initialize new devices
            if (this.reconnecting && this.isUserAlreadyInConference(this.userName)) {
                console.log('User already in conference, skipping device initialization');
                document.getElementById('loading').style.display = 'none';
                return;
            }

            // Create a section for the local user even if no cameras - IMPORTANT: This ensures user section exists
            let section = document.querySelector(`[data-participant-id="local"]`);
            if (!section) {
                section = this.createParticipantSection('local', this.userName);

                // Ensure the section was created successfully
                if (!section) {
                    console.error('Failed to create section for local user');
                    // Still try to continue with audio setup
                }
            }

            // Initialize audio track
            try {
                const audioTracks = await JitsiMeetJS.createLocalTracks({
                    devices: ['audio']
                });

                if (audioTracks && audioTracks.length > 0) {
                    this.localTracks.audio = audioTracks[0];

                    if (this.room) {
                        await this.room.addTrack(audioTracks[0]);
                    }

                    console.log('Audio track initialized successfully');
                }
            } catch (audioError) {
                console.error('Error initializing audio track:', audioError);
                this.showError('Microphone access error');
            }

            // Make sure we have a valid section object before continuing
            if (!section) {
                // Try once more to get/create the section
                section = document.querySelector(`[data-participant-id="local"]`);
                if (!section) {
                    section = this.createParticipantSection('local', this.userName);
                }
            }

            // Handle device config for video
            const deviceConfig = this.deviceConfig;
            if (!deviceConfig || !deviceConfig.cameras || deviceConfig.cameras.length === 0) {
                console.log('No camera configuration available, joining with audio only');

                // Show "No camera available" message for local user
                if (section) {
                    const camerasContainer = section.querySelector('.cameras-container');
                    if (camerasContainer) {
                        let placeholder = camerasContainer.querySelector('.no-camera-placeholder');
                        if (placeholder) {
                            placeholder.style.display = 'flex';
                        }
                    }
                }

                // Always update the user count and list
                this.updateUserCount(this.userName);
                this.updateUsersList();

                return; // Exit after setting up audio
            }

            // Filter out cameras with "Камера" in the name
            const validCameras = deviceConfig.cameras.filter(camera =>
                !camera.label.includes('Камера')
            );

            if (validCameras.length === 0) {
                console.warn('No valid cameras found after filtering');
                // Show "No camera available" message for local user
                if (section) {
                    const camerasContainer = section.querySelector('.cameras-container');
                    if (camerasContainer) {
                        let placeholder = camerasContainer.querySelector('.no-camera-placeholder');
                        if (placeholder) {
                            placeholder.style.display = 'flex';
                        }
                    }
                }

                // Always update the user count and list
                this.updateUserCount(this.userName);
                this.updateUsersList();

                return; // Exit after setting up audio
            }

            for (let index = 0; index < validCameras.length; index++) {
                const camera = validCameras[index];
                try {
                    const tracks = await JitsiMeetJS.createLocalTracks({
                        devices: ['video'],
                        cameraDeviceId: camera.deviceId,
                        constraints: {
                            video: {
                                deviceId: camera.deviceId,
                                height: {ideal: 720},
                                width: {ideal: 1280}
                            }
                        }
                    });

                    // Check if we got a valid track with actual video
                    if (!tracks || tracks.length === 0 || !tracks[0]) {
                        console.log(`No valid tracks created for camera: ${camera.label}`);
                        continue;
                    }

                    // Test if this track is valid
                    if (!this.isValidVideoTrack(tracks[0])) {
                        console.log(`Skipping invalid video track from camera: ${camera.label}`);
                        tracks[0].dispose();
                        continue;
                    }

                    this.localTracks.video.push(tracks[0]);
                    this.createVideoPreview(tracks[0], camera.label, index);

                    if (this.room) {
                        await this.room.addTrack(tracks[0]);
                    }
                } catch (e) {
                    console.error(`Error accessing camera: ${camera.label}`, e);
                    this.showError(`Camera access error: ${camera.label}`);
                }
            }

            // If no video tracks were successfully added, show the placeholder
            if (this.localTracks.video.length === 0 && section) {
                const camerasContainer = section.querySelector('.cameras-container');
                if (camerasContainer) {
                    let placeholder = camerasContainer.querySelector('.no-camera-placeholder');
                    if (placeholder) {
                        placeholder.style.display = 'flex';
                    }
                }
            }

            // Always update the user count and list
            this.updateUserCount(this.userName);
            this.updateUsersList();

        } catch (error) {
            console.error('Error initializing devices:', error);
            this.showError('Device initialization error');
        }
        document.getElementById('loading').style.display = 'none';
    }

    setupControlButtons() {
        document.getElementById('toggleVideo').addEventListener('click', () => {
            this.localTracks.video.forEach(track => {
                if (track.isMuted()) {
                    track.unmute();
                } else {
                    track.mute();
                }
                this.updateButtonState('toggleVideo', !track.isMuted());
            });
        });

        document.getElementById('toggleAudio').addEventListener('click', () => {
            if (this.localTracks.audio) {
                if (this.localTracks.audio.isMuted()) {
                    this.localTracks.audio.unmute();
                } else {
                    this.localTracks.audio.mute();
                }
                this.updateButtonState('toggleAudio', !this.localTracks.audio.isMuted());
            }
        });

        document.getElementById('leaveCall').addEventListener('click', () => {
            this.leaveConference();
        });
    }

    updateButtonState(buttonId, enabled) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.classList.toggle('muted', !enabled);
        }
    }

    async leaveConference() {
        console.log('Leave conference method is working');

        // Clear the stored user ID and conference ID
        sessionStorage.removeItem('conferenceUserId');
        sessionStorage.removeItem('conferenceId');

        await this.updateUserCount(this.userName);
        this.remoteTracks.forEach((tracks, participantId) => {
            tracks.forEach(track => track.detach());
            const container = document.querySelector(`[data-participant-id="${participantId}"]`);
            if (container) {
                container.remove();
            }
        });
        this.remoteTracks.clear();

        Object.values(this.localTracks).flat().forEach(track => {
            if (track) {
                track.dispose();
            }
        });

        if (this.room) {
            this.room.leave();
        }

        if (this.connection) {
            this.connection.disconnect();
        }

        await fetch('/conference/leaveConference', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `conferenceId=${encodeURIComponent(this.conferenceId)}&userName=${encodeURIComponent(this.userName)}`
        })
            .then(response => {
                if (response.ok) {
                    window.location.href = '/home';
                } else {
                    console.error('Error leaving conference:', response.statusText);
                }
            })
            .catch(error => {
                console.error('Request failed', error);
            });
    }

    onConnectionFailed() {
        this.showError('Server connection error');
        document.getElementById('loading').style.display = 'none';
    }

    onDisconnected() {
        if (this.userUpdateInterval) {
            clearInterval(this.userUpdateInterval);
        }
        console.log('The connection is broken');
    }

    onConferenceJoined() {
        console.log('The conference has been successfully connected');
        this.isInitialized = true;

        // Store the user's own participant ID
        this.myParticipantId = this.room.myUserId();
        console.log(`My participant ID on join: ${this.myParticipantId}`);

        // Important change: Always ensure the local user is in the participants map
        // Add local user to participants map with "local" as the ID
        this.participants.set("local", {
            id: "local",
            displayName: this.userName,
            tracks: new Map()
        });

        // For both new connections and reconnections, ensure local user exists
        if (!this.getParticipantSection(this.userName)) {
            this.createParticipantSection("local", this.userName);
        }

        // Ensure local user has a count
        if (!this.userCounts.has(this.userName)) {
            this.userCounts.set(this.userName, 1);
        }

        // Update the users list
        this.updateUsersList();

        // Process existing participants
        const participants = this.room.getParticipants();

        // IMPORTANT: After reconnection, request video tracks from all participants
        if (this.reconnecting) {
            console.log('Reconnecting - requesting all participants to send tracks again');

            // Send identity message with a delay to allow BridgeChannel to initialize
            setTimeout(() => {
                this.sendIdentityMessage();

                // Request tracks from all participants
                participants.forEach(participant => {
                    const id = participant.getId();
                    // Request all tracks from this participant
                    this.requestParticipantTracks(id);
                });
            }, 3000); // Increase timeout to 3 seconds to ensure BridgeChannel is ready
        } else {
            // Normal flow for first connection
            participants.forEach(participant => {
                this.onUserJoined(participant.getId(), participant);
            });

            // Send identity after longer delay for new connections
            setTimeout(() => {
                this.sendIdentityMessage();
            }, 3000); // Increase timeout to 3 seconds
        }
    }


// New method to request tracks explicitly
    requestParticipantTracks(participantId) {
        // Send a message to request tracks
        if (this.room) {
            const message = {
                type: 'track_request',
                requesterId: this.myParticipantId,
                timestamp: Date.now()
            };

            try {
                this.room.sendEndpointMessage(participantId, {trackRequest: message});
                console.log(`Requested tracks from participant ${participantId}`);
            } catch (error) {
                console.error(`Failed to request tracks from ${participantId}`, error);
            }
        }
    }

    onUserJoined(id, user) {
        const displayName = user.getDisplayName() || "Участник";

        console.log(`User joined: ${id}, name: ${displayName}`);

        // Check if this user ID is already in participants map
        if (this.participants.has(id)) {
            console.log(`User ID ${id} already in participants map, updating`);
            this.participants.get(id).displayName = displayName;
            return;
        }

        // Add to participants map first
        this.participants.set(id, {
            id,
            displayName,
            tracks: new Map()
        });

        // Initialize visibility if not set
        if (!this.userVisibility.has(displayName)) {
            this.userVisibility.set(displayName, true);
        }

        // Check if there's already a section for this display name
        const existingSection = this.getParticipantSection(displayName);

        if (existingSection && displayName !== this.userName) {
            console.log(`Using existing section for user with same name: ${displayName}`);
            // No need to create a new section - the video tracks will be added
            // to the existing section when they arrive in onRemoteTrackAdded
        } else {
            // Create a new section only if we don't have one with this name
            // or if it's the local user
            this.createParticipantSection(id, displayName);
        }

        // Process any existing tracks from this participant
        if (user.getTracks) {
            const existingTracks = user.getTracks();
            existingTracks.forEach(track => this.onRemoteTrackAdded(track));
        }

        // Update user counts
        this.updateUserCount(displayName).then(() => {
            // Update UI
            this.updateUsersList();
        });
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            console.error(message);

            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }

    async loadDeviceConfig() {
        try {
            const response = await fetch(`/api/conference/devices?conferenceId=${this.conferenceId}&userName=${this.userName}`);
            if (!response.ok) {
                throw new Error('Failed to load device configuration');
            }
            this.deviceConfig = await response.json();
            return this.deviceConfig;
        } catch (error) {
            console.error('Error loading device configuration:', error);
            this.showError('Ошибка загрузки конфигурации устройств');
            throw error;
        }
    }


    async init() {
        try {
            document.getElementById('loading').style.display = 'flex';

            // Check if this is a reconnection
            const storedUserId = sessionStorage.getItem('conferenceUserId');
            const storedConferenceId = sessionStorage.getItem('conferenceId');

            if (storedUserId === this.userName && storedConferenceId === this.conferenceId) {
                console.log('Detected page refresh/reconnection');
                this.reconnecting = true;

                // Add this line to force a small delay to ensure browser is ready
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Load device config for the current user
            await this.loadDeviceConfig();

            // Also load all users' camera configurations
            await this.loadAllUserCameraConfigurations();

            JitsiMeetJS.init({
                disableAudioLevels: true,
                disableRtx: true,
                disableSuspendVideo: true,
                enableAnalyticsLogging: false,
                disableRtcStats: true,
                analytics: {
                    disabled: true
                },
                rtcstats: {
                    enabled: false
                }
            });

            const options = {
                hosts: {
                    domain: 'meet.jitsi',
                    muc: 'muc.meet.jitsi',
                    focus: 'focus.meet.jitsi'
                },
                serviceUrl: 'http://localhost:5280/http-bind',
                bosh: '//localhost:5280/http-bind',
                websocket: 'ws://localhost:5280/xmpp-websocket',
                clientNode: 'http://jitsi.org/jitsimeet',
                enableWebsocket: true,
                openBridgeChannel: 'websocket',
                p2p: {
                    enabled: true
                },
                disableAudioLevels: true,
                disableSimulcast: false,
                enableRemb: true,
                enableTcc: true,
                resolution: 720,
                constraints: {
                    video: {
                        height: {
                            ideal: 720,
                            max: 720,
                            min: 180
                        }
                    }
                }
            };

            console.log("SETOPTIONS");

            this.connection = new JitsiMeetJS.JitsiConnection(null, null, options);
            console.log("SETCONNECTION");

            this.connection.addEventListener(
                JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
                () => this.onConnectionSuccess(options)
            );
            this.connection.addEventListener(
                JitsiMeetJS.events.connection.CONNECTION_FAILED,
                () => this.onConnectionFailed()
            );
            this.connection.addEventListener(
                JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
                () => this.onDisconnected()
            );

            await this.connection.connect();
            await this.initializeDevices();
            this.setupControlButtons();
            this.startUserCountUpdates();
            JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels.ERROR);

            this.connection.addEventListener(
                JitsiMeetJS.events.connection.CONNECTION_FAILED,
                (error) => {
                    console.error('Detailed Connection Failed:', error);
                    console.error('Error Details:', JSON.stringify(error, null, 2));
                    this.showError(`Подробная ошибка подключения: ${JSON.stringify(error)}`);
                }
            );

        } catch (error) {
            console.error('Initialization error:', error);
            this.showError(`Ошибка инициализации: ${error.message}`);
            document.getElementById('loading').style.display = 'none';
        }
        console.log("InitializedFinished");
    }
}