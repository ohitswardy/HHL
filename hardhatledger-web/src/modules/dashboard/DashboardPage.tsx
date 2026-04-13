import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import {
  HiCurrencyDollar,
  HiClipboardList,
  HiExclamationCircle,
  HiUserGroup,
  HiCube,
  HiRefresh,
  HiArrowSmUp,
  HiArrowSmDown,
  HiTrendingUp,
  HiShoppingCart,
  HiClock,
  HiCheckCircle,
  HiXCircle,
  HiTruck,
  HiCollection,
  HiExclamation,
} from 'react-icons/hi';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  type BarShapeProps,
} from 'recharts';
import api from '../../lib/api';
import type { DashboardSummary } from '../../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `₱${(value / 1_000).toFixed(1)}K`;
  return `₱${value.toLocaleString('en', { minimumFractionDigits: 2 })}`;
}

function formatFull(value: number): string {
  return `₱${value.toLocaleString('en', { minimumFractionDigits: 2 })}`;
}

// ── Animated counter hook ──────────────────────────────────────────────────

function useAnimatedCounter(target: number, duration = 1200): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const startValRef = useRef(0);

  useEffect(() => {
    startRef.current = null;
    startValRef.current = count;

    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(startValRef.current + (target - startValRef.current) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return count;
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 32;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * h,
  }));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1]!.x} cy={pts[pts.length - 1]!.y} r="3" fill={color} />
    </svg>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="neu-card-flat" style={{ padding: '10px 14px', minWidth: 140 }}>
      <p style={{ fontSize: '0.7rem', color: 'var(--n-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label ? dayjs(label).format('ddd, MMM D') : ''}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--n-text)', fontFamily: 'var(--n-font-mono)' }}>
          {formatFull(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  isCurrency?: boolean;
  icon: React.ReactNode;
  color: string;
  glow: string;
  trend?: number[];
  delta?: number;
  suffix?: string;
  onClick?: () => void;
}

function KpiCard({ label, value, isCurrency, icon, color, glow, trend, delta, onClick }: KpiCardProps) {
  const animated = useAnimatedCounter(isCurrency ? Math.round(value) : value);
  const displayValue = isCurrency ? formatCurrency(animated) : animated.toLocaleString();
  const deltaUp = delta !== undefined && delta >= 0;

  return (
    <div
      className="neu-card"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.12s ease, box-shadow 0.12s ease' }}
      onMouseEnter={onClick ? (e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; } : undefined}
      onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; } : undefined}
    >
      {/* accent glow blob */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: glow,
          filter: 'blur(24px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="neu-label" style={{ marginBottom: '0.5rem' }}>{label}</p>
          <p
            style={{
              fontFamily: 'var(--n-font-display)',
              fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
              fontWeight: 700,
              color: 'var(--n-text)',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {displayValue}
          </p>
          {delta !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6 }}>
              {deltaUp ? (
                <HiArrowSmUp style={{ color: 'var(--n-success)', width: 14, height: 14, flexShrink: 0 }} />
              ) : (
                <HiArrowSmDown style={{ color: 'var(--n-danger)', width: 14, height: 14, flexShrink: 0 }} />
              )}
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: deltaUp ? 'var(--n-success)' : 'var(--n-danger)',
                  fontFamily: 'var(--n-font-mono)',
                }}
              >
                {deltaUp ? '+' : ''}{delta.toFixed(1)}% vs yesterday
              </span>
            </div>
          )}
        </div>
        <div
          className="neu-stat-icon"
          style={{ color, background: glow, flexShrink: 0 }}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      {trend && trend.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <Sparkline data={trend} color={color} />
        </div>
      )}
    </div>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    completed: 'var(--n-success)',
    voided: 'var(--n-danger)',
    refunded: 'var(--n-warning)',
    pending: 'var(--n-info)',
  };
  const color = colorMap[status] ?? 'var(--n-text-dim)';
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}`,
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}

// ── Transaction icon ───────────────────────────────────────────────────────

function TxIcon({ status }: { status: string }) {
  if (status === 'completed') return <HiCheckCircle style={{ color: 'var(--n-success)', width: 18, height: 18 }} />;
  if (status === 'voided') return <HiXCircle style={{ color: 'var(--n-danger)', width: 18, height: 18 }} />;
  return <HiClock style={{ color: 'var(--n-info)', width: 18, height: 18 }} />;
}

// ── Recent Transactions Panel ──────────────────────────────────────────────

interface RecentTx {
  id: number;
  transaction_number: string;
  client: string;
  user: string;
  total_amount: number;
  status: string;
  created_at: string;
}

function RecentTransactionsPanel({ transactions }: { transactions: RecentTx[] }) {
  const navigate = useNavigate();
  return (
    <Card className="p-6">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 className="neu-section-title" style={{ margin: 0 }}>Recent Transactions</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="neu-btn neu-btn-secondary"
            onClick={() => navigate('/pos/transactions')}
            style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            View All
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="neu-stat-icon" style={{ color: 'var(--n-accent)', background: 'var(--n-accent-glow)', width: 32, height: 32, borderRadius: 10 }} aria-hidden="true">
            <HiShoppingCart style={{ width: 16, height: 16 }} />
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--n-text-dim)' }}>
          <HiShoppingCart style={{ width: 32, height: 32, margin: '0 auto 0.5rem', display: 'block', opacity: 0.4 }} />
          <p style={{ fontSize: '0.875rem', margin: 0 }}>No transactions yet today</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {transactions.slice(0, 10).map((tx) => (
            <div
              key={tx.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate('/pos/transactions')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/pos/transactions'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                transition: 'background 0.15s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'var(--n-table-row-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              <TxIcon status={tx.status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-text)', margin: 0, fontFamily: 'var(--n-font-mono)', letterSpacing: '0.02em' }}>
                  {tx.transaction_number}
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--n-text-secondary)', margin: 0, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tx.client} · {dayjs(tx.created_at).fromNow()}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--n-text)', margin: 0, fontFamily: 'var(--n-font-mono)' }}>
                  {formatFull(tx.total_amount)}
                </p>
                <Badge
                  variant={
                    tx.status === 'completed'
                      ? 'success'
                      : tx.status === 'voided'
                      ? 'danger'
                      : tx.status === 'refunded'
                      ? 'warning'
                      : 'info'
                  }
                >
                  {tx.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Sales Trend Chart ──────────────────────────────────────────────────────

interface TrendPoint {
  date: string;
  total: number;
  count: number;
}

type TrendPeriod = 7 | 14 | 30;

const TREND_PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: 7, label: '7D' },
  { value: 14, label: '14D' },
  { value: 30, label: '30D' },
];

function PeriodToggle({ active, onChange }: { active: TrendPeriod; onChange: (p: TrendPeriod) => void }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--n-inset)',
        borderRadius: 8,
        padding: 2,
        gap: 2,
      }}
    >
      {TREND_PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          style={{
            padding: '4px 10px',
            fontSize: '0.7rem',
            fontWeight: 600,
            fontFamily: 'var(--n-font-mono)',
            letterSpacing: '0.04em',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            color: active === p.value ? 'var(--n-text)' : 'var(--n-text-dim)',
            background: active === p.value ? 'var(--n-surface)' : 'transparent',
            boxShadow: active === p.value ? 'var(--n-shadow-sm)' : 'none',
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function SalesTrendChart({ data: initialData }: { data: TrendPoint[] }) {
  const [period, setPeriod] = useState<TrendPeriod>(7);
  const [fetchedData, setFetchedData] = useState<TrendPoint[] | null>(null);
  const [loadingTrend, setLoadingTrend] = useState(false);

  // When period is 7, use parent data directly; otherwise use fetched data
  const trendData = period === 7 ? initialData : (fetchedData ?? initialData);

  const handlePeriodChange = useCallback((newPeriod: TrendPeriod) => {
    setPeriod(newPeriod);
    if (newPeriod === 7) {
      setFetchedData(null);
      return;
    }
    setLoadingTrend(true);
    api
      .get<DashboardSummary>('/dashboard', { params: { sales_trend_days: newPeriod } })
      .then((res) => setFetchedData(res.data.sales_trend))
      .catch(() => {})
      .finally(() => setLoadingTrend(false));
  }, []);

  const max = Math.max(...trendData.map((d) => d.total), 1);

  return (
    <Card className="p-6">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 className="neu-section-title" style={{ margin: 0 }}>Sales Trend</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--n-text-secondary)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Last {period} days · completed orders
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PeriodToggle active={period} onChange={handlePeriodChange} />
          <div className="neu-stat-icon" style={{ color: 'var(--n-accent)', background: 'var(--n-accent-glow)', width: 32, height: 32, borderRadius: 10 }} aria-hidden="true">
            <HiTrendingUp style={{ width: 16, height: 16 }} />
          </div>
        </div>
      </div>

      <div aria-label={`Sales trend chart for the last ${period} days`} style={{ position: 'relative' }}>
        {loadingTrend && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: 8, zIndex: 2 }}>
            <Spinner size="sm" />
          </div>
        )}
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F5A623" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#F5A623" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--n-divider)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => dayjs(d).format('MMM D')}
              fontSize={11}
              tick={{ fill: 'var(--n-text-secondary)', fontFamily: 'var(--n-font-body)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatCurrency(v)}
              fontSize={11}
              tick={{ fill: 'var(--n-text-secondary)', fontFamily: 'var(--n-font-body)' }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={max * 0.5} stroke="var(--n-divider)" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#F5A623"
              strokeWidth={2.5}
              fill="url(#salesGrad)"
              dot={{ r: 4, fill: '#F5A623', strokeWidth: 2, stroke: 'var(--n-surface)' }}
              activeDot={{ r: 6, fill: '#F5A623', stroke: 'var(--n-surface)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── Metrics Ring ──────────────────────────────────────────────────────────

interface RingSegment {
  value: number;
  color: string;
  label: string;
}

function MetricsRing({
  segments,
  size,
  centerLabel,
}: {
  segments: RingSegment[];
  size: number;
  centerLabel: string;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  // build cumulative offsets
  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const fraction = seg.value / total;
    const dashLen = fraction * circumference;
    const offset = circumference - cumulative * circumference;
    cumulative += fraction;
    return { ...seg, dashLen, offset };
  });

  // gap between segments (in svg units)
  const gap = 4;

  const cx = size / 2;
  const cy = size / 2;
  // start from top (-90°)
  const startAngle = -Math.PI / 2;

  // pre-compute arc paths for each segment
  function polarToCartesian(angle: number) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }

  function arcPath(startA: number, endA: number) {
    const s = polarToCartesian(startA);
    const e = polarToCartesian(endA);
    const large = endA - startA > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const gapAngle = gap / radius;
  let anglePtr = startAngle;
  const paths = arcs.map((seg) => {
    const sweepAngle = (seg.value / total) * 2 * Math.PI;
    const pathStart = anglePtr + gapAngle / 2;
    const pathEnd = anglePtr + sweepAngle - gapAngle / 2;
    anglePtr += sweepAngle;
    return { ...seg, pathStart, pathEnd, sweepAngle };
  });

  const totalAnimated = useAnimatedCounter(total, 900);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Business overview ring: ${total} total entities`}
      style={{ overflow: 'visible' }}
    >
      {/* track */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="var(--n-divider)"
        strokeWidth={strokeWidth}
      />
      {/* segments */}
      {paths.map((seg, i) =>
        seg.sweepAngle > gapAngle ? (
          <path
            key={i}
            d={arcPath(seg.pathStart, seg.pathEnd)}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${seg.color}44)` }}
          />
        ) : null
      )}
      {/* center text */}
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontFamily: 'var(--n-font-display)',
          fontSize: 26,
          fontWeight: 700,
          fill: 'var(--n-text)',
        }}
      >
        {totalAnimated}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontFamily: 'var(--n-font-body)',
          fontSize: 10,
          fill: 'var(--n-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {centerLabel}
      </text>
    </svg>
  );
}

// ── Business Overview Card ─────────────────────────────────────────────────

interface BusinessOverviewProps {
  totalProducts: number;
  totalClients: number;
  totalSuppliers: number;
  totalCategories: number;
}

function BusinessOverviewCard({
  totalProducts,
  totalClients,
  totalSuppliers,
  totalCategories,
}: BusinessOverviewProps) {
  const navigate = useNavigate();
  const segments: RingSegment[] = [
    { label: 'Products',   value: totalProducts,   color: 'var(--n-accent)' },
    { label: 'Clients',    value: totalClients,    color: '#3B82F6' },
    { label: 'Suppliers',  value: totalSuppliers,  color: 'var(--n-success)' },
    { label: 'Categories', value: totalCategories, color: '#8B5CF6' },
  ];

  const metrics = [
    { icon: <HiCube style={{ width: 14, height: 14 }} />,       label: 'Products',   value: totalProducts,   color: 'var(--n-accent)',   href: '/inventory' },
    { icon: <HiUserGroup style={{ width: 14, height: 14 }} />,  label: 'Clients',    value: totalClients,    color: '#3B82F6',            href: '/clients' },
    { icon: <HiTruck style={{ width: 14, height: 14 }} />,      label: 'Suppliers',  value: totalSuppliers,  color: 'var(--n-success)',   href: '/suppliers' },
    { icon: <HiCollection style={{ width: 14, height: 14 }} />, label: 'Categories', value: totalCategories, color: '#8B5CF6',            href: '/inventory/categories' },
  ];

  return (
    <Card className="p-6 flex flex-col flex-1">
      {/* header */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h2 className="neu-section-title" style={{ margin: 0 }}>Business Overview</h2>
        <p style={{ fontSize: '0.72rem', color: 'var(--n-text-secondary)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Active entities
        </p>
      </div>

      {/* ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
        <MetricsRing segments={segments} size={180} centerLabel="Entities" />
      </div>

      {/* legend grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
        }}
      >
        {metrics.map((item) => (
          <div
            key={item.label}
            role="button"
            tabIndex={0}
            onClick={() => navigate(item.href)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(item.href); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 8, padding: '4px 6px', transition: 'background 0.15s ease' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--n-table-row-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            <div
              className="neu-stat-icon"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                color: item.color,
                background: `color-mix(in srgb, ${item.color} 12%, transparent)`,
                flexShrink: 0,
              }}
            >
              {item.icon}
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', color: 'var(--n-text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.label}
              </p>
              <p
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--n-text)',
                  margin: 0,
                  fontFamily: 'var(--n-font-mono)',
                  lineHeight: 1.2,
                }}
              >
                {item.value.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Summary metric mini-card ───────────────────────────────────────────────

function MetricRow({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid var(--n-divider)',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: onClick ? 6 : 0,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={onClick ? (e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--n-table-row-hover)'; } : undefined}
      onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; } : undefined}
    >
      <p style={{ fontSize: '0.8rem', color: 'var(--n-text-secondary)', margin: 0 }}>{label}</p>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--n-text)', margin: 0, fontFamily: 'var(--n-font-mono)' }}>{value}</p>
        {sub && <p style={{ fontSize: '0.68rem', color: 'var(--n-text-dim)', margin: 0 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Business Health Panel ──────────────────────────────────────────────────

function BusinessHealthPanel({ data }: { data: DashboardSummary }) {
  const navigate = useNavigate();
  const totalTrend = data.sales_trend.reduce((a, b) => a + b.total, 0);
  const totalOrders = data.sales_trend.reduce((a, b) => a + b.count, 0);
  const avgOrder = totalOrders > 0 ? totalTrend / totalOrders : 0;
  const healthScore = Math.min(
    100,
    Math.round(
      (data.low_stock_count === 0 ? 30 : Math.max(0, 30 - data.low_stock_count * 3)) +
        (data.pending_pos === 0 ? 20 : Math.max(0, 20 - data.pending_pos * 2)) +
        (totalOrders > 0 ? 30 : 0) +
        (data.total_clients > 0 ? 20 : 0)
    )
  );

  const scoreColor =
    healthScore >= 75
      ? 'var(--n-success)'
      : healthScore >= 45
      ? 'var(--n-warning)'
      : 'var(--n-danger)';

  const circumference = 2 * Math.PI * 36;
  const dash = (healthScore / 100) * circumference;

  return (
    <Card className="p-6">
      <h2 className="neu-section-title" style={{ margin: '0 0 1.25rem' }}>Business Health</h2>

      {/* Score ring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={88} height={88} viewBox="0 0 88 88" aria-label={`Health score: ${healthScore}/100`}>
            <circle cx={44} cy={44} r={36} fill="none" stroke="var(--n-divider)" strokeWidth={8} />
            <circle
              cx={44}
              cy={44}
              r={36}
              fill="none"
              stroke={scoreColor}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={circumference * 0.25}
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: scoreColor, fontFamily: 'var(--n-font-display)', lineHeight: 1 }}>
              {healthScore}
            </span>
            <span style={{ fontSize: '0.6rem', color: 'var(--n-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              /100
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: scoreColor, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {healthScore >= 75 ? 'Excellent' : healthScore >= 45 ? 'Fair' : 'Needs Attention'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--n-text-secondary)', margin: 0, lineHeight: 1.4 }}>
            {data.low_stock_count > 0
              ? `${data.low_stock_count} product${data.low_stock_count > 1 ? 's' : ''} below reorder level`
              : 'Stock levels healthy'}
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ borderTop: '1px solid var(--n-divider)' }}>
        <MetricRow label="7-Day Revenue" value={formatFull(totalTrend)} />
        <MetricRow label="Total Orders (7d)" value={totalOrders.toLocaleString()} onClick={() => navigate('/pos/transactions')} />
        <MetricRow label="Avg. Order Value" value={formatFull(avgOrder)} />
        <MetricRow label="Pending POs" value={data.pending_pos.toString()} sub={data.pending_pos > 0 ? 'Action needed' : 'All clear'} onClick={() => navigate('/purchase-orders')} />
        <MetricRow label="Low Stock Items" value={data.low_stock_count.toString()} sub={data.low_stock_count > 0 ? 'Review inventory' : 'Healthy'} onClick={() => navigate('/inventory/stock')} />
      </div>
    </Card>
  );
}

// ── Fulfillment Mix (derived from transactions) ────────────────────────────

function FulfillmentMiniChart({ transactions }: { transactions: RecentTx[] }) {
  const byStatus = transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.status] = (acc[tx.status] ?? 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(byStatus).map(([status, count]) => ({ status, count }));

  if (chartData.length === 0) return null;

  const colorMap: Record<string, string> = {
    completed: 'var(--n-success)',
    voided: 'var(--n-danger)',
    refunded: 'var(--n-warning)',
    pending: 'var(--n-info)',
  };

  return (
    <Card className="p-6">
      <h2 className="neu-section-title" style={{ margin: '0 0 1.25rem' }}>Transaction Mix</h2>
      <div aria-label="Transaction status breakdown">
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 24 }}>
            <XAxis type="number" fontSize={11} tick={{ fill: 'var(--n-text-secondary)', fontFamily: 'var(--n-font-body)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="status"
              fontSize={11}
              tick={{ fill: 'var(--n-text-secondary)', fontFamily: 'var(--n-font-body)' }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              formatter={(v) => [String(v), 'Transactions']}
              contentStyle={{
                background: 'var(--n-surface)',
                border: '1px solid var(--n-divider)',
                borderRadius: 12,
                fontSize: '0.8rem',
                fontFamily: 'var(--n-font-body)',
                color: 'var(--n-text)',
              }}
            />
            <Bar
              dataKey="count"
              radius={[0, 6, 6, 0]}
              fill="#8B95A8"
              shape={(props: BarShapeProps & { status?: string }) => {
                const fill = colorMap[props.status ?? ''] ?? '#8B95A8';
                const { x = 0, y = 0, width = 0, height = 0 } = props;
                const r = Math.min(6, height / 2);
                return (
                  <rect
                    x={x}
                    y={y}
                    width={Math.max(width, 0)}
                    height={Math.max(height, 0)}
                    rx={r}
                    ry={r}
                    fill={fill}
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 12 }}>
        {chartData.map((entry) => (
          <div key={entry.status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDot status={entry.status} />
            <span style={{ fontSize: '0.72rem', color: 'var(--n-text-secondary)', textTransform: 'capitalize' }}>
              {entry.status} ({entry.count})
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Revenue Sparkline Strip ────────────────────────────────────────────────

function WeeklyRevenueStrip({ data }: { data: TrendPoint[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <Card className="p-4">
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, marginRight: 8 }}>
        <p className="neu-label" style={{ margin: '0 0 4px' }}>Daily Revenue</p>
        <p style={{ fontSize: '0.72rem', color: 'var(--n-text-dim)', margin: 0 }}>7-day view</p>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 6, height: 48 }}>
        {data.map((d, i) => {
          const pct = max > 0 ? d.total / max : 0;
          const isToday = i === data.length - 1;
          return (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                title={`${dayjs(d.date).format('MMM D')}: ${formatFull(d.total)}`}
                style={{
                  width: '100%',
                  height: `${Math.max(pct * 36, 4)}px`,
                  background: isToday ? 'var(--n-accent)' : 'var(--n-info)',
                  borderRadius: '4px 4px 0 0',
                  opacity: isToday ? 1 : 0.5,
                  transition: 'height 0.6s ease',
                }}
              />
              <span style={{ fontSize: '0.55rem', color: 'var(--n-text-dim)', whiteSpace: 'nowrap' }}>
                {dayjs(d.date).format('D')}
              </span>
            </div>
          );
        })}
      </div>
      </div>
    </Card>
  );
}

// ── Low Stock Panel ────────────────────────────────────────────────────────

interface LowStockItem {
  id: number;
  name: string;
  sku: string;
  quantity_on_hand: number;
  reorder_level: number;
}

function getSeverity(onHand: number, reorder: number): { color: string; label: string } {
  if (onHand === 0) return { color: 'var(--n-danger)', label: 'Out of Stock' };
  const ratio = onHand / (reorder || 1);
  if (ratio <= 0.25) return { color: 'var(--n-danger)', label: 'Critical' };
  if (ratio <= 0.5) return { color: 'var(--n-warning)', label: 'Low' };
  return { color: 'var(--n-accent)', label: 'Warning' };
}

function LowStockPanel({ items, totalCount }: { items: LowStockItem[]; totalCount: number }) {
  const navigate = useNavigate();
  const PAGE_SIZE = 4;
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pageItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card className="p-6 flex flex-col flex-1">
      {/* header — fixed, never scrolls */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexShrink: 0 }}>
        <div>
          <h2 className="neu-section-title" style={{ margin: 0 }}>Low Stock Alerts</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--n-text-secondary)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {totalCount} product{totalCount !== 1 ? 's' : ''} below reorder level
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            className="neu-btn neu-btn-secondary"
            onClick={() => navigate('/inventory/stock')}
            style={{ fontSize: '0.72rem', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            View All
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {totalCount > 0 && (
            <div
              className="neu-stat-icon"
              style={{ width: 36, height: 36, borderRadius: 10, color: 'var(--n-danger)', background: 'var(--n-danger-glow)' }}
              aria-hidden="true"
            >
              <HiExclamation style={{ width: 20, height: 20 }} />
            </div>
          )}
        </div>
      </div>

      {/* list — fixed 4 items */}
      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--n-text-dim)', fontSize: '0.8125rem' }}>
          All products above reorder level
        </div>
      ) : (
        <>
          <div style={{ flex: 1 }}>
            {pageItems.map((item, i) => {
              const severity = getSeverity(item.quantity_on_hand, item.reorder_level);
              const pct = item.reorder_level > 0
                ? Math.min((item.quantity_on_hand / item.reorder_level) * 100, 100)
                : 0;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/inventory/stock')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/inventory/stock'); }}
                  style={{
                    padding: '0.5rem 6px',
                    borderBottom: i < pageItems.length - 1 ? '1px solid var(--n-divider)' : 'none',
                    cursor: 'pointer',
                    borderRadius: 8,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--n-table-row-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  {/* name + badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                    <span
                      title={item.name}
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--n-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '55%',
                      }}
                    >
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: severity.color,
                        background: `color-mix(in srgb, ${severity.color} 12%, transparent)`,
                        padding: '0.125rem 0.5rem',
                        borderRadius: 6,
                        flexShrink: 0,
                      }}
                    >
                      {severity.label}
                    </span>
                  </div>

                  {/* progress bar */}
                  <div style={{ height: 4, borderRadius: 4, background: 'var(--n-divider)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: severity.color,
                        borderRadius: 4,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>

                  {/* sku + qty */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.625rem', fontFamily: 'var(--n-font-mono)', color: 'var(--n-text-dim)' }}>
                      {item.sku}
                    </span>
                    <span style={{ fontSize: '0.625rem', fontFamily: 'var(--n-font-mono)', color: 'var(--n-text-secondary)' }}>
                      {item.quantity_on_hand} / {item.reorder_level}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--n-divider)', flexShrink: 0 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--n-text-dim)', fontFamily: 'var(--n-font-mono)' }}>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, items.length)} of {items.length}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                  aria-label="Previous page"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: '1px solid var(--n-divider)',
                    background: 'var(--n-surface)',
                    color: page === 0 ? 'var(--n-text-dim)' : 'var(--n-text)',
                    cursor: page === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: page === 0 ? 0.4 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M7.5 9L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                  aria-label="Next page"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: '1px solid var(--n-divider)',
                    background: 'var(--n-surface)',
                    color: page >= totalPages - 1 ? 'var(--n-text-dim)' : 'var(--n-text)',
                    cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: page >= totalPages - 1 ? 0.4 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(false);

    api
      .get<DashboardSummary>('/dashboard')
      .then((res) => {
        setData(res.data);
        setLastRefreshed(new Date());
      })
      .catch(() => {
        if (!silent) setError(true);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 60s
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <HiExclamationCircle style={{ width: 40, height: 40, color: 'var(--n-danger)', margin: '0 auto 1rem', display: 'block' }} />
        <p style={{ color: 'var(--n-text-secondary)', marginBottom: '1rem' }}>Failed to load dashboard data.</p>
        <button className="neu-btn neu-btn-primary" onClick={() => load()} style={{ minWidth: 120 }}>
          <HiRefresh style={{ width: 16, height: 16 }} />
          Retry
        </button>
      </div>
    );
  }

  const trendValues = data.sales_trend.map((d) => d.total);

  // Derived: yesterday vs today delta (last two data points)
  const todayTrend = data.sales_trend[data.sales_trend.length - 1];
  const yesterdayTrend = data.sales_trend[data.sales_trend.length - 2];
  const salesDelta =
    todayTrend && yesterdayTrend && yesterdayTrend.total > 0
      ? ((todayTrend.total - yesterdayTrend.total) / yesterdayTrend.total) * 100
      : undefined;

  const kpiCards: KpiCardProps[] = [
    {
      label: "Today's Sales",
      value: data.todays_sales,
      isCurrency: true,
      icon: <HiCurrencyDollar className="w-6 h-6" />,
      color: 'var(--n-success)',
      glow: 'var(--n-success-glow)',
      trend: trendValues,
      delta: salesDelta,
      onClick: () => navigate('/pos/transactions'),
    },
    {
      label: 'Pending POs',
      value: data.pending_pos,
      icon: <HiClipboardList className="w-6 h-6" />,
      color: 'var(--n-info)',
      glow: 'var(--n-info-glow)',
      onClick: () => navigate('/purchase-orders'),
    },
    {
      label: 'Low Stock Alerts',
      value: data.low_stock_count,
      icon: <HiExclamationCircle className="w-6 h-6" />,
      color: data.low_stock_count > 0 ? 'var(--n-danger)' : 'var(--n-success)',
      glow: data.low_stock_count > 0 ? 'var(--n-danger-glow)' : 'var(--n-success-glow)',
      onClick: () => navigate('/inventory/stock'),
    },
    {
      label: 'Total Clients',
      value: data.total_clients,
      icon: <HiUserGroup className="w-6 h-6" />,
      color: '#8B5CF6',
      glow: 'rgba(139,92,246,0.15)',
      onClick: () => navigate('/clients'),
    },
    {
      label: 'Active Products',
      value: data.total_products,
      icon: <HiCube className="w-6 h-6" />,
      color: 'var(--n-accent)',
      glow: 'var(--n-accent-glow)',
      onClick: () => navigate('/inventory'),
    },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="neu-page-title">Dashboard</h1>
          <p style={{ fontSize: '0.72rem', color: 'var(--n-text-dim)', margin: '4px 0 0', fontFamily: 'var(--n-font-mono)' }}>
            {dayjs().format('dddd, MMMM D, YYYY')}
          </p>
        </div>
        <button
          className="neu-btn neu-btn-secondary"
          onClick={() => load(true)}
          disabled={refreshing}
          aria-label="Refresh dashboard data"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', padding: '0.4rem 0.875rem' }}
        >
          <HiRefresh
            style={{
              width: 14,
              height: 14,
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          {refreshing ? 'Refreshing…' : `Updated ${dayjs(lastRefreshed).fromNow()}`}
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div
        className="dash-kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {kpiCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      {/* ── Weekly Revenue Strip ── */}
      {data.sales_trend.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <WeeklyRevenueStrip data={data.sales_trend} />
        </div>
      )}

      {/* ── Main + Secondary unified grid ── */}
      <div
        className="dash-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gridTemplateRows: 'auto auto',
          gap: 20,
          marginBottom: 20,
        }}
      >
        {/* row 1 col 1-2: Sales Trend */}
        <div className="dash-sales-trend" style={{ gridColumn: '1 / 3', gridRow: '1' }}>
          <SalesTrendChart data={data.sales_trend} />
        </div>

        {/* row 1 col 3: Business Health */}
        <div className="dash-biz-health" style={{ gridColumn: '3', gridRow: '1' }}>
          <BusinessHealthPanel data={data} />
        </div>

        {/* row 2 col 1: Transaction Mix */}
        <div className="dash-tx-mix" style={{ gridColumn: '1', gridRow: '2' }}>
          <FulfillmentMiniChart transactions={data.recent_transactions} />
        </div>

        {/* row 2 col 2: Low Stock Alerts */}
        <div className="dash-low-stock" style={{ gridColumn: '2', gridRow: '2', display: 'flex', flexDirection: 'column' }}>
          <LowStockPanel
            items={data.low_stock_items}
            totalCount={data.low_stock_count}
          />
        </div>

        {/* row 2 col 3: Business Overview */}
        <div className="dash-biz-overview" style={{ gridColumn: '3', gridRow: '2', display: 'flex', flexDirection: 'column', alignSelf: 'flex-start' }}>
          <BusinessOverviewCard
            totalProducts={data.total_products}
            totalClients={data.total_clients}
            totalSuppliers={data.total_suppliers}
            totalCategories={data.total_categories}
          />
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <RecentTransactionsPanel transactions={data.recent_transactions} />

      {/* ── Spin keyframe (inline for refresh button) ── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* ── Tablet (≤ 1023px): 2-column layout ── */
        @media (max-width: 1023px) {
          .dash-main-grid {
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: none !important;
          }
          .dash-sales-trend {
            grid-column: 1 / -1 !important;
            grid-row: auto !important;
          }
          .dash-biz-health,
          .dash-tx-mix,
          .dash-low-stock,
          .dash-biz-overview {
            grid-column: auto !important;
            grid-row: auto !important;
            align-self: auto !important;
          }
        }

        /* ── Mobile (≤ 639px): single-column layout ── */
        @media (max-width: 639px) {
          .dash-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .dash-main-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: none !important;
          }
          .dash-sales-trend,
          .dash-biz-health,
          .dash-tx-mix,
          .dash-low-stock,
          .dash-biz-overview {
            grid-column: 1 !important;
            grid-row: auto !important;
            align-self: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
