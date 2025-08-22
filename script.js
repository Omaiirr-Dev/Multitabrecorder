/*
 * ========================================
 * MULTI-SCREEN RECORDER - JAVASCRIPT
 * ========================================
 * 
 * This JavaScript file handles all the functionality for our screen recording app.
 * It manages recording state, user interface updates, file saving, and browser APIs.
 * The code is organized into logical sections for easy maintenance.
 */

// === CONFIGURATION === 
// Central place for all app settings - easy to tweak without hunting through code
const CONFIG = {
  MAX_DURATION_MINUTES: 180,        // 3 hours max recording time
  STATUS_UPDATE_INTERVAL_MS: 500,   // How often to update the UI (twice per second)
  THUMBNAIL_INTERVAL_MS: 5000,      // Capture thumbnails every 5 seconds
  AUTO_STOP_DEFAULT_MINUTES: 60,    // Default auto-stop time
};

// === UTILITY FUNCTIONS ===
// Helper function to format seconds into MM:SS format for display
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

// === STATE MANAGEMENT ===
// This class keeps track of everything happening in our app
// Think of it as the "brain" that remembers what's going on
class RecordingStateManager {
  constructor() {
    // Map to store all active recordings (key = recording ID, value = recording data)
    this.screenRecordings = new Map();
    
    // Counter to give each recording a unique ID
    this.recordingCounter = 0;
    
    // Timer for updating the UI regularly
    this.statusUpdateInterval = null;
    
    // Whether to automatically download recordings when they finish
    this.autoSaveEnabled = false;
    
    // Map to store thumbnail capture data for each recording
    this.thumbnailCaptures = new Map();
    
    // Array to store error handling functions
    this.errorHandlers = [];

    // Bind cleanup function so it works properly when called from events
    this.cleanup = this.cleanup.bind(this);
    
    // Clean up when user closes the page
    window.addEventListener('beforeunload', this.cleanup);

    // Load user's saved preferences and set up event listeners
    this.loadUserPreferences();
    this.initializeEventListeners();
  }

  // Load user preferences from browser storage
  // This remembers their settings between sessions
  loadUserPreferences() {
    try {
      const pref = JSON.parse(localStorage.getItem('recordingPreferences') || '{}');
      if (pref.autoSaveEnabled) {
        this.autoSaveEnabled = true;
        // Update the toggle switch to match saved preference
        const toggle = document.getElementById('auto-save');
        if (toggle) {
          toggle.checked = true;
        }
      }
    } catch (e) { 
      // If something goes wrong loading preferences, just ignore it
      // Better to have default settings than crash the app
    }
  }

  // Save current preferences to browser storage
  saveUserPreferences() {
    try {
      localStorage.setItem('recordingPreferences', JSON.stringify({ 
        autoSaveEnabled: this.autoSaveEnabled 
      }));
    } catch (e) { 
      // Storage might be full or disabled, but don't crash over it
    }
  }

  // Set up event listeners for user interface elements
  initializeEventListeners() {
    const toggle = document.getElementById('auto-save');
    if (toggle) {
      // When user toggles auto-save, update our state and save the preference
      toggle.addEventListener('change', (e) => this.handleAutoSaveToggle(e.target.checked));
    }
  }

  // Handle when user toggles the auto-save setting
  handleAutoSaveToggle(enabled) {
    this.autoSaveEnabled = enabled;
    this.saveUserPreferences();
    // Show a friendly message to confirm the change
    this.showAlert(`Auto-save ${enabled ? 'enabled' : 'disabled'}`, 'success');
  }

  // Register a function to handle errors (for extensibility)
  registerErrorHandler(handler) {
    this.errorHandlers.push(handler);
  }

  // Clean up all active recordings when the page is closing
  // This prevents browser warnings about ongoing media capture
  cleanup() {
    try { 
      stopAllRecordings(); 
    } catch (e) { 
      // If cleanup fails, don't crash - just log it
      console.warn('Cleanup failed:', e);
    }
  }

  // Show a popup message to the user
  // type can be 'success' or 'error' for different styling
  showAlert(message, type = 'success') {
    // Create a popup notification element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    // Add it to the page
    document.body.appendChild(alert);
    
    // Remove it after 3 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 3000);
  }
}

// === RECORDING CORE FUNCTIONS ===

// Figure out what video format the browser can actually record
// Different browsers support different formats, so we try the best ones first
function getMimeTypeForFormat(format) {
  const candidates = {
    webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
    mp4: ['video/mp4;codecs=h264,aac', 'video/mp4'],
  }[format] || ['video/webm'];
  
  // Return the first format the browser says it can handle
  return candidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
}

// Set up video quality constraints based on user's slider selection
function getVideoConstraints() {
  const resolution = $('video-quality')?.value || '1280x720';
  const [w, h] = resolution.split('x').map(Number);
  return { 
    width: { ideal: w }, 
    height: { ideal: h }, 
    frameRate: { ideal: 30, max: 60 }  // Smooth video with good performance
  };
}

// Extract a friendly name from the browser's track label
// Sometimes the browser tells us what tab/window is being shared
function extractTabTitleFromTrack(track) {
  try { 
    return track.label || 'Shared tab'; 
  } catch { 
    return 'Shared tab'; 
  }
}

