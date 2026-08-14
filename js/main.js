// Bootstraps Three.js, wires up the start/end screens, and runs the game
// loop: update player/enemies/boss/collectibles, resolve pickups, refresh
// the HUD, and drive the third-person chase camera.
(function () {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const builder = new LevelBuilder(scene);
  let world = null;
  let player = null;
  let cameraYaw = Math.PI; // start facing the same way the player faces
  let cameraPitch = 0.44; // radians above the horizontal
  const cameraRay = new THREE.Raycaster();

  const heartsEl = document.getElementById('hearts');
  const milkCountEl = document.getElementById('milkCount');
  const tunaCountEl = document.getElementById('tunaCount');
  const bossBarWrap = document.getElementById('bossBarWrap');
  const bossBarFill = document.getElementById('bossBarFill');
  const superBarFill = document.getElementById('superBarFill');
  const superBarWrap = document.getElementById('superBarWrap');
  const messageBanner = document.getElementById('messageBanner');
  const startScreen = document.getElementById('startScreen');
  const endScreen = document.getElementById('endScreen');
  const endTitle = document.getElementById('endTitle');
  const endStats = document.getElementById('endStats');

  let messageTimer = 0;
  function showMessage(text, seconds = 2.5) {
    messageBanner.textContent = text;
    messageBanner.classList.remove('hidden');
    messageTimer = seconds;
  }

  function refreshHud() {
    heartsEl.innerHTML = '';
    for (let i = 0; i < player.maxHearts; i++) {
      const span = document.createElement('span');
      span.textContent = i < player.hearts ? '❤️' : '🤍';
      heartsEl.appendChild(span);
    }
    milkCountEl.textContent = player.milk;
    tunaCountEl.textContent = player.tuna;

    const superPct = (player.superMeter / player.superMeterMax) * 100;
    superBarFill.style.width = `${superPct}%`;
    superBarWrap.classList.toggle('super-ready', player.superMeter >= player.superMeterMax);

    if (world.boss && !world.boss.dead && world.boss.awake) {
      bossBarWrap.classList.remove('hidden');
      bossBarFill.style.width = `${(world.boss.hp / world.boss.maxHp) * 100}%`;
    } else {
      bossBarWrap.classList.add('hidden');
    }
  }

  function startLevel(config) {
    if (world) builder.dispose(world);
    world = builder.build(config);
    player = new Player(config.spawn);
    world.group.add(player.mesh);
    cameraYaw = Math.PI;
    cameraPitch = 0.44;
    window.__player = player; // handy for console debugging
    window.__world = world;
    window.__camera = camera;
    window.__stepCamera = (dt) => updateCamera(dt, false); // handy for console/test debugging
    endScreen.classList.add('hidden');
    refreshHud();
    updateCamera(0, true);
  }

  const CAMERA_DIST = 7.5;
  const PITCH_MIN = 0.12, PITCH_MAX = 1.15;

  // Offset from the look target, orbiting on a sphere of radius CAMERA_DIST:
  // yaw spins around the player, pitch raises/lowers the camera (and pulls
  // it in closer horizontally as it rises, like a normal orbit camera).
  function desiredCameraOffset() {
    const horiz = CAMERA_DIST * Math.cos(cameraPitch);
    const height = CAMERA_DIST * Math.sin(cameraPitch);
    return new THREE.Vector3(Math.sin(cameraYaw) * horiz, height, Math.cos(cameraYaw) * horiz);
  }

  function updateCamera(dt, snap) {
    const rotSpeed = 2.0, pitchSpeed = 1.0;
    if (Input.down('KeyA')) cameraYaw += rotSpeed * dt;
    if (Input.down('KeyD')) cameraYaw -= rotSpeed * dt;
    if (Input.down('KeyW')) cameraPitch += pitchSpeed * dt;
    if (Input.down('KeyS')) cameraPitch -= pitchSpeed * dt;
    // Mobile finger-swipe look (see js/mobile.js) — accumulated drag,
    // consumed and reset here each frame. Always 0 on desktop.
    if (Input.lookDeltaX || Input.lookDeltaY) {
      cameraYaw -= Input.lookDeltaX;
      cameraPitch -= Input.lookDeltaY;
      Input.lookDeltaX = 0;
      Input.lookDeltaY = 0;
    }
    cameraPitch = THREE.MathUtils.clamp(cameraPitch, PITCH_MIN, PITCH_MAX);

    const target = player.position.clone();
    target.y += 1.1;
    const offset = desiredCameraOffset();
    const fullDist = offset.length();
    const dir = offset.clone().normalize();

    // Don't let the camera end up behind a wall/hedge: if something solid
    // sits between the player and the ideal camera spot, pull the camera
    // in front of it instead of rendering its back face (which just looks
    // like the screen going blank/wrong).
    let dist = fullDist;
    if (world.cameraBlockers && world.cameraBlockers.length) {
      cameraRay.set(target, dir);
      cameraRay.near = 0.05;
      cameraRay.far = fullDist;
      const hits = cameraRay.intersectObjects(world.cameraBlockers, false);
      if (hits.length > 0) dist = Math.max(1.2, hits[0].distance - 0.3);
    }

    const desired = target.clone().addScaledVector(dir, dist);
    if (snap) camera.position.copy(desired);
    else camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    camera.lookAt(target);
  }

  function checkHints() {
    for (const hint of world.hints) {
      if (hint.shown) continue;
      const dx = player.position.x - hint.x, dz = player.position.z - hint.z;
      if (dx * dx + dz * dz < hint.radius * hint.radius) {
        hint.shown = true;
        showMessage(hint.text, 4.5);
        break;
      }
    }
  }

  function animateWater(dt) {
    for (const mat of world.waterMaterials) {
      mat.map.offset.x += dt * 0.04;
      mat.map.offset.y += dt * 0.02;
    }
  }

  function checkPickups() {
    for (const item of world.collectibles) {
      if (item.collected) continue;
      const dist = item.mesh.position.distanceTo(player.position);
      if (dist < 0.9) {
        item.collected = true;
        item.mesh.visible = false;
        if (item.type === 'milk') player.addMilk(); // heals
        else if (item.type === 'tuna') player.addTuna(); // grows max hearts every 3
        else if (item.type === 'key') {
          player.hasKey = true;
          showMessage('Encontraste una llave!', 2.5);
        } else if (item.type === 'fish') {
          // Not banked yet — Granny notices instantly and starts chasing
          // (checkGranny()); only pays off if he makes it out a door with
          // it still on him (checkDoors()).
          player.hasStolenFish = true;
          showMessage('Agarraste el pescado! Corre!', 2.5);
        }
        SFX.playPickup();
      }
    }
  }

  let doorCooldown = 0;
  function checkDoors(dt) {
    doorCooldown = Math.max(0, doorCooldown - dt);

    // Locked-door reminder: shown once per approach (not spammed every
    // frame while standing there), independent of pressing F, and only
    // while the player doesn't have the key yet — makes clear why nothing
    // happens instead of leaving it to a message that only fires on a
    // failed F-press.
    for (const door of world.doors) {
      if (!door.locked || player.hasKey) { door._hintShown = false; continue; }
      const dx = player.position.x - door.x, dz = player.position.z - door.z;
      const nearHint = dx * dx + dz * dz < (door.radius + 1.5) * (door.radius + 1.5);
      if (nearHint && !door._hintShown) {
        door._hintShown = true;
        showMessage('Necesito una llave.', 2.5);
      } else if (!nearHint) {
        door._hintShown = false;
      }
    }

    if (doorCooldown > 0) return;
    for (const door of world.doors) {
      const dx = player.position.x - door.x, dz = player.position.z - door.z;
      const inRange = dx * dx + dz * dz < door.radius * door.radius;
      // `auto` doors (the return trip out of a house) trigger on proximity
      // alone — only entrances (from outside in) need a deliberate F, so
      // walking into a room doesn't accidentally teleport you back out.
      if (inRange && (door.auto || Input.pressed('KeyF'))) {
        if (door.locked && !player.hasKey) continue; // the reminder above already covers this
        player.position.set(door.to.x, door.to.y, door.to.z);
        player.velocity.set(0, 0, 0);
        player.lastSafe.copy(player.position);
        doorCooldown = 0.6; // don't immediately re-trigger a door at the destination
        SFX.playPickup();
        if (door.enterMessage) showMessage(door.enterMessage, 3.5);
        if (player.hasStolenFish) {
          player.hasStolenFish = false;
          player.addTuna(); player.addTuna();
          player.addMilk();
          showMessage('Escapaste con el pescado! +2 latas, +1 leche.', 3);
        }
        return;
      }
    }
  }

  // Kitchen heist: Granny wanders a patrol route until the fish is stolen,
  // at which point she instantly notices (no detection radius/suspicion —
  // she just knows), screams, and directly chases the player. Catching him
  // costs the fish (which respawns on its table for another attempt) and a
  // heart, and sweeps him back outside; reaching any door with the fish
  // still on him banks the reward (see checkDoors()) and calms her down.
  function checkGranny(dt) {
    if (!world.granny) return;
    world.granny.update(dt, player);

    if (player.hasStolenFish && !world.granny.angry) {
      world.granny.enrage();
      showMessage('"MI PESCADO! LA ABUELA ESTA FURIOSA!" — CORRE hacia una puerta!', 3);
    }
    if (!player.hasStolenFish && world.granny.angry) {
      world.granny.calm(); // he escaped through a door or already got caught
    }

    // catchImmuneTimer: a short grace period right after enrage() (and after
    // every graze, see below) so being already close to her when you grab
    // the fish — or getting swatted once — doesn't chain into more hits
    // before you can even react.
    if (world.granny.angry && world.granny.catchImmuneTimer <= 0) {
      const dx = player.position.x - world.granny.position.x, dz = player.position.z - world.granny.position.z;
      const closeOnY = Math.abs(player.position.y - world.granny.position.y) < MELEE_VERTICAL_REACH;
      if (dx * dx + dz * dz < world.granny.catchRadius * world.granny.catchRadius && closeOnY) {
        world.granny.catchHits++;
        world.granny.catchImmuneTimer = 1.0;
        if (world.granny.catchHits >= world.granny.catchHitsToEject) {
          // The real catch: loses the fish, costs a heart, gets swept
          // outside — only once she's landed several hits, not one.
          player.hasStolenFish = false;
          world.granny.calm();
          player.takeDamage(1, world.granny.position);
          const fish = world.collectibles.find((c) => c.type === 'fish');
          if (fish) { fish.collected = false; fish.mesh.visible = true; } // back on the table for next time
          if (world.granny.exitTo) player.position.set(world.granny.exitTo.x, world.granny.exitTo.y, world.granny.exitTo.z);
          player.velocity.set(0, 0, 0);
          doorCooldown = 0.6;
          showMessage('Te atrapo y te golpeo con la escoba! Perdiste el pescado.', 3.5);
        } else {
          // A graze: knockback only, no heart lost — keeps the chase (and
          // the tension) going instead of ending the whole attempt.
          const push = new THREE.Vector3(dx, 0, dz);
          if (push.lengthSq() < 0.0001) push.set(0, 0, 1);
          push.normalize().multiplyScalar(5);
          player.velocity.x = push.x;
          player.velocity.z = push.z;
          player.velocity.y = 4;
          player.grounded = false;
          SFX.playHiss();
          showMessage(`Te rozo con la escoba! (${world.granny.catchHits}/${world.granny.catchHitsToEject})`, 1.8);
        }
      }
    }
  }

  function checkGate() {
    for (const gate of world.gates) {
      if (gate.opened) continue;
      const required = gate.required ?? (world.goal?.collectiblesRequired ?? 0);
      if (player.milk + player.tuna < required) continue;
      gate.opened = true;
      const idx = world.platforms.indexOf(gate.platform);
      if (idx !== -1) world.platforms.splice(idx, 1);
      const blockerIdx = world.cameraBlockers.indexOf(gate.platform.mesh);
      if (blockerIdx !== -1) world.cameraBlockers.splice(blockerIdx, 1);
      world.group.remove(gate.platform.mesh);
      SFX.playPickup();
      showMessage(gate.openMessage ?? 'El porton se abrio!', 4);
    }
  }

  function checkEndConditions(dt) {
    if (player.dead) {
      endTitle.textContent = 'Benito quedo agotado...';
      endStats.textContent = `Cartones de leche: ${player.milk} — Latas de atun: ${player.tuna}`;
      endScreen.classList.remove('hidden');
      return true;
    }
    if (world.boss && world.boss.dead) {
      endTitle.textContent = 'Nivel completado!';
      endStats.textContent = `Venciste al Gato Grande con ${player.milk} cartones de leche y ${player.tuna} latas de atun.`;
      endScreen.classList.remove('hidden');
      return true;
    }
    return false;
  }

  let running = false;
  let lastTime = performance.now();
  let clockT = 0;

  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = Math.min(dt, 0.05);
    clockT += dt;

    if (!running) return;

    player.update(dt, world, cameraYaw);
    for (const enemy of world.enemies) enemy.update(dt, world, player);
    if (world.boss) world.boss.update(dt, world, player);
    for (const item of world.collectibles) item.update(dt, clockT);
    for (const d of world.destructibles) d.update(dt, player, world);
    checkPickups();
    checkGate();
    checkDoors(dt);
    checkGranny(dt);
    checkHints();
    animateWater(dt);
    updateCamera(dt);
    refreshHud();

    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) messageBanner.classList.add('hidden');
    }

    if (checkEndConditions(dt)) {
      running = false;
    }

    Input.clearFrame();
    renderer.render(scene, camera);
  }

  const startBtn = document.getElementById('startBtn');

  startBtn.addEventListener('click', () => {
    SFX.unlock();
    startScreen.classList.add('hidden');
    startLevel(LEVEL_REGISTRY[0]);
    showMessage('Junta leche y atun, esquiva a los gatos negros!', 4);
    running = true;
  });

  document.getElementById('restartBtn').addEventListener('click', () => {
    SFX.unlock();
    startLevel(LEVEL_REGISTRY[0]);
    showMessage('Otra vez! Junta leche y atun.', 3);
    running = true;
  });

  // The Silverpaw model has to finish loading before a Player/Enemy can be
  // built from it, so the start button stays disabled until it's ready.
  // window.__SILVERPAW_FBX_B64 / __SILVERPAW_TEX_B64 are only present in the
  // self-contained Artifact build, where the model is embedded as base64.
  // The FBX itself is passed through as raw base64 so silverpaw.js can
  // parse it straight from memory (no fetch — that gets blocked by the
  // Artifact page's CSP). The texture still goes through a blob: URL since
  // texture loading is Image-based (img-src), not fetch-based, and isn't
  // affected by that restriction.
  let texUrl;
  if (window.__SILVERPAW_TEX_B64) {
    texUrl = Silverpaw.base64ToBlobUrl(window.__SILVERPAW_TEX_B64, 'image/png');
  }
  // Props (milk carton, tuna can) load independently of Silverpaw — each
  // Collectible checks Props.isReady(type) for itself, so one pack failing
  // doesn't block the other's model or Silverpaw's from being used.
  Promise.allSettled([
    Silverpaw.load(undefined, texUrl, window.__SILVERPAW_FBX_B64),
    Props.loadAll(),
  ]).then((results) => {
    startBtn.disabled = false;
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) {
      // Deliberately NOT a silent fallback: if anything fails, the button
      // says so, with the real error, instead of quietly looking identical
      // to success while actually falling back to procedural models.
      console.warn('Some 3D model(s) failed to load, using procedural fallbacks instead:', results);
      startBtn.textContent = `Jugar (sin modelos 3D: ${String(failed.reason.message || failed.reason).slice(0, 60)})`;
    } else {
      startBtn.textContent = 'Empezar a jugar';
    }
  });

  requestAnimationFrame(loop);
})();
