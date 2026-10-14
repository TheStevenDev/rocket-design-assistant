import { useEffect, useRef, useState } from 'react';
import { tr } from '../core/i18n';
import { fmt } from '../core/units';
import { useStore, type ViewerToggles } from '../state/store';
import { RocketViewer } from '../viewer/RocketViewer';
import { useAnalysis, useUnits } from './context';
import { Icon } from './icons';
import { useIsDark } from './theme';

const basicToggles = (): [keyof ViewerToggles, string][] => [
  ['components', tr('Interni', 'Internals')], ['transparent', tr('Trasparente', 'Transparent')], ['cg', 'CG'], ['cp', 'CP'], ['dimensions', tr('Quote', 'Dimensions')],
];
const expertToggles = (): [keyof ViewerToggles, string][] => [
  ['nose', tr('Ogiva', 'Nose')], ['body', tr('Corpo', 'Body')], ['fins', tr('Pinne', 'Fins')], ['axes', tr('Assi', 'Axes')],
];

export function ViewerPanel({ large = false, onToggleLarge }: { large?: boolean; onToggleLarge?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<RocketViewer | null>(null);
  const [failed, setFailed] = useState(false);
  const project = useStore((s) => s.project);
  const toggles = useStore((s) => s.toggles);
  const setToggle = useStore((s) => s.setToggle);
  const resetToken = useStore((s) => s.viewResetToken);
  const resetView = useStore((s) => s.resetView);
  const expert = useStore((s) => s.expert);
  const lang = useStore((s) => s.lang);
  const a = useAnalysis();
  const u = useUnits();
  const dark = useIsDark();

  useEffect(() => {
    if (!host.current) return;
    try {
      viewer.current = new RocketViewer(host.current);
    } catch {
      setFailed(true);
    }
    return () => { viewer.current?.dispose(); viewer.current = null; };
  }, []);

  useEffect(() => {
    viewer.current?.setData({
      geometry: project.geometry,
      derived: a.derived,
      components: project.components,
      cgX: a.stability.cgX,
      cpX: a.stability.cpX,
      toggles,
      formatLength: (v) => fmt(v, 'length', u),
      dark,
    });
  }, [project.geometry, project.components, a, toggles, u, dark, lang]);

  // Re-frame on explicit request or when the panel is resized, not on mount.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    // Wait one frame so the canvas has its new size.
    const id = requestAnimationFrame(() => viewer.current?.frameModel(a.derived.totalLength));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken, large]);

  const toggleList = expert ? [...basicToggles(), ...expertToggles()] : basicToggles();

  return (
    <div className={`viewer ${large ? 'viewer-large' : ''}`}>
      <div className="viewer-head">
        <span className="viewer-title">{tr('Anteprima 3D', '3D preview')}</span>
        <div className="viewer-actions">
          <button className="icon-btn" onClick={resetView} title={tr('Reimposta vista', 'Reset view')} aria-label={tr('Reimposta vista', 'Reset view')}><Icon name="undo" size={16} /></button>
          {onToggleLarge && (
            <button className="icon-btn" onClick={onToggleLarge} title={large ? tr('Riduci', 'Shrink') : tr('Ingrandisci', 'Enlarge')} aria-label={large ? tr('Riduci', 'Shrink') : tr('Ingrandisci', 'Enlarge')}>
              <Icon name={large ? 'shrink' : 'expand'} size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="viewer-canvas" ref={host}>
        {failed && <p className="muted">{tr('Il browser non supporta WebGL: anteprima 3D non disponibile.', 'This browser does not support WebGL: 3D preview unavailable.')}</p>}
      </div>
      <div className="viewer-toolbar">
        {toggleList.map(([k, label]) => (
          <button key={k} className={`chip ${toggles[k] ? 'on' : ''}`} aria-pressed={toggles[k]} onClick={() => setToggle(k, !toggles[k])}>{label}</button>
        ))}
      </div>
      <div className="viewer-help muted small">{tr('Trascina per ruotare · rotella per ingrandire · tasto destro per spostare', 'Drag to rotate · scroll to zoom · right-click to pan')}</div>
    </div>
  );
}
