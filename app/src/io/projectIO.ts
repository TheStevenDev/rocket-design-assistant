import { z } from 'zod';
import { tr } from '../core/i18n';
import { newId } from '../core/ids';
import { LENGTH_FACTORS, MASS_FACTORS } from '../core/units';
import { SCHEMA_VERSION, type Project } from '../core/types';

export const FILE_FORMAT = 'rocket-design-assistant';

const num = z.number();
const nonNeg = z.number().min(0);
const override = z.object({ mass: nonNeg, massUncertainty: nonNeg }).nullable();

const projectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  meta: z.object({
    id: z.string(), name: z.string(), description: z.string().default(''),
    createdAt: z.string(), updatedAt: z.string(),
  }),
  geometry: z.object({
    nose: z.object({
      shape: z.enum(['conical', 'ogive', 'elliptical', 'parabolic', 'power', 'vonKarman']),
      length: num, wallThickness: num, solid: z.boolean(), shapeParameter: num.default(0.5),
      materialId: z.string(), massOverride: override,
    }),
    body: z.object({ outerDiameter: num, length: num, wallThickness: num, materialId: z.string(), massOverride: override }),
    fins: z.object({
      count: z.number().int(), rootChord: num, tipChord: num, span: num, sweepLength: num, thickness: num, aftOffset: num,
      crossSection: z.enum(['square', 'rounded', 'airfoil']), materialId: z.string(), massOverride: override,
    }),
  }),
  components: z.array(z.object({
    id: z.string(), name: z.string(), kind: z.enum(['generic', 'motor']),
    mass: num, propellantMass: num.default(0), cgX: num, length: num.default(0), diameter: num.default(0),
    source: z.enum(['measured', 'estimated']), massUncertainty: nonNeg.default(0), positionUncertainty: nonNeg.default(0),
    notes: z.string().default(''),
    role: z.enum(['gps', 'sensor', 'computer', 'camera', 'battery', 'recovery', 'other']).optional(),
    catalogId: z.string().optional(),
    avgThrust: nonNeg.optional(),
  })),
  configurations: z.array(z.object({
    id: z.string(), name: z.string(), excludedComponentIds: z.array(z.string()), propellantFraction: z.number().min(0).max(1),
  })),
  finStructure: z.object({
    fabricationMethod: z.string(), attachment: z.enum(['surface', 'slot', 'throughTheWall']),
    minManufacturableThickness: nonNeg, thicknessTolerance: nonNeg, dimensionalTolerance: nonNeg.default(0.001),
    edgeTreatment: z.string(), youngModulusOverride: z.number().positive().nullable(), shearModulusOverride: z.number().positive().nullable(),
    materialConfidence: z.enum(['typical', 'datasheet', 'tested', 'unknown']),
    expectedMaxSpeed: nonNeg.nullable(), expectedMaxAltitude: nonNeg.nullable(), notes: z.string().default(''),
  }),
  settings: z.object({ lengthUnit: z.enum(['mm', 'cm', 'm']), massUnit: z.enum(['g', 'kg']) }),
});

export interface ProjectFile {
  format: typeof FILE_FORMAT;
  formatVersion: 1;
  /** Units of every length and mass in `project`. Exports always use SI. */
  units: { length: string; mass: string };
  exportedAt: string;
  project: Project;
}

export function exportProject(p: Project): string {
  const file: ProjectFile = { format: FILE_FORMAT, formatVersion: 1, units: { length: 'm', mass: 'kg' }, exportedAt: new Date().toISOString(), project: p };
  return JSON.stringify(file, null, 2);
}

export function exportFileName(p: Project): string {
  const slug = p.meta.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || tr('razzo', 'rocket');
  return `${slug}.rocket.json`;
}

export type ImportResult =
  | { ok: true; project: Project; warnings: string[] }
  | { ok: false; errors: string[] };

type Json = Record<string, unknown>;

