/// Logic to make initial setting configuration without cameras
function setupWithoutVideoToggle() {
    const withoutCamerasToggle = document.getElementById('withoutCamerasToggle');

    if (!withoutCamerasToggle) {
        console.error("Audio only toggle checkbox not found!");
        return;
    }

    const camerasColumn = document.querySelector('.row > .col-md-6:first-child');

    withoutCamerasToggle.addEventListener('change', function() {
        if (this.checked) {
            if (camerasColumn) camerasColumn.style.display = 'none';
            document.querySelectorAll('input[type="checkbox"][id^="camera-"]').forEach(checkbox => {
                checkbox.checked = false;
            });
        } else {
            if (camerasColumn) camerasColumn.style.display = 'block';
        }
    });

    if (withoutCamerasToggle.checked) {
        if (camerasColumn) camerasColumn.style.display = 'none';
    }
}

/// Logic to make initial device configuration without microphone
function setupWithoutAudioToggle() {
    const withoutAudioToggle = document.getElementById('withoutAudioToggle');

    if (!withoutAudioToggle) {
        console.error("Without audio toggle checkbox not found!");
        return;
    }
    const audiosColumn = document.querySelector('.row > .col-md-6:last-child');

    withoutAudioToggle.addEventListener('change', function() {
        if (this.checked) {
            if (audiosColumn) audiosColumn.style.display = 'none';

            document.querySelectorAll('input[type="radio"][name="microphone"]').forEach(radio => {
                radio.checked = false;
            });

        } else {
            if (audiosColumn) audiosColumn.style.display = 'block';
        }
    });

    if (withoutAudioToggle.checked) {
        if (audiosColumn) audiosColumn.style.display = 'none';
    }
}
async function getDevices() {
    try {
        const existingVideos = document.querySelectorAll('video');
        existingVideos.forEach(video => {
            if (video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
            }
        });

        const devices = await navigator.mediaDevices.enumerateDevices();

        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');

        if (videoDevices.length === 0 && audioDevices.length === 0) {
            throw new Error('No media devices found');
        }

        const cameraList = document.getElementById('cameraList');
        const audioList = document.getElementById('audioList');

        cameraList.innerHTML = '';
        audioList.innerHTML = '';

        videoDevices.forEach((device, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item camera-item';

            const video = document.createElement('video');
            video.setAttribute('id', 'video-' + index);
            video.setAttribute('autoplay', '');
            video.setAttribute('playsinline', '');
            video.setAttribute('style', 'width: 100%; height: auto;');
            video.muted = true;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'camera-' + index;
            checkbox.value = device.deviceId;
            checkbox.dataset.label = device.label || `Camera ${index + 1}`;
            checkbox.className = 'form-check-input ms-2';

            const label = document.createElement('label');
            label.setAttribute('for', 'camera-' + index);
            label.textContent = device.label || `Camera ${index + 1}`;
            label.className = 'form-check-label ms-2';
            li.appendChild(checkbox);
            li.appendChild(label);
            li.appendChild(video);
            cameraList.appendChild(li);
            navigator.mediaDevices.getUserMedia({
                video: { deviceId: device.deviceId },
                audio: false
            })
                .then(stream => {
                    video.srcObject = stream;
                })
                .catch(error => {
                    console.error('Error accessing video stream: ', error);
                });
        });


        audioDevices.forEach((device, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'microphone';
            radio.id = 'audio-' + index;
            radio.value = device.deviceId;
            radio.dataset.label = device.label || `Microphone ${index + 1}`;

            const label = document.createElement('label');
            label.setAttribute('for', 'audio-' + index);
            label.textContent = device.label || `Microphone ${index + 1}`;

            const audioTestContainer = document.createElement('div');
            audioTestContainer.className = 'audio-test-container';

            const canvas = document.createElement('canvas');
            canvas.className = 'audio-visualizer';
            canvas.id = `visualizer-${device.deviceId}`;
            canvas.width = 200;
            canvas.height = 60;

            const testControls = document.createElement('div');
            testControls.className = 'test-controls';

            const recordButton = document.createElement('button');
            recordButton.className = 'btn btn-primary btn-sm';
            recordButton.textContent = 'Start Recording';
            recordButton.onclick = () => startAudioTest(device.deviceId);

            const stopButton = document.createElement('button');
            stopButton.className = 'btn btn-danger btn-sm';
            stopButton.textContent = 'Stop Recording';
            stopButton.style.display = 'none';
            stopButton.onclick = () => stopAudioTest(device.deviceId);

            const playButton = document.createElement('button');
            playButton.className = 'btn btn-success btn-sm';
            playButton.textContent = 'Play Recording';
            playButton.style.display = 'none';
            playButton.onclick = () => playRecording(device.deviceId);

            testControls.appendChild(recordButton);
            testControls.appendChild(stopButton);
            testControls.appendChild(playButton);

            audioTestContainer.appendChild(canvas);
            audioTestContainer.appendChild(testControls);

            li.appendChild(radio);
            li.appendChild(label);
            li.appendChild(audioTestContainer);
            audioList.appendChild(li);
        });

        document.querySelectorAll('.previous-config-radio').forEach(radio => {
            radio.addEventListener('change', function() {
                document.querySelectorAll('.previous-config-radio').forEach(r => {
                    if (r !== this) r.checked = false;
                });
            });
        });

    } catch (error) {
        console.error('Error fetching device list:', error);
        document.getElementById('errorAlert').textContent =
            `Error accessing media devices: ${error.message}`;
        document.getElementById('errorAlert').style.display = 'block';
    }
}

