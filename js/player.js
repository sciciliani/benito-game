// He's a big boy. Bumped up again per request — wider and taller than the
// shared Silverpaw rig other cats use.
const FAT_SCALE = { x: 1.7, y: 1.3, z: 1.6 };

// Benito, the player character. Owns movement/physics, climbing, jumping,
// the claw attack, health, and respawn-on-drowning logic. Camera control
// lives in main.js so it can also see the Three.js camera object.
class Player {
  constructor(spawn) {
    if (typeof Silverpaw !== 'undefined' && Silverpaw.isReady()) {
      const inst = Silverpaw.instantiate();
      this.mesh = inst.group;
      this.mixer = inst.mixer;
      this.actions = inst.actions;
      this.animDriver = Silverpaw.createAnimDriver(inst.actions);
      this.mesh.userData.parts = { body: { material: inst.material } };
      this.usingSilverpaw = true;
      this._wasGrounded = true;
      // Benito is a chonky boy: fatten him up relative to the shared
      // Silverpaw model. Enemy.js calls Silverpaw.instantiate() separately
      // for each rival cat, so this scale is local to Benito's own clone and
      // doesn't touch their geometry.
      this.mesh.scale.set(FAT_SCALE.x, FAT_SCALE.y, FAT_SCALE.z);
    } else {
      this.mesh = buildCatMesh({ furColor: 0xffffff, earColor: 0xffb6c1, pawColor: 0xffe1ea, eyeColor: 0x6fae4a });
      this.usingSilverpaw = false;
    }
    // Matches the fattened mesh scale above so the collision boundary
    // actually contains the visible body instead of the old (pre-fattening)
    // silhouette — otherwise the model pokes into whatever he's pressed
    // against. The extra +0.15 over the torso-width-derived radius accounts
    // for the head/nose sticking out further forward than the shoulders do.
    this.radius = 0.4 * ((FAT_SCALE.x + FAT_SCALE.z) / 2) + 0.15;
    this.height = 1.1 * FAT_SCALE.y;
    this.swipeEffect = buildSwipeEffect();
    this.mesh.add(this.swipeEffect.group);
    this.superEffect = buildSuperEffect();
    this.mesh.add(this.superEffect.group);
    this.hitFlashTimer = 0;

    this.position = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.velocity = new THREE.Vector3();
    this.grounded = false;
    this.onClimbable = false;
    this.facing = 0; // radians, yaw

    this.maxHearts = 5;
    this.hearts = this.maxHearts;
    this.invulnTimer = 0;

    this.attackCooldown = 0;
    this.attackActiveTimer = 0;
    this.attackId = 0;
    this.attackRange = 1.35;
    this.attackArc = Math.PI / 2.2; // total cone width

    this.lastSafe = this.position.clone();
    this.safeTimer = 0;

    this.speed = 6.5;
    this.runSpeed = 10.5;
    this.jumpVelocity = 8.6;
    this.gravity = -22;
    this.climbSpeed = 3.2;

    this.milk = 0;
    this.tuna = 0;
    this.hasKey = false;
    this.hasStolenFish = false;

    this.superMeter = 0;
    this.superMeterMax = 5;
    this.superRadius = 5.5;
    this.superFlashTimer = 0;

    this.dead = false;
  }

  get isAttacking() {
    return this.attackActiveTimer > 0;
  }

  takeDamage(amount, fromPos) {
    if (this.invulnTimer > 0 || this.dead) return;
    this.hearts -= amount;
    this.invulnTimer = 1.1;
    this.hitFlashTimer = 1.1;
    if (fromPos) {
      const push = this.position.clone().sub(fromPos);
      push.y = 0;
      if (push.lengthSq() < 0.0001) push.set(0, 0, 1);
      push.normalize().multiplyScalar(6);
      this.velocity.x = push.x;
      this.velocity.z = push.z;
      this.velocity.y = 5;
      this.grounded = false;
    }
    if (this.hearts <= 0) {
      this.hearts = 0;
      this.dead = true;
    }
  }

  respawnAtCheckpoint() {
    this.position.copy(this.lastSafe);
    this.velocity.set(0, 0, 0);
    this.invulnTimer = 0.8;
  }

  heal(amount) {
    this.hearts = Math.min(this.maxHearts, this.hearts + amount);
  }

  addMilk() {
    this.milk++;
    this.heal(1);
    this.superMeter = Math.min(this.superMeterMax, this.superMeter + 0.5);
  }

