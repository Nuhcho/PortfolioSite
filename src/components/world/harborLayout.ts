/** Shared shore footprints keep the water depth, rocks and port in agreement. */
export const SHORE_QUAYS = [
  { center: [-7.125, 1], halfSize: [16.125, 20.25] },
  { center: [19.125, 1], halfSize: [4.125, 20.25] },
  { center: [31.5, 3.5], halfSize: [8.25, 17.75] },
] as const;

export const BREAKWATER_ARMS = [
  { center: [43, 29.3], halfSize: [1.75, 16.3] },
  { center: [30.625, 44.2], halfSize: [10.625, 1.4] },
] as const;

// One continuous outline avoids intersecting, coplanar caps at the corner.
export const BREAKWATER_OUTLINE = [
  [41.25, 13], [44.75, 13], [44.75, 45.6],
  [20, 45.6], [20, 42.8], [41.25, 42.8],
] as const;

export const PORT_FOCUS = [32, 1, 20] as const;

/** Each closed island pairs the ground beneath the town with its waterline.
 * Narrow sections preserve the canal and working berths; exposed coasts
 * spread into broad, curved headlands rather than ending in separate strips. */
export const ISLAND_SHORES = [
  [
    [-22.7,-18.7,-25.5,-22.8],[-18,-18.7,-18,-24],[-8,-18.7,-8,-21.7],
    [5.8,-18.7,5.8,-22.7],[8.5,-18.7,8.95,-19.3],
    [8.5,-8,9.06,-8],[8.5,8,9.06,8],[8.5,19.8,9.04,19.8],
    [8,20.7,8,21.35],[2.5,20.7,2.5,21.35],[-3.5,20.7,-3.5,21.4],
    [-8.5,20.7,-8.5,26.5],[-14.5,20.7,-14.5,28.4],[-20,20.7,-20,25.7],
    [-22.7,20.7,-26.8,23],[-22.7,17,-29.2,17],[-22.7,10,-28.2,10],
    [-22.7,4,-29.5,4],[-22.7,-3,-26.5,-3],[-22.7,-13,-28,-13],
  ],
  [
    [15.5,-18.7,15.08,-19.3],[18,-18.7,18,-22.4],[22.7,-18.7,22.6,-21.7],
    [25.5,-13.7,25.5,-18.2],[33.5,-13.7,33.5,-18.8],[39.2,-13.7,41,-15],
    [39.2,-9,43.3,-9],[39.2,-2,41.7,-2],[39.2,5,43.4,5],
    [39.2,12,40.2,12],[39.2,19.7,39.9,19.7],
    [38,20.7,38,21.35],[30,20.7,30,21.35],[24,20.7,24,21.35],
    [18,20.7,18,21.35],[15.5,20,15.08,20],[15.5,9,15.08,9],[15.5,-6,15.08,-6],
  ],
] as const;
