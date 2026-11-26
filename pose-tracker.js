/**
 * pose-tracker.js
 * MediaPipe Pose tabanlı tam vücut (kol + gövde + bacak/diz/ayak) hareket takip motoru.
 * PC (Logitech webcam) ve Android/iPad tabletler (Samsung Tab S7 FE vb.) için
 * ön/arka kamera geçişi ve Tablet Hız Modu (modelComplexity 0/1) desteklidir.
 */

export class PoseTracker {
  constructor() {
    this.videoElement = document.getElementById('webcam');
    this.overlayCanvas = document.getElementById('camera-overlay');
    this.overlayCtx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;
    this.statusElement = document.getElementById('camera-status');

    this.pose = null;
    this.stream = null;
    this.frameLoopActive = false;
    this.isSendingFrame = false;

    // Tablet/mobil otomatik tespiti: tabletlerde varsayılan olarak akıcı Hız Modu (modelComplexity: 0)
    const isTouchDevice =
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) ||
      (typeof navigator !== 'undefined' && /Android|iPad|iPhone|Tablet/i.test(navigator.userAgent));

    this.fastMode = isTouchDevice;
    this.facingMode = 'user'; // 'user' = Ön Kamera, 'environment' = Arka Kamera

    this.isTrackingActive = false;
    this.onTrackingCallback = null;
    this.onCalibrationSuccess = null;
    this.calibrationPassed = false;
    this.frameCounter = 0;

    // Aynalanmış ekran koordinatları (0 = ekran solu, 1 = ekran sağı)
    this.smoothedX = 0.5;
    this.currentLane = 0; // -1: Sol, 0: Orta, 1: Sağ

    // Kalibrasyon referansları
    this.standingNoseY = null;
    this.standingShoulderY = null;
    this.bodyScale = 0.22;

    // Duruş durumları
    this.isJumping = false;
    this.isCrouching = false;
    this.hasLegTracking = false;

