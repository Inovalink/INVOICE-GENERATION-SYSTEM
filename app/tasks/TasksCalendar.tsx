'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  Trash2,
  Video,
} from 'lucide-react';
import CreateTaskModal, { type CreatedTask } from '@/components/tasks/CreateTaskModal';
import TasksBoard, { type BoardStatus, type BoardTask } from './TasksBoard';
import './tasks.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'NORMAL' | 'HIGH' | 'URGENT';

type Task = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string;
  priority: Priority;
  completed: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Distinct color palette — each task gets its own color derived from its ID
const TASK_PALETTE = [
  '#6366f1', // indigo
  '#f97316', // orange
  '#14b8a6', // teal
  '#ec4899', // pink
  '#a855f7', // purple
  '#22c55e', // green
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#84cc16', // lime
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning!';
  if (h < 17) return 'Good afternoon!';
  return 'Good evening!';
}

/** Deterministic color from task ID — same task always gets the same color. */
function taskColor(task: Task): string {
  let hash = 0;
  for (let i = 0; i < task.id.length; i++) {
    hash = ((hash << 5) - hash + task.id.charCodeAt(i)) | 0;
  }
  return TASK_PALETTE[Math.abs(hash) % TASK_PALETTE.length];
}

function formatTimeShort(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function durationLabel(startMs: number, endMs: number): string {
  const mins = Math.round((endMs - startMs) / 60000);
  if (mins <= 0) return '1 hour';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h} ${h === 1 ? 'hour' : 'hours'}`;
}

function formatDateLabel(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${d.getFullYear()}`;
}

/** Build 42 cells (6 rows × 7 cols) for a month grid starting on Sunday. */
function buildMonthCells(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0=Sun

  const cells: Date[] = [];

  // Prev month fill
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i));
  }
  // Current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  // Next month fill to reach 42
  let nxt = 1;
  while (cells.length < 42) {
    cells.push(new Date(year, month + 1, nxt++));
  }

  return cells;
}

/** Group tasks by local date string key. */
function groupByDate(tasks: Task[]): Map<string, Task[]> {
  const m = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = localDateStr(new Date(t.dueDate));
    const arr = m.get(key) ?? [];
    arr.push(t);
    m.set(key, arr);
  }
  return m;
}


// ─── Event card (right sidebar) ───────────────────────────────────────────────

