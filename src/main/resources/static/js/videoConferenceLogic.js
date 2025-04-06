class VideoConference {
    constructor(conferenceId ,userName) {
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
            this.showError('Ошибка подключения к конференции');
            document.getElementById('loading').style.display = 'none';
        }
    }

    sendIdentityMessage() {
        if (this.room) {
            const message = {
                type: 'identity',
                userName: this.userName,
                timestamp: Date.now()
            };
            this.room.sendEndpointMessage('', { identity: message });
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
    }
    onUserLeft(id) {
        console.log('User left:', id);
        const participant = this.participants.get(id);

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
                const section = document.querySelector(`[data-participant-id="${id}"]`);
                if (section) {
                    section.remove();
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

        this.userCounts.forEach((count, userName) => {
            // Skip rendering users who aren't in the participants list unless it's the local user
            if (!uniqueUsers.has(userName) && userName !== this.userName) {
                return;
            }

            const isVisible = this.userVisibility.get(userName) !== false;

            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <label class="user-checkbox">
                    <input type="checkbox"
                           data-username="${userName}"
                           ${isVisible ? 'checked' : ''}>
                    <span>${userName}</span>
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

    onRemoteTrackRemoved(track) {
        if (track.isLocal()) {
            return;
        }

        const participantId = track.getParticipantId();
        const trackId = track.getId();

        const section = document.querySelector(`[data-participant-id="${participantId}"]`);
        if (section) {
            const wrapper = document.querySelector(`[data-track-id="${trackId}"]`);
            if (wrapper) {
                wrapper.remove();
                this.updateSectionLayout(section);
            }
        }

        if (this.remoteTracks.has(participantId)) {
            const tracks = this.remoteTracks.get(participantId);
            if (tracks.has(trackId)) {
                tracks.delete(trackId);
            }

            if (tracks.size === 0) {
                this.remoteTracks.delete(participantId);
                const section = document.querySelector(`[data-participant-id="${participantId}"]`);
                if (section) {
                    section.remove();
                }
            }
        }
    }


    createParticipantSection(participantId, displayName) {
        // Check if section already exists for this participant
        let section = document.querySelector(`[data-participant-id="${participantId}"]`);
        if (section) {
            return section;
        }

        section = document.createElement('div');
        section.className = 'participant-section';
        if (this.userVisibility.get(displayName.split(' (')[0]) === false) {
            section.classList.add('hidden');
        }
        section.setAttribute('data-participant-id', participantId);
        section.setAttribute('data-size', '1');

        const nameDiv = document.createElement('div');
        nameDiv.className = 'participant-name';
        nameDiv.textContent = displayName;

        const camerasContainer = document.createElement('div');
        camerasContainer.className = 'cameras-container';
        camerasContainer.setAttribute('data-layout', '1');

        section.appendChild(nameDiv);
        section.appendChild(camerasContainer);
        document.getElementById('video-container').appendChild(section);

        return section;
    }



    // Обновим инициализацию камер
    createVideoPreview(track, label, index) {
        // Use "local" as the participant ID for local tracks
        let section = document.querySelector(`[data-participant-id="local"]`);

        if (!section) {
            section = this.createParticipantSection('local', this.userName);
        }

        const camerasContainer = section.querySelector('.cameras-container');

        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        wrapper.setAttribute('data-track-id', track.getId());

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        track.attach(video);

        const cameraLabel = document.createElement('div');
        cameraLabel.className = 'camera-label';
        cameraLabel.textContent = `${label || 'Камера'} ${index + 1}`;

        wrapper.appendChild(video);
        wrapper.appendChild(cameraLabel);
        camerasContainer.appendChild(wrapper);

        this.updateSectionLayout(section);
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
            const participant = this.participants.get(participantId);
            const displayName = participant ? participant.displayName : 'Участник';

            // Get or create section for this participant
            let section = document.querySelector(`[data-participant-id="${participantId}"]`);
            if (!section) {
                section = this.createParticipantSection(participantId, displayName);
            }

            const camerasContainer = section.querySelector('.cameras-container');

            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.setAttribute('data-track-id', track.getId());

            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;

            const label = document.createElement('div');
            label.className = 'camera-label';
            label.textContent = `Камера ${camerasContainer.children.length + 1}`;

            track.attach(video);
            wrapper.appendChild(video);
            wrapper.appendChild(label);
            camerasContainer.appendChild(wrapper);

            this.updateSectionLayout(section);

            video.play().catch(error => {
                console.error('Ошибка воспроизведения видео:', error);
            });
        } else if (track.getType() === 'audio') {
            const audio = document.createElement('audio');
            track.attach(audio);
            audio.play().catch(error => {
                console.error('Ошибка воспроизведения аудио:', error);
            });
        }
    }

    updateSectionLayout(section) {
        const camerasContainer = section.querySelector('.cameras-container');
        const cameraCount = camerasContainer.children.length;

        // Устанавливаем размер секции
        section.setAttribute('data-size', Math.min(Math.ceil(cameraCount / 2), 4));

        // Устанавливаем раскладку сетки
        camerasContainer.setAttribute('data-layout', cameraCount);
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

            const deviceConfig = this.deviceConfig;
            if (!deviceConfig || !deviceConfig.cameras) {
                throw new Error('Device configuration not loaded');
            }

            for (let index = 0; index < deviceConfig.cameras.length; index++) {
                const camera = deviceConfig.cameras[index];
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

                    this.localTracks.video.push(tracks[0]);
                    this.createVideoPreview(tracks[0], camera.label, index);

                    if (this.room) {
                        await this.room.addTrack(tracks[0]);
                    }
                } catch (e) {
                    console.error(`Error accessing camera: ${camera.label}`, e);
                    this.showError(`Ошибка доступа к камере: ${camera.label}`);
                }
            }
        } catch (error) {
            console.error('Error initializing devices:', error);
            this.showError('Ошибка инициализации устройств');
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
        this.showError('Ошибка подключения к серверу');
        document.getElementById('loading').style.display = 'none';
    }

    onDisconnected() {
        if (this.userUpdateInterval) {
            clearInterval(this.userUpdateInterval);
        }
        console.log('Соединение разорвано');
    }

    async onConferenceJoined() {
        console.log('Конференция успешно подключена');
        this.isInitialized = true;

        // Store the user's own participant ID
        this.myParticipantId = this.room.myUserId();
        console.log(`My participant ID on join: ${this.myParticipantId}`);

        // First check if this is a reconnection
        if (this.reconnecting) {
            console.log('Handling reconnection in onConferenceJoined');
            // For reconnections, we don't update user count to avoid duplicates
        } else {
            // For new connections, update user count if not already in conference
            if (!this.isUserAlreadyInConference(this.userName)) {
                await this.updateUserCount(this.userName);
            }
        }

        this.updateUsersList();

        // Fetch and process existing participants
        const participants = this.room.getParticipants();
        participants.forEach(participant => {
            this.onUserJoined(participant.getId(), participant);
        });

        // Add a short delay before sending identity message
        setTimeout(() => {
            try {
                this.sendIdentityMessage();
                console.log('Identity message sent successfully');
            } catch (error) {
                console.error('Error sending identity message:', error);
            }
        }, 1000); // Wait 1 second
    }

    onUserJoined(id, user) {
        const displayName = user.getDisplayName() || null;

        console.log(`User joined: ${id}, name: ${displayName}`);

        // Check if this is the user's own connection from another tab/window
        if ((displayName === this.userName && id !== this.myParticipantId)  || displayName === 'Участник') {
            console.log(`Detected own user from another connection: ${id}`);
            // Don't create duplicate UI elements for the same user
            if (this.reconnecting || displayName === 'Участник') {
                console.log('Reconnection detected, skipping duplicate UI creation');
                return;
            }
        }

        // Don't add duplicate participant entries
        if (this.participants.has(id)) {
            console.log(`User ID ${id} already in participants map, updating`);
            this.participants.get(id).displayName = displayName;
            return;
        }

        // Check if we already have sections with this display name
        const existingSectionsWithName = Array.from(document.querySelectorAll('.participant-section'))
            .filter(section => {
                const nameDiv = section.querySelector('.participant-name');
                return nameDiv && nameDiv.textContent === displayName;
            });

        // If we're reconnecting and we already have a section for this user name, don't create another
        if (this.reconnecting && existingSectionsWithName.length > 0 && displayName === this.userName) {
            console.log(`Skipping duplicate UI creation for reconnecting user ${displayName}`);
            // Just add to participants map but don't create UI elements
            this.participants.set(id, {
                id,
                displayName,
                tracks: new Map()
            });
            return;
        }

        // Mark as processed to avoid duplicate UI elements
        this.processedParticipants.add(id);

        // Add to participants map
        this.participants.set(id, {
            id,
            displayName,
            tracks: new Map()
        });

        // Initialize visibility if not set
        if (!this.userVisibility.has(displayName)) {
            this.userVisibility.set(displayName, true);
        }

        // Update user counts
        this.updateUserCount(displayName).then(count => {
            // Check if UI section already exists for this participant
            const existingSections = Array.from(document.querySelectorAll('.participant-section'))
                .filter(section => section.getAttribute('data-participant-id') === id);

            if (existingSections.length === 0) {
                const section = this.createParticipantSection(id, displayName);

                // Process any existing tracks from this participant
                if (user.getTracks) {
                    const existingTracks = user.getTracks();
                    existingTracks.forEach(track => this.onRemoteTrackAdded(track));
                }
            }

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

    async updateUserCount(userName) {
        try {
            // Skip if we're reconnecting and the user is the local user
            if (this.reconnecting && userName === this.userName) {
                console.log('Skipping user count update for reconnecting user');
                return this.userCounts.get(userName) || 1;
            }

            const response = await fetch(`/conference/updateUserJoinCount?userName=${encodeURIComponent(userName)}&conferenceId=${this.conferenceId}`);
            if (!response.ok) {
                throw new Error('Failed to update user count');
            }
            const count = await response.json().catch(() => 0);

            // Update the count
            this.userCounts.set(userName, count);
            this.updateUsersList();
            return count;
        } catch (error) {
            console.error('Error updating user count:', error);
            this.showError('Ошибка обновления количества пользователей');
            return null;
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
            }

            await this.loadDeviceConfig();

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