import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import type { PurchaseOrder } from '../../../types';
import dayjs from 'dayjs';

const statusVariant = (s: string) => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = { draft: 'neutral', sent: 'info', partial: 'warning', received: 'success', cancelled: 'danger' };
  return map[s] || 'neutral';
};

export function PurchaseOrdersPage() {
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/purchase-orders', { params: { per_page: 50 } }).then((res) => setPOs(res.data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-dark mb-6">Purchase Orders</h1>
      <Card>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 border-b"><tr>
          <th className="text-left px-4 py-3 font-medium text-gray-600">PO #</th>
          <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
          <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
          <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
          <th className="text-left px-4 py-3 font-medium text-gray-600">Expected</th>
          <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
        </tr></thead><tbody className="divide-y">{pos.map((po) => (
          <tr key={po.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-mono text-xs font-medium">{po.po_number}</td>
            <td className="px-4 py-3">{po.supplier?.name}</td>
            <td className="px-4 py-3 text-center"><Badge variant={statusVariant(po.status)}>{po.status}</Badge></td>
            <td className="px-4 py-3 text-right font-semibold">{po.total_amount.toFixed(2)}</td>
            <td className="px-4 py-3 text-gray-600">{po.expected_date ? dayjs(po.expected_date).format('MMM D, YYYY') : '-'}</td>
            <td className="px-4 py-3 text-gray-600">{dayjs(po.created_at).format('MMM D, YYYY')}</td>
          </tr>
        ))}</tbody></table></div>
        {pos.length === 0 && <p className="text-center text-gray-400 py-8">No purchase orders yet</p>}
      </Card>
    </div>
  );
}
