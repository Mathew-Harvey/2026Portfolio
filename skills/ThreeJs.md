# Three.js Creative Mastery — An LLM Skill Guide

> Comprehensive reference for building immersive, performant, creative 3D web experiences with Three.js, inspired by the philosophy and techniques of Bruno Simon.

---

## Philosophy: The Bruno Simon Approach

Bruno Simon's work (bruno-simon.com, Three.js Journey) represents a particular creative philosophy for 3D on the web:

1. **Playfulness over photorealism** — Make things interactive, fun, and surprising. Users should *want* to explore.
2. **Illusions over computation** — Fake it when you can. Use matcaps instead of lights, baked shadows instead of real-time shadow maps, simple physics proxies instead of complex collision meshes. The user doesn't care *how* it looks good, only *that* it looks good.
3. **Performance is not optional** — A beautiful scene at 15fps is a bad scene. Target 60fps on mid-range devices. Every technique choice should consider its frame budget.
4. **Physics make things feel real** — When objects collide, bounce, and respond to user input, the experience crosses from "demo" to "world."
5. **Start simple, layer complexity** — Scene → Camera → Renderer → Mesh → Light → Animation → Physics → Post-processing → Polish.
6. **Debug everything** — Use lil-gui, dat.GUI, or a debug panel gated behind a URL hash (`#debug`). Expose every parameter. Tweak relentlessly.

---

## Table of Contents

