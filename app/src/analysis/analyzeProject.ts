import { tr } from '../core/i18n';
import type { Issue, ModelAssumption, Project } from '../core/types';
import { deriveGeometry, type DerivedGeometry } from '../geometry/rocketGeometry';
import type { MassBreakdown } from '../mass/massProperties';
import { barrowman, barrowmanAssumptions, type BarrowmanResult } from '../physics/barrowman';
import { finStructureAssumptions } from '../physics/finStructure';
import { sensitivityAnalysis, type SensitivityResult } from '../physics/sensitivity';
import {
  assessReliability, classifyMargin, configurationResults, propellantSweep, stabilityPoint,
  type ConfigurationResult, type MarginClass, type Reliability, type SweepPoint,
} from '../physics/stability';
import { validateProject } from '../validation/validate';
import { assessCompleteness, type Completeness } from './completeness';

export interface StabilityResult {
  cgX: number;
  cpX: number;
  margin: number;
  marginClass: MarginClass;
  cp: BarrowmanResult;
  reliability: Reliability;
}

export interface AnalysisResult {
  derived: DerivedGeometry;
  /** Mass breakdown of the reference configuration (first configuration, or full). */
  mass: MassBreakdown;
  referenceConfigurationName: string;
  stability: StabilityResult;
  configurations: ConfigurationResult[];
  propellantSweep: SweepPoint[];
  sensitivity: SensitivityResult | null;
  completeness: Completeness;
  issues: Issue[];
  assumptions: ModelAssumption[];
}

export function massAssumptions(): ModelAssumption[] {
  const model = tr('Masse', 'Masses');
  return [
    tr('Origine dell\'asse nella punta dell\'ogiva, x positiva verso la coda.', 'Axis origin at the nose tip, x positive towards the tail.'),
    tr('Masse strutturali stimate da geometria e densità tipica (incertezza ±15%) se non misurate.', 'Structural masses estimated from geometry and typical density (±15% uncertainty) when not measured.'),
    tr('Ogiva cava modellata come guscio sottile di spessore costante; la spalla di innesto non è inclusa.', 'Hollow nose cone modelled as a thin shell of constant thickness; the shoulder is not included.'),
    tr('Il propellente si consuma restando centrato nel CG del motore.', 'The propellant burns while staying centred on the motor CG.'),
  ].map((text) => ({ model, text }));
}

export interface AnalyzeOptions {
  sensitivity?: boolean;
  monteCarloSamples?: number;
}

/** Pure function: Project → every derived quantity shown by the UI. */
export function analyzeProject(project: Project, opts: AnalyzeOptions = {}): AnalysisResult {
  const derived = deriveGeometry(project.geometry);
  const issues = validateProject(project, derived);
  const cp = barrowman(project.geometry, derived);
  const refConfig = project.configurations[0] ?? { id: 'full', name: tr('Completa', 'Complete'), excludedComponentIds: [], propellantFraction: 1 };
  const point = stabilityPoint(project, derived, cp, refConfig);
  const reliability = assessReliability(project, cp, issues);
  const computable = reliability.status !== 'unavailable';

  const stability: StabilityResult = {
    cgX: point.cgX,
    cpX: computable ? cp.cpX : NaN,
    margin: computable ? point.margin : NaN,
    marginClass: computable ? classifyMargin(point.margin) : 'unavailable',
    cp,
    reliability,
  };

  return {
    derived,
    mass: point.mass,
    referenceConfigurationName: refConfig.name,
    stability,
    configurations: computable ? configurationResults(project, derived, cp) : [],
    propellantSweep: computable ? propellantSweep(project, derived, cp) : [],
    sensitivity: computable && opts.sensitivity !== false
      ? sensitivityAnalysis(project, derived, refConfig, opts.monteCarloSamples ?? 400)
      : null,
    completeness: assessCompleteness(project, issues),
    issues,
    assumptions: [...massAssumptions(), ...barrowmanAssumptions(), ...finStructureAssumptions()],
  };
}
