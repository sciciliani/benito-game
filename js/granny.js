// Stationary NPC guarding the kitchen. Doesn't move or attack directly —
// she just builds suspicion while the player is near her, and main.js's
// checkGranny() resolves what happens when it maxes out (only a problem if
// the player is actually holding the stolen fish at that point).
class Granny {
  constructor(cfg) {
    this.position = new THREE.Vector3(cfg.x, cfg.y, cfg.z);
    this.noticeRadius = cfg.noticeRadius ?? 3.2;
    this.exitTo = cfg.exitTo ?? null; // where the player lands if caught
    this.suspicion = 0; // 0..1
    this.mesh = this._build();
    this.mesh.position.copy(this.position);
    if (cfg.ry) this.mesh.rotation.y = cfg.ry;
    this._baseRy = cfg.ry ?? 0;
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

    this._headMesh = head;
    return g;
  }

  update(dt, player) {
    const dx = player.position.x - this.position.x, dz = player.position.z - this.position.z;
    const near = Math.hypot(dx, dz) < this.noticeRadius && Math.abs(player.position.y - this.position.y) < 2.5;
    // Rises faster once the fish is actually gone — a lot harder to not
    // notice an empty counter than a cat quietly sniffing around.
    const rate = player.hasStolenFish ? 0.42 : 0.16;
    this.suspicion = THREE.MathUtils.clamp(this.suspicion + (near ? rate : -0.3) * dt, 0, 1);

    if (this.suspicion > 0.08) {
      this.mesh.rotation.y = Math.atan2(dx, dz);
    } else {
      this.mesh.rotation.y = this._baseRy;
    }
    // A little more red in the cheeks as she gets suspicious.
    const heat = this.suspicion;
    this._headMesh.material.color.setRGB(0.94, 0.79 - heat * 0.35, 0.63 - heat * 0.35);
  }
}
