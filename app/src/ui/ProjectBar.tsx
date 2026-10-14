import { useEffect, useRef, useState } from 'react';
import { TEMPLATES, templateProject, type TemplateId } from '../core/defaults';
import { LANGS, locale, tr, txt } from '../core/i18n';
import { newId } from '../core/ids';
import type { LengthUnit, MassUnit } from '../core/types';
import { fmtNumber } from '../core/units';
import { exportFileName, exportProject, importProject } from '../io/projectIO';
import { deleteProject, listProjects, loadProject, saveProject, type StoredProjectInfo } from '../io/storage';
import { useStore, type Theme } from '../state/store';
import { useAnalysis } from './context';
import { Checkbox, Segmented } from './fields';
import { Icon, type IconName } from './icons';

export interface Notice { kind: 'info' | 'warning' | 'error'; lines: string[] }

const THEMES: { id: Theme; icon: IconName; label: () => string }[] = [
  { id: 'light', icon: 'sun', label: () => tr('Tema chiaro', 'Light theme') },
  { id: 'system', icon: 'monitor', label: () => tr('Come il sistema', 'Match system') },
  { id: 'dark', icon: 'moon', label: () => tr('Tema scuro', 'Dark theme') },
];

function StabilityPill() {
  const a = useAnalysis();
  const setTab = useStore((s) => s.setTab);
  const s = a.stability;
  const tone = s.marginClass === 'typical' ? 'ok' : s.marginClass === 'negative' || s.marginClass === 'unavailable' ? 'bad' : 'warn';
  const name = tr('Stabilità', 'Stability');
  const label = s.marginClass === 'unavailable' ? `${name}: —` : `${name} ${fmtNumber(s.margin, 2)} cal`;
  return (
    <button className={`pill pill-${tone}`} onClick={() => setTab('check')} title={tr('Vai alla verifica', 'Go to the check')}>
      <span className="pill-dot" /> {label}
    </button>
  );
}

