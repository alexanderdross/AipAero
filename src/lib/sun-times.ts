// Dependency-free sunrise / sunset / civil-twilight calculation (the standard
// "sunrise equation", NOAA-derived). Pure function, no API, no key - so it runs
// server-side for any airport whose coordinates we already have (the NOAA METAR
// response carries lat/lon for reporting stations). All times are UTC.

const DEG = Math.PI / 180;

const toJulian = (d: Date) => d.getTime() / 86400000 + 2440587.5;
const fromJulian = (j: number) => new Date((j - 2440587.5) * 86400000);

// Returns the rise/set times of the sun crossing the given altitude `angle`
// (degrees): -0.833 = official sunrise/sunset, -6 = civil twilight. `null` when
// the event does not occur that day (polar day/night).
function sunEvent(
  date: Date,
  lat: number,
  lon: number,
  angle: number,
): { rise: Date | null; set: Date | null } {
  const n = Math.round(toJulian(date) - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const Mr = M * DEG;
  const C =
    1.9148 * Math.sin(Mr) + 0.02 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const lr = lambda * DEG;
  const jTransit =
    2451545.0 + jStar + 0.0053 * Math.sin(Mr) - 0.0069 * Math.sin(2 * lr);
  const sinDec = Math.sin(lr) * Math.sin(23.44 * DEG);
  const cosDec = Math.cos(Math.asin(sinDec));
  const latR = lat * DEG;
  const cosOmega =
    (Math.sin(angle * DEG) - Math.sin(latR) * sinDec) /
    (Math.cos(latR) * cosDec);
  if (cosOmega > 1 || cosOmega < -1) return { rise: null, set: null };
  const omega = Math.acos(cosOmega) / DEG;
  return {
    rise: fromJulian(jTransit - omega / 360),
    set: fromJulian(jTransit + omega / 360),
  };
}

export interface SunTimes {
  sunrise: Date | null;
  sunset: Date | null;
  civilDawn: Date | null;
  civilDusk: Date | null;
}

export function getSunTimes(date: Date, lat: number, lon: number): SunTimes {
  const official = sunEvent(date, lat, lon, -0.833);
  const civil = sunEvent(date, lat, lon, -6);
  return {
    sunrise: official.rise,
    sunset: official.set,
    civilDawn: civil.rise,
    civilDusk: civil.set,
  };
}
