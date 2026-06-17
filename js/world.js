/* ============================================================
   world.js — destructible tile world, physics & destruction
   ============================================================ */

// material id -> definition. id 0 = empty.
const MAT = [
  null, // 0 empty
  { name: 'dirt',      hp: 22,  solid: true,  c: '#6b4a2c', c2: '#553a22', edge: '#7d5938', soft: true, cap: 'grass' },
  { name: 'stone',     hp: 46,  solid: true,  c: '#5b5550', c2: '#46413c', edge: '#6e6760' },
  { name: 'brick',     hp: 80,  solid: true,  c: '#7a3a30', c2: '#5e2a22', edge: '#8f463a' },
  { name: 'wood',      hp: 16,  solid: true,  c: '#7d5a2e', c2: '#5f4422', edge: '#946b39' },
  { name: 'bedrock',   hp: 1e9, solid: true,  c: '#2c2a28', c2: '#201e1c', edge: '#3a3633', indestructible: true },
  { name: 'barrel',    hp: 12,  solid: true,  c: '#caa33a', c2: '#3a2a14', edge: '#e8c24f', barrel: true },
  { name: 'vault',     hp: 34,  solid: true,  c: '#caa33a', c2: '#8a6a1c', edge: '#f4d35e', gold: true },
  { name: 'cobble',    hp: 54,  solid: true,  c: '#3f4750', c2: '#2b3038', edge: '#545d68' },
  { name: 'sandstone', hp: 38,  solid: true,  c: '#caa86a', c2: '#a98a4e', edge: '#e0c488', soft: true },
  { name: 'mossy',     hp: 72,  solid: true,  c: '#4a463f', c2: '#3a3631', edge: '#5b5550' },
  { name: 'sand',      hp: 14,  solid: true,  c: '#d8c07a', c2: '#b89a52', edge: '#e8d49a', soft: true, falls: true },
  { name: 'gravel',    hp: 22,  solid: true,  c: '#6a6258', c2: '#4a463e', edge: '#7d756a', falls: true },
  { name: 'rocket',    hp: 12,  solid: true,  c: '#b1322c', c2: '#3a1410', edge: '#e0843a', rocket: true },   // launches a rocket when destroyed
  { name: 'ladder',    hp: 1e9, solid: false, c: '#6a4a28', c2: '#3a2a14', edge: '#8a6438', ladder: true, indestructible: true },
];
// char -> material id (used by level loader)
const CHAR2MAT = { '#': 2, 'D': 1, 'B': 3, '=': 4, '~': 5, 'X': 6, '$': 7, 'C': 8, 'S': 9, 'm': 10, 'A': 11, 'R': 12, 'K': 13, 'h': 14 };

/* a single tile detached by gravity, falling until it lands & re-deposits */
class FallingBlock {
  constructor(c, r, id, world) {
    this.T = world.T; this.x = c * this.T; this.y = r * this.T; this.id = id; this.world = world;
    this.vy = 0; this.alive = true; this.hit = null;
  }
  update(dt, game) {
    const T = this.T, w = this.world;
    this.vy = Math.min(this.vy + CONFIG.GRAVITY * dt, CONFIG.TERMINAL_VY);
    const ny = this.y + this.vy * dt;
    const c = Math.floor((this.x + T / 2) / T);
    const belowRow = Math.floor((ny + T) / T);
    // crush whatever it falls onto
    if (this.vy > 250) {
      const box = { x: this.x + 2, y: this.y, w: T - 4, h: T };
      if (game.player && !game.player.dead && aabb(box, game.player)) { if (this.hit !== 'p') { game.player.hurt(14, 0, game); this.hit = 'p'; } }
      for (const e of game.enemies) if (e.alive && aabb(box, e)) e.hurt(16, 0, game);
    }
    if (belowRow >= w.rows || w.solid(c, belowRow)) {
      const restRow = belowRow - 1;
      this.alive = false;
      if (restRow >= 0 && !w.solid(c, restRow)) {
        w.set(c, restRow, this.id);
        w.maybeFall(c, restRow - 1);   // anything stacked above now follows
      } else {
        game.fx.debrisBurst(this.x + T / 2, this.y + T / 2, MAT[this.id].c2, 90);
      }
      game.fx.chips(this.x + T / 2, this.y + T / 2, MAT[this.id].c, 5);
      game.cam.addShake(2); Sound.crumble();
    } else {
      this.y = ny;
    }
  }
  draw(ctx, cam) {
    const img = TEX.tiles[this.id] && TEX.tiles[this.id][0];
    const x = Math.round(this.x + cam.ox), y = Math.round(this.y + cam.oy);
    if (img) ctx.drawImage(img, x, y); else { ctx.fillStyle = MAT[this.id].c; ctx.fillRect(x, y, this.T, this.T); }
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + this.T - 3, this.T, 3);
  }
}

