'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Info,
  Link2,
  Loader2,
  Minus,
  Paperclip,
  Search,
  SquarePen,
  Upload,
  Users,
  X,
} from 'lucide-react';
import './CreateTaskModal.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'NORMAL' | 'HIGH' | 'URGENT';
type PriorityDisplay = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type CreatedTask = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
};

type Client = { id: string; name: string; company: string | null };

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  dueDate: string | null;
  clientName: string;
};

type AttachFile = { id: string; file: File };

type FormState = {
  title: string;
  description: string;
  priority: PriorityDisplay;
  dueDate: string;
  startTime: string;
  endTime: string;
  clientId: string;
  invoiceId: string;
};

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  position: { x: number; y: number } | null; // null = closed
  initialDate: string; // YYYY-MM-DD
  onClose: () => void;
  onCreated: (task: CreatedTask) => void;
};

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIO_CFG: Record<PriorityDisplay, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  dbValue: Priority;
}> = {
  LOW:    { label: 'Low',    icon: <ArrowDown     size={13} strokeWidth={2.3} />, color: '#16a34a', bg: 'rgba(22,163,74,0.07)',   border: 'rgba(22,163,74,0.3)',    dbValue: 'NORMAL' },
  NORMAL: { label: 'Normal', icon: <Minus         size={13} strokeWidth={2.5} />, color: '#6366f1', bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.3)',  dbValue: 'NORMAL' },
  HIGH:   { label: 'High',   icon: <ArrowUp       size={13} strokeWidth={2.3} />, color: '#f97316', bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.3)',  dbValue: 'HIGH'   },
  URGENT: { label: 'Urgent', icon: <AlertTriangle size={13} strokeWidth={2.2} />, color: '#ef4444', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.3)',   dbValue: 'URGENT' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

// ─── Searchable Select ────────────────────────────────────────────────────────

type SelectOption = {
  value: string;
  label: string;
  sub?: string;
  badge?: string;
};

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  loading = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const rootRef           = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = query.trim()
    ? options.filter(
        o =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.sub && o.sub.toLowerCase().includes(query.toLowerCase())),
      )
    : options;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) { setQuery(''); return; }
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const choose = (v: string) => { onChange(v); setOpen(false); };
  const clear  = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="ctm-select">
      <button
        type="button"
        disabled={disabled || loading}
        className={`ctm-select__trigger${open ? ' ctm-select__trigger--open' : ''}`}
        onClick={() => !disabled && !loading && setOpen(o => !o)}
      >
        {loading ? (
          <span className="ctm-select__placeholder">Loading…</span>
        ) : selected ? (
          <span className="ctm-select__value">{selected.label}</span>
        ) : (
          <span className="ctm-select__placeholder">{placeholder}</span>
        )}
        <ChevronDown size={14} className="ctm-select__chevron" strokeWidth={2.2} />
      </button>

      {open && (
        <div className="ctm-select__dropdown">
          <div className="ctm-select__search">
            <Search size={13} className="ctm-select__search-icon" strokeWidth={2.2} />
            <input
              ref={inputRef}
              className="ctm-select__search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
            />
          </div>

          <ul className="ctm-select__list" role="listbox">
            {value && (
              <li
                className="ctm-select__item ctm-select__item--clear"
                role="option"
                aria-selected={false}
                onClick={clear}
              >
                Clear selection
              </li>
            )}

            {filtered.map(o => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={`ctm-select__item${o.value === value ? ' ctm-select__item--selected' : ''}`}
                onClick={() => choose(o.value)}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.label}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  {o.badge && (
                    <span className={`ctm-status-badge ctm-status-badge--${o.badge}`}>
                      {o.badge.replace('_', ' ')}
                    </span>
                  )}
                  {o.sub && <span className="ctm-select__item-sub">{o.sub}</span>}
                  {o.value === value && <Check size={12} className="ctm-select__item-check" strokeWidth={2.5} />}
                </span>
              </li>
            ))}

            {filtered.length === 0 && (
              <li className="ctm-select__empty">No results found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Priority Dropdown ────────────────────────────────────────────────────────

function PriorityDropdown({ value, onChange }: {
  value: PriorityDisplay;
  onChange: (v: PriorityDisplay) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cfg = PRIO_CFG[value];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="ctm-prio-dd">
      <button
        type="button"
        className={`ctm-prio-dd__trigger${open ? ' ctm-prio-dd__trigger--open' : ''}`}
        style={{ '--pc': cfg.color, '--pb': cfg.bg, '--pbd': cfg.border } as React.CSSProperties}
        onClick={() => setOpen(o => !o)}
      >
        <span className="ctm-prio-dd__icon" style={{ color: cfg.color }}>{cfg.icon}</span>
        <span className="ctm-prio-dd__label" style={{ color: cfg.color }}>{cfg.label}</span>
        <ChevronDown size={13} className="ctm-prio-dd__chevron" strokeWidth={2.2} />
      </button>

      {open && (
        <div className="ctm-prio-dd__menu">
          {(Object.keys(PRIO_CFG) as PriorityDisplay[]).map(p => {
            const c = PRIO_CFG[p];
            const active = value === p;
            return (
              <button
                key={p}
                type="button"
                className={`ctm-prio-dd__opt${active ? ' ctm-prio-dd__opt--active' : ''}`}
                onClick={() => { onChange(p); setOpen(false); }}
              >
                <span className="ctm-prio-dd__opt-left">
                  <span style={{ color: c.color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>{c.icon}</span>
                  <span style={{ color: active ? c.color : undefined }}>{c.label}</span>
                </span>
                {active && <Check size={12} strokeWidth={2.5} style={{ color: c.color, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function CollapsibleSection({
  icon,
  label,
  badge,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`ctm__collapsible${open ? ' ctm__collapsible--open' : ''}`}>
      <button
        type="button"
        className="ctm__collapsible-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="ctm__collapsible-trigger-left">
          <span className="ctm__collapsible-icon">{icon}</span>
          <span className="ctm__collapsible-label">{label}</span>
          {badge && <span className="ctm__collapsible-badge">{badge}</span>}
        </span>
        <ChevronDown size={14} className="ctm__collapsible-chevron" strokeWidth={2.2} />
      </button>

      {open && <div className="ctm__collapsible-body">{children}</div>}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function CreateTaskModal({ position, initialDate, onClose, onCreated }: Props) {
  const isOpen = position !== null;

  const [form, setForm] = useState<FormState>({
    title:       '',
    description: '',
    priority:    'NORMAL',
    dueDate:     initialDate,
    startTime:   '09:00',
    endTime:     '10:00',
    clientId:    '',
    invoiceId:   '',
  });

  const [clients,         setClients]         = useState<Client[]>([]);
  const [invoices,        setInvoices]        = useState<Invoice[]>([]);
  const [loadingClients,  setLoadingClients]  = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [attachments,     setAttachments]     = useState<AttachFile[]>([]);
  const [dragOver,        setDragOver]        = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [titleError,      setTitleError]      = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef     = useRef<HTMLInputElement>(null);
  const cardRef      = useRef<HTMLDivElement>(null);

  // After each render clamp the card fully inside the viewport.
  // Always start from position.x/y (the requested open coordinates) so
  // stale imperative values from a previous open never carry over.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !position) return;

    const rect = el.getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    const gap  = 8;

    let x = position.x;
    let y = position.y;

    // Clamp so right edge stays in viewport
    if (x + rect.width  > vw - gap) x = vw - rect.width  - gap;
    if (x < gap) x = gap;

    // Clamp so bottom edge (footer) stays in viewport
    if (y + rect.height > vh - gap) y = vh - rect.height - gap;
    if (y < gap) y = gap;

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
  }, [position]);

  // Sync date + reset form each time the popup opens
  useEffect(() => {
    if (!isOpen) return;
    setForm({ title: '', description: '', priority: 'NORMAL', dueDate: initialDate, startTime: '09:00', endTime: '10:00', clientId: '', invoiceId: '' });
    setAttachments([]);
    setTitleError(false);
    setTimeout(() => titleRef.current?.focus(), 60);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Fetch clients once on first open
  useEffect(() => {
    if (!isOpen || clients.length > 0) return;
    setLoadingClients(true);
    fetch('/api/clients')
      .then(r => r.ok ? r.json() : [])
      .then((data: Client[]) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingClients(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Fetch invoices when client selected
  useEffect(() => {
    if (!form.clientId) { setInvoices([]); setForm(f => ({ ...f, invoiceId: '' })); return; }
    setLoadingInvoices(true);
    fetch(`/api/invoices?clientId=${form.clientId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Invoice[]) => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => setInvoices([]))
      .finally(() => setLoadingInvoices(false));
  }, [form.clientId]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleClose = useCallback(() => { onClose(); }, [onClose]);

  // File handling
  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).map(file => ({ id: Math.random().toString(36).slice(2), file }));
    setAttachments(prev => [...prev, ...arr]);
  };

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setTitleError(true); titleRef.current?.focus(); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:    form.title.trim(),
          notes:    form.description.trim() || null,
          dueDate:  `${form.dueDate}T${form.startTime}`,
          priority: PRIO_CFG[form.priority].dbValue,
        }),
      });

      if (res.ok) {
        const task: CreatedTask = await res.json();
        onCreated(task);
        handleClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const clientOptions: SelectOption[] = clients.map(c => ({
    value: c.id,
    label: c.name,
    sub:   c.company ?? undefined,
  }));

  const invoiceOptions: SelectOption[] = invoices.map(inv => ({
    value: inv.id,
    label: inv.invoiceNumber,
    badge: inv.status,
    sub:   `GHS ${inv.total.toLocaleString()}`,
  }));

  if (!isOpen) return null;

  const attachCount = attachments.length;

  return (
    <>
      {/* Invisible click-outside catcher */}
      <div className="ctm-overlay" onMouseDown={handleClose} aria-hidden />

      <div
        ref={cardRef}
        className="ctm"
        role="dialog"
        aria-modal
        aria-label="Create Task"
        style={{ top: position.y, left: position.x }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ctm__header">
          <div className="ctm__header-left">
            <div className="ctm__header-icon" aria-hidden>
              <SquarePen size={14} strokeWidth={2} />
            </div>
            <div className="ctm__header-text">
              <h2 className="ctm__header-title">New Task</h2>
            </div>
          </div>
          <button
            type="button"
            className="ctm__close"
            aria-label="Close"
            onClick={handleClose}
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        </div>

        {/* Body */}
        <form className="ctm__body" id="ctm-form" onSubmit={handleSubmit} noValidate>

          {/* ── Section: Task Details ─────────────────────── */}
          <div className="ctm__section">
            <div className="ctm__section-header">
              <SquarePen size={13} className="ctm__section-icon" strokeWidth={2.2} />
              <span className="ctm__section-title">Task Details</span>
            </div>

            {/* Title */}
            <div className="ctm__field">
              <label className="ctm__label" htmlFor="ctm-title">
                Title <span className="ctm__label-required">*</span>
              </label>
              <input
                ref={titleRef}
                id="ctm-title"
                className={`ctm__input ctm__input--title${titleError ? ' ctm__input--error' : ''}`}
                type="text"
                placeholder="What needs to be done?"
                value={form.title}
                onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setTitleError(false); }}
                autoComplete="off"
                maxLength={280}
              />
              {titleError && (
                <span className="ctm__error-text">
                  <Info size={11} strokeWidth={2.5} />
                  Title is required
                </span>
              )}
            </div>

            {/* Description */}
            <div className="ctm__field">
              <label className="ctm__label" htmlFor="ctm-desc">Description</label>
              <textarea
                id="ctm-desc"
                className="ctm__textarea"
                placeholder="Add context, steps, or notes for this task…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                maxLength={2000}
              />
            </div>

            {/* Priority */}
            <div className="ctm__field">
              <label className="ctm__label">Priority</label>
              <PriorityDropdown
                value={form.priority}
                onChange={p => setForm(f => ({ ...f, priority: p }))}
              />
            </div>
          </div>

          {/* ── Section: Scheduling ───────────────────────── */}
          <div className="ctm__section">
            <div className="ctm__section-header">
              <CalendarDays size={13} className="ctm__section-icon" strokeWidth={2.2} />
              <span className="ctm__section-title">Scheduling</span>
            </div>

            <div className="ctm__row-schedule">
              {/* Due date */}
              <div className="ctm__field" style={{ marginBottom: 0 }}>
                <label className="ctm__label" htmlFor="ctm-date">
                  Due Date <span className="ctm__label-required">*</span>
                </label>
                <input
                  id="ctm-date"
                  className="ctm__input"
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  required
                  style={{ colorScheme: 'light dark' }}
                />
              </div>

              {/* Time range */}
              <div className="ctm__field" style={{ marginBottom: 0 }}>
                <label className="ctm__label">
                  <Clock size={11} strokeWidth={2.5} aria-hidden />
                  Time Range
                </label>
                <div className="ctm__time-range">
                  <input
                    className="ctm__input"
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    aria-label="Start time"
                    style={{ colorScheme: 'light dark' }}
                  />
                  <span className="ctm__time-dash" aria-hidden>—</span>
                  <input
                    className="ctm__input"
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    aria-label="End time"
                    style={{ colorScheme: 'light dark' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section: Links & Associations ─────────────── */}
          <div className="ctm__section">
            <div className="ctm__section-header">
              <Link2 size={13} className="ctm__section-icon" strokeWidth={2.2} />
              <span className="ctm__section-title">Optional</span>
            </div>

            <div className="ctm__info-banner">
              <Info size={13} className="ctm__info-banner-icon" strokeWidth={2.2} />
              <span className="ctm__info-banner-text">
                Link this task to a client or invoice for business tracking. Leave empty for personal tasks.
              </span>
            </div>

            <div className="ctm__row-2col">
              {/* Client */}
              <div className="ctm__field" style={{ marginBottom: 0 }}>
                <label className="ctm__label">Client</label>
                <SearchableSelect
                  value={form.clientId}
                  onChange={v => setForm(f => ({ ...f, clientId: v, invoiceId: '' }))}
                  options={clientOptions}
                  placeholder="Search clients…"
                  loading={loadingClients}
                />
                <span className="ctm__helper">Optional</span>
              </div>

              {/* Invoice */}
              <div className="ctm__field" style={{ marginBottom: 0 }}>
                <label className="ctm__label">Related Invoice</label>
                <SearchableSelect
                  value={form.invoiceId}
                  onChange={v => setForm(f => ({ ...f, invoiceId: v }))}
                  options={invoiceOptions}
                  placeholder={form.clientId ? 'Search invoices…' : 'Select client first'}
                  disabled={!form.clientId}
                  loading={loadingInvoices}
                />
                <span className="ctm__helper">Optional</span>
              </div>
            </div>
          </div>

          {/* ── Collapsible: Assignment ────────────────────── */}
          <CollapsibleSection
            icon={<Users size={14} strokeWidth={2.1} />}
            label="Assignment"
            badge="optional"
          >
            <div className="ctm__assignment-note">
              <Users size={14} strokeWidth={2} />
              <span>
                Team assignment is available in the workspace plan. You can assign this task to yourself or collaborators after creation.
              </span>
            </div>
          </CollapsibleSection>

          {/* ── Collapsible: Attachments ───────────────────── */}
          <CollapsibleSection
            icon={<Paperclip size={14} strokeWidth={2.1} />}
            label="Attachments"
            badge={attachCount > 0 ? `${attachCount} file${attachCount > 1 ? 's' : ''}` : 'optional'}
          >
            {/* Drop zone */}
            <div
              className={`ctm__drop-zone${dragOver ? ' ctm__drop-zone--drag-over' : ''}`}
              onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload attachments"
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={e => e.target.files && addFiles(e.target.files)}
              />
              <div className="ctm__drop-icon" aria-hidden>
                <Upload size={15} strokeWidth={2} />
              </div>
              <span className="ctm__drop-title">
                {dragOver ? 'Drop files here' : 'Drag & drop or click to upload'}
              </span>
              <span className="ctm__drop-sub">PNG, JPG, PDF, DOCX — up to 10 MB each</span>
            </div>

            {/* File list */}
            {attachments.length > 0 && (
              <div className="ctm__file-list" role="list">
                {attachments.map(a => (
                  <div key={a.id} className="ctm__file-item" role="listitem">
                    <div className="ctm__file-icon" aria-hidden>
                      <Paperclip size={12} strokeWidth={2.2} />
                    </div>
                    <span className="ctm__file-name" title={a.file.name}>{a.file.name}</span>
                    <span className="ctm__file-size">{fmtFileSize(a.file.size)}</span>
                    <button
                      type="button"
                      className="ctm__file-remove"
                      aria-label={`Remove ${a.file.name}`}
                      onClick={() => removeAttachment(a.id)}
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

        </form>

        {/* Footer */}
        <div className="ctm__footer">
          <div className="ctm__footer-left">
            {form.dueDate && (
              <span className="ctm__footer-count">
                {fmtDate(form.dueDate)}
              </span>
            )}
          </div>

          <div className="ctm__footer-right">
            <button
              type="button"
              className="ctm__btn-cancel"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="ctm-form"
              className="ctm__btn-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} strokeWidth={2.2} className="ctm__spinner" />
                  Creating…
                </>
              ) : (
                <>
                  Create Task
                  <ArrowRight size={14} strokeWidth={2.4} className="ctm__btn-submit-arrow" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
