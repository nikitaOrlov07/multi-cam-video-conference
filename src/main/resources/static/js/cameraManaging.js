const AddCameraLogic = {
    initialize: function() {

        if (typeof VideoConference !== 'undefined') {
            this.extendVideoConference();
        } else {
            console.error('VideoConference class not found. Make sure videoConferenceLogic.js is loaded first.');
            document.addEventListener('videoConferenceReady', this.extendVideoConference.bind(this));
        }
    },

    extendVideoConference: function() {
        VideoConference.prototype.addCamera = this.addCamera;
        VideoConference.prototype.removeCamera = this.removeCamera;
        VideoConference.prototype.getAvailableCameras = this.getAvailableCameras;
        VideoConference.prototype.createCameraSelector = this.createCameraSelector;
        VideoConference.prototype.populateCameraList = this.populateCameraList;
        VideoConference.prototype.initCameraControls = this.initCameraControls;
        VideoConference.prototype.notifyTrackRemoval = this.notifyTrackRemoval;
        VideoConference.prototype.removeVideoElementByTrackId = this.removeVideoElementByTrackId;
        VideoConference.prototype.createNoVideosPlaceholder = this.createNoVideosPlaceholder;

        const originalInit = VideoConference.prototype.init;
        VideoConference.prototype.init = async function() {

            this.technicalTrackManager = new TechnicalUserManager({
                conference: this,
                onTrackDisposed: (trackId) => {
                    console.log(`Track ${trackId} disposed via manager.`);
                },
                onError: (error) => {
                    console.error("TechnicalTrackManager Error:", error);
                    if (typeof ConferenceUtils !== 'undefined' && ConferenceUtils.showError) {
                        ConferenceUtils.showError("Error managing technical camera: " + error.message);
                    }
                }
            });
            console.log('TechnicalTrackManager initialized in VideoConference (early)');

            await originalInit.call(this);


            // initCameraControls can be called after originalInit has completed
            if (typeof this.initCameraControls === 'function') {
                await this.initCameraControls();
                console.log('Camera controls initialized from AddCameraLogic');
            } else {
                console.error("initCameraControls is not a function on this VideoConference instance after originalInit");
            }
        };

        console.log('VideoConference class extended with camera controls');
    },

    /// Add new camera
        async addCamera(deviceId, label) {
            try {
                if (this.technicalTrackManager && this.technicalTrackManager.isDeviceInUse(deviceId)) {
                    console.log(`Camera ${label} (${deviceId}) is already in use by a technical user, not adding it again`);
                    ConferenceUtils.showError(`Камера ${label} уже используется.`);
                    return;
                }

                if (this.localTracks.video && this.localTracks.video.find(track => typeof track.getDeviceId === 'function' && track.getDeviceId() === deviceId)) {
                    console.log(`Camera ${label} (${deviceId}) is already in use by the main user, not adding it again`);
                    ConferenceUtils.showError(`Камера ${label} уже используется.`);
                    return;
                }

                let currentCameraCount = 0;
                if (this.localTracks.video && this.localTracks.video.length > 0) {
                    currentCameraCount++;
                }
                if (this.technicalTrackManager) {
                    currentCameraCount += this.technicalTrackManager.getAllTechnicalUsers().length;
                }
                const order = currentCameraCount + 1;

                console.log(`Adding camera: ${label} (${deviceId}) with determined order ${order}`);

                if (order > 1) {
                    const technicalUserName = `${this.userName}_technical_cam${order}_${deviceId.substring(0,5)}`;
                    console.log(`Adding Camera: Creating technical user: ${technicalUserName} for camera: ${label} (${deviceId})`);
                    if (!this.technicalTrackManager) {
                        console.error("TechnicalTrackManager is not initialized!");
                        ConferenceUtils.showError("Ошибка: Менеджер технических камер не инициализирован.");
                        return;
                    }
                    await this.technicalTrackManager.createTechnicalUser(technicalUserName, {
                        deviceId,
                        label,
                        order
                    });
                    console.log(`Successfully added camera ${label} via technical user`);

                } else {
                    console.log("Adding first camera for main user");
                    const tracks = await JitsiMeetJS.createLocalTracks({
                        devices: ['video'],
                        cameraDeviceId: deviceId,
                        constraints: { video: { deviceId: { exact: deviceId }, height: { ideal: 480 }, width: { ideal: 640 } } }
                    });

                    if (!tracks || tracks.length === 0 || !tracks[0]) {
                        console.error(`No tracks created for camera: ${label}`);
                        ConferenceUtils.showError(`Failed to access camera: ${label}`);
                        return;
                    }
                    const videoTrack = tracks[0];
                    if (!this.localTracks.video) this.localTracks.video = [];

                    this.localTracks.video.push(videoTrack);
                    this.createVideoPreview(videoTrack, label, 0);

                    if (this.room) {
                        try {
                            await this.room.addTrack(videoTrack);
                            console.log(`Added primary camera ${label} to room`);
                        } catch (trackError) {
                            console.error(`Error adding track to room: ${label}`, trackError);
                        }
                    }
                    console.log(`Successfully added primary camera ${label} with order ${order}`);
                }

                const orderKey = `${this.userName}_${deviceId}`;
                this.cameraOrderMap = this.cameraOrderMap || new Map();
                this.cameraOrderMap.set(orderKey, { order, label });

                const totalCamerasForGrid = (this.localTracks.video ? this.localTracks.video.length : 0) +
                    (this.technicalTrackManager ? this.technicalTrackManager.getAllTechnicalUsers().length : 0);

                if (totalCamerasForGrid > 0) {
                    const gridConfigKey = `${this.userName}_gridConfig`;
                    let gridRows = Math.ceil(Math.sqrt(totalCamerasForGrid));
                    let gridCols = Math.ceil(totalCamerasForGrid / gridRows);
                    this.cameraOrderMap.set(gridConfigKey, { gridRows, gridCols });
                }

                this.broadcastTracks();
                await this.populateCameraList();

            } catch (error) {
                console.error(`Error adding camera: ${label}`, error);
                ConferenceUtils.showError(`Camera access error for ${label}: ${error.message}`);
                await this.populateCameraList();
            }
        },

    /// Delete camera
    removeCamera: async function(deviceId, label) {
        try {
            console.log(`Attempting to remove camera: ${label} (${deviceId})`);

            let removed = false;
            if (this.technicalTrackManager) {
                removed = await this.technicalTrackManager.removeTechnicalUserByDeviceId(deviceId);
                if (removed) {
                    console.log(`Successfully removed technical user camera: ${label} via manager`);
                }
            }

            if (!removed) {
                if (this.localTracks.video && this.localTracks.video.length > 0) {
                    const trackIndex = this.localTracks.video.findIndex(
                        track => typeof track.getDeviceId === 'function' && track.getDeviceId() === deviceId
                    );

                    if (trackIndex !== -1) {
                        const trackToRemove = this.localTracks.video[trackIndex];
                        const trackId = trackToRemove.getId();
                        console.log(`Found primary track to remove: ${trackId} for device: ${deviceId}`);

                        if (this.room) {
                            try {
                                await this.room.removeTrack(trackToRemove);
                                console.log(`Removed primary camera ${label} from room`);
                                this.notifyTrackRemoval(trackId);
                            } catch (error) {
                                console.error(`Error removing primary track from room: ${label}`, error);
                            }
                        } else {
                            this.notifyTrackRemoval(trackId);
                        }


                        try {
                            await trackToRemove.dispose();
                            console.log(`Disposed track for primary camera: ${label}`);
                        } catch (error) {
                            console.error(`Error disposing primary track: ${label}`, error);
                        }

                        this.localTracks.video.splice(trackIndex, 1);
                        this.removeVideoElementByTrackId(trackId, deviceId);

                        const previewContainer = document.querySelector(`[data-camera-id="${deviceId}"]`);
                        if (previewContainer) {
                            previewContainer.remove();
                            console.log(`Removed preview for primary camera: ${label}`);
                        }
                        removed = true;
                        console.log(`Successfully removed primary camera: ${label}`);
                    }
                }
            }

            if (!removed) {
                console.warn(`Camera ${label} (${deviceId}) not found for removal either as technical or primary.`);
                this.removeVideoElementByTrackId(null, deviceId);
                const previewContainer = document.querySelector(`[data-camera-id="${deviceId}"]`);
                if (previewContainer) {
                    previewContainer.remove();
                    console.log(`Force removed preview for untracked camera: ${label}`);
                }
            }

            const orderKey = `${this.userName}_${deviceId}`;
            if (this.cameraOrderMap && this.cameraOrderMap.has(orderKey)) {
                this.cameraOrderMap.delete(orderKey);
            }

            const totalCamerasForGrid = (this.localTracks.video ? this.localTracks.video.length : 0) +
                (this.technicalTrackManager ? this.technicalTrackManager.getAllTechnicalUsers().length : 0);

            if (totalCamerasForGrid > 0) {
                const gridConfigKey = `${this.userName}_gridConfig`;
                let gridRows = Math.ceil(Math.sqrt(totalCamerasForGrid));
                let gridCols = Math.ceil(totalCamerasForGrid / gridRows);
                this.cameraOrderMap.set(gridConfigKey, { gridRows, gridCols });
            } else {
                const section = document.querySelector(`[data-participant-id="local"]`);
                if (section) {
                    const camerasContainer = section.querySelector('.cameras-container');
                    if (camerasContainer) {
                        this.createNoVideosPlaceholder(camerasContainer);
                    }
                }
            }

            this.broadcastTracks();
            await this.populateCameraList();

        } catch (error) {
            console.error(`Error removing camera: ${label}`, error);
            ConferenceUtils.showError(`Error removing camera ${label}: ${error.message}`);
            await this.populateCameraList();
        }
    },


    notifyTrackRemoval: function(trackId) {
        if (!this.room) {
            console.error("Cannot send track removal - room is null");
            return;
        }
        try {
            const message = {
                type: 'track_removed',
                trackId: trackId,
                senderId: this.myParticipantId,
                userName: this.displayName,
                timestamp: Date.now()
            };
            console.log(`Attempting to send track removal for track ${trackId}`, message);
            this.room.sendEndpointMessage('', {trackRemoval: message});
            console.log(`Track removal message sent for track: ${trackId}`, message);
            setTimeout(() => {
                try {
                    this.room.sendEndpointMessage('', {trackRequest: {
                            ...message,
                            type: 'track_removed'
                        }});
                    console.log("Sent fallback track removal message");
                } catch (e) {
                    console.error("Error sending fallback track removal", e);
                }
            }, 500);
        } catch (error) {
            console.error('Failed to send track removal notification', error);
            setTimeout(() => {
                try {
                    const retryMessage = {
                        type: 'track_removed',
                        trackId: trackId,
                        senderId: this.myParticipantId,
                        userName: this.displayName,
                        timestamp: Date.now()
                    };
                    this.room.sendEndpointMessage('', {trackRemoval: retryMessage});
                    console.log("Retried sending track removal notification");
                } catch (e) {
                    console.error("Retry also failed", e);
                }
            }, 1000);
        }
    },

    removeVideoElementByTrackId: function(trackId, deviceId) {
        console.log(`Trying to remove local video with track-id ${trackId || 'N/A'}, device-id ${deviceId || 'N/A'}`);
        let videoWrapper = null;

        if (trackId) {
            videoWrapper = document.querySelector(`.video-wrapper[data-track-id="${trackId}"]`);
        }

        if (!videoWrapper && deviceId) {
            videoWrapper = document.querySelector(`.video-wrapper[data-device-id="${deviceId}"]`);
            if (videoWrapper) {
                console.log(`Found video wrapper by device ID: ${deviceId}`);
            }
        }

        if (videoWrapper) {
            const section = videoWrapper.closest('.participant-section');
            videoWrapper.remove();
            console.log(`Removed video wrapper (track: ${trackId}, device: ${deviceId})`);

            if (section) {
                const camerasContainer = section.querySelector('.cameras-container');
                if (camerasContainer && camerasContainer.querySelectorAll('.video-wrapper').length === 0) {
                    this.createNoVideosPlaceholder(camerasContainer);
                }
            } else {
                console.warn("Section for removed video wrapper was not found.");
            }
        } else {
            console.warn(`VideoWrapper for track: ${trackId} or device: ${deviceId} was not found for removal.`);
            const allWrappers = Array.from(document.querySelectorAll('.video-wrapper')).map(wrapper => {
                return {
                    element: wrapper,
                    trackId: wrapper.getAttribute('data-track-id'),
                    deviceId: wrapper.getAttribute('data-device-id')
                };
            });
            console.error(`VideoWrapper for track: ${trackId} was not found`);
            console.error("Existing video wrappers:", allWrappers);
            const allVideos = document.querySelectorAll('.video-wrapper');
            console.log(`Total video wrappers found: ${allVideos.length}`);
            if (deviceId) {
                const orphanedWrappers = document.querySelectorAll(`.video-wrapper[data-device-id="${deviceId}"]`);
                orphanedWrappers.forEach(ow => {
                    console.warn(`Removing orphaned wrapper by deviceId: ${deviceId}`);
                    ow.remove();
                });
            }
        }
    },

    createNoVideosPlaceholder: function(container) {
        const placeholder = document.createElement('div');
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
        container.appendChild(placeholder);
        return placeholder;
    },

    getAvailableCameras: async function() {
        console.log("Getting available cameras");
        try {
            try {
                await navigator.mediaDevices.getUserMedia({ video: true });
            } catch (err) {
                console.warn("Could not get camera permissions (optional check): ", err);
            }

            let devices = await navigator.mediaDevices.enumerateDevices();
            let videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log("Found video devices:", videoDevices);

            const usedDeviceIds = new Set();

            if (this.localTracks && this.localTracks.video && this.localTracks.video.length > 0) {
                this.localTracks.video.forEach(track => {
                    if (track && typeof track.getDeviceId === 'function') {
                        const devId = track.getDeviceId();
                        if (devId) {
                            usedDeviceIds.add(devId);
                            console.log(`Device ${devId} marked as in use by main user.`);
                        }
                    }
                });
            }

            if (this.technicalTrackManager) {
                const techUsers = this.technicalTrackManager.getAllTechnicalUsers();
                techUsers.forEach(techUser => {
                    if (techUser.deviceId) {
                        usedDeviceIds.add(techUser.deviceId);
                        console.log(`Device ${techUser.deviceId} marked as in use by technical user ${techUser.name}`);
                    }
                });
            }

            console.log("Currently used device IDs:", Array.from(usedDeviceIds));

            return videoDevices.map(device => ({
                deviceId: device.deviceId,
                label: device.label || `Camera ${device.deviceId.substr(0, 8)}...`,
                inUse: usedDeviceIds.has(device.deviceId)
            }));

        } catch (error) {
            console.error('Error getting available cameras:', error);
            return [];
        }
    },

    createCameraSelector: async function() {
        const existingSelector = document.getElementById('camera-selector');
        if (existingSelector) {
            existingSelector.remove();
        }

        const existingBtn = document.getElementById('add-camera-btn');
        if (existingBtn) {
            existingBtn.remove();
        }

        const container = document.createElement('div');
        container.id = 'camera-selector';
        container.style.position = 'absolute';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.backgroundColor = '#333';
        container.style.padding = '15px';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        container.style.zIndex = '1000';
        container.style.display = 'none';
        container.style.color = '#fff';
        container.style.width = '300px';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '10px';

        const title = document.createElement('h3');
        title.textContent = 'Camera Manager';
        title.style.margin = '0';
        title.style.color = '#fff';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = '#fff';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = () => { container.style.display = 'none'; };

        header.appendChild(title);
        header.appendChild(closeBtn);

        const cameraList = document.createElement('div');
        cameraList.id = 'camera-list';
        cameraList.style.maxHeight = '200px';
        cameraList.style.overflowY = 'auto';
        cameraList.style.marginBottom = '10px';

        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = 'Refresh Camera List';
        refreshBtn.style.width = '100%';
        refreshBtn.style.padding = '8px';
        refreshBtn.style.backgroundColor = '#555';
        refreshBtn.style.color = '#fff';
        refreshBtn.style.border = 'none';
        refreshBtn.style.borderRadius = '4px';
        refreshBtn.style.marginBottom = '10px';
        refreshBtn.style.cursor = 'pointer';

        container.appendChild(header);
        container.appendChild(refreshBtn);
        container.appendChild(cameraList);

        document.body.appendChild(container);

        const addCameraBtn = document.createElement('button');
        addCameraBtn.id = 'add-camera-btn';
        addCameraBtn.textContent = '🎥 Manage Cameras';
        addCameraBtn.style.position = 'absolute';
        addCameraBtn.style.bottom = '20px';
        addCameraBtn.style.right = '20px';
        addCameraBtn.style.padding = '10px 15px';
        addCameraBtn.style.backgroundColor = '#4285f4';
        addCameraBtn.style.color = '#fff';
        addCameraBtn.style.border = 'none';
        addCameraBtn.style.borderRadius = '4px';
        addCameraBtn.style.cursor = 'pointer';
        addCameraBtn.style.zIndex = '999';

        const self = this;
        addCameraBtn.onclick = () => {
            console.log('Camera manager button clicked');
            self.populateCameraList().then(() => {
                container.style.display = 'block';
            }).catch(err => {
                console.error('Error populating camera list:', err);
            });
        };

        document.body.appendChild(addCameraBtn);

        refreshBtn.onclick = () => {
            console.log('Refresh camera list button clicked');
            self.populateCameraList().catch(err => {
                console.error('Error refreshing camera list:', err);
            });
        };

        return container;
    },


    /// For displaying camera items
    populateCameraList: async function() {
        const cameraList = document.getElementById('camera-list');
        if (!cameraList) {
            console.error('Camera list element not found');
            return;
        }

        cameraList.innerHTML = '';

        const cameras = await this.getAvailableCameras();

        console.log("Populated cameras list with", cameras.length, "cameras");

        if (cameras.length === 0) {
            const noDevices = document.createElement('div');
            noDevices.textContent = 'No cameras found';
            noDevices.style.padding = '10px';
            noDevices.style.color = '#fff';
            cameraList.appendChild(noDevices);
            return;
        }

        const self = this;

        cameras.forEach(camera => {
            const item = document.createElement('div');
            item.style.padding = '10px';
            item.style.borderBottom = '1px solid #444';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';

            const label = document.createElement('span');
            label.textContent = camera.label;
            label.style.color = '#fff';
            label.style.flexGrow = '1';
            label.style.marginRight = '10px';

            const actionBtn = document.createElement('button');
            actionBtn.style.padding = '5px 10px';
            actionBtn.style.color = '#fff';
            actionBtn.style.border = 'none';
            actionBtn.style.borderRadius = '4px';
            actionBtn.style.cursor = 'pointer';

            if (camera.inUse) {
                actionBtn.textContent = 'Remove';
                actionBtn.style.backgroundColor = '#f44336';
                actionBtn.onclick = () => {
                    document.getElementById('camera-selector').style.display = 'none';
                    self.removeCamera(camera.deviceId, camera.label);
                };
            } else {
                actionBtn.textContent = 'Add';
                actionBtn.style.backgroundColor = '#4285f4';
                actionBtn.onclick = () => {
                    document.getElementById('camera-selector').style.display = 'none';
                    self.addCamera(camera.deviceId, camera.label);
                };
            }

            item.appendChild(label);
            item.appendChild(actionBtn);
            cameraList.appendChild(item);
        });
    },

    initCameraControls: async function() {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .catch(error => {
                    console.warn('Could not get media permissions:', error);
                });
        } catch (error) {
            console.error('Error requesting media permissions:', error);
        }

        this.cameraOrderMap = this.cameraOrderMap || new Map();

        await this.createCameraSelector();

        await this.populateCameraList().catch(err => {
            console.error('Error in initial camera list population:', err);
        });

        console.log('Camera controls fully initialized');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AddCameraLogic.initialize();
    if (typeof VideoConference !== 'undefined') {
        AddCameraLogic.extendVideoConference();
    }
});

window.AddCameraLogic = AddCameraLogic;