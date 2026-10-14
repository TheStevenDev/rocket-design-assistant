import { tr } from '../core/i18n';
import { getMaterial } from '../core/materials';
import type { Issue, Project, Severity } from '../core/types';
import type { DerivedGeometry } from '../geometry/rocketGeometry';

export interface NumberRule {
  min?: number;
  /** When true, `min` itself is not allowed (value must be strictly greater). */
  exclusiveMin?: boolean;
  max?: number;
  integer?: boolean;
  /** Values outside [warnMin, warnMax] are allowed but unusual. */
  warnMin?: number;
  warnMax?: number;
  warnText?: () => string;
}

export interface FieldCheck {
  severity: Severity;
  message: string;
}

/** Immediate validation of a single numeric field (values in SI). */
export function checkNumber(value: number | null, rule: NumberRule, fmt: (v: number) => string = String): FieldCheck | null {
  if (value === null || !Number.isFinite(value)) return { severity: 'error', message: tr('Valore numerico richiesto', 'A number is required') };
  if (rule.integer && !Number.isInteger(value)) return { severity: 'error', message: tr('Deve essere un numero intero', 'Must be a whole number') };
  if (rule.min !== undefined) {
    if (rule.exclusiveMin ? value <= rule.min : value < rule.min) {
      return { severity: 'error', message: rule.exclusiveMin ? tr(`Deve essere maggiore di ${fmt(rule.min)}`, `Must be greater than ${fmt(rule.min)}`) : tr(`Minimo ${fmt(rule.min)}`, `Minimum ${fmt(rule.min)}`) };
    }
  }
  if (rule.max !== undefined && value > rule.max) return { severity: 'error', message: tr(`Massimo ${fmt(rule.max)}`, `Maximum ${fmt(rule.max)}`) };
  if ((rule.warnMin !== undefined && value < rule.warnMin) || (rule.warnMax !== undefined && value > rule.warnMax)) {
    return { severity: 'warning', message: rule.warnText?.() ?? tr('Valore insolito per un razzo amatoriale: verificare', 'Unusual value for a hobby rocket: please check') };
  }
  return null;
}

export const RULES = {
  bodyDiameter: { min: 0, exclusiveMin: true, warnMin: 0.01, warnMax: 0.3 },
  bodyLength: { min: 0, exclusiveMin: true, warnMin: 0.1, warnMax: 5 },
  wallThickness: { min: 0, exclusiveMin: true, warnMax: 0.01 },
  noseLength: { min: 0, exclusiveMin: true, warnMin: 0.01, warnMax: 1.5 },
  shapeParameter: { min: 0.05, max: 1 },
  finCount: { min: 1, max: 8, integer: true, warnMin: 3, warnMax: 4, warnText: () => tr('Il modello di Barrowman è esatto per 3 o 4 pinne; per altri numeri è un\'approssimazione', 'The Barrowman model is exact for 3 or 4 fins; for other counts it is an approximation') },
  rootChord: { min: 0, exclusiveMin: true },
  tipChord: { min: 0 },
  span: { min: 0, exclusiveMin: true },
  sweep: { warnMin: 0, warnText: () => tr('Freccia negativa (pinne a freccia inversa): verificare', 'Negative sweep (forward-swept fins): please check') },
  finThickness: { min: 0, exclusiveMin: true, warnMax: 0.02 },
  aftOffset: { min: 0 },
  mass: { min: 0, exclusiveMin: true, warnMax: 50 },
  massNonNegative: { min: 0 },
  uncertainty: { min: 0 },
  fraction: { min: 0, max: 1 },
  positive: { min: 0, exclusiveMin: true },
  nonNegative: { min: 0 },
} satisfies Record<string, NumberRule>;

function push(issues: Issue[], severity: Severity, area: Issue['area'], message: string, field?: string) {
  issues.push({ severity, area, message, field });
}