// === MAIN RECORDING FUNCTION ===
// This is the heart of the app - starts a new screen recording
async function addScreenRecording() {
  // Get video quality settings from the slider
  const videoConstraints = getVideoConstraints();
  let stream;
  
  try {
    // Ask the browser to capture the screen
    // We exclude the current tab to avoid the "record this tab?" prompt
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        ...videoConstraints,
        displaySurface: 'browser',        // Prefer browser tabs
        selfBrowserSurface: 'exclude'     // Skip the current tab prompt
      },
      audio: true  // Also capture audio if available
    });
  } catch (e) {
    // User probably cancelled or browser doesn't support screen capture
    stateManager.showAlert('Screen capture was not granted', 'error');
    return;
  }

  // Create a unique ID for this recording
  const id = ++stateManager.recordingCounter;
  
  // Build the UI card that shows this recording is active
  const container = document.createElement('div');
  container.className = 'recording-status-item recording';
  container.id = `recording-${id}`;

  // Create the info section (title and status)
  const info = document.createElement('div');
  info.className = 'recording-info';
  const name = document.createElement('div');
  name.className = 'recording-name';
  const track = stream.getVideoTracks()[0];
  name.textContent = extractTabTitleFromTrack(track);
  const details = document.createElement('div');
  details.className = 'recording-details';
  details.textContent = 'Recording... 00:00';
  info.appendChild(name);
  info.appendChild(details);

  // Create the stop button
  const actions = document.createElement('div');
  const stopBtn = document.createElement('button');
  stopBtn.className = 'remove-btn';
  stopBtn.textContent = 'Stop';
  stopBtn.onclick = () => stopScreenRecording(id);
  actions.appendChild(stopBtn);

  // Put it all together and add to the page
  container.appendChild(info);
  container.appendChild(actions);
  $('recordings-preview')?.appendChild(container);

  // Set up the actual recording using MediaRecorder API
  const format = $('video-format')?.value || 'webm';
  const mimeType = getMimeTypeForFormat(format);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];  // Will store the recorded video data

  // When the recorder has data ready, store it
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // When recording stops, save the file
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType });
    const meta = {
      name: extractTabTitleFromTrack(track),
      format: format,
      timestamp: new Date().toISOString()
    };
    saveScreenRecording(id, blob, meta);
    
    // Clean up the UI
    container.remove();
    stateManager.screenRecordings.delete(id);
    updateStatusDisplay();
  };

  // Start recording!
  recorder.start(1000);  // Collect data every second
  
  // Store the recording info so we can manage it later
  stateManager.screenRecordings.set(id, {
    recorder,
    stream,
    startTime: Date.now(),
    container
  });

  // Update the UI to show we're recording
  updateStatusDisplay();
  stateManager.showAlert('Recording started!', 'success');
}

// === RECORDING MANAGEMENT ===

// Stop a specific recording by its ID
function stopScreenRecording(id) {
  const rec = stateManager.screenRecordings.get(id);
  if (!rec) return;
  
  // Stop the recorder and all media tracks
  try { rec.recorder.stop(); } catch {}
  rec.stream.getTracks().forEach(t => { 
    try { t.stop(); } catch {} 
  });
  
  // Remove from our tracking
  stateManager.screenRecordings.delete(id);
  updateStatusDisplay();
}

// Stop all active recordings at once
function stopAllRecordings() {
  [...stateManager.screenRecordings.keys()].forEach(id => stopScreenRecording(id));
}

// === FILE MANAGEMENT ===

// Save a completed recording and add it to the saved list
async function saveScreenRecording(id, blob, meta) {
  const url = URL.createObjectURL(blob);

  // Create UI element for the saved recording list
  const item = document.createElement('div');
  item.className = 'recording-item';
  const left = document.createElement('div');
  left.innerHTML = `<div class="recording-name">${meta.name} (${meta.format.toUpperCase()})</div>`;
  const right = document.createElement('div');

  // Download button
  const dlBtn = document.createElement('button');
  dlBtn.className = 'download-btn';
  dlBtn.textContent = 'Download';
  dlBtn.onclick = () => downloadRecording(url, meta);
  right.appendChild(dlBtn);

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn remove-btn';
  delBtn.textContent = 'Delete';
  delBtn.onclick = () => { 
    item.remove(); 
    URL.revokeObjectURL(url);  // Free up memory
  };
  right.appendChild(delBtn);

  // Add to the saved recordings list
  item.appendChild(left);
  item.appendChild(right);
  $('recordings-list')?.appendChild(item);

  // If auto-save is enabled, automatically download the file
  if (stateManager.autoSaveEnabled) {
    downloadRecording(url, meta);
  }
}

// Download a recording file to the user's computer
function downloadRecording(url, meta) {
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');  // Safe filename timestamp
  a.href = url;
  a.download = `${meta.name || 'Recording'}_${ts}.${meta.format || 'webm'}`;
  document.body.appendChild(a);
  a.click();  // Trigger the download
  a.remove();  // Clean up
}

// Clear all saved recordings from the list
function clearAllSavedRecordings() {
  $('recordings-list').innerHTML = '';
}

// === UI HELPER FUNCTIONS ===

// Shorthand for document.getElementById - saves typing!
function $(id) {
  return document.getElementById(id);
}

// Update the status display to show current recording info
function updateStatusDisplay() {
  const count = stateManager.screenRecordings.size;
  const status = $('overall-status');
  
  if (count === 0) {
    status.textContent = 'Ready to record';
    status.classList.remove('recording-active');
  } else {
    status.textContent = `Recording ${count} screen${count > 1 ? 's' : ''}...`;
    status.classList.add('recording-active');
  }
}

// === INITIALIZATION ===
// Set up the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Create our global state manager
  window.stateManager = new RecordingStateManager();
  
  // Initialize the UI
  updateStatusDisplay();
});

/*
 * That's it! The app is now ready to record screens.
 * 
 * Key concepts:
 * - We use the MediaRecorder API to capture video/audio
 * - getDisplayMedia() asks the browser to share a screen/tab
 * - We store active recordings in a Map for easy management
 * - The UI updates in real-time to show recording status
 * - Files are saved as Blobs and can be downloaded
 * - Everything is cleaned up properly to avoid memory leaks
 */