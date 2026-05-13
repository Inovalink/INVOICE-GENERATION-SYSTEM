'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, Check, CheckSquare, Clock, Flag,
  GripVertical, Layers, Loader2, MessageSquare,
  MinusCircle, Plus, SearchCheck, Timer, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BoardStatus = string;

export type BoardColumn = {
  id: string;
  label: string;
  color: string;
  bg: string;
};

type Priority = 'NORMAL' | 'HIGH' | 'URGENT';
type DisplayPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type BoardTask = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string;
  priority: Priority;
  completed: boolean;
  createdAt?: string;
};

// ─── Column config ────────────────────────────────────────────────────────────

const COLOR_PRESETS: { color: string; bg: string }[] = [
  { color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  }, // indigo
  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  }, // purple
  { color: '#ec4899', bg: 'rgba(236,72,153,0.12)'  }, // pink
  { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   }, // cyan
  { color: '#14b8a6', bg: 'rgba(20,184,166,0.12)'  }, // teal
  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   }, // green
  { color: '#eab308', bg: 'rgba(234,179,8,0.12)'   }, // amber
  { color: '#f97316', bg: 'rgba(249,115,22,0.12)'  }, // orange
  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   }, // red
  { color: '#64748b', bg: 'rgba(100,116,139,0.12)' }, // slate
];

