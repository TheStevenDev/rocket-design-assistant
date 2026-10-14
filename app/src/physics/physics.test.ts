import { describe, expect, it } from 'vitest';
import { defaultProject } from '../core/defaults';
import type { Project } from '../core/types';
import { analyzeProject } from '../analysis/analyzeProject';
import { integrateNose, noseRadiusAt } from '../geometry/noseProfile';
import { deriveGeometry } from '../geometry/rocketGeometry';
import { combineMasses, massBreakdown } from '../mass/massProperties';
import { barrowman } from './barrowman';
import { classifyMargin } from './stability';

describe('nose profile', () => {
  it('ends at the base radius for every shape', () => {
    for (const s of ['conical', 'ogive', 'elliptical', 'parabolic', 'power', 'vonKarman'] as const) {
      expect(noseRadiusAt(s, 0.2, 0.2, 0.033)).toBeCloseTo(0.033, 6);
      expect(noseRadiusAt(s, 0, 0.2, 0.033)).toBeCloseTo(0, 6);
    }
  });
  it('integrates a cone exactly', () => {
    const L = 0.3, R = 0.05;
    const n = integrateNose('conical', L, R);
    expect(n.volume).toBeCloseTo((Math.PI * R * R * L) / 3, 8);
    expect(n.volumeCentroidX).toBeCloseTo(0.75 * L, 6);
    expect(n.surfaceArea).toBeCloseTo(Math.PI * R * Math.hypot(R, L), 8);
    expect(n.surfaceCentroidX).toBeCloseTo((2 / 3) * L, 6);
  });
});

describe('Barrowman', () => {
  const withNose = (shape: Project['geometry']['nose']['shape']) => {
    const p = defaultProject();
    p.geometry.nose.shape = shape;
    return p;
  };
  it('places the CP of a cone at 2/3 of its length', () => {
    const p = withNose('conical');
    const r = barrowman(p.geometry, deriveGeometry(p.geometry));
    expect(r.contributions[0].cpX).toBeCloseTo((2 / 3) * p.geometry.nose.length, 4);
  });
  it('places the CP of an elliptical nose at 1/3 of its length', () => {
    const p = withNose('elliptical');
    const r = barrowman(p.geometry, deriveGeometry(p.geometry));
    expect(r.contributions[0].cpX / p.geometry.nose.length).toBeCloseTo(1 / 3, 2);
  });
  it('places the CP of a tangent ogive near 0.47 L', () => {
    const p = withNose('ogive');
    const r = barrowman(p.geometry, deriveGeometry(p.geometry));
    const ratio = r.contributions[0].cpX / p.geometry.nose.length;
    expect(ratio).toBeGreaterThan(0.44);
    expect(ratio).toBeLessThan(0.5);
  });
  it('matches a hand calculation for the fin set', () => {
    // Reference: 4 fins, Cr=0.12, Ct=0.05, s=0.08, Xs=0.06, d=0.066.
    const p = defaultProject();
    const d = deriveGeometry(p.geometry);
    const fin = barrowman(p.geometry, d).contributions[1];
    const R = 0.033, s = 0.08, D = 0.066, cr = 0.12, ct = 0.05, xs = 0.06;
    const l = Math.hypot(s, xs + ct / 2 - cr / 2);
    const cn = (1 + R / (s + R)) * (16 * (s / D) ** 2) / (1 + Math.sqrt(1 + (2 * l / (cr + ct)) ** 2));
    const xf = (xs / 3) * (cr + 2 * ct) / (cr + ct) + (1 / 6) * (cr + ct - cr * ct / (cr + ct));
    expect(fin.cnAlpha).toBeCloseTo(cn, 8);
    expect(fin.cpX).toBeCloseTo(0.8 - 0.12 + xf, 8);
  });
});

