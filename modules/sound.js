/**
 * sound.js
 * Canlı, neşeli ve çocuk dostu Web Audio ses ve ritim motoru.
 * Sert patlama/parazit yerine zıplayan yay, yükselen kombo çanı,
 * yıldız toplama tınısı ve isteğe bağlı neşeli marimba koşu ritmi üretir.
 */

export class SoundSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicEnabled = true;
    this.musicTimer = null;
    this.beatStep = 0;
  }

  setMuted(isMuted) {
    this.muted = !!isMuted;
    if (this.muted) this.stopMusic();
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = !!enabled;
    if (!this.musicEnabled) {
      this.stopMusic();
    }
  }

  init() {
    if (this.muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch (e) {
        // Sessizce devam et
      }
    }
    return this.ctx;
  }

  playTone(freqStart, freqEnd, duration, volume = 0.16, type = 'triangle', delay = 0) {
    try {
      const ctx = this.init();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.025);
    } catch (e) {
      // Ses engellenmişse sessizce geç
    }
  }

  // 3-2-1 Geri sayım bipi
  playCountdown(isGo = false) {
    if (isGo) {
      this.playTone(523.25, 523.25, 0.14, 0.18, 'triangle', 0);
      this.playTone(659.25, 659.25, 0.14, 0.18, 'triangle', 0.08);
      this.playTone(783.99, 783.99, 0.28, 0.2, 'triangle', 0.16);
    } else {
      this.playTone(440, 440, 0.12, 0.14, 'triangle');
    }
  }

  // Zıplama: neşeli esnek yay sesi (boing!)
  playJump() {
    this.playTone(240, 540, 0.19, 0.17, 'triangle', 0);
    this.playTone(360, 620, 0.14, 0.08, 'sine', 0.03);
  }

  // Eğilme: hızlı aşağı vınlama
  playDuck() {
    this.playTone(420, 190, 0.15, 0.13, 'sine');
  }

  // Şerit değiştirme: canlı adım vınlaması
  playStep() {
    this.playTone(260, 360, 0.08, 0.09, 'triangle');
  }

  // Yoldan yıldız toplama (seri arttıkça nota yükselir!)
  playStar(streak = 0) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const base = scale[Math.min(scale.length - 1, streak % scale.length)];
    this.playTone(base, base * 1.12, 0.13, 0.15, 'sine', 0);
    this.playTone(base * 1.5, base * 1.5, 0.16, 0.09, 'triangle', 0.05);
  }

  // Engel geçme (kombo yükselişli)
  playClear(streak = 1) {
    const scale = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
    const f1 = scale[Math.min(scale.length - 1, Math.max(0, streak - 1))];
    this.playTone(f1, f1, 0.14, 0.14, 'triangle', 0);
    this.playTone(f1 * 1.25, f1 * 1.25, 0.2, 0.13, 'sine', 0.06);
  }

  // Ayna Kapısı eşleşti: coşkulu sihirli kapı açılma akoru!
  playPoseMatch() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this.playTone(n, n, 0.24, 0.15, 'triangle', i * 0.065);
    });
  }

  // Engele çarpma: komik yumuşak çizgi film 'bonk' sesi
  playBump() {
    this.playTone(210, 95, 0.18, 0.17, 'triangle', 0);
    this.playTone(130, 80, 0.16, 0.12, 'sine', 0.05);
  }

  // Parkur tamamlandı: neşeli zafer melodisi
  playStageComplete() {
    const notes = [392.0, 523.25, 659.25, 783.99, 659.25, 1046.5];
    const times = [0, 0.1, 0.2, 0.3, 0.44, 0.56];
    notes.forEach((n, idx) => {
      this.playTone(n, n, idx === notes.length - 1 ? 0.45 : 0.2, 0.16, 'triangle', times[idx]);
    });
  }

  // Dinlenme / tekrar dene kapanışı
  playGentleEnd() {
    const notes = [440.0, 392.0, 329.63];
    notes.forEach((n, idx) => {
      this.playTone(n, n, 0.25, 0.12, 'triangle', idx * 0.14);
    });
  }

  // Hafif, neşeli ahşap marimba macera ritmi (koşu sırasında heyecan katar)
  startMusic() {
    if (this.muted || !this.musicEnabled || this.musicTimer) return;
    this.init();
    const melody = [
      261.63, 329.63, 392.0, 329.63,
      293.66, 349.23, 440.0, 349.23,
      261.63, 329.63, 392.0, 523.25,
      392.0, 329.63, 293.66, 329.63
    ];
    const bass = [130.81, 0, 196.0, 0, 146.83, 0, 220.0, 0];

    this.beatStep = 0;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.musicEnabled) {
        this.stopMusic();
        return;
      }
      const mNote = melody[this.beatStep % melody.length];
      const bNote = bass[this.beatStep % bass.length];
      if (mNote) {
        this.playTone(mNote, mNote, 0.14, 0.042, 'triangle', 0);
      }
      if (bNote) {
        this.playTone(bNote, bNote, 0.18, 0.038, 'sine', 0);
      }
      this.beatStep++;
    }, 260);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const sfx = new SoundSynth();
