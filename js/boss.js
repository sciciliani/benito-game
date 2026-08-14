// Level-ending boss: a big cat that lumbers around its arena and lobs
// "gas cloud" projectiles at the player. Melee-vulnerable like a regular
// Enemy but with more HP and a bigger hitbox/attack range for the player.
class Boss {
  constructor(cfg) {
    this.mesh = buildCatMesh({ furColor: 0x8a8a7a, earColor: 0x555045, eyeColor: 0xff3b3b, scale: 2.4 });
    this.position = new THREE.Vector3(cfg.x, cfg.y, cfg.z);
    this.mesh.position.copy(this.position); // otherwise it sits at the scene
    // origin (i.e. near spawn) until update() first runs after waking up
    this.radius = 1.1;
    this.arenaCenter = new THREE.Vector2(cfg.x, cfg.z);
    this.arenaRadius = cfg.arenaRadius ?? 14;

    this.hp = cfg.hp ?? 6;
    this.maxHp = this.hp;
    this.dead = false;
    this.hitFlash = 0;
    this.lastHitAttackId = -1;

    this.speed = cfg.speed ?? 1.6;
    this.fireInterval = cfg.fireInterval ?? 3.2;
    this.windupDuration = cfg.windupDuration ?? 0.7;
    this.fireTimer = this.fireInterval * 0.6;
    this.winding = false;
    this.projectileSpeed = cfg.projectileSpeed ?? 5.5;
    this.projectileDamage = cfg.projectileDamage ?? 1;

    this.projectiles = [];
    this.parent = null; // set by LevelBuilder once mesh is in the scene graph
    this.awake = false;
    this.awakeRadius = cfg.awakeRadius ?? 16;
  }

  update(dt, world, player) {
    if (this.dead) return;

    if (!this.awake) {
      if (this.position.distanceTo(player.position) < this.awakeRadius) this.awake = true;
      this._updateProjectiles(dt, world, player);
      return;
    }

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.fireTimer -= dt;

    // Waddle slowly toward the player but stay within the arena circle.
    const toPlayer = new THREE.Vector2(player.position.x - this.position.x, player.position.z - this.position.z);
    if (toPlayer.length() > 3) {
      toPlayer.normalize();
      const nx = this.position.x + toPlayer.x * this.speed * dt;
      const nz = this.position.z + toPlayer.y * this.speed * dt;
      if (new THREE.Vector2(nx, nz).distanceTo(this.arenaCenter) < this.arenaRadius) {
        this.position.x = nx;
        this.position.z = nz;
      }
      this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.y);
    }
    if (!player.dead) separateCircles(this.position, this.radius, player.position, player.radius);
    this.position.y = findGroundY(world, this.position.x, this.position.z, this.position.y);
    this.mesh.position.copy(this.position);

    // Wind-up tell: mouth opens and eyes narrow for windupDuration before
    // the gas actually fires, so the player has a clear cue to back off.
    const parts = this.mesh.userData.parts;
    if (this.fireTimer <= this.windupDuration && !this.winding) {
      this.winding = true;
      SFX.playGrowl();
    }
    if (this.winding) {
      const p = THREE.MathUtils.clamp(1 - this.fireTimer / this.windupDuration, 0, 1);
      parts.mouth.scale.y = 0.22 + p * 2.4;
      parts.eyeL.scale.y = 1 - p * 0.55;
      parts.eyeR.scale.y = 1 - p * 0.55;
    }

    if (this.fireTimer <= 0) {
      this._fireGas(player);
      this.fireTimer = this.fireInterval;
      this.winding = false;
      parts.mouth.scale.y = 0.22;
      parts.eyeL.scale.y = 1;
      parts.eyeR.scale.y = 1;
    }

    if (player.attackId !== this.lastHitAttackId && player.attackHits(this.position, this.radius)) {
      this.lastHitAttackId = player.attackId;
      this.takeHit(1);
      player.onLandedHit();
    }

    if (this.hitFlash > 0) {
      this.mesh.userData.parts.body.material.color.set(0xd06a3a);
    } else {
      this.mesh.userData.parts.body.material.color.set(0x8a8a7a);
    }

    this._updateProjectiles(dt, world, player);
  }

  // Shared by the regular claw swipe above and Player's AoE super attack.
  takeHit(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.hitFlash = 0.25;
    if (this.hp <= 0) this.die();
  }

  _fireGas(player) {
    if (!this.parent) return;
    const geo = new THREE.SphereGeometry(0.35, 10, 10);
    const mat = new THREE.MeshLambertMaterial({ color: 0x8fd94a, transparent: true, opacity: 0.75 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(this.position).setY(this.position.y + 1.4);
    this.parent.add(mesh);

    const dir = new THREE.Vector3().subVectors(player.position, this.position);
    dir.y = 0;
    dir.normalize();

    this.projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(this.projectileSpeed),
      life: 3.5,
    });
  }

  _updateProjectiles(dt, world, player) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.life -= dt;
      proj.mesh.position.addScaledVector(proj.velocity, dt);
      proj.mesh.scale.setScalar(1 + Math.sin(performance.now() * 0.01) * 0.08);

      const hitPlayer = !player.dead && proj.mesh.position.distanceTo(player.position) < 0.5 + player.radius;
      if (hitPlayer) {
        player.takeDamage(this.projectileDamage, proj.mesh.position);
        proj.life = 0;
      }
      if (proj.life <= 0) {
        this.parent.remove(proj.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  die() {
    this.dead = true;
    this.mesh.visible = false;
    for (const proj of this.projectiles) this.parent.remove(proj.mesh);
    this.projectiles = [];
  }
}
