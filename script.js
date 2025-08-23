// Extracted JavaScript from the previous inline script
// NOTE: This preserves behavior while keeping functions on the global scope

// === CONFIG AND UTILITIES ===
const CONFIG = {
  MAX_DURATION_MINUTES: 180,
  STATUS_UPDATE_INTERVAL_MS: 500,
  THUMBNAIL_INTERVAL_MS: 5000,
  AUTO_STOP_DEFAULT_MINUTES: 60,
};

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

// === STATE MANAGER ===
class RecordingStateManager {
  constructor() {
    this.screenRecordings = new Map();
    this.recordingCounter = 0;
    this.statusUpdateInterval = null;
    this.autoSaveEnabled = false;
    this.thumbnailCaptures = new Map();
    this.errorHandlers = [];

    this.cleanup = this.cleanup.bind(this);
    window.addEventListener('beforeunload', this.cleanup);

    this.loadUserPreferences();
    this.initializeEventListeners();
  }

  loadUserPreferences() {
    try {
      const pref = JSON.parse(localStorage.getItem('recordingPreferences') || '{}');
      if (pref.autoSaveEnabled) {
        this.autoSaveEnabled = true;
        const toggle = document.getElementById('auto-save');
        if (toggle) {
          toggle.checked = true;
        }
      }
    } catch (e) { /* ignore */ }
  }

  saveUserPreferences() {
    try {
      localStorage.setItem('recordingPreferences', JSON.stringify({ autoSaveEnabled: this.autoSaveEnabled }));
    } catch (e) { /* ignore */ }
  }

  initializeEventListeners() {
    const toggle = document.getElementById('auto-save');
    if (toggle) {
      toggle.addEventListener('change', (e) => this.handleAutoSaveToggle(e.target.checked));
    }
  }

  handleAutoSaveToggle(enabled) {
    this.autoSaveEnabled = enabled;
    this.saveUserPreferences();
    this.showAlert(`Auto-save ${enabled ? 'enabled' : 'disabled'}`, 'success');
  }

  registerErrorHandler(handler) {
    this.errorHandlers.push(handler);
  }

  cleanup() {
    // Stop all active recordings on unload
    try { stopAllRecordings(); } catch (e) { /* ignore */ }
  }

  showAlert(message, type = 'success') {
    const container = document.getElementById('alerts');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `alert ${type === 'error' ? 'alert-error' : 'alert-success'}`;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3500);
  }
}

const stateManager = new RecordingStateManager();

// === THUMBNAIL CAPTURE ENGINE ===
function ThumbnailCaptureEngine() {}
ThumbnailCaptureEngine.prototype.capture = async function(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 360;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
};
ThumbnailCaptureEngine.prototype.captureFinalThumbnail = async function(videoEl) {
  return this.capture(videoEl);
};

// === DOM HELPERS ===
function $(id) { return document.getElementById(id); }

function updateStatusDisplay() {
  const total = document.querySelectorAll('.recording-status-item.recording').length;
  const overall = $('overall-status');
  if (overall) {
    overall.textContent = total > 0 ? `${total} recording${total > 1 ? 's' : ''} in progress` : 'No active recordings';
    overall.classList.toggle('recording-active', total > 0);
  }
}

function startStatusUpdates() {
  if (stateManager.statusUpdateInterval) return;
  stateManager.statusUpdateInterval = setInterval(updateStatusDisplay, CONFIG.STATUS_UPDATE_INTERVAL_MS);
}

function stopStatusUpdates() {
  if (stateManager.statusUpdateInterval) {
    clearInterval(stateManager.statusUpdateInterval);
    stateManager.statusUpdateInterval = null;
  }
}

// === RECORDING CORE ===
function getMimeTypeForFormat(format) {
  const candidates = {
    webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
    mp4: ['video/mp4;codecs=h264,aac', 'video/mp4'],
  }[format] || ['video/webm'];
  return candidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
}

function getVideoConstraints() {
  const resolution = $('video-quality')?.value || '1280x720';
  const [w, h] = resolution.split('x').map(Number);
  return { width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30, max: 60 } };
}

