import { tr } from '../core/i18n';
import { getMaterial } from '../core/materials';
import type { MassSource, Project, RocketGeometry } from '../core/types';
import type { DerivedGeometry } from '../geometry/rocketGeometry';

export type MassGroup = 'structure' | 'component' | 'motor';

export interface MassItem {
  id: string;
  name: string;
  group: MassGroup;
  mass: number;
  cgX: number;
  source: MassSource;
  massUncertainty: number;
  positionUncertainty: number;
  /** Axial extent, for drawing the distribution. */
  startX: number;
  endX: number;
  /** Id of the user component, or of the structural part ('nose' | 'body' | 'fins'). */
  refId: string;
}

export interface MassSummary {
  total: number;
  cgX: number;
  /** Root-sum-square of the individual mass uncertainties. */
  totalUncertainty: number;
}

export interface MassBreakdown extends MassSummary {
  items: MassItem[];
}

/** Relative uncertainty assumed for masses computed from geometry and typical densities. */
export const COMPUTED_MASS_REL_UNCERTAINTY = 0.15;
const COMPUTED_POSITION_UNCERTAINTY = 0.002;

export interface ConfigurationInput {
  excludedComponentIds: string[];
  propellantFraction: number;
}

export const FULL_CONFIGURATION: ConfigurationInput = { excludedComponentIds: [], propellantFraction: 1 };

function density(materialId: string): number {
  return getMaterial(materialId)?.density ?? 0;
}

function structural(
  refId: string, name: string, computedMass: number, cgX: number, startX: number, endX: number,
  override: RocketGeometry['body']['massOverride'],
): MassItem {
  const measured = override !== null;
  return {
    id: `struct_${refId}`,
    refId,
    name,
    group: 'structure',
    mass: measured ? override.mass : computedMass,
    cgX,
    source: measured ? 'measured' : 'computed',
    massUncertainty: measured ? override.massUncertainty : computedMass * COMPUTED_MASS_REL_UNCERTAINTY,
    positionUncertainty: COMPUTED_POSITION_UNCERTAINTY,
    startX,
    endX,
  };
}

/** Masses of nose, body and fins estimated from geometry and material density. */
export function structuralMasses(g: RocketGeometry, d: DerivedGeometry): MassItem[] {
  const { nose, body, fins } = g;

  const noseMass = nose.solid
    ? d.nose.volume * density(nose.materialId)
    : d.nose.surfaceArea * nose.wallThickness * density(nose.materialId);
  const noseCg = nose.solid ? d.nose.volumeCentroidX : d.nose.surfaceCentroidX;

  const ro = body.outerDiameter / 2;
  const ri = Math.max(0, ro - body.wallThickness);
  const bodyMass = Math.PI * (ro * ro - ri * ri) * body.length * density(body.materialId);

  const finMass = d.fins.area * fins.thickness * fins.count * density(fins.materialId);

  return [
    structural('nose', tr('Ogiva', 'Nose cone'), noseMass, noseCg, 0, nose.length, nose.massOverride),
    structural('body', tr('Tubo corpo', 'Body tube'), bodyMass, d.bodyStartX + body.length / 2, d.bodyStartX, d.bodyEndX, body.massOverride),
    structural('fins', tr(`Pinne (${fins.count})`, `Fins (${fins.count})`), finMass, d.fins.centroidX, d.fins.rootLeadingEdgeX,
      Math.max(d.fins.rootTrailingEdgeX, d.fins.tipTrailingEdgeX), fins.massOverride),
  ];
}

export function componentMasses(project: Project, config: ConfigurationInput): MassItem[] {
  const frac = Math.min(Math.max(config.propellantFraction, 0), 1);
  return project.components
    .filter((c) => !config.excludedComponentIds.includes(c.id))
    .map((c) => {
      const mass = c.kind === 'motor' ? c.mass - c.propellantMass * (1 - frac) : c.mass;
      const half = c.length > 0 ? c.length / 2 : 0;
      return {
        id: c.id,
        refId: c.id,
        name: c.kind === 'motor' && frac < 1 ? tr(`${c.name} (propellente ${Math.round(frac * 100)}%)`, `${c.name} (propellant ${Math.round(frac * 100)}%)`) : c.name,
        group: c.kind === 'motor' ? 'motor' : 'component',
        mass,
        cgX: c.cgX,
        source: c.source,
        massUncertainty: c.massUncertainty,
        positionUncertainty: c.positionUncertainty,
        startX: c.cgX - half,
        endX: c.cgX + half,
      } satisfies MassItem;
    });
}

export function combineMasses(items: Pick<MassItem, 'mass' | 'cgX' | 'massUncertainty'>[]): MassSummary {
  let total = 0, moment = 0, varSum = 0;
  for (const it of items) {
    total += it.mass;
    moment += it.mass * it.cgX;
    varSum += it.massUncertainty ** 2;
  }
  return { total, cgX: total > 0 ? moment / total : NaN, totalUncertainty: Math.sqrt(varSum) };
}

export function massBreakdown(project: Project, d: DerivedGeometry, config: ConfigurationInput = FULL_CONFIGURATION): MassBreakdown {
  const items = [...structuralMasses(project.geometry, d), ...componentMasses(project, config)];
  return { items, ...combineMasses(items) };
}
