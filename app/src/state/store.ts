import { create } from 'zustand';
import { defaultProject } from '../core/defaults';
import { setLang as setI18nLang, tr, type Lang } from '../core/i18n';
import type { LengthUnit, MassUnit, Project } from '../core/types';

export type Tab = 'shape' | 'electronics' | 'motor' | 'check' | 'mass' | 'stability' | 'fins';
export type Theme = 'system' | 'light' | 'dark';

export interface ViewerToggles {
  nose: boolean;
  body: boolean;
  fins: boolean;
  components: boolean;
  cg: boolean;
  cp: boolean;
  dimensions: boolean;
  axes: boolean;
  transparent: boolean;
}

const HISTORY_LIMIT = 100;
/** Edits with the same key closer than this are merged into one undo step (typing). */
const COALESCE_MS = 1000;

const PREFS_KEY = 'rda.prefs';
interface Prefs { theme: Theme; expert: boolean; lang: Lang }

function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    return {
      theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'system',
      expert: p.expert === true,
      lang: p.lang === 'it' ? 'it' : 'en',
    };
  } catch {
    return { theme: 'system', expert: false, lang: 'en' };
  }
}

function writePrefs(p: Prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* preferences are a convenience */ }
}

interface State {
  project: Project;
  past: Project[];
  future: Project[];
  lastEdit: { key: string; at: number } | null;
  tab: Tab;
  toggles: ViewerToggles;
  /** Bumped to ask the viewer to re-frame the camera. */
  viewResetToken: number;
  theme: Theme;
  /** Shows the detailed engineering panels (masses, stability, fin structure). */
  expert: boolean;
  lang: Lang;

  update: (key: string, recipe: (draft: Project) => void) => void;
  undo: () => void;
  redo: () => void;
  load: (p: Project) => void;
  setUnits: (u: { lengthUnit?: LengthUnit; massUnit?: MassUnit }) => void;
  setTab: (t: Tab) => void;
  setToggle: (k: keyof ViewerToggles, v: boolean) => void;
  resetView: () => void;
  setTheme: (t: Theme) => void;
  setExpert: (v: boolean) => void;
  setLang: (l: Lang) => void;
}

const prefs = readPrefs();
// Before the default project is built, so its names use the chosen language.
setI18nLang(prefs.lang);

export const useStore = create<State>((set, get) => ({
  project: defaultProject(tr('Il mio primo razzo', 'My first rocket')),
  past: [],
  future: [],
  lastEdit: null,
  tab: 'shape',
  toggles: { nose: true, body: true, fins: true, components: true, cg: true, cp: true, dimensions: false, axes: false, transparent: true },
  viewResetToken: 0,
  theme: prefs.theme,
  expert: prefs.expert,
  lang: prefs.lang,

  update: (key, recipe) => {
    const { project, past, lastEdit } = get();
    const next = structuredClone(project);
    recipe(next);
    next.meta.updatedAt = new Date().toISOString();
    const now = Date.now();
    const coalesce = lastEdit !== null && lastEdit.key === key && now - lastEdit.at < COALESCE_MS && past.length > 0;
    set({
      project: next,
      past: coalesce ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
      lastEdit: { key, at: now },
    });
  },
  undo: () => {
    const { past, project, future } = get();
    if (past.length === 0) return;
    set({ project: { ...past[past.length - 1], settings: project.settings }, past: past.slice(0, -1), future: [project, ...future], lastEdit: null });
  },
  redo: () => {
    const { past, project, future } = get();
    if (future.length === 0) return;
    set({ project: { ...future[0], settings: project.settings }, past: [...past, project], future: future.slice(1), lastEdit: null });
  },
  load: (p) => set((s) => ({ project: p, past: [], future: [], lastEdit: null, viewResetToken: s.viewResetToken + 1 })),
  // Display preferences are part of the project but are not worth an undo step.
  setUnits: (u) => set((s) => ({ project: { ...s.project, settings: { ...s.project.settings, ...u } } })),
  setTab: (tab) => set({ tab }),
  setToggle: (k, v) => set((s) => ({ toggles: { ...s.toggles, [k]: v } })),
  resetView: () => set((s) => ({ viewResetToken: s.viewResetToken + 1 })),
  setTheme: (theme) => { set({ theme }); writePrefs({ theme, expert: get().expert, lang: get().lang }); },
  setExpert: (expert) => {
    const tab = get().tab;
    set({ expert, tab: !expert && (tab === 'mass' || tab === 'stability' || tab === 'fins') ? 'check' : tab });
    writePrefs({ theme: get().theme, expert, lang: get().lang });
  },
  setLang: (lang) => {
    // Module state first: the re-render triggered by set() must already see it.
    setI18nLang(lang);
    set({ lang });
    writePrefs({ theme: get().theme, expert: get().expert, lang });
  },
}));
