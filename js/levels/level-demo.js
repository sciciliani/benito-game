// Example level demonstrating every mechanic the prototype supports:
// open-world traversal, an enemy gauntlet, a water crossing you cross by
// bouncing between pads, a climbable wall, and a boss arena at the end.
//
// LEVEL CONFIG SCHEMA (plain data — no Three.js objects in here):
//   id, name           : identifiers shown in level select / debug
//   spawn              : {x,y,z} where Benito starts
//   skyColor, skyHorizon: hex, sky gradient (zenith / horizon)
//   groundColor        : hex, base terrain color (grass texture is tinted from this)
//   groundSize         : side length of the square ground plane
//   platforms[]        : {x,y,z, w,h,d, color?, climbable?, bouncy?, hedge?, house?}
//                         box colliders. climbable = player can climb it by
//                         holding E while touching it. bouncy = landing on
//                         top launches the player forward/up. hedge/house are
//                         purely cosmetic tags LevelBuilder uses to pick a
//                         different look (still solid, non-climbable boxes).
//   water[]            : {x,z,w,d} rectangular zones at y=0. Falling in
//                         (i.e. not standing on a platform inside the zone)
//                         respawns the player at their last checkpoint.
//   collectibles[]     : {type:'milk'|'tuna', x,y,z}
//   enemies[]          : {x,y,z, patrolA:{x,z}, patrolB:{x,z}, hp?, speed?,
//                         chaseSpeed?, aggroRadius?, attackRadius?, attackDamage?}
//   boss               : {x,y,z, hp?, arenaRadius?, awakeRadius?, speed?,
//                         fireInterval?, windupDuration?, projectileSpeed?,
//                         projectileDamage?} | null
//   hints[]            : {x,z,radius,text} on-screen tip shown once when the
//                         player first gets within radius of (x,z).
//
// To add a level: copy this object's shape into js/levels/level-X.js, end
// with LEVEL_REGISTRY.push(LEVEL_X), and add a <script> tag in index.html.
// To remove one: delete the file and its script tag.

