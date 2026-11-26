/**
 * parkour.js
 * Birinci Şahıs (POV) Canlı Macera Parkuru Motoru.
 * Parlamayan, göz yormayan ama heyecanlı ve tempolu masal doğa parkuru:
 * - 3 şeritli sağa/sola kaçınma ve slalom geçişleri
 * - Zıplama kütükleri, parkur çubukları ve dere atlayışları
 * - Bayraklı ve yapraklı eğilme kemerleri
 * - Ayna Kapısı (Mirror Me) — eşleşince kapılar iki yana açılır ve hız desteği verir!
 * - Yol boyunca toplanabilir dönen altın yıldızlar, seri (kombo) sistemi ve 3-2-1 başlangıç!
 */

import { sfx } from './sound.js';
import { CalmParticle } from './particles.js';
import { MIRROR_POSES, drawTargetPoseSilhouette, drawLiveMirrorOverlay } from './poses.js';

const LANE_WIDTH = 2.05;
const ROAD_HALF_WIDTH = LANE_WIDTH * 1.55;
const VIEW_DISTANCE = 50;

export class ParkourEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    this.stage = 1;
    this.stars = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.lives = 5;
    this.maxLives = 5;
    this.calmMode = true;
    this.speedMultiplier = 1.0;

    // POV Kamera ve Oyuncu Durumu
    this.playerLane = 0; // -1: Sol, 0: Orta, 1: Sağ
    this.cameraX = 0;
    this.cameraY = 1.55;
    this.cameraRoll = 0; // Şerit değiştirirken hafif eğlenceli yatış açısı

    // Zıplama ve Eğilme fiziği
    this.jumpTimer = 0;
    this.jumpDuration = 0.68;
    this.wasJumpInput = false;

    this.crouchAmount = 0;
    this.crouchGraceTimer = 0;
    this.wasCrouchInput = false;

    // Hız desteği (Ayna Kapısı veya yüksek seri sonrası kısa neşeli rüzgar)
    this.boostTimer = 0;

    // 3-2-1 Başlangıç geri sayımı
    this.countdownTimer = 0;
    this.lastCountdownNum = 0;

    // İlerleme ve nesneler
    this.distance = 0;
    this.stageLength = 100;
    this.obstacles = [];
    this.collectibles = [];
    this.scenery = [];
    this.clouds = [];
    this.butterflies = [];
    this.particles = [];

    this.clearedCount = 0;
    this.totalObstacles = 12;

    // Geri bildirim mesajı
    this.feedbackText = '';
    this.feedbackColor = '#46733f';
    this.feedbackTimer = 0;

    // Canlı kamera poz verisi
    this.livePose = null;
    this.liveBodyScale = 0.22;
    this.liveHasLegs = false;
    this.liveIsCrouching = false;
    this.manualPoseId = null;
    this.manualPoseTimer = 0;
    this.poseDeck = [];

    this.time = 0;
    this.isRunning = false;

    this.initAtmosphere();
    this.initScenery();
  }

  initAtmosphere() {
    this.clouds = [
      { x: 0.14, y: 0.13, scale: 1.05, speed: 0.005 },
      { x: 0.48, y: 0.09, scale: 0.9, speed: 0.0038 },
      { x: 0.8, y: 0.15, scale: 1.12, speed: 0.0044 }
    ];
    this.butterflies = [
      { x: 0.25, y: 0.34, phase: 0, speed: 0.035, color: '#e6a65c' },
      { x: 0.72, y: 0.31, phase: 2.1, speed: -0.03, color: '#d97b66' }
    ];
  }

  initScenery() {
    this.scenery = [];
    for (let z = 3; z <= VIEW_DISTANCE; z += 3.8) {
      this.scenery.push(this.createSceneryItem(-1, z + Math.random() * 1.4));
      this.scenery.push(this.createSceneryItem(1, z + Math.random() * 1.4));
    }
  }

  createSceneryItem(side, z) {
    const types = ['pine', 'roundTree', 'flagPost', 'flowerBush', 'pine', 'roundTree'];
    const type = types[Math.floor(Math.random() * types.length)];
    const isFlag = type === 'flagPost';
    return {
      side,
      x: isFlag
        ? side * (ROAD_HALF_WIDTH + 0.55)
        : side * (ROAD_HALF_WIDTH + 1.4 + Math.random() * 4.4),
      z,
      type,
      scale: 0.85 + Math.random() * 0.45,
      tint: Math.floor(Math.random() * 3)
    };
  }

  startStage(stageNum = 1, resetStars = false) {
    this.stage = stageNum;
    if (resetStars) {
      this.stars = 0;
      this.bestStreak = 0;
    }
    this.streak = 0;
    this.lives = this.maxLives;
    this.distance = 0;
    this.clearedCount = 0;
    this.particles = [];
    this.feedbackText = '';
    this.feedbackTimer = 0;
    this.jumpTimer = 0;
    this.crouchAmount = 0;
    this.crouchGraceTimer = 0;
    this.boostTimer = 0;

    // 3-2-1 Canlı başlangıç!
    this.countdownTimer = 2.4;
    this.lastCountdownNum = 4;

    this.generateStageCourse(stageNum);
    this.isRunning = true;
    this.notifyHud();
  }

  stop() {
    this.isRunning = false;
    sfx.stopMusic();
  }

  /**
   * Tempolu, ritmik ve eğlenceli parkur oluşturur.
   * Engellerin arasına toplanacak altın yıldız dizileri ekler!
   */
  generateStageCourse(stageNum) {
    this.obstacles = [];
    this.collectibles = [];

    const count = Math.min(18, 12 + (stageNum - 1) * 2);
    this.totalObstacles = count;

    let nextZ = 22;
    const baseGap = Math.max(14.5, 18.5 - (stageNum - 1) * 0.75);

    const patternPool = ['dodge', 'jump', 'duck', 'mirror'];
    let lastType = null;
    let lastOpenLane = 0;

    for (let i = 0; i < count; i++) {
      let type;
      if (i < 4) {
        type = patternPool[i];
      } else {
        // Dodge ve Jump biraz daha sık, Mirror Me her 3-4 engelde bir sürpriz!
        const weighted = ['dodge', 'jump', 'duck', 'dodge', 'mirror'];
        const candidates = weighted.filter((t) => t !== lastType);
        type = candidates[Math.floor(Math.random() * candidates.length)];
      }
      lastType = type;

      if (type === 'dodge') {
        const allLanes = [-1, 0, 1];
        const possibleOpen = allLanes.filter((l) => l !== lastOpenLane);
        const openLane = possibleOpen[Math.floor(Math.random() * possibleOpen.length)];
        lastOpenLane = openLane;

        const blockedLanes = allLanes.filter((l) => l !== openLane);
        if (stageNum === 1 && i < 2) {
          blockedLanes.splice(Math.floor(Math.random() * blockedLanes.length), 1);
        }

        const styles = ['fence', 'hay', 'crates'];
        const style = styles[Math.floor(Math.random() * styles.length)];
        this.obstacles.push({
          type: 'dodge',
          z: nextZ,
          blockedLanes,
          openLane,
          style,
          resolved: false,
          hit: false
        });

        // Açık şeridin hemen önüne ve arkasına 2 davetkâr yıldız koy!
        this.collectibles.push({ lane: openLane, y: 0.95, z: nextZ - 4.2, collected: false });
        this.collectibles.push({ lane: openLane, y: 0.95, z: nextZ + 3.5, collected: false });
      } else if (type === 'jump') {
        const styles = ['log', 'hurdle', 'brook'];
        const style = styles[Math.floor(Math.random() * styles.length)];
        this.obstacles.push({
          type: 'jump',
          z: nextZ,
          style,
          resolved: false,
          hit: false
        });

        // Zıplama engelinin tam üstünde havada ödül yıldızı!
        this.collectibles.push({ lane: lastOpenLane, y: 2.05, z: nextZ, collected: false, high: true });
      } else if (type === 'duck') {
        const style = Math.random() < 0.5 ? 'bunting' : 'branch';
        this.obstacles.push({
          type: 'duck',
          z: nextZ,
          style,
          resolved: false,
          hit: false
        });

        // Eğilme kemerinin altında alçak ödül yıldızı!
        this.collectibles.push({ lane: lastOpenLane, y: 0.55, z: nextZ, collected: false, low: true });
      } else if (type === 'mirror') {
        const poseDef = this.drawNextMirrorPose();
        this.obstacles.push({
          type: 'mirror',
          z: nextZ + 3,
          poseDef,
          holdTime: 0,
          requiredHold: 0.22,
          matched: false,
          curtainOpen: 0,
          resolved: false,
          hit: false
        });
        nextZ += 4;
      }

      nextZ += baseGap;
    }

    // Bitiş öncesi 3'lü kutlama yıldızı!
    for (let s = 0; s < 3; s++) {
      this.collectibles.push({ lane: 0, y: 0.95, z: nextZ + s * 2.4, collected: false });
    }

    this.stageLength = nextZ + 11;
    this.obstacles.push({
      type: 'finish',
      z: this.stageLength,
      resolved: false
    });
  }

  drawNextMirrorPose() {
    if (!this.poseDeck || this.poseDeck.length === 0) {
      // Tüm pozları karıştır (bacaklı ve kollu pozlar dengeli dağılsın)
      this.poseDeck = [...MIRROR_POSES];
      for (let i = this.poseDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.poseDeck[i], this.poseDeck[j]] = [this.poseDeck[j], this.poseDeck[i]];
      }
    }
    return this.poseDeck.pop();
  }

  setInput({ lane, isJumping, isCrouching, hasLegTracking, pose, bodyScale }) {
    if (typeof lane === 'number' && lane !== this.playerLane) {
      this.playerLane = Math.max(-1, Math.min(1, lane));
      if (this.isRunning && this.countdownTimer <= 0) sfx.playStep();
    }

    if (isJumping && !this.wasJumpInput && this.jumpTimer <= 0) {
      this.jumpTimer = this.jumpDuration;
      if (this.isRunning && this.countdownTimer <= 0) sfx.playJump();
    }
    this.wasJumpInput = !!isJumping;

    if (isCrouching) {
      if (!this.wasCrouchInput && this.isRunning && this.countdownTimer <= 0) {
        sfx.playDuck();
      }
      this.crouchGraceTimer = 0.25;
    }
    this.wasCrouchInput = !!isCrouching;
    this.liveIsCrouching = !!isCrouching;

    if (typeof hasLegTracking === 'boolean') this.liveHasLegs = hasLegTracking;
    if (pose) this.livePose = pose;
    if (bodyScale) this.liveBodyScale = bodyScale;
  }

  triggerMatchCurrentMirrorPose() {
    const upcoming = this.obstacles.find((o) => o.type === 'mirror' && !o.matched && o.z - this.distance > 0.5 && o.z - this.distance < 24);
    if (upcoming) {
      this.manualPoseId = upcoming.poseDef.id;
      this.manualPoseTimer = 1.1;
    }
  }

  triggerKeyboardJump() {
    if (this.jumpTimer <= 0) {
      this.jumpTimer = this.jumpDuration;
      if (this.isRunning && this.countdownTimer <= 0) sfx.playJump();
    }
  }

  triggerKeyboardCrouch() {
    if (this.crouchGraceTimer <= 0.05 && this.isRunning && this.countdownTimer <= 0) {
      sfx.playDuck();
    }
    this.crouchGraceTimer = 0.55;
  }

  triggerManualPose(poseIndex) {
    const p = MIRROR_POSES[poseIndex];
    if (p) {
      this.manualPoseId = p.id;
      this.manualPoseTimer = 1.1;
    }
  }

  showFeedback(text, color = '#46733f') {
    this.feedbackText = text;
    this.feedbackColor = color;
    this.feedbackTimer = 1.25;
  }

  spawnCelebration(x, y, count = 14) {
    const palette = ['#e8b84b', '#76a06d', '#df7f62', '#6ea4bf', '#faf6ec'];
    for (let i = 0; i < count; i++) {
      const col = palette[i % palette.length];
      const shape = i % 3 === 0 ? 'star' : i % 3 === 1 ? 'confetti' : 'leaf';
      this.particles.push(new CalmParticle(x, y, col, shape));
    }
  }

  notifyHud() {
    if (this.callbacks.onHudUpdate) {
      this.callbacks.onHudUpdate({
        stage: this.stage,
        stars: this.stars,
        streak: this.streak,
        bestStreak: this.bestStreak,
        lives: this.lives,
        maxLives: this.maxLives,
        calmMode: this.calmMode,
        clearedCount: this.clearedCount,
        totalObstacles: this.totalObstacles,
        progress: Math.min(1, this.distance / Math.max(1, this.stageLength))
      });
    }
  }

  update(dt) {
    this.time += dt;

    // Bulutlar ve kelebekler
    this.clouds.forEach((c) => {
      c.x += c.speed * dt;
      if (c.x > 1.18) c.x = -0.18;
    });

    this.butterflies.forEach((b) => {
      b.x += b.speed * dt;
      b.phase += dt * 5;
      if (b.x > 1.12) b.x = -0.12;
      if (b.x < -0.12) b.x = 1.12;
    });

    // Parçacıklar
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].alpha <= 0) this.particles.splice(i, 1);
    }

    if (this.feedbackTimer > 0) this.feedbackTimer = Math.max(0, this.feedbackTimer - dt);
    if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - dt);

    if (this.manualPoseTimer > 0) {
      this.manualPoseTimer = Math.max(0, this.manualPoseTimer - dt);
      if (this.manualPoseTimer === 0) this.manualPoseId = null;
    }

    // POV Kamera yatay hareket + hafif eğlenceli yatış (tilt)
    const targetCamX = this.playerLane * LANE_WIDTH;
    const prevCamX = this.cameraX;
    this.cameraX += (targetCamX - this.cameraX) * Math.min(1, dt * 10.5);
    const camVelX = (this.cameraX - prevCamX) / Math.max(0.001, dt);
    const targetRoll = Math.max(-0.042, Math.min(0.042, -camVelX * 0.0055));
    this.cameraRoll += (targetRoll - this.cameraRoll) * Math.min(1, dt * 9);

    // Zıplama yüksekliği
    let jumpOffset = 0;
    if (this.jumpTimer > 0) {
      this.jumpTimer = Math.max(0, this.jumpTimer - dt);
      const t = 1 - this.jumpTimer / this.jumpDuration;
      jumpOffset = Math.sin(t * Math.PI) * 1.55;
    }

    // Eğilme yumuşak geçişi
    if (this.crouchGraceTimer > 0) {
      this.crouchGraceTimer = Math.max(0, this.crouchGraceTimer - dt);
    }
    const targetCrouch = this.crouchGraceTimer > 0 && jumpOffset < 0.15 ? 1 : 0;
    this.crouchAmount += (targetCrouch - this.crouchAmount) * Math.min(1, dt * 11);

    const strideBob = this.isRunning && this.countdownTimer <= 0 && jumpOffset === 0 && this.crouchAmount < 0.3
      ? Math.sin(this.distance * 1.65) * 0.055
      : 0;

    this.cameraY = 1.55 + jumpOffset - this.crouchAmount * 0.88 + strideBob;

    if (!this.isRunning) return;

    // 3-2-1 Başlangıç geri sayımı
    if (this.countdownTimer > 0) {
      this.countdownTimer -= dt;
      const curNum = Math.ceil(this.countdownTimer / 0.75);
      if (curNum !== this.lastCountdownNum && curNum >= 1 && curNum <= 3) {
        this.lastCountdownNum = curNum;
        sfx.playCountdown(false);
      }
      if (this.countdownTimer <= 0) {
        this.countdownTimer = 0;
        sfx.playCountdown(true);
        sfx.startMusic();
        this.showFeedback('Başladık! Koş!', '#46733f');
      }
      return;
    }

    // Ayna Kapısı yaklaşırken poz kopyalamak için hafif yavaşlatma
    let mirrorSlowFactor = 1.0;
    for (const obs of this.obstacles) {
      if (obs.type === 'mirror' && !obs.matched) {
        const relZ = obs.z - this.distance;
        if (relZ > 1.2 && relZ < 16.5) {
          mirrorSlowFactor = 0.58;
          break;
        }
      }
    }

    // Seri & Hız desteği faktörü (heyecanlı ama kontrollü!)
    const streakBonus = 1.0 + Math.min(0.18, this.streak * 0.025);
    const boostFactor = this.boostTimer > 0 ? 1.22 : 1.0;

    // Canlı, keyifli koşu hızı
    const baseSpeed = (9.6 + (this.stage - 1) * 0.8) * this.speedMultiplier * mirrorSlowFactor * streakBonus * boostFactor;
    const step = baseSpeed * dt;
    this.distance += step;

    // Kenar dekorları kaydır
    for (const item of this.scenery) {
      item.z -= step;
      if (item.z < 1.1) {
        item.z += VIEW_DISTANCE;
        item.x = item.type === 'flagPost'
          ? item.side * (ROAD_HALF_WIDTH + 0.55)
          : item.side * (ROAD_HALF_WIDTH + 1.4 + Math.random() * 4.4);
      }
    }

    const isAirborne = jumpOffset > 0.3;
    const isDucked = this.crouchAmount > 0.4;

    // Toplanabilir altın yıldız kontrolü
    for (const col of this.collectibles) {
      if (col.collected) continue;
      const relZ = col.z - this.distance;
      if (relZ <= 1.8 && relZ >= -0.6) {
        const laneMatch = col.high || col.low ? true : Math.abs(col.lane - this.playerLane) === 0;
        const heightMatch = col.high ? isAirborne : col.low ? isDucked : true;
        if (laneMatch && heightMatch) {
          col.collected = true;
          this.stars += 1;
          sfx.playStar(this.streak);
          const proj = this.project(col.lane * LANE_WIDTH, col.y, Math.max(1.2, relZ));
          this.spawnCelebration(proj.x, proj.y, 8);
          this.notifyHud();
        }
      }
    }

    // Engeller ve Ayna Kapıları
    for (const obs of this.obstacles) {
      const relZ = obs.z - this.distance;

      // Ayna Kapısı poz kontrolü
      if (obs.type === 'mirror' && !obs.matched && relZ < 22 && relZ > 0.6) {
        const poseMatched =
          (this.manualPoseId && this.manualPoseId === obs.poseDef.id) ||
          obs.poseDef.check(this.livePose, this.liveBodyScale, {
            isCrouching: this.liveIsCrouching || this.crouchAmount > 0.4,
            hasLegTracking: this.liveHasLegs
          });

        if (poseMatched) {
          obs.holdTime += dt;
          if (obs.holdTime >= obs.requiredHold) {
            obs.matched = true;
            this.streak++;
            this.bestStreak = Math.max(this.bestStreak, this.streak);
            this.stars += 3;
            this.boostTimer = 1.6;
            sfx.playPoseMatch();
            this.showFeedback(`Süper! +3 Yıldız — ${obs.poseDef.title}!`, '#46733f');
            this.spawnCelebration(this.canvas.width * 0.5, this.canvas.height * 0.44, 22);
            this.notifyHud();
          }
        } else {
          obs.holdTime = Math.max(0, obs.holdTime - dt * 0.75);
        }
      }

      if (obs.type === 'mirror' && obs.matched && obs.curtainOpen < 1) {
        obs.curtainOpen = Math.min(1, obs.curtainOpen + dt * 3.5);
      }

      // Engel geçiş kararı
      if (!obs.resolved && relZ <= 1.35) {
        obs.resolved = true;

        if (obs.type === 'finish') {
          this.isRunning = false;
          sfx.stopMusic();
          sfx.playStageComplete();
          this.spawnCelebration(this.canvas.width * 0.5, this.canvas.height * 0.4, 30);
          this.notifyHud();
          if (this.callbacks.onStageComplete) {
            this.callbacks.onStageComplete({
              stage: this.stage,
              stars: this.stars,
              bestStreak: this.bestStreak
            });
          }
          return;
        }

        let passed = true;
        if (obs.type === 'dodge') {
          passed = !obs.blockedLanes.includes(this.playerLane);
        } else if (obs.type === 'jump') {
          passed = isAirborne;
        } else if (obs.type === 'duck') {
          passed = isDucked;
        } else if (obs.type === 'mirror') {
          passed = obs.matched;
        }

        this.clearedCount++;

        if (passed) {
          if (obs.type !== 'mirror') {
            this.streak++;
            this.bestStreak = Math.max(this.bestStreak, this.streak);
            this.stars += 1;
            sfx.playClear(this.streak);

            let msg =
              obs.type === 'jump'
                ? 'Müthiş Zıplama!'
                : obs.type === 'duck'
                  ? 'Harika Eğildin!'
                  : 'Süper Kaçış!';
            if (this.streak >= 3) {
              msg = `${msg} (${this.streak}x Seri!)`;
            }
            this.showFeedback(msg, '#46733f');
            this.spawnCelebration(this.canvas.width * 0.5, this.canvas.height * 0.5, 12);
          }
        } else {
          obs.hit = true;
          this.streak = 0;
          this.boostTimer = 0;
          sfx.playBump();
          if (!this.calmMode) {
            this.lives = Math.max(0, this.lives - 1);
          }
          const gentleHint =
            obs.type === 'jump'
              ? 'Hop! Bir dahakine zıplayalım!'
              : obs.type === 'duck'
                ? 'Hop! Bir dahakine eğilelim!'
                : obs.type === 'mirror'
                  ? 'Bir dahakine pozu yakalayalım!'
                  : 'Sorun değil, koşmaya devam!';
          this.showFeedback(gentleHint, '#b35c44');

          if (!this.calmMode && this.lives <= 0) {
            this.isRunning = false;
            sfx.stopMusic();
            sfx.playGentleEnd();
            this.notifyHud();
            if (this.callbacks.onGentleEnd) {
              this.callbacks.onGentleEnd({
                stage: this.stage,
                stars: this.stars,
                bestStreak: this.bestStreak
              });
            }
            return;
          }
        }

        this.notifyHud();
      }
    }

    this.notifyHud();
  }

  project(worldX, worldY, relZ) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const z = Math.max(0.25, relZ);
    const focal = Math.min(w, h) * 0.72;
    const horizonY = h * 0.41;

    const scale = focal / z;
    const sx = w * 0.5 + (worldX - this.cameraX) * scale;
    const sy = horizonY + (this.cameraY - worldY) * scale;
    return { x: sx, y: sy, scale };
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // Hafif dinamik POV yatış (şerit değiştirirken canlı koşu hissi verir)
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this.cameraRoll);
    ctx.translate(-w / 2, -h / 2);

    this.drawSkyAndHills(ctx, w, h);
    this.drawPathAndLanes(ctx, w, h);

    // Derinlik sıralı çizim (ağaçlar + bayraklar + yıldızlar + engeller)
    const renderables = [];

    for (const item of this.scenery) {
      if (item.z > 0.8 && item.z < VIEW_DISTANCE) {
        renderables.push({ kind: 'scenery', z: item.z, obj: item });
      }
    }

    for (const col of this.collectibles) {
      if (col.collected) continue;
      const relZ = col.z - this.distance;
      if (relZ > 0.6 && relZ < VIEW_DISTANCE) {
        renderables.push({ kind: 'star', z: relZ, obj: col });
      }
    }

    for (const obs of this.obstacles) {
      const relZ = obs.z - this.distance;
      if (relZ > 0.5 && relZ < VIEW_DISTANCE) {
        renderables.push({ kind: 'obstacle', z: relZ, obj: obs });
      }
    }

    renderables.sort((a, b) => b.z - a.z);

    for (const r of renderables) {
      if (r.kind === 'scenery') {
        this.drawSceneryItem(ctx, r.obj, r.z);
      } else if (r.kind === 'star') {
        this.drawCollectibleStar(ctx, r.obj, r.z);
      } else {
        this.drawObstacle(ctx, r.obj, r.z);
      }
    }

    // Hız rüzgarı çizgileri (sadece hız desteği veya 4+ seri varken, çok nazik beyaz çizgiler)
    if (this.isRunning && this.countdownTimer <= 0 && (this.boostTimer > 0 || this.streak >= 4)) {
      this.drawGentleWindLines(ctx, w, h);
    }

    ctx.restore();

    // Parçacıklar ve arayüz ipuçları (düz, yatışsız)
    for (const p of this.particles) {
      p.draw(ctx);
    }

    if (this.isRunning && this.countdownTimer > 0) {
      this.drawCountdownOverlay(ctx, w, h);
    } else if (this.isRunning) {
      this.drawUpcomingCue(ctx, w);
      this.drawStanceIndicator(ctx, w, h);
    }

    if (this.feedbackTimer > 0 && this.feedbackText) {
      this.drawFeedbackToast(ctx, w, h);
    }
  }

  drawSkyAndHills(ctx, w, h) {
    const horizonY = h * 0.41;

    // Canlı, güneşli ama mat masal gökyüzü (aşırı parlak/neon değil)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#9fc7dc');
    skyGrad.addColorStop(0.6, '#cde2eb');
    skyGrad.addColorStop(1, '#f4ecdc');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-40, -40, w + 80, horizonY + 46);

    // Sıcak güneş ve yumuşak halesi (parlamayan mat katmanlar)
    const sunX = w * 0.82;
    const sunY = h * 0.15;
    const sunR = Math.min(w, h) * 0.052;
    ctx.fillStyle = 'rgba(244, 217, 146, 0.32)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2cf7e';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Bulutlar
    ctx.fillStyle = 'rgba(253, 251, 246, 0.92)';
    this.clouds.forEach((c) => {
      const cx = c.x * w;
      const cy = c.y * h;
      const r = Math.min(w, h) * 0.042 * c.scale;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.9, cy - r * 0.25, r * 0.85, 0, Math.PI * 2);
      ctx.arc(cx + r * 1.75, cy + r * 0.05, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
    });

    // Uzak dağ silüeti
    ctx.fillStyle = '#a5bfa5';
    ctx.beginPath();
    ctx.moveTo(-40, horizonY + 6);
    ctx.lineTo(w * 0.14, horizonY - h * 0.14);
    ctx.lineTo(w * 0.34, horizonY - h * 0.04);
    ctx.lineTo(w * 0.56, horizonY - h * 0.16);
    ctx.lineTo(w * 0.78, horizonY - h * 0.06);
    ctx.lineTo(w + 40, horizonY - h * 0.12);
    ctx.lineTo(w + 40, horizonY + 10);
    ctx.closePath();
    ctx.fill();

    // Yakın yumuşak tepeler
    ctx.fillStyle = '#97ba8e';
    ctx.beginPath();
    ctx.moveTo(-40, horizonY + 6);
    ctx.quadraticCurveTo(w * 0.24, horizonY - h * 0.08, w * 0.5, horizonY + 2);
    ctx.quadraticCurveTo(w * 0.78, horizonY - h * 0.09, w + 40, horizonY);
    ctx.lineTo(w + 40, horizonY + 10);
    ctx.closePath();
    ctx.fill();

    // Minik süzülen kelebekler
    this.butterflies.forEach((b) => {
      const bx = b.x * w;
      const by = b.y * h + Math.sin(b.phase) * 9;
      const wing = Math.abs(Math.sin(b.phase * 2.2)) * 6 + 3;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(bx - 4, by, wing, 4, -0.3, 0, Math.PI * 2);
      ctx.ellipse(bx + 4, by, wing, 4, 0.3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Canlı güneşli çayır
    const meadowGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    meadowGrad.addColorStop(0, '#96ba88');
    meadowGrad.addColorStop(0.55, '#82ab74');
    meadowGrad.addColorStop(1, '#6f9962');
    ctx.fillStyle = meadowGrad;
    ctx.fillRect(-40, horizonY, w + 80, h - horizonY + 40);
  }

  drawPathAndLanes(ctx, w, h) {
    const farZ = VIEW_DISTANCE;
    const nearZ = 0.5;

    const farL = this.project(-ROAD_HALF_WIDTH, 0, farZ);
    const farR = this.project(ROAD_HALF_WIDTH, 0, farZ);
    const nearL = this.project(-ROAD_HALF_WIDTH, 0, nearZ);
    const nearR = this.project(ROAD_HALF_WIDTH, 0, nearZ);

    // Sıcak altın-kum parkur yolu
    ctx.fillStyle = '#e5d3b3';
    ctx.beginPath();
    ctx.moveTo(farL.x, farL.y);
    ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.lineTo(nearL.x, nearL.y);
    ctx.closePath();
    ctx.fill();

    // Yatay taş / ahşap bantlar (koşu hızını çok keyifli hissettirir, göz yormaz)
    const bandStep = 3.2;
    const bandOffset = this.distance % (bandStep * 2);
    ctx.fillStyle = 'rgba(196, 172, 134, 0.24)';
    for (let z = farZ - bandOffset; z > 0.8; z -= bandStep * 2) {
      const zFar = Math.min(farZ, z);
      const zNear = Math.max(0.55, z - bandStep);
      const fl = this.project(-ROAD_HALF_WIDTH, 0, zFar);
      const fr = this.project(ROAD_HALF_WIDTH, 0, zFar);
      const nl = this.project(-ROAD_HALF_WIDTH, 0, zNear);
      const nr = this.project(ROAD_HALF_WIDTH, 0, zNear);
      ctx.beginPath();
      ctx.moveTo(fl.x, fl.y);
      ctx.lineTo(fr.x, fr.y);
      ctx.lineTo(nr.x, nr.y);
      ctx.lineTo(nl.x, nl.y);
      ctx.closePath();
      ctx.fill();
    }

    // Yol kenarı ahşap bordür çizgisi
    ctx.strokeStyle = '#c19f73';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(farL.x, farL.y);
    ctx.lineTo(nearL.x, nearL.y);
    ctx.moveTo(farR.x, farR.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.stroke();

    // 3 Şerit kesikli çizgileri
    const laneDividers = [-LANE_WIDTH * 0.5, LANE_WIDTH * 0.5];
    const dashSpacing = 3.8;
    const offset = this.distance % dashSpacing;

    ctx.strokeStyle = 'rgba(255, 252, 245, 0.72)';
    ctx.lineCap = 'round';

    for (const divX of laneDividers) {
      for (let z = farZ - offset; z > 0.9; z -= dashSpacing) {
        const z1 = Math.max(0.7, z);
        const z2 = Math.max(0.55, z - 1.5);
        const p1 = this.project(divX, 0.01, z1);
        const p2 = this.project(divX, 0.01, z2);
        ctx.lineWidth = Math.max(1.6, p2.scale * 0.06);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  drawSceneryItem(ctx, item, z) {
    const base = this.project(item.x, 0, z);
    const s = base.scale * item.scale;
    if (s < 3) return;

    ctx.save();
    if (item.type === 'flagPost') {
      // Parkur kenarı neşeli üçgen flama direği!
      const poleH = s * 1.95;
      ctx.strokeStyle = '#8d6844';
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x, base.y - poleH);
      ctx.stroke();

      const flagColors = ['#df7f62', '#e8b84b', '#6ea4bf'];
      const flutter = Math.sin(this.time * 4.5 + z) * s * 0.08;
      const dir = -item.side; // Yola doğru hafif dalgalanır
      ctx.fillStyle = flagColors[item.tint % flagColors.length];
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - poleH);
      ctx.lineTo(base.x + dir * s * 0.75, base.y - poleH + s * 0.2 + flutter);
      ctx.lineTo(base.x, base.y - poleH + s * 0.45);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'pine') {
      const sway = Math.sin(this.time * 1.6 + z * 0.4) * s * 0.03;
      ctx.fillStyle = '#8b6543';
      ctx.fillRect(base.x - s * 0.14, base.y - s * 0.7, s * 0.28, s * 0.7);

      ctx.fillStyle = item.tint === 0 ? '#5b8a57' : '#699962';
      ctx.beginPath();
      ctx.moveTo(base.x + sway, base.y - s * 2.55);
      ctx.lineTo(base.x - s * 0.92, base.y - s * 0.65);
      ctx.lineTo(base.x + s * 0.92, base.y - s * 0.65);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = item.tint === 0 ? '#6e9c68' : '#7bad72';
      ctx.beginPath();
      ctx.moveTo(base.x + sway * 1.3, base.y - s * 3.05);
      ctx.lineTo(base.x - s * 0.68, base.y - s * 1.48);
      ctx.lineTo(base.x + s * 0.68, base.y - s * 1.48);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'roundTree') {
      ctx.fillStyle = '#8e6946';
      ctx.fillRect(base.x - s * 0.16, base.y - s * 1.15, s * 0.32, s * 1.15);

      ctx.fillStyle = item.tint === 0 ? '#69975e' : '#7ba66c';
      ctx.beginPath();
      ctx.arc(base.x, base.y - s * 1.68, s * 0.86, 0, Math.PI * 2);
      ctx.arc(base.x - s * 0.52, base.y - s * 1.4, s * 0.58, 0, Math.PI * 2);
      ctx.arc(base.x + s * 0.52, base.y - s * 1.4, s * 0.58, 0, Math.PI * 2);
      ctx.fill();

      // Ağaçta minik sıcak elmalar/çiçekler
      if (s > 11 && item.tint === 1) {
        ctx.fillStyle = '#df7f62';
        ctx.beginPath();
        ctx.arc(base.x - s * 0.28, base.y - s * 1.72, s * 0.12, 0, Math.PI * 2);
        ctx.arc(base.x + s * 0.34, base.y - s * 1.45, s * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#6c9862';
      ctx.beginPath();
      ctx.arc(base.x, base.y - s * 0.42, s * 0.54, 0, Math.PI * 2);
      ctx.arc(base.x - s * 0.38, base.y - s * 0.28, s * 0.38, 0, Math.PI * 2);
      ctx.arc(base.x + s * 0.38, base.y - s * 0.28, s * 0.38, 0, Math.PI * 2);
      ctx.fill();

      if (s > 9) {
        const flowerCols = ['#f2cf7e', '#e38c72', '#a8cfe0'];
        ctx.fillStyle = flowerCols[item.tint % flowerCols.length];
        ctx.beginPath();
        ctx.arc(base.x - s * 0.2, base.y - s * 0.54, s * 0.11, 0, Math.PI * 2);
        ctx.arc(base.x + s * 0.24, base.y - s * 0.36, s * 0.1, 0, Math.PI * 2);
        ctx.arc(base.x, base.y - s * 0.25, s * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Yol boyunca süzülen mat altın yıldız (zıplayarak / eğilerek / şerit değiştirerek toplanır)
   */
  drawCollectibleStar(ctx, col, relZ) {
    const hover = Math.sin(this.time * 4 + col.z) * 0.12;
    const p = this.project(col.lane * LANE_WIDTH, col.y + hover, relZ);
    const ground = this.project(col.lane * LANE_WIDTH, 0.02, relZ);
    const r = Math.min(44, p.scale * 0.34);
    if (r < 4) return;

    ctx.save();
    // Zeminde yumuşak gölge (yıldızın yüksekliğini anında belli eder!)
    ctx.fillStyle = 'rgba(92, 78, 58, 0.2)';
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, r * 0.72, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Yatay eksende nazikçe dönen altın yıldız
    const spinScaleX = 0.55 + Math.abs(Math.cos(this.time * 2.8 + col.z)) * 0.45;
    ctx.translate(p.x, p.y);
    ctx.scale(spinScaleX, 1);

    ctx.fillStyle = '#f0c24f';
    ctx.strokeStyle = '#b58422';
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.48;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const sx = Math.cos(a) * rad;
      const sy = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawObstacle(ctx, obs, relZ) {
    ctx.save();
    if (obs.hit) {
      ctx.globalAlpha = 0.4;
    }

    if (obs.type === 'dodge') {
      this.drawDodgeObstacle(ctx, obs, relZ);
    } else if (obs.type === 'jump') {
      this.drawJumpObstacle(ctx, obs, relZ);
    } else if (obs.type === 'duck') {
      this.drawDuckObstacle(ctx, obs, relZ);
    } else if (obs.type === 'mirror') {
      this.drawMirrorGate(ctx, obs, relZ);
    } else if (obs.type === 'finish') {
      this.drawFinishArch(ctx, relZ);
    }

    ctx.restore();
  }

  drawDodgeObstacle(ctx, obs, relZ) {
    // Açık şeritte yeşil yön oku (çocuk hemen açık yolu görsün!)
    const openBase = this.project(obs.openLane * LANE_WIDTH, 0.02, relZ + 1.4);
    if (openBase.scale > 8) {
      const r = openBase.scale * 0.44;
      ctx.save();
      ctx.fillStyle = 'rgba(91, 142, 84, 0.32)';
      ctx.beginPath();
      ctx.ellipse(openBase.x, openBase.y, r * 1.15, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const lane of obs.blockedLanes) {
      const cx = lane * LANE_WIDTH;
      const halfW = LANE_WIDTH * 0.43;
      const bl = this.project(cx - halfW, 0, relZ);
      const br = this.project(cx + halfW, 0, relZ);
      const tl = this.project(cx - halfW, 1.38, relZ);
      const width = br.x - bl.x;
      const height = bl.y - tl.y;
      if (width < 4) continue;

      if (obs.style === 'fence') {
        ctx.fillStyle = '#9f764f';
        ctx.strokeStyle = '#6f4e30';
        ctx.lineWidth = Math.max(1.5, width * 0.025);

        const postW = width * 0.14;
        [0.08, 0.43, 0.78].forEach((ratio) => {
          ctx.beginPath();
          ctx.roundRect(bl.x + width * ratio, tl.y, postW, height, Math.max(2, postW * 0.3));
          ctx.fill();
          ctx.stroke();
        });

        ctx.fillStyle = '#bf9366';
        [0.2, 0.56].forEach((ratio) => {
          ctx.beginPath();
          ctx.roundRect(bl.x, tl.y + height * ratio, width, height * 0.22, Math.max(2, height * 0.05));
          ctx.fill();
          ctx.stroke();
        });
      } else if (obs.style === 'crates') {
        // Renkli boyalı ahşap macera sandığı
        ctx.fillStyle = '#d48668';
        ctx.strokeStyle = '#96543d';
        ctx.lineWidth = Math.max(1.8, width * 0.03);
        ctx.beginPath();
        ctx.roundRect(bl.x + width * 0.04, tl.y + height * 0.08, width * 0.92, height * 0.92, Math.max(4, width * 0.08));
        ctx.fill();
        ctx.stroke();

        // Çapraz ahşap çıta
        ctx.strokeStyle = '#f3e7d3';
        ctx.lineWidth = Math.max(2, width * 0.045);
        ctx.beginPath();
        ctx.moveTo(bl.x + width * 0.14, tl.y + height * 0.18);
        ctx.lineTo(bl.x + width * 0.86, bl.y - height * 0.12);
        ctx.moveTo(bl.x + width * 0.86, tl.y + height * 0.18);
        ctx.lineTo(bl.x + width * 0.14, bl.y - height * 0.12);
        ctx.stroke();
      } else {
        // Saman balyası
        ctx.fillStyle = '#dfb966';
        ctx.strokeStyle = '#a8843c';
        ctx.lineWidth = Math.max(1.5, width * 0.025);
        ctx.beginPath();
        ctx.roundRect(bl.x, tl.y + height * 0.12, width, height * 0.88, Math.max(4, width * 0.12));
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#8f6d2e';
        ctx.beginPath();
        ctx.moveTo(bl.x + width * 0.28, tl.y + height * 0.12);
        ctx.lineTo(bl.x + width * 0.28, bl.y);
        ctx.moveTo(bl.x + width * 0.72, tl.y + height * 0.12);
        ctx.lineTo(bl.x + width * 0.72, bl.y);
        ctx.stroke();
      }
    }
  }

  drawJumpObstacle(ctx, obs, relZ) {
    const leftBase = this.project(-ROAD_HALF_WIDTH + 0.15, 0, relZ);
    const rightBase = this.project(ROAD_HALF_WIDTH - 0.15, 0, relZ);
    const leftTop = this.project(-ROAD_HALF_WIDTH + 0.15, 0.74, relZ);
    const width = rightBase.x - leftBase.x;
    const height = leftBase.y - leftTop.y;
    if (width < 8) return;

    if (obs.style === 'hurdle') {
      // Kırmızı-krem çizgili eğlenceli parkur engeli
      const barH = height * 0.42;
      const postW = Math.max(4, width * 0.045);
      ctx.fillStyle = '#8b6847';
      ctx.fillRect(leftBase.x, leftTop.y, postW, height);
      ctx.fillRect(rightBase.x - postW, leftTop.y, postW, height);

      ctx.fillStyle = '#df7f62';
      ctx.strokeStyle = '#9e4f39';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(leftBase.x, leftTop.y, width, barH, Math.max(4, barH * 0.3));
      ctx.fill();
      ctx.stroke();

      // Krem şeritler
      ctx.fillStyle = '#faf5ea';
      const stripes = 5;
      for (let i = 0; i < stripes; i++) {
        ctx.fillRect(leftBase.x + width * (0.1 + i * 0.18), leftTop.y + 2, width * 0.08, barH - 4);
      }
    } else {
      ctx.fillStyle = obs.style === 'log' ? '#8c623d' : '#6ea4bf';
      ctx.strokeStyle = obs.style === 'log' ? '#5e3f25' : '#4d7d96';
      ctx.lineWidth = Math.max(2, height * 0.06);
      ctx.beginPath();
      ctx.roundRect(leftBase.x, leftTop.y, width, height, Math.max(4, height * 0.42));
      ctx.fill();
      ctx.stroke();

      if (obs.style === 'log') {
        ctx.strokeStyle = 'rgba(242, 226, 204, 0.4)';
        ctx.lineWidth = Math.max(1.4, height * 0.045);
        ctx.beginPath();
        ctx.moveTo(leftBase.x + width * 0.12, leftTop.y + height * 0.38);
        ctx.lineTo(leftBase.x + width * 0.44, leftTop.y + height * 0.38);
        ctx.moveTo(leftBase.x + width * 0.56, leftTop.y + height * 0.64);
        ctx.lineTo(leftBase.x + width * 0.88, leftTop.y + height * 0.64);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#d8e8ed';
        ctx.beginPath();
        ctx.ellipse(leftBase.x + width * 0.26, leftTop.y + height * 0.5, width * 0.09, height * 0.2, 0, 0, Math.PI * 2);
        ctx.ellipse(leftBase.x + width * 0.7, leftTop.y + height * 0.48, width * 0.1, height * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (width > 62) {
      const signCx = (leftBase.x + rightBase.x) * 0.5;
      const signW = Math.min(134, width * 0.32);
      const signH = Math.min(34, height * 0.88);
      const signY = leftTop.y - signH - Math.max(6, height * 0.18);

      ctx.fillStyle = '#faf6ec';
      ctx.strokeStyle = '#df7f62';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(signCx - signW / 2, signY, signW, signH, 11);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4a3d33';
      ctx.font = `800 ${Math.max(11, Math.min(16, signH * 0.54))}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲ Zıpla!', signCx, signY + signH / 2 + 1);
    }
  }

  drawDuckObstacle(ctx, obs, relZ) {
    const leftBase = this.project(-ROAD_HALF_WIDTH, 0, relZ);
    const rightBase = this.project(ROAD_HALF_WIDTH, 0, relZ);
    const leftClearance = this.project(-ROAD_HALF_WIDTH, 1.38, relZ);
    const leftTop = this.project(-ROAD_HALF_WIDTH, 2.58, relZ);

    const width = rightBase.x - leftBase.x;
    const beamH = leftClearance.y - leftTop.y;
    const pillarW = Math.max(5, width * 0.075);
    if (width < 10) return;

    ctx.fillStyle = '#8b6542';
    ctx.strokeStyle = '#5e4229';
    ctx.lineWidth = Math.max(1.5, pillarW * 0.12);
    ctx.fillRect(leftBase.x, leftTop.y, pillarW, leftBase.y - leftTop.y);
    ctx.strokeRect(leftBase.x, leftTop.y, pillarW, leftBase.y - leftTop.y);
    ctx.fillRect(rightBase.x - pillarW, leftTop.y, pillarW, rightBase.y - leftTop.y);
    ctx.strokeRect(rightBase.x - pillarW, leftTop.y, pillarW, rightBase.y - leftTop.y);

    ctx.fillStyle = '#aa7f55';
    ctx.beginPath();
    ctx.roundRect(leftBase.x - pillarW * 0.25, leftTop.y, width + pillarW * 0.5, beamH, Math.max(4, beamH * 0.18));
    ctx.fill();
    ctx.stroke();

    if (obs.style === 'bunting') {
      // Kirişten sarkan renkli mat bayrak üçgenleri!
      const flags = 7;
      const fw = width / flags;
      const colors = ['#df7f62', '#f0c24f', '#6ea4bf', '#759f6b'];
      for (let i = 0; i < flags; i++) {
        const fx = leftBase.x + i * fw;
        const sway = Math.sin(this.time * 4 + i) * Math.min(4, beamH * 0.06);
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.moveTo(fx, leftClearance.y);
        ctx.lineTo(fx + fw, leftClearance.y);
        ctx.lineTo(fx + fw * 0.5 + sway, leftClearance.y + beamH * 0.34);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#6b9461';
      const leafCount = 7;
      for (let i = 0; i < leafCount; i++) {
        const lx = leftBase.x + (width / (leafCount - 1)) * i;
        ctx.beginPath();
        ctx.arc(lx, leftTop.y + beamH * 0.14, Math.max(4, beamH * 0.34), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (width > 68) {
      const cx = (leftBase.x + rightBase.x) * 0.5;
      const cy = leftTop.y + beamH * 0.54;
      const pillW = Math.min(128, width * 0.33);
      const pillH = Math.min(34, beamH * 0.56);

      ctx.fillStyle = '#faf6ec';
      ctx.strokeStyle = '#5e8855';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, 11);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4a3d33';
      ctx.font = `800 ${Math.max(11, Math.min(16, pillH * 0.55))}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▼ Eğil!', cx, cy + 1);
    }
  }

  drawMirrorGate(ctx, obs, relZ) {
    const leftBase = this.project(-ROAD_HALF_WIDTH, 0, relZ);
    const rightBase = this.project(ROAD_HALF_WIDTH, 0, relZ);
    const leftTop = this.project(-ROAD_HALF_WIDTH, 3.15, relZ);

    const width = rightBase.x - leftBase.x;
    const height = leftBase.y - leftTop.y;
    if (width < 12) return;

    const postW = Math.max(6, width * 0.075);
    const innerLeft = leftBase.x + postW;
    const innerW = width - postW * 2;
    const headerH = height * 0.19;

    const openOffset = obs.curtainOpen * (innerW * 0.54);
    const panelY = leftTop.y + headerH;
    const panelH = height - headerH;

    if (obs.curtainOpen < 0.98) {
      ctx.save();
      ctx.fillStyle = obs.matched ? 'rgba(211, 234, 203, 0.92)' : 'rgba(250, 244, 232, 0.95)';
      ctx.strokeStyle = obs.matched ? '#5e8e56' : '#c2ae92';
      ctx.lineWidth = 2.5;

      const halfW = innerW / 2;
      ctx.beginPath();
      ctx.rect(innerLeft - openOffset, panelY, Math.max(0, halfW), panelH);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.rect(innerLeft + halfW + openOffset, panelY, Math.max(0, halfW), panelH);
      ctx.fill();
      ctx.stroke();

      if (obs.curtainOpen < 0.35 && width > 50) {
        const silSize = Math.min(innerW * 0.4, panelH * 0.66);
        const cx = leftBase.x + width / 2;
        const cy = panelY + panelH * 0.49;

        drawTargetPoseSilhouette(ctx, obs.poseDef, cx, cy, silSize, obs.matched);

        if (this.livePose && relZ < 22 && !obs.matched) {
          drawLiveMirrorOverlay(ctx, this.livePose, this.liveBodyScale, cx, cy, silSize, obs.matched);
        }

        // Bacak gerektiren pozda ayaklar kamerada henüz görünmüyorsa nazik not göster
        if (obs.poseDef.usesLegs && !this.liveHasLegs && this.livePose && !obs.matched && width > 130) {
          ctx.fillStyle = '#8c5742';
          ctx.font = `700 ${Math.max(10, Math.min(13, innerW * 0.045))}px Nunito, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Biraz geri çekil, ayakların da görünsün!', cx, panelY + panelH - 12);
        }

        if (obs.holdTime > 0 && !obs.matched) {
          const prog = Math.min(1, obs.holdTime / obs.requiredHold);
          const barW = Math.min(150, innerW * 0.52);
          const barH = 12;
          const bx = cx - barW / 2;
          const by = panelY + panelH - 24;
          ctx.fillStyle = '#ddd2c0';
          ctx.beginPath();
          ctx.roundRect(bx, by, barW, barH, 6);
          ctx.fill();
          ctx.fillStyle = '#5e8e56';
          ctx.beginPath();
          ctx.roundRect(bx, by, barW * prog, barH, 6);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Ahşap kapı direkleri
    ctx.fillStyle = '#99724d';
    ctx.strokeStyle = '#684a2f';
    ctx.lineWidth = Math.max(2, postW * 0.1);
    ctx.fillRect(leftBase.x, leftTop.y, postW, height);
    ctx.strokeRect(leftBase.x, leftTop.y, postW, height);
    ctx.fillRect(rightBase.x - postW, leftTop.y, postW, height);
    ctx.strokeRect(rightBase.x - postW, leftTop.y, postW, height);

    // Üst başlık tabelası
    ctx.fillStyle = obs.matched ? '#5e8e56' : '#df7f62';
    ctx.beginPath();
    ctx.roundRect(leftBase.x - postW * 0.2, leftTop.y, width + postW * 0.4, headerH, Math.max(6, headerH * 0.25));
    ctx.fill();
    ctx.stroke();

    if (width > 72) {
      ctx.fillStyle = '#faf7f0';
      const fontSize = Math.max(11, Math.min(20, headerH * 0.46));
      ctx.font = `800 ${fontSize}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = obs.matched ? `✓ Harika! (${obs.poseDef.title})` : `🪞 Ayna Kapısı: ${obs.poseDef.title}`;
      ctx.fillText(label, leftBase.x + width / 2, leftTop.y + headerH / 2 + 1);
    }
  }

  drawFinishArch(ctx, relZ) {
    const leftBase = this.project(-ROAD_HALF_WIDTH, 0, relZ);
    const rightBase = this.project(ROAD_HALF_WIDTH, 0, relZ);
    const leftTop = this.project(-ROAD_HALF_WIDTH, 3.1, relZ);
    const width = rightBase.x - leftBase.x;
    const height = leftBase.y - leftTop.y;
    if (width < 10) return;

    const postW = Math.max(6, width * 0.08);
    ctx.fillStyle = '#9b744f';
    ctx.fillRect(leftBase.x, leftTop.y, postW, height);
    ctx.fillRect(rightBase.x - postW, leftTop.y, postW, height);

    const bannerH = height * 0.24;
    ctx.fillStyle = '#5e8e56';
    ctx.strokeStyle = '#3f6939';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(leftBase.x, leftTop.y, width, bannerH, 12);
    ctx.fill();
    ctx.stroke();

    if (width > 70) {
      ctx.fillStyle = '#faf7f0';
      ctx.font = `800 ${Math.max(12, Math.min(24, bannerH * 0.48))}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏁 Bitiş Kapısı!', leftBase.x + width / 2, leftTop.y + bannerH / 2 + 1);
    }
  }

  drawGentleWindLines(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 252, 245, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const slots = [
      { x: 0.08, y: 0.25 },
      { x: 0.92, y: 0.28 },
      { x: 0.06, y: 0.62 },
      { x: 0.94, y: 0.65 }
    ];
    slots.forEach((s, idx) => {
      const t = (this.time * 2.2 + idx * 0.37) % 1;
      const sx = s.x * w;
      const sy = s.y * h + (t - 0.5) * 45;
      const dir = s.x < 0.5 ? -1 : 1;
      ctx.globalAlpha = Math.sin(t * Math.PI) * 0.55;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + dir * 28, sy + 18);
      ctx.stroke();
    });
    ctx.restore();
  }

  drawCountdownOverlay(ctx, w, h) {
    const num = Math.max(1, Math.ceil(this.countdownTimer / 0.75));
    const subText = num === 3 ? 'Hazır Ol!' : num === 2 ? 'Yerini Al!' : 'Başlıyoruz!';

    ctx.save();
    const boxW = 220;
    const boxH = 150;
    const bx = (w - boxW) / 2;
    const by = (h - boxH) / 2;

    ctx.fillStyle = 'rgba(250, 247, 240, 0.94)';
    ctx.strokeStyle = '#6f9468';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 28);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#5e8e56';
    ctx.font = '800 68px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), w / 2, by + 64);

    ctx.fillStyle = '#4a4036';
    ctx.font = '800 20px Nunito, sans-serif';
    ctx.fillText(subText, w / 2, by + 118);
    ctx.restore();
  }

  drawUpcomingCue(ctx, w) {
    const upcoming = this.obstacles.find((o) => !o.resolved && o.z - this.distance > 1.0 && o.z - this.distance < 21);
    if (!upcoming) return;

    let label = '';
    let bg = 'rgba(250, 247, 240, 0.94)';
    let border = '#c9bca8';

    if (upcoming.type === 'jump') {
      label = '▲ Zıpla!';
      border = '#df7f62';
    } else if (upcoming.type === 'duck') {
      label = '▼ Eğil!';
      border = '#5e8e56';
    } else if (upcoming.type === 'dodge') {
      if (upcoming.openLane === -1) label = '◀ Sola Kaç!';
      else if (upcoming.openLane === 1) label = 'Sağa Kaç! ▶';
      else label = '● Ortaya Geç!';
      border = '#d4a13f';
    } else if (upcoming.type === 'mirror') {
      label = upcoming.matched
        ? `✓ Kapı Açıldı! (${upcoming.poseDef.title})`
        : `🪞 ${upcoming.poseDef.title} — ${upcoming.poseDef.subtitle}`;
      bg = upcoming.matched ? 'rgba(215, 236, 208, 0.95)' : 'rgba(252, 245, 234, 0.96)';
      border = upcoming.matched ? '#5e8e56' : '#df7f62';
    } else if (upcoming.type === 'finish') {
      label = '🏁 Bitiş Kapısı Göründü!';
      border = '#5e8e56';
    }

    if (!label) return;

    ctx.save();
    const isNarrow = w < 640;
    ctx.font = `800 ${isNarrow ? 15 : 18}px Nunito, sans-serif`;
    const textW = ctx.measureText(label).width;
    const pillW = Math.min(w - 24, textW + (isNarrow ? 30 : 42));
    const pillH = isNarrow ? 36 : 42;
    const px = (w - pillW) / 2;
    const py = 60;

    ctx.fillStyle = bg;
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, 23);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#3d3730';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, py + pillH / 2 + 1);
    ctx.restore();
  }

  drawStanceIndicator(ctx, w, h) {
    const barW = Math.min(270, w - 24);
    const barH = 40;
    const bx = (w - barW) / 2;
    const by = h - barH - 14;

    ctx.save();
    ctx.fillStyle = 'rgba(250, 247, 240, 0.9)';
    ctx.strokeStyle = '#d4cab9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, barH, 21);
    ctx.fill();
    ctx.stroke();

    const labels = [
      { lane: -1, text: 'Sol' },
      { lane: 0, text: 'Orta' },
      { lane: 1, text: 'Sağ' }
    ];

    const segW = barW / 3;
    labels.forEach((item, idx) => {
      const sx = bx + idx * segW;
      const active = this.playerLane === item.lane;
      if (active) {
        ctx.fillStyle = '#5e8e56';
        ctx.beginPath();
        ctx.roundRect(sx + 4, by + 4, segW - 8, barH - 8, 16);
        ctx.fill();
      }
      ctx.fillStyle = active ? '#faf7f0' : '#6c6358';
      ctx.font = '800 14px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.text, sx + segW / 2, by + barH / 2 + 1);
    });

    let stanceText = 'Koşuyor';
    let stanceBg = '#ece3d3';
    if (this.jumpTimer > 0) {
      stanceText = '▲ Havada!';
      stanceBg = '#d5e8ce';
    } else if (this.crouchAmount > 0.42) {
      stanceText = '▼ Eğildi!';
      stanceBg = '#f0decb';
    }

    const badgeW = 96;
    const badgeX = bx + barW + 10;
    if (badgeX + badgeW < w - 12) {
      ctx.fillStyle = stanceBg;
      ctx.strokeStyle = '#cfc5b4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(badgeX, by + 4, badgeW, barH - 8, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4a4138';
      ctx.font = '800 13px Nunito, sans-serif';
      ctx.fillText(stanceText, badgeX + badgeW / 2, by + barH / 2 + 1);
    }

    ctx.restore();
  }

  drawFeedbackToast(ctx, w, h) {
    const alpha = Math.min(1, this.feedbackTimer * 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '800 22px Nunito, sans-serif';
    const textW = ctx.measureText(this.feedbackText).width;
    const boxW = textW + 44;
    const boxH = 46;
    const x = (w - boxW) / 2;
    const y = h * 0.27;

    ctx.fillStyle = 'rgba(250, 247, 240, 0.96)';
    ctx.strokeStyle = this.feedbackColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.feedbackColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.feedbackText, w / 2, y + boxH / 2 + 1);
    ctx.restore();
  }
}
