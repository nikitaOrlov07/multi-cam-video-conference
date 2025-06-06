const MoveSectionLogic = {

}
MoveSectionLogic.makeVideosDraggableWithinSection = function() {
    const videoWrappers = document.querySelectorAll('.video-wrapper');
    videoWrappers.forEach(wrapper => {
        this.makeVideoFreeDraggable(wrapper);
    });
};

MoveSectionLogic.makeVideoFreeDraggable = function(videoWrapper) {
    if (videoWrapper.classList.contains('video-draggable-initialized')) {
        return;
    }

    videoWrapper.classList.add('video-draggable-initialized');

    videoWrapper.style.position = 'absolute';
    videoWrapper.style.zIndex = '10';

    const camerasContainer = videoWrapper.closest('.cameras-container');
    if (camerasContainer) {
        camerasContainer.style.position = 'relative';
        camerasContainer.style.display = 'block';
        camerasContainer.style.height = '100%';

        const placeholder = camerasContainer.querySelector('.no-camera-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }

    const cameraOrder = videoWrapper.getAttribute('data-camera-order');

    if (!videoWrapper.style.top && !videoWrapper.style.left) {
        const index = parseInt(cameraOrder) || 0;
        const row = Math.floor(index / 2);
        const col = index % 2;

        videoWrapper.style.top = `${row * 50}%`;
        videoWrapper.style.left = `${col * 50}%`;
        videoWrapper.style.width = '50%';
        videoWrapper.style.height = '50%';
    }

    const dragHandle = document.createElement('div');
    dragHandle.className = 'video-drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.title = 'Drag to move';
    dragHandle.style.cssText = `
        position: absolute;
        top: 5px;
        left: 5px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 3px 6px;
        border-radius: 3px;
        cursor: move;
        z-index: 101;
        opacity: 0;
        transition: opacity 0.2s ease;
    `;
    videoWrapper.appendChild(dragHandle);

    // Hide button
    const hideButton = document.createElement('div');
    hideButton.className = 'video-hide-button';
    hideButton.innerHTML = '−';
    hideButton.title = 'Hide video';
    hideButton.style.cssText = `
        position: absolute;
        top: 5px;
        left: 35px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 3px 6px;
        border-radius: 3px;
        cursor: pointer;
        z-index: 101;
        opacity: 0;
        transition: opacity 0.2s ease;
    `;
    videoWrapper.appendChild(hideButton);
    videoWrapper.dataset.hidden = 'false';
    hideButton.addEventListener('click', () => {
        this.toggleVideoVisibility(videoWrapper);
    });

    // Delete button
    const deleteButton = document.createElement('div');
    deleteButton.className = 'video-delete-button';
    deleteButton.innerHTML = '🗑️';
    deleteButton.title = 'Delete camera';
    deleteButton.style.cssText = `
        position: absolute;
        top: 5px;
        left: 65px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 3px 6px;
        border-radius: 3px;
        cursor: pointer;
        z-index: 101;
        opacity: 0;
        transition: opacity 0.2s ease;
    `;
    videoWrapper.appendChild(deleteButton);
    deleteButton.addEventListener('click', () => {
        this.confirmDeleteCamera(videoWrapper);
    });

    videoWrapper.addEventListener('mouseenter', () => {
        dragHandle.style.opacity = '1';
        hideButton.style.opacity = '1';
        deleteButton.style.opacity = '1';
    });
    videoWrapper.addEventListener('mouseleave', () => {
        if (!isDragging) {
            dragHandle.style.opacity = '0';
            hideButton.style.opacity = '0';
            deleteButton.style.opacity = '0';
        }
    });

    let isDragging = false;
    let startX, startY, startLeft, startTop;
    const startDrag = (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const containerRect = videoWrapper.closest('.cameras-container').getBoundingClientRect();
        const wrapperRect = videoWrapper.getBoundingClientRect();
        startLeft = (wrapperRect.left - containerRect.left);
        startTop = (wrapperRect.top - containerRect.top);
        videoWrapper.style.opacity = '0.7';
        videoWrapper.style.boxShadow = '0 0 10px rgba(0, 120, 255, 0.7)';
        videoWrapper.classList.add('dragging');

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);

        e.preventDefault();
    };

    const drag = (e) => {
        if (!isDragging) return;

        requestAnimationFrame(() => {
            const containerRect = videoWrapper.closest('.cameras-container').getBoundingClientRect();
            const newLeft = ((e.clientX - startX + startLeft) / containerRect.width) * 100;
            const newTop = ((e.clientY - startY + startTop) / containerRect.height) * 100;
            const maxLeft = 100 - (parseFloat(videoWrapper.style.width) || 50);
            const maxTop = 100 - (parseFloat(videoWrapper.style.height) || 50);
            const boundedLeft = Math.max(0, Math.min(newLeft, maxLeft));
            const boundedTop = Math.max(0, Math.min(newTop, maxTop));
            videoWrapper.style.left = `${boundedLeft}%`;
            videoWrapper.style.top = `${boundedTop}%`;
        });
    };

    const stopDrag = () => {
        isDragging = false;
        videoWrapper.style.opacity = '1';
        videoWrapper.style.boxShadow = '';
        videoWrapper.classList.remove('dragging');

        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);

        MoveSectionLogic.saveCameraPositionConfig(videoWrapper);
    };

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'video-resize-handle';
    resizeHandle.innerHTML = '↘';
    resizeHandle.title = 'Resize';
    resizeHandle.style.cssText = `
        position: absolute;
        bottom: 5px;
        right: 5px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 3px 6px;
        border-radius: 3px;
        cursor: se-resize;
        z-index: 101;
        opacity: 0;
        transition: opacity 0.2s ease;
    `;
    videoWrapper.appendChild(resizeHandle);
    videoWrapper.addEventListener('mouseenter', () => {
        resizeHandle.style.opacity = videoWrapper.dataset.hidden === 'true' ? '0' : '1';
    });
    videoWrapper.addEventListener('mouseleave', () => {
        if (!isResizing) {
            resizeHandle.style.opacity = '0';
        }
    });
    let isResizing = false;
    let resizeStartX, resizeStartY, startWidth, startHeight;
    const startResize = (e) => {
        if (videoWrapper.dataset.hidden === 'true') return;
        isResizing = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;

        const style = window.getComputedStyle(videoWrapper);
        startWidth = parseFloat(style.width);
        startHeight = parseFloat(style.height);

        videoWrapper.style.opacity = '0.7';
        videoWrapper.style.boxShadow = '0 0 10px rgba(0, 120, 255, 0.7)';

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);

        e.preventDefault();
    };

    const resize = (e) => {
        if (!isResizing) return;

        requestAnimationFrame(() => {
            const deltaX = e.clientX - resizeStartX;
            const deltaY = e.clientY - resizeStartY;

            const container = videoWrapper.closest('.cameras-container');
            const containerRect = container.getBoundingClientRect();

            const newWidthPx = startWidth + deltaX;
            const newHeightPx = startHeight + deltaY;

            const newWidth = (newWidthPx / containerRect.width) * 100;
            const newHeight = (newHeightPx / containerRect.height) * 100;

            const minWidthPct = (100 / containerRect.width) * 100;
            const minHeightPct = (100 / containerRect.height) * 100;

            videoWrapper.style.width = `${Math.max(minWidthPct, newWidth)}%`;
            videoWrapper.style.height = `${Math.max(minHeightPct, newHeight)}%`;

            const video = videoWrapper.querySelector('video');
            if (video) {
                MoveSectionLogic.adjustVideoAspectRatio(video);
            }
        });
    };

    const stopResize = () => {
        isResizing = false;
        videoWrapper.style.opacity = '1';
        videoWrapper.style.boxShadow = '';
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
        MoveSectionLogic.saveCameraPositionConfig(videoWrapper);
    };
    dragHandle.addEventListener('mousedown', startDrag);
    resizeHandle.addEventListener('mousedown', startResize);
    this.loadCameraPositionConfig(videoWrapper);
};
MoveSectionLogic.confirmDeleteCamera = function(videoWrapper) {
    // Create and show confirmation dialog
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'camera-delete-confirmation';
    confirmDialog.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 1000;
        text-align: center;
        min-width: 250px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    `;

    confirmDialog.innerHTML = `
        <div style="margin-bottom: 15px;">Are you sure you want to delete this camera?</div>
        <div style="margin-bottom: 10px;">This action cannot be undone.</div>
        <div style="display: flex; justify-content: space-between;">
            <button class="btn-cancel" style="padding: 5px 15px; background: #555; border: none; color: white; border-radius: 3px; cursor: pointer;">Cancel</button>
            <button class="btn-confirm" style="padding: 5px 15px; background: #d32f2f; border: none; color: white; border-radius: 3px; cursor: pointer;">Delete</button>
        </div>
    `;

    videoWrapper.appendChild(confirmDialog);

    // Add event listeners to buttons
    const cancelButton = confirmDialog.querySelector('.btn-cancel');
    const confirmButton = confirmDialog.querySelector('.btn-confirm');

    cancelButton.addEventListener('click', () => {
        confirmDialog.remove();
    });

    confirmButton.addEventListener('click', () => {
        this.deleteCamera(videoWrapper);
        confirmDialog.remove();
    });
};

MoveSectionLogic.deleteCamera = function(videoWrapper) {
    const section = videoWrapper.closest('.participant-section');
    if (!section) return;

    const displayName = section.querySelector('.participant-name')?.textContent;
    if (!displayName) return;

    const trackId = videoWrapper.getAttribute('data-track-id');
    if (!trackId) return;

    try {
        const conferenceId = window.conference?.conferenceId;
        if (conferenceId) {
            // Store that this camera should be deleted
            const key = `camera-deleted-${conferenceId}-${displayName}-${trackId}`;
            localStorage.setItem(key, 'true');

            // Remove from DOM
            videoWrapper.remove();

            // Update any related UI if needed
            const camerasContainer = section.querySelector('.cameras-container');
            if (camerasContainer) {
                const remainingVideos = camerasContainer.querySelectorAll('.video-wrapper');
                if (remainingVideos.length === 0) {
                    const placeholder = camerasContainer.querySelector('.no-camera-placeholder');
                    if (placeholder) {
                        placeholder.style.display = 'block';
                    }
                }
            }

            console.log(`Camera ${trackId} for ${displayName} has been deleted`);
        }
    } catch (e) {
        console.error('Error deleting camera:', e);
    }
};

MoveSectionLogic.toggleVideoVisibility = function(videoWrapper) {
    const isHidden = videoWrapper.dataset.hidden === 'true';
    const hideButton = videoWrapper.querySelector('.video-hide-button');
    const resizeHandle = videoWrapper.querySelector('.video-resize-handle');
    const video = videoWrapper.querySelector('video');
    const cameraLabel = videoWrapper.querySelector('.camera-label');

    if (isHidden) {
        videoWrapper.dataset.hidden = 'false';
        if (videoWrapper.dataset.originalHeight) {
            videoWrapper.style.height = videoWrapper.dataset.originalHeight;
        } else {
            videoWrapper.style.height = '50%';
        }
        if (video) video.style.display = 'block';
        if (resizeHandle) resizeHandle.style.display = 'block';
        if (hideButton) {
            hideButton.innerHTML = '−';
            hideButton.title = 'Hide video';
        }
        if (cameraLabel) {
            cameraLabel.style.position = 'absolute';
            cameraLabel.style.bottom = '5px';
            cameraLabel.style.left = '5px';
            cameraLabel.style.top = 'auto';
            cameraLabel.style.textAlign = 'left';
        }
    } else {
        videoWrapper.dataset.hidden = 'true';
        videoWrapper.dataset.originalHeight = videoWrapper.style.height;
        videoWrapper.style.height = '30px';
        if (video) video.style.display = 'none';
        if (resizeHandle) resizeHandle.style.display = 'none';
        if (hideButton) {
            hideButton.innerHTML = '+';
            hideButton.title = 'Show video';
        }
        if (cameraLabel) {
            cameraLabel.style.position = 'absolute';
            cameraLabel.style.bottom = 'auto';
            cameraLabel.style.top = '5px';
            cameraLabel.style.left = '45px';
            cameraLabel.style.textAlign = 'left';
        }
    }
    this.saveCameraPositionConfig(videoWrapper);
};
MoveSectionLogic.saveCameraPositionConfig = function(videoWrapper) {
    if (!window.conference || !window.conference.userName) return;
    const section = videoWrapper.closest('.participant-section');
    if (!section) return;
    const displayName = section.querySelector('.participant-name')?.textContent;
    if (!displayName) return;

    const trackId = videoWrapper.getAttribute('data-track-id');
    if (!trackId) return;

    const positionData = {
        top: videoWrapper.style.top,
        left: videoWrapper.style.left,
        width: videoWrapper.style.width,
        height: videoWrapper.style.height,
        zIndex: videoWrapper.style.zIndex,
        hidden: videoWrapper.dataset.hidden || 'false',
        originalHeight: videoWrapper.dataset.originalHeight || ''
    };

    try {
        const conferenceId = window.conference.conferenceId;
        const key = `camera-position-${conferenceId}-${displayName}-${trackId}`;
        localStorage.setItem(key, JSON.stringify(positionData));
    } catch (e) {
        console.error('Error saving camera position configuration:', e);
    }
};
MoveSectionLogic.loadCameraPositionConfig = function(videoWrapper) {
    if (!window.conference) return;

    const section = videoWrapper.closest('.participant-section');
    if (!section) return;

    const displayName = section.querySelector('.participant-name')?.textContent;
    if (!displayName) return;

    const trackId = videoWrapper.getAttribute('data-track-id');
    if (!trackId) return;

    try {
        const conferenceId = window.conference.conferenceId;
        const key = `camera-position-${conferenceId}-${displayName}-${trackId}`;
        const positionData = localStorage.getItem(key);

        if (positionData) {
            const position = JSON.parse(positionData);
            videoWrapper.style.top = position.top || '0%';
            videoWrapper.style.left = position.left || '0%';
            videoWrapper.style.width = position.width || '50%';
            videoWrapper.style.height = position.height || '50%';
            videoWrapper.style.zIndex = position.zIndex || '10';

            if (position.hidden === 'true') {
                videoWrapper.dataset.hidden = 'true';
                videoWrapper.dataset.originalHeight = position.originalHeight || '';
                setTimeout(() => {
                    this.toggleVideoVisibility(videoWrapper);
                }, 100);
            }
        }
    } catch (e) {
        console.error('Error loading camera position configuration:', e);
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
    let header = element.querySelector('.participant-header') ||
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
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    const dragMouseDown = function(e) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = element.offsetLeft;
        startTop = element.offsetTop;
        element.style.zIndex = '1000';
        document.addEventListener('mousemove', elementDrag);
        document.addEventListener('mouseup', closeDragElement);
        e.preventDefault();
    };

    const elementDrag = function(e) {
        if (!isDragging) return;
        requestAnimationFrame(() => {
            const newLeft = startLeft + (e.clientX - startX);
            const newTop = startTop + (e.clientY - startY);
            element.style.left = newLeft + "px";
            element.style.top = newTop + "px";
        });
    };
    const closeDragElement = function() {
        isDragging = false;
        element.style.zIndex = '100';
        document.removeEventListener('mousemove', elementDrag);
        document.removeEventListener('mouseup', closeDragElement);
        MoveSectionLogic.saveSectionPosition(element);
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
        // Check if this camera should be hidden from view due to previous deletion
        const displayName = section.querySelector('.participant-name')?.textContent;
        const trackId = wrapper.getAttribute('data-track-id');
        if (displayName && trackId && window.conference?.conferenceId) {
            const key = `camera-deleted-${window.conference.conferenceId}-${displayName}-${trackId}`;
            if (localStorage.getItem(key) === 'true') {
                wrapper.remove();
                return;
            }
        }

        this.makeVideoFreeDraggable(wrapper);
    });

    const camerasContainer = section.querySelector('.cameras-container');
    if (camerasContainer) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList.contains('video-wrapper')) {
                            // Check if this camera should be hidden from view
                            const displayName = section.querySelector('.participant-name')?.textContent;
                            const trackId = node.getAttribute('data-track-id');
                            if (displayName && trackId && window.conference?.conferenceId) {
                                const key = `camera-deleted-${window.conference.conferenceId}-${displayName}-${trackId}`;
                                if (localStorage.getItem(key) === 'true') {
                                    node.remove();
                                    return;
                                }
                            }

                            this.makeVideoFreeDraggable(node);
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
            transition: box-shadow 0.2s ease;
            box-sizing: border-box;
            min-width: 100px;
            min-height: 100px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            border-radius: 4px;
            overflow: hidden;
        }
        .participant-section:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .participant-section .resizer {
            opacity: 0;
            transition: opacity 0.2s ease;
            background-color: #4285f4;
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        .participant-section:hover .resizer {
            opacity: 1;
        }
        .participant-section .section-controls {
            opacity: 0;
            transition: opacity 0.2s ease;
            display: flex;
            gap: 8px;
        }
        .participant-section:hover .section-controls {
            opacity: 1;
        }
        .participant-header {
            padding: 8px;
            background-color: #f1f1f1;
            border-bottom: 1px solid #ddd;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .control-button {
            background: rgba(0,0,0,0.5) !important;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            padding: 4px 8px;
            transition: background 0.2s ease;
        }
        .control-button:hover {
            background: rgba(0,0,0,0.7) !important;
        }
        .video-wrapper {
            position: absolute;
            transition: opacity 0.3s ease, box-shadow 0.3s ease, height 0.3s ease;
            border: 1px solid transparent;
            border-radius: 4px;
            overflow: hidden;
        }
        .video-wrapper:hover {
            border: 1px solid rgba(66, 133, 244, 0.5);
        }
        .video-wrapper.dragging {
            opacity: 0.7;
            border: 2px dashed #4285f4;
            z-index: 1000;
        }
        .video-wrapper[data-hidden="true"] {
            background: rgba(0, 0, 0, 0.5);
            height: 30px !important;
            overflow: visible;
        }
        .cameras-container {
            position: relative;
            height: 100%;
            overflow: hidden;
        }
        .video-drag-handle, .video-resize-handle, .video-hide-button, .video-delete-button {
            background: rgba(0,0,0,0.7) !important;
            color: white;
            padding: 3px 6px;
            border-radius: 3px;
            cursor: pointer;
            z-index: 101;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .video-drag-handle:hover, .video-resize-handle:hover, .video-hide-button:hover, .video-delete-button:hover {
            background: rgba(0,0,0,0.9) !important;
        }
        .video-delete-button {
            color: #ff6b6b;
        }
        .camera-label {
            z-index: 102;
            position: absolute;
            bottom: 5px;
            left: 5px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 3px 6px;
            border-radius: 3px;
            font-size: 12px;
            transition: all 0.3s ease;
        }
        .video-wrapper[data-hidden="true"] .camera-label {
            top: 5px;
            left: 45px;
            bottom: auto;
        }
        .camera-delete-confirmation {
            animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -60%); }
            to { opacity: 1; transform: translate(-50%, -50%); }
        }
    `;
    document.head.appendChild(styleElement);
};