class World {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.T = CONFIG.TILE;
    this.pixelW = cols * this.T;
    this.pixelH = rows * this.T;
    this.mat = new Uint8Array(cols * rows);   // material id
    this.hp = new Int32Array(cols * rows);    // current hp
    this.fallers = [];                        // active FallingBlocks
    this.game = null;                         // set by Game
  }
  // detach a gravity-affected tile (and cascade upward) when unsupported
  maybeFall(c, r) {
    if (!this.inBounds(c, r) || this.fallers.length > 400) return;
    const id = this.at(c, r);
    if (!id || !MAT[id].falls || this.solid(c, r + 1)) return;
    this.mat[this.idx(c, r)] = 0; this.hp[this.idx(c, r)] = 0;
    this.fallers.push(new FallingBlock(c, r, id, this));
    this.maybeFall(c, r - 1);
  }
  updateFallers(dt, game) {
    for (const f of this.fallers) f.update(dt, game);
    if (this.fallers.length) this.fallers = this.fallers.filter(f => f.alive);
  }
  // instantly drop any unsupported gravity tiles to their resting cell (level build)
  settle() {
    for (let c = 0; c < this.cols; c++) for (let r = this.rows - 1; r >= 0; r--) {
      const id = this.at(c, r);
      if (!id || !MAT[id].falls || this.solid(c, r + 1)) continue;
      let rr = r; while (rr + 1 < this.rows && !this.solid(c, rr + 1)) rr++;
      if (rr !== r) { this.mat[this.idx(c, r)] = 0; this.hp[this.idx(c, r)] = 0; this.mat[this.idx(c, rr)] = id; this.hp[this.idx(c, rr)] = MAT[id].hp; }
    }
  }
  idx(c, r) { return r * this.cols + c; }
  inBounds(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }

  set(c, r, id) {
    if (!this.inBounds(c, r)) return;
    const i = this.idx(c, r);
    this.mat[i] = id;
    this.hp[i] = id ? MAT[id].hp : 0;
  }
  at(c, r) { return this.inBounds(c, r) ? this.mat[this.idx(c, r)] : 2; } // OOB = solid wall
  solid(c, r) { const m = this.at(c, r); return m !== 0 && MAT[m] && MAT[m].solid; }
  solidPx(x, y) { return this.solid(Math.floor(x / this.T), Math.floor(y / this.T)); }
  ladderAt(x, y) { const m = this.at(Math.floor(x / this.T), Math.floor(y / this.T)); return m && MAT[m] && MAT[m].ladder; }

  // ---- destruction ------------------------------------------
  // returns true if tile was destroyed this call
  damage(c, r, dmg, opts = {}) {
    if (!this.inBounds(c, r)) return false;
    const i = this.idx(c, r); const id = this.mat[i];
    if (!id) return false;
    const m = MAT[id];
    if (m.indestructible) { if (this.game) this.game.fx.spark(c * this.T + 14, r * this.T + 14, m.edge, 2); return false; }
    this.hp[i] -= dmg;
    if (this.game) {
      Sound.crumble();
      this.game.fx.chips(c * this.T + 14, r * this.T + 14, m.c, 2);
    }
    if (this.hp[i] <= 0) {
      this.mat[i] = 0; this.hp[i] = 0;
      if (this.game) {
        const T = this.T;
        this.game.fx.chips(c * T + T / 2, r * T + T / 2, m.c, 10);
        this.game.fx.chips(c * T + T / 2, r * T + T / 2, m.c2, 6);
        this.game.fx.debrisBurst(c * T + T / 2, r * T + T / 2, m.c2, opts.power || 70);
        this.game.fx.smoke(c * T + T / 2, r * T + T / 2, 2, 'rgba(120,110,95,');
        this.game.fx.rubble(c * T + T / 2, (r + 1) * T - 3, m.c2);   // persistent rubble on the ground below
        if (m.gold) { this.game.fx.spark(c * T + 14, r * T + 14, '#ffe27a', 8); this.game.spawnOregano(c * T + T / 2, r * T + T / 2, 3 + (Math.random() * 3 | 0)); }
      }
      if (m.barrel && !opts.noBarrelChain) {
        // chained explosion (queued to avoid deep recursion)
        if (this.game) this.game.queueExplosion(c * this.T + this.T / 2, r * this.T + this.T / 2, 86, 64);
      }
      if (m.rocket && this.game) {  // launch a rocket toward the player
        const px = c * this.T + this.T / 2, py = r * this.T + this.T / 2;
        const dir = this.game.player ? sign(this.game.player.cx - px) || 1 : 1;
        this.game.spawnRocket(px, py, dir);
        this.game.queueExplosion(px, py, 44, 30);
      }
      this.maybeFall(c, r - 1);  // unsupported gravity blocks above collapse
      return true;
    }
    return false;
  }

  // big radial explosion: damages tiles + entities, debris, cave-in
  explode(x, y, radius, dmg) {
    const T = this.T;
    const c0 = Math.floor((x - radius) / T), c1 = Math.floor((x + radius) / T);
    const r0 = Math.floor((y - radius) / T), r1 = Math.floor((y + radius) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const cx = c * T + T / 2, cy = r * T + T / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d <= radius) this.damage(c, r, dmg * (1 - d / radius) + 14, { power: 140, noBarrelChain: false });
    }
    this._caveIn(c0 - 1, c1 + 1, r0 - 2, r1 + 1);
    if (this.game) {
      this.game.fx.explosion(x, y, radius);
      this.game.cam.addShake(radius * 0.18);
      Sound.explode();
      this.game.damageEntitiesRadial(x, y, radius * 1.05, dmg);
    }
  }

  // lightweight cave-in: soft tiles with nothing beneath crumble into debris
  _caveIn(c0, c1, r0, r1) {
    c0 = Math.max(0, c0); r0 = Math.max(0, r0);
    c1 = Math.min(this.cols - 1, c1); r1 = Math.min(this.rows - 1, r1);
    for (let pass = 0; pass < 2; pass++) {
      for (let r = r1; r >= r0; r--) for (let c = c0; c <= c1; c++) {
        const id = this.at(c, r);
        if (!id || !MAT[id].soft) continue;
        if (!this.solid(c, r + 1) && r + 1 < this.rows) {
          this.mat[this.idx(c, r)] = 0; this.hp[this.idx(c, r)] = 0;
          if (this.game) this.game.fx.debrisBurst(c * this.T + 14, r * this.T + 14, MAT[id].c2, 50);
          this.maybeFall(c, r - 1);
        }
      }
    }
  }

  // auto step-up over a 1-tile ledge/obstacle (smooth ground traversal)
  _tryStep(e, col) {
    const T = this.T;
    const feetRow = Math.floor((e.y + e.h - 1) / T);
    if (!this.solid(col, feetRow) || this.solid(col, feetRow - 1)) return false; // must be a single-tile step
    if ((e.y + e.h) - feetRow * T > T + 3) return false;                         // feet must be near the ledge top
    const newY = feetRow * T - e.h;
    const c0 = Math.floor(e.x / T), c1 = Math.floor((e.x + e.w - 1) / T);
    const nr0 = Math.floor(newY / T), nr1 = feetRow - 1;
    for (let c = c0; c <= c1; c++) for (let r = nr0; r <= nr1; r++) if (this.solid(c, r)) return false; // headroom
    e.y = newY; return true;
  }

  // ---- physics: move entity, resolve vs solid tiles ----------
  moveAndCollide(e, dt) {
    const T = this.T;
    e.onGround = false; e.hitWall = 0; e.hitCeil = false;

    // ---- X axis ----
    e.x += e.vx * dt;
    let r0 = Math.floor(e.y / T), r1 = Math.floor((e.y + e.h - 1) / T);
    if (e.vx > 0) {
      const col = Math.floor((e.x + e.w) / T);
      let hit = false; for (let r = r0; r <= r1; r++) if (this.solid(col, r)) { hit = true; break; }
      if (hit && !(e.canStep !== false && this._tryStep(e, col))) { e.x = col * T - e.w; e.vx = 0; e.hitWall = 1; }
    } else if (e.vx < 0) {
      const col = Math.floor(e.x / T);
      let hit = false; for (let r = r0; r <= r1; r++) if (this.solid(col, r)) { hit = true; break; }
      if (hit && !(e.canStep !== false && this._tryStep(e, col))) { e.x = (col + 1) * T; e.vx = 0; e.hitWall = -1; }
    }

    // ---- Y axis ----
    e.y += e.vy * dt;
    let c0 = Math.floor(e.x / T), c1 = Math.floor((e.x + e.w - 1) / T);
    if (e.vy > 0) {
      const row = Math.floor((e.y + e.h) / T);
      for (let c = c0; c <= c1; c++) if (this.solid(c, row)) { e.y = row * T - e.h; e.vy = 0; e.onGround = true; break; }
    } else if (e.vy < 0) {
      const row = Math.floor(e.y / T);
      for (let c = c0; c <= c1; c++) if (this.solid(c, row)) { e.y = (row + 1) * T; e.vy = 0; e.hitCeil = true; break; }
    }
    // keep inside world horizontally
    if (e.x < 0) { e.x = 0; e.vx = Math.max(0, e.vx); }
    if (e.x + e.w > this.pixelW) { e.x = this.pixelW - e.w; e.vx = Math.min(0, e.vx); }
  }

  // ---- render -----------------------------------------------
  draw(ctx, cam) {
    if (!TEX.ready) TEX.build();
    const T = this.T;
    const c0 = Math.max(0, Math.floor(cam.x / T));
    const c1 = Math.min(this.cols - 1, Math.floor((cam.x + cam.vw) / T) + 1);
    const r0 = Math.max(0, Math.floor(cam.y / T));
    const r1 = Math.min(this.rows - 1, Math.floor((cam.y + cam.vh) / T) + 1);
    const ox = cam.ox, oy = cam.oy;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = this.idx(c, r); const id = this.mat[i];
      if (!id) continue;
      const m = MAT[id];
      const x = Math.round(c * T + ox), y = Math.round(r * T + oy);
      const variant = ((c * 2 + r * 3) % TEX.V + TEX.V) % TEX.V;
      const img = TEX.tiles[id] && TEX.tiles[id][variant];
      if (img) ctx.drawImage(img, x, y); else { ctx.fillStyle = m.c; ctx.fillRect(x, y, T, T); }
      if (!m.solid) continue;   // ladders & other non-solid props: no block shading/cracks
      const openAbove = !this.solid(c, r - 1);
      // shade neighbours that face open space for depth
      if (openAbove) { ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x, y, T, 2); }
      if (!this.solid(c, r + 1)) { ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillRect(x, y + T - 3, T, 3); }
      // grass cap on exposed earth
      if (openAbove && m.cap === 'grass') {
        ctx.fillStyle = '#4a7a3a'; ctx.fillRect(x, y, T, 4);
        ctx.fillStyle = '#5e9a46';
        for (let k = 0; k < T; k += 5) ctx.fillRect(x + k, y - 2 - ((c + k) % 2), 3, 4);
      }
      // damage cracks
      const frac = this.hp[i] / m.hp;
      if (!m.indestructible && frac < 0.6) {
        ctx.strokeStyle = 'rgba(0,0,0,' + (0.55 * (1 - frac)) + ')';
        ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + 12, y + 14); ctx.lineTo(x + 8, y + T - 4);
        if (frac < 0.3) { ctx.moveTo(x + T - 6, y + 6); ctx.lineTo(x + T - 14, y + 16); }
        ctx.stroke();
      }
    }
    for (const f of this.fallers) if (cam.visible(f.x, f.y, T, T)) f.draw(ctx, cam);
  }
}
