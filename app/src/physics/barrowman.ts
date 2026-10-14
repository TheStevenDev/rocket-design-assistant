import { tr } from '../core/i18n';
import type { ModelAssumption, RocketGeometry } from '../core/types';
import type { DerivedGeometry } from '../geometry/rocketGeometry';

export interface CpContribution {
  part: 'nose' | 'fins';
  name: string;
  /** Normal-force coefficient slope [1/rad], referred to the body cross-section area. */
  cnAlpha: number;
  /** Centre of pressure of this part, from the nose tip. */
  cpX: number;
}

export interface BarrowmanResult {
  contributions: CpContribution[];
  cnAlpha: number;
  cpX: number;
  /** Fin–body interference factor K = 1 + R/(s+R). */
  interferenceFactor: number;
}

export function barrowmanAssumptions(): ModelAssumption[] {
  return [
    tr('Flusso subsonico e incomprimibile: nessuna correzione per il numero di Mach.', 'Subsonic, incompressible flow: no Mach number correction.'),
    tr('Angolo d\'attacco piccolo (indicativamente sotto 10°): la portanza del corpo cilindrico è trascurata.', 'Small angle of attack (roughly below 10°): the lift of the cylindrical body is neglected.'),
    tr('Corpo rigido, assialsimmetrico, con superficie liscia; nessuna transizione o boattail.', 'Rigid, axisymmetric body with a smooth surface; no transitions or boattail.'),
    tr('Pinne piane, sottili, trapezoidali, identiche e disposte simmetricamente.', 'Flat, thin, trapezoidal fins, all identical and symmetrically arranged.'),
    tr('Interferenza pinne–corpo modellata solo con il fattore K = 1 + R/(s+R).', 'Fin–body interference modelled only through the factor K = 1 + R/(s+R).'),
    tr('Nessun effetto di rotazione (roll), di raffica, di vento o di separazione del flusso.', 'No effects of roll, gusts, wind or flow separation.'),
  ].map((text) => ({ model: 'Barrowman', text }));
}

/**
 * Efficiency factor for fin counts other than 3–4, from the approximation used
 * by common hobby tools: adding more fins does not add lift linearly.
 */
export function finCountEfficiency(count: number): number {
  const table: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 0.948, 6: 0.913, 7: 0.854, 8: 0.81 };
  return table[Math.round(count)] ?? 0.75;
}

/** Barrowman centre of pressure for nose + body + one set of trapezoidal fins. */
export function barrowman(g: RocketGeometry, d: DerivedGeometry): BarrowmanResult {
  const D = d.referenceDiameter;
  const R = d.bodyRadius;
  const contributions: CpContribution[] = [];

  // Nose: CNα = 2 for any slender body of revolution; X_N = L − V/A_base.
  if (g.nose.length > 0 && D > 0) {
    contributions.push({ part: 'nose', name: tr('Ogiva', 'Nose cone'), cnAlpha: 2, cpX: g.nose.length - d.nose.volume / d.referenceArea });
  }


  const f = g.fins;
  const fd = d.fins;
  let K = 1;
  if (f.count > 0 && f.span > 0 && f.rootChord > 0 && D > 0) {
    const s = f.span, cr = f.rootChord, ct = f.tipChord, xs = f.sweepLength;
    K = 1 + R / (s + R);
    const cnFins = (4 * f.count * (s / D) ** 2) / (1 + Math.sqrt(1 + ((2 * fd.midChordLength) / (cr + ct)) ** 2));
    const cnAlpha = K * cnFins * finCountEfficiency(f.count);
    const xf = (xs / 3) * (cr + 2 * ct) / (cr + ct) + (1 / 6) * ((cr + ct) - (cr * ct) / (cr + ct));
    contributions.push({ part: 'fins', name: tr(`Pinne (${f.count})`, `Fins (${f.count})`), cnAlpha, cpX: fd.rootLeadingEdgeX + xf });
  }

  const cnAlpha = contributions.reduce((a, c) => a + c.cnAlpha, 0);
  const cpX = cnAlpha > 0 ? contributions.reduce((a, c) => a + c.cnAlpha * c.cpX, 0) / cnAlpha : NaN;
  return { contributions, cnAlpha, cpX, interferenceFactor: K };
}
