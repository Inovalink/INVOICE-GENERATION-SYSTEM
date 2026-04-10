import type { InvoiceStatusBreakdown } from '@/lib/invoiceStatusCounts';

/** Match invoice status badge tokens in `app/globals.css` (tables, detail header). */
const COLORS = {
  paid: 'var(--chart-revenue-strong)',
  pending: 'var(--status-pending-text)',
  overdue: 'var(--status-overdue-text)',
} as const;

const TRACK = 'var(--border-color)';

type Props = {
  breakdown: InvoiceStatusBreakdown;
  /** Smaller rings for two-column finance layout. */
  variant?: 'default' | 'split';
  /** Date-scoped home dashboard passes this; breakdown is pre-filtered on the server. */
  financeDate?: string;
};

const BASE_SIZE = 280;
/** Finance two-column row: larger than 240 so rings read clearly next to the pie chart. */
const SPLIT_SIZE = 272;

/** Concentric rings: outer = Paid, middle = Pending, inner = Overdue (reference layout). */
export default function InvoiceStatusRadial({
  breakdown,
  variant = 'default',
  financeDate: _financeDate,
}: Props) {
  const { paid, pending, overdue, total } = breakdown;

  const pPaid = total > 0 ? paid / total : 0;
  const pPending = total > 0 ? pending / total : 0;
  const pOverdue = total > 0 ? overdue / total : 0;

  const size = variant === 'split' ? SPLIT_SIZE : BASE_SIZE;
  const k = size / BASE_SIZE;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(1, Math.round(11 * k));
  const rings = [
    { r: Math.round(102 * k), pct: pPaid, color: COLORS.paid, label: 'Paid' },
    { r: Math.round(82 * k), pct: pPending, color: COLORS.pending, label: 'Pending' },
    { r: Math.round(62 * k), pct: pOverdue, color: COLORS.overdue, label: 'Overdue' },
  ];

  const svgInner = (
    <>
      {rings.map((ring) => (
        <Ring
          key={ring.label}
          cx={cx}
          cy={cy}
          strokeWidth={stroke}
          track={TRACK}
          delayMs={ring.label === 'Paid' ? 40 : ring.label === 'Pending' ? 180 : 320}
          {...ring}
        />
      ))}
    </>
  );

  const chartAndLegend = (
    <>
      <div className="invoice-status-radial__chart-wrap">
        {variant === 'split' ? (
          <div className="invoice-status-radial__svg-wrap invoice-status-radial__svg-wrap--split">
            <svg
              className="invoice-status-radial__svg"
              viewBox={`0 0 ${size} ${size}`}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={`Total ${total} invoices: ${paid} paid, ${pending} pending, ${overdue} overdue`}
            >
              {svgInner}
            </svg>
          </div>
        ) : (
          <svg
            className="invoice-status-radial__svg"
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            role="img"
            aria-label={`Total ${total} invoices: ${paid} paid, ${pending} pending, ${overdue} overdue`}
          >
            {svgInner}
          </svg>
        )}
        <div className="invoice-status-radial__center">
          <span className="invoice-status-radial__center-num">{total}</span>
          <span className="invoice-status-radial__center-label">Total Invoices</span>
        </div>
      </div>

      <ul className="invoice-status-radial__legend">
        <li className="invoice-status-radial__legend-row">
          <span className="invoice-status-radial__swatch" style={{ background: COLORS.paid }} />
          <span className="invoice-status-radial__legend-name" style={{ color: COLORS.paid }}>
            Paid
          </span>
          <span className="invoice-status-radial__legend-val" style={{ color: COLORS.paid }}>
            {paid}
          </span>
        </li>
        <li className="invoice-status-radial__legend-row">
          <span className="invoice-status-radial__swatch" style={{ background: COLORS.pending }} />
          <span className="invoice-status-radial__legend-name" style={{ color: COLORS.pending }}>
            Pending
          </span>
          <span className="invoice-status-radial__legend-val" style={{ color: COLORS.pending }}>
            {pending}
          </span>
        </li>
        <li className="invoice-status-radial__legend-row">
          <span className="invoice-status-radial__swatch" style={{ background: COLORS.overdue }} />
          <span className="invoice-status-radial__legend-name" style={{ color: COLORS.overdue }}>
            Overdue
          </span>
          <span className="invoice-status-radial__legend-val" style={{ color: COLORS.overdue }}>
            {overdue}
          </span>
        </li>
      </ul>
    </>
  );

  if (variant === 'split') {
    return (
      <section
        className="invoice-status-radial invoice-status-radial--split"
        aria-label="Invoice status breakdown"
      >
        <div className="sale-analytics-card">
          <div className="sale-analytics-card__top">
            <h2 className="sale-analytics-card__title">Invoice Status</h2>
          </div>
          <div className="invoice-status-radial__split-body">{chartAndLegend}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="invoice-status-radial" aria-label="Invoice status breakdown">
      <h2 className="invoice-status-radial__heading">Invoice Status</h2>
      <div className="invoice-status-radial__card">{chartAndLegend}</div>
    </section>
  );
}
function Ring({
  cx,
  cy,
  r,
  strokeWidth,
  pct,
  color,
  track,
  delayMs,
}: {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  pct: number;
  color: string;
  track: string;
  delayMs: number;
}) {
  const C = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct)) * C;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={track}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      >
        <animate
          attributeName="stroke-dasharray"
          from={`0 ${C}`}
          to={`${dash} ${C}`}
          dur="950ms"
          begin={`${delayMs}ms`}
          fill="freeze"
        />
      </circle>
    </g>
  );
}

