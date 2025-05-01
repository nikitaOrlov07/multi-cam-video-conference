const ConferenceUtils = {
    cameraOrderMap: new Map(),
    async updateUserCount(conferenceId, userName, userCounts, displayName, reconnecting, callback) {
        try {
            let userDisplayName = userName;
            if (userDisplayName && userDisplayName.includes('_technical')) {
                userDisplayName = userDisplayName.split('_technical')[0];
            }

            if (reconnecting && userDisplayName === displayName) {
                console.log('Skipping user count update for reconnecting user');
                return Promise.resolve(userCounts.get(userDisplayName) || 1);
            }

            if (userDisplayName === displayName) {
                if (!userCounts.has(userDisplayName)) {
                    userCounts.set(userDisplayName, 1);
                }
                if (callback && typeof callback === 'function') {
                    callback();
                }
                return Promise.resolve(userCounts.get(userDisplayName));
            }

            return fetch(`/conference/updateUserJoinCount?userName=${encodeURIComponent(userDisplayName)}&conferenceId=${encodeURIComponent(conferenceId)}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to update user count');
                    }
                    return response.json().catch(() => 0);
                })
                .then(count => {
                    userCounts.set(userDisplayName, count);
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                    return count;
                })
                .catch(error => {
                    console.error('Error updating user count:', error);
                    ConferenceUtils.showError('Error while updating users count');
                    return null;
                });
        } catch (error) {
            console.error('Error updating user count:', error);
            ConferenceUtils.showError('Error while updating users count');
            return Promise.resolve(null);
        }
    },
    getParticipantSection(displayName, conference) {
        if (!conference || !conference.displayNameToSectionMap) {
            const sections = document.querySelectorAll('.participant-section');
            for (const section of sections) {
                const nameDiv = section.querySelector('.participant-name');
                if (nameDiv && nameDiv.textContent === displayName) {
                    return section;
                }
            }
            return null;
        }
        if (conference.displayNameToSectionMap.has(displayName)) {
            const sectionId = conference.displayNameToSectionMap.get(displayName);
            const section = document.querySelector(`[data-participant-id="${sectionId}"]`);
            if (section) {
                return section;
            }
        }
        const sections = document.querySelectorAll('.participant-section');
        for (const section of sections) {
            const nameDiv = section.querySelector('.participant-name');
            if (nameDiv && nameDiv.textContent === displayName) {
                return section;
            }
        }
        return null;
    },
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
    , async loadDeviceConfig(conferenceId, userName) {
        try {
            const response = await fetch(`/api/conference/devices?conferenceId=${conferenceId}&userName=${userName}`);
            if (!response.ok) {
                throw new Error('Failed to load device configuration');
            }
            return await response.json();
        } catch (error) {
            this.showError(`Error while loading users ${userName} configuration`);
            throw error;
        }
    },
    startUserCountUpdates() {
        if (this.userUpdateInterval) {
            clearInterval(this.userUpdateInterval);
            this.userUpdateInterval = null;
        }
        this.userUpdateInterval = setInterval(() => {
            console.log("Running background user count verification");
            this.userCounts.forEach((_, userName) => {
                this.updateUserCount(
                    this.conferenceId,
                    userName,
                    this.userCounts,
                    this.displayName,
                    false,
                    () => ConferenceUtils.updateUsersList()
                );
            });
        }, 300000);
    }
    , updateButtonState(buttonId, enabled) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.classList.toggle('muted', !enabled);
        }
    }
    ,
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
    },
    onConnectionFailed() {
        ConferenceUtils.showError('Server connection error');
        document.getElementById('loading').style.display = 'none';
    },
    onDisconnected() {
        if (this.userUpdateInterval) {
            clearInterval(this.userUpdateInterval);
        }
        console.log('The connection is broken');
    }
}
ConferenceUtils.setupControlButtons = function(conferenceInstance) {
    document.getElementById('toggleVideo').addEventListener('click', () => {
        if (conferenceInstance.localTracks.video) {
            conferenceInstance.localTracks.video.forEach(track => {
                if (track.isMuted()) {
                    track.unmute();
                } else {
                    track.mute();
                }
                conferenceInstance.updateButtonState('toggleVideo', !track.isMuted());
            });
        }
    });

    document.getElementById('toggleAudio').addEventListener('click', () => {
        if (conferenceInstance.localTracks.audio) {
            if (conferenceInstance.localTracks.audio.isMuted()) {
                conferenceInstance.localTracks.audio.unmute();
            } else {
                conferenceInstance.localTracks.audio.mute();
            }
            conferenceInstance.updateButtonState('toggleAudio', !conferenceInstance.localTracks.audio.isMuted());
        }
    });

    document.getElementById('leaveCall').addEventListener('click', () => {
        conferenceInstance.leaveConference();
    });
};
ConferenceUtils.updateUsersList = function() {
    const videoConference = window.conference;
    if (!videoConference) {
        console.error('VideoConference instance not found');
        return;
    }

    const usersListElement = document.getElementById('users-list');
    if (!usersListElement) {
        console.error('Users list element not found');
        return;
    }

    usersListElement.innerHTML = '';
    const uniqueUsers = new Set();

    videoConference.participants.forEach(participant => {
        uniqueUsers.add(participant.displayName);
    });

    uniqueUsers.add(videoConference.userName);

    uniqueUsers.forEach(userName => {
        if (!videoConference.userCounts.has(userName)) {
            videoConference.userCounts.set(userName, 1);
        }
    });

    if (!videoConference.participants.has("local")) {
        videoConference.participants.set("local", {
            id: "local",
            displayName: videoConference.userName,
            tracks: new Map()
        });
    }

    videoConference.userCounts.forEach((count, userName) => {
        if (!uniqueUsers.has(userName) && userName !== videoConference.userName) {
            return;
        }

        const isVisible = videoConference.userVisibility.get(userName) !== false;
        const isLocalUser = userName === videoConference.userName;
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
        checkbox.addEventListener('change',   (e) => {
            videoConference.toggleUserVisibility(userName, e.target.checked);
        });

        usersListElement.appendChild(userItem);
    });
};
ConferenceUtils.setGlobalConference = function(conferenceInstance) {
    window.conference = conferenceInstance;
    console.log('Global conference instance set', window.conference);
    return window.conference;
};
ConferenceUtils.getConferenceInstance = function() {
    if (!window.conference) {
        console.error('VideoConference instance not found in window.conference');
        return null;
    }
    return window.conference;
};
