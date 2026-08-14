// Builds a low-poly cat out of primitives: a procedural fur texture, flat
// shading for a faceted "low poly mammal" look, slit-pupil eyes, a mouth
// that can open for hiss/roar expressions, and pivoted front legs so a
// paw-swipe can be animated. Returns a THREE.Group with named child meshes
// in userData.parts so controllers can animate them without external assets.
function buildCatMesh({
  furColor = 0xffffff, earColor = 0xffb6c1, pawColor = null,
  scale = 1, eyeColor = 0x222222,
} = {}) {
  const group = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ map: makeFurTexture(furColor), color: 0xffffff, flatShading: true });
  const pawMat = new THREE.MeshLambertMaterial({ color: pawColor ?? furColor, flatShading: true });

  const bodyColor = new THREE.Color(furColor);
  const bellyMat = new THREE.MeshLambertMaterial({
    color: bodyColor.clone().lerp(new THREE.Color(0xffffff), 0.55), flatShading: true,
  });

  // Body — a slightly tapered, low-segment capsule for a faceted silhouette.
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.5, 2, 7), fur);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.52, -0.02);
  body.scale.set(1, 1, 1.08);
  body.name = 'body';
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), bellyMat);
  belly.scale.set(0.85, 0.55, 1);
  belly.position.set(0, 0.32, 0.05);
  group.add(belly);

  // Head: flattened + slightly tapered toward the muzzle for a less
  // balloon-like skull, with a distinct projecting muzzle block.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 9, 7), fur);
  head.scale.set(1, 0.88, 0.92);
  head.position.set(0, 0.94, 0.5);
  head.name = 'head';
  group.add(head);

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), fur);
  muzzle.scale.set(1, 0.72, 0.85);
  muzzle.position.set(0, 0.82, 0.78);
  group.add(muzzle);

  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 6), fur);
    cheek.scale.set(1, 0.6, 0.8);
    cheek.position.set(0.24 * side, 0.79, 0.7);
    group.add(cheek);
  }

  // Ears
  const earGeo = new THREE.ConeGeometry(0.13, 0.24, 5);
  const innerEarGeo = new THREE.ConeGeometry(0.07, 0.15, 5);
  const innerEarMat = new THREE.MeshLambertMaterial({ color: earColor, flatShading: true });
  for (const side of [-1, 1]) {
    const earL = new THREE.Mesh(earGeo, fur);
    earL.position.set(0.19 * side, 1.2, 0.5);
    earL.rotation.x = -0.15;
    earL.rotation.z = 0.18 * side;
    earL.scale.z = 0.6;
    group.add(earL);
    const inner = new THREE.Mesh(innerEarGeo, innerEarMat);
    inner.position.set(0.19 * side, 1.18, 0.55);
    inner.rotation.x = -0.15;
    inner.rotation.z = 0.18 * side;
    inner.scale.z = 0.6;
    group.add(inner);
  }

  // Eyes: sclera + colored iris + a vertical slit pupil. Stored so callers
  // can squint them (scale.y down) for expressions.
  const scleraMat = new THREE.MeshLambertMaterial({ color: 0xfdf9ec, flatShading: true });
  const irisMat = new THREE.MeshLambertMaterial({ color: eyeColor, flatShading: true });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  const eyeGroups = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.058, 7, 6), scleraMat);
    sclera.scale.set(1, 1.15, 0.5);
    eye.add(sclera);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.036, 10), irisMat);
    iris.position.z = 0.028;
    eye.add(iris);
    const pupil = new THREE.Mesh(new THREE.PlaneGeometry(0.011, 0.048), pupilMat);
    pupil.position.z = 0.031;
    eye.add(pupil);
    eye.position.set(0.135 * side, 0.98, 0.76);
    eye.rotation.y = 0.3 * side;
    group.add(eye);
    eyeGroups.push(eye);
  }

  // Nose: pink bridge + a small dark triangular tip.
  const noseBridge = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0xffc0cb, flatShading: true })
  );
  noseBridge.position.set(0, 0.815, 0.93);
  group.add(noseBridge);
  const noseTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.032, 0.04, 4),
    new THREE.MeshLambertMaterial({ color: 0x7a4a52, flatShading: true })
  );
  noseTip.rotation.x = Math.PI / 2;
  noseTip.rotation.y = Math.PI / 4;
  noseTip.position.set(0, 0.82, 0.97);
  group.add(noseTip);

  // Mouth: closed thin line by default; controllers scale.y this up to
  // open it for a hiss/roar expression.
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3a1620 }));
  mouth.scale.set(1, 0.22, 0.55);
  mouth.position.set(0, 0.765, 0.9);
  mouth.name = 'mouth';
  group.add(mouth);

  // Whiskers
  const whiskerMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  for (const side of [-1, 1]) {
    for (const tilt of [-0.11, 0, 0.11]) {
      const points = [
        new THREE.Vector3(0.09 * side, 0.81 + tilt * 0.3, 0.88),
        new THREE.Vector3(0.38 * side, 0.8 + tilt, 0.74),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      group.add(new THREE.Line(geo, whiskerMat));
    }
  }

  // Back legs: static, like before.
  const legGeo = new THREE.CylinderGeometry(0.085, 0.09, 0.28, 5);
  const pawGeo = new THREE.CylinderGeometry(0.095, 0.1, 0.14, 5);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, fur);
    leg.position.set(0.22 * side, 0.27, -0.28);
    group.add(leg);
    const pawMesh = new THREE.Mesh(pawGeo, pawMat);
    pawMesh.position.set(0.22 * side, 0.07, -0.28);
    group.add(pawMesh);
  }

  // Front legs: mounted on shoulder pivots so a swipe/punch can be animated
  // by rotating the pivot forward.
  const frontLegPivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.22 * side, 0.4, 0.28);
    const leg = new THREE.Mesh(legGeo, fur);
    leg.position.set(0, -0.14, 0);
    pivot.add(leg);
    const pawMesh = new THREE.Mesh(pawGeo, pawMat);
    pawMesh.position.set(0, -0.34, 0);
    pivot.add(pawMesh);
    group.add(pivot);
    frontLegPivots.push(pivot);
  }

  // Tail on a pivot so it can wag
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.68, -0.5);
  tailPivot.name = 'tailPivot';
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.48, 2, 5), fur);
  tail.rotation.x = Math.PI / 2.6;
  tail.position.set(0, 0.14, -0.14);
  tailPivot.add(tail);
  group.add(tailPivot);

  group.scale.setScalar(scale);
  group.userData.parts = {
    body, head, tailPivot, belly, mouth,
    eyeL: eyeGroups[0], eyeR: eyeGroups[1],
    frontLegPivotL: frontLegPivots[0], frontLegPivotR: frontLegPivots[1],
  };
  return group;
}
