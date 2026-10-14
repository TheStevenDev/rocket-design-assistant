import type { LengthUnit, MassUnit } from './types';

// Conversion factors from the display unit to SI.
export const LENGTH_FACTORS: Record<LengthUnit, number> = { mm: 1e-3, cm: 1e-2, m: 1 };
export const MASS_FACTORS: Record<MassUnit, number> = { g: 1e-3, kg: 1 };

export type Dimension = 'length' | 'mass' | 'density' | 'pressure' | 'speed' | 'altitude' | 'ratio' | 'count' | 'fraction' | 'force';

export interface UnitContext {
  lengthUnit: LengthUnit;
  massUnit: MassUnit;
}

export interface DisplayUnit {
  label: string;
  /** SI value = display value × factor. */
  factor: number;
  decimals: number;
}

export function displayUnit(dim: Dimension, ctx: UnitContext): DisplayUnit {
  switch (dim) {
    case 'length':
      return { label: ctx.lengthUnit, factor: LENGTH_FACTORS[ctx.lengthUnit], decimals: { mm: 1, cm: 2, m: 4 }[ctx.lengthUnit] };
    case 'mass':
      return { label: ctx.massUnit, factor: MASS_FACTORS[ctx.massUnit], decimals: ctx.massUnit === 'g' ? 1 : 4 };
    case 'density':
      return { label: 'kg/m³', factor: 1, decimals: 0 };
    case 'pressure':
      return { label: 'GPa', factor: 1e9, decimals: 2 };
    case 'speed':
      return { label: 'm/s', factor: 1, decimals: 0 };
    case 'altitude':
      return { label: 'm', factor: 1, decimals: 0 };
    case 'ratio':
      return { label: '', factor: 1, decimals: 2 };
    case 'count':
      return { label: '', factor: 1, decimals: 0 };
    case 'fraction':
      return { label: '%', factor: 0.01, decimals: 0 };
    case 'force':
      return { label: 'N', factor: 1, decimals: 1 };
  }
}

export function toDisplay(si: number, dim: Dimension, ctx: UnitContext): number {
  return si / displayUnit(dim, ctx).factor;
}

export function fromDisplay(value: number, dim: Dimension, ctx: UnitContext): number {
  return value * displayUnit(dim, ctx).factor;
}

/** Formats an SI value in the current display unit, e.g. "66.0 mm". */
export function fmt(si: number | null | undefined, dim: Dimension, ctx: UnitContext, decimals?: number): string {
  if (si === null || si === undefined || !Number.isFinite(si)) return '—';
  const u = displayUnit(dim, ctx);
  const v = (si / u.factor).toFixed(decimals ?? u.decimals);
  return u.label ? `${v} ${u.label}` : v;
}

export function fmtNumber(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(decimals);
}

/** Parses user text, accepting both "," and "." as decimal separator. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '' || t === '-' || t === '.') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}
