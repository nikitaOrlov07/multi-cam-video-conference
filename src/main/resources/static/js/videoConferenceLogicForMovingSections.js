const MoveSectionLogic = {

}
MoveSectionLogic.makeVideosDraggableWithinSection = function() {
    const videoWrappers = document.querySelectorAll('.video-wrapper');
    videoWrappers.forEach(wrapper => {
        this.makeVideoDraggable(wrapper);
    });
};

MoveSectionLogic.makeVideoDraggable = function(videoWrapper) {
    if (videoWrapper.classList.contains('video-draggable-initialized')) {
        return;
    }

    videoWrapper.classList.add('video-draggable-initialized');
    videoWrapper.setAttribute('draggable', 'true');

    const dragHandle = document.createElement('div');
    dragHandle.className = 'video-drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.title = 'Drag to rearrange';
    dragHandle.style.cssText = `
        position: absolute;
        top: 5px;
        left: 5px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        cursor: move;
        z-index: 101;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    videoWrapper.appendChild(dragHandle);

    videoWrapper.addEventListener('mouseenter', () => {
        dragHandle.style.opacity = '1';
    });

    videoWrapper.addEventListener('mouseleave', () => {
        dragHandle.style.opacity = '0';
    });

    videoWrapper.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', videoWrapper.getAttribute('data-camera-order'));
        e.dataTransfer.setData('application/video-wrapper-id', videoWrapper.getAttribute('data-track-id'));
        videoWrapper.style.opacity = '0.4';
    });

    videoWrapper.addEventListener('dragend', () => {
        videoWrapper.style.opacity = '1';
    });

    const camerasContainer = videoWrapper.closest('.cameras-container');
    if (camerasContainer && !camerasContainer.classList.contains('drop-initialized')) {
        this.setupDropZone(camerasContainer);
    }
};

MoveSectionLogic.setupDropZone = function(camerasContainer) {
    camerasContainer.classList.add('drop-initialized');

    camerasContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const videoWrappers = camerasContainer.querySelectorAll('.video-wrapper');
        videoWrappers.forEach(wrap => {
            wrap.style.boxShadow = 'inset 0 0 0 2px rgba(66, 133, 244, 0.5)';
        });
    });

    camerasContainer.addEventListener('dragleave', () => {
        const videoWrappers = camerasContainer.querySelectorAll('.video-wrapper');
        videoWrappers.forEach(wrap => {
            wrap.style.boxShadow = '';
        });
    });

    camerasContainer.addEventListener('drop', (e) => {
        e.preventDefault();

        const videoWrappers = camerasContainer.querySelectorAll('.video-wrapper');
        videoWrappers.forEach(wrap => {
            wrap.style.boxShadow = '';
        });

        const srcCameraOrder = e.dataTransfer.getData('text/plain');
        const srcTrackId = e.dataTransfer.getData('application/video-wrapper-id');

        if (!srcTrackId) return;

        const sourceWrapper = camerasContainer.querySelector(`[data-track-id="${srcTrackId}"]`);
        if (!sourceWrapper) return;

        const dropX = e.clientX;
        const dropY = e.clientY;
        let closestWrapper = null;
        let closestDistance = Infinity;

        videoWrappers.forEach(wrapper => {
            if (wrapper === sourceWrapper) return;

            const rect = wrapper.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const distance = Math.sqrt(
                Math.pow(dropX - centerX, 2) + Math.pow(dropY - centerY, 2)
            );

            if (distance < closestDistance) {
                closestDistance = distance;
                closestWrapper = wrapper;
            }
        });

        if (closestWrapper) {
            const targetCameraOrder = closestWrapper.getAttribute('data-camera-order');

            sourceWrapper.setAttribute('data-camera-order', targetCameraOrder);
            closestWrapper.setAttribute('data-camera-order', srcCameraOrder);

            const sourceLabel = sourceWrapper.querySelector('.camera-label');
            const targetLabel = closestWrapper.querySelector('.camera-label');

            if (sourceLabel && targetLabel) {
                const sourceLabelText = sourceLabel.textContent;
                const targetLabelText = targetLabel.textContent;

                const sourceLabelBase = sourceLabelText.substring(0, sourceLabelText.lastIndexOf(' ') + 1);
                const targetLabelBase = targetLabelText.substring(0, targetLabelText.lastIndexOf(' ') + 1);

                sourceLabel.textContent = `${sourceLabelBase}${targetCameraOrder}`;
                targetLabel.textContent = `${targetLabelBase}${srcCameraOrder}`;
            }

            this.saveCameraOrderConfig(sourceWrapper, closestWrapper);

            const section = camerasContainer.closest('.participant-section');
            if (section && window.conference) {
                window.conference.updateSectionLayout(section);
            }
        }
    });
};

MoveSectionLogic.saveCameraOrderConfig = function(sourceWrapper, targetWrapper) {
    if (!window.conference || !window.conference.userName) return;

    const section = sourceWrapper.closest('.participant-section');
    if (!section) return;

    const displayName = section.querySelector('.participant-name')?.textContent;
    if (!displayName) return;

    const sourceTrackId = sourceWrapper.getAttribute('data-track-id');
    const targetTrackId = targetWrapper.getAttribute('data-track-id');

    if (window.conference.cameraOrderMap) {
        const sourceOrder = sourceWrapper.getAttribute('data-camera-order');
        const targetOrder = targetWrapper.getAttribute('data-camera-order');

        const conferenceId = window.conference.conferenceId;

        let sourceDeviceId = sourceTrackId;
        let targetDeviceId = targetTrackId;

        if (sourceDeviceId && targetDeviceId) {
            const sourceKey = `${displayName}_${sourceDeviceId}`;
            const targetKey = `${displayName}_${targetDeviceId}`;

            if (window.conference.cameraOrderMap.has(sourceKey)) {
                const sourceConfig = window.conference.cameraOrderMap.get(sourceKey);
                sourceConfig.order = parseInt(targetOrder);
                window.conference.cameraOrderMap.set(sourceKey, sourceConfig);
            }

            if (window.conference.cameraOrderMap.has(targetKey)) {
                const targetConfig = window.conference.cameraOrderMap.get(targetKey);
                targetConfig.order = parseInt(sourceOrder);
                window.conference.cameraOrderMap.set(targetKey, targetConfig);
            }

            try {
                const cameraConfigKey = `camera-config-${conferenceId}-${displayName}`;
                const cameraConfig = JSON.stringify(Array.from(window.conference.cameraOrderMap.entries())
                    .filter(([key]) => key.startsWith(`${displayName}_`)));
                localStorage.setItem(cameraConfigKey, cameraConfig);
                console.log(`Saved camera order configuration for ${displayName}`);
            } catch (e) {
                console.error('Error saving camera order configuration:', e);
            }
        }
    }
};
MoveSectionLogic.makeParticipantSectionsResizableAndDraggable = function() {
    const sections = document.querySelectorAll('.participant-section');

    sections.forEach(section => {
        this.makeResizable(section);
        this.makeDraggable(section);

        this.addControlsToSection(section);
    });

    window.addEventListener('beforeunload', () => {
        this.saveAllSectionPositions();
    });
};
MoveSectionLogic.makeResizable = function(element) {
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    resizer.style.cssText = `
        width: 10px;
        height: 10px;
        background-color: #4285f4;
        position: absolute;
        right: 0;
        bottom: 0;
        cursor: se-resize;
        z-index: 100;
    `;

    element.style.position = 'relative';
    element.appendChild(resizer);

    let originalWidth, originalHeight, originalX, originalY;

    const startResize = function(e) {
        e.preventDefault();
        originalWidth = parseFloat(getComputedStyle(element).width);
        originalHeight = parseFloat(getComputedStyle(element).height);
        originalX = e.pageX;
        originalY = e.pageY;

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    };

    const resize = function(e) {
        const width = originalWidth + (e.pageX - originalX);
        const height = originalHeight + (e.pageY - originalY);

        if (width > 100) {
            element.style.width = width + 'px';
        }

        if (height > 100) {
            element.style.height = height + 'px';
        }

        MoveSectionLogic.saveSectionPosition(element);

        const video = element.querySelector('video');
        if (video) {
            MoveSectionLogic.adjustVideoAspectRatio(video);
        }
    };

    const stopResize = function() {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    };

    resizer.addEventListener('mousedown', startResize);
};
MoveSectionLogic.makeDraggable = function(element) {
    const header = element.querySelector('.participant-header') ||
        element.querySelector('.participant-name');

    if (!header) {
        const newHeader = document.createElement('div');
        newHeader.className = 'participant-header';
        newHeader.style.cssText = `
            padding: 5px;
            background-color: #f1f1f1;
            cursor: move;
            user-select: none;
        `;

        const nameElement = element.querySelector('.participant-name');
        if (nameElement) {
            newHeader.appendChild(nameElement);
        } else {
            newHeader.innerHTML = '<span class="participant-name">Участник</span>';
        }

        element.insertBefore(newHeader, element.firstChild);
        header = newHeader;
    } else {
        header.style.cursor = 'move';
    }

    element.style.position = 'absolute';

    this.loadSectionPosition(element);

    let posX = 0, posY = 0, posInitX = 0, posInitY = 0;

    const dragMouseDown = function(e) {
        e.preventDefault();

        posInitX = e.clientX;
        posInitY = e.clientY;

        document.addEventListener('mousemove', elementDrag);
        document.addEventListener('mouseup', closeDragElement);
    };

    const elementDrag = function(e) {
        e.preventDefault();

        posX = posInitX - e.clientX;
        posY = posInitY - e.clientY;
        posInitX = e.clientX;
        posInitY = e.clientY;

        element.style.top = (element.offsetTop - posY) + "px";
        element.style.left = (element.offsetLeft - posX) + "px";

        MoveSectionLogic.saveSectionPosition(element);
    };

    const closeDragElement = function() {
        document.removeEventListener('mousemove', elementDrag);
        document.removeEventListener('mouseup', closeDragElement);
    };

    header.addEventListener('mousedown', dragMouseDown);
};

MoveSectionLogic.addControlsToSection = function(section) {
    const controlPanel = document.createElement('div');
    controlPanel.className = 'section-controls';
    controlPanel.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        display: flex;
        gap: 5px;
        z-index: 101;
    `;

    const maximizeBtn = document.createElement('button');
    maximizeBtn.innerHTML = '⤢';
    maximizeBtn.title = 'Максимизировать';
    maximizeBtn.className = 'control-button';
    maximizeBtn.style.cssText = `
        background: rgba(0,0,0,0.5);
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        padding: 2px 5px;
    `;

    const resetBtn = document.createElement('button');
    resetBtn.innerHTML = '↺';
    resetBtn.title = 'Сбросить размер и положение';
    resetBtn.className = 'control-button';
    resetBtn.style.cssText = `
        background: rgba(0,0,0,0.5);
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        padding: 2px 5px;
    `;

    maximizeBtn.addEventListener('click', () => {
        this.maximizeSection(section);
    });

    resetBtn.addEventListener('click', () => {
        this.resetSectionPosition(section);
    });

    controlPanel.appendChild(maximizeBtn);
    controlPanel.appendChild(resetBtn);

    section.appendChild(controlPanel);
};

