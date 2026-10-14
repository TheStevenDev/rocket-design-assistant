import { tr, txt } from '../core/i18n';
import { getMaterial } from '../core/materials';
import type { MaterialConfidence, ModelAssumption, Project } from '../core/types';

export interface PropertyValue {
  value: number | null;
  origin: 'user' | 'library' | 'missing';
  confidence: MaterialConfidence;
}

export interface FinMaterialSummary {
  materialName: string;
  density: number | null;
  youngModulus: PropertyValue;
  shearModulus: PropertyValue;
  notes: string;
}

export function finMaterialSummary(p: Project): FinMaterialSummary {
  const m = getMaterial(p.geometry.fins.materialId);
  const fs = p.finStructure;
  const prop = (user: number | null, lib: number | null | undefined): PropertyValue =>
    user !== null
      ? { value: user, origin: 'user', confidence: fs.materialConfidence }
      : lib != null
        ? { value: lib, origin: 'library', confidence: m?.confidence ?? 'unknown' }
        : { value: null, origin: 'missing', confidence: 'unknown' };
  return {
    materialName: m ? txt(m.name) : tr('Sconosciuto', 'Unknown'),
    density: m?.density ?? null,
    youngModulus: prop(fs.youngModulusOverride, m?.youngModulus),
    shearModulus: prop(fs.shearModulusOverride, m?.shearModulus),
    notes: m ? txt(m.notes) : '',
  };
}

export function finStructureAssumptions(): ModelAssumption[] {
  const finMass = tr('Massa pinne', 'Fin mass');
  return [
    { model: finMass, text: tr('Pinna modellata come lastra piana di spessore costante: profili, raccordi e colla non sono inclusi.', 'Fin modelled as a flat plate of constant thickness: profiles, fillets and glue are not included.') },
    { model: finMass, text: tr('Densità del materiale da libreria (valore tipico) se non viene inserita una massa misurata.', 'Material density from the library (typical value) unless a measured mass is entered.') },
    { model: tr('Materiale', 'Material'), text: tr('Materiale considerato omogeneo e isotropo nel piano: legno, compositi e stampa 3D non lo sono.', 'Material treated as homogeneous and in-plane isotropic: wood, composites and 3D prints are not.') },
    { model: tr('Vincolo', 'Attachment'), text: tr('Il tipo di fissaggio è registrato ma non modellato: la rigidezza reale dell\'incastro alla radice non è nota.', 'The attachment type is recorded but not modelled: the real stiffness of the root joint is unknown.') },
    { model: 'Flutter', text: tr('Nessun calcolo di flutter o divergenza è eseguito in questa versione.', 'No flutter or divergence calculation is performed in this version.') },
  ];
}

export function finLimits(): string[] {
  return [
    tr('I valori geometrici derivati (allungamento, rastremazione, spessore relativo) descrivono la forma, non la resistenza.', 'The derived geometric values (aspect ratio, taper, relative thickness) describe the shape, not the strength.'),
    tr('Non viene stimata la resistenza strutturale né la frequenza propria delle pinne.', 'Neither the structural strength nor the natural frequency of the fins is estimated.'),
    tr('Le proprietà dei materiali amatoriali variano molto (umidità, stratifica, parametri di stampa): servono dati di prova.', 'Properties of hobby materials vary a lot (humidity, layup, print settings): test data are needed.'),
    tr('Una geometria non è "a prova di flutter" per la sola forma o per il risultato di una formula semplificata.', 'No geometry is "flutter-proof" because of its shape alone or the result of a simplified formula.'),
  ];
}
