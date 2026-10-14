import { useMemo } from 'react';
import { newComponent } from '../core/defaults';
import { tr } from '../core/i18n';
import { newId } from '../core/ids';
import { fmt } from '../core/units';
import type { MassComponent } from '../core/types';
import { structuralMasses } from '../mass/massProperties';
import { useStore } from '../state/store';
import { RULES } from '../validation/validate';
import { RocketSideView } from './charts';
import { useAnalysis, useUnits } from './context';
import { Callout, Card, IssueList, NumberField, SelectField, SourceBadge, Stat, TextField } from './fields';

export function MassPanel() {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const lang = useStore((s) => s.lang);
  const a = useAnalysis();
  const u = useUnits();
  const L = (v: number) => fmt(v, 'length', u);
  const M = (v: number) => fmt(v, 'mass', u);

  const computed = useMemo(() => {
    const g = structuredClone(project.geometry);
    g.nose.massOverride = g.body.massOverride = g.fins.massOverride = null;
    return structuralMasses(g, a.derived);
    // Part names are translated, so recompute on a language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.geometry, a.derived, lang]);

  const bySource = (s: string) => a.mass.items.filter((i) => i.source === s).reduce((t, i) => t + i.mass, 0);
  const total = a.mass.total || 1;
  const pct = (s: string) => Math.round((bySource(s) / total) * 100);
  const origin = tr('Origine', 'Source');

  return (
    <div className="panel">
      <div className="stats">
        <Stat label={tr(`Massa totale (${a.referenceConfigurationName})`, `Total mass (${a.referenceConfigurationName})`)} value={M(a.mass.total)}
          sub={tr(`± ${M(a.mass.totalUncertainty)} (somma quadratica)`, `± ${M(a.mass.totalUncertainty)} (root sum square)`)} />
        <Stat label={tr('Centro di massa (CG)', 'Centre of mass (CG)')} value={L(a.mass.cgX)} sub={tr('dalla punta dell\'ogiva', 'from the nose tip')} />
        <Stat label={tr('Massa misurata', 'Measured mass')} value={`${pct('measured')}%`}
          sub={tr(`stimata ${pct('estimated')}% · calcolata ${pct('computed')}%`, `estimated ${pct('estimated')}% · computed ${pct('computed')}%`)} />
      </div>

      <Card title={tr('Distribuzione delle masse lungo l\'asse', 'Mass distribution along the axis')}
        subtitle={tr('Ogni cerchio è un elemento, con area proporzionale alla massa; il segmento indica l\'ingombro. Passa sopra un elemento per i dettagli.', 'Each circle is an item, with its area proportional to its mass; the segment shows its length. Hover over an item for details.')}>
        <RocketSideView geometry={project.geometry} derived={a.derived} cgX={a.mass.cgX} cpX={a.stability.cpX}
          items={a.mass.items} formatLength={L} formatMass={M} />
      </Card>

      <Card title={tr('Parti strutturali', 'Structural parts')} subtitle={tr('Calcolate da geometria e densità del materiale. Inserisci la massa pesata per sostituire la stima.', 'Computed from geometry and material density. Enter the weighed mass to replace the estimate.')}>
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>{tr('Parte', 'Part')}</th><th>{tr('Stima da geometria', 'Estimate from geometry')}</th><th>{tr('Massa misurata', 'Measured mass')}</th><th>CG</th><th>{origin}</th></tr></thead>
            <tbody>
              {(['nose', 'body', 'fins'] as const).map((part, k) => {
                const ov = project.geometry[part].massOverride;
                const item = a.mass.items.find((i) => i.refId === part)!;
                return (
                  <tr key={part}>
                    <td>{computed[k].name}</td>
                    <td className="num">{M(computed[k].mass)} <span className="muted">±15%</span></td>
                    <td className="cell-field">
                      <NumberField label="" dim="mass" value={ov?.mass ?? null} rule={RULES.positive} placeholder={tr('non misurata', 'not measured')}
                        onClear={() => update(`ov.${part}`, (p) => { p.geometry[part].massOverride = null; })}
                        onChange={(v) => update(`ov.${part}`, (p) => { p.geometry[part].massOverride = { mass: v, massUncertainty: p.geometry[part].massOverride?.massUncertainty ?? 0.001 }; })} />
                    </td>
                    <td className="num">{L(item.cgX)}</td>
                    <td><SourceBadge source={item.source} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={tr('Componenti', 'Components')} subtitle={tr('Elettronica, recupero, motore, zavorra… La posizione è quella del CG del singolo componente.', 'Electronics, recovery, motor, ballast… The position is the CG of each component.')}
        actions={<>
          <button onClick={() => update('add', (p) => { p.components.push(newComponent()); })}>+ {tr('Componente', 'Component')}</button>
          <button onClick={() => update('add', (p) => {
            p.components.push(newComponent({ name: tr('Motore', 'Motor'), kind: 'motor', mass: 0.1, propellantMass: 0.05, cgX: Math.max(0, a.derived.totalLength - 0.05), length: 0.1, diameter: 0.029 }));
          })}>+ {tr('Motore', 'Motor')}</button>
        </>}>
        {project.components.length === 0 && <p className="muted">{tr('Nessun componente. Aggiungi almeno il motore.', 'No components. Add at least the motor.')}</p>}
        <div className="components">
          {project.components.map((c) => <ComponentEditor key={c.id} c={c} />)}
        </div>
      </Card>

      <Card title={tr('Riepilogo masse', 'Mass summary')}>
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>{tr('Elemento', 'Item')}</th><th>{tr('Massa', 'Mass')}</th><th>{tr('Quota', 'Share')}</th><th>CG</th><th>{tr('Incertezza', 'Uncertainty')}</th><th>{origin}</th></tr></thead>
            <tbody>
              {[...a.mass.items].sort((x, y) => y.mass - x.mass).map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td className="num">{M(i.mass)}</td>
                  <td><div className="share"><div style={{ width: `${(i.mass / total) * 100}%` }} /></div><span className="muted">{((i.mass / total) * 100).toFixed(0)}%</span></td>
                  <td className="num">{L(i.cgX)}</td>
                  <td className="num">±{M(i.massUncertainty)} · ±{L(i.positionUncertainty)}</td>
                  <td><SourceBadge source={i.source} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={tr('Controlli sui dati di massa', 'Mass data checks')}>
        <IssueList issues={a.issues.filter((i) => i.area === 'mass')} />
        <Callout kind="info">{lang === 'en'
          ? '"Computed" masses use typical densities and have an assumed uncertainty of ±15%; "estimated" masses are entered values that were not weighed. Weighing the components is the most effective way to improve the CG estimate.'
          : 'Le masse "calcolate" usano densità tipiche e hanno un\'incertezza assunta di ±15%; le masse "stimate" sono valori inseriti ma non pesati. Pesare i componenti è il modo più efficace per migliorare la stima del CG.'}</Callout>
      </Card>
    </div>
  );
}

function ComponentEditor({ c }: { c: MassComponent }) {
  const update = useStore((s) => s.update);
  const set = (key: string, fn: (t: MassComponent) => void) => update(`${c.id}.${key}`, (p) => { fn(p.components.find((x) => x.id === c.id)!); });
  const f = (k: string) => `components.${c.id}.${k}`;
  const fromTip = tr('Dalla punta dell\'ogiva', 'From the nose tip');
  return (
    <div className={`component ${c.kind}`}>
      <div className="component-head">
        <input className="component-name" value={c.name} aria-label={tr('Nome componente', 'Component name')} onChange={(e) => set('name', (t) => { t.name = e.target.value; })} />
        <span className="badge">{c.kind === 'motor' ? tr('motore', 'motor') : tr('componente', 'component')}</span>
        <SourceBadge source={c.source} />
        <div className="spacer" />
        <button className="ghost" title={tr('Duplica', 'Duplicate')} onClick={() => update('dup', (p) => {
          const i = p.components.findIndex((x) => x.id === c.id);
          p.components.splice(i + 1, 0, { ...structuredClone(c), id: newId('cmp'), name: `${c.name} (${tr('copia', 'copy')})` });
        })}>{tr('Duplica', 'Duplicate')}</button>
        <button className="ghost danger" title={tr('Elimina', 'Delete')} onClick={() => update('del', (p) => {
          p.components = p.components.filter((x) => x.id !== c.id);
          p.configurations.forEach((cfg) => { cfg.excludedComponentIds = cfg.excludedComponentIds.filter((id) => id !== c.id); });
        })}>{tr('Elimina', 'Delete')}</button>
      </div>
      <div className="grid">
        <NumberField label={c.kind === 'motor' ? tr('Massa al decollo', 'Lift-off mass') : tr('Massa', 'Mass')} dim="mass" value={c.mass} rule={RULES.mass} field={f('mass')}
          onChange={(v) => set('mass', (t) => { t.mass = v; })} />
        {c.kind === 'motor' && (
          <NumberField label={tr('Massa propellente', 'Propellant mass')} dim="mass" value={c.propellantMass} rule={RULES.massNonNegative} field={f('propellantMass')}
            hint={tr('Consumata durante la combustione', 'Burnt during the burn')} onChange={(v) => set('prop', (t) => { t.propellantMass = v; })} />
        )}
        <NumberField label={tr('Posizione CG', 'CG position')} dim="length" value={c.cgX} rule={RULES.nonNegative} field={f('cgX')} hint={fromTip}
          onChange={(v) => set('cg', (t) => { t.cgX = v; })} />
        <NumberField label={tr('Lunghezza', 'Length')} dim="length" value={c.length} rule={RULES.nonNegative} field={f('length')} hint={tr('0 = non specificata', '0 = not specified')}
          onChange={(v) => set('len', (t) => { t.length = v; })} />
        <NumberField label={tr('Diametro', 'Diameter')} dim="length" value={c.diameter} rule={RULES.nonNegative} field={f('diameter')} hint={tr('0 = non specificato', '0 = not specified')}
          onChange={(v) => set('dia', (t) => { t.diameter = v; })} />
        <SelectField label={tr('Origine del dato', 'Data source')} value={c.source}
          options={[{ value: 'measured', label: tr('Misurato (pesato)', 'Measured (weighed)') }, { value: 'estimated', label: tr('Stimato', 'Estimated') }]}
          onChange={(v) => set('src', (t) => { t.source = v; })} />
        <NumberField label={tr('Incertezza massa ±', 'Mass uncertainty ±')} dim="mass" value={c.massUncertainty} rule={RULES.uncertainty} field={f('massUncertainty')}
          onChange={(v) => set('dm', (t) => { t.massUncertainty = v; })} />
        <NumberField label={tr('Incertezza posizione ±', 'Position uncertainty ±')} dim="length" value={c.positionUncertainty} rule={RULES.uncertainty}
          onChange={(v) => set('dx', (t) => { t.positionUncertainty = v; })} />
        <SelectField label={tr('Tipo', 'Type')} value={c.kind} options={[{ value: 'generic', label: tr('Componente', 'Component') }, { value: 'motor', label: tr('Motore', 'Motor') }]}
          onChange={(v) => set('kind', (t) => { t.kind = v; })} />
      </div>
      <TextField label={tr('Note', 'Notes')} value={c.notes} onChange={(v) => set('notes', (t) => { t.notes = v; })} placeholder={tr('Fonte del dato, modello, ecc.', 'Data source, model, etc.')} />
    </div>
  );
}
