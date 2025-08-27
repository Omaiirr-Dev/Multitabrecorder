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
    CLEANUP_DELAY: 100,          // wait a bit before cleaning up
    
    // Filename handling patterns
    FILENAME_PATTERNS: {
        // Only remove characters that are truly invalid for file systems
        // Preserve URLs, dashes, dots, colons, slashes, etc.
        DISPLAY_SAFE: /[<>"\\|?*]/g,  // Only remove Windows invalid chars for display
        DOWNLOAD_SAFE: /[<>:"/\\|?*]/g  // Remove more chars only for actual downloads
    }
};

// Helper functions for consistent filename handling
function preserveUrlForDisplay(filename) {
    // Only remove truly problematic characters, preserve URLs completely
    return filename.replace(CONFIG.FILENAME_PATTERNS.DISPLAY_SAFE, '_');
}

function sanitizeForDownload(filename) {
    // Only sanitize when actually downloading files
    return filename.replace(CONFIG.FILENAME_PATTERNS.DOWNLOAD_SAFE, '_');
}

function preserveUrlInTabTitle(tabTitle) {
     // Preserve all URL characters in tab titles
     return tabTitle.replace(CONFIG.FILENAME_PATTERNS.DISPLAY_SAFE, '').substring(0, 50) || 'Screen Recording';
 }
 
 // Comprehensive URL preservation validation
 function validateUrlPreservation(originalUrl, processedUrl, context) {
     console.log(`[URL Preservation Check - ${context}]`);
     console.log(`Original: "${originalUrl}"`);
     console.log(`Processed: "${processedUrl}"`);
     
     // Check if critical URL components are preserved
     const urlComponents = {
         protocol: originalUrl.includes('://'),
         colon: originalUrl.includes(':'),
         slash: originalUrl.includes('/'),
         dot: originalUrl.includes('.'),
         dash: originalUrl.includes('-'),
         underscore: originalUrl.includes('_'),
         equals: originalUrl.includes('='),
         question: originalUrl.includes('?'),
         ampersand: originalUrl.includes('&')
     };
     
     const preservedComponents = {
         protocol: processedUrl.includes('://'),
         colon: processedUrl.includes(':'),
         slash: processedUrl.includes('/'),
         dot: processedUrl.includes('.'),
         dash: processedUrl.includes('-'),
         underscore: processedUrl.includes('_'),
         equals: processedUrl.includes('='),
         question: processedUrl.includes('?'),
         ampersand: processedUrl.includes('&')
     };
     
     let allPreserved = true;
     for (const [component, originalHas] of Object.entries(urlComponents)) {
         if (originalHas && !preservedComponents[component]) {
             console.warn(`❌ Lost ${component} in ${context}`);
             allPreserved = false;
         } else if (originalHas && preservedComponents[component]) {
             console.log(`✅ Preserved ${component} in ${context}`);
         }
     }
     
     if (allPreserved) {
         console.log(`🎉 All URL components preserved in ${context}!`);
     } else {
         console.error(`🚨 URL components lost in ${context}!`);
     }
     
     return allPreserved;
 }
 
 // Enhanced filename processing with validation
 function processFilenameWithValidation(filename, context, forDownload = false) {
     console.log(`\n[Processing filename for ${context}]`);
     console.log(`Input: "${filename}"`);
     console.log(`For download: ${forDownload}`);
     
     let result;
     if (forDownload) {
         result = sanitizeForDownload(filename);
         console.log(`Applied download sanitization`);
     } else {
         result = preserveUrlForDisplay(filename);
         console.log(`Applied display preservation`);
     }
     
     console.log(`Output: "${result}"`);
     validateUrlPreservation(filename, result, context);
     
     return result;
 }

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
        const qualityNames = ['4K', '1440p', '1080p', '720p', '480p'];
        
        if (qualitySlider && qualityText) {
            // Set default to 1080p (value 2)
            qualitySlider.value = 2;
            qualityText.textContent = '1080p';
            
            qualitySlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                qualityText.textContent = qualityNames[value] || '1080p';
                
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
                padding: 8px 12px;
                border-radius: 3px;
                color: #e0e0e0;
                font-weight: 400;
                z-index: 10000;
                max-width: 300px;
                word-wrap: break-word;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                transition: all 0.3s ease;
                font-size: 12px;
                background-color: ${type === 'error' ? '#333333' : '#2a2a2a'};
                border: 1px solid ${type === 'error' ? '#555555' : '#404040'};
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
        const cleanTabTitle = preserveUrlForDisplay((recording.tabTitle || 'Screen Recording')).substring(0, 30);
        
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
        
        // Update compiler table in real-time
        if (typeof updateCompilerTable === 'function') {
            updateCompilerTable();
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
            // Preserve URL characters and common punctuation for tab titles
            tabTitle = preserveUrlInTabTitle(tabTitle);
        } catch {}

        // Set up thumbnail capture
        try {
            await thumbnailEngine.initializeThumbnailCapture(stream, recordingId);
        } catch (thumbnailError) {
            console.warn('Thumbnail capture setup failed:', thumbnailError);
        }

        const qualityNames = ['4K', '1440p', '1080p', '720p HD', '480p'];
        const qualityName = qualityNames[selectedQuality] || '4K';
        
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
    const cleanTabTitle = preserveUrlForDisplay(tabTitle).substring(0, 30);
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
            baseFilename = preserveUrlForDisplay(customFilename);
            console.log(`Using custom filename: ${baseFilename} for recording ${recordingId}`);
        }
        // Check preserved custom filenames (for recordings that have already stopped)
        else if (window.pendingCustomFilenames && window.pendingCustomFilenames.has(recordingId)) {
            customFilename = window.pendingCustomFilenames.get(recordingId);
            // Clean up the temporary storage
            window.pendingCustomFilenames.delete(recordingId);
            baseFilename = preserveUrlForDisplay(customFilename);
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
        const maxSize = 1024 * 1024 * 1024; // 1GB limit (1024MB)
        
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
        stateManager.showAlert(`Recording saved: ${filename} (${sizeMB}MB). Total storage: ${totalUsageMB}/1024MB`);
        
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
    
    // Sanitize filename only for download
     const sanitizedFilename = sanitizeForDownload(filename);
     a.download = sanitizedFilename;
    
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
        // Update compiler table in real-time
        if (typeof updateCompilerTable === 'function') {
            updateCompilerTable();
        }
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
                <strong>Storage Usage: ${totalSizeMB}/1024 MB (${recordings.length} recordings)</strong>
            </div>
        `;
        
        // Sort by timestamp (newest first)
        recordings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        recordings.forEach((recording, index) => {
            const recordingDiv = document.createElement('div');
            recordingDiv.className = 'recording-item';
            recordingDiv.setAttribute('data-recording-id', recording.id); // Add this for rename function
            
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
        
        // Update compiler table when recordings change
        if (typeof updateCompilerTable === 'function') {
            updateCompilerTable();
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
            
            // Sanitize filename only for download, preserve URLs in display
            const sanitizedFilename = sanitizeForDownload(recording.filename);
            a.download = sanitizedFilename;
            
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
        // Update compiler table in real-time
        if (typeof updateCompilerTable === 'function') {
            updateCompilerTable();
        }
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
        
        // Find the recording item in the DOM
        const recordingItem = document.querySelector(`[data-recording-id="${id}"]`);
        if (!recordingItem) {
            stateManager.showAlert('Recording element not found', 'error');
            return;
        }
        
        // Find the filename display element
        const filenameElement = recordingItem.querySelector('.recording-name');
        if (!filenameElement) {
            stateManager.showAlert('Filename element not found', 'error');
            return;
        }
        
        const currentName = recording.filename.replace(/\.[^/.]+$/, '');
        const extension = recording.filename.split('.').pop();
        
        // Create inline input for editing
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'inline-rename-input';
        input.style.cssText = `
            background: #2a2a2a;
            color: #ffffff;
            border: 1px solid #ff6b35;
            border-radius: 3px;
            padding: 4px 8px;
            font-size: 13px;
            font-family: inherit;
            width: 200px;
            outline: none;
        `;
        
        // Replace filename with input
        filenameElement.style.display = 'none';
        filenameElement.parentNode.insertBefore(input, filenameElement.nextSibling);
        input.focus();
        input.select();
        
        // Handle save on Enter or blur
        const saveRename = async () => {
            const newName = input.value.trim();
            
            if (newName && newName !== currentName) {
                console.log(`\n[RENAME OPERATION STARTED]`);
                console.log(`Original name: "${currentName}"`);
                console.log(`New name input: "${newName}"`);
                
                // Store the original name for display - NO SANITIZATION
                const displayName = newName;
                console.log(`Display name (unsanitized): "${displayName}"`);
                
                // Validate URL preservation in display name
                validateUrlPreservation(newName, displayName, 'Rename Display');
                
                // Create filename with original unsanitized name
                const newFilename = `${displayName}.${extension}`;
                console.log(`Final filename: "${newFilename}"`);
                
                // Update the recording with the original unsanitized name
                recording.filename = newFilename;
                recording.displayName = displayName; // Store original for display
                recording.originalInput = newName; // Store what user actually typed
                
                console.log(`Stored in database:`);
                console.log(`- filename: "${recording.filename}"`);
                console.log(`- displayName: "${recording.displayName}"`);
                console.log(`- originalInput: "${recording.originalInput}"`);
                
                // Delete old and save updated
                await stateManager.dbManager.deleteRecording(id);
                await stateManager.dbManager.saveRecording(recording);
                
                // Update the display with original name
                filenameElement.textContent = newFilename;
                console.log(`UI updated with: "${newFilename}"`);
                
                // Validate final result
                validateUrlPreservation(newName, newFilename, 'Final Rename Result');
                
                // Update compiler table in real-time
                if (typeof updateCompilerTable === 'function') {
                    updateCompilerTable();
                }
                
                stateManager.showAlert(`Recording renamed to: ${displayName}`, 'success');
                console.log(`[RENAME OPERATION COMPLETED SUCCESSFULLY]\n`);
            }
            
            // Restore original display
            input.remove();
            filenameElement.style.display = '';
        };
        
        // Save on Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveRename();
            } else if (e.key === 'Escape') {
                // Cancel on Escape
                input.remove();
                filenameElement.style.display = '';
            }
        });
        
        // Save on blur (clicking away)
        input.addEventListener('blur', saveRename);
        
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
    
    // Initialize crop selection in center of video with 16:9 aspect ratio
    const videoRect = video.getBoundingClientRect();
    const containerRect = videoContainer.getBoundingClientRect();
    
    // Calculate 16:9 crop area that fits within the video
    const aspectRatio = 16 / 9;
    let cropWidth = videoRect.width * 0.6;
    let cropHeight = cropWidth / aspectRatio;
    
    // If height is too large, adjust based on height
    if (cropHeight > videoRect.height * 0.6) {
        cropHeight = videoRect.height * 0.6;
        cropWidth = cropHeight * aspectRatio;
    }
    
    currentCropSession.cropRect = {
        x: (videoRect.width - cropWidth) / 2,
        y: (videoRect.height - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight
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
    
    // Store initial mouse position for drag threshold
    currentCropSession.initialMouseX = clientX;
    currentCropSession.initialMouseY = clientY;
    currentCropSession.dragStarted = false;
    currentCropSession.isDragging = true;
    currentCropSession.startX = clientX - rect.left;
    currentCropSession.startY = clientY - rect.top;
    
    // Add visual feedback for drag start
    const overlay = document.getElementById('crop-overlay');
    overlay.style.cursor = 'crosshair';
    
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
    
    // Calculate raw dimensions first
    let rawWidth = Math.abs(currentX - currentCropSession.startX);
    let rawHeight = Math.abs(currentY - currentCropSession.startY);
    
    // Apply 16:9 aspect ratio constraint
    const aspectRatio = 16 / 9;
    let finalWidth, finalHeight;
    
    // Determine which dimension to constrain based on aspect ratio
    if (rawWidth / rawHeight > aspectRatio) {
        // Width is too large, constrain by height
        finalHeight = rawHeight;
        finalWidth = finalHeight * aspectRatio;
    } else {
        // Height is too large, constrain by width
        finalWidth = rawWidth;
        finalHeight = finalWidth / aspectRatio;
    }
    
    // Calculate position based on drag direction
    let finalX, finalY;
    
    if (currentX >= currentCropSession.startX) {
        // Dragging right
        finalX = currentCropSession.startX;
    } else {
        // Dragging left
        finalX = currentCropSession.startX - finalWidth;
    }
    
    if (currentY >= currentCropSession.startY) {
        // Dragging down
        finalY = currentCropSession.startY;
    } else {
        // Dragging up
        finalY = currentCropSession.startY - finalHeight;
    }
    
    // Ensure the crop area stays within bounds
    finalX = Math.max(0, Math.min(finalX, rect.width - finalWidth));
    finalY = Math.max(0, Math.min(finalY, rect.height - finalHeight));
    
    // If we hit a boundary, recalculate dimensions to fit
    const availableWidth = rect.width - finalX;
    const availableHeight = rect.height - finalY;
    
    if (finalWidth > availableWidth) {
        finalWidth = availableWidth;
        finalHeight = finalWidth / aspectRatio;
    }
    if (finalHeight > availableHeight) {
        finalHeight = availableHeight;
        finalWidth = finalHeight * aspectRatio;
    }
    
    currentCropSession.cropRect = {
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight
    };
    
    updateCropSelection();
}

function endDrag(e) {
    if (!currentCropSession) return;
    
    currentCropSession.isDragging = false;
    currentCropSession.dragStarted = false;
    
    // Reset cursor to default
    const overlay = document.getElementById('crop-overlay');
    overlay.style.cursor = 'default';
    
    // Only apply minimum size if a drag actually occurred
    if (currentCropSession.cropRect.width > 0 && currentCropSession.cropRect.height > 0) {
        // Ensure minimum size while maintaining 16:9 aspect ratio
        const aspectRatio = 16 / 9;
        const minWidth = 80;  // Minimum width for 16:9 ratio
        const minHeight = minWidth / aspectRatio;
        
        if (currentCropSession.cropRect.width < minWidth) {
            currentCropSession.cropRect.width = minWidth;
            currentCropSession.cropRect.height = minHeight;
        }
        if (currentCropSession.cropRect.height < minHeight) {
            currentCropSession.cropRect.height = minHeight;
            currentCropSession.cropRect.width = minWidth;
        }
        
        // Final boundary check to ensure crop area is within video bounds
        const video = document.getElementById('crop-video');
        const videoRect = video.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();
        
        // Adjust position if crop area extends beyond video bounds
        const maxX = overlayRect.width - currentCropSession.cropRect.width;
        const maxY = overlayRect.height - currentCropSession.cropRect.height;
        
        currentCropSession.cropRect.x = Math.max(0, Math.min(currentCropSession.cropRect.x, maxX));
        currentCropSession.cropRect.y = Math.max(0, Math.min(currentCropSession.cropRect.y, maxY));
        
        updateCropSelection();
        
        // Provide haptic feedback on supported devices
        if (navigator.vibrate) {
            navigator.vibrate(50); // Short vibration for feedback
        }
    }
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
        
        // Add progress indicator above the instruction text
        const cropInstructions = document.querySelector('.crop-instructions');
        const progressDiv = document.createElement('div');
        progressDiv.id = 'crop-progress';
        progressDiv.style.cssText = `
            background: rgba(26, 26, 26, 0.95);
            color: white;
            padding: 15px 20px;
            border-radius: 6px;
            text-align: center;
            font-size: 14px;
            font-weight: 400;
            margin-bottom: 15px;
            border: 1px solid #404040;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        `;
        
        // Insert the progress div before the instruction text
        cropInstructions.insertBefore(progressDiv, cropInstructions.firstChild);
        
        progressDiv.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px;">
                <div class="loading-spinner" style="width: 16px; height: 16px; border: 2px solid #404040; border-top: 2px solid #ff6b35; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span style="font-size: 16px; font-weight: 500;">Cropping Video</span>
            </div>
            <div style="background: #333; border-radius: 6px; height: 6px; margin-bottom: 8px; overflow: hidden;">
                <div id="crop-progress-bar" style="background: linear-gradient(90deg, #ff6b35, #f7931e); height: 100%; width: 0%; transition: width 0.5s ease; border-radius: 6px;"></div>
            </div>
            <div id="crop-progress-text" style="font-size: 12px; color: #ccc;">0%</div>
        `;
        
        // Add spinner animation CSS
        if (!document.getElementById('spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        
        // Store progress elements for updates
         window.cropProgressBar = document.getElementById('crop-progress-bar');
         window.cropProgressText = document.getElementById('crop-progress-text');
         
         // Implement 10-second incremental progress system
         let simulatedProgress = 0;
         const progressInterval = setInterval(() => {
             if (simulatedProgress < 80) {
                 simulatedProgress += 10;
                 if (window.cropProgressBar && window.cropProgressText) {
                     window.cropProgressBar.style.width = simulatedProgress + '%';
                     window.cropProgressText.textContent = simulatedProgress + '%';
                 }
             } else {
                 clearInterval(progressInterval);
             }
         }, 10000); // Every 10 seconds
         
         // Store interval for cleanup
         window.cropProgressInterval = progressInterval;
        
        let croppedBlob;
         try {
             // Process video using canvas
             croppedBlob = await processSimpleCrop(recording.blob, { left, right, top, bottom });
             
             // Clear progress interval and remove progress indicator
             if (window.cropProgressInterval) {
                 clearInterval(window.cropProgressInterval);
                 window.cropProgressInterval = null;
             }
             if (progressDiv && progressDiv.parentNode) {
                 progressDiv.parentNode.removeChild(progressDiv);
             }
         } catch (error) {
             // Clear progress interval and remove progress indicator on error
             if (window.cropProgressInterval) {
                 clearInterval(window.cropProgressInterval);
                 window.cropProgressInterval = null;
             }
             if (progressDiv && progressDiv.parentNode) {
                 progressDiv.parentNode.removeChild(progressDiv);
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
        
        // Remove timeout - allow unlimited processing time
        // Processing will continue until completion regardless of duration
        
        video.onloadedmetadata = () => {
            try {
                const originalWidth = video.videoWidth;
                const originalHeight = video.videoHeight;
                
                // Calculate new dimensions
                const newWidth = originalWidth - left - right;
                const newHeight = originalHeight - top - bottom;
                
                if (newWidth <= 0 || newHeight <= 0) {
                    URL.revokeObjectURL(video.src);
                    reject(new Error('Invalid crop dimensions. Check your crop values.'));
                    return;
                }
                
                // Check if resulting video would be too large
                if (newWidth > 4000 || newHeight > 4000) {
                    URL.revokeObjectURL(video.src);
                    reject(new Error('Resulting video dimensions too large. Try smaller crop area.'));
                    return;
                }
                
                // Create canvas with optimized settings for MacBook performance
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { 
                    alpha: false,
                    desynchronized: true,  // Better performance on MacBook
                    powerPreference: 'high-performance',  // Use dedicated GPU if available
                    willReadFrequently: false  // Optimize for write operations
                });
                canvas.width = newWidth;
                canvas.height = newHeight;
                
                // Enable hardware acceleration hints
                ctx.imageSmoothingEnabled = false;  // Faster pixel-perfect copying
                ctx.imageSmoothingQuality = 'high';  // High quality when smoothing is needed
                
                // Set up MediaRecorder with optimized settings for faster processing
                const stream = canvas.captureStream(30); // Limited to 30fps for performance
                // Prefer VP8 for faster encoding over VP9 (better for MacBook performance)
                let mimeType = 'video/webm;codecs=vp8';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'video/webm;codecs=vp9';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = 'video/webm';
                    }
                }
                
                // Optimized settings for MacBook Chrome performance
                const recorder = new MediaRecorder(stream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: 8000000,  // 8 Mbps for high quality 1080p 30fps
                    // Hardware acceleration hints for better performance
                    videoKeyFrameIntervalDuration: 2000  // Keyframe every 2 seconds for faster seeking
                });
                
                const chunks = [];
                let frameCount = 0;
                
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };
                
                recorder.onstop = () => {
                     try {
                         // Clear the simulated progress interval
                         if (window.cropProgressInterval) {
                             clearInterval(window.cropProgressInterval);
                             window.cropProgressInterval = null;
                         }
                         
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
                     // Clear the simulated progress interval
                     if (window.cropProgressInterval) {
                         clearInterval(window.cropProgressInterval);
                         window.cropProgressInterval = null;
                     }
                     
                     URL.revokeObjectURL(video.src);
                     window.cropProgressBar = null;
                     window.cropProgressText = null;
                     reject(new Error('Recording failed: ' + (event.error?.message || 'Unknown error')));
                 };
                
                // Start recording with optimized data collection for MacBook
                recorder.start(250); // Collect data every 250ms for faster processing on MacBook
                
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
                             
                             // Optimized memory management for MacBook performance
                             if (frameCount % 300 === 0 && window.gc) {
                                 window.gc(); // More frequent garbage collection for better MacBook performance
                             }
                             
                             // Yield control to browser for smoother performance
                             if (frameCount % 60 === 0) {
                                 // Use setTimeout to yield control without blocking
                                 setTimeout(() => {}, 0);
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
        initializeCompilerTool();
        initializeDurationControls();
        initializeNotepad();
    } catch (error) {
        console.error('Initialization failed:', error);
    }
});

// Notepad functionality
function initializeNotepad() {
    const textarea = document.getElementById('notepad-textarea');
    const notepadSection = document.querySelector('.notepad-section');
    const notepadHeader = document.querySelector('.notepad-header');
    if (!textarea || !notepadSection || !notepadHeader) return;
    
    // Load saved notes from localStorage
    const savedNotes = localStorage.getItem('notepad-content');
    if (savedNotes) {
        textarea.value = savedNotes;
        autoResizeTextarea(textarea);
    }
    
    // Auto-resize textarea function
    function autoResizeTextarea(element) {
        element.style.height = 'auto';
        element.style.height = Math.max(120, element.scrollHeight) + 'px';
    }
    
    // Auto-save on input with debouncing and auto-resize
    let saveTimeout;
    textarea.addEventListener('input', function() {
        autoResizeTextarea(this);
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            localStorage.setItem('notepad-content', textarea.value);
        }, 500); // Save after 500ms of no typing
    });
    
    // Save on blur (when user clicks away)
    textarea.addEventListener('blur', function() {
        localStorage.setItem('notepad-content', textarea.value);
    });
    
    // Handle tab key for proper indentation
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            
            // Insert tab character
            this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);
            
            // Move cursor after the tab
            this.selectionStart = this.selectionEnd = start + 1;
            
            // Auto-resize and save
            autoResizeTextarea(this);
            localStorage.setItem('notepad-content', this.value);
        }
    });
    
    // Resize functionality is handled by CSS resize property
    // The notepad can now be resized by dragging the bottom-right corner
}

function clearNotepad() {
    const textarea = document.getElementById('notepad-textarea');
    const clearBtn = document.querySelector('.notepad-clear-btn');
    if (!textarea || !clearBtn) return;
    
    // Check if button is in confirmation state
    if (clearBtn.classList.contains('confirm-state')) {
        // Second click - actually clear
        textarea.value = '';
        localStorage.removeItem('notepad-content');
        
        // Reset textarea height to minimum
        textarea.style.height = '120px';
        
        // Reset button state
        clearBtn.classList.remove('confirm-state');
        clearBtn.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
            </svg>
            Clear
        `;
        
        // Show confirmation
        stateManager.showAlert('Notes cleared successfully', 'success');
        
        // Focus back to textarea
        textarea.focus();
    } else {
        // First click - show confirmation state
        if (textarea.value.trim()) {
            clearBtn.classList.add('confirm-state');
            clearBtn.innerHTML = `
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                </svg>
                Are you sure?
            `;
            
            // Reset to normal state after 3 seconds if not clicked
            setTimeout(() => {
                if (clearBtn.classList.contains('confirm-state')) {
                    clearBtn.classList.remove('confirm-state');
                    clearBtn.innerHTML = `
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                        </svg>
                        Clear
                    `;
                }
            }, 3000);
        }
    }
}

