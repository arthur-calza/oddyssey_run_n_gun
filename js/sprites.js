/* ============================================================
   sprites.js — frame-by-frame animated pixel actors (Broforce-style)
   The body is drawn part-by-part each frame (legs stride, torso bobs,
   arms swing) and baked into spritesheets: idle / run / jump / fall /
   hurt / death. The front arm + weapon is drawn LIVE so aiming works in
   360° and the shot recoils. Concept art is kept for the HUD portrait.
   ============================================================ */

const SPR = {
  ready: false, sheets: {}, defs: {},
  images: {}, whites: {}, imgLoading: false,
  ANIMS: { idle: 6, run: 8, jump: 8, fall: 8, crouch: 4, crouchwalk: 8, crouchshoot: 4, attack: 8, hurt: 2, death: 6 },
  PXF: 5,          // fator de pixelização: a arte é assada em ~1/PXF da resolução e ampliada (look retrô, ~20px de altura)
  _pwBuf: null,    // buffer reaproveitado para pixelizar o braço/arma
  _pwCache: {},    // cache de quadros da arma por (def, modo, ângulo) — evita re-pixelizar todo frame
  WAIM: 64,        // nº de ângulos discretos da arma no cache

  define(key, d) { d.key = key; this.defs[key] = d; },

  // ---- concept-art images (used for the HUD portrait) ----------
  loadImages() {
    if (this.imgLoading) return; this.imgLoading = true;
    for (const key in this.defs) {
      const d = this.defs[key], img = new Image();
      img.src = d.portraitSrc || ('assets/' + key + '.png');   // retrato dedicado (pictures/) ou concept (assets/)
      this.images[key] = img;
    }
  },
  hasImage(key) { const i = this.images[key]; return i && i.complete && i.naturalWidth > 0; },

  // ---- bake all spritesheets -----------------------------------
  build() {
    if (this.ready) return;
    for (const key in this.defs) {
      const d = this.defs[key]; this.sheets[key] = {};
      for (const a in this.ANIMS) {
        const n = this.ANIMS[a], frames = [];
        for (let f = 0; f < n; f++) frames.push(this._bake(d, a, f, n));
        this.sheets[key][a] = frames;
      }
    }
    this.ready = true;
  },

  /* ===== EDIÇÃO DE SPRITES (SpriteLab) =====
     As folhas (sheets) são canvases editáveis: o editor pinta DIRETO nelas, então
     o jogo reflete as edições na hora. Reverter = reassar o quadro original. As
     alterações persistem em localStorage (por par "personagem/ação"). */
  _editKey: 'oddyssey_sprite_edits_v1',
  _dirty: {},                       // { "key/anim": true }
  markDirty(key, anim) { this._dirty[key + '/' + anim] = true; },
  frameCanvas(key, anim, fi) { const a = this.sheets[key] && this.sheets[key][anim]; return a && a[fi]; },
  _blankLike(ref) { const c = document.createElement('canvas'); c.width = ref.width; c.height = ref.height; return c; },
  _copyOf(ref) { const c = this._blankLike(ref); c.getContext('2d').drawImage(ref, 0, 0); return c; },
  addFrame(key, anim, blank) {
    const arr = this.sheets[key] && this.sheets[key][anim]; if (!arr || !arr.length) return -1;
    arr.push(blank ? this._blankLike(arr[arr.length - 1]) : this._copyOf(arr[arr.length - 1]));
    this.markDirty(key, anim); return arr.length - 1;
  },
  removeFrame(key, anim, fi) {
    const arr = this.sheets[key] && this.sheets[key][anim]; if (!arr || arr.length <= 1) return false;
    arr.splice(fi, 1); this.markDirty(key, anim); return true;
  },
  revertFrame(key, anim, fi) {
    const d = this.defs[key], arr = this.sheets[key] && this.sheets[key][anim]; if (!d || !arr) return;
    if (fi < this.ANIMS[anim]) arr[fi] = this._bake(d, anim, fi, this.ANIMS[anim]);   // quadro original → reassa
    else { const c = this._blankLike(arr[fi]); arr[fi] = c; }                          // quadro extra → limpa
    this.markDirty(key, anim);
  },
  saveEdits() {
    const out = {};
    for (const id in this._dirty) { const [key, anim] = id.split('/'); const arr = this.sheets[key] && this.sheets[key][anim]; if (arr) out[id] = arr.map(c => c.toDataURL()); }
    try { localStorage.setItem(this._editKey, JSON.stringify(out)); return true; } catch (e) { return false; }
  },
  loadEdits() {
    let raw; try { raw = localStorage.getItem(this._editKey); } catch (e) { return; }
    if (!raw) return; let obj; try { obj = JSON.parse(raw); } catch (e) { return; }
    for (const id in obj) {
      const [key, anim] = id.split('/'); if (!this.sheets[key]) continue;
      const urls = obj[id], frames = new Array(urls.length);
      this.sheets[key][anim] = frames; this.markDirty(key, anim);
      urls.forEach((u, i) => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); frames[i] = c; }; img.src = u; frames[i] = document.createElement('canvas'); frames[i].width = 1; frames[i].height = 1; });
    }
  },
  clearAllEdits() {
    try { localStorage.removeItem(this._editKey); } catch (e) {}
    for (const id in this._dirty) { const [key, anim] = id.split('/'); const d = this.defs[key]; if (!d) continue; const n = this.ANIMS[anim], frames = []; for (let f = 0; f < n; f++) frames.push(this._bake(d, anim, f, n)); this.sheets[key][anim] = frames; }
    this._dirty = {};
  },

  _bake(d, anim, f, n) {
    const W = d.cw || 120, H = d.ch || 132, foot = H - 6;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.save(); g.translate(W / 2, foot);
    if (anim === 'death') { const t = f / (n - 1 || 1); g.rotate(-t * 1.45); g.translate(0, t * 6); }
    this._drawBody(g, d, this._pose(anim, f, n));
    g.restore();
    // contorno aplicado em ALTA resolução (1px no espaço grande) → vira só um leve
    // escurecimento de borda depois da redução: bordas finas e fluidas (estilo Broforce).
    return this._pixelize(this._outline(cv), d);
  },

  // downscale a baked (detailed) frame into a few chunky pixels and snap the
  // silhouette to hard edges — the low-res Broforce look (no thick outline).
  _pixelize(src, d) {
    const PXF = d.pxf || this.PXF;
    const sw = Math.max(1, Math.round(src.width / PXF));
    const sh = Math.max(1, Math.round(src.height / PXF));
    const small = document.createElement('canvas'); small.width = sw; small.height = sh;
    const g = small.getContext('2d'); g.imageSmoothingEnabled = true;
    g.drawImage(src, 0, 0, sw, sh);                       // area-average down to low-res
    const im = g.getImageData(0, 0, sw, sh), px = im.data; // crisp silhouette (no soft edges)
    for (let i = 0; i < px.length; i += 4) px[i + 3] = px[i + 3] >= 120 ? 255 : 0;
    g.putImageData(im, 0, 0);
    return small;
  },

  // wrap a baked frame with a 1px dark outline by stamping a black silhouette
  _outline(src) {
    const W = src.width, H = src.height;
    const sil = document.createElement('canvas'); sil.width = W; sil.height = H;
    const sc = sil.getContext('2d'); sc.drawImage(src, 0, 0);
    sc.globalCompositeOperation = 'source-atop'; sc.fillStyle = '#0a0908'; sc.fillRect(0, 0, W, H);
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const o = out.getContext('2d');
    const off = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [dx, dy] of off) o.drawImage(sil, dx, dy);
    o.drawImage(src, 0, 0);
    return out;
  },

  _pose(anim, f, n) {
    const ph = (f / n) * TAU;
    const p = { anim, ph, legF: 0, legB: 0, bob: 0, lean: 0, arm: 0, crouch: 0, air: false };
    if (anim === 'run') {
      p.legF = ph; p.legB = ph + Math.PI;
      p.bob = -Math.abs(Math.sin(ph)) * 3; p.lean = 4; p.arm = Math.sin(ph) * 0.5;
    } else if (anim === 'idle') {
      p.legF = 0.12; p.legB = -0.12; p.bob = Math.sin(ph) * 1.2; p.arm = Math.sin(ph) * 0.08;
    } else if (anim === 'jump') {
      // 8 quadros: DOBRA OS JOELHOS (impulso) → estica subindo → ápice
      p.air = true; const t = n > 1 ? f / (n - 1) : 0;
      const imp = Math.max(0, 1 - t / 0.26);                       // agachamento de impulso (2 primeiros quadros)
      const ext = t < 0.26 ? 0 : Math.sin(((t - 0.26) / 0.74) * Math.PI * 0.85);  // estica no meio da subida
      p.crouch = imp * 12 - ext * 5;
      p.legF = imp * 0.85 + (1 - imp) * 0.28; p.legB = imp * 0.45 + (1 - imp) * -0.28;
      p.arm = imp * 0.35 + (1 - imp) * lerp(-0.2, -0.7, clamp((t - 0.26) / 0.74, 0, 1));
      p.lean = 2 + ext * 1.5; p.bob = -t * 1.6;
    } else if (anim === 'fall') {
      // 8 quadros: ápice → queda acentuada (pernas p/ trás, braços p/ cima, capa esvoaça)
      p.air = true; const t = n > 1 ? f / (n - 1) : 0;
      p.legF = lerp(-0.05, -0.55, t); p.legB = lerp(0.12, 0.62, t);
      p.arm = lerp(-0.4, -1.0, t); p.lean = lerp(-1, -5, t); p.crouch = lerp(-3, 3, t); p.bob = t * 1.5;
    } else if (anim === 'crouch') {
      // agachado PARADO: pés no chão, joelhos dobrados (IK em _leg), leve respiração
      const s2 = Math.sin(ph);
      p.crouch = 14 + s2 * 0.8; p.legF = 0.5; p.legB = -0.5; p.arm = 0.18 + s2 * 0.05; p.lean = 1; p.bob = s2 * 0.5;
    } else if (anim === 'crouchwalk') {
      // andar agachado (8): passada agachada, pés alternando no chão
      p.crouch = 14; p.legF = ph; p.legB = ph + Math.PI; p.arm = Math.sin(ph) * 0.35; p.lean = 2; p.bob = -Math.abs(Math.sin(ph)) * 1.1;
    } else if (anim === 'crouchshoot') {
      // atirar agachado (4): coice — recua e volta, joelhos firmes
      const kick = Math.sin((f / (n - 1 || 1)) * Math.PI);
      p.crouch = 14; p.legF = 0.5; p.legB = -0.5; p.lean = 1 - kick * 4; p.arm = 0.1; p.bob = kick * 0.9;
    } else if (anim === 'attack') {
      // ATAQUE CURTO (8): espada faz arco de 270° (cima→frente→baixo→trás)
      const t = n > 1 ? f / (n - 1) : 0;
      p.swing = lerp(-Math.PI / 2, Math.PI, t);
      p.crouch = Math.sin(t * Math.PI) * 5; p.lean = lerp(-2, 5, t); p.legF = 0.28; p.legB = -0.28; p.arm = 0.25; p.bob = 0;
    } else if (anim === 'hurt') {
      p.lean = -6 - f * 2; p.legF = -0.4; p.legB = 0.3; p.arm = -0.9;
    } else if (anim === 'death') {
      p.legF = 0.2; p.legB = -0.3; p.arm = -1.0; p.lean = -4;
    }
    return p;
  },

  // ---------- the body (rounded, shaded — Metal Slug-ish) ---------
  _drawBody(g, d, p) {
    const P = d.pal, s = d.scale || 1, bulk = d.bulk || 1;
    const bob = p.bob, lean = p.lean, crouch = p.crouch || 0;
    const hipY = -34 * s + crouch;
    const shY = -62 * s + crouch + bob;
    const headCy = -82 * s + crouch + bob, headR = 11 * s;
    g.lineJoin = 'round'; g.lineCap = 'round';
    // ground shadow
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.beginPath(); g.ellipse(0, -2 * s, 15 * s * bulk, 4 * s, 0, 0, TAU); g.fill();
    if (d.tail) this._tail(g, P, s, hipY, p);
    if (P.cape) this._cape(g, P, s, shY, hipY, lean, p);
    // legs (back first)
    this._leg(g, P, s, -6 * s * bulk, hipY, p.legB, true, p, d.digi);
    this._leg(g, P, s, 6 * s * bulk, hipY, p.legF, false, p, d.digi);
    // torso
    this._torso(g, d, P, s, lean, shY, hipY, bulk);
    // back arm
    this._arm(g, P, s, lean - 9 * s * bulk, shY + 5 * s, p.arm, true);
    // head
    this._head(g, d, lean * 1.05, headCy, headR);
    // ATAQUE CURTO: braço + espada varrendo o arco de 270° (assado no quadro)
    if (p.anim === 'attack') this._attackSword(g, P, s, lean, shY, p.swing || 0);
  },

  // braço estendido segurando a espada, girado para `ang` (arco do golpe)
  _attackSword(g, P, s, lean, shY, ang) {
    g.save(); g.translate(lean + 2 * s, shY + 6 * s); g.rotate(ang);
    g.strokeStyle = P.arm || P.armor || '#6a6a7a'; g.lineWidth = 5 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(11 * s, 0); g.stroke();
    g.fillStyle = P.glove || P.skin || '#43321e'; g.beginPath(); g.arc(11 * s, 0, 3 * s, 0, TAU); g.fill();
    g.fillStyle = '#5a4326'; g.fillRect(10 * s, -1.6 * s, 4 * s, 3.2 * s);              // cabo
    g.fillStyle = P.buckle || '#caa33a'; g.fillRect(13.5 * s, -3.6 * s, 2.2 * s, 7.2 * s); // guarda
    g.fillStyle = '#e8eef5'; g.fillRect(15.5 * s, -2 * s, 22 * s, 4 * s);               // lâmina
    g.beginPath(); g.moveTo(37.5 * s, -2 * s); g.lineTo(43 * s, 0); g.lineTo(37.5 * s, 2 * s); g.fill(); // ponta
    g.fillStyle = '#aeb8c2'; g.fillRect(15.5 * s, -2 * s, 22 * s, 1.4 * s);             // fio
    g.restore();
  },

  _round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.fill(); },

  // tapered, round-ended limb segment with a soft highlight on the lit side
  _segLimb(g, x0, y0, x1, y1, w0, w1, base, hi) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    g.fillStyle = base;
    g.beginPath();
    g.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); g.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
    g.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2); g.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2); g.closePath(); g.fill();
    g.beginPath(); g.arc(x0, y0, w0 / 2, 0, TAU); g.fill(); g.beginPath(); g.arc(x1, y1, w1 / 2, 0, TAU); g.fill();
    if (hi) { g.strokeStyle = hi; g.lineWidth = Math.max(1, w1 * 0.4); g.beginPath(); g.moveTo(x0 + nx * w0 * 0.22 + 0.5, y0 + ny * w0 * 0.22); g.lineTo(x1 + nx * w1 * 0.22 + 0.5, y1 + ny * w1 * 0.22); g.stroke(); }
  },

  // tapered, rounded torso with clipped 3-tone shading and gear
  _torso(g, d, P, s, x, shY, hipY, bulk) {
    const cW = 22 * s * bulk, wW = 15 * s * bulk, midY = (shY + hipY) / 2;
    g.save();
    g.beginPath();
    g.moveTo(x - cW / 2, shY + 2 * s);
    g.quadraticCurveTo(x - cW / 2 - 2 * s, midY, x - wW / 2, hipY + 3 * s);
    g.quadraticCurveTo(x, hipY + 6 * s, x + wW / 2, hipY + 3 * s);
    g.quadraticCurveTo(x + cW / 2 + 2 * s, midY, x + cW / 2, shY + 2 * s);
    g.quadraticCurveTo(x, shY - 4 * s, x - cW / 2, shY + 2 * s);
    g.closePath(); g.fillStyle = P.torso; g.fill(); g.clip();
    g.fillStyle = P.torsoSh; g.beginPath(); g.ellipse(x - cW * 0.34, midY, cW * 0.45, (hipY - shY) * 0.8, 0, 0, TAU); g.fill();
    g.fillStyle = P.torsoHi; g.beginPath(); g.ellipse(x + cW * 0.14, shY + 9 * s, cW * 0.3, 8 * s, 0, 0, TAU); g.fill();
    if (P.plate) { g.fillStyle = P.plate; g.beginPath(); g.ellipse(x, shY + 10 * s, cW * 0.44, 9 * s, 0, 0, TAU); g.fill(); g.fillStyle = P.armorHi; g.beginPath(); g.ellipse(x, shY + 7 * s, cW * 0.3, 3 * s, 0, 0, TAU); g.fill(); }
    g.fillStyle = P.torsoSh; g.fillRect(x - 0.7 * s, shY + 4 * s, 1.4 * s, hipY - shY);
    g.fillStyle = P.belt || P.armorSh; g.fillRect(x - cW, hipY - 1 * s, cW * 2, 5 * s);
    if (P.buckle) { g.fillStyle = P.buckle; g.beginPath(); g.ellipse(x, hipY + 1.5 * s, 3 * s, 2.5 * s, 0, 0, TAU); g.fill(); }
    if (P.pendant) { g.fillStyle = P.pendant; g.beginPath(); g.ellipse(x, midY + 3 * s, 2.6 * s, 3.2 * s, 0, 0, TAU); g.fill(); }
    g.restore();
    // neck + pauldrons on top
    g.fillStyle = P.skinSh || P.torsoSh; g.fillRect(x - 3 * s, shY - 6 * s, 6 * s, 6 * s);
    if (P.pauldron) {
      g.fillStyle = P.pauldron;
      g.beginPath(); g.ellipse(x - cW / 2, shY + 1 * s, 6 * s, 5 * s, 0, 0, TAU); g.ellipse(x + cW / 2, shY + 1 * s, 6 * s, 5 * s, 0, 0, TAU); g.fill();
      g.fillStyle = P.armorHi; g.beginPath(); g.ellipse(x + cW / 2 - 1 * s, shY - 1 * s, 3 * s, 2 * s, 0, 0, TAU); g.fill();
    }
  },

  _leg(g, P, s, hx, hy, phase, back, p, digi) {
    const thighLen = 16 * s, shinLen = 15 * s;
    const wTop = 7.5 * s, wKnee = 6 * s, wAnk = 5 * s;
    const crouchFam = p.anim === 'crouch' || p.anim === 'crouchwalk' || p.anim === 'crouchshoot';
    let kx, ky, ax, ay;
    if (crouchFam) {
      // AGACHADO: pés PLANTADOS no chão (footY≈0) e joelhos dobrados p/ FRENTE.
      // posicionamento direto (IK) — o quadril desce, o pé fica no chão.
      const footY = -3 * s;
      const stride = (p.anim === 'crouchwalk') ? Math.sin(phase) : phase * 0.5;   // passada (andar) / leve abertura (parado)
      const lift = (p.anim === 'crouchwalk') ? Math.max(0, Math.cos(phase)) * 4 * s : 0;
      ax = hx + (back ? -3 : 6) * s + stride * 6 * s;
      ay = footY - lift;
      kx = hx + (back ? 4 : 8) * s + stride * 3 * s;     // joelho à frente
      ky = (hy + ay) * 0.5 - 4 * s;                       // joelho um pouco acima do meio
    } else {
      let thighA, bend;
      if (p.air) { thighA = (back ? -1 : 1) * 0.35 + Math.sin(phase) * 0.1; bend = 0.55 + (back ? 0.25 : 0); }
      else if (p.anim === 'run') { thighA = Math.sin(phase) * 0.5; bend = 0.2 + Math.max(0, Math.cos(phase)) * 0.7; }
      else { thighA = phase; bend = 0.1; }
      kx = hx + Math.sin(thighA) * thighLen; ky = hy + Math.cos(thighA) * thighLen;
      const shinA = thighA + (digi ? bend : -bend);    // digitigrade knee bends backward
      ax = kx + Math.sin(shinA) * shinLen; ay = ky + Math.cos(shinA) * shinLen;
    }
    const col = back ? (P.legSh || P.armorSh) : (P.leg || P.armor);
    this._segLimb(g, hx, hy, kx, ky, wTop, wKnee, col, back ? null : P.armorHi);
    this._segLimb(g, kx, ky, ax, ay, wKnee, wAnk, col, back ? null : P.armorHi);
    if (!digi && !back) { g.fillStyle = P.armorHi || col; g.beginPath(); g.arc(kx, ky, 2.6 * s, 0, TAU); g.fill(); }
    // foot
    if (digi) {
      g.fillStyle = P.foot || '#2a201a';
      g.beginPath(); g.moveTo(ax - 3 * s, ay - 1 * s); g.lineTo(ax + 9 * s, ay - 2 * s); g.lineTo(ax + 9 * s, ay + 2 * s); g.lineTo(ax - 3 * s, ay + 3 * s); g.closePath(); g.fill();
      g.fillStyle = P.claw || '#cabfa0'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(ax + 7 * s + i * 1.4 * s, ay - 1 * s); g.lineTo(ax + 11 * s + i * 1.4 * s, ay - 3 * s); g.lineTo(ax + 10 * s + i * 1.4 * s, ay + 1 * s); g.fill(); }
    } else {
      g.fillStyle = P.boot || '#2a1c12';
      g.beginPath(); g.ellipse(ax + 1 * s, ay - 1 * s, 5.5 * s, 3.2 * s, 0, 0, TAU); g.fill();
      g.fillStyle = P.armorSh || '#1a120c'; g.fillRect(ax - 3.5 * s, ay - 4.5 * s, 5 * s, 4 * s);
    }
  },

  _arm(g, P, s, sx, sy, ang, back) {
    const upper = 11 * s, fore = 10 * s;
    const ex = sx + Math.sin(ang) * upper, ey = sy + Math.cos(ang) * upper;
    const hx = ex + Math.sin(ang * 0.55) * fore, hy = ey + Math.cos(ang * 0.55) * fore;
    const col = back ? (P.armSh || P.armorSh) : (P.arm || P.armor);
    this._segLimb(g, sx, sy, ex, ey, 6.5 * s, 5 * s, col, back ? null : P.armorHi);
    this._segLimb(g, ex, ey, hx, hy, 5 * s, 4 * s, col, back ? null : P.armorHi);
    g.fillStyle = P.glove || P.skin || col; g.beginPath(); g.arc(hx, hy, 3 * s, 0, TAU); g.fill();
  },

  // capa ESVOAÇANTE — maior e bem mais animada (corre/pula/cai). Puramente
  // visual: sai pelas laterais e por baixo do corpo e ondula na barra inferior.
  _cape(g, P, s, shY, hipY, lean, p) {
    const run = p.anim === 'run', jump = p.anim === 'jump', fall = p.anim === 'fall', air = !!p.air;
    const t = p.ph || 0, fr = (t / TAU);   // fração do quadro (0..1) p/ a capa "abrir" ao longo da ação
    // No AR a capa abre MUITO mais (área maior) e ondula bastante — sobe no pulo, infla na queda
    const airOpen = air ? (jump ? 0.5 + fr * 0.8 : 0.8 + fr * 0.5) : 0;   // cresce ao longo do pulo/queda
    const back = (run ? 6 + Math.sin(t) * 3.5 : air ? 14 + airOpen * 8 : 2.5 + Math.sin(t * 0.6) * 1.4) * s;
    const lift = (jump ? -8 - airOpen * 6 : fall ? -4 - airOpen * 4 : 0) * s;
    const topHW = (air ? 12.5 : 11) * s, botHW = (run ? 18 : air ? 22 + airOpen * 7 : 14.5) * s;
    const topY = shY - 2 * s, botY = hipY + 30 * s + lift;
    const wob = (run ? Math.sin(t * 2) * 4.5 : air ? Math.sin(t * 1.5) * 4 : Math.sin(t * 0.8) * 1.6) * s;
    // capa principal (pano)
    g.fillStyle = P.cape;
    g.beginPath();
    g.moveTo(lean - topHW, topY);                                                                      // ombro esquerdo
    g.quadraticCurveTo(lean - topHW - back * 0.7, (topY + botY) * 0.5, lean - botHW - back, botY + wob); // desce esvoaçando p/ trás
    g.quadraticCurveTo(lean - back, botY + 7 * s + wob * 0.4, lean + botHW * 0.55 - back, botY - wob);   // barra ondulada
    g.quadraticCurveTo(lean + topHW + back * 0.2, (topY + botY) * 0.5, lean + topHW, topY);              // volta ao ombro direito
    g.quadraticCurveTo(lean, topY - 4 * s, lean - topHW, topY);                                          // gola sobre os ombros
    g.closePath(); g.fill();
    // dobra interna (sombra) p/ profundidade
    g.fillStyle = P.capeSh;
    g.beginPath();
    g.moveTo(lean + 1.5 * s, topY);
    g.quadraticCurveTo(lean - back * 0.5, (topY + botY) * 0.5, lean - botHW * 0.4 - back, botY + wob * 0.7);
    g.quadraticCurveTo(lean - back, botY + 4 * s, lean + 2 * s - back * 0.5, botY - 2 * s);
    g.closePath(); g.fill();
  },

  _tail(g, P, s, hipY, p) {
    const sway = (p.anim === 'run' ? Math.sin(p.ph) * 5 : Math.sin((p.ph || 0) * 0.7) * 2.5);
    const baseY = hipY + 8 * s;
    g.fillStyle = P.skin;
    g.beginPath(); g.moveTo(-6 * s, baseY - 3 * s);
    g.quadraticCurveTo(-26 * s, baseY + 2 * s + sway, -34 * s, baseY + 16 * s + sway);
    g.quadraticCurveTo(-30 * s, baseY + 10 * s + sway, -22 * s, baseY + 8 * s + sway * 0.5);
    g.quadraticCurveTo(-12 * s, baseY + 6 * s, -4 * s, baseY + 6 * s); g.closePath(); g.fill();
    g.fillStyle = P.skinSh; g.beginPath(); g.moveTo(-6 * s, baseY - 1 * s); g.quadraticCurveTo(-24 * s, baseY + 4 * s + sway, -33 * s, baseY + 15 * s + sway); g.quadraticCurveTo(-26 * s, baseY + 9 * s + sway, -16 * s, baseY + 8 * s); g.closePath(); g.fill();
  },

  _head(g, d, hx, cy, r) {
    const P = d.pal, s = d.scale || 1;
    const oval = (cx, cyy, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(cx, cyy, rx, ry, 0, 0, TAU); g.fill(); };
    switch (d.head) {
      case 'human': {
        oval(hx, cy, r * 0.92, r * 1.04, P.skin);                       // head
        oval(hx - r * 0.42, cy + r * 0.1, r * 0.5, r * 0.9, P.skinSh);  // back/jaw shadow
        g.fillStyle = P.hair; g.beginPath(); g.ellipse(hx, cy - r * 0.42, r * 1.02, r * 0.8, 0, Math.PI, TAU); g.fill();  // hair top
        g.beginPath(); g.moveTo(hx - r, cy - r * 0.5); g.quadraticCurveTo(hx - r * 1.1, cy + r * 0.4, hx - r * 0.6, cy + r * 0.6); g.lineTo(hx - r * 0.5, cy - r * 0.3); g.fill(); // sideburn
        if (d.longHair) { g.fillStyle = P.hair; g.beginPath(); g.moveTo(hx - r * 0.95, cy - r * 0.2); g.quadraticCurveTo(hx - r * 1.25, cy + r * 0.9, hx - r * 0.7, cy + r * 1.5); g.lineTo(hx - r * 0.2, cy + r * 0.6); g.lineTo(hx - r * 0.4, cy - r * 0.2); g.fill(); } // cabelo longo
        if (!d.noBeard) oval(hx, cy + r * 0.62, r * 0.78, r * 0.55, P.hair);  // barba (opcional)
        oval(hx + r * 0.28, cy + r * 0.06, r * 0.55, r * 0.58, P.skin); // face
        if (P.eye) { g.shadowColor = P.eye; g.shadowBlur = 5; }         // olhos brilhantes (mago)
        g.fillStyle = P.eye || '#241c14'; g.beginPath(); g.arc(hx + r * 0.38, cy - r * 0.02, 1.5 * s, 0, TAU); g.fill();  // eye
        g.shadowBlur = 0; g.fillStyle = P.skinSh; g.fillRect(hx + r * 0.72, cy + r * 0.05, 1.2 * s, 2.5 * s); break;      // nose
      }
      case 'elf': {
        // ouvido pontudo (atrás), desenhado antes da cabeça
        g.fillStyle = P.skinSh; g.beginPath(); g.moveTo(hx - r * 0.5, cy - r * 0.05); g.lineTo(hx - r * 1.15, cy - r * 0.55); g.lineTo(hx - r * 0.4, cy - r * 0.35); g.closePath(); g.fill();
        oval(hx, cy, r * 0.9, r * 1.02, P.skin);                       // cabeça (jovem, fina)
        oval(hx - r * 0.42, cy + r * 0.1, r * 0.48, r * 0.85, P.skinSh);// sombra do maxilar
        g.fillStyle = P.skin; g.beginPath(); g.moveTo(hx - r * 0.42, cy + r * 0.02); g.lineTo(hx - r * 0.95, cy - r * 0.42); g.lineTo(hx - r * 0.34, cy - r * 0.28); g.closePath(); g.fill(); // ponta da orelha
        g.fillStyle = P.hair; g.beginPath(); g.ellipse(hx, cy - r * 0.46, r * 1.04, r * 0.82, 0, Math.PI, TAU); g.fill();   // cabelo bagunçado
        g.beginPath(); g.moveTo(hx - r, cy - r * 0.5); g.quadraticCurveTo(hx - r * 1.15, cy + r * 0.2, hx - r * 0.62, cy + r * 0.42); g.lineTo(hx - r * 0.5, cy - r * 0.25); g.fill(); // mecha lateral
        g.beginPath(); g.moveTo(hx + r * 0.2, cy - r * 1.0); g.lineTo(hx + r * 0.7, cy - r * 0.5); g.lineTo(hx - r * 0.1, cy - r * 0.7); g.fill(); // topete
        oval(hx + r * 0.3, cy + r * 0.06, r * 0.5, r * 0.55, P.skin);   // rosto
        g.fillStyle = '#241c14'; g.beginPath(); g.arc(hx + r * 0.42, cy - r * 0.02, 1.5 * s, 0, TAU); g.fill();             // olho
        g.fillStyle = P.skinSh; g.fillRect(hx + r * 0.76, cy + r * 0.05, 1.2 * s, 2.5 * s);                                 // nariz
        break;
      }
      case 'lizard': case 'dragon': {
        for (let i = 0; i < 4; i++) { g.fillStyle = P.crest || P.skinSh; g.beginPath(); g.moveTo(hx - r * 0.7 + i * 4 * s, cy - r * 0.7); g.lineTo(hx - r * 0.5 + i * 4 * s, cy - r * 1.3 - (i % 2) * 2 * s); g.lineTo(hx - r * 0.3 + i * 4 * s, cy - r * 0.7); g.fill(); }
        oval(hx - r * 0.1, cy, r * 0.85, r * 0.85, P.skin);            // skull
        g.fillStyle = P.skin; g.beginPath(); g.ellipse(hx + r * 0.7, cy + r * 0.28, r * 0.78, r * 0.42, -0.15, 0, TAU); g.fill();  // snout
        oval(hx - r * 0.4, cy + r * 0.05, r * 0.42, r * 0.7, P.skinSh);
        oval(hx - r * 0.05, cy - r * 0.42, r * 0.4, r * 0.28, P.skinHi || P.skin);
        g.fillStyle = P.skinSh; g.beginPath(); g.ellipse(hx + r * 0.85, cy + r * 0.6, r * 0.5, r * 0.16, 0, 0, TAU); g.fill();  // jawline
        g.fillStyle = P.eye || '#e8c84a'; g.beginPath(); g.ellipse(hx + r * 0.42, cy - r * 0.15, 2 * s, 2.6 * s, 0, 0, TAU); g.fill();
        g.fillStyle = '#1a140e'; g.fillRect(hx + r * 0.42 - 0.6 * s, cy - r * 0.45, 1.2 * s, 3.2 * s);
        if (d.head === 'dragon') { g.strokeStyle = P.horn || '#2a2018'; g.lineWidth = 3 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx - r * 0.3, cy - r * 0.8); g.quadraticCurveTo(hx - r * 1.1, cy - r * 1.4, hx - r * 1.5, cy - r * 0.9); g.stroke(); }
        break;
      }
      case 'demon': {
        g.fillStyle = P.horn || '#241a14'; g.lineCap = 'round';
        g.beginPath(); g.moveTo(hx - r * 0.6, cy - r * 0.6); g.quadraticCurveTo(hx - r * 1.4, cy - r * 1.4, hx - r * 1.2, cy - r * 2.1); g.lineTo(hx - r * 0.7, cy - r * 1.1); g.fill();
        g.beginPath(); g.moveTo(hx + r * 0.6, cy - r * 0.6); g.quadraticCurveTo(hx + r * 1.4, cy - r * 1.4, hx + r * 1.2, cy - r * 2.1); g.lineTo(hx + r * 0.7, cy - r * 1.1); g.fill();
        oval(hx, cy, r * 0.92, r, P.skin); oval(hx - r * 0.4, cy + r * 0.1, r * 0.5, r * 0.85, P.skinSh);
        oval(hx + r * 0.15, cy - r * 0.3, r * 0.45, r * 0.35, P.skinHi || P.skin);
        g.fillStyle = '#ffcc44'; g.beginPath(); g.ellipse(hx + r * 0.1, cy - r * 0.05, r * 0.5, 2.2 * s, 0, 0, TAU); g.fill();
        g.fillStyle = '#15110e'; g.beginPath(); g.ellipse(hx - r * 0.05, cy + r * 0.55, r * 0.6, r * 0.22, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8e0cf'; for (let i = -2; i <= 2; i++) g.fillRect(hx + i * 2.2 * s, cy + r * 0.5, 1.2 * s, 2 * s); break;  // teeth
      }
      case 'wolf': {
        g.fillStyle = P.skin; g.beginPath(); g.moveTo(hx - r * 0.7, cy - r * 0.3); g.lineTo(hx - r * 1.1, cy - r * 1.4); g.lineTo(hx - r * 0.2, cy - r * 0.7); g.fill();
        g.beginPath(); g.moveTo(hx + r * 0.7, cy - r * 0.3); g.lineTo(hx + r * 1.1, cy - r * 1.4); g.lineTo(hx + r * 0.2, cy - r * 0.7); g.fill();
        oval(hx, cy, r * 0.85, r * 0.9, P.skin); oval(hx - r * 0.4, cy + r * 0.1, r * 0.45, r * 0.75, P.skinSh);
        g.fillStyle = P.skin; g.beginPath(); g.ellipse(hx + r * 0.7, cy + r * 0.3, r * 0.7, r * 0.4, -0.1, 0, TAU); g.fill();   // snout
        g.fillStyle = '#1a1410'; g.beginPath(); g.arc(hx + r * 1.25, cy + r * 0.2, 2 * s, 0, TAU); g.fill();
        g.fillStyle = P.eye || '#f0e050'; g.beginPath(); g.ellipse(hx + r * 0.3, cy - r * 0.1, 2 * s, 1.6 * s, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8e0cf'; g.fillRect(hx + r * 0.5, cy + r * 0.55, r * 0.6, 1.2 * s); break;
      }
      case 'zombie': {
        if (P.hood) { g.fillStyle = P.hood; g.beginPath(); g.ellipse(hx, cy - r * 0.2, r * 1.15, r * 1.1, 0, Math.PI * 0.95, TAU * 1.05); g.fill(); }
        oval(hx, cy, r * 0.86, r, P.skin); oval(hx - r * 0.4, cy + r * 0.15, r * 0.5, r * 0.8, P.skinSh);
        oval(hx + r * 0.2, cy - r * 0.25, r * 0.4, r * 0.3, P.skinHi || P.skin);
        g.fillStyle = '#120e0a'; g.beginPath(); g.arc(hx + r * 0.05, cy - r * 0.05, 2 * s, 0, TAU); g.arc(hx + r * 0.6, cy - r * 0.05, 1.6 * s, 0, TAU); g.fill();  // sunken eyes
        g.fillStyle = '#e8e0cf'; g.fillRect(hx - r * 0.3, cy + r * 0.55, r * 0.9, 1.4 * s); g.fillStyle = '#5a2a2a'; g.fillRect(hx - r * 0.7, cy + r * 0.2, 2 * s, 4 * s); break;
      }
      case 'flayer': {
        oval(hx, cy - r * 0.2, r * 0.95, r * 1.05, P.skin);            // domed head
        oval(hx - r * 0.35, cy - r * 0.1, r * 0.5, r * 0.85, P.skinSh);
        oval(hx + r * 0.1, cy - r * 0.7, r * 0.45, r * 0.4, P.skinHi || P.skin);
        g.fillStyle = '#e8e0f0'; g.beginPath(); g.arc(hx - r * 0.3, cy - r * 0.1, 1.6 * s, 0, TAU); g.arc(hx + r * 0.4, cy - r * 0.1, 1.6 * s, 0, TAU); g.fill();
        g.fillStyle = P.tentacle || P.skinSh; for (let i = -2; i <= 2; i++) { const tx = hx + i * 3.2 * s; g.beginPath(); g.moveTo(tx, cy + r * 0.3); g.quadraticCurveTo(tx + i * 1.5, cy + r * 1.0, tx + i * 3, cy + r * 1.6); g.quadraticCurveTo(tx + i, cy + r * 0.9, tx + 1.5 * s, cy + r * 0.4); g.fill(); } break;
      }
      case 'skull': {   // crânio (esqueleto): órbitas vazias + dentes (+ brasas se P.eye)
        oval(hx, cy, r * 0.92, r * 1.0, P.skin); oval(hx - r * 0.4, cy + r * 0.12, r * 0.46, r * 0.72, P.skinSh);
        g.fillStyle = '#15110e'; g.beginPath(); g.arc(hx - r * 0.32, cy - r * 0.05, r * 0.26, 0, TAU); g.arc(hx + r * 0.34, cy - r * 0.05, r * 0.26, 0, TAU); g.fill();  // órbitas
        if (P.eye) { g.fillStyle = P.eye; g.shadowColor = P.eye; g.shadowBlur = 5; g.beginPath(); g.arc(hx - r * 0.32, cy - r * 0.05, r * 0.12, 0, TAU); g.arc(hx + r * 0.34, cy - r * 0.05, r * 0.12, 0, TAU); g.fill(); g.shadowBlur = 0; }
        g.fillStyle = P.skinSh; g.beginPath(); g.moveTo(hx, cy + r * 0.1); g.lineTo(hx - r * 0.12, cy + r * 0.4); g.lineTo(hx + r * 0.12, cy + r * 0.4); g.fill();   // nariz
        g.fillStyle = '#15110e'; for (let i = -2; i <= 2; i++) g.fillRect(hx + i * 2.0 * s - 0.5 * s, cy + r * 0.52, 1.2 * s, 2.4 * s); break;  // dentes
      }
    }
    // ---- adereços de cabeça (desenhados POR CIMA) ----
    if (d.goggles) {   // óculos de aviador na testa (Silvyr)
      g.strokeStyle = P.metal || '#6a5030'; g.lineWidth = 1.4 * s; g.lineCap = 'round';
      g.beginPath(); g.moveTo(hx - r * 0.8, cy - r * 0.72); g.lineTo(hx + r * 0.8, cy - r * 0.72); g.stroke();
      g.fillStyle = P.metal || '#9a7d44'; g.beginPath(); g.arc(hx - r * 0.34, cy - r * 0.72, 2.4 * s, 0, TAU); g.arc(hx + r * 0.36, cy - r * 0.72, 2.4 * s, 0, TAU); g.fill();
      g.fillStyle = P.goggle || '#7fd8e8'; g.beginPath(); g.arc(hx - r * 0.34, cy - r * 0.72, 1.5 * s, 0, TAU); g.arc(hx + r * 0.36, cy - r * 0.72, 1.5 * s, 0, TAU); g.fill();
    }
    if (d.hat === 'plumed') {   // chapéu de aba larga com pluma vermelha (Nicolau)
      g.fillStyle = P.plume || '#b1322c';                                          // pluma (atrás, varrida)
      g.beginPath(); g.moveTo(hx - r * 0.2, cy - r * 0.85);
      g.quadraticCurveTo(hx - r * 1.7, cy - r * 1.7, hx - r * 1.25, cy - r * 2.45);
      g.quadraticCurveTo(hx - r * 0.5, cy - r * 1.7, hx + r * 0.35, cy - r * 0.95); g.fill();
      g.fillStyle = P.hat || '#5a3a1e';
      g.beginPath(); g.ellipse(hx, cy - r * 0.78, r * 1.5, r * 0.42, 0, 0, TAU); g.fill();   // aba
      g.beginPath(); g.ellipse(hx + r * 0.05, cy - r * 1.06, r * 0.82, r * 0.5, 0, 0, TAU); g.fill(); // copa
      g.fillStyle = P.hatHi || '#6a4626'; g.beginPath(); g.ellipse(hx + r * 0.05, cy - r * 1.14, r * 0.6, r * 0.26, 0, 0, TAU); g.fill();
      g.fillStyle = P.trim || '#caa33a'; g.fillRect(hx - r * 0.82, cy - r * 0.92, r * 1.64, r * 0.16); // faixa
    }
    if (d.hat === 'jester') {   // gorro de bobo da corte: pontas caídas com guizos (Vex)
      const c1 = P.hat || '#6a1f2e', c2 = P.hat2 || '#241a1f', bell = P.bell || '#caa33a';
      const lobe = (tx, ty, col) => {   // ponta mole terminando num guizo
        g.fillStyle = col; g.beginPath();
        g.moveTo(hx - r * 0.45, cy - r * 0.78);
        g.quadraticCurveTo((hx + tx) / 2, cy - r * 1.55, tx, ty);
        g.quadraticCurveTo((hx + tx) / 2 + r * 0.35, cy - r * 0.95, hx + r * 0.45, cy - r * 0.78);
        g.closePath(); g.fill();
        g.fillStyle = bell; g.beginPath(); g.arc(tx, ty + 1.6 * s, 1.9 * s, 0, TAU); g.fill();
      };
      lobe(hx - r * 1.7, cy - r * 0.35, c1);                     // ponta esquerda
      lobe(hx + r * 1.7, cy - r * 0.35, c2);                     // ponta direita
      lobe(hx + r * 0.15, cy - r * 2.15, c1);                    // ponta central (p/ cima)
      g.fillStyle = c2; g.beginPath(); g.ellipse(hx, cy - r * 0.72, r * 1.06, r * 0.46, 0, 0, TAU); g.fill();  // copa
      g.fillStyle = c1; g.fillRect(hx - r * 1.02, cy - r * 0.66, r * 2.04, r * 0.26);                          // banda na testa
    }
  },

  // ---- live front arm + weapon, rotated toward aim --------------
  drawWeaponArm(ctx, d, sx, sy, aim, recoil, mode, wpnName) {
    const P = d.pal, s = d.scale || 1;
    const wpn = mode === 'sword' ? 'sword' : (wpnName || d.weapon);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(aim); ctx.translate(-(recoil || 0), 0);
    ctx.fillStyle = P.arm || P.armor; ctx.fillRect(-2 * s, -2.5 * s, 9 * s, 5 * s);
    if (P.glove) { ctx.fillStyle = P.glove; ctx.fillRect(6 * s, -2.5 * s, 4 * s, 5 * s); }
    this._weapon(ctx, wpn, P, s);
    ctx.restore();
  },

  _weapon(ctx, wpn, P, s) {
    const M = P.metal || '#3a3e44', Md = P.metalSh || '#20242a', Wd = P.wood || '#6a4424';
    switch (wpn) {
      case 'shotgun':
        ctx.fillStyle = Wd; ctx.fillRect(2 * s, -2 * s, 9 * s, 4 * s);
        ctx.fillStyle = M; ctx.fillRect(10 * s, -3 * s, 18 * s, 5 * s);
        ctx.fillStyle = Md; ctx.fillRect(10 * s, 0, 18 * s, 2 * s); ctx.fillRect(24 * s, -3 * s, 4 * s, 5 * s);
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(27 * s, -2 * s, 2 * s, 4 * s); break;
      case 'rifle':
        ctx.fillStyle = Wd; ctx.fillRect(2 * s, -2 * s, 7 * s, 4 * s);
        ctx.fillStyle = M; ctx.fillRect(8 * s, -2 * s, 24 * s, 3.5 * s); ctx.fillStyle = Md; ctx.fillRect(8 * s, 1 * s, 24 * s, 1.5 * s); break;
      case 'musket':
        ctx.fillStyle = Wd; ctx.fillRect(1 * s, -2.5 * s, 12 * s, 5 * s); ctx.fillStyle = '#caa33a'; ctx.fillRect(12 * s, -2 * s, 4 * s, 4 * s);
        ctx.fillStyle = M; ctx.fillRect(15 * s, -2 * s, 12 * s, 4 * s); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(25 * s, -2.5 * s, 3 * s, 5 * s); break;
      case 'cannon':
        ctx.fillStyle = Md; ctx.fillRect(0, -4 * s, 12 * s, 8 * s); ctx.fillStyle = M; ctx.fillRect(10 * s, -5 * s, 16 * s, 10 * s);
        ctx.fillStyle = '#0c0a08'; ctx.fillRect(24 * s, -3.5 * s, 4 * s, 7 * s); ctx.fillStyle = Md; ctx.fillRect(10 * s, 3 * s, 16 * s, 2 * s); break;
      case 'smg':
        ctx.fillStyle = Md; ctx.fillRect(2 * s, -2 * s, 6 * s, 4 * s); ctx.fillStyle = M; ctx.fillRect(7 * s, -2 * s, 16 * s, 3 * s); ctx.fillRect(9 * s, 2 * s, 4 * s, 5 * s); break;
      case 'pistol':   // flintlock de engenho: cabo curto + cano + cão
        ctx.fillStyle = Wd; ctx.fillRect(-1 * s, -1 * s, 4 * s, 7 * s);          // cabo (curva p/ baixo)
        ctx.fillStyle = Wd; ctx.fillRect(1 * s, -2 * s, 6 * s, 4 * s);           // corpo de madeira
        ctx.fillStyle = M; ctx.fillRect(6 * s, -2 * s, 13 * s, 3 * s);            // cano
        ctx.fillStyle = Md; ctx.fillRect(6 * s, 0.4 * s, 13 * s, 1.2 * s);
        ctx.fillStyle = '#caa33a'; ctx.fillRect(4 * s, -3.5 * s, 2.4 * s, 3 * s); // cão/martelo
        ctx.fillStyle = '#caa33a'; ctx.fillRect(17 * s, -2.6 * s, 2 * s, 1.6 * s); break; // mira
      case 'flamethrower':   // tanque de combustível + cano + bico com chama-piloto
        ctx.fillStyle = Md; ctx.fillRect(-5 * s, -3.5 * s, 7 * s, 9 * s);         // tanque
        ctx.fillStyle = M; ctx.fillRect(-4 * s, -2.5 * s, 5 * s, 7 * s);
        ctx.fillStyle = '#caa33a'; ctx.fillRect(-1.5 * s, -4 * s, 2.5 * s, 2 * s); // válvula
        ctx.fillStyle = M; ctx.fillRect(2 * s, -2 * s, 19 * s, 4 * s);            // cano
        ctx.fillStyle = Md; ctx.fillRect(2 * s, 1 * s, 19 * s, 1.4 * s);
        ctx.fillStyle = '#b1322c'; ctx.fillRect(20 * s, -2.6 * s, 4 * s, 5.2 * s); // bico
        ctx.fillStyle = '#ff8a3c'; ctx.beginPath(); ctx.arc(25 * s, 0, 2 * s, 0, TAU); ctx.fill(); break; // chama-piloto
      case 'dagger':   // adaga empunhada (Vex)
        ctx.fillStyle = Wd; ctx.fillRect(0, -1.3 * s, 4 * s, 2.6 * s);                  // cabo
        ctx.fillStyle = '#caa33a'; ctx.fillRect(4 * s, -2.4 * s, 1.8 * s, 4.8 * s);     // guarda
        ctx.fillStyle = P.metal || '#dfe3e8'; ctx.beginPath(); ctx.moveTo(5.6 * s, -1.8 * s); ctx.lineTo(13 * s, 0); ctx.lineTo(5.6 * s, 1.8 * s); ctx.fill();  // lâmina
        ctx.fillStyle = P.metalSh || '#9aa6b2'; ctx.beginPath(); ctx.moveTo(5.6 * s, -1.8 * s); ctx.lineTo(13 * s, 0); ctx.lineTo(5.6 * s, 0); ctx.fill(); break;  // bisel
      case 'bow':
        ctx.strokeStyle = P.wood || '#7a5a2a'; ctx.lineWidth = 2.4 * s; ctx.beginPath(); ctx.arc(4 * s, 0, 13 * s, -1.25, 1.25); ctx.stroke();
        ctx.strokeStyle = '#d8d0b8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4 * s + Math.cos(-1.25) * 13 * s, Math.sin(-1.25) * 13 * s); ctx.lineTo(20 * s, 0); ctx.lineTo(4 * s + Math.cos(1.25) * 13 * s, Math.sin(1.25) * 13 * s); ctx.stroke();
        ctx.strokeStyle = '#caa45a'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(20 * s, 0); ctx.lineTo(6 * s, 0); ctx.stroke();
        ctx.fillStyle = '#cfcfcf'; ctx.beginPath(); ctx.moveTo(22 * s, 0); ctx.lineTo(17 * s, -2.5 * s); ctx.lineTo(17 * s, 2.5 * s); ctx.fill(); break;
      case 'staff':
        ctx.fillStyle = Wd; ctx.fillRect(-2 * s, -1.5 * s, 26 * s, 3 * s); ctx.fillStyle = P.orb || '#b07bff'; ctx.shadowColor = P.orb || '#b07bff'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(25 * s, 0, 4.5 * s, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; break;
      case 'sword':
        ctx.fillStyle = '#5a4326'; ctx.fillRect(0, -2 * s, 5 * s, 4 * s); ctx.fillStyle = '#caa33a'; ctx.fillRect(5 * s, -4 * s, 2.5 * s, 8 * s);
        ctx.fillStyle = '#dfe3e8'; ctx.fillRect(7 * s, -2 * s, 22 * s, 4 * s); ctx.beginPath(); ctx.moveTo(29 * s, -2 * s); ctx.lineTo(34 * s, 0); ctx.lineTo(29 * s, 2 * s); ctx.fill();
        ctx.fillStyle = '#9aa6b2'; ctx.fillRect(7 * s, -2 * s, 22 * s, 1.5 * s); break;
    }
  },

  // chest/hands anchor where the weapon is held (world coords, no camera)
  gunAnchor(e) {
    if (typeof RIG !== 'undefined' && RIG.has(e.spr)) return RIG.gunAnchor(e);
    const d = this.defs[e.spr];
    if (!d) return { x: e.cx, y: e.y + e.h * 0.32 };
    const H = d.ch || 132, scale = e.h * (d.artK || 1.7) / H, s = d.scale || 1;
    const drop = e.crouching ? e.h * 0.34 : 0;   // AGACHADO: abaixa o cano p/ acertar objetos de 1 tile
    return { x: e.cx + (e.face || 1) * 5 * s * scale, y: (e.y + e.h) - 56 * s * scale + drop };
  },

  // ---- public draw ---------------------------------------------
  draw(ctx, e, cam) {
    if (!this.ready) this.build();
    const d = this.defs[e.spr]; if (!d) return;
    const W = d.cw || 120, H = d.ch || 132;
    const dh = e.h * (d.artK || 1.7), scale = dh / H, dw = W * scale;
    const cx = e.cx + cam.ox, baseY = e.y + e.h + cam.oy;
    // pick animation
    let anim = 'idle';
    const dying = (e.dying != null && e.dying > 0) || e.dead;
    if (dying) anim = 'death';
    else if (e.attackArc > 0) anim = 'attack';                              // ATAQUE CURTO (golpe de espada)
    else if (e.flash > 0.04 && e.onGround && Math.abs(e.vx) < 30) anim = 'hurt';
    else if (!e.onGround) anim = (e.vy < -40 ? 'jump' : 'fall');
    else if (e.crouching) anim = (e.shootT > 0 ? 'crouchshoot' : (Math.abs(e.vx) > 24 ? 'crouchwalk' : 'crouch'));
    else if (Math.abs(e.vx) > 24) anim = 'run';
    const frames = this.sheets[e.spr][anim] || this.sheets[e.spr].idle;
    let fi;
    if (anim === 'death') { const dt = e.dying != null ? (1 - clamp(e.dying / (e.dyingMax || 0.6), 0, 1)) : clamp((1 - (e.deathT || 0)), 0, 1); fi = Math.min(frames.length - 1, Math.floor(dt * frames.length)); }
    else if (anim === 'attack') { const t = clamp(1 - (e.attackArc || 0), 0, 1); fi = clamp(Math.round(t * (frames.length - 1)), 0, frames.length - 1); }   // arco conforme o golpe avança
    else if (anim === 'run' || anim === 'crouchwalk') { fi = Math.floor((e.runDist || 0) / (d.stride || 22)) % frames.length; }   // foot-locked
    else if (anim === 'crouchshoot') { const t = clamp(1 - (e.shootT || 0) / 0.18, 0, 1); fi = clamp(Math.round(t * (frames.length - 1)), 0, frames.length - 1); }
    else if (anim === 'jump') { const t = clamp(1 - (-(e.vy || 0)) / 1400, 0, 1); fi = clamp(Math.round(t * (frames.length - 1)), 0, frames.length - 1); }   // quadro pelo impulso vertical
    else if (anim === 'fall') { const t = clamp((e.vy || 0) / 1200, 0, 1); fi = clamp(Math.round(t * (frames.length - 1)), 0, frames.length - 1); }          // quadro pela velocidade de queda
    else { const fps = anim === 'idle' ? 3.5 : anim === 'crouch' ? 3 : 1; fi = Math.floor((e.anim || 0) * fps) % frames.length; }

    const face = e.face < 0 ? -1 : 1;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(cx, baseY); ctx.scale(face * scale, scale);
    const fr = frames[fi];                                     // low-res frame → stretched (nearest) to the WxH footprint
    ctx.drawImage(fr, 0, 0, fr.width, fr.height, -W / 2, -(H - 6), W, H);
    ctx.restore();

    // live weapon arm at the chest/hands anchor (not while dying nor during the sword swing)
    if (d.weapon && e.aimAng != null && anim !== 'death' && anim !== 'attack') {
      const ga = this.gunAnchor(e);
      const recoil = (e.cool && e.coolMax) ? (e.cool / e.coolMax) * 4 : 0;
      const mode = (e.dashT > 0 || e.swordMode) ? 'sword' : null;
      const wpn = e.weaponVisual || d.weapon;   // a arma equipada pode trocar o visual (ex.: fase de testes)
      this._drawPixWeapon(ctx, d, ga.x + cam.ox, ga.y + cam.oy, scale, e.aimAng, recoil, mode, wpn);
    }
  },

  // blit the (cached) pixel-art weapon at the hands anchor; the recoil kicks it
  // back along the aim direction so the shot still has punch without re-baking.
  _drawPixWeapon(ctx, d, wx, wy, scale, aim, recoil, mode, wpn) {
    const PXF = d.pxf || this.PXF;
    const buf = this._pixWeaponFrame(d, mode, aim, PXF, wpn);
    const c = buf.width / 2;
    const rx = -Math.cos(aim) * recoil * scale, ry = -Math.sin(aim) * recoil * scale;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(wx + rx, wy + ry); ctx.scale(scale * PXF, scale * PXF);
    ctx.drawImage(buf, -c, -c);
    ctx.restore();
  },

  // pixelized arm+weapon for one discrete aim angle, baked once and cached
  _pixWeaponFrame(d, mode, aim, PXF, wpn) {
    const steps = this.WAIM, bucket = ((Math.round(aim / (TAU / steps)) % steps) + steps) % steps;
    const ckey = d.key + ':' + (mode || '') + ':' + (wpn || d.weapon || '') + ':' + bucket;
    let frame = this._pwCache[ckey];
    if (frame) return frame;
    const ang = bucket * (TAU / steps);
    const R = 46 * (d.scale || 1);                             // half-extent of the weapon (generous)
    const bw = Math.max(8, Math.ceil((2 * R) / PXF) + 2);      // buffer size (+2 px for the outline)
    let buf = this._pwBuf; if (!buf) buf = this._pwBuf = document.createElement('canvas');
    if (buf.width !== bw || buf.height !== bw) { buf.width = bw; buf.height = bw; }
    const g = buf.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, bw, bw); g.imageSmoothingEnabled = true;
    const c = bw / 2;
    g.save(); g.translate(c, c); g.scale(1 / PXF, 1 / PXF);    // natural units → buffer pixels
    this.drawWeaponArm(g, d, 0, 0, ang, 0, mode, wpn);
    g.restore();
    const im = g.getImageData(0, 0, bw, bw), px = im.data;     // crisp silhouette (sem contorno grosso)
    for (let i = 0; i < px.length; i += 4) px[i + 3] = px[i + 3] >= 120 ? 255 : 0;
    g.putImageData(im, 0, 0);
    frame = document.createElement('canvas'); frame.width = bw; frame.height = bw;
    frame.getContext('2d').drawImage(buf, 0, 0);              // cópia (buf é reaproveitado)
    this._pwCache[ckey] = frame;
    return frame;
  },
};

