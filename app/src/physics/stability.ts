import { tr, type Text } from '../core/i18n';
import type { Issue, MassConfiguration, Project } from '../core/types';
import { deriveGeometry, type DerivedGeometry } from '../geometry/rocketGeometry';
import { massBreakdown, type ConfigurationInput, type MassBreakdown } from '../mass/massProperties';
import { barrowman, type BarrowmanResult } from './barrowman';

export type MarginClass = 'negative' | 'low' | 'typical' | 'high' | 'unavailable';

/** Reference band commonly quoted for hobby rockets. Not a safety criterion. */
export const TYPICAL_MARGIN_MIN = 1;
export const TYPICAL_MARGIN_MAX = 2;

export const MARGIN_CLASS_LABELS: Record<MarginClass, Text> = {
  negative: { it: 'Negativo: instabile secondo il modello', en: 'Negative: unstable according to the model' },
  low: { it: 'Sotto l\'intervallo di riferimento (1–2 cal)', en: 'Below the reference range (1–2 cal)' },
  typical: { it: 'Nell\'intervallo di riferimento (1–2 cal) secondo il modello', en: 'Within the reference range (1–2 cal) according to the model' },
  high: { it: 'Sopra l\'intervallo di riferimento: possibile sovrastabilità', en: 'Above the reference range: possibly overstable' },
  unavailable: { it: 'Non stimabile', en: 'Cannot be estimated' },
};

export function classifyMargin(margin: number): MarginClass {
  if (!Number.isFinite(margin)) return 'unavailable';
  if (margin < 0) return 'negative';
  if (margin < TYPICAL_MARGIN_MIN) return 'low';
  if (margin <= TYPICAL_MARGIN_MAX) return 'typical';
  return 'high';
}

export interface StabilityPoint {
  cgX: number;
  cpX: number;
  /** Static margin in body calibers. */
  margin: number;
  mass: MassBreakdown;
}

export function stabilityPoint(project: Project, d: DerivedGeometry, cp: BarrowmanResult, config: ConfigurationInput): StabilityPoint {
  const mass = massBreakdown(project, d, config);
  const margin = d.referenceDiameter > 0 ? (cp.cpX - mass.cgX) / d.referenceDiameter : NaN;
  return { cgX: mass.cgX, cpX: cp.cpX, margin, mass };
}

/** Margin for a project evaluated from scratch (used by the sensitivity analysis). */
export function evaluateMargin(project: Project, config: ConfigurationInput): number {
  const d = deriveGeometry(project.geometry);
  return stabilityPoint(project, d, barrowman(project.geometry, d), config).margin;
}

export type ReliabilityStatus = 'unavailable' | 'limited' | 'withinAssumptions';

export interface Reliability {
  status: ReliabilityStatus;
  /** Why the estimate is unavailable or limited. */
  reasons: string[];
  /** Data that would improve the estimate. */
  missing: string[];
}

export function assessReliability(project: Project, cp: BarrowmanResult, issues: Issue[]): Reliability {
  const reasons: string[] = [];
  const missing: string[] = [];
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) reasons.push(tr(`Il progetto contiene ${errors.length} errore/i di input da correggere.`, `The project has ${errors.length} input error(s) to fix.`));
  if (!(cp.cnAlpha > 0) || !Number.isFinite(cp.cpX)) reasons.push(tr('Il centro di pressione non è calcolabile con la geometria attuale.', 'The centre of pressure cannot be computed with the current geometry.'));
  if (!cp.contributions.some((c) => c.part === 'fins')) {
    reasons.push(tr('Nessuna superficie stabilizzatrice valida.', 'No valid stabilising surface.'));
    missing.push(tr('Geometria delle pinne', 'Fin geometry'));
  }
  if (reasons.length > 0) return { status: 'unavailable', reasons, missing };

  const motor = project.components.find((c) => c.kind === 'motor');
  if (!motor) {
    reasons.push(tr('Manca il motore: il CG calcolato non corrisponde alla configurazione di volo.', 'No motor: the computed CG does not match the flight configuration.'));
    missing.push(tr('Motore (massa al decollo, massa propellente, posizione)', 'Motor (lift-off mass, propellant mass, position)'));
  } else if (motor.propellantMass <= 0) {
    missing.push(tr('Massa del propellente del motore', 'Motor propellant mass'));
  }
  const f = project.geometry.fins.count;
  if (f !== 3 && f !== 4) reasons.push(tr(`Con ${f} pinne la formula di Barrowman è un'approssimazione.`, `With ${f} fins the Barrowman formula is an approximation.`));
  for (const i of issues) if (i.severity === 'warning' && i.area === 'stability') reasons.push(i.message);

  const g = project.geometry;
  const unmeasured = [g.nose, g.body, g.fins].filter((p) => p.massOverride === null).length;
  if (unmeasured > 0) missing.push(tr(`Masse misurate delle parti strutturali (${unmeasured} su 3 sono stimate dalla geometria)`, `Measured masses of the structural parts (${unmeasured} of 3 are estimated from geometry)`));
  const estimated = project.components.filter((c) => c.source === 'estimated').length;
  if (estimated > 0) missing.push(tr(`Masse misurate dei componenti (${estimated} su ${project.components.length} sono stime)`, `Measured component masses (${estimated} of ${project.components.length} are estimates)`));

  return { status: reasons.length > 0 ? 'limited' : 'withinAssumptions', reasons, missing };
}

export interface ConfigurationResult {
  configuration: MassConfiguration;
  point: StabilityPoint;
  marginClass: MarginClass;
}

export function configurationResults(project: Project, d: DerivedGeometry, cp: BarrowmanResult): ConfigurationResult[] {
  return project.configurations.map((configuration) => {
    const point = stabilityPoint(project, d, cp, configuration);
    return { configuration, point, marginClass: classifyMargin(point.margin) };
  });
}

export interface SweepPoint {
  propellantFraction: number;
  cgX: number;
  margin: number;
  mass: number;
}

/** Static margin as propellant is consumed (100% → 0%), all components included. */
export function propellantSweep(project: Project, d: DerivedGeometry, cp: BarrowmanResult, steps = 20): SweepPoint[] {
  const out: SweepPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const propellantFraction = 1 - i / steps;
    const p = stabilityPoint(project, d, cp, { excludedComponentIds: [], propellantFraction });
    out.push({ propellantFraction, cgX: p.cgX, margin: p.margin, mass: p.mass.total });
  }
  return out;
}
