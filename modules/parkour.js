/**
 * parkour.js
 * Birinci Şahıs (POV) HD Macera Parkuru Motoru.
 * - Retina / HiDPI keskin vektör çizimi (devicePixelRatio uyumlu)
 * - Zemin gölgeleri, derinlik sisi, katmanlı dağlar, dokulu ahşap engeller ve çim detayları
 * - Bölüm başı 5 saniyelik etkileşimli "Hazırlan!" süreci ve otomatik boy kalibrasyonu
 * - 3 şerit kaçınma, zıplama, eğilme, toplanabilir yıldızlar ve 11 tam vücut Ayna Kapısı
 */

import { sfx } from './sound.js';
import { CalmParticle } from './particles.js';
import { MIRROR_POSES, drawTargetPoseSilhouette, drawLiveMirrorOverlay } from './poses.js';

const LANE_WIDTH = 2.05;
const ROAD_HALF_WIDTH = LANE_WIDTH * 1.55;
const VIEW_DISTANCE = 54;

export class ParkourEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    // Mantıksal CSS boyutları (HiDPI ölçeklemesi app.js üzerinden setTransform ile yapılır)
    this.viewWidth = window.innerWidth;
    this.viewHeight = window.innerHeight;

    this.stage = 1;
    this.stars = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.lives = 5;
    this.maxLives = 5;
    this.calmMode = true;
    this.speedMultiplier = 1.0;

    // POV Kamera ve Oyuncu Durumu
    this.playerLane = 0;
    this.cameraX = 0;
    this.cameraY = 1.55;
    this.cameraRoll = 0;

    // Zıplama ve Eğilme fiziği
    this.jumpTimer = 0;
    this.jumpDuration = 0.68;
    this.wasJumpInput = false;

    this.crouchAmount = 0;
    this.crouchGraceTimer = 0;
    this.wasCrouchInput = false;

    this.boostTimer = 0;

    // 5 saniyelik bölüm başı hazırlık süreci
    this.prepDuration = 5.0;
    this.countdownTimer = 0;
    this.lastCountdownNum = 0;
    this.recalibratedForStage = false;

    // İlerleme ve sahne nesneleri
    this.distance = 0;
    this.stageLength = 100;
    this.obstacles = [];
    this.collectibles = [];
    this.scenery = [];
    this.roadPebbles = [];
    this.clouds = [];
    this.butterflies = [];
    this.particles = [];

    this.clearedCount = 0;
    this.totalObstacles = 12;

    // Yazısız görsel geri bildirim (sadece sabit onay/yıldız simgesi)
    this.feedbackIcon = ''; // 'ok' | 'star' | ''
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

  setViewport(w, h) {
    this.viewWidth = Math.max(1, w);
    this.viewHeight = Math.max(1, h);
  }

  initAtmosphere() {
    this.clouds = [
      { x: 0.14, y: 0.12, scale: 1.05, speed: 0.0045 },
      { x: 0.48, y: 0.085, scale: 0.9, speed: 0.0034 },
      { x: 0.8, y: 0.14, scale: 1.15, speed: 0.004 }
    ];
    this.butterflies = [
      { x: 0.25, y: 0.34, phase: 0, speed: 0.032, color: '#e6a65c' },
      { x: 0.72, y: 0.3, phase: 2.1, speed: -0.028, color: '#df7f62' }
    ];
  }

  initScenery() {
    this.scenery = [];
    for (let z = 3; z <= VIEW_DISTANCE; z += 3.4) {
      this.scenery.push(this.createSceneryItem(-1, z + Math.random() * 1.4));
      this.scenery.push(this.createSceneryItem(1, z + Math.random() * 1.4));
    }

    this.roadPebbles = [];
    for (let i = 0; i < 28; i++) {
      this.roadPebbles.push({
        x: (Math.random() - 0.5) * ROAD_HALF_WIDTH * 1.85,
        z: 1.5 + Math.random() * (VIEW_DISTANCE - 4),
        r: 0.05 + Math.random() * 0.07,
        shade: Math.random() < 0.5 ? '#c7b08e' : '#b79e7a'
      });
    }
  }

  createSceneryItem(side, z) {
    const types = ['pine', 'roundTree', 'flagPost', 'flowerBush', 'grassTuft', 'pine', 'roundTree'];
    const type = types[Math.floor(Math.random() * types.length)];
    const isFlag = type === 'flagPost';
    const isTuft = type === 'grassTuft';
    return {
      side,
      x: isFlag
        ? side * (ROAD_HALF_WIDTH + 0.55)
        : isTuft
          ? side * (ROAD_HALF_WIDTH + 0.35 + Math.random() * 1.1)
          : side * (ROAD_HALF_WIDTH + 1.5 + Math.random() * 4.8),
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
    this.feedbackIcon = '';
    this.feedbackTimer = 0;
    this.jumpTimer = 0;
    this.crouchAmount = 0;
    this.crouchGraceTimer = 0;
    this.boostTimer = 0;

    // 5 saniyelik rahat hazırlık süresi
    this.countdownTimer = this.prepDuration;
    this.lastCountdownNum = 6;
    this.recalibratedForStage = false;

    this.generateStageCourse(stageNum);
    this.isRunning = true;
    if (this.callbacks.onPrepStateChange) {
      this.callbacks.onPrepStateChange(true);
    }
    this.notifyHud();
  }

  stop() {
    this.isRunning = false;
    sfx.stopMusic();
    if (this.callbacks.onPrepStateChange) {
      this.callbacks.onPrepStateChange(false);
    }
  }

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

  triggerMatchCurrentMirrorPose() {
    const upcoming = this.obstacles.find((o) => o.type === 'mirror' && !o.matched && o.z - this.distance > 0.5 && o.z - this.distance < 24);
    if (upcoming) {
      this.manualPoseId = upcoming.poseDef.id;
      this.manualPoseTimer = 1.1;
    }
  }

  showFeedback(iconType = 'ok') {
    this.feedbackIcon = iconType;
    this.feedbackTimer = 0.75;
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

    const targetCamX = this.playerLane * LANE_WIDTH;
    const prevCamX = this.cameraX;
    this.cameraX += (targetCamX - this.cameraX) * Math.min(1, dt * 10.5);
    const camVelX = (this.cameraX - prevCamX) / Math.max(0.001, dt);
    const targetRoll = Math.max(-0.04, Math.min(0.04, -camVelX * 0.0052));
    this.cameraRoll += (targetRoll - this.cameraRoll) * Math.min(1, dt * 9);

    let jumpOffset = 0;
    if (this.jumpTimer > 0) {
      this.jumpTimer = Math.max(0, this.jumpTimer - dt);
      const t = 1 - this.jumpTimer / this.jumpDuration;
      jumpOffset = Math.sin(t * Math.PI) * 1.55;
    }

    if (this.crouchGraceTimer > 0) {
      this.crouchGraceTimer = Math.max(0, this.crouchGraceTimer - dt);
    }
    const targetCrouch = this.crouchGraceTimer > 0 && jumpOffset < 0.15 ? 1 : 0;
    this.crouchAmount += (targetCrouch - this.crouchAmount) * Math.min(1, dt * 11);

    const strideBob = this.isRunning && this.countdownTimer <= 0 && jumpOffset === 0 && this.crouchAmount < 0.3
      ? Math.sin(this.distance * 1.65) * 0.052
      : 0;

    this.cameraY = 1.55 + jumpOffset - this.crouchAmount * 0.88 + strideBob;

    if (!this.isRunning) return;

    // 5 saniyelik bölüm başı hazırlık süreci
    if (this.countdownTimer > 0) {
      this.countdownTimer -= dt;
      const curNum = Math.ceil(this.countdownTimer);
      if (curNum !== this.lastCountdownNum && curNum >= 1 && curNum <= 5) {
        this.lastCountdownNum = curNum;
        if (curNum <= 3) sfx.playCountdown(false);
      }

      // Son 0.5 saniyede oyuncu yerine geçtiği için boy kalibrasyonunu otomatik kilitle!
      if (!this.recalibratedForStage && this.countdownTimer <= 0.5) {
        this.recalibratedForStage = true;
        if (this.callbacks.onAutoRecalibrate) {
          this.callbacks.onAutoRecalibrate();
        }
      }

      if (this.countdownTimer <= 0) {
        this.countdownTimer = 0;
        sfx.playCountdown(true);
        sfx.startMusic();
        if (this.callbacks.onPrepStateChange) {
          this.callbacks.onPrepStateChange(false);
        }
      }
      return;
    }

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

    const streakBonus = 1.0 + Math.min(0.18, this.streak * 0.025);
    const boostFactor = this.boostTimer > 0 ? 1.22 : 1.0;

    const baseSpeed = (9.6 + (this.stage - 1) * 0.8) * this.speedMultiplier * mirrorSlowFactor * streakBonus * boostFactor;
    const step = baseSpeed * dt;
    this.distance += step;

    for (const item of this.scenery) {
      item.z -= step;
      if (item.z < 1.1) {
        item.z += VIEW_DISTANCE;
        item.x = item.type === 'flagPost'
          ? item.side * (ROAD_HALF_WIDTH + 0.55)
          : item.type === 'grassTuft'
            ? item.side * (ROAD_HALF_WIDTH + 0.35 + Math.random() * 1.1)
            : item.side * (ROAD_HALF_WIDTH + 1.5 + Math.random() * 4.8);
      }
    }

    for (const peb of this.roadPebbles) {
      peb.z -= step;
      if (peb.z < 0.8) {
        peb.z += VIEW_DISTANCE - 3;
        peb.x = (Math.random() - 0.5) * ROAD_HALF_WIDTH * 1.85;
      }
    }

    const isAirborne = jumpOffset > 0.3;
    const isDucked = this.crouchAmount > 0.4;

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
          this.spawnCelebration(proj.x, proj.y, 9);
          this.notifyHud();
        }
      }
    }

    for (const obs of this.obstacles) {
      const relZ = obs.z - this.distance;

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
            this.showFeedback('ok');
            this.spawnCelebration(this.viewWidth * 0.5, this.viewHeight * 0.44, 24);
            this.notifyHud();
          }
        } else {
          obs.holdTime = Math.max(0, obs.holdTime - dt * 0.75);
        }
      }

      if (obs.type === 'mirror' && obs.matched && obs.curtainOpen < 1) {
        obs.curtainOpen = Math.min(1, obs.curtainOpen + dt * 3.5);
      }

      if (!obs.resolved && relZ <= 1.35) {
        obs.resolved = true;

        if (obs.type === 'finish') {
          this.isRunning = false;
          sfx.stopMusic();
          sfx.playStageComplete();
          this.spawnCelebration(this.viewWidth * 0.5, this.viewHeight * 0.4, 30);
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
            this.showFeedback('ok');
            this.spawnCelebration(this.viewWidth * 0.5, this.viewHeight * 0.5, 12);
          }
        } else {
          obs.hit = true;
          this.streak = 0;
          this.boostTimer = 0;
          sfx.playBump();
          if (!this.calmMode) {
            this.lives = Math.max(0, this.lives - 1);
          }

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
    const w = this.viewWidth;
    const h = this.viewHeight;
    const z = Math.max(0.25, relZ);
    const focal = Math.min(w, h) * 0.72;
    const horizonY = h * 0.4;

    const scale = focal / z;
    const sx = w * 0.5 + (worldX - this.cameraX) * scale;
    const sy = horizonY + (this.cameraY - worldY) * scale;
    return { x: sx, y: sy, scale };
  }

  // Ufuktan yumuşak belirme (pop-in yerine sinematik derinlik geçişi)
  depthAlpha(relZ) {
    if (relZ <= VIEW_DISTANCE - 9) return 1;
    return Math.max(0, (VIEW_DISTANCE - relZ) / 9);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.viewWidth;
    const h = this.viewHeight;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this.cameraRoll);
    ctx.translate(-w / 2, -h / 2);

    this.drawSkyAndHills(ctx, w, h);
    this.drawPathAndLanes(ctx, w, h);

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
      const alpha = this.depthAlpha(r.z);
      if (alpha <= 0.02) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (r.kind === 'scenery') {
        this.drawSceneryItem(ctx, r.obj, r.z);
      } else if (r.kind === 'star') {
        this.drawCollectibleStar(ctx, r.obj, r.z);
      } else {
        this.drawObstacle(ctx, r.obj, r.z);
      }
      ctx.restore();
    }

    if (this.isRunning && this.countdownTimer <= 0 && (this.boostTimer > 0 || this.streak >= 4)) {
      this.drawGentleWindLines(ctx, w, h);
    }

    ctx.restore();

    for (const p of this.particles) {
      p.draw(ctx);
    }

    if (this.isRunning && this.countdownTimer > 0) {
      this.drawPrepCountdown(ctx, w, h);
    } else if (this.isRunning) {
      this.drawFixedActionCue(ctx, w);
      this.drawLaneDots(ctx, w, h);
    }
  }

  drawSkyAndHills(ctx, w, h) {
    const horizonY = h * 0.4;

    // Zengin güneşli sabah gökyüzü
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#8dbbd6');
    skyGrad.addColorStop(0.55, '#c2dde9');
    skyGrad.addColorStop(1, '#f4ebd7');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-40, -40, w + 80, horizonY + 46);

    // Katmanlı sıcak mat güneş
    const sunX = w * 0.8;
    const sunY = h * 0.14;
    const sunR = Math.min(w, h) * 0.052;
    ctx.fillStyle = 'rgba(246, 223, 158, 0.24)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(246, 223, 158, 0.42)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5d27b';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Hacimli, alt gölgeli bulutlar
    this.clouds.forEach((c) => {
      const cx = c.x * w;
      const cy = c.y * h;
      const r = Math.min(w, h) * 0.04 * c.scale;

      ctx.fillStyle = 'rgba(222, 232, 236, 0.72)';
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.85, cy + r * 0.32, r * 1.55, r * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(254, 252, 248, 0.96)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.85, cy - r * 0.28, r * 0.9, 0, Math.PI * 2);
      ctx.arc(cx + r * 1.72, cy + r * 0.02, r * 0.76, 0, Math.PI * 2);
      ctx.fill();
    });

    // Uzak mavi-yeşil dağ sırası (atmosfer derinliği)
    ctx.fillStyle = '#99b8b3';
    ctx.beginPath();
    ctx.moveTo(-40, horizonY + 8);
    ctx.lineTo(w * 0.12, horizonY - h * 0.14);
    ctx.lineTo(w * 0.28, horizonY - h * 0.05);
    ctx.lineTo(w * 0.46, horizonY - h * 0.17);
    ctx.lineTo(w * 0.68, horizonY - h * 0.06);
    ctx.lineTo(w * 0.86, horizonY - h * 0.14);
    ctx.lineTo(w + 40, horizonY - h * 0.04);
    ctx.lineTo(w + 40, horizonY + 12);
    ctx.closePath();
    ctx.fill();

    // Orta katman yeşil tepeler
    ctx.fillStyle = '#8db487';
    ctx.beginPath();
    ctx.moveTo(-40, horizonY + 8);
    ctx.quadraticCurveTo(w * 0.2, horizonY - h * 0.095, w * 0.44, horizonY + 1);
    ctx.quadraticCurveTo(w * 0.74, horizonY - h * 0.105, w + 40, horizonY - 2);
    ctx.lineTo(w + 40, horizonY + 12);
    ctx.closePath();
    ctx.fill();

    // Süzülen kelebekler
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

    // Zengin dokulu çayır zemini
    const meadowGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    meadowGrad.addColorStop(0, '#a0c192');
    meadowGrad.addColorStop(0.28, '#87b079');
    meadowGrad.addColorStop(0.7, '#75a067');
    meadowGrad.addColorStop(1, '#638f57');
    ctx.fillStyle = meadowGrad;
    ctx.fillRect(-40, horizonY, w + 80, h - horizonY + 40);

    // Ufuk sis şeridi (gökyüzü ile çayır arasında yumuşak HD geçiş)
    const mistGrad = ctx.createLinearGradient(0, horizonY - 12, 0, horizonY + 34);
    mistGrad.addColorStop(0, 'rgba(244, 235, 215, 0)');
    mistGrad.addColorStop(0.45, 'rgba(244, 235, 215, 0.55)');
    mistGrad.addColorStop(1, 'rgba(244, 235, 215, 0)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(-40, horizonY - 12, w + 80, 46);
  }

  drawPathAndLanes(ctx, w, h) {
    const farZ = VIEW_DISTANCE;
    const nearZ = 0.5;

    const farL = this.project(-ROAD_HALF_WIDTH, 0, farZ);
    const farR = this.project(ROAD_HALF_WIDTH, 0, farZ);
    const nearL = this.project(-ROAD_HALF_WIDTH, 0, nearZ);
    const nearR = this.project(ROAD_HALF_WIDTH, 0, nearZ);

    // Dış çim-toprak kenar bordürü
    const farOL = this.project(-ROAD_HALF_WIDTH - 0.22, 0, farZ);
    const farOR = this.project(ROAD_HALF_WIDTH + 0.22, 0, farZ);
    const nearOL = this.project(-ROAD_HALF_WIDTH - 0.22, 0, nearZ);
    const nearOR = this.project(ROAD_HALF_WIDTH + 0.22, 0, nearZ);

    ctx.fillStyle = '#b99c72';
    ctx.beginPath();
    ctx.moveTo(farOL.x, farOL.y);
    ctx.lineTo(farOR.x, farOR.y);
    ctx.lineTo(nearOR.x, nearOR.y);
    ctx.lineTo(nearOL.x, nearOL.y);
    ctx.closePath();
    ctx.fill();

    // Sıcak perspektif geçişli toprak parkur yolu
    const roadGrad = ctx.createLinearGradient(0, farL.y, 0, nearL.y);
    roadGrad.addColorStop(0, '#eadbc2');
    roadGrad.addColorStop(0.5, '#e2cea9');
    roadGrad.addColorStop(1, '#d6be94');
    ctx.fillStyle = roadGrad;
    ctx.beginPath();
    ctx.moveTo(farL.x, farL.y);
    ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.lineTo(nearL.x, nearL.y);
    ctx.closePath();
    ctx.fill();

    // Ritmik yol bantları
    const bandStep = 3.2;
    const bandOffset = this.distance % (bandStep * 2);
    ctx.fillStyle = 'rgba(176, 148, 108, 0.16)';
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

    // Minik yol çakıl taşları (HD doku hissi)
    for (const peb of this.roadPebbles) {
      if (peb.z < 0.9 || peb.z > VIEW_DISTANCE - 6) continue;
      const p = this.project(peb.x, 0.005, peb.z);
      const rx = Math.max(1.2, p.scale * peb.r);
      ctx.fillStyle = peb.shade;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, rx * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3 Şerit kesikli çizgileri
    const laneDividers = [-LANE_WIDTH * 0.5, LANE_WIDTH * 0.5];
    const dashSpacing = 3.8;
    const offset = this.distance % dashSpacing;

    ctx.strokeStyle = 'rgba(255, 252, 245, 0.78)';
    ctx.lineCap = 'round';

    for (const divX of laneDividers) {
      for (let z = farZ - offset; z > 0.9; z -= dashSpacing) {
        const z1 = Math.max(0.7, z);
        const z2 = Math.max(0.55, z - 1.5);
        const p1 = this.project(divX, 0.01, z1);
        const p2 = this.project(divX, 0.01, z2);
        ctx.lineWidth = Math.max(1.6, p2.scale * 0.055);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  drawGroundShadow(ctx, cx, cy, rx, ry) {
    ctx.fillStyle = 'rgba(54, 68, 46, 0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSceneryItem(ctx, item, z) {
    const base = this.project(item.x, 0, z);
    const s = base.scale * item.scale;
    if (s < 3) return;

    ctx.save();
    if (item.type === 'grassTuft') {
      ctx.strokeStyle = '#58824e';
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x - s * 0.22, base.y - s * 0.42);
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x + s * 0.04, base.y - s * 0.52);
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x + s * 0.25, base.y - s * 0.38);
      ctx.stroke();
    } else if (item.type === 'flagPost') {
      this.drawGroundShadow(ctx, base.x, base.y, s * 0.3, s * 0.1);
      const poleH = s * 1.95;
      ctx.strokeStyle = '#825c39';
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x, base.y - poleH);
      ctx.stroke();

      // Direk başı topuz
      ctx.fillStyle = '#e8b84b';
      ctx.beginPath();
      ctx.arc(base.x, base.y - poleH, Math.max(2, s * 0.09), 0, Math.PI * 2);
      ctx.fill();

      const flagColors = ['#df7f62', '#e8b84b', '#6ea4bf'];
      const flutter = Math.sin(this.time * 4.5 + z) * s * 0.08;
      const dir = -item.side;
      ctx.fillStyle = flagColors[item.tint % flagColors.length];
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - poleH + s * 0.06);
      ctx.lineTo(base.x + dir * s * 0.78, base.y - poleH + s * 0.24 + flutter);
      ctx.lineTo(base.x, base.y - poleH + s * 0.48);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'pine') {
      this.drawGroundShadow(ctx, base.x + s * 0.12, base.y, s * 0.82, s * 0.22);
      const sway = Math.sin(this.time * 1.6 + z * 0.4) * s * 0.03;

      ctx.fillStyle = '#7c5838';
      ctx.fillRect(base.x - s * 0.14, base.y - s * 0.72, s * 0.28, s * 0.72);

      // İki tonlu gölgeli çam katmanları (HD derinlik)
      ctx.fillStyle = item.tint === 0 ? '#4e7c4b' : '#5b8a55';
      ctx.beginPath();
      ctx.moveTo(base.x + sway, base.y - s * 2.55);
      ctx.lineTo(base.x - s * 0.94, base.y - s * 0.65);
      ctx.lineTo(base.x + s * 0.94, base.y - s * 0.65);
      ctx.closePath();
      ctx.fill();

      // Güneşli sağ yan parıltı
      ctx.fillStyle = 'rgba(210, 232, 185, 0.22)';
      ctx.beginPath();
      ctx.moveTo(base.x + sway, base.y - s * 2.55);
      ctx.lineTo(base.x, base.y - s * 0.65);
      ctx.lineTo(base.x + s * 0.94, base.y - s * 0.65);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = item.tint === 0 ? '#659460' : '#73a36a';
      ctx.beginPath();
      ctx.moveTo(base.x + sway * 1.3, base.y - s * 3.08);
      ctx.lineTo(base.x - s * 0.68, base.y - s * 1.48);
      ctx.lineTo(base.x + s * 0.68, base.y - s * 1.48);
      ctx.closePath();
      ctx.fill();
    } else if (item.type === 'roundTree') {
      this.drawGroundShadow(ctx, base.x + s * 0.14, base.y, s * 0.88, s * 0.24);

      ctx.fillStyle = '#825d3c';
      ctx.fillRect(base.x - s * 0.16, base.y - s * 1.18, s * 0.32, s * 1.18);

      // Koyu taban yaprak gölgesi
      ctx.fillStyle = '#588450';
      ctx.beginPath();
      ctx.arc(base.x - s * 0.48, base.y - s * 1.34, s * 0.58, 0, Math.PI * 2);
      ctx.arc(base.x + s * 0.48, base.y - s * 1.34, s * 0.58, 0, Math.PI * 2);
      ctx.fill();

      // Ana yaprak tacı
      ctx.fillStyle = item.tint === 0 ? '#6a9860' : '#7aa76c';
      ctx.beginPath();
      ctx.arc(base.x, base.y - s * 1.72, s * 0.86, 0, Math.PI * 2);
      ctx.fill();

      // Üst güneşli tepe vurgusu
      ctx.fillStyle = 'rgba(225, 240, 198, 0.28)';
      ctx.beginPath();
      ctx.arc(base.x + s * 0.2, base.y - s * 1.98, s * 0.44, 0, Math.PI * 2);
      ctx.fill();

      if (s > 11 && item.tint === 1) {
        ctx.fillStyle = '#df7f62';
        ctx.beginPath();
        ctx.arc(base.x - s * 0.28, base.y - s * 1.72, s * 0.12, 0, Math.PI * 2);
        ctx.arc(base.x + s * 0.34, base.y - s * 1.45, s * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      this.drawGroundShadow(ctx, base.x, base.y, s * 0.7, s * 0.18);
      ctx.fillStyle = '#5e8b55';
      ctx.beginPath();
      ctx.arc(base.x - s * 0.36, base.y - s * 0.26, s * 0.38, 0, Math.PI * 2);
      ctx.arc(base.x + s * 0.36, base.y - s * 0.26, s * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#73a067';
      ctx.beginPath();
      ctx.arc(base.x, base.y - s * 0.44, s * 0.52, 0, Math.PI * 2);
      ctx.fill();

      if (s > 9) {
        const flowerCols = ['#f4d17a', '#e38c72', '#a8cfe0'];
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

  drawCollectibleStar(ctx, col, relZ) {
    const hover = Math.sin(this.time * 4 + col.z) * 0.12;
    const p = this.project(col.lane * LANE_WIDTH, col.y + hover, relZ);
    const ground = this.project(col.lane * LANE_WIDTH, 0.02, relZ);
    const r = Math.min(44, p.scale * 0.34);
    if (r < 4) return;

    ctx.save();
    ctx.fillStyle = 'rgba(92, 78, 58, 0.24)';
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, r * 0.72, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    const spinScaleX = 0.55 + Math.abs(Math.cos(this.time * 2.8 + col.z)) * 0.45;
    ctx.translate(p.x, p.y);
    ctx.scale(spinScaleX, 1);

    ctx.fillStyle = '#f2c34b';
    ctx.strokeStyle = '#a8781b';
    ctx.lineWidth = Math.max(1.8, r * 0.1);
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

    // İç parlak altın yıldız vurgusu
    ctx.fillStyle = '#fae196';
    ctx.beginPath();
    ctx.arc(-r * 0.12, -r * 0.14, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawObstacle(ctx, obs, relZ) {
    ctx.save();
    if (obs.hit) {
      ctx.globalAlpha = 0.38;
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
    const openBase = this.project(obs.openLane * LANE_WIDTH, 0.02, relZ + 1.4);
    if (openBase.scale > 8) {
      const r = openBase.scale * 0.44;
      ctx.save();
      ctx.fillStyle = 'rgba(91, 142, 84, 0.32)';
      ctx.beginPath();
      ctx.ellipse(openBase.x, openBase.y, r * 1.15, r * 0.38, 0, 0, Math.PI * 2);
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

      // Engel zemin gölgesi
      this.drawGroundShadow(ctx, (bl.x + br.x) * 0.5, bl.y + height * 0.03, width * 0.54, Math.max(4, height * 0.1));

      if (obs.style === 'fence') {
        ctx.fillStyle = '#976e47';
        ctx.strokeStyle = '#68472a';
        ctx.lineWidth = Math.max(1.5, width * 0.024);

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
        ctx.fillStyle = '#d48668';
        ctx.strokeStyle = '#8c4b35';
        ctx.lineWidth = Math.max(1.8, width * 0.03);
        ctx.beginPath();
        ctx.roundRect(bl.x + width * 0.04, tl.y + height * 0.08, width * 0.92, height * 0.92, Math.max(4, width * 0.08));
        ctx.fill();
        ctx.stroke();

        // Üst kenar ışık şeridi
        ctx.fillStyle = 'rgba(255, 245, 232, 0.22)';
        ctx.fillRect(bl.x + width * 0.08, tl.y + height * 0.12, width * 0.84, height * 0.12);

        ctx.strokeStyle = '#f3e7d3';
        ctx.lineWidth = Math.max(2, width * 0.042);
        ctx.beginPath();
        ctx.moveTo(bl.x + width * 0.15, tl.y + height * 0.2);
        ctx.lineTo(bl.x + width * 0.85, bl.y - height * 0.12);
        ctx.moveTo(bl.x + width * 0.85, tl.y + height * 0.2);
        ctx.lineTo(bl.x + width * 0.15, bl.y - height * 0.12);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#dfb966';
        ctx.strokeStyle = '#9e7a34';
        ctx.lineWidth = Math.max(1.6, width * 0.025);
        ctx.beginPath();
        ctx.roundRect(bl.x, tl.y + height * 0.12, width, height * 0.88, Math.max(4, width * 0.12));
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 245, 210, 0.25)';
        ctx.fillRect(bl.x + width * 0.06, tl.y + height * 0.17, width * 0.88, height * 0.14);

        ctx.strokeStyle = '#8a692b';
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

    this.drawGroundShadow(ctx, (leftBase.x + rightBase.x) * 0.5, leftBase.y + height * 0.06, width * 0.5, Math.max(4, height * 0.16));

    if (obs.style === 'hurdle') {
      const barH = height * 0.42;
      const postW = Math.max(4, width * 0.045);
      ctx.fillStyle = '#855f3d';
      ctx.fillRect(leftBase.x, leftTop.y, postW, height);
      ctx.fillRect(rightBase.x - postW, leftTop.y, postW, height);

      ctx.fillStyle = '#df7f62';
      ctx.strokeStyle = '#994a34';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(leftBase.x, leftTop.y, width, barH, Math.max(4, barH * 0.3));
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#faf5ea';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(leftBase.x + width * (0.1 + i * 0.18), leftTop.y + 2, width * 0.08, barH - 4);
      }
    } else {
      ctx.fillStyle = obs.style === 'log' ? '#8c623d' : '#689eb9';
      ctx.strokeStyle = obs.style === 'log' ? '#5a3b22' : '#45768f';
      ctx.lineWidth = Math.max(2, height * 0.06);
      ctx.beginPath();
      ctx.roundRect(leftBase.x, leftTop.y, width, height, Math.max(4, height * 0.42));
      ctx.fill();
      ctx.stroke();

      if (obs.style === 'log') {
        ctx.fillStyle = 'rgba(250, 232, 204, 0.18)';
        ctx.beginPath();
        ctx.roundRect(leftBase.x + width * 0.04, leftTop.y + height * 0.14, width * 0.92, height * 0.24, height * 0.12);
        ctx.fill();

        ctx.strokeStyle = 'rgba(242, 226, 204, 0.42)';
        ctx.lineWidth = Math.max(1.4, height * 0.045);
        ctx.beginPath();
        ctx.moveTo(leftBase.x + width * 0.12, leftTop.y + height * 0.44);
        ctx.lineTo(leftBase.x + width * 0.44, leftTop.y + height * 0.44);
        ctx.moveTo(leftBase.x + width * 0.56, leftTop.y + height * 0.68);
        ctx.lineTo(leftBase.x + width * 0.88, leftTop.y + height * 0.68);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#d8e8ed';
        ctx.beginPath();
        ctx.ellipse(leftBase.x + width * 0.26, leftTop.y + height * 0.5, width * 0.09, height * 0.2, 0, 0, Math.PI * 2);
        ctx.ellipse(leftBase.x + width * 0.7, leftTop.y + height * 0.48, width * 0.1, height * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
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

    // Kemer gölgesi yerde (altından geçilecek boşluğu net gösterir!)
    this.drawGroundShadow(ctx, (leftBase.x + rightBase.x) * 0.5, leftBase.y + 3, width * 0.48, Math.max(4, beamH * 0.16));

    ctx.fillStyle = '#855e3b';
    ctx.strokeStyle = '#5a3d24';
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
      ctx.fillStyle = '#65905b';
      for (let i = 0; i < 7; i++) {
        const lx = leftBase.x + (width / 6) * i;
        ctx.beginPath();
        ctx.arc(lx, leftTop.y + beamH * 0.14, Math.max(4, beamH * 0.34), 0, Math.PI * 2);
        ctx.fill();
      }
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
      ctx.fillStyle = obs.matched ? 'rgba(211, 234, 203, 0.93)' : 'rgba(250, 244, 232, 0.96)';
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
        const silSize = Math.min(innerW * 0.44, panelH * 0.72);
        const cx = leftBase.x + width / 2;
        const cy = panelY + panelH * 0.5;

        drawTargetPoseSilhouette(ctx, obs.poseDef, cx, cy, silSize, obs.matched);

        if (this.livePose && relZ < 22 && !obs.matched) {
          drawLiveMirrorOverlay(ctx, this.livePose, this.liveBodyScale, cx, cy, silSize, obs.matched);
        }

        if (obs.holdTime > 0 && !obs.matched) {
          const prog = Math.min(1, obs.holdTime / obs.requiredHold);
          const barW = Math.min(150, innerW * 0.52);
          const barH = 12;
          const bx = cx - barW / 2;
          const by = panelY + panelH - 22;
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

    ctx.fillStyle = '#946d49';
    ctx.strokeStyle = '#63462c';
    ctx.lineWidth = Math.max(2, postW * 0.1);
    ctx.fillRect(leftBase.x, leftTop.y, postW, height);
    ctx.strokeRect(leftBase.x, leftTop.y, postW, height);
    ctx.fillRect(rightBase.x - postW, leftTop.y, postW, height);
    ctx.strokeRect(rightBase.x - postW, leftTop.y, postW, height);

    ctx.fillStyle = obs.matched ? '#5e8e56' : '#df7f62';
    ctx.beginPath();
    ctx.roundRect(leftBase.x - postW * 0.2, leftTop.y, width + postW * 0.4, headerH, Math.max(6, headerH * 0.25));
    ctx.fill();
    ctx.stroke();

    // Üst kemerde yazı yerine sade yıldız / onay ikonu
    if (width > 56) {
      const hx = leftBase.x + width / 2;
      const hy = leftTop.y + headerH / 2;
      const iconR = Math.max(6, headerH * 0.3);
      if (obs.matched) {
        this.drawCheckIcon(ctx, hx, hy, iconR, '#faf7f0');
      } else {
        ctx.fillStyle = '#f5d27b';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? iconR : iconR * 0.48;
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          const sx = hx + Math.cos(a) * rad;
          const sy = hy + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      }
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
    ctx.fillStyle = '#946d49';
    ctx.fillRect(leftBase.x, leftTop.y, postW, height);
    ctx.fillRect(rightBase.x - postW, leftTop.y, postW, height);

    // Yazısız damalı bitiş kemeri!
    const bannerH = height * 0.22;
    const cols = 8;
    const rows = 2;
    const cellW = width / cols;
    const cellH = bannerH / rows;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(leftBase.x, leftTop.y, width, bannerH, 10);
    ctx.clip();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#5e8e56' : '#faf6ec';
        ctx.fillRect(leftBase.x + c * cellW, leftTop.y + r * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
    ctx.restore();
    ctx.strokeStyle = '#3f6939';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(leftBase.x, leftTop.y, width, bannerH, 10);
    ctx.stroke();
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

  /**
   * 5 saniyelik net, okunaklı bölüm başı hazırlık ekranı
   */
  drawPrepCountdown(ctx, w, h) {
    const num = Math.max(1, Math.ceil(this.countdownTimer));
    const title = `Parkur ${this.stage} Başlıyor!`;
    const subText =
      num >= 4
        ? 'Kameranın karşısına geç, 2 adım geri çekil!'
        : num === 3
          ? 'Ayakların da kamerada görünsün!'
          : num === 2
            ? 'Dik dur, boyun ayarlanıyor...'
            : 'Hazır ol, koşuya başlıyoruz!';

    const playerOk = !!this.livePose;
    const statusText = playerOk
      ? this.liveHasLegs
        ? '✓ Oyuncu ve bacaklar algılandı — Süper!'
        : '✓ Oyuncu algılandı (Biraz geri çekilebilirsin)'
      : 'Oyuncu kamerada aranıyor...';

    ctx.save();
    const boxW = Math.min(w - 32, 420);
    const boxH = 220;
    const bx = (w - boxW) / 2;
    const by = (h - boxH) / 2;

    ctx.fillStyle = 'rgba(250, 247, 240, 0.95)';
    ctx.strokeStyle = '#678f60';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 24);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#3d3730';
    ctx.font = '800 20px Nunito, sans-serif';
    ctx.fillText(title, w / 2, by + 34);

    // Geri sayım dairesi
    const prog = this.countdownTimer / this.prepDuration;
    ctx.strokeStyle = '#e3dacb';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(w / 2, by + 102, 40, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#678f60';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(w / 2, by + 102, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
    ctx.stroke();

    ctx.fillStyle = '#4e7847';
    ctx.font = '800 44px Nunito, sans-serif';
    ctx.fillText(String(num), w / 2, by + 104);

    ctx.fillStyle = '#5a5046';
    ctx.font = '700 15px Nunito, sans-serif';
    ctx.fillText(subText, w / 2, by + 164);

    ctx.fillStyle = playerOk ? '#46733f' : '#9c6c31';
    ctx.font = '800 13px Nunito, sans-serif';
    ctx.fillText(statusText, w / 2, by + 194);

    ctx.restore();
  }

  drawArrowIcon(ctx, cx, cy, dir, r, color) {
    ctx.save();
    ctx.translate(cx, cy);
    const rotMap = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
    ctx.rotate(rotMap[dir] || 0);

    ctx.fillStyle = color;
    ctx.beginPath();
    // Kalın, yumuşak köşeli net yön oku (sağa bakan temel şekil)
    ctx.moveTo(r * 0.92, 0);
    ctx.lineTo(r * 0.06, -r * 0.78);
    ctx.lineTo(r * 0.06, -r * 0.34);
    ctx.lineTo(-r * 0.86, -r * 0.34);
    ctx.lineTo(-r * 0.86, r * 0.34);
    ctx.lineTo(r * 0.06, r * 0.34);
    ctx.lineTo(r * 0.06, r * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawCheckIcon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(4, r * 0.34);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.62, cy + r * 0.04);
    ctx.lineTo(cx - r * 0.14, cy + r * 0.54);
    ctx.lineTo(cx + r * 0.7, cy - r * 0.52);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Yazısız, ekranda TAM SABİT (sağa sola kaymayan) büyük yön oku göstergesi
   */
  drawFixedActionCue(ctx, w) {
    const upcoming = this.obstacles.find((o) => !o.resolved && o.z - this.distance > 1.0 && o.z - this.distance < 21);

    let iconType = null; // 'up' | 'down' | 'left' | 'right' | 'check'
    let color = '#5e8e56';
    let bg = 'rgba(250, 247, 240, 0.94)';

    if (upcoming) {
      if (upcoming.type === 'jump') {
        iconType = 'up';
        color = '#df7f62';
      } else if (upcoming.type === 'duck') {
        iconType = 'down';
        color = '#5e8e56';
      } else if (upcoming.type === 'dodge') {
        if (!upcoming.blockedLanes.includes(this.playerLane)) {
          // Çocuk zaten açık şeritteyse yeşil onay!
          iconType = 'check';
          color = '#5e8e56';
          bg = 'rgba(222, 239, 217, 0.95)';
        } else if (upcoming.openLane < this.playerLane) {
          iconType = 'left';
          color = '#d4962e';
        } else {
          iconType = 'right';
          color = '#d4962e';
        }
      } else if (upcoming.type === 'mirror' && upcoming.matched) {
        iconType = 'check';
        color = '#5e8e56';
        bg = 'rgba(222, 239, 217, 0.95)';
      }
    } else if (this.feedbackTimer > 0 && this.feedbackIcon === 'ok') {
      iconType = 'check';
      color = '#5e8e56';
      bg = 'rgba(222, 239, 217, 0.95)';
    }

    if (!iconType) return;

    // Tam sabit orta-üst konum (hiç kaymaz!)
    const size = w < 640 ? 64 : 78;
    const cx = w * 0.5;
    const cy = 64 + size * 0.5;

    ctx.save();
    ctx.fillStyle = bg;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(cx - size / 2, cy - size / 2, size, size, 20);
    ctx.fill();
    ctx.stroke();

    const iconR = size * 0.34;
    if (iconType === 'check') {
      this.drawCheckIcon(ctx, cx, cy, iconR, color);
    } else {
      this.drawArrowIcon(ctx, cx, cy, iconType, iconR, color);
    }
    ctx.restore();
  }

  /**
   * Altta yazısız, sade 3 şerit noktası (Sol / Orta / Sağ)
   */
  drawLaneDots(ctx, w, h) {
    const cx = w * 0.5;
    const cy = h - 24;
    const spacing = 26;

    ctx.save();
    ctx.fillStyle = 'rgba(250, 247, 240, 0.85)';
    ctx.strokeStyle = '#d4cab9';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(cx - 50, cy - 13, 100, 26, 13);
    ctx.fill();
    ctx.stroke();

    [-1, 0, 1].forEach((lane) => {
      const dx = cx + lane * spacing;
      const active = this.playerLane === lane;
      ctx.fillStyle = active ? '#5e8e56' : '#cfc5b4';
      ctx.beginPath();
      ctx.arc(dx, cy, active ? 7.5 : 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}
