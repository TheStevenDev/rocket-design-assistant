import { tr, txt } from '../core/i18n';
import { CONFIDENCE_LABELS, getMaterial } from '../core/materials';
import { fmt, fmtNumber } from '../core/units';
import type { FinAttachment, MaterialConfidence } from '../core/types';
import { finLimits, finMaterialSummary, finStructureAssumptions, type PropertyValue } from '../physics/finStructure';
import { useStore } from '../state/store';
import { RULES } from '../validation/validate';
import { useAnalysis, useUnits } from './context';
import { Callout, Card, IssueList, NumberField, SelectField, TextField } from './fields';

const originLabel = (o: PropertyValue['origin']) => ({ user: tr('inserito', 'entered'), library: tr('libreria', 'library'), missing: tr('mancante', 'missing') })[o];

function PropRow({ label, p }: { label: string; p: PropertyValue }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{p.value === null ? '—' : `${(p.value / 1e9).toFixed(2)} GPa`}</td>
      <td><span className={`badge ${p.origin === 'missing' ? 'badge-missing' : ''}`}>{originLabel(p.origin)}</span> <span className="muted">{txt(CONFIDENCE_LABELS[p.confidence])}</span></td>
    </tr>
  );
}

export function FinsPanel() {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const lang = useStore((s) => s.lang);
  const a = useAnalysis();
  const u = useUnits();
  const f = project.geometry.fins;
  const fd = a.derived.fins;
  const fs = project.finStructure;
  const mat = finMaterialSummary(project);
  const finMassItem = a.mass.items.find((i) => i.refId === 'fins');
  const L = (v: number) => fmt(v, 'length', u);
  const set = (key: string, fn: (x: typeof fs) => void) => update(`fs.${key}`, (p) => { fn(p.finStructure); });
  const useLibrary = tr('usa libreria', 'use library');
  const notGiven = tr('non indicata', 'not given');
  const measured = tr('misurata', 'measured');

  return (
    <div className="panel">
      <Callout kind="warning" title={tr('Modulo di raccolta dati, non di verifica', 'A data collection form, not a verification')}>
        {lang === 'en' ? (
          <>This section organises the fin geometry, fabrication constraints, material properties and assumptions. In this version it
            <strong> does not compute structural strength or flutter speed</strong> and does not suggest "safe" dimensions.</>
        ) : (
          <>Questa sezione organizza geometria, vincoli di fabbricazione, proprietà del materiale e ipotesi delle pinne. In questa versione
            <strong> non calcola resistenza strutturale né velocità di flutter</strong> e non indica dimensioni "sicure".</>
        )}
      </Callout>

      <Card title={tr('1 · Geometria nominale', '1 · Nominal geometry')} subtitle={tr('Valori derivati dai parametri inseriti in Design.', 'Values derived from the parameters entered in Shape.')}>
        <table className="kv">
          <tbody>
            <tr><th>{tr('Numero di pinne', 'Number of fins')}</th><td>{f.count}</td></tr>
            <tr><th>{tr('Corde (radice / estremità)', 'Chords (root / tip)')}</th><td>{L(f.rootChord)} / {L(f.tipChord)}</td></tr>
            <tr><th>{tr('Apertura · spessore', 'Span · thickness')}</th><td>{L(f.span)} · {L(f.thickness)}</td></tr>
            <tr><th>{tr('Area di una pinna', 'Area of one fin')}</th><td>{(fd.area * 1e4).toFixed(1)} cm²</td></tr>
            <tr><th>{tr('Allungamento (coppia di pinne)', 'Aspect ratio (fin pair)')}</th><td>{fmtNumber(fd.aspectRatio, 2)}</td></tr>
            <tr><th>{tr('Rapporto di rastremazione Ct/Cr', 'Taper ratio Ct/Cr')}</th><td>{fmtNumber(fd.taperRatio, 2)}</td></tr>
            <tr><th>{tr('Corda media aerodinamica', 'Mean aerodynamic chord')}</th><td>{L(fd.mac)}</td></tr>
            <tr><th>{tr('Angolo di freccia del bordo d\'attacco', 'Leading-edge sweep angle')}</th><td>{((fd.leadingEdgeSweep * 180) / Math.PI).toFixed(1)}°</td></tr>
            <tr><th>{tr('Spessore relativo t/MAC', 'Relative thickness t/MAC')}</th><td>{(fd.thicknessRatio * 100).toFixed(1)}%</td></tr>
            <tr><th>{tr('Massa dell\'insieme pinne', 'Mass of the fin set')}</th><td>{finMassItem ? `${fmt(finMassItem.mass, 'mass', u)} (${finMassItem.source === 'measured' ? measured : tr('calcolata', 'computed')})` : '—'}</td></tr>
          </tbody>
        </table>
      </Card>

      <Card title={tr('2 · Vincoli di fabbricazione', '2 · Fabrication constraints')}>
        <div className="grid">
          <TextField label={tr('Metodo di realizzazione', 'Fabrication method')} value={fs.fabricationMethod} onChange={(v) => set('method', (x) => { x.fabricationMethod = v; })}
            placeholder={tr('es. taglio laser, fresatura CNC, stampa 3D', 'e.g. laser cutting, CNC milling, 3D printing')} />
          <SelectField<FinAttachment> label={tr('Fissaggio al corpo', 'Attachment to the body')} value={fs.attachment}
            options={[
              { value: 'surface', label: tr('Incollate in superficie', 'Surface mounted') },
              { value: 'slot', label: tr('Inserite in asola', 'Slotted') },
              { value: 'throughTheWall', label: tr('Passanti fino al tubo motore (TTW)', 'Through the wall to the motor tube (TTW)') },
            ]}
            onChange={(v) => set('att', (x) => { x.attachment = v; })} />
          <NumberField label={tr('Spessore minimo realizzabile', 'Minimum manufacturable thickness')} dim="length" value={fs.minManufacturableThickness} rule={RULES.nonNegative}
            onChange={(v) => set('tmin', (x) => { x.minManufacturableThickness = v; })} />
          <NumberField label={tr('Tolleranza di spessore ±', 'Thickness tolerance ±')} dim="length" value={fs.thicknessTolerance} rule={RULES.nonNegative}
            onChange={(v) => set('ttol', (x) => { x.thicknessTolerance = v; })} />
          <NumberField label={tr('Tolleranza dimensionale ±', 'Dimensional tolerance ±')} dim="length" value={fs.dimensionalTolerance} rule={RULES.nonNegative}
            hint={tr('Su corde, apertura, freccia e posizione: usata nell\'analisi di sensibilità', 'On chords, span, sweep and position: used in the sensitivity analysis')}
            onChange={(v) => set('dtol', (x) => { x.dimensionalTolerance = v; })} />
          <TextField label={tr('Trattamento dei bordi', 'Edge treatment')} value={fs.edgeTreatment} onChange={(v) => set('edge', (x) => { x.edgeTreatment = v; })} />
        </div>
      </Card>

      <Card title={tr('3 · Proprietà del materiale', '3 · Material properties')} subtitle={`${tr('Materiale', 'Material')}: ${mat.materialName}${mat.density ? ` · ${mat.density} kg/m³` : ''}`}>
        <table className="kv">
          <tbody>
            <PropRow label={tr('Modulo di Young E', 'Young\'s modulus E')} p={mat.youngModulus} />
            <PropRow label={tr('Modulo di taglio G', 'Shear modulus G')} p={mat.shearModulus} />
          </tbody>
        </table>
        {mat.notes && <p className="muted small">{mat.notes}</p>}
        <div className="grid">
          <NumberField label={tr('E da prova o scheda tecnica', 'E from test or datasheet')} dim="pressure" value={fs.youngModulusOverride} rule={RULES.positive} placeholder={useLibrary}
            onClear={() => set('E', (x) => { x.youngModulusOverride = null; })} onChange={(v) => set('E', (x) => { x.youngModulusOverride = v; })} />
          <NumberField label={tr('G da prova o scheda tecnica', 'G from test or datasheet')} dim="pressure" value={fs.shearModulusOverride} rule={RULES.positive} placeholder={useLibrary}
            onClear={() => set('G', (x) => { x.shearModulusOverride = null; })} onChange={(v) => set('G', (x) => { x.shearModulusOverride = v; })} />
          <SelectField<MaterialConfidence> label={tr('Affidabilità dei valori inseriti', 'Reliability of the entered values')} value={fs.materialConfidence}
            options={(Object.keys(CONFIDENCE_LABELS) as MaterialConfidence[]).map((k) => ({ value: k, label: txt(CONFIDENCE_LABELS[k]) }))}
            onChange={(v) => set('conf', (x) => { x.materialConfidence = v; })} />
        </div>
        {getMaterial(f.materialId)?.confidence === 'unknown' && fs.shearModulusOverride === null && (
          <Callout kind="warning">{tr('Per questo materiale la libreria non ha proprietà meccaniche: qualsiasi valutazione strutturale richiede dati di prova.', 'The library has no mechanical properties for this material: any structural assessment needs test data.')}</Callout>
        )}
      </Card>

      <Card title={tr('4 · Condizioni di volo previste', '4 · Expected flight conditions')} subtitle={tr('Da una simulazione di traiettoria esterna. Servono per qualsiasi futura analisi aeroelastica.', 'From an external trajectory simulation. Needed for any future aeroelastic analysis.')}>
        <div className="grid">
          <NumberField label={tr('Velocità massima prevista', 'Expected maximum speed')} dim="speed" value={fs.expectedMaxSpeed} rule={RULES.nonNegative} placeholder={notGiven}
            onClear={() => set('v', (x) => { x.expectedMaxSpeed = null; })} onChange={(v) => set('v', (x) => { x.expectedMaxSpeed = v; })} />
          <NumberField label={tr('Quota della velocità massima', 'Altitude of maximum speed')} dim="altitude" value={fs.expectedMaxAltitude} rule={RULES.nonNegative} placeholder={notGiven}
            onClear={() => set('h', (x) => { x.expectedMaxAltitude = null; })} onChange={(v) => set('h', (x) => { x.expectedMaxAltitude = v; })} />
        </div>
        <TextField label={tr('Note', 'Notes')} multiline value={fs.notes} onChange={(v) => set('notes', (x) => { x.notes = v; })} placeholder={tr('Fonte dei dati, prove effettuate, osservazioni', 'Data source, tests performed, observations')} />
      </Card>

      <Card title={tr('5 · Ipotesi del modello', '5 · Model assumptions')}>
        <ul className="assumptions">{finStructureAssumptions().map((x) => <li key={x.text}><span className="badge">{x.model}</span> {x.text}</li>)}</ul>
      </Card>

      <Card title={tr('6 · Incertezze e limiti della simulazione', '6 · Uncertainties and limits of the simulation')}>
        <ul className="assumptions">
          <li>{tr(`Spessore: ±${L(fs.thicknessTolerance)} · dimensioni in pianta: ±${L(fs.dimensionalTolerance)}.`, `Thickness: ±${L(fs.thicknessTolerance)} · planform dimensions: ±${L(fs.dimensionalTolerance)}.`)}</li>
          <li>{tr('Massa delle pinne', 'Fin mass')}: {finMassItem?.source === 'measured' ? measured : tr('calcolata con densità tipica, ±15%', 'computed from typical density, ±15%')}.</li>
          {finLimits().map((t) => <li key={t}>{t}</li>)}
        </ul>
        <IssueList issues={a.issues.filter((i) => i.area === 'fins')} empty={tr('Nessun conflitto con i vincoli di fabbricazione.', 'No conflict with the fabrication constraints.')} />
      </Card>

      <Card title={tr('Il flutter delle pinne', 'Fin flutter')} className="info-card">
        {lang === 'en' ? (
          <>
            <p>
              <strong>Flutter</strong> is an aeroelastic instability: above a certain speed, the aerodynamic forces and the elastic deformation
              of the fin feed each other, with oscillations that can grow until the fin breaks within moments.
            </p>
            <p>It depends on the interaction of many quantities, including:</p>
            <ul>
              <li>Bending and torsional <strong>stiffness</strong> (material, thickness, layup, root constraint);</li>
              <li><strong>Mass distribution</strong> and the position of the section's centre of gravity relative to the elastic axis;</li>
              <li>Structural and aerodynamic <strong>damping</strong>;</li>
              <li><strong>Aerodynamic conditions</strong>: speed, air density, Mach number, dynamic pressure.</li>
            </ul>
            <p>
              The simplified formulas common in the hobby (derived from NACA TN 4197) rely on strong assumptions and often uncertain
              material data: they can give an order of magnitude, but <strong>no shape or simplified formula makes a fin "immune" to flutter</strong>.
            </p>
            <Callout kind="info" title="When a specialist analysis is needed">
              For high speeds (roughly transonic or supersonic), thin or high-aspect-ratio fins, composite or 3D-printed materials,
              or when no test data on the material are available, dedicated structural and aeroelastic analyses (modal/FEM,
              vibration tests) and the advice of someone with specific experience are needed.
            </Callout>
          </>
        ) : (
          <>
            <p>
              Il <strong>flutter</strong> è un'instabilità aeroelastica: oltre una certa velocità le forze aerodinamiche e le deformazioni elastiche
              della pinna si alimentano a vicenda, con oscillazioni che possono crescere fino alla rottura in pochi istanti.
            </p>
            <p>Dipende dall'interazione di molte grandezze, tra cui:</p>
            <ul>
              <li><strong>Rigidezza</strong> flessionale e torsionale (materiale, spessore, stratifica, vincolo alla radice);</li>
              <li><strong>Distribuzione di massa</strong> e posizione del baricentro della sezione rispetto all'asse elastico;</li>
              <li><strong>Smorzamento</strong> strutturale e aerodinamico;</li>
              <li><strong>Condizioni aerodinamiche</strong>: velocità, densità dell'aria, numero di Mach, pressione dinamica.</li>
            </ul>
            <p>
              Le formule semplificate diffuse in ambito amatoriale (derivate da NACA TN 4197) usano ipotesi forti e dati di materiale spesso
              incerti: possono dare un ordine di grandezza, ma <strong>nessuna forma né formula semplificata rende una pinna "immune" dal flutter</strong>.
            </p>
            <Callout kind="info" title="Quando serve un'analisi specialistica">
              Per velocità elevate (indicativamente transoniche o supersoniche), pinne sottili o di grande allungamento, materiali compositi o stampati
              in 3D, o quando non sono disponibili dati di prova sul materiale, servono analisi strutturali e aeroelastiche dedicate (modale/FEM,
              prove di vibrazione) e il parere di chi ha esperienza specifica.
            </Callout>
          </>
        )}
      </Card>
    </div>
  );
}
