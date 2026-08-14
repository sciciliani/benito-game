// Small procedural canvas textures (grass, sky gradient + clouds, water
// ripples, and generic health-bar sprites) so the world reads as more than
// flat colored primitives without needing any external image assets.

function makeGrassTexture(baseColorHex) {
  const base = new THREE.Color(baseColorHex);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  const blade = new THREE.Color();
  for (let i = 0; i < 1100; i++) {
    const t = 0.65 + Math.random() * 0.7;
    blade.copy(base).multiplyScalar(t);
    ctx.fillStyle = `rgb(${(blade.r * 255) | 0},${(blade.g * 255) | 0},${(blade.b * 255) | 0})`;
    const x = Math.random() * size, y = Math.random() * size;
    const w = 1 + Math.random() * 2, h = 3 + Math.random() * 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.9);
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.restore();
  }
  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = 'rgba(50,35,15,0.12)';
    const x = Math.random() * size, y = Math.random() * size, r = 4 + Math.random() * 12;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeFurTexture(baseColorHex) {
  const base = new THREE.Color(baseColorHex);
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  const strand = new THREE.Color();
  for (let i = 0; i < 2200; i++) {
    const t = 0.78 + Math.random() * 0.44;
    strand.copy(base).multiplyScalar(t);
    ctx.strokeStyle = `rgba(${(strand.r * 255) | 0},${(strand.g * 255) | 0},${(strand.b * 255) | 0},0.55)`;
    ctx.lineWidth = 0.6;
    const x = Math.random() * size, y = Math.random() * size;
    const len = 2 + Math.random() * 3.5;
    const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.7; // mostly vertical, like combed fur
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function makeCloudTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 6; i++) {
    const x = size * 0.3 + Math.random() * size * 0.4;
    const y = size * 0.5 + (Math.random() - 0.5) * 24;
    const r = 18 + Math.random() * 24;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function buildSkyDome(topColorHex, horizonColorHex) {
  const w = 8, h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const top = new THREE.Color(topColorHex), horizon = new THREE.Color(horizonColorHex);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `#${top.getHexString()}`);
  grad.addColorStop(0.65, `#${horizon.getHexString()}`);
  grad.addColorStop(1, '#f4fdff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const skyTex = new THREE.CanvasTexture(canvas);
  const domeGeo = new THREE.SphereGeometry(280, 24, 16);
  const domeMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(domeGeo, domeMat);

  const group = new THREE.Group();
  group.renderOrder = -1;
  group.add(dome);

  const cloudTex = makeCloudTexture();
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    const sprite = new THREE.Sprite(mat);
    const ang = Math.random() * Math.PI * 2;
    const dist = 160 + Math.random() * 90;
    sprite.position.set(Math.cos(ang) * dist, 35 + Math.random() * 45, Math.sin(ang) * dist);
    const s = 28 + Math.random() * 38;
    sprite.scale.set(s, s * 0.5, 1);
    group.add(sprite);
  }
  return group;
}

function makeWaterTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2c82d6';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 55; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.14})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    const x = Math.random() * size, y = Math.random() * size, r = 4 + Math.random() * 12;
    ctx.beginPath();
    ctx.arc(x, y, r, 0.3, Math.PI * 1.4);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// A small always-faces-camera health bar. Call redraw(fraction) whenever HP
// changes; fraction is clamped to [0,1].
function makeHealthBarSprite() {
  const width = 64, height = 10;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.9, (0.9 * height) / width, 1);

  function redraw(fraction) {
    fraction = THREE.MathUtils.clamp(fraction, 0, 1);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(15,15,15,0.75)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = fraction > 0.4 ? '#5ad25a' : '#e0483f';
    ctx.fillRect(2, 2, Math.max(0, (width - 4) * fraction), height - 4);
    texture.needsUpdate = true;
  }
  redraw(1);
  return { sprite, redraw };
}