MoveSectionLogic.maximizeSection = function(section) {
    if (!section.dataset.prevDimensions) {
        const rect = section.getBoundingClientRect();
        section.dataset.prevDimensions = JSON.stringify({
            width: section.style.width,
            height: section.style.height,
            top: section.style.top,
            left: section.style.left
        });

        section.style.width = 'calc(100% - 40px)';
        section.style.height = 'calc(100% - 40px)';
        section.style.top = '20px';
        section.style.left = '20px';
        section.style.zIndex = '1000';

        const maxButton = section.querySelector('.control-button');
        if (maxButton) {
            maxButton.innerHTML = '⤓';
            maxButton.title = 'Восстановить размер';
        }
    } else {
        const prevDim = JSON.parse(section.dataset.prevDimensions);
        section.style.width = prevDim.width;
        section.style.height = prevDim.height;
        section.style.top = prevDim.top;
        section.style.left = prevDim.left;
        section.style.zIndex = '';
        section.dataset.prevDimensions = '';

        const maxButton = section.querySelector('.control-button');
        if (maxButton) {
            maxButton.innerHTML = '⤢';
            maxButton.title = 'Максимизировать';
        }
    }

    const video = section.querySelector('video');
    if (video) {
        this.adjustVideoAspectRatio(video);
    }
};

