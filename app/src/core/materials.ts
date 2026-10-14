import type { Text } from './i18n';
import type { Material } from './types';

// Typical values for hobby materials. They vary widely with supplier, layup,
// moisture and print settings: the UI always labels them as indicative.
export const MATERIALS: Material[] = [
  {
    id: 'kraft', name: { it: 'Cartone spiralato (kraft)', en: 'Spiral-wound cardboard (kraft)' }, density: 700, youngModulus: null, shearModulus: null, poissonRatio: null, confidence: 'unknown',
    notes: { it: 'Proprietà meccaniche molto variabili e sensibili all\'umidità.', en: 'Mechanical properties vary widely and are sensitive to humidity.' },
  },
  {
    id: 'balsa', name: { it: 'Balsa', en: 'Balsa' }, density: 160, youngModulus: 3.0e9, shearModulus: 0.15e9, poissonRatio: null, confidence: 'typical',
    notes: { it: 'Fortemente anisotropo; E lungo la venatura. Densità 100–250 kg/m³.', en: 'Strongly anisotropic; E along the grain. Density 100–250 kg/m³.' },
  },
  {
    id: 'plywood', name: { it: 'Compensato di betulla', en: 'Birch plywood' }, density: 680, youngModulus: 9e9, shearModulus: 0.6e9, poissonRatio: null, confidence: 'typical',
    notes: { it: 'Dipende dal numero di strati e dall\'orientamento.', en: 'Depends on the number of plies and their orientation.' },
  },
  {
    id: 'g10', name: { it: 'Vetroresina G10/FR4', en: 'Fibreglass G10/FR4' }, density: 1850, youngModulus: 18.6e9, shearModulus: 4.1e9, poissonRatio: 0.12, confidence: 'typical',
    notes: { it: 'Valori nel piano del laminato.', en: 'In-plane laminate values.' },
  },
  {
    id: 'cfrp', name: { it: 'Fibra di carbonio (laminato)', en: 'Carbon fibre (laminate)' }, density: 1550, youngModulus: 50e9, shearModulus: 18e9, poissonRatio: 0.3, confidence: 'typical',
    notes: { it: 'Laminato quasi-isotropo indicativo: dipende fortemente dalla stratifica.', en: 'Indicative quasi-isotropic laminate: depends strongly on the layup.' },
  },
  {
    id: 'al6061', name: { it: 'Alluminio 6061-T6', en: 'Aluminium 6061-T6' }, density: 2700, youngModulus: 68.9e9, shearModulus: 26e9, poissonRatio: 0.33, confidence: 'datasheet',
    notes: { it: '', en: '' },
  },
  {
    id: 'pla', name: { it: 'PLA (stampa 3D)', en: 'PLA (3D printed)' }, density: 1240, youngModulus: 3.5e9, shearModulus: 1.3e9, poissonRatio: 0.36, confidence: 'typical',
    notes: { it: 'Riferito a pezzo pieno: riempimento, orientamento e temperatura cambiano molto i valori.', en: 'For a solid part: infill, orientation and temperature change the values a lot.' },
  },
  {
    id: 'petg', name: { it: 'PETG (stampa 3D)', en: 'PETG (3D printed)' }, density: 1270, youngModulus: 2.0e9, shearModulus: 0.74e9, poissonRatio: 0.37, confidence: 'typical',
    notes: { it: 'Riferito a pezzo pieno.', en: 'For a solid part.' },
  },
  {
    id: 'phenolic', name: { it: 'Tubo fenolico', en: 'Phenolic tube' }, density: 950, youngModulus: null, shearModulus: null, poissonRatio: null, confidence: 'unknown',
    notes: { it: '', en: '' },
  },
];

export function getMaterial(id: string): Material | undefined {
  return MATERIALS.find((m) => m.id === id);
}

export const CONFIDENCE_LABELS: Record<Material['confidence'], Text> = {
  typical: { it: 'valore tipico', en: 'typical value' },
  datasheet: { it: 'scheda tecnica', en: 'datasheet' },
  tested: { it: 'misurato/provato', en: 'measured/tested' },
  unknown: { it: 'non disponibile', en: 'not available' },
};
