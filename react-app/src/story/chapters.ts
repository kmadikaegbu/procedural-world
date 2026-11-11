/**
 * THE STORY of New York, told as the History Timeline plays: one chapter for
 * each turning point, from the Lenape's island to the rising sea. The story
 * card shows the latest chapter, with the population of the day beside it
 * (from map/city/population.ts), and Play can stop at each one for a few
 * seconds so it can be read.
 *
 * These are well-known events. Dates and figures follow the standard histories
 * (the City's own and the census); a few differ by a year between sources, and
 * anything here should be spot-checked before it is presented as fact.
 */

import { TIMELINE_DEFAULT } from '../map/timeline'

export interface Chapter {
  year: number
  title: string
  text: string
  /** Where it happened: the camera flies there, and the map marks it. */
  where: Where
}

/** Latitude, longitude. */
export type LatLon = [lat: number, lon: number]

/**
 * Where a chapter happened, and how the map shows it. The camera looks at `at`
 * from `view` world units away (1 unit = 33.5 m). With a label, a beacon marks
 * `at`; `path` adds a line (a wall, a bridge, a subway), `ring` an outlined area
 * (a park) and `km` a circle (a fire, a flood). With no label, it's an overview
 * and nothing is drawn. Locations are approximate: a street corner, not a survey.
 */
export interface Where {
  at: LatLon
  view: number
  label?: string
  path?: LatLon[]
  ring?: LatLon[]
  km?: number
  /** Colour: the story's usual cyan, or fire, water or park. */
  tone?: 'story' | 'fire' | 'water' | 'park'
}