/* ================= CHARACTER DEFINITIONS ===================== */
SPR.define('ragnarok', {
  head: 'human', weapon: 'shotgun', artK: 1.7,
  portraitSrc: 'pictures/retrato_Ragnarok.png', portraitFull: true,   // retrato dedicado p/ o HUD (busto inteiro)
  portrait: { x: 34, y: 2, w: 78, h: 78 },   // recorte da cabeça na concept (assets/ragnarok.png)
  pal: { skin: '#b07a52', skinSh: '#7e5132', hair: '#3a2615',
    torso: '#586673', torsoHi: '#7c8b97', torsoSh: '#343d47', armor: '#586673', armorHi: '#7c8b97', armorSh: '#343d47',
    leg: '#4c5660', legSh: '#2e353d', legHi: '#727d88', arm: '#586673', pauldron: '#6b7884', plate: '#6b7884',
    glove: '#43321e', boot: '#241813', belt: '#4a3320', buckle: '#8a6a26', cape: '#9a1f1f', capeSh: '#5e1212',
    metal: '#2c3036', metalSh: '#181b20', wood: '#5a3c20' },
});
SPR.define('zracks', {
  head: 'lizard', weapon: 'bow', digi: true, tail: true, artK: 1.7,
  portraitSrc: 'pictures/retrato_Zracks.png', portraitFull: true,   // retrato dedicado p/ o HUD (busto inteiro)
  portrait: { x: 50, y: 4, w: 80, h: 80 },   // recorte da cabeça na concept (assets/zracks.png)
  pal: { skin: '#4f6e30', skinSh: '#314a1d', skinHi: '#6b8a3f', crest: '#2c4519', eye: '#cf9a28',
    torso: '#3c2e1a', torsoHi: '#574021', torsoSh: '#241a0d', armor: '#3c2e1a', armorHi: '#574021', armorSh: '#241a0d',
    leg: '#415423', legSh: '#283619', arm: '#4f6e30', foot: '#2c4519', claw: '#b8ad8a',
    belt: '#2c2010', pendant: '#c7bf9e', wood: '#4a3216' },
});
SPR.define('nicolau', {
  head: 'human', hat: 'plumed', weapon: 'pistol', artK: 1.7,
  portraitSrc: 'pictures/retrato_Nicolau_Saint_German.png', portraitFull: true,
  pal: { skin: '#c98f6a', skinSh: '#92593a', hair: '#3a2414',
    torso: '#6a4426', torsoHi: '#86582f', torsoSh: '#3e2614', armor: '#6a4426', armorHi: '#86582f', armorSh: '#3e2614',
    leg: '#2e3552', legSh: '#1c2236', legHi: '#3e4a72', arm: '#6a4426', glove: '#43321e', boot: '#2a1c12',
    pauldron: '#8a929d', plate: '#6b7884', belt: '#caa33a', buckle: '#8a6a26',
    hat: '#5a3a1e', hatHi: '#6e4926', plume: '#b1322c', trim: '#caa33a',
    metal: '#3a3e44', metalSh: '#20242a', wood: '#5a3c20' },
});
SPR.define('silvyr', {
  head: 'elf', goggles: true, weapon: 'flamethrower', artK: 1.7,
  portraitSrc: 'pictures/retrato_Silvyr.png', portraitFull: true,
  pal: { skin: '#d9b89a', skinSh: '#a8835f', hair: '#4a3220',
    torso: '#2a3450', torsoHi: '#3a4868', torsoSh: '#161f30', armor: '#2a3450', armorHi: '#3a4868', armorSh: '#161f30',
    leg: '#2a2f3e', legSh: '#171b26', legHi: '#3a4150', arm: '#34405e', glove: '#9a7d44', boot: '#3a2a1a',
    pauldron: '#9a7d44', belt: '#8a7340', buckle: '#b59a55',
    cape: '#1f2536', capeSh: '#141926', goggle: '#7fd8e8',
    metal: '#4a4e54', metalSh: '#2a2e34', wood: '#46341e' },
});
SPR.define('edward', {
  head: 'human', noBeard: true, longHair: true, weapon: 'staff', artK: 1.7,
  portraitSrc: 'pictures/retrato_Edward.png', portraitFull: true,
  pal: { skin: '#c89a72', skinSh: '#946a44', hair: '#241a12', eye: '#6fd0ff',
    torso: '#3a3550', torsoHi: '#4e4870', torsoSh: '#221f30', armor: '#3a3550', armorHi: '#4e4870', armorSh: '#221f30',
    plate: '#9aa2ad', armorHi2: '#c3cad3', pauldron: '#6a4a32', pendant: '#b07bff',
    leg: '#2e2a44', legSh: '#1a1726', legHi: '#3e3860', arm: '#3a3550', glove: '#5a4326', boot: '#3a2614',
    belt: '#7a5a2a', buckle: '#caa33a', cape: '#3a2658', capeSh: '#241038',
    orb: '#7fd8ff', metal: '#5a5e66', metalSh: '#34383e', wood: '#4a3220' },
});
SPR.define('vex', {
  head: 'human', hat: 'jester', noBeard: true, weapon: 'dagger', artK: 1.7,
  portraitSrc: 'pictures/retrato_Vex.png', portraitFull: true,
  pal: { skin: '#b6b096', skinSh: '#827c66', hair: '#241d15', eye: '#1a140e',   // pele pálida de bobo
    torso: '#5a2030', torsoHi: '#7a2e40', torsoSh: '#371320', armor: '#5a2030', armorHi: '#7a2e40', armorSh: '#371320',
    leg: '#3a1622', legSh: '#23101a', legHi: '#52202e', arm: '#5a2030', glove: '#1a1410', boot: '#241018',
    belt: '#2a1410', buckle: '#caa33a', cape: '#2a2230', capeSh: '#171420',
    hat: '#6a1f2e', hat2: '#26181d', bell: '#caa33a', trim: '#caa33a',
    metal: '#cfd2d6', metalSh: '#8a9098', wood: '#4a3220' },
});
SPR.define('zombie', {
  head: 'zombie', weapon: 'musket', artK: 1.66,
  pal: { skin: '#5e7a40', skinSh: '#3a5024', skinHi: '#769255', hood: '#2c2316',
    torso: '#42341f', torsoHi: '#574226', torsoSh: '#281e12', armor: '#544832', armorHi: '#6a5b3f', armorSh: '#382c1d',
    leg: '#43381f', legSh: '#281f10', legHi: '#564a2d', arm: '#5e7a40', boot: '#241a10', belt: '#3a280f',
    metal: '#3e3a2e', metalSh: '#221f18', wood: '#4a3214' },
});
SPR.define('werewolf', {
  head: 'wolf', weapon: 'smg', digi: true, tail: true, artK: 1.66,
  pal: { skin: '#3e342a', skinSh: '#241c14', skinHi: '#5a4c3c', eye: '#e8b020',
    torso: '#32281c', torsoHi: '#463828', torsoSh: '#1c150e', armor: '#3e3022', armorHi: '#52402c', armorSh: '#241a10',
    leg: '#322a20', legSh: '#1c150e', arm: '#3e342a', foot: '#161009', claw: '#d8cfba', belt: '#2e2014',
    metal: '#24242a', metalSh: '#131316' },
});
SPR.define('wolf', {
  head: 'wolf', digi: true, tail: true, scale: 0.92, artK: 1.5,
  pal: { skin: '#4a3c2e', skinSh: '#2a2016', skinHi: '#665440', eye: '#e8b020',
    torso: '#3e3224', torsoHi: '#524030', torsoSh: '#241c12', armor: '#3e3224', armorHi: '#5a4836', armorSh: '#241c12',
    leg: '#3e3224', legSh: '#241c12', arm: '#4a3c2e', foot: '#161009', claw: '#d8cfba' },
});
SPR.define('direwolf', {
  head: 'wolf', digi: true, tail: true, scale: 1.22, bulk: 1.15, cw: 150, ch: 158, artK: 1.6,
  pal: { skin: '#322820', skinSh: '#1c140f', skinHi: '#4c3c30', eye: '#ff4a2a',
    torso: '#32281c', torsoHi: '#46382a', torsoSh: '#1c140e', armor: '#32281c', armorHi: '#4c3c30', armorSh: '#180f0a',
    leg: '#32281c', legSh: '#1c140e', arm: '#322820', foot: '#100b08', claw: '#d8cfba' },
});
SPR.define('dragonman', {
  head: 'dragon', weapon: 'rifle', digi: true, tail: true, scale: 1.12, cw: 142, ch: 150, artK: 1.66,
  pal: { skin: '#b32a1c', skinSh: '#6e1410', skinHi: '#d8402c', crest: '#5a120e', horn: '#241a12', eye: '#e0b028',
    torso: '#403a2c', torsoHi: '#544a38', torsoSh: '#26221a', armor: '#403a2c', armorHi: '#5a5040', armorSh: '#241f18', pauldron: '#5a5040',
    leg: '#8a1c14', legSh: '#54120e', arm: '#b32a1c', foot: '#341210', claw: '#bcb190', belt: '#322414', pendant: '#bcb190',
    metal: '#42464c', metalSh: '#26292e', wood: '#523c1e' },
});
SPR.define('demon', {
  head: 'demon', weapon: 'cannon', scale: 1.25, bulk: 1.15, cw: 168, ch: 176, artK: 1.6,
  pal: { skin: '#8e271c', skinSh: '#4e120e', skinHi: '#b23425', horn: '#1f160f',
    torso: '#322a2a', torsoHi: '#473a3a', torsoSh: '#1a1514', armor: '#322a2a', armorHi: '#4c4040', armorSh: '#1a1514', pauldron: '#4c4040', plate: '#43331f',
    leg: '#322624', legSh: '#1a1310', arm: '#8e271c', boot: '#241710', belt: '#4e120e', pendant: '#bcb190',
    metal: '#322624', metalSh: '#1a1310' },
});
SPR.define('flayer', {
  head: 'flayer', weapon: 'staff', scale: 1.7, bulk: 1.1, cw: 230, ch: 246, artK: 1.5,
  pal: { skin: '#5e3e84', skinSh: '#382452', skinHi: '#7e5aa8', tentacle: '#4c3070',
    torso: '#241c38', torsoHi: '#372a54', torsoSh: '#130d22', armor: '#241c38', armorHi: '#372a54', armorSh: '#130d22', pendant: '#8a6a26',
    leg: '#322550', legSh: '#1a1230', arm: '#5e3e84', foot: '#201634', claw: '#b8946e',
    cape: '#241038', capeSh: '#14071f', belt: '#322452', orb: '#a86bff', wood: '#342818' },
});

