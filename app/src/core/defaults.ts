import { ELECTRONICS, MOTORS, PARACHUTES, SHOCK_CORD_MASS, type CatalogItem, type MotorPreset } from './catalog';
import { newId } from './ids';
import { tr, txt, type Text } from './i18n';
import { SCHEMA_VERSION, type FinStructureInfo, type MassComponent, type Project, type RocketGeometry } from './types';

export function defaultFinStructure(): FinStructureInfo {
  return {
    fabricationMethod: tr('Taglio laser da lastra', 'Laser-cut from sheet'),
    attachment: 'throughTheWall',
    minManufacturableThickness: 0.002,
    thicknessTolerance: 0.0002,
    dimensionalTolerance: 0.001,
    edgeTreatment: tr('Bordi arrotondati', 'Rounded edges'),
    youngModulusOverride: null,
    shearModulusOverride: null,
    materialConfidence: 'typical',
    expectedMaxSpeed: null,
    expectedMaxAltitude: null,
    notes: '',
  };
}

export function newComponent(partial: Partial<MassComponent> = {}): MassComponent {
  return {
    id: newId('cmp'),
    name: tr('Nuovo componente', 'New component'),
    kind: 'generic',
    mass: 0.01,
    propellantMass: 0,
    cgX: 0.3,
    length: 0,
    diameter: 0,
    source: 'estimated',
    massUncertainty: 0.002,
    positionUncertainty: 0.005,
    notes: '',
    ...partial,
  };
}

export function catalogComponent(item: CatalogItem, cgX: number): MassComponent {
  return newComponent({
    name: txt(item.name), role: item.role, catalogId: item.id, mass: item.mass, cgX,
    length: item.length, diameter: item.diameter,
    massUncertainty: Math.max(0.001, item.mass * 0.2), positionUncertainty: 0.01,
    notes: tr('Valore tipico dal catalogo: pesa il pezzo reale.', 'Typical catalog value: weigh the real part.'),
  });
}

/** Motor flush with the aft end of a rocket of the given total length. */
export function motorComponent(m: MotorPreset, totalLength: number): MassComponent {
  return newComponent({
    name: txt(m.name), kind: 'motor', catalogId: m.id, mass: m.totalMass, propellantMass: m.propellantMass, avgThrust: m.avgThrust,
    cgX: Math.max(0, totalLength - m.length / 2), length: m.length, diameter: m.diameter,
    massUncertainty: 0.005, positionUncertainty: 0.005, notes: tr('Valori indicativi: verifica su thrustcurve.org o sulla scheda del motore.', 'Indicative values: check thrustcurve.org or the motor datasheet.'),
  });
}

export function parachuteComponent(diameter: number, cgX: number): MassComponent {
  const p = PARACHUTES.reduce((best, x) => (Math.abs(x.diameter - diameter) < Math.abs(best.diameter - diameter) ? x : best));
  return newComponent({
    name: tr(`Paracadute ${Math.round(p.diameter * 100)} cm + cordino`, `Parachute ${Math.round(p.diameter * 100)} cm + shock cord`), role: 'recovery', catalogId: p.id,
    mass: p.mass + SHOCK_CORD_MASS, cgX, length: 0.08, massUncertainty: 0.01, positionUncertainty: 0.02,
  });
}

export type TemplateId = 'small' | 'medium' | 'large';

interface Template {
  label: Text;
  description: Text;
  geometry: RocketGeometry;
  motorId: string;
  chuteDiameter: number;
  /** Motor mount tube and centering rings. */
  mountMass: number;
}