  // Every 3 tuna grows the heart cap by one (and hands over that heart
  // already full, not just a bigger empty ceiling).
  addTuna() {
    this.tuna++;
    const newMax = 5 + Math.floor(this.tuna / 3);
    if (newMax > this.maxHearts) {
      this.maxHearts = newMax;
      this.hearts++;
    }
    this.superMeter = Math.min(this.superMeterMax, this.superMeter + 0.5);
  }

  onLandedHit() {
    this.superMeter = Math.min(this.superMeterMax, this.superMeter + 1);
  }

  // "Super Zarpazo": once the meter is full, S unleashes an explosion of
  // claws + dust around Benito, hitting every enemy/boss in range hard all
  // at once instead of one swipe at a time.
  trySuper(world) {
    if (this.superMeter < this.superMeterMax) return;
    this.superMeter = 0;
    this.superFlashTimer = SUPER_EFFECT_DURATION;
    this.invulnTimer = Math.max(this.invulnTimer, 0.6);
    SFX.playSuperRoar();
    for (const enemy of world.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.position.x - this.position.x, dz = enemy.position.z - this.position.z;
      const closeOnY = Math.abs(enemy.position.y - this.position.y) < MELEE_VERTICAL_REACH + 1;
      if (dx * dx + dz * dz < this.superRadius * this.superRadius && closeOnY) {
        enemy.takeHit(4, this.position); // significantly damaged — kills most regular enemies outright
      }
    }
    if (world.boss && !world.boss.dead) {
      const b = world.boss;
      const dx = b.position.x - this.position.x, dz = b.position.z - this.position.z;
      if (dx * dx + dz * dz < this.superRadius * this.superRadius) b.takeHit(2, this.position);
    }
  }

  tryAttack() {
    if (this.attackCooldown > 0) return;
    this.attackCooldown = 0.45;
    this.attackActiveTimer = 0.18;
    this.attackDuration = 0.18;
    this.attackId++;
    SFX.playAttack();
    SFX.playHiss();
  }

  // Returns true if this swing (identified by attackId) hits a target at
  // targetPos within targetRadius. Callers should pass the same attackId
  // once per target per swing to avoid double-hits.
  attackHits(targetPos, targetRadius) {
    if (!this.isAttacking) return false;
    const toTarget = targetPos.clone().sub(this.position);
    // A target on a ledge/rooftop above or below isn't actually in swipe
    // range even if its x/z happens to line up with Benito's.
    if (Math.abs(toTarget.y) > MELEE_VERTICAL_REACH) return false;
    toTarget.y = 0;
    const dist = toTarget.length();
    if (dist > this.attackRange + targetRadius) return false;
    if (dist < 0.001) return true;
    toTarget.normalize();
    const facingVec = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const angle = facingVec.angleTo(toTarget);
    return angle < this.attackArc / 2;
  }

  // progress in [0,1] drives the swing (paw punches out then returns, mouth
  // opens into a hiss, eyes narrow); progress < 0 relaxes back to neutral.
  _animateAttackFace(progress) {
    const parts = this.mesh.userData.parts;
    if (!parts.frontLegPivotR) return; // Silverpaw model: its own clips cover motion, no separate paw pivot
    if (progress < 0) {
      parts.frontLegPivotR.rotation.x = THREE.MathUtils.lerp(parts.frontLegPivotR.rotation.x, 0, 0.35);
      parts.mouth.scale.y = THREE.MathUtils.lerp(parts.mouth.scale.y, 0.22, 0.35);
      parts.eyeL.scale.y = THREE.MathUtils.lerp(parts.eyeL.scale.y, 1, 0.35);
      parts.eyeR.scale.y = THREE.MathUtils.lerp(parts.eyeR.scale.y, 1, 0.35);
      return;
    }
    const swing = Math.sin(Math.min(progress, 1) * Math.PI); // 0 -> 1 -> 0
    parts.frontLegPivotR.rotation.x = -swing * 1.3;
    parts.mouth.scale.y = 0.22 + swing * 1.7;
    parts.eyeL.scale.y = 1 - swing * 0.6;
    parts.eyeR.scale.y = 1 - swing * 0.6;
  }

