// Basic app settings - nothing fancy here!
const CONFIG = {
    MAX_RECORDING_DURATION: 7200000, // 2 hours max - should be plenty!
    SCREENSHOT_INTERVALS: {
        MIN: 2000, // grab a screenshot every 2 seconds
        MAX: 6000  // or every 6 seconds depending on performance
    },
    PREVIEW_DIMENSIONS: {
        WIDTH: 220,  // preview video size
        HEIGHT: 130
    },
    THUMBNAIL_DIMENSIONS: {
        WIDTH: 160,  // thumbnail size for saved videos
        HEIGHT: 90
    },
    STORAGE_KEYS: {
        RECORDINGS: 'webRecordings',      // where we save recordings
        USER_PREFERENCES: 'userPreferences' // user settings
    },
    ERROR_RECOVERY_ATTEMPTS: 3, // try 3 times if something fails
    CLEANUP_DELAY: 100          // wait a bit before cleaning up
};

// Add this new class after CONFIG
class IndexedDBManager {
    constructor() {
        this.dbName = 'ScreenRecorderDB';
        this.dbVersion = 1;
        this.storeName = 'recordings';
        this.db = null;
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('filename', 'filename', { unique: false });
                }
            };
        });
    }

    async saveRecording(recordingData) {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(recordingData);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllRecordings() {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteRecording(id) {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllRecordings() {
        if (!this.db) await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getStorageUsage() {
        if (!this.db) await this.initDB();
        
        const recordings = await this.getAllRecordings();
        let totalSize = 0;
        recordings.forEach(recording => {
            totalSize += recording.size || 0;
        });
        return totalSize;
    }
}

// Main class that handles all the recording stuff
class RecordingStateManager {
    constructor() {
        this.screenRecordings = new Map();  // active recordings
        this.recordingCounter = 0;          // count how many we've made
        this.statusUpdateInterval = null;   // timer for updating UI
        this.thumbnailCaptures = new Map();  // screenshot data
        this.errorHandlers = new Map();      // error handling
        this.cleanup = this.cleanup.bind(this);
        
        // Initialize IndexedDB
        this.dbManager = new IndexedDBManager();
        this.dbManager.initDB().catch(error => {
            console.error('IndexedDB initialization failed:', error);
            this.showAlert('Storage initialization failed. Recordings will download directly.', 'error');
        });
        
        // Clean initialization - no auto-save references
        this.initializeEventListeners();
        this.initializeQualitySlider();
    }

    initializeEventListeners() {
        // Only essential event listeners - no auto-save toggle
        window.addEventListener('beforeunload', this.cleanup);
        window.addEventListener('unload', this.cleanup);
    }

    initializeQualitySlider() {
        const qualitySlider = document.getElementById('video-quality');
        const qualityText = document.getElementById('quality-text');
        const qualityWarning = document.getElementById('quality-warning');
        const qualityNames = ['4K Ultra', '1440p QHD', '1080p Full HD', '720p HD', '480p SD'];
        
        if (qualitySlider && qualityText) {
            // Set default to 1080p (value 2)
            qualitySlider.value = 2;
            qualityText.textContent = '1080p Full HD';
            
            qualitySlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                qualityText.textContent = qualityNames[value] || '1080p Full HD';
                
                // Show warning only when 4K (value 0) is selected
                if (qualityWarning) {
                    qualityWarning.style.display = value === 0 ? 'block' : 'none';
                }
            });
        }
    }

    cleanup() {
        // Stop all active recordings when leaving the page
        this.screenRecordings.forEach((recording, id) => {
            try {
                if (recording.mediaRecorder && recording.mediaRecorder.state !== 'inactive') {
                    recording.mediaRecorder.stop();
                }
                if (recording.stream) {
                    recording.stream.getTracks().forEach(track => {
                        try {
                            track.stop();
                        } catch (e) {
                            console.warn('Error stopping track:', e);
                        }
                    });
                }
            } catch (error) {
                console.warn('Error during cleanup:', error);
            }
        });
        
        // Clear the status update timer
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
            this.statusUpdateInterval = null;
        }
    }

    showAlert(message, type = 'success') {
        try {
            // Create a nice popup message
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type}`;
            alertDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                font-weight: bold;
                z-index: 10000;
                max-width: 400px;
                word-wrap: break-word;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                transition: all 0.3s ease;
                background-color: ${type === 'error' ? '#e74c3c' : '#27ae60'};
            `;
            alertDiv.textContent = message;
            
            document.body.appendChild(alertDiv);
            
            // Fade out and remove after 5 seconds
            setTimeout(() => {
                alertDiv.style.opacity = '0';
                alertDiv.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (alertDiv.parentNode) {
                        alertDiv.remove();
                    }
                }, 300);
            }, 4700);
        } catch (error) {
            console.error('Error showing alert:', error);
        }
    }
}