MoveSectionLogic.adjustVideoAspectRatio = function(videoElement) {
    if (!videoElement) return;

    if (videoElement.videoWidth && videoElement.videoHeight) {
        const parentWidth = videoElement.parentElement.clientWidth;
        const parentHeight = videoElement.parentElement.clientHeight;

        const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
        const containerRatio = parentWidth / parentHeight;

        if (videoRatio > containerRatio) {
            videoElement.style.width = '100%';
            videoElement.style.height = 'auto';
        } else {
            videoElement.style.width = 'auto';
            videoElement.style.height = '100%';
        }
    } else {
        videoElement.addEventListener('loadedmetadata', () => {
            this.adjustVideoAspectRatio(videoElement);
        }, { once: true });
    }
};

MoveSectionLogic.resetSectionPosition = function(section) {
    section.style.position = 'relative';
    section.style.width = '';
    section.style.height = '';
    section.style.top = '';
    section.style.left = '';
    section.style.zIndex = '';
    section.dataset.prevDimensions = '';

    this.saveSectionPosition(section);

    const video = section.querySelector('video');
    if (video) {
        this.adjustVideoAspectRatio(video);
    }
};

MoveSectionLogic.saveSectionPosition = function(section) {
    if (!section.id) {
        const participantName = section.querySelector('.participant-name')?.textContent;
        if (participantName) {
            section.id = 'section-' + participantName.replace(/\s+/g, '-').toLowerCase();
        } else {
            section.id = 'section-' + Math.random().toString(36).substring(2, 9);
        }
    }

    const positionData = {
        width: section.style.width,
        height: section.style.height,
        top: section.style.top,
        left: section.style.left,
        zIndex: section.style.zIndex
    };

    try {
        const conferenceId = window.conference?.conferenceId;
        if (conferenceId) {
            const storageKey = `section-position-${conferenceId}-${section.id}`;
            localStorage.setItem(storageKey, JSON.stringify(positionData));
        }
    } catch (e) {
        console.error('Error saving section position:', e);
    }
};