/** Whole-project validation: field ranges plus cross-field consistency. */
export function validateProject(p: Project, d: DerivedGeometry): Issue[] {
  const issues: Issue[] = [];
  const { nose, body, fins } = p.geometry;

  const fieldChecks: [string, number, NumberRule, Issue['area'], string][] = [
    ['geometry.body.outerDiameter', body.outerDiameter, RULES.bodyDiameter, 'design', tr('Diametro corpo', 'Body diameter')],
    ['geometry.body.length', body.length, RULES.bodyLength, 'design', tr('Lunghezza corpo', 'Body length')],
    ['geometry.body.wallThickness', body.wallThickness, RULES.wallThickness, 'design', tr('Spessore parete corpo', 'Body wall thickness')],
    ['geometry.nose.length', nose.length, RULES.noseLength, 'design', tr('Lunghezza ogiva', 'Nose length')],
    ['geometry.fins.count', fins.count, RULES.finCount, 'design', tr('Numero pinne', 'Fin count')],
    ['geometry.fins.rootChord', fins.rootChord, RULES.rootChord, 'design', tr('Corda alla radice', 'Root chord')],
    ['geometry.fins.tipChord', fins.tipChord, RULES.tipChord, 'design', tr('Corda all\'estremità', 'Tip chord')],
    ['geometry.fins.span', fins.span, RULES.span, 'design', tr('Apertura pinna', 'Fin span')],
    ['geometry.fins.sweepLength', fins.sweepLength, RULES.sweep, 'design', tr('Freccia', 'Sweep')],
    ['geometry.fins.thickness', fins.thickness, RULES.finThickness, 'design', tr('Spessore pinna', 'Fin thickness')],
    ['geometry.fins.aftOffset', fins.aftOffset, RULES.aftOffset, 'design', tr('Posizione pinne', 'Fin position')],
  ];
  if (!nose.solid) fieldChecks.push(['geometry.nose.wallThickness', nose.wallThickness, RULES.wallThickness, 'design', tr('Spessore ogiva', 'Nose wall thickness')]);
  if (nose.shape === 'power') fieldChecks.push(['geometry.nose.shapeParameter', nose.shapeParameter, RULES.shapeParameter, 'design', tr('Esponente ogiva', 'Nose exponent')]);
  for (const [field, v, rule, area, label] of fieldChecks) {
    const c = checkNumber(v, rule);
    if (c) push(issues, c.severity, area, `${label}: ${c.message}`, field);
  }

  // Cross-field consistency.
  const R = body.outerDiameter / 2;
  if (body.wallThickness >= R) push(issues, 'error', 'design', tr('Lo spessore della parete è maggiore o uguale al raggio del corpo.', 'The wall thickness is greater than or equal to the body radius.'), 'geometry.body.wallThickness');
  if (!nose.solid && nose.wallThickness >= R) push(issues, 'error', 'design', tr('Lo spessore dell\'ogiva è maggiore o uguale al raggio.', 'The nose wall thickness is greater than or equal to the radius.'), 'geometry.nose.wallThickness');
  if (fins.aftOffset + fins.rootChord > body.length) push(issues, 'error', 'design', tr('Le pinne sporgono oltre l\'estremità anteriore del tubo corpo (posizione + corda alla radice > lunghezza corpo).', 'The fins extend past the front end of the body tube (position + root chord > body length).'), 'geometry.fins.aftOffset');
  if (d.fins.tipTrailingEdgeX > d.bodyEndX + 1e-9) push(issues, 'info', 'design', tr('Le pinne sporgono oltre la coda del razzo: la lunghezza totale indicata non le include.', 'The fins extend past the tail of the rocket: the total length shown does not include them.'), 'geometry.fins.sweepLength');
  if (fins.thickness >= fins.rootChord) push(issues, 'error', 'design', tr('Lo spessore della pinna non è compatibile con la corda alla radice.', 'The fin thickness is not compatible with the root chord.'), 'geometry.fins.thickness');
  if (d.fineness > 0 && d.fineness < 6) push(issues, 'warning', 'stability', tr(`Rapporto di snellezza basso (${d.fineness.toFixed(1)}): la portanza del corpo, trascurata dal modello, diventa più importante.`, `Low fineness ratio (${d.fineness.toFixed(1)}): body lift, neglected by the model, becomes more important.`));
  if (d.fineness > 30) push(issues, 'warning', 'design', tr(`Rapporto di snellezza molto alto (${d.fineness.toFixed(1)}): attenzione alla flessione del corpo.`, `Very high fineness ratio (${d.fineness.toFixed(1)}): watch out for body bending.`));
  if (fins.count === 2) push(issues, 'warning', 'stability', tr('Con 2 pinne la stabilizzazione agisce in un solo piano.', 'With 2 fins, stabilisation acts in one plane only.'), 'geometry.fins.count');

  const parts = [[nose.materialId, tr('dell\'ogiva', 'nose'), 'nose'], [body.materialId, tr('del corpo', 'body'), 'body'], [fins.materialId, tr('delle pinne', 'fin'), 'fins']] as const;
  for (const [id, label, field] of parts) {
    if (!getMaterial(id)) push(issues, 'error', 'design', tr(`Materiale ${label} non riconosciuto: la massa non può essere stimata.`, `Unknown ${label} material: the mass cannot be estimated.`), `geometry.${field}.materialId`);
  }

  // Components.
  const motors = p.components.filter((c) => c.kind === 'motor');
  if (motors.length === 0) push(issues, 'warning', 'mass', tr('Nessun motore definito: il CG non rappresenta la configurazione di volo.', 'No motor defined: the CG does not represent the flight configuration.'));
  if (motors.length > 1) push(issues, 'info', 'mass', tr('Sono definiti più motori: verranno sommati tutti (cluster o errore di inserimento?).', 'More than one motor is defined: they will all be added up (cluster or input mistake?).'));
  for (const c of p.components) {
    const name = c.name.trim() || tr('(senza nome)', '(unnamed)');
    if (!c.name.trim()) push(issues, 'warning', 'mass', tr('Un componente non ha nome.', 'A component has no name.'), `components.${c.id}.name`);
    if (!(c.mass > 0)) push(issues, 'error', 'mass', tr(`${name}: la massa deve essere maggiore di zero.`, `${name}: the mass must be greater than zero.`), `components.${c.id}.mass`);
    if (c.cgX < 0 || c.cgX > d.totalLength) push(issues, 'error', 'mass', tr(`${name}: il CG del componente è fuori dal razzo (0 – lunghezza totale).`, `${name}: the component CG is outside the rocket (0 – total length).`), `components.${c.id}.cgX`);
    if (c.length > 0 && (c.cgX - c.length / 2 < -1e-9 || c.cgX + c.length / 2 > d.totalLength + 1e-9)) {
      push(issues, 'warning', 'mass', tr(`${name}: con la lunghezza indicata il componente sporge dal razzo.`, `${name}: with the given length the component sticks out of the rocket.`), `components.${c.id}.length`);
    }
    if (c.diameter > 0 && c.diameter > d.innerDiameter + 1e-9) push(issues, 'warning', 'mass', tr(`${name}: il diametro supera il diametro interno del tubo.`, `${name}: the diameter exceeds the inner diameter of the tube.`), `components.${c.id}.diameter`);
    if (c.kind === 'motor') {
      if (c.propellantMass < 0) push(issues, 'error', 'mass', tr(`${name}: massa del propellente negativa.`, `${name}: negative propellant mass.`), `components.${c.id}.propellantMass`);
      if (c.propellantMass >= c.mass) push(issues, 'error', 'mass', tr(`${name}: la massa del propellente deve essere minore della massa totale del motore.`, `${name}: the propellant mass must be less than the total motor mass.`), `components.${c.id}.propellantMass`);
      if (c.propellantMass === 0) push(issues, 'warning', 'mass', tr(`${name}: massa del propellente non indicata, la configurazione di burnout coincide con il decollo.`, `${name}: propellant mass not given, the burnout configuration is the same as lift-off.`), `components.${c.id}.propellantMass`);
    }
    if (c.massUncertainty < 0 || c.positionUncertainty < 0) push(issues, 'error', 'mass', tr(`${name}: le incertezze non possono essere negative.`, `${name}: uncertainties cannot be negative.`), `components.${c.id}.massUncertainty`);
  }

  for (const cfg of p.configurations) {
    if (cfg.propellantFraction < 0 || cfg.propellantFraction > 1) push(issues, 'error', 'stability', tr(`Configurazione "${cfg.name}": frazione di propellente fuori da 0–100%.`, `Configuration "${cfg.name}": propellant fraction outside 0–100%.`));
    if (cfg.excludedComponentIds.length >= p.components.length && p.components.length > 0) {
      push(issues, 'info', 'stability', tr(`Configurazione "${cfg.name}": tutti i componenti sono esclusi.`, `Configuration "${cfg.name}": all components are excluded.`));
    }
  }

  // Fin structure / fabrication constraints.
  const fs = p.finStructure;
  if (fs.minManufacturableThickness > 0 && fins.thickness < fs.minManufacturableThickness) {
    push(issues, 'warning', 'fins', tr('Lo spessore della pinna è sotto lo spessore minimo realizzabile indicato.', 'The fin thickness is below the stated minimum manufacturable thickness.'), 'geometry.fins.thickness');
  }
  if (fs.expectedMaxSpeed !== null && fs.expectedMaxSpeed > 100) {
    push(issues, 'warning', 'stability', tr('Velocità massima prevista oltre ~100 m/s (Mach ≈ 0,3): gli effetti di comprimibilità non sono modellati.', 'Expected maximum speed above ~100 m/s (Mach ≈ 0.3): compressibility effects are not modelled.'));
  }

  return issues;
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