// Handles taking screenshots during recording
class ThumbnailCaptureEngine {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.captureQueue = new Map();
    }

    async initializeThumbnailCapture(stream, recordingId) {
        try {
            // Create a hidden video element to capture frames from
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;
            video.style.position = 'absolute';
            video.style.left = '-9999px';
            video.style.top = '-9999px';
            video.style.width = '1px';
            video.style.height = '1px';
            
            // Add to page so it actually loads
            document.body.appendChild(video);

            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Video took too long to load'));
                }, 10000);

                video.onloadedmetadata = async () => {
                    clearTimeout(timeoutId);
                    try {
                        await video.play();
                        
                        // Wait for the first frame to be ready
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        const captureData = {
                            video,
                            stream,
                            recordingId,
                            isActive: true,
                            captureCount: 0,
                            lastCapture: null
                        };

                        this.stateManager.thumbnailCaptures.set(recordingId, captureData);
                        this.startContinuousCapture(captureData);
                        resolve(captureData);
                    } catch (playError) {
                        clearTimeout(timeoutId);
                        document.body.removeChild(video);
                        reject(playError);
                    }
                };

                video.onerror = () => {
                    clearTimeout(timeoutId);
                    document.body.removeChild(video);
                    reject(new Error('Video failed to load'));
                };
            });
        } catch (error) {
            console.error('Error setting up thumbnail capture:', error);
            throw error;
        }
    }

    startContinuousCapture(captureData) {
        const captureFrame = () => {
            // Stop if recording is done
            if (!captureData.isActive || !this.stateManager.screenRecordings.has(captureData.recordingId)) {
                this.stopCapture(captureData.recordingId);
                return;
            }

            try {
                const { video } = captureData;
                
                // Make sure video is actually playing and has content
                if (video.videoWidth > 0 && video.videoHeight > 0 && !video.paused) {
                    // Set up canvas for screenshot
                    this.canvas.width = CONFIG.THUMBNAIL_DIMENSIONS.WIDTH;
                    this.canvas.height = CONFIG.THUMBNAIL_DIMENSIONS.HEIGHT;
                    
                    // Figure out how to fit the video in the thumbnail
                    const videoAspect = video.videoWidth / video.videoHeight;
                    const canvasAspect = this.canvas.width / this.canvas.height;
                    
                    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
                    
                    if (videoAspect > canvasAspect) {
                        // Video is wider - crop the sides
                        sw = video.videoHeight * canvasAspect;
                        sx = (video.videoWidth - sw) / 2;
                    } else {
                        // Video is taller - crop top/bottom
                        sh = video.videoWidth / canvasAspect;
                        sy = (video.videoHeight - sh) / 2;
                    }
                    
                    // Draw the frame
                    this.ctx.fillStyle = '#000000';
                    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                    
                    this.ctx.drawImage(
                        video, 
                        sx, sy, sw, sh,
                        0, 0, this.canvas.width, this.canvas.height
                    );
                    
                    // Add a slight overlay to make it look like a thumbnail
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                    
                    // Save the screenshot
                    const thumbnail = this.canvas.toDataURL('image/jpeg', 0.8);
                    captureData.lastCapture = thumbnail;
                    captureData.captureCount++;
                }
            } catch (error) {
                console.warn('Error capturing frame:', error);
            }
            
            // Schedule next capture
            const nextInterval = CONFIG.SCREENSHOT_INTERVALS.MIN + 
                Math.random() * (CONFIG.SCREENSHOT_INTERVALS.MAX - CONFIG.SCREENSHOT_INTERVALS.MIN);
            captureData.timeoutId = setTimeout(captureFrame, nextInterval);
        };
        
        // Start capturing after a short delay
        captureData.timeoutId = setTimeout(captureFrame, 2000);
    }

    stopCapture(recordingId) {
        const captureData = this.stateManager.thumbnailCaptures.get(recordingId);
        if (captureData) {
            captureData.isActive = false;
            
            if (captureData.timeoutId) {
                clearTimeout(captureData.timeoutId);
            }
            
            if (captureData.video) {
                captureData.video.srcObject = null;
                if (captureData.video.parentNode) {
                    captureData.video.parentNode.removeChild(captureData.video);
                }
            }
            
            this.stateManager.thumbnailCaptures.delete(recordingId);
        }
    }

    captureFinalThumbnail(recordingId) {
        const captureData = this.stateManager.thumbnailCaptures.get(recordingId);
        if (!captureData || !captureData.video) return null;
        
        try {
            const { video } = captureData;
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                this.canvas.width = CONFIG.THUMBNAIL_DIMENSIONS.WIDTH;
                this.canvas.height = CONFIG.THUMBNAIL_DIMENSIONS.HEIGHT;

                const videoAspect = video.videoWidth / video.videoHeight;
                const canvasAspect = this.canvas.width / this.canvas.height;
                let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
                
                if (videoAspect > canvasAspect) {
                    sw = video.videoHeight * canvasAspect;
                    sx = (video.videoWidth - sw) / 2;
                } else {
                    sh = video.videoWidth / canvasAspect;
                    sy = (video.videoHeight - sh) / 2;
                }

                this.ctx.fillStyle = '#000000';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(video, sx, sy, sw, sh, 0, 0, this.canvas.width, this.canvas.height);
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                const thumbnail = this.canvas.toDataURL('image/jpeg', 0.8);

                const recording = this.stateManager.screenRecordings.get(recordingId);
                if (recording) {
                    recording.screenshot = thumbnail;
                }
                captureData.lastCapture = thumbnail;
                return thumbnail;
            }
        } catch (e) {
            console.warn('captureFinalThumbnail error:', e);
        }
        return null;
    }
}

// This function sets up video quality based on what the user picked
function getVideoConstraints(qualityValue) {
    const constraints = {
        video: {
            frameRate: { ideal: 60, max: 60 }  // Higher framerate for smoother video
        }
    };
    
    // Convert slider value to quality setting
    const qualityMap = {
        0: '4k',
        1: '1440p', 
        2: '1080p',
        3: '720p',
        4: '480p'
    };
    
    const quality = qualityMap[qualityValue] || '4k';
    
    // Set resolution based on quality choice
    switch (quality) {
        case '4k':
            constraints.video.width = { ideal: 3840 };
            constraints.video.height = { ideal: 2160 };
            break;
        case '1440p':
            constraints.video.width = { ideal: 2560 };
            constraints.video.height = { ideal: 1440 };
            break;
        case '1080p':
            constraints.video.width = { ideal: 1920 };
            constraints.video.height = { ideal: 1080 };
            break;
        case '720p':
            constraints.video.width = { ideal: 1280 };
            constraints.video.height = { ideal: 720 };
            break;
        case '480p':
            constraints.video.width = { ideal: 854 };
            constraints.video.height = { ideal: 480 };
            break;
    }
    
    return constraints;
}

