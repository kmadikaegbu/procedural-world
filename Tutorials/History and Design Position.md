# History and Design Position

What the project is *about*: the making of New York City's ground, and Roosevelt
Island's place in it. This note holds the history the app is built on, the
design position it takes, the precedents it answers, and how each historical
fact turns into something you can see on screen.

> [!summary] The position in one line
> **New York's ground is made, not given.** The map reads the city as a record
> of decisions laid over a Lenape landscape: the 1811 grid, the clearing of the
> forest, landfill, and now a rising sea. Roosevelt Island is the counterpoint.
> The city used it to keep people out of sight, then remade it as a planned
> "new town in town" and a memorial, and it is the one piece of ground in the
> model that is never paved.

> [!note] This is a draft position
> Written to get the argument on the page. Rewrite it in your own words and
> sharpen it with your professor: a design position only counts if it's yours.

---

# Part 1 — The history

## Two timelines, one map

The city grew outward from the **Battery**, the southern tip of Manhattan.
Roosevelt Island, 3.2 km of rock in the East River, sat just beyond that growth
for most of its history. It was close enough to use and far enough to ignore.

| Year | The city | The island |
| --- | --- | --- |
| 1609 | Henry Hudson sails into the harbour. Mannahatta is Lenape land: over 55 ecological communities of forest, marsh, meadow and streams (the Welikia Project's reconstruction). | **Minnehanonck** to the Lenape. |
| 1624–25 | The Dutch found **New Amsterdam** at the Battery. | |
| 1637 | | The Dutch take it: **Varken Eylandt**, Hog Island. |
| 1664 | The English take the town; it becomes **New York**. | |
| 1686 | | Robert Blackwell's family takes it over: **Blackwell's Island**, a name that lasts 235 years. |
| 1692 on | Landfill begins pushing Lower Manhattan's shore out into the rivers. By the 19th century about 137 acres have been made this way. | |
| 1811 | The **Commissioners' Plan** lays a rectangular grid over all of Manhattan, ignoring its hills and streams, tilted 29° to follow the island. The commissioners expected it to take centuries to fill. | |
| 1828 | | The city buys the island (sources say 1821 or 1828) for its prisons and hospitals: a penitentiary, then a workhouse. |
| 1839 | | The **Octagon**, A. J. Davis's lunatic asylum, opens. |
| 1856 | The Battery tide gauge starts measuring sea level. | James Renwick Jr.'s **Smallpox Hospital** opens. |
| 1909 | The **Queensboro Bridge** opens, passing right over the island. Manhattan's population peaks the next year at about 2.3 million. | |
| 1921 | | Renamed **Welfare Island**: hospitals take over (Goldwater Hospital, 1939). |
| 1950 | The whole city is built up; about 7.9 million people. | |
| 1969 | | The state's Urban Development Corporation leases the island for 99 years and adopts **Philip Johnson and John Burgee's** master plan for a "new town in town". |
| 1973 | Battery Park City's landfill, partly from the World Trade Center's excavation, is underway, the last great Manhattan fill. | Renamed **Roosevelt Island**. **Louis Kahn** designs a memorial to FDR for its southern tip; he dies in 1974. |
| 1975–76 | | **OMA** (Rem Koolhaas and partners) draw paper projects for the island, among them the *Welfare Palace Hotel*, later published in *Delirious New York* (1978). |
| 1976 | | The **Roosevelt Island Tramway** opens. |
| 2012 | | **Four Freedoms Park** opens, built to Kahn's design almost 40 years later. |
| 2017 | | **Cornell Tech** opens its first building. |
| 2024 | The Battery gauge shows the sea rising **2.94 mm a year** since 1856, about half a metre so far. | |

## What the history says

- **The ground is built.** Estimates put about a quarter of Manhattan's land on
  fill. The shoreline in this map is today's, and that shoreline is itself a
  construction.
- **The grid came before the city.** In 1811 most of Manhattan was farms and
  woods. The plan decided the city's shape in advance and flattened the
  landscape to fit it.
- **The island was the city's edge, inside the city.** For 150 years
  Blackwell's and then Welfare Island held what the city didn't want to see:
  prisoners, the poor, the sick, people with mental illness. The 1969 plan and
  the renaming were a deliberate attempt to rewrite that.
- **The sea is now the one remaking the shore.** The same water that was
  filled in for 300 years is slowly coming back.

---

# Part 2 — The design position

The app is not a neutral model of a place. It argues that:

1. **Land is a decision, not a given.** Every grey cell in the city is ground
   that something was cleared, filled or paved to make. The timeline makes you
   watch it happen, from the Battery outward.
2. **The grid is an act of imposition.** The street grid appears in 1811 and
   only on ground the city has reached. It is drawn faint so the land can be
   seen under it.
3. **Roosevelt Island resists.** It stays green in every era, through the
   asylum years and today. It is the place the city kept apart, and in the
   model it is the only ground the paving rule can't reach.
4. **Procedural noise is honest about what we don't know.** Nobody surveyed the
   hills of 1609 in detail. Instead of pretending, the terrain's relief is
   seeded noise inside a coastline that *is* real data. The parts that are
   measured are kept separate from the parts that are invented, and the
   difference is stated in the app.
5. **The future is a choice too.** The sea-level curve after today is
   deliberately stylized and steep. It is a provocation, not a forecast, and it
   says so.

---

# Part 3 — Precedents, and what this project does with them

| Precedent | What it does | What I take | What I do differently |
| --- | --- | --- | --- |
| **Welikia / Mannahatta Project** (Eric Sanderson, Wildlife Conservation Society, 1999–2013) | Reconstructs Manhattan's ecology as of September 1609 by matching a Revolutionary War-era British map to the modern city. | The starting year (1609) and the idea that the "natural" island is a design subject in its own right. | Welikia freezes one moment. This project is about the **process** in between, the clearing and paving, and lets you scrub through it. It also admits where it guesses (procedural relief) instead of reconstructing. |
| **The Commissioners' Plan of 1811** | A rectangular grid laid over the whole island, regardless of terrain, tilted 29°. | The grid's real 29° angle in the ground shader, with block spacing approximated (streets ~80 m apart, avenues drawn ~190 m apart). | The grid is not the city's permanent fact. It **appears** in 1811 and only where the city has grown, so it reads as an event, not a background. |
| **Johnson and Burgee's Roosevelt Island plan** (1969) | A planned "new town in town" on a former institutional island: mid- and high-rise housing by well-known architects, built out in about eight years. | The island as a deliberately planned counter-city. | Instead of buildings, the island's planned difference shows up as **ground that's never paved**: green in every era. |
| **OMA, *Delirious New York* and the Welfare Island projects** (1975–78) | Treats Manhattan's grid as a machine that produces the city; the *Welfare Palace Hotel* imagines a "city within a city" at the island's southern tip. | Reading the grid as the generator of the city, and Roosevelt Island as a place to test ideas about Manhattan. | Koolhaas celebrates the grid's density. This project shows the **cost** of the grid: the forest it replaces. |
| **Louis Kahn's Four Freedoms Park** (designed 1973–74, opened 2012) | A memorial of stone and trees at the island's tip, pointing at the UN and Manhattan. | Landscape as monument; the island's tip as a place to look back at the city. | A possible next step: model the park's allée and the view corridor down the river. |
| **Jessica Hsiao, *Wildform*** (a classmate's project in this course, 2026) | A game on the same island: you place blocks and plant climbers, spreaders and drapers, and where the plants meet they grow bridges, balconies and towers. It teaches itself one hint at a time, with a checklist of the goal, and keeps every dial in a separate Lab. | The way of teaching: a guided first run whose stops tick off as you do them, and a simple Explore view beside a Lab with every slider. (The idea only; none of its code.) | The story runs the other way. In Wildform nature builds the architecture; here the city replaces nature, and the tour ends on the last wild land and the rising sea. |

---

# Part 4 — How the history becomes the app

One control, the **History Timeline** (1609 → 2100), drives all of it.

| History | In the app | Measured or estimated? |
| --- | --- | --- |
| The city grows out from the Battery | Paving spreads in a circle around the Battery: New Amsterdam (~0.8 km) by 1664, ~2.5 km by 1800, ~6.5 km (42nd St) by 1850, into Harlem and Brooklyn by 1900, the whole city by 1950. | **Estimate.** A circle is a simplification; the real city grew up Manhattan's spine and out from Brooklyn's own centre. |
| The forest is cleared for the city | Trees vanish where the paving reaches; about 8% survive as street and park trees. | **Stylized** share. |
| The 1811 grid | Street lines fade in from 1811 over ten years, only on paved ground, at Manhattan's 29° angle. | Year and angle **real**; spacing approximate. |
| The buildings | The 421,993 buildings standing today rise in the year the city records for each (NYC Building Footprints), at their real place and roof height. Before them, a procedural "lost city" stands for the buildings since torn down. | Standing buildings **real** (64% of years are rounded); the lost city **procedural**, cleared by ~1950 where nothing stands today. |
| Roosevelt Island apart from the city | The island is never paved and keeps its trees in every era. | A **design choice**: the island did have buildings throughout. |
| The story | A card tells the city's history in 37 chapters as the years pass (`react-app/src/story/chapters.ts`), each with the population of its year; Play stops on each so it can be read, and the camera flies to where it happened, marked with a beacon, line or area. | **Real** events from the standard histories; dates and figures should be spot-checked before presenting. Chapters after today are imagined. |
| The names | The header changes Mannahatta → New Amsterdam → New York City; the panel shows Minnehanonck → Hog Island → Blackwell's → Welfare → Roosevelt Island, plus the latest event. | **Real**; a few dates differ by a year between sources. |
| Sea level | Rises 2.94 mm a year from 1856 (the Battery gauge), drawn at the hills' 15× so it shows; held flat before 1856. After today, a steep stylized curve. | **Measured** up to today; **stylized** after. |

Screenshots of the same view in three years:

![1609: Mannahatta, all forest and meadow](<timeline/19-history-1609.jpg>)

![1880: Manhattan paved and cleared from the Battery up; Queens still wooded; Blackwell's Island green](<timeline/19-history-1880.jpg>)

![2026: the whole city paved, street trees only; Roosevelt Island still wooded](<timeline/19-history-2026.jpg>)

The code: `react-app/src/map/timeline.ts` holds every date, curve and name;
`world/region.ts` (`urbanWeight`, `greenAt`) turns the city's reach into
paving; the ground shader draws the grid; `Props.tsx` clears the trees.

---

# Part 5 — Limits and next steps

- **The shoreline is today's.** The landfill that built Lower Manhattan,
  Battery Park City and parts of every borough is not shown: the land is
  already there in 1609. The Welikia Project's historical shoreline would fix
  this: the coast could grow over time, the way the paving does.
- **The city's growth is a circle.** Better: digitize a handful of historical
  maps (1767 Ratzer, 1836, 1879, 1916) into "built-up by year" outlines.
- **Buildings are boxes, and the demolished ones are invented.** Today's
  buildings are real but drawn as the rectangle around each outline. Buildings
  torn down before today aren't in the data; a historical source (the 1916
  Bromley atlases, or the NYPL's digitized building footprints) could replace
  the lost city. Roosevelt Island's own landmarks (the Octagon, the Smallpox
  Hospital, the lighthouse) are still placed from photographs.
- **The island's own shape changed** (its tips and seawalls were built up over
  time). Not modelled.
- **Self-critique:** the circle-from-the-Battery growth and the 8% street-tree
  share are the weakest assumptions. They should be stated in any
  presentation, along with what would replace them.

---

## Island life: what's real and what's stylized

The People tab runs Roosevelt Island as a city simulation, modelled on Stone
Librande's SimCity diagrams (Class 09): units, agents, paths and resources.

**From the island's record:**
- Opening years:
  - the new town and the Tramway: 1975–76
  - the F train station: 1989
  - Manhattan Park: 1989
  - the Octagon's apartments: 2006
  - Southpoint Park: 2011
  - Four Freedoms Park: 2012
  - Cornell Tech and The House: 2017
  - Goldwater Hospital closed in 2013
- A Tram cabin carries 110 people.
- The pneumatic trash system (AVAC) has run under Main Street since 1975.
- The resident count is scaled to the 2020 census, 11,722.

**Stylized:**
- **Schedules and roles:** the shares of commuters, children, retirees and
  local workers, and the times they leave and come back.
- **Hospital staff:** the three shifts and how many work each one.
- **Timetables:** the headways for the Tram, the train and the bus.
- **Rates:** trash per person and per hospital, and every electrical load.
  They give the right shape of a day (an evening peak, a quiet night with
  the hospital still running), not measured figures.
- **The AVAC plant** is placed at the north end, but its position is
  approximate.
- **The trash in the tubes** is drawn at a tenth of its real speed (about
  100 km/h), so it can be followed.

**Simplifications:**
- Every day is a weekday.
- Each agent stands for ten people.
- Everyone walks Main Street; there are no cars on the island.
- The Tram's labelled queue is the island's side only. Trips leave on the
  timetable, separate from the cabins drawn on the cable.

---

## Sources

- [Roosevelt Island — Wikipedia](https://en.wikipedia.org/wiki/Roosevelt_Island)
- [Roosevelt Island Tramway — Wikipedia](https://en.wikipedia.org/wiki/Roosevelt_Island_Tramway)
- [Roosevelt Island station — Wikipedia](https://en.wikipedia.org/wiki/Roosevelt_Island_station)
- [Automated vacuum collection — Wikipedia](https://en.wikipedia.org/wiki/Automated_vacuum_collection)
- [Roosevelt Island Historical Walk — correctionhistory.org](https://correctionhistory.org/rooseveltisland/html/rooseveltislandtour_names.html)
- [Islands of New York City: Roosevelt Island — NYPL](https://live-legacy-admin.nypl.org/blog/2009/03/28/islands-new-york-city-roosevelt-island)
- [The Octagon (Roosevelt Island) — Wikipedia](https://en.wikipedia.org/wiki/The_Octagon_(Roosevelt_Island))
- [Smallpox Hospital — Wikipedia](https://en.wikipedia.org/wiki/Smallpox_Hospital)
- [Roosevelt Island — The Cultural Landscape Foundation](https://www.tclf.org/landscapes/roosevelt-island)
- [Franklin D. Roosevelt Four Freedoms Park — Wikipedia](https://en.wikipedia.org/wiki/Franklin_D._Roosevelt_Four_Freedoms_Park)
- [Louis Kahn and the memorial's history — Cooper Union](https://archweb.cooper.edu/exhibitions/kahn/history_01.html)
- [Delirious New York — Wikipedia](https://en.wikipedia.org/wiki/Delirious_New_York)
- [Welfare Palace Hotel (1978) — Drawing Matter](https://drawingmatter.org/?p=133)
- [Roosevelt Island Redevelopment Project — MoMA](https://www.moma.org/collection/works/818)
- [Land reclamation in Lower Manhattan — Wikipedia](https://en.wikipedia.org/wiki/Land_reclamation_in_Lower_Manhattan)
- [Battery Park City — Wikipedia](https://en.wikipedia.org/wiki/Battery_Park_City)
- [On this day in 1811, the Manhattan street grid became official — 6sqft](https://www.6sqft.com/204-years-ago-today-the-manhattan-street-grid-became-official/)
- [How far from true north are the avenues of Manhattan? — Charles Petzold](https://ftp.charlespetzold.com/etc/AvenuesOfManhattan)
- [Notes on the Commissioners' Future City — Gotham Center](https://gothamcenter.org/blog/notes-on-the-commissioners-future-city)
- [Mannahatta / Welikia — Wildlife Conservation Society](https://newsroom.wcs.org/News-Releases/articleType/ArticleView/articleId/6296/Well-Take-Mannahatta.aspx)
- [NOAA sea level trends (The Battery, 8518750)](https://tidesandcurrents.noaa.gov/sltrends/msltrendstable.htm)
- [NYC total population 1790–2000 — NYC Planning](https://www.nyc.gov/assets/planning/download/pdf/data-maps/nyc-population/historical-population/1790-2000_nyc_total_foreign_birth.pdf)
- [Notes on Manhattan Bricks (Manhattan's 1910 population peak) — Gotham Center](https://www.gothamcenter.org/blog/notes-on-manhattan-bricks)