MoveSectionLogic.loadSectionPosition = function(section) {
    if (!section.id) {
        const participantName = section.querySelector('.participant-name')?.textContent;
        if (participantName) {
            section.id = 'section-' + participantName.replace(/\s+/g, '-').toLowerCase();
        } else {
            section.id = 'section-' + Math.random().toString(36).substring(2, 9);
        }
    }

    try {
        const conferenceId = window.conference?.conferenceId;
        if (conferenceId) {
            const storageKey = `section-position-${conferenceId}-${section.id}`;
            const positionData = localStorage.getItem(storageKey);

            if (positionData) {
                const position = JSON.parse(positionData);
                section.style.width = position.width || '';
                section.style.height = position.height || '';
                section.style.top = position.top || '';
                section.style.left = position.left || '';
                section.style.zIndex = position.zIndex || '';
            }
        }
    } catch (e) {
        console.error('Error loading section position:', e);
    }
};

MoveSectionLogic.saveAllSectionPositions = function() {
    const sections = document.querySelectorAll('.participant-section');
    sections.forEach(section => {
        this.saveSectionPosition(section);
    });
};

MoveSectionLogic.initializeNewParticipantSection = function(section) {
    if (!section) return;
    this.makeResizable(section);
    this.makeDraggable(section);
    this.addControlsToSection(section);
    this.loadSectionPosition(section);
    const video = section.querySelector('video');
    if (video) {
        this.adjustVideoAspectRatio(video);
    }

    const videoWrappers = section.querySelectorAll('.video-wrapper');
    videoWrappers.forEach(wrapper => {
        this.makeVideoDraggable(wrapper);
    });

    const camerasContainer = section.querySelector('.cameras-container');
    if (camerasContainer) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList.contains('video-wrapper')) {
                            this.makeVideoDraggable(node);
                        }
                    });
                }
            });
        });

        observer.observe(camerasContainer, {
            childList: true
        });
        if (!this.videoObservers) {
            this.videoObservers = new Map();
        }
        this.videoObservers.set(section, observer);
    }
};