function updateRecordingsPreview() {
    const previewContainer = document.getElementById('recordings-preview');
    
    if (stateManager.screenRecordings.size === 0) {
        previewContainer.innerHTML = 'No screen recordings active';
        document.getElementById('stop-all-btn').disabled = true;
        return;
    }
    
    // Store current input values and focus state before updating
    const inputStates = new Map();
    stateManager.screenRecordings.forEach((recording, id) => {
        const existingInput = document.getElementById(`filename-input-${id}`);
        if (existingInput) {
            inputStates.set(id, {
                value: existingInput.value,
                focused: document.activeElement === existingInput,
                selectionStart: existingInput.selectionStart,
                selectionEnd: existingInput.selectionEnd
            });
        }
    });
    
    previewContainer.innerHTML = '';
    document.getElementById('stop-all-btn').disabled = false;
    
    // Show each active recording in compact mode
    stateManager.screenRecordings.forEach((recording, id) => {
        const recordingItem = document.createElement('div');
        recordingItem.className = 'recording-status-item recording compact-recording';
        
        // Generate current filename for editing
        const selectedFormat = document.getElementById('video-format').value;
        const qualitySlider = document.getElementById('video-quality');
        const qualityValues = ['4k', '1440p', '1080p', '720p', '480p'];
        const selectedQuality = qualityValues[parseInt(qualitySlider.value)];
        const cleanTabTitle = (recording.tabTitle || 'Screen Recording').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        
        // Use stored input value if available, otherwise use recording's custom filename or default
        let currentFilename;
        const storedState = inputStates.get(id);
        if (storedState) {
            currentFilename = storedState.value;
        } else {
            currentFilename = recording.customFilename || `${cleanTabTitle}_${id}_${selectedQuality}`;
        }
        
        recordingItem.innerHTML = `
            <div class="compact-recording-info">
                <div class="compact-recording-header">
                    <div class="recording-indicator-compact">
                        <div class="recording-dot"></div>
                        <span>REC</span>
                    </div>
                    <div class="recording-time">
                        ${formatTime((Date.now() - recording.startTime) / 1000)} elapsed
                        <br>
                        <span style="font-size: 11px; color: #888;">
                            ${formatTime(Math.max(0, (recording.duration / 1000) - ((Date.now() - recording.startTime) / 1000)))} remaining
                        </span>
                    </div>
                </div>
                <div class="filename-edit-container">
                    <label class="filename-label">Site name <span class="edit-hint">(click to edit)</span></label>
                    <input type="text" 
                           id="filename-input-${id}" 
                           class="filename-input editable-indicator" 
                           value="${currentFilename}"
                           placeholder="Click to edit recording name"
                           onchange="updateRecordingFilename(${id}, this.value)"
                           oninput="updateRecordingFilename(${id}, this.value)"
                           title="Click to edit the recording filename">
                    <span class="file-extension">.${selectedFormat}</span>
                </div>
            </div>
            <div class="compact-preview-container">
                <video id="preview-${id}" class="compact-preview-video" autoplay muted playsinline></video>
                <div class="compact-preview-overlay">
                    <div class="preview-recording-indicator">
                        <div class="recording-dot"></div>
                    </div>
                </div>
            </div>
            <button class="compact-stop-btn" onclick="stopScreenRecording(${id})" title="Stop Recording">⏹</button>
        `;
        previewContainer.appendChild(recordingItem);
        
        // Restore input state if it was focused
        if (storedState && storedState.focused) {
            setTimeout(() => {
                const newInput = document.getElementById(`filename-input-${id}`);
                if (newInput) {
                    newInput.focus();
                    newInput.setSelectionRange(storedState.selectionStart, storedState.selectionEnd);
                }
            }, 0);
        }
        
        // Show live preview of what's being recorded
        setTimeout(() => {
            const video = document.getElementById(`preview-${id}`);
            if (video && recording.stream) {
                video.srcObject = recording.stream;
                // Make sure it plays on all browsers
                video.play && video.play().catch(() => {});
            }
        }, 100);
    });
}

// Function to update recording filename in real-time
function updateRecordingFilename(recordingId, newFilename) {
    const recording = stateManager.screenRecordings.get(recordingId);
    if (recording) {
        // Store the custom filename in the recording object
        recording.customFilename = newFilename.trim() || `Screen_Recording_${recordingId}`;
        console.log(`Updated filename for recording ${recordingId}: ${recording.customFilename}`);
    } else {
        console.warn(`Recording ${recordingId} not found when trying to update filename`);
    }
}

// Removed old search ID functions - now using per-recording ID inputs

// Function to check for duplicate IDs and append COPY suffixes
async function checkForDuplicateId(baseId, format) {
    try {
        const existingRecordings = await stateManager.dbManager.getAllRecordings();
        const existingFilenames = existingRecordings.map(r => r.filename.replace(/\.[^.]+$/, '')); // Remove extension
        
        // Check if base ID exists
        if (!existingFilenames.includes(baseId)) {
            return `${baseId}.${format}`;
        }
        
        // Try with Copy1, Copy2, Copy3, etc.
         for (let i = 1; i <= 999; i++) {
             const testFilename = `${baseId}Copy${i}`;
             if (!existingFilenames.includes(testFilename)) {
                 return `${testFilename}.${format}`;
             }
         }
         
         // If all Copy numbers are taken, use timestamp
         const timestamp = Date.now();
         return `${baseId}Copy${timestamp}.${format}`;
        
    } catch (error) {
        console.warn('Error checking for duplicates:', error);
        return `${baseId}.${format}`;
    }
}

// Function to update recording ID and rename file in real-time
async function updateRecordingId(recordingId, newId) {
    try {
        newId = newId.trim();
        const input = document.getElementById(`id-input-${recordingId}`);
        
        if (!newId) {
            // Clear any duplicate styling if ID is empty
            if (input) {
                input.classList.remove('duplicate');
            }
            return;
        }
        
        // Get the recording from database
        const recordings = await stateManager.dbManager.getAllRecordings();
        const recording = recordings.find(r => r.id === recordingId);
        
        if (!recording) {
            console.warn(`Recording ${recordingId} not found`);
            return;
        }
        
        // Get current format from the recording
        const currentFormat = recording.format || 'webm';
        
        // Check for duplicates and generate new filename
        const newFilename = await checkForDuplicateId(newId, currentFormat);
        const baseFilename = newFilename.replace(/\.[^.]+$/, ''); // Remove extension
        
        // Check if this would be a duplicate (has Copy suffix)
          const isDuplicate = baseFilename !== newId && baseFilename.includes('Copy');
        
        // Update input styling based on duplicate status
        if (input) {
            if (isDuplicate) {
                input.classList.add('duplicate');
            } else {
                input.classList.remove('duplicate');
            }
        }
        
        // Update the recording in the database (delete old, save new to avoid key conflict)
         await stateManager.dbManager.deleteRecording(recording.id);
         
         const updatedRecording = {
             ...recording,
             filename: newFilename
         };
         
         await stateManager.dbManager.saveRecording(updatedRecording);
        
        // Update the filename display without full refresh
        const recordingNameElement = document.querySelector(`#id-input-${recordingId}`).closest('.recording-item').querySelector('.recording-name');
        if (recordingNameElement) {
            recordingNameElement.textContent = newFilename;
        }
        
        console.log(`Updated recording ${recordingId} filename to: ${newFilename}`);
        
    } catch (error) {
        console.error('Error updating recording ID:', error);
        stateManager.showAlert('Failed to update recording ID: ' + error.message, 'error');
    }
}

