const ScreenShareLogic = {
    initialize: function() {
        console.log("Start initialize screenSharing logci")
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

        const originalInit = VideoConference.prototype.init;
        VideoConference.prototype.init = async function() {
            await originalInit.call(this);
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

            this.createVideoPreview(screenTrack, screenLabel, null, true);

            if (order > 1) {
                const technicalUserName = `${this.userName}_technical${order-1}_screen${order}`;
                console.log(`Creating technical user: ${technicalUserName} for screen sharing`);
                await this.createTechnicalUserWithCamera(technicalUserName, screenTrack, {
                    label: screenLabel,
                    deviceId: screenDeviceId,
                    order: order,
                    isScreen: true
                });
            } else {
                if (this.room) {
                    try {
                        await this.room.addTrack(screenTrack);
                    } catch (trackError) {
                        console.error(`Error adding screen share track to room`, trackError);
                    }
                }
            }
            this.broadcastTracks();
            const shareButton = document.getElementById('screen-share-btn');
            if (shareButton) {
                shareButton.textContent = '🛑 Stop Sharing';
                shareButton.classList.add('active');
            }
        } catch (error) {
            console.error('Error starting screen share:', error);
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
                if (this.room) {
                    try {
                        await this.room.removeTrack(this.screenTrack);
                        this.notifyTrackRemoval(trackId);
                    } catch (error) {
                        console.error(`Error removing screen share track from room`, error);
                    }
                }
            } else {
                const order = trackIndex + 1;
                const technicalUserName = `${this.userName}_technical${order-1}_screen${order}`;
                if (this.technicalUsers && this.technicalUsers.has(technicalUserName)) {
                    const techUser = this.technicalUsers.get(technicalUserName);
                    if (techUser && techUser.connection) {
                        try {
                            await techUser.connection.disconnect();
                            this.technicalUsers.delete(technicalUserName);
                            this.notifyTrackRemoval(trackId);
                        } catch (error) {
                            console.error(`Error disconnecting technical user: ${technicalUserName}`, error);
                        }
                    }
                } else {
                    if (this.room) {
                        try {
                            await this.room.removeTrack(this.screenTrack);
                            this.notifyTrackRemoval(trackId);
                        } catch (error) {
                            console.error(`Error removing screen share track from room`, error);
                        }
                    }
                }
            }
            try {
                await this.screenTrack.dispose();
            } catch (error) {
                console.error(`Error disposing screen share track:`, error);
            }

            if (trackIndex !== -1) {
                this.localTracks.video.splice(trackIndex, 1);
            }

            const orderKey = `${this.userName}_${screenDeviceId}`;
            if (this.cameraOrderMap && this.cameraOrderMap.has(orderKey)) {
                this.cameraOrderMap.delete(orderKey);
            }
            this.removeVideoElementByTrackId(trackId);
            this.screenTrack = null;
            if (this.localTracks.video.length > 0) {
                const gridConfigKey = `${this.userName}_gridConfig`;
                let gridRows = Math.ceil(Math.sqrt(this.localTracks.video.length));
                let gridCols = Math.ceil(this.localTracks.video.length / gridRows);
                this.cameraOrderMap.set(gridConfigKey, {
                    gridRows: gridRows,
                    gridCols: gridCols
                });
            }
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

            const shareButton = document.getElementById('screen-share-btn');
            if (shareButton) {
                shareButton.textContent = '🖥️ Share Screen';
                shareButton.classList.remove('active');
            }

            this.broadcastTracks();
            console.log('Screen sharing stopped successfully');

        } catch (error) {
            console.error('Error stopping screen share:', error);
            ConferenceUtils.showError(`Error stopping screen share: ${error.message || 'Unknown error'}`);
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
            this.style.backgroundColor = '#3367d6';
        });
        screenShareBtn.addEventListener('mouseleave', function() {
            this.style.backgroundColor = this.classList.contains('active') ? '#f44336' : '#4285f4';
        });
        const self = this;
        screenShareBtn.onclick = async () => {
            console.log('Screen share button clicked');
            await self.toggleScreenSharing();
        };
        document.body.appendChild(screenShareBtn);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ScreenShareLogic.initialize();
    if (typeof VideoConference !== 'undefined') {
        ScreenShareLogic.extendVideoConference();
    }
});

window.ScreenShareLogic = ScreenShareLogic;