/**
 * poses.js
 * Ayna Kapısı (Mirror Me) tam vücut (kol + gövde + bacak/diz/ayak) hareket kopyalama pozları.
 * Çöp adam yerine sevimli, kıyafetli, yüz ifadeli tam vücut çizgi karakter çizer.
 */

function isVisible(pt, minVis = 0.3) {
  return !!pt && (pt.visibility === undefined || pt.visibility >= minVis);
}

function isRightLegLifted(pose, s) {
  const la = pose.leftAnkle;
  const ra = pose.rightAnkle;
  const lk = pose.leftKnee;
  const rk = pose.rightKnee;

  if (isVisible(la, 0.32) && isVisible(ra, 0.32) && (la.y - ra.y) > s * 0.32) return true;
  if (isVisible(lk, 0.35) && isVisible(rk, 0.35) && (lk.y - rk.y) > s * 0.24) return true;
  return false;
}

function isLeftLegLifted(pose, s) {
  const la = pose.leftAnkle;
  const ra = pose.rightAnkle;
  const lk = pose.leftKnee;
  const rk = pose.rightKnee;

  if (isVisible(la, 0.32) && isVisible(ra, 0.32) && (ra.y - la.y) > s * 0.32) return true;
  if (isVisible(lk, 0.35) && isVisible(rk, 0.35) && (rk.y - lk.y) > s * 0.24) return true;
  return false;
}

function areLegsWide(pose, s) {
  const la = pose.leftAnkle;
  const ra = pose.rightAnkle;
  const lk = pose.leftKnee;
  const rk = pose.rightKnee;

  if (isVisible(la, 0.32) && isVisible(ra, 0.32)) return Math.abs(ra.x - la.x) > s * 1.25;
  if (isVisible(lk, 0.35) && isVisible(rk, 0.35)) return Math.abs(rk.x - lk.x) > s * 1.02;
  return false;
}

function isRightLegSideKick(pose, s) {
  const rh = pose.rightHip;
  const ra = pose.rightAnkle;
  const rk = pose.rightKnee;
  if (!rh) return false;
  if (isVisible(ra, 0.32) && (ra.x - rh.x) > s * 0.52) return true;
  if (isVisible(rk, 0.35) && (rk.x - rh.x) > s * 0.42) return true;
  return false;
}

function isLeftLegSideKick(pose, s) {
  const lh = pose.leftHip;
  const la = pose.leftAnkle;
  const lk = pose.leftKnee;
  if (!lh) return false;
  if (isVisible(la, 0.32) && (lh.x - la.x) > s * 0.52) return true;
  if (isVisible(lk, 0.35) && (lh.x - lk.x) > s * 0.42) return true;
  return false;
}

const STANDING_LEGS = {
  leftKnee: { x: -0.22, y: 0.48 },
  leftAnkle: { x: -0.24, y: 0.96 },
  rightKnee: { x: 0.22, y: 0.48 },
  rightAnkle: { x: 0.24, y: 0.96 },
  squatY: 0
};