/// Logic for start audio test for microphone
async function startAudioTest(deviceId) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: deviceId }
        });

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.start();
        currentTestingMicrophone = deviceId;

        const container = document.querySelector(`#visualizer-${deviceId}`).parentElement;
        container.querySelector('button:nth-child(1)').style.display = 'none';
        container.querySelector('button:nth-child(2)').style.display = 'inline-block';
        container.querySelector('button:nth-child(3)').style.display = 'none';

        drawAudioVisualization(analyser, deviceId);

    } catch (error) {
        console.error('Error starting audio test:', error);
    }
}

/// Logic for draw visualization for microphone testing
function drawAudioVisualization(analyser, deviceId) {
    const canvas = document.getElementById(`visualizer-${deviceId}`);
    const canvasCtx = canvas.getContext('2d');
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    function draw() {
        if (currentTestingMicrophone !== deviceId) return;

        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        const barWidth = (WIDTH / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;
            canvasCtx.fillStyle = `rgb(50, 50, ${barHeight + 100})`;
            canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }

    draw();
}
/// Logic for stoping microphone testing
function stopAudioTest(deviceId) {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        currentTestingMicrophone = null;

        const container = document.querySelector(`#visualizer-${deviceId}`).parentElement;
        container.querySelector('button:nth-child(1)').style.display = 'inline-block';
        container.querySelector('button:nth-child(2)').style.display = 'none';
        container.querySelector('button:nth-child(3)').style.display = 'inline-block';

        const canvas = document.getElementById(`visualizer-${deviceId}`);
        const canvasCtx = canvas.getContext('2d');
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    }
}
/// Logic for play sound from microphone testing
function playRecording(deviceId) {
    if (audioChunks.length === 0) return;

    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
}