// Main function that starts screen recording
async function addScreenRecording() {
    try {
        // Check if browser supports screen recording
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            stateManager.showAlert('Your browser doesn\'t support screen recording. Try Chrome, Edge, or Firefox.', 'error');
            return;
        }
        if (typeof MediaRecorder === 'undefined') {
            stateManager.showAlert('MediaRecorder not available in this browser.', 'error');
            return;
        }

        const selectedQuality = parseInt(document.getElementById('video-quality').value);
        const constraints = getVideoConstraints(selectedQuality);
        // Show cursor in recordings
        constraints.video.cursor = 'always';

        // Ask user to pick what to record - simple and clean
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: constraints.video,
            audio: true
        });

        if (!stream || stream.getVideoTracks().length === 0) {
            stateManager.showAlert('No video captured. Please try again and pick a tab.', 'error');
            return;
        }

        const recordingId = ++stateManager.recordingCounter;
        const duration = parseInt(document.getElementById('duration').value) * 1000;

        // Try to get a nice name for what we're recording
        let tabTitle = 'Screen Recording';
        try {
            const label = stream.getVideoTracks()[0]?.label || '';
            if (label.includes('tab:')) {
                tabTitle = label.split('tab:')[1].trim();
            } else if (label) {
                tabTitle = label.trim();
            }
            tabTitle = tabTitle.replace(/[^\w\s-]/g, '').substring(0, 50) || 'Screen Recording';
        } catch {}

        // Set up thumbnail capture
        try {
            await thumbnailEngine.initializeThumbnailCapture(stream, recordingId);
        } catch (thumbnailError) {
            console.warn('Thumbnail capture setup failed:', thumbnailError);
        }

        const qualityNames = ['4K Ultra', '1440p QHD', '1080p Full HD', '720p HD', '480p SD'];
        const qualityName = qualityNames[selectedQuality] || '4K Ultra';
        
        startScreenRecording(stream, recordingId, duration, tabTitle);
        stateManager.showAlert(`Started recording in ${qualityName} quality!`);

    } catch (error) {
        console.error('Error starting recording:', error);
        let errorMessage = 'Failed to start recording. ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Please allow screen sharing and pick a tab.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No sharing source available.';
        } else if (error.name === 'TypeError') {
            errorMessage += 'Try serving this page over http(s) (localhost works fine).';
        } else {
            errorMessage += 'Please try again.';
        }
        stateManager.showAlert(errorMessage, 'error');
    }
}

// Fixed stop function - now properly stops everything
function stopScreenRecording(recordingId) {
    const recording = stateManager.screenRecordings.get(recordingId);
    if (!recording) {
        console.warn('Recording not found:', recordingId);
        return;
    }

    try {
        // Capture final thumbnail before stopping
        const thumbnailData = stateManager.thumbnailCaptures.get(recordingId);
        if (thumbnailData && thumbnailData.video && thumbnailData.video.videoWidth > 0) {
            try {
                thumbnailEngine.captureFinalThumbnail(recordingId);
            } catch (error) {
                console.warn('Final thumbnail capture failed:', error);
            }
        }
        
        // Stop the media recorder first
        if (recording.mediaRecorder && recording.mediaRecorder.state !== 'inactive') {
            recording.mediaRecorder.stop();
        }
        
        // Stop all tracks in the stream (this kills the live feed)
        if (recording.stream) {
            recording.stream.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (error) {
                    console.warn('Error stopping track:', error);
                }
            });
        }
        
        // Store custom filename before removing recording (for later use in saveScreenRecording)
        if (recording.customFilename) {
            // Store in a temporary map that saveScreenRecording can access
            if (!window.pendingCustomFilenames) {
                window.pendingCustomFilenames = new Map();
            }
            window.pendingCustomFilenames.set(recordingId, recording.customFilename);
            console.log(`Preserved custom filename for recording ${recordingId}: ${recording.customFilename}`);
        }
        
        // Remove from active recordings immediately
        stateManager.screenRecordings.delete(recordingId);
        
        // Clean up thumbnail capture
        setTimeout(() => {
            thumbnailEngine.stopCapture(recordingId);
        }, 100);
        
        // Update UI immediately
        updateRecordingsPreview();
        updateStatusDisplay();
        
        stateManager.showAlert(`Recording ${recordingId} stopped successfully`);
        
    } catch (error) {
        console.error('Error stopping recording:', error);
        stateManager.showAlert(`Error stopping recording ${recordingId}`, 'error');
    }
}

function startStatusUpdates() {
    if (stateManager.statusUpdateInterval) {
        clearInterval(stateManager.statusUpdateInterval);
    }
    
    stateManager.statusUpdateInterval = setInterval(updateStatusDisplay, 1000);
}

function stopStatusUpdates() {
    if (stateManager.statusUpdateInterval) {
        clearInterval(stateManager.statusUpdateInterval);
        stateManager.statusUpdateInterval = null;
    }
}

function updateStatusDisplay() {
    // Simplified status update - just update the recordings preview
    updateRecordingsPreview();
    
    // Stop status updates if no recordings are active
    if (stateManager.screenRecordings.size === 0) {
        stopStatusUpdates();
    }
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startScreenRecording(stream, recordingId, duration, tabTitle = "Unknown") {
    const selectedFormat = document.getElementById('video-format').value;
    let options = {};
    
    // Set MIME type based on selected format with fallbacks
    switch(selectedFormat) {
        case 'mp4':
            options.mimeType = 'video/mp4';
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm'; // Fallback
            }
            break;
        case 'mkv':
            options.mimeType = 'video/x-matroska';
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm'; // Fallback
            }
            break;
        case 'avi':
            options.mimeType = 'video/avi';
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm'; // Fallback
            }
            break;
        default: // webm
            options.mimeType = 'video/webm;codecs=vp9,opus';
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm;codecs=vp8,opus';
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'video/webm';
                }
            }
    }
    
    const mediaRecorder = new MediaRecorder(stream, options);
    const recordedChunks = [];
    const startTime = Date.now();
    
    mediaRecorder.ondataavailable = function(event) {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    
    mediaRecorder.onstop = function() {
        // Save the recording data
        saveScreenRecording(recordedChunks, recordingId, startTime, tabTitle);
        
        // Clean up the recording from active list
        setTimeout(() => {
            stateManager.screenRecordings.delete(recordingId);
            thumbnailEngine.stopCapture(recordingId);
            updateRecordingsPreview();
            updateStatusDisplay();
        }, CONFIG.CLEANUP_DELAY);
    };

    // Handle stream ending (user stops sharing)
    stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    });
    
    mediaRecorder.start(1000);
    
    stateManager.screenRecordings.set(recordingId, {
        mediaRecorder,
        stream,
        startTime,
        duration,
        tabTitle,
        screenshot: null
    });
    
    // Auto-stop after duration
    setTimeout(() => {
        if (stateManager.screenRecordings.has(recordingId)) {
            stopScreenRecording(recordingId);
        }
    }, duration);
    
    updateRecordingsPreview();
    startStatusUpdates();
}

