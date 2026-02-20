/**
 * VisionX - Real-Time AI Object Detection
 * Frontend Logic
 */

class VisionXApp {
    constructor() {
        // Elements
        this.video = document.getElementById('webcam');
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('webkit-playsinline', '');
        this.canvas = document.getElementById('detection-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.captureBtn = document.getElementById('capture-btn');
        this.fpsCounter = document.getElementById('fps-counter');
        this.objectCount = document.getElementById('object-count');
        this.thresholdSlider = document.getElementById('threshold-slider');
        this.thresholdVal = document.getElementById('threshold-val');
        this.detectionToggle = document.getElementById('detection-toggle');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        this.detectionLog = document.getElementById('detection-log');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.videoContainer = document.querySelector('.video-container');

        // State
        this.stream = null;
        this.isDetecting = false;
        this.lastFrameTime = 0;
        this.fps = 0;
        this.threshold = 0.5;
        this.apiUrl = ''; // Use same origin
        this.processingFrame = false;

        // Colors for bounding boxes
        this.colors = ['#00f2ff', '#7000ff', '#00e676', '#ff4d4d', '#ffab00', '#f50057'];

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.checkBackendStatus();

        // Initialize values from slider
        this.threshold = this.thresholdSlider.value / 100;
        this.thresholdVal.textContent = `${this.thresholdSlider.value}%`;

        // Sync threshold slider
        this.thresholdSlider.addEventListener('input', (e) => {
            this.threshold = e.target.value / 100;
            this.thresholdVal.textContent = `${e.target.value}%`;
        });
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
        this.captureBtn.addEventListener('click', () => this.takeScreenshot());
    }

    async checkBackendStatus() {
        try {
            const resp = await fetch(`${this.apiUrl}/health`);
            const data = await resp.json();
            if (data.status === 'ready') {
                this.updateStatus(true);
            } else {
                this.statusText.textContent = "Backend Initializing...";
                setTimeout(() => this.checkBackendStatus(), 2000);
            }
        } catch (err) {
            console.error("Backend connection failed", err);
            this.updateStatus(false);
            setTimeout(() => this.checkBackendStatus(), 5000);
        }
    }

    updateStatus(online) {
        if (online) {
            this.statusIndicator.className = 'status-indicator status-online';
            this.statusText.textContent = 'Backend Online';
        } else {
            this.statusIndicator.className = 'status-indicator status-offline';
            this.statusText.textContent = 'Backend Offline';
        }
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, frameRate: 30 }
            });
            console.log("Camera stream obtained");
            this.video.srcObject = this.stream;

            this.startBtn.classList.add('hidden');
            this.stopBtn.classList.remove('hidden');

            this.video.onloadedmetadata = () => {
                console.log("Video metadata loaded", this.video.videoWidth, this.video.videoHeight);
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                this.videoContainer.classList.add('active');
                this.loadingOverlay.classList.remove('hidden'); // Show loader

                // Safety: Hide loader after 3 seconds even if backend is slow
                setTimeout(() => {
                    this.loadingOverlay.classList.add('hidden');
                }, 3000);

                this.video.play().then(() => {
                    this.isDetecting = true;
                    this.detectionLoop();
                });
            };
        } catch (err) {
            console.error("Camera access denied", err);
            alert("Error: Camera access denied. Please check permissions.");
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
        }
        this.isDetecting = false;
        this.loadingOverlay.classList.add('hidden'); // Hide loader if user stops camera
        this.videoContainer.classList.remove('active');
        this.startBtn.classList.remove('hidden');
        this.stopBtn.classList.add('hidden');
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.fpsCounter.textContent = '0';
        this.objectCount.textContent = '0';
    }

    async detectionLoop() {
        if (!this.isDetecting) return;

        const now = performance.now();
        if (this.lastFrameTime) {
            const delta = (now - this.lastFrameTime) / 1000;
            this.fps = Math.round(1 / delta);
            this.fpsCounter.textContent = this.fps;
        }
        this.lastFrameTime = now;

        if (this.detectionToggle.checked && !this.processingFrame) {
            await this.processFrame();
        }

        requestAnimationFrame(() => this.detectionLoop());
    }

    async processFrame() {
        this.processingFrame = true;

        try {
            // Offscreen canvas to capture current video frame
            const offscreen = document.createElement('canvas');
            offscreen.width = 320; // Resize for faster backend processing
            offscreen.height = (this.video.videoHeight / this.video.videoWidth) * 320;
            const octx = offscreen.getContext('2d');
            octx.drawImage(this.video, 0, 0, offscreen.width, offscreen.height);

            // Convert to blob
            const blob = await new Promise(resolve => offscreen.toBlob(resolve, 'image/jpeg', 0.8));

            const formData = new FormData();
            formData.append('file', blob, 'frame.jpg');
            formData.append('threshold', this.threshold);

            const resp = await fetch(`${this.apiUrl}/predict`, {
                method: 'POST',
                body: formData
            });

            const data = await resp.json();
            if (data.detections) {
                this.loadingOverlay.classList.add('hidden'); // Hide loader once we get data
                this.drawDetections(data.detections);
                this.updateDetectionLog(data.detections);
            }
        } catch (err) {
            console.error("Frame processing failed", err);
            // Hide overlay even on error to let user retry
            this.loadingOverlay.classList.add('hidden');
        } finally {
            this.processingFrame = false;
        }
    }

    drawDetections(detections) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.objectCount.textContent = detections.length;

        detections.forEach((det, index) => {
            const { label, confidence, box } = det;
            const color = this.colors[index % this.colors.length];

            // Bounding Box (Scaled from normalized coordinates)
            const x = box.x * this.canvas.width;
            const y = box.y * this.canvas.height;
            const w = box.w * this.canvas.width;
            const h = box.h * this.canvas.height;

            // --- High-End Visuals ---

            // 1. Box Glow Effect
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = color;
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 3;

            // Draw main rectangle
            this.ctx.strokeRect(x, y, w, h);

            // 2. Decorative Corners (Tech Style)
            const cornerSize = Math.min(w, h, 20);
            this.ctx.lineWidth = 6;

            // Top Left
            this.ctx.beginPath();
            this.ctx.moveTo(x, y + cornerSize);
            this.ctx.lineTo(x, y);
            this.ctx.lineTo(x + cornerSize, y);
            this.ctx.stroke();

            // Bottom Right
            this.ctx.beginPath();
            this.ctx.moveTo(x + w - cornerSize, y + h);
            this.ctx.lineTo(x + w, y + h);
            this.ctx.lineTo(x + w, y + h - cornerSize);
            this.ctx.stroke();

            // 3. Label Design
            this.ctx.shadowBlur = 0; // Reset shadow for text
            this.ctx.fillStyle = color;

            const confPercent = (confidence * 100).toFixed(0);
            const text = `${label.toUpperCase()} · ${confPercent}%`;

            this.ctx.font = '700 14px Outfit';
            const textMetrics = this.ctx.measureText(text);
            const labelWidth = textMetrics.width + 20;
            const labelHeight = 28;

            // Label background (rounded-top styles)
            this.ctx.beginPath();
            const radius = 6;
            const lx = x;
            const ly = y - labelHeight - 2;

            // Ensure label doesn't go off screen
            const finalLy = ly < 0 ? y : ly;

            this.ctx.roundRect(lx, finalLy, labelWidth, labelHeight, [radius, radius, 0, 0]);
            this.ctx.fill();

            // Label text
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(text, lx + 10, finalLy + 19);

            // 4. Trace line (Visual flair)
            this.ctx.globalAlpha = 0.2;
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x, y, w, h);
            this.ctx.globalAlpha = 1.0;
        });
    }

    updateDetectionLog(detections) {
        if (detections.length === 0) return;

        // Only update if something changed significantly or every N frames to avoid UI flicker
        this.detectionLog.innerHTML = detections.map((det, i) => `
            <div class="detection-item" style="border-left-color: ${this.colors[i % this.colors.length]}">
                <span class="item-label">${det.label}</span>
                <span class="item-confidence">${(det.confidence * 100).toFixed(0)}%</span>
            </div>
        `).join('');
    }

    takeScreenshot() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.video.videoWidth;
        tempCanvas.height = this.video.videoHeight;
        const tctx = tempCanvas.getContext('2d');

        // Draw video then canvas (detections) on top
        tctx.drawImage(this.video, 0, 0);
        tctx.drawImage(this.canvas, 0, 0);

        const link = document.createElement('a');
        link.download = `VisionX-Capture-${Date.now()}.png`;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    }
}

// Instantiate the app
window.addEventListener('DOMContentLoaded', () => {
    new VisionXApp();
});
