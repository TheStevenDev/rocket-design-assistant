import { massAssumptions } from '../analysis/analyzeProject';
import { tr, txt } from '../core/i18n';
import { newId } from '../core/ids';
import { fmt, fmtNumber } from '../core/units';
import { barrowmanAssumptions } from '../physics/barrowman';
import { MARGIN_CLASS_LABELS, TYPICAL_MARGIN_MAX, TYPICAL_MARGIN_MIN } from '../physics/stability';
import { useStore } from '../state/store';
import { RULES } from '../validation/validate';
import { Histogram, LineChart, RocketSideView, TornadoChart } from './charts';
import { useAnalysis, useUnits } from './context';
import { Callout, Card, Checkbox, NumberField, Stat } from './fields';

export function ReliabilityBanner() {
  const { stability: s } = useAnalysis();
  const r = s.reliability;
  if (r.status === 'unavailable') {
    return (
      <Callout kind="error" title={tr('Stima di stabilità non disponibile', 'Stability estimate not available')}>
        <ul>{r.reasons.map((t) => <li key={t}>{t}</li>)}</ul>
        {r.missing.length > 0 && <p>{tr('Dati mancanti', 'Missing data')}: {r.missing.join('; ')}.</p>}
      </Callout>
    );
  }
  return (
    <Callout kind={r.status === 'limited' ? 'warning' : 'info'}
      title={r.status === 'limited' ? tr('Stima con limitazioni', 'Estimate with limitations') : tr('Stima valida solo entro le ipotesi del modello', 'Estimate valid only within the model assumptions')}>
      {r.reasons.length > 0 && <ul>{r.reasons.map((t) => <li key={t}>{t}</li>)}</ul>}
      <p>
        {tr('Risultato del metodo di Barrowman (subsonico, piccoli angoli d\'attacco). Non è una certificazione e non garantisce un volo stabile in ogni condizione: vento, raffiche, velocità di uscita dalla rampa e comprimibilità non sono considerati.',
          'Result of the Barrowman method (subsonic, small angles of attack). It is not a certification and does not guarantee a stable flight in every condition: wind, gusts, rail exit speed and compressibility are not considered.')}
      </p>
      {r.missing.length > 0 && <p><strong>{tr('Per migliorare la stima:', 'To improve the estimate:')}</strong> {r.missing.join('; ')}.</p>}
    </Callout>
  );
}

