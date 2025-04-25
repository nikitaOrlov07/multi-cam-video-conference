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
        this.userUpdateInterval = null;
        this.reconnecting = false;
        this.myParticipantId = null;
        this.displayNameToSectionMap = new Map();
        this.cameraOrderMap = new Map();
    }

    async onConnectionSuccess(options) {
        try {
            console.log('Connection established successfully=====================');

            // Update user count immediately when connecting
            await ConferenceUtils.updateUserCount(
                this.conferenceId,
                this.userName,
                this.userCounts,
                this.displayName,
                this.reconnecting,
                () => ConferenceUtils.updateUsersList()
            );

            // Clean up any potential duplicate video elements before initializing a new room
            if (this.reconnecting) {
                await this.cleanupBeforeReconnection();
            }

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

            if (this.reconnecting) {
                console.log("Waiting before join to avoid connection conflicts");
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            await this.room.join();
            this.myParticipantId = this.room.myUserId();
            console.log(`My participant ID: ${this.myParticipantId}`);

            if (this.reconnecting) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const participants = this.room.getParticipants();
            participants.forEach(participant => {
                this.onUserJoined(participant.getId(), participant);
            });

            // Broadcast user join to notify all participants to update their user counts
            if (this.room && this.room.getBridgeChannel && this.room.getBridgeChannel()) {
                const message = {
                    type: 'user_joined',
                    userName: this.userName,
                    timestamp: Date.now()
                };
                this.room.sendEndpointMessage('', {userStatus: message});
            }

            document.getElementById('loading').style.display = 'none';
        } catch (error) {
            console.error('Conference connection error:', error);
            ConferenceUtils.showError('Conference connection error');
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
        if (message && message.userStatus) {
            const statusMessage = message.userStatus;
            if (statusMessage.type === 'user_joined' || statusMessage.type === 'user_left') {
                console.log(`Received user status update: ${statusMessage.type} for ${statusMessage.userName}`);
                this.userCounts.forEach((_, userName) => {
                    ConferenceUtils.updateUserCount(
                        this.conferenceId,
                        userName,
                        this.userCounts,
                        this.displayName,
                        false,
                        () => ConferenceUtils.updateUsersList()
                    );
                });
            }
        }
        if (message && message.trackRequest && message.trackRequest.type === 'track_request') {
            console.log(`Received track request from ${participant.getId()}`);
            if (this.localTracks.video && this.localTracks.video.length > 0) {
                for (const track of this.localTracks.video) {
                    if (typeof track.isDisposed === 'function' && !track.isDisposed()) {
                        try {
                            console.log(`Re-sharing video track: ${track.getId()}`);
                            this.room.addTrack(track)
                                .catch(error => {
                                    console.log(`Note: Could not add video track (may already exist): ${error.message}`);
                                    setTimeout(() => {
                                        try {
                                            this.room.addTrack(track).catch(e => {
                                                console.log(`Second attempt to add track failed: ${e.message}`);
                                            });
                                        } catch (e) {
                                            console.error('Error in delayed track add:', e);
                                        }
                                    }, 2000);
                                });
                        } catch (error) {
                            console.error('Error re-sharing video track:', error);
                        }
                    }
                }
            }

            if (this.localTracks.audio &&
                typeof this.localTracks.audio.isDisposed === 'function' &&
                !this.localTracks.audio.isDisposed()) {
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
        if (message && message.trackInfo && message.trackInfo.type === 'track_available') {
            console.log(`Received track availability notification from ${participant.getId()}`);
            this.requestParticipantTracks(participant.getId());
        }
    }

    onUserLeft(id) {
        console.log('User left:', id);
        const participant = this.participants.get(id);

        // Skip processing if this is ourselves (can happen during page refresh)
        if (participant && participant.displayName === this.userName) {
            console.log('Ignoring user left event for local user');
            return;
        }

        if (participant) {
            const displayName = participant.displayName;
            const currentCount = this.userCounts.get(displayName);

            if (currentCount > 1) {
                this.userCounts.set(displayName, currentCount - 1);
            } else {
                this.userCounts.delete(displayName);
            }

            ConferenceUtils.updateUserCount(
                this.conferenceId,
                displayName,
                this.userCounts,
                this.displayName,
                false,
                () => ConferenceUtils.updateUsersList()
            ).then(() => {
                ConferenceUtils.updateUsersList();
                if (this.room && this.room.getBridgeChannel && this.room.getBridgeChannel()) {
                    const message = {
                        type: 'user_left',
                        userName: displayName,
                        timestamp: Date.now()
                    };
                    this.room.sendEndpointMessage('', {userStatus: message});
                }
            });
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
            const tracks = this.remoteTracks.get(id);
            tracks.forEach(track => {
                try {
                    track.detach();
                    track.dispose();
                } catch (e) {
                    console.error(`Error disposing track for leaving user: ${id}`, e);
                }
            });
            const elements = document.querySelectorAll(`[data-participant-id="${id}"]`);
            elements.forEach(element => element.remove());

            this.remoteTracks.delete(id);
        }
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
        console.log(`Remote track removed: ${trackId} from participant: ${participantId}`);
        try {
            track.detach();
        } catch (e) {
            console.error(`Error detaching track ${trackId}:`, e);
        }
        const wrapper = document.querySelector(`[data-track-id="${trackId}"]`);
        let section = null;
        if (wrapper) {
            section = wrapper.closest('.participant-section');
            wrapper.remove();

            if (section) {
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
                const removeTrack = tracks.get(trackId);
                if (removeTrack && typeof removeTrack.dispose === 'function') {
                    removeTrack.dispose();
                }
                tracks.delete(trackId);
            }
            if (tracks.size === 0) {
                this.remoteTracks.delete(participantId);
            }
        }
    }

    createParticipantSection(participantId, displayName) {
        let section = ConferenceUtils.getParticipantSection(displayName, this);
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
        if (this.userVisibility.get(displayName.split(' (')[0]) === false) {section.classList.add('hidden');}
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
        if (this.cameraOrderMap.has(orderKey)) {
            const config = this.cameraOrderMap.get(orderKey);
            cameraOrder = config.order;
            wrapper.setAttribute('data-camera-order', cameraOrder);
        } else {
            cameraOrder = index + 1;
            wrapper.setAttribute('data-camera-order', cameraOrder);
        }
        const cameraLabel = document.createElement('div');
        cameraLabel.className = 'camera-label';
        if (cameraOrder !== null) {
            cameraLabel.textContent = `${label || 'Camera'} ${cameraOrder}`;
        } else {
            cameraLabel.textContent = `${label || 'Camera'} ${index + 1}`;
        }
        wrapper.appendChild(video);
        wrapper.appendChild(cameraLabel);
        camerasContainer.appendChild(wrapper);
        this.updateSectionLayout(section);
        console.log(`Added camera ${label} to container. Total cameras: ${camerasContainer.querySelectorAll('.video-wrapper').length}`);
    }
    onRemoteTrackAdded(track) {
        if (track.isLocal()) {
            return;
        }
        const participantId = track.getParticipantId();
        const trackId = track.getId();
        if (this.remoteTracks.has(participantId) &&
            this.remoteTracks.get(participantId).has(trackId)) {
            console.log(`Track ${trackId} already exists, skipping duplicate`);
            return;
        }
        const existingTrackElement = document.querySelector(`[data-track-id="${trackId}"]`);
        if (existingTrackElement) {
            console.log(`Track ${trackId} is already displayed, skipping`);
            return;
        }
        console.log(`Remote track added - type: ${track.getType()}, participant: ${participantId}`);
        if (!this.remoteTracks.has(participantId)) {
            this.remoteTracks.set(participantId, new Map());
        }
        this.remoteTracks.get(participantId).set(trackId, track);
        if (track.getType() !== 'video') {
            if (track.getType() === 'audio') {
                const existingAudio = document.getElementById(`audio-${trackId}`);
                if (existingAudio) {
                    console.log(`Audio element for track ${trackId} already exists`);
                    return;
                }
                const audio = document.createElement('audio');
                audio.id = `audio-${trackId}`;
                try {
                    track.attach(audio);
                    console.log(`Successfully attached audio track ${trackId} to element ${audio.id}`);
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
            return;
        }
        console.log(`Processing video track: ${trackId} from participant ${participantId}`);
        const isValid = ConferenceUtils.isValidVideoTrack(track);
        console.log(`Video track validity check: ${isValid}`);
        if (!isValid) {
            console.log(`Skipping invalid video track from participant ${participantId}`);
            return;
        }
        const participant = this.participants.get(participantId);
        if (!participant) {
            console.error(`No participant found for ID ${participantId}, skipping track`);
            return;
        }
        const displayName = participant.displayName || 'Участник';
        if (this.reconnecting && displayName === this.displayName && participantId !== this.myParticipantId) {
            console.log(`Skipping track from another user with our display name during reconnection`);
            return;
        }
        let cameraOrder = null;
        if (participant.isTechnical && participant.cameraInfo) {
            const orderMatch = participant.cameraInfo.match(/camera(\d+)/);
            if (orderMatch && orderMatch[1]) {
                cameraOrder = parseInt(orderMatch[1], 10);
                console.log(`Found camera order ${cameraOrder} from technical user`);
            }
        }
        let section = ConferenceUtils.getParticipantSection(displayName, this);
        if (!section) {
            section = this.createParticipantSection(participantId, displayName);
            if (!section) {
                console.error(`Unable to create section for ${displayName} with ID ${participantId}`);
                return;
            }
        }
        const camerasContainer = section.querySelector('.cameras-container');
        if (!camerasContainer) {
            console.error(`No cameras container found for participant ${participantId}`);
            return;
        }
        if (document.querySelector(`[data-track-id="${trackId}"]`)) {
            console.log(`Track ${trackId} is already displayed, skipping`);
            return;
        }
        const placeholder = camerasContainer.querySelector('.no-camera-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        wrapper.setAttribute('data-track-id', trackId);
        wrapper.setAttribute('data-participant-id', participantId);
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.id = `video-${trackId}`;

        let deviceId = '';
        if (typeof track.getDeviceId === 'function') {
            deviceId = track.getDeviceId();
        } else {
            deviceId = trackId;
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
                console.error(`Video error for track ${trackId}:`, e);
            });
            track.attach(video);
            console.log(`Successfully attached track ${trackId} to video element ${video.id}`);
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
    }
    async initializeDevices() {
        try {
            const storedUserId = sessionStorage.getItem('conferenceUserId');
            const storedConferenceId = sessionStorage.getItem('conferenceId');
            if (storedUserId === this.userName && storedConferenceId === this.conferenceId) {
                this.reconnecting = true;
                console.log('Detected reconnection, handling accordingly');
                this.remoteTracks.forEach((tracks, participantId) => {
                    tracks.forEach(track => {
                        if (typeof track.dispose === 'function') {
                            track.dispose();
                        }
                    });
                });
                this.remoteTracks.clear();
            }
            sessionStorage.setItem('conferenceUserId', this.userName);
            sessionStorage.setItem('conferenceId', this.conferenceId);
            let displayName = this.userName;
            if (displayName.includes('_technical')) {
                displayName = displayName.split('_technical')[0];
            }
            this.displayName = displayName;if (!ConferenceUtils.getParticipantSection(this.userName, this)) {
                this.createParticipantSection("local", this.userName);
            }
            let section = document.querySelector(`[data-participant-id="local"]`);
            if (!section) {
                section = this.createParticipantSection('local', displayName);
                if (!section) {
                    console.error('Failed to create section for local user');
                }
            }
            if (this.reconnecting && section) {
                console.log('Reconnecting - preserving local tracks');
                if (this.localTracks.video && this.localTracks.video.length > 0) {
                    for (let i = 0; i < this.localTracks.video.length; i++) {
                        const track = this.localTracks.video[i];
                        const trackId = track.getId();
                        const wrapper = document.querySelector(`[data-track-id="${trackId}"]`);
                        if (!wrapper) {
                            console.log(`Creating missing preview for track ${trackId}`);
                            const deviceId = typeof track.getDeviceId === 'function' ? track.getDeviceId() : trackId;
                            const label = typeof track.getDeviceName === 'function' ? track.getDeviceName() : `Camera ${i+1}`;
                            this.createVideoPreview(track, label, i);
                        }
                    }
                }
            }
            try {
                if (!(this.reconnecting && this.localTracks.audio &&
                    typeof this.localTracks.audio.isDisposed === 'function' &&
                    !this.localTracks.audio.isDisposed())) {
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
                } else {
                    console.log('Keeping existing audio track during reconnection');
                }
            } catch (audioError) {
                console.error('Error initializing audio track:', audioError);
                ConferenceUtils.showError('Microphone access error');
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
                ConferenceUtils.updateUserCount(
                    this.conferenceId,
                    this.userName,
                    this.userCounts,
                    this.displayName,
                    this.reconnecting,
                    () => ConferenceUtils.updateUsersList()
                ).then(() => {
                    ConferenceUtils.updateUsersList();
                });
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
                        if (placeholder) {
                            placeholder.style.display = 'flex';
                        }
                    }
                }
                ConferenceUtils.updateUserCount(
                    this.conferenceId,
                    this.userName,
                    this.userCounts,
                    this.displayName,
                    this.reconnecting,
                    () => ConferenceUtils.updateUsersList()
                ).then(() => {
                    ConferenceUtils.updateUsersList();
                });
                document.getElementById('loading').style.display = 'none';
                return;
            }
            if (this.reconnecting &&
                this.localTracks.video &&
                this.localTracks.video.length === validCameras.length &&
                this.localTracks.video.every(track => typeof track.isDisposed === 'function' && !track.isDisposed())) {
                console.log('Keeping existing camera tracks during reconnection');
                for (const track of this.localTracks.video) {
                    if (this.room) {
                        try {
                            await this.room.addTrack(track);
                        } catch (e) {
                            console.log(`Note: Could not add video track (may already exist): ${e.message}`);
                        }
                    }
                }
            } else {
                if (!this.localTracks.video) {
                    this.localTracks.video = [];
                } else {
                    for (const track of this.localTracks.video) {
                        if (track && typeof track.dispose === 'function') {
                            track.dispose();
                        }
                    }
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
                        ConferenceUtils.showError(`Camera access error: ${camera.label}`);
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
                           ConferenceUtils.showError(`Camera access error for additional camera: ${camera.label}`);
                        }
                    }
                }
            }
            ConferenceUtils.updateUserCount(
                this.conferenceId,
                this.userName,
                this.userCounts,
                this.displayName,
                this.reconnecting,
                () => ConferenceUtils.updateUsersList()
            ).then(() => {
                ConferenceUtils.updateUsersList();
            });
        } catch (error) {
            console.error('Error initializing devices:', error);
            ConferenceUtils.showError('Device initialization error');
        }
        document.getElementById('loading').style.display = 'none';
    }

    async leaveConference() {
        sessionStorage.removeItem('conferenceUserId');
        sessionStorage.removeItem('conferenceId');
        try {
            const count = await ConferenceUtils.updateUserCount(
                this.conferenceId,
                this.userName,
                this.userCounts,
                this.displayName,
                false, // Not reconnecting, actively leaving
                () => ConferenceUtils.updateUsersList()
            );
            if (this.room && this.room.getBridgeChannel && this.room.getBridgeChannel()) {
                const message = {
                    type: 'user_left',
                    userName: this.userName,
                    timestamp: Date.now()
                };
                this.room.sendEndpointMessage('', {userStatus: message});
            }
        } catch (error) {
            console.error('Error updating user count during leave:', error);
        }
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
        ConferenceUtils.showError('Server connection error');
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
            this.myParticipantId = this.room.myUserId();
            console.log(`My participant ID on join: ${this.myParticipantId}`);
            this.participants.set("local", {
                id: "local",
                displayName: this.userName,
                tracks: new Map()
            });
            if (!ConferenceUtils.getParticipantSection(this.userName, this)) {
                this.createParticipantSection("local", this.userName);
            }
            if (!this.userCounts.has(this.userName)) {
                this.userCounts.set(this.userName, 1);
            }
            ConferenceUtils.updateUsersList();
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.sendIdentityMessage();
            const participants = this.room.getParticipants();
            if (this.localTracks.video && this.localTracks.video.length > 0) {
                for (let i = 0; i < this.localTracks.video.length; i++) {
                    const videoTrack = this.localTracks.video[i];
                    if (typeof videoTrack.isDisposed === 'function' && !videoTrack.isDisposed()) {
                        console.log(`Adding/re-adding video track ${i+1}: ${videoTrack.getId()}`);
                        try {
                            await this.room.addTrack(videoTrack);
                        } catch (error) {
                            console.log(`Could not add video track (may already exist): ${error.message}`);
                        }
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            }
            if (this.localTracks.audio &&
                typeof this.localTracks.audio.isDisposed === 'function' &&
                !this.localTracks.audio.isDisposed()) {
                try {
                    await this.room.addTrack(this.localTracks.audio);
                } catch (error) {
                    console.log(`Could not add audio track (may already exist): ${error.message}`);
                }
            }
            if (this.reconnecting) {
                console.log('Reconnecting - requesting tracks from other participants');
                participants.forEach(participant => {
                    const id = participant.getId();
                    const displayName = participant.getDisplayName();
                    if (displayName !== this.userName) {
                        this.requestParticipantTracks(id);
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 2000));
                this.broadcastTracks();
                this.cleanupStaleVideoElements();
            } else {
                participants.forEach(participant => {
                    this.onUserJoined(participant.getId(), participant);
                });
            }
        } catch (error) {
            console.error('Error in onConferenceJoined:', error);
        }
    }
    cleanupStaleVideoElements() {
        console.log('Cleaning up stale video elements');
        const videoElements = document.querySelectorAll('.video-wrapper video');
        videoElements.forEach(video => {
            const wrapper = video.closest('.video-wrapper');
            if (!wrapper) return;
            const trackId = wrapper.getAttribute('data-track-id');
            const participantId = wrapper.getAttribute('data-participant-id');
            let trackExists = false;
            if (participantId && this.remoteTracks.has(participantId)) {
                trackExists = this.remoteTracks.get(participantId).has(trackId);
            }
            if (!trackExists && this.localTracks.video) {
                trackExists = this.localTracks.video.some(t => t.getId() === trackId);
            }
            if (!trackExists) {
                console.log(`Removing stale video element for track ${trackId}`);
                wrapper.remove();
                const section = wrapper.closest('.participant-section');
                if (section) {
                    this.updateSectionLayout(section);
                    const camerasContainer = section.querySelector('.cameras-container');
                    if (camerasContainer && camerasContainer.querySelectorAll('.video-wrapper').length === 0) {
                        let placeholder = camerasContainer.querySelector('.no-camera-placeholder');
                        if (placeholder) {
                            placeholder.style.display = 'flex';
                        }}}}});}
    broadcastTracks() {
        if (!this.room) return;
        console.log('Broadcasting tracks to all participants');
        try {
            setTimeout(() => {
                const message = {
                    type: 'track_available',
                    senderId: this.myParticipantId,
                    timestamp: Date.now()
                };
                this.room.sendEndpointMessage('', {trackInfo: message});
                if (this.localTracks.video && this.localTracks.video.length > 0) {
                    this.localTracks.video.forEach((track, index) => {
                        setTimeout(() => {
                            if (track && typeof track.isDisposed === 'function' && !track.isDisposed()) {
                                console.log(`Re-sharing video track during broadcast: ${track.getId()}`);
                                try {
                                    this.room.addTrack(track).catch(error => {
                                        console.log(`Note: Could not re-add video track during broadcast: ${error.message}`);
                                    });
                                } catch (error) {
                                    console.error('Error re-sharing video track during broadcast:', error);
                                }
                            }
                        }, index * 800);
                    });
                }
                setTimeout(() => {
                    if (this.localTracks.audio &&
                        typeof this.localTracks.audio.isDisposed === 'function' &&
                        !this.localTracks.audio.isDisposed()) {
                        try {
                            this.room.addTrack(this.localTracks.audio).catch(error => {
                                console.log(`Note: Could not re-add audio track during broadcast: ${error.message}`);
                            });
                        } catch (error) {
                            console.error('Error re-sharing audio track during broadcast:', error);
                        }
                    }
                }, (this.localTracks.video?.length || 0) * 800 + 1000);
            }, 1500);
        } catch (error) {
            console.error('Error broadcasting tracks:', error);
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
        let displayName = user.getDisplayName() || "User";
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
        const existingSection = ConferenceUtils.getParticipantSection(baseName, this);
        if (existingSection && baseName !== this.displayName) {
            console.log(`Using existing section for user with same name: ${baseName}`);
        } else {
            this.createParticipantSection(id, baseName);
        }
        if (user.getTracks) {
            const existingTracks = user.getTracks();
            existingTracks.forEach(track => this.onRemoteTrackAdded(track));
        }
        ConferenceUtils.updateUserCount(
            this.conferenceId,
            baseName,
            this.userCounts,
            this.displayName,
            this.reconnecting,
            () => ConferenceUtils.updateUsersList()
        ).then(() => {
            ConferenceUtils.updateUsersList();
        });
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
    async cleanupBeforeReconnection() {
        const allVideoElements = document.querySelectorAll('.video-wrapper');
        const trackIds = new Map();
        allVideoElements.forEach(wrapper => {
            const trackId = wrapper.getAttribute('data-track-id');
            if (trackId) {
                if (trackIds.has(trackId)) {
                    console.log(`Removing duplicate video for track ${trackId}`);
                    wrapper.remove();
                } else {
                    trackIds.set(trackId, wrapper);
                }
            }
        });
        const technicalUsers = Array.from(this.participants.values())
            .filter(p => p.isTechnical && p.displayName === this.userName);
        for (const user of technicalUsers) {
            console.log(`Clearing technical user: ${user.id}`);
            this.participants.delete(user.id);
            if (this.remoteTracks.has(user.id)) {
                const tracks = this.remoteTracks.get(user.id);
                tracks.forEach(track => {
                    if (track && typeof track.dispose === 'function') {
                        track.dispose();
                    }
                });
                this.remoteTracks.delete(user.id);
            }
        }
        this.processedParticipants = new Set();
        await new Promise(resolve => setTimeout(resolve, 800));
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
           ConferenceUtils.showError(`Camera access error: ${label}`);
            document.getElementById('loading').style.display = 'none';
        }
    }
    async init() {
        try {
            document.getElementById('loading').style.display = 'flex';
            ConferenceUtils.setGlobalConference(this);
            MoveSectionLogic.initializeResizableAndDraggableSections();
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
                this.participants.clear();
                this.displayNameToSectionMap.clear();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            this.deviceConfig = await ConferenceUtils.loadDeviceConfig(this.conferenceId , this.userName);
            console.debug("Setting Device COnfig" , this.deviceConfig)
            await ConferenceUtils.loadAllUserCameraConfigurations(this.conferenceId);
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
                },
                enableConnectionRecovery: true,
                connectionRecoveryTimeout: 10000
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
                    setInterval(() => {
                        if (this.room && this.room.isJoined()) {
                            this.broadcastTracks();
                        }
                    }, 60000);
                }
            }

            await ConferenceUtils.setupControlButtons(this);
            ConferenceUtils.startUserCountUpdates();
            JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels.ERROR);
            this.connection.addEventListener(
                JitsiMeetJS.events.connection.CONNECTION_FAILED,
                (error) => {
                    console.error('Detailed Connection Failed:', error);
                    console.error('Error Details:', JSON.stringify(error, null, 2));
                    ConferenceUtils.showError(`Подробная ошибка подключения: ${JSON.stringify(error)}`);
                }
            );
            if (this.reconnecting) {
                const existingVideoWrappers = document.querySelectorAll('.video-wrapper');
                const processedTrackIds = new Set();


                existingVideoWrappers.forEach(wrapper => {
                    const trackId = wrapper.getAttribute('data-track-id');
                    if (processedTrackIds.has(trackId)) {
                        console.log(`Removing duplicate video wrapper for track ${trackId}`);
                        wrapper.remove();
                    } else {
                        processedTrackIds.add(trackId);
                    }
                });
            }
        } catch (error) {
            console.error('Initialization error:', error);
            ConferenceUtils.showError(`Ошибка инициализации: ${error.message}`);
            document.getElementById('loading').style.display = 'none';
        }
        console.log("InitializedFinished");
    }
}