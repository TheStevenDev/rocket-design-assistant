import type { Project } from '../core/types';
import { importProject, exportProject } from './projectIO';

// Projects are kept in this browser's localStorage. Every access is guarded:
// storage can be unavailable (private mode, blocked site data, quota).

const INDEX_KEY = 'rda.projects.v1';
const LAST_KEY = 'rda.lastProject.v1';
const projectKey = (id: string) => `rda.project.v1.${id}`;

export interface StoredProjectInfo {
  id: string;
  name: string;
  updatedAt: string;
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
function remove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function listProjects(): StoredProjectInfo[] {
  try {
    const list = JSON.parse(read(INDEX_KEY) ?? '[]') as StoredProjectInfo[];
    return Array.isArray(list) ? list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  } catch {
    return [];
  }
}

export function saveProject(p: Project): boolean {
  const ok = write(projectKey(p.meta.id), exportProject(p));
  if (!ok) return false;
  const list = listProjects().filter((x) => x.id !== p.meta.id);
  list.push({ id: p.meta.id, name: p.meta.name, updatedAt: p.meta.updatedAt });
  write(LAST_KEY, p.meta.id);
  return write(INDEX_KEY, JSON.stringify(list));
}

export function loadProject(id: string): Project | null {
  const text = read(projectKey(id));
  if (!text) return null;
  const r = importProject(text);
  if (!r.ok) return null;
  // importProject assigns a fresh id to avoid collisions; keep the stored one here.
  r.project.meta.id = id;
  return r.project;
}

export function deleteProject(id: string) {
  remove(projectKey(id));
  write(INDEX_KEY, JSON.stringify(listProjects().filter((x) => x.id !== id)));
}

export function lastProjectId(): string | null {
  return read(LAST_KEY);
}
