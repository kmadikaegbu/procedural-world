# New York, Made Ground

### Four hundred years of New York, built in your browser, with Roosevelt Island at its centre

**▶ [Open the live demo](https://procedural-world-design-app.web.app)**, press
**Play** on the History Timeline, and watch the city grow.

**📘 [Tools and Procedural Techniques](docs/TECHNIQUES.md):** everything this
project uses (software, data, 3D models, references) and how each part of the
world is generated.

| 1609 · Mannahatta | 1880 · New York City | 2026 · Today |
| :---: | :---: | :---: |
| ![The map in 1609: all forest and meadow](Tutorials/timeline/19-history-1609.jpg) | ![The map in 1880: the paved city spreading from the Battery](Tutorials/timeline/19-history-1880.jpg) | ![The map today: the city paved, Roosevelt Island still green](Tutorials/timeline/19-history-2026.jpg) |
| Lenape land: forest, marsh and meadow. | The city spreads north from the Battery, clearing the forest as it goes. | The whole city is paved. Roosevelt Island stays green. |

---

## The idea

> **New York's ground is made, not given.**

In 1609, Manhattan was *Mannahatta*: hills, streams, forest and marsh. Almost
everything since has been a decision laid on top of that land:

- A street grid drawn over the whole island in 1811, before most of it was built.
- Forests cleared for streets and buildings.
- Shorelines pushed into the rivers with landfill.
- Now, a sea that rises a little more each year.

**Roosevelt Island** is the counterpoint. It is a thin strip of rock in the East
River, right in the middle of all this, and it has been five places in turn:

| Years | Name | What the island was |
| --- | --- | --- |
| before 1637 | **Minnehanonck** | Lenape land |
| 1637 | **Hog Island** | A Dutch pig farm |
| 1686 | **Blackwell's Island** | A family farm, then the city's prisons, asylum and smallpox hospital |
| 1921 | **Welfare Island** | Hospitals |
| 1973 | **Roosevelt Island** | A planned "new town in town", Louis Kahn's Four Freedoms memorial, and now Cornell Tech |

For most of its history the city used the island to keep people out of sight,
then remade it as an experiment in planning. In this model it is the one piece
of ground that is never paved.

This project turns that history into a world you can scrub through.

---

## What you'll see

Drag the **History Timeline** from 1609 to 2100, or press Play to watch it run
at 12 years a second.

- 🏙️ **The city grows.** Paving spreads out from the Battery: New Amsterdam by
  1664, about 42nd Street by 1850, the whole city by 1950.
- 🏗️ **The real city is built.** All 422,000 buildings standing on the map
  today, from the city's own Building Footprints data, rise in the year the
  city records each one was built, at its real place, size and roof height.
  Before them stands a procedural "lost city" of the buildings that came
  first, and each lost building comes down when the first real one on its
  ground goes up. A counter shows the population (the census, 1624 to today)
  and how many buildings and kilometres of street exist.
- 🌉 **The bridges open.** The Brooklyn (1883), Williamsburg (1903),
  Manhattan and Queensboro (1909), Hell Gate (1916), Triborough (1936) and
  Roosevelt Island (1955) bridges are built in their real years, with the
  tramway (1976) and its two cabins.
- 🗽 **Liberty rises.** The Statue of Liberty stands on Liberty Island,
  built in code: Fort Wood's eleven-pointed star (1811), the granite pedestal
  rising in 1884–86, then the statue with her torch, crown and tablet. Her
  copper weathers from brown to green by about 1906. The monument is enlarged
  like the buildings, and nudged about 150 m east of its real spot because the
  real one sits right at the map's edge.
- 🌳 **The forest goes.** Trees are cleared as the city arrives, and a few
  survive as street trees.
- 📐 **The real streets are laid.** Every street, highway, park path and
  alley is the city's own, along its surveyed centre line (NYC's Centerline
  data), drawn at its real width. Each is laid as the city reaches it: the
  crooked lanes of the old town first, then the 1811 grid marching up
  Manhattan, then Brooklyn's and Queens' own grids. The lost city's buildings
  line those real streets.