MoveSectionLogic.drag = function(e) {
    if (!isDragging) return;
    requestAnimationFrame(() => {
        const containerRect = videoWrapper.closest('.cameras-container').getBoundingClientRect();
        const newLeft = ((e.clientX - startX + startLeft) / containerRect.width) * 100;
        const newTop = ((e.clientY - startY + startTop) / containerRect.height) * 100;
        const maxLeft = 100 - (parseFloat(videoWrapper.style.width) || 50);
        const maxTop = 100 - (parseFloat(videoWrapper.style.height) || 50);
        const boundedLeft = Math.max(0, Math.min(newLeft, maxLeft));
        const boundedTop = Math.max(0, Math.min(newTop, maxTop));
        videoWrapper.style.left = `${boundedLeft}%`;
        videoWrapper.style.top = `${boundedTop}%`;
        MoveSectionLogic.saveCameraPositionConfig(videoWrapper);
    });
};
MoveSectionLogic.startDrag = function(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const containerRect = videoWrapper.closest('.cameras-container').getBoundingClientRect();
    const wrapperRect = videoWrapper.getBoundingClientRect();
    startLeft = (wrapperRect.left - containerRect.left);
    startTop = (wrapperRect.top - containerRect.top);
    videoWrapper.style.opacity = '0.7';
    videoWrapper.style.boxShadow = '0 0 10px rgba(0, 120, 255, 0.7)';
    videoWrapper.classList.add('dragging');
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
};
MoveSectionLogic.initializeResizableAndDraggableSections = function() {
    this.addSectionStyles();
    this.makeParticipantSectionsResizableAndDraggable();
    this.makeVideosDraggableWithinSection();
    this.setupSectionObserver();
    console.log('Resizable and draggable sections initialized');
    return true;
};