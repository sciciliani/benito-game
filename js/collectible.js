// A pickup item: a milk carton, a tuna can, a key, or the stolen fish.
// Purely data + a mesh; World/main.js handles proximity detection and
// removal (and, for 'fish', the steal-and-escape mini-game logic).
class Collectible {
  constructor(type, x, y, z) {
    this.type = type; // 'milk' | 'tuna' | 'key' | 'fish'
    this.collected = false;
    this.usingModel = (type === 'milk' || type === 'tuna') && typeof Props !== 'undefined' && Props.isReady(type);
    if (this.usingModel) {
      this.mesh = Props.instantiate(type);
    } else if (type === 'milk') {
      this.mesh = this._buildMilk();
    } else if (type === 'tuna') {
      this.mesh = this._buildTuna();
    } else if (type === 'key') {
      this.mesh = this._buildKey();
    } else {
      this.mesh = this._buildFish();
    }
    this.mesh.position.set(x, y, z);
    this.baseY = y;
    this.spinPhase = Math.random() * Math.PI * 2;
  }

  _buildMilk() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xfbfbfb });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.2), bodyMat);
    g.add(body);

    // Blue brand stripe around the middle.
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.305, 0.09, 0.205),
      new THREE.MeshLambertMaterial({ color: 0x2b6fd1 })
    );
    stripe.position.y = -0.04;
    g.add(stripe);

    // Gable roof: two angled flaps meeting at a ridge.
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xe8f2ff });
    const flapGeo = new THREE.BoxGeometry(0.31, 0.2, 0.14);
    const flapL = new THREE.Mesh(flapGeo, roofMat);
    flapL.position.set(0, 0.28, -0.045);
    flapL.rotation.x = -0.62;
    g.add(flapL);
    const flapR = new THREE.Mesh(flapGeo, roofMat);
    flapR.position.set(0, 0.28, 0.045);
    flapR.rotation.x = 0.62;
    g.add(flapR);

    return g;
  }

  _buildTuna() {
    const g = new THREE.Group();
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.16, 16),
      new THREE.MeshLambertMaterial({ color: 0xcdd0d3 })
    );
    g.add(can);

    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.204, 0.204, 0.1, 16),
      new THREE.MeshLambertMaterial({ color: 0xd8433a })
    );
    g.add(label);

    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.02, 16),
      new THREE.MeshLambertMaterial({ color: 0xeceff2 })
    );
    lid.position.y = 0.09;
    g.add(lid);

    const pull = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.011, 6, 12),
      new THREE.MeshLambertMaterial({ color: 0xb8bcc0 })
    );
    pull.rotation.x = Math.PI / 2;
    pull.position.set(0.045, 0.11, 0);
    g.add(pull);

    return g;
  }

  _buildKey() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xe8c23a });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 16), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.13;
    g.add(ring);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 8), mat);
    shaft.position.y = -0.02;
    g.add(shaft);

    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.03), mat);
    tooth1.position.set(0.045, -0.11, 0);
    g.add(tooth1);
    const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), mat);
    tooth2.position.set(0.035, -0.16, 0);
    g.add(tooth2);

    return g;
  }

  _buildFish() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x8fb3c9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 4, 8), mat);
    body.rotation.z = Math.PI / 2;
    g.add(body);

    const tailMat = new THREE.MeshLambertMaterial({ color: 0x6f95ab });
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 4), tailMat);
    tail.rotation.z = -Math.PI / 2;
    tail.position.x = -0.17;
    g.add(tail);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    eye.position.set(0.13, 0.02, 0.05);
    g.add(eye);

    return g;
  }

  update(dt, t) {
    if (this.collected) return;
    this.mesh.rotation.y += dt * 1.6;
    this.mesh.position.y = this.baseY + Math.sin(t * 2 + this.spinPhase) * 0.08;
  }
}
