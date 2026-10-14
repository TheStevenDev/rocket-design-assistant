import type { Text } from '../core/i18n';
import type { NoseShape } from '../core/types';

export const NOSE_SHAPE_LABELS: Record<NoseShape, Text> = {
  conical: { it: 'Conica', en: 'Conical' },
  ogive: { it: 'Ogiva tangente', en: 'Tangent ogive' },
  elliptical: { it: 'Ellittica', en: 'Elliptical' },
  parabolic: { it: 'Parabolica', en: 'Parabolic' },
  power: { it: 'Serie di potenza', en: 'Power series' },
  vonKarman: { it: 'Von Kármán (Haack LD)', en: 'Von Kármán (Haack LD)' },
};

/**
 * Radius of the nose cone at axial station x (0 = tip, length = shoulder).
 * R is the base radius. `n` is the exponent of the power series shape.
 */
export function noseRadiusAt(shape: NoseShape, x: number, length: number, R: number, n = 0.5): number {
  if (length <= 0 || R <= 0) return 0;
  const xi = Math.min(Math.max(x / length, 0), 1);
  switch (shape) {
    case 'conical':
      return R * xi;
    case 'ogive': {
      const rho = (R * R + length * length) / (2 * R);
      const dx = length - xi * length;
      return Math.max(0, Math.sqrt(Math.max(rho * rho - dx * dx, 0)) + R - rho);
    }
    case 'elliptical':
      return R * Math.sqrt(Math.max(0, 1 - (1 - xi) * (1 - xi)));
    case 'parabolic':
      return R * (2 * xi - xi * xi);
    case 'power':
      return R * Math.pow(xi, Math.min(Math.max(n, 0.05), 1));
    case 'vonKarman': {
      const theta = Math.acos(1 - 2 * xi);
      return (R / Math.sqrt(Math.PI)) * Math.sqrt(Math.max(0, theta - Math.sin(2 * theta) / 2));
    }
  }
}

export interface ProfilePoint {
  x: number;
  r: number;
}

/** Samples the profile with points clustered near the tip, where curvature is highest. */
export function sampleNoseProfile(shape: NoseShape, length: number, R: number, n = 0.5, segments = 64): ProfilePoint[] {
  const pts: ProfilePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = length * (shape === 'conical' ? t : t * t * (3 - 2 * t) * 0.5 + t * 0.5);
    pts.push({ x, r: noseRadiusAt(shape, x, length, R, n) });
  }
  return pts;
}

export interface NoseIntegrals {
  /** Enclosed volume (solid of revolution). */
  volume: number;
  /** x of the centroid of the enclosed volume. */
  volumeCentroidX: number;
  /** Lateral (wetted) surface area. */
  surfaceArea: number;
  /** x of the centroid of the lateral surface. */
  surfaceCentroidX: number;
}

const cache = new Map<string, NoseIntegrals>();

/** Numerical integration of the nose profile (frustum sums on a fine grid), memoised. */
export function integrateNose(shape: NoseShape, length: number, R: number, n = 0.5, steps = 2000): NoseIntegrals {
  const key = `${shape}|${length}|${R}|${n}|${steps}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const result = integrateNoseUncached(shape, length, R, n, steps);
  if (cache.size > 64) cache.clear();
  cache.set(key, result);
  return result;
}

function integrateNoseUncached(shape: NoseShape, length: number, R: number, n: number, steps: number): NoseIntegrals {
  let volume = 0, volMoment = 0, area = 0, areaMoment = 0;
  let prevX = 0;
  let prevR = noseRadiusAt(shape, 0, length, R, n);
  for (let i = 1; i <= steps; i++) {
    const x = (length * i) / steps;
    const r = noseRadiusAt(shape, x, length, R, n);
    const dx = x - prevX;
    const xm = (x + prevX) / 2;
    // Frustum volume and lateral area between the two stations.
    const dV = (Math.PI * dx * (prevR * prevR + prevR * r + r * r)) / 3;
    const slant = Math.hypot(dx, r - prevR);
    const dA = Math.PI * (prevR + r) * slant;
    volume += dV; volMoment += dV * xm;
    area += dA; areaMoment += dA * xm;
    prevX = x; prevR = r;
  }
  return {
    volume,
    volumeCentroidX: volume > 0 ? volMoment / volume : 0,
    surfaceArea: area,
    surfaceCentroidX: area > 0 ? areaMoment / area : 0,
  };
}