export const CHAPTERS: Chapter[] = [
  {
    year: 1609,
    title: 'Mannahatta',
    text: "Henry Hudson sails into the harbour. The island is Lenape land: hills, forest, marsh and meadow, with deer, foxes, beaver and great flocks of birds. The Lenape move with the seasons, fishing, farming and hunting.",
    where: { at: [40.785, -73.965], view: 330, label: 'Mannahatta: "island of many hills"' },
  },
  {
    year: 1624,
    title: 'New Amsterdam',
    text: 'Dutch West India Company settlers arrive to trade for beaver pelts. They build Fort Amsterdam at the southern tip, where the Battery is today.',
    where: { at: [40.7043, -74.0139], view: 55, label: 'Fort Amsterdam' },
  },
  {
    year: 1626,
    title: 'The "purchase" of Manhattan',
    text: 'Peter Minuit trades goods worth 60 guilders with the Lenape for the island. The two sides understood the deal very differently: the Lenape likely thought they were sharing the land, not selling it.',
    where: { at: [40.8722, -73.9230], view: 70, label: 'Shorakkopoch, Inwood: where tradition places the deal' },
  },
  {
    year: 1653,
    title: 'The wall',
    text: "The Dutch build a wooden wall across the island's north edge, against attack. It is taken down in 1699; the street that ran beside it is still called Wall Street.",
    where: { at: [40.7062, -74.0092], view: 50, label: 'The wall, along today\'s Wall Street', path: [[40.7078, -74.0131], [40.7062, -74.0092], [40.7046, -74.0057]] },
  },
  {
    year: 1664,
    title: 'New York',
    text: "English warships sail into the harbour and the Dutch surrender without a fight. The town is renamed for the Duke of York. About 1,500 people live there.",
    where: { at: [40.7043, -74.0139], view: 70, label: 'Fort Amsterdam surrenders' },
  },
  {
    year: 1711,
    title: 'Slavery',
    text: 'A market for buying and selling enslaved people opens at the foot of Wall Street. Through the 1700s, roughly one New Yorker in five is enslaved; their labour builds much of the colonial city.',
    where: { at: [40.7052, -74.0072], view: 45, label: 'The slave market, Wall and Pearl Streets' },
  },
  {
    year: 1776,
    title: 'Revolution',
    text: 'After the Battle of Long Island the British take the city and hold it for seven years. A great fire burns hundreds of its buildings. The British leave on Evacuation Day, 1783.',
    where: { at: [40.7095, -74.0120], view: 70, label: 'The Great Fire of 1776', km: 0.45, tone: 'fire' },
  },
  {
    year: 1789,
    title: 'The first capital',
    text: "George Washington is sworn in as the first President at Federal Hall on Wall Street. New York is the nation's capital for a year. In 1792, traders sign the agreement that becomes the Stock Exchange.",
    where: { at: [40.7073, -74.0103], view: 45, label: 'Federal Hall' },
  },
  {
    year: 1811,
    title: 'The grid',
    text: "The Commissioners' Plan lays a grid of streets and avenues over all of Manhattan, tilted 29°, across hills, streams and farms that would be levelled to fit it. Watch it appear on the map.",
    where: { at: [40.7330, -73.9930], view: 160, label: 'The grid starts north of Houston Street', path: [[40.7287, -74.0105], [40.7243, -73.9925], [40.7205, -73.9787]] },
  },
  {
    year: 1825,
    title: 'The Erie Canal',
    text: "The canal links the Hudson to the Great Lakes, and New York becomes the nation's busiest port, pulling far ahead of every other American city.",
    where: { at: [40.7065, -74.0036], view: 120, label: 'South Street: the port. Up the Hudson to the canal', path: [[40.7000, -74.0200], [40.7400, -74.0130], [40.8000, -73.9850], [40.8800, -73.9350]] },
  },
  {
    year: 1827,
    title: 'Emancipation',
    text: 'Slavery ends in New York State. Free Black New Yorkers had already built their own churches, schools and, uptown, Seneca Village.',
    where: { at: [40.7830, -73.9690], view: 55, label: 'Seneca Village' },
  },
  {
    year: 1835,
    title: 'The Great Fire',
    text: 'In a freezing December, fire destroys about 700 buildings in lower Manhattan, much of the old Dutch town. The city rebuilds in brick and stone, and builds the Croton Aqueduct for water (1842).',
    where: { at: [40.7048, -74.0090], view: 55, label: 'The Great Fire of 1835', km: 0.28, tone: 'fire' },
  },
  {
    year: 1847,
    title: 'Immigration',
    text: "Famine in Ireland and revolution in Germany send hundreds of thousands to New York. The population doubles in twenty years; many crowd into tenements on the Lower East Side.",
    where: { at: [40.7150, -73.9850], view: 70, label: 'The Lower East Side' },
  },
  {
    year: 1858,
    title: 'Central Park',
    text: "Work begins on Olmsted and Vaux's plan. About 1,600 people, among them Seneca Village's Black landowners, are evicted to make way. The park's lakes and hills are built, not left wild.",
    where: { at: [40.7826, -73.9656], view: 170, label: 'Central Park', ring: [[40.7644, -73.9730], [40.7681, -73.9819], [40.8006, -73.9582], [40.7968, -73.9493]], tone: 'park' },
  },
  {
    year: 1863,
    title: 'The Draft Riots',
    text: 'Protest against the Civil War draft turns into four days of violence, much of it aimed at Black New Yorkers. It is one of the deadliest riots in American history.',
    where: { at: [40.7540, -73.9717], view: 60, label: 'The draft office, Third Avenue and 47th Street' },
  },
  {
    year: 1883,
    title: 'The Brooklyn Bridge',
    text: 'The longest suspension bridge in the world joins Manhattan to the City of Brooklyn, then the third-largest city in the country.',
    where: { at: [40.7065, -73.9968], view: 70, label: 'The Brooklyn Bridge', path: [[40.7112, -74.0013], [40.7021, -73.9905]] },
  },
  {
    year: 1886,
    title: 'Liberty',
    text: 'The Statue of Liberty is dedicated in the harbour. From 1892, Ellis Island beside it processes more than 12 million immigrants.',
    where: { at: [40.6892, -74.0445], view: 90, label: 'The Statue of Liberty' },
  },
  {
    year: 1898,
    title: 'Greater New York',
    text: 'Manhattan, Brooklyn, Queens, the Bronx and Staten Island join into one city of about 3.4 million people, the second-largest in the world after London.',
    where: { at: [40.7128, -74.0060], view: 600, label: 'City Hall: five boroughs, one city' },
  },
  {
    year: 1904,
    title: 'The subway',
    text: 'The first subway line opens, from City Hall to Harlem. The city can now spread out along the lines, and the farms of the outer boroughs fill with houses.',
    where: { at: [40.7650, -73.9800], view: 300, label: 'The first subway: City Hall to Harlem', path: [[40.7134, -74.0045], [40.7299, -73.9910], [40.7519, -73.9772], [40.7559, -73.9871], [40.7937, -73.9722], [40.8263, -73.9503]] },
  },
  {
    year: 1909,
    title: 'Across the island',
    text: 'The Queensboro Bridge opens, passing right over Blackwell\'s Island (now Roosevelt Island) on its way to Queens.',
    where: { at: [40.7566, -73.9535], view: 70, label: 'The Queensboro Bridge', path: [[40.7600, -73.9625], [40.7566, -73.9535], [40.7517, -73.9410]] },
  },
  {
    year: 1911,
    title: 'The Triangle fire',
    text: '146 garment workers, most of them young immigrant women, die in a factory fire behind locked doors. New York writes the first modern workplace-safety laws.',
    where: { at: [40.7302, -73.9955], view: 45, label: 'The Triangle Waist Company' },
  },
  {
    year: 1916,
    title: 'Zoning',
    text: "After the Equitable Building blocks the sun from its neighbours, the city passes the country's first zoning law. Towers must step back as they rise: the 'wedding-cake' skyline.",
    where: { at: [40.7085, -74.0108], view: 45, label: 'The Equitable Building' },
  },
  {
    year: 1920,
    title: 'The Harlem Renaissance',
    text: 'In the Great Migration, Black Americans move north; Harlem becomes the centre of Black art, music and writing.',
    where: { at: [40.8095, -73.9480], view: 70, label: 'Harlem' },
  },
  {
    year: 1929,
    title: 'Crash',
    text: "The stock market crashes on Wall Street and the Depression begins. Even so, the towers already started keep rising.",
    where: { at: [40.7069, -74.0113], view: 45, label: 'The Stock Exchange' },
  },
  {
    year: 1931,
    title: 'The skyscrapers',
    text: 'The Empire State Building opens, the tallest in the world for forty years, a year after the Chrysler Building. Watch Midtown rise around them.',
    where: { at: [40.7484, -73.9857], view: 60, label: 'The Empire State Building' },
  },
  {
    year: 1936,
    title: 'Robert Moses',
    text: 'The Triborough Bridge opens. Over forty years Moses builds bridges, parkways, beaches and pools, and cuts expressways through neighbourhoods.',
    where: { at: [40.7930, -73.9270], view: 100, label: 'The Triborough Bridge', path: [[40.8030, -73.9300], [40.7960, -73.9250], [40.7790, -73.9230]] },
  },
  {
    year: 1950,
    title: 'The peak',
    text: 'Nearly 7.9 million people live in the city. From here, many move to the suburbs, and the docks and factories begin to close.',
    where: { at: [40.7300, -73.9500], view: 650 },
  },
  {
    year: 1952,
    title: 'The United Nations',
    text: 'The UN headquarters opens on the East River, facing the island across the water.',
    where: { at: [40.7489, -73.9680], view: 55, label: 'The United Nations' },
  },
  {
    year: 1973,
    title: 'Roosevelt Island',
    text: 'Welfare Island is renamed. Its hospitals give way to a planned "new town in town"; the Tramway follows in 1976. The World Trade Center opens downtown the same year.',
    where: { at: [40.7620, -73.9500], view: 90, label: 'Roosevelt Island' },
  },
  {
    year: 1975,
    title: 'The fiscal crisis',
    text: 'The city nearly goes bankrupt. Services are cut, and by 1980 the population has fallen to about 7 million.',
    where: { at: [40.7128, -74.0060], view: 50, label: 'City Hall' },
  },
  {
    year: 1990,
    title: 'The comeback',
    text: 'Crime begins a long fall, and new immigrants from the Caribbean, Latin America, Asia and Africa grow the city again.',
    where: { at: [40.7557, -73.8831], view: 80, label: 'Jackson Heights, Queens' },
  },
  {
    year: 2001,
    title: 'September 11',
    text: 'Terrorist attacks destroy the World Trade Center and kill nearly 3,000 people. One World Trade Center opens on the site in 2014.',
    where: { at: [40.7115, -74.0134], view: 50, label: 'The World Trade Center' },
  },
  {
    year: 2012,
    title: 'Hurricane Sandy',
    text: "A storm surge of about 14 feet at the Battery floods subway tunnels and lower Manhattan, and kills 44 New Yorkers. The sea is about a foot higher than a century before, and the city begins building flood walls.",
    where: { at: [40.7070, -74.0120], view: 110, label: 'Flooded by the surge', km: 0.8, tone: 'water' },
  },
  {
    year: 2020,
    title: 'The pandemic',
    text: 'COVID-19 hits New York first and hardest among American cities. The census that year counts 8.8 million New Yorkers, the most ever.',
    where: { at: [40.7447, -73.8857], view: 70, label: 'Elmhurst Hospital, Queens' },
  },
  {
    year: TIMELINE_DEFAULT,
    title: 'Today',
    text: "About 422,000 buildings stand on this map. Wild land is down to the parks and Roosevelt Island, where a few animals hang on.",
    where: { at: [40.7620, -73.9500], view: 110, label: 'Roosevelt Island: the last wild land' },
  },
  {
    year: 2050,
    title: 'The rising sea',
    text: "From here the story is imagined. The sea keeps rising, by a curve drawn far steeper than the forecasts so it can be seen. Watch the shoreline, and the low ground around the island.",
    where: { at: [40.7050, -74.0120], view: 260, label: 'Low ground at risk', km: 1.5, tone: 'water' },
  },
  {
    year: 2100,
    title: '2100',
    text: 'Where the city meets the water is the question for the next century: walls, wetlands, raised ground, or retreat.',
    where: { at: [40.7300, -73.9800], view: 600 },
  },
]

/** The chapter in force in `year`: the latest one at or before it. */
export function chapterAt(year: number): number {
  let i = 0
  while (i + 1 < CHAPTERS.length && CHAPTERS[i + 1].year <= year) i++
  return i
}

/** The first chapter after `year`, or null if there are none left. */
export function chapterAfter(year: number): Chapter | null {
  return CHAPTERS.find((c) => c.year > year) ?? null
}

/** How long Play holds on each new chapter, so it can be read (seconds). */
export const HOLD_SECONDS = 5