export function ProjectBar({ saveState, onNotice }: { saveState: 'saved' | 'pending' | 'unavailable'; onNotice: (n: Notice | null) => void }) {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const load = useStore((s) => s.load);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const setUnits = useStore((s) => s.setUnits);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const expert = useStore((s) => s.expert);
  const setExpert = useStore((s) => s.setExpert);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const setTab = useStore((s) => s.setTab);
  const fileInput = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [openList, setOpenList] = useState<StoredProjectInfo[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StoredProjectInfo | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const switchTo = (p: typeof project) => { saveProject(project); load(p); onNotice(null); };
  const act = (fn: () => void) => () => { setMenu(false); fn(); };

  const doExport = () => {
    const text = exportProject(project);
    // Some embedded viewers block downloads: also show the JSON so it can be copied.
    setExportText(text);
    setCopied(false);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName(project);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const doImport = async (file: File) => {
    const r = importProject(await file.text());
    if (!r.ok) { onNotice({ kind: 'error', lines: [tr(`Importazione di "${file.name}" non riuscita:`, `Could not import "${file.name}":`), ...r.errors] }); return; }
    switchTo(r.project);
    onNotice({ kind: r.warnings.length ? 'warning' : 'info', lines: [tr(`Progetto "${r.project.meta.name}" importato.`, `Project "${r.project.meta.name}" imported.`), ...r.warnings] });
  };

  return (
    <header className="topbar">
      <div className="brand"><Icon name="rocket" size={20} /></div>
      <div className="title-block">
        <input className="project-name" value={project.meta.name} aria-label={tr('Nome del progetto', 'Project name')}
          onChange={(e) => update('meta.name', (p) => { p.meta.name = e.target.value; })} />
        <span className={`save-state ${saveState}`}>
          {saveState === 'saved' ? tr('Salvato', 'Saved') : saveState === 'pending' ? tr('Salvataggio…', 'Saving…') : tr('Salvataggio non disponibile', 'Saving unavailable')}
        </span>
      </div>

      <StabilityPill />

      <div className="toolbar">
        <button className="icon-btn" onClick={undo} disabled={!canUndo} title={tr('Annulla (Ctrl+Z)', 'Undo (Ctrl+Z)')} aria-label={tr('Annulla', 'Undo')}><Icon name="undo" /></button>
        <button className="icon-btn" onClick={redo} disabled={!canRedo} title={tr('Ripeti (Ctrl+Y)', 'Redo (Ctrl+Y)')} aria-label={tr('Ripeti', 'Redo')}><Icon name="redo" /></button>
        <div className="theme-switch lang-switch" role="radiogroup" aria-label={tr('Lingua', 'Language')}>
          {LANGS.map((l) => (
            <button key={l.id} role="radio" aria-checked={lang === l.id} className={lang === l.id ? 'on' : ''}
              title={l.name} aria-label={l.name} lang={l.id} onClick={() => setLang(l.id)}>{l.label}</button>
          ))}
        </div>
        <div className="theme-switch" role="radiogroup" aria-label={tr('Tema', 'Theme')}>
          {THEMES.map((t) => (
            <button key={t.id} role="radio" aria-checked={theme === t.id} className={theme === t.id ? 'on' : ''}
              title={t.label()} aria-label={t.label()} onClick={() => setTheme(t.id)}><Icon name={t.icon} size={16} /></button>
          ))}
        </div>
        <div className="menu-wrap" ref={menuRef}>
          <button className="icon-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} title={tr('Progetto e impostazioni', 'Project and settings')} aria-label="Menu">
            <Icon name="more" />
          </button>
          {menu && (
            <div className="menu" role="menu">
              <button role="menuitem" onClick={act(() => setNewOpen(true))}><Icon name="filePlus" size={16} /> {tr('Nuovo razzo…', 'New rocket…')}</button>
              <button role="menuitem" onClick={act(() => setOpenList(listProjects()))}><Icon name="folder" size={16} /> {tr('Apri…', 'Open…')}</button>
              <button role="menuitem" onClick={act(() => {
                const copy = structuredClone(project);
                const now = new Date().toISOString();
                copy.meta = { ...copy.meta, id: newId('prj'), name: `${project.meta.name} (${tr('copia', 'copy')})`, createdAt: now, updatedAt: now };
                switchTo(copy);
              })}><Icon name="copy" size={16} /> {tr('Duplica', 'Duplicate')}</button>
              <button role="menuitem" onClick={act(doExport)}><Icon name="download" size={16} /> {tr('Esporta file', 'Export file')}</button>
              <button role="menuitem" onClick={act(() => fileInput.current?.click())}><Icon name="upload" size={16} /> {tr('Importa file', 'Import file')}</button>
              <div className="menu-sep" />
              <div className="menu-group">
                <Segmented<LengthUnit> label={tr('Lunghezze', 'Lengths')} value={project.settings.lengthUnit}
                  options={[{ value: 'mm', label: 'mm' }, { value: 'cm', label: 'cm' }, { value: 'm', label: 'm' }]}
                  onChange={(v) => setUnits({ lengthUnit: v })} />
                <Segmented<MassUnit> label={tr('Masse', 'Masses')} value={project.settings.massUnit}
                  options={[{ value: 'g', label: 'g' }, { value: 'kg', label: 'kg' }]}
                  onChange={(v) => setUnits({ massUnit: v })} />
                <Checkbox label={tr('Modalità esperto (analisi dettagliate)', 'Expert mode (detailed analyses)')} checked={expert}
                  onChange={(v) => { setExpert(v); if (v) setTab('stability'); }} />
              </div>
            </div>
          )}
        </div>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ''; }} />
      </div>

      {newOpen && (
        <div className="modal-backdrop" onClick={() => setNewOpen(false)}>
          <div className="modal modal-wide" role="dialog" aria-label={tr('Nuovo razzo', 'New rocket')} onClick={(e) => e.stopPropagation()}>
            <h2>{tr('Nuovo razzo', 'New rocket')}</h2>
            <p className="muted">{tr('Scegli una taglia di partenza: potrai cambiare tutte le misure dopo. Il progetto attuale resta salvato.', 'Pick a starting size: you can change every measurement later. The current project stays saved.')}</p>
            <div className="tiles">
              {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
                <button key={id} className="tile" onClick={() => {
                  const size = txt(TEMPLATES[id].label).toLowerCase();
                  switchTo(templateProject(id, tr(`Razzo ${size}`, `${txt(TEMPLATES[id].label)} rocket`)));
                  setTab('shape');
                  setNewOpen(false);
                }}>
                  <span className="tile-head"><span className="tile-name">{txt(TEMPLATES[id].label)}</span></span>
                  <span className="tile-summary">{txt(TEMPLATES[id].description)}</span>
                </button>
              ))}
            </div>
            <div className="row"><button className="ghost" onClick={() => setNewOpen(false)}>{tr('Annulla', 'Cancel')}</button></div>
          </div>
        </div>
      )}

      {openList && (
        <div className="modal-backdrop" onClick={() => setOpenList(null)}>
          <div className="modal" role="dialog" aria-label={tr('Apri progetto', 'Open project')} onClick={(e) => e.stopPropagation()}>
            <h2>{tr('I tuoi razzi', 'Your rockets')}</h2>
            {openList.length === 0 && <p className="muted">{tr('Nessun progetto salvato.', 'No saved projects.')}</p>}
            <ul className="project-list">
              {openList.map((p) => (
                <li key={p.id} className={p.id === project.meta.id ? 'current' : ''}>
                  <button className="link" disabled={p.id === project.meta.id} onClick={() => {
                    const loaded = loadProject(p.id);
                    if (loaded) { switchTo(loaded); setOpenList(null); }
                    else onNotice({ kind: 'error', lines: [tr(`Impossibile leggere il progetto "${p.name}".`, `Could not read the project "${p.name}".`)] });
                  }}>{p.name}</button>
                  <span className="muted small">{new Date(p.updatedAt).toLocaleString(locale())}</span>
                  {p.id !== project.meta.id && (
                    pendingDelete?.id === p.id ? (
                      <span className="confirm">
                        {tr('Eliminare?', 'Delete?')}
                        <button className="danger" onClick={() => { deleteProject(p.id); setPendingDelete(null); setOpenList(listProjects()); }}>{tr('Elimina', 'Delete')}</button>
                        <button className="ghost" onClick={() => setPendingDelete(null)}>{tr('Annulla', 'Cancel')}</button>
                      </span>
                    ) : (
                      <button className="icon-btn danger" aria-label={tr(`Elimina ${p.name}`, `Delete ${p.name}`)} onClick={() => setPendingDelete(p)}><Icon name="trash" size={16} /></button>
                    )
                  )}
                </li>
              ))}
            </ul>
            <p className="muted small">{tr('I progetti restano solo in questo browser: usa Esporta per conservarne una copia o condividerli.', 'Projects are kept only in this browser: use Export to keep a copy or share them.')}</p>
            <div className="row"><button onClick={() => setOpenList(null)}>{tr('Chiudi', 'Close')}</button></div>
          </div>
        </div>
      )}

      {exportText !== null && (
        <div className="modal-backdrop" onClick={() => setExportText(null)}>
          <div className="modal" role="dialog" aria-label={tr('Esporta progetto', 'Export project')} onClick={(e) => e.stopPropagation()}>
            <h2>{tr('Esporta progetto', 'Export project')}</h2>
            <p className="muted small">
              {lang === 'en' ? (
                <>The file <strong>{exportFileName(project)}</strong> has been downloaded, if the browser allows it. Otherwise copy the text below
                  and save it in a .json file: it can be re-imported with Import. File units: metres and kilograms.</>
              ) : (
                <>Il file <strong>{exportFileName(project)}</strong> è stato scaricato, se il browser lo consente. In alternativa copia il testo qui sotto
                  e salvalo in un file .json: si reimporta con Importa. Unità del file: metri e chilogrammi.</>
              )}
            </p>
            <textarea id="export-json" readOnly rows={10} value={exportText} onFocus={(e) => e.target.select()} />
            <div className="row">
              <button className="primary" onClick={() => {
                navigator.clipboard?.writeText(exportText).then(() => setCopied(true), () => (document.getElementById('export-json') as HTMLTextAreaElement | null)?.select());
              }}>{copied ? tr('Copiato', 'Copied') : tr('Copia JSON', 'Copy JSON')}</button>
              <button className="ghost" onClick={() => setExportText(null)}>{tr('Chiudi', 'Close')}</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
