import { describe, expect, it } from 'vitest';
import { defaultProject } from '../core/defaults';
import { exportProject, importProject } from './projectIO';

describe('project import/export', () => {
  it('round-trips a project', () => {
    const p = defaultProject('Test');
    const r = importProject(exportProject(p));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.geometry).toEqual(p.geometry);
    expect(r.project.components).toEqual(p.components);
    expect(r.project.meta.id).not.toBe(p.meta.id);
  });
  it('converts declared millimetre/gram units to SI', () => {
    const p = defaultProject();
    const file = JSON.parse(exportProject(p));
    file.units = { length: 'mm', mass: 'g' };
    file.project.geometry.body.outerDiameter = 66;
    file.project.components[0].mass = 40;
    const r = importProject(JSON.stringify(file));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.geometry.body.outerDiameter).toBeCloseTo(0.066);
    expect(r.project.components[0].mass).toBeCloseTo(0.04);
    expect(r.warnings.length).toBe(1);
  });
  it('rejects unknown units', () => {
    const file = JSON.parse(exportProject(defaultProject()));
    file.units = { length: 'in', mass: 'kg' };
    const r = importProject(JSON.stringify(file));
    expect(r.ok).toBe(false);
  });
  it('reports schema errors with their path', () => {
    const file = JSON.parse(exportProject(defaultProject()));
    file.project.geometry.fins.count = 'quattro';
    const r = importProject(JSON.stringify(file));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toContain('geometry.fins.count');
  });
  it('rejects non-JSON', () => {
    expect(importProject('not json').ok).toBe(false);
  });
});
