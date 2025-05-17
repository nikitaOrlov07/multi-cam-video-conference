class FixedTechnicalTrackManager {
    /**
     * A utility class for managing JitsiMeet technical users and their tracks.
     * 
     * @param {Object} options - Configuration options
     * @param {VideoConference} options.conference - The main conference instance
     * @param {Function} options.onTrackDisposed - Callback for when a track is disposed
     * @param {Function} options.onError - Callback for error handling
     */
    constructor(options = {}) {
        this.conference = options.conference;
        this.onTrackDisposed = options.onTrackDisposed || (() => {});
        this.onError = options.onError || console.error;
        this.technicalUsers = new Map();
    }
    /**
     * Checks if a technical user with the given name is managed by this instance.
     * @param {string} technicalUserName - The full name of the technical user (e.g., MainUser_technical_camX_deviceId)
     * @returns {boolean}
     */
    isManagingTechnicalUserByName(technicalUserName) {
        return this.technicalUsers.has(technicalUserName);
    }
    /**
     * Creates a technical user with a camera track
     * 
     * @param {string} technicalUserName - Name for the technical user
     * @param {Object} camera - Camera information
     * @param {string} camera.deviceId - The device ID of the camera
     * @param {string} camera.label - The label of the camera
     * @param {number} camera.order - The order of the camera
     * @returns {Promise<Object>} - Technical user information
     */
    async createTechnicalUser(technicalUserName, camera) {
        console.log(`Creating technical user ${technicalUserName} for camera ${camera.label} (${camera.deviceId})`);
        
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
            
            if (!tracks || tracks.length === 0 || !tracks[0]) {
                throw new Error(`Failed to create video track for ${technicalUserName}`);
            }
            
            const videoTrack = tracks[0];
            const trackId = videoTrack.getId();
            
            console.log(`Created new track with ID ${trackId} for technical user ${technicalUserName}`);
            
            await technicalRoom.addTrack(videoTrack);
            console.log(`Technical user ${technicalUserName} added track ${trackId} to room`);

            if (this.conference.createVideoPreview) {
                this.conference.createVideoPreview(videoTrack, camera.label, camera.order - 1);
            }

            const techUser = {
                connection: technicalConnection,
                room: technicalRoom,
                track: videoTrack,
                trackId: trackId,
                deviceId: camera.deviceId,
                label: camera.label,
                order: camera.order
            };
            
            this.technicalUsers.set(technicalUserName, techUser);
            
            return techUser;
        } catch (error) {
            console.error(`Error creating technical user ${technicalUserName}:`, error);
            throw error;
        }
    }
    
    /**
     * Removes a technical user by deviceId
     * 
     * @param {string} deviceId - The device ID to remove
     * @returns {Promise<boolean>} - True if removed successfully
     */
    async removeTechnicalUserByDeviceId(deviceId) {
        let foundUser = null;
        let foundUserName = null;
        
        // Find the technical user with this deviceId
        for (const [userName, userData] of this.technicalUsers.entries()) {
            if (userData.deviceId === deviceId) {
                foundUser = userData;
                foundUserName = userName;
                break;
            }
        }
        
        if (!foundUser) {
            console.warn(`No technical user found for deviceId ${deviceId}`);
            return false;
        }
        
        return this.removeTechnicalUser(foundUserName);
    }
    
    /**
     * Removes a technical user by name
     * 
     * @param {string} userName - The technical user name
     * @returns {Promise<boolean>} - True if removed successfully
     */
    async removeTechnicalUser(userName) {
        if (!this.technicalUsers.has(userName)) {
            console.warn(`Technical user ${userName} not found`);
            return false;
        }
        
        const userData = this.technicalUsers.get(userName);
        console.log(`Removing technical user ${userName} with trackId ${userData.trackId}`);
        
        try {
            if (this.conference.notifyTrackRemoval && userData.trackId) {
                this.conference.notifyTrackRemoval(userData.trackId);
            }
            
            if (userData.room && userData.track) {
                await userData.room.removeTrack(userData.track);
            }
            
            if (this.conference.removeVideoElementByTrackId && userData.trackId) {
                this.conference.removeVideoElementByTrackId(userData.trackId, userData.deviceId);
            }
            
            const previewContainer = document.querySelector(`[data-camera-id="${userData.deviceId}"]`);
            if (previewContainer) {
                previewContainer.remove();
                console.log(`Removed preview for camera: ${userData.label}`);
            }
            
            if (userData.track && typeof userData.track.dispose === 'function') {
                await userData.track.dispose();
                console.log(`Disposed track for technical user ${userName}`);
                this.onTrackDisposed(userData.trackId);
            }
            
            if (userData.room) {
                userData.room.leave();
            }
            
            if (userData.connection) {
                await userData.connection.disconnect();
                console.log(`Disconnected technical user: ${userName}`);
            }
            
            this.technicalUsers.delete(userName);
            
            return true;
        } catch (error) {
            console.error(`Error removing technical user ${userName}:`, error);
            this.onError(error);
            return false;
        }
    }
    
    /**
     * Checks if a device is being used by a technical user
     * 
     * @param {string} deviceId - The device ID to check
     * @returns {boolean} - True if device is used by a technical user
     */
    isDeviceInUse(deviceId) {
        for (const [userName, userData] of this.technicalUsers.entries()) {
            if (userData.deviceId === deviceId) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Gets all technical users
     * 
     * @returns {Array<Object>} - List of technical user data
     */
    getAllTechnicalUsers() {
        const users = [];
        for (const [userName, userData] of this.technicalUsers.entries()) {
            users.push({
                name: userName,
                ...userData
            });
        }
        return users;
    }
    
    /**
     * Disposes all technical users
     */
    async disposeAll() {
        const userNames = Array.from(this.technicalUsers.keys());
        for (const userName of userNames) {
            await this.removeTechnicalUser(userName);
        }
    }
}