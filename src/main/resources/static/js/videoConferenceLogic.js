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
        this.reconnecting = false;
        this.myParticipantId = null;
        this.displayNameToSectionMap = new Map();
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
            deviceConfigs.forEach(config => {
                const userName = config.userName;
                const gridRows = config.gridRows || 2;
                const gridCols = config.gridCols || 2;
                if (config.cameraConfiguration) {
                    try {
                        const cameras = JSON.parse(config.cameraConfiguration);
                        cameras.forEach(camera => {
                            const key = `${userName}_${camera.deviceId}`;
                            this.cameraOrderMap.set(key, {
                                order: camera.order,
                                gridRows: gridRows,
                                gridCols: gridCols
                            });
                        });
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
            let displayName = userName;
            if (displayName && displayName.includes('_technical')) {
                displayName = displayName.split('_technical')[0];
            }
            if (this.reconnecting && displayName === this.displayName) {
                console.log('Skipping user count update for reconnecting user');
                return Promise.resolve(this.userCounts.get(displayName) || 1);
            }
            if (displayName === this.displayName) {
                if (!this.userCounts.has(displayName)) {
                    this.userCounts.set(displayName, 1);
                }
                this.updateUsersList();
                return Promise.resolve(this.userCounts.get(displayName));
            }
            return fetch(`/conference/updateUserJoinCount?userName=${encodeURIComponent(displayName)}&conferenceId=${this.conferenceId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to update user count');
                    }
                    return response.json().catch(() => 0);
                })
                .then(count => {
                    this.userCounts.set(displayName, count);
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
            let displayName = this.userName;
            if (displayName.includes('_technical')) {
                displayName = displayName.split('_technical')[0];
            }
            this.displayName = displayName;
            this.room.setDisplayName(displayName);
            await this.room.join();
            this.myParticipantId = this.room.myUserId();
            console.log(`My participant ID: ${this.myParticipantId}`);
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
                setTimeout(() => this.sendIdentityMessage(), 2000);
            }
        } else {
            console.warn('BridgeChannel not ready, will retry in 2 seconds');
            setTimeout(() => this.sendIdentityMessage(), 2000);
        }
    }

    onEndpointMessageReceived(participant, message) {
        if (message && message.identity && message.identity.type === 'identity') {
            const participantId = participant.getId();
            const userName = message.identity.userName;
            console.log(`Received identity from ${participantId}: ${userName}`);
            if (this.participants.has(participantId)) {
                const existingParticipant = this.participants.get(participantId);
                existingParticipant.displayName = userName;
                const section = document.querySelector(`[data-participant-id="${participantId}"]`);
                if (section) {
                    const nameDiv = section.querySelector('.participant-name');
                    if (nameDiv) {
                        nameDiv.textContent = userName;
                    }
                }
            }
        }
        if (message && message.trackRequest && message.trackRequest.type === 'track_request') {
            console.log(`Received track request from ${message.trackRequest.requesterId}`);
            if (this.localTracks.video && this.localTracks.video.length > 0) {
                for (const track of this.localTracks.video) {
                    if (typeof track.isDisposed === 'function' && !track.isDisposed()) {
                        try {
                            console.log(`Re-sharing video track: ${track.getId()}`);
                            this.room.addTrack(track)
                                .catch(error => {
                                    console.log(`Note: Could not add video track (may already exist): ${error.message}`);
                                });
                        } catch (error) {
                            console.error('Error re-sharing video track:', error);
                        }
                    }
                }
            }
            if (this.localTracks.audio && typeof this.localTracks.audio.isDisposed === 'function' && !this.localTracks.audio.isDisposed()) {
                try {
                    this.room.addTrack(this.localTracks.audio)
                        .catch(error => {
                            console.log(`Note: Could not add audio track (may already exist): ${error.message}`);
                        });
                } catch (error) {
                    console.error('Error re-sharing audio track:', error);
                }
            }
        }
    }

    onUserLeft(id) {
        console.log('User left:', id);
        const participant = this.participants.get(id);
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
        const uniqueUsers = new Set();
        this.participants.forEach(participant => {
            uniqueUsers.add(participant.displayName);
        });
        uniqueUsers.add(this.userName);
        uniqueUsers.forEach(userName => {
            if (!this.userCounts.has(userName)) {
                this.userCounts.set(userName, 1);
            }
        });
        if (!this.participants.has("local")) {
            this.participants.set("local", {
                id: "local",
                displayName: this.userName,
                tracks: new Map()
            });
        }
        this.userCounts.forEach((count, userName) => {
            if (!uniqueUsers.has(userName) && userName !== this.userName) {
                return;
            }
            const isVisible = this.userVisibility.get(userName) !== false;
            const isLocalUser = userName === this.userName;
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
        section.setAttribute('data-size', Math.min(4, Math.ceil(count / 2)));
        const displayName = section.querySelector('.participant-name').textContent;
        let gridRows = 2; let gridCols = 2;
        for (const [key, config] of this.cameraOrderMap.entries()) {
            if (key.startsWith(`${displayName}_`) && config.gridRows && config.gridCols) {
                gridRows = config.gridRows;
                gridCols = config.gridCols;
                break;
            }
        }
        camerasContainer.style.gridTemplateRows = `repeat(${gridRows}, 1fr)`;
        camerasContainer.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;
        videoWrappers.forEach(wrapper => {
            const order = wrapper.getAttribute('data-camera-order') || 999;
            const col = (order - 1) % gridCols;
            const row = Math.floor((order - 1) / gridCols);
            wrapper.style.gridRow = `${row + 1}`;
            wrapper.style.gridColumn = `${col + 1}`;
        });
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
                const camerasContainer = section.querySelector('.cameras-container');
                if (camerasContainer) {
                    const videoWrappers = camerasContainer.querySelectorAll('.video-wrapper');
                    if (videoWrappers.length === 0) {
                        let placeholder = camerasContainer.querySelector('.no-camera-placeholder');

                        if (!placeholder) {
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
        let section = this.getParticipantSection(displayName);
        if (section) {
            console.log(`Using existing section for ${displayName}`);
            return section;
        }
        if (displayName === 'Участник') {
            console.log(`Skipping section creation for default participant: ${participantId}`);
            return null;
        }
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
        let gridRows = 2;
        let gridCols = 2;
        const gridConfigKey = `${displayName}_gridConfig`;
        if (this.cameraOrderMap.has(gridConfigKey)) {
            const config = this.cameraOrderMap.get(gridConfigKey);
            gridRows = config.gridRows || gridRows;
            gridCols = config.gridCols || gridCols;
        }
        camerasContainer.style.gridTemplateRows = `repeat(${gridRows}, 1fr)`;
        camerasContainer.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;
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
        noCameraPlaceholder.style.gridColumn = `1 / span ${gridCols}`;
        noCameraPlaceholder.style.gridRow = `1 / span ${gridRows}`;
        camerasContainer.appendChild(noCameraPlaceholder);
        section.appendChild(nameDiv);
        section.appendChild(camerasContainer);
        document.getElementById('video-container').appendChild(section);
        if (isLocalUser) {
            this.participants.set("local", {
                id: "local",
                displayName: this.userName,
                tracks: new Map()
            });
            if (!this.userCounts.has(this.userName)) {
                this.userCounts.set(this.userName, 1);
            }
        }
        this.displayNameToSectionMap.set(displayName, sectionId);

        return section;
    }
    createVideoPreview(track, label, index) {
        let section = document.querySelector(`[data-participant-id="local"]`);

        if (!section) {
            section = this.createParticipantSection('local', this.userName);
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
        let deviceId = '';
        if (typeof track.getDeviceId === 'function') {
            deviceId = track.getDeviceId();
        } else {
            deviceId = track.getId();
        }
        const orderKey = `${this.userName}_${deviceId}`;
        let cameraOrder = null;
        let gridConfig = null;
        if (this.cameraOrderMap.has(orderKey)) {
            const config = this.cameraOrderMap.get(orderKey);
            cameraOrder = config.order;
            wrapper.setAttribute('data-camera-order', cameraOrder);
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
        if (cameraOrder !== null) {
            cameraLabel.textContent = `${label || 'Камера'} ${cameraOrder}`;
        } else {
            cameraLabel.textContent = `${label || 'Камера'} ${index + 1}`;
        }
        wrapper.appendChild(video);
        wrapper.appendChild(cameraLabel);
        camerasContainer.appendChild(wrapper);
        this.updateSectionLayout(section);
        console.log(`Added camera ${label} to container. Total cameras: ${camerasContainer.querySelectorAll('.video-wrapper').length}`);
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
        console.log(`Remote track added - type: ${track.getType()}, participant: ${track.getParticipantId()}`);
        const participantId = track.getParticipantId();
        if (!this.remoteTracks.has(participantId)) {
            this.remoteTracks.set(participantId, new Map());
        }
        this.remoteTracks.get(participantId).set(track.getId(), track);
        if (track.getType() === 'video') {
            console.log(`Processing video track: ${track.getId()} from participant ${participantId}`);
            const isValid = this.isValidVideoTrack(track);
            console.log(`Video track validity check: ${isValid}`);
            if (!isValid) {
                console.log(`Attempting to process video track anyway from participant ${participantId}`);
            }
            const participant = this.participants.get(participantId);
            if (!participant) {
                console.error(`No participant found for ID ${participantId}, creating placeholder`);
                this.participants.set(participantId, {
                    id: participantId,
                    displayName: 'Unknown Participant',
                    tracks: new Map()
                });
            }
            const displayName = participant?.displayName || 'Участник';
            let cameraOrder = null;
            if (participant?.isTechnical && participant?.cameraInfo) {
                const orderMatch = participant.cameraInfo.match(/camera(\d+)/);
                if (orderMatch && orderMatch[1]) {
                    cameraOrder = parseInt(orderMatch[1], 10);
                    console.log(`Found camera order ${cameraOrder} from technical user`);
                }
            }
            let section = this.getParticipantSection(displayName);
            if (!section) {
                section = this.createParticipantSection(participantId, displayName);
                if (!section) {
                    console.error(`Unable to create section for ${displayName} with ID ${participantId}, creating emergency section`);
                    section = document.createElement('div');
                    section.className = 'participant-section';
                    section.setAttribute('data-participant-id', participantId);
                    section.setAttribute('data-size', '1');
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'participant-name';
                    nameDiv.textContent = displayName;
                    const camerasContainer = document.createElement('div');
                    camerasContainer.className = 'cameras-container';
                    camerasContainer.style.gridTemplateRows = 'repeat(2, 1fr)';
                    camerasContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
                    section.appendChild(nameDiv);
                    section.appendChild(camerasContainer);
                    document.getElementById('video-container').appendChild(section);
                    this.displayNameToSectionMap.set(displayName, participantId);
                }
            }
            const camerasContainer = section.querySelector('.cameras-container');
            if (!camerasContainer) {
                console.error(`No cameras container found for participant ${participantId} with name ${displayName}, creating one`);
                const newCamerasContainer = document.createElement('div');
                newCamerasContainer.className = 'cameras-container';
                newCamerasContainer.style.gridTemplateRows = 'repeat(2, 1fr)';
                newCamerasContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
                section.appendChild(newCamerasContainer);
                return;
            }
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
            video.id = `video-${track.getId()}`;
            let deviceId = '';
            if (typeof track.getDeviceId === 'function') {
                deviceId = track.getDeviceId();
            } else {
                deviceId = track.getId();
            }
            if (cameraOrder !== null) {
                wrapper.setAttribute('data-camera-order', cameraOrder);
            } else {
                const orderKey = `${displayName}_${deviceId}`;
                if (this.cameraOrderMap.has(orderKey)) {
                    cameraOrder = this.cameraOrderMap.get(orderKey).order;
                    wrapper.setAttribute('data-camera-order', cameraOrder);
                } else {
                    const existingWrappers = camerasContainer.querySelectorAll('.video-wrapper');
                    cameraOrder = existingWrappers.length + 1;
                    wrapper.setAttribute('data-camera-order', cameraOrder);
                }
            }
            const label = document.createElement('div');
            label.className = 'camera-label';
            label.textContent = `Камера ${cameraOrder || camerasContainer.querySelectorAll('.video-wrapper').length + 1}`;
            try {
                video.addEventListener('error', (e) => {
                    console.error(`Video error for track ${track.getId()}:`, e);});
                track.attach(video);
                console.log(`Successfully attached track ${track.getId()} to video element ${video.id}`);
                video.load();
            } catch (e) {
                console.error('Error attaching video track:', e);
                return;
            }
            wrapper.appendChild(video);
            wrapper.appendChild(label);
            camerasContainer.appendChild(wrapper);
            this.updateSectionLayout(section);
            video.play().catch(error => {
                console.error('Video playback error:', error);
                video.muted = true;
                video.play().catch(e => {
                    console.error('Second video playback attempt failed:', e);
                    wrapper.remove();
                    this.updateSectionLayout(section);
                    if (camerasContainer.querySelectorAll('.video-wrapper').length === 0 && placeholder) {
                        placeholder.style.display = 'flex';
                    }
                });
            });
        } else if (track.getType() === 'audio') {
            const audio = document.createElement('audio');
            audio.id = `audio-${track.getId()}`;
            try {
                track.attach(audio);
                console.log(`Successfully attached audio track ${track.getId()} to element ${audio.id}`);
                audio.play().catch(error => {
                    console.error('Audio playback error:', error);
                    audio.muted = true;
                    audio.play().catch(e => {
                        console.error('Second audio playback attempt failed:', e);
                    });
                });
            } catch (e) {
                console.error('Error attaching audio track:', e);
            }
        }
    }
    async initializeDevices() {
        try {
            const storedUserId = sessionStorage.getItem('conferenceUserId');
            const storedConferenceId = sessionStorage.getItem('conferenceId');
            if (storedUserId === this.userName && storedConferenceId === this.conferenceId) {
                this.reconnecting = true;
                console.log('Detected reconnection, handling accordingly');
            }
            sessionStorage.setItem('conferenceUserId', this.userName);
            sessionStorage.setItem('conferenceId', this.conferenceId);
            let displayName = this.userName;
            if (displayName.includes('_technical')) {
                displayName = displayName.split('_technical')[0];
            }
            this.displayName = displayName;
            if (this.reconnecting && this.isUserAlreadyInConference(displayName)) {
                console.log('User already in conference, skipping device initialization');
                document.getElementById('loading').style.display = 'none';
                return;
            }
            let section = document.querySelector(`[data-participant-id="local"]`);
            if (!section) {
                section = this.createParticipantSection('local', displayName);
                if (!section) {
                    console.error('Failed to create section for local user');
                }
            }
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
            const deviceConfig = this.deviceConfig;
            if (!deviceConfig) {
                console.log('No device configuration available, joining with audio only');
                if (section) {
                    const camerasContainer = section.querySelector('.cameras-container');
                    if (camerasContainer) {
                        let placeholder = camerasContainer.querySelector('.no-camera-placeholder');
                        if (placeholder) {
                            placeholder.style.display = 'flex';
                        }
                    }
                }
                this.updateUserCount(displayName);
                this.updateUsersList();
                document.getElementById('loading').style.display = 'none';
                return;
            }
            let cameras = [];
            try {
                if (deviceConfig.cameraConfiguration && typeof deviceConfig.cameraConfiguration === 'string') {
                    cameras = JSON.parse(deviceConfig.cameraConfiguration);
                } else if (Array.isArray(deviceConfig.cameras)) {
                    cameras = deviceConfig.cameras;
                }
            } catch (parseError) {
                console.error('Error parsing camera configuration:', parseError);
                cameras = [];
            }

            const validCameras = cameras.filter(camera =>
                camera && camera.label && typeof camera.label === 'string' && !camera.label.includes('Камера')
            );

            if (validCameras.length === 0) {
                console.warn('No valid cameras found after filtering');
                if (section) {
                    const camerasContainer = section.querySelector('.cameras-container');
                    if (camerasContainer) {
                        let placeholder = camerasContainer.querySelector('.no-camera-placeholder');
                        if (placeholder) {placeholder.style.display = 'flex';}
                    }
                }
                this.updateUserCount(displayName);
                this.updateUsersList();
                document.getElementById('loading').style.display = 'none';
                return;
            }
            if (!this.localTracks.video) {
                this.localTracks.video = [];
            }
            if (validCameras.length > 0) {
                const camera = validCameras[0];
                try {
                    console.log(`Initializing primary camera: ${camera.label} (${camera.deviceId})`);
                    const tracks = await JitsiMeetJS.createLocalTracks({
                        devices: ['video'],
                        cameraDeviceId: camera.deviceId,
                        constraints: {
                            video: {
                                deviceId: { exact: camera.deviceId },
                                height: { ideal: 480 },
                                width: { ideal: 640 }
                            }
                        }
                    });
                    if (tracks && tracks.length > 0 && tracks[0]) {
                        const track = tracks[0];
                        this.localTracks.video.push(track);
                        this.createVideoPreview(track, camera.label, 0);
                        if (this.room) {
                            try {
                                await this.room.addTrack(track);
                                console.log(`Added primary camera ${camera.label} to room`);
                            } catch (trackError) {
                                console.error(`Error adding track to room: ${camera.label}`, trackError);
                            }
                        }
                        console.log(`Successfully added primary camera ${camera.label} with order ${camera.order || 1}`);
                    }
                } catch (e) {
                    console.error(`Error accessing camera: ${camera.label}`, e);
                    this.showError(`Camera access error: ${camera.label}`);
                }
            }
            if (validCameras.length > 1) {
                console.log(`Creating ${validCameras.length - 1} technical users for additional cameras`);
                for (let i = 1; i < validCameras.length; i++) {
                    const camera = validCameras[i];
                    const technicalUserName = `${this.userName}_technical${i}_camera${i+1}`;
                    console.log(`Creating technical user: ${technicalUserName} for camera: ${camera.label} (${camera.deviceId})`);
                    try {
                        const additionalTracks = await JitsiMeetJS.createLocalTracks({
                            devices: ['video'],
                            cameraDeviceId: camera.deviceId,
                            constraints: {
                                video: {
                                    deviceId: { exact: camera.deviceId },
                                    height: { ideal: 480 },
                                    width: { ideal: 640 }
                                }
                            }
                        });
                        if (additionalTracks && additionalTracks.length > 0 && additionalTracks[0]) {
                            const additionalTrack = additionalTracks[0];
                            this.localTracks.video.push(additionalTrack);
                            this.createVideoPreview(additionalTrack, camera.label, i);
                            await this.createTechnicalUserWithCamera(technicalUserName, additionalTrack, camera);
                            console.log(`Successfully set up technical user ${technicalUserName} with camera ${camera.label}`);
                        }
                    } catch (e) {
                        console.error(`Error setting up technical user for camera: ${camera.label}`, e);
                        this.showError(`Camera access error for additional camera: ${camera.label}`);
                    }
                }
            }
            this.updateUserCount(displayName);
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
        if (!this.userName.includes('_technical')) {
            const technicalFrames = document.querySelectorAll('iframe[id^="technical-frame-"]');
            technicalFrames.forEach(frame => {
                frame.remove();
            });
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
    async onConferenceJoined() {
        try {
            console.log('The conference has been successfully connected');
            this.isInitialized = true;
            this.myParticipantId = this.room.myUserId();
            console.log(`My participant ID on join: ${this.myParticipantId}`);
            this.participants.set("local", {
                id: "local",
                displayName: this.userName,
                tracks: new Map()
            });
            if (!this.getParticipantSection(this.userName)) {
                this.createParticipantSection("local", this.userName);
            }
            if (!this.userCounts.has(this.userName)) {
                this.userCounts.set(this.userName, 1);
            }
            this.updateUsersList();
            const participants = this.room.getParticipants();
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.sendIdentityMessage();
            if (this.reconnecting) {
                console.log('Reconnecting - requesting all participants to send tracks again');
                participants.forEach(participant => {
                    const id = participant.getId();
                    this.requestParticipantTracks(id);
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (this.localTracks.video && this.localTracks.video.length > 0) {
                    for (const videoTrack of this.localTracks.video) {
                        if (typeof videoTrack.isDisposed === 'function' &&
                            !videoTrack.isDisposed()) {
                            console.log(`Re-adding video track after reconnection`);
                            try {
                                await this.room.addTrack(videoTrack);
                            } catch (error) {
                                console.log(`Could not re-add video track (may already exist): ${error.message}`);
                            }
                        }
                    }
                }
                if (this.localTracks.audio &&
                    typeof this.localTracks.audio.isDisposed === 'function' &&
                    !this.localTracks.audio.isDisposed()) {
                    try {
                        await this.room.addTrack(this.localTracks.audio);
                    } catch (error) {
                        console.log(`Could not re-add audio track (may already exist): ${error.message}`);
                    }
                }
            } else {
                participants.forEach(participant => {
                    this.onUserJoined(participant.getId(), participant);
                });
            }
        } catch (error) {
            console.error('Error in onConferenceJoined:', error);
        }
    }
    requestParticipantTracks(participantId) {
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
        let displayName = user.getDisplayName() || "Участник";
        let baseName = displayName;
        let isTechnicalUser = false;
        let cameraInfo = null;
        if (displayName.includes('_technical')) {
            const parts = displayName.split('_');
            baseName = parts[0];
            isTechnicalUser = true;
            for (const part of parts) {
                if (part.startsWith('camera')) {
                    cameraInfo = part;
                    break;
                }
            }
        }
        console.log(`User joined: ${id}, name: ${displayName}, base name: ${baseName}`);
        if (this.participants.has(id)) {
            console.log(`User ID ${id} already in participants map, updating`);
            this.participants.get(id).displayName = baseName;
            return;
        }
        this.participants.set(id, {
            id,
            displayName: baseName,
            isTechnical: isTechnicalUser,
            cameraInfo: cameraInfo,
            tracks: new Map()
        });
        if (!this.userVisibility.has(baseName)) {
            this.userVisibility.set(baseName, true);
        }
        const existingSection = this.getParticipantSection(baseName);
        if (existingSection && baseName !== this.displayName) {
            console.log(`Using existing section for user with same name: ${baseName}`);
        } else {
            this.createParticipantSection(id, baseName);
        }
        if (user.getTracks) {
            const existingTracks = user.getTracks();
            existingTracks.forEach(track => this.onRemoteTrackAdded(track));
        }
        this.updateUserCount(baseName).then(() => {
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
            this.showError('Ошибка загрузки конфигурации устройств');
            throw error;
        }
    }
    async createTechnicalUserWithCamera(technicalUserName, videoTrack, camera) {
        try {
            const technicalConnection = new JitsiMeetJS.JitsiConnection(
                null,
                null,
                this.connectionOptions
            );
            if (!this.technicalConnections) {
                this.technicalConnections = [];
            }
            this.technicalConnections.push(technicalConnection);
            await new Promise((resolve, reject) => {
                technicalConnection.addEventListener(
                    JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
                    resolve
                );
                technicalConnection.addEventListener(
                    JitsiMeetJS.events.connection.CONNECTION_FAILED,
                    reject
                );
                technicalConnection.connect();
            });
            console.log(`Technical user ${technicalUserName} connected successfully`);
            const technicalRoom = technicalConnection.initJitsiConference(
                this.conferenceId,
                this.conferenceOptions
            );
            if (!this.technicalRooms) {
                this.technicalRooms = [];
            }
            this.technicalRooms.push(technicalRoom);
            technicalRoom.setDisplayName(technicalUserName);
            await new Promise((resolve) => {
                technicalRoom.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, resolve);
                technicalRoom.join();
            });
            console.log(`Technical user ${technicalUserName} joined conference room`);
            await technicalRoom.addTrack(videoTrack);
            console.log(`Added camera ${camera.label} to room via technical user ${technicalUserName}`);
            return technicalRoom;
        } catch (error) {
            console.error(`Error creating technical user ${technicalUserName}:`, error);
            throw error;
        }
    }
    async initializeTechnicalCamera(deviceId, label, order) {
        try {
            console.log(`Technical user initializing camera: ${label} (${deviceId}) with order ${order}`);

            const tracks = await JitsiMeetJS.createLocalTracks({
                devices: ['video'],
                cameraDeviceId: deviceId,
                constraints: {
                    video: {
                        deviceId: { exact: deviceId },
                        height: { ideal: 480 },
                        width: { ideal: 640 }
                    }
                }
            });

            if (!tracks || tracks.length === 0 || !tracks[0]) {
                console.log(`No tracks created for technical camera: ${label}`);
                return;
            }

            const track = tracks[0];
            if (!this.localTracks.video) {
                this.localTracks.video = [];
            }
            this.localTracks.video.push(track);
            if (this.room) {
                try {
                    await this.room.addTrack(track);
                    console.log(`Technical user added camera ${label} to room`);
                } catch (trackError) {
                    console.error(`Error adding technical track to room: ${label}`, trackError);
                }
            }

            document.getElementById('loading').style.display = 'none';
        } catch (error) {
            console.error(`Technical user error accessing camera: ${label}`, error);
            this.showError(`Camera access error: ${label}`);
            document.getElementById('loading').style.display = 'none';
        }
    }
    async init() {
        try {
            document.getElementById('loading').style.display = 'flex';
            let displayName = this.userName;
            const isTechnicalUser = displayName.includes('_technical');
            if (isTechnicalUser) {
                displayName = displayName.split('_technical')[0];
            }
            this.displayName = displayName;
            const storedUserId = sessionStorage.getItem('conferenceUserId');
            const storedConferenceId = sessionStorage.getItem('conferenceId');
            if (storedUserId === this.userName && storedConferenceId === this.conferenceId) {
                console.log('Detected page refresh/reconnection');
                this.reconnecting = true;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            await this.loadDeviceConfig();
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
            this.connectionOptions = {
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
                openBridgeChannel: 'websocket'
            };
            this.conferenceOptions = {
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
            this.connection = new JitsiMeetJS.JitsiConnection(null, null, this.connectionOptions);
            this.connection.addEventListener(
                JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
                () => this.onConnectionSuccess(this.conferenceOptions)
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
            if (!isTechnicalUser) {
                await this.initializeDevices();
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                const cameraDeviceId = urlParams.get('cameraDeviceId');
                const cameraLabel = urlParams.get('cameraLabel');
                const cameraOrder = urlParams.get('cameraOrder');
                if (cameraDeviceId) {
                    await this.initializeTechnicalCamera(cameraDeviceId, cameraLabel, cameraOrder);
                }
            }
            if (this.room) {
                await new Promise(resolve => {
                    if (this.room.isJoined()) {
                        resolve();
                    } else {
                        const onJoined = () => {
                            this.room.removeEventListener(
                                JitsiMeetJS.events.conference.CONFERENCE_JOINED,
                                onJoined
                            );
                            resolve();
                        };
                        this.room.addEventListener(
                            JitsiMeetJS.events.conference.CONFERENCE_JOINED,
                            onJoined
                        );
                        setTimeout(resolve, 5000);
                    }
                });
                if (!isTechnicalUser) {
                    await this.createTechnicalUsers();
                }
            }
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