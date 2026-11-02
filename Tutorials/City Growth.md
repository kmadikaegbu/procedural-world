# City Growth: Streets, Buildings and Population

The **Year** slider in the History Timeline now builds the city as it moves.
Streets are laid, buildings rise out of the ground, towers replace low
buildings, and the population counter follows the census.

![1850](<timeline/19-city-1850.jpg>)

> [!warning] What is real and what is modelled
> - **Population is real data**: the US census counts (1790 on), historians'
>   estimates before that, and a stylized flat line after 2020. Spot-check the
>   numbers against the Census Bureau's tables before presenting them.
> - **Streets and buildings are procedural.** They follow New York's real
>   rules (growth outward from the Battery, tilted grids, towers in the cores),
>   but they are **not a survey**. No building is in its real place.
> - Each building stands for a few real ones (lots are about 45 m wide), so
>   there are 66,000 buildings, not a million.

---

# Part 1 — In plain language

## What you see as the years pass

| Year | What happens |
| --- | --- |
| 1624–1700 | A small settlement at the Battery: a few timber houses, dirt tracks |
| 1700–1800 | The town creeps up the island; houses get a second storey |
| 1800–1850 | Streets multiply; brick rows replace wood; the city is on the move |
| 1850–1900 | Tall tenements, the streets get paved, the grid fills Manhattan, then Brooklyn |
| 1900–1950 | The first skyscrapers in Wall Street and Midtown; low blocks come down for towers |
| 1950–today | Glass towers; the outer boroughs fill; the city is full |
| 2026–2100 | The sea rises and floods the lowest streets and buildings |

New construction is **grey concrete** and rises over four years. A new street
is a **brown dirt track** that is laid from one end and later paved. Roosevelt
Island gets its own story: the penitentiary and asylum in the 1830s, hospitals,
the apartment towers of the 1970s, Cornell Tech from 2017.

## The readout

Under the slider: the **population curve** with a marker for the chosen year,
the number of **buildings** and the kilometres of **streets laid**. Three
buttons (Island, Battery, Midtown) fly the camera to where the action is.

---

# Part 2 — How it works

## One rule for when things are built

The old timeline already had an estimate of **how far the city had spread from
the Battery** in each year (`REACH` in `timeline.ts`). Reading it backwards
gives the year the city first reaches any spot:

```
built(lot) = yearForCityReach(distance to the Battery) + delay
delay      = (random number)² × 70 years       // edges fill in slowly
street     = built − 4 years                    // streets come first
```

So the paved ground, the buildings and the streets all grow by the same rule.

## Districts, each with its own grid

Manhattan's grid is tilted 29°, but the rest of the city is not. `layout.ts`
splits the map into ten districts (old town, Midtown, Harlem, the Bronx,
Queens × 2, Brooklyn × 3, Staten Island). Each has its own **angle**, block
size and fill rate. A lot belongs to the nearest district, so the grids meet
at ragged seams, like the real city.

Blocks are laid on that grid. Each block gets a cross street and an avenue
(drawn as a long thin strip), and up to four lots. Lots on water, on Roosevelt
Island, in Central Park, or on Governors Island are skipped.

## Height and style by era

- **Storeys** come from a table by year (1.3 in 1624 → 7 in 2020) times a
  random factor, and times how tall the district runs.
- **Cores** (Wall Street, Midtown, Downtown Brooklyn, Long Island City) are
  Gaussian bumps. In a core, a low building is **pulled down** and a **tower**
  built on the same lot. The tower's height is capped by what was possible in
  its year (12 storeys in 1890, 75 in 1932, 100 after 1975).
- **Five shapes** are drawn once and stretched per building (`shapes.ts`):
  gabled house, plain block, stepped Art Deco tower, slab with a rooftop box,
  pyramid-crowned shaft.
- **Walls**: timber before 1750, brick and ochre, limestone for early
  skyscrapers, blue-grey glass after 1950. Windows are painted by the shader
  from the building's own size, so a taller building just has more storeys.

## The GPU does the timeline

Nothing is rebuilt when the year changes. Every building carries the year it
is built (and pulled down) in a small per-instance attribute, and the shader
compares it with one number, `uYear`:

```glsl
rise = smoothstep(0, 4, uYear - built)     // grows from nothing
show = year >= built  &&  ground above the sea  &&  not pulled down
y   *= rise * show                          // the building's height
```

That is why scrubbing is smooth and Play costs no JavaScript. Streets work the
same way, but they stretch along their length instead of up.

**Standing on the terrain.** Buildings read a picture of the terrain's height
(the same idea as the water's depth map), so they follow sculpting, the seed
and the amplitude without being placed again. The picture is only rebuilt when
the terrain changes, not when the year or the sea level does.

**Flooding.** A building or street whose ground is below sea level is hidden,
so the 2100 sea takes the low-lying city.

## Population

`population.ts` is a table of `[year, people]` points with straight lines
between them. The curve in the panel is drawn from the same table.

| Year | People | | Year | People |
| --- | --- | --- | --- | --- |
| 1626 | 270 | | 1900 | 3.44 million |
| 1664 | 1,500 | | 1950 | 7.89 million |
| 1700 | 5,000 | | 1980 | 7.07 million |
| 1790 | 49,400 | | 2020 | 8.80 million |
| 1850 | 696,100 | | 2050 | 9.0 million (stylized) |

Up to 1771 these are the settled town; from 1790 they are the five boroughs,
so the line jumps there.

> [!note] Buildings don't track population exactly
> The buildings are placed by where and when the city spread, not by
> population. Both grow together (1850: 696,000 people, 6,800 buildings; 1950:
> 7.9 million, 54,000 buildings), but the building count doesn't dip when the
> population does (1950–1980).

## Limits

- Procedural, not a survey: no real building is in its real place.
- No landmark bridges, rail yards or piers; no parks except Central Park.
- Streets end at the shore, so some coastal blocks have no street.
- Buildings counted in the readout include ones the sea has flooded.
- Not shown in the Voxel scene or the minimap.

---

## Files

| File | What it does |
| --- | --- |
| `map/city/population.ts` | the census table and the curve |
| `map/city/layout.ts` | districts, cores, lots, streets, eras, the island's buildings |
| `map/city/shapes.ts` | the five building shapes |
| `map/city/City.tsx` | the instanced meshes, the height picture and the shaders |
| `map/city/CityStats.tsx` | population curve and counters |
| `map/timeline.ts` | `yearForCityReach`, the inverse of the old reach estimate |

Index: [Tutorials](<README.md>)
