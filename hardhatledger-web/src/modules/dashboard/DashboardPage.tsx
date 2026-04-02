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
  if (!data) return <p className="text-gray-500">Failed to load dashboard.</p>;

  const cards = [
    { label: "Today's Sales", value: `${data.todays_sales.toLocaleString('en', { minimumFractionDigits: 2 })}`, icon: <HiCash className="w-6 h-6" />, color: 'text-green-600 bg-green-50' },
    { label: 'Pending POs', value: data.pending_pos, icon: <HiClipboardList className="w-6 h-6" />, color: 'text-blue-600 bg-blue-50' },
    { label: 'Low Stock Alerts', value: data.low_stock_count, icon: <HiExclamation className="w-6 h-6" />, color: 'text-red-600 bg-red-50' },
    { label: 'Total Clients', value: data.total_clients, icon: <HiUserGroup className="w-6 h-6" />, color: 'text-purple-600 bg-purple-50' },
    { label: 'Active Products', value: data.total_products, icon: <HiCube className="w-6 h-6" />, color: 'text-navy bg-navy/5' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-dark mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {cards.map((card) => (
          <Card key={card.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-bold text-navy-dark mt-1">{card.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${card.color}`}>{card.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold text-navy-dark mb-4">Sales Trend (7 Days)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.sales_trend}>
              <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('MMM D')} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString('en', { minimumFractionDigits: 2 }) : v} />
              <Bar dataKey="total" fill="#F5A623" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-navy-dark mb-4">Recent Transactions</h2>
          <div className="space-y-3">
            {data.recent_transactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{tx.transaction_number}</p>
                  <p className="text-xs text-gray-500">{tx.client}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{tx.total_amount.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
                  <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'voided' ? 'danger' : 'warning'}>
                    {tx.status}
                  </Badge>
                </div>
              </div>
            ))}
            {data.recent_transactions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No transactions yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
