import type { ReactNode } from 'react';
import { tr, txt, type Text } from '../core/i18n';
import { useStore, type Tab } from '../state/store';
import { Icon, type IconName } from './icons';

export interface StepDef { id: Tab; label: Text; hint: Text; icon: IconName }

export const STEPS: StepDef[] = [
  { id: 'shape', label: { it: 'Forma', en: 'Shape' }, hint: { it: 'Corpo, ogiva e pinne', en: 'Body, nose cone and fins' }, icon: 'rocket' },
  { id: 'electronics', label: { it: 'Elettronica', en: 'Electronics' }, hint: { it: 'GPS, sensori, camera', en: 'GPS, sensors, camera' }, icon: 'computer' },
  { id: 'motor', label: { it: 'Motore e paracadute', en: 'Motor and parachute' }, hint: { it: 'Spinta e recupero', en: 'Thrust and recovery' }, icon: 'flame' },
  { id: 'check', label: { it: 'Verifica', en: 'Check' }, hint: { it: 'È pronto per volare?', en: 'Is it ready to fly?' }, icon: 'checkCircle' },
];

export const EXPERT_TABS: StepDef[] = [
  { id: 'mass', label: { it: 'Masse in dettaglio', en: 'Mass details' }, hint: { it: 'Pesi, incertezze', en: 'Weights, uncertainties' }, icon: 'weight' },
  { id: 'stability', label: { it: 'Stabilità in dettaglio', en: 'Stability details' }, hint: { it: 'Barrowman, sensibilità', en: 'Barrowman, sensitivity' }, icon: 'chart' },
  { id: 'fins', label: { it: 'Pinne e struttura', en: 'Fins and structure' }, hint: { it: 'Materiali, flutter', en: 'Materials, flutter' }, icon: 'fin' },
];

/** Back / next buttons at the bottom of a guided step. */
export function StepFooter({ current }: { current: Tab }) {
  const setTab = useStore((s) => s.setTab);
  const i = STEPS.findIndex((s) => s.id === current);
  const prev = STEPS[i - 1];
  const next = STEPS[i + 1];
  const go = (t: Tab) => { setTab(t); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return (
    <div className="step-footer">
      {prev ? <button className="ghost" onClick={() => go(prev.id)}><Icon name="arrowLeft" size={16} /> {txt(prev.label)}</button> : <span />}
      {next && <button className="primary" onClick={() => go(next.id)}>{tr('Avanti', 'Next')}: {txt(next.label)} <Icon name="arrowRight" size={16} /></button>}
    </div>
  );
}

export function StepIntro({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <header className="step-intro">
      <span className="step-kicker">{tr(`Passo ${step} di ${STEPS.length}`, `Step ${step} of ${STEPS.length}`)}</span>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}
