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
| A tree (species height 2.0–2.3 × scale 0.6–1.4) | 1.2–3.2 | **40–108 m** | 20–30 m | **~2–3.5× taller** |
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
| Scale min / max | Props → Scatter | **≈ 0.3 / 0.4** | A 2.15-unit tree × 0.35 ≈ 0.75 units ≈ 25 m |
| Wave height | Weather → Water | **≈ 0.01–0.02** | 0.3–0.7 m chop |

> [!tip] Expect it to look underwhelming
> At true scale the island becomes a flat, thin sliver and the trees a faint
> green fuzz, which is accurate. That contrast is a good thing to show a panel:
> it explains *why* the default view is exaggerated, and that the
> exaggeration is controlled by sliders, not baked in.

---

## Quick reference

```
1 unit   ≈ 33.5 m  ≈ 110 ft
1 m      ≈ 0.03 units
person   ≈ 0.05 units
house    ≈ 0.25 units
real tree ≈ 0.6–0.9 units      model tree ≈ 1.2–3.2 units
10-storey ≈ 1 unit             The House (26 storeys) ≈ 2.45 units
island   = 96 units long       true width ≈ 7.3 units
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
