/**
 * app.js
 * Doğa Parkuru — Kamera takibi, Tablet/TV Tam Ekran modu, Wake Lock,
 * ön/arka kamera değiştirme, klavye yedeği, HUD ve ekran geçişleri yöneticisi.
 */

import { PoseTracker } from './pose-tracker.js';
import { ParkourEngine } from './modules/parkour.js';
import { sfx } from './modules/sound.js';

class ParkourApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');

    // Ekran katmanları
    this.screenWelcome = document.getElementById('screen-welcome');
    this.screenPause = document.getElementById('screen-pause');
    this.screenComplete = document.getElementById('screen-complete');
    this.screenEnd = document.getElementById('screen-end');

    // HUD elemanları
    this.stageValEl = document.getElementById('stage-val');
    this.progressTextEl = document.getElementById('progress-text');
    this.progressFillEl = document.getElementById('progress-fill');
    this.starsValEl = document.getElementById('stars-val');
    this.streakValEl = document.getElementById('streak-val');
    this.heartsLabelEl = document.getElementById('hearts-label');
    this.heartsValEl = document.getElementById('hearts-val');
    this.hubStatusEl = document.getElementById('hub-status');

    // Kontroller
    this.btnStart = document.getElementById('btn-start');
    this.btnStartTv = document.getElementById('btn-start-tv');
    this.btnTvMode = document.getElementById('btn-tv-mode');
    this.btnPause = document.getElementById('btn-pause');
    this.btnHome = document.getElementById('btn-home');
    this.btnResume = document.getElementById('btn-resume');
    this.btnPauseHome = document.getElementById('btn-pause-home');
    this.btnNextStage = document.getElementById('btn-next-stage');
    this.btnCompleteHome = document.getElementById('btn-complete-home');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnEndHome = document.getElementById('btn-end-home');
    this.btnSwitchCam = document.getElementById('btn-switch-cam');
    this.btnRecalibrate = document.getElementById('btn-recalibrate');
    this.btnMute = document.getElementById('btn-mute');
    this.btnMusic = document.getElementById('btn-music');
    this.speedSlider = document.getElementById('speed-slider');
    this.speedValueEl = document.getElementById('speed-value');
    this.calmModeToggle = document.getElementById('calm-mode-toggle');
    this.tabletSpeedToggle = document.getElementById('tablet-speed-toggle');

    this.state = 'welcome';
    this.lastTime = performance.now();
    this.isMuted = false;
    this.musicEnabled = true;
    this.isTvMode = false;
    this.wakeLockSentinel = null;

    this.tracker = new PoseTracker();
    this.engine = new ParkourEngine(this.canvas, {
      onHudUpdate: (hud) => this.renderHud(hud),
      onStageComplete: (info) => this.handleStageComplete(info),
      onGentleEnd: (info) => this.handleGentleEnd(info)
    });

    // Tablet Hız Modu kutusunu cihaz varsayılanıyla eşitle
    if (this.tabletSpeedToggle) {
      this.tabletSpeedToggle.checked = this.tracker.fastMode;
    }

    this.bindEvents();
  }

  bindEvents() {
    this.btnStart.addEventListener('click', () => {
      sfx.init();
      this.tracker.recalibrate();
      this.requestWakeLock();
      this.startPlaying(1, true);
    });

    this.btnStartTv.addEventListener('click', () => {
      sfx.init();
      this.tracker.recalibrate();
      this.requestWakeLock();
      this.setTvMode(true);
      this.startPlaying(1, true);
    });

    this.btnTvMode.addEventListener('click', () => {
      this.setTvMode(!this.isTvMode);
    });

    this.btnPause.addEventListener('click', () => {
      if (this.state === 'playing') {
        this.setState('paused');
        this.engine.stop();
      } else if (this.state === 'paused') {
        this.resumePlaying();
      }
    });

    this.btnResume.addEventListener('click', () => this.resumePlaying());

    [this.btnHome, this.btnPauseHome, this.btnCompleteHome, this.btnEndHome].forEach((btn) => {
      btn.addEventListener('click', () => {
        this.engine.stop();
        this.setState('welcome');
      });
    });

    this.btnNextStage.addEventListener('click', () => {
      this.requestWakeLock();
      this.startPlaying(this.engine.stage + 1, false);
    });

    this.btnRetry.addEventListener('click', () => {
      this.requestWakeLock();
      this.startPlaying(this.engine.stage, false);
    });

    this.btnSwitchCam.addEventListener('click', async () => {
      this.btnSwitchCam.disabled = true;
      const mode = await this.tracker.switchCamera();
      this.btnSwitchCam.textContent = mode === 'user' ? 'Kamera: Ön' : 'Kamera: Arka';
      this.btnSwitchCam.disabled = false;
      this.engine.showFeedback(mode === 'user' ? 'Ön kamera aktif' : 'Arka kamera aktif', '#46733f');
    });

    this.btnRecalibrate.addEventListener('click', () => {
      this.tracker.recalibrate();
      this.engine.showFeedback('Boy hizalaması yenilendi', '#46733f');
    });

    this.btnMute.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      sfx.setMuted(this.isMuted);
      this.btnMute.textContent = this.isMuted ? 'Ses: Kapalı' : 'Ses: Açık';
      if (!this.isMuted && this.musicEnabled && this.state === 'playing' && this.engine.countdownTimer <= 0) {
        sfx.startMusic();
      }
    });

    this.btnMusic.addEventListener('click', () => {
      this.musicEnabled = !this.musicEnabled;
      sfx.setMusicEnabled(this.musicEnabled);
      this.btnMusic.textContent = this.musicEnabled ? 'Müzik: Açık' : 'Müzik: Kapalı';
      if (this.musicEnabled && !this.isMuted && this.state === 'playing' && this.engine.countdownTimer <= 0) {
        sfx.startMusic();
      }
    });

    this.speedSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.engine.speedMultiplier = val;
      this.speedValueEl.textContent = `${val.toFixed(1)}x`;
    });

    this.calmModeToggle.addEventListener('change', (e) => {
      this.engine.calmMode = e.target.checked;
      this.engine.notifyHud();
    });

    this.tabletSpeedToggle.addEventListener('change', (e) => {
      this.tracker.setFastMode(e.target.checked);
      this.engine.showFeedback(
        e.target.checked ? 'Tablet Hız Modu açıldı' : 'Standart hassas takip aktif',
        '#46733f'
      );
    });

    // Tarayıcı tam ekranından çıkılınca (ör. ESC veya Android geri hareketi) canvas boyutunu yenile
    document.addEventListener('fullscreenchange', () => {
      setTimeout(() => this.resizeCanvas(), 80);
    });

    // Sekmeye geri dönüldüğünde ekran uyanık kilidini (Wake Lock) tazele
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (this.state === 'playing' || this.isTvMode)) {
        this.requestWakeLock();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        if (this.state === 'playing') {
          this.setState('paused');
          this.engine.stop();
        } else if (this.state === 'paused') {
          this.resumePlaying();
        }
        return;
      }

      if (this.state !== 'playing') return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.engine.setInput({ lane: Math.max(-1, this.engine.playerLane - 1) });
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.engine.setInput({ lane: Math.min(1, this.engine.playerLane + 1) });
      } else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        this.engine.triggerKeyboardJump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.engine.triggerKeyboardCrouch();
      } else if (e.key === 'm' || e.key === 'M') {
        this.engine.triggerMatchCurrentMirrorPose();
      } else if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        this.engine.triggerManualPose(parseInt(e.key, 10) - 1);
      }
    });

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  /**
   * TV Tam Ekran Modu: sol ayar panelini gizler, kamerayı sol alt köşede küçük PiP yapar
   * ve mümkünse tarayıcı tam ekranını (Fullscreen) açar.
   */
  async setTvMode(enable) {
    this.isTvMode = !!enable;
    document.body.classList.toggle('tv-mode', this.isTvMode);
    this.btnTvMode.textContent = this.isTvMode ? 'Ayarlar' : 'TV Tam Ekran';

    try {
      if (this.isTvMode) {
        this.requestWakeLock();
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) {
          await el.requestFullscreen();
        }
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (e) {
      // Bazı tarayıcılar fullscreen kısıtlayabilir; CSS TV modu yine de çalışır
    }

    // Düzen değişimi tamamlanınca canvas çözünürlüğünü güncelle
    requestAnimationFrame(() => this.resizeCanvas());
    setTimeout(() => this.resizeCanvas(), 150);
  }

  /**
   * Ekran Uyumama (Screen Wake Lock API): çocuklar tablete dokunmadan oynarken ekran kararmaz.
   */
  async requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      if (this.wakeLockSentinel) return;
      this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });
    } catch (e) {
      // Desteklenmiyor veya pil tasarrufu aktifse sessizce geç
    }
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
  }

  setState(newState) {
    this.state = newState;
    const map = {
      welcome: this.screenWelcome,
      paused: this.screenPause,
      complete: this.screenComplete,
      end: this.screenEnd
    };

    Object.values(map).forEach((el) => {
      el.className = 'screen-overlay hidden';
    });

    if (map[newState]) {
      map[newState].className = 'screen-overlay active';
    }

    this.btnPause.disabled = newState !== 'playing' && newState !== 'paused';
    this.btnPause.textContent = newState === 'paused' ? 'Devam Et' : 'Duraklat';
  }

  startPlaying(stageNum, resetStars) {
    this.setState('playing');
    this.engine.startStage(stageNum, resetStars);
  }

  resumePlaying() {
    this.setState('playing');
    this.engine.isRunning = true;
    this.requestWakeLock();
    if (this.engine.countdownTimer <= 0 && !this.isMuted && this.musicEnabled) {
      sfx.startMusic();
    }
  }

  handleStageComplete(info) {
    document.getElementById('complete-stage').textContent = info.stage;
    document.getElementById('complete-stars').textContent = `★ ${info.stars}`;
    document.getElementById('complete-streak').textContent = `${info.bestStreak}x`;
    document.getElementById('btn-next-stage').textContent = `Parkur ${info.stage + 1}'e Geç`;
    this.setState('complete');
  }

  handleGentleEnd(info) {
    document.getElementById('end-stage').textContent = info.stage;
    document.getElementById('end-stars').textContent = `★ ${info.stars}`;
    this.setState('end');
  }

  renderHud(hud) {
    this.stageValEl.textContent = hud.stage;
    this.starsValEl.textContent = `★ ${hud.stars}`;
    this.streakValEl.textContent = `${hud.streak || 0}x`;
    this.progressTextEl.textContent = `${hud.clearedCount} / ${hud.totalObstacles}`;
    this.progressFillEl.style.width = `${Math.round(hud.progress * 100)}%`;

    if (hud.calmMode) {
      this.heartsLabelEl.textContent = 'Mod';
      this.heartsValEl.textContent = 'Rahat';
      this.heartsValEl.className = 'hud-value hud-mode-tag';
      this.heartsValEl.style.color = '';
    } else {
      this.heartsLabelEl.textContent = 'Kalp';
      let hearts = '';
      for (let i = 0; i < hud.maxLives; i++) {
        hearts += i < hud.lives ? '♥' : '♡';
      }
      this.heartsValEl.textContent = hearts;
      this.heartsValEl.className = 'hud-value';
      this.heartsValEl.style.color = '#c97b63';
    }
  }

  loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.engine.update(dt);
    this.engine.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  async start() {
    this.resizeCanvas();
    this.engine.notifyHud();
    requestAnimationFrame((t) => this.loop(t));

    this.tracker.onTrackingCallback = (data) => {
      this.engine.setInput({
        lane: data.lane,
        isJumping: data.isJumping,
        isCrouching: data.isCrouching,
        hasLegTracking: data.hasLegTracking,
        pose: data.pose,
        bodyScale: data.bodyScale
      });
    };

    this.tracker.onCalibrationSuccess = () => {
      this.hubStatusEl.textContent = 'Kamera hazır — Oyuncu algılandı!';
      this.hubStatusEl.className = 'hub-badge status-ready';
    };

    setTimeout(() => {
      if (!this.tracker.calibrationPassed) {
        this.hubStatusEl.textContent = 'Kamera bekleniyor (İstersen klavye ile hemen başlayabilirsin)';
        this.hubStatusEl.className = 'hub-badge status-connecting';
      }
    }, 2500);

    try {
      await this.tracker.initialize();
    } catch (e) {
      console.warn('Kamera başlatma atlandı:', e);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new ParkourApp();
  app.start();
});
