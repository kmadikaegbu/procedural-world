# Roosevelt Island Layout

How the island, its banks and its bridges were laid out from photographs, so
that the model matches the real island as it looks today.

> [!warning] What is measured and what is guessed
> Positions come from four aerial photographs (Google Earth views from the
> south-west, the south, and above) read through a perspective, so they are good
> to a few tens of metres. Building names, heights and dates beyond what the
> photos show are from the island's history. The shoreline is the real one.

---

# Part 1 — The island in plain language

From the south tip to the north: **Four Freedoms Park** (a granite "room", a
terrace and a long lawn between rows of trees), the ruin of the **Smallpox
Hospital** in an overgrown grove, **Southpoint Park**'s meadow with its worn
paths, the **Cornell Tech** campus just south of the **Queensboro Bridge**, the
brick apartment towers of **Main Street**, **Manhattan Park** and the
**Motorgate** garage, the sports area (a field, a baseball diamond, four tennis
courts, a pool and a playground), the **Octagon**, the **Coler** and
**Goldwater** hospitals, and the **lighthouse** at the tip.

Across the water: Manhattan's FDR Drive and the Sutton Place towers on the
west; Vernon Boulevard, Rainey Park, Costco, the warehouses and the Long Island
City towers on the east.

---

# Part 2 — How it works

## One frame for everything

Everything on the island is placed in the island's own frame
(`world/island.ts`): `s` along the island (0 at the middle, + north), `u` across
it (− Manhattan, + Queens), in world units of 33.5 m. The island's axis runs 29°
east of north, and a profile of its real edges (from the shoreline data) lets
the code find the island's west and east shore at any `s`.

## A survey, then a review

1. **Survey.** Four agents each read the photos for one kind of thing
   (buildings, ground and paths, bridges and banks, vegetation) and returned
   items with positions, sizes and a confidence. A fifth merged and
   cross-checked them: it moved items that fell in the river and resolved
   conflicts between photos.
2. **Build.** The merged list became `ISLAND_BUILDINGS`, `BANK_TOWERS`, ground
   patches, paths and woods.
3. **Review.** A second group compared renders of the model with the photos and
   ranked the differences. The biggest were the water's colour (it was turquoise;
   the East River is dark slate), the sand beaches (there are none, only a
   seawall), and the Queensboro Bridge's position and weight.

## What each part does

| Part | Where | What it does |
| --- | --- | --- |
| Buildings | `ISLAND_BUILDINGS` | Real position, footprint, height and date. The Octagon and lighthouse are eight-sided towers. |
| Ground | `PATCHES`, `islandRibbons()` | Fields, courts, plazas and paths drawn flat on the ground, following the terrain. |
| Main Street, promenades | `islandRibbons()` | Follow the island's edges, found from the shoreline. |
| FDR Drive, Vernon Blvd | `shoreRoad()` | Walk out from the island across the water to the first land and lay the road just inland. |
| Trees | `islandTreeWeight()`, `WOODS`, `linden()` | None on lawns, fields and buildings; thick in the woods; a row on the shore; Four Freedoms' lindens placed in rows. |
| Banks | `BANK_TOWERS`, `world/parks.ts` | Towers and parks on the Manhattan and Queens sides. |
| Bridges and tram | `city/bridges.ts` | Each bridge is found by walking a line across the real shoreline; the tram's cabins shuttle on its cables. |

## A correction the review found

The survey had put the Queensboro Bridge 41% of the way up the island. Real
geography puts it a third of the way up (59th Street, between the island's south
tip at 46th and its north tip at 86th). The bridge, Cornell Tech, the tram and
the Southpoint meadow were moved south to match.

## Limits

- The trees are the project's usual tree shapes, not the round broadleaf canopy
  of the real island.
- The south tip tapers to a point; the real tip is blunt.
- Heights use the shared scale (×2.9), so towers on the banks are large next to
  the island.

Index: [Tutorials](<README.md>)
