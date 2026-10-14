import { tr, txt } from '../core/i18n';
import { MATERIALS } from '../core/materials';
import { fmt, fmtNumber } from '../core/units';
import type { NoseShape } from '../core/types';
import { NOSE_SHAPE_LABELS } from '../geometry/noseProfile';
import { useStore } from '../state/store';
import { RULES } from '../validation/validate';
import { useAnalysis, useUnits } from './context';
import { Advanced, Card, Checkbox, IssueList, NumberField, Segmented, SelectField } from './fields';
import { StepFooter, StepIntro } from './steps';

const materialOptions = () => MATERIALS.map((m) => ({ value: m.id, label: txt(m.name) }));
const COMMON_SHAPES: NoseShape[] = ['ogive', 'conical', 'elliptical', 'vonKarman'];

export function DesignPanel() {
  const g = useStore((s) => s.project.geometry);
  const update = useStore((s) => s.update);
  const a = useAnalysis();
  const u = useUnits();
  const d = a.derived;
  const L = (v: number) => fmt(v, 'length', u);
  const designIssues = a.issues.filter((i) => i.area === 'design' && i.severity !== 'info');
  const materials = materialOptions();
  const material = tr('Materiale', 'Material');
  const wall = tr('Spessore parete', 'Wall thickness');

  return (
    <div className="panel">
      <StepIntro step={1} title={tr('Disegna la forma', 'Design the shape')}>
        {tr('Parti dalle misure del tubo che hai comprato o stampato. Il modello 3D e la stabilità si aggiornano mentre scrivi.',
          'Start from the measurements of the tube you bought or printed. The 3D model and the stability update as you type.')}
      </StepIntro>

      <div className="mini-stats">
        <div><span>{tr('Lunghezza', 'Length')}</span><strong>{L(d.totalLength)}</strong></div>
        <div><span>{tr('Diametro', 'Diameter')}</span><strong>{L(g.body.outerDiameter)}</strong></div>
        <div><span>{tr('Snellezza L/D', 'Fineness L/D')}</span><strong>{fmtNumber(d.fineness, 1)}</strong></div>
        <div><span>{tr('Massa al decollo', 'Lift-off mass')}</span><strong>{fmt(a.mass.total, 'mass', u)}</strong></div>
      </div>

      <Card icon="box" title={tr('Corpo', 'Body')} subtitle={tr('Il tubo principale. Il suo diametro è il riferimento per la stabilità (1 calibro = 1 diametro).', 'The main tube. Its diameter is the reference for stability (1 caliber = 1 diameter).')}>
        <div className="grid">
          <NumberField label={tr('Diametro esterno', 'Outer diameter')} dim="length" value={g.body.outerDiameter} rule={RULES.bodyDiameter} field="geometry.body.outerDiameter"
            onChange={(v) => update('body.D', (p) => { p.geometry.body.outerDiameter = v; })} />
          <NumberField label={tr('Lunghezza del tubo', 'Tube length')} dim="length" value={g.body.length} rule={RULES.bodyLength} field="geometry.body.length"
            hint={tr('Senza l\'ogiva', 'Without the nose cone')} onChange={(v) => update('body.L', (p) => { p.geometry.body.length = v; })} />
          <SelectField label={material} value={g.body.materialId} options={materials}
            onChange={(v) => update('body.mat', (p) => { p.geometry.body.materialId = v; })} />
        </div>
        <Advanced>
          <div className="grid">
            <NumberField label={wall} dim="length" value={g.body.wallThickness} rule={RULES.wallThickness} field="geometry.body.wallThickness"
              onChange={(v) => update('body.t', (p) => { p.geometry.body.wallThickness = v; })} />
          </div>
        </Advanced>
      </Card>

      <Card icon="rocket" title={tr('Ogiva', 'Nose cone')} subtitle={tr('La punta. Una forma ogivale è il compromesso più comune: facile da trovare e con poca resistenza.', 'The tip. An ogive is the most common compromise: easy to find and low drag.')}>
        <Segmented<NoseShape> label={tr('Forma', 'Shape')} value={COMMON_SHAPES.includes(g.nose.shape) ? g.nose.shape : 'ogive'}
          options={COMMON_SHAPES.map((k) => ({ value: k, label: txt(NOSE_SHAPE_LABELS[k]) }))}
          onChange={(v) => update('nose.shape', (p) => { p.geometry.nose.shape = v; })} />
        <div className="grid">
          <NumberField label={tr('Lunghezza ogiva', 'Nose length')} dim="length" value={g.nose.length} rule={RULES.noseLength} field="geometry.nose.length"
            hint={tr(`${fmtNumber(g.nose.length / g.body.outerDiameter, 1)} volte il diametro (tipico 3–5)`, `${fmtNumber(g.nose.length / g.body.outerDiameter, 1)} times the diameter (typical 3–5)`)}
            onChange={(v) => update('nose.L', (p) => { p.geometry.nose.length = v; })} />
          <SelectField label={material} value={g.nose.materialId} options={materials}
            onChange={(v) => update('nose.mat', (p) => { p.geometry.nose.materialId = v; })} />
        </div>
        <Advanced>
          <div className="grid">
            <SelectField<NoseShape> label={tr('Tutte le forme', 'All shapes')} value={g.nose.shape}
              options={(Object.keys(NOSE_SHAPE_LABELS) as NoseShape[]).map((k) => ({ value: k, label: txt(NOSE_SHAPE_LABELS[k]) }))}
              onChange={(v) => update('nose.shape', (p) => { p.geometry.nose.shape = v; })} />
            {g.nose.shape === 'power' && (
              <NumberField label={tr('Esponente n', 'Exponent n')} dim="ratio" value={g.nose.shapeParameter} rule={RULES.shapeParameter} field="geometry.nose.shapeParameter"
                hint="r = R·(x/L)ⁿ, 0 < n ≤ 1" onChange={(v) => update('nose.n', (p) => { p.geometry.nose.shapeParameter = v; })} />
            )}
            <NumberField label={wall} dim="length" value={g.nose.wallThickness} rule={RULES.wallThickness} field="geometry.nose.wallThickness"
              disabled={g.nose.solid} hint={g.nose.solid ? tr('Non usato: ogiva piena', 'Not used: solid nose cone') : undefined}
              onChange={(v) => update('nose.t', (p) => { p.geometry.nose.wallThickness = v; })} />
            <div className="field">
              <span className="label-like">{tr('Costruzione', 'Construction')}</span>
              <Checkbox label={tr('Ogiva piena (es. balsa tornita)', 'Solid nose cone (e.g. turned balsa)')} checked={g.nose.solid}
                onChange={(v) => update('nose.solid', (p) => { p.geometry.nose.solid = v; })} />
            </div>
          </div>
        </Advanced>
      </Card>

      <Card icon="fin" title={tr('Pinne', 'Fins')} subtitle={tr('Le pinne spostano il centro di pressione verso la coda: è questo che rende il razzo stabile. Pinne più grandi = più stabilità.', 'Fins move the centre of pressure towards the tail: that is what makes the rocket stable. Bigger fins = more stability.')}>
        <div className="fin-layout">
          <FinSketch />
          <div className="grid">
            <Segmented<number> label={tr('Numero di pinne', 'Number of fins')} value={g.fins.count}
              options={[3, 4].map((n) => ({ value: n, label: tr(`${n} pinne`, `${n} fins`) }))}
              onChange={(v) => update('fins.n', (p) => { p.geometry.fins.count = v; })} />
            <NumberField label={tr('Base (Cr)', 'Root (Cr)')} dim="length" value={g.fins.rootChord} rule={RULES.rootChord} field="geometry.fins.rootChord"
              hint={tr('Lato attaccato al corpo', 'Edge attached to the body')} onChange={(v) => update('fins.cr', (p) => { p.geometry.fins.rootChord = v; })} />
            <NumberField label={tr('Punta (Ct)', 'Tip (Ct)')} dim="length" value={g.fins.tipChord} rule={RULES.tipChord} field="geometry.fins.tipChord"
              hint={tr('Lato esterno, parallelo al corpo', 'Outer edge, parallel to the body')} onChange={(v) => update('fins.ct', (p) => { p.geometry.fins.tipChord = v; })} />
            <NumberField label={tr('Altezza (s)', 'Height (s)')} dim="length" value={g.fins.span} rule={RULES.span} field="geometry.fins.span"
              hint={tr('Quanto sporge dal corpo', 'How far it sticks out from the body')} onChange={(v) => update('fins.s', (p) => { p.geometry.fins.span = v; })} />
            <NumberField label={tr('Inclinazione (Xs)', 'Sweep (Xs)')} dim="length" value={g.fins.sweepLength} rule={RULES.sweep} field="geometry.fins.sweepLength"
              hint={tr('Arretramento della punta', 'How far back the tip sits')} onChange={(v) => update('fins.xs', (p) => { p.geometry.fins.sweepLength = v; })} />
          </div>
        </div>
        <Advanced>
          <div className="grid">
            <NumberField label={tr('Numero di pinne (altro)', 'Number of fins (other)')} dim="count" value={g.fins.count} rule={RULES.finCount} field="geometry.fins.count"
              onChange={(v) => update('fins.n', (p) => { p.geometry.fins.count = v; })} />
            <NumberField label={tr('Spessore', 'Thickness')} dim="length" value={g.fins.thickness} rule={RULES.finThickness} field="geometry.fins.thickness"
              onChange={(v) => update('fins.t', (p) => { p.geometry.fins.thickness = v; })} />
            <NumberField label={tr('Distanza dal fondo', 'Distance from the aft end')} dim="length" value={g.fins.aftOffset} rule={RULES.aftOffset} field="geometry.fins.aftOffset"
              hint={tr('Dal fondo del tubo al bordo posteriore della pinna', 'From the end of the tube to the fin trailing edge')}
              onChange={(v) => update('fins.pos', (p) => { p.geometry.fins.aftOffset = v; })} />
            <SelectField label={material} value={g.fins.materialId} options={materials}
              onChange={(v) => update('fins.mat', (p) => { p.geometry.fins.materialId = v; })} />
            <SelectField label={tr('Profilo dei bordi', 'Edge profile')} value={g.fins.crossSection}
              options={[{ value: 'square', label: tr('Squadrato', 'Square') }, { value: 'rounded', label: tr('Arrotondato', 'Rounded') }, { value: 'airfoil', label: tr('Profilo alare', 'Airfoil') }]}
              onChange={(v) => update('fins.cs', (p) => { p.geometry.fins.crossSection = v; })} />
          </div>
        </Advanced>
      </Card>

      {designIssues.length > 0 && (
        <Card icon="alert" title={tr('Da sistemare', 'To fix')}>
          <IssueList issues={designIssues} />
        </Card>
      )}

      <StepFooter current="shape" />
    </div>
  );
}