async function saveScreenRecording(recordedChunks, recordingId, startTime, tabTitle = "Unknown") {
    if (recordedChunks.length === 0) {
        stateManager.showAlert(`No recording data to save for screen ${recordingId}`, 'error');
        return;
    }
    
    const selectedFormat = document.getElementById('video-format').value;
    const qualitySlider = document.getElementById('video-quality');
    const qualityValues = ['4k', '1440p', '1080p', '720p', '480p'];
    const selectedQuality = qualityValues[parseInt(qualitySlider.value)];
    const blob = new Blob(recordedChunks, { type: getMimeTypeForFormat(selectedFormat) });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Clean tab title for filename
    const cleanTabTitle = tabTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const duration = (Date.now() - startTime) / 1000;
    
    // Get existing recordings count for naming
    try {
        const existingRecordings = await stateManager.dbManager.getAllRecordings();
        const sameTabCount = existingRecordings.filter(rec => 
            rec.tabTitle && rec.tabTitle.toLowerCase() === tabTitle.toLowerCase()
        ).length + 1;
        
        // Use custom filename if set during recording, otherwise generate default
        const recordingForFilename = stateManager.screenRecordings.get(recordingId);
        let customFilename = null;
        
        // Priority order: 1) Custom filename, 2) Default
         let baseFilename;
         
         // Check active recording for custom filename
         if (recordingForFilename && recordingForFilename.customFilename) {
            customFilename = recordingForFilename.customFilename;
            baseFilename = customFilename.replace(/[^a-zA-Z0-9_-]/g, '_');
            console.log(`Using custom filename: ${baseFilename} for recording ${recordingId}`);
        }
        // Check preserved custom filenames (for recordings that have already stopped)
        else if (window.pendingCustomFilenames && window.pendingCustomFilenames.has(recordingId)) {
            customFilename = window.pendingCustomFilenames.get(recordingId);
            // Clean up the temporary storage
            window.pendingCustomFilenames.delete(recordingId);
            baseFilename = customFilename.replace(/[^a-zA-Z0-9_-]/g, '_');
            console.log(`Using preserved custom filename: ${baseFilename} for recording ${recordingId}`);
        }
        else {
            // Use default naming convention
            baseFilename = `${cleanTabTitle}_${sameTabCount}_${selectedQuality}`;
            console.log(`Using default filename: ${baseFilename} for recording ${recordingId}`);
        }
        
        const filename = `${baseFilename}.${selectedFormat}`;
        
        // Get screenshot
        let screenshot = null;
        const activeRecording = stateManager.screenRecordings.get(recordingId);
        const thumbnailData = stateManager.thumbnailCaptures.get(recordingId);
        
        if (activeRecording && activeRecording.screenshot) {
            screenshot = activeRecording.screenshot;
        } else if (thumbnailData && thumbnailData.lastCapture) {
            screenshot = thumbnailData.lastCapture;
        }
        
        // Create recording data object
        const recordingData = {
            filename: filename,
            blob: blob,  // Store blob directly, not Base64!
            size: blob.size,
            timestamp: new Date().toISOString(),
            duration: duration,
            format: selectedFormat,
            quality: selectedQuality,
            tabTitle: tabTitle,
            tabCount: sameTabCount,
            screenshot: screenshot
        };
        
        // Check storage usage before saving
        const currentUsage = await stateManager.dbManager.getStorageUsage();
        const newSize = blob.size;
        const totalSize = currentUsage + newSize;
        const maxSize = 200 * 1024 * 1024; // 200MB limit
        
        if (totalSize > maxSize) {
            const usageMB = (currentUsage / (1024 * 1024)).toFixed(1);
            const newSizeMB = (newSize / (1024 * 1024)).toFixed(1);
            stateManager.showAlert(`Storage limit reached! Current: ${usageMB}MB, New recording: ${newSizeMB}MB. Please delete old recordings or download this one directly.`, 'error');
            
            // Force download instead of saving
            downloadRecordingDirectly(blob, filename);
            return;
        }
        
        // Save to IndexedDB
        await stateManager.dbManager.saveRecording(recordingData);
        await loadSavedRecordings(); // Refresh the UI
        
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
        const totalUsageMB = (totalSize / (1024 * 1024)).toFixed(1);
        stateManager.showAlert(`Recording saved: ${filename} (${sizeMB}MB). Total storage: ${totalUsageMB}/200MB`);
        
    } catch (error) {
        console.error('Failed to save recording:', error);
        stateManager.showAlert('Failed to save recording. Downloading directly.', 'error');
        
        // Fallback to direct download
        const filename = `${cleanTabTitle}_${timestamp}_${selectedQuality}.${selectedFormat}`;
        downloadRecordingDirectly(blob, filename);
    }
}