- 🌊 **The sea rises.** Up to today, sea level follows the Battery tide gauge,
  which has measured 2.94 mm a year since 1856. The rise is drawn as
  exaggerated as the hills, so you can see it. After today the curve is
  deliberately dramatic. It is an illustration, not a forecast.
- 🦌 **The wildlife retreats.** Birds flock, deer graze, and foxes hunt
  them. They live only on land the city hasn't paved, so as it spreads they
  are pushed back, until today they're left on Roosevelt Island.
- 🏷️ **The names change.** The header reads Mannahatta, then New Amsterdam,
  then New York City. The panel shows the island's name for that year and the
  latest thing that happened there.

The coastline is New York's real one, from the city's own shoreline data. It
includes Manhattan, Brooklyn, Queens, the Hudson, East and Harlem rivers, and
Roosevelt Island in its true place and at its true width. The city's parks
(Central Park, Prospect Park, Randalls Island and others) are left green and
empty. The hills on top are invented, generated from seeded noise, except
on Roosevelt Island, which is flat as in life: a level deck about 2.5 m above
the river, edged by its seawall.

**Roosevelt Island is laid out from photographs.** Its buildings (Cornell
Tech, the Main Street towers, Manhattan Park, the Octagon, Coler Hospital, the
lighthouse), Four Freedoms and Southpoint parks, sports fields, paths and the
banks either side were placed from four aerial photographs of the real
island. See [Roosevelt Island Layout](<Tutorials/Roosevelt Island Layout.md>).

**Follow the story.** As the years pass, a card at the bottom of the screen
tells New York's story in 37 chapters, from the Lenape's Mannahatta through
New Amsterdam, slavery, the Revolution, the grid, the Erie Canal,
immigration, Central Park, the bridges, the subway, the skyscrapers, the
1975 crisis, September 11 and Hurricane Sandy, to the rising sea. Each
chapter shows the population of its year. Play stops on each chapter for a
few seconds so it can be read. As each chapter arrives, the camera glides to
where it happened, and the map marks it: a beacon with a label (Fort
Amsterdam, Federal Hall, the Triangle factory, the Empire State Building), a
line for the Dutch wall, the bridges and the first subway, an outline for
Central Park, and a circle for the great fires and Sandy's flood. Locations
are approximate, to the street corner.

**Watch the wildlife up close.** You can zoom in to about 20 m. The
**Deer**, **Fox** and **Birds** buttons fly down to an animal and follow it,
saying what it's doing (grazing, fleeing a fox, flying with the flock). There
are far more in the early years, before the city paves their land.

**Watch Roosevelt Island's day.** From 1976, when the new town and the
Tramway open, the island runs as a small city simulation. About 12,000
residents and 2,000 people who come in for the day keep a daily routine. They
commute by Tram, subway or bus, go to school, work hospital shifts, walk in
the parks and stop at the Main Street shops. The Tram's cabins carry 110 a
trip, so queues build at the rush hours. Trash goes through tubes under Main
Street to the plant at the north end, as on the real island. The panel tracks
riders, trash and the island's electricity through the day. The **Morning
rush**, **Midday**, **Evening** and **Night** buttons jump to that time of
day.

**Start with the tour.** On a first visit a short guided tour opens at the top
of the screen: five stops from Mannahatta in 1609, through the city's spread,
the 1811 grid and the skyline, to the last wild land and the sea in 2100. Each
stop says what to try, ticks itself off when you've done it, and has a button
that does it for you. The panel opens in **Explore**, which shows only the
history and the weather. The **Lab** is the same app with every slider.

In the Lab you can also:

- Change the weather: rain, snow that settles on the ground, fog, clouds and
  the sun's position.
