// Loads small static prop models (purchased Unity asset packs: a milk
// carton, a tuna can) once each, normalizes each to a target height with its
// base sitting at local y=0 and its footprint centered on x/z (to match how
// Collectible positions/spins items), and hands out cheap clones via
// instantiate(name).
//
// Unlike Silverpaw.fbx, these FBX exports carry no embedded texture
// reference (Unity kept that binding in its .mat file, not the mesh export)
// so the diffuse map is loaded separately here and assigned directly, rather
// than relying on FBXLoader's own texture resolution.
const Props = (function () {
  const DEFS = {
    milk: { fbx: 'assets/milk/Milk.fbx', tex: 'assets/milk/Milk_Albedo.png', targetHeight: 0.4 },
    tuna: { fbx: 'assets/tuna/TunaCan.fbx', tex: 'assets/tuna/TunaCan_Albedo.png', targetHeight: 0.18 },
  };

  const templates = {};

  function normalize(obj, targetHeight) {
    let box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    obj.scale.setScalar(targetHeight / (size.y || 1));
    box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= box.min.y;
  }

  function load(name) {
    const def = DEFS[name];
    if (!def) return Promise.reject(new Error(`Props: unknown prop "${name}"`));
    if (def.promise) return def.promise;

    def.promise = new Promise((resolve, reject) => {
      const loader = new THREE.FBXLoader();
      const texLoader = new THREE.TextureLoader();
      Promise.all([
        new Promise((res, rej) => loader.load(def.fbx, res, undefined, rej)),
        new Promise((res, rej) => texLoader.load(def.tex, res, undefined, rej)),
      ]).then(([obj, texture]) => {
        texture.colorSpace = THREE.SRGBColorSpace ?? texture.colorSpace;
        const material = new THREE.MeshLambertMaterial({ map: texture });
        obj.traverse((child) => {
          if (child.isMesh) {
            child.material = material;
            child.frustumCulled = false;
          }
        });
        normalize(obj, def.targetHeight);
        templates[name] = obj;
        resolve(obj);
      }).catch(reject);
    });
    return def.promise;
  }

  function loadAll() {
    return Promise.all(Object.keys(DEFS).map(load));
  }

  function instantiate(name) {
    const template = templates[name];
    if (!template) return null;
    return template.clone(true);
  }

  return { load, loadAll, instantiate, isReady: (name) => !!templates[name] };
})();
