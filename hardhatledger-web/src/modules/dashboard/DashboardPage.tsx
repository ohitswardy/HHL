import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { HiCash, HiClipboardList, HiExclamation, HiUserGroup, HiCube } from 'react-icons/hi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../lib/api';
import type { DashboardSummary } from '../../types';
import dayjs from 'dayjs';

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then((res) => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" />;
  if (!data) return <p style={{ color: 'var(--n-text-secondary)' }}>Failed to load dashboard.</p>;

  const cards = [
    { label: "Today's Sales", value: `${data.todays_sales.toLocaleString('en', { minimumFractionDigits: 2 })}`, icon: <HiCash className="w-6 h-6" />, color: 'var(--n-success)', glow: 'var(--n-success-glow)' },
    { label: 'Pending POs', value: data.pending_pos, icon: <HiClipboardList className="w-6 h-6" />, color: 'var(--n-info)', glow: 'var(--n-info-glow)' },
    { label: 'Low Stock Alerts', value: data.low_stock_count, icon: <HiExclamation className="w-6 h-6" />, color: 'var(--n-danger)', glow: 'var(--n-danger-glow)' },
    { label: 'Total Clients', value: data.total_clients, icon: <HiUserGroup className="w-6 h-6" />, color: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.15)' },
    { label: 'Active Products', value: data.total_products, icon: <HiCube className="w-6 h-6" />, color: 'var(--n-accent)', glow: 'var(--n-accent-glow)' },
  ];

  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: '1.5rem' }}>Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {cards.map((card) => (
          <Card key={card.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="neu-label" style={{ marginBottom: '0.25rem' }}>{card.label}</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--n-text)', fontFamily: 'var(--n-font-display)' }}>{card.value}</p>
              </div>
              <div className="neu-stat-icon" style={{ color: card.color, background: card.glow }}>{card.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h2 className="neu-section-title" style={{ marginBottom: '1rem' }}>Sales Trend (7 Days)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.sales_trend}>
              <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('MMM D')} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString('en', { minimumFractionDigits: 2 }) : v} />
              <Bar dataKey="total" fill="#F5A623" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h2 className="neu-section-title" style={{ marginBottom: '1rem' }}>Recent Transactions</h2>
          <div className="space-y-3">
            {data.recent_transactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--n-divider)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--n-text)' }}>{tx.transaction_number}</p>
                  <p className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>{tx.client}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color: 'var(--n-text)' }}>{tx.total_amount.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
                  <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'voided' ? 'danger' : 'warning'}>
                    {tx.status}
                  </Badge>
                </div>
              </div>
            ))}
            {data.recent_transactions.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--n-text-dim)' }}>No transactions yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
