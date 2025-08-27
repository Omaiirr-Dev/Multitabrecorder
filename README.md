# Omairs Multi-Tab Recorder

## 🎬 Complete Feature Documentation & Technical Guide

### Table of Contents
1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Technical Architecture](#technical-architecture)
4. [User Interface Components](#user-interface-components)
5. [Recording System](#recording-system)
6. [Video Processing](#video-processing)
7. [Storage Management](#storage-management)
8. [Quality Control](#quality-control)
9. [File Management](#file-management)
10. [Cropping System](#cropping-system)
11. [Compiler Tool](#compiler-tool)
12. [Visual Workflows](#visual-workflows)
13. [Browser Compatibility](#browser-compatibility)
14. [Performance Optimizations](#performance-optimizations)
15. [Error Handling](#error-handling)

---

## Overview

**Omairs Multi-Tab Recorder** is a sophisticated web-based screen recording application that enables users to capture, process, and manage multiple screen recordings simultaneously. Built with modern web technologies, it provides a comprehensive solution for screen recording with advanced features like real-time cropping, quality control, and intelligent file management.

### Key Capabilities
- **Multi-tab Recording**: Record multiple browser tabs or applications simultaneously
- **Real-time Processing**: Live thumbnail generation and progress tracking
- **Advanced Cropping**: Canvas-based video cropping with drag-and-drop interface
- **Quality Management**: Multiple quality presets from 480p to 4K
- **Smart Storage**: 1GB local storage with intelligent usage tracking
- **File Organization**: Automated naming, duplicate detection, and ID management
- **Terminal Integration**: Command generation for external processing

---

## Core Features

### 1. Screen Recording Engine

#### **What It Does**
Captures screen content from selected browser tabs or applications with configurable quality settings and duration controls.

#### **How It Works**
```javascript
// Core recording initialization
const stream = await navigator.mediaDevices.getDisplayMedia({
    video: constraints.video,
    audio: true
});

const mediaRecorder = new MediaRecorder(stream, options);
```

#### **Technical Implementation**
- **API Used**: `MediaDevices.getDisplayMedia()` for screen capture
- **Recording Format**: WebM with VP9/VP8 codec fallbacks
- **Audio Capture**: Simultaneous system audio recording
- **Frame Rate**: Configurable up to 60fps for smooth playback

#### **Process Flow**
```
User Click → Permission Request → Stream Capture → MediaRecorder Setup → Recording Start
     ↓
Data Collection → Thumbnail Generation → Progress Updates → Auto-stop Timer
     ↓
Recording Complete → Blob Creation → Storage Processing → UI Update
```

### 2. Duration Control System

#### **What It Does**
Provides flexible recording duration control through both slider interface and custom time input.

#### **Visual Interface**
```
[Recording Duration:]
[●────────────────○] 5:00    [Custom: MM:SS]
 0:00  2:30  5:00  7:30  10:00
```

#### **Technical Logic**
```javascript
// Slider synchronization
slider.addEventListener('input', function() {
    const seconds = parseInt(this.value);
    updateCustomInputFromSeconds(seconds);
    hiddenInput.value = seconds;
});

// Custom input validation
function validateMMSS(mmss) {
    const regex = /^([0-5]?[0-9]):([0-5][0-9])$/;
    return regex.test(mmss);
}
```

#### **Features**
- **30-second intervals**: Precise control with step increments
- **0-10 minute range**: Covers most recording scenarios
- **Real-time sync**: Bidirectional updates between controls
- **Format validation**: MM:SS input with error checking

### 3. Quality Management System

#### **What It Does**
Offers multiple video quality presets optimized for different use cases and file size requirements.

#### **Quality Presets**
```javascript
const qualityMap = {
    0: '4k',     // 3840x2160 - Ultra high quality
    1: '1440p',  // 2560x1440 - High quality
    2: '1080p',  // 1920x1080 - Full HD (default)
    3: '720p',   // 1280x720  - Standard HD
    4: '480p'    // 854x480   - Compact size
};
```

#### **Visual Indicator**
```
[Video Quality:]
[●────○────────────] 720p HD
 4K  1440p 1080p 720p 480p
```

#### **Technical Implementation**
- **Default Setting**: 720p HD for optimal balance
- **Orange Theme**: Consistent UI styling with hover effects
- **Dynamic Constraints**: Automatic resolution adjustment
- **Warning System**: 4K usage alerts for file size awareness

### 4. Multi-Recording Management

#### **What It Does**
Enables simultaneous recording of multiple sources with individual control and monitoring.

#### **Recording State Tracking**
```javascript
class RecordingStateManager {
    constructor() {
        this.screenRecordings = new Map();  // Active recordings
        this.recordingCounter = 0;          // Unique ID generator
        this.thumbnailCaptures = new Map(); // Screenshot data
    }
}
```

#### **Visual Layout**
```
┌─────────────────────────────────────────┐
│ Active Screen Recordings                │
├─────────────────────────────────────────┤
│ [●REC] Site Name [00:05] [■Stop]       │
│ [●REC] Site Name [00:12] [■Stop]       │
│ [●REC] Site Name [00:08] [■Stop]       │
└─────────────────────────────────────────┘
```

#### **Features**
- **Live Preview**: Real-time video feed for each recording
- **Individual Controls**: Stop button for each recording
- **Progress Tracking**: Elapsed time and remaining duration
- **Filename Editing**: Real-time renaming during recording

---

## Technical Architecture

### 1. Core Classes

#### **RecordingStateManager**
```javascript
class RecordingStateManager {
    // Manages all recording states and operations
    initializeEventListeners()     // Setup event handlers
    initializeQualitySlider()      // Configure quality controls
    showAlert(message, type)       // User notifications
    cleanup()                      // Resource cleanup
}
```

#### **IndexedDBManager**
```javascript
class IndexedDBManager {
    // Handles local storage operations
    initDB()                       // Database initialization
    saveRecording(recording)       // Store recording data
    getAllRecordings()             // Retrieve all recordings
    deleteRecording(id)            // Remove specific recording
    getStorageUsage()              // Calculate storage usage
}
```

#### **ThumbnailCaptureEngine**
```javascript
class ThumbnailCaptureEngine {
    // Generates real-time thumbnails
    initializeThumbnailCapture()   // Setup capture system
    captureFrame()                 // Generate thumbnail
    captureFinalThumbnail()        // Final screenshot
    stopCapture()                  // Cleanup resources
}
```

### 2. Data Flow Architecture

```
User Interface
      ↓
State Manager ← → IndexedDB Manager
      ↓                    ↓
MediaRecorder API    Storage System
      ↓                    ↓
Thumbnail Engine → Blob Processing
      ↓                    ↓
Canvas Processing → File Management
```

### 3. Storage Structure

#### **Recording Data Format**
```javascript
const recordingData = {
    id: uniqueId,                    // Unique identifier
    filename: "site_1_720p.webm",   // Generated filename
    data: base64EncodedVideo,        // Video blob data
    size: fileSizeInBytes,           // File size
    timestamp: isoDateString,        // Creation time
    duration: durationInSeconds,     // Recording length
    format: "webm",                 // Video format
    quality: "720p",                // Quality setting
    screenshot: base64Thumbnail,     // Preview image
    isEdited: false                  // Modification flag
};
```

---

## User Interface Components

### 1. Main Control Panel

#### **Layout Structure**
```
┌─────────────────────────────────────────┐
│ Omairs Multi-Tab Recorder               │
├─────────────────────────────────────────┤
│ Screen Recording Controls               │
│ ┌─────────────────────────────────────┐ │
│ │ Duration: [●──────○] 5:00 [05:30]  │ │
│ │ Format:   [WebM ▼]                 │ │
│ │ Quality:  [●──○────] 720p HD       │ │
│ │ [Share Screen & Record] [Stop All] │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### **Component Breakdown**
- **Duration Slider**: 200px width, orange theme, tick marks
- **Format Dropdown**: WebM, MP4, MKV, AVI options
- **Quality Slider**: 5-step range with visual labels
- **Action Buttons**: Primary (green) and danger (red) styling

### 2. What's New Panel

#### **Visual Design**
```
[What's New ▼]
┌─────────────────────────────────────────┐
│ Latest Updates                          │
├─────────────────────────────────────────┤
│ • File terminal management system       │
│   Enhanced file handling and commands   │
│ • Added cropping functionality          │
│   Processing time varies by hardware    │
│ • Updated recording status display      │
│   Now shows site names for management  │
│ • Enhanced search functionality         │
│   ID inputs with duplicate detection    │
└─────────────────────────────────────────┘
```

#### **Features**
- **No Version Numbers**: Clean, timeless appearance
- **Bullet Points**: Simple, emoji-free design
- **Collapsible**: Smooth animation with arrow rotation
- **Gradient Button**: Orange theme with hover effects

### 3. Recording Status Display

#### **Active Recording View**
```
┌─────────────────────────────────────────┐
│ [●REC] example.com                     │
│ Site name: [editable_field____] .webm  │
│ 00:05 elapsed | 29:55 remaining        │
│ [Live Preview Video] [■ Stop]          │
└─────────────────────────────────────────┘
```

#### **Technical Implementation**
- **Real-time Updates**: 1-second interval refresh
- **Live Preview**: Direct stream display
- **Editable Fields**: Instant filename modification
- **Progress Indicators**: Animated recording dot

---

## Recording System

### 1. Stream Capture Process

#### **Permission Flow**
```
User Click → Browser Permission → Source Selection → Stream Creation
     ↓              ↓                    ↓              ↓
  Button UI    Permission Dialog    Screen Picker    MediaStream
```

#### **Technical Implementation**
```javascript
// Stream acquisition with error handling
try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 60, max: 60 },
            cursor: 'always'
        },
        audio: true
    });
} catch (error) {
    // Handle permission denial or API unavailability
}
```

### 2. MediaRecorder Configuration

#### **Codec Selection Logic**
```javascript
// Codec priority with fallbacks
switch(selectedFormat) {
    case 'webm':
        options.mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm;codecs=vp8,opus';
        }
        break;
    // Additional format handling...
}
```

#### **Data Collection Strategy**
```javascript
mediaRecorder.ondataavailable = function(event) {
    if (event.data.size > 0) {
        recordedChunks.push(event.data);
    }
};

// Collect data every second for responsive UI
mediaRecorder.start(1000);
```

### 3. Thumbnail Generation System

#### **Real-time Capture Process**
```javascript
class ThumbnailCaptureEngine {
    async initializeThumbnailCapture(stream, recordingId) {
        // Create hidden video element
        const video = document.createElement('video');
        video.srcObject = stream;
        
        // Setup canvas for frame capture
        this.canvas.width = CONFIG.THUMBNAIL_DIMENSIONS.WIDTH;
        this.canvas.height = CONFIG.THUMBNAIL_DIMENSIONS.HEIGHT;
        
        // Start capture loop
        this.startCaptureLoop(video, recordingId);
    }
}
```

#### **Capture Timing Logic**
```
Frame Capture Every 2-6 Seconds
        ↓
Canvas Rendering (160x90)
        ↓
Base64 Encoding
        ↓
Storage in Memory
        ↓
Final Thumbnail on Stop
```

---

## Video Processing

### 1. Cropping System Architecture

#### **Modal Interface**
```
┌─────────────────────────────────────────┐
│ Crop Video                          [×] │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │        Video Display Area           │ │
│ │     ┌─────────────────┐             │ │
│ │     │ Crop Selection  │             │ │
│ │     │     Area        │             │ │
│ │     └─────────────────┘             │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ ⟳ Cropping Video [▓▓▓▓▓░░░░░] 50%      │
│ Drag your mouse to select the area     │
├─────────────────────────────────────────┤
│              [Save] [Cancel]            │
└─────────────────────────────────────────┘
```

#### **Drag Selection Logic**
```javascript
function setupCropDragging() {
    overlay.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    // Calculate selection rectangle
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
}
```

### 2. Canvas-Based Processing

#### **Crop Processing Pipeline**
```
Video Blob → Canvas Setup → Frame Rendering → MediaRecorder → Output Blob
     ↓            ↓              ↓               ↓            ↓
  Input File   Crop Coords   Real-time Draw   Re-encoding   Final File
```

#### **Technical Implementation**
```javascript
async function processSimpleCrop(videoBlob, cropParams) {
    const { left, right, top, bottom } = cropParams;
    
    // Calculate new dimensions
    const newWidth = originalWidth - left - right;
    const newHeight = originalHeight - top - bottom;
    
    // Setup canvas with new dimensions
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    // Create recording stream
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream);
}
```

### 3. Progress Tracking System

#### **Smart Progress Logic**
```javascript
// Simulated progress for user feedback
let simulatedProgress = 0;
const progressInterval = setInterval(() => {
    if (simulatedProgress < 80) {
        simulatedProgress += 10;  // 10% every 10 seconds
        updateProgressBar(simulatedProgress + '%');
    } else {
        clearInterval(progressInterval);  // Wait for real completion
    }
}, 10000);
```

#### **Visual Progress Display**
```
⟳ Cropping Video
[▓▓▓▓▓▓▓▓░░] 80%

Progress Timeline:
0-10s:  0% → 10%
10-20s: 10% → 20%
...
70-80s: 70% → 80%
80s+:   Wait for completion → 100%
```

---

## Storage Management

### 1. IndexedDB Implementation

#### **Database Schema**
```javascript
const dbSchema = {
    name: 'WebRecorderDB',
    version: 1,
    stores: {
        recordings: {
            keyPath: 'id',
            autoIncrement: true,
            indexes: {
                timestamp: 'timestamp',
                filename: 'filename',
                size: 'size'
            }
        }
    }
};
```

#### **Storage Operations**
```javascript
class IndexedDBManager {
    async saveRecording(recording) {
        const transaction = this.db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        return store.add(recording);
    }
    
    async getStorageUsage() {
        const recordings = await this.getAllRecordings();
        return recordings.reduce((total, rec) => total + (rec.size || 0), 0);
    }
}
```

### 2. Storage Quota Management

#### **Capacity Monitoring**
```
Storage Limit: 1024MB (1GB)
Current Usage: [▓▓▓░░░░░░░] 256MB/1024MB

Capacity Breakdown:
- Standard recordings: ~200-250 videos
- High-quality recordings: ~50-75 videos  
- 4K recordings: ~20-30 videos
```

#### **Usage Calculation Logic**
```javascript
async function checkStorageUsage() {
    const currentUsage = await stateManager.dbManager.getStorageUsage();
    const newSize = blob.size;
    const totalSize = currentUsage + newSize;
    const maxSize = 1024 * 1024 * 1024; // 1GB
    
    if (totalSize > maxSize) {
        const usageMB = (currentUsage / (1024 * 1024)).toFixed(1);
        showAlert(`Storage limit reached! Current: ${usageMB}MB`);
        return false;
    }
    return true;
}
```

### 3. File Naming System

#### **Automatic Naming Logic**
```javascript
// Naming convention: site_count_quality.format
const cleanTabTitle = tabTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
const filename = `${cleanTabTitle}_${sameTabCount}_${selectedQuality}.${selectedFormat}`;

// Example outputs:
// "youtube_1_720p.webm"
// "github_2_1080p.webm"
// "stackoverflow_1_480p.webm"
```

#### **Duplicate Detection**
```javascript
async function checkForDuplicateId(newId, format) {
    const recordings = await getAllRecordings();
    const existingIds = recordings.map(r => 
        r.filename.replace(/\.[^.]+$/, '') // Remove extension
    );
    
    if (existingIds.includes(newId)) {
        return `${newId}Copy.${format}`; // Add Copy suffix
    }
    return `${newId}.${format}`;
}
```

---

## File Management

### 1. Recording List Interface

#### **List Layout**
```
┌─────────────────────────────────────────┐
│ Storage Usage: 256.5/1024 MB (12 recordings) │
├─────────────────────────────────────────┤
│ [📹] youtube_1_720p.webm           [Crop] │
│      15.2 MB • 02:30 • 2025-01-15  [Download] │
│      ID: [1234____] [Rename] [Delete]   │
├─────────────────────────────────────────┤
│ [📹] github_2_1080p.webm    [EDITED] [Crop] │
│      28.7 MB • 05:15 • 2025-01-15  [Download] │
│      ID: [5678____] [Rename] [Delete]   │
└─────────────────────────────────────────┘
```

#### **Individual Recording Controls**
```javascript
// Per-recording ID management
function updateRecordingId(recordingId, newId) {
    // Validate and update ID
    // Check for duplicates
    // Update database
    // Refresh UI
    // Update compiler table
}

// Real-time filename editing
function updateRecordingFilename(recordingId, newFilename) {
    // Validate filename
    // Update recording data
    // Sync with storage
    // Update displays
}
```

### 2. Download System

#### **Download Process**
```
User Click → Blob Retrieval → URL Creation → Download Trigger → Cleanup
     ↓            ↓              ↓              ↓            ↓
  Button UI   Database Query   Object URL    Browser DL   Memory Free
```

#### **Implementation**
```javascript
function downloadRecording(recordingId) {
    const recording = getRecordingById(recordingId);
    const blob = new Blob([recording.data], { type: recording.mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = recording.filename;
    a.click();
    
    URL.revokeObjectURL(url); // Cleanup
}
```

### 3. Bulk Operations

#### **Delete All Functionality**
```javascript
async function clearAllSavedRecordings() {
    if (confirm('Delete all recordings? This cannot be undone.')) {
        await stateManager.dbManager.clearAllRecordings();
        await loadSavedRecordings();        // Refresh UI
        updateCompilerTable();              // Update compiler
        showAlert('All recordings deleted');
    }
}
```

---

## Compiler Tool

### 1. Command Generation System

#### **Table Interface**
```
┌─────────────────────────────────────────┐
│ Formatted commands for terminal         │
│ ⚠️ Ensure all files are correctly named │
├─────────────────────────────────────────┤
│ Match slot time: [10:30 ▼]             │
├─────────────────────────────────────────┤
│ Filename        │ ID   │ Command        │
├─────────────────┼──────┼────────────────┤
│ video1.webm     │ 1234 │ ffmpeg -i...   │
│ video2.webm     │ 5678 │ ffmpeg -i...   │
└─────────────────────────────────────────┘
```

#### **Command Template Logic**
```javascript
function generateFFmpegCommand(filename, id, timeSlot) {
    return `ffmpeg -i "${filename}" -ss ${timeSlot} -t 00:02:00 -c copy "output_${id}.mp4"`;
}

// Real-time table updates
function updateCompilerTable() {
    const recordings = getAllRecordings();
    const tableBody = document.getElementById('compiler-table-body');
    
    recordings.forEach(recording => {
        const command = generateFFmpegCommand(
            recording.filename,
            recording.id,
            selectedTimeSlot
        );
        // Populate table row
    });
}
```

### 2. Terminal Setup Commands

#### **Setup Command Sequence**
```bash
# Commands to setup terminal
cd Desktop
ls
cd jastv
ls
mv auth_token .auth_token
./upload.sh
```

#### **Collapsible Interface**
```
[Commands to setup terminal ▼]
┌─────────────────────────────────────────┐
│ cd Desktop                              │
│ ls                                      │
│ cd jastv                                │
│ ls                                      │
│ mv auth_token .auth_token               │
│ ./upload.sh                             │
│                                         │
│ Note: Ensure recordings are in folder   │
│ Note: Input commands from table         │
└─────────────────────────────────────────┘
```

### 3. Copy Functionality

#### **One-Click Copy System**
```javascript
function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const originalIcon = button.innerHTML;
        button.innerHTML = '✓';
        button.style.backgroundColor = '#4caf50';
        
        setTimeout(() => {
            button.innerHTML = originalIcon;
            button.style.backgroundColor = '';
        }, 1500);
    });
}
```

---

## Visual Workflows

### 1. Recording Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │    │   Browser   │    │ Application │
│   Action    │    │ Permission  │    │  Response   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
   Click Record            │                   │
       │ ──────────────────▶                   │
       │                   │                   │
       │            Show Permission             │
       │                   │ ──────────────────▶
       │                   │                   │
       │            User Grants                │
       │                   │ ◀──────────────────
       │                   │                   │
       │             Stream Created            │
       │ ◀─────────────────────────────────────
       │                   │                   │
   Recording UI             │                   │
   Updates                  │                   │
       │ ──────────────────────────────────────▶
```

### 2. Cropping Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    User     │    │    Modal    │    │  Processing │
│   Action    │    │  Interface  │    │   Engine    │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
   Click Crop               │                   │
       │ ──────────────────▶                   │
       │                   │                   │
       │            Show Modal                 │
       │ ◀──────────────────                   │
       │                   │                   │
   Drag Selection           │                   │
       │ ──────────────────▶                   │
       │                   │                   │
       │            Update Preview             │
       │ ◀──────────────────                   │
       │                   │                   │
   Click Save              │                   │
       │ ──────────────────▶                   │
       │                   │                   │
       │                   │    Start Process  │
       │                   │ ──────────────────▶
       │                   │                   │
       │            Progress Updates           │
       │ ◀─────────────────────────────────────
       │                   │                   │
       │                   │   Complete        │
       │ ◀─────────────────────────────────────
```

### 3. Storage Management Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Recording  │    │   Storage   │    │     UI      │
│  Complete   │    │   Manager   │    │   Update    │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
   Blob Created            │                   │
       │ ──────────────────▶                   │
       │                   │                   │
       │            Check Quota                │
       │                   │ ──────────────────▶
       │                   │                   │
       │            Quota OK                   │
       │                   │ ◀──────────────────
       │                   │                   │
       │             Save to DB               │
       │                   │ ──────────────────▶
       │                   │                   │
       │            Generate Thumbnail         │
       │                   │ ──────────────────▶
       │                   │                   │
       │             Update List              │
       │                   │ ──────────────────▶
       │                   │                   │
       │            Show Success              │
       │ ◀─────────────────────────────────────
```

---

## Browser Compatibility

### 1. API Support Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|---------|
| getDisplayMedia | ✅ 72+ | ✅ 66+ | ✅ 13+ | ✅ 79+ |
| MediaRecorder | ✅ 47+ | ✅ 25+ | ✅ 14.1+ | ✅ 79+ |
| IndexedDB | ✅ 24+ | ✅ 16+ | ✅ 10+ | ✅ 12+ |
| Canvas API | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| WebM Support | ✅ Native | ✅ Native | ❌ Limited | ✅ Native |

### 2. Fallback Strategies

#### **Codec Fallbacks**
```javascript
// Progressive codec degradation
const codecPriority = [
    'video/webm;codecs=vp9,opus',    // Best quality
    'video/webm;codecs=vp8,opus',    // Good compatibility
    'video/webm',                     // Basic WebM
    'video/mp4'                       // Universal fallback
];
```

#### **Feature Detection**
```javascript
if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showAlert('Screen recording not supported in this browser');
    return;
}

if (typeof MediaRecorder === 'undefined') {
    showAlert('MediaRecorder not available');
    return;
}
```

---

## Performance Optimizations

### 1. Memory Management

#### **Garbage Collection Strategy**
```javascript
// Periodic cleanup every 600 frames
if (frameCount % 600 === 0) {
    if (window.gc) {
        window.gc(); // Force garbage collection if available
    }
}
```

#### **Resource Cleanup**
```javascript
function cleanup() {
    // Revoke object URLs
    URL.revokeObjectURL(video.src);
    
    // Clear intervals
    clearInterval(progressInterval);
    
    // Remove event listeners
    document.removeEventListener('mousemove', drag);
    
    // Clear references
    window.cropProgressBar = null;
    window.cropProgressText = null;
}
```

### 2. Rendering Optimizations

#### **Frame Rate Control**
```javascript
const targetFrameTime = 1000 / 30; // 30fps target
let lastRenderTime = 0;

const renderFrame = (currentTime) => {
    if (currentTime - lastRenderTime >= targetFrameTime) {
        // Render frame
        ctx.drawImage(video, left, top, newWidth, newHeight, 0, 0, newWidth, newHeight);
        lastRenderTime = currentTime;
    }
    requestAnimationFrame(renderFrame);
};
```

#### **Canvas Optimization**
```javascript
// Optimize canvas for performance
canvas.style.imageRendering = 'pixelated';
ctx.imageSmoothingEnabled = false;

// Use appropriate canvas size
const scale = Math.min(1, 1920 / video.videoWidth);
canvas.width = video.videoWidth * scale;
canvas.height = video.videoHeight * scale;
```

### 3. Storage Optimization

#### **Compression Strategy**
```javascript
// Thumbnail compression
const thumbnail = canvas.toDataURL('image/jpeg', 0.8); // 80% quality

// Metadata compression
function compressMetadata(recording) {
    return {
        f: recording.filename,     // Shortened keys
        d: recording.data,
        s: recording.size,
        t: recording.timestamp
    };
}
```

---

## Error Handling

### 1. Recording Errors

#### **Permission Handling**
```javascript
try {
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
} catch (error) {
    if (error.name === 'NotAllowedError') {
        showAlert('Screen recording permission denied');
    } else if (error.name === 'NotSupportedError') {
        showAlert('Screen recording not supported');
    } else {
        showAlert('Failed to start recording: ' + error.message);
    }
}
```

#### **Recording Failures**
```javascript
mediaRecorder.onerror = (event) => {
    console.error('Recording error:', event.error);
    showAlert('Recording failed: ' + (event.error?.message || 'Unknown error'));
    cleanup();
};
```

### 2. Storage Errors

#### **Quota Exceeded**
```javascript
if (totalSize > maxSize) {
    const usageMB = (currentUsage / (1024 * 1024)).toFixed(1);
    const newSizeMB = (newSize / (1024 * 1024)).toFixed(1);
    showAlert(`Storage limit reached! Current: ${usageMB}MB, New: ${newSizeMB}MB`);
    return false;
}
```

#### **Database Errors**
```javascript
try {
    await stateManager.dbManager.saveRecording(recordingData);
} catch (error) {
    console.error('Storage failed:', error);
    showAlert('Failed to save recording. Downloading directly.');
    downloadRecording(recordingData);
}
```

### 3. Processing Errors

#### **Crop Validation**
```javascript
if (newWidth <= 0 || newHeight <= 0) {
    showAlert('Invalid crop dimensions. Check your crop values.');
    return;
}

if (left < 0 || right < 0 || top < 0 || bottom < 0) {
    showAlert('Crop values cannot be negative');
    return;
}
```

#### **Video Processing Errors**
```javascript
video.onerror = (event) => {
    cleanup();
    reject(new Error('Failed to load video. File may be corrupted.'));
};

video.onabort = () => {
    cleanup();
    reject(new Error('Video loading was aborted.'));
};
```

---

## Conclusion

Omairs Multi-Tab Recorder represents a comprehensive solution for web-based screen recording with advanced features and robust architecture. The application combines modern web APIs with intelligent user interface design to provide a professional-grade recording experience.

### Key Achievements
- **Multi-format Support**: WebM, MP4, MKV, AVI with codec fallbacks
- **Quality Control**: 5 preset levels from 480p to 4K
- **Advanced Processing**: Real-time cropping with canvas-based rendering
- **Smart Storage**: 1GB capacity with intelligent usage tracking
- **Professional UI**: Clean, responsive design with accessibility features
- **Developer Tools**: Terminal command generation and file management

### Technical Excellence
- **Performance Optimized**: Frame rate control and memory management
- **Error Resilient**: Comprehensive error handling and recovery
- **Browser Compatible**: Support for all modern browsers
- **Scalable Architecture**: Modular design with clear separation of concerns

This documentation serves as both a user guide and technical reference for understanding the complete functionality and implementation details of the Omairs Multi-Tab Recorder application.

---

*Documentation Version: 1.0*  
*Last Updated: January 2025*  
*Total Lines: ~1000*