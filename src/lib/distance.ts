// Great-circle distance between two lat/lon points, in kilometres (haversine).
// Pure, dependency-free - used for "weather from the nearest station" and the
// "nearby airfields" list.

const R_KM = 6371;
const toRad = (x: number) => (x * Math.PI) / 180;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}
