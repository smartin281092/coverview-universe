import rawGeometry from "./health.geo.json" with { type: "json" };
import { z } from "zod";
const area = z.object({
  bounds: z.array(z.number()).length(4),
  polygons: z.array(z.array(z.array(z.array(z.number()).length(2)))),
});
const geometry = z
  .object({
    municipalities: z.array(area.extend({ id: z.number().int(), regionId: z.string() })),
    countries: z.array(area.extend({ country: z.string() })),
  })
  .parse(rawGeometry);
// swisstopo, ch1903wgs84-EN.pdf, December 2016, p.3. Navigation approximation (~1 m).
export function swissCoordinates(latitude: number, longitude: number) {
  const p = (latitude * 3600 - 169028.66) / 10000,
    l = (longitude * 3600 - 26782.5) / 10000;
  return [
    2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l * l * l,
    1200147.07 +
      308807.95 * p +
      3745.25 * l * l +
      76.63 * p * p -
      194.56 * l * l * p +
      119.79 * p * p * p,
  ] as const;
}
function inRing(x: number, y: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    if (a[1]! > y !== b[1]! > y && x < ((b[0]! - a[0]!) * (y - a[1]!)) / (b[1]! - a[1]!) + a[0]!)
      inside = !inside;
  }
  return inside;
}
function contains(x: number, y: number, feature: { bounds: number[]; polygons: number[][][][] }) {
  const b = feature.bounds;
  return (
    x >= b[0]! &&
    y >= b[1]! &&
    x <= b[2]! &&
    y <= b[3]! &&
    feature.polygons.some(
      (p) => inRing(x, y, p[0]!) && !p.slice(1).some((hole) => inRing(x, y, hole)),
    )
  );
}
export function locateCoordinates(latitude: number, longitude: number, accuracy: number) {
  if (accuracy > 10000 || latitude < 44 || latitude > 49 || longitude < 4 || longitude > 12)
    return null;
  const [x, y] = swissCoordinates(latitude, longitude);
  const municipality = geometry.municipalities.find((feature) => contains(x, y, feature));
  if (municipality)
    return { municipalityId: municipality.id, regionId: municipality.regionId, country: "CH" };
  const country = geometry.countries.find((feature) => contains(x, y, feature))?.country;
  return country && country !== "LI"
    ? { municipalityId: null, regionId: `EU-${country}`, country }
    : null;
}