// Duration controls initialization and synchronization
function initializeDurationControls() {
    const slider = document.getElementById('duration-slider');
    const customInput = document.getElementById('custom-duration-input');
    const hiddenInput = document.getElementById('duration');
    
    // Set initial values
     updateSliderFromSeconds(300); // 5 minutes default
    
    // Slider change handler
    slider.addEventListener('input', function() {
        const seconds = parseInt(this.value);
        updateCustomInputFromSeconds(seconds);
        hiddenInput.value = seconds;
    });
    
    // Custom input change handler
    customInput.addEventListener('input', function() {
        const mmss = this.value;
        if (validateMMSS(mmss)) {
            const seconds = convertMMSSToSeconds(mmss);
            if (seconds <= 3600) { // Max 60 minutes
                updateSliderFromSeconds(seconds);
                hiddenInput.value = seconds;
                this.setCustomValidity('');
            } else {
                this.setCustomValidity('Duration cannot exceed 60:00');
            }
        } else if (mmss.length >= 4) {
            this.setCustomValidity('Please enter time in MM:SS format (e.g., 05:30)');
        } else {
            this.setCustomValidity('');
        }
    });
    
    // Custom input blur handler for final validation
    customInput.addEventListener('blur', function() {
        if (this.value && !validateMMSS(this.value)) {
            this.value = formatSecondsToMMSS(parseInt(hiddenInput.value));
        }
    });
}

