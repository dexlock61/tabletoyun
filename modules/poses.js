/**
 * poses.js
 * Ayna Kapısı (Mirror Me) tam vücut (kol + gövde + bacak/diz/ayak) hareket kopyalama pozları,
 * çocuk dostu esnek algılama kuralları ve tam vücut silüet/canlı ayna çizimleri.
 */

// Yardımcı poz ölçümleri (aynalanmış ekran koordinatları: sol < sağ, yukarı < aşağı)
function isVisible(pt, minVis = 0.3) {
  return !!pt && (pt.visibility === undefined || pt.visibility >= minVis);
}

function getFootOrKneeY(ankle, knee) {
  if (isVisible(ankle, 0.32)) return { y: ankle.y, isAnkle: true };
  if (isVisible(knee, 0.35)) return { y: knee.y, isAnkle: false };
  return null;
}

function isRightLegLifted(pose, s) {
  const la = pose.leftAnkle;
  const ra = pose.rightAnkle;
  const lk = pose.leftKnee;
  const rk = pose.rightKnee;

  // Ayak bileği farkı (sağ ayak soldan belirgin yukarıda)
  if (isVisible(la, 0.32) && isVisible(ra, 0.32) && (la.y - ra.y) > s * 0.32) {
    return true;
  }
  // Diz farkı (sağ diz soldan belirgin yukarıda — tek ayak diz çekme)
  if (isVisible(lk, 0.35) && isVisible(rk, 0.35) && (lk.y - rk.y) > s * 0.24) {
    return true;
  }
  return false;
}

function isLeftLegLifted(pose, s) {
  const la = pose.leftAnkle;
  const ra = pose.rightAnkle;
  const lk = pose.leftKnee;
  const rk = pose.rightKnee;

  if (isVisible(la, 0.32) && isVisible(ra, 0.32) && (ra.y - la.y) > s * 0.32) {
    return true;
  }
  if (isVisible(lk, 0.35) && isVisible(rk, 0.35) && (rk.y - lk.y) > s * 0.24) {
    return true;
  }
  return false;
}

