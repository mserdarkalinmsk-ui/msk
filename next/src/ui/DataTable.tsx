import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

export interface Column<T> {
  key: string;
  label: string;
  width: number;
  value: (r: T) => string | number | null;
  render?: (r: T) => ComponentChildren;
  align?: 'r';
  sum?: boolean;
  format?: (v: number) => string;
  pin?: boolean;
  edit?: { type: 'text' | 'number' | 'select'; options?: string[]; commit: (r: T, v: string) => void };
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  groupBy?: { label: string; key: (r: T) => string }[];
  onOpen?: (r: T) => void;
  actions?: (selected: T[], clear: () => void) => ComponentChildren;
  maxHeight?: number;
  title?: string;
  storageKey?: string;
}

const ROW = 42, OVERSCAN = 8;
type Item<T> = { kind: 'row'; r: T } | { kind: 'group'; label: string; rows: T[] };

function csvCell(v: unknown) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
export function downloadCSV<T>(name: string, cols: Column<T>[], rows: T[]) {
  const body = [cols.map((c) => csvCell(c.label)).join(','), ...rows.map((r) => cols.map((c) => csvCell(c.value(r))).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function loadWidths(k?: string): Record<string, number> { try { return k ? JSON.parse(localStorage.getItem(k) || '{}') : {}; } catch { return {}; } }

/** Virtualised grid: sort, filter, resize, pinned first column, grouping with subtotals, selection, inline edit, CSV export. */
export function DataTable<T>({ rows, columns, rowKey, groupBy, onOpen, actions, maxHeight = 520, title = 'table', storageKey }: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [widths, setWidths] = useState<Record<string, number>>(() => loadWidths(storageKey));
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(maxHeight);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { try { storageKey && localStorage.setItem(storageKey, JSON.stringify(widths)); } catch { /* ignore */ } }, [widths]);
  useEffect(() => {
    const el = box.current!; const ro = new ResizeObserver(() => setViewH(el.clientHeight)); ro.observe(el); return () => ro.disconnect();
  }, []);

  const view = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let R = qq ? rows.filter((r) => columns.some((c) => String(c.value(r) ?? '').toLowerCase().includes(qq))) : rows.slice();
    if (sort) {
      const c = columns.find((x) => x.key === sort.key)!;
      R.sort((a, b) => {
        const x = c.value(a), y = c.value(b);
        if (x == null) return 1; if (y == null) return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return R;
  }, [rows, columns, q, sort]);

  const items: Item<T>[] = useMemo(() => {
    const g = groupBy?.find((x) => x.label === group);
    if (!g) return view.map((r) => ({ kind: 'row' as const, r }));
    const m = new Map<string, T[]>();
    view.forEach((r) => { const k = g.key(r) || '—'; m.set(k, [...(m.get(k) ?? []), r]); });
    return [...m].flatMap(([label, rs]) => [{ kind: 'group' as const, label, rows: rs }, ...rs.map((r) => ({ kind: 'row' as const, r }))]);
  }, [view, group]);

  const cols = columns.map((c) => ({ ...c, w: widths[c.key] ?? c.width }));
  const template = `40px ${cols.map((c) => c.w + 'px').join(' ')}`;
  const hasSum = columns.some((c) => c.sum);
  const start = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const end = Math.min(items.length, Math.ceil((scrollTop + viewH) / ROW) + OVERSCAN);
  const selRows = view.filter((r) => sel.has(rowKey(r)));
  const allSel = view.length > 0 && selRows.length === view.length;

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sumOf = (rs: T[], c: Column<T>) => rs.reduce((s, r) => s + (Number(c.value(r)) || 0), 0);

  function startResize(e: PointerEvent, key: string, w0: number) {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, t = e.currentTarget as HTMLElement; t.classList.add('on');
    const mv = (ev: PointerEvent) => setWidths((w) => ({ ...w, [key]: Math.max(60, w0 + ev.clientX - x0) }));
    const up = () => { t.classList.remove('on'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  const cell = (c: (typeof cols)[number], r: T) => {
    const id = rowKey(r);
    if (editing && editing.id === id && editing.key === c.key && c.edit) {
      const done = (v: string | null) => { setEditing(null); if (v != null && v !== String(c.value(r) ?? '')) c.edit!.commit(r, v); };
      const common = {
        class: 'dt-edit', autoFocus: true,
        onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter') done((e.target as HTMLInputElement).value); if (e.key === 'Escape') done(null); },
        onBlur: (e: FocusEvent) => done((e.target as HTMLInputElement).value),
      };
      return c.edit.type === 'select'
        ? <select {...common} value={String(c.value(r) ?? '')} onChange={(e) => done((e.target as HTMLSelectElement).value)}>{c.edit.options!.map((o) => <option>{o}</option>)}</select>
        : <input {...(common as any)} type={c.edit.type} value={String(c.value(r) ?? '')} />;
    }
    const content = c.render ? c.render(r) : c.format && typeof c.value(r) === 'number' ? c.format(c.value(r) as number) : c.value(r);
    return c.edit
      ? <span class="editable" title="Double-click to edit" onDblClick={(e) => { e.stopPropagation(); setEditing({ id, key: c.key }); }}>{content}</span>
      : content;
  };

  return (
    <div class="dt">
      <div class="dt-bar">
        <input type="search" placeholder="Filter rows…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Filter rows" />
        {groupBy && (
          <select class="select" value={group} onChange={(e) => setGroup((e.target as HTMLSelectElement).value)} aria-label="Group rows">
            <option value="">No grouping</option>
            {groupBy.map((g) => <option value={g.label}>Group by {g.label}</option>)}
          </select>
        )}
        <span class="grow" />
        {selRows.length > 0 && <span class="muted" style={{ fontSize: '12.5px' }}>{selRows.length} selected</span>}
        {actions?.(selRows, () => setSel(new Set()))}
        <button class="btn" onClick={() => downloadCSV(`${title}.csv`, columns, selRows.length ? selRows : view)}>
          Export {selRows.length ? 'selected' : 'CSV'}
        </button>
      </div>
      <div class="dt-scroll" ref={box} style={{ maxHeight: `${maxHeight}px` }} onScroll={(e) => setScrollTop((e.target as HTMLElement).scrollTop)}>
        <div class="dt-table" role="grid" aria-rowcount={items.length} style={{ gridTemplateColumns: template }}>
          <div class="dt-row dt-head" role="row">
            <div class="dt-cell pin" style={{ justifyContent: 'center' }}>
              <input type="checkbox" checked={allSel} aria-label="Select all" onChange={() => setSel(allSel ? new Set() : new Set(view.map(rowKey)))} />
            </div>
            {cols.map((c) => (
              <div class={`dt-cell ${c.align ?? ''} ${c.pin ? 'pin' : ''}`} style={c.pin ? { left: '40px' } : undefined} role="columnheader"
                aria-sort={sort?.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}
                onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}>
                {c.label}{sort?.key === c.key && <span aria-hidden="true">{sort.dir > 0 ? '↑' : '↓'}</span>}
                <span class="dt-resize" onPointerDown={(e) => startResize(e as PointerEvent, c.key, c.w)} onClick={(e) => e.stopPropagation()} />
              </div>
            ))}
          </div>
          {start > 0 && <div style={{ gridColumn: '1 / -1', height: `${start * ROW}px` }} />}
          {items.slice(start, end).map((it) =>
            it.kind === 'group' ? (
              <div class="dt-row dt-group" role="row" key={'g' + it.label}>
                <div class="dt-cell pin" />
                {cols.map((c, i) => (
                  <div class={`dt-cell ${c.align ?? ''} ${c.pin ? 'pin' : ''}`} style={c.pin ? { left: '40px' } : undefined}>
                    {i === 0 ? `${it.label} · ${it.rows.length}` : c.sum ? <span class="num">{(c.format ?? String)(sumOf(it.rows, c))}</span> : ''}
                  </div>
                ))}
              </div>
            ) : (
              <div class="dt-row" role="row" key={rowKey(it.r)} data-sel={sel.has(rowKey(it.r)) || undefined}
                onClick={() => onOpen?.(it.r)} style={{ cursor: onOpen ? 'pointer' : undefined }}>
                <div class="dt-cell pin" style={{ justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={sel.has(rowKey(it.r))} aria-label="Select row" onChange={() => toggle(rowKey(it.r))} />
                </div>
                {cols.map((c) => (
                  <div class={`dt-cell ${c.align ?? ''} ${c.pin ? 'pin' : ''} ${c.align ? 'num' : ''}`} style={c.pin ? { left: '40px' } : undefined} role="gridcell">
                    {cell(c, it.r)}
                  </div>
                ))}
              </div>
            ),
          )}
          {end < items.length && <div style={{ gridColumn: '1 / -1', height: `${(items.length - end) * ROW}px` }} />}
          {hasSum && view.length > 0 && (
            <div class="dt-row dt-total" role="row">
              <div class="dt-cell pin" />
              {cols.map((c, i) => (
                <div class={`dt-cell ${c.align ?? ''} ${c.pin ? 'pin' : ''}`} style={c.pin ? { left: '40px' } : undefined}>
                  {i === 0 ? `Total · ${view.length}` : c.sum ? <span class="num">{(c.format ?? String)(sumOf(view, c))}</span> : ''}
                </div>
              ))}
            </div>
          )}
        </div>
        {!view.length && <div class="dt-empty">No rows match “{q}”.</div>}
      </div>
    </div>
  );
}
