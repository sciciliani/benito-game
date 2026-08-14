// Default level. Builds on LEVEL_DEMO's straight corridor (see that file for
// the fully-documented schema) by widening the middle stretch into an open
// plaza with a hidden west room, plus a single gated entrance out in the
// open field before the plaza that stays shut until the player has
// collected enough milk/tuna, so exploring the field is required before
// going any further. The couch and granny houses out there are themselves
// climbable, with a rooftop enemy to fight on each.
//
// Layout along z (the main direction of travel):
//   -4..6   spawn funnel, corridor width  9 (x: -9..9)
//    6..17  open plaza,   width 18 (x: -18..18) — west room
//   17..38  water crossing, corridor width 9 (unchanged from LEVEL_DEMO)
//   41..57  climbable wall + stair descent (unchanged from LEVEL_DEMO)
//   57..98  enemy gauntlet + boss arena (widens back to 18, unchanged shape)

(function () {
  // h=3.4 (not the double jump's fault: it's kept at full strength — see
  // player.js — and this is just tall enough that even its worst-case
  // ~2.93 reach still can't clear the fence, with margin).
  function hedgeCol(x, z0, z1, segLen) {
    const segs = [];
    for (let z = z0; z < z1; z += segLen) {
      const len = Math.min(segLen, z1 - z);
      segs.push({ x, y: 1.7, z: z + len / 2, w: 1.8, h: 3.4, d: len + 0.4, hedge: true });
    }
    return segs;
  }
  function hedgeRow(x0, x1, z, segLen) {
    const segs = [];
    for (let x = x0; x < x1; x += segLen) {
      const len = Math.min(segLen, x1 - x);
      segs.push({ x: x + len / 2, y: 1.7, z, w: len + 0.4, h: 3.4, d: 1.8, hedge: true });
    }
    return segs;
  }

  const boundaries = [
    ...hedgeRow(-9, 9, -4, 4.5),        // cap behind spawn
    ...hedgeCol(-9, -4, 6, 5),          // spawn funnel, west/east
    ...hedgeCol(9, -4, 6, 5),
    // Plaza outer wall. West side has a narrow gap (z10.2-12.8, exactly the
    // width of the iron gate below) — the only way in from the open field
    // where Benito now starts (see spawn below). The hedge fully encloses
    // everything before the river; that gate is the sole entrance.
    ...hedgeCol(-18, 6, 10.2, 3),
    ...hedgeCol(-18, 12.8, 17, 3),
    ...hedgeCol(18, 6, 17, 5.5),
    ...hedgeRow(-18, -9, 6, 4.5),       // west room north wall
    ...hedgeRow(-18, -9, 14, 4.5),      // west room south wall (west wall is shared with the plaza outer wall above)
    ...hedgeCol(-9, 17, 60, 5),         // corridor resumes, west/east
    ...hedgeCol(9, 17, 60, 5),
    ...hedgeRow(-18, -9, 60, 4.5),      // arena south wall, west/east flank (leaves -9..9 open as the entrance)
    ...hedgeRow(9, 18, 60, 4.5),
    ...hedgeCol(-18, 60, 98, 6),        // arena west/east wall
    ...hedgeCol(18, 60, 98, 6),
    ...hedgeRow(-18, 18, 98, 6),        // arena north cap, behind the boss
  ];

  // Purely decorative — placed just outside the outer hedge walls (|x| > 18)
  // so they're visible in the distance but never inside reachable space
  // (matches how platforms/enemies have no collision against them). The
  // other two (that used to be here at x=-24) are now the real couch/
  // granny houses, in the reachable field west of the plaza — see below.
  const houses = [
    { x: 24, y: 1.4, z: 36, w: 5, h: 2.8, d: 5, house: true },
    { x: 24, y: 1.4, z: 85, w: 5, h: 2.8, d: 5, house: true },
  ];

  const LEVEL_GARDEN = {
    id: 'garden-1',
    name: 'Jardin de Benito',
    // Spawns outside the walled plaza entirely, in the open field to the
    // west — the couch house is close by (with a rival cat guarding it),
    // the granny house and the lookout tower a bit further out, and the
    // main path (rival cats, the swamp crossing, the boss) is found by
    // heading east through the gap in the plaza wall.
    spawn: { x: -22, y: 1, z: 10 },
    skyColor: 0x2f7fd6,
    skyHorizon: 0xbfe9ff,
    groundColor: 0x5ea63c,
    groundSize: 260,

    platforms: [
      // The entrance gate: closes off everything before the river (the
      // whole walled plaza, west room, and water crossing) behind the hedge
      // — this narrow iron door (double a normal door's width, see the
      // matching gap cut into the boundary hedge above) is the only way
      // in. Opens once 3 rival cats have been defeated (see
      // world.catsDefeated, incremented in enemy.js/player.js), not by
      // collecting items. Only as tall as the hedge it sits in (h=3.6 vs
      // the hedge's 3.4), not the far corridor gate's full h=5 — it reads
      // as part of the fence line, not a separate tower. Same
      // steel-door/forbidden-sign look as before (see level.js) but sized
      // for a gap in a column wall: width (x) is the thin dimension, depth
      // (z) is the wide one.
      {
        x: -18, y: 1.8, z: 11.5, w: 1.2, h: 3.6, d: 2.6, gate: true,
        gateRequiresKills: 3,
        gateOpenMessage: 'El porton se abrio! El jardin esta abierto.',
        gateLockedMessage: 'Esta puerta solo se abrira al haber vencido a tres gatos.',
      },

      // The couch house — the one nearest spawn, with a rival cat guarding
      // the approach (see enemies below). Slightly bigger than before, with
      // a flat roof (flatRoof: true — see level.js) instead of the usual
      // decorative cone, since this one is meant to be climbed: it's a cat,
      // and these are walls, so three of the four sides (everywhere but the
      // front door) are climbable, all leading up to the same rooftop deck
      // with a rival cat to fight on it.
      { x: -27, y: 1.6, z: 6, w: 6, h: 3.2, d: 6, house: true, flatRoof: true },
      { x: -27, y: 1.6, z: 9.4, w: 4, h: 3.2, d: 0.8, climbable: true }, // back (south) wall
      { x: -23.6, y: 1.6, z: 6, w: 0.8, h: 3.2, d: 4, climbable: true }, // east side wall
      { x: -30.4, y: 1.6, z: 6, w: 0.8, h: 3.2, d: 4, climbable: true }, // west side wall
      { x: -27, y: 3.35, z: 7, w: 10, h: 0.3, d: 8 },
      // Its own interior, same reused pattern, offset to x=400.
      { x: 400, y: -0.5, z: 0, w: 12, h: 1, d: 12, color: 0x9c7a4a },
      { x: 400, y: 2, z: -6, w: 12, h: 4, d: 0.6, color: 0xcbb994 },
      { x: 406, y: 2, z: 0, w: 0.6, h: 4, d: 12, color: 0xcbb994 },
      { x: 394, y: 2, z: 0, w: 0.6, h: 4, d: 12, color: 0xcbb994 },
      { x: 400, y: 2, z: 6, w: 12, h: 4, d: 0.6, color: 0xcbb994 }, // south wall

      // The granny/kitchen house — a bit further out than the couch house.
      // Same treatment: bigger, flat roof, three climbable sides (all but
      // the front door) leading to a rooftop deck with a rival cat.
      { x: -27, y: 1.6, z: 18, w: 6, h: 3.2, d: 6, house: true, flatRoof: true },
      { x: -27, y: 1.6, z: 21.4, w: 4, h: 3.2, d: 0.8, climbable: true }, // back (south) wall
      { x: -23.6, y: 1.6, z: 18, w: 0.8, h: 3.2, d: 4, climbable: true }, // east side wall
      { x: -30.4, y: 1.6, z: 18, w: 0.8, h: 3.2, d: 4, climbable: true }, // west side wall
      { x: -27, y: 3.35, z: 19, w: 10, h: 0.3, d: 8 },

      // The enterable key-house — deep in the boss arena rather than near
      // spawn, so it's a real destination and not just a pit stop. Placed
      // more than arenaRadius (16) from the boss's arena center (0,78) so
      // the boss (no wall collision) can never wander into/through it.
      { x: -13, y: 1.4, z: 90, w: 4, h: 2.8, d: 4, house: true },

      // Shared house interior, reused by the key-house door. Built far from
      // the outdoor level (no other geometry near x=300) so it can't be
      // seen or walked into by accident; only reachable via a door.
      { x: 300, y: -0.5, z: 0, w: 12, h: 1, d: 12, color: 0x9c7a4a },
      { x: 300, y: 2, z: -6, w: 12, h: 4, d: 0.6, color: 0xcbb994 },
      { x: 306, y: 2, z: 0, w: 0.6, h: 4, d: 12, color: 0xcbb994 },
      { x: 294, y: 2, z: 0, w: 0.6, h: 4, d: 12, color: 0xcbb994 },
      { x: 300, y: 2, z: 6, w: 12, h: 4, d: 0.6, color: 0xcbb994 }, // south wall (the return door sits flush against it)

      // Its own interior, offset to x=500 — a full kitchen, 28x24 (up from
      // 18x16), with more furniture scattered around so there's actual room
      // to run and dodge during the chase, not just one straight sprint to
      // the door.
      { x: 500, y: -0.5, z: 0, w: 28, h: 1, d: 24, color: 0xc9a86a }, // tile floor
      { x: 500, y: 2, z: -12, w: 28, h: 4, d: 0.6, color: 0xcbb994 }, // north wall
      { x: 514, y: 2, z: 0, w: 0.6, h: 4, d: 24, color: 0xcbb994 }, // east wall
      { x: 486, y: 2, z: 0, w: 0.6, h: 4, d: 24, color: 0xcbb994 }, // west wall
      { x: 500, y: 2, z: 12, w: 28, h: 4, d: 0.6, color: 0xcbb994 }, // south wall (return door sits flush against it)

      // Kitchen decor along the west wall: stove, counter/sink, and a tall
      // fridge further down — also doubles as cover during the chase.
      { x: 489, y: 0.5, z: -10.5, w: 1.6, h: 1.0, d: 1.0, color: 0x4a4a4a }, // stove
      { x: 489, y: 0.5, z: -7.5, w: 1.6, h: 1.0, d: 1.0, color: 0xd8d8d8 }, // counter/sink
      { x: 489, y: 1.1, z: -2, w: 1.6, h: 2.2, d: 1.3, color: 0xe8e8ec }, // fridge
      { x: 489, y: 0.7, z: 4, w: 1.3, h: 1.4, d: 1.0, color: 0x8a5a3c }, // broom closet
      // Upper cabinets along the north wall, purely decorative.
      { x: 491.5, y: 2.5, z: -11.6, w: 1.8, h: 0.9, d: 0.6, color: 0x9c7a52 },
      { x: 497, y: 2.5, z: -11.6, w: 1.8, h: 0.9, d: 0.6, color: 0x9c7a52 },
      { x: 502.5, y: 2.5, z: -11.6, w: 1.8, h: 0.9, d: 0.6, color: 0x9c7a52 },
      { x: 508, y: 2.5, z: -11.6, w: 1.8, h: 0.9, d: 0.6, color: 0x9c7a52 },

      // The fish's table — deliberately taller than Benito's max jump
      // height (~1.68) so it can't be reached directly from the ground;
      // the chair just south of it is the intended (and required) step up.
      { x: 507, y: 0.9, z: -9, w: 2.0, h: 1.8, d: 1.3, color: 0x8a6d3b },
      { x: 507, y: 0.33, z: -7.3, w: 0.65, h: 0.65, d: 0.65, color: 0x9c7a52 }, // chair (climb this first)
      { x: 507, y: 0.33, z: -10.7, w: 0.65, h: 0.65, d: 0.65, color: 0x9c7a52 }, // second chair, decorative

      // Kitchen island, between the table and the middle of the room — cover
      // to juke around while Granny's chasing (she avoids it too, see the
      // `obstacles` list on the `granny` config below).
      { x: 500, y: 0.5, z: -1, w: 3.2, h: 1.0, d: 1.6, color: 0xb08a5c },

      // A round dining table further into the room with two stools, and a
      // pantry shelf against the east wall — more cover spread across the
      // room instead of everything clustered near the table.
      { x: 507, y: 0.5, z: 2, w: 1.8, h: 1.0, d: 1.8, color: 0x9c7a52 },
      { x: 507, y: 0.25, z: 0.5, w: 0.5, h: 0.5, d: 0.5, color: 0x8a6d3b }, // stool
      { x: 507, y: 0.25, z: 3.5, w: 0.5, h: 0.5, d: 0.5, color: 0x8a6d3b }, // stool
      { x: 513, y: 1.0, z: 6, w: 1.3, h: 2.0, d: 1.3, color: 0x8a6d3b }, // pantry shelf
      // A trash can near the exit — a last dodge option right before the door.
      { x: 496, y: 0.45, z: 9, w: 0.8, h: 0.9, d: 0.8, color: 0x707070 },

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
      // Spawn.
      { type: 'milk', x: -3, y: 0.4, z: 3 },
      { type: 'milk', x: 3, y: 0.4, z: 3 },
      // Plaza main path.
      { type: 'tuna', x: 0, y: 1.3, z: 8 },
      { type: 'tuna', x: 0, y: 1.3, z: 13 },
      // West room (hidden side branch) — also where the house key is.
      { type: 'milk', x: -13, y: 0.4, z: 8 },
      { type: 'tuna', x: -15, y: 0.4, z: 10 },
      { type: 'tuna', x: -13, y: 0.4, z: 12 },
      { type: 'key', x: -16, y: 0.4, z: 8 },
      // Rooftop reward on each climbable house (see the rival cats up
      // there too, in enemies below).
      { type: 'tuna', x: -28, y: 3.8, z: 6 },
      { type: 'tuna', x: -26, y: 3.8, z: 8 },
      { type: 'tuna', x: -28, y: 3.8, z: 18 },
      { type: 'tuna', x: -26, y: 3.8, z: 20 },
      // The open field around spawn/the two houses.
      { type: 'milk', x: -22, y: 0.4, z: 7 },
      { type: 'tuna', x: -25, y: 0.4, z: 11 },
      { type: 'tuna', x: -20, y: 0.4, z: 15 },
      { type: 'milk', x: -24, y: 0.4, z: 20 },
      // Water crossing.
      { type: 'tuna', x: 0, y: 0.9, z: 17.5 },
      { type: 'tuna', x: 1.3, y: 0.9, z: 21.5 },
      { type: 'tuna', x: -1.3, y: 0.9, z: 25.5 },
      { type: 'tuna', x: 1.3, y: 0.9, z: 29.5 },
      { type: 'tuna', x: 0, y: 0.9, z: 33.5 },
      // Past the climbable wall: wall-top + stairs.
      { type: 'milk', x: -2, y: 8.7, z: 45 },
      { type: 'milk', x: 2, y: 8.7, z: 45 },
      { type: 'tuna', x: 0, y: 7.3, z: 48 },
      { type: 'tuna', x: 0, y: 5.3, z: 51 },
      { type: 'tuna', x: 0, y: 3.3, z: 54 },
      { type: 'milk', x: -3, y: 1.3, z: 61 },
      { type: 'milk', x: 3, y: 1.3, z: 61 },
      // A little reward waiting inside the house. Kept well clear of the
      // door's arrival spot (300,1,-3) — pickup radius is 0.9, so anything
      // closer than that gets eaten the instant you walk in.
      { type: 'milk', x: 296, y: 0.4, z: -2 },
      { type: 'tuna', x: 304, y: 0.4, z: -2 },
      // The stolen fish, sitting on the table (see the table+chair platforms
      // above — reachable only by climbing the chair first). Picking it up
      // doesn't grant tuna/milk directly; it sets player.hasStolenFish,
      // resolved by escaping through a door (checkDoors) or getting caught
      // by Granny (checkGranny), both in main.js.
      { type: 'fish', x: 507, y: 2.1, z: -9 },
    ],

    // Bidirectional teleports. `to` is where the player lands; walking
    // within `radius` of a door's x/z and pressing F triggers entrance
    // doors (see checkDoors() in main.js) — return doors are `auto` and
    // trigger on proximity alone, no F needed to leave. Locked ones need
    // the key (found in the west room).
    doors: [
      { // Key-house front door, flush against its front wall (z=88).
        x: -13, y: 0, z: 88, ry: 0, radius: 1.1, locked: true,
        to: { x: 300, y: 1, z: -3 },
      },
      // Return door flush against the south wall's INNER face (5.7, not
      // its center at 6 — the wall is 0.6 thick and the door panel only
      // 0.15, so centering it on the wall buried it completely inside the
      // solid wall mesh, invisible from inside the room).
      { x: 300, y: 0, z: 5.7, ry: Math.PI, auto: true, to: { x: -13, y: 1, z: 87.0 } },

      // Couch house door, flush against its front wall (z=3, after the
      // house grew slightly) — no key needed, meant to be an easy early
      // find (it's the one nearest spawn).
      {
        x: -27, y: 0, z: 3, ry: 0, radius: 1.0, to: { x: 400, y: 1, z: 0 },
        enterMessage: 'Rasguñá el sillón con Espacio para romperlo!',
      },
      { x: 400, y: 0, z: 5.7, ry: Math.PI, auto: true, to: { x: -27, y: 1, z: 2.15 } }, // inner face of south wall (z=6)

      // Granny/kitchen house door, flush against its front wall (z=15,
      // after the house grew slightly) — locked (needs the same key as the
      // boss-arena house), with a big padlock so it reads as locked from
      // outside.
      {
        x: -27, y: 0, z: 15, ry: 0, radius: 1.1, locked: true, to: { x: 500, y: 1, z: 9 },
        enterMessage: 'Toma el pescado y escapa de la abuela!',
      },
      { x: 500, y: 0, z: 11.7, ry: Math.PI, auto: true, to: { x: -27, y: 1, z: 14.15 } }, // inner face of south wall (z=12)
    ],

    // Couch mini-game: attack it (Space) enough times and it breaks open.
    destructibles: [
      {
        x: 400, y: 0, z: -2, ry: Math.PI, hp: 6, radius: 1.1,
        rewards: [
          { type: 'tuna', dx: -0.9, dz: 0.4 },
          { type: 'tuna', dx: 0.9, dz: 0.4 },
          { type: 'milk', dx: 0, dz: -0.7 },
        ],
      },
    ],

    // Kitchen heist mini-game: Granny wanders this patrol route (near the
    // stove/counter, clear of the table) until the fish is stolen, then
    // chases the player directly (checkGranny() in main.js). exitTo is
    // where getting caught dumps the player.
    granny: {
      x: 489, y: 0, z: -9,
      patrolA: { x: 489, z: -9 }, patrolB: { x: 489, z: 1 },
      ry: 0,
      // Only ejects the player (see checkGranny() in main.js) after this
      // many hits — a single graze just knocks Benito back, giving him a
      // real chance to keep running instead of ending the attempt outright.
      catchHitsToEject: 3,
      // obstacles: furniture she (and the player, via normal platform
      // collision) can't cut straight through — gives dodging around them
      // during the chase an actual purpose. Spread across the bigger room
      // now, not just clustered near the table.
      obstacles: [
        { x: 507, z: -9, radius: 1.2 },  // the table
        { x: 489, z: -2, radius: 1.0 },  // the fridge
        { x: 489, z: 4, radius: 0.9 },   // the broom closet
        { x: 500, z: -1, radius: 1.9 },  // the kitchen island
        { x: 507, z: 2, radius: 1.3 },   // the dining table
        { x: 507, z: 0.5, radius: 0.5 }, // stool
        { x: 507, z: 3.5, radius: 0.5 }, // stool
        { x: 513, z: 6, radius: 1.1 },   // the pantry shelf
        { x: 496, z: 9, radius: 0.6 },   // the trash can
      ],
      exitTo: { x: -27, y: 1, z: 14.15 },
    },

    enemies: [
      {
        // Guards the plaza's main path, well outside spawn's radius so
        // Benito doesn't start the game already being mauled.
        x: 4, y: 0, z: 11,
        patrolA: { x: -4, z: 11 }, patrolB: { x: 4, z: 11 },
        hp: 2, speed: 2.2, chaseSpeed: 4, aggroRadius: 6,
      },
      {
        // West room.
        x: -13, y: 0, z: 10,
        patrolA: { x: -16, z: 10 }, patrolB: { x: -11, z: 10 },
        hp: 2, speed: 2, chaseSpeed: 3.6, aggroRadius: 5,
      },
      {
        // Guards the approach to the couch house — the rival cat right by
        // the nearest house to spawn. Patrols in front of the door (z=1,
        // north of the house), not under the rooftop deck (z=3..11):
        // findGroundY() picks the tallest platform at a given x/z with no
        // notion of "below" vs "above", so a ground enemy wandering under
        // an elevated platform gets snapped up onto it.
        x: -27, y: 0, z: 1,
        patrolA: { x: -29, z: 1 }, patrolB: { x: -25, z: 1 },
        hp: 2, speed: 2, chaseSpeed: 3.8, aggroRadius: 5,
      },
      {
        // Roams the open field further out, toward the granny house.
        x: -20, y: 0, z: 26,
        patrolA: { x: -24, z: 26 }, patrolB: { x: -16, z: 26 },
        hp: 2, speed: 2.2, chaseSpeed: 4, aggroRadius: 5,
      },
      {
        // On the couch house's rooftop deck — climb up and fight it there.
        x: -27, y: 3.5, z: 7,
        patrolA: { x: -29, z: 5 }, patrolB: { x: -25, z: 9 },
        hp: 2, speed: 1.8, chaseSpeed: 3.2, aggroRadius: 5,
      },
      {
        // On the granny house's rooftop deck.
        x: -27, y: 3.5, z: 19,
        patrolA: { x: -29, z: 17 }, patrolB: { x: -25, z: 21 },
        hp: 2, speed: 1.8, chaseSpeed: 3.2, aggroRadius: 5,
      },
      {
        // Gauntlet, escalating toward the boss.
        x: 0, y: 0, z: 57,
        patrolA: { x: -4, z: 57 }, patrolB: { x: 4, z: 57 },
        hp: 2, speed: 2.4, chaseSpeed: 4.4, aggroRadius: 7,
      },
      {
        x: 0, y: 0, z: 60,
        patrolA: { x: -3, z: 60 }, patrolB: { x: 3, z: 60 },
        hp: 3, speed: 2.6, chaseSpeed: 4.6, aggroRadius: 7,
      },
      {
        x: 0, y: 0, z: 63,
        patrolA: { x: -3, z: 63 }, patrolB: { x: 3, z: 63 },
        hp: 3, speed: 2.6, chaseSpeed: 4.8, aggroRadius: 8,
      },
      {
        x: 0, y: 0, z: 68,
        patrolA: { x: -3, z: 68 }, patrolB: { x: 3, z: 68 },
        hp: 4, speed: 2.9, chaseSpeed: 5.2, aggroRadius: 9,
      },
    ],

    boss: {
      x: 0, y: 0, z: 78,
      hp: 6, arenaRadius: 16, awakeRadius: 20,
      speed: 1.7, fireInterval: 3.2, windupDuration: 0.7,
      projectileSpeed: 6, projectileDamage: 1,
    },

    hints: [
      { x: -22, z: 10, radius: 7, text: 'Benito desperto afuera, cerca de una casa con un sillon. Cuidado con los gatos rivales que rondan el campo abierto. Mas al este, del otro lado de la pared, esta el resto del jardin.' },
      { x: -27, z: 6, radius: 5, text: 'La casa del sillon sospechoso. Presiona F para entrar... y despues probá arañarlo (Espacio). Cualquier pared menos la del frente se trepa: hay un gato rival esperando en el techo.' },
      { x: -27, z: 18, radius: 6, text: 'La cocina de una abuela gatera. El pescado esta arriba de la mesa: subite a la silla primero. Si te agarra con el pescado, va a salir corriendo detras tuyo con la escoba! Esta casa tambien se trepa por los costados.' },
      { x: -13, z: 9, radius: 5, text: 'Encontraste un rincon escondido... y una llave! Debe abrir alguna puerta en algun lugar lejano.' },
      { x: 0, z: 15, radius: 4, text: 'El arroyo se cruza saltando entre las plataformas rosas: te impulsan solas al aterrizar.' },
      { x: 0, z: 42.5, radius: 6, text: 'Esa pared se escala: acercate y mantene E apretado para trepar.' },
      { x: 0, z: 61, radius: 5, text: 'El Gato Grande espera adelante. Cuando abra la boca y gruna, va a largar gases: esquivalos y aprovecha para aranarlo de cerca.' },
      { x: -13, z: 90, radius: 6, text: 'Esta debe ser la puerta de la llave! Presiona F para entrar.' },
    ],

    // Unused as a gate fallback now — the only gate requires defeating cats
    // (gateRequiresKills), not collectibles. Left as a nominal goal value.
    goal: { collectiblesRequired: 4 },
  };

  LEVEL_REGISTRY.push(LEVEL_GARDEN);
})();