// Helper function for direct downloads
function downloadRecordingDirectly(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function getMimeTypeForFormat(format) {
    switch(format) {
        case 'mp4': return 'video/mp4';
        case 'mkv': return 'video/x-matroska';
        case 'avi': return 'video/avi';
        default: return 'video/webm';
    }
}

function stopAllRecordings() {
    stateManager.screenRecordings.forEach((recording, id) => {
        if (recording.mediaRecorder && recording.mediaRecorder.state !== 'inactive') {
            recording.mediaRecorder.stop();
        }
        if (recording.stream) {
            recording.stream.getTracks().forEach(track => track.stop());
        }
        thumbnailEngine.stopCapture(id);
    });
    
    stateManager.showAlert('All screen recordings stopped');
}

function clearAllRecordings() {
    if (stateManager.screenRecordings.size > 0) {
        stateManager.showAlert('Cannot clear while recordings are active', 'error');
        return;
    }
    updateRecordingsPreview();
    stateManager.showAlert('All recordings cleared');
}

async function clearAllSavedRecordings() {
    try {
        await stateManager.dbManager.clearAllRecordings();
        await loadSavedRecordings();
        stateManager.showAlert('All saved recordings deleted');
    } catch (error) {
        console.error('Clear all failed:', error);
        stateManager.showAlert('Clear all failed', 'error');
    }
}

async function loadSavedRecordings() {
    try {
        const recordings = await stateManager.dbManager.getAllRecordings();
        const recordingsList = document.getElementById('recordings-list');
        
        if (recordings.length === 0) {
            recordingsList.innerHTML = '<p>No recordings yet. Start recording to see your videos here.</p>';
            return;
        }
        
        // Store current input values and focus state before updating
        const inputStates = new Map();
        recordings.forEach(recording => {
            const existingInput = document.getElementById(`id-input-${recording.id}`);
            if (existingInput) {
                inputStates.set(recording.id, {
                    value: existingInput.value,
                    focused: document.activeElement === existingInput,
                    selectionStart: existingInput.selectionStart,
                    selectionEnd: existingInput.selectionEnd,
                    hasDuplicateClass: existingInput.classList.contains('duplicate')
                });
            }
        });
        
        // Calculate total storage usage
        let totalSize = 0;
        recordings.forEach(recording => totalSize += recording.size || 0);
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
        
        recordingsList.innerHTML = `
            <div style="margin-bottom: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px; border: 1px solid #404040;">
                <strong>Storage Usage: ${totalSizeMB}/200 MB (${recordings.length} recordings)</strong>
            </div>
        `;
        
        // Sort by timestamp (newest first)
        recordings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        recordings.forEach((recording, index) => {
            const recordingDiv = document.createElement('div');
            recordingDiv.className = 'recording-item';
            
            const sizeInMB = (recording.size / (1024 * 1024)).toFixed(1);
            const date = new Date(recording.timestamp).toLocaleString();
            const sourceInfo = `${recording.format?.toUpperCase() || 'WEBM'} | ${recording.quality || '720p'}`;
            
            // Mini thumbnail (not clickable)
            let thumbnailHtml = '';
            if (recording.screenshot) {
                thumbnailHtml = `
                    <img src="${recording.screenshot}" 
                         alt="Recording thumbnail" 
                         class="thumbnail-image"
                         title="Recording preview">
                `;
            }
            
            // Edited indicator
            let editedIndicator = '';
            if (recording.isEdited) {
                editedIndicator = '<span class="edited-indicator">EDITED</span>';
            }
            
            recordingDiv.innerHTML = `
                <div class="recording-item-content">
                    ${thumbnailHtml}
                    <div class="recording-item-info">
                        <div class="recording-name">
                            ${recording.filename}
                            ${editedIndicator}
                        </div>
                        <div class="recording-details">
                            ${sizeInMB} MB • ${formatTime(recording.duration || 0)} • ${date} • ${sourceInfo}
                        </div>
                    </div>
                </div>
                <div class="recording-item-actions">
                    <div class="id-input-container">
                        <label for="id-input-${recording.id}">ID:</label>
                        <input type="text" 
                               id="id-input-${recording.id}" 
                               class="recording-id-input" 
                               placeholder="Enter ID"
                               value="${inputStates.get(recording.id)?.value || ''}"
                               onblur="updateRecordingId(${recording.id}, this.value)">
                    </div>
                    <button class="crop-btn" onclick="openCropModal(${recording.id})" title="Crop this video">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7,17V1H5V5H1V7H5V17A2,2 0 0,0 7,19H17V23H19V19H23V17H19V7H7V17M9,9H17V17H9V9Z" />
                        </svg>
                        Crop
                    </button>
                    <button class="rename-btn" onclick="renameRecording(${recording.id})" title="Rename this recording">
                        Rename file
                    </button>
                    <button class="download-btn" onclick="downloadRecordingFromDB(${recording.id})">
                        Download
                    </button>
                    <button class="download-btn delete-btn" onclick="deleteRecordingFromDB(${recording.id})">
                        Delete
                    </button>
                </div>
            `;
            
            recordingsList.appendChild(recordingDiv);
            
            // Restore input state if it existed
            const storedState = inputStates.get(recording.id);
            if (storedState) {
                const newInput = document.getElementById(`id-input-${recording.id}`);
                if (newInput) {
                    // Restore duplicate class if it was present
                    if (storedState.hasDuplicateClass) {
                        newInput.classList.add('duplicate');
                    }
                    
                    // Restore focus and selection if it was focused
                    if (storedState.focused) {
                        setTimeout(() => {
                            newInput.focus();
                            newInput.setSelectionRange(storedState.selectionStart, storedState.selectionEnd);
                        }, 0);
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Failed to load recordings:', error);
        document.getElementById('recordings-list').innerHTML = '<p>Error loading recordings.</p>';
    }
}

async function downloadRecordingFromDB(id) {
    try {
        const recordings = await stateManager.dbManager.getAllRecordings();
        const recording = recordings.find(r => r.id === id);
        
        if (recording && recording.blob) {
            const url = URL.createObjectURL(recording.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = recording.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            stateManager.showAlert('Download started');
        } else {
            stateManager.showAlert('Recording not found', 'error');
        }
    } catch (error) {
        console.error('Download failed:', error);
        stateManager.showAlert('Download failed', 'error');
    }
}

async function deleteRecordingFromDB(id) {
    try {
        await stateManager.dbManager.deleteRecording(id);
        await loadSavedRecordings();
        stateManager.showAlert('Recording deleted');
    } catch (error) {
        console.error('Delete failed:', error);
        stateManager.showAlert('Delete failed', 'error');
    }
}

async function renameRecording(id) {
    try {
        const recordings = await stateManager.dbManager.getAllRecordings();
        const recording = recordings.find(r => r.id === id);
        
        if (!recording) {
            stateManager.showAlert('Recording not found', 'error');
            return;
        }
        
        const currentName = recording.filename.replace(/\.[^/.]+$/, '');
        const newName = prompt('Enter new filename (without extension):', currentName);
        
        if (newName && newName.trim() && newName.trim() !== currentName) {
            const cleanName = newName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            
            if (cleanName) {
                const extension = recording.filename.split('.').pop();
                const newFilename = `${cleanName}.${extension}`;
                
                // Update the recording
                recording.filename = newFilename;
                
                // Delete old and save updated
                await stateManager.dbManager.deleteRecording(id);
                await stateManager.dbManager.saveRecording(recording);
                
                await loadSavedRecordings();
                stateManager.showAlert(`Recording renamed to: ${newFilename}`);
            } else {
                stateManager.showAlert('Invalid filename. Please use only letters, numbers, underscores, and hyphens.', 'error');
            }
        }
    } catch (error) {
        console.error('Rename failed:', error);
        stateManager.showAlert('Rename failed', 'error');
    }
}

// Simple crop functionality
let currentCropSession = null;

// Simple Crop Modal Functions
async function openCropModal(recordingId) {
    try {
        const recordings = await stateManager.dbManager.getAllRecordings();
        const recording = recordings.find(r => r.id === recordingId);
        
        if (!recording || !recording.blob) {
            stateManager.showAlert('Recording not found', 'error');
            return;
        }
        
        // Set up video element
        const video = document.getElementById('crop-video');
        video.src = URL.createObjectURL(recording.blob);
        
        // Store current session
        currentCropSession = {
            recordingId: recordingId,
            recording: recording,
            videoElement: video,
            isDragging: false,
            startX: 0,
            startY: 0,
            cropRect: { x: 0, y: 0, width: 200, height: 150 }
        };
        
        // Show modal
        document.getElementById('crop-modal').style.display = 'block';
        
        // Set up drag functionality when video loads
        video.onloadedmetadata = () => {
            setupCropDragging();
            updateCropSelection();
        };
        
        stateManager.showAlert('Crop tool loaded. Drag to select crop area or use input fields.');
        
    } catch (error) {
        console.error('Failed to open crop modal:', error);
        stateManager.showAlert('Failed to open crop tool: ' + error.message, 'error');
    }
}

// Set up draggable crop selection
function setupCropDragging() {
    const videoContainer = document.querySelector('.crop-video-container');
    const video = document.getElementById('crop-video');
    const overlay = document.getElementById('crop-overlay');
    const selection = document.getElementById('crop-selection');
    
    if (!videoContainer || !video || !overlay || !selection) return;
    
    // Initialize crop selection in center of video
    const videoRect = video.getBoundingClientRect();
    const containerRect = videoContainer.getBoundingClientRect();
    
    currentCropSession.cropRect = {
        x: videoRect.width * 0.25,
        y: videoRect.height * 0.25,
        width: videoRect.width * 0.5,
        height: videoRect.height * 0.5
    };
    
    updateCropSelection();
    
    // Mouse events for dragging
    overlay.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Touch events for mobile
    overlay.addEventListener('touchstart', startDrag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', endDrag);
}

function startDrag(e) {
    if (!currentCropSession) return;
    
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    currentCropSession.isDragging = true;
    currentCropSession.startX = clientX - rect.left;
    currentCropSession.startY = clientY - rect.top;
    
    // Start new selection
    currentCropSession.cropRect = {
        x: currentCropSession.startX,
        y: currentCropSession.startY,
        width: 0,
        height: 0
    };
    
    updateCropSelection();
}

function drag(e) {
    if (!currentCropSession || !currentCropSession.isDragging) return;
    
    e.preventDefault();
    const overlay = document.getElementById('crop-overlay');
    const rect = overlay.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;
    
    // Calculate selection rectangle
    const x = Math.min(currentCropSession.startX, currentX);
    const y = Math.min(currentCropSession.startY, currentY);
    const width = Math.abs(currentX - currentCropSession.startX);
    const height = Math.abs(currentY - currentCropSession.startY);
    
    currentCropSession.cropRect = { x, y, width, height };
    updateCropSelection();
}

function endDrag(e) {
    if (!currentCropSession) return;
    
    currentCropSession.isDragging = false;
    
    // Ensure minimum size
    if (currentCropSession.cropRect.width < 20) {
        currentCropSession.cropRect.width = 20;
    }
    if (currentCropSession.cropRect.height < 20) {
        currentCropSession.cropRect.height = 20;
    }
    
    updateCropSelection();
    updateInputFields();
}

function updateCropSelection() {
    if (!currentCropSession) return;
    
    const selection = document.getElementById('crop-selection');
    if (!selection) return;
    
    const { x, y, width, height } = currentCropSession.cropRect;
    
    selection.style.left = x + 'px';
    selection.style.top = y + 'px';
    selection.style.width = width + 'px';
    selection.style.height = height + 'px';
    selection.style.display = 'block';
}

// Input field functions removed - now using drag-only interface

function closeCropModal() {
    if (currentCropSession && currentCropSession.videoElement) {
        URL.revokeObjectURL(currentCropSession.videoElement.src);
        currentCropSession.videoElement.src = '';
        currentCropSession = null;
    }
    document.getElementById('crop-modal').style.display = 'none';
}

async function applyCrop() {
    if (!currentCropSession) return;
    
    try {
        const { recording, videoElement } = currentCropSession;
        
        // Calculate crop values from drag selection
        const video = document.getElementById('crop-video');
        const videoRect = video.getBoundingClientRect();
        const { x, y, width, height } = currentCropSession.cropRect;
        
        // Convert from display coordinates to video coordinates
        const scaleX = video.videoWidth / videoRect.width;
        const scaleY = video.videoHeight / videoRect.height;
        
        const left = Math.round(x * scaleX);
        const top = Math.round(y * scaleY);
        const right = Math.round((videoRect.width - (x + width)) * scaleX);
        const bottom = Math.round((videoRect.height - (y + height)) * scaleY);
        
        // Validate crop values
        if (left < 0 || right < 0 || top < 0 || bottom < 0) {
            stateManager.showAlert('Crop values cannot be negative', 'error');
            return;
        }
        
        // Show applying message
        stateManager.showAlert('Applying crop...', 'success');
        
        // Add real-time progress indicator
        const progressDiv = document.createElement('div');
        progressDiv.id = 'crop-progress';
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 25px 35px;
            border-radius: 12px;
            z-index: 10001;
            text-align: center;
            font-size: 16px;
            font-weight: 500;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            min-width: 300px;
        `;
        progressDiv.innerHTML = `
            <div style="margin-bottom: 15px; font-size: 18px;">🎬 Applying Crop</div>
            <div style="margin-bottom: 15px; font-size: 13px; color: #ccc;">Processing your video...</div>
            <div style="background: #333; border-radius: 10px; height: 8px; margin-bottom: 10px; overflow: hidden;">
                <div id="crop-progress-bar" style="background: linear-gradient(90deg, #ff6b35, #f7931e); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 10px;"></div>
            </div>
            <div id="crop-progress-text" style="font-size: 12px; color: #aaa;">0%</div>
        `;
        document.body.appendChild(progressDiv);
        
        // Store progress elements for updates
         window.cropProgressBar = document.getElementById('crop-progress-bar');
         window.cropProgressText = document.getElementById('crop-progress-text');
        
        let croppedBlob;
         try {
             // Process video using canvas
             croppedBlob = await processSimpleCrop(recording.blob, { left, right, top, bottom });
             
             // Remove progress indicator
             document.body.removeChild(progressDiv);
         } catch (error) {
             // Remove progress indicator on error
             if (document.body.contains(progressDiv)) {
                 document.body.removeChild(progressDiv);
             }
             throw error;
         }
        
        // Update the original recording in-place
        recording.blob = croppedBlob;
        recording.size = croppedBlob.size;
        recording.timestamp = new Date().toISOString();
        recording.isEdited = true;
        recording.editHistory = recording.editHistory || [];
        recording.editHistory.push({
            type: 'crop',
            timestamp: new Date().toISOString(),
            params: { left, right, top, bottom }
        });
        
        // Delete the old record and save the updated one
        await stateManager.dbManager.deleteRecording(recording.id);
        await stateManager.dbManager.saveRecording(recording);
        
        // Refresh UI
        await loadSavedRecordings();
        closeCropModal();
        
        stateManager.showAlert('Video edited successfully! Original has been updated.');
        
    } catch (error) {
        console.error('Crop processing failed:', error);
        stateManager.showAlert('Crop processing failed: ' + error.message, 'error');
    }
}

// Simple canvas-based crop processing with optimization for larger videos
async function processSimpleCrop(videoBlob, cropParams) {
    return new Promise((resolve, reject) => {
        const { left, right, top, bottom } = cropParams;
        
        // Check video size and warn for large files
        const videoSizeMB = videoBlob.size / (1024 * 1024);
        if (videoSizeMB > 50) {
            console.warn(`Processing large video: ${videoSizeMB.toFixed(1)}MB`);
        }
        
        // Create video element
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoBlob);
        video.muted = true;
        video.preload = 'metadata';
        
        // Set timeout for large videos
        const timeout = setTimeout(() => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Video processing timeout. Try with a smaller video or shorter duration.'));
        }, 300000); // 5 minute timeout
        
        video.onloadedmetadata = () => {
            try {
                const originalWidth = video.videoWidth;
                const originalHeight = video.videoHeight;
                
                // Calculate new dimensions
                const newWidth = originalWidth - left - right;
                const newHeight = originalHeight - top - bottom;
                
                if (newWidth <= 0 || newHeight <= 0) {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(video.src);
                    reject(new Error('Invalid crop dimensions. Check your crop values.'));
                    return;
                }
                
                // Check if resulting video would be too large
                if (newWidth > 4000 || newHeight > 4000) {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(video.src);
                    reject(new Error('Resulting video dimensions too large. Try smaller crop area.'));
                    return;
                }
                
                // Create canvas with optimized settings
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { alpha: false });
                canvas.width = newWidth;
                canvas.height = newHeight;
                
                // Set up MediaRecorder with optimized settings for faster processing
                const stream = canvas.captureStream(30); // Limited to 30fps for performance
                let mimeType = 'video/webm;codecs=vp9';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'video/webm;codecs=vp8';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = 'video/webm';
                    }
                }
                
                const recorder = new MediaRecorder(stream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: Math.min(2000000, 800000 * (newWidth * newHeight) / (1920 * 1080)) // Reduced bitrate for faster processing
                });
                
                const chunks = [];
                let frameCount = 0;
                
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };
                
                recorder.onstop = () => {
                     clearTimeout(timeout);
                     try {
                         // Complete the progress bar
                         if (window.cropProgressBar && window.cropProgressText) {
                             window.cropProgressBar.style.width = '100%';
                             window.cropProgressText.textContent = '100%';
                         }
                         
                         const croppedBlob = new Blob(chunks, { type: mimeType.split(';')[0] });
                         URL.revokeObjectURL(video.src);
                         
                         // Clean up progress references
                         window.cropProgressBar = null;
                         window.cropProgressText = null;
                         
                         if (croppedBlob.size === 0) {
                             reject(new Error('Processing resulted in empty video. Try different crop settings.'));
                         } else {
                             resolve(croppedBlob);
                         }
                     } catch (error) {
                         URL.revokeObjectURL(video.src);
                         window.cropProgressBar = null;
                         window.cropProgressText = null;
                         reject(new Error('Failed to create cropped video: ' + error.message));
                     }
                 };
                
                recorder.onerror = (event) => {
                     clearTimeout(timeout);
                     URL.revokeObjectURL(video.src);
                     window.cropProgressBar = null;
                     window.cropProgressText = null;
                     reject(new Error('Recording failed: ' + (event.error?.message || 'Unknown error')));
                 };
                
                // Start recording
                recorder.start(1000); // Collect data every second
                
                let lastRenderTime = 0;
                const targetFrameTime = 1000 / 30; // 30fps = ~33.33ms per frame
                
                const renderFrame = (currentTime) => {
                     if (video.ended || video.paused) {
                         recorder.stop();
                         return;
                     }
                     
                     // Frame rate limiting for consistent 30fps processing
                     if (currentTime - lastRenderTime >= targetFrameTime) {
                         try {
                             // Draw cropped frame with error handling
                             ctx.drawImage(
                                 video,
                                 left, top, newWidth, newHeight,
                                 0, 0, newWidth, newHeight
                             );
                             frameCount++;
                             lastRenderTime = currentTime;
                             
                             // Update progress bar based on video progress
                             if (video.duration > 0) {
                                 const progress = Math.min(100, (video.currentTime / video.duration) * 100);
                                 if (window.cropProgressBar && window.cropProgressText) {
                                     window.cropProgressBar.style.width = progress + '%';
                                     window.cropProgressText.textContent = Math.round(progress) + '%';
                                 }
                             }
                             
                             // Memory management for very long videos
                             if (frameCount % 300 === 0 && window.gc) {
                                 window.gc(); // Force garbage collection if available
                             }
                             
                         } catch (drawError) {
                             console.warn('Frame draw error:', drawError);
                         }
                     }
                     
                     requestAnimationFrame(renderFrame);
                 };
                 
                 // Start the render loop with proper timing
                 requestAnimationFrame(renderFrame);
                 
                 // Remove ontimeupdate as we're using requestAnimationFrame for better control
                 // video.ontimeupdate = renderFrame;
                
                // Start playback
                video.play().catch(playError => {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(video.src);
                    reject(new Error('Failed to play video: ' + playError.message));
                });
                
            } catch (setupError) {
                 clearTimeout(timeout);
                 URL.revokeObjectURL(video.src);
                 window.cropProgressBar = null;
                 window.cropProgressText = null;
                 reject(new Error('Setup failed: ' + setupError.message));
             }
         };
         
         video.onerror = (event) => {
             clearTimeout(timeout);
             URL.revokeObjectURL(video.src);
             window.cropProgressBar = null;
             window.cropProgressText = null;
             reject(new Error('Failed to load video. The file may be corrupted or too large.'));
         };
         
         video.onabort = () => {
             clearTimeout(timeout);
             URL.revokeObjectURL(video.src);
             window.cropProgressBar = null;
             window.cropProgressText = null;
             reject(new Error('Video loading was aborted.'));
         };
    });
}

// INITIALIZE GLOBAL STATE
const dbManager = new IndexedDBManager();
const stateManager = new RecordingStateManager();
const thumbnailEngine = new ThumbnailCaptureEngine(stateManager);

// Update the DOMContentLoaded event
// What's New dropdown functionality
function toggleWhatsNew() {
    const dropdown = document.getElementById('whats-new-dropdown');
    dropdown.classList.toggle('show');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const container = document.querySelector('.whats-new-container');
    const dropdown = document.getElementById('whats-new-dropdown');
    
    if (container && !container.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Close dropdown on escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const dropdown = document.getElementById('whats-new-dropdown');
        dropdown.classList.remove('show');
    }
});

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize IndexedDB and load recordings
    try {
        await stateManager.dbManager.initDB();
        await loadSavedRecordings();
    } catch (error) {
        console.error('Initialization failed:', error);
    }
});