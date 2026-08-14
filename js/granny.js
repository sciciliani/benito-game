// The kitchen heist NPC. Wanders a patrol route while calm, muttering
// gibberish now and then. The instant the player grabs the fish (see
// enrage(), called from main.js's checkGranny()) she shouts and directly
// chases the player's position, broom swinging — but there's a short grace
// period (catchImmuneTimer) before she can actually land a hit, so grabbing
// the fish doesn't feel like an instant ambush even if she's already close.
// She also can't walk through the room's furniture (obstacles), same as the
// player — that's what makes dodging around it worthwhile.
class Granny {
  constructor(cfg) {
    this.position = new THREE.Vector3(cfg.x, cfg.y, cfg.z);
    this.patrolA = new THREE.Vector2(cfg.patrolA?.x ?? cfg.x, cfg.patrolA?.z ?? cfg.z);
    this.patrolB = new THREE.Vector2(cfg.patrolB?.x ?? cfg.x, cfg.patrolB?.z ?? cfg.z);
    this.patrolTarget = this.patrolB;
    this.patrolSpeed = cfg.patrolSpeed ?? 1.5;
    // Faster than Benito's walk (6.5) but slower than his run (10.5) — she
    // can't be outwalked, but running away is a real, necessary option.
    this.chaseSpeed = cfg.chaseSpeed ?? 6.8;
    this.catchRadius = cfg.catchRadius ?? 1.0;
    this.exitTo = cfg.exitTo ?? null;
    this.obstacles = cfg.obstacles ?? []; // furniture circles: {x,z,radius} — see level-garden.js
    this.radius = 0.3;
    this.angry = false;
    this.catchImmuneTimer = 0;
    this._mutterTimer = 2 + Math.random() * 3;

    this.mesh = this._build();
    this.mesh.position.copy(this.position);
    this._baseRy = cfg.ry ?? 0;
    this.mesh.rotation.y = this._baseRy;
  }

  _build() {
    const g = new THREE.Group();
    const dressMat = new THREE.MeshLambertMaterial({ color: 0x7a5a9c });
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.95, 10), dressMat);
    dress.position.y = 0.56;
    g.add(dress);

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf0c9a0 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skinMat);
    head.position.y = 1.18;
    g.add(head);

    const hairMat = new THREE.MeshLambertMaterial({ color: 0xd8d8dc });
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), hairMat);
    hair.scale.set(1, 0.8, 1);
    hair.position.y = 1.22;
    g.add(hair);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), hairMat);
    bun.position.set(0, 1.38, -0.06);
    g.add(bun);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 2, 5), dressMat);
      arm.rotation.z = 0.5 * side;
      arm.position.set(0.28 * side, 0.85, 0);
      g.add(arm);
    }

    // The broom: wooden handle + a straw head, held out to one side. Its
    // rotation gets animated in update() — resting while calm, swinging
    // wildly while chasing.
    const broom = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a5a3c })
    );
    handle.position.y = 0.45;
    broom.add(handle);
    const straw = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.28, 8),
      new THREE.MeshLambertMaterial({ color: 0xe0c060 })
    );
    straw.position.y = -0.03;
    straw.rotation.x = Math.PI;
    broom.add(straw);
    broom.position.set(0.4, 0.55, 0.1);
    broom.rotation.z = -0.4;
    g.add(broom);

    this._headMesh = head;
    this._skinMat = skinMat;
    this._broom = broom;
    return g;
  }

  enrage() {
    if (this.angry) return;
    this.angry = true;
    // A couple seconds where she's visibly furious and coming for you, but
    // can't actually land a hit yet — time to get moving after the grab
    // before the chase becomes a real threat.
    this.catchImmuneTimer = 1.8;
    SFX.playGrannyAngryShout();
  }

  calm() {
    this.angry = false;
    this._skinMat.color.set(0xf0c9a0);
  }

  // Keeps her (and the player, symmetrically, from the player's own
  // collision) from cutting straight through furniture — a plain
  // "push out of the circle" since she has no other pathfinding.
  _avoidObstacles() {
    for (const ob of this.obstacles) {
      const dx = this.position.x - ob.x, dz = this.position.z - ob.z;
      const minDist = ob.radius + this.radius;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minDist * minDist) continue;
      const dist = Math.sqrt(distSq);
      const nx = dist > 0.0001 ? dx / dist : 1;
      const nz = dist > 0.0001 ? dz / dist : 0;
      const overlap = minDist - dist;
      this.position.x += nx * overlap;
      this.position.z += nz * overlap;
    }
  }

  update(dt, player) {
    if (this.catchImmuneTimer > 0) this.catchImmuneTimer = Math.max(0, this.catchImmuneTimer - dt);

    if (this.angry) {
      const dx = player.position.x - this.position.x, dz = player.position.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        this.position.x += (dx / dist) * this.chaseSpeed * dt;
        this.position.z += (dz / dist) * this.chaseSpeed * dt;
        this.mesh.rotation.y = Math.atan2(dx, dz);
      }
      this._broom.rotation.z = -0.4 + Math.sin(performance.now() * 0.025) * 0.7;
      this._skinMat.color.set(0xe0784a); // flushed with anger
    } else {
      const toTarget = new THREE.Vector2(this.patrolTarget.x - this.position.x, this.patrolTarget.y - this.position.z);
      const d = toTarget.length();
      if (d < 0.3) {
        this.patrolTarget = this.patrolTarget === this.patrolA ? this.patrolB : this.patrolA;
      } else {
        toTarget.normalize();
        this.position.x += toTarget.x * this.patrolSpeed * dt;
        this.position.z += toTarget.y * this.patrolSpeed * dt;
        this.mesh.rotation.y = Math.atan2(toTarget.x, toTarget.y);
      }
      this._broom.rotation.z = -0.4;

      this._mutterTimer -= dt;
      if (this._mutterTimer <= 0) {
        SFX.playGrannyMutter();
        this._mutterTimer = 4 + Math.random() * 4;
      }
    }
    this._avoidObstacles();
    this.mesh.position.copy(this.position);
  }
}
