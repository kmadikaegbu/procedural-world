// Its own module so noise.ts and terraform.ts can both use it without
// importing each other.
export const MAP_SIZE = 100 // world units across the terrain plane

/** Fraction of the map the island spans north→south — this is what ties the map to real metres (see scale.ts). */
export const ISLAND_LENGTH = 0.96
