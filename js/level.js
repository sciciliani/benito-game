// Generic level loader: turns a plain-data level config into Three.js meshes
// plus lightweight collision data the physics step can query cheaply.
//
// To add a new level: create js/levels/level-X.js that fills out the same
// shape as LEVEL_DEMO (see that file for the documented schema) and calls
// LEVEL_REGISTRY.push(LEVEL_X). Then add a <script> tag for it in index.html.
// To remove a level, delete its file/script tag. Nothing else needs to change.

const LEVEL_REGISTRY = [];

// Highest platform top under (x,z), used by simple ground-following AI
// (enemies/boss) that don't need the player's full collision resolution.
function findGroundY(world, x, z, fallback = 0) {
  let best = fallback;
  for (const p of world.platforms) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
      if (p.topY > best) best = p.topY;
    }
  }
  return best;
}

// Melee/contact range checks only compared x/z, so a cat standing on a
// ledge or rooftop could still "hit" someone directly below/above it even
// though they're nowhere near each other. Attacks additionally require the
// two bodies be within this much of each other on y.
const MELEE_VERTICAL_REACH = 1.6;

// Same idea for chase-aggro (see Enemy.update): enemies have no gravity, so
// letting one chase a player it can't actually reach vertically walks it
// off whatever ledge it's standing on and leaves it stranded in midair.
// Bigger than the melee reach since "can this enemy plausibly get to the
// player" (via stairs, a short drop, etc.) is a looser question than
// "are they close enough to swing at each other right now".
const AGGRO_VERTICAL_REACH = 4;

// Pushes two circular bodies (x/z only) apart along their center line so
// their radii stop overlapping — used to keep character models from
// visually melting into each other (Enemy/Boss have no other collision
// against the player; only against the level geometry via findGroundY).
function separateCircles(posA, radiusA, posB, radiusB) {
  const dx = posA.x - posB.x, dz = posA.z - posB.z;
  const minDist = radiusA + radiusB;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return;
  const dist = Math.sqrt(distSq);
  const nx = dist > 0.0001 ? dx / dist : 1;
  const nz = dist > 0.0001 ? dz / dist : 0;
  const overlap = (minDist - dist) / 2;
  posA.x += nx * overlap; posA.z += nz * overlap;
  posB.x -= nx * overlap; posB.z -= nz * overlap;
}

class LevelBuilder {
  constructor(scene) {
    this.scene = scene;
  }