function updateSliderFromSeconds(seconds) {
    const slider = document.getElementById('duration-slider');
    const customInput = document.getElementById('custom-duration-input');
    
    // Clamp to slider range (0-600 seconds = 0-10 minutes)
    const clampedSeconds = Math.max(0, Math.min(600, seconds));
    slider.value = clampedSeconds;
    
    // Update custom input
    customInput.value = formatSecondsToMMSS(seconds);
}

function updateCustomInputFromSeconds(seconds) {
    const customInput = document.getElementById('custom-duration-input');
    customInput.value = formatSecondsToMMSS(seconds);
}

function validateMMSS(mmss) {
    const regex = /^([0-5]?[0-9]):([0-5][0-9])$/;
    return regex.test(mmss);
}

function convertMMSSToSeconds(mmss) {
    const parts = mmss.split(':');
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    return (minutes * 60) + seconds;
}

function formatSecondsToMMSS(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Compiler Tool Functions
function toggleCompilerTool() {
    const content = document.getElementById('compiler-content');
    const arrow = document.getElementById('compiler-arrow');
    
    if (content.style.display === 'none' || !content.classList.contains('show')) {
        content.style.display = 'block';
        // Small delay to ensure display change takes effect before animation
        setTimeout(() => {
            content.classList.add('show');
            arrow.classList.add('expanded');
        }, 10);
        updateCompilerTable();
    } else {
        content.classList.remove('show');
        arrow.classList.remove('expanded');
        // Hide after animation completes
        setTimeout(() => {
            content.style.display = 'none';
        }, 400);
    }
}

function initializeCompilerTool() {
    populateTimeDropdown();
    updateCompilerTable();
    
    // Listen for time changes
    const timeDropdown = document.getElementById('upload-time');
    if (timeDropdown) {
        timeDropdown.addEventListener('change', updateCompilerTable);
    }
}

function populateTimeDropdown() {
    const timeDropdown = document.getElementById('upload-time');
    if (!timeDropdown) return;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Round to nearest 15-minute interval
    const roundedMinute = Math.round(currentMinute / 15) * 15;
    let defaultHour = currentHour;
    let defaultMinute = roundedMinute;
    
    if (defaultMinute >= 60) {
        defaultHour += 1;
        defaultMinute = 0;
    }
    
    const defaultTime = `${defaultHour.toString().padStart(2, '0')}:${defaultMinute.toString().padStart(2, '0')}`;
    
    // Generate time options in 15-minute intervals
    timeDropdown.innerHTML = '';
    
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const option = document.createElement('option');
            option.value = timeString;
            option.textContent = timeString;
            
            if (timeString === defaultTime) {
                option.selected = true;
            }
            
            timeDropdown.appendChild(option);
        }
    }
}

