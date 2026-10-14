import { useMemo, useRef, useState, type ReactNode } from 'react';
import { tr } from '../core/i18n';
import type { RocketGeometry } from '../core/types';
import { sampleNoseProfile } from '../geometry/noseProfile';
import type { DerivedGeometry } from '../geometry/rocketGeometry';
import type { MassItem } from '../mass/massProperties';
import type { TornadoEntry, MonteCarloSummary } from '../physics/sensitivity';
import { sourceLabel } from './fields';

// ---------------------------------------------------------------------------
// Side view of the rocket with CG/CP markers and, optionally, mass items.

interface SideViewProps {
  geometry: RocketGeometry;
  derived: DerivedGeometry;
  cgX: number;
  cpX: number;
  items?: MassItem[];
  formatLength: (v: number) => string;
  formatMass?: (v: number) => string;
  /** Extra CG positions (e.g. other configurations), drawn as thin ticks. */
  extraCg?: { x: number; label: string }[];
}

export function RocketSideView({ geometry: g, derived: d, cgX, cpX, items, formatLength, formatMass, extraCg = [] }: SideViewProps) {
  const [hover, setHover] = useState<MassItem | null>(null);
  const W = 800;
  const L = d.totalLength;
  const tip = Math.max(d.fins.tipRadius, d.bodyRadius);
  const pad = 24;
  const sx = (W - 2 * pad) / Math.max(L, 1e-6);
  // Keep the true aspect ratio but never let a stubby rocket get too tall.
  const sy = Math.min(sx, 70 / Math.max(tip, 1e-6));
  const top = 34;
  const cy = top + tip * sy;
  const H = cy + tip * sy + (items ? 54 : 30);
  const X = (x: number) => pad + x * sx;
  const Y = (r: number) => cy - r * sy;

  const outline = useMemo(() => {
    const R = d.bodyRadius;
    const nose = sampleNoseProfile(g.nose.shape, g.nose.length, R, g.nose.shapeParameter, 48);
    const upper = nose.map((p) => `${X(p.x)},${Y(p.r)}`).join(' ');
    const lower = [...nose].reverse().map((p) => `${X(p.x)},${Y(-p.r)}`).join(' ');
    return `${upper} ${X(d.bodyEndX)},${Y(R)} ${X(d.bodyEndX)},${Y(-R)} ${lower}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, d, sx, sy]);

  const fin = (sign: 1 | -1) => {
    const R = d.bodyRadius, f = g.fins, x0 = d.fins.rootLeadingEdgeX;
    return [
      [x0, R], [x0 + f.rootChord, R], [x0 + f.sweepLength + f.tipChord, R + f.span], [x0 + f.sweepLength, R + f.span],
    ].map(([x, r]) => `${X(x)},${Y(sign * r)}`).join(' ');
  };

  const maxMass = items ? Math.max(...items.map((i) => i.mass), 1e-9) : 1;
  const marker = (x: number, cls: string, label: string, above: boolean) => Number.isFinite(x) && (
    <g className={cls}>
      <line x1={X(x)} x2={X(x)} y1={above ? top - 14 : cy} y2={above ? cy : cy + tip * sy + 14} className="marker-line" />
      <circle cx={X(x)} cy={cy} r={6} className="marker-dot" />
      <text x={X(x)} y={above ? top - 18 : cy + tip * sy + 26} textAnchor="middle" className="marker-label">{label}</text>
    </g>
  );

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="side-view" role="img" aria-label={tr('Vista laterale del razzo con CG e CP', 'Side view of the rocket with CG and CP')}>
        <line x1={pad} x2={W - pad} y1={cy} y2={cy} className="axis-line" strokeDasharray="4 4" />
        {g.fins.count > 0 && <><polygon points={fin(1)} className="sv-fin" /><polygon points={fin(-1)} className="sv-fin" /></>}
        <polygon points={outline} className="sv-body" />
        <line x1={X(d.bodyStartX)} x2={X(d.bodyStartX)} y1={Y(d.bodyRadius)} y2={Y(-d.bodyRadius)} className="sv-joint" />
        {items?.map((it) => {
          const r = 3 + 11 * Math.sqrt(it.mass / maxMass);
          return (
            <g key={it.id} onMouseEnter={() => setHover(it)} onMouseLeave={() => setHover(null)} className="sv-item">
              {it.endX > it.startX && <line x1={X(it.startX)} x2={X(it.endX)} y1={cy} y2={cy} className={`sv-extent sv-${it.group}`} />}
              <circle cx={X(it.cgX)} cy={cy} r={r} className={`sv-mass sv-${it.group} src-${it.source}`} />
              <circle cx={X(it.cgX)} cy={cy} r={Math.max(r, 12)} fill="transparent" />
            </g>
          );
        })}
        {extraCg.map((e) => Number.isFinite(e.x) && (
          <g key={e.label} className="mk-cg-extra">
            <line x1={X(e.x)} x2={X(e.x)} y1={Y(d.bodyRadius) - 6} y2={Y(-d.bodyRadius) + 6} />
            <title>{`${e.label}: CG ${formatLength(e.x)}`}</title>
          </g>
        ))}
        {marker(cgX, 'mk-cg', `CG ${formatLength(cgX)}`, true)}
        {marker(cpX, 'mk-cp', `CP ${formatLength(cpX)}`, false)}
        <text x={pad} y={H - 6} className="tick-label">{tr('0 (punta)', '0 (tip)')}</text>
        <text x={W - pad} y={H - 6} textAnchor="end" className="tick-label">{formatLength(L)}</text>
      </svg>
      {hover && formatMass && (
        <div className="tooltip-static">
          <strong>{hover.name}</strong> · {formatMass(hover.mass)} {tr('a', 'at')} {formatLength(hover.cgX)} · {sourceLabel(hover.source)}
        </div>
      )}
      {items && (
        <div className="legend">
          <span><i className="lg lg-structure" /> {tr('struttura', 'structure')}</span>
          <span><i className="lg lg-component" /> {tr('componenti', 'components')}</span>
          <span><i className="lg lg-motor" /> {tr('motore', 'motor')}</span>
          <span><i className="lg lg-dashed" /> {tr('contorno tratteggiato = massa non misurata', 'dashed outline = mass not measured')}</span>
          <span><i className="lg lg-cg" /> CG</span>
          <span><i className="lg lg-cp" /> CP</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line chart with a reference band and crosshair tooltip.

interface LinePoint { x: number; y: number }

export function LineChart({ points, xLabel, yLabel, formatX, formatY, band, markers = [], invertX }: {
  points: LinePoint[];
  xLabel: string;
  yLabel: string;
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  band?: { y0: number; y1: number; label: string };
  markers?: { x: number; y: number; label: string }[];
  invertX?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [hi, setHi] = useState<number | null>(null);
  const W = 640, H = 240, l = 48, r = 16, t = 14, b = 40;
  const finite = points.filter((p) => Number.isFinite(p.y));
  if (finite.length < 2) return <p className="muted">{tr('Dati insufficienti per il grafico.', 'Not enough data for the chart.')}</p>;
  const xs = finite.map((p) => p.x);
  const ys = finite.map((p) => p.y).concat(band ? [band.y0, band.y1] : []).concat(markers.map((m) => m.y));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(0, ...ys), y1 = Math.max(...ys);
  const span = y1 - y0 || 1;
  y0 -= span * 0.05; y1 += span * 0.08;
  const X = (x: number) => { const f = (x - x0) / (x1 - x0 || 1); return l + (invertX ? 1 - f : f) * (W - l - r); };
  const Y = (y: number) => t + (1 - (y - y0) / (y1 - y0)) * (H - t - b);
  const ticks = niceTicks(y0, y1, 5);
  const path = finite.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');

  const onMove = (e: React.MouseEvent) => {
    const svg = ref.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    finite.forEach((p, i) => { const dd = Math.abs(X(p.x) - px); if (dd < bd) { bd = dd; best = i; } });
    setHi(best);
  };
  const h = hi !== null ? finite[hi] : null;

  return (
    <div className="chart-wrap">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="chart" onMouseMove={onMove} onMouseLeave={() => setHi(null)} role="img" aria-label={tr(`${yLabel} in funzione di ${xLabel}`, `${yLabel} versus ${xLabel}`)}>
        {band && (
          <g className="ref-band">
            <rect x={l} width={W - l - r} y={Y(Math.min(band.y1, y1))} height={Math.max(0, Y(Math.max(band.y0, y0)) - Y(Math.min(band.y1, y1)))} />
            <text x={(l + W - r) / 2} y={Y(Math.min(band.y1, y1)) + 12} textAnchor="middle" className="tick-label">{band.label}</text>
          </g>
        )}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={l} x2={W - r} y1={Y(v)} y2={Y(v)} className={v === 0 ? 'baseline' : 'gridline'} />
            <text x={l - 6} y={Y(v) + 4} textAnchor="end" className="tick-label">{formatY(v)}</text>
          </g>
        ))}
        <text x={l} y={H - 22} className="tick-label">{formatX(invertX ? x1 : x0)}</text>
        <text x={W - r} y={H - 22} textAnchor="end" className="tick-label">{formatX(invertX ? x0 : x1)}</text>
        <text x={(l + W - r) / 2} y={H - 4} textAnchor="middle" className="axis-title">{xLabel}</text>
        <path d={path} className="series-line" />
        {markers.map((m) => (
          <g key={m.label}>
            <circle cx={X(m.x)} cy={Y(m.y)} r={5} className="series-marker" />
            <text x={X(m.x) + (X(m.x) < (l + W - r) / 2 ? 8 : -8)} y={Y(m.y) + 18}
              textAnchor={X(m.x) < (l + W - r) / 2 ? 'start' : 'end'} className="point-label">{m.label}</text>
          </g>
        ))}
        {h && (
          <g>
            <line x1={X(h.x)} x2={X(h.x)} y1={t} y2={H - b} className="crosshair" />
            <circle cx={X(h.x)} cy={Y(h.y)} r={5} className="series-marker" />
          </g>
        )}
      </svg>
      <div className="chart-caption">{yLabel}</div>
      {h && <div className="tooltip-static">{xLabel}: <strong>{formatX(h.x)}</strong> · {yLabel}: <strong>{formatY(h.y)}</strong></div>}
    </div>
  );
}

function niceTicks(a: number, b: number, n: number): number[] {
  const span = b - a;
  if (!(span > 0)) return [a];
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-12; v += step) out.push(Math.round(v / step) * step);
  return out;
}

// ---------------------------------------------------------------------------
// Tornado chart: margin at −δ and +δ of each uncertain input.

export function TornadoChart({ entries, nominal, max = 10, describe }: {
  entries: TornadoEntry[]; nominal: number; max?: number; describe: (e: TornadoEntry) => string;
}) {
  const shown = entries.slice(0, max);
  if (shown.length === 0) return <p className="muted">{tr('Nessun parametro con incertezza indicata.', 'No parameter has an uncertainty set.')}</p>;
  const W = 640, rowH = 26, l = 200, r = 60, t = 20;
  const H = t + shown.length * rowH + 24;
  const ext = Math.max(...shown.flatMap((e) => [Math.abs(e.marginLow - nominal), Math.abs(e.marginHigh - nominal)]), 1e-6);
  const X = (m: number) => l + ((m - nominal) / ext * 0.5 + 0.5) * (W - l - r);
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={tr('Sensibilità del margine statico', 'Static margin sensitivity')}>
        <line x1={X(nominal)} x2={X(nominal)} y1={t - 8} y2={H - 20} className="baseline" />
        <text x={X(nominal)} y={t - 10} textAnchor="middle" className="tick-label">{tr('nominale', 'nominal')} {nominal.toFixed(2)} cal</text>
        {shown.map((e, i) => {
          const y = t + i * rowH + 4;
          const bar = (v: number, cls: string) => (
            <rect x={Math.min(X(v), X(nominal))} y={y} width={Math.max(1, Math.abs(X(v) - X(nominal)))} height={rowH - 8} rx={3} className={cls} />
          );
          return (
            <g key={e.id}>
              <title>{describe(e)}</title>
              <text x={l - 8} y={y + 13} textAnchor="end" className="row-label">{e.label.length > 30 ? e.label.slice(0, 29) + '…' : e.label}</text>
              {bar(e.marginLow, 'bar-dec')}
              {bar(e.marginHigh, 'bar-inc')}
              <text x={W - r + 6} y={y + 13} className="tick-label">±{(e.swing / 2).toFixed(3)}</text>
            </g>
          );
        })}
        <text x={X(nominal) - 4} y={H - 4} textAnchor="end" className="tick-label">{tr('← margine minore', '← lower margin')}</text>
        <text x={X(nominal) + 4} y={H - 4} className="tick-label">{tr('margine maggiore →', 'higher margin →')}</text>
      </svg>
      <div className="legend">
        <span><i className="lg lg-dec" /> {tr('parametro al valore minimo (−incertezza)', 'parameter at its minimum (−uncertainty)')}</span>
        <span><i className="lg lg-inc" /> {tr('parametro al valore massimo (+incertezza)', 'parameter at its maximum (+uncertainty)')}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Histogram({ mc, band }: { mc: MonteCarloSummary; band: { y0: number; y1: number } }) {
  const W = 640, H = 180, l = 16, r = 16, t = 16, b = 40;
  const maxC = Math.max(...mc.histogram.map((h) => h.count), 1);
  const x0 = mc.histogram[0].x0, x1 = mc.histogram[mc.histogram.length - 1].x1;
  const X = (v: number) => l + ((v - x0) / (x1 - x0 || 1)) * (W - l - r);
  const [hover, setHover] = useState<number | null>(null);
  const hb = hover !== null ? mc.histogram[hover] : null;
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={tr('Distribuzione Monte Carlo del margine statico', 'Monte Carlo distribution of the static margin')}>
        {band.y0 < x1 && band.y1 > x0 && (
          <rect x={X(Math.max(band.y0, x0))} width={X(Math.min(band.y1, x1)) - X(Math.max(band.y0, x0))} y={t} height={H - t - b} className="ref-band-rect" />
        )}
        {mc.histogram.map((h, i) => {
          const bh = (h.count / maxC) * (H - t - b);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={X(h.x0) + 1} width={Math.max(1, X(h.x1) - X(h.x0) - 2)} y={H - b - bh} height={bh} rx={3} className="bar-hist" />
              <rect x={X(h.x0)} width={X(h.x1) - X(h.x0)} y={t} height={H - t - b} fill="transparent" />
            </g>
          );
        })}
        <line x1={l} x2={W - r} y1={H - b} y2={H - b} className="baseline" />
        {[mc.p05, mc.p50, mc.p95].map((v, i) => (
          <g key={i}>
            <line x1={X(v)} x2={X(v)} y1={t} y2={H - b} className="crosshair" />
            <text x={X(v)} y={H - b + 14} textAnchor="middle" className="tick-label">{['P5', 'P50', 'P95'][i]} {v.toFixed(2)}</text>
          </g>
        ))}
        <text x={(l + W - r) / 2} y={H - 4} textAnchor="middle" className="axis-title">{tr('margine statico [cal]', 'static margin [cal]')}</text>
      </svg>
      {hb && <div className="tooltip-static">{hb.x0.toFixed(2)} – {hb.x1.toFixed(2)} cal: <strong>{hb.count}</strong> {tr('campioni su', 'samples of')} {mc.samples}</div>}
    </div>
  );
}

export function Meter({ value, children }: { value: number; children?: ReactNode }) {
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="meter-fill" style={{ width: `${Math.round(value * 100)}%` }} />
      {children}
    </div>
  );
}