function EventCard({ task, onDelete }: { task: Task; onDelete: () => void }) {
  const due    = new Date(task.dueDate);
  const endDue = new Date(due.getTime() + 60 * 60 * 1000);
  const color  = taskColor(task);

  // Derive initials from the task title words for avatar bubbles
  const words    = task.title.trim().split(/\s+/);
  const initials = words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '?');

  // Avatar colors offset from the task's own palette index for harmony
  let baseHash = 0;
  for (let i = 0; i < task.id.length; i++) {
    baseHash = ((baseHash << 5) - baseHash + task.id.charCodeAt(i)) | 0;
  }
  const baseIdx = Math.abs(baseHash) % TASK_PALETTE.length;
  const avatarColors = initials.map((_, i) =>
    TASK_PALETTE[(baseIdx + i + 3) % TASK_PALETTE.length],
  );

  return (
    <div className="ta-event-card">
      <div className="ta-event-card__accent" style={{ background: color }} />
      <div className="ta-event-card__body">
        <div className="ta-event-card__title">{task.title}</div>
        {task.notes && (
          <div className="ta-event-card__desc">{task.notes}</div>
        )}
        <div className="ta-event-card__meta">
          <span className="ta-event-card__time">
            {formatTimeShort(due)} – {formatTimeShort(endDue)}
          </span>
          <span className="ta-event-card__duration">
            {durationLabel(due.getTime(), endDue.getTime())}
          </span>
        </div>
        <div className="ta-event-card__actions">
          {task.priority !== 'NORMAL' && (
            <button type="button" className="ta-event-card__btn">
              <Video size={10} strokeWidth={2.2} />
              {task.priority === 'URGENT' ? 'Join Now' : 'Meet Link'}
            </button>
          )}
          <button
            type="button"
            className="ta-event-card__btn"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 size={9} strokeWidth={2.2} />
          </button>
        </div>
        <div className="ta-event-card__avatars" style={{ marginTop: '0.4rem' }}>
          {initials.map((ini, i) => (
            <span
              key={i}
              className="ta-avatar"
              style={{ background: avatarColors[i] }}
            >
              {ini}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function TasksCalendar() {
  const today = new Date();

  // ── Calendar state ─────────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(() => today);

  // ── View ───────────────────────────────────────────────────────────────────
  const [view, setView] = useState<'calendar' | 'board'>('calendar');

  // ── Data ───────────────────────────────────────────────────────────────────
  const [tasks,   setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Board state ────────────────────────────────────────────────────────────
  const [boardStatuses,   setBoardStatuses]   = useState<Map<string, BoardStatus>>(new Map());
  const [allTasksLoaded,  setAllTasksLoaded]  = useState(false);

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [modalPos,  setModalPos]  = useState<{ x: number; y: number } | null>(null);
  const [modalDate, setModalDate] = useState(localDateStr(today));

  const POPUP_W = 460;
  const POPUP_H = 560;

  // ── Derived ────────────────────────────────────────────────────────────────
  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
  const tasksByDate = useMemo(() => groupByDate(tasks), [tasks]);
  const greeting = getGreeting();

  const selectedKey     = localDateStr(selectedDate);
  const selectedDayTasks = useMemo(
    () => (tasksByDate.get(selectedKey) ?? []).sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    ),
    [tasksByDate, selectedKey],
  );

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);

    // Fetch current month + adjacent months
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;

    const urls = Array.from(
      new Set([
        `/api/tasks?year=${py}&month=${pm + 1}`,
        `/api/tasks?year=${year}&month=${month + 1}`,
        `/api/tasks?year=${ny}&month=${nm + 1}`,
      ]),
    );

    Promise.all(urls.map(u => fetch(u).then(r => r.ok ? r.json() : []).catch(() => [])))
      .then(results => {
        const merged = (results as Task[][]).flat();
        const seen   = new Set<string>();
        setTasks(merged.filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true))));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // ── Fetch all tasks once when board is first opened ───────────────────────
  useEffect(() => {
    if (view !== 'board' || allTasksLoaded) return;
    fetch('/api/tasks')
      .then(r => r.ok ? r.json() : [])
      .then((data: Task[]) => {
        if (!Array.isArray(data)) return;
        setTasks(prev => {
          const seen = new Set(prev.map(t => t.id));
          return [...prev, ...data.filter(t => !seen.has(t.id))];
        });
      })
      .catch(() => {})
      .finally(() => setAllTasksLoaded(true));
  }, [view, allTasksLoaded]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goPrevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const prevDay  = () => setSelectedDate(d => new Date(d.getTime() - 86400000));
  const nextDay  = () => setSelectedDate(d => new Date(d.getTime() + 86400000));

  // ── Cell click ─────────────────────────────────────────────────────────────
  const handleCellClick = useCallback((date: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDate(date);
    setModalDate(localDateStr(date));

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    const gap  = 8;

    // Prefer right of cell; fall back to left if it would clip
    let x = rect.right + 10;
    if (x + POPUP_W > vw - gap) x = rect.left - POPUP_W - 10;
    x = Math.max(gap, Math.min(x, vw - POPUP_W - gap));

    // Always keep the bottom of the modal inside the viewport
    let y = rect.top;
    if (y + POPUP_H > vh - gap) y = vh - POPUP_H - gap;
    y = Math.max(gap, y);

    setModalPos({ x, y });
  }, [POPUP_W, POPUP_H]);

  // ── Task created via modal (calendar side) ────────────────────────────────
  const handleTaskCreated = useCallback((task: CreatedTask) => {
    setTasks(prev => [...prev, task]);
    setBoardStatuses(prev => new Map(prev).set(task.id, 'TODO'));
  }, []);

  // ── Delete task ────────────────────────────────────────────────────────────
  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setBoardStatuses(prev => { const m = new Map(prev); m.delete(id); return m; });
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  };

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="tasks-app">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="ta-topbar">
        <div className="ta-topbar__greeting">
          <h1 className="ta-topbar__title">{greeting}</h1>
          <p className="ta-topbar__sub">Here&rsquo;s what&rsquo;s on your agenda today.</p>
        </div>

        {/* View toggle */}
        <div className="ta-view-toggle">
          <button
            type="button"
            className={`ta-view-toggle__btn${view === 'calendar' ? ' ta-view-toggle__btn--active' : ''}`}
            onClick={() => setView('calendar')}
          >
            <CalendarDays size={13} strokeWidth={2} />
            Calendar
          </button>
          <button
            type="button"
            className={`ta-view-toggle__btn${view === 'board' ? ' ta-view-toggle__btn--active' : ''}`}
            onClick={() => setView('board')}
          >
            <LayoutGrid size={13} strokeWidth={2} />
            Board
          </button>
        </div>

        <div className="ta-topbar__right">
          <div className="ta-search">
            <Search size={13} className="ta-search__icon" strokeWidth={2.2} />
            <input
              className="ta-search__input"
              type="text"
              placeholder="Search for some activities…"
            />
          </div>
          <button type="button" className="ta-notif-btn" aria-label="Notifications">
            <Bell size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── Board view ──────────────────────────────────────── */}
      {view === 'board' && (
        <TasksBoard
          tasks={tasks as BoardTask[]}
          boardStatuses={boardStatuses}
          onStatusChange={(id, status) =>
            setBoardStatuses(prev => new Map(prev).set(id, status))
          }
          onTaskCreated={(task, col) => {
            setTasks(prev => [...prev, task as Task]);
            setBoardStatuses(prev => new Map(prev).set(task.id, col));
          }}
          onTaskDelete={deleteTask}
        />
      )}

      {/* ── Calendar body split ──────────────────────────────── */}
      {view === 'calendar' && <div className="ta-body">

        {/* ══ CALENDAR SECTION ══════════════════════════════════ */}
        <div className="ta-cal">

          {/* Month header */}
          <div className="ta-cal__header">
            <button
              type="button"
              className="ta-month-selector"
              onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
              title="Go to current month"
            >
              <span className="ta-month-selector__name">{MONTH_NAMES[month]}</span>
              <ChevronDown size={14} strokeWidth={2.2} className="ta-month-selector__chevron" />
              <span className="ta-month-selector__year">{year}</span>
            </button>

            <div className="ta-cal-nav">
              {loading && <Loader2 size={13} strokeWidth={2} style={{ color: 'var(--ta-text-muted)', animation: 'spin 0.8s linear infinite', marginRight: '0.3rem' }} />}
              <button type="button" className="ta-cal-nav__btn" onClick={goPrevMonth} aria-label="Prev month">
                <ChevronLeft size={13} strokeWidth={2.4} />
              </button>
              <button type="button" className="ta-cal-nav__btn" onClick={goNextMonth} aria-label="Next month">
                <ChevronRight size={13} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {/* Day labels */}
          <div className="ta-cal__day-labels">
            {DAY_LABELS.map(d => (
              <div key={d} className="ta-day-label">{d}</div>
            ))}
          </div>

          {/* Month grid */}
          <div className="ta-cal__grid">
            {cells.map((cellDate, idx) => {
              const isToday        = isSameDay(cellDate, today);
              const isSelected     = isSameDay(cellDate, selectedDate);
              const isCurrentMonth = cellDate.getMonth() === month;
              const dayKey         = localDateStr(cellDate);
              const dayTasks       = tasksByDate.get(dayKey) ?? [];
              const visibleChips   = dayTasks.slice(0, 3);
              const overflow       = dayTasks.length - visibleChips.length;

              return (
                <div
                  key={idx}
                  role="button"
                  tabIndex={0}
                  className={[
                    'ta-cell',
                    isToday        ? 'ta-cell--today'        : '',
                    isSelected     ? 'ta-cell--selected'     : '',
                    !isCurrentMonth ? 'ta-cell--other-month' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={e => handleCellClick(cellDate, e)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCellClick(cellDate, e as unknown as React.MouseEvent); }}
                  aria-label={`${cellDate.toDateString()}${dayTasks.length ? `, ${dayTasks.length} task${dayTasks.length > 1 ? 's' : ''}` : ''}`}
                  aria-pressed={isSelected}
                >
                  <span className={`ta-cell__num${isToday ? ' ta-cell__num--today' : ''}`}>
                    {cellDate.getDate()}
                  </span>

                  <div className="ta-cell__chips">
                    {visibleChips.map(t => (
                      <span
                        key={t.id}
                        className="ta-chip"
                        style={{ background: taskColor(t) }}
                        title={t.title}
                      >
                        {t.title}
                      </span>
                    ))}
                    {overflow > 0 && (
                      <span className="ta-chip ta-chip--more">+{overflow} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══ RIGHT SIDEBAR ══════════════════════════════════════ */}
        <aside className="ta-sidebar">
          <div className="ta-sidebar__header">
            <div className="ta-sidebar__title-area">
              <span className="ta-sidebar__label">Scheduled</span>
              <span className="ta-sidebar__date-str">{formatDateLabel(selectedDate)}</span>
            </div>
            <div className="ta-sidebar__nav">
              <button type="button" className="ta-sidebar__nav-btn" aria-label="Calendar view">
                <CalendarDays size={12} strokeWidth={2.2} />
              </button>
              <button type="button" className="ta-sidebar__nav-btn" onClick={prevDay} aria-label="Prev day">
                <ChevronLeft size={12} strokeWidth={2.4} />
              </button>
              <button type="button" className="ta-sidebar__nav-btn" onClick={nextDay} aria-label="Next day">
                <ChevronRight size={12} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <div className="ta-sidebar__timeline">
            {selectedDayTasks.length === 0 ? (
              <div className="ta-sidebar__empty">
                <CalendarDays size={28} strokeWidth={1.5} style={{ opacity: 0.22 }} />
                <span>No events scheduled for this day.</span>
                <button
                  type="button"
                  className="ta-sidebar__add-btn"
                  onClick={e => {
                    setModalDate(selectedKey);
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    let x = rect.left - POPUP_W - 10;
                    if (x < 8) x = Math.min(rect.right + 10, vw - POPUP_W - 8);
                    x = Math.max(8, x);
                    let y = rect.top;
                    if (y + POPUP_H > vh - 8) y = vh - POPUP_H - 8;
                    y = Math.max(8, y);
                    setModalPos({ x, y });
                  }}
                >
                  <Plus size={12} strokeWidth={2.4} />
                  Add event
                </button>
              </div>
            ) : (
              selectedDayTasks.map(task => {
                const due = new Date(task.dueDate);
                const timeKey = due.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                return (
                  <div key={task.id} className="ta-timeline-slot">
                    <div className="ta-timeline-time">{timeKey}</div>
                    <EventCard task={task} onDelete={() => deleteTask(task.id)} />
                  </div>
                );
              })
            )}
          </div>
        </aside>

      </div>}

      {/* ══ CREATE TASK MODAL ═════════════════════════════════════ */}
      <CreateTaskModal
        position={modalPos}
        initialDate={modalDate}
        onClose={() => setModalPos(null)}
        onCreated={handleTaskCreated}
      />

    </div>
  );
}
