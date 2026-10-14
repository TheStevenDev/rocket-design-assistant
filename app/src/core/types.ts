// Core data structures. All values are SI: metres, kilograms, kg/m³, pascal.
// Longitudinal axis: origin at the nose tip, x positive towards the tail.

import type { Text } from './i18n';

export type LengthUnit = 'mm' | 'cm' | 'm';
export type MassUnit = 'g' | 'kg';

export type NoseShape = 'conical' | 'ogive' | 'elliptical' | 'parabolic' | 'power' | 'vonKarman';

export type FinCrossSection = 'square' | 'rounded' | 'airfoil';

/** Where a mass value comes from. `computed` = derived from geometry and material density. */
export type MassSource = 'measured' | 'estimated' | 'computed';

/** A measured mass that replaces the value computed from geometry. */
export interface MassOverride {
  mass: number;
  massUncertainty: number;
}

export interface NoseGeometry {
  shape: NoseShape;
  length: number;
  wallThickness: number;
  /** Solid nose (e.g. turned balsa) instead of a thin shell. */
  solid: boolean;
  /** Exponent for the `power` shape (0 < n ≤ 1). Ignored otherwise. */
  shapeParameter: number;
  materialId: string;
  massOverride: MassOverride | null;
}

export interface BodyGeometry {
  outerDiameter: number;
  length: number;
  wallThickness: number;
  materialId: string;
  massOverride: MassOverride | null;
}

export interface FinGeometry {
  count: number;
  rootChord: number;
  tipChord: number;
  /** Semi-span: distance from body surface to fin tip. */
  span: number;
  /** Axial distance from root leading edge to tip leading edge. */
  sweepLength: number;
  thickness: number;
  /** Distance from the aft end of the body to the root trailing edge. */
  aftOffset: number;
  crossSection: FinCrossSection;
  materialId: string;
  massOverride: MassOverride | null;
}

export interface RocketGeometry {
  nose: NoseGeometry;
  body: BodyGeometry;
  fins: FinGeometry;
}

export type ComponentKind = 'generic' | 'motor';

/** What a component is for. Drives grouping in the beginner UI; physics only uses `kind`. */
export type ComponentRole = 'gps' | 'sensor' | 'computer' | 'camera' | 'battery' | 'recovery' | 'other';

export interface MassComponent {
  id: string;
  name: string;
  kind: ComponentKind;
  role?: ComponentRole;
  /** Entry of the built-in catalog the component was created from (see core/catalog). */
  catalogId?: string;
  /** Motor only: average thrust [N], used for the thrust-to-weight check. */
  avgThrust?: number;
  /** For a motor: loaded (lift-off) mass including propellant. */
  mass: number;
  /** Motor only: propellant mass consumed during the burn. */
  propellantMass: number;
  /** Position of the component's own CG from the nose tip. */
  cgX: number;
  /** Optional, 0 = not specified. Used for drawing. */
  length: number;
  diameter: number;
  source: 'measured' | 'estimated';
  massUncertainty: number;
  positionUncertainty: number;
  notes: string;
}

export interface MassConfiguration {
  id: string;
  name: string;
  excludedComponentIds: string[];
  /** 1 = full motor, 0 = burnout. */
  propellantFraction: number;
}

export type FinAttachment = 'surface' | 'slot' | 'throughTheWall';
export type MaterialConfidence = 'typical' | 'datasheet' | 'tested' | 'unknown';

export interface FinStructureInfo {
  fabricationMethod: string;
  attachment: FinAttachment;
  minManufacturableThickness: number;
  thicknessTolerance: number;
  /** ± tolerance on fin planform dimensions (chords, span, sweep, position). */
  dimensionalTolerance: number;
  edgeTreatment: string;
  /** User-provided material properties, override the library values when not null. */
  youngModulusOverride: number | null;
  shearModulusOverride: number | null;
  materialConfidence: MaterialConfidence;
  expectedMaxSpeed: number | null;
  expectedMaxAltitude: number | null;
  notes: string;
}

export interface ProjectSettings {
  lengthUnit: LengthUnit;
  massUnit: MassUnit;
}

export interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export const SCHEMA_VERSION = 1 as const;

export interface Project {
  schemaVersion: typeof SCHEMA_VERSION;
  meta: ProjectMeta;
  geometry: RocketGeometry;
  components: MassComponent[];
  configurations: MassConfiguration[];
  finStructure: FinStructureInfo;
  settings: ProjectSettings;
}

export interface Material {
  id: string;
  name: Text;
  density: number;
  youngModulus: number | null;
  shearModulus: number | null;
  poissonRatio: number | null;
  confidence: MaterialConfidence;
  notes: Text;
}

// ---------------------------------------------------------------------------
// Results (produced by analyzeProject, never persisted)

export type Severity = 'error' | 'warning' | 'info';
export type Area = 'design' | 'mass' | 'stability' | 'fins' | 'project';

export interface Issue {
  severity: Severity;
  area: Area;
  /** Dotted path of the related field, when there is one. */
  field?: string;
  message: string;
}

export interface ModelAssumption {
  model: string;
  text: string;
}
