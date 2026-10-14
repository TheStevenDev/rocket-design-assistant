import { ELECTRONICS, SINGLE_CHOICE_ROLES, getCatalogItem, powerBudget, zonePosition, type CatalogItem, type Zone } from '../core/catalog';
import { EXAMPLE_KIT, catalogComponent } from '../core/defaults';
import { tr, txt, type Text } from '../core/i18n';
import type { ComponentRole, MassComponent, Project } from '../core/types';
import { fmt } from '../core/units';
import { deriveGeometry } from '../geometry/rocketGeometry';
import { flightChecks } from '../analysis/flightChecks';
import { useStore } from '../state/store';
import { RULES } from '../validation/validate';
import { CheckList } from './CheckPanel';
import { useAnalysis, useUnits } from './context';
import { Card, NumberField } from './fields';
import { Icon, type IconName } from './icons';
import { StepFooter, StepIntro } from './steps';

interface Category { role: ComponentRole; icon: IconName; title: Text; intro: Text }

const CATEGORIES: Category[] = [
  {
    role: 'gps', icon: 'gps', title: { it: 'GPS', en: 'GPS' },
    intro: {
      it: 'Registra la traiettoria e ti dice dove è atterrato il razzo. Va messo nell\'ogiva, se è di plastica: lì il segnale arriva meglio.',
      en: 'Logs the trajectory and tells you where the rocket landed. Put it in the nose cone if it is plastic: the signal gets through best there.',
    },
  },
  {
    role: 'sensor', icon: 'sensor', title: { it: 'Inclinazione e accelerazione', en: 'Tilt and acceleration' },
    intro: {
      it: 'Un sensore inerziale (IMU) misura accelerazioni e rotazioni: da qui ricavi l\'inclinazione, la spinta reale e le vibrazioni. Il barometro aggiunge la quota. Puoi sceglierne più di uno.',
      en: 'An inertial sensor (IMU) measures accelerations and rotations: from these you get tilt, real thrust and vibration. The barometer adds altitude. You can pick more than one.',
    },
  },
  {
    role: 'computer', icon: 'computer', title: { it: 'Computer di volo', en: 'Flight computer' },
    intro: { it: 'Il microcontrollore che legge tutti i sensori e salva i dati su microSD.', en: 'The microcontroller that reads every sensor and saves the data to microSD.' },
  },
  {
    role: 'camera', icon: 'camera', title: { it: 'Camera', en: 'Camera' },
    intro: {
      it: 'Per riprendere il volo. Di solito guarda verso il basso da una finestrella laterale o da una carenatura sul corpo.',
      en: 'To film the flight. It usually looks down through a side window or from a fairing on the body.',
    },
  },
  {
    role: 'battery', icon: 'battery', title: { it: 'Batteria', en: 'Battery' },
    intro: { it: 'Alimenta GPS, sensori e computer (e la camera, se non ha una batteria propria).', en: 'Powers GPS, sensors and computer (and the camera, if it has no battery of its own).' },
  },
  {
    role: 'other', icon: 'box', title: { it: 'Montaggio', en: 'Mounting' },
    intro: { it: 'Il supporto che tiene ferma l\'elettronica dentro il vano.', en: 'The mount that holds the electronics in place inside the bay.' },
  },
];

const isCatalogPart = (c: MassComponent) => getCatalogItem(c.catalogId) !== undefined;

function addPart(p: Project, item: CatalogItem) {
  const g = p.geometry;
  const d = deriveGeometry(g);
  if (SINGLE_CHOICE_ROLES.includes(item.role)) {
    removeParts(p, (c) => c.role === item.role && isCatalogPart(c));
  }
  const zone: Zone = item.role === 'gps' ? 'nose' : 'bay';
  p.components.push(catalogComponent(item, zonePosition(zone, g, d)));
}

function removeParts(p: Project, pred: (c: MassComponent) => boolean) {
  const removed = new Set(p.components.filter(pred).map((c) => c.id));
  p.components = p.components.filter((c) => !removed.has(c.id));
  p.configurations.forEach((cfg) => { cfg.excludedComponentIds = cfg.excludedComponentIds.filter((id) => !removed.has(id)); });
}

export function ElectronicsPanel() {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const a = useAnalysis();
  const u = useUnits();
  const electronics = project.components.filter(isCatalogPart);
  const totalMass = electronics.reduce((t, c) => t + c.mass, 0);
  const power = powerBudget(project.components);
  const tips = flightChecks(project, a).checks.filter((c) => c.step === 'electronics');

  return (
    <div className="panel">
      <StepIntro step={2} title={tr('Scegli l\'elettronica', 'Choose the electronics')}>
        {tr('Tocca una scheda per aggiungerla al razzo. Pesi e consumi sono valori tipici: quando hai i pezzi in mano, pesali e inserisci il valore reale.',
          'Tap a card to add it to the rocket. Weights and power draw are typical values: once you have the parts, weigh them and enter the real value.')}
      </StepIntro>

      <div className="kit-bar">
        <div className="mini-stats">
          <div><span>{tr('Componenti', 'Components')}</span><strong>{electronics.length}</strong></div>
          <div><span>{tr('Peso elettronica', 'Electronics weight')}</span><strong>{fmt(totalMass, 'mass', u)}</strong></div>
          <div><span>{tr('Consumo', 'Power draw')}</span><strong>{Math.round(power.currentMa)} mA</strong></div>
          <div><span>{tr('Autonomia', 'Runtime')}</span><strong>{power.runtimeHours === null ? '—' : power.runtimeHours >= 2 ? `${power.runtimeHours.toFixed(1)} h` : `${Math.round(power.runtimeHours * 60)} min`}</strong></div>
        </div>
        <div className="row">
          <button className="primary" onClick={() => update('kit', (p) => {
            for (const id of EXAMPLE_KIT) {
              const item = ELECTRONICS.find((e) => e.id === id)!;
              if (!p.components.some((c) => c.catalogId === id)) addPart(p, item);
            }
          })}><Icon name="sparkles" size={16} /> {tr('Kit consigliato', 'Recommended kit')}</button>
          {electronics.length > 0 && (
            <button className="ghost danger" onClick={() => update('kit.clear', (p) => removeParts(p, isCatalogPart))}>
              <Icon name="trash" size={16} /> {tr('Togli tutto', 'Remove all')}
            </button>
          )}
        </div>
      </div>

      {CATEGORIES.map((cat) => (
        <CategoryCard key={cat.role} cat={cat} />
      ))}

      {tips.length > 0 && (
        <Card icon="info" title={tr('Consigli per la tua elettronica', 'Tips for your electronics')}>
          <CheckList checks={tips} />
        </Card>
      )}

      <StepFooter current="electronics" />
    </div>
  );
}