/// Logic to open a “Preview Window” where the user can see what they have selected
async function openPreviewModal() {
    const conferenceIdElement = document.getElementById('conferenceIdInput');
    const hasPresetConferenceId = !!(conferenceIdElement && conferenceIdElement.value.trim());
    const selectedConfig = document.querySelector('input[name="previousConfiguration"]:checked');
    const isWithoutCameras = document.getElementById('withoutCamerasToggle').checked;
    const isWithoutAudio = document.getElementById('withoutAudioToggle').checked;
    if (selectedConfig) {
        try {
            const response = await fetch(`/api/conference/devices/${selectedConfig.value}`);
            if (!response.ok) {
                throw new Error('Failed to fetch configuration details');
            }
            const config = await response.json();
            const previewGrid = document.getElementById('previewGrid');
            const selectedAudioLabel = document.getElementById('selectedAudioLabel');
            previewGrid.innerHTML = '';
            stopAllStreams();
            const sortedCameras = [...config.cameras].sort((a, b) => a.order - b.order);
            for (let i = 0; i < sortedCameras.length; i++) {
                const camera = sortedCameras[i];
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                const video = document.createElement('video');
                video.className = 'preview-video';
                video.autoplay = true;
                video.playsInline = true;
                video.muted = true;
                const label = document.createElement('div');
                label.className = 'camera-label';
                label.textContent = `${camera.label} (${i + 1})`;
                previewItem.appendChild(video);
                previewItem.appendChild(label);
                previewGrid.appendChild(previewItem);
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: camera.deviceId },
                        audio: false
                    });
                    video.srcObject = stream;
                    activeStreams.push(stream);
                } catch (error) {
                    console.error('Error accessing camera:', error);
                    label.textContent = `${camera.label} (${i + 1}) - Device unavailable`;
                }
            }
            selectedAudioLabel.textContent = config.audio && config.audio.length > 0
                ? config.audio[0].label
                : 'No audio device selected';
            previewModal.show();
            if (hasPresetConferenceId) {
                const modalElement = document.getElementById('previewModal');
                if (!modalElement) {
                    console.error("Could not find modal window element with ID 'previewModal'!");
                    return;
                }
                const createBtn = modalElement.querySelector('.btn-success');
                const cancelBtn = modalElement.querySelector('.btn-secondary');
                const joinBtn = modalElement.querySelector('.btn-primary');
                if (createBtn) {
                    createBtn.style.display = 'none';
                } else {
                    console.error("The .btn-success button was not found OUTSIDE the modal window!");
                }
                if (cancelBtn) {
                    cancelBtn.style.display = 'inline-block';
                } else {
                    console.error("The .btn-secondary button is not found OUTSIDE the modal window!");
                }
                if (joinBtn) {
                    joinBtn.textContent = 'Join Conference';
                    joinBtn.onclick = function() {
                        const conferenceId = conferenceIdElement.value;
                        joinPresetConference(conferenceId);
                    };
                } else {
                    console.error("The .btn-primary button is not found OUTSIDE the modal window");
                }
            }
        } catch (error) {
            console.error('Error setting up preview for previous configuration:', error);
            alert('Failed to load previous configuration. Please try again or select new devices.');
        }
        return;
    }

    const selectedCameras = Array.from(document.querySelectorAll('input[type="checkbox"][id^="camera-"]:checked'));
    if (!isWithoutCameras && selectedCameras.length === 0) {
        alert('Please select at least one camera');
        return;
    }
    let selectedAudio = null;
    if (!isWithoutAudio) {
        console.log("Is without audio", isWithoutAudio);
        selectedAudio = document.querySelector('input[type="radio"][name="microphone"]:checked');
        if (!selectedAudio) {
            alert('Please select at least one microphone');
            return;
        }
    }
    const previewGrid = document.getElementById('previewGrid');
    const selectedAudioLabel = document.getElementById('selectedAudioLabel');

    previewGrid.innerHTML = '';
    stopAllStreams();

    const sortedCameras = selectedCameras
        .map(camera => ({
            element: camera,
            order: parseInt(camera.parentElement.querySelector('.camera-order').value)
        }))
        .sort((a, b) => a.order - b.order)
        .map(item => item.element);

    const orders = sortedCameras.map(camera =>
        parseInt(camera.parentElement.querySelector('.camera-order').value)
    );
    const hasDuplicates = new Set(orders).size !== orders.length;
    if (hasDuplicates) {
        alert('Please ensure each camera has a unique order number');
        return;
    }

    for (let i = 0; i < sortedCameras.length; i++) {
        const camera = sortedCameras[i];
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';

        const video = document.createElement('video');
        video.className = 'preview-video';
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;

        const label = document.createElement('div');
        label.className = 'camera-label';
        label.textContent = `${camera.dataset.label} (${i + 1})`;
        previewItem.appendChild(video);
        previewItem.appendChild(label);
        previewGrid.appendChild(previewItem);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: camera.value },
                audio: false
            });
            video.srcObject = stream;
            activeStreams.push(stream);
        } catch (error) {
            console.error('Error accessing camera:', error);
            label.textContent = 'Error: Could not access camera';
        }
    }

    selectedAudioLabel.textContent = isWithoutAudio ?
        'No audio device selected' :
        selectedAudio.dataset.label;

    previewModal.show();
    if (hasPresetConferenceId) {
        const modalElement = document.getElementById('previewModal');
        if (!modalElement) {
            console.error("Could not find modal window element with ID 'previewModal'!");
            return;
        }
        const createBtn = modalElement.querySelector('.btn-success');
        const cancelBtn = modalElement.querySelector('.btn-secondary');
        const joinBtn = modalElement.querySelector('.btn-primary');
        if (createBtn) {
            createBtn.style.display = 'none';
        } else {
            console.error("The .btn-success button was not found OUTSIDE the modal window!");
        }
        if (cancelBtn) {
            cancelBtn.style.display = 'inline-block';
        } else {
            console.error("The .btn-secondary button is not found OUTSIDE the modal window!");
        }
        if (joinBtn) {
            joinBtn.textContent = 'Join Conference';
            joinBtn.onclick = function() {
                const conferenceId = conferenceIdElement.value;
                joinPresetConference(conferenceId);
            };
        } else {
            console.error("The .btn-primary button is not found OUTSIDE the modal window");
        }
    }
}
/// Logic for joining an already chosen conference
function joinPresetConference(conferenceId) {
    const selectedConfig = document.querySelector('input[name="previousConfiguration"]:checked');

    if (selectedConfig) {
        const configurationId = selectedConfig.value;
        const userName = document.getElementById('userNameInput').value;
        const requestBody = {
            userName: userName
        };
        sendDeviceData(requestBody, conferenceId, configurationId);
    } else {
        const selectedCameras = Array.from(document.querySelectorAll('input[type="checkbox"][id^="camera-"]:checked'))
            .map(checkbox => ({
                deviceId: checkbox.value,
                label: checkbox.dataset.label,
                order: parseInt(checkbox.parentElement.querySelector('.camera-order').value)
            }))
            .sort((a, b) => a.order - b.order);

        const selectedAudio = document.querySelector('input[type="radio"][name="microphone"]:checked');
        const audioDevice = selectedAudio ? [{
            deviceId: selectedAudio.value,
            label: selectedAudio.dataset.label
        }] : [];

        const userName = document.getElementById('userNameInput').value;

        const requestBody = {
            cameras: selectedCameras,
            audio: audioDevice,
            userName: userName
        };

        sendDeviceData(requestBody, conferenceId);
    }
}


