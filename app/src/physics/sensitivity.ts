import { tr } from '../core/i18n';
import type { Project } from '../core/types';
import type { DerivedGeometry } from '../geometry/rocketGeometry';
import { structuralMasses, type ConfigurationInput } from '../mass/massProperties';
import { evaluateMargin } from './stability';

/** One uncertain input: apply(project, delta) mutates a cloned project. */
export interface UncertainParameter {
  id: string;
  label: string;
  /** ± half-width of the uncertainty interval (SI). */
  halfWidth: number;
  kind: 'mass' | 'position' | 'geometry';
  apply: (p: Project, delta: number) => void;
}

export function uncertainParameters(project: Project, d: DerivedGeometry): UncertainParameter[] {
  const params: UncertainParameter[] = [];
  for (const s of structuralMasses(project.geometry, d)) {
    const part = s.refId as 'nose' | 'body' | 'fins';
    params.push({
      id: `mass:${part}`, label: tr(`Massa ${s.name.toLowerCase()}`, `Mass of ${s.name.toLowerCase()}`), halfWidth: s.massUncertainty, kind: 'mass',
      apply: (p, delta) => { p.geometry[part].massOverride = { mass: Math.max(0, s.mass + delta), massUncertainty: s.massUncertainty }; },
    });
  }
  for (const c of project.components) {
    params.push({
      id: `mass:${c.id}`, label: tr(`Massa ${c.name}`, `Mass of ${c.name}`), halfWidth: c.massUncertainty, kind: 'mass',
      apply: (p, delta) => { const t = p.components.find((x) => x.id === c.id)!; t.mass = Math.max(t.propellantMass, t.mass + delta); },
    });
    params.push({
      id: `pos:${c.id}`, label: tr(`Posizione ${c.name}`, `Position of ${c.name}`), halfWidth: c.positionUncertainty, kind: 'position',
      apply: (p, delta) => { p.components.find((x) => x.id === c.id)!.cgX += delta; },
    });
  }
  const tol = project.finStructure.dimensionalTolerance;
  const fin = (key: 'rootChord' | 'tipChord' | 'span' | 'sweepLength' | 'aftOffset', label: string, min = 0) =>
    params.push({
      id: `geom:${key}`, label, halfWidth: tol, kind: 'geometry',
      apply: (p, delta) => { p.geometry.fins[key] = Math.max(min, p.geometry.fins[key] + delta); },
    });
  fin('span', tr('Apertura pinne', 'Fin span'), 1e-4);
  fin('rootChord', tr('Corda radice pinne', 'Fin root chord'), 1e-4);
  fin('tipChord', tr('Corda estremità pinne', 'Fin tip chord'));
  fin('sweepLength', tr('Freccia pinne', 'Fin sweep'), -Infinity);
  fin('aftOffset', tr('Posizione pinne', 'Fin position'));
  return params.filter((x) => x.halfWidth > 0);
}

export interface TornadoEntry {
  id: string;
  label: string;
  halfWidth: number;
  kind: UncertainParameter['kind'];
  marginLow: number;
  marginHigh: number;
  /** |marginHigh − marginLow| */
  swing: number;
}

export interface MonteCarloSummary {
  samples: number;
  min: number;
  p05: number;
  p50: number;
  p95: number;
  max: number;
  /** Histogram of margins: bin lower edges and counts. */
  histogram: { x0: number; x1: number; count: number }[];
}

export interface SensitivityResult {
  nominal: number;
  tornado: TornadoEntry[];
  monteCarlo: MonteCarloSummary | null;
}

/** Deterministic PRNG so results are repeatable between renders. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function sensitivityAnalysis(
  project: Project, d: DerivedGeometry, config: ConfigurationInput, samples = 400, seed = 12345,
): SensitivityResult {
  const nominal = evaluateMargin(project, config);
  const params = uncertainParameters(project, d);
  const run = (deltas: Map<string, number>) => {
    const p = structuredClone(project);
    for (const prm of params) {
      const delta = deltas.get(prm.id);
      if (delta) prm.apply(p, delta);
    }
    return evaluateMargin(p, config);
  };

  const tornado: TornadoEntry[] = params.map((prm) => {
    const marginLow = run(new Map([[prm.id, -prm.halfWidth]]));
    const marginHigh = run(new Map([[prm.id, prm.halfWidth]]));
    return { id: prm.id, label: prm.label, halfWidth: prm.halfWidth, kind: prm.kind, marginLow, marginHigh, swing: Math.abs(marginHigh - marginLow) };
  }).sort((a, b) => b.swing - a.swing);

  let monteCarlo: MonteCarloSummary | null = null;
  if (samples > 0 && params.length > 0 && Number.isFinite(nominal)) {
    const rnd = mulberry32(seed);
    const values: number[] = [];
    for (let i = 0; i < samples; i++) {
      const deltas = new Map(params.map((prm) => [prm.id, (rnd() * 2 - 1) * prm.halfWidth]));
      const m = run(deltas);
      if (Number.isFinite(m)) values.push(m);
    }
    values.sort((a, b) => a - b);
    const min = values[0], max = values[values.length - 1];
    const bins = 16;
    const w = (max - min) / bins || 1e-6;
    const histogram = Array.from({ length: bins }, (_, k) => ({ x0: min + k * w, x1: min + (k + 1) * w, count: 0 }));
    for (const v of values) histogram[Math.min(bins - 1, Math.floor((v - min) / w))].count++;
    monteCarlo = { samples: values.length, min, p05: quantile(values, 0.05), p50: quantile(values, 0.5), p95: quantile(values, 0.95), max, histogram };
  }
  return { nominal, tornado, monteCarlo };
}