  build(config) {
    const world = {
      config,
      platforms: [],   // { minX,maxX,minZ,maxZ, topY, climbable, bouncy, mesh }
      water: config.water || [],
      waterMaterials: [],
      collectibles: [],
      enemies: [],
      boss: null,
      spawn: config.spawn,
      hints: (config.hints || []).map((h) => ({ ...h, shown: false })),
      group: new THREE.Group(),
      goal: config.goal ?? { collectiblesRequired: 0 },
      // One or more gated barriers (see checkGate() in main.js). Each gate
      // can set its own `gateRequires` (collectibles) or `gateRequiresKills`
      // (rival cats defeated) threshold; if neither is set it falls back to
      // goal.collectiblesRequired.
      gates: [],
      // Rival cats defeated so far (regular claw hits or the super attack —
      // see enemy.js and Player.trySuper) — a gate can require this instead
      // of collectibles.
      catsDefeated: 0,
    };

    const skyTop = config.skyColor ?? 0x2f7fd6;
    const skyHorizon = config.skyHorizon ?? 0xbfe9ff;
    this.scene.background = new THREE.Color(skyHorizon);
    this.scene.fog = new THREE.Fog(skyHorizon, 70, 230);
    world.group.add(buildSkyDome(skyTop, skyHorizon));

    // Lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x446622, 0.9);
    world.group.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(40, 60, 20);
    world.group.add(sun);

    // Ground
    const groundSize = config.groundSize ?? 200;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const grassTex = makeGrassTexture(config.groundColor ?? 0x6ab150);
    grassTex.repeat.set(groundSize / 5, groundSize / 5);
    const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    world.group.add(ground);
    world.platforms.push({
      minX: -groundSize / 2, maxX: groundSize / 2,
      minZ: -groundSize / 2, maxZ: groundSize / 2,
      topY: 0, climbable: false, bouncy: false, isGround: true,
    });

    // Water zones (visual only; logic handled via world.water in physics)
    for (const w of world.water) {
      const geo = new THREE.PlaneGeometry(w.w, w.d);
      const waterTex = makeWaterTexture();
      waterTex.repeat.set(w.w / 3, w.d / 3);
      const mat = new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.88 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(w.x, 0.05, w.z);
      world.group.add(mesh);
      world.waterMaterials.push(mat);
    }

    // Shared materials for repeated decorative platform types, built lazily
    // (and once) so 20+ hedge segments don't each pay for their own canvas.
    let hedgeMat = null;
    const houseMats = { wall: null, roof: null };

    // Platforms
    for (const p of config.platforms ?? []) {
      const w = p.w, h = p.h, d = p.d;
      let mesh;
      if (p.hedge) {
        if (!hedgeMat) {
          const tex = makeGrassTexture(0x2f6b2f);
          tex.repeat.set(Math.max(1, w), Math.max(1, h));
          hedgeMat = new THREE.MeshLambertMaterial({ map: tex });
        }
        mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hedgeMat);
      } else if (p.house) {
        if (!houseMats.wall) {
          houseMats.wall = new THREE.MeshLambertMaterial({ color: 0xe4c9a0 });
          houseMats.roof = new THREE.MeshLambertMaterial({ color: 0xa1503a });
        }
        mesh = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), houseMats.wall);
        mesh.add(body);
        if (p.flatRoof) {
          // Climbable houses get a flat parapet ledge instead of a cone —
          // it needs to actually read as a place you can stand and fight,
          // not just a decorative peak. Collision-wise the box body above
          // is already the flat top the player lands on; this is a thin
          // purely-visual trim around its edge.
          const trim = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 0.06, d * 1.04), houseMats.roof);
          trim.position.y = h / 2 + (h * 0.06) / 2;
          mesh.add(trim);
        } else {
          const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, h * 0.6, 4), houseMats.roof);
          roof.rotation.y = Math.PI / 4;
          roof.position.y = h / 2 + (h * 0.6) / 2;
          mesh.add(roof);
        }
      } else if (p.bouncy) {
        // Cushion look: a squashed sphere reads as a puffy pillow far
        // better than a sharp-edged box does, plus a tufted seam ring.
        const color = p.color ?? 0xff77b8;
        mesh = new THREE.Group();
        const pillow = new THREE.Mesh(
          new THREE.SphereGeometry(1, 16, 10),
          new THREE.MeshLambertMaterial({ color })
        );
        pillow.scale.set(w / 2, h, d / 2);
        mesh.add(pillow);
        const seam = new THREE.Mesh(
          new THREE.TorusGeometry(Math.min(w, d) / 2 * 0.7, h * 0.22, 6, 20),
          new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.82) })
        );
        seam.rotation.x = Math.PI / 2;
        seam.position.y = h * 0.55;
        mesh.add(seam);
      } else if (p.gate) {
        // A steel door + a "forbidden" sign, so it reads as a clearly
        // different kind of barrier from the (brown, wood-toned) climbable
        // wall — a plain colored box was too easy to mix the two up. Gates
        // block either a corridor cap (wide in x, thin in z, approached
        // along z) or a gap in a column wall (wide in z, thin in x,
        // approached along x) — whichever of w/d is smaller is the
        // thin/approach-facing axis, and the ribs + sign orient to match.
        mesh = new THREE.Group();
        const wide = Math.max(w, d);
        const wideIsX = w >= d;
        const steelMat = new THREE.MeshLambertMaterial({ color: p.color ?? 0x848c96 });
        mesh.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steelMat));
        const ribMat = new THREE.MeshLambertMaterial({ color: 0x5c6570 });
        for (const frac of [-0.28, 0, 0.28]) {
          const ribW = wideIsX ? wide * 0.94 : w * 1.08;
          const ribD = wideIsX ? d * 1.08 : wide * 0.94;
          const rib = new THREE.Mesh(new THREE.BoxGeometry(ribW, h * 0.05, ribD), ribMat);
          rib.position.y = h * frac;
          mesh.add(rib);
        }
        const signMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2, side: THREE.DoubleSide });
        const backing = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), signMat);
        const redMat = new THREE.MeshBasicMaterial({ color: 0xdb2020, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.78, 24), redMat);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.2, 0.02), redMat);
        bar.rotation.z = Math.PI / 4;
        const sign = new THREE.Group();
        sign.add(backing, ring, bar);
        if (wideIsX) {
          sign.position.set(0, 0, d / 2 + 0.03);
        } else {
          sign.rotation.y = Math.PI / 2;
          sign.position.set(w / 2 + 0.03, 0, 0);
        }
        mesh.add(sign);
      } else {
        let color = p.color ?? 0x8a6d3b;
        if (p.climbable) color = 0x9c7a4a;
        mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
      }
      mesh.position.set(p.x, p.y, p.z);
      world.group.add(mesh);

      const entry = {
        minX: p.x - w / 2, maxX: p.x + w / 2,
        minZ: p.z - d / 2, maxZ: p.z + d / 2,
        topY: p.y + h / 2,
        bottomY: p.y - h / 2,
        climbable: !!p.climbable,
        bouncy: !!p.bouncy,
        mesh,
      };
      world.platforms.push(entry);
      // A gate: a solid wall that blocks the path until the player has
      // collected enough items or defeated enough cats (see checkGate() in
      // main.js), then despawns.
      if (p.gate) {
        world.gates.push({
          platform: entry,
          x: p.x, z: p.z,
          required: p.gateRequires ?? null,
          requiredKills: p.gateRequiresKills ?? null,
          opened: false,
          openMessage: p.gateOpenMessage ?? null,
          lockedMessage: p.gateLockedMessage ?? null,
        });
      }
    }

    // Solid meshes the follow camera should never render the far/back side
    // of (walls, hedges, houses...). The ground is excluded since it's
    // roughly level with the camera and would create false hits.
    world.cameraBlockers = world.platforms.filter((p) => p.mesh && !p.isGround).map((p) => p.mesh);

    // Collectibles
    for (const c of config.collectibles ?? []) {
      const item = new Collectible(c.type, c.x, c.y, c.z);
      world.group.add(item.mesh);
      world.collectibles.push(item);
    }

    // Enemies
    for (const e of config.enemies ?? []) {
      const enemy = new Enemy(e);
      world.group.add(enemy.mesh);
      world.enemies.push(enemy);
    }

    // Boss
    if (config.boss) {
      world.boss = new Boss(config.boss);
      world.group.add(world.boss.mesh);
      world.boss.parent = world.group;
    }

    // Destructibles (breakable props like the couch mini-game).
    world.destructibles = (config.destructibles ?? []).map((d) => {
      const obj = new Destructible(d);
      world.group.add(obj.mesh);
      return obj;
    });

    // Granny (kitchen heist mini-game NPC) — at most one per level.
    world.granny = config.granny ? new Granny(config.granny) : null;
    if (world.granny) world.group.add(world.granny.mesh);

    // Doors: bidirectional teleports (house entrances, etc). No solid
    // collision of their own — main.js's checkDoors() triggers on proximity
    // (+ a keypress, unless `auto`). Just a visible panel + knob so the
    // player can see where one is; `locked` ones need player.hasKey
    // (checked in main.js), and get a big padlock so that's obvious too.
    world.doors = (config.doors ?? []).map((d) => {
      const doorGroup = new THREE.Group();
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 2.2, 0.15),
        new THREE.MeshLambertMaterial({ color: d.color ?? (d.locked ? 0x5b4636 : 0x4a2f1c) })
      );
      doorGroup.add(panel);
      // Knob + (if locked) padlock are built twice, mirrored on both faces
      // of the panel — a single one-sided copy meant the door read as bare
      // wood from whichever side didn't happen to face it.
      const knobMat = new THREE.MeshLambertMaterial({ color: 0xdcb84a });
      for (const side of [1, -1]) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), knobMat);
        knob.position.set(0.45, -0.1, side * 0.13);
        doorGroup.add(knob);
      }
      if (d.locked) {
        const lockBodyMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
        const shackleMat = new THREE.MeshLambertMaterial({ color: 0xb0b0b8 });
        for (const side of [1, -1]) {
          const lockGroup = new THREE.Group();
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.12), lockBodyMat);
          lockGroup.add(body);
          const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 12, Math.PI), shackleMat);
          shackle.position.y = 0.15;
          lockGroup.add(shackle);
          lockGroup.position.set(0, 0.15, side * 0.14);
          doorGroup.add(lockGroup);
        }
      }
      doorGroup.position.set(d.x, d.y + 1, d.z);
      if (d.ry) doorGroup.rotation.y = d.ry;
      world.group.add(doorGroup);
      return {
        x: d.x, y: d.y, z: d.z, radius: d.radius ?? 1.2, to: d.to,
        locked: !!d.locked, auto: !!d.auto, enterMessage: d.enterMessage,
      };
    });

    this.scene.add(world.group);
    return world;
  }

  dispose(world) {
    this.scene.remove(world.group);
  }
}

// Node-only: lets tests/ `require()` the pure helpers above without a
// bundler or a DOM/Three.js scene. Never runs in the browser (see the same
// pattern/explanation in player.js).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findGroundY, separateCircles, MELEE_VERTICAL_REACH, AGGRO_VERTICAL_REACH };
}
