# Style Guide

**Aesthetic direction: a warm, friendly, procedural world.**

Everything the app renders should feel hand-made, sun-warmed, and inviting — a small
world you want to spend time in, not a technical demo. Procedural generation is the
engine, but the output should read as *cozy and crafted*, never noisy or clinical.

---

## 1. Design Principles

1. **Warmth over realism.** Golden-hour light, soft shadows, rounded forms. Physical
   accuracy is secondary to how the scene *feels*.
2. **Friendly geometry.** Rounded edges, gentle bevels, slightly chunky proportions.
   Avoid sharp corners, thin spikes, and hard technical shapes.
3. **Calm procedural variety.** Randomness adds charm through small variations (tilt,
   scale, hue drift), never chaos. Every generated scene should look composed.
4. **Readable at a glance.** Strong silhouettes, clear focal point, uncluttered
   negative space. The eye should always know where to land.
5. **Quiet motion.** Things breathe, sway, and drift slowly. Nothing snaps or flashes.
6. **Cohesive, limited palette.** A handful of warm hues used consistently beats a
   rainbow. Color communicates mood, not information overload.

---

## 2. Color

### Core palette

| Role | Name | Hex | Use |
|------|------|-----|-----|
| Background base | Warm Dusk | `#1f1a24` | Scene clear color, deepest shadow |
| Background lift | Ember Haze | `#2e2431` | Fog far color, vignette edge |
| Primary surface | Terracotta | `#e07a5f` | Hero objects, primary material |
| Secondary surface | Honey | `#f2cc8f` | Accents, highlights, secondary forms |
| Tertiary surface | Sage | `#81b29a` | Foliage, ground cover, cool balance |
| Ground / earth | Clay | `#c98a63` | Terrain, base plane |
| Sky / light tint | Peach Glow | `#ffd9b3` | Key light color, sky hemisphere top |
| Sky shadow tint | Dusty Rose | `#b98a86` | Hemisphere light bottom, bounce |
| Text on dark | Cream | `#f4efe6` | UI labels, titles |
| Text muted | Warm Grey | `#a89f97` | Secondary UI text |

### Rules

- **Hue range:** stay between ~15° (red-orange) and ~150° (green). No pure blues,
  no magentas. Cool tones appear only as *desaturated* sage or dusty rose for balance.
- **Saturation:** mid saturation (40–70%). Nothing fully saturated, nothing greyed out.
- **Value:** keep a wide value spread per frame — one clear light area, one clear
  dark area — so the composition has depth.
- **Procedural color:** derive object colors by drifting a base hue by ±8° and
  lightness by ±6%. Never pick fully random RGB.
- **Never:** neon, pure white (`#ffffff`), pure black (`#000000`), high-contrast
  complementary clashes.

### CSS tokens

```css
:root {
  --c-bg:          #1f1a24;
  --c-bg-lift:     #2e2431;
  --c-terracotta:  #e07a5f;
  --c-honey:       #f2cc8f;
  --c-sage:        #81b29a;
  --c-clay:        #c98a63;
  --c-peach:       #ffd9b3;
  --c-rose:        #b98a86;
  --c-cream:       #f4efe6;
  --c-warm-grey:   #a89f97;
}
```

---

## 3. Lighting

Target mood: **late afternoon, an hour before sunset.**

| Light | Setup | Notes |
|-------|-------|-------|
| Key (sun) | `DirectionalLight`, color `#ffd9b3`, intensity ~2.5, low angle (elevation ~20–30°) | Casts the primary soft shadow |
| Fill (sky) | `HemisphereLight`, sky `#ffd9b3`, ground `#b98a86`, intensity ~0.6 | Warm bounce, no dark undersides |
| Ambient | `AmbientLight`, color `#2e2431`, intensity ~0.3 | Lifts blacks only slightly |
| Rim (optional) | Faint back `DirectionalLight`, `#f2cc8f`, intensity ~0.4 | Separates silhouettes from background |

- **Shadows:** soft. Use PCFSoft shadow maps, generous bias, low resolution is fine
  (blur hides it). Shadow color should read warm-grey, never blue-black.
- **Exposure / tone mapping:** `ACESFilmicToneMapping`, `toneMappingExposure` ~1.0–1.2.
- **Fog:** warm exponential fog (`#2e2431`) to fade the procedural world's edges and
  keep focus central.
- **No** hard specular hotspots, no lens flare, no god rays that dominate.

---

## 4. Materials

Default to **`MeshStandardMaterial`** with matte, slightly soft settings:

```js
{
  roughness: 0.7,      // 0.6–0.85 range — matte, a little sheen
  metalness: 0.0,      // almost never metal
  flatShading: false,  // smooth by default; flatShading OK for stylized low-poly
  envMapIntensity: 0.3 // subtle
}
```

- **Toon option:** `MeshToonMaterial` with a 3–4 step gradient map is on-brand for a
  more illustrated look — pick one (standard *or* toon) and stay consistent.
- **Surface feel:** imagine painted wood, clay, felt, sun-baked earth. Not glass,
  chrome, plastic, or concrete.