function extractTabTitleFromTrack(track) {
  try { return track.label || 'Shared tab'; } catch { return 'Shared tab'; }
}

async function addScreenRecording() {
  // Exclude current tab to skip the pre-prompt and go straight to tab picker
  const videoConstraints = getVideoConstraints();
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        ...videoConstraints,
        displaySurface: 'browser',
        selfBrowserSurface: 'exclude'  // This prevents the current tab pre-prompt
      },
      audio: true
    });
  } catch (e) {
    stateManager.showAlert('Screen capture was not granted', 'error');
    return;
  }

  // Build UI card
  const id = ++stateManager.recordingCounter;
  const container = document.createElement('div');
  container.className = 'recording-status-item recording';
  container.id = `recording-${id}`;

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

  const actions = document.createElement('div');
  const stopBtn = document.createElement('button');
  stopBtn.className = 'remove-btn';
  stopBtn.textContent = 'Stop';
  stopBtn.onclick = () => stopScreenRecording(id);
  actions.appendChild(stopBtn);

  container.appendChild(info);
  container.appendChild(actions);
  $('individual-statuses')?.appendChild(container);

  // Preview
  const previewContainer = document.createElement('div');
  previewContainer.className = 'recording-preview-container';
  const videoEl = document.createElement('video');
  videoEl.className = 'preview-video';
  videoEl.muted = true;
  videoEl.srcObject = stream;
  videoEl.autoplay = true;
  previewContainer.appendChild(videoEl);
  $('recordings-preview')?.appendChild(previewContainer);

  // Start recording
  startStatusUpdates();
  const format = $('video-format')?.value || 'webm';
  const mimeType = getMimeTypeForFormat(format);

  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
    await saveScreenRecording(id, blob, { name: name.textContent, format });
  };
  recorder.start(1000);

  // Store state
  stateManager.screenRecordings.set(id, { id, stream, recorder, startTime: Date.now(), detailsEl: details, videoEl, name: name.textContent, format, chunks });

  // Update timer
  const timer = setInterval(() => {
    const rec = stateManager.screenRecordings.get(id);
    if (!rec) { clearInterval(timer); return; }
    const elapsed = Math.floor((Date.now() - rec.startTime) / 1000);
    rec.detailsEl.textContent = `Recording... ${formatTime(elapsed)}`;
  }, 1000);

  // Stop when track ends (user stops sharing)
  track.addEventListener('ended', () => stopScreenRecording(id));
}

function stopScreenRecording(id) {
  const rec = stateManager.screenRecordings.get(id);
  if (!rec) return;
  try { rec.recorder.stop(); } catch {}
  rec.stream.getTracks().forEach(t => { try { t.stop(); } catch {} });
  stateManager.screenRecordings.delete(id);
  updateStatusDisplay();
}

function stopAllRecordings() {
  [...stateManager.screenRecordings.keys()].forEach(id => stopScreenRecording(id));
}

async function saveScreenRecording(id, blob, meta) {
  const url = URL.createObjectURL(blob);

  // Saved list UI
  const item = document.createElement('div');
  item.className = 'recording-item';
  const left = document.createElement('div');
  left.innerHTML = `<div class="recording-name">${meta.name} (${meta.format.toUpperCase()})</div>`;
  const right = document.createElement('div');

  const dlBtn = document.createElement('button');
  dlBtn.className = 'download-btn';
  dlBtn.textContent = 'Download';
  dlBtn.onclick = () => downloadRecording(url, meta);
  right.appendChild(dlBtn);

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn remove-btn';
  delBtn.textContent = 'Delete';
  delBtn.onclick = () => { item.remove(); URL.revokeObjectURL(url); };
  right.appendChild(delBtn);

  item.appendChild(left);
  item.appendChild(right);
  $('recordings-list')?.appendChild(item);

  // Auto download when auto-save on
  if (stateManager.autoSaveEnabled) {
    downloadRecording(url, meta);
  }
}

function downloadRecording(url, meta) {
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `${meta.name || 'Recording'}_${ts}.${meta.format || 'webm'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function clearAllSavedRecordings() {
  $('recordings-list').innerHTML = '';
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  updateStatusDisplay();
});