export const MIRROR_POSES = [
  {
    id: 'star_wide',
    usesLegs: true,
    check(pose, scale) {
      if (!pose || !pose.leftShoulder || !pose.rightShoulder || !pose.leftWrist || !pose.rightWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      const lUpWide = pose.leftWrist.y < pose.leftShoulder.y - s * 0.12 && (pose.leftShoulder.x - pose.leftWrist.x) > s * 0.28;
      const rUpWide = pose.rightWrist.y < pose.rightShoulder.y - s * 0.12 && (pose.rightWrist.x - pose.rightShoulder.x) > s * 0.28;
      return lUpWide && rUpWide && areLegsWide(pose, s);
    },
    figure: {
      leftElbow: { x: -0.68, y: -0.38 },
      leftWrist: { x: -1.04, y: -0.92 },
      rightElbow: { x: 0.68, y: -0.38 },
      rightWrist: { x: 1.04, y: -0.92 },
      leftKnee: { x: -0.48, y: 0.48 },
      leftAnkle: { x: -0.78, y: 0.94 },
      rightKnee: { x: 0.48, y: 0.48 },
      rightAnkle: { x: 0.78, y: 0.94 },
      squatY: 0
    }
  },
  {
    id: 'flamingo_right',
    usesLegs: true,
    check(pose, scale) {
      if (!pose || !pose.leftShoulder || !pose.rightShoulder || !pose.leftWrist || !pose.rightWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      const armsOut =
        (pose.leftShoulder.x - pose.leftWrist.x) > s * 0.32 &&
        (pose.rightWrist.x - pose.rightShoulder.x) > s * 0.32;
      return armsOut && isRightLegLifted(pose, s);
    },
    figure: {
      leftElbow: { x: -0.76, y: -0.05 },
      leftWrist: { x: -1.22, y: -0.1 },
      rightElbow: { x: 0.76, y: -0.05 },
      rightWrist: { x: 1.22, y: -0.1 },
      leftKnee: { x: -0.22, y: 0.48 },
      leftAnkle: { x: -0.24, y: 0.96 },
      rightKnee: { x: 0.56, y: 0.06 },
      rightAnkle: { x: 0.24, y: 0.48 },
      squatY: 0
    }
  },
  {
    id: 'flamingo_left',
    usesLegs: true,
    check(pose, scale) {
      if (!pose || !pose.leftShoulder || !pose.rightShoulder || !pose.leftWrist || !pose.rightWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      const armsOut =
        (pose.leftShoulder.x - pose.leftWrist.x) > s * 0.32 &&
        (pose.rightWrist.x - pose.rightShoulder.x) > s * 0.32;
      return armsOut && isLeftLegLifted(pose, s);
    },
    figure: {
      leftElbow: { x: -0.76, y: -0.05 },
      leftWrist: { x: -1.22, y: -0.1 },
      rightElbow: { x: 0.76, y: -0.05 },
      rightWrist: { x: 1.22, y: -0.1 },
      leftKnee: { x: -0.56, y: 0.06 },
      leftAnkle: { x: -0.24, y: 0.48 },
      rightKnee: { x: 0.22, y: 0.48 },
      rightAnkle: { x: 0.24, y: 0.96 },
      squatY: 0
    }
  },
  {
    id: 'superhero_right',
    usesLegs: true,
    check(pose, scale) {
      if (!pose || !pose.rightShoulder || !pose.rightWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      const rUp = pose.rightWrist.y < pose.rightShoulder.y - s * 0.24;
      return rUp && isLeftLegLifted(pose, s);
    },
    figure: {
      leftElbow: { x: -0.58, y: 0.28 },
      leftWrist: { x: -0.36, y: 0.55 },
      rightElbow: { x: 0.56, y: -0.4 },
      rightWrist: { x: 0.42, y: -1.06 },
      leftKnee: { x: -0.54, y: 0.05 },
      leftAnkle: { x: -0.44, y: 0.54 },
      rightKnee: { x: 0.22, y: 0.48 },
      rightAnkle: { x: 0.24, y: 0.96 },
      squatY: 0
    }
  },
  {
    id: 'superhero_left',
    usesLegs: true,
    check(pose, scale) {
      if (!pose || !pose.leftShoulder || !pose.leftWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      const lUp = pose.leftWrist.y < pose.leftShoulder.y - s * 0.24;
      return lUp && isRightLegLifted(pose, s);
    },
    figure: {
      leftElbow: { x: -0.56, y: -0.4 },
      leftWrist: { x: -0.42, y: -1.06 },
      rightElbow: { x: 0.58, y: 0.28 },
      rightWrist: { x: 0.36, y: 0.55 },
      leftKnee: { x: -0.22, y: 0.48 },
      leftAnkle: { x: -0.24, y: 0.96 },
      rightKnee: { x: 0.54, y: 0.05 },
      rightAnkle: { x: 0.44, y: 0.54 },
      squatY: 0
    }
  },
  {
    id: 'side_kick_right',
    usesLegs: true,
    check(pose, scale) {
      if (!pose || !pose.rightHip) return false;
      const s = Math.max(0.08, scale || 0.2);
      return isRightLegSideKick(pose, s);
    },
    figure: {
      leftElbow: { x: -0.72, y: -0.1 },
      leftWrist: { x: -1.12, y: -0.32 },
      rightElbow: { x: 0.72, y: -0.1 },
      rightWrist: { x: 1.12, y: -0.32 },
      leftKnee: { x: -0.22, y: 0.48 },
      leftAnkle: { x: -0.24, y: 0.96 },
      rightKnee: { x: 0.65, y: 0.26 },
      rightAnkle: { x: 1.05, y: 0.52 },
      squatY: 0
    }
  },
  {
    id: 'side_kick_left',
    usesLegs: true,
    check(pose, scale) {
      if (!pose || !pose.leftHip) return false;
      const s = Math.max(0.08, scale || 0.2);
      return isLeftLegSideKick(pose, s);
    },
    figure: {
      leftElbow: { x: -0.72, y: -0.1 },
      leftWrist: { x: -1.12, y: -0.32 },
      rightElbow: { x: 0.72, y: -0.1 },
      rightWrist: { x: 1.12, y: -0.32 },
      leftKnee: { x: -0.65, y: 0.26 },
      leftAnkle: { x: -1.05, y: 0.52 },
      rightKnee: { x: 0.22, y: 0.48 },
      rightAnkle: { x: 0.24, y: 0.96 },
      squatY: 0
    }
  },
  {
    id: 'frog_squat',
    usesLegs: true,
    check(pose, scale, meta = {}) {
      if (!pose || !pose.leftShoulder || !pose.rightShoulder) return false;
      const s = Math.max(0.08, scale || 0.2);
      let kneesBent = false;
      if (isVisible(pose.leftHip) && isVisible(pose.leftKnee) && isVisible(pose.rightHip) && isVisible(pose.rightKnee)) {
        const hipY = (pose.leftHip.y + pose.rightHip.y) / 2;
        const kneeY = (pose.leftKnee.y + pose.rightKnee.y) / 2;
        kneesBent = (kneeY - hipY) < s * 0.72;
      }
      return !!(meta.isCrouching || kneesBent);
    },
    figure: {
      leftElbow: { x: -0.75, y: 0.05 },
      leftWrist: { x: -0.82, y: -0.52 },
      rightElbow: { x: 0.75, y: 0.05 },
      rightWrist: { x: 0.82, y: -0.52 },
      leftKnee: { x: -0.66, y: 0.14 },
      leftAnkle: { x: -0.42, y: 0.68 },
      rightKnee: { x: 0.66, y: 0.14 },
      rightAnkle: { x: 0.42, y: 0.68 },
      squatY: 0.22
    }
  },
  {
    id: 'hands_up',
    usesLegs: false,
    check(pose, scale) {
      if (!pose || !pose.leftShoulder || !pose.rightShoulder || !pose.leftWrist || !pose.rightWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      return pose.leftWrist.y < pose.leftShoulder.y - s * 0.22 && pose.rightWrist.y < pose.rightShoulder.y - s * 0.22;
    },
    figure: {
      ...STANDING_LEGS,
      leftElbow: { x: -0.6, y: -0.38 },
      leftWrist: { x: -0.42, y: -1.05 },
      rightElbow: { x: 0.6, y: -0.38 },
      rightWrist: { x: 0.42, y: -1.05 }
    }
  },
  {
    id: 'airplane',
    usesLegs: false,
    check(pose, scale) {
      if (!pose || !pose.leftShoulder || !pose.rightShoulder || !pose.leftWrist || !pose.rightWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      const lWide = (pose.leftShoulder.x - pose.leftWrist.x) > s * 0.46 && Math.abs(pose.leftWrist.y - pose.leftShoulder.y) < s * 0.65;
      const rWide = (pose.rightWrist.x - pose.rightShoulder.x) > s * 0.46 && Math.abs(pose.rightWrist.y - pose.rightShoulder.y) < s * 0.65;
      return lWide && rWide;
    },
    figure: {
      ...STANDING_LEGS,
      leftElbow: { x: -0.78, y: 0.0 },
      leftWrist: { x: -1.25, y: -0.02 },
      rightElbow: { x: 0.78, y: 0.0 },
      rightWrist: { x: 1.25, y: -0.02 }
    }
  },
  {
    id: 'diagonal_dance',
    usesLegs: false,
    check(pose, scale) {
      if (!pose || !pose.leftShoulder || !pose.rightShoulder || !pose.leftWrist || !pose.rightWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      const rUp = pose.rightWrist.y < pose.rightShoulder.y - s * 0.24;
      const lWide = (pose.leftShoulder.x - pose.leftWrist.x) > s * 0.44 && Math.abs(pose.leftWrist.y - pose.leftShoulder.y) < s * 0.65;
      return rUp && lWide;
    },
    figure: {
      ...STANDING_LEGS,
      leftElbow: { x: -0.76, y: 0.02 },
      leftWrist: { x: -1.22, y: 0.0 },
      rightElbow: { x: 0.56, y: -0.38 },
      rightWrist: { x: 0.42, y: -1.06 }
    }
  }
];

/**
 * İki nokta arasında uçları yuvarlatılmış, organik kalınlıkta uzuv parçası (kapsül) çizer.
 */
function drawLimbCapsule(ctx, x1, y1, x2, y2, r1, r2, fillColor, strokeColor) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return;
  const angle = Math.atan2(dy, dx);
  const perp = angle + Math.PI / 2;

  const p1x = x1 + Math.cos(perp) * r1;
  const p1y = y1 + Math.sin(perp) * r1;
  const p2x = x2 + Math.cos(perp) * r2;
  const p2y = y2 + Math.sin(perp) * r2;
  const p3x = x2 - Math.cos(perp) * r2;
  const p3y = y2 - Math.sin(perp) * r2;
  const p4x = x1 - Math.cos(perp) * r1;
  const p4y = y1 - Math.sin(perp) * r1;

  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.arc(x2, y2, r2, perp, perp + Math.PI, true);
  ctx.lineTo(p4x, p4y);
  ctx.arc(x1, y1, r1, perp + Math.PI, perp, true);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1.2, r2 * 0.22);
    ctx.stroke();
  }
}

/**
 * Ayakkabı çizer (bacak açısına göre doğal yönelir)
 */
function drawShoe(ctx, x, y, dirX, size, color, strokeColor) {
  ctx.save();
  ctx.translate(x, y);
  const flip = dirX < -0.05 ? -1 : 1;
  ctx.scale(flip, 1);

  // Ayakkabı gövdesi
  ctx.fillStyle = color;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(1.4, size * 0.015);
  ctx.beginPath();
  ctx.ellipse(size * 0.03, size * 0.02, size * 0.095, size * 0.052, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Krem taban çizgisi
  ctx.fillStyle = '#faf6ec';
  ctx.beginPath();
  ctx.roundRect(-size * 0.055, size * 0.04, size * 0.17, size * 0.026, size * 0.015);
  ctx.fill();

  ctx.restore();
}

/**
 * Sevimli, kıyafetli, saçlı ve gülen çocuk illüstrasyonu (çöp adam yerine gerçek çizgi insan!)
 */
export function drawTargetPoseSilhouette(ctx, poseDef, cx, cy, size, matched = false) {
  const fig = poseDef.figure;
  const outline = '#5a493c';
  const skin = '#f5cfb0';
  const skinShade = '#e8ba96';
  const hair = '#6d4c37';
  const hairHighlight = '#855f46';
  const shirt = matched ? '#66995e' : '#e08365';
  const shirtStripe = matched ? '#a7cfa0' : '#f4cf90';
  const pants = matched ? '#4f7a49' : '#5f879e';
  const shoe = matched ? '#e8b84b' : '#d69e38';

  ctx.save();
  const squatOffset = (fig.squatY || 0) * size;
  ctx.translate(cx, cy + squatOffset);

  const shoulderY = -size * 0.22;
  const hipY = size * 0.18;
  const shoulderHalf = size * 0.2;
  const hipHalf = size * 0.14;
  const unit = size * 0.48;

  // Eklem koordinatları
  const lHip = { x: -hipHalf, y: hipY };
  const rHip = { x: hipHalf, y: hipY };
  const lKnee = { x: fig.leftKnee.x * unit, y: hipY + fig.leftKnee.y * unit };
  const rKnee = { x: fig.rightKnee.x * unit, y: hipY + fig.rightKnee.y * unit };
  const lAnkle = { x: fig.leftAnkle.x * unit, y: hipY + fig.leftAnkle.y * unit };
  const rAnkle = { x: fig.rightAnkle.x * unit, y: hipY + fig.rightAnkle.y * unit };

  const lShoulder = { x: -shoulderHalf, y: shoulderY };
  const rShoulder = { x: shoulderHalf, y: shoulderY };
  const lElbow = { x: fig.leftElbow.x * unit, y: shoulderY + fig.leftElbow.y * unit };
  const rElbow = { x: fig.rightElbow.x * unit, y: shoulderY + fig.rightElbow.y * unit };
  const lWrist = { x: fig.leftWrist.x * unit, y: shoulderY + fig.leftWrist.y * unit };
  const rWrist = { x: fig.rightWrist.x * unit, y: shoulderY + fig.rightWrist.y * unit };

  const legUpperR = size * 0.072;
  const legMidR = size * 0.058;
  const legAnkleR = size * 0.048;

  // 1. BACAKLAR (Pantolonlu organik üst ve alt bacaklar + ayakkabılar)
  drawLimbCapsule(ctx, lHip.x, lHip.y, lKnee.x, lKnee.y, legUpperR, legMidR, pants, outline);
  drawLimbCapsule(ctx, lKnee.x, lKnee.y, lAnkle.x, lAnkle.y, legMidR, legAnkleR, pants, outline);
  drawLimbCapsule(ctx, rHip.x, rHip.y, rKnee.x, rKnee.y, legUpperR, legMidR, pants, outline);
  drawLimbCapsule(ctx, rKnee.x, rKnee.y, rAnkle.x, rAnkle.y, legMidR, legAnkleR, pants, outline);

  drawShoe(ctx, lAnkle.x, lAnkle.y, lAnkle.x - lKnee.x - 0.1, size, shoe, outline);
  drawShoe(ctx, rAnkle.x, rAnkle.y, rAnkle.x - rKnee.x + 0.1, size, shoe, outline);

  // 2. KOLLAR (Tişört kolu + ten rengi ön kol + sevimli yuvarlak eller)
  const armUpperR = size * 0.062;
  const armMidR = size * 0.05;
  const armWristR = size * 0.042;

  // Sol kol
  drawLimbCapsule(ctx, lShoulder.x, lShoulder.y, lElbow.x, lElbow.y, armUpperR, armMidR, shirt, outline);
  drawLimbCapsule(ctx, lElbow.x, lElbow.y, lWrist.x, lWrist.y, armMidR * 0.92, armWristR, skin, outline);
  // Sağ kol
  drawLimbCapsule(ctx, rShoulder.x, rShoulder.y, rElbow.x, rElbow.y, armUpperR, armMidR, shirt, outline);
  drawLimbCapsule(ctx, rElbow.x, rElbow.y, rWrist.x, rWrist.y, armMidR * 0.92, armWristR, skin, outline);

  // Eller
  ctx.fillStyle = skin;
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1.2, size * 0.015);
  [lWrist, rWrist].forEach((hand) => {
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, size * 0.058, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // 3. GÖVDE (Sevimli çizgili kazak / tişört + şort/pantolon beli)
  const torsoTop = shoulderY - size * 0.04;
  const torsoH = hipY - torsoTop + size * 0.09;
  const torsoW = shoulderHalf * 2.08;

  // Pantolon bel kısmı
  ctx.fillStyle = pants;
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1.5, size * 0.018);
  ctx.beginPath();
  ctx.roundRect(-hipHalf * 1.45, hipY - size * 0.05, hipHalf * 2.9, size * 0.15, size * 0.06);
  ctx.fill();
  ctx.stroke();

  // Tişört gövdesi
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.roundRect(-torsoW / 2, torsoTop, torsoW, torsoH * 0.88, size * 0.11);
  ctx.fill();
  ctx.stroke();

  // Tişört üzerinde iki sıcak şerit (çizgi film karakter havası!)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-torsoW / 2 + 1, torsoTop + 1, torsoW - 2, torsoH * 0.88 - 2, size * 0.1);
  ctx.clip();
  ctx.fillStyle = shirtStripe;
  ctx.fillRect(-torsoW / 2, torsoTop + torsoH * 0.34, torsoW, torsoH * 0.12);
  ctx.fillRect(-torsoW / 2, torsoTop + torsoH * 0.56, torsoW, torsoH * 0.09);
  ctx.restore();

  // 4. BOYUN VE BAŞ (Saç, kulaklar, gözler, pembe yanaklar, gülümseme)
  const headY = shoulderY - size * 0.24;
  const headR = size * 0.185;

  // Boyun
  ctx.fillStyle = skinShade;
  ctx.fillRect(-size * 0.048, shoulderY - size * 0.1, size * 0.096, size * 0.09);

  // Arka saç hacmi (sevimli küt / atkuyruğu)
  ctx.fillStyle = hair;
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1.4, size * 0.016);
  ctx.beginPath();
  ctx.arc(0, headY - headR * 0.06, headR * 1.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Minik iki yandan saç topuzu / buklesi
  ctx.beginPath();
  ctx.arc(-headR * 0.96, headY - headR * 0.38, headR * 0.36, 0, Math.PI * 2);
  ctx.arc(headR * 0.96, headY - headR * 0.38, headR * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Kulaklar
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(-headR * 0.96, headY + headR * 0.08, headR * 0.2, 0, Math.PI * 2);
  ctx.arc(headR * 0.96, headY + headR * 0.08, headR * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Yüz
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, headY + headR * 0.04, headR * 0.94, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ön kakül saç
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(0, headY - headR * 0.08, headR * 0.96, Math.PI * 1.08, Math.PI * 1.92);
  ctx.quadraticCurveTo(headR * 0.25, headY - headR * 0.25, 0, headY - headR * 0.42);
  ctx.quadraticCurveTo(-headR * 0.35, headY - headR * 0.22, -headR * 0.92, headY - headR * 0.26);
  ctx.closePath();
  ctx.fill();

  // Saç üst parıltısı
  ctx.strokeStyle = hairHighlight;
  ctx.lineWidth = Math.max(1.5, headR * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, headY - headR * 0.12, headR * 0.72, Math.PI * 1.25, Math.PI * 1.62);
  ctx.stroke();

  // Gözler (yeterince büyükse detayları çiz)
  if (size > 34) {
    ctx.fillStyle = '#3b2f28';
    ctx.beginPath();
    ctx.arc(-headR * 0.34, headY + headR * 0.04, headR * 0.11, 0, Math.PI * 2);
    ctx.arc(headR * 0.34, headY + headR * 0.04, headR * 0.11, 0, Math.PI * 2);
    ctx.fill();

    // Göz ışıltısı
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-headR * 0.37, headY, headR * 0.045, 0, Math.PI * 2);
    ctx.arc(headR * 0.31, headY, headR * 0.045, 0, Math.PI * 2);
    ctx.fill();

    // Pembe yanaklar
    ctx.fillStyle = 'rgba(232, 134, 120, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-headR * 0.52, headY + headR * 0.26, headR * 0.16, headR * 0.1, 0, 0, Math.PI * 2);
    ctx.ellipse(headR * 0.52, headY + headR * 0.26, headR * 0.16, headR * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neşeli gülümseme
    ctx.strokeStyle = '#6b4536';
    ctx.lineWidth = Math.max(1.5, headR * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, headY + headR * 0.26, headR * (matched ? 0.32 : 0.24), 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Çocuğun canlı el ve ayak konumlarını karakter üzerinde yumuşak yönlendirici halkalarla gösterir.
 */
export function drawLiveMirrorOverlay(ctx, pose, bodyScale, cx, cy, size, matched = false) {
  if (!pose || !pose.leftShoulder || !pose.rightShoulder) return;

  const ls = pose.leftShoulder;
  const rs = pose.rightShoulder;
  const midX = (ls.x + rs.x) / 2;
  const midY = (ls.y + rs.y) / 2;
  const s = Math.max(0.08, bodyScale || 0.2);

  const shoulderY = -size * 0.22;
  const scaleFactor = (size * 0.44) / s;

  const mapPt = (pt) => {
    if (!pt || !isVisible(pt, 0.28)) return null;
    return {
      x: (pt.x - midX) * scaleFactor,
      y: shoulderY + (pt.y - midY) * scaleFactor
    };
  };

  const pLS = mapPt(ls);
  const pRS = mapPt(rs);
  const pLE = mapPt(pose.leftElbow);
  const pRE = mapPt(pose.rightElbow);
  const pLW = mapPt(pose.leftWrist);
  const pRW = mapPt(pose.rightWrist);
  const pLH = mapPt(pose.leftHip);
  const pRH = mapPt(pose.rightHip);
  const pLK = mapPt(pose.leftKnee);
  const pRK = mapPt(pose.rightKnee);
  const pLA = mapPt(pose.leftAnkle);
  const pRA = mapPt(pose.rightAnkle);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, size * 0.042);
  ctx.strokeStyle = matched ? 'rgba(70, 120, 62, 0.65)' : 'rgba(95, 135, 158, 0.55)';

  // Yarı saydam rehber çizgiler
  ctx.beginPath();
  if (pLS && pLE && pLW) {
    ctx.moveTo(pLS.x, pLS.y);
    ctx.lineTo(pLE.x, pLE.y);
    ctx.lineTo(pLW.x, pLW.y);
  }
  if (pRS && pRE && pRW) {
    ctx.moveTo(pRS.x, pRS.y);
    ctx.lineTo(pRE.x, pRE.y);
    ctx.lineTo(pRW.x, pRW.y);
  }
  if (pLH && pLK) {
    ctx.moveTo(pLH.x, pLH.y);
    ctx.lineTo(pLK.x, pLK.y);
    if (pLA) ctx.lineTo(pLA.x, pLA.y);
  }
  if (pRH && pRK) {
    ctx.moveTo(pRH.x, pRH.y);
    ctx.lineTo(pRK.x, pRK.y);
    if (pRA) ctx.lineTo(pRA.x, pRA.y);
  }
  ctx.stroke();

  // Canlı el ve ayak konum halkaları (çocuk kendi ellerini/ayaklarını karakterinkilerle üst üste getirir!)
  const ringR = Math.max(4.5, size * 0.068);
  [pLW, pRW].forEach((pt) => {
    if (!pt) return;
    ctx.fillStyle = matched ? 'rgba(86, 148, 76, 0.85)' : 'rgba(224, 131, 101, 0.85)';
    ctx.strokeStyle = '#faf7f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  [pLA, pRA].forEach((pt) => {
    if (!pt) return;
    ctx.fillStyle = matched ? 'rgba(86, 148, 76, 0.85)' : 'rgba(232, 184, 75, 0.88)';
    ctx.strokeStyle = '#faf7f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}