const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'TODO',           label: 'To Do',          color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  { id: 'IN_PROGRESS',    label: 'In Progress',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  { id: 'ON_HOLD',        label: 'On Hold',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  { id: 'REVIEWS_NEEDED', label: 'Reviews Needed', color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  { id: 'UNDER_REVIEW',   label: 'Under Review',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
];

// Icon assigned per default column ID; custom columns fall back to Layers
const COL_ICONS: Record<string, React.ReactNode> = {
  TODO:           <CheckSquare  size={13} strokeWidth={2}   />,
  IN_PROGRESS:    <Timer        size={13} strokeWidth={2}   />,
  ON_HOLD:        <MinusCircle  size={13} strokeWidth={1.8} />,
  REVIEWS_NEEDED: <MessageSquare size={13} strokeWidth={2}  />,
  UNDER_REVIEW:   <SearchCheck  size={13} strokeWidth={1.8} />,
};

function getColIcon(id: string): React.ReactNode {
  return COL_ICONS[id] ?? <Layers size={13} strokeWidth={2} />;
}

const COL_STORAGE = 'tb_columns_v1';

function loadColumns(): BoardColumn[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS;
  try {
    const raw = localStorage.getItem(COL_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as BoardColumn[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_COLUMNS;
}

const PRIO_OPTS: { key: DisplayPriority; label: string; color: string; db: Priority }[] = [
  { key: 'LOW',    label: 'Low',    color: '#16a34a', db: 'NORMAL' },
  { key: 'NORMAL', label: 'Normal', color: '#6366f1', db: 'NORMAL' },
  { key: 'HIGH',   label: 'High',   color: '#f97316', db: 'HIGH'   },
  { key: 'URGENT', label: 'Urgent', color: '#ef4444', db: 'URGENT' },
];

const PRIO_META: Record<Priority, { color: string; bg: string; label: string }> = {
  NORMAL: { color: '#6366f1', bg: 'rgba(99,102,241,0.10)',  label: 'Normal' },
  HIGH:   { color: '#f97316', bg: 'rgba(249,115,22,0.10)',  label: 'High'   },
  URGENT: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   label: 'Urgent' },
};

// ─── Task colour (mirrors TasksCalendar — same palette + same hash) ──────────

const TASK_PALETTE = [
  '#6366f1', '#f97316', '#14b8a6', '#ec4899', '#a855f7',
  '#22c55e', '#f59e0b', '#06b6d4', '#ef4444', '#3b82f6',
  '#10b981', '#8b5cf6', '#f43f5e', '#0ea5e9', '#84cc16',
];

function taskColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return TASK_PALETTE[Math.abs(hash) % TASK_PALETTE.length];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(iso: string): boolean {
  if (!iso) return false;
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  const taskDay = new Date(y, m - 1, d);
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  return taskDay < today;
}

function fmtDueDay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  const taskDay = new Date(y, m - 1, d); taskDay.setHours(0, 0, 0, 0);
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((taskDay.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 6)
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][taskDay.getDay()];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]}`;
}

function fmtTime(iso: string): string {
  if (!iso) return '';
  const timePart = iso.split('T')[1];
  if (!timePart) return '';
  const [h, min] = timePart.split(':').map(Number);
  if (isNaN(h)) return '';
  return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ─── Inline Add Form ──────────────────────────────────────────────────────────

function InlineForm({
  onSave,
  onCancel,
}: {
  onSave: (d: { title: string; notes: string | null; dueDate: string; time: string; priority: Priority }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title,   setTitle]   = useState('');
  const [notes,   setNotes]   = useState('');
  const [dueDate, setDueDate] = useState(todayStr);
  const [time,    setTime]    = useState('09:00');
  const [disPrio, setDisPrio] = useState<DisplayPriority>('NORMAL');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const submit = async () => {
    if (!title.trim()) { setErr(true); ref.current?.focus(); return; }
    const dbPrio = PRIO_OPTS.find(p => p.key === disPrio)!.db;
    setSaving(true);
    try { await onSave({ title: title.trim(), notes: notes.trim() || null, dueDate, time, priority: dbPrio }); }
    finally { setSaving(false); }
  };

  return (
    <div className="tb-form">
      <input
        ref={ref}
        className={`tb-form__title${err ? ' tb-form__title--err' : ''}`}
        placeholder="Add task name"
        value={title}
        maxLength={280}
        onChange={e => { setTitle(e.target.value); setErr(false); }}
        onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
      />

      <textarea
        className="tb-form__desc"
        placeholder="Add task description"
        value={notes}
        maxLength={1000}
        rows={2}
        onChange={e => setNotes(e.target.value)}
      />

      <div className="tb-form__row">
        <label className="tb-form__date-label">
          <Calendar size={11} strokeWidth={2} className="tb-form__field-icon" />
          <input
            type="date"
            className="tb-form__date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            style={{ colorScheme: 'light dark' }}
          />
        </label>

        <label className="tb-form__date-label">
          <Clock size={11} strokeWidth={2} className="tb-form__field-icon" />
          <input
            type="time"
            className="tb-form__date tb-form__time"
            value={time}
            onChange={e => setTime(e.target.value)}
            style={{ colorScheme: 'light dark' }}
          />
        </label>

        <div className="tb-form__prios">
          {PRIO_OPTS.map(p => (
            <button
              key={p.key}
              type="button"
              title={p.label}
              className={`tb-form__prio-dot${disPrio === p.key ? ' tb-form__prio-dot--on' : ''}`}
              style={{ '--pc': p.color } as React.CSSProperties}
              onClick={() => setDisPrio(p.key)}
            />
          ))}
        </div>
      </div>

      <div className="tb-form__btns">
        <button type="button" className="tb-form__cancel" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="tb-form__save" onClick={submit} disabled={saving}>
          {saving
            ? <Loader2 size={12} strokeWidth={2} className="tb-spin" />
            : <Check size={12} strokeWidth={2.5} />}
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function BoardCard({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  task: BoardTask;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDelete: (id: string) => void;
}) {
  const pm       = PRIO_META[task.priority];
  const overdue  = isOverdue(task.dueDate);
  const dayLabel = fmtDueDay(task.dueDate);
  const time     = fmtTime(task.dueDate);
  const calColor = overdue ? '#ef4444' : pm.color;

  return (
    <div
      className={`tb-card${isDragging ? ' tb-card--dragging' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      style={{ '--pc': pm.color, '--pb': pm.bg } as React.CSSProperties}
    >
      {/* Top row: priority badge + actions */}
      <div className="tb-card__top">
        <span className="tb-card__badge">
          <Flag size={9} strokeWidth={2.5} className="tb-card__badge-flag" />
          {pm.label}
        </span>
        <div className="tb-card__actions">
          <GripVertical size={13} strokeWidth={1.8} className="tb-card__grip" />
          <button
            type="button"
            className="tb-card__del"
            aria-label="Delete task"
            onClick={() => onDelete(task.id)}
          >
            <X size={11} strokeWidth={2.3} />
          </button>
        </div>
      </div>

      {/* Title */}
      <p className="tb-card__title">{task.title}</p>

      {/* Description */}
      {task.notes && <p className="tb-card__desc">{task.notes}</p>}

      {/* Due date row */}
      {task.dueDate && (
        <div className="tb-card__due-row">
          <div className="tb-card__due">
            <span
              className="tb-card__cal-btn"
              style={{ background: calColor } as React.CSSProperties}
            >
              <Calendar size={11} strokeWidth={2.2} />
            </span>
            <span className={`tb-card__due-label${overdue ? ' tb-card__due-label--past' : ''}`}>
              {dayLabel}
            </span>
          </div>
          {time && (
            <span className="tb-card__time-chip">
              <Clock size={9} strokeWidth={2} />
              {time}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

type Props = {
  tasks: BoardTask[];
  boardStatuses: Map<string, BoardStatus>;
  onStatusChange: (id: string, status: BoardStatus) => void;
  onTaskCreated: (task: BoardTask, col: BoardStatus) => void;
  onTaskDelete: (id: string) => void;
};

export default function TasksBoard({
  tasks,
  boardStatuses,
  onStatusChange,
  onTaskCreated,
  onTaskDelete,
}: Props) {
  // ── drag state
  const [addingIn,   setAddingIn]   = useState<BoardStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver,   setDragOver]   = useState<BoardStatus | null>(null);

  // ── column management
  const [columns,       setColumns]    = useState<BoardColumn[]>(loadColumns);
  const [editingColId,  setEditingCol] = useState<string | null>(null);
  const [editLabel,     setEditLabel]  = useState('');
  const [colorPickFor,  setColorFor]   = useState<string | null>(null);
  const [colorPickPos,  setPickPos]    = useState<{ top: number; left: number } | null>(null);

  const validColIds = useMemo(() => new Set(columns.map(c => c.id)), [columns]);

  // close color picker on outside click
  useEffect(() => {
    if (!colorPickFor) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t.closest('.tb-colorpicker') && !t.closest('.tb-col__icon-btn')) {
        setColorFor(null);
        setPickPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorPickFor]);

  const saveColumns = useCallback((cols: BoardColumn[]) => {
    setColumns(cols);
    try { localStorage.setItem(COL_STORAGE, JSON.stringify(cols)); } catch {}
  }, []);

  const startRename = useCallback((col: BoardColumn) => {
    setEditingCol(col.id);
    setEditLabel(col.label);
    setColorFor(null);
    setPickPos(null);
  }, []);

  const commitRename = useCallback((colId: string, label: string, orig: string) => {
    saveColumns(columns.map(c => c.id === colId ? { ...c, label: label.trim() || orig } : c));
    setEditingCol(null);
  }, [columns, saveColumns]);

  const handleDeleteCol = useCallback((colId: string) => {
    if (columns.length <= 1) return;
    const remaining = columns.filter(c => c.id !== colId);
    const fallback  = remaining[0].id;
    tasks
      .filter(t => (boardStatuses.get(t.id) ?? columns[0].id) === colId)
      .forEach(t => onStatusChange(t.id, fallback));
    saveColumns(remaining);
  }, [columns, tasks, boardStatuses, onStatusChange, saveColumns]);

  const handleAddCol = useCallback(() => {
    if (columns.length >= 5) return;
    const preset = COLOR_PRESETS[columns.length % COLOR_PRESETS.length];
    const newCol: BoardColumn = { id: `col_${Date.now()}`, label: 'New Column', ...preset };
    saveColumns([...columns, newCol]);
    setEditingCol(newCol.id);
    setEditLabel('New Column');
  }, [columns, saveColumns]);

  // open the fixed-position color picker aligned to the clicked icon button
  const openColorPicker = useCallback((e: React.MouseEvent<HTMLButtonElement>, colId: string) => {
    if (colorPickFor === colId) { setColorFor(null); setPickPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const PICKER_W = 196;
    let left = rect.left;
    const top  = rect.bottom + 10;
    if (left + PICKER_W > window.innerWidth - 8) left = window.innerWidth - PICKER_W - 8;
    if (left < 8) left = 8;
    setColorFor(colId);
    setPickPos({ top, left });
  }, [colorPickFor]);

  // close = true for swatch clicks, false for live custom-input changes
  const updateColColor = useCallback((colId: string, preset: { color: string; bg: string }, close = true) => {
    saveColumns(columns.map(c => c.id === colId ? { ...c, ...preset } : c));
    if (close) { setColorFor(null); setPickPos(null); }
  }, [columns, saveColumns]);

  // ── drag handlers
  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOver(null);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, col: BoardStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(col);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent, col: BoardStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) onStatusChange(id, col);
    setDragOver(null);
    setDraggingId(null);
  }, [onStatusChange]);

  const handleSave = useCallback(async (
    col: BoardStatus,
    data: { title: string; notes: string | null; dueDate: string; time: string; priority: Priority },
  ) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:    data.title,
        notes:    data.notes,
        dueDate:  `${data.dueDate}T${data.time}`,
        priority: data.priority,
      }),
    });
    if (!res.ok) return;
    const task: BoardTask = await res.json();
    onTaskCreated(task, col);
    setAddingIn(null);
  }, [onTaskCreated]);

  return (
    <div className="tb">
      {columns.map(col => {
        const colTasks = tasks.filter(t => {
          const s = boardStatuses.get(t.id);
          return ((s && validColIds.has(s)) ? s : columns[0]?.id) === col.id;
        });
        const isOver = dragOver === col.id;

        return (
          <div
            key={col.id}
            className={`tb-col${isOver ? ' tb-col--over' : ''}`}
            style={{ '--cc': col.color, '--cb': col.bg } as React.CSSProperties}
            onDragOver={e => onDragOver(e, col.id)}
            onDragLeave={onDragLeave}
            onDrop={e => onDrop(e, col.id)}
          >
            {/* ── Column header */}
            <div className="tb-col__head">
              {/* Icon box — click opens fixed color picker */}
              <button
                className="tb-col__icon-btn"
                title="Change column color"
                onClick={e => openColorPicker(e, col.id)}
              >
                {getColIcon(col.id)}
              </button>

              {/* Label or rename input */}
              <div className="tb-col__head-mid">
                {editingColId === col.id ? (
                  <input
                    className="tb-col__label-input"
                    value={editLabel}
                    autoFocus
                    maxLength={24}
                    onChange={e => setEditLabel(e.target.value)}
                    onBlur={() => commitRename(col.id, editLabel, col.label)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(col.id, editLabel, col.label);
                      if (e.key === 'Escape') setEditingCol(null);
                    }}
                  />
                ) : (
                  <span
                    className="tb-col__label"
                    onDoubleClick={() => startRename(col)}
                    title="Double-click to rename"
                  >
                    {col.label}
                  </span>
                )}
              </div>

              {/* Count pill + delete */}
              <div className="tb-col__head-right">
                <span className="tb-col__count">{colTasks.length}</span>
                {columns.length > 1 && (
                  <button
                    className="tb-col__del-btn"
                    aria-label={`Delete ${col.label}`}
                    onClick={() => handleDeleteCol(col.id)}
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                )}
              </div>

            </div>

            {/* ── Cards */}
            <div className="tb-col__body">
              {colTasks.map(task => (
                <BoardCard
                  key={task.id}
                  task={task}
                  isDragging={draggingId === task.id}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDelete={onTaskDelete}
                />
              ))}

              {addingIn === col.id && (
                <InlineForm
                  onSave={data => handleSave(col.id, data)}
                  onCancel={() => setAddingIn(null)}
                />
              )}
            </div>

            {/* ── Add task */}
            {addingIn !== col.id && (
              <button
                type="button"
                className="tb-col__add"
                onClick={() => setAddingIn(col.id)}
              >
                <Plus size={13} strokeWidth={2.4} />
                Add Task
              </button>
            )}
          </div>
        );
      })}

      {/* ── Add column */}
      {columns.length < 5 && (
        <button type="button" className="tb-col-adder" onClick={handleAddCol}>
          <Plus size={15} strokeWidth={2.3} />
          <span>Add Column</span>
        </button>
      )}

      {/* ── Fixed color picker overlay (escapes column overflow:hidden) */}
      {colorPickFor && colorPickPos && (() => {
        const col = columns.find(c => c.id === colorPickFor);
        if (!col) return null;
        return (
          <div
            className="tb-colorpicker"
            style={{ top: colorPickPos.top, left: colorPickPos.left }}
          >
            <p className="tb-colorpicker__title">Column color</p>
            <div className="tb-colorpicker__swatches">
              {COLOR_PRESETS.map(p => (
                <button
                  key={p.color}
                  className={`tb-colorpicker__dot${col.color === p.color ? ' tb-colorpicker__dot--on' : ''}`}
                  style={{ '--sc': p.color } as React.CSSProperties}
                  onClick={() => updateColColor(colorPickFor, p)}
                />
              ))}
            </div>
            <div className="tb-colorpicker__divider" />
            <label className="tb-colorpicker__custom" title="Pick any color">
              <span
                className="tb-colorpicker__custom-swatch"
                style={{ background: col.color }}
              />
              <span className="tb-colorpicker__custom-text">Custom color</span>
              <input
                type="color"
                className="tb-colorpicker__input"
                value={col.color}
                onChange={e => {
                  const hex = e.target.value;
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  updateColColor(colorPickFor, { color: hex, bg: `rgba(${r},${g},${b},0.12)` }, false);
                }}
              />
            </label>
          </div>
        );
      })()}
    </div>
  );
}