/** Scales the length and mass fields of a raw (unvalidated) project in place. */
function scaleUnits(raw: Json, lf: number, mf: number) {
  const scale = (obj: unknown, keys: string[], f: number) => {
    if (!obj || typeof obj !== 'object') return;
    const o = obj as Json;
    for (const k of keys) if (typeof o[k] === 'number') o[k] = (o[k] as number) * f;
  };
  const g = raw.geometry as Json | undefined;
  if (g) {
    scale(g.nose, ['length', 'wallThickness'], lf);
    scale(g.body, ['outerDiameter', 'length', 'wallThickness'], lf);
    scale(g.fins, ['rootChord', 'tipChord', 'span', 'sweepLength', 'thickness', 'aftOffset'], lf);
    for (const part of ['nose', 'body', 'fins']) scale((g[part] as Json | undefined)?.massOverride, ['mass', 'massUncertainty'], mf);
  }
  if (Array.isArray(raw.components)) {
    for (const c of raw.components) {
      scale(c, ['cgX', 'length', 'diameter', 'positionUncertainty'], lf);
      scale(c, ['mass', 'propellantMass', 'massUncertainty'], mf);
    }
  }
  scale(raw.finStructure, ['minManufacturableThickness', 'thicknessTolerance', 'dimensionalTolerance'], lf);
}

export function importProject(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: [tr('Il file non è un JSON valido.', 'The file is not valid JSON.')] };
  }
  if (!data || typeof data !== 'object') return { ok: false, errors: [tr('Contenuto del file non riconosciuto.', 'Unrecognised file content.')] };
  const warnings: string[] = [];
  let raw: Json;
  const d = data as Json;
  if (d.format === FILE_FORMAT) {
    const units = (d.units ?? {}) as Json;
    const lu = String(units.length ?? '');
    const mu = String(units.mass ?? '');
    if (!(lu in LENGTH_FACTORS)) return { ok: false, errors: [tr(`Unità di lunghezza non supportata o mancante: "${lu}". Ammesse: mm, cm, m.`, `Unsupported or missing length unit: "${lu}". Allowed: mm, cm, m.`)] };
    if (!(mu in MASS_FACTORS)) return { ok: false, errors: [tr(`Unità di massa non supportata o mancante: "${mu}". Ammesse: g, kg.`, `Unsupported or missing mass unit: "${mu}". Allowed: g, kg.`)] };
    raw = structuredClone(d.project) as Json;
    if (!raw || typeof raw !== 'object') return { ok: false, errors: [tr('Il file non contiene un progetto.', 'The file does not contain a project.')] };
    const lf = LENGTH_FACTORS[lu as keyof typeof LENGTH_FACTORS];
    const mf = MASS_FACTORS[mu as keyof typeof MASS_FACTORS];
    if (lf !== 1 || mf !== 1) {
      scaleUnits(raw, lf, mf);
      warnings.push(tr(`Valori convertiti da ${lu} e ${mu} a unità SI.`, `Values converted from ${lu} and ${mu} to SI units.`));
    }
  } else if ('geometry' in d && 'schemaVersion' in d) {
    raw = structuredClone(d);
    warnings.push(tr('Il file non dichiara le unità: si assume che sia in unità SI (m, kg).', 'The file does not declare its units: SI units (m, kg) are assumed.'));
  } else {
    return { ok: false, errors: [tr('Il file non è un progetto di Rocket Design Assistant.', 'The file is not a Rocket Design Assistant project.')] };
  }

  if (raw.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, errors: [tr(`Versione di schema ${String(raw.schemaVersion)} non supportata (attesa ${SCHEMA_VERSION}).`, `Unsupported schema version ${String(raw.schemaVersion)} (expected ${SCHEMA_VERSION}).`)] };
  }
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || tr('(radice)', '(root)')}: ${i.message}`) };
  }
  const project = parsed.data as Project;
  project.meta = { ...project.meta, id: newId('prj') };
  return { ok: true, project, warnings };
}
