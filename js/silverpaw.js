// Loads the purchased "Silverpaw" cat model (Silverpaw.fbx) once, splits its
// single combined animation take into the named clips Unity's importer had
// defined (Idle / Walk / Run / Jump start-loop-end — see Silverpaw.fbx.meta),
// and hands out cloned, independently-animatable instances via instantiate().
//
// A plain Object3D.clone() does NOT correctly duplicate a skinned mesh's bone
// bindings, so cloning goes through THREE.SkeletonUtils.clone() instead.
const Silverpaw = (function () {
  // Frame ranges lifted directly from Silverpaw.fbx.meta's clipAnimations.
  const CLIP_RANGES = {
    idle: [0, 500],
    walk: [600, 880],
    run: [1200, 1440],
    jumpStart: [1540, 1575],
    jumpLoop: [1700, 1740],
    jumpEnd: [1840, 1855],
  };
  const TOTAL_FRAMES = 1855;
  const TARGET_HEIGHT = 1.05; // matches the procedural cat's rough standing height

  // The rest of the game treats local +Z as "forward" (see catModel.js /
  // player.js's facing math). The source rig's own forward axis is whatever
  // the original modeling app used, so this corrects the mismatch — tuned
  // by visual inspection, not derived from anything in the FBX itself.
  const FORWARD_OFFSET_Y = 0;

  let template = null;
  let loadingPromise = null;

  // blob: URLs are used for the texture (Image-based loading, governed by
  // the img-src CSP directive, which is typically permissive).
  function base64ToBlobUrl(base64, mimeType) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return buffer;
  }

  function onFbxParsed(obj, resolve, reject) {
    const master = obj.animations && obj.animations[0];
    if (!master) {
      reject(new Error('Silverpaw.fbx has no animation take'));
      return;
    }
    const fps = TOTAL_FRAMES / master.duration;

    const clips = {};
    for (const key in CLIP_RANGES) {
      const [first, last] = CLIP_RANGES[key];
      clips[key] = THREE.AnimationUtils.subclip(master, key, first, last, fps);
    }

    // Normalize scale (the source FBX's units make it hundreds of units
    // tall) and re-origin so local y=0 sits at the feet, to match how the
    // rest of the game's physics treats character meshes (see catModel.js).
    let box = new THREE.Box3().setFromObject(obj);
    const height = box.getSize(new THREE.Vector3()).y || 1;
    obj.scale.setScalar(TARGET_HEIGHT / height);
    box = new THREE.Box3().setFromObject(obj);
    obj.position.y -= box.min.y;

    obj.traverse((child) => {
      if (child.isMesh) child.frustumCulled = false;
    });

    template = { scene: obj, clips };
    resolve(template);
  }

  // textureUrl is handled via a LoadingManager urlModifier rather than
  // relying on FBXLoader's automatic "resolve relative to the FBX's own
  // path" behavior — that breaks when the FBX has no real path (a parsed
  // in-memory buffer, see fbxBase64 below). Texture loading goes through
  // THREE.TextureLoader (Image-based, img-src), which is unaffected by the
  // connect-src restriction that blocks the FBX's own network fetch.
  //
  // fbxBase64, when given, skips network loading for the FBX file entirely
  // — it's parsed straight from an in-memory ArrayBuffer via
  // FBXLoader.parse(). This is required in the self-contained Artifact
  // build, where fetch()/XHR against embedded data:/blob: URLs gets
  // blocked by that page's CSP connect-src (confirmed via the actual error:
  // "Failed to fetch. Refused to connect because it violates the
  // document's Content Security Policy" from FileLoader.load). Parsing a
  // buffer already held in memory makes no network request at all, so no
  // connect-src rule applies regardless of scheme.
  function load(fbxUrl = 'assets/silverpaw/Silverpaw.fbx', textureUrl = 'assets/silverpaw/Silverpaw_Tex.png', fbxBase64 = null) {
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise((resolve, reject) => {
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => (url.indexOf('Silverpaw_Tex.png') !== -1 ? textureUrl : url));
      const loader = new THREE.FBXLoader(manager);
      try {
        if (fbxBase64) {
          const obj = loader.parse(base64ToArrayBuffer(fbxBase64), '');
          onFbxParsed(obj, resolve, reject);
        } else {
          loader.load(fbxUrl, (obj) => onFbxParsed(obj, resolve, reject), undefined, reject);
        }
      } catch (e) {
        reject(e);
      }
    });
    return loadingPromise;
  }

  // tintColor: optional hex, multiplies the model's material color (used to
  // recolor the same model into a black rival cat without a second texture).
  function instantiate(tintColor) {
    const clone = THREE.SkeletonUtils.clone(template.scene);
    clone.rotation.y = FORWARD_OFFSET_Y;
    let material = null;
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        if (tintColor != null) child.material.color.set(tintColor);
        material = child.material;
      }
    });

    const mixer = new THREE.AnimationMixer(clone);
    const actions = {};
    for (const key in template.clips) actions[key] = mixer.clipAction(template.clips[key]);
    actions.jumpStart.setLoop(THREE.LoopOnce);
    actions.jumpStart.clampWhenFinished = true;
    actions.jumpEnd.setLoop(THREE.LoopOnce);
    actions.jumpEnd.clampWhenFinished = true;

    // Wrap in a holder so game code can freely set holder.rotation.y = facing
    // without fighting the forward-axis correction baked into the clone.
    const holder = new THREE.Group();
    holder.add(clone);

    return { group: holder, mixer, actions, material };
  }

  // Small crossfade helper shared by Player/Enemy so switching between
  // idle/walk/run/jump reads as one continuous motion instead of a snap-cut.
  function createAnimDriver(actions) {
    let current = null;
    return {
      play(name, fade = 0.2) {
        const next = actions[name];
        if (!next || current === next) return;
        if (current) current.fadeOut(fade);
        next.reset().fadeIn(fade).play();
        current = next;
      },
      get currentAction() {
        return current;
      },
    };
  }

  return { load, instantiate, createAnimDriver, base64ToBlobUrl, isReady: () => !!template };
})();
