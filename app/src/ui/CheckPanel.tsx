import { flightChecks, type CheckStatus, type FlightCheck } from '../analysis/flightChecks';
import { tr, txt } from '../core/i18n';
import { fmt, fmtNumber } from '../core/units';
import { useStore } from '../state/store';
import { RocketSideView } from './charts';
import { useAnalysis, useUnits } from './context';
import { Card, IssueList } from './fields';
import { Icon, type IconName } from './icons';
import { STEPS, StepFooter, StepIntro } from './steps';

const STATUS_ICON: Record<CheckStatus, IconName> = { ok: 'checkCircle', warn: 'alert', bad: 'xCircle', todo: 'info' };
const statusLabel = (s: CheckStatus) =>
  ({ ok: 'ok', warn: tr('attenzione', 'warning'), bad: tr('da sistemare', 'to fix'), todo: tr('da fare', 'to do') })[s];

export function CheckList({ checks }: { checks: FlightCheck[] }) {
  const setTab = useStore((s) => s.setTab);
  const tab = useStore((s) => s.tab);
  return (
    <ul className="checks-list">
      {checks.map((c) => {
        const step = STEPS.find((s) => s.id === c.step);
        return (
          <li key={c.id} className={`check check-${c.status}`}>
            <Icon name={STATUS_ICON[c.status]} size={20} className="check-icon" />
            <div className="check-body">
              <div className="check-title">
                <strong>{c.title}</strong>
                <span className="sr-only">{statusLabel(c.status)}</span>
                {c.step !== tab && c.status !== 'ok' && step && (
                  <button className="link small" onClick={() => setTab(c.step)}>{tr('Vai a', 'Go to')} {txt(step.label)}</button>
                )}
              </div>
              <p>{c.text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Horizontal static-margin scale with the reference band and lift-off / burnout markers. */
function MarginGauge({ liftoff, burnout }: { liftoff: number; burnout: number }) {
  const W = 640, H = 72, pad = 24, min = -1, max = 4;
  const X = (v: number) => pad + ((Math.min(Math.max(v, min), max) - min) / (max - min)) * (W - 2 * pad);
  const y = 24, h = 14;
  const zones: [number, number, string][] = [[min, 0, 'z-bad'], [0, 1, 'z-warn'], [1, 2, 'z-ok'], [2, 3, 'z-ok2'], [3, max, 'z-warn']];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="gauge" role="img"
      aria-label={tr(`Margine statico ${fmtNumber(liftoff, 2)} calibri al decollo, ${fmtNumber(burnout, 2)} a fine spinta`, `Static margin ${fmtNumber(liftoff, 2)} calibers at lift-off, ${fmtNumber(burnout, 2)} at burnout`)}>
      {zones.map(([a, b, cls]) => <rect key={a} x={X(a)} y={y} width={X(b) - X(a)} height={h} className={cls} />)}
      {[-1, 0, 1, 2, 3, 4].map((t) => (
        <text key={t} x={X(t)} y={y + h + 18} textAnchor="middle" className="tick-label">{t}</text>
      ))}
      <text x={X(1.5)} y={y - 8} textAnchor="middle" className="gauge-band">{tr('zona ideale', 'ideal zone')}</text>
      {Number.isFinite(burnout) && (
        <g className="gauge-burnout">
          <line x1={X(burnout)} x2={X(burnout)} y1={y - 4} y2={y + h + 4} />
          <circle cx={X(burnout)} cy={y + h / 2} r={7} />
        </g>
      )}
      {Number.isFinite(liftoff) && (
        <g className="gauge-liftoff">
          <circle cx={X(liftoff)} cy={y + h / 2} r={9} />
        </g>
      )}
    </svg>
  );
}

export function CheckPanel() {
  const project = useStore((s) => s.project);
  const lang = useStore((s) => s.lang);
  const a = useAnalysis();
  const u = useUnits();
  const L = (v: number) => fmt(v, 'length', u);
  const fc = flightChecks(project, a);
  const s = a.stability;
  const available = s.reliability.status !== 'unavailable';
  const burnout = a.configurations.find((c) => c.configuration.propellantFraction === 0)?.point.margin ?? NaN;
  const bad = fc.checks.filter((c) => c.status === 'bad').length;
  const warn = fc.checks.filter((c) => c.status === 'warn').length;
  const passed = fc.checks.filter((c) => c.status === 'ok').length;
  const badTitle = bad === 1 ? tr('C\'è una cosa da sistemare', 'There is one thing to fix') : tr(`Ci sono ${bad} cose da sistemare`, `There are ${bad} things to fix`);
  const verdict = !available ? { tone: 'bad', title: tr('Stabilità non ancora calcolabile', 'Stability cannot be computed yet'), icon: 'xCircle' as const }
    : bad > 0 ? { tone: 'bad', title: badTitle, icon: 'xCircle' as const }
    : warn > 0 ? { tone: 'warn', title: tr('Quasi pronto: controlla gli avvisi', 'Almost ready: check the warnings'), icon: 'alert' as const }
    : { tone: 'ok', title: tr('Tutto in ordine secondo il modello', 'All good according to the model'), icon: 'checkCircle' as const };
  const errors = a.issues.filter((i) => i.severity === 'error');

  return (
    <div className="panel">
      <StepIntro step={4} title={tr('Verifica', 'Check')}>
        {tr('Un riepilogo semplice di quello che conta per il primo volo. Ogni punto ti porta dove puoi sistemarlo.',
          'A simple summary of what matters for the first flight. Each item takes you to where you can fix it.')}
      </StepIntro>

      <section className={`hero hero-${verdict.tone}`}>
        <div className="hero-head">
          <Icon name={verdict.icon} size={28} />
          <div>
            <h2>{verdict.title}</h2>
            <p className="muted">{tr(`${passed} controlli superati · ${warn} avvisi · ${bad} problemi`, `${passed} checks passed · ${warn} warnings · ${bad} problems`)}</p>
          </div>
        </div>
        <div className="hero-metrics">
          <div><span>{tr('Margine al decollo', 'Margin at lift-off')}</span><strong>{available ? `${fmtNumber(s.margin, 2)} cal` : '—'}</strong></div>
          <div><span>{tr('A fine spinta', 'At burnout')}</span><strong>{available ? `${fmtNumber(burnout, 2)} cal` : '—'}</strong></div>
          <div><span>{tr('Spinta / peso', 'Thrust / weight')}</span><strong>{fc.thrustToWeight === null ? '—' : `${fmtNumber(fc.thrustToWeight, 1)} : 1`}</strong></div>
          <div><span>{tr('Discesa', 'Descent')}</span><strong>{fc.descentRate === null ? '—' : `${fmtNumber(fc.descentRate, 1)} m/s`}</strong></div>
        </div>
        {available && <MarginGauge liftoff={s.margin} burnout={burnout} />}
        <div className="legend">
          <span><span className="lg lg-cg" /> {tr('decollo', 'lift-off')}</span>
          <span><span className="lg lg-dashed" /> {tr('fine spinta', 'burnout')}</span>
          <span>{tr('Margine statico in calibri: distanza tra baricentro (CG) e centro di pressione (CP) divisa per il diametro.', 'Static margin in calibers: distance between the centre of gravity (CG) and the centre of pressure (CP) divided by the diameter.')}</span>
        </div>
      </section>

      <Card icon="checkCircle" title={tr('Checklist del primo volo', 'First flight checklist')}>
        <CheckList checks={fc.checks} />
      </Card>

      <Card icon="rocket" title={tr('Dove sono baricentro e centro di pressione', 'Where the centre of gravity and centre of pressure are')}
        subtitle={lang === 'en'
          ? <>The rocket is stable when the <strong>CP</strong> (red) is behind the <strong>CG</strong> (blue) by at least one diameter.</>
          : <>Il razzo è stabile quando il <strong>CP</strong> (rosso) è dietro al <strong>CG</strong> (blu) di almeno un diametro.</>}>
        <RocketSideView geometry={project.geometry} derived={a.derived} cgX={s.cgX} cpX={s.cpX} formatLength={L} />
      </Card>

      {errors.length > 0 && (
        <Card icon="xCircle" title={tr('Errori nei dati', 'Data errors')}>
          <IssueList issues={errors} />
        </Card>
      )}

      <details className="advanced card">
        <summary>{tr('Limiti di queste stime', 'Limits of these estimates')}</summary>
        <div className="advanced-body">
          {lang === 'en' ? (
            <p>
              The calculations use simplified models (Barrowman, subsonic speed, small angles). Passing these checks <strong>does not make the rocket safe</strong>:
              run a full simulation (e.g. OpenRocket), do a swing test on a string and follow the rules of the launch site and of your club.
            </p>
          ) : (
            <p>
              I calcoli usano modelli semplificati (Barrowman, velocità subsonica, piccoli angoli). Superare questi controlli <strong>non rende il razzo sicuro</strong>:
              fai una simulazione completa (es. OpenRocket), una prova di oscillazione con lo spago e segui le regole del sito di lancio e dell'associazione.
            </p>
          )}
          <ul className="assumptions">{a.assumptions.map((x) => <li key={x.text}><span className="badge">{x.model}</span> {x.text}</li>)}</ul>
        </div>
      </details>

      <StepFooter current="check" />
    </div>
  );
}
