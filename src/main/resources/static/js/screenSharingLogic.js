const ScreenShareLogic = {
    initialize: function() {
        console.log("Start initialize screenSharing logic")
        if (typeof VideoConference !== 'undefined') {
            this.extendVideoConference();
        } else {
            console.error('VideoConference or AddCameraLogic not found. Make sure required scripts are loaded first.');
            document.addEventListener('videoConferenceReady', this.extendVideoConference.bind(this));
        }
    },

    extendVideoConference: function() {
        console.log("ScreenSharing extend video conference")
        VideoConference.prototype.startScreenShare = this.startScreenShare;
        VideoConference.prototype.stopScreenShare = this.stopScreenShare;
        VideoConference.prototype.initScreenShareControls = this.initScreenShareControls;
        VideoConference.prototype.isScreenSharingActive = this.isScreenSharingActive;
        VideoConference.prototype.toggleScreenSharing = this.toggleScreenSharing;
        VideoConference.prototype.getScreenShareOrder = this.getScreenShareOrder;
        VideoConference.prototype.removeTechnicalUserByTrackId = this.removeTechnicalUserByTrackId;
        VideoConference.prototype.updateGridConfiguration = this.updateGridConfiguration;
        VideoConference.prototype.showNoCameraPlaceholderIfNeeded = this.showNoCameraPlaceholderIfNeeded;

        const originalInit = VideoConference.prototype.init;
        VideoConference.prototype.init = async function() {
            await originalInit.call(this);

            // Initialize TechnicalUserManager for screen sharing
            this.screenShareManager = new TechnicalUserManager({
                conference: this,
                onTrackDisposed: (trackId) => {
                    console.log(`Screen share track ${trackId} disposed`);
                },
                onError: (error) => {
                    console.error('Screen share technical user error:', error);
                    ConferenceUtils.showError(`Screen sharing error: ${error.message || 'Unknown error'}`);
                }
            });

            await this.initScreenShareControls();
            console.log('Screen share controls initialized');
        };

        console.log('VideoConference class extended with screen sharing capabilities');
    },

    async startScreenShare() {
        try {
            if (this.screenTrack) {
                console.log('Screen sharing is already active');
                return;
            }

            console.log('Starting screen share');
            const tracks = await JitsiMeetJS.createLocalTracks({
                devices: ['desktop'],
                desktopSharingFrameRate: {
                    min: 5,
                    max: 15
                }
            });

            if (!tracks || tracks.length === 0) {
                console.error('No screen sharing track created');
                ConferenceUtils.showError('Failed to start screen sharing');
                return;
            }

            const screenTrack = tracks[0];
            this.screenTrack = screenTrack;

            screenTrack.addEventListener(JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED, () => {
                console.log('Screen sharing stopped via browser UI');
                this.stopScreenShare();
            });

            const screenLabel = 'Screen Share';
            const screenDeviceId = 'screen-share-device';

            const hasCameras = this.localTracks.video && this.localTracks.video.length > 0;
            const order = hasCameras ? this.localTracks.video.length + 1 : 1;

            if (!this.localTracks.video) {
                this.localTracks.video = [];
            }
            this.localTracks.video.push(screenTrack);

            const orderKey = `${this.userName}_${screenDeviceId}`;
            this.cameraOrderMap = this.cameraOrderMap || new Map();
            this.cameraOrderMap.set(orderKey, {
                order: order,
                label: screenLabel,
                isScreen: true
            });

            if (order > 1) {
                // Используем консистентное имя для technical user
                const technicalUserName = `${this.userName}_technical_screen${order}_${screenDeviceId}`;
                console.log(`Creating technical user: ${technicalUserName} for screen sharing`);

                const cameraInfo = {
                    deviceId: screenDeviceId,
                    label: screenLabel,
                    order: order,
                    isScreen: true
                };

                try {
                    await this.screenShareManager.createTechnicalUserForScreenShare(
                        technicalUserName,
                        screenTrack,
                        cameraInfo
                    );

                    // Создаем video preview для screen share
                    this.createVideoPreview(screenTrack, screenLabel, order - 1, true);

                } catch (error) {
                    console.error(`Error creating technical user for screen share:`, error);
                    ConferenceUtils.showError('Failed to setup screen sharing with technical user');
                    return;
                }
            } else {
                this.createVideoPreview(screenTrack, screenLabel, null, true);

                if (this.room) {
                    try {
                        await this.room.addTrack(screenTrack);
                    } catch (trackError) {
                        console.error(`Error adding screen share track to room`, trackError);
                    }
                }
            }

            this.broadcastTracks();
            ScreenShareLogic.updateScreenShareButton(true);

        } catch (error) {
            console.error('Error starting screen share:', error);
            ConferenceUtils.showError(`Failed to start screen sharing: ${error.message || 'Unknown error'}`);
        }
    },

    async stopScreenShare() {
        try {
            if (!this.screenTrack) {
                console.log('No active screen sharing to stop');
                return;
            }

            const trackId = this.screenTrack.getId();
            const screenDeviceId = 'screen-share-device';
            let trackIndex = -1;

            if (this.localTracks.video && this.localTracks.video.length > 0) {
                for (let i = 0; i < this.localTracks.video.length; i++) {
                    if (this.localTracks.video[i] === this.screenTrack) {
                        trackIndex = i;
                        break;
                    }
                }
            }

            const isPrimary = trackIndex === 0 && this.localTracks.video.length === 1;

            if (isPrimary) {
                // Primary screen share - remove from main room
                console.log('Stopping primary screen share');

                if (this.room) {
                    try {
                        await this.room.removeTrack(this.screenTrack);
                        this.notifyTrackRemoval(trackId);
                    } catch (error) {
                        console.error(`Error removing screen share track from room`, error);
                    }
                }

                // Remove video element for primary screen share
                this.removeVideoElementByTrackId(trackId, screenDeviceId);

            } else {
                // Secondary screen share - использует TechnicalUserManager
                console.log('Stopping secondary screen share via technical user');

                // Правильное формирование имени technical user
                const order = this.getScreenShareOrder();
                const technicalUserName = `${this.userName}_technical_screen${order}_${screenDeviceId}`;

                console.log(`Attempting to remove technical user: ${technicalUserName}`);

                // Попробуем удалить через screenShareManager
                let removed = false;
                if (this.screenShareManager) {
                    removed = await this.screenShareManager.removeTechnicalUser(technicalUserName);
                }

                if (!removed) {
                    // Fallback: попробуем найти technical user по device ID
                    console.log('Fallback: trying to remove by device ID');
                    if (this.screenShareManager) {
                        removed = await this.screenShareManager.removeTechnicalUserByDeviceId(screenDeviceId);
                    }
                }

                if (!removed) {
                    // Последний fallback: попробуем найти по track ID
                    console.log('Final fallback: searching by track ID');
                    removed = await this.removeTechnicalUserByTrackId(trackId);
                }

                if (!removed) {
                    console.warn('Could not remove technical user, cleaning up manually');
                    // Manual cleanup
                    if (this.room) {
                        try {
                            await this.room.removeTrack(this.screenTrack);
                            this.notifyTrackRemoval(trackId);
                        } catch (error) {
                            console.error(`Error removing screen share track from room`, error);
                        }
                    }
                    // Remove video element manually
                    this.removeVideoElementByTrackId(trackId, screenDeviceId);
                }
            }

            // Clean up the screen track
            try {
                await this.screenTrack.dispose();
                console.log('Screen track disposed successfully');
            } catch (error) {
                console.error(`Error disposing screen share track:`, error);
            }

            // Remove from local tracks array
            if (trackIndex !== -1) {
                this.localTracks.video.splice(trackIndex, 1);
            }

            // Clean up camera order map
            const orderKey = `${this.userName}_${screenDeviceId}`;
            if (this.cameraOrderMap && this.cameraOrderMap.has(orderKey)) {
                this.cameraOrderMap.delete(orderKey);
            }

            this.screenTrack = null;

            // Update grid configuration
            this.updateGridConfiguration();

            // Show no-camera placeholder if needed
            this.showNoCameraPlaceholderIfNeeded();

            ScreenShareLogic.updateScreenShareButton(false);
            this.broadcastTracks();
            console.log('Screen sharing stopped successfully');

        } catch (error) {
            console.error('Error stopping screen share:', error);
            ConferenceUtils.showError(`Error stopping screen share: ${error.message || 'Unknown error'}`);
        }
    },

    getScreenShareOrder() {
        if (!this.localTracks.video) return 1;

        let screenOrder = 1;
        for (let i = 0; i < this.localTracks.video.length; i++) {
            if (this.localTracks.video[i] === this.screenTrack) {
                screenOrder = i + 1;
                break;
            }
        }
        return screenOrder;
    },

    async removeTechnicalUserByTrackId(trackId) {
        if (!this.screenShareManager) return false;

        const allTechnicalUsers = this.screenShareManager.getAllTechnicalUsers();

        for (const user of allTechnicalUsers) {
            if (user.trackId === trackId) {
                console.log(`Found technical user by track ID: ${user.name}`);
                return await this.screenShareManager.removeTechnicalUser(user.name);
            }
        }

        return false;
    },

    updateGridConfiguration() {
        if (this.localTracks.video && this.localTracks.video.length > 0) {
            const gridConfigKey = `${this.userName}_gridConfig`;
            let gridRows = Math.ceil(Math.sqrt(this.localTracks.video.length));
            let gridCols = Math.ceil(this.localTracks.video.length / gridRows);

            if (!this.cameraOrderMap) {
                this.cameraOrderMap = new Map();
            }

            this.cameraOrderMap.set(gridConfigKey, {
                gridRows: gridRows,
                gridCols: gridCols
            });
        }
    },

    showNoCameraPlaceholderIfNeeded() {
        const section = document.querySelector(`[data-participant-id="local"]`);
        if (section) {
            const camerasContainer = section.querySelector('.cameras-container');
            if (camerasContainer && this.localTracks.video.length === 0) {
                let placeholder = camerasContainer.querySelector('.no-camera-placeholder');
                if (placeholder) {
                    placeholder.style.display = 'flex';
                } else {
                    placeholder = this.createNoVideosPlaceholder(camerasContainer);
                }
            }
        }
    },

    isScreenSharingActive() {
        return !!this.screenTrack;
    },

    async toggleScreenSharing() {
        if (this.isScreenSharingActive()) {
            await this.stopScreenShare();
        } else {
            await this.startScreenShare();
        }
    },

    updateScreenShareButton(isActive) {
        const shareButton = document.getElementById('screen-share-btn');
        if (shareButton) {
            if (isActive) {
                shareButton.textContent = '🛑 Stop Sharing';
                shareButton.classList.add('active');
                shareButton.style.backgroundColor = '#f44336';
            } else {
                shareButton.textContent = '🖥️ Share Screen';
                shareButton.classList.remove('active');
                shareButton.style.backgroundColor = '#4285f4';
            }
        }
    },

    async initScreenShareControls() {
        const existingBtn = document.getElementById('screen-share-btn');
        if (existingBtn) {
            existingBtn.remove();
        }

        const screenShareBtn = document.createElement('button');
        screenShareBtn.id = 'screen-share-btn';
        screenShareBtn.textContent = '🖥️ Share Screen';
        screenShareBtn.style.position = 'absolute';
        screenShareBtn.style.bottom = '20px';
        screenShareBtn.style.right = '180px';
        screenShareBtn.style.padding = '10px 15px';
        screenShareBtn.style.backgroundColor = '#4285f4';
        screenShareBtn.style.color = '#fff';
        screenShareBtn.style.border = 'none';
        screenShareBtn.style.borderRadius = '4px';
        screenShareBtn.style.cursor = 'pointer';
        screenShareBtn.style.zIndex = '999';

        screenShareBtn.addEventListener('mouseenter', function() {
            this.style.backgroundColor = this.classList.contains('active') ? '#d32f2f' : '#3367d6';
        });

        screenShareBtn.addEventListener('mouseleave', function() {
            this.style.backgroundColor = this.classList.contains('active') ? '#f44336' : '#4285f4';
        });

        const self = this;
        screenShareBtn.onclick = async () => {
            console.log('Screen share button clicked');
            screenShareBtn.disabled = true;
            try {
                await self.toggleScreenSharing();
            } finally {
                screenShareBtn.disabled = false;
            }
        };

        document.body.appendChild(screenShareBtn);
    }
};