function getCurrentDate() {
    const now = new Date();
    // Use local date instead of UTC to avoid timezone issues
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // YYYY-MM-DD format
}

function getSelectedTimestamp() {
    const timeDropdown = document.getElementById('upload-time');
    const selectedTime = timeDropdown ? timeDropdown.value : '00:00';
    const currentDate = getCurrentDate();
    return `${currentDate}T${selectedTime}:00`; // ISO 8601 format
}

async function updateCompilerTable() {
    const tableBody = document.getElementById('compiler-table-body');
    if (!tableBody) return;
    
    try {
        const recordings = await stateManager.dbManager.getAllRecordings();
        
        if (recordings.length === 0) {
            tableBody.innerHTML = '<tr><td>No recordings available for compilation</td></tr>';
            return;
        }
        
        const timestamp = getSelectedTimestamp();
        
        tableBody.innerHTML = '';
        
        recordings.forEach(recording => {
            // Extract filename without extension
            const filenameWithoutExt = recording.filename.replace(/\.[^/.]+$/, '');
            
            // Generate upload command using actual filename
            const uploadCommand = `./upload.sh -n "${filenameWithoutExt}" -t "${timestamp}" "${recording.filename}"`;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="command-row">
                        <button class="copy-btn" onclick="copyToClipboard('${uploadCommand.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', this)"
                                title="Copy command to clipboard">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/>
                            </svg>
                        </button>
                        <span class="command-text" title="Click to select command">${uploadCommand}</span>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error updating compiler table:', error);
        tableBody.innerHTML = '<tr><td>Error loading recordings</td></tr>';
    }
}

// Copy to clipboard function
function copyToClipboard(text, buttonElement) {
    // Get the button element if not passed
    if (!buttonElement) {
        buttonElement = event.target.closest('.copy-btn');
    }
    
    const originalIcon = buttonElement.innerHTML;
    const checkIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>`;
    
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            // Show success feedback
            buttonElement.innerHTML = checkIcon;
            buttonElement.style.background = '#4caf50';
            buttonElement.style.borderColor = '#4caf50';
            
            setTimeout(() => {
                buttonElement.innerHTML = originalIcon;
                buttonElement.style.background = '';
                buttonElement.style.borderColor = '';
            }, 1500);
            
            stateManager.showAlert('Command copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Clipboard API failed:', err);
            fallbackCopy(text, buttonElement, originalIcon, checkIcon);
        });
    } else {
        // Use fallback for older browsers
        fallbackCopy(text, buttonElement, originalIcon, checkIcon);
    }
}

function fallbackCopy(text, buttonElement, originalIcon, checkIcon) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            // Show success feedback
            buttonElement.innerHTML = checkIcon;
            buttonElement.style.background = '#4caf50';
            buttonElement.style.borderColor = '#4caf50';
            
            setTimeout(() => {
                buttonElement.innerHTML = originalIcon;
                buttonElement.style.background = '';
                buttonElement.style.borderColor = '';
            }, 1500);
            
            stateManager.showAlert('Command copied to clipboard!', 'success');
        } else {
            throw new Error('Copy command failed');
        }
    } catch (fallbackErr) {
         console.error('Fallback copy failed:', fallbackErr);
         stateManager.showAlert('Failed to copy command. Please copy manually.', 'error');
     }
 }
 
 // Setup commands toggle function
 function toggleSetupCommands() {
     const content = document.getElementById('setup-commands-content');
     const arrow = document.getElementById('setup-arrow');
     
     if (content.style.display === 'none') {
         content.style.display = 'block';
         arrow.classList.add('expanded');
     } else {
         content.style.display = 'none';
         arrow.classList.remove('expanded');
     }
 }