---
name: threejs-3d-asset-sourcing-and-loading
description: >
  Find, evaluate, and load free 3D models (GLTF/GLB) into Three.js scenes.
  Use this skill whenever the task involves sourcing 3D assets from the web,
  loading external models into Three.js, handling GLTF/GLB files, setting up
  model viewers, or troubleshooting model loading issues (CORS, scaling,
  materials, animations, compression). Also trigger when the user mentions
  "3D models", "GLB", "GLTF", "Sketchfab", "Poly Haven", or asks to add
  realistic objects to a Three.js scene.
---

# Sourcing and Loading 3D Models in Three.js

## Format: Always Prefer GLTF / GLB

GLTF is the Khronos Group standard for web 3D — treat it as the only format worth recommending unless the user has a specific reason for something else.

- **GLB** (binary, single file) — best for production. All geometry, materials, textures, and animations bundled together.
- **GLTF** (JSON + `.bin` + texture files) — useful for debugging or when you need to inspect/edit the JSON by hand.

Both support PBR materials, skeletal animation, morph targets, skins, cameras, and lights. Three.js ships a first-class `GLTFLoader` for both.

Avoid OBJ (no materials/animations), FBX (closed format, inconsistent web support), and COLLADA/DAE (bloated, deprecated in practice).


## Where to Find Free Models

Prioritise **CC0 / Public Domain** sources for hassle-free commercial use. Always verify the licence on each individual model before shipping.

### Tier 1 — CC0, Direct GLB, No Account Required

| Source | What You Get | URL |
|--------|-------------|-----|
| **Poly Haven** | Photoscanned PBR models, all CC0. High quality. Direct GLB download with selectable resolution. | https://polyhaven.com/models |
| **poly.pizza** | Curated CC0 low-poly collection. Instant GLB preview and download. Great search. | https://poly.pizza |
| **Kenney** | Thousands of clean low-poly game asset packs (nature, vehicles, buildings, furniture). All CC0. | https://kenney.nl/assets |
| **Quaternius** | Large themed low-poly packs (characters, environments, props, animals). All CC0. | https://quaternius.com |

### Tier 2 — CC0 / CC-BY, May Require Account or Filtering

| Source | What You Get | URL |
|--------|-------------|-----|
| **Sketchfab** | 800k+ downloadable models. Filter by "Downloadable" + Creative Commons licence. Exports to GLB/GLTF. | https://sketchfab.com/search?type=models&licenses=cc |
| **Poimandres Market** | Curated GLTF assets designed for React Three Fiber / Three.js. Free downloads. | https://market.pmnd.rs |
| **AmbientCG** | Primarily PBR textures, but has a growing library of CC0 scanned models. | https://ambientcg.com |
| **Khronos glTF Sample Models** | Official test/reference models. Great for development and debugging. | https://github.com/KhronosGroup/glTF-Sample-Models |
| **Three.js Example Models** | Small set of well-tested models bundled with Three.js (DamagedHelmet, Fox, Soldier, etc.). | https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf |

### Tier 3 — Mixed Licences, Check Carefully

| Source | Notes | URL |
|--------|-------|-----|
| **CGTrader** (free section) | Large variety. Filter by GLTF. Many are CC-BY or royalty-free but check per model. | https://www.cgtrader.com/free-3d-models |
| **TurboSquid** (free section) | Established marketplace with free tier. Licence varies per model. | https://www.turbosquid.com/Search/3D-Models/free |
| **NASA 3D Resources** | Space/mission models, public domain. May need format conversion. | https://nasa3d.arc.nasa.gov/models |

### Validation and Preview Tools

Before integrating a model, preview and validate it:

- **Online viewer**: https://gltf-viewer.donmccurdy.com — drag-and-drop GLB/GLTF preview with environment lighting.
- **glTF Validator**: https://github.com/KhronosGroup/glTF-Validator — checks spec compliance and flags errors.
- **gltf.report**: https://gltf.report — browser-based analysis showing file size breakdown, mesh stats, texture sizes.


## Loading Models in Three.js

### Minimal Working Example

This loads a GLB, auto-centres it, enables shadows, and sets up orbit controls:

```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// Camera
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(3, 3, 5);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting — essential for PBR materials
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Load model
const loader = new GLTFLoader();

loader.load(
  'path/to/model.glb',
  (gltf) => {
    const model = gltf.scene;

    // Auto-centre and normalise scale
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    model.scale.setScalar(2 / maxDim); // fit into ~2 unit bounding box
    model.position.sub(center.multiplyScalar(model.scale.x));

    // Enable shadows on all meshes
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(model);

    // Handle animations if present
    if (gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play());

      // Store mixer for the render loop
      scene.userData.mixer = mixer;
    }
  },
  (progress) => {
    if (progress.total > 0) {
      console.log(`Loading: ${((progress.loaded / progress.total) * 100).toFixed(1)}%`);
    }
  },
  (error) => console.error('Model load failed:', error)
);

// Render loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (scene.userData.mixer) scene.userData.mixer.update(delta);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
```

### Adding DRACO Compression Support

DRACO can reduce mesh data by 70–90%. Many models from Sketchfab and production pipelines use it.

```javascript
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
```

