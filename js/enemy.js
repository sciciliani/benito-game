// A rival black cat: patrols between two points, chases the player when
// close, scratches on contact, and can be defeated by the player's attack.
class Enemy {
  constructor(cfg) {
    this.baseColor = 0x111114;
    if (typeof Silverpaw !== 'undefined' && Silverpaw.isReady()) {
      const inst = Silverpaw.instantiate(this.baseColor);
      this.mesh = inst.group;
      this.mixer = inst.mixer;
      this.animDriver = Silverpaw.createAnimDriver(inst.actions);
      this.mesh.userData.parts = { body: { material: inst.material } };
      this.usingSilverpaw = true;
    } else {
      this.mesh = buildCatMesh({ furColor: this.baseColor, earColor: 0x444444, eyeColor: 0xffcc33, pawColor: 0xf2f2f2 });
      this.usingSilverpaw = false;
    }
    this.position = new THREE.Vector3(cfg.x, cfg.y, cfg.z);
    this.radius = 0.42;

    this.healthBar = makeHealthBarSprite();
    this.healthBar.sprite.position.set(0, 1.75, 0);
    this.mesh.add(this.healthBar.sprite);

    this.patrolA = new THREE.Vector2(cfg.patrolA?.x ?? cfg.x, cfg.patrolA?.z ?? cfg.z);
    this.patrolB = new THREE.Vector2(cfg.patrolB?.x ?? cfg.x, cfg.patrolB?.z ?? cfg.z);
    this.patrolTarget = this.patrolB;

    this.speed = cfg.speed ?? 2.4;
    this.chaseSpeed = cfg.chaseSpeed ?? 4.2;
    this.aggroRadius = cfg.aggroRadius ?? 7;
    this.attackRadius = cfg.attackRadius ?? 1.0;
    this.attackDamage = cfg.attackDamage ?? 1;
    this.attackCooldownMax = 1.0;
    this.attackCooldown = 0;

    this.hp = cfg.hp ?? 2;
    this.maxHp = this.hp;
    this.dead = false;
    this.hitFlash = 0;
    this.lastHitAttackId = -1;
  }

  update(dt, world, player) {
    if (this.dead) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    const toPlayer = new THREE.Vector2(player.position.x - this.position.x, player.position.z - this.position.z);
    const distToPlayer = toPlayer.length();
    // Aggro is x/z only, same blind spot the melee checks had: without a
    // vertical gate, an enemy up on a ledge/rooftop "chases" the player's
    // x/z even when they're on the ground far below, walking itself off the
    // ledge — and since Enemy has no gravity, it just hangs in midair at
    // whatever y findGroundY last gave it once there's no platform under it.
    const closeOnYAggro = Math.abs(player.position.y - this.position.y) < AGGRO_VERTICAL_REACH;
    const chasing = distToPlayer < this.aggroRadius && closeOnYAggro;

    let dirX = 0, dirZ = 0;
    if (chasing) {
      if (distToPlayer > 0.001) toPlayer.normalize();
      dirX = toPlayer.x; dirZ = toPlayer.y;
      this.position.x += dirX * this.chaseSpeed * dt;
      this.position.z += dirZ * this.chaseSpeed * dt;
    } else {
      const toTarget = new THREE.Vector2(this.patrolTarget.x - this.position.x, this.patrolTarget.y - this.position.z);
      const d = toTarget.length();
      if (d < 0.3) {
        this.patrolTarget = this.patrolTarget === this.patrolA ? this.patrolB : this.patrolA;
      } else {
        toTarget.normalize();
        dirX = toTarget.x; dirZ = toTarget.y;
        this.position.x += dirX * this.speed * dt;
        this.position.z += dirZ * this.speed * dt;
      }
    }

    if (dirX !== 0 || dirZ !== 0) {
      this.mesh.rotation.y = Math.atan2(dirX, dirZ);
    }

    if (!player.dead) separateCircles(this.position, this.radius, player.position, player.radius);
    this.position.y = findGroundY(world, this.position.x, this.position.z, this.position.y);
    this.mesh.position.copy(this.position);
    const tail = this.mesh.userData.parts.tailPivot;
    if (tail) tail.rotation.y = Math.sin(performance.now() * 0.01) * 0.6;

    if (this.usingSilverpaw) {
      this.mixer.update(dt);
      const isMoving = dirX !== 0 || dirZ !== 0;
      if (!isMoving) this.animDriver.play('idle', 0.25);
      else this.animDriver.play(chasing ? 'run' : 'walk', 0.2);
    }

    // Contact damage to player. distToPlayer is x/z only, so also require
    // the two bodies be close on y — otherwise an enemy standing on a
    // ledge/rooftop could "hit" the player passing underneath on the ground.
    const closeOnY = Math.abs(player.position.y - this.position.y) < MELEE_VERTICAL_REACH;
    if (!player.dead && distToPlayer < this.attackRadius + player.radius && closeOnY && this.attackCooldown <= 0) {
      player.takeDamage(this.attackDamage, this.position);
      this.attackCooldown = this.attackCooldownMax;
    }

    // Being hit by the player's claw swipe.
    if (player.attackId !== this.lastHitAttackId && player.attackHits(this.position, this.radius)) {
      this.lastHitAttackId = player.attackId;
      this.takeHit(1, player.position);
      player.onLandedHit();
    }

    if (this.hitFlash > 0) {
      this.mesh.userData.parts.body.material.color.set(0x883333);
    } else {
      this.mesh.userData.parts.body.material.color.set(this.baseColor);
    }
  }

  // Shared by the regular claw swipe above and Player's AoE super attack.
  takeHit(amount, fromPos) {
    if (this.dead) return;
    this.hp -= amount;
    this.healthBar.redraw(Math.max(0, this.hp) / this.maxHp);
    this.hitFlash = 0.25;
    if (fromPos) {
      const knock = this.position.clone().sub(fromPos);
      knock.y = 0;
      if (knock.lengthSq() > 0.0001) {
        knock.normalize().multiplyScalar(2.2);
        this.position.add(knock);
      }
    }
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.mesh.visible = false;
    this.healthBar.sprite.visible = false;
  }
}