- **Texture:** prefer subtle procedural noise for large-scale color variation over
  photographic maps. Keep textures low-frequency and warm.
- **Emissive:** only for things that should glow gently (lanterns, windows) — dim,
  honey-colored, with a soft bloom.

---

## 5. Geometry & Procedural Generation

### Form language

- **Rounded everything.** Use rounded-box / bevelled geometry, capsules, spheres,
  low-frequency displaced planes. Bevel width ~4–8% of the object's size.
- **Chunky proportions.** Slightly oversized, stumpy, stable. Think "toy" not "spec".
- **Low-to-mid poly.** Enough segments to read as smooth silhouette; not so many it
  looks CAD-perfect. Embrace gentle facets.

### Procedural rules

- **Seeded randomness.** Every world has a visible seed; the same seed = the same
  world. Expose it in the UI.
- **Coherent noise, not white noise.** Use Perlin/Simplex/value noise for terrain,
  placement density, and color drift. Layer 2–3 octaves, keep amplitude modest.
- **Placement:** scatter with blue-noise / Poisson-disk sampling so objects are
  evenly spaced and never overlap awkwardly. Leave deliberate clearings.
- **Variation budget:** per instance, allow
  - rotation: full 360° on up-axis, ±5° tilt
  - scale: ±15%
  - hue: ±8°, lightness: ±6%
  - never vary: base form language, material type, silhouette category
- **Composition:** bias generation toward a clear center of interest — denser or
  taller elements toward the middle, sparser at the edges where fog takes over.
- **Determinism:** generation must be pure — `(seed, params) → world`, no hidden
  global state, so scenes are shareable and reproducible.

---

## 6. Camera & Motion

- **Default framing:** slight high angle (~15–25° above horizon), subject centered,
  comfortable margin around the focal object.
- **Orbit controls:** damped (`dampingFactor` ~0.08), clamped polar angle so the
  user can't go under the ground plane, gentle zoom limits.
- **Idle motion:** very slow auto-orbit (≤ 0.5 rad/s) or a subtle camera "breathe".
- **Object motion:** low-amplitude sine sway for foliage, slow bob for floating
  elements, phase-offset per instance so movement never looks synchronized.
- **Timing:** ease-in-out everywhere. Durations 400–800ms for UI, multi-second for
  ambient world motion.
- **Never:** fast spins, snapping cuts, camera shake, strobing.

---

## 7. Post-processing

Keep it light — enhancement, not spectacle.

| Effect | Setting |
|--------|---------|
| Bloom | Low threshold, small radius, subtle intensity — just softens highlights |
| Vignette | Gentle, warm (`#2e2431`), draws the eye inward |
| Color grading | Nudge toward warm: lift shadows slightly orange, keep highlights peachy |
| Ambient occlusion | Optional, soft, short radius — grounds objects without dark halos |
| Film grain | Very subtle, static or slow — adds a hand-made texture |

Avoid: chromatic aberration, heavy depth-of-field, sharp sharpening, glitch effects.

---

## 8. UI / HTML Layer

The React UI floats over the 3D scene and should feel like part of the same world.

- **Typography:**
  - Headings: a warm, rounded humanist sans (e.g. *Nunito*, *Quicksand*, *Baloo 2*).
  - Body / labels: a clean readable sans (system UI stack is fine).
  - Generous letter-spacing on titles, comfortable line-height (1.5) on body.
- **Panels:** semi-transparent dark warm glass (`rgba(31, 26, 36, 0.72)` + backdrop
  blur), soft 12–16px corner radius, hairline light border (`rgba(255,255,255,0.09)`).
- **Controls:** `accent-color: var(--c-terracotta)`. Chunky, rounded, obvious hit
  targets. Sliders and toggles, not tiny inputs.
- **Text color:** Cream on dark, Warm Grey for secondary. Never pure white.
- **Spacing:** roomy. 16px base padding, 10px gaps. Let the scene breathe through.
- **Shadows:** soft and warm-tinted, low opacity. No hard drop shadows.
- **Motion:** panels fade + rise 8px on mount (300ms ease-out). Hover states are a
  gentle background lift, no color pops.
- **Iconography:** rounded stroke icons, 1.5–2px weight, matching the friendly forms.

---

## 9. Sound (if added)

Warm and organic: soft wooden clicks for UI, low ambient pad, occasional gentle
nature texture. Nothing digital, sharp, or looping obviously.

---

## 10. Quick Checklist

Before shipping a scene or screen, confirm:

- [ ] Palette stays within warm hues (15°–150°), no neon, no pure black/white
- [ ] One clear light area, one clear dark area, one obvious focal point
- [ ] All forms rounded / bevelled; nothing sharp or spiky
- [ ] Shadows soft and warm-tinted
- [ ] Procedural variation is subtle (tilt, scale, hue) — scene reads as composed
- [ ] Motion is slow and eased; nothing snaps or flashes
- [ ] UI panels match the warm-glass style; text is Cream, never white
- [ ] Scene has a visible, reproducible seed
```