Always set up DRACO decoding — it costs nothing when a model doesn't use it, and prevents silent failures when one does.


### Adding HDR Environment Lighting

For photorealistic PBR rendering, environment maps make a dramatic difference:

```javascript
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

new RGBELoader().load('environment.hdr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture; // PBR materials reflect this
  scene.background = texture;  // optional: use as visible background
});
```

Free HDRIs: https://polyhaven.com/hdris (all CC0).


### Loading from Public URLs

Many sources serve CORS-friendly direct links:

```javascript
// Poly Haven (check their API or direct download links)
loader.load('https://dl.polyhaven.org/file/ph-assets/Models/glb/treasure_chest_2k.glb', ...);

// Three.js sample models (GitHub raw)
loader.load(
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf',
  ...
);

// Khronos sample models
loader.load(
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Fox/glTF-Binary/Fox.glb',
  ...
);
```

For production, always self-host models to avoid CORS issues and ensure availability.


### Using `loadAsync` (Promise-Based)

Cleaner approach, especially when loading multiple models:

```javascript
async function loadModels() {
  const loader = new GLTFLoader();

  // Load multiple models in parallel
  const [helmetData, foxData] = await Promise.all([
    loader.loadAsync('models/helmet.glb'),
    loader.loadAsync('models/fox.glb'),
  ]);

  scene.add(helmetData.scene);
  scene.add(foxData.scene);
}

loadModels().catch(console.error);
```


## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Model appears completely black | No lights in scene | Add `AmbientLight` + `DirectionalLight` at minimum. Use an HDR environment for PBR. |
| Model doesn't appear at all | Wrong scale or position — model may be microscopic or kilometres away | Use the Box3 normalisation pattern from the example above. |
| CORS error in console | Remote server doesn't allow cross-origin requests | Self-host the file, or use a source that serves proper CORS headers. |
| Textures missing or white | GLTF references external files that can't be found at the expected paths | Use GLB (embedded textures) instead, or ensure all referenced files are co-located. |
| DRACO decode error | Model uses DRACO but no decoder configured | Add `DRACOLoader` setup (see above). |
| Materials look different from Blender/source | Three.js renderer settings don't match authoring tool | Set `renderer.outputColorSpace = THREE.SRGBColorSpace` and `renderer.toneMapping = THREE.ACESFilmicToneMapping`. |
| Animations not playing | Mixer not created or not updated in render loop | Create `AnimationMixer`, call `.clipAction(clip).play()`, and update `mixer.update(delta)` every frame. |
| Model is sideways or upside down | Authored in Z-up software (3ds Max, etc.) | GLTF spec is Y-up. Rotate the model: `model.rotation.x = -Math.PI / 2`. |
| Huge file size, slow loading | Uncompressed meshes and large textures | Apply DRACO compression. Resize textures to power-of-two (1024×1024 or 2048×2048). Use `gltf-transform` CLI to optimise. |


## Optimisation Checklist for Production

1. **Use GLB** — single file, no path issues, smaller than GLTF+bin+textures.
2. **Enable DRACO** — typical 70–90% reduction in geometry data.
3. **Compress textures** — use KTX2/Basis Universal via `KTX2Loader` for GPU-compressed textures, or at minimum resize to reasonable dimensions.
4. **Serve with gzip/brotli** — configure your web server or CDN to compress GLB on the wire.
5. **Target <5 MB per model for mobile** — test on real devices.
6. **Show a loading indicator** — use the progress callback or `loadAsync` with a progress UI.
7. **Reuse loader instances** — create one `GLTFLoader` and use it for all models.
8. **Dispose when done** — call `geometry.dispose()`, `material.dispose()`, and `texture.dispose()` when removing models to prevent memory leaks.

### Optimisation Tools

- **gltf-transform** (CLI + library): https://gltf-transform.dev — resize textures, apply DRACO, merge meshes, strip unused data. The single most useful tool for production GLTF pipelines.
- **glTF Validator**: https://github.com/KhronosGroup/glTF-Validator — catch spec violations before they become runtime bugs.
- **gltf.report**: https://gltf.report — visual file size breakdown to identify what's eating your budget.


## Quick Reference: Import Paths

```javascript
// Core
import * as THREE from 'three';

// Loaders
import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader }   from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader }    from 'three/examples/jsm/loaders/KTX2Loader.js';
import { RGBELoader }    from 'three/examples/jsm/loaders/RGBELoader.js';

// Controls
import { OrbitControls }  from 'three/examples/jsm/controls/OrbitControls.js';

// CDN alternative (for vanilla HTML without bundler)
// <script type="importmap">
// {
//   "imports": {
//     "three": "https://cdn.jsdelivr.net/npm/three@0.170/build/three.module.js",
//     "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170/examples/jsm/"
//   }
// }
// </script>
```


## React Three Fiber Equivalent

If the project uses React, loading GLTF models is simpler with `@react-three/drei`:

```jsx
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';

function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function App() {
  return (
    <Canvas camera={{ position: [3, 3, 5], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 7]} intensity={2} />
      <Environment preset="city" />
      <Model url="/models/my-model.glb" />
      <OrbitControls enableDamping />
    </Canvas>
  );
}
```

`useGLTF` handles caching, DRACO decoding, and cleanup automatically.