- Sculpt the land with a brush.
- Run water erosion over the land.
- Switch the whole city into **voxels** (cubes).
- Flip between a readable scale and true real-world scale.
- Watch the wildlife: deer in herds that notice foxes by sight, smell (carried
  on the wind) and sound; animals that drink at the shore, bed down at night,
  shelter from the rain and leave tracks.
- Run Roosevelt Island's day in the **People** tab: change the speed, follow
  the trash flows, and read the riders, trash and electricity for the day.

---

## Standing on precedents

The project is a response to earlier attempts to picture or plan this ground:

| Precedent | What this project takes, and where it differs |
| --- | --- |
| **The Welikia / Mannahatta Project** (Eric Sanderson) | Its reconstruction of the island as it was in 1609 sets the starting point. Welikia shows one moment; this project shows the process in between. |
| **The Commissioners' Plan of 1811** | The grid is here at its real angle, but it *arrives* in 1811 rather than always being there. |
| **Johnson and Burgee's Roosevelt Island plan** (1969) | It treated the island as a planned counter-city. Here, that difference shows up as ground that never gets paved. |
| **OMA, *Delirious New York*** (1978) | Koolhaas celebrates the grid as the machine that makes the city. This model shows what the grid replaced. |
| **Louis Kahn's Four Freedoms Park** (designed 1973, opened 2012) | It shows landscape as a monument, with the island's tip as a place to look back at the city. |
| **Jessica Hsiao, *Wildform*** (a classmate's project, 2026) | A game where plants grow architecture between two buildings. I borrowed its way of teaching (a guided first run with a checklist, and a simple Play view beside a Lab with every dial), not its code. Its story runs the other way: there, nature builds; here, the city replaces nature. |

The full argument, with a year-by-year history and sources, is in
**[History and Design Position](<Tutorials/History and Design Position.md>)**.
That note also lists which parts of the app use measured data, which are
estimates, and which are design choices.

### Being honest about the model

- **The city grows as a circle around the Battery.** That's a simplification.
  The real city grew up Manhattan's spine, and Brooklyn grew out from its own
  centre.
- **Today's buildings are real; the ones before them are made up.** The data
  only knows buildings that still stand, so everything demolished before is
  missing from it. The lost city fills that gap: it follows New York's real
  rules (growth outward from the Battery, tilted grids), but no lost building
  is in its real place, and each stands for a few. Where nothing stands today,
  a lost building is cleared in about 1950, an estimate.
- **The construction years are partly estimates too.** 64% of them are
  round numbers (47,680 buildings are dated exactly 1920), so the city fills
  in with jumps at 1910, 1920 and 1930. Each real building is drawn as the
  smallest box around its outline, with its real roof height. Roosevelt
  Island's own buildings are still placed from photographs.
- **Today's streets are real; the lost city's lots are made up.** The streets
  come from the city's Centerline data. The lost city's buildings are laid along
  them by rule, not at their historical places.
- **Heights share one scale.** Trees, buildings and animals are drawn at their
  real size × 2.9 (hills ×15), so they stay in proportion to each other.
  Footprints and street widths are real.
- **The shoreline is today's in every year.** The real one moved as landfill
  was added. Welikia's historical shoreline would be the next thing to add.

---

## How it's built

A browser app written in **React** and **three.js**. Almost everything is
generated as it runs. The only 3D models are the animals, Roosevelt Island's
people and its cars and buses, and there are no texture images. Each technique
is explained, with links to its code, in
**[Tools and Procedural Techniques](docs/TECHNIQUES.md)**.

- **Terrain:** seeded fractal noise, shaped by the real coastline. The mesh is
  fine around Roosevelt Island and coarser toward the edges of the city.
- **Trees:** a procedural forest with four levels of detail, drawn with
  instancing so thousands of trees stay fast.
- **Grass and paving:** a shader paints grass and paved ground, driven by the
  year.
- **Water:** procedural water with a shoreline that follows the sea level.
- **The city:** about 494,000 buildings and 157,000 straight pieces of
  street, placed once and built by the shader as the Year changes. 422,000 of
  the buildings are real: `scripts/build-nyc-buildings.mjs` downloads the
  city's [Building Footprints](https://data.cityofnewyork.us/d/5zhs-2jue) (NYC
  Open Data), reduces each outline to its smallest rectangle and packs them
  into a 5 MB binary file the page loads after it starts. The rest are the
  procedural lost city, set along the real streets. The streets are real too:
  `scripts/build-nyc-streets.mjs` downloads the city's
  [Centerline](https://data.cityofnewyork.us/d/inkn-q76z) data (71,500 lines:
  streets, highways, paths, ramps and alleys) into a 1.3 MB file. Until it
  loads, a procedural grid stands in. The bridges are planned from the real shoreline so each spans its
  river.