function stopAllStreams() {
    activeStreams.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
    });
    activeStreams = [];
}

/// Logic for joining a new conference
function createNewConference() {
    const selectedConfig = document.querySelector('input[name="previousConfiguration"]:checked');
    if (selectedConfig) {
        const configurationId = selectedConfig.value;
        const userName = document.getElementById('userNameInput').value;
        const requestBody = {
            userName: userName
        };
        sendDeviceData(requestBody, null, configurationId);
    } else {
        const selectedCameras = Array.from(document.querySelectorAll('input[type="checkbox"][id^="camera-"]:checked'))
            .map(checkbox => ({
                deviceId: checkbox.value,
                label: checkbox.dataset.label,
                order: parseInt(checkbox.parentElement.querySelector('.camera-order').value)
            }))
            .sort((a, b) => a.order - b.order);
        const selectedAudio = document.querySelector('input[type="radio"][name="microphone"]:checked');
        const audioDevice = selectedAudio ? [{
            deviceId: selectedAudio.value,
            label: selectedAudio.dataset.label
        }] : [];
        const userName = document.getElementById('userNameInput').value;
        const requestBody = {
            cameras: selectedCameras,
            audio: audioDevice,
            userName: userName
        };
        sendDeviceData(requestBody);
    }
}

/// Logic for join already existing conference
function openJoinModal() {
    previewModal.hide();
    const joinModal = document.getElementById('joinConferenceModal');
    const conferenceInput = document.getElementById('conferenceIdentifier');

    document.getElementById('errorAlert').style.display = 'none';
    conferenceInput.value = '';

    joinModal.style.display = 'block';

    // Reset modal position and remove transform
    const modalContent = joinModal.querySelector('.modal-content');
    modalContent.style.transform = 'none';

    // Set focus after a small delay
    setTimeout(() => {
        conferenceInput.focus();
    }, 100);
}

