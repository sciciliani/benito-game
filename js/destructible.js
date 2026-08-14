// A breakable prop (currently: a couch). Takes hits from the player's claw
// swipe exactly like Enemy/Boss do, and on death spawns real Collectible
// pickups nearby so the reward uses the same walk-over-to-collect flow as
// everything else — no special-case pickup code needed.
class Destructible {
  constructor(cfg) {
    this.position = new THREE.Vector3(cfg.x, cfg.y, cfg.z);
    this.radius = cfg.radius ?? 1.1;
    this.hp = cfg.hp ?? 6;
    this.maxHp = this.hp;
    this.dead = false;
    this.hitFlash = 0;
    this.lastHitAttackId = -1;
    this.rewards = cfg.rewards ?? []; // [{type, dx, dz}]
    this.mesh = this._buildCouch(cfg);
    this.mesh.position.copy(this.position);
    if (cfg.ry) this.mesh.rotation.y = cfg.ry;
  }

  _buildCouch(cfg) {
    const g = new THREE.Group();
    const frameMat = new THREE.MeshLambertMaterial({ color: cfg.color ?? 0x8a5a3c });
    this._frameMat = frameMat;

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 0.9), frameMat);
    base.position.y = 0.28;
    g.add(base);

    const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 0.22), frameMat);
    back.position.set(0, 0.78, -0.34);
    g.add(back);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.9), frameMat);
      arm.position.set(0.84 * side, 0.5, 0);
      g.add(arm);
    }

    const cushionMat = new THREE.MeshLambertMaterial({ color: cfg.cushionColor ?? 0xc98a55 });
    this._cushionMat = cushionMat;
    for (const off of [-0.56, 0.56]) {
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.2, 0.8), cushionMat);
      cushion.position.set(off, 0.6, 0.02);
      g.add(cushion);
    }

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 6), frameMat);
      leg.position.set(0.8 * side, 0.02, 0.32);
      g.add(leg);
      const leg2 = leg.clone();
      leg2.position.z = -0.32;
      g.add(leg2);
    }

    return g;
  }

  update(dt, player, world) {
    if (this.dead) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    // It's a static prop, not a platform in world.platforms, so nothing
    // else stops the player from walking straight through it. Push only the
    // player out (not separateCircles' usual both-ways split) — it's a
    // couch, not another character, it shouldn't visibly shove aside.
    const dx = player.position.x - this.position.x, dz = player.position.z - this.position.z;
    const minDist = this.radius + player.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq);
      const nx = dist > 0.0001 ? dx / dist : 1; // dead-center edge case: push an arbitrary direction
      const nz = dist > 0.0001 ? dz / dist : 0;
      const overlap = minDist - dist;
      player.position.x += nx * overlap;
      player.position.z += nz * overlap;
    }

    if (player.attackId !== this.lastHitAttackId && player.attackHits(this.position, this.radius)) {
      this.lastHitAttackId = player.attackId;
      this.takeHit(1, world);
      player.onLandedHit();
    }

    // Wobbles more violently the closer it is to falling apart.
    const damage = 1 - this.hp / this.maxHp;
    this.mesh.rotation.z = Math.sin(performance.now() * 0.025) * damage * 0.08;

    if (this._baseCushion === undefined) this._baseCushion = this._cushionMat.color.getHex();
    this._cushionMat.color.set(this.hitFlash > 0 ? 0xffb0a0 : this._baseCushion);
  }

  takeHit(amount, world) {
    if (this.dead) return;
    this.hp -= amount;
    this.hitFlash = 0.2;
    SFX.playHiss();
    if (this.hp <= 0) this.die(world);
  }

  die(world) {
    this.dead = true;
    this.mesh.visible = false;
    for (const r of this.rewards) {
      const item = new Collectible(r.type, this.position.x + (r.dx ?? 0), this.position.y + 0.4, this.position.z + (r.dz ?? 0));
      world.group.add(item.mesh);
      world.collectibles.push(item);
    }
  }
}