function CategoryCard({ cat }: { cat: Category }) {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const u = useUnits();
  const items = ELECTRONICS.filter((e) => e.role === cat.role);
  const installed = project.components.filter((c) => c.role === cat.role && isCatalogPart(c));

  return (
    <Card icon={cat.icon} title={txt(cat.title)} subtitle={txt(cat.intro)}>
      <div className="tiles">
        {items.map((item) => {
          const on = installed.some((c) => c.catalogId === item.id);
          return (
            <button key={item.id} className={`tile ${on ? 'on' : ''}`} aria-pressed={on}
              onClick={() => update(`part.${item.id}`, (p) => {
                if (on) removeParts(p, (c) => c.catalogId === item.id);
                else addPart(p, item);
              })}>
              <span className="tile-head">
                <span className="tile-name">{txt(item.name)}</span>
                <span className="tile-check" aria-hidden>{on && <Icon name="check" size={14} />}</span>
              </span>
              <span className="tile-summary">{txt(item.summary)}</span>
              <span className="tile-specs">
                {item.recommended && <span className="badge badge-accent">{tr('consigliato', 'recommended')}</span>}
                {item.specs.map((s) => <span key={s.it} className="badge">{txt(s)}</span>)}
              </span>
              <span className="tile-foot">
                <span>{fmt(item.mass, 'mass', u)}</span>
                {item.currentMa > 0 && <span>{item.currentMa} mA</span>}
                {item.capacityMah && <span>{item.capacityMah} mAh</span>}
              </span>
            </button>
          );
        })}
      </div>
      {installed.map((c) => <InstalledPart key={c.id} c={c} />)}
    </Card>
  );
}

function InstalledPart({ c }: { c: MassComponent }) {
  const g = useStore((s) => s.project.geometry);
  const update = useStore((s) => s.update);
  const a = useAnalysis();
  const u = useUnits();
  const item = getCatalogItem(c.catalogId)!;
  const set = (key: string, fn: (t: MassComponent) => void) => update(`${c.id}.${key}`, (p) => { fn(p.components.find((x) => x.id === c.id)!); });
  const zones: { id: Zone; label: string }[] = [{ id: 'nose', label: tr('Nell\'ogiva', 'In the nose cone') }, { id: 'bay', label: tr('Sotto l\'ogiva', 'Below the nose cone') }];
  const at = (z: Zone) => Math.abs(zonePosition(z, g, a.derived) - c.cgX) < 1e-6;
  const L = a.derived.totalLength;

  return (
    <div className="installed">
      <div className="installed-title">
        <Icon name="check" size={14} /> <strong>{txt(item.name)}</strong>
        {c.source === 'measured' ? <span className="badge badge-measured">{tr('pesato', 'weighed')}</span> : <span className="badge badge-estimated">{tr('peso stimato', 'estimated weight')}</span>}
      </div>
      {item.caveat && <p className="caveat"><Icon name="info" size={14} /> {txt(item.caveat)}</p>}
      <div className="installed-grid">
        <div className="field">
          <span className="label-like">{tr('Posizione', 'Position')}</span>
          <div className="segmented">
            {zones.map((z) => (
              <button key={z.id} type="button" className={at(z.id) ? 'on' : ''}
                onClick={() => set('cg', (t) => { t.cgX = zonePosition(z.id, g, a.derived); })}>{z.label}</button>
            ))}
          </div>
          <input type="range" min={0} max={L} step={0.001} value={Math.min(c.cgX, L)} aria-label={tr('Posizione dalla punta', 'Position from the tip')}
            onChange={(e) => set('cg', (t) => { t.cgX = Number(e.target.value); })} />
          <div className="field-hint">{tr(`${fmt(c.cgX, 'length', u)} dalla punta`, `${fmt(c.cgX, 'length', u)} from the tip`)}</div>
        </div>
        <NumberField label={tr('Peso reale', 'Real weight')} dim="mass" value={c.source === 'measured' ? c.mass : null} rule={RULES.positive}
          placeholder={tr(`stimato ${fmt(c.mass, 'mass', u)}`, `estimated ${fmt(c.mass, 'mass', u)}`)} field={`components.${c.id}.mass`} hint={tr('Pesalo con una bilancia da cucina', 'Weigh it on a kitchen scale')}
          onClear={() => set('mass', (t) => { t.mass = item.mass; t.source = 'estimated'; t.massUncertainty = Math.max(0.001, item.mass * 0.2); })}
          onChange={(v) => set('mass', (t) => { t.mass = v; t.source = 'measured'; t.massUncertainty = 0.0005; })} />
      </div>
    </div>
  );
}