/** Small annotated planform sketch so the fin parameters are unambiguous. */
function FinSketch() {
  const f = useStore((s) => s.project.geometry.fins);
  const W = 300, H = 170, pad = 30;
  const xmax = Math.max(f.rootChord, f.sweepLength + f.tipChord), xmin = Math.min(0, f.sweepLength);
  const sc = Math.min((W - 2 * pad) / Math.max(xmax - xmin, 1e-6), (H - 2 * pad) / Math.max(f.span, 1e-6));
  const X = (x: number) => pad + (x - xmin) * sc;
  const Y = (y: number) => H - pad - y * sc;
  const pts = [[0, 0], [f.rootChord, 0], [f.sweepLength + f.tipChord, f.span], [f.sweepLength, f.span]].map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fin-sketch" role="img" aria-label={tr('Schema della pinna con i parametri', 'Fin sketch with its parameters')}>
      <line x1={pad - 14} x2={W - pad + 14} y1={Y(0)} y2={Y(0)} className="axis-line" />
      <text x={W - pad + 12} y={Y(0) + 16} textAnchor="end" className="tick-label">{tr('corpo · coda →', 'body · tail →')}</text>
      <polygon points={pts} className="sv-fin" />
      <text x={(X(0) + X(f.rootChord)) / 2} y={Y(0) + 16} textAnchor="middle" className="point-label">Cr</text>
      <text x={(X(f.sweepLength) + X(f.sweepLength + f.tipChord)) / 2} y={Y(f.span) - 6} textAnchor="middle" className="point-label">Ct</text>
      <text x={X(f.sweepLength + f.tipChord) + 6} y={(Y(0) + Y(f.span)) / 2} className="point-label">s</text>
      <line x1={X(0)} x2={X(f.sweepLength)} y1={Y(f.span) - 16} y2={Y(f.span) - 16} className="crosshair" />
      <text x={(X(0) + X(f.sweepLength)) / 2} y={Y(f.span) - 20} textAnchor="middle" className="point-label">Xs</text>
    </svg>
  );
}