export function StabilityPanel() {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const lang = useStore((s) => s.lang);
  const a = useAnalysis();
  const u = useUnits();
  const L = (v: number) => fmt(v, 'length', u);
  const s = a.stability;
  const available = s.reliability.status !== 'unavailable';
  const D = a.derived.referenceDiameter;
  const ref = a.referenceConfigurationName;
  const del = tr('Elimina', 'Delete');

  return (
    <div className="panel">
      <ReliabilityBanner />

      <div className="stats">
        <Stat label={tr('Centro di massa (CG)', 'Centre of mass (CG)')} value={L(s.cgX)} sub={tr(`configurazione "${ref}"`, `configuration "${ref}"`)} />
        <Stat label={tr('Centro di pressione (CP)', 'Centre of pressure (CP)')} value={available ? L(s.cpX) : '—'} sub="Barrowman" />
        <Stat label={tr('Margine statico', 'Static margin')} value={available ? `${fmtNumber(s.margin, 2)} cal` : '—'}
          sub={txt(MARGIN_CLASS_LABELS[s.marginClass])} tone={s.marginClass} />
        {a.sensitivity?.monteCarlo && (
          <Stat label={tr('Intervallo con le incertezze', 'Range with uncertainties')} value={`${a.sensitivity.monteCarlo.p05.toFixed(2)} – ${a.sensitivity.monteCarlo.p95.toFixed(2)} cal`}
            sub={tr('5° – 95° percentile (Monte Carlo)', '5th – 95th percentile (Monte Carlo)')} />
        )}
      </div>

      <Card title={tr('CG e CP sul razzo', 'CG and CP on the rocket')} subtitle={lang === 'en'
        ? <>The static margin is the distance CP − CG divided by the diameter ({L(D)}). A CP behind the CG creates a moment that brings the rocket back in line, <em>according to the model</em>.</>
        : <>Il margine statico è la distanza CP − CG divisa per il diametro ({L(D)}). Un CP dietro al CG genera un momento che riporta il razzo in asse, <em>secondo il modello</em>.</>}>
        <RocketSideView geometry={project.geometry} derived={a.derived} cgX={s.cgX} cpX={s.cpX} formatLength={L}
          extraCg={a.configurations.map((c) => ({ x: c.point.cgX, label: c.configuration.name }))} />
        <div className="concept">
          <div><strong>CG</strong> · {tr('punto in cui si concentra la massa: si sposta in avanti mentre il motore brucia.', 'the point where the mass is concentrated: it moves forward as the motor burns.')}</div>
          <div><strong>CP</strong> · {tr('punto in cui agisce la risultante delle forze aerodinamiche laterali: dipende solo dalla forma (in questo modello).', 'the point where the resultant of the lateral aerodynamic forces acts: it depends only on the shape (in this model).')}</div>
          <div><strong>{tr('Margine', 'Margin')}</strong> · {tr('1–2 calibri è un intervallo di riferimento comune nei razzi amatoriali, non un criterio di sicurezza.', '1–2 calibers is a common reference range for hobby rockets, not a safety criterion.')}</div>
        </div>
      </Card>

      {available && (
        <Card title={tr('Contributi al centro di pressione', 'Contributions to the centre of pressure')} subtitle={tr('Pendenza del coefficiente di forza normale CNα (riferita all\'area della sezione del corpo).', 'Normal-force coefficient slope CNα (referred to the body cross-section area).')}>
          <table className="data">
            <thead><tr><th>{tr('Elemento', 'Item')}</th><th>CNα [1/rad]</th><th>{tr('Posizione CP', 'CP position')}</th><th>{tr('Peso sul CP', 'Weight on CP')}</th></tr></thead>
            <tbody>
              {s.cp.contributions.map((c) => (
                <tr key={c.part}><td>{c.name}</td><td className="num">{c.cnAlpha.toFixed(2)}</td><td className="num">{L(c.cpX)}</td>
                  <td><div className="share"><div style={{ width: `${(c.cnAlpha / s.cp.cnAlpha) * 100}%` }} /></div><span className="muted">{((c.cnAlpha / s.cp.cnAlpha) * 100).toFixed(0)}%</span></td></tr>
              ))}
              <tr className="total"><td>{tr('Totale', 'Total')}</td><td className="num">{s.cp.cnAlpha.toFixed(2)}</td><td className="num">{L(s.cpX)}</td><td className="muted">{tr('K pinne–corpo', 'K fin–body')} = {s.cp.interferenceFactor.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </Card>
      )}

      {available && (
        <Card title={tr('Margine durante la combustione', 'Margin during the burn')} subtitle={tr('Tutti i componenti inclusi; il propellente viene consumato dal 100% allo 0%.', 'All components included; the propellant is burnt from 100% to 0%.')}>
          <LineChart
            points={a.propellantSweep.map((p) => ({ x: p.propellantFraction * 100, y: p.margin }))}
            xLabel={tr('propellente residuo', 'remaining propellant')} yLabel={tr('margine statico [cal]', 'static margin [cal]')} invertX
            formatX={(v) => `${v.toFixed(0)}%`} formatY={(v) => v.toFixed(2)}
            band={{ y0: TYPICAL_MARGIN_MIN, y1: TYPICAL_MARGIN_MAX, label: tr('riferimento 1–2 cal', 'reference 1–2 cal') }}
            markers={[a.propellantSweep[0], a.propellantSweep[a.propellantSweep.length - 1]].map((p, i) => ({ x: p.propellantFraction * 100, y: p.margin, label: i ? 'burnout' : tr('decollo', 'lift-off') }))}
          />
        </Card>
      )}

      <Card title={tr('Configurazioni di massa', 'Mass configurations')} subtitle={tr('Confronta il margine escludendo componenti o variando il propellente (es. senza payload, con zavorra).', 'Compare the margin by excluding components or changing the propellant (e.g. without payload, with ballast).')}
        actions={<button onClick={() => update('cfg.add', (p) => { p.configurations.push({ id: newId('cfg'), name: tr(`Configurazione ${p.configurations.length + 1}`, `Configuration ${p.configurations.length + 1}`), excludedComponentIds: [], propellantFraction: 1 }); })}>+ {tr('Configurazione', 'Configuration')}</button>}>
        <p className="muted small">{tr('La prima configurazione è quella di riferimento per il riepilogo e la sensibilità.', 'The first configuration is the reference for the summary and the sensitivity.')}</p>
        <div className="configs">
          {project.configurations.map((cfg, idx) => {
            const res = a.configurations.find((r) => r.configuration.id === cfg.id);
            const set = (key: string, fn: (c: typeof cfg) => void) => update(`cfg.${cfg.id}.${key}`, (p) => { fn(p.configurations.find((x) => x.id === cfg.id)!); });
            return (
              <div key={cfg.id} className="config">
                <div className="component-head">
                  <input className="component-name" value={cfg.name} aria-label={tr('Nome configurazione', 'Configuration name')} onChange={(e) => set('name', (c) => { c.name = e.target.value; })} />
                  {idx === 0 && <span className="badge">{tr('riferimento', 'reference')}</span>}
                  <div className="spacer" />
                  {idx > 0 && <button className="ghost" onClick={() => update('cfg.up', (p) => { const [c] = p.configurations.splice(idx, 1); p.configurations.unshift(c); })}>{tr('Usa come riferimento', 'Use as reference')}</button>}
                  <button className="ghost danger" disabled={project.configurations.length <= 1}
                    onClick={() => update('cfg.del', (p) => { p.configurations = p.configurations.filter((x) => x.id !== cfg.id); })}>{del}</button>
                </div>
                <div className="config-body">
                  <NumberField label={tr('Propellente residuo', 'Remaining propellant')} dim="fraction" value={cfg.propellantFraction} rule={RULES.fraction}
                    onChange={(v) => set('frac', (c) => { c.propellantFraction = v; })} />
                  <div className="field field-wide">
                    <span className="label-like">{tr('Componenti inclusi', 'Included components')}</span>
                    <div className="checks">
                      {project.components.map((c) => (
                        <Checkbox key={c.id} label={c.name} checked={!cfg.excludedComponentIds.includes(c.id)}
                          onChange={(on) => set('excl', (x) => { x.excludedComponentIds = on ? x.excludedComponentIds.filter((id) => id !== c.id) : [...x.excludedComponentIds, c.id]; })} />
                      ))}
                    </div>
                  </div>
                  {res && (
                    <div className="config-result">
                      <div><span className="muted">{tr('Massa', 'Mass')}</span> {fmt(res.point.mass.total, 'mass', u)}</div>
                      <div><span className="muted">CG</span> {L(res.point.cgX)}</div>
                      <div className={`margin-chip tone-${res.marginClass}`}>{fmtNumber(res.point.margin, 2)} cal</div>
                      <div className="muted small">{txt(MARGIN_CLASS_LABELS[res.marginClass])}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {a.sensitivity && (
        <Card title={tr('Sensibilità alle incertezze', 'Sensitivity to uncertainties')}
          subtitle={tr(`Ogni barra mostra come cambia il margine portando un solo parametro al limite della sua incertezza (configurazione "${ref}"). Le incertezze dei componenti si modificano in Masse; la tolleranza delle pinne in Pinne e struttura.`,
            `Each bar shows how the margin changes when a single parameter is moved to the edge of its uncertainty (configuration "${ref}"). Component uncertainties are edited in Mass details; the fin tolerance in Fins and structure.`)}>
          <TornadoChart entries={a.sensitivity.tornado} nominal={a.sensitivity.nominal}
            describe={(e) => {
              const hw = e.kind === 'mass' ? fmt(e.halfWidth, 'mass', u) : L(e.halfWidth);
              return tr(`${e.label}: ±${hw} → margine da ${e.marginLow.toFixed(3)} a ${e.marginHigh.toFixed(3)} cal`, `${e.label}: ±${hw} → margin from ${e.marginLow.toFixed(3)} to ${e.marginHigh.toFixed(3)} cal`);
            }} />
          {a.sensitivity.monteCarlo && (
            <>
              <h3>{tr('Variazione combinata (Monte Carlo)', 'Combined variation (Monte Carlo)')}</h3>
              <p className="muted small">
                {tr(`${a.sensitivity.monteCarlo.samples} combinazioni casuali di tutti i parametri, ciascuno distribuito uniformemente entro la propria incertezza. Il 90% dei casi cade tra ${a.sensitivity.monteCarlo.p05.toFixed(2)} e ${a.sensitivity.monteCarlo.p95.toFixed(2)} cal. L'incertezza del modello aerodinamico stesso non è inclusa.`,
                  `${a.sensitivity.monteCarlo.samples} random combinations of all parameters, each uniformly distributed within its own uncertainty. 90% of the cases fall between ${a.sensitivity.monteCarlo.p05.toFixed(2)} and ${a.sensitivity.monteCarlo.p95.toFixed(2)} cal. The uncertainty of the aerodynamic model itself is not included.`)}
              </p>
              <Histogram mc={a.sensitivity.monteCarlo} band={{ y0: TYPICAL_MARGIN_MIN, y1: TYPICAL_MARGIN_MAX }} />
            </>
          )}
        </Card>
      )}

      <Card title={tr('Ipotesi del modello', 'Model assumptions')}>
        <ul className="assumptions">
          {[...massAssumptions(), ...barrowmanAssumptions()].map((x) => <li key={x.text}><span className="badge">{x.model}</span> {x.text}</li>)}
        </ul>
      </Card>
    </div>
  );
}
