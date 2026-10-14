import { describe, expect, it } from 'vitest';
import { chuteDiameterFor, descentRate, powerBudget } from '../core/catalog';
import { catalogComponent, defaultProject, templateProject, type TemplateId } from '../core/defaults';
import { ELECTRONICS } from '../core/catalog';
import { setLang } from '../core/i18n';
import { analyzeProject } from './analyzeProject';
import { flightChecks } from './flightChecks';

const status = (p: ReturnType<typeof defaultProject>, id: string) =>
  flightChecks(p, analyzeProject(p, { sensitivity: false })).checks.find((c) => c.id === id)?.status;

describe('templates', () => {
  it.each(['small', 'medium', 'large'] as TemplateId[])('%s template is valid, stable, and passes the beginner checks', (id) => {
    const p = templateProject(id);
    const a = analyzeProject(p, { sensitivity: false });
    expect(a.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const f = flightChecks(p, a);
    for (const c of ['stability', 'motor', 'chute']) expect(f.checks.find((x) => x.id === c)?.status).toBe('ok');
  });
  it('example project with electronics is stable and powered', () => {
    const p = defaultProject();
    expect(status(p, 'stability')).toBe('ok');
    expect(status(p, 'power')).toBe('ok');
    expect(status(p, 'gps')).toBe('ok');
  });
});

describe('beginner checks', () => {
  it('descent rate and recommended chute are consistent', () => {
    expect(descentRate(0.6, chuteDiameterFor(0.6, 5))).toBeCloseTo(5, 8);
  });
  it('sums the power budget from catalog items', () => {
    const p = defaultProject();
    const b = powerBudget(p.components);
    expect(b.capacityMah).toBe(1000);
    expect(b.runtimeHours).toBeCloseTo(800 / b.currentMa, 8);
  });
  it('flags a GPS inside a carbon nose cone', () => {
    const p = defaultProject();
    p.geometry.nose.materialId = 'cfrp';
    expect(status(p, 'gps')).toBe('bad');
  });
  it('flags electronics without a battery', () => {
    const p = defaultProject();
    p.components = p.components.filter((c) => c.role !== 'battery');
    expect(status(p, 'power')).toBe('bad');
  });
  it('warns about the 8 g orientation sensor used alone', () => {
    const p = defaultProject();
    p.components = p.components.filter((c) => c.role !== 'sensor');
    p.components.push(catalogComponent(ELECTRONICS.find((e) => e.id === 'imu-bno085')!, 0.25));
    expect(status(p, 'imu')).toBe('warn');
  });
  it('flags a missing parachute and low thrust', () => {
    const p = defaultProject();
    p.components = p.components.filter((c) => c.role !== 'recovery');
    p.components.find((c) => c.kind === 'motor')!.avgThrust = 10;
    expect(status(p, 'chute')).toBe('bad');
    expect(status(p, 'motor')).toBe('bad');
  });
});

describe('language', () => {
  it('produces the same checks in English and Italian', () => {
    const p = defaultProject();
    const run = () => flightChecks(p, analyzeProject(p, { sensitivity: false })).checks;
    const en = run();
    setLang('it');
    try {
      const it_ = run();
      expect(en.map((c) => [c.id, c.status])).toEqual(it_.map((c) => [c.id, c.status]));
      expect(en.find((c) => c.id === 'stability')?.title).toBe('Stability');
      expect(en.find((c) => c.id === 'chute')?.text).toContain('Descent at about');
      expect(it_.find((c) => c.id === 'stability')?.title).toBe('Stabilità');
    } finally {
      setLang('en');
    }
  });
});