    // Yumuşatılmış tam vücut eklem noktaları
    this.smoothedPose = null;
  }

  recalibrate() {
    this.standingNoseY = null;
    this.standingShoulderY = null;
    this.isJumping = false;
    this.isCrouching = false;
  }

  setFastMode(enabled) {
    this.fastMode = !!enabled;
    if (this.pose) {
      this.pose.setOptions({
        modelComplexity: this.fastMode ? 0 : 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
    }
  }

  async initialize() {
    this.updateStatus('Kamera hazırlanıyor...', 'connecting');

    try {
      if (typeof Pose === 'undefined') {
        throw new Error('MediaPipe Pose kütüphanesi yüklenemedi.');
      }

      this.pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });

      this.pose.setOptions({
        modelComplexity: this.fastMode ? 0 : 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.pose.onResults((results) => this.handlePoseResults(results));

      await this.startCameraStream(this.facingMode);
      this.startFrameLoop();
    } catch (error) {
      console.warn('PoseTracker başlatılamadı:', error);
      this.updateStatus('Kamera kapalı (HTTPS veya izin gerekli)', 'error');
    }
  }

  async startCameraStream(facingMode = 'user') {
    this.updateStatus('Kameraya bağlanılıyor...', 'connecting');

    // Eski kamera akışını temizce durdur
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    const width = this.fastMode ? 480 : 640;
    const height = this.fastMode ? 360 : 480;

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode: { ideal: facingMode }
        },
        audio: false
      });
    } catch (e) {
      // Tek kameralı cihazlarda (ör. PC webcam) ideal facingMode hata verirse genel video aç
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: width }, height: { ideal: height } },
        audio: false
      });
    }

    this.stream = stream;
    this.facingMode = facingMode;
    this.videoElement.srcObject = stream;

    await new Promise((resolve) => {
      if (this.videoElement.readyState >= 1 && this.videoElement.videoWidth > 0) {
        resolve();
        return;
      }
      this.videoElement.onloadedmetadata = () => resolve();
    });

    try {
      await this.videoElement.play();
    } catch (e) {
      // Otomatik oynatma kısıtı varsa kullanıcı dokunuşunda devam eder
    }

    if (this.overlayCanvas) {
      this.overlayCanvas.width = this.videoElement.videoWidth || width;
      this.overlayCanvas.height = this.videoElement.videoHeight || height;
    }

    const camName = this.facingMode === 'user' ? 'Ön kamera' : 'Arka kamera';
    this.updateStatus(`${camName} hazır — Oyuncu bekleniyor...`, 'connecting');
  }

  async switchCamera() {
    const nextMode = this.facingMode === 'user' ? 'environment' : 'user';
    try {
      this.recalibrate();
      await this.startCameraStream(nextMode);
      return this.facingMode;
    } catch (e) {
      console.warn('Kamera değiştirilemedi:', e);
      this.updateStatus('Bu cihazda tek kamera algılandı', 'ready');
      return this.facingMode;
    }
  }

  startFrameLoop() {
    if (this.frameLoopActive) return;
    this.frameLoopActive = true;

    const tick = async () => {
      if (!this.frameLoopActive) return;
      if (
        this.pose &&
        this.videoElement &&
        this.videoElement.readyState >= 2 &&
        this.videoElement.videoWidth > 0 &&
        !this.isSendingFrame
      ) {
        this.isSendingFrame = true;
        try {
          await this.pose.send({ image: this.videoElement });
        } catch (e) {
          // Kare hatasını yut ve devam et
        } finally {
          this.isSendingFrame = false;
        }
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  updateStatus(message, stateClass) {
    if (!this.statusElement) return;
    this.statusElement.textContent = message;
    this.statusElement.className = `status-${stateClass}`;
  }

  mirrorLandmark(lm) {
    if (!lm) return null;
    return {
      x: 1.0 - lm.x,
      y: lm.y,
      visibility: lm.visibility === undefined ? 1.0 : lm.visibility
    };
  }

  lerpPoint(prev, next, alpha) {
    if (!next) return prev;
    if (!prev) return { ...next };
    return {
      x: prev.x + (next.x - prev.x) * alpha,
      y: prev.y + (next.y - prev.y) * alpha,
      visibility: next.visibility
    };
  }

  handlePoseResults(results) {
    if (this.overlayCtx && this.overlayCanvas) {
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }

    if (!results.poseLandmarks) {
      this.isTrackingActive = false;
      return;
    }

    this.isTrackingActive = true;
    this.frameCounter++;

    const raw = results.poseLandmarks;
    this.drawCalmSkeleton(raw);

    const nextPose = {
      nose: this.mirrorLandmark(raw[0]),
      leftShoulder: this.mirrorLandmark(raw[11]),
      rightShoulder: this.mirrorLandmark(raw[12]),
      leftElbow: this.mirrorLandmark(raw[13]),
      rightElbow: this.mirrorLandmark(raw[14]),
      leftWrist: this.mirrorLandmark(raw[15]),
      rightWrist: this.mirrorLandmark(raw[16]),
      leftHip: this.mirrorLandmark(raw[23]),
      rightHip: this.mirrorLandmark(raw[24]),
      leftKnee: this.mirrorLandmark(raw[25]),
      rightKnee: this.mirrorLandmark(raw[26]),
      leftAnkle: this.mirrorLandmark(raw[27]),
      rightAnkle: this.mirrorLandmark(raw[28])
    };

    if (!this.smoothedPose) {
      this.smoothedPose = nextPose;
    } else {
      const alpha = 0.44;
      for (const key of Object.keys(nextPose)) {
        this.smoothedPose[key] = this.lerpPoint(this.smoothedPose[key], nextPose[key], alpha);
      }
    }

    const ls = this.smoothedPose.leftShoulder;
    const rs = this.smoothedPose.rightShoulder;
    const nose = this.smoothedPose.nose;
    const lk = this.smoothedPose.leftKnee;
    const rk = this.smoothedPose.rightKnee;
    const la = this.smoothedPose.leftAnkle;
    const ra = this.smoothedPose.rightAnkle;

    const kneesVisible = lk && rk && lk.visibility > 0.35 && rk.visibility > 0.35;
    const anklesVisible = la && ra && la.visibility > 0.32 && ra.visibility > 0.32;
    this.hasLegTracking = !!(kneesVisible || anklesVisible);

    // 1. Yatay konum (omuz ortası)
    let rawScreenX = 0.5;
    if (ls && rs) {
      rawScreenX = (ls.x + rs.x) / 2;
      const span = Math.hypot(rs.x - ls.x, rs.y - ls.y);
      if (span > 0.045 && span < 0.7) {
        this.bodyScale += (span - this.bodyScale) * 0.12;
      }
    } else if (nose) {
      rawScreenX = nose.x;
    }

    rawScreenX = Math.max(0, Math.min(1, rawScreenX));
    this.smoothedX += (rawScreenX - this.smoothedX) * 0.38;

    if (this.currentLane === 0) {
      if (this.smoothedX < 0.39) this.currentLane = -1;
      else if (this.smoothedX > 0.61) this.currentLane = 1;
    } else if (this.currentLane === -1) {
      if (this.smoothedX > 0.44) this.currentLane = 0;
    } else if (this.currentLane === 1) {
      if (this.smoothedX < 0.56) this.currentLane = 0;
    }

    // 2. Zıplama ve Eğilme tespiti
    const shoulderMidY = ls && rs ? (ls.y + rs.y) / 2 : null;
    const refY = shoulderMidY !== null ? shoulderMidY : (nose ? nose.y : null);

    if (refY !== null) {
      if (this.standingShoulderY === null) {
        this.standingShoulderY = refY;
        this.standingNoseY = nose ? nose.y : refY - this.bodyScale * 0.5;
      } else {
        const deltaUp = this.standingShoulderY - refY;
        const jumpThresh = Math.max(0.032, this.bodyScale * 0.21);
        const crouchThresh = Math.max(0.046, this.bodyScale * 0.28);

        const noseDeltaUp = nose && this.standingNoseY !== null ? (this.standingNoseY - nose.y) : deltaUp;

        this.isJumping = (deltaUp > jumpThresh) || (noseDeltaUp > jumpThresh * 1.05);
        this.isCrouching = (!this.isJumping) && ((deltaUp < -crouchThresh) || (noseDeltaUp < -crouchThresh * 1.1));

        if (!this.isJumping && !this.isCrouching && Math.abs(deltaUp) < jumpThresh * 0.75) {
          this.standingShoulderY += (refY - this.standingShoulderY) * 0.015;
          if (nose && this.standingNoseY !== null) {
            this.standingNoseY += (nose.y - this.standingNoseY) * 0.015;
          }
        }
      }
    }

    if (this.onTrackingCallback) {
      this.onTrackingCallback({
        x: this.smoothedX,
        lane: this.currentLane,
        isJumping: this.isJumping,
        isCrouching: this.isCrouching,
        hasLegTracking: this.hasLegTracking,
        bodyScale: this.bodyScale,
        pose: this.smoothedPose
      });
    }

    if (!this.calibrationPassed && this.frameCounter > 12) {
      this.calibrationPassed = true;
      this.updateStatus('Oyuncu algılandı — Hazır', 'ready');
      if (this.onCalibrationSuccess) {
        this.onCalibrationSuccess();
      }
    }
  }

  drawCalmSkeleton(landmarks) {
    if (!this.overlayCtx || !this.overlayCanvas) return;
    const ctx = this.overlayCtx;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    const connections = [
      [11, 12],
      [11, 23], [12, 24], [23, 24],
      [11, 13], [13, 15],
      [12, 14], [14, 16],
      [23, 25], [25, 27],
      [24, 26], [26, 28]
    ];

    ctx.save();
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(116, 158, 110, 0.88)';

    ctx.beginPath();
    connections.forEach(([i, j]) => {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      if (p1 && p2 && (p1.visibility === undefined || p1.visibility > 0.32) && (p2.visibility === undefined || p2.visibility > 0.32)) {
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
      }
    });
    ctx.stroke();

    const joints = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    joints.forEach((idx) => {
      const lm = landmarks[idx];
      if (!lm || (lm.visibility !== undefined && lm.visibility <= 0.32)) return;
      ctx.beginPath();
      const isHand = idx === 15 || idx === 16;
      const isFoot = idx === 27 || idx === 28;
      const isKnee = idx === 25 || idx === 26;
      const isNose = idx === 0;
      const r = isNose || isHand || isFoot ? 7 : 5;
      ctx.arc(lm.x * w, lm.y * h, r, 0, Math.PI * 2);
      ctx.fillStyle = isHand ? '#df7f62' : isFoot ? '#e8b84b' : isKnee ? '#7aa8bf' : isNose ? '#e8b84b' : '#f7f4ec';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#5c554d';
      ctx.stroke();
    });
    ctx.restore();
  }
}
