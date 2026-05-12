'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, type PieLabelRenderProps } from 'recharts';
import { formatGhs } from '@/lib/formatGhs';
import type { TopSellingLimit, TopSellingProduct, TopSellingSort } from '@/lib/topSellingProducts';

/** Sale Analytics reference palette — orange, purple, teal first, then extended */
const SEGMENT_COLORS = [
  '#f97316',
  '#9333ea',
  '#06b6d4',
  'var(--accent-primary)',
  'var(--accent-hover)',
  '#ec4899',
  '#eab308',
  'var(--chart-5)',
  '#14b8a6',
  '#f43f5e',
];

const FULL = {
  chartW: 720,
  chartH: 440,
  innerR: 88,
  outerR: 132,
} as const;

/**
 * Split layout base — actual SVG size follows measured shell width (ResizeObserver)
 * so the overlay and pie share the same box (no center drift or clipping).
 */
/** Split layout: wide enough SVG + margins so callout labels are not clipped */
const SPLIT_BASE = {
  chartW: 700,
  chartH: 464,
  innerR: 83,
  outerR: 125,
} as const;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Word-wrap for SVG <text> (no native wrap). Greedy lines, then merge overflow into last line with ellipsis. */
function wrapLabelText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let buf = '';

  for (const word of words) {
    const candidate = buf ? `${buf} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      buf = candidate;
    } else if (buf) {
      lines.push(buf);
      buf = word.length > maxCharsPerLine ? truncate(word, maxCharsPerLine) : word;
    } else {
      lines.push(truncate(word, maxCharsPerLine));
      buf = '';
    }
  }
  if (buf) lines.push(buf);

  if (lines.length <= maxLines) return lines.length ? lines : [truncate(text, maxCharsPerLine)];
  const head = lines.slice(0, maxLines - 1);
  const tail = lines.slice(maxLines - 1).join(' ');
  head.push(truncate(tail, maxCharsPerLine));
  return head;
}

function formatQty(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  if (Math.abs(v - Math.round(v)) < 1e-6) return `${Math.round(v)}`;
  return v.toLocaleString('en-GH', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

type LabelPayload = {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
  value: number;
  fill: string;
  sort: TopSellingSort;
  /** Tighter callouts + shorter copy so labels fit a narrower chart. */
  compact?: boolean;
};

function SaleCalloutLabel(props: LabelPayload) {
  const { cx, cy, midAngle, outerRadius, percent, name, value, fill, sort, compact } = props;
  const pct = Math.round(percent * 1000) / 10;
  const RADIAN = Math.PI / 180;
  const cos = Math.cos(-RADIAN * midAngle);
  const sin = Math.sin(-RADIAN * midAngle);
  const elbow = compact ? 16 : 26;
  const edge = compact ? 5 : 6;
  const sx = cx + (outerRadius + edge) * cos;
  const sy = cy + (outerRadius + edge) * sin;
  const mx = cx + (outerRadius + elbow) * cos;
  const my = cy + (outerRadius + elbow) * sin;
  const sign = cos >= 0 ? 1 : -1;
  const horiz = compact ? 32 : Math.min(96, 72 + name.length * 0.35);
  const tx = mx + sign * horiz;
  const ty = my;
  const textAnchor = sign > 0 ? 'start' : 'end';
  const valueStr = sort === 'revenue' ? formatGhs(value, 0) : `${formatQty(value)} units`;
  const pctSize = compact ? 13.5 : 15;
  const nameSize = compact ? 11 : 11.5;
  const valSize = compact ? 10 : 10.5;
  const nameLineH = compact ? 12 : 13;
  const valLineH = compact ? 11 : 12;
  const nameLines = compact
    ? wrapLabelText(name, 14, 3)
    : wrapLabelText(name, 22, 4);
  const valueLines = compact
    ? wrapLabelText(valueStr, 16, 2)
    : wrapLabelText(valueStr, 26, 2);
  const valueStartY = ty + 8 + nameLines.length * nameLineH + 4;

  return (
    <g className="sale-callout">
      <polyline
        points={`${sx},${sy} ${mx},${my} ${tx},${ty}`}
        fill="none"
        stroke={fill}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={tx}
        y={ty - 10}
        textAnchor={textAnchor}
        fill={fill}
        fontSize={pctSize}
        fontWeight={700}
        letterSpacing="-0.02em"
      >
        {pct}%
      </text>
      {nameLines.map((line, i) => (
        <text
          key={`name-${i}`}
          x={tx}
          y={ty + 8 + i * nameLineH}
          textAnchor={textAnchor}
          fill="#64748b"
          fontSize={nameSize}
          fontWeight={500}
        >
          {line}
        </text>
      ))}
      {valueLines.map((line, i) => (
        <text
          key={`val-${i}`}
          x={tx}
          y={valueStartY + i * valLineH}
          textAnchor={textAnchor}
          fill="#94a3b8"
          fontSize={valSize}
          fontWeight={500}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

type Props = {
  initialProducts: TopSellingProduct[];
  /** `split`: smaller chart for two-column finance layout. */
  layout?: 'full' | 'split';
};

type PropsWithDate = Props & {
  /** When set, refetches include this YYYY-MM-DD (invoice issue date scope). */
  financeDate?: string;
};

export default function TopSellingProductsCard({
  initialProducts,
  layout = 'full',
  financeDate,
}: PropsWithDate) {
  const [sort, setSort] = useState<TopSellingSort>('revenue');
  const [limit, setLimit] = useState<TopSellingLimit>(10);
  const [products, setProducts] = useState<TopSellingProduct[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [openSort, setOpenSort] = useState(false);
  const [openLimit, setOpenLimit] = useState(false);
  const skipFetchRef = useRef(true);
  const pieShellRef = useRef<HTMLDivElement>(null);
  const sortDdRef = useRef<HTMLDivElement>(null);
  const limitDdRef = useRef<HTMLDivElement>(null);
  const [splitShellW, setSplitShellW] = useState<number>(SPLIT_BASE.chartW);
  const sortListId = useId();
  const limitListId = useId();

  const closeDropdowns = useCallback(() => {
    setOpenSort(false);
    setOpenLimit(false);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (sortDdRef.current?.contains(t)) return;
      if (limitDdRef.current?.contains(t)) return;
      closeDropdowns();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [closeDropdowns]);

  useLayoutEffect(() => {
    if (layout !== 'split') return;
    const el = pieShellRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (!Number.isFinite(w) || w < 40) return;
      setSplitShellW(Math.min(SPLIT_BASE.chartW, Math.floor(w)));
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const q = new URLSearchParams({ sort, limit: String(limit) });
        if (financeDate) q.set('date', financeDate);
        const res = await fetch(`/api/top-selling-products?${q.toString()}`);
        const data = (await res.json()) as { products?: TopSellingProduct[] };
        if (!cancelled && Array.isArray(data.products)) setProducts(data.products);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sort, limit, financeDate]);

  const { chartW, chartH, innerR, outerR } = useMemo(() => {
    if (layout === 'split') {
      const scale = splitShellW / SPLIT_BASE.chartW;
      return {
        chartW: splitShellW,
        chartH: Math.max(220, Math.round(SPLIT_BASE.chartH * scale)),
        innerR: Math.max(24, Math.round(SPLIT_BASE.innerR * scale)),
        outerR: Math.max(38, Math.round(SPLIT_BASE.outerR * scale)),
      };
    }
    return FULL;
  }, [layout, splitShellW]);

  const chartMargin =
    layout === 'split'
      ? { top: 12, right: 72, bottom: 14, left: 26 }
      : { top: 8, right: 8, bottom: 8, left: 8 };

  /** Recharts draws the pie in the margin inset; HTML overlay must shift to match hole center */
  const centerSlotStyle =
    layout === 'split'
      ? {
          transform: `translate(${(chartMargin.left - chartMargin.right) / 2}px, ${(chartMargin.top - chartMargin.bottom) / 2}px)`,
        }
      : undefined;

  const metricSum = useMemo(() => {
    if (products.length === 0) return 0;
    return sort === 'revenue'
      ? products.reduce((s, p) => s + p.totalRevenue, 0)
      : products.reduce((s, p) => s + p.totalQuantity, 0);
  }, [products, sort]);

  const chartData = useMemo(() => {
    if (products.length === 0) return [];
    const sum =
      sort === 'revenue'
        ? products.reduce((s, p) => s + p.totalRevenue, 0)
        : products.reduce((s, p) => s + p.totalQuantity, 0);
    if (sum <= 0) return [];
    return products.map((p, i) => ({
      name: p.productName,
      value: sort === 'revenue' ? p.totalRevenue : p.totalQuantity,
      fill: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    }));
  }, [products, sort]);

  const centerSub = sort === 'revenue'
    ? `Top ${limit} revenue`
    : `Top ${limit} quantity`;
  const sortLabel = sort === 'revenue' ? 'Revenue' : 'Quantity';
  const limitLabel = limit === 10 ? 'Top 10' : 'Top 5';
  const revenueAmountDisplay = useMemo(() => {
    if (sort !== 'revenue') return '';
    return metricSum.toLocaleString('en-GH', {
      maximumFractionDigits: metricSum >= 1000 ? 0 : 2,
      minimumFractionDigits: 0,
    });
  }, [sort, metricSum]);

  const labelRenderer = (props: PieLabelRenderProps) => {
    const cx = Number(props.cx ?? 0);
    const cy = Number(props.cy ?? 0);
    const midAngle = Number(props.midAngle ?? 0);
    const innerRadius = Number(props.innerRadius ?? innerR);
    const outerRadius = Number(props.outerRadius ?? outerR);
    const percent = Number(props.percent ?? 0);
    const index = Number(props.index ?? 0);
    const name = String(props.name ?? '');
    const value = Number(props.value ?? 0);
    const fill = String(
      chartData[index]?.fill ?? SEGMENT_COLORS[index % SEGMENT_COLORS.length],
    );
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
    return (
      <SaleCalloutLabel
        cx={cx}
        cy={cy}
        midAngle={midAngle}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        percent={percent}
        name={name}
        value={value}
        fill={fill}
        sort={sort}
        compact={layout === 'split'}
      />
    );
  };

  return (
    <div
      className={`sale-analytics-card ${loading ? 'sale-analytics-card--loading' : ''} ${layout === 'split' ? 'sale-analytics-card--split' : ''}`}
    >
      <div className="sale-analytics-card__top">
        <h2 className="sale-analytics-card__title">Top Selling Products</h2>
        <div className="sale-analytics-card__head-actions">
          <div
            className="sale-analytics-card__controls sale-analytics-card__pill-dds"
            role="toolbar"
            aria-label="Chart options"
          >
            <div className="invoice-total-dd" ref={sortDdRef}>
              <button
                type="button"
                className={`invoice-total-dd__trigger ${openSort ? 'is-open' : ''}`}
                aria-expanded={openSort}
                aria-haspopup="listbox"
                aria-controls={sortListId}
                onClick={() => {
                  setOpenLimit(false);
                  setOpenSort((o) => !o);
                }}
              >
                <span className="invoice-total-dd__value">{sortLabel}</span>
                <ChevronDown className="invoice-total-dd__chevron" size={14} strokeWidth={2.5} aria-hidden />
              </button>
              {openSort ? (
                <ul id={sortListId} className="invoice-total-dd__list" role="listbox">
                  <li className="invoice-total-dd__item" role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={sort === 'revenue'}
                      className={`invoice-total-dd__option ${sort === 'revenue' ? 'is-selected' : ''}`}
                      onClick={() => {
                        setSort('revenue');
                        closeDropdowns();
                      }}
                    >
                      Revenue
                    </button>
                  </li>
                  <li className="invoice-total-dd__item" role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={sort === 'quantity'}
                      className={`invoice-total-dd__option ${sort === 'quantity' ? 'is-selected' : ''}`}
                      onClick={() => {
                        setSort('quantity');
                        closeDropdowns();
                      }}
                    >
                      Quantity
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>

            <div className="invoice-total-dd" ref={limitDdRef}>
              <button
                type="button"
                className={`invoice-total-dd__trigger ${openLimit ? 'is-open' : ''}`}
                aria-expanded={openLimit}
                aria-haspopup="listbox"
                aria-controls={limitListId}
                onClick={() => {
                  setOpenSort(false);
                  setOpenLimit((o) => !o);
                }}
              >
                <span className="invoice-total-dd__value">{limitLabel}</span>
                <ChevronDown className="invoice-total-dd__chevron" size={14} strokeWidth={2.5} aria-hidden />
              </button>
              {openLimit ? (
                <ul id={limitListId} className="invoice-total-dd__list" role="listbox">
                  <li className="invoice-total-dd__item" role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={limit === 5}
                      className={`invoice-total-dd__option ${limit === 5 ? 'is-selected' : ''}`}
                      onClick={() => {
                        setLimit(5);
                        closeDropdowns();
                      }}
                    >
                      Top 5
                    </button>
                  </li>
                  <li className="invoice-total-dd__item" role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={limit === 10}
                      className={`invoice-total-dd__option ${limit === 10 ? 'is-selected' : ''}`}
                      onClick={() => {
                        setLimit(10);
                        closeDropdowns();
                      }}
                    >
                      Top 10
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="sale-analytics-card__empty">No invoice line items yet.</p>
      ) : chartData.length === 0 ? (
        <p className="sale-analytics-card__empty">No measurable amounts for this view.</p>
      ) : (
        <div className="sale-analytics-card__chart-wrap">
          <div
            className="sale-analytics-card__pie-shell"
            ref={layout === 'split' ? pieShellRef : undefined}
          >
            <PieChart
              width={chartW}
              height={chartH}
              margin={chartMargin}
              className="sale-analytics-card__pie-svg"
              accessibilityLayer={false}
            >
              <Tooltip
                formatter={(v) => {
                  const n = typeof v === 'number' ? v : Number(v);
                  const x = Number.isFinite(n) ? n : 0;
                  return sort === 'revenue' ? formatGhs(x, 0) : formatQty(x);
                }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  boxShadow: 'var(--shadow-md)',
                }}
                labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={innerR}
                outerRadius={outerR}
                paddingAngle={4}
                cornerRadius={11}
                stroke="none"
                strokeWidth={0}
                labelLine={false}
                label={labelRenderer}
                isAnimationActive
                rootTabIndex={-1}
              >
                {chartData.map((entry, i) => (
                  <Cell key={`c-${entry.name}-${i}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
            <div className="sale-analytics-card__center-slot" style={centerSlotStyle} aria-hidden>
              <div className="sale-analytics-card__center">
                {sort === 'revenue' ? (
                  <>
                    <span className="sale-analytics-card__center-curr">GHS</span>
                    <span className="sale-analytics-card__center-amount">{revenueAmountDisplay}</span>
                    <span className="sale-analytics-card__center-sub">{centerSub}</span>
                  </>
                ) : (
                  <>
                    <span className="sale-analytics-card__center-main">{formatQty(metricSum)}</span>
                    <span className="sale-analytics-card__center-sub">{centerSub}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
