import { useEffect, useId, useState, type ReactNode } from 'react';
import { tr } from '../core/i18n';
import { displayUnit, parseNumber, type Dimension } from '../core/units';
import type { Issue } from '../core/types';
import { checkNumber, type NumberRule } from '../validation/validate';
import { useAnalysis, useUnits } from './context';
import { Icon, type IconName } from './icons';

interface NumberFieldProps {
  label: string;
  /** SI value. */
  value: number | null;
  dim: Dimension;
  onChange: (si: number) => void;
  rule?: NumberRule;
  hint?: string;
  /** Project path, used to show cross-field issues from the analysis. */
  field?: string;
  /** Allows the empty value (onClear is called). */
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  badge?: ReactNode;
}

function round(v: number, decimals: number): string {
  const s = v.toFixed(decimals);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/**
 * Numeric input shown in the current display unit and stored in SI.
 * Validates while typing; only valid values are committed to the project.
 */
export function NumberField({ label, value, dim, onChange, rule = {}, hint, field, onClear, placeholder, disabled, badge }: NumberFieldProps) {
  const units = useUnits();
  const analysis = useAnalysis();
  const u = displayUnit(dim, units);
  const id = useId();
  const shown = value === null ? '' : round(value / u.factor, u.decimals + 3);
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);

  // Follow external changes (undo, unit switch, import) when not editing.
  useEffect(() => { if (!focused) setText(shown); }, [shown, focused]);

  const parsed = parseNumber(text);
  const si = parsed === null ? null : parsed * u.factor;
  const fmt = (v: number) => `${round(v / u.factor, u.decimals + 2)}${u.label ? ' ' + u.label : ''}`;
  const local = text === '' && onClear ? null : checkNumber(si, rule, fmt);
  const external: Issue | undefined = field ? analysis.issues.find((i) => i.field === field && i.severity !== 'info') : undefined;
  const shownIssue = local ?? (external ? { severity: external.severity, message: external.message } : null);

  return (
    <div className={`field ${shownIssue ? `has-${shownIssue.severity}` : ''}`}>
      <label htmlFor={id}>{label}{badge}</label>
      <div className="input-unit">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={shownIssue?.severity === 'error'}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setText(shown); }}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            if (t.trim() === '' && onClear) { onClear(); return; }
            const p = parseNumber(t);
            if (p === null) return;
            const v = p * u.factor;
            const c = checkNumber(v, rule);
            if (!c || c.severity !== 'error') onChange(v);
          }}
        />
        {u.label && <span className="unit">{u.label}</span>}
      </div>
      {shownIssue ? <div className={`field-msg ${shownIssue.severity}`}>{shownIssue.message}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange, hint }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function TextField({ label, value, onChange, hint, multiline, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; multiline?: boolean; placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="field field-wide">
      <label htmlFor={id}>{label}</label>
      {multiline
        ? <textarea id={id} value={value} rows={3} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function Checkbox({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="checkbox" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Card({ title, subtitle, children, actions, className = '', icon }: {
  title: string; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string; icon?: IconName;
}) {
  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        {icon && <span className="card-icon"><Icon name={icon} size={20} /></span>}
        <div className="card-titles">
          <h2>{title}</h2>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
        {actions && <div className="card-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function SourceBadge({ source }: { source: 'measured' | 'estimated' | 'computed' }) {
  const label = sourceLabel(source);
  return <span className={`badge badge-${source}`}>{label}</span>;
}

const ICONS = { error: 'xCircle', warning: 'alert', info: 'info' } as const satisfies Record<string, IconName>;
export function sourceLabel(source: 'measured' | 'estimated' | 'computed'): string {
  return { measured: tr('misurato', 'measured'), estimated: tr('stimato', 'estimated'), computed: tr('calcolato', 'computed') }[source];
}

const severityLabel = (s: Issue['severity']) => ({ error: tr('Errore', 'Error'), warning: tr('Avviso', 'Warning'), info: tr('Nota', 'Note') })[s];

export function IssueList({ issues, empty = tr('Nessun problema rilevato.', 'No problems found.') }: { issues: Issue[]; empty?: string }) {
  if (issues.length === 0) return <p className="muted">{empty}</p>;
  const order = { error: 0, warning: 1, info: 2 };
  return (
    <ul className="issues">
      {[...issues].sort((a, b) => order[a.severity] - order[b.severity]).map((i, k) => (
        <li key={k} className={`issue ${i.severity}`}>
          <Icon name={ICONS[i.severity]} size={16} className="issue-icon" />
          <span><strong>{severityLabel(i.severity)}:</strong> {i.message}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({ kind, title, children }: { kind: 'info' | 'warning' | 'error' | 'neutral'; title?: string; children: ReactNode }) {
  return (
    <div className={`callout callout-${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      {title && <strong className="callout-title">{kind !== 'neutral' && <Icon name={ICONS[kind]} size={16} />}{title}</strong>}
      <div>{children}</div>
    </div>
  );
}

/** Pill-shaped single choice, for short option lists. */
export function Segmented<T extends string | number>({ label, value, options, onChange, hint }: {
  label?: string; value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; hint?: string;
}) {
  return (
    <div className="field">
      {label && <span className="label-like">{label}</span>}
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} title={o.title}
            className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

/** Collapsible group for the fields a beginner can leave at their defaults. */
export function Advanced({ children, label = tr('Dettagli avanzati', 'Advanced details') }: { children: ReactNode; label?: string }) {
  return (
    <details className="advanced">
      <summary>{label}</summary>
      <div className="advanced-body">{children}</div>
    </details>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