  update(dt, world, cameraYaw) {
    if (this.dead) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackActiveTimer = Math.max(0, this.attackActiveTimer - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    const attackProgress = this.isAttacking ? 1 - this.attackActiveTimer / this.attackDuration : -1;
    this.swipeEffect.update(attackProgress);
    this._animateAttackFace(attackProgress);

    this.superFlashTimer = Math.max(0, this.superFlashTimer - dt);
    const superProgress = this.superFlashTimer > 0 ? 1 - this.superFlashTimer / SUPER_EFFECT_DURATION : -1;
    this.superEffect.update(superProgress);
    const body = this.mesh.userData.parts.body;
    if (this.superFlashTimer > 0) {
      body.material.color.set(0xfff2a0);
    } else if (this.hitFlashTimer > 0 && Math.floor(this.hitFlashTimer * 12) % 2 === 0) {
      body.material.color.set(0xff9a9a);
    } else {
      body.material.color.set(0xffffff);
    }

    if (Input.pressed('Space')) this.tryAttack();
    if (Input.pressed('KeyS')) this.trySuper(world);

    // Movement input relative to camera yaw.
    let ix = 0, iz = 0;
    if (Input.down('ArrowUp')) iz -= 1;
    if (Input.down('ArrowDown')) iz += 1;
    if (Input.down('ArrowLeft')) ix -= 1;
    if (Input.down('ArrowRight')) ix += 1;

    const moving = ix !== 0 || iz !== 0;
    const wantsRun = Input.down('ShiftLeft') || Input.down('ShiftRight');
    let moveX = 0, moveZ = 0;
    if (moving) {
      const len = Math.hypot(ix, iz);
      ix /= len; iz /= len;
      const cos = Math.cos(cameraYaw), sin = Math.sin(cameraYaw);
      // Forward (iz=-1) should move away from camera along its facing dir,
      // and right (ix=1) along the camera's actual right vector (cos(yaw),
      // 0, -sin(yaw)) — the previous signs here matched only at the default
      // cameraYaw = PI (where sin(yaw) is 0), so turning the camera away
      // from that made left/right (and forward/back) come out backwards.
      moveX = ix * cos + iz * sin;
      moveZ = -ix * sin + iz * cos;
      this.facing = Math.atan2(moveX, moveZ);
    }

    // Climbing check happens before normal horizontal collision so we can
    // switch physics modes cleanly. Climbing requires a dedicated key (E)
    // so walls otherwise behave like solid obstacles you walk into.
    const climbWall = this._checkClimbable(world);
    this.onClimbable = !!climbWall;
    const climbing = this.onClimbable && Input.down('KeyE');

    if (climbing) {
      this.velocity.y = this.climbSpeed;
      this.velocity.x = 0;
      this.velocity.z = 0;
      if (moving) {
        this.position.x += moveX * dt * (this.speed * 0.4);
        this.position.z += moveZ * dt * (this.speed * 0.4);
      }
      // Auto-mantle near the top: relying on gravity to arc him onto
      // whatever ledge sits above the wall (like the lookout tower's
      // rooftop) is timing-fragile — if the ledge is wider than the wall
      // (a "T" shape), _resolveHorizontalCollision can nudge him sideways
      // out from under it before the vertical snap ever catches him,
      // and he just falls. Snapping directly onto the ledge once he's
      // near the wall's top is deterministic instead.
      if (this.position.y > climbWall.topY - 0.3) {
        const landing = this._findLedgeAbove(world, climbWall.topY);
        if (landing) {
          this.position.y = landing.topY;
          this.velocity.y = 0;
          this.grounded = true;
        }
      }
    } else {
      this.velocity.y += this.gravity * dt;
      const currentSpeed = wantsRun ? this.runSpeed : this.speed;
      const targetVX = moveX * currentSpeed;
      const targetVZ = moveZ * currentSpeed;
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVX, moving ? 0.35 : 0.2);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVZ, moving ? 0.35 : 0.2);

      if (this.grounded && (Input.pressed('ControlLeft') || Input.pressed('ControlRight'))) this._jump();
    }

    // Integrate + collide.
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this._resolveHorizontalCollision(world);

    this.position.y += this.velocity.y * dt;
    this.grounded = false;
    this._resolveVerticalCollision(world);

    // Drowning check: below water level with nothing solid underfoot.
    if (!this.grounded && this.position.y < 0.15 && this._inWaterZone(world)) {
      this.respawnAtCheckpoint();
    }
    if (this.position.y < -15) {
      this.respawnAtCheckpoint();
    }