export const TEMPLATES: Record<TemplateId, Template> = {
  small: {
    label: { it: 'Piccolo', en: 'Small' },
    description: { it: 'Ø 41 mm · motori C–D da 24 mm · ideale per il primo lancio', en: 'Ø 41 mm · 24 mm C–D motors · ideal for a first launch' },
    geometry: {
      nose: { shape: 'ogive', length: 0.13, wallThickness: 0.0015, solid: false, shapeParameter: 0.5, materialId: 'pla', massOverride: null },
      body: { outerDiameter: 0.041, length: 0.45, wallThickness: 0.001, materialId: 'kraft', massOverride: null },
      fins: { count: 3, rootChord: 0.08, tipChord: 0.035, span: 0.055, sweepLength: 0.045, thickness: 0.003, aftOffset: 0, crossSection: 'rounded', materialId: 'balsa', massOverride: null },
    },
    motorId: 'mot-d12', chuteDiameter: 0.45, mountMass: 0.015,
  },
  medium: {
    label: { it: 'Medio', en: 'Medium' },
    description: { it: 'Ø 54 mm · motori F–G da 29 mm · c\'è spazio per l\'elettronica', en: 'Ø 54 mm · 29 mm F–G motors · room for electronics' },
    geometry: {
      nose: { shape: 'ogive', length: 0.17, wallThickness: 0.002, solid: false, shapeParameter: 0.5, materialId: 'pla', massOverride: null },
      body: { outerDiameter: 0.054, length: 0.55, wallThickness: 0.0013, materialId: 'kraft', massOverride: null },
      fins: { count: 3, rootChord: 0.11, tipChord: 0.045, span: 0.07, sweepLength: 0.06, thickness: 0.003, aftOffset: 0, crossSection: 'rounded', materialId: 'plywood', massOverride: null },
    },
    motorId: 'mot-g-29', chuteDiameter: 0.75, mountMass: 0.035,
  },
  large: {
    label: { it: 'Grande', en: 'Large' },
    description: { it: 'Ø 66 mm · motori G–H da 38 mm · elettronica e camera comode', en: 'Ø 66 mm · 38 mm G–H motors · plenty of room for electronics and camera' },
    geometry: {
      nose: { shape: 'ogive', length: 0.2, wallThickness: 0.002, solid: false, shapeParameter: 0.5, materialId: 'pla', massOverride: null },
      body: { outerDiameter: 0.066, length: 0.6, wallThickness: 0.0015, materialId: 'kraft', massOverride: null },
      fins: { count: 4, rootChord: 0.12, tipChord: 0.05, span: 0.08, sweepLength: 0.06, thickness: 0.003, aftOffset: 0, crossSection: 'rounded', materialId: 'plywood', massOverride: null },
    },
    motorId: 'mot-h-38', chuteDiameter: 0.9, mountMass: 0.05,
  },
};

/** Electronics shown in the example project: precise GPS, IMU, barometer, logger, camera. */
export const EXAMPLE_KIT = ['gps-f9p', 'imu-bmi088', 'baro-bmp390', 'fc-pico2', 'bat-1s-1000', 'cam-thumb', 'sled'];

export function templateProject(id: TemplateId, name = tr('Nuovo razzo', 'New rocket'), withKit = false): Project {
  const t = TEMPLATES[id];
  const g = structuredClone(t.geometry);
  const now = new Date().toISOString();
  const total = g.nose.length + g.body.length;
  const motor = MOTORS.find((m) => m.id === t.motorId)!;
  const bay = g.nose.length + 0.06;
  const components: MassComponent[] = [];
  if (withKit) {
    for (const id of EXAMPLE_KIT) {
      const item = ELECTRONICS.find((e) => e.id === id)!;
      // The GPS antenna goes in the plastic nose cone, everything else in the bay.
      components.push(catalogComponent(item, item.role === 'gps' ? g.nose.length * 0.65 : bay));
    }
  }
  components.push(
    parachuteComponent(t.chuteDiameter, g.nose.length + g.body.length * 0.27),
    newComponent({ name: tr('Tubo motore + anelli', 'Motor tube + centering rings'), role: 'other', mass: t.mountMass, cgX: total - motor.length / 2 - 0.02, length: motor.length + 0.04, diameter: motor.diameter + 0.003, massUncertainty: 0.008 }),
    motorComponent(motor, total),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { id: newId('prj'), name, description: txt(t.description), createdAt: now, updatedAt: now },
    geometry: g,
    components,
    configurations: [
      { id: newId('cfg'), name: tr('Decollo', 'Lift-off'), excludedComponentIds: [], propellantFraction: 1 },
      { id: newId('cfg'), name: 'Burnout', excludedComponentIds: [], propellantFraction: 0 },
    ],
    finStructure: defaultFinStructure(),
    settings: { lengthUnit: 'mm', massUnit: 'g' },
  };
}

/** Example 66 mm rocket with GPS, sensors and camera, used on first start. */
export function defaultProject(name = tr('Nuovo razzo', 'New rocket')): Project {
  return templateProject('large', name, true);
}