describe('mass properties', () => {
  it('combines point masses', () => {
    const r = combineMasses([{ mass: 1, cgX: 0, massUncertainty: 0.3 }, { mass: 3, cgX: 1, massUncertainty: 0.4 }]);
    expect(r.total).toBe(4);
    expect(r.cgX).toBeCloseTo(0.75);
    expect(r.totalUncertainty).toBeCloseTo(0.5);
  });
  it('computes the body tube mass from geometry', () => {
    const p = defaultProject();
    const body = massBreakdown(p, deriveGeometry(p.geometry)).items.find((i) => i.refId === 'body')!;
    const expected = Math.PI * (0.033 ** 2 - 0.0315 ** 2) * 0.6 * 700;
    expect(body.mass).toBeCloseTo(expected, 8);
    expect(body.cgX).toBeCloseTo(0.5, 8);
    expect(body.source).toBe('computed');
  });
  it('uses a measured override and marks it as measured', () => {
    const p = defaultProject();
    p.geometry.body.massOverride = { mass: 0.2, massUncertainty: 0.001 };
    const body = massBreakdown(p, deriveGeometry(p.geometry)).items.find((i) => i.refId === 'body')!;
    expect(body.mass).toBe(0.2);
    expect(body.source).toBe('measured');
  });
  it('removes propellant at burnout', () => {
    const p = defaultProject();
    const d = deriveGeometry(p.geometry);
    const full = massBreakdown(p, d, { excludedComponentIds: [], propellantFraction: 1 });
    const empty = massBreakdown(p, d, { excludedComponentIds: [], propellantFraction: 0 });
    expect(full.total - empty.total).toBeCloseTo(0.12, 10);
  });
});

describe('analyzeProject', () => {
  it('produces a plausible margin for the default rocket', () => {
    const r = analyzeProject(defaultProject(), { monteCarloSamples: 50 });
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.stability.margin).toBeGreaterThan(0.5);
    expect(r.stability.margin).toBeLessThan(3);
    expect(r.stability.cpX).toBeGreaterThan(r.stability.cgX);
    expect(r.configurations).toHaveLength(2);
    expect(r.sensitivity!.tornado.length).toBeGreaterThan(5);
    const mc = r.sensitivity!.monteCarlo!;
    expect(mc.p05).toBeLessThanOrEqual(mc.p50);
    expect(mc.p50).toBeLessThanOrEqual(mc.p95);
  });
  it('is deterministic', () => {
    const p = defaultProject();
    const a = analyzeProject(p, { monteCarloSamples: 50 });
    const b = analyzeProject(p, { monteCarloSamples: 50 });
    expect(a.sensitivity!.monteCarlo!.p50).toBe(b.sensitivity!.monteCarlo!.p50);
  });
  it('refuses to estimate stability with invalid geometry', () => {
    const p = defaultProject();
    p.geometry.body.wallThickness = 0.05;
    const r = analyzeProject(p, { sensitivity: false });
    expect(r.stability.reliability.status).toBe('unavailable');
    expect(r.stability.marginClass).toBe('unavailable');
    expect(Number.isNaN(r.stability.margin)).toBe(true);
  });
  it('flags a missing motor', () => {
    const p = defaultProject();
    p.components = p.components.filter((c) => c.kind !== 'motor');
    const r = analyzeProject(p, { sensitivity: false });
    expect(r.stability.reliability.status).toBe('limited');
    expect(r.stability.reliability.missing.some((m) => m.startsWith('Motor'))).toBe(true);
  });
  it('flags fins that overrun the body', () => {
    const p = defaultProject();
    p.geometry.fins.aftOffset = 0.55;
    const r = analyzeProject(p, { sensitivity: false });
    expect(r.issues.some((i) => i.field === 'geometry.fins.aftOffset' && i.severity === 'error')).toBe(true);
  });
  it('classifies margins without calling anything safe', () => {
    expect(classifyMargin(-0.1)).toBe('negative');
    expect(classifyMargin(0.5)).toBe('low');
    expect(classifyMargin(1.5)).toBe('typical');
    expect(classifyMargin(3)).toBe('high');
  });
});
