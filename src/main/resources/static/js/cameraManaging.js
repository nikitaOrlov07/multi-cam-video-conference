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
            await originalInit.call(this);
            await this.initCameraControls();
            console.log('Camera controls initialized');
        };

        console.log('VideoConference class extended with camera controls');
    },

    /// Add new camera
    async addCamera(deviceId, label) {
        try {
            const hasCameras = this.localTracks.video && this.localTracks.video.length > 0;
            const order = hasCameras ? this.localTracks.video.length + 1 : 1;
            console.log(`Adding camera: ${label} (${deviceId}) with order ${order}`);

            if (this.localTracks.video) {
                const existingCamera = this.localTracks.video.find(track => {
                    return typeof track.getDeviceId === 'function' && track.getDeviceId() === deviceId;
                });

                if (existingCamera) {
                    console.log(`Camera ${label} (${deviceId}) is already in use, not adding it again`);
                    return;
                }
            }

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
                console.error(`No tracks created for camera: ${label}`);
                ConferenceUtils.showError(`Failed to access camera: ${label}`);
                return;
            }

            const videoTrack = tracks[0];

            if (!this.localTracks.video) {
                this.localTracks.video = [];
            }

            const orderKey = `${this.userName}_${deviceId}`;
            this.cameraOrderMap = this.cameraOrderMap || new Map();
            this.cameraOrderMap.set(orderKey, {
                order: order,
                label: label
            });

            this.localTracks.video.push(videoTrack);

            if (order > 1) {
                const technicalUserName = `${this.userName}_technical${order-1}_camera${order}`;
                console.log(`Creating technical user: ${technicalUserName} for camera: ${label} (${deviceId}) for adding new camera`);
                await this.createTechnicalUserWithCamera(technicalUserName, videoTrack, {
                    label: label,
                    deviceId: deviceId,
                    order: order
                });

                console.log(`Successfully added camera ${label} via technical user`);
            } else {
                console.log("Adding first camera for user");
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

            const gridConfigKey = `${this.userName}_gridConfig`;
            let gridRows = Math.ceil(Math.sqrt(this.localTracks.video.length));
            let gridCols = Math.ceil(this.localTracks.video.length / gridRows);
            this.cameraOrderMap.set(gridConfigKey, {
                gridRows: gridRows,
                gridCols: gridCols
            });

            this.broadcastTracks();

        } catch (error) {
            console.error(`Error adding camera: ${label}`, error);
            ConferenceUtils.showError(`Camera access error: ${label}`);
        }
    },

    /// Delete camera
    removeCamera: async function(deviceId, label) {
        try {
            console.log(`Removing camera: ${label} (${deviceId})`);
            if (!this.localTracks.video || this.localTracks.video.length === 0) {
                console.log("No video tracks to remove");
                return;
            }

            // First check if this camera belongs to a technical user
            let technicalUserEntry = null;
            let technicalUserName = null;

            if (this.technicalUsers) {
                // Find the technical user by deviceId
                for (const [username, data] of this.technicalUsers.entries()) {
                    if (data.deviceId === deviceId) {
                        technicalUserEntry = data;
                        technicalUserName = username;
                        console.log(`Found technical user by deviceId: ${username} for camera ${label} (${deviceId})`);
                        break;
                    }
                }
            }

            // If found in technical users, handle that case separately
            if (technicalUserEntry && technicalUserName) {
                try {
                    // Use the stored trackId for notification
                    const trackId = technicalUserEntry.trackId;
                    console.log(`Removing technical user camera with trackId: ${trackId}`);

                    // Disconnect the technical user
                    if (technicalUserEntry.connection) {
                        await technicalUserEntry.connection.disconnect();
                        console.log(`Disconnected technical user: ${technicalUserName}`);
                    }

                    // Remove from our map
                    this.technicalUsers.delete(technicalUserName);

                    // Notify about track removal
                    this.notifyTrackRemoval(trackId);

                    // Remove the video element
                    this.removeVideoElementByTrackId(trackId, deviceId);

                    // Remove preview if it exists
                    const previewContainer = document.querySelector(`[data-camera-id="${deviceId}"]`);
                    if (previewContainer) {
                        previewContainer.remove();
                        console.log(`Removed preview for camera: ${label}`);
                    }

                    console.log(`Successfully removed technical user camera: ${label}`);

                    // Update grid configuration
                    if (this.localTracks.video.length > 0) {
                        const gridConfigKey = `${this.userName}_gridConfig`;
                        let gridRows = Math.ceil(Math.sqrt(this.localTracks.video.length));
                        let gridCols = Math.ceil(this.localTracks.video.length / gridRows);
                        this.cameraOrderMap.set(gridConfigKey, {
                            gridRows: gridRows,
                            gridCols: gridCols
                        });
                    }

                    this.broadcastTracks();
                    console.log(`Successfully removed camera: ${label}`);
                    this.populateCameraList();
                    return;
                } catch (error) {
                    console.error(`Error removing technical user camera: ${label}`, error);
                    ConferenceUtils.showError(`Error removing camera: ${label}`);
                    return;
                }
            }

            // Standard track removal process for non-technical user cameras
            let trackIndex = -1;
            let trackToRemove = null;

            for (let i = 0; i < this.localTracks.video.length; i++) {
                const track = this.localTracks.video[i];
                if (typeof track.getDeviceId === 'function' && track.getDeviceId() === deviceId) {
                    trackIndex = i;
                    trackToRemove = track;
                    break;
                }
            }

            if (trackIndex === -1 || !trackToRemove) {
                console.error(`Camera track with deviceId ${deviceId} not found in local tracks`);

                // Try one more attempt: look for any preview element with this deviceId
                const preview = document.querySelector(`[data-camera-id="${deviceId}"]`);
                if (preview) {
                    preview.remove();
                    console.log(`Removed preview for camera: ${label} though track wasn't found`);
                }

                // Also try to remove any video element
                this.removeVideoElementByTrackId(null, deviceId);

                this.populateCameraList();
                return;
            }

            const trackId = trackToRemove.getId();
            console.log(`Found track to remove: ${trackId} for device: ${deviceId}`);

            const isPrimary = trackIndex === 0 && this.localTracks.video.length === 1;

            if (isPrimary) {
                if (this.room) {
                    try {
                        await this.room.removeTrack(trackToRemove);
                        console.log(`Removed primary camera ${label} from room`);
                        this.notifyTrackRemoval(trackId);
                    } catch (error) {
                        console.error(`Error removing track from room: ${label}`, error);
                    }
                }
            } else {
                const order = trackIndex + 1;
                const technicalUserName = `${this.userName}_technical${order-1}_camera${order}`;

                if (this.technicalUsers && this.technicalUsers.has(technicalUserName)) {
                    technicalUserEntry = this.technicalUsers.get(technicalUserName);
                    try {
                        // Use the stored trackId for notification if available
                        const notifyTrackId = technicalUserEntry.trackId || trackId;

                        await technicalUserEntry.connection.disconnect();
                        this.technicalUsers.delete(technicalUserName);
                        console.log(`Disconnected technical user: ${technicalUserName}`);

                        // Make sure we're using the right trackId for notification
                        this.notifyTrackRemoval(notifyTrackId);

                        // Make sure video element is found and removed using the same ID
                        this.removeVideoElementByTrackId(notifyTrackId, deviceId);
                    } catch (error) {
                        console.error(`Error disconnecting technical user: ${technicalUserName}`, error);
                    }
                } else {
                    if (this.room) {
                        try {
                            await this.room.removeTrack(trackToRemove);
                            console.log(`Removed camera ${label} from room`);
                            this.notifyTrackRemoval(trackId);
                        } catch (error) {
                            console.error(`Error removing track from room: ${label}`, error);
                        }
                    }
                }
            }

            try {
                await trackToRemove.dispose();
                console.log(`Disposed track for camera: ${label}`);
            } catch (error) {
                console.error(`Error disposing track: ${label}`, error);
            }

            this.localTracks.video.splice(trackIndex, 1);

            const orderKey = `${this.userName}_${deviceId}`;
            if (this.cameraOrderMap && this.cameraOrderMap.has(orderKey)) {
                this.cameraOrderMap.delete(orderKey);
            }

            // Remove video element by both track ID and device ID as a fallback
            this.removeVideoElementByTrackId(trackId, deviceId);

            const previewContainer = document.querySelector(`[data-camera-id="${deviceId}"]`);
            if (previewContainer) {
                previewContainer.remove();
                console.log(`Removed preview for camera: ${label}`);
            }

            if (this.localTracks.video.length > 0) {
                const gridConfigKey = `${this.userName}_gridConfig`;
                let gridRows = Math.ceil(Math.sqrt(this.localTracks.video.length));
                let gridCols = Math.ceil(this.localTracks.video.length / gridRows);
                this.cameraOrderMap.set(gridConfigKey, {
                    gridRows: gridRows,
                    gridCols: gridCols
                });
            }

            // Check if we need to show a placeholder
            const section = document.querySelector(`[data-participant-id="local"]`);
            if (section) {
                const camerasContainer = section.querySelector('.cameras-container');
                if (camerasContainer && this.localTracks.video.length === 0) {
                    let placeholder = camerasContainer.querySelector('.no-camera-placeholder');
                    if (placeholder) {
                        placeholder.style.display = 'flex';
                    } else {
                        this.createNoVideosPlaceholder(camerasContainer);
                    }
                }
            }

            this.broadcastTracks();
            console.log(`Successfully removed camera: ${label}`);
            this.populateCameraList();

        } catch (error) {
            console.error(`Error removing camera: ${label}`, error);
            ConferenceUtils.showError(`Error removing camera: ${label}`);
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
        console.log(`Trying to remove local video with track-id ${trackId}, device-id ${deviceId || 'not provided'}`);
        let videoWrapper = document.querySelector(`.video-wrapper[data-track-id="${trackId}"]`);
        if (!videoWrapper && deviceId) {
            videoWrapper = document.querySelector(`.video-wrapper[data-device-id="${deviceId}"]`);
            if (videoWrapper) {
                console.log(`Found video wrapper by device ID instead of track ID`);
            }
        }
        if (videoWrapper) {
            const section = videoWrapper.closest('.participant-section');
            videoWrapper.remove();
            console.log(`Removed video wrapper for track: ${trackId}`);

            const allWrappers = Array.from(document.querySelectorAll('.video-wrapper')).map(wrapper => {
                return {
                    element: wrapper,
                    trackId: wrapper.getAttribute('data-track-id'),
                    deviceId: wrapper.getAttribute('data-device-id')
                };
            });

            console.error("All  video wrappers from local page:", allWrappers);

            if (section) {
                const camerasContainer = section.querySelector('.cameras-container');
                if (camerasContainer && camerasContainer.querySelectorAll('.video-wrapper').length === 0) {
                    let placeholder = camerasContainer.querySelector('.no-camera-placeholder');
                    if (placeholder) {
                        placeholder.style.display = 'flex';
                    } else {
                        this.createNoVideosPlaceholder(camerasContainer);
                    }
                }
            }
            else {
                console.error("Section for trackId " + trackId + " was not found");
            }
        }
        else {
            const allWrappers = Array.from(document.querySelectorAll('.video-wrapper')).map(wrapper => {
                return {
                    element: wrapper,
                    trackId: wrapper.getAttribute('data-track-id'),
                    deviceId: wrapper.getAttribute('data-device-id')
                };
            });

            console.error(`VideoWrapper for track: ${trackId} was not found`);
            console.error("Existing video wrappers:", allWrappers);

            // Try a more aggressive approach to find the element
            const allVideos = document.querySelectorAll('.video-wrapper');
            console.log(`Total video wrappers found: ${allVideos.length}`);

            if (allVideos.length === 1 && this.localTracks.video.length === 0) {
                // If this is the last video and we have no tracks, just remove it
                const lastWrapper = allVideos[0];
                console.log("Removing last remaining video wrapper as fallback");
                const section = lastWrapper.closest('.participant-section');
                lastWrapper.remove();

                if (section) {
                    const camerasContainer = section.querySelector('.cameras-container');
                    if (camerasContainer) {
                        this.createNoVideosPlaceholder(camerasContainer);
                    }
                }
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
                console.warn("Could not get camera permissions: ", err);
            }

            let devices = await navigator.mediaDevices.enumerateDevices();
            let videoDevices = devices.filter(device => device.kind === 'videoinput');

            console.log("Found video devices:", videoDevices);

            const usedDeviceIds = new Set();

            // Check main user's tracks
            if (this.localTracks && this.localTracks.video && this.localTracks.video.length > 0) {
                this.localTracks.video.forEach(track => {
                    if (typeof track.getDeviceId === 'function') {
                        usedDeviceIds.add(track.getDeviceId());
                    }
                });
            }

            // Also check technical users' tracks
            if (this.technicalUsers && this.technicalUsers.size > 0) {
                for (const [username, userData] of this.technicalUsers.entries()) {
                    if (userData.deviceId) {
                        usedDeviceIds.add(userData.deviceId);
                        console.log(`Marked camera ${userData.deviceId} as in use by technical user ${username}`);
                    }

                    // Additional check for track deviceId if available
                    if (userData.track && typeof userData.track.getDeviceId === 'function') {
                        usedDeviceIds.add(userData.track.getDeviceId());
                    }
                }
            }

            return videoDevices.map(device => ({
                deviceId: device.deviceId,
                label: device.label || `Camera ${device.deviceId.substr(0, 5)}...`,
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