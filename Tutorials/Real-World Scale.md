# Real-World Scale

How big is "1" in this world? This note works out what a **world unit** means
in metres, then uses it to size people, trees, houses and Roosevelt Island's
real buildings, and to show where the model is true to life and where it's
deliberately exaggerated so things stay visible.

> [!summary] The answer
> **1 world unit ≈ 33.5 metres** (about 110 feet), measured along the island's
> length, the one dimension built to match reality.
>
> | | |
> | --- | --- |
> | metres → units | **divide by 33.5** |
> | units → metres | **multiply by 33.5** |
> | 1 metre | ≈ 0.03 units |
> | 100 metres | ≈ 3 units |
> | 1 kilometre | ≈ 30 units |

---

## Step 1 — Find something real to measure against

A 3D scene has no built-in size: "1" can mean anything. To give it a scale, pick
one thing in the scene whose **real size you know**, and divide.

The only part of this map that is built to match reality is the **island's
length**:

- In the code, the map is `MAP_SIZE = 100` units across, and the island spans
  `ISLAND_LENGTH = 0.96` of it, so the island is **96 units long**.
- In reality, Roosevelt Island is about **2 miles = 3,220 m** long.

```
1 unit = real length ÷ model length
       = 3,220 m ÷ 96 units
       ≈ 33.5 m per unit
```

> [!info] Why the length and not the width or height?
> The **width** has its own slider (Island → Width), and the **height** has
> its own (Amplitude). Both were chosen to look good, not to match reality, so
> they can't be trusted as a ruler. Only the length is fixed to the real
> island.

---

## Step 2 — Convert anything

```
size in units  = size in metres ÷ 33.5
size in metres = size in units × 33.5
```

To see how true to life something is, compare the model with the real thing:

```
exaggeration = size in the model ÷ real size
```

1 means true to scale, 2 means twice as big as real, and 0.5 means half.

---

## Step 3 — People, trees and buildings at true scale

What real things would measure if you placed them on this map at true size:

| Thing | Real size | In world units | Notes |
| --- | --- | --- | --- |
| A person | 1.75 m | **0.05** | Smaller than one terrain grid square (0.5 units). |
| A car | 4.5 m long | 0.13 | |
| A two-storey house | ~8 m tall | **0.24** | Assumes ~3–4 m per storey. |
| A mature London plane, NYC's tallest common street tree | 20–30 m tall | **0.6–0.9** | |
| A 10-storey apartment block | ~33 m tall | 1.0 | One world unit is about a 10-storey building. |
| The Roosevelt Island Tram, highest point above the river | 76 m (250 ft) | 2.3 | |
| The House at Cornell Tech, tallest building on campus, 26 storeys | ~82 m (270 ft) | **2.45** | |
| Roosevelt Island, length | 3,220 m | 96 | The ruler. |
| Roosevelt Island, widest point | 244 m (800 ft) | 7.3 | |
| Roosevelt Island, highest ground | 7 m (23 ft) | **0.21** | Nearly flat. |

---

## Step 4 — How big things are *in this model*

Now the other direction: what the code actually draws, converted into metres.

