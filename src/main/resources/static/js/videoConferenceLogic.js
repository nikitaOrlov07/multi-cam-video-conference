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
    }

    isUserAlreadyInConference(userName) {
        const usersList = document.getElementById('users-list');
        const existingUserElements = usersList.querySelectorAll('.user-item');
        for (const element of existingUserElements) {
            const checkbox = element.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.getAttribute('data-username') === userName) {
                return true;
            }
        }
        return false;
    }

    startUserCountUpdates() {
        // Clear any existing interval
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


            // Обновленные обработчики событий
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

            await this.room.join();
            this.room.setDisplayName(this.userName);

            // После успешного подключения запрашиваем список текущих участников
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


    onUserLeft(id) {
        console.log('User left:', id);
        const participant = this.participants.get(id);

        if (participant) {
            const displayName = participant.displayName;
            const currentCount = this.userCounts.get(displayName);

            // Update count but don't remove from lists
            if (currentCount > 1) {
                this.userCounts.set(displayName, currentCount - 1);
            }

            this.updateUsersList();
            this.participants.delete(id);

            // Only remove the section if there are no other participants with the same name
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

        this.userCounts.forEach((count, userName) => {
            // Получаем текущее состояние видимости (по умолчанию true)
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

            // Добавляем обработчик события для чекбокса
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
        const section = document.querySelector(`[data-participant-id="${participantId}"]`);
        if (section) {
            const wrapper = document.querySelector(`[data-track-id="${track.getId()}"]`);
            if (wrapper) {
                wrapper.remove();
                this.updateSectionLayout(section);
            }
        }

        if (this.remoteTracks.has(participantId)) {
            this.remoteTracks.get(participantId).delete(trackId);
            if (this.remoteTracks.get(participantId).size === 0) {
                this.remoteTracks.delete(participantId);
                const section = document.querySelector(`[data-participant-id="${participantId}"]`);
                if (section) {
                    section.remove();
                }
            }
        }
    }


    createParticipantSection(participantId, displayName) {
        const section = document.createElement('div');
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
        const section = this.createParticipantSection('local', this.userName);
        const camerasContainer = section.querySelector('.cameras-container');

        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';

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
        if (track.getType() === 'video') {
            const participant = this.participants.get(participantId);
            const displayName = participant ? participant.displayName : 'Участник';
            const section = this.createParticipantSection(participantId, displayName);
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

            // Обновляем размер секции и раскладку сетки
            this.updateSectionLayout(section);

            video.play().catch(error => {
                console.error('Ошибка воспроизведения видео:', error);
            });
        } else if (trackType === 'audio') {
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
            if (this.isUserAlreadyInConference(this.userName)) {
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
        console.log('Leave conference method is working ')
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

        // Выход из конференции
        if (this.room) {
            this.room.leave();
        }

        // Отключение соединения
        if (this.connection) {
            this.connection.disconnect();
        }

        /// Redirect to Post leave method
        // Make POST request to the constructed URL
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

        // Добавляем проверку на существование пользователя перед обновлением
        if (!this.isUserAlreadyInConference(this.userName)) {
            await this.updateUserCount(this.userName);
            this.updateUsersList();
        }

        const participants = this.room.getParticipants();
        participants.forEach(participant => {
            this.onUserJoined(participant.getId(), participant);
        });
    }


    onUserJoined(id, user) {
        const displayName = user.getDisplayName() || 'Участник';

        // Проверяем, был ли уже обработан этот participant ID
        if (this.processedParticipants.has(id)) {
            return;
        }

        // Проверяем, существует ли уже пользователь с таким именем
        if (this.isUserAlreadyInConference(displayName)) {
            console.log(`User ${displayName} already in conference, skipping`);
            return;
        }

        this.processedParticipants.add(id);

        // Обновляем счетчик пользователей с сервера
        this.updateUserCount(displayName).then(count => {
            this.participants.set(id, {
                id,
                displayName,
                tracks: new Map()
            });

            if (!this.userVisibility.has(displayName)) {
                this.userVisibility.set(displayName, true);
            }

            const existingSections = Array.from(document.querySelectorAll('.participant-section'))
                .filter(section => section.querySelector('.participant-name').textContent === displayName);

            if (existingSections.length === 0) {
                const section = this.createParticipantSection(id, displayName);

                if (user.getTracks) {
                    const existingTracks = user.getTracks();
                    existingTracks.forEach(track => this.onRemoteTrackAdded(track));
                }
            }
        });
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            console.error(message);

            // Автоматически скрываем сообщение об ошибке через 5 секунд
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

    // For updating user Account count from backend
    async updateUserCount(userName) {
        try {
            const response = await fetch(`/conference/updateUserJoinCount?userName=${encodeURIComponent(userName)}&conferenceId=${this.conferenceId}`);
            if (!response.ok) {
                throw new Error('Failed to update user count');
            }
            const count = await response.json();

            // Update the count regardless of value
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
                    focus: 'focus.meet.jitsi'  // Changed from guest.meet.jitsi
                },
                serviceUrl: 'http://localhost:5280/http-bind',  // Updated BOSH URL
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

            console.log("SETOPTIONS")


            this.connection = new JitsiMeetJS.JitsiConnection(null, null, options);
            console.log("SETCONNECTION")
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
        console.log("InitializedFinished")
    }
}