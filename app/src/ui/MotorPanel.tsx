import { flightChecks } from '../analysis/flightChecks';
import { MOTORS, PARACHUTES, chuteDiameterOf, descentRate } from '../core/catalog';
import { motorComponent, parachuteComponent } from '../core/defaults';
import { tr, txt } from '../core/i18n';
import type { MassComponent } from '../core/types';
import { fmt, fmtNumber } from '../core/units';
import { useStore } from '../state/store';
import { RULES } from '../validation/validate';
import { CheckList } from './CheckPanel';
import { useAnalysis, useUnits } from './context';
import { Advanced, Card, NumberField } from './fields';
import { Icon } from './icons';
import { StepFooter, StepIntro } from './steps';

export function MotorPanel() {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const a = useAnalysis();
  const u = useUnits();
  const L = (v: number) => fmt(v, 'length', u);
  const motor = project.components.find((c) => c.kind === 'motor');
  const chute = project.components.find((c) => c.role === 'recovery' && chuteDiameterOf(c) !== null);
  const fc = flightChecks(project, a);
  const tips = fc.checks.filter((c) => c.step === 'motor');
  const setMotor = (key: string, fn: (m: MassComponent) => void) =>
    update(`motor.${key}`, (p) => { fn(p.components.find((c) => c.kind === 'motor')!); });
  const inner = a.derived.innerDiameter;
  const chuteCm = Math.round(fc.recommendedChute * 100);
  const burnoutMass = fmt(fc.burnoutMass, 'mass', u);
  const thrustcurve = <a href="https://www.thrustcurve.org" target="_blank" rel="noreferrer">thrustcurve.org</a>;

  return (
    <div className="panel">
      <StepIntro step={3} title={tr('Motore e paracadute', 'Motor and parachute')}>
        {tr('Il motore deve spingere almeno 5 volte il peso del razzo; il paracadute deve farlo scendere a 3–7 m/s.',
          'The motor must push at least 5 times the rocket\'s weight; the parachute must bring it down at 3–7 m/s.')}
      </StepIntro>

      <div className="mini-stats">
        <div><span>{tr('Massa al decollo', 'Lift-off mass')}</span><strong>{fmt(fc.liftoffMass, 'mass', u)}</strong></div>
        <div><span>{tr('Spinta / peso', 'Thrust / weight')}</span><strong className={fc.thrustToWeight !== null && fc.thrustToWeight < 5 ? 'tone-low' : ''}>{fc.thrustToWeight === null ? '—' : `${fmtNumber(fc.thrustToWeight, 1)} : 1`}</strong></div>
        <div><span>{tr('Velocità di discesa', 'Descent rate')}</span><strong>{fc.descentRate === null ? '—' : `${fmtNumber(fc.descentRate, 1)} m/s`}</strong></div>
        <div><span>{tr('Paracadute ideale', 'Ideal parachute')}</span><strong>Ø {chuteCm} cm</strong></div>
      </div>

      <Card icon="flame" title={tr('Motore', 'Motor')} subtitle={
        <>{tr('Valori indicativi per scegliere: i dati esatti sono su', 'Indicative values to help you choose: the exact data are on')} {thrustcurve}. {tr(`Il diametro interno del tuo tubo è ${L(inner)}.`, `The inner diameter of your tube is ${L(inner)}.`)}</>
      }>
        <div className="tiles tiles-motor">
          {MOTORS.map((m) => {
            const on = motor?.catalogId === m.id;
            const fits = m.diameter < inner;
            return (
              <button key={m.id} className={`tile ${on ? 'on' : ''}`} aria-pressed={on} disabled={!fits}
                title={fits ? undefined : tr('Troppo grande per il tubo', 'Too big for the tube')}
                onClick={() => update('motor.pick', (p) => {
                  const total = a.derived.totalLength;
                  const old = p.components.findIndex((c) => c.kind === 'motor');
                  const next = motorComponent(m, total);
                  if (old >= 0) { next.id = p.components[old].id; p.components[old] = next; } else p.components.push(next);
                })}>
                <span className="tile-head">
                  <span className="motor-class">{m.impulseClass}</span>
                  <span className="tile-name">{txt(m.name)}</span>
                  <span className="tile-check" aria-hidden>{on && <Icon name="check" size={14} />}</span>
                </span>
                <span className="tile-summary">{fits ? txt(m.note) : tr(`Non entra: serve un tubo con diametro interno > ${L(m.diameter)}.`, `Does not fit: needs a tube with inner diameter > ${L(m.diameter)}.`)}</span>
                <span className="tile-foot">
                  <span>Ø {Math.round(m.diameter * 1000)} mm</span>
                  <span>{fmt(m.totalMass, 'mass', u)}</span>
                  <span>{m.avgThrust} N</span>
                </span>
              </button>
            );
          })}
        </div>

        {motor && (
          <div className="installed">
            <div className="installed-title"><Icon name="check" size={14} /> <strong>{motor.name}</strong></div>
            <div className="grid">
              <NumberField label={tr('Massa totale', 'Total mass')} dim="mass" value={motor.mass} rule={RULES.mass} field={`components.${motor.id}.mass`}
                hint={tr('Con il propellente', 'Including propellant')} onChange={(v) => setMotor('mass', (m) => { m.mass = v; })} />
              <NumberField label={tr('Propellente', 'Propellant')} dim="mass" value={motor.propellantMass} rule={RULES.massNonNegative} field={`components.${motor.id}.propellantMass`}
                onChange={(v) => setMotor('prop', (m) => { m.propellantMass = v; })} />
              <NumberField label={tr('Spinta media', 'Average thrust')} dim="force" value={motor.avgThrust ?? null} rule={RULES.positive}
                onClear={() => setMotor('thrust', (m) => { delete m.avgThrust; })}
                onChange={(v) => setMotor('thrust', (m) => { m.avgThrust = v; })} />
            </div>
            <Advanced label={tr('Dimensioni e posizione', 'Size and position')}>
              <div className="grid">
                <NumberField label={tr('Diametro', 'Diameter')} dim="length" value={motor.diameter} rule={RULES.nonNegative} field={`components.${motor.id}.diameter`}
                  onChange={(v) => setMotor('dia', (m) => { m.diameter = v; })} />
                <NumberField label={tr('Lunghezza', 'Length')} dim="length" value={motor.length} rule={RULES.nonNegative} field={`components.${motor.id}.length`}
                  onChange={(v) => setMotor('len', (m) => { m.length = v; })} />
                <NumberField label={tr('Centro del motore', 'Motor centre')} dim="length" value={motor.cgX} rule={RULES.nonNegative} field={`components.${motor.id}.cgX`}
                  hint={tr('Dalla punta dell\'ogiva', 'From the nose tip')} onChange={(v) => setMotor('cg', (m) => { m.cgX = v; })} />
                <div className="field">
                  <span className="label-like">&nbsp;</span>
                  <button onClick={() => setMotor('cg', (m) => { m.cgX = Math.max(0, a.derived.totalLength - m.length / 2); })}>{tr('Allinea alla coda', 'Align with the tail')}</button>
                </div>
              </div>
            </Advanced>
          </div>
        )}
      </Card>

      <Card icon="parachute" title={tr('Paracadute', 'Parachute')} subtitle={tr(
        `Per una massa a fine spinta di ${burnoutMass} serve un paracadute di circa ${chuteCm} cm (discesa a 5 m/s).`,
        `For a burnout mass of ${burnoutMass} you need a parachute of about ${chuteCm} cm (descent at 5 m/s).`)}>
        <div className="chute-row">
          {PARACHUTES.map((c) => {
            const rate = descentRate(fc.burnoutMass, c.diameter);
            const on = chute?.catalogId === c.id;
            const tone = rate > 7 ? 'bad' : rate < 3 ? 'warn' : 'ok';
            return (
              <button key={c.id} className={`chute ${on ? 'on' : ''}`} aria-pressed={on}
                onClick={() => update('chute.pick', (p) => {
                  const old = p.components.findIndex((x) => x.role === 'recovery' && chuteDiameterOf(x) !== null);
                  const cg = old >= 0 ? p.components[old].cgX : p.geometry.nose.length + p.geometry.body.length * 0.27;
                  const next = parachuteComponent(c.diameter, cg);
                  if (old >= 0) { next.id = p.components[old].id; p.components[old] = next; } else p.components.push(next);
                })}>
                <strong>{Math.round(c.diameter * 100)} cm</strong>
                <span className={`rate rate-${tone}`}>{rate.toFixed(1)} m/s</span>
              </button>
            );
          })}
        </div>
        <p className="muted small">{tr('Velocità calcolate con un coefficiente di resistenza 0,8 (paracadute piatto tondo), stima prudente.', 'Rates computed with a drag coefficient of 0.8 (flat round parachute), a conservative estimate.')}</p>
      </Card>

      {tips.length > 0 && (
        <Card icon="info" title={tr('Da controllare', 'To check')}>
          <CheckList checks={tips} />
        </Card>
      )}

      <StepFooter current="motor" />
    </div>
  );
}