| Thing in the model | World units | In metres | Real-world equivalent | Exaggeration |
| --- | --- | --- | --- | --- |
| The whole map | 100 × 100 | 3.35 km square | | |
| Island length | 96 | 3,220 m | 3,220 m | **1×, true to scale** |
| Island width at Width = 1 (default) | 18 | ~600 m | 244 m | **~2.5× wider** |
| Island width at Width = 0.45 | 8.1 | ~270 m | 244 m | ~1.1×, close to true |
| Tallest hills (Amplitude = 4) | up to ~3–4 | 100–135 m | 7 m | **~15–19× taller** |
| River bed | −4 below sea level | −134 m | much shallower in reality | very deep |
| A tree (mature 0.4–0.8 u at true size, × the readable objects factor 2.9, × size 0.3–1.15) | 0.4–2.7 | **14–91 m** (real 5–32 m) | 5–30 m | **~2.9× taller** (the objects factor) |
| Tree spacing (default) | 0.5 | 17 m | plausible for woodland | ≈ 1× |
| Clouds | 24 above sea | ~800 m | low cloud base ~500–2,000 m | ≈ true |
| Wave height (default) | 0.12 | ~4 m | river chop is usually under 1 m | **far taller** |
| Longest wave (crest to crest) | 9 | ~300 m | | |
| Terrain grid square (Resolution 200) | 0.5 | ~17 m | | the smallest land detail |
| Water depth-map pixel | 0.39 | ~13 m | | the smallest shoreline detail |
| Voxel block | 1.5 | ~50 m | | |
| Planting-mask cell | 1.56 | ~52 m | | |
| Ivy leaf | 0.2–0.32 | 7–11 m | ~0.1 m | **~100× too big** |
| Fallen leaf | 0.2 × 0.13 | ~7 × 4 m | ~0.1 m | **~60× too big** |

> [!warning] What this tells you
> **Horizontally** the island is real (length) or close to real (Width ≈ 0.45).
> **Vertically** everything is stretched: hills are ~15–19× taller than the
> real island, and trees ~2–3× taller than real trees. **Small details**
> (ivy leaves, fallen leaves, waves) are drawn tens of times too big.

---

## Step 5 — Why exaggerate? (screen size)

How big something looks on screen depends on its size and how far away the
camera is. With this app's 50° camera in a 900-pixel-tall window:

```
pixels per unit = window height ÷ (2 × distance × tan(25°))
               ≈ 900 ÷ (0.93 × distance)
```

| Camera | Distance | 1 unit on screen | A true-scale person (0.05 u) | A true-scale tree (0.75 u) | A model tree (2.15 u) |
| --- | --- | --- | --- | --- | --- |
| Zoomed all the way in | 20 units (670 m) | ~48 px | **~2.5 px** | ~36 px | ~104 px |
| Default view | ~111 units (3.7 km) | ~8.7 px | **~0.5 px** | ~6.5 px | ~19 px |
| Zoomed all the way out | 260 units (8.7 km) | ~3.7 px | invisible | ~3 px | ~8 px |

So at the default view, a true-scale tree would be about 6 pixels tall, and a
person less than one pixel. The camera's closest zoom is 670 m away, about
as far as standing on the Manhattan shore looking across the river.

The exaggerations are a **readability choice**, the same trick printed maps
use when they draw roads far wider than they really are:

- **Taller hills** so the terrain, biomes and erosion are visible at all.
- **Bigger trees** so the forest reads as trees, not green dust.
- **Bigger leaves and waves** so seasons, foam and motion show from far away.
- **A wider island** (Width = 1) so there's room for detail.

---

## Step 6 — Making it true to scale