- **Weather:** sky, fog, clouds, and rain or snow.
- **Animals:** the deer and foxes are Quaternius's rigged low-poly models (CC0,
  from [Poly Pizza](https://poly.pizza/u/Quaternius)). Their animations are
  baked into textures when the page loads, so hundreds of animals can each play
  their own clip with one draw call per model. The birds are built in code.
- **People and vehicles:** Roosevelt Island's people are Quaternius's animated
  Man, Man in Suit, Woman and Woman in Dress, and its cars are his Car, Sedan,
  SUV and Pickup Truck (all CC0, from [Poly Pizza](https://poly.pizza/u/Quaternius)).
  The people's walk and idle animations are baked the same way as the
  animals'. Each person wears their own shirt colour and each car its own
  paint, about one in six a yellow cab. The bus and the van are by
  [Poly by Google](https://poly.pizza/u/Poly%20by%20Google), CC-BY 3.0:
  "Bus" (https://poly.pizza/m/4CPpvEmrMoF) and "Van"
  (https://poly.pizza/m/aT_24cDaW1a).

### Run it yourself

You'll need Node.js `^20.19` or `>=22.12`.

```bash
git clone https://github.com/kmadikaegbu/procedural-world.git
cd procedural-world/react-app
npm install
npm run dev
```

Then open http://localhost:5173. The [developer guide](react-app/README.md)
covers the scripts, the architecture and how to deploy to Firebase.

---

## Explore the repository

This repo is both the app and a course vault for *Procedural World Building*.
The vault is written in [Obsidian](https://obsidian.md), but it's plain
Markdown, so it reads fine on GitHub.

| If you want… | Go to |
| --- | --- |
| The history and the design argument | [History and Design Position](<Tutorials/History and Design Position.md>) |
| How the project grew, with screenshots | [Project Timeline](<Tutorials/Project Timeline.md>) |
| How the pieces fit together | [How the World Fits Together](<Tutorials/How the World Fits Together.md>) |
| Beginner tutorials (Git, React, three.js) | [Tutorials](Tutorials/README.md) |
| The visual rules: palette, lighting, materials | [Style Guide](<Style Guide.md>) |
| Design decisions and research | [Planning](Planning/Planning.md) · [Analysis](Analysis/Analysis.md) |
| What was built each class | [Progress log](docs/progress/README.md) · [Checklist](docs/progress/CHECKLIST.md) |
| What I used, and every procedural technique | [Tools and Procedural Techniques](docs/TECHNIQUES.md) |
| The code | [`react-app/`](react-app/) |

```
procedural-world/
├── react-app/      the app (Vite + React + TypeScript + three.js)
├── Tutorials/      guides, the history note, and the project timeline
├── Planning/       design decisions and ideas
├── Analysis/       site research and technique references
├── docs/progress/  the per-class progress log
├── Style Guide.md  the visual design system
└── archive/        earlier class notes, kept for history
```

---

<sub>Built with [Vite](https://vite.dev), [React 19](https://react.dev),
[three.js](https://threejs.org) and
[@react-three/fiber](https://r3f.docs.pmnd.rs/). Hosted on
[Firebase](https://firebase.google.com/docs/hosting).</sub>