    if (this.grounded && !this._inWaterZone(world)) {
      this.safeTimer -= dt;
      if (this.safeTimer <= 0) {
        this.lastSafe.copy(this.position);
        this.lastSafe.y += 0.05;
        this.safeTimer = 0.4;
      }
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.facing;
    // The Silverpaw rig has no climbing clip, so as a stand-in we pitch the
    // whole model 90° to read as scrambling up the wall face-first, instead
    // of playing the horizontal walk cycle while sliding straight up (which
    // looks like it's running halfway inside the wall).
    const climbPitch = climbing ? -Math.PI / 2 : 0;
    this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, climbPitch, 0.25);

    const tail = this.mesh.userData.parts.tailPivot;
    if (tail) tail.rotation.y = Math.sin(performance.now() * 0.006) * 0.5;

    if (this.usingSilverpaw) {
      this.mixer.update(dt);
      if (climbing) {
        this.animDriver.play('walk', 0.15);
      } else if (!this.grounded) {
        if (this._wasGrounded) this.animDriver.play('jumpStart', 0.08);
        else if (!this.actions.jumpStart.isRunning()) this.animDriver.play('jumpLoop', 0.2);
      } else {
        if (!this._wasGrounded) this.animDriver.play('jumpEnd', 0.1);
        else if (!this.actions.jumpEnd.isRunning()) {
          this.animDriver.play(!moving ? 'idle' : wantsRun ? 'run' : 'walk', 0.2);
        }
      }
      this._wasGrounded = this.grounded;
    }
  }

  _jump() {
    this.velocity.y = this.jumpVelocity;
    this.grounded = false;
    SFX.playJump();
  }

  _inWaterZone(world) {
    for (const w of world.water) {
      if (Math.abs(this.position.x - w.x) < w.w / 2 && Math.abs(this.position.z - w.z) < w.d / 2) {
        return true;
      }
    }
    return false;
  }

  _checkClimbable(world) {
    // Must exceed the resting distance _resolveHorizontalCollision leaves
    // him at when pressed against a wall (this.radius) — otherwise he can
    // never actually get close enough to register as "near" a climbable
    // wall (this broke when the collision radius grew to cover his head).
    const margin = this.radius + 0.3;
    for (const p of world.platforms) {
      if (!p.climbable) continue;
      const nearX = this.position.x > p.minX - margin && this.position.x < p.maxX + margin;
      const nearZ = this.position.z > p.minZ - margin && this.position.z < p.maxZ + margin;
      const withinHeight = this.position.y > p.bottomY - 0.2 && this.position.y < p.topY + 0.2;
      if (nearX && nearZ && withinHeight) return p;
    }
    return null;
  }

  // A landable (non-climbable) platform roughly flush with the top of the
  // wall being climbed, overlapping his x/z — used to auto-mantle onto it.
  _findLedgeAbove(world, wallTopY) {
    for (const p of world.platforms) {
      if (p.climbable || p.isGround) continue;
      if (p.topY < wallTopY - 0.1 || p.topY > wallTopY + 1.5) continue;
      const overlapX = this.position.x > p.minX - this.radius && this.position.x < p.maxX + this.radius;
      const overlapZ = this.position.z > p.minZ - this.radius && this.position.z < p.maxZ + this.radius;
      if (overlapX && overlapZ) return p;
    }
    return null;
  }

  _resolveHorizontalCollision(world) {
    for (const p of world.platforms) {
      if (p.isGround) continue;
      const withinY = this.position.y + this.height * 0.6 > p.bottomY && this.position.y < p.topY - 0.05;
      if (!withinY) continue;
      const closestX = THREE.MathUtils.clamp(this.position.x, p.minX, p.maxX);
      const closestZ = THREE.MathUtils.clamp(this.position.z, p.minZ, p.maxZ);
      const dx = this.position.x - closestX;
      const dz = this.position.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < this.radius * this.radius && distSq > 0.000001) {
        const dist = Math.sqrt(distSq);
        const overlap = this.radius - dist;
        this.position.x += (dx / dist) * overlap;
        this.position.z += (dz / dist) * overlap;
      }
    }
  }

  _resolveVerticalCollision(world) {
    let bestTop = -Infinity;
    let landedPlatform = null;
    const inWater = this._inWaterZone(world);
    for (const p of world.platforms) {
      if (p.isGround && inWater) continue; // no dry ground under a water zone
      const overlapX = this.position.x > p.minX - this.radius && this.position.x < p.maxX + this.radius;
      const overlapZ = this.position.z > p.minZ - this.radius && this.position.z < p.maxZ + this.radius;
      if (!overlapX || !overlapZ) continue;
      if (this.velocity.y > 0) continue; // moving up, don't snap onto ceilings
      if (this.position.y >= p.topY - 0.35 && this.position.y <= p.topY + 0.6 && p.topY > bestTop) {
        bestTop = p.topY;
        landedPlatform = p;
      }
    }
    if (landedPlatform) {
      this.position.y = landedPlatform.topY;
      if (landedPlatform.bouncy) {
        this.velocity.y = 13;
        const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
        this.velocity.x += fx * 4;
        this.velocity.z += fz * 4;
        this.grounded = false;
      } else {
        this.velocity.y = 0;
        this.grounded = true;
      }
    }
  }
}

