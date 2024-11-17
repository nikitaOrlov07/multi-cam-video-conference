async function getDevices() {
    try {
        console.log("getDevices function is called");
        // Stop any existing streams
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

            const orderInput = document.createElement('input');
            orderInput.type = 'number';
            orderInput.className = 'camera-order form-control';
            orderInput.min = 1;
            orderInput.max = videoDevices.length;
            orderInput.value = index + 1;

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

            li.appendChild(orderInput);
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

    } catch (error) {
        console.error('Error fetching device list:', error);
        document.getElementById('errorAlert').textContent =
            `Error accessing media devices: ${error.message}`;
        document.getElementById('errorAlert').style.display = 'block';
    }
}

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

function playRecording(deviceId) {
    if (audioChunks.length === 0) return;

    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
}

async function openPreviewModal() {
    console.log("open Preview model");
    const rows = parseInt(document.getElementById('gridRows').value);
    const cols = parseInt(document.getElementById('gridCols').value);
    const requiredCameras = rows * cols;

    const selectedCameras = Array.from(document.querySelectorAll('input[type="checkbox"][id^="camera-"]:checked'));

    if (selectedCameras.length !== requiredCameras) {
        alert(`Please select exactly ${requiredCameras} cameras (${rows}×${cols} grid)`);
        return;
    }

    // Проверка на наличие выбранного микрофона
    const selectedAudio = document.querySelector('input[type="radio"][name="microphone"]:checked');
    if (!selectedAudio) {
        alert('Please select at least one microphone');
        return;
    }

    const previewGrid = document.getElementById('previewGrid');
    const selectedAudioLabel = document.getElementById('selectedAudioLabel');

    // Clear previous previews and streams
    previewGrid.innerHTML = '';
    stopAllStreams();

    // Set grid layout
    previewGrid.style.display = 'grid';
    previewGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    previewGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    // Sort cameras by order
    const sortedCameras = selectedCameras
        .map(camera => ({
            element: camera,
            order: parseInt(camera.parentElement.querySelector('.camera-order').value)
        }))
        .sort((a, b) => a.order - b.order)
        .map(item => item.element);

    // Check for duplicate orders
    const orders = sortedCameras.map(camera =>
        parseInt(camera.parentElement.querySelector('.camera-order').value)
    );
    const hasDuplicates = new Set(orders).size !== orders.length;

    if (hasDuplicates) {
        alert('Please ensure each camera has a unique order number');
        return;
    }

    // Create preview for each selected camera
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

    // Update selected audio device
    selectedAudioLabel.textContent = selectedAudio ?
        selectedAudio.dataset.label :
        'No audio device selected';

    // Show modal using Bootstrap
    previewModal.show();
}

function closePreviewModal() {
    stopAllStreams();
    if (document.getElementById('joinConferenceModal').style.display === 'block') {
        return; // Не закрываем preview модальное окно, если открыто join модальное окно
    }
    previewModal.hide();
}

function stopAllStreams() {
    activeStreams.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
    });
    activeStreams = [];
}

function createNewConference() {
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

    const gridSize = {
        rows: parseInt(document.getElementById('gridRows').value),
        cols: parseInt(document.getElementById('gridCols').value)
    };

    // Get userName from hidden input
    const userName = document.getElementById('userNameInput').value;

    const requestBody = {
        cameras: selectedCameras,
        audio: audioDevice,
        gridSize: gridSize,
        userName: userName  // Add userName to request body
    };

    sendDeviceData(requestBody);
}

function openJoinModal() {
    previewModal.hide(); // Close preview modal first
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

    const gridSize = {
        rows: parseInt(document.getElementById('gridRows').value),
        cols: parseInt(document.getElementById('gridCols').value)
    };

    const userName = document.getElementById('userNameInput').value;

    const requestBody = {
        cameras: selectedCameras,
        audio: audioDevice,
        gridSize: gridSize,
        userName: userName
    };

    sendDeviceData(requestBody, identifier);
}

function sendDeviceData(requestBody, identifier = null) {
    // Add userName to URL parameters
    const userName = encodeURIComponent(requestBody.userName);
    const url = '/connect-devices' +
        (identifier ? `?identifier=${identifier}` : '') +
        (userName ? `${identifier ? '&' : '?'}userName=${userName}` : '');

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
                    // Include userName in redirect URL
                    window.location.href = `/conference?conferenceId=${conferenceId}&userName=${userName}`;
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