# Installing three.js

A beginner-friendly guide to adding **three.js** (3D graphics in the browser) to a project.

---

## 1. What three.js Is

three.js is a JavaScript library that wraps **WebGL** so you can render 3D scenes — meshes, cameras, lights, materials — without writing raw GPU code. It runs in any modern browser.

You almost always use it **inside a build-tooled project** (Vite, etc.) so imports and TypeScript work. There's also a no-build CDN option for quick tests.

---

## 2. Prerequisites

- **Node.js 18+** and npm — check with `node --version` / `npm --version`
- An existing project with a bundler. If you don't have one:
  ```bash
  npm create vite@latest my-app
  cd my-app
  npm install
  ```
  (See the *Installing React* tutorial for the full Vite walkthrough.)

---

## 3. Install into a Project (recommended)

```bash
npm install three
```

If you use **TypeScript**, also add the type definitions:

```bash
npm install --save-dev @types/three
```

That's it. `three` is now in `package.json` under `dependencies`.

---

## 4. Minimal Working Example

Create `src/main.js` (or wire this into a component):

```js
import * as THREE from 'three'

// Scene, camera, renderer
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
)
camera.position.z = 3

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

// A cube
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x00b4d8 }),
)
scene.add(cube)

// Light (StandardMaterial needs one)
const light = new THREE.DirectionalLight(0xffffff, 3)
light.position.set(2, 2, 5)
scene.add(light)

// Animation loop
function animate() {
  cube.rotation.x += 0.01
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
animate()
```

Run `npm run dev` and you should see a spinning cube.

---

## 5. Add-ons (OrbitControls, loaders, etc.)

Extra modules live under `three/addons/` (formerly `three/examples/jsm/`):

```js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
```

No separate install — they ship inside the `three` package.

---

## 6. Using three.js with React

Two approaches:

### a) Plain three.js in a `useEffect`

Set up the scene once, clean it up on unmount:

```tsx
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function Scene() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = ref.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)
    // ...scene setup + animate loop...

    return () => {
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={ref} style={{ width: '100%', height: 400 }} />
}
```

### b) React Three Fiber (declarative, recommended for React apps)

```bash
npm install three @react-three/fiber
npm install @react-three/drei          # helpers: OrbitControls, loaders, shapes
```

```tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <directionalLight position={[2, 2, 5]} intensity={3} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#00b4d8" />
      </mesh>
      <OrbitControls />
    </Canvas>
  )
}
```

---

## 7. No-Build Option (CDN + import map)

For a single HTML file with no npm:

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.185.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.185.0/examples/jsm/"
  }
}
</script>

<script type="module">
  import * as THREE from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  // ...your code...
</script>
```

Pin the version number. Good for demos; use npm for real projects.

---

## 8. Verify the Install

```bash
npm ls three          # shows the installed version
```

Then run your dev server and confirm a basic scene renders. If you see a black screen:

- Is anything **added to the scene**? (`scene.add(mesh)`)
- Is the **camera** pointed at it and not inside it? (`camera.position.z = 3`)
- Using `MeshStandardMaterial` / `MeshPhongMaterial`? You **need a light**. `MeshBasicMaterial` doesn't.
- Are you calling `renderer.render(scene, camera)` in a loop?

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot find module 'three'` | Run `npm install three`; restart the dev server |
| TypeScript errors on `THREE.*` | `npm install --save-dev @types/three` |
| `Failed to resolve import "three/addons/..."` | Use the `three/addons/` prefix (needs three r150+), or the older `three/examples/jsm/` path |
| Black screen, no errors | See the checklist in section 8 |
| Huge bundle / slow build | Expected — three is large. Import only what you need, or code-split the 3D view with `React.lazy` / dynamic `import()` |
| `THREE.WebGLRenderer: Context Lost` | Dispose the renderer on unmount; don't create multiple renderers |

---

## 10. Quick Reference

```bash
# core
npm install three
npm install --save-dev @types/three     # TypeScript

# React (declarative)
npm install three @react-three/fiber @react-three/drei

# check version
npm ls three
```

```js
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
```

---

## Further Reading

- [three.js — Installation](https://threejs.org/docs/#manual/en/introduction/Installation)
- [three.js — Creating a scene](https://threejs.org/docs/#manual/en/introduction/Creating-a-scene)
- [three.js examples](https://threejs.org/examples/)
- [React Three Fiber docs](https://r3f.docs.pmnd.rs/)
- [three.js journey (course)](https://threejs-journey.com/)