/* ===== NOVOS INIMIGOS (Fase de Testes) ===== */
SPR.define('skeleton', {
  head: 'skull', weapon: 'bow', artK: 1.66,
  pal: { skin: '#e8e0cf', skinSh: '#c2ba9e', eye: '#ff6a2c',
    torso: '#4a4234', torsoHi: '#5e5444', torsoSh: '#2c271e', armor: '#4a4234', armorHi: '#5e5444', armorSh: '#2c271e',
    leg: '#d4ccb6', legSh: '#a89f88', arm: '#d4ccb6', boot: '#3a3024', belt: '#3a2c1c', wood: '#5a4326' },
});
SPR.define('ghoul', {
  head: 'zombie', artK: 1.6,
  pal: { skin: '#7a8a4a', skinSh: '#4e5a2c', skinHi: '#96a85f', hood: '#27291a',
    torso: '#34301f', torsoHi: '#48422a', torsoSh: '#201d12', armor: '#34301f', armorHi: '#48422a', armorSh: '#201d12',
    leg: '#48421f', legSh: '#2a2612', arm: '#7a8a4a', boot: '#201810', belt: '#2a2010' },
});
SPR.define('imp', {
  head: 'demon', weapon: 'wand', scale: 0.8, bulk: 0.92, cw: 104, ch: 116, tail: true, artK: 1.5,
  pal: { skin: '#b23425', skinSh: '#6e1410', skinHi: '#d8503a', horn: '#241a12',
    torso: '#3a2420', torsoHi: '#4e342c', torsoSh: '#201210', armor: '#3a2420', armorHi: '#4e342c', armorSh: '#201210',
    leg: '#8a241a', legSh: '#541210', arm: '#b23425', foot: '#241010', claw: '#e8d0a0', orb: '#ff7a2c', wood: '#3a2418' },
});
SPR.define('ogre', {
  head: 'demon', scale: 1.32, bulk: 1.28, cw: 172, ch: 182, artK: 1.6,
  pal: { skin: '#7a8a52', skinSh: '#4a5a2e', skinHi: '#94a566', horn: '#2a2018',
    torso: '#4a3a26', torsoHi: '#5e4a32', torsoSh: '#2a2014', armor: '#4a3a26', armorHi: '#5e4a32', armorSh: '#2a2014', pauldron: '#5e4a32',
    leg: '#3a3020', legSh: '#221a10', arm: '#7a8a52', boot: '#241a10', belt: '#3a2812' },
});
SPR.define('musketeer', {
  head: 'human', weapon: 'musket', artK: 1.68,
  pal: { skin: '#c89a72', skinSh: '#946a44', hair: '#2a1d12',
    torso: '#2e3a6a', torsoHi: '#42528a', torsoSh: '#1a2240', armor: '#2e3a6a', armorHi: '#42528a', armorSh: '#1a2240', pauldron: '#8a2a2a',
    leg: '#3a3550', legSh: '#221f30', arm: '#2e3a6a', glove: '#2a1c12', boot: '#241810', belt: '#caa33a', buckle: '#e8c45a',
    metal: '#3a3e44', metalSh: '#20242a', wood: '#5a3c20' },
});
SPR.define('cultist', {
  head: 'zombie', weapon: 'staff', artK: 1.66,
  pal: { skin: '#9a8f7d', skinSh: '#6a6052', hood: '#241038',
    torso: '#2a1840', torsoHi: '#3a2456', torsoSh: '#160a26', armor: '#2a1840', armorHi: '#3a2456', armorSh: '#160a26',
    leg: '#241038', legSh: '#140722', arm: '#2a1840', boot: '#180e24', belt: '#caa33a',
    cape: '#1f0e30', capeSh: '#120720', orb: '#b07bff', wood: '#3a2a18' },
});
SPR.define('specter', {
  head: 'flayer', scale: 1.0, artK: 1.6,
  pal: { skin: '#b59ad8', skinSh: '#7a5aa8', skinHi: '#d0bce8', tentacle: '#6a4a9a',
    torso: '#3a2858', torsoHi: '#4e3a72', torsoSh: '#221540', armor: '#3a2858', armorHi: '#4e3a72', armorSh: '#221540',
    leg: '#2a1c44', legSh: '#160e28', arm: '#b59ad8', cape: '#2a1850', capeSh: '#160a28' },
});
SPR.define('hellhound', {
  head: 'wolf', digi: true, tail: true, artK: 1.55,
  pal: { skin: '#7a241a', skinSh: '#4a120e', skinHi: '#a8402c', eye: '#ffd84a',
    torso: '#3a1a14', torsoHi: '#4e2620', torsoSh: '#200d0a', armor: '#3a1a14', armorHi: '#4e2620', armorSh: '#200d0a',
    leg: '#5a1c14', legSh: '#340f0c', arm: '#7a241a', foot: '#1a0a08', claw: '#e8d0a0' },
});