function closeJoinModal() {
    const joinModal = document.getElementById('joinConferenceModal');
    joinModal.style.display = 'none';
    document.getElementById('errorAlert').style.display = 'none';
}


function joinConference() {
    const identifier = document.getElementById('conferenceIdentifier').value.trim();

    if (!identifier) {
        alert('Please enter a conference identifier');
        return;
    }
    const selectedConfig = document.querySelector('input[name="previousConfiguration"]:checked');
    if (selectedConfig) {
        const configurationId = selectedConfig.value;
        const userName = document.getElementById('userNameInput').value;
        const requestBody = {
            userName: userName
        };
        sendDeviceData(requestBody, identifier, configurationId);
    } else {
        const selectedCameras = Array.from(document.querySelectorAll('input[type="checkbox"][id^="camera-"]:checked'))
            .map(checkbox => ({
                deviceId: checkbox.value,
                label: checkbox.dataset.label,
                order: parseInt(checkbox.parentElement.querySelector('.camera-order').value)
            }))
            .sort((a, b) => a.order - b.order);

        const selectedAudio = document.querySelector('input[type="radio"][name="microphone"]:checked');
        const audioDevice = selectedAudio ? [{
            deviceId: selectedAudio.value,
            label: selectedAudio.dataset.label
        }] : [];
        const userName = document.getElementById('userNameInput').value;
        const requestBody = {
            cameras: selectedCameras,
            audio: audioDevice,
            userName: userName
        };
        sendDeviceData(requestBody, identifier);
    }
}

/// Logic for sending selected device data to backend
function sendDeviceData(requestBody, identifier = null, configurationId = null) {
    const userName = encodeURIComponent(requestBody.userName);
    let url = '/connect-devices';
    const params = [];
    if (identifier) params.push(`identifier=${identifier}`);
    if (userName) params.push(`userName=${userName}`);
    if (configurationId) params.push(`configurationId=${configurationId}`);

    if (params.length > 0) {
        url += '?' + params.join('&');
    }
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    })
        .then(response => {
            if (response.ok) {
                return response.text().then(conferenceId => {
                    stopAllStreams();
                    window.location.href = `/conference/join?conferenceId=${conferenceId}&userName=${userName}`;
                });
            } else {
                return response.text().then(text => {
                    if (text === "No conference with identifier") {
                        document.getElementById('errorAlert').style.display = 'block';
                    } else {
                        console.error('Error:', text);
                    }
                });
            }
        })
        .catch(error => {
            console.error('Error during fetch request:', error);
        });
}

///  Logic for toggling the Previous Config section
function togglePreviousConfig(radio) {
    if (radio.getAttribute('data-was-checked') === 'true') {
        radio.checked = false;
        radio.setAttribute('data-was-checked', 'false');
    } else {
        document.querySelectorAll('.previous-config-radio').forEach(r => {
            r.setAttribute('data-was-checked', 'false');
        });
        radio.setAttribute('data-was-checked', 'true');
    }
}