If you want to show the real proportions (say, for a slide comparing "as
modelled" against "as real"), these settings get close:

| Setting | Where | True-to-scale value | Why |
| --- | --- | --- | --- |
| Width | Terrain → Island | **≈ 0.40** | 96 ÷ 0.40-width island ≈ the real 13:1 shape |
| Amplitude | Terrain | **≈ 0.25** | Real highest ground 7 m ≈ 0.21 units, plus a little for the bank |
| Scale switch | View → True to scale | **on** | Sets every factor to 1 at once. Tree sizes, spacing, ivy and waves all follow. |
| Wave height | Weather → Water | **≈ 0.01–0.02** | 0.3–0.7 m chop |

> [!tip] Expect it to look underwhelming
> At true scale the island becomes a flat, thin sliver and the trees a faint
> green fuzz, which is accurate. That contrast is a good thing to show a panel:
> it explains *why* the default view is exaggerated, and that the
> exaggeration is controlled by sliders, not baked in.

---

# Part 2 — Working with scale

Steps 1–6 *measured* the scale this project ended up with. The steps below
are for **deciding** it on purpose: the order to make the choices in, so
objects, detail and camera all agree with each other.

## Step 7 — Define a working scale

Before placing anything, decide **what 1 unit means** and write it down in
the code, so every file uses the same ruler.

| Choice | Good for | This project |
| --- | --- | --- |
| **1 unit = 1 m** | Walk-around scenes, physics, characters. Most game engines assume it. | Would make the map 3,350 units across. |
| **1 unit = a larger chunk** (here ~33.5 m) | Whole-island or city views, where the map should be a convenient size like 100. | ✔ The choice made, by fitting the island into `MAP_SIZE = 100`. |

Either works. The important part is to **choose once and name it**. This
project now does it in `react-app/src/map/scale.ts` (see "Applied in this
project" below). The pattern:

```ts
// scale.ts — the one place the world's ruler is defined
export const METERS_PER_UNIT = 33.5          // 1 world unit = 33.5 m
export const m = (meters: number) => meters / METERS_PER_UNIT

// how much each category is enlarged for readability (1 = true to scale)
export const TERRAIN_VERTICAL_EXAGGERATION = 15   // hills
export const OBJECT_EXAGGERATION = 2.5            // trees, buildings, people
```

Then a size in the code reads as a real measurement:
`m(25) * OBJECT_EXAGGERATION` instead of a mystery number like `2.1`.

> [!tip] Why name it?
> Today the tree height `2.1`, the wave height `0.12` and the hill height `4`
> were each tuned by eye, separately. Nothing ties them together, which is how
> leaves ended up ~100× too big while the island's length is exact. A named
> scale makes every size traceable to metres.

## Step 8 — Make objects proportional to that scale

**Rule:** every object = its real size in metres, converted with `m()`, times
**one shared** exaggeration factor for its category.

```
size in units = m(real metres) × OBJECT_EXAGGERATION
```

Using **the same factor for every object** keeps them in proportion with each
other, even when they're all enlarged. A tree is always about 14 people tall,
whatever the factor.

With `OBJECT_EXAGGERATION = 2.5`:

| Object | Real | True scale (×1) | Exaggerated (×2.5) | Ratio to a person |
| --- | --- | --- | --- | --- |
| Person | 1.75 m | 0.05 u | 0.13 u | 1 |
| Two-storey house | 8 m | 0.24 u | 0.60 u | ~4.6 |
| Street tree | 25 m | 0.75 u | 1.87 u | ~14 |
| 10-storey building | 33 m | 1.0 u | 2.5 u | ~19 |
| The House at Cornell Tech | 82 m | 2.45 u | 6.1 u | ~47 |
| Tram, high point | 76 m | 2.3 u | 5.7 u | ~43 |

> [!example] Where today's trees fit
> The model's trees average ~1.6 units (about 18 m real × 2.9). Every tree is its real height × **×2.9**.
> So if buildings were added next to today's trees, they should use the same
> ×2.9, making The House about 7 units tall, or the trees would tower over
> 26-storey towers.

**Things that must scale with the objects too:**

- **Spacing:** tree spacing, ivy step length and fallen-leaf spread are
  object-sized, so multiply them by the same factor. If trees are 2.5× bigger
  but spacing stays real, the crowns pile into each other.
- **Leaves and small parts:** an ivy leaf is ~0.1 m. At ×2.5 that's 0.0075
  units; today it's 0.2–0.32 (×70–100). That mismatch is why ivy leaves look
  chunky.
- **Terrain vs objects:** keep objects' exaggeration **at or below** the
  terrain's vertical exaggeration (×15 here). Otherwise a tree outgrows the
  hill it stands on and the landscape looks like a tabletop model.

## Step 9 — Resolution is tied to scale

Every grid, texture and mesh samples the world at some spacing. **A feature
needs at least 2 samples across it to show at all, and about 4 to look
smooth.** So each resolution sets the smallest thing that system can show:

```
smallest visible feature ≈ 2–4 × sample spacing
sample spacing          = area covered ÷ resolution
```

What that means for this project:

| System | Resolution | Spacing (units) | Spacing (real) | Smallest feature it can show |
| --- | --- | --- | --- | --- |
| Terrain mesh (Resolution 200) | 200 × 200 over 100 u | 0.5 | ~17 m | landforms ≥ ~35–70 m |
| Sculpt edit grid | 128 × 128 | 0.78 | ~26 m | brush detail ≥ ~50 m |
| Erosion grid | 256 × 256 | 0.39 | ~13 m | gullies ≥ ~26 m |
| Water depth map | 256 × 256 | 0.39 | ~13 m | shoreline detail ≥ ~26 m |
| Water wave mesh | 192 × 192 | 0.52 | ~17 m | waves ≥ ~35 m (the shortest, 54 m, gets only ~3 samples) |
| Shadow map | 2048 px over 120 u | 0.06 | ~2 m | shadows of things ≥ ~4 m; a person's shadow is under one pixel |
| Planting mask | 64 × 64 | 1.56 | ~52 m | painted zones ≥ ~100 m |
| Voxel blocks | — | 1.5 | ~50 m | one block = a 50 m cube |

> [!info] This explains two things already in the notes
> - **Missing shore foam:** the river bank's shallow strip is ~0.2 units wide,
>   narrower than one depth-map pixel (0.39), so depth-based foam couldn't see
>   it (see [Procedural Water](<Procedural Water.md>)).
> - **Octaves:** the terrain noise's base wavelength is 1 ÷ frequency =
>   1 ÷ 0.035 ≈ 28.6 units. Each octave halves it, so the 5th octave is
>   ~1.8 units, about 3.6 grid squares. A 6th or 7th octave would be smaller
>   than the grid can show: extra cost for detail that never appears.

**Choosing a resolution:** decide the smallest feature you want, then work
backwards.

```
resolution needed = area ÷ (smallest feature ÷ 3)
```

To show 6 m features (say, a building footprint) over the 3.35 km map, you'd
need 3,350 ÷ 2 ≈ **1,700 samples per side, about 2.9 million vertices**. One
mesh that size is too heavy, which is why large worlds are split into chunks
with their own LOD (the same idea as the tree LOD).

> [!tip] The unit choice doesn't change the cost — the detail does
> Switching to 1 unit = 1 m changes only the *numbers*: spacing becomes 17
> units instead of 0.5. The vertex count for the same 17 m detail is
> identical. What costs performance is wanting **finer real-world detail**,
> whatever the units.

The **screen** is a resolution too: at the default camera (~8.7 pixels per
unit, Step 5), anything under ~0.35 units (12 m) is smaller than 3 pixels and
won't read, however finely it's modelled.

## Step 10 — Camera position and scale

The camera has to be placed for the scale too: how far away, how wide a view,
and the distances it can render.

**1. Framing: how far back to see the whole subject**

```
distance to fit = subject size ÷ (2 × tan(field of view ÷ 2))
```

With the 50° camera and the 96-unit island: 96 ÷ (2 × tan 25°) ≈ **103
units**. The default camera sits ~111 units away, so it was framed to fit
the whole island with a little margin.

**2. Zoom limits in real terms**

| Camera setting | Units | Real distance | Like viewing from… |
| --- | --- | --- | --- |
| Closest zoom (`minDistance`) | 20 | ~670 m | a low drone over the river |
| Default | ~111 | ~3.7 km | a plane on approach |
| Farthest (`maxDistance`) | 260 | ~8.7 km | high altitude |

Nothing in the app is viewed from street level, which is why people and
houses would be invisible at true scale.

**3. What should be visible decides the exaggeration**

Turn Step 5's pixel formula around: to make something at least *N* pixels
tall,

```
size needed (units) = N ÷ pixels per unit at that camera distance
```

| To show… at ≥ 4 px | At closest zoom (48 px/u) | At default (8.7 px/u) |
| --- | --- | --- |
| A person | 0.083 u → **×1.6** | 0.46 u → ×9 (absurd) |
| A house | 0.083 u → fine at ×1 | 0.46 u → ×1.9 |
| A tree | fine at ×1 | 0.46 u → fine at ×1 (just) |

So the camera range tells you which objects are worth adding. People only make
sense if the camera can come closer than ~670 m, or they'd need to be
enlarged ×9.

**4. Near and far planes**

The camera only draws between a **near** and a **far** distance. Here the
near plane is 0.1 units (~3.4 m) and the far plane is three.js's default 2,000
units (~67 km).

- A street-level camera at 1.7 m eye height (0.05 units) would sit *closer
  than the near plane* to the ground, so nearby ground and objects would be
  clipped away. You'd need near ≈ 0.005 units, which stretches the near-to-far
  ratio to 400,000:1. The depth buffer then can't tell close surfaces apart
  (flickering called **z-fighting**). This is one reason street-level games use
  1 unit = 1 m with near = 0.1 m.
- For this camera (670 m to 8.7 km), the current planes are comfortable.

**5. Everything else that follows the camera range**

| Setting | Value | Real-world meaning |
| --- | --- | --- |
| LOD switch distances | 45 / 85 / 125 u | 1.5 / 2.8 / 4.2 km |
| Fog (default weather) | density ≈ 0.0076 per unit | fully fogged by ~260 u ≈ 8.7 km, just past the farthest zoom |
| Fog (heaviest preset) | density ≈ 0.0175 per unit | fully fogged by ~113 u ≈ 3.8 km |
| Shadow camera | ±60 u | covers the 100-unit map; a bigger map would need wider bounds, which coarsens each shadow pixel |

If the scale or camera range changed, every one of these would need to move
with it.

## Applied in this project

The rules above are now in the code. `react-app/src/map/scale.ts` is the one
place the ruler is defined.

| Rule | How it's applied |
| --- | --- |
| **Define the scale** | `METERS_PER_UNIT = 3,220 m ÷ (MAP_SIZE × ISLAND_LENGTH) ≈ 33.5`, plus `m()` and `toMeters()` converters. |
| **One factor per category** | `EXAGGERATION.readable = { vertical: 15, objects: 2.9, islandWidth: 2.5 }`; `EXAGGERATION.true` is all 1s. |
| **Objects from real metres** | Mature tree heights are `objectSize(28 / 19 / 14 m)` for open, dense and leaning (a full-crowned plane, a compact park tree, a stunted wind-bent waterfront tree). Each placed tree is then a fraction of that, 0.3 (sapling) to 1.15 (veteran), set by its stand's age and its site: see "Tree size" below. Tree **spacing** is set in metres (default 6 m) and enlarged by the same objects factor. Ivy and fallen leaves shrink with the trees. |
| **Vertical sizes** | Wave height is set in metres (default 0.27 m) × the vertical factor, so waves stay in proportion to the hills. The river bed, erosion and sculpt offsets follow the same factor. |
| **Resolution** | Real river chop (~5–30 m crest to crest) is finer than the 17 m wave mesh, so it stays as shader ripples; the geometric waves are long swell. |
| **Camera** | The default camera distance comes from the framing formula: `96 ÷ (2 · tan 25°) × 1.08 ≈ 111 units`. |

**The Scale switch** (View section): **Readable scale** draws everything with
the factors above. **True to scale** sets them all to 1. The result matches
the real island:

| | Readable | True to scale | Real island |
| --- | --- | --- | --- |
| Highest ground | 107 m | **7.1 m** | 7 m |
| Widest point | ~600 m | **242 m** | 244 m |
| Trees (mean) | 52 m | **18 m** (range 5–32 m) | 10–30 m |
| Waves | ~4 m | **0.27 m** | under 1 m |

Sculpting is paused at true scale, because brush strokes are stored at the
readable scale. The water shader measures depth in readable units (it divides
by the vertical scale), so a true-scale river still looks as deep as it is.

### Tree size

A tree's size isn't a free random number. Real woodland has a mix of ages, and
the land decides how big each tree gets. In `trees/scatter.ts`, `treeSize01()`
combines three things (a fraction 0 to 1 between Scale min and Scale max):

| Driver | Effect |
| --- | --- |
| **Stand age** | A slow noise field gives each patch of the island an age. Trees in a grove are alike (neighbouring trees differ about half as much as random pairs), and groves differ from each other. |
| **Site** | Taller on low, sheltered ground; stunted where open water is within about 170 m (5 units); stunted on steep ground. |
| **Chance** | A nudge from each tree's own seed. |

The **Size variety** slider blends from all-identical (0) to natural (1) and
beyond. With the defaults, 400 trees come out as 5–32 m, mostly 10–20 m with a
tail of tall veterans, and size correlates with altitude at about −0.5.
Before this change every tree was 13–36 m with a flat spread, all three
species the same height, and no link to the land (correlation 0).

## A checklist for starting a scene

1. **Pick the ruler.** One real thing, its real size, and `METERS_PER_UNIT`.
2. **Name it in code:** `m()` plus one exaggeration factor per category
   (terrain height, objects).
3. **Size every object** as `m(real metres) × its category's factor`,
   including spacing and small parts.
4. **Decide the camera range** (closest, default, farthest) and frame the
   subject with `size ÷ (2·tan(fov/2))`.
5. **Check visibility:** at each camera distance, is each object ≥ 3–4 pixels?
   If not, enlarge its category, hide it, or LOD it.
6. **Set resolutions** from the smallest feature you need:
   `area ÷ (feature ÷ 3)`. Stop adding noise octaves once they're smaller than
   the grid.
7. **Derive the rest from the camera range:** near/far planes, LOD
   distances, fog density, shadow bounds.

---

## Quick reference

```
1 unit   ≈ 33.5 m  ≈ 110 ft
1 m      ≈ 0.03 units
person   ≈ 0.05 units
house    ≈ 0.25 units
real tree ≈ 0.15–0.9 units     model tree ≈ 0.4–2.7 units
10-storey ≈ 1 unit             The House (26 storeys) ≈ 2.45 units
island   = 96 units long       true width ≈ 7.3 units

size     = m(real metres) × exaggeration      (one factor per category)
feature  ≥ 2–4 × sample spacing               (spacing = area ÷ resolution)
framing  = subject ÷ (2 · tan(fov / 2))       (island: ~103 u)
visible  ≥ 3–4 px = size × pixels per unit
```

Where these numbers live in the code: `MAP_SIZE` in `react-app/src/map/mapSize.ts`;
`ISLAND_LENGTH`, `ISLAND_HALF_WIDTH` and `SEABED_DEPTH` in `react-app/src/map/noise.ts`;
tree `height` in `react-app/src/map/trees/species.ts`; tree scale in
`react-app/src/map/trees/scatter.ts`; camera distances in `react-app/src/App.tsx`.

---

## Sources

- [Roosevelt Island (Wikipedia)](https://en.wikipedia.org/wiki/Roosevelt_Island): about 2 mi long, 800 ft at its widest, highest elevation 23 ft.
- [Roosevelt Island Tramway (Wikipedia)](https://en.wikipedia.org/wiki/Roosevelt_Island_Tramway): rises to 250 ft above the East River.
- [Construction Update: Cornell Tech Campus (Field Condition)](https://www.fieldcondition.com/blog/2017/6/5/construction-update-cornell-tech-nyc): The House rises to 270 ft.
- [The House by Handel Architects (Architectural Record)](https://www.architecturalrecord.com/articles/13060-the-house-by-handel-architects-at-cornell-tech?v=preview): 26 storeys.
- [London plane (Wikipedia)](https://en.wikipedia.org/wiki/London_plane): typically 20–40 m tall.
- [London Plane Tree (University of Redlands)](https://arc11s.redlands.edu/trees/species-accounts/londonplanetree): 70–100 ft at maturity.

Previous: [How the World Fits Together](<How the World Fits Together.md>) ·
Index: [Tutorials](<README.md>)
