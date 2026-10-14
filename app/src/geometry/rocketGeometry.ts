import type { FinGeometry, RocketGeometry } from '../core/types';
import { integrateNose, type NoseIntegrals } from './noseProfile';

export interface DerivedFins {
  /** Planform area of a single fin. */
  area: number;
  totalArea: number;
  /** x of the root leading edge from the nose tip. */
  rootLeadingEdgeX: number;
  rootTrailingEdgeX: number;
  tipLeadingEdgeX: number;
  tipTrailingEdgeX: number;
  /** Aspect ratio of a pair of fins (2s)²/(2A). */
  aspectRatio: number;
  taperRatio: number;
  /** Mean aerodynamic chord and its spanwise position from the root. */
  mac: number;
  macSpanPosition: number;
  /** Length of the mid-chord line (Barrowman l_F). */
  midChordLength: number;
  /** Leading-edge sweep angle [rad]. */
  leadingEdgeSweep: number;
  thicknessRatio: number;
  /** Planform centroid x (chordwise, from nose tip). */
  centroidX: number;
  /** Planform centroid spanwise distance from the root. */
  centroidSpan: number;
  /** Fin tip radius from the axis (body radius + span). */
  tipRadius: number;
}

export interface DerivedGeometry {
  totalLength: number;
  bodyRadius: number;
  referenceDiameter: number;
  referenceArea: number;
  fineness: number;
  bodyStartX: number;
  bodyEndX: number;
  innerDiameter: number;
  nose: NoseIntegrals;
  fins: DerivedFins;
}

export function deriveFins(f: FinGeometry, bodyEndX: number, bodyRadius: number): DerivedFins {
  const { rootChord: cr, tipChord: ct, span: s, sweepLength: xs } = f;
  const area = ((cr + ct) / 2) * s;
  const rootTrailingEdgeX = bodyEndX - f.aftOffset;
  const rootLeadingEdgeX = rootTrailingEdgeX - cr;
  const tipLeadingEdgeX = rootLeadingEdgeX + xs;
  const sum = cr + ct;
  const taperRatio = cr > 0 ? ct / cr : 0;
  const mac = sum > 0 ? (2 / 3) * (cr * cr + cr * ct + ct * ct) / sum : 0;
  const macSpanPosition = sum > 0 ? (s / 3) * (cr + 2 * ct) / sum : 0;
  // Centroid of the trapezoid (chordwise from the root LE).
  const centroidChordwise = sum > 0 ? (xs * (cr + 2 * ct) + (cr * cr + cr * ct + ct * ct)) / (3 * sum) : 0;
  return {
    area,
    totalArea: area * f.count,
    rootLeadingEdgeX,
    rootTrailingEdgeX,
    tipLeadingEdgeX,
    tipTrailingEdgeX: tipLeadingEdgeX + ct,
    aspectRatio: area > 0 ? (2 * s) ** 2 / (2 * area) : 0,
    taperRatio,
    mac,
    macSpanPosition,
    midChordLength: Math.hypot(s, xs + ct / 2 - cr / 2),
    leadingEdgeSweep: Math.atan2(xs, s),
    thicknessRatio: mac > 0 ? f.thickness / mac : 0,
    centroidX: rootLeadingEdgeX + centroidChordwise,
    centroidSpan: macSpanPosition,
    tipRadius: bodyRadius + s,
  };
}

export function deriveGeometry(g: RocketGeometry): DerivedGeometry {
  const D = g.body.outerDiameter;
  const R = D / 2;
  const bodyStartX = g.nose.length;
  const bodyEndX = g.nose.length + g.body.length;
  return {
    totalLength: bodyEndX,
    bodyRadius: R,
    referenceDiameter: D,
    referenceArea: Math.PI * R * R,
    fineness: D > 0 ? bodyEndX / D : 0,
    bodyStartX,
    bodyEndX,
    innerDiameter: Math.max(0, D - 2 * g.body.wallThickness),
    nose: integrateNose(g.nose.shape, g.nose.length, R, g.nose.shapeParameter),
    fins: deriveFins(g.fins, bodyEndX, R),
  };
}
