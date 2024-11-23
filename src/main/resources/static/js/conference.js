// conference.js
class VideoConference {
    constructor() {
        this.localCameras = new Map(); // Map to store local camera streams
        this.peers = new Map(); // Map to store peer connections
        this.mediaDevices = []; // Available media devices
        this.conferenceId = new URL(window.location.href).searchParams.get('conferenceId');

        this.initializeElements();
        this.initializeEventListeners();
        this.loadAvailableDevices();
        this.connectToServer();
    }

    initializeElements() {
        this.userCameraList = document.getElementById('user-camera-list');
        this.participantsGrid = document.getElementById('participants-grid');
        this.modal = document.getElementById('camera-modal');
        this.cameraSelect = document.getElementById('camera-select');
        this.addCameraBtn = document.getElementById('add-camera');
        this.confirmCameraBtn = document.getElementById('confirm-camera');
        this.closeModalBtn = document.querySelector('.close');
    }

    initializeEventListeners() {
        this.addCameraBtn.addEventListener('click', () => this.showCameraModal());
        this.confirmCameraBtn.addEventListener('click', () => this.addSelectedCamera());
        this.closeModalBtn.addEventListener('click', () => this.hideModal());

        // Handle device changes
        navigator.mediaDevices.addEventListener('devicechange', () => {
            this.loadAvailableDevices();
        });
    }

    async loadAvailableDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.mediaDevices = devices.filter(device => device.kind === 'videoinput');
            this.updateCameraSelect();
        } catch (error) {
            console.error('Error loading devices:', error);
        }
    }

    updateCameraSelect() {
        this.cameraSelect.innerHTML = '';
        this.mediaDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${device.deviceId.slice(0, 5)}...`;
            this.cameraSelect.appendChild(option);
        });
    }

    showCameraModal() {
        this.modal.style.display = 'block';
    }

    hideModal() {
        this.modal.style.display = 'none';
    }

    async addSelectedCamera() {
        const deviceId = this.cameraSelect.value;
        if (!deviceId) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId } }
            });

            const cameraItem = this.createCameraItem(stream, deviceId);
            this.userCameraList.appendChild(cameraItem);
            this.localCameras.set(deviceId, stream);

            // Save camera configuration to server
            await this.saveCameraConfiguration();

            this.hideModal();
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Error accessing camera. Please try again.');
        }
    }

    createCameraItem(stream, deviceId) {
        const div = document.createElement('div');
        div.className = 'camera-item';

        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        const info = document.createElement('div');
        info.className = 'camera-info';
        info.textContent = this.mediaDevices.find(d => d.deviceId === deviceId)?.label ||
            `Camera ${deviceId.slice(0, 5)}...`;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-camera';
        removeBtn.innerHTML = '<i class="fas fa-minus"></i>';
        removeBtn.onclick = () => this.removeCamera(deviceId, div);

        div.appendChild(video);
        div.appendChild(info);
        div.appendChild(removeBtn);

        return div;
    }

    async removeCamera(deviceId, element) {
        const stream = this.localCameras.get(deviceId);
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            this.localCameras.delete(deviceId);
        }

        element.remove();
        await this.saveCameraConfiguration();
    }

    async saveCameraConfiguration() {
        const cameraConfig = Array.from(this.localCameras.keys()).map((deviceId, index) => ({
            deviceId,
            label: this.mediaDevices.find(d => d.deviceId === deviceId)?.label || '',
            order: index + 1
        }));

        try {
            await fetch(`/api/conference/${this.conferenceId}/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cameraConfiguration: JSON.stringify(cameraConfig)
                })
            });
        } catch (error) {
            console.error('Error saving camera configuration:', error);
        }
    }

    async connectToServer() {
        // Implement WebSocket connection for signaling
        this.ws = new WebSocket(`ws://${window.location.host}/conference/${this.conferenceId}`);

        this.ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            await this.handleSignalingMessage(message);
        };
    }

    async handleSignalingMessage(message) {
        switch (message.type) {
            case 'new-participant':
                await this.initializePeerConnection(message.participantId);
                break;
            case 'offer':
                await this.handleOffer(message);
                break;
            case 'answer':
                await this.handleAnswer(message);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(message);
                break;
        }
    }

    async initializePeerConnection(participantId) {
        const peer = new SimplePeer({
            initiator: true,
            trickle: false
        });

        // Add all local streams to the peer connection
        this.localCameras.forEach(stream => {
            stream.getTracks().forEach(track => {
                peer.addTrack(track, stream);
            });
        });

        peer.on('signal', data => {
            this.ws.send(JSON.stringify({
                type: 'signal',
                to: participantId,
                data
            }));
        });

        peer.on('stream', stream => {
            this.addParticipantVideo(participantId, stream);
        });

        this.peers.set(participantId, peer);
    }

    addParticipantVideo(participantId, stream) {
        const div = document.createElement('div');
        div.className = 'participant-video';

        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;

        div.appendChild(video);
        this.participantsGrid.appendChild(div);
    }

    // Implement other WebRTC signaling handlers (handleOffer, handleAnswer, handleIceCandidate)
}

// Initialize the conference when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const conference = new VideoConference();
});