// Three tapered claw-mark streaks fanned out in front of the character,
// local-space so they automatically follow the player's facing rotation.
// update(progress) with progress in [0,1] drives the swing animation;
// progress < 0 hides the effect entirely.
function buildSwipeEffect() {
  const group = new THREE.Group();
  group.visible = false;
  const claws = [];
  const offsets = [-0.24, 0, 0.24];
  for (const off of offsets) {
    const geo = new THREE.PlaneGeometry(0.07, 0.6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff6f0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(off, 1.0, 0.9);
    mesh.rotation.z = Math.PI / 5;
    mesh.rotation.y = -0.35;
    group.add(mesh);
    claws.push(mesh);
  }
  return {
    group,
    update(progress) {
      if (progress < 0) {
        group.visible = false;
        return;
      }
      group.visible = true;
      const fade = Math.sin(Math.min(progress, 1) * Math.PI);
      for (const claw of claws) {
        claw.material.opacity = fade * 0.95;
        claw.scale.set(1, 0.55 + progress * 0.85, 1);
      }
    },
  };
}

const SUPER_EFFECT_DURATION = 0.55;

// The "Super Zarpazo" explosion: a full ring of claw-mark streaks radiating
// outward around Benito (unlike the single-direction swipeEffect above) plus
// a burst of dust puffs, both driven by update(progress) in [0,1].
function buildSuperEffect() {
  const group = new THREE.Group();
  group.visible = false;

  const claws = [];
  const CLAW_COUNT = 8;
  for (let i = 0; i < CLAW_COUNT; i++) {
    const angle = (i / CLAW_COUNT) * Math.PI * 2;
    const geo = new THREE.PlaneGeometry(0.09, 0.75);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff6f0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(Math.sin(angle) * 0.85, 1.0, Math.cos(angle) * 0.85);
    mesh.rotation.y = angle;
    mesh.rotation.x = Math.PI / 2.4;
    group.add(mesh);
    claws.push(mesh);
  }

  const puffs = [];
  const PUFF_COUNT = 10;
  const dustColor = new THREE.Color(0xcdbfa0);
  for (let i = 0; i < PUFF_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: dustColor, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), mat);
    const a = (i / PUFF_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const r = 0.3 + Math.random() * 0.8;
    mesh.userData.baseX = Math.cos(a) * r;
    mesh.userData.baseZ = Math.sin(a) * r;
    mesh.userData.baseY = 0.15 + Math.random() * 0.5;
    mesh.position.set(mesh.userData.baseX, mesh.userData.baseY, mesh.userData.baseZ);
    group.add(mesh);
    puffs.push(mesh);
  }

  return {
    group,
    update(progress) {
      if (progress < 0) {
        group.visible = false;
        return;
      }
      group.visible = true;
      const p = Math.min(progress, 1);
      // Claws snap out fast, then fade — the "impact" beat.
      const clawFade = Math.sin(Math.min(p * 2.2, 1) * Math.PI);
      for (const claw of claws) {
        claw.material.opacity = clawFade * 0.95;
        claw.scale.set(1, 0.5 + p * 1.6, 1);
      }
      // Dust drifts outward and up while fading out over the full duration.
      for (const puff of puffs) {
        puff.material.opacity = (1 - p) * 0.5;
        const spread = 1 + p * 1.8;
        puff.position.x = puff.userData.baseX * spread;
        puff.position.z = puff.userData.baseZ * spread;
        puff.position.y = puff.userData.baseY + p * 0.6;
        puff.scale.setScalar(0.7 + p * 1.6);
      }
    },
  };
}
