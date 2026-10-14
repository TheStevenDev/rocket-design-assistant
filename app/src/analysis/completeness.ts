import type { Area, Issue, Project } from '../core/types';
import { tr } from '../core/i18n';
import { getMaterial } from '../core/materials';
import { finMaterialSummary } from '../physics/finStructure';

export type CompletenessStatus = 'ok' | 'partial' | 'missing';

export interface CompletenessItem {
  label: string;
  status: CompletenessStatus;
  detail: string;
  area: Area;
}

export interface Completeness {
  /** 0–1 */
  score: number;
  items: CompletenessItem[];
}

export function assessCompleteness(p: Project, issues: Issue[]): Completeness {
  const items: CompletenessItem[] = [];
  const add = (label: string, status: CompletenessStatus, detail: string, area: Area) => items.push({ label, status, detail, area });
  const g = p.geometry;

  const designErrors = issues.filter((i) => i.area === 'design' && i.severity === 'error').length;
  add(tr('Geometria valida', 'Valid geometry'), designErrors ? 'missing' : 'ok', designErrors ? tr(`${designErrors} errore/i nei parametri geometrici`, `${designErrors} error(s) in the geometry parameters`) : tr('Nessun errore', 'No errors'), 'design');

  const mats = [g.nose.materialId, g.body.materialId, g.fins.materialId].filter((id) => getMaterial(id)).length;
  add(tr('Materiali assegnati', 'Materials assigned'), mats === 3 ? 'ok' : 'missing', tr(`${mats} su 3`, `${mats} of 3`), 'design');

  const measured = [g.nose, g.body, g.fins].filter((x) => x.massOverride !== null).length;
  add(tr('Masse strutturali misurate', 'Structural masses measured'), measured === 3 ? 'ok' : measured > 0 ? 'partial' : 'missing',
    tr(`${measured} su 3 misurate, le altre stimate dalla geometria`, `${measured} of 3 measured, the others estimated from geometry`), 'mass');

  const motor = p.components.find((c) => c.kind === 'motor');
  add(tr('Motore definito', 'Motor defined'), motor ? (motor.propellantMass > 0 ? 'ok' : 'partial') : 'missing',
    motor ? (motor.propellantMass > 0 ? motor.name : tr('Manca la massa del propellente', 'Propellant mass missing')) : tr('Nessun motore nella lista dei componenti', 'No motor in the component list'), 'mass');

  const generic = p.components.filter((c) => c.kind === 'generic');
  add(tr('Componenti interni', 'Internal components'), generic.length > 0 ? 'ok' : 'missing', tr(`${generic.length} componenti`, `${generic.length} components`), 'mass');

  const measuredComp = p.components.filter((c) => c.source === 'measured').length;
  add(tr('Masse dei componenti misurate', 'Component masses measured'), p.components.length === 0 ? 'missing' : measuredComp === p.components.length ? 'ok' : measuredComp > 0 ? 'partial' : 'missing',
    tr(`${measuredComp} su ${p.components.length} misurate`, `${measuredComp} of ${p.components.length} measured`), 'mass');

  const withUnc = p.components.filter((c) => c.massUncertainty > 0 && c.positionUncertainty > 0).length;
  add(tr('Incertezze indicate', 'Uncertainties given'), p.components.length > 0 && withUnc === p.components.length ? 'ok' : withUnc > 0 ? 'partial' : 'missing',
    tr(`${withUnc} su ${p.components.length} componenti con incertezza su massa e posizione`, `${withUnc} of ${p.components.length} components with mass and position uncertainty`), 'mass');

  const hasBurnout = p.configurations.some((c) => c.propellantFraction === 0);
  add(tr('Configurazioni di massa', 'Mass configurations'), p.configurations.length >= 2 && hasBurnout ? 'ok' : p.configurations.length > 0 ? 'partial' : 'missing',
    tr(`${p.configurations.length} configurazioni${hasBurnout ? ', incluso burnout' : ', manca il burnout'}`, `${p.configurations.length} configurations${hasBurnout ? ', including burnout' : ', burnout missing'}`), 'stability');

  const fm = finMaterialSummary(p);
  const props = [fm.youngModulus, fm.shearModulus];
  const known = props.filter((x) => x.value !== null).length;
  const tested = props.filter((x) => x.confidence === 'tested' || x.confidence === 'datasheet').length;
  add(tr('Proprietà del materiale delle pinne', 'Fin material properties'), known === 2 ? (tested === 2 ? 'ok' : 'partial') : 'missing',
    known === 2 ? (tested === 2 ? tr('Da scheda tecnica o prova', 'From datasheet or test') : tr('Solo valori tipici di libreria', 'Typical library values only')) : tr('Modulo elastico e/o di taglio non disponibili', 'Elastic and/or shear modulus not available'), 'fins');

  const fs = p.finStructure;
  const fab = [fs.fabricationMethod.trim() !== '', fs.minManufacturableThickness > 0, fs.edgeTreatment.trim() !== ''].filter(Boolean).length;
  add(tr('Vincoli di fabbricazione pinne', 'Fin fabrication constraints'), fab === 3 ? 'ok' : fab > 0 ? 'partial' : 'missing', tr(`${fab} su 3 campi compilati`, `${fab} of 3 fields filled in`), 'fins');

  const flight = [fs.expectedMaxSpeed, fs.expectedMaxAltitude].filter((v) => v !== null).length;
  add(tr('Condizioni di volo previste', 'Expected flight conditions'), flight === 2 ? 'ok' : flight === 1 ? 'partial' : 'missing',
    flight === 2 ? tr('Velocità e quota massime indicate', 'Maximum speed and altitude given') : tr('Velocità e/o quota massima non indicate', 'Maximum speed and/or altitude not given'), 'fins');

  const score = items.reduce((a, i) => a + (i.status === 'ok' ? 1 : i.status === 'partial' ? 0.5 : 0), 0) / items.length;
  return { score, items };
}