1. [Scene Setup & Boilerplate](#1-scene-setup--boilerplate)
2. [Cameras & Controls](#2-cameras--controls)
3. [Geometry](#3-geometry)
4. [Materials & Textures](#4-materials--textures)
5. [Lighting — Real and Faked](#5-lighting--real-and-faked)
6. [Shadows — Real and Faked](#6-shadows--real-and-faked)
7. [Animation](#7-animation)
8. [Physics with Cannon-es](#8-physics-with-cannon-es)
9. [Loading Models (GLTF/GLB)](#9-loading-models-gltfglb)
10. [Particles](#10-particles)
11. [Raycasting & Interaction](#11-raycasting--interaction)
12. [Shaders (GLSL)](#12-shaders-glsl)
13. [Post-Processing](#13-post-processing)
14. [Scroll-Based Experiences](#14-scroll-based-experiences)
15. [Performance Optimization](#15-performance-optimization)
16. [Project Architecture](#16-project-architecture)
17. [Creative Recipes](#17-creative-recipes)
18. [Common Gotchas](#18-common-gotchas)

---

## 1. Scene Setup & Boilerplate

Every Three.js project starts with three things: a **Scene**, a **Camera**, and a **Renderer**.

```javascript
import * as THREE from 'three'

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Camera
const camera = new THREE.PerspectiveCamera(
  75,                                         // FOV (degrees)
  window.innerWidth / window.innerHeight,     // Aspect ratio
  0.1,                                        // Near clipping plane
  100                                         // Far clipping plane
)
camera.position.set(0, 2, 5)

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,                               // Set true for transparent bg
})
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))  // Cap at 2x
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0

// Clock for frame-rate-independent animation
const clock = new THREE.Clock()

// Animation loop
function tick() {
  const delta = clock.getDelta()
  const elapsed = clock.getElapsedTime()

  // Update controls, physics, animations here

  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}
tick()

// Responsive resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
```

### Key decisions at setup time

| Decision | Recommendation |
|----------|---------------|
| `antialias` | `true` unless targeting very low-end mobile |
| `pixelRatio` | Always cap at 2 — retina screens at 3x kill performance |
| `toneMapping` | `ACESFilmicToneMapping` for cinematic look, `NoToneMapping` for flat/toon |
| `outputColorSpace` | `SRGBColorSpace` for correct color display |
| FOV | 45–55 for realistic, 70–80 for dramatic/wide, 20–35 for telephoto |

### Scene Background Options

```javascript
// Solid color
scene.background = new THREE.Color('#1a1a2e')

// Gradient via CSS on the canvas (set renderer alpha: true)
// Then style the page background with a CSS gradient

// Cubemap skybox
const cubeLoader = new THREE.CubeTextureLoader()
scene.background = cubeLoader.load([
  'px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'
])

// HDR environment (for reflections + background)
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
new RGBELoader().load('environment.hdr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = texture
  scene.background = texture
  scene.backgroundBlurriness = 0.05  // Subtle blur
})

// Fog (adds depth, hides far geometry pop-in)
scene.fog = new THREE.Fog('#1a1a2e', 10, 50)          // Linear
scene.fog = new THREE.FogExp2('#1a1a2e', 0.015)       // Exponential
```

---

## 2. Cameras & Controls

### PerspectiveCamera

Most common. Simulates human vision with depth perspective.

```javascript
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 100)
camera.position.set(0, 2, 5)
camera.lookAt(0, 0, 0)
```

### OrthographicCamera

No perspective distortion. Good for 2D games, isometric views, UI overlays.

```javascript
const frustumSize = 10
const aspect = window.innerWidth / window.innerHeight
const camera = new THREE.OrthographicCamera(
  -frustumSize * aspect / 2, frustumSize * aspect / 2,
  frustumSize / 2, -frustumSize / 2,
  0.1, 100
)
```

### OrbitControls (most common interactive camera)

```javascript
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true          // Smooth inertia
controls.dampingFactor = 0.05
controls.target.set(0, 1, 0)          // Orbit center
controls.minDistance = 2               // Zoom limits
controls.maxDistance = 20
controls.maxPolarAngle = Math.PI / 2   // Prevent going below ground
controls.autoRotate = false
controls.autoRotateSpeed = 2.0

// MUST call in animation loop
function tick() {
  controls.update()
  renderer.render(scene, camera)
}
```

### Custom Camera Animation (no controls library)

For scripted experiences (scroll-driven, cinematic):

```javascript
// Camera follows a path
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 2, 10),
  new THREE.Vector3(5, 3, 5),
  new THREE.Vector3(10, 1, 0),
  new THREE.Vector3(5, 2, -5),
])

function tick() {
  const t = elapsed * 0.05  // speed
  const point = curve.getPointAt(t % 1)
  camera.position.copy(point)
  camera.lookAt(0, 0, 0)
}
```

---

## 3. Geometry

### Built-In Primitives

```javascript
new THREE.BoxGeometry(1, 1, 1)                    // width, height, depth
new THREE.SphereGeometry(0.5, 32, 32)             // radius, w-segments, h-segments
new THREE.PlaneGeometry(10, 10)                    // width, height
new THREE.CylinderGeometry(0.5, 0.5, 1, 32)      // rTop, rBottom, height, segments
new THREE.ConeGeometry(0.5, 1, 32)                // radius, height, segments
new THREE.TorusGeometry(1, 0.4, 16, 100)          // radius, tube, radial, tubular
new THREE.TorusKnotGeometry(1, 0.3, 100, 16)
new THREE.CircleGeometry(1, 32)
new THREE.RingGeometry(0.5, 1, 32)
new THREE.CapsuleGeometry(0.5, 1, 4, 8)
new THREE.IcosahedronGeometry(1, 0)               // detail 0=20 faces
new THREE.DodecahedronGeometry(1, 0)
```

### Custom BufferGeometry

When you need vertices you control directly (terrain, custom shapes, particle positions):

```javascript
const geometry = new THREE.BufferGeometry()
const count = 500  // triangles
const positions = new Float32Array(count * 3 * 3)  // 3 vertices × 3 coords

for (let i = 0; i < count * 3 * 3; i++) {
  positions[i] = (Math.random() - 0.5) * 4
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
geometry.computeVertexNormals()  // Required for lighting
```

### Indexed Geometry (reuse vertices)

```javascript
const vertices = new Float32Array([
  -1, -1, 0,   1, -1, 0,   1, 1, 0,   -1, 1, 0
])
const indices = new Uint16Array([0, 1, 2, 0, 2, 3])

const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
geometry.setIndex(new THREE.BufferAttribute(indices, 1))
```

### InstancedMesh (draw thousands of copies efficiently)

The single most important optimization for many-object scenes:

```javascript
const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
const material = new THREE.MeshStandardMaterial({ color: '#ff6600' })
const count = 5000
const mesh = new THREE.InstancedMesh(geometry, material, count)

const dummy = new THREE.Object3D()
for (let i = 0; i < count; i++) {
  dummy.position.set(
    (Math.random() - 0.5) * 50,
    Math.random() * 10,
    (Math.random() - 0.5) * 50
  )
  dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
  dummy.scale.setScalar(0.5 + Math.random())
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
}
mesh.instanceMatrix.needsUpdate = true
scene.add(mesh)
```

### Merging Static Geometry

For scenes with many static meshes that won't animate individually:

```javascript
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const geometries = []
for (let i = 0; i < 100; i++) {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  geo.translate(Math.random() * 20, 0, Math.random() * 20)
  geometries.push(geo)
}
const merged = mergeGeometries(geometries)
const mesh = new THREE.Mesh(merged, material)
scene.add(mesh)  // 1 draw call instead of 100
```

---

## 4. Materials & Textures

### Material Types — When to Use What

| Material | Lights Needed | Shadows | Performance | Best For |
|----------|:---:|:---:|:---:|----------|
| `MeshBasicMaterial` | No | No | ★★★★★ | Flat color, wireframes, unlit scenes |
| `MeshMatcapMaterial` | No | No | ★★★★☆ | **Bruno Simon's go-to**. Fake lighting via matcap texture |
| `MeshLambertMaterial` | Yes | Yes | ★★★★☆ | Matte surfaces, low poly |
| `MeshPhongMaterial` | Yes | Yes | ★★★☆☆ | Shiny surfaces, specular highlights |
| `MeshToonMaterial` | Yes | Yes | ★★★☆☆ | Cel-shaded cartoon look |
| `MeshStandardMaterial` | Yes | Yes | ★★☆☆☆ | PBR. Most realistic. Default choice for lit scenes |
| `MeshPhysicalMaterial` | Yes | Yes | ★☆☆☆☆ | Advanced PBR: clearcoat, transmission, sheen |
| `ShaderMaterial` | Custom | Custom | Varies | Full control. Custom GLSL shaders |

### The Matcap Trick (Bruno Simon's Secret Weapon)

Matcap (Material Capture) materials use a pre-baked sphere texture that contains all lighting and reflection information. **No lights are needed in the scene.** This is how Bruno's portfolio achieves its look at high performance.

```javascript
const textureLoader = new THREE.TextureLoader()
const matcapTexture = textureLoader.load('/textures/matcap-clay.png')
matcapTexture.colorSpace = THREE.SRGBColorSpace  // Critical for correct colors

const material = new THREE.MeshMatcapMaterial({
  matcap: matcapTexture
})
```

**Where to find matcap textures:**
- https://github.com/nidorx/matcaps — Huge free library organized by color
- Create your own in Blender: render a sphere with your desired lighting setup

**Matcap limitations:**
- Lighting is view-relative (the lit side always faces the camera)
- Doesn't respond to scene lights or cast/receive shadows
- Works best when the camera orbit is limited or fixed

### Texture Loading

```javascript
const textureLoader = new THREE.TextureLoader()

// Basic color map
const colorTexture = textureLoader.load('/textures/color.jpg')
colorTexture.colorSpace = THREE.SRGBColorSpace  // Only for color/matcap maps!

// Other maps (keep in linear space — no colorSpace change)
const normalTexture = textureLoader.load('/textures/normal.jpg')
const roughnessTexture = textureLoader.load('/textures/roughness.jpg')
const aoTexture = textureLoader.load('/textures/ao.jpg')
const metalnessTexture = textureLoader.load('/textures/metalness.jpg')
const displacementTexture = textureLoader.load('/textures/displacement.jpg')

const material = new THREE.MeshStandardMaterial({
  map: colorTexture,
  normalMap: normalTexture,
  roughnessMap: roughnessTexture,
  aoMap: aoTexture,
  metalnessMap: metalnessTexture,
  displacementMap: displacementTexture,
  displacementScale: 0.1,
})
```

### Texture Optimization

```javascript
// Repeat and wrap
texture.wrapS = THREE.RepeatWrapping
texture.wrapT = THREE.RepeatWrapping
texture.repeat.set(4, 4)

// Filtering (critical for toon/pixel art styles)
texture.magFilter = THREE.NearestFilter    // Pixelated look (toon gradients)
texture.minFilter = THREE.NearestFilter
texture.generateMipmaps = false            // Disable mipmaps when using NearestFilter

// For standard textures
texture.minFilter = THREE.LinearMipmapLinearFilter  // Default, smooth
```

### Toon / Cel-Shading

```javascript
const gradientTexture = textureLoader.load('/textures/gradient-3-step.jpg')
gradientTexture.magFilter = THREE.NearestFilter  // Prevents smoothing between steps
gradientTexture.minFilter = THREE.NearestFilter
gradientTexture.generateMipmaps = false

const material = new THREE.MeshToonMaterial({
  color: '#ffcc00',
  gradientMap: gradientTexture  // Controls number of shading bands
})
```

### PBR Material (Standard)

```javascript
const material = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  metalness: 0.0,         // 0 = dielectric, 1 = metal
  roughness: 0.5,         // 0 = mirror, 1 = matte
  envMapIntensity: 1.0,   // Strength of environment reflections
})
```

### Physical Material (Advanced PBR)

```javascript
const material = new THREE.MeshPhysicalMaterial({
  // All Standard props plus:
  clearcoat: 1.0,          // Lacquer/car paint layer
  clearcoatRoughness: 0.1,
  transmission: 0.9,       // Glass-like transparency
  ior: 1.5,                // Index of refraction (glass = 1.5)
  thickness: 0.5,          // Simulated thickness for refraction
  sheen: 1.0,              // Fabric-like sheen
  sheenColor: new THREE.Color('#ffffff'),
  iridescence: 1.0,        // Rainbow film effect
})
```

### Environment Maps for Reflections

```javascript
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

const rgbeLoader = new RGBELoader()
rgbeLoader.load('/hdri/studio.hdr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = texture   // All PBR materials get reflections
  // scene.background = texture // Optional: use as sky too
})
```

---

## 5. Lighting — Real and Faked

### The Fake-It-First Approach

Before adding real lights, consider whether you need them:

| Technique | Lights Needed | Shadows | Performance |
|-----------|:---:|:---:|:---:|
| Matcap materials | None | Fake with blob texture | Excellent |
| Baked lighting in Blender | None | Baked into texture | Excellent |
| Environment map only | None | No | Good |
| Real Three.js lights | Yes | Optional | Moderate-Heavy |

Bruno Simon's 2019 portfolio has **zero real lights or shadows** — everything is matcaps and tricks.

### Real Light Types (when you need them)

```javascript
// Ambient — flat fill, no direction
const ambient = new THREE.AmbientLight('#ffffff', 0.5)
scene.add(ambient)

// Hemisphere — sky/ground gradient
const hemi = new THREE.HemisphereLight('#87ceeb', '#8b4513', 0.6)
scene.add(hemi)

// Directional — parallel rays (sun)
const sun = new THREE.DirectionalLight('#ffffff', 1.5)
sun.position.set(5, 10, 5)
scene.add(sun)

// Point — omnidirectional (bulb)
const bulb = new THREE.PointLight('#ff9900', 1, 20, 2)
bulb.position.set(0, 3, 0)
scene.add(bulb)

// Spot — cone (flashlight, stage)
const spot = new THREE.SpotLight('#ffffff', 1, 30, Math.PI / 6, 0.5, 2)
spot.position.set(0, 10, 0)
spot.target.position.set(0, 0, 0)
scene.add(spot)
scene.add(spot.target)

// RectArea — soft rectangular (window, studio softbox)
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
RectAreaLightUniformsLib.init()
const rect = new THREE.RectAreaLight('#ffffff', 5, 4, 2)
rect.position.set(0, 5, 0)
rect.lookAt(0, 0, 0)
scene.add(rect)
// Only works with MeshStandardMaterial and MeshPhysicalMaterial
```

### Three-Point Lighting Setup

Classic film/studio setup:

```javascript
// Key light (main)
const key = new THREE.DirectionalLight('#ffffcc', 1.2)
key.position.set(5, 5, 5)
key.castShadow = true
scene.add(key)

// Fill light (softer, opposite side)
const fill = new THREE.DirectionalLight('#ccccff', 0.5)
fill.position.set(-5, 3, 5)
scene.add(fill)

// Back / rim light
const rim = new THREE.DirectionalLight('#ffffff', 0.3)
rim.position.set(0, 5, -5)
scene.add(rim)

// Ambient fill
scene.add(new THREE.AmbientLight('#404040', 0.3))
```

### Light Helpers (for debugging)

```javascript
scene.add(new THREE.DirectionalLightHelper(sun, 2))
scene.add(new THREE.PointLightHelper(bulb, 0.5))
scene.add(new THREE.SpotLightHelper(spot))
scene.add(new THREE.CameraHelper(sun.shadow.camera))  // Shadow frustum
```

---

## 6. Shadows — Real and Faked

### Enabling Real Shadows

```javascript
// 1. Renderer
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// 2. Light
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)  // Quality (512, 1024, 2048, 4096)
sun.shadow.camera.near = 0.5
sun.shadow.camera.far = 30

// Tight frustum — critical for quality
const d = 10
sun.shadow.camera.left = -d
sun.shadow.camera.right = d
sun.shadow.camera.top = d
sun.shadow.camera.bottom = -d

// Fix shadow artifacts
sun.shadow.bias = -0.0001
sun.shadow.normalBias = 0.02

// 3. Objects
mesh.castShadow = true
ground.receiveShadow = true
```

### Fake Shadow (Bruno's Approach) — Blob Shadow

A transparent circle texture under each object. Zero cost, looks great at distance:

```javascript
const shadowTexture = textureLoader.load('/textures/roundshadow.png')
const shadowMaterial = new THREE.MeshBasicMaterial({
  map: shadowTexture,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,        // Prevents z-fighting
})

const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1.5, 1.5),
  shadowMaterial
)
shadowPlane.rotation.x = -Math.PI / 2
shadowPlane.position.y = 0.01  // Just above ground
scene.add(shadowPlane)

// Move shadow with its object in animation loop
shadowPlane.position.x = object.position.x
shadowPlane.position.z = object.position.z
```

### Baked Shadows (from Blender)

Best for static scenes. Bake lighting and shadows into textures in Blender, then use `MeshBasicMaterial` with the baked texture. No runtime lighting cost at all.

---

## 7. Animation

### Frame-Rate-Independent Animation

Always use `Clock.getDelta()` or `Clock.getElapsedTime()`:

```javascript
const clock = new THREE.Clock()

function tick() {
  const delta = clock.getDelta()      // Seconds since last frame
  const elapsed = clock.getElapsedTime()  // Total seconds

  // Rotation at consistent speed regardless of FPS
  mesh.rotation.y += delta * 0.5

  // Oscillation
  mesh.position.y = Math.sin(elapsed * 2) * 0.5

  // Circular orbit
  mesh.position.x = Math.cos(elapsed) * 3
  mesh.position.z = Math.sin(elapsed) * 3

  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}
```

### GSAP for Tweened Animation

GSAP is the go-to for smooth, eased animations in creative Three.js work:

```javascript
import gsap from 'gsap'

// Animate position
gsap.to(mesh.position, {
  x: 3,
  duration: 1.5,
  ease: 'power2.inOut',
})

// Animate material properties
gsap.to(mesh.material, {
  opacity: 0,
  duration: 0.5,
  ease: 'power1.out',
})

// Animate camera
gsap.to(camera.position, {
  x: 5, y: 3, z: 8,
  duration: 2,
  ease: 'power3.inOut',
  onUpdate: () => camera.lookAt(0, 0, 0),
})

// Timeline for sequenced animations
const tl = gsap.timeline()
tl.to(mesh.position, { y: 2, duration: 0.5 })
  .to(mesh.rotation, { y: Math.PI, duration: 0.8 }, '-=0.2')
  .to(mesh.scale, { x: 2, y: 2, z: 2, duration: 0.3 })
```

### Keyframe Animation System (Three.js built-in)

For playing animations embedded in GLTF models:

```javascript
const mixer = new THREE.AnimationMixer(model)

// Play a clip
const clip = THREE.AnimationClip.findByName(gltf.animations, 'Walk')
const action = mixer.clipAction(clip)
action.play()

// Crossfade between animations
const idleAction = mixer.clipAction(idleClip)
const walkAction = mixer.clipAction(walkClip)
idleAction.play()

// Transition
idleAction.crossFadeTo(walkAction, 0.5, true)
walkAction.play()

// In animation loop
function tick() {
  mixer.update(delta)
}
```

### Procedural Motion Patterns

```javascript
function tick() {
  const t = clock.getElapsedTime()

  // Bobbing
  mesh.position.y = Math.sin(t * 2) * 0.3 + 1

  // Breathing scale
  const breathe = 1 + Math.sin(t * 1.5) * 0.05
  mesh.scale.set(breathe, breathe, breathe)

  // Figure-8
  mesh.position.x = Math.sin(t) * 3
  mesh.position.z = Math.sin(t * 2) * 1.5

  // Smooth damping toward target
  mesh.position.lerp(targetPosition, 0.05)

  // Spring physics
  velocity += (target - position) * stiffness
  velocity *= damping
  position += velocity
}
```

---

## 8. Physics with Cannon-es

Physics make experiences feel tangible. Bruno Simon used Cannon.js for his portfolio's car, bowling pins, and destructible text.

### Setup

```bash
npm install cannon-es
```

```javascript
import * as CANNON from 'cannon-es'

// Physics world
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
})

// Broadphase (performance optimization for collision detection)
world.broadphase = new CANNON.SAPBroadphase(world)

// Allow sleeping (bodies at rest stop computing)
world.allowSleep = true
```

### Core Concept: Mirror Three.js Meshes with Physics Bodies

The fundamental pattern: create a visual mesh AND a physics body, then sync them each frame.

```javascript
// Track all physics objects
const objectsToUpdate = []

function createSphere(radius, position) {
  // Three.js mesh (visual)
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 32),
    new THREE.MeshStandardMaterial({ color: '#ff6600' })
  )
  mesh.castShadow = true
  mesh.position.copy(position)
  scene.add(mesh)

  // Cannon-es body (physics)
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(position.x, position.y, position.z),
  })
  world.addBody(body)

  // Track the pair
  objectsToUpdate.push({ mesh, body })
}

function createBox(width, height, depth, position) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: '#4488ff' })
  )
  mesh.castShadow = true
  mesh.position.copy(position)
  scene.add(mesh)

  // IMPORTANT: Cannon uses HALF-extents
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)),
    position: new CANNON.Vec3(position.x, position.y, position.z),
  })
  world.addBody(body)

  objectsToUpdate.push({ mesh, body })
}
```

### Ground / Static Bodies

```javascript
const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,           // mass: 0 also works
  shape: new CANNON.Plane(),
})
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)  // Face up
world.addBody(groundBody)
```

### Materials & Contact (Bounce and Friction)

```javascript
const defaultMaterial = new CANNON.Material('default')
const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.1,
    restitution: 0.7,  // Bounciness (0 = no bounce, 1 = full bounce)
  }
)
world.addContactMaterial(defaultContactMaterial)
world.defaultContactMaterial = defaultContactMaterial
```

### Applying Forces

```javascript
// Impulse (instant force, like a hit)
body.applyImpulse(
  new CANNON.Vec3(5, 0, 0),       // Force direction + magnitude
  new CANNON.Vec3(0, 0, 0)        // Point on body to apply (world coords)
)

// Continuous force (like wind or thrust)
body.applyForce(
  new CANNON.Vec3(0, 50, 0),
  body.position
)

// Set velocity directly
body.velocity.set(0, 10, 0)
```

### Collision Events

```javascript
body.addEventListener('collide', (event) => {
  const impactStrength = event.contact.getImpactVelocityAlongNormal()

  if (impactStrength > 1.5) {
    // Play sound, spawn particles, etc.
    playHitSound(impactStrength)
  }
})
```

### The Animation Loop (Sync Physics → Three.js)

```javascript
function tick() {
  const delta = clock.getDelta()

  // Step the physics world
  world.step(1 / 60, delta, 3)  // fixedStep, dt, maxSubSteps

  // Sync every physics body to its mesh
  for (const { mesh, body } of objectsToUpdate) {
    mesh.position.copy(body.position)
    mesh.quaternion.copy(body.quaternion)
  }

  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}
```

### Compound Shapes (for complex objects)

Bruno's approach: use simple physics primitives to approximate complex visual models.

```javascript
// Car made of box + wheels
const carBody = new CANNON.Body({ mass: 5 })

// Main chassis
carBody.addShape(
  new CANNON.Box(new CANNON.Vec3(1, 0.3, 0.5)),
  new CANNON.Vec3(0, 0.3, 0)  // offset
)

// Cabin
carBody.addShape(
  new CANNON.Box(new CANNON.Vec3(0.5, 0.3, 0.4)),
  new CANNON.Vec3(-0.1, 0.8, 0)
)

world.addBody(carBody)
```

### Constraints

```javascript
// Hinge (door, wheel)
const hinge = new CANNON.HingeConstraint(bodyA, bodyB, {
  pivotA: new CANNON.Vec3(1, 0, 0),
  axisA: new CANNON.Vec3(0, 1, 0),
  pivotB: new CANNON.Vec3(-1, 0, 0),
  axisB: new CANNON.Vec3(0, 1, 0),
})
world.addConstraint(hinge)

// Distance (rope, spring)
const dist = new CANNON.DistanceConstraint(bodyA, bodyB, 2)
world.addConstraint(dist)

// Lock (weld bodies together)
const lock = new CANNON.LockConstraint(bodyA, bodyB)
world.addConstraint(lock)

// Spring
const spring = new CANNON.Spring(bodyA, bodyB, {
  restLength: 1,
  stiffness: 50,
  damping: 5,
})
// Apply spring force each step
world.addEventListener('postStep', () => {
  spring.applyForce()
})
```

### Cleanup

```javascript
function removeObject(obj) {
  // Remove from Three.js
  scene.remove(obj.mesh)
  obj.mesh.geometry.dispose()
  obj.mesh.material.dispose()

  // Remove from Cannon
  world.removeBody(obj.body)

  // Remove from tracking array
  const index = objectsToUpdate.indexOf(obj)
  if (index > -1) objectsToUpdate.splice(index, 1)
}
```

---

## 9. Loading Models (GLTF/GLB)

GLTF is the "JPEG of 3D." GLB is the binary version (single file). Always prefer these formats.

### Basic Loading

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

// Optional: Draco compression decoder (much smaller files)
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')  // Copy from node_modules/three/examples/jsm/libs/draco/

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

gltfLoader.load('/models/scene.glb', (gltf) => {
  const model = gltf.scene

  // Optional: scale and position
  model.scale.set(0.5, 0.5, 0.5)
  model.position.set(0, 0, 0)

  // Enable shadows on all meshes
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  scene.add(model)

  // If model has animations
  if (gltf.animations.length > 0) {
    const mixer = new THREE.AnimationMixer(model)
    const action = mixer.clipAction(gltf.animations[0])
    action.play()
    // Store mixer for update loop
  }
})
```

### Loading Manager (progress tracking)

```javascript
const loadingManager = new THREE.LoadingManager()

loadingManager.onStart = () => {
  console.log('Loading started')
}

loadingManager.onProgress = (url, loaded, total) => {
  const progress = loaded / total
  // Update loading bar UI
}

loadingManager.onLoad = () => {
  // Hide loading screen, start experience
  gsap.to('.loading-screen', { opacity: 0, duration: 0.5 })
}

const textureLoader = new THREE.TextureLoader(loadingManager)
const gltfLoader = new GLTFLoader(loadingManager)
```

### Baked Scene Workflow (Blender → Three.js)

1. Model and light your scene in Blender
2. Bake all lighting to textures (Cycles render, bake diffuse + lighting)
3. Export as GLTF with baked textures
4. In Three.js, replace materials with `MeshBasicMaterial` using the baked texture
5. Result: a beautiful scene with **zero runtime lighting cost**

```javascript
gltfLoader.load('/models/baked-room.glb', (gltf) => {
  const bakedTexture = textureLoader.load('/textures/baked.jpg')
  bakedTexture.flipY = false  // GLTF textures are flipped
  bakedTexture.colorSpace = THREE.SRGBColorSpace

  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshBasicMaterial({ map: bakedTexture })
    }
  })

  scene.add(gltf.scene)
})
```

---

## 10. Particles

### Points-Based Particles

```javascript
const count = 10000
const positions = new Float32Array(count * 3)
const colors = new Float32Array(count * 3)

for (let i = 0; i < count; i++) {
  const i3 = i * 3
  positions[i3]     = (Math.random() - 0.5) * 20
  positions[i3 + 1] = Math.random() * 10
  positions[i3 + 2] = (Math.random() - 0.5) * 20

  colors[i3]     = Math.random()
  colors[i3 + 1] = Math.random()
  colors[i3 + 2] = Math.random()
}

const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

const material = new THREE.PointsMaterial({
  size: 0.1,
  sizeAttenuation: true,   // Smaller with distance
  vertexColors: true,
  transparent: true,
  alphaMap: textureLoader.load('/textures/particle.png'),
  depthWrite: false,       // Prevents particles hiding each other
  blending: THREE.AdditiveBlending,  // Glow effect
})

const particles = new THREE.Points(geometry, material)
scene.add(particles)
```

### Animating Particles

```javascript
function tick() {
  const positions = particles.geometry.attributes.position.array

  for (let i = 0; i < count; i++) {
    const i3 = i * 3

    // Wave animation
    positions[i3 + 1] = Math.sin(elapsed + positions[i3]) * 0.5
  }

  particles.geometry.attributes.position.needsUpdate = true
}
```

### Galaxy Generator (Classic Bruno Simon Exercise)

```javascript
function generateGalaxy(params) {
  const { count, size, radius, branches, spin, randomness, randomnessPower, insideColor, outsideColor } = params

  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  const colorInside = new THREE.Color(insideColor)
  const colorOutside = new THREE.Color(outsideColor)

  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const r = Math.random() * radius
    const branchAngle = (i % branches) / branches * Math.PI * 2
    const spinAngle = r * spin

    const randomX = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
    const randomY = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
    const randomZ = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * r

    positions[i3]     = Math.cos(branchAngle + spinAngle) * r + randomX
    positions[i3 + 1] = randomY
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ

    const mixedColor = colorInside.clone().lerp(colorOutside, r / radius)
    colors[i3]     = mixedColor.r
    colors[i3 + 1] = mixedColor.g
    colors[i3 + 2] = mixedColor.b
  }

  // ... create BufferGeometry + Points as above
}
```

---

## 11. Raycasting & Interaction

### Mouse Click Detection

```javascript
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

function onClick(event) {
  // Convert screen coords to normalized device coords (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(clickableObjects, true)

  if (intersects.length > 0) {
    const hit = intersects[0]
    console.log('Hit:', hit.object.name, 'at:', hit.point)
  }
}

window.addEventListener('click', onClick)
```

### Hover Effects

```javascript
let hoveredObject = null

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(hoverables)

  if (intersects.length > 0) {
    if (hoveredObject !== intersects[0].object) {
      // Mouse enter
      hoveredObject = intersects[0].object
      document.body.style.cursor = 'pointer'
      gsap.to(hoveredObject.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.3 })
    }
  } else if (hoveredObject) {
    // Mouse leave
    document.body.style.cursor = 'default'
    gsap.to(hoveredObject.scale, { x: 1, y: 1, z: 1, duration: 0.3 })
    hoveredObject = null
  }
}

window.addEventListener('mousemove', onMouseMove)
```

### For Canvas Inside a Container (not fullscreen)

```javascript
function getMouseFromEvent(event, canvas) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
  }
}
```

### Touch Support

```javascript
function onTouchStart(event) {
  if (event.touches.length === 1) {
    const touch = event.touches[0]
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(clickableObjects)
    if (intersects.length > 0) {
      handleClick(intersects[0])
    }
  }
}
canvas.addEventListener('touchstart', onTouchStart)
```

---

## 12. Shaders (GLSL)

Shaders unlock the full power of the GPU. Bruno Simon considers this the "leveling up" moment.

### Shader Material Basics

```javascript
const material = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec2 vUv;
    uniform float uTime;

    void main() {
      vUv = uv;

      vec3 pos = position;
      pos.z += sin(pos.x * 5.0 + uTime) * 0.2;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uTime;

    void main() {
      float strength = sin(vUv.x * 20.0 + uTime) * 0.5 + 0.5;
      gl_FragColor = vec4(vec3(strength), 1.0);
    }
  `,
  uniforms: {
    uTime: { value: 0 },
  },
})

// Update in loop
function tick() {
  material.uniforms.uTime.value = clock.getElapsedTime()
}
```

### Common Uniforms

```javascript
uniforms: {
  uTime:       { value: 0.0 },
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uMouse:      { value: new THREE.Vector2(0, 0) },
  uColor:      { value: new THREE.Color('#ff6600') },
  uTexture:    { value: someTexture },
  uProgress:   { value: 0.0 },  // For transitions
}
```

### GLSL Essentials Cheat Sheet

```glsl
// Types
float, vec2, vec3, vec4, mat2, mat3, mat4, sampler2D

// Built-in functions
sin(x), cos(x), tan(x)
abs(x), floor(x), ceil(x), fract(x)
mod(x, y)                     // Modulo
min(a, b), max(a, b)
clamp(x, min, max)
mix(a, b, t)                  // Lerp
smoothstep(edge0, edge1, x)   // Smooth interpolation
step(edge, x)                 // 0 if x < edge, 1 otherwise
length(v)                     // Vector length
distance(a, b)
normalize(v)
dot(a, b)
cross(a, b)
reflect(incident, normal)

// Texture sampling
texture2D(sampler, uv)

// Vertex shader built-ins
position, normal, uv           // Attributes
projectionMatrix, modelViewMatrix, modelMatrix, viewMatrix
gl_Position                    // Output: clip space position

// Fragment shader
gl_FragColor                   // Output: pixel color (vec4)
gl_FragCoord                   // Pixel coordinates
```

### Useful Shader Patterns

```glsl
// Noise-based displacement (vertex)
float noise = sin(position.x * 5.0 + uTime) * cos(position.z * 5.0 + uTime) * 0.3;
pos.y += noise;

// Radial gradient (fragment)
float dist = distance(vUv, vec2(0.5));
float strength = 1.0 - dist * 2.0;

// Stripes
float stripes = step(0.5, fract(vUv.x * 10.0));

// Circle
float circle = step(0.3, distance(vUv, vec2(0.5)));

// Fresnel effect (rim glow)
float fresnel = pow(1.0 - dot(vNormal, normalize(cameraPosition - vWorldPosition)), 3.0);
```

### RawShaderMaterial vs ShaderMaterial

- `ShaderMaterial` — Automatically injects Three.js uniforms (`projectionMatrix`, `modelViewMatrix`, etc.) and attributes (`position`, `uv`, `normal`).
- `RawShaderMaterial` — You must declare everything yourself. More verbose but full control.

---

## 13. Post-Processing

Post-processing applies screen-space effects after the scene renders. Bloom, vignette, color grading, etc.

### Setup

```javascript
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const composer = new EffectComposer(renderer)

// 1. Always start with RenderPass
composer.addPass(new RenderPass(scene, camera))

// 2. Add effect passes
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5,    // strength
  0.4,    // radius
  0.85    // threshold (only pixels brighter than this glow)
)
composer.addPass(bloomPass)

// 3. Always end with OutputPass (handles color space)
composer.addPass(new OutputPass())

// 4. Use composer.render() instead of renderer.render()
function tick() {
  composer.render()  // NOT renderer.render(scene, camera)
}
```

### Common Passes

```javascript
// Bloom (glow)
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

// Antialiasing (WebGL AA is bypassed with post-processing)
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight)

// Vignette
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js'
const vignettePass = new ShaderPass(VignetteShader)
vignettePass.uniforms['offset'].value = 0.95
vignettePass.uniforms['darkness'].value = 1.2

// Film grain
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js'
const filmPass = new FilmPass(0.35, false)

// Glitch
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js'
const glitchPass = new GlitchPass()

// Depth of field
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
const bokehPass = new BokehPass(scene, camera, {
  focus: 5.0,
  aperture: 0.003,
  maxblur: 0.01,
})
```

### Custom Post-Processing Shader

```javascript
const myEffect = {
  uniforms: {
    tDiffuse: { value: null },  // Previous pass texture (auto-filled)
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // Slight wave distortion
      uv.x += sin(uv.y * 20.0 + uTime) * 0.003;

      vec4 color = texture2D(tDiffuse, uv);

      // Color tint
      color.rgb = mix(color.rgb, vec3(1.0, 0.8, 0.6), 0.1);

      gl_FragColor = color;
    }
  `
}

const customPass = new ShaderPass(myEffect)
composer.addPass(customPass)

function tick() {
  customPass.uniforms.uTime.value = elapsed
  composer.render()
}
```

### Selective Bloom (Bloom only on certain objects)

Uses layers to separate blooming from non-blooming objects:

```javascript
const BLOOM_LAYER = 1
const bloomLayer = new THREE.Layers()
bloomLayer.set(BLOOM_LAYER)

// Mark objects to bloom
glowingMesh.layers.enable(BLOOM_LAYER)

const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
const materials = {}

function darkenNonBloomed(obj) {
  if (obj.isMesh && !bloomLayer.test(obj.layers)) {
    materials[obj.uuid] = obj.material
    obj.material = darkMaterial
  }
}

function restoreMaterial(obj) {
  if (materials[obj.uuid]) {
    obj.material = materials[obj.uuid]
    delete materials[obj.uuid]
  }
}

// Custom render
function render() {
  scene.traverse(darkenNonBloomed)
  composer.render()
  scene.traverse(restoreMaterial)
}
```

---

## 14. Scroll-Based Experiences

A signature of creative web development — tying 3D scenes to scroll position.

### Basic Scroll-Driven Camera

```javascript
let scrollY = window.scrollY
window.addEventListener('scroll', () => {
  scrollY = window.scrollY
})

function tick() {
  // Move camera based on scroll
  camera.position.y = -(scrollY / window.innerHeight) * 4

  renderer.render(scene, camera)
}
```

### Section-Based Scroll

```javascript
const objectsDistance = 4  // Spacing between sections

const meshes = [mesh1, mesh2, mesh3]
meshes.forEach((mesh, i) => {
  mesh.position.y = -i * objectsDistance
})

function tick() {
  const scrollProgress = scrollY / window.innerHeight

  camera.position.y = -scrollProgress * objectsDistance

  // Rotate meshes based on scroll
  for (const mesh of meshes) {
    mesh.rotation.y = scrollProgress * 0.5
    mesh.rotation.x = scrollProgress * 0.3
  }
}
```

### Parallax on Mouse Move

```javascript
const cursor = { x: 0, y: 0 }

window.addEventListener('mousemove', (event) => {
  cursor.x = event.clientX / window.innerWidth - 0.5
  cursor.y = event.clientY / window.innerHeight - 0.5
})

function tick() {
  // Smooth parallax
  const parallaxX = cursor.x * 0.5
  const parallaxY = -cursor.y * 0.5

  // Smooth damping
  cameraGroup.position.x += (parallaxX - cameraGroup.position.x) * delta * 5
  cameraGroup.position.y += (parallaxY - cameraGroup.position.y) * delta * 5
}
```

### GSAP ScrollTrigger Integration

```javascript
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)

gsap.to(mesh.rotation, {
  y: Math.PI * 2,
  scrollTrigger: {
    trigger: '.section-two',
    start: 'top bottom',
    end: 'bottom top',
    scrub: 1,           // Smooth scrubbing
  }
})
```

---

## 15. Performance Optimization

### The Performance Checklist

**Geometry:**
- Use `InstancedMesh` for repeated objects (not individual meshes)
- Merge static geometries with `mergeGeometries()`
- Lower segment counts on distant or small objects
- Use LOD (`THREE.LOD`) for distance-based mesh swapping

**Materials:**
- Use `MeshMatcapMaterial` or `MeshBasicMaterial` when possible — avoid expensive PBR
- Share materials between meshes (don't create new instances for identical materials)
- Avoid `MeshPhysicalMaterial` unless you truly need transmission, clearcoat, etc.

**Textures:**
- Use power-of-2 dimensions (512, 1024, 2048)
- Compress with KTX2/Basis for GPU-compressed textures
- Don't exceed 2048×2048 unless close-up
- Use `texture.dispose()` when done

**Lights & Shadows:**
- Minimize light count (each light = extra shader work)
- Use matcaps or baked lighting instead of real-time
- Tight shadow frustums — use `CameraHelper` to visualize
- Shadow map sizes: 512 for distant, 1024 standard, 2048 hero objects
- Disable shadows on small/unimportant objects

**Renderer:**
- Cap `pixelRatio` at 2
- Use `frustumCulling` (on by default)
- Limit draw calls: check with `renderer.info.render.calls`

**Physics:**
- Use `SAPBroadphase` instead of `NaiveBroadphase`
- Enable `allowSleep` on the world
- Use simple physics shapes (boxes, spheres) — never use Trimesh for dynamic bodies
- Lower solver iterations for less critical simulations

**Monitoring:**
```javascript
import Stats from 'three/addons/libs/stats.module.js'

const stats = new Stats()
document.body.appendChild(stats.dom)

function tick() {
  stats.begin()
  // ... render
  stats.end()
}

// Check draw calls
console.log(renderer.info.render)
// { calls: 42, triangles: 15000, points: 0, lines: 0 }
```

---

## 16. Project Architecture

### Bruno Simon's Approach (Class-Based)

For complex projects, organize into classes:

```
src/
  Experience/
    Experience.js       # Main orchestrator (singleton)
    Camera.js           # Camera + controls
    Renderer.js         # WebGL renderer setup
    World/
      World.js          # Scene content manager
      Environment.js    # Lights, fog, env maps
      Floor.js          # Ground plane
      Character.js      # Animated character
    Utils/
      Time.js           # Clock wrapper (delta, elapsed)
      Sizes.js          # Viewport + resize handling
      Resources.js      # Asset loader + manager
      Debug.js          # lil-gui wrapper
    sources.js          # Asset manifest
  style.css
  index.js              # Entry point
```

### Experience Singleton Pattern

```javascript
// Experience.js
import * as THREE from 'three'
import Camera from './Camera.js'
import Renderer from './Renderer.js'
import World from './World/World.js'
import Sizes from './Utils/Sizes.js'
import Time from './Utils/Time.js'
import Resources from './Utils/Resources.js'
import Debug from './Utils/Debug.js'
import sources from './sources.js'

let instance = null

export default class Experience {
  constructor(canvas) {
    if (instance) return instance
    instance = this

    this.canvas = canvas
    this.debug = new Debug()
    this.sizes = new Sizes()
    this.time = new Time()
    this.scene = new THREE.Scene()
    this.resources = new Resources(sources)
    this.camera = new Camera()
    this.renderer = new Renderer()
    this.world = new World()

    // Events
    this.sizes.on('resize', () => this.resize())
    this.time.on('tick', () => this.update())
  }

  resize() {
    this.camera.resize()
    this.renderer.resize()
  }

  update() {
    this.camera.update()
    this.world.update()
    this.renderer.update()
  }
}
```

### Debug Panel (gated behind URL hash)

```javascript
import GUI from 'lil-gui'

export default class Debug {
  constructor() {
    this.active = window.location.hash === '#debug'

    if (this.active) {
      this.gui = new GUI()
    }
  }
}

// Usage in any class:
if (this.debug.active) {
  const folder = this.debug.gui.addFolder('Lights')
  folder.add(light, 'intensity', 0, 5, 0.01)
  folder.addColor(light, 'color')
}
```

---

## 17. Creative Recipes

### Recipe: Floating Objects (dreamy, slow motion)

```javascript
const objects = []

for (let i = 0; i < 20; i++) {
  const geo = new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.3, 0)
  const mat = new THREE.MeshMatcapMaterial({ matcap: matcapTexture })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(
    (Math.random() - 0.5) * 10,
    Math.random() * 5,
    (Math.random() - 0.5) * 10
  )
  mesh.userData.speed = 0.2 + Math.random() * 0.5
  mesh.userData.offset = Math.random() * Math.PI * 2
  scene.add(mesh)
  objects.push(mesh)
}

function tick() {
  const t = clock.getElapsedTime()
  for (const obj of objects) {
    obj.position.y += Math.sin(t * obj.userData.speed + obj.userData.offset) * 0.002
    obj.rotation.x += 0.002
    obj.rotation.y += 0.003
  }
}
```

### Recipe: Text That You Can Hit (Bruno's bowling-pin-style)

Combine physics bodies with 3D text or letters. Create a CANNON box per letter, let the user knock them over with a physics-enabled projectile.

### Recipe: Infinite Procedural World

```javascript
// Generate terrain chunks around the camera
const chunkSize = 20
const visibleChunks = new Map()

function updateChunks() {
  const camChunkX = Math.floor(camera.position.x / chunkSize)
  const camChunkZ = Math.floor(camera.position.z / chunkSize)

  for (let x = camChunkX - 2; x <= camChunkX + 2; x++) {
    for (let z = camChunkZ - 2; z <= camChunkZ + 2; z++) {
      const key = `${x},${z}`
      if (!visibleChunks.has(key)) {
        const chunk = generateChunk(x, z)
        visibleChunks.set(key, chunk)
        scene.add(chunk)
      }
    }
  }

  // Remove distant chunks
  for (const [key, chunk] of visibleChunks) {
    const [x, z] = key.split(',').map(Number)
    if (Math.abs(x - camChunkX) > 3 || Math.abs(z - camChunkZ) > 3) {
      scene.remove(chunk)
      chunk.geometry.dispose()
      chunk.material.dispose()
      visibleChunks.delete(key)
    }
  }
}
```

### Recipe: HTML Labels Over 3D Objects

```javascript
function updateLabel(object3D, htmlElement) {
  const pos = object3D.position.clone()
  pos.project(camera)

  const x = (pos.x * 0.5 + 0.5) * window.innerWidth
  const y = (-pos.y * 0.5 + 0.5) * window.innerHeight

  htmlElement.style.transform = `translate(${x}px, ${y}px)`

  // Hide if behind camera
  htmlElement.style.display = pos.z > 1 ? 'none' : 'block'
}
```

### Recipe: Portal / Scene Transition

Use render targets to render one scene to a texture, display it on a plane (the "portal"), then transition:

```javascript
const renderTarget = new THREE.WebGLRenderTarget(1024, 1024)
const portalMaterial = new THREE.MeshBasicMaterial({
  map: renderTarget.texture
})
const portalPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 3),
  portalMaterial
)
scene.add(portalPlane)

function tick() {
  // Render alternate scene to texture
  renderer.setRenderTarget(renderTarget)
  renderer.render(otherScene, otherCamera)
  renderer.setRenderTarget(null)

  // Render main scene normally
  renderer.render(scene, camera)
}
```

---

## 18. Common Gotchas

### Color Space

Textures used as `map` or `matcap` must be set to sRGB:
```javascript
texture.colorSpace = THREE.SRGBColorSpace
```
Normal maps, roughness maps, metalness maps, and other data textures must stay in linear space (the default). Getting this wrong makes everything look washed out or too dark.

### GLTF Texture Flip

GLTF models have their textures flipped:
```javascript
bakedTexture.flipY = false
```

### Cannon-es Half-Extents

Cannon-es `Box` shape uses **half-extents**, not full dimensions:
```javascript
// Three.js box: width=2, height=2, depth=2
new THREE.BoxGeometry(2, 2, 2)

// Cannon-es equivalent: half of each dimension
new CANNON.Box(new CANNON.Vec3(1, 1, 1))
```

### Dispose Everything

Three.js does not garbage collect GPU resources. You must manually dispose:
```javascript
geometry.dispose()
material.dispose()
texture.dispose()
renderTarget.dispose()
renderer.dispose()
```

### PixelRatio on Resize

Always re-apply pixel ratio when resizing:
```javascript
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
```

### OrbitControls Blocks UI

If OrbitControls consume click events, disable them during drag/transform operations:
```javascript
transformControls.addEventListener('dragging-changed', (event) => {
  orbitControls.enabled = !event.value
})
```

### Shadow Acne

Shadowy lines on surfaces receiving their own shadow:
```javascript
light.shadow.bias = -0.0001
light.shadow.normalBias = 0.02
```

### Post-Processing Kills Antialiasing

WebGL's built-in AA is bypassed when using EffectComposer. Add an AA pass:
```javascript
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
composer.addPass(new SMAAPass(width, height))
```

---

## Quick Reference: Imports

```javascript
// Core
import * as THREE from 'three'

// Controls
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// Loaders
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

// Post-processing
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'

// Utilities
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import Stats from 'three/addons/libs/stats.module.js'

// Physics (separate package)
import * as CANNON from 'cannon-es'

// Animation
import gsap from 'gsap'
```

---

## CDN Usage (for single-file projects / artifacts)

When building single-file HTML/JS artifacts without a bundler:

```javascript
import * as THREE from 'three'
// In artifact environments, Three.js r128 is available globally
// OrbitControls and other addons may need CDN:
// https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
```

**Note:** When using Three.js r128 (the CDN version available in many artifact environments):
- `CapsuleGeometry` was introduced in r142 — use `CylinderGeometry` + `SphereGeometry` instead
- Import paths differ from modern `three/addons/` style
- Some newer features like `outputColorSpace` may not be available (use `outputEncoding = THREE.sRGBEncoding` instead)

---

## Summary: The Bruno Simon Workflow

1. **Prototype fast** — Get geometry on screen. Use basic materials.
2. **Fake everything you can** — Matcaps over lights. Blob shadows over shadow maps. Simple physics shapes over precise collision meshes.
3. **Add physics early** — It transforms the feel of the experience immediately.
4. **Debug panel from day one** — Expose every number. Tweak obsessively. Gate behind `#debug`.
5. **Performance budget** — Check `renderer.info`, use Stats.js, test on mobile. Cut before it's too late.
6. **Polish last** — Post-processing, particle effects, easing curves, sound. These are the 20% that make it feel 80% more complete.
7. **Ship it** — A finished creative project that runs at 60fps beats a perfect one that never launches.