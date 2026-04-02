import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import type { InventoryMovement } from '../../../types';
import dayjs from 'dayjs';

export function MovementsPage() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory/movements', { params: { per_page: 50 } })
      .then((res) => setMovements(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" />;

  const typeVariant = (t: string) => t === 'in' ? 'success' : t === 'out' ? 'danger' : 'info';

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-dark mb-6">Inventory Movements</h1>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Qty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{dayjs(m.created_at).format('MMM D, YYYY h:mm A')}</td>
                  <td className="px-4 py-3 font-medium">{m.product?.name}</td>
                  <td className="px-4 py-3 text-center"><Badge variant={typeVariant(m.type)}>{m.type.toUpperCase()}</Badge></td>
                  <td className="px-4 py-3 text-center font-semibold">{m.quantity}</td>
                  <td className="px-4 py-3 text-gray-600">{m.reference_type || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{m.notes || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{m.user?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === 0 && <p className="text-center text-gray-400 py-8">No movements recorded</p>}
        </div>
      </Card>
    </div>
  );
}
