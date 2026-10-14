import { useDeferredValue, useEffect, useMemo, useState, type ComponentType } from 'react';
import { analyzeProject } from '../analysis/analyzeProject';
import { flightChecks } from '../analysis/flightChecks';
import { tr, txt } from '../core/i18n';
import { lastProjectId, loadProject, saveProject } from '../io/storage';
import { useStore, type Tab } from '../state/store';
import { CheckPanel } from './CheckPanel';
import { AnalysisContext } from './context';
import { DesignPanel } from './DesignPanel';
import { ElectronicsPanel } from './ElectronicsPanel';
import { FinsPanel } from './FinsPanel';
import { Icon } from './icons';
import { MassPanel } from './MassPanel';
import { MotorPanel } from './MotorPanel';
import { ProjectBar, type Notice } from './ProjectBar';
import { StabilityPanel } from './StabilityPanel';
import { EXPERT_TABS, STEPS, type StepDef } from './steps';
import { useApplyTheme } from './theme';
import { ViewerPanel } from './ViewerPanel';

const PANELS: Record<Tab, ComponentType> = {
  shape: DesignPanel, electronics: ElectronicsPanel, motor: MotorPanel, check: CheckPanel,
  mass: MassPanel, stability: StabilityPanel, fins: FinsPanel,
};

export function App() {
  const project = useStore((s) => s.project);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const expert = useStore((s) => s.expert);
  const lang = useStore((s) => s.lang);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'unavailable'>('saved');
  const [bigViewer, setBigViewer] = useState(false);
  useApplyTheme();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // Restore the last project once.
  useEffect(() => {
    const id = lastProjectId();
    const p = id ? loadProject(id) : null;
    if (p) useStore.getState().load(p);
  }, []);

  // Autosave (debounced).
  useEffect(() => {
    setSaveState('pending');
    const t = setTimeout(() => setSaveState(saveProject(project) ? 'saved' : 'unavailable'), 600);
    return () => clearTimeout(t);
  }, [project]);

  // Keyboard undo/redo outside text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); useStore.getState().undo(); }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); useStore.getState().redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The analysis (with Monte Carlo) runs on a deferred copy so typing stays responsive.
  // Sensitivity is only shown in expert mode, so skip it otherwise.
  // The result holds translated messages, so it is recomputed when the language changes.
  const deferred = useDeferredValue(project);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const analysis = useMemo(() => analyzeProject(deferred, { sensitivity: expert }), [deferred, expert, lang]);
  const stale = deferred !== project;

  // Worst check status per step, shown as a dot in the navigation.
  const stepStatus = useMemo(() => {
    const out: Partial<Record<Tab, 'bad' | 'warn'>> = {};
    for (const c of flightChecks(deferred, analysis).checks) {
      if (c.status === 'bad') out[c.step] = 'bad';
      else if (c.status === 'warn' && out[c.step] !== 'bad') out[c.step] = 'warn';
    }
    return out;
  }, [deferred, analysis]);

  const Panel = PANELS[tab];
  const navItem = (s: StepDef, i?: number) => (
    <button key={s.id} className={`nav-item ${tab === s.id ? 'active' : ''}`} aria-current={tab === s.id ? 'page' : undefined}
      onClick={() => { setTab(s.id); setBigViewer(false); }}>
      <span className="nav-icon">{i !== undefined ? <span className="nav-num">{i + 1}</span> : <Icon name={s.icon} size={16} />}</span>
      <span className="nav-text">
        <span className="nav-label">{txt(s.label)}</span>
        <span className="nav-hint">{txt(s.hint)}</span>
      </span>
      {stepStatus[s.id] && <span className={`nav-dot nav-dot-${stepStatus[s.id]}`} aria-label={stepStatus[s.id] === 'bad' ? tr('problemi', 'problems') : tr('avvisi', 'warnings')} />}
    </button>
  );

  return (
    <AnalysisContext.Provider value={analysis}>
      <div className="app">
        <ProjectBar saveState={saveState} onNotice={setNotice} />
        <div className={`shell ${bigViewer ? 'shell-viewer' : ''}`}>
          <nav className="sidebar" aria-label={tr('Passi', 'Steps')}>
            <div className="nav-group">{STEPS.map((s, i) => navItem(s, i))}</div>
            {expert && (
              <div className="nav-group">
                <div className="nav-caption"><Icon name="wrench" size={14} /> {tr('Esperto', 'Expert')}</div>
                {EXPERT_TABS.map((s) => navItem(s))}
              </div>
            )}
          </nav>
          <main className={`content ${stale ? 'stale' : ''}`}>
            {notice && (
              <div className={`callout callout-${notice.kind} notice`}>
                {notice.lines.map((l, i) => <div key={i}>{l}</div>)}
                <button className="ghost" onClick={() => setNotice(null)}>{tr('Chiudi', 'Close')}</button>
              </div>
            )}
            <Panel />
          </main>
          <aside className="side">
            <ViewerPanel large={bigViewer} onToggleLarge={() => setBigViewer(!bigViewer)} />
          </aside>
        </div>
        <footer className="footer muted small">
          Rocket Design Assistant · {tr('stime semplificate per la progettazione preliminare, non una certificazione di volo.', 'simplified estimates for preliminary design, not a flight certification.')}
        </footer>
      </div>
    </AnalysisContext.Provider>
  );
}