(function () {
  // The playable path is boxed in by hedges (and the odd house) on both
  // sides so the wall/water/stairs actually have to be dealt with instead
  // of walked around. Generated here rather than hand-placed one by one.
  function hedgeCol(x, z0, z1, segLen) {
    const segs = [];
    for (let z = z0; z < z1; z += segLen) {
      const len = Math.min(segLen, z1 - z);
      segs.push({ x, y: 1.3, z: z + len / 2, w: 1.8, h: 2.6, d: len + 0.4, hedge: true });
    }
    return segs;
  }
  function hedgeRow(x0, x1, z, segLen) {
    const segs = [];
    for (let x = x0; x < x1; x += segLen) {
      const len = Math.min(segLen, x1 - x);
      segs.push({ x: x + len / 2, y: 1.3, z, w: len + 0.4, h: 2.6, d: 1.8, hedge: true });
    }
    return segs;
  }

  const CORRIDOR_HALF_W = 9; // matches the water zone / climbable wall width
  const boundaries = [
    ...hedgeRow(-CORRIDOR_HALF_W, CORRIDOR_HALF_W, -4, 4.5),          // cap behind spawn
    ...hedgeCol(-CORRIDOR_HALF_W, -4, 60, 5),                          // west side of main corridor
    ...hedgeCol(CORRIDOR_HALF_W, -4, 60, 5),                           // east side of main corridor
    ...hedgeRow(-18, -CORRIDOR_HALF_W, 60, 4.5),                       // arena south wall, west flank
    ...hedgeRow(CORRIDOR_HALF_W, 18, 60, 4.5),                         // arena south wall, east flank (leaves the -9..9 gap open as the entrance)
    ...hedgeCol(-18, 60, 98, 6),                                       // arena west wall
    ...hedgeCol(18, 60, 98, 6),                                        // arena east wall
    ...hedgeRow(-18, 18, 98, 6),                                       // arena north cap, behind the boss
  ];

  const houses = [
    { x: -13, y: 1.4, z: 20, w: 5, h: 2.8, d: 5, house: true },
    { x: 13, y: 1.4, z: 32, w: 5, h: 2.8, d: 5, house: true },
    { x: -13, y: 1.4, z: 52, w: 5, h: 2.8, d: 5, house: true },
    { x: -22, y: 1.4, z: 78, w: 5, h: 2.8, d: 5, house: true },
    { x: 22, y: 1.4, z: 78, w: 5, h: 2.8, d: 5, house: true },
  ];

  const LEVEL_DEMO = {
    id: 'demo-1',
    name: 'Jardin de Benito (Demo)',
    spawn: { x: 0, y: 1, z: 0 },
    skyColor: 0x2f7fd6,
    skyHorizon: 0xbfe9ff,
    groundColor: 0x5ea63c,
    groundSize: 240,

    platforms: [
      // Stepping stones leading up to the water crossing.
      { x: 0, y: 0.5, z: 8, w: 3, h: 1, d: 3 },
      { x: 0, y: 0.5, z: 13, w: 3, h: 1, d: 3 },

      // Bounce pads across the stream — short, gently-offset hops.
      { x: 0, y: 0.3, z: 17.5, w: 2.6, h: 0.4, d: 2.6, bouncy: true },
      { x: 1.3, y: 0.3, z: 21.5, w: 2.6, h: 0.4, d: 2.6, bouncy: true },
      { x: -1.3, y: 0.3, z: 25.5, w: 2.6, h: 0.4, d: 2.6, bouncy: true },
      { x: 1.3, y: 0.3, z: 29.5, w: 2.6, h: 0.4, d: 2.6, bouncy: true },
      { x: 0, y: 0.3, z: 33.5, w: 2.6, h: 0.4, d: 2.6, bouncy: true },

      // Landing after the crossing.
      { x: 0, y: 0.5, z: 38, w: 6, h: 1, d: 4 },

      // Climbable wall + top ledge — spans the full corridor width so it
      // can't be walked around, only over.
      { x: 0, y: 4, z: 45, w: 18, h: 8, d: 1, climbable: true },
      { x: 0, y: 8.2, z: 45, w: 10, h: 0.4, d: 3 },

      // Stair-step descent on the far side of the wall.
      { x: 0, y: 6.5, z: 48, w: 4, h: 1, d: 3 },
      { x: 0, y: 4.5, z: 51, w: 4, h: 1, d: 3 },
      { x: 0, y: 2.5, z: 54, w: 4, h: 1, d: 3 },
      { x: 0, y: 0.5, z: 57, w: 6, h: 1, d: 4 },

      ...boundaries,
      ...houses,
    ],

    water: [
      { x: 0, z: 25.5, w: 18, d: 20 },
    ],

    collectibles: [
      { type: 'milk', x: -3, y: 0.4, z: 3 },
      { type: 'milk', x: 3, y: 0.4, z: 3 },
      { type: 'tuna', x: 0, y: 1.3, z: 8 },
      { type: 'tuna', x: 0, y: 1.3, z: 13 },
      { type: 'tuna', x: 0, y: 0.9, z: 17.5 },
      { type: 'tuna', x: 1.3, y: 0.9, z: 21.5 },
      { type: 'tuna', x: -1.3, y: 0.9, z: 25.5 },
      { type: 'tuna', x: 1.3, y: 0.9, z: 29.5 },
      { type: 'milk', x: -2, y: 8.7, z: 45 },
      { type: 'milk', x: 2, y: 8.7, z: 45 },
      { type: 'tuna', x: 0, y: 7.3, z: 48 },
      { type: 'tuna', x: 0, y: 5.3, z: 51 },
      { type: 'tuna', x: 0, y: 3.3, z: 54 },
      { type: 'milk', x: -3, y: 1.3, z: 61 },
      { type: 'milk', x: 3, y: 1.3, z: 61 },
    ],

    enemies: [
      {
        // Guards the approach to the water, well outside spawn's radius so
        // Benito doesn't start the game already being mauled.
        x: 4, y: 0, z: 11,
        patrolA: { x: -4, z: 11 }, patrolB: { x: 4, z: 11 },
        hp: 2, speed: 2.2, chaseSpeed: 4, aggroRadius: 6,
      },
      {
        x: 0, y: 0, z: 57,
        patrolA: { x: -4, z: 57 }, patrolB: { x: 4, z: 57 },
        hp: 2, speed: 2.4, chaseSpeed: 4.4, aggroRadius: 7,
      },
      {
        x: 0, y: 0, z: 63,
        patrolA: { x: -3, z: 63 }, patrolB: { x: 3, z: 63 },
        hp: 3, speed: 2.6, chaseSpeed: 4.8, aggroRadius: 8,
      },
    ],

    boss: {
      x: 0, y: 0, z: 78,
      hp: 6, arenaRadius: 16, awakeRadius: 20,
      speed: 1.7, fireInterval: 3.2, windupDuration: 0.7,
      projectileSpeed: 6, projectileDamage: 1,
    },

    hints: [
      { x: 0, z: 9, radius: 6, text: 'Un gato negro ronda cerca. Acercate y presiona Espacio para arañarlo.' },
      { x: 0, z: 15, radius: 4, text: 'El arroyo se cruza saltando entre las plataformas rosas: te impulsan solas al aterrizar.' },
      { x: 0, z: 42, radius: 6, text: 'Esa pared se escala: acercate y mantené E apretado para trepar.' },
      { x: 0, z: 61, radius: 5, text: 'El Gato Grande espera adelante. Cuando abra la boca y gruña, va a largar gases: esquivalos y aprovecha para arañarlo de cerca.' },
    ],

    goal: { collectiblesRequired: 0 },
  };

  LEVEL_REGISTRY.push(LEVEL_DEMO);
})();