function areLegsWide(pose, s) {
  const la = pose.leftAnkle;
  const ra = pose.rightAnkle;
  const lk = pose.leftKnee;
  const rk = pose.rightKnee;

  if (isVisible(la, 0.32) && isVisible(ra, 0.32)) {
    return Math.abs(ra.x - la.x) > s * 1.25;
  }
  if (isVisible(lk, 0.35) && isVisible(rk, 0.35)) {
    return Math.abs(rk.x - lk.x) > s * 1.02;
  }
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

// Varsayılan düz duran bacaklar
const STANDING_LEGS = {
  leftKnee: { x: -0.22, y: 0.48 },
  leftAnkle: { x: -0.24, y: 0.96 },
  rightKnee: { x: 0.22, y: 0.48 },
  rightAnkle: { x: 0.24, y: 0.96 },
  squatY: 0
};

export const MIRROR_POSES = [
  // 1. Tam Vücut: Yıldız Ol (Kollar yukarı-yana + bacaklar açık!)
  {
    id: 'star_wide',
    usesLegs: true,
    title: 'Yıldız Ol',
    subtitle: 'Kollarını ve bacaklarını kocaman aç!',
    check(pose, scale) {
      if (!pose || !pose.leftShoulder || !pose.rightShoulder || !pose.leftWrist || !pose.rightWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      const lUpWide = pose.leftWrist.y < pose.leftShoulder.y - s * 0.12 && (pose.leftShoulder.x - pose.leftWrist.x) > s * 0.28;
      const rUpWide = pose.rightWrist.y < pose.rightShoulder.y - s * 0.12 && (pose.rightWrist.x - pose.rightShoulder.x) > s * 0.28;
      return lUpWide && rUpWide && areLegsWide(pose, s);
    },
    figure: {
      leftElbow: { x: -0.68, y: -0.4 },
      leftWrist: { x: -1.05, y: -0.92 },
      rightElbow: { x: 0.68, y: -0.4 },
      rightWrist: { x: 1.05, y: -0.92 },
      leftKnee: { x: -0.48, y: 0.48 },
      leftAnkle: { x: -0.78, y: 0.94 },
      rightKnee: { x: 0.48, y: 0.48 },
      rightAnkle: { x: 0.78, y: 0.94 },
      squatY: 0
    }
  },

  // 2. Tam Vücut: Sağ Ayak Flamingo (Sağ diz yukarı + kollar açık!)
  {
    id: 'flamingo_right',
    usesLegs: true,
    title: 'Sağ Flamingo',
    subtitle: 'Sağ dizini kaldır, kollarını aç!',
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
      rightKnee: { x: 0.56, y: 0.08 },
      rightAnkle: { x: 0.24, y: 0.46 },
      squatY: 0
    }
  },

  // 3. Tam Vücut: Sol Ayak Flamingo (Sol diz yukarı + kollar açık!)
  {
    id: 'flamingo_left',
    usesLegs: true,
    title: 'Sol Flamingo',
    subtitle: 'Sol dizini kaldır, kollarını aç!',
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
      leftKnee: { x: -0.56, y: 0.08 },
      leftAnkle: { x: -0.24, y: 0.46 },
      rightKnee: { x: 0.22, y: 0.48 },
      rightAnkle: { x: 0.24, y: 0.96 },
      squatY: 0
    }
  },

  // 4. Tam Vücut: Süper Kahraman (Sağ el yukarı + sol diz yukarı!)
  {
    id: 'superhero_right',
    usesLegs: true,
    title: 'Süper Kahraman',
    subtitle: 'Sağ elini ve sol dizini kaldır!',
    check(pose, scale) {
      if (!pose || !pose.rightShoulder || !pose.rightWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      const rUp = pose.rightWrist.y < pose.rightShoulder.y - s * 0.24;
      return rUp && isLeftLegLifted(pose, s);
    },
    figure: {
      leftElbow: { x: -0.55, y: 0.25 },
      leftWrist: { x: -0.35, y: 0.52 },
      rightElbow: { x: 0.56, y: -0.4 },
      rightWrist: { x: 0.42, y: -1.08 },
      leftKnee: { x: -0.52, y: 0.06 },
      leftAnkle: { x: -0.44, y: 0.54 },
      rightKnee: { x: 0.22, y: 0.48 },
      rightAnkle: { x: 0.24, y: 0.96 },
      squatY: 0
    }
  },

  // 5. Tam Vücut: Süper Kahraman Sol (Sol el yukarı + sağ diz yukarı!)
  {
    id: 'superhero_left',
    usesLegs: true,
    title: 'Uçan Kahraman',
    subtitle: 'Sol elini ve sağ dizini kaldır!',
    check(pose, scale) {
      if (!pose || !pose.leftShoulder || !pose.leftWrist) return false;
      const s = Math.max(0.08, scale || 0.2);
      const lUp = pose.leftWrist.y < pose.leftShoulder.y - s * 0.24;
      return lUp && isRightLegLifted(pose, s);
    },
    figure: {
      leftElbow: { x: -0.56, y: -0.4 },
      leftWrist: { x: -0.42, y: -1.08 },
      rightElbow: { x: 0.55, y: 0.25 },
      rightWrist: { x: 0.35, y: 0.52 },
      leftKnee: { x: -0.22, y: 0.48 },
      leftAnkle: { x: -0.24, y: 0.96 },
      rightKnee: { x: 0.52, y: 0.06 },
      rightAnkle: { x: 0.44, y: 0.54 },
      squatY: 0
    }
  },

  // 6. Tam Vücut: Dansçı Bacak (Sağ bacağı yana aç!)
  {
    id: 'side_kick_right',
    usesLegs: true,
    title: 'Sağ Dans Adımı',
    subtitle: 'Sağ bacağını yana aç, iki elinle dengele!',
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

  // 7. Tam Vücut: Sol Dans Adımı (Sol bacağı yana aç!)
  {
    id: 'side_kick_left',
    usesLegs: true,
    title: 'Sol Dans Adımı',
    subtitle: 'Sol bacağını yana aç, iki elinle dengele!',
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

  // 8. Tam Vücut: Kurbağa Çömelmesi (Çömel + eller öne/yukarı!)
  {
    id: 'frog_squat',
    usesLegs: true,
    title: 'Minik Kurbağa',
    subtitle: 'Çömel ve kollarını iki yana kaldır!',
    check(pose, scale, meta = {}) {
      if (!pose || !pose.leftShoulder || !pose.rightShoulder) return false;
      const s = Math.max(0.08, scale || 0.2);
      // Eğilme bayrağı VEYA kalça-diz yüksekliğinin yakınlaşması (gerçek çömelme)
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

  // 9. Üst Vücut: Güneş Ol (İki Kol Yukarı)
  {
    id: 'hands_up',
    usesLegs: false,
    title: 'Güneşe Uzan',
    subtitle: 'İki kolunu birden yukarı kaldır!',
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

  // 10. Üst Vücut: Uçak Ol (Kollar İki Yana Açık)
  {
    id: 'airplane',
    usesLegs: false,
    title: 'Uçak Ol',
    subtitle: 'Kollarını kanat gibi iki yana aç!',
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

  // 11. Üst Vücut: Çapraz Dans (Sağ el yukarı, sol el yana!)
  {
    id: 'diagonal_dance',
    usesLegs: false,
    title: 'Çapraz Dans',
    subtitle: 'Sağ elin yukarı, sol kolun yana!',
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
 * Kapı üzerindeki tam vücut hedef poz silüetini (kollar + gövde + bacaklar/dizler/ayaklar) çizer.
 */
export function drawTargetPoseSilhouette(ctx, poseDef, cx, cy, size, matched = false) {
  const fig = poseDef.figure;
  const strokeColor = matched ? '#46733f' : '#6c5844';
  const fillColor = matched ? '#a9c99e' : '#dfd0ba';
  const accentColor = matched ? '#4f8248' : '#df7f62';
  const footColor = matched ? '#4f8248' : '#d6a43e';

  ctx.save();
  const squatOffset = (fig.squatY || 0) * size;
  ctx.translate(cx, cy + squatOffset);

  const shoulderY = -size * 0.24;
  const hipY = size * 0.2;
  const shoulderHalf = size * 0.22;
  const hipHalf = size * 0.16;
  const unit = size * 0.48;

  // Gövde
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2.2, size * 0.04);
  ctx.beginPath();
  ctx.roundRect(
    -shoulderHalf * 0.92,
    shoulderY - size * 0.03,
    shoulderHalf * 1.84,
    hipY - shoulderY + size * 0.08,
    size * 0.12
  );
  ctx.fill();
  ctx.stroke();

  // Baş
  ctx.beginPath();
  ctx.arc(0, shoulderY - size * 0.22, size * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Bacaklar (kalça -> diz -> ayak bileği)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size * 0.095);
  ctx.strokeStyle = strokeColor;
  ctx.beginPath();
  // Sol bacak
  ctx.moveTo(-hipHalf, hipY);
  ctx.lineTo(fig.leftKnee.x * unit, hipY + fig.leftKnee.y * unit);
  ctx.lineTo(fig.leftAnkle.x * unit, hipY + fig.leftAnkle.y * unit);
  // Sağ bacak
  ctx.moveTo(hipHalf, hipY);
  ctx.lineTo(fig.rightKnee.x * unit, hipY + fig.rightKnee.y * unit);
  ctx.lineTo(fig.rightAnkle.x * unit, hipY + fig.rightAnkle.y * unit);
  ctx.stroke();

  // Ayaklar (sarı ayakkabı noktaları — bacak hareketini çocuk anında fark eder!)
  ctx.fillStyle = footColor;
  const footR = Math.max(3.5, size * 0.072);
  ctx.beginPath();
  ctx.arc(fig.leftAnkle.x * unit, hipY + fig.leftAnkle.y * unit, footR, 0, Math.PI * 2);
  ctx.arc(fig.rightAnkle.x * unit, hipY + fig.rightAnkle.y * unit, footR, 0, Math.PI * 2);
  ctx.fill();

  // Kollar (omuz -> dirsek -> bilek)
  ctx.lineWidth = Math.max(4, size * 0.092);
  ctx.strokeStyle = strokeColor;
  ctx.beginPath();
  ctx.moveTo(-shoulderHalf, shoulderY);
  ctx.lineTo(fig.leftElbow.x * unit, shoulderY + fig.leftElbow.y * unit);
  ctx.lineTo(fig.leftWrist.x * unit, shoulderY + fig.leftWrist.y * unit);

  ctx.moveTo(shoulderHalf, shoulderY);
  ctx.lineTo(fig.rightElbow.x * unit, shoulderY + fig.rightElbow.y * unit);
  ctx.lineTo(fig.rightWrist.x * unit, shoulderY + fig.rightWrist.y * unit);
  ctx.stroke();

  // Eller (sıcak mercan daireler)
  ctx.fillStyle = accentColor;
  const handR = Math.max(3.5, size * 0.07);
  ctx.beginPath();
  ctx.arc(fig.leftWrist.x * unit, shoulderY + fig.leftWrist.y * unit, handR, 0, Math.PI * 2);
  ctx.arc(fig.rightWrist.x * unit, shoulderY + fig.rightWrist.y * unit, handR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Çocuğun canlı tam vücut hareketini (kollar + bacaklar) kapıdaki hedef silüet üzerine yansıtır.
 */
export function drawLiveMirrorOverlay(ctx, pose, bodyScale, cx, cy, size, matched = false) {
  if (!pose || !pose.leftShoulder || !pose.rightShoulder) return;

  const ls = pose.leftShoulder;
  const rs = pose.rightShoulder;
  const midX = (ls.x + rs.x) / 2;
  const midY = (ls.y + rs.y) / 2;
  const s = Math.max(0.08, bodyScale || 0.2);

  const shoulderY = -size * 0.24;
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
  ctx.lineWidth = Math.max(3, size * 0.065);
  ctx.strokeStyle = matched ? 'rgba(70, 115, 63, 0.92)' : 'rgba(223, 127, 98, 0.86)';

  ctx.beginPath();
  // Kollar
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
  // Bacaklar
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

  // Canlı el ve ayak noktaları
  ctx.fillStyle = matched ? '#46733f' : '#df7f62';
  [pLW, pRW].forEach((pt) => {
    if (!pt) return;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(3, size * 0.055), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = matched ? '#46733f' : '#e0a938';
  [pLA, pRA].forEach((pt) => {
    if (!pt) return;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(3, size * 0.055), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}
