import type { SearchSuggestion } from './globalSearch';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
] as const;
const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function monthEnd(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/** Monday of the ISO week containing d */
function weekMonday(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  return r;
}

/** Most recent occurrence of weekday (0=Sun…6=Sat), could be today. */
function mostRecent(today: Date, dow: number): Date {
  const diff = (today.getDay() - dow + 7) % 7;
  return addDays(today, -diff);
}

/** Next occurrence of weekday, strictly after today. */
function nextOccurrence(today: Date, dow: number): Date {
  const diff = (dow - today.getDay() + 7) % 7 || 7;
  return addDays(today, diff);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dayHref(iso: string): string {
  return `/?date=${encodeURIComponent(iso)}`;
}

function rangeHref(from: string, to: string): string {
  return `/invoices?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

function monthIdx(str: string): number {
  const full = MONTH_NAMES.indexOf(str as typeof MONTH_NAMES[number]);
  if (full !== -1) return full;
  return MONTH_SHORT.indexOf(str as typeof MONTH_SHORT[number]);
}

function matchesMonth(q: string): number[] {
  const matched: number[] = [];
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (MONTH_NAMES[i].startsWith(q) || (MONTH_SHORT[i] !== 'may' && MONTH_SHORT[i] === q)) {
      matched.push(i);
    }
    if (q === MONTH_SHORT[i]) matched.push(i);
  }
  return [...new Set(matched)];
}

function matchesDayName(q: string): number[] {
  return DAY_NAMES.reduce<number[]>((acc, name, i) => {
    if (name.startsWith(q)) acc.push(i);
    return acc;
  }, []);
}

type Entry = { priority: number; s: SearchSuggestion };

export function getTemporalSuggestions(rawQ: string, now: Date): SearchSuggestion[] {
  const q = rawQ.trim().toLowerCase();
  if (!q) return [];

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const entries: Entry[] = [];
  const seen = new Set<string>();

  function push(priority: number, s: SearchSuggestion) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      entries.push({ priority, s });
    }
  }

  function daySuggestion(id: string, label: string, d: Date, p: number) {
    push(p, { id, kind: 'date', label, subLabel: fmtDay(d), href: dayHref(toISO(d)), badge: 'Day view' });
  }

  function periodSuggestion(id: string, label: string, sub: string, from: Date, to: Date, p: number) {
    push(p, { id, kind: 'period', label, subLabel: sub, href: rangeHref(toISO(from), toISO(to)), badge: 'Invoices' });
  }

  const todayISO = toISO(today);

  // ── Relative keyword matching ────────────────────────────────────────────────

  if ('today'.startsWith(q))     daySuggestion('date-today',     'Today',     today,                 0);
  if ('yesterday'.startsWith(q)) daySuggestion('date-yesterday', 'Yesterday', addDays(today, -1),   1);
  if ('tomorrow'.startsWith(q))  daySuggestion('date-tomorrow',  'Tomorrow',  addDays(today, 1),    2);
  if ('now'.startsWith(q) && q.length >= 2) daySuggestion('date-now', 'Now (Today)', today,         3);

  // ── "this / last / next" prefix handling ─────────────────────────────────────

  const modMatch = q.match(/^(this|last|next)\s*(.*)$/);
  if (modMatch) {
    const mod = modMatch[1] as 'this' | 'last' | 'next';
    const sub = modMatch[2].trim();

    // Weekday after modifier
    for (const dow of matchesDayName(sub || '')) {
      const name = DAY_NAMES[dow];
      if (mod === 'this') {
        const monday = weekMonday(today);
        const target = dow === 0 ? addDays(monday, 6) : addDays(monday, dow - 1);
        daySuggestion(`date-this-${name}`, `This ${capitalize(name)}`, target, 10 + dow);
      } else if (mod === 'last') {
        const recent = mostRecent(today, dow);
        const actual = recent.getTime() === today.getTime() ? addDays(recent, -7) : recent;
        daySuggestion(`date-last-${name}`, `Last ${capitalize(name)}`, actual, 10 + dow);
      } else {
        daySuggestion(`date-next-${name}`, `Next ${capitalize(name)}`, nextOccurrence(today, dow), 10 + dow);
      }
    }

    // week
    if (!sub || 'week'.startsWith(sub)) {
      const mon = weekMonday(today);
      if (mod === 'this') {
        periodSuggestion('period-this-week', 'This week', `${fmtDay(mon)} → ${fmtDay(addDays(mon, 6))}`, mon, addDays(mon, 6), 20);
      } else if (mod === 'last') {
        const lMon = addDays(mon, -7);
        periodSuggestion('period-last-week', 'Last week', `${fmtDay(lMon)} → ${fmtDay(addDays(lMon, 6))}`, lMon, addDays(lMon, 6), 20);
      } else {
        const nMon = addDays(mon, 7);
        periodSuggestion('period-next-week', 'Next week', `${fmtDay(nMon)} → ${fmtDay(addDays(nMon, 6))}`, nMon, addDays(nMon, 6), 20);
      }
    }

    // month
    if (!sub || 'month'.startsWith(sub)) {
      if (mod === 'this') {
        const ms = new Date(today.getFullYear(), today.getMonth(), 1);
        periodSuggestion('period-this-month', 'This month', fmtMonth(ms), ms, monthEnd(ms.getFullYear(), ms.getMonth()), 21);
      } else if (mod === 'last') {
        const lm = today.getMonth() === 0
          ? new Date(today.getFullYear() - 1, 11, 1)
          : new Date(today.getFullYear(), today.getMonth() - 1, 1);
        periodSuggestion('period-last-month', 'Last month', fmtMonth(lm), lm, monthEnd(lm.getFullYear(), lm.getMonth()), 21);
      } else {
        const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        periodSuggestion('period-next-month', 'Next month', fmtMonth(nm), nm, monthEnd(nm.getFullYear(), nm.getMonth()), 21);
      }
    }

    // year
    if (!sub || 'year'.startsWith(sub)) {
      if (mod === 'this') {
        const yr = today.getFullYear();
        periodSuggestion('period-this-year', 'This year', String(yr), new Date(yr, 0, 1), new Date(yr, 11, 31), 22);
      } else if (mod === 'last') {
        const yr = today.getFullYear() - 1;
        periodSuggestion('period-last-year', 'Last year', String(yr), new Date(yr, 0, 1), new Date(yr, 11, 31), 22);
      } else {
        const yr = today.getFullYear() + 1;
        periodSuggestion('period-next-year', 'Next year', String(yr), new Date(yr, 0, 1), new Date(yr, 11, 31), 22);
      }
    }

    // quarter
    if (!sub || 'quarter'.startsWith(sub)) {
      let qm = Math.floor(today.getMonth() / 3);
      let qy = today.getFullYear();
      if (mod === 'last') { qm--; if (qm < 0) { qm = 3; qy--; } }
      else if (mod === 'next') { qm++; if (qm > 3) { qm = 0; qy++; } }
      const qs = new Date(qy, qm * 3, 1);
      const qe = monthEnd(qy, qm * 3 + 2);
      const qLabel = `${mod === 'this' ? 'This' : mod === 'last' ? 'Last' : 'Next'} quarter (Q${qm + 1} ${qy})`;
      periodSuggestion(`period-${mod}-quarter`, qLabel,
        `${capitalize(MONTH_NAMES[qm * 3])} — ${capitalize(MONTH_NAMES[qm * 3 + 2])} ${qy}`, qs, qe, 23);
    }

    // N days (e.g. "last 7 days", "last 30 days")
    const nDaysMatch = sub.match(/^(\d+)\s+days?$/);
    if (mod === 'last' && nDaysMatch) {
      const n = parseInt(nDaysMatch[1], 10);
      if (n > 0 && n <= 365) {
        const from = addDays(today, -n);
        periodSuggestion(`period-last-${n}-days`, `Last ${n} day${n === 1 ? '' : 's'}`,
          `${fmtDay(from)} → Today`, from, today, 24);
      }
    }
  }

  // ── Quarter shorthand: "Q1", "q2 2025" ───────────────────────────────────────
  const quarterMatch = q.match(/^q([1-4])(?:\s+(\d{4}))?$/);
  if (quarterMatch) {
    const qNum = parseInt(quarterMatch[1], 10) - 1;
    const yr = quarterMatch[2] ? parseInt(quarterMatch[2], 10) : today.getFullYear();
    if (yr >= 2000 && yr <= 2100) {
      const qs = new Date(yr, qNum * 3, 1);
      const qe = monthEnd(yr, qNum * 3 + 2);
      periodSuggestion(`period-q${qNum + 1}-${yr}`, `Q${qNum + 1} ${yr}`,
        `${capitalize(MONTH_NAMES[qNum * 3])} — ${capitalize(MONTH_NAMES[qNum * 3 + 2])} ${yr}`, qs, qe, 25);
    }
  }

  // ── Bare weekday names (min 1 char) ──────────────────────────────────────────
  if (!modMatch) {
    for (const dow of matchesDayName(q)) {
      const name = DAY_NAMES[dow];
      const recent = mostRecent(today, dow);
      if (recent.getTime() !== today.getTime()) {
        daySuggestion(`date-recent-${name}`, capitalize(name), recent, 30 + dow);
      }
      daySuggestion(`date-next-${name}`, `Next ${capitalize(name)}`, nextOccurrence(today, dow), 40 + dow);
    }
  }

  // ── Bare month names (min 2 chars to avoid over-matching "m") ────────────────
  if (!modMatch && q.length >= 2) {
    // "month year" e.g. "april 2025"
    const mYrMatch = q.match(/^([a-z]+)\s+(\d{4})$/);
    if (mYrMatch) {
      const mi = monthIdx(mYrMatch[1]);
      const yr = parseInt(mYrMatch[2], 10);
      if (mi !== -1 && yr >= 2000 && yr <= 2100) {
        const ms = new Date(yr, mi, 1);
        periodSuggestion(`period-${yr}-${mi}`, `${capitalize(MONTH_NAMES[mi])} ${yr}`, fmtMonth(ms), ms, monthEnd(yr, mi), 50);
      }
    } else {
      for (const mi of matchesMonth(q)) {
        const yr = today.getFullYear();
        const ms = new Date(yr, mi, 1);
        const me = monthEnd(yr, mi);
        periodSuggestion(`period-${yr}-${mi}`, `${capitalize(MONTH_NAMES[mi])} ${yr}`, fmtMonth(ms), ms, me, 50 + mi);
        // Also offer previous year when that month is in the future
        if (ms.getTime() > today.getTime()) {
          const pms = new Date(yr - 1, mi, 1);
          const pme = monthEnd(yr - 1, mi);
          periodSuggestion(`period-${yr - 1}-${mi}`, `${capitalize(MONTH_NAMES[mi])} ${yr - 1}`, fmtMonth(pms), pms, pme, 51 + mi);
        }
      }
    }
  }

  // ── ISO date YYYY-MM-DD ───────────────────────────────────────────────────────
  if (!modMatch) {
    const isoFull = q.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoFull) {
      const d = new Date(`${q}T00:00:00`);
      if (!isNaN(d.getTime())) {
        daySuggestion(`date-iso-${q}`, fmtDay(d), d, 60);
      }
    }

    // ISO partial YYYY-MM
    const isoMo = q.match(/^(\d{4})-(\d{2})$/);
    if (isoMo) {
      const yr = parseInt(isoMo[1], 10);
      const mo = parseInt(isoMo[2], 10) - 1;
      if (mo >= 0 && mo <= 11 && yr >= 2000 && yr <= 2100) {
        const ms = new Date(yr, mo, 1);
        periodSuggestion(`period-iso-${q}`, fmtMonth(ms), `${toISO(ms)} → ${toISO(monthEnd(yr, mo))}`, ms, monthEnd(yr, mo), 60);
      }
    }

    // Full year YYYY
    if (/^\d{4}$/.test(q)) {
      const yr = parseInt(q, 10);
      if (yr >= 2000 && yr <= 2100) {
        periodSuggestion(`period-year-${yr}`, `Year ${yr}`, `January — December ${yr}`,
          new Date(yr, 0, 1), new Date(yr, 11, 31), 61);
      }
    }

    // Partial year prefix "20", "202" → nearby matching years
    if (/^\d{2,3}$/.test(q)) {
      const cur = today.getFullYear();
      [cur - 2, cur - 1, cur, cur + 1].filter(yr => String(yr).startsWith(q)).forEach(yr => {
        periodSuggestion(`period-year-${yr}`, `Year ${yr}`, `January — December ${yr}`,
          new Date(yr, 0, 1), new Date(yr, 11, 31), 62);
      });
    }

    // Slash date MM/DD or MM/DD/YYYY
    const slashMatch = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (slashMatch) {
      const mo = parseInt(slashMatch[1], 10) - 1;
      const day = parseInt(slashMatch[2], 10);
      const yr = slashMatch[3] ? parseInt(slashMatch[3], 10) : today.getFullYear();
      if (mo >= 0 && mo <= 11 && day >= 1 && day <= 31 && yr >= 2000 && yr <= 2100) {
        const d = new Date(yr, mo, day);
        if (!isNaN(d.getTime()) && d.getDate() === day) {
          daySuggestion(`date-slash-${q}`, fmtDay(d), d, 63);
        }
      }
    }

    // "Month Day" text: "april 29", "29 april", "29th april"
    const mdMatch = q.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/);
    const dmMatch = q.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)$/);
    const mdParts = mdMatch ? { mStr: mdMatch[1], dayNum: parseInt(mdMatch[2], 10) }
      : dmMatch ? { mStr: dmMatch[2], dayNum: parseInt(dmMatch[1], 10) }
      : null;
    if (mdParts) {
      const mi = monthIdx(mdParts.mStr);
      if (mi !== -1 && mdParts.dayNum >= 1 && mdParts.dayNum <= 31) {
        const d = new Date(today.getFullYear(), mi, mdParts.dayNum);
        if (!isNaN(d.getTime()) && d.getDate() === mdParts.dayNum) {
          daySuggestion(`date-md-${mi}-${mdParts.dayNum}`, fmtDay(d), d, 64);
        }
      }
    }

    // Ordinal "15th", "1st", "23rd" → this month
    const ordMatch = q.match(/^(\d{1,2})(st|nd|rd|th)$/);
    if (ordMatch) {
      const dayNum = parseInt(ordMatch[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const d = new Date(today.getFullYear(), today.getMonth(), dayNum);
        if (!isNaN(d.getTime()) && d.getDate() === dayNum) {
          daySuggestion(`date-ord-${dayNum}`, fmtDay(d), d, 65);
        }
      }
    }

    // "N days ago" / "N weeks ago"
    const daysAgo = q.match(/^(\d+)\s+days?\s+ago$/);
    if (daysAgo) {
      const n = parseInt(daysAgo[1], 10);
      if (n >= 0 && n <= 365) {
        const d = addDays(today, -n);
        daySuggestion(`date-days-ago-${n}`, `${n} day${n === 1 ? '' : 's'} ago`, d, 66);
      }
    }
    const weeksAgo = q.match(/^(\d+)\s+weeks?\s+ago$/);
    if (weeksAgo) {
      const n = parseInt(weeksAgo[1], 10);
      if (n >= 0 && n <= 52) {
        const d = addDays(today, -n * 7);
        daySuggestion(`date-weeks-ago-${n}`, `${n} week${n === 1 ? '' : 's'} ago`, d, 67);
      }
    }
  }

  return entries
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6)
    .map(e => e.s);
}