const originalGetParticipantSection = ConferenceUtils.getParticipantSection;
MoveSectionLogic.getParticipantSection = function(displayName, conference) {
    const section = originalGetParticipantSection.call(this, displayName, conference);

    if (section && !section.classList.contains('resizable-initialized')) {
        section.classList.add('resizable-initialized');
        this.initializeNewParticipantSection(section);
    }

    return section;
};

MoveSectionLogic.setupSectionObserver = function() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.classList && node.classList.contains('participant-section')) {
                            if (!node.classList.contains('resizable-initialized')) {
                                node.classList.add('resizable-initialized');
                                this.initializeNewParticipantSection(node);
                            }
                        }

                        const sections = node.querySelectorAll('.participant-section');
                        sections.forEach(section => {
                            if (!section.classList.contains('resizable-initialized')) {
                                section.classList.add('resizable-initialized');
                                this.initializeNewParticipantSection(section);
                            }
                        });
                    }
                });
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
};

MoveSectionLogic.initializeResizableAndDraggableSections = function() {
    this.addSectionStyles();

    this.makeParticipantSectionsResizableAndDraggable();

    this.setupSectionObserver();

    console.log('Resizable and draggable sections initialized');

    return true;
};

MoveSectionLogic.addSectionStyles = function() {
    if (document.getElementById('resizable-draggable-styles')) {
        return;
    }
    const styleElement = document.createElement('style');
    styleElement.id = 'resizable-draggable-styles';
    styleElement.innerHTML = `
        .participant-section {
            transition: box-shadow 0.3s ease;
            box-sizing: border-box;
            min-width: 100px;
            min-height: 100px;
        }
        .participant-section:hover {
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        }
        .participant-section .resizer {
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .participant-section:hover .resizer {
            opacity: 1;
        }
        .participant-section .section-controls {
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .participant-section:hover .section-controls {
            opacity: 1;
        }
        .participant-header {
            padding: 5px;
            background-color: #f1f1f1;
            border-bottom: 1px solid #ddd;
        }
        .control-button:hover {
            background: rgba(0,0,0,0.7) !important;
        }
        .video-wrapper {
            position: relative;
            transition: opacity 0.3s ease;
        }
        .video-wrapper.dragging {
            opacity: 0.5;
            border: 2px dashed #4285f4;
        }
        .video-wrapper.drag-over {
            box-shadow: inset 0 0 0 2px #4285f4;
        }
        .cameras-container {
            position: relative;
        }
        .video-drag-handle:hover {
            background: rgba(0,0,0,0.7) !important;
        }
    `;
    document.head.appendChild(styleElement);
};

MoveSectionLogic.initializeResizableAndDraggableSections = function() {
    this.addSectionStyles();

    this.makeParticipantSectionsResizableAndDraggable();
    this.makeVideosDraggableWithinSection();

    this.setupSectionObserver();

    console.log('Resizable and draggable sections initialized');

    return true;
};