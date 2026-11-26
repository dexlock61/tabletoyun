/**
 * app.js
 * Doğa Parkuru — Mobil, Tablet, TV ve PC uyumlu tek kolon sade ekran yöneticisi.
 */

import { PoseTracker } from './pose-tracker.js';
import { ParkourEngine } from './modules/parkour.js';
import { sfx } from './modules/sound.js';

class ParkourApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.gameHud = document.getElementById('game-hud');

    // Ortak kamera kutusu ve yerleştirilebileceği yuvalar
    this.cameraBox = document.getElementById('camera-box');
    this.hiddenCameraHost = document.getElementById('camera-hidden-host');
    this.welcomeCameraSlot = document.getElementById('welcome-camera-slot');
    this.settingsCameraSlot = document.getElementById('settings-camera-slot');
    this.pipCameraSlot = document.getElementById('pip-camera-slot');

    // Ekran katmanları
    this.screenWelcome = document.getElementById('screen-welcome');
    this.screenSettings = document.getElementById('screen-settings');
    this.screenPause = document.getElementById('screen-pause');
    this.screenComplete = document.getElementById('screen-complete');
    this.screenEnd = document.getElementById('screen-end');

    // HUD elemanları
    this.stageValEl = document.getElementById('stage-val');
    this.progressFillEl = document.getElementById('progress-fill');
    this.starsValEl = document.getElementById('stars-val');
    this.streakValEl = document.getElementById('streak-val');
    this.heartsValEl = document.getElementById('hearts-val');

    // Düğmeler & ayarlar
    this.btnStart = document.getElementById('btn-start');
    this.btnStartTv = document.getElementById('btn-start-tv');
    this.btnWelcomeSettings = document.getElementById('btn-welcome-settings');
    this.btnQuickSwitchCam = document.getElementById('btn-quick-switch-cam');

    this.btnTogglePip = document.getElementById('btn-toggle-pip');
    this.btnFullscreen = document.getElementById('btn-fullscreen');
    this.btnHudSettings = document.getElementById('btn-hud-settings');
    this.btnPause = document.getElementById('btn-pause');
    this.btnHideHud = document.getElementById('btn-hide-hud');
    this.btnShowHud = document.getElementById('btn-show-hud');

    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.btnSwitchCam = document.getElementById('btn-switch-cam');
    this.btnRecalibrate = document.getElementById('btn-recalibrate');
    this.btnMute = document.getElementById('btn-mute');
    this.btnMusic = document.getElementById('btn-music');
    this.btnSettingsHome = document.getElementById('btn-settings-home');

    this.btnResume = document.getElementById('btn-resume');
    this.btnPauseSettings = document.getElementById('btn-pause-settings');
    this.btnPauseHome = document.getElementById('btn-pause-home');
    this.btnNextStage = document.getElementById('btn-next-stage');
    this.btnCompleteHome = document.getElementById('btn-complete-home');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnEndHome = document.getElementById('btn-end-home');

    this.speedSlider = document.getElementById('speed-slider');
    this.speedValueEl = document.getElementById('speed-value');
    this.calmModeToggle = document.getElementById('calm-mode-toggle');
    this.tabletSpeedToggle = document.getElementById('tablet-speed-toggle');
    this.pipToggle = document.getElementById('pip-toggle');

    this.state = 'welcome'; // welcome | playing | paused | complete | end
    this.settingsReturnState = 'welcome';
    this.showPipInGame = false;
    this.hudHiddenByUser = false;
    this.isInPrepPhase = false;
    this.lastTime = performance.now();
    this.isMuted = false;
    this.musicEnabled = true;
    this.wakeLockSentinel = null;

    this.tracker = new PoseTracker();
    this.engine = new ParkourEngine(this.canvas, {
      onHudUpdate: (hud) => this.renderHud(hud),
      onStageComplete: (info) => this.handleStageComplete(info),
      onGentleEnd: (info) => this.handleGentleEnd(info),
      onAutoRecalibrate: () => this.tracker.recalibrate(),
      onPrepStateChange: (inPrep) => this.handlePrepStateChange(inPrep)
    });

    if (this.tabletSpeedToggle) {
      this.tabletSpeedToggle.checked = this.tracker.fastMode;
    }
    if (this.pipToggle) {
      this.pipToggle.checked = this.showPipInGame;
    }

    // Başlangıçta kamerayı ana menü önizleme yuvasına yerleştir
    this.mountCamera('welcome');
    this.bindEvents();
  }

  /**
   * Tek video akışını bozmadan kamera kutusunu ilgili yuvaya yerleştirir.
   */
  mountCamera(target) {
    this.pipCameraSlot.classList.add('hidden');

    if (target === 'welcome') {
      this.welcomeCameraSlot.appendChild(this.cameraBox);
    } else if (target === 'settings') {
      this.settingsCameraSlot.appendChild(this.cameraBox);
    } else if (target === 'pip' && (this.showPipInGame || this.isInPrepPhase)) {
      this.pipCameraSlot.classList.remove('hidden');
      this.pipCameraSlot.appendChild(this.cameraBox);
    } else {
      this.hiddenCameraHost.appendChild(this.cameraBox);
    }

    // DOM taşıma sonrası tarayıcı videoyu duraklatırsa anında devam ettir
    const vid = this.tracker.videoElement;
    if (vid && vid.srcObject && vid.paused) {
      vid.play().catch(() => {});
    }
  }

  bindEvents() {
    this.btnStart.addEventListener('click', () => {
      sfx.init();
      this.tracker.recalibrate();
      this.requestWakeLock();
      this.startPlaying(1, true);
    });

    this.btnStartTv.addEventListener('click', async () => {
      sfx.init();
      this.tracker.recalibrate();
      this.requestWakeLock();
      await this.toggleFullscreen(true);
      this.startPlaying(1, true);
    });

    this.btnWelcomeSettings.addEventListener('click', () => this.openSettings('welcome'));

    this.btnHudSettings.addEventListener('click', () => {
      if (this.state === 'playing') {
        this.engine.stop();
        this.openSettings('paused');
      } else {
        this.openSettings(this.state);
      }
    });

    this.btnPauseSettings.addEventListener('click', () => this.openSettings('paused'));

    this.btnCloseSettings.addEventListener('click', () => this.closeSettings());

    this.btnTogglePip.addEventListener('click', () => {
      this.setPipVisible(!this.showPipInGame);
    });

    this.pipToggle.addEventListener('change', (e) => {
      this.setPipVisible(e.target.checked);
    });

    this.btnFullscreen.addEventListener('click', () => {
      this.toggleFullscreen(!document.fullscreenElement);
    });

    this.btnPause.addEventListener('click', () => {
      if (this.state === 'playing') {
        this.engine.stop();
        this.setState('paused');
      }
    });

    this.btnHideHud.addEventListener('click', () => {
      this.hudHiddenByUser = true;
      this.updateHudVisibility();
    });

    this.btnShowHud.addEventListener('click', () => {
      this.hudHiddenByUser = false;
      this.updateHudVisibility();
    });

    this.btnResume.addEventListener('click', () => this.resumePlaying());

    [this.btnPauseHome, this.btnCompleteHome, this.btnEndHome, this.btnSettingsHome].forEach((btn) => {
      btn.addEventListener('click', () => {
        this.engine.stop();
        this.screenSettings.classList.add('hidden');
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

    const handleSwitchCam = async () => {
      this.btnSwitchCam.disabled = true;
      this.btnQuickSwitchCam.disabled = true;
      const mode = await this.tracker.switchCamera();
      this.btnSwitchCam.textContent = mode === 'user' ? 'Kamera: Ön' : 'Kamera: Arka';
      this.btnSwitchCam.disabled = false;
      this.btnQuickSwitchCam.disabled = false;
    };

    this.btnSwitchCam.addEventListener('click', handleSwitchCam);
    this.btnQuickSwitchCam.addEventListener('click', handleSwitchCam);

    this.btnRecalibrate.addEventListener('click', () => {
      this.tracker.recalibrate();
      this.engine.showFeedback('Boy hizalaması yenilendi', '#46733f');
    });

    this.btnMute.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      sfx.setMuted(this.isMuted);
      this.btnMute.textContent = this.isMuted ? 'Ses: Kapalı' : 'Ses: Açık';
    });

    this.btnMusic.addEventListener('click', () => {
      this.musicEnabled = !this.musicEnabled;
      sfx.setMusicEnabled(this.musicEnabled);
      this.btnMusic.textContent = this.musicEnabled ? 'Müzik: Açık' : 'Müzik: Kapalı';
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
    });

    document.addEventListener('fullscreenchange', () => {
      this.btnFullscreen.classList.toggle('active', !!document.fullscreenElement);
      setTimeout(() => this.resizeCanvas(), 80);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.state === 'playing') {
        this.requestWakeLock();
      }
    });

    // Klavye kontrolleri (PC testi için)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        if (this.state === 'playing') {
          this.engine.stop();
          this.setState('paused');
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

  setPipVisible(visible) {
    this.showPipInGame = !!visible;
    this.pipToggle.checked = this.showPipInGame;
    this.btnTogglePip.classList.toggle('active', this.showPipInGame);
    if (this.state === 'playing' && this.screenSettings.classList.contains('hidden')) {
      this.mountCamera(this.showPipInGame ? 'pip' : 'hidden');
    }
  }

  openSettings(returnState) {
    this.settingsReturnState = returnState;
    this.btnSettingsHome.classList.toggle('hidden', returnState === 'welcome');
    this.screenSettings.classList.remove('hidden');
    this.screenSettings.scrollTop = 0;
    this.mountCamera('settings');
  }

  closeSettings() {
    this.screenSettings.classList.add('hidden');
    if (this.settingsReturnState === 'welcome') {
      this.setState('welcome');
    } else if (this.settingsReturnState === 'paused') {
      this.setState('paused');
    } else {
      this.setState(this.settingsReturnState);
    }
  }

  async toggleFullscreen(enable) {
    try {
      if (enable && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (!enable && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (e) {
      // Desteklenmiyorsa sessizce geç
    }
    requestAnimationFrame(() => this.resizeCanvas());
  }

  async requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      if (this.wakeLockSentinel) return;
      this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });
    } catch (e) {
      // Desteklenmiyorsa geç
    }
  }

  handlePrepStateChange(inPrep) {
    this.isInPrepPhase = !!inPrep;
    if (this.state === 'playing' && this.screenSettings.classList.contains('hidden')) {
      // 5 sn hazırlık sürecinde çocuk kendini görsün diye küçük kamerayı göster;
      // koşu başlayınca oyun içi önizleme kapalıysa otomatik gizle!
      if (this.isInPrepPhase || this.showPipInGame) {
        this.pipCameraSlot.classList.remove('hidden');
        this.pipCameraSlot.appendChild(this.cameraBox);
        const vid = this.tracker.videoElement;
        if (vid && vid.srcObject && vid.paused) vid.play().catch(() => {});
      } else {
        this.mountCamera('hidden');
      }
    }
  }

  updateHudVisibility() {
    const playing = this.state === 'playing';
    this.gameHud.classList.toggle('hidden', !playing || this.hudHiddenByUser);
    this.btnShowHud.classList.toggle('hidden', !playing || !this.hudHiddenByUser);
  }

  resizeCanvas() {
    // Gerçek Retina / HiDPI HD çözünürlük (telefon/tabletlerde bulanık 480p görünümünü tamamen giderir!)
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);

    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.engine.setViewport(cssW, cssH);
  }

  setState(newState) {
    this.state = newState;

    this.screenWelcome.classList.toggle('hidden', newState !== 'welcome');
    this.screenPause.classList.toggle('hidden', newState !== 'paused');
    this.screenComplete.classList.toggle('hidden', newState !== 'complete');
    this.screenEnd.classList.toggle('hidden', newState !== 'end');

    this.updateHudVisibility();

    if (newState === 'welcome') {
      this.screenWelcome.scrollTop = 0;
      this.mountCamera('welcome');
    } else if (newState === 'playing') {
      this.mountCamera(this.showPipInGame || this.isInPrepPhase ? 'pip' : 'hidden');
    } else {
      this.mountCamera('hidden');
    }

    requestAnimationFrame(() => this.resizeCanvas());
  }

  startPlaying(stageNum, resetStars) {
    this.screenSettings.classList.add('hidden');
    this.setState('playing');
    this.engine.startStage(stageNum, resetStars);
  }

  resumePlaying() {
    this.screenSettings.classList.add('hidden');
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
    this.stageValEl.textContent = `P${hud.stage}`;
    this.starsValEl.textContent = `★ ${hud.stars}`;
    this.streakValEl.textContent = `${hud.streak || 0}x`;
    this.progressFillEl.style.width = `${Math.round(hud.progress * 100)}%`;

    if (hud.calmMode) {
      this.heartsValEl.textContent = 'Rahat';
      this.heartsValEl.style.color = '';
    } else {
      this.heartsValEl.textContent = `♥ ${hud.lives}`;
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
