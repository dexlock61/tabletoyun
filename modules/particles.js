/**
 * particles.js
 * Canlı ama göz yormayan yıldız, yaprak ve mat konfeti parçacıkları.
 */

export class CalmParticle {
  constructor(x, y, color, shape = 'star') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.shape = shape; // 'star' | 'confetti' | 'leaf' | 'circle'
    this.size = Math.random() * 6 + 5;

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4.2 + 1.6;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 2.4;
    this.gravity = 0.095;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.14;
    this.alpha = 0.92;
    this.decay = 0.018;
  }

  update() {
    this.x += this.vx;
    this.vx *= 0.985;
    this.vy += this.gravity;
    this.y += this.vy;
    this.rotation += this.rotSpeed;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = this.color;

    if (this.shape === 'star') {
      ctx.beginPath();
      const spikes = 5;
      const outerR = this.size;
      const innerR = this.size * 0.48;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / spikes - Math.PI / 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (this.shape === 'confetti') {
      ctx.beginPath();
      ctx.roundRect(-this.size * 0.7, -this.size * 0.35, this.size * 1.4, this.size * 0.7, 2);
      ctx.fill();
    } else if (this.shape === 'leaf') {
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size * 1.15, this.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