// Extend TechnicalUserManager to support screen sharing
if (typeof TechnicalUserManager !== 'undefined') {
    TechnicalUserManager.prototype.createTechnicalUserForScreenShare = async function(technicalUserName, screenTrack, cameraInfo) {
        console.log(`Creating technical user ${technicalUserName} for screen sharing`);

        try {
            const technicalConnection = new JitsiMeetJS.JitsiConnection(
                null, null, this.conference.connectionOptions
            );

            await new Promise((resolve, reject) => {
                technicalConnection.addEventListener(
                    JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, resolve
                );
                technicalConnection.addEventListener(
                    JitsiMeetJS.events.connection.CONNECTION_FAILED, reject
                );
                technicalConnection.connect();
            });

            console.log(`Technical user ${technicalUserName} connected successfully`);

            const technicalRoom = technicalConnection.initJitsiConference(
                this.conference.conferenceId,
                this.conference.conferenceOptions
            );

            technicalRoom.setDisplayName(technicalUserName);

            await new Promise((resolve) => {
                technicalRoom.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, resolve);
                technicalRoom.join();
            });

            console.log(`Technical user ${technicalUserName} joined conference room`);

            // Use the existing screen track instead of creating a new one
            const trackId = screenTrack.getId();
            console.log(`Using existing screen track with ID ${trackId} for technical user ${technicalUserName}`);

            await technicalRoom.addTrack(screenTrack);
            console.log(`Technical user ${technicalUserName} added screen track ${trackId} to room`);

            const techUser = {
                connection: technicalConnection,
                room: technicalRoom,
                track: screenTrack,
                trackId: trackId,
                deviceId: cameraInfo.deviceId,
                label: cameraInfo.label,
                order: cameraInfo.order,
                isScreen: true
            };

            this.technicalUsers.set(technicalUserName, techUser);

            return techUser;
        } catch (error) {
            console.error(`Error creating technical user for screen share ${technicalUserName}:`, error);
            throw error;
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    ScreenShareLogic.initialize();
    if (typeof VideoConference !== 'undefined') {
        ScreenShareLogic.extendVideoConference();
    }
});

window.ScreenShareLogic = ScreenShareLogic;