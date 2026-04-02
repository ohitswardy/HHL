import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import type { Product } from '../../../types';

export function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/inventory', { params: { per_page: 100 } })
      .then((res) => setProducts(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-dark mb-6">Stock Levels</h1>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">On Hand</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Reserved</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Available</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Reorder Level</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => {
                const onHand = p.stock?.quantity_on_hand ?? 0;
                const isLow = onHand <= p.reorder_level;
                return (
                  <tr key={p.id} className={isLow ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3 text-center font-semibold">{onHand}</td>
                    <td className="px-4 py-3 text-center">{p.stock?.quantity_reserved ?? 0}</td>
                    <td className="px-4 py-3 text-center font-semibold">{p.stock?.available_quantity ?? 0}</td>
                    <td className="px-4 py-3 text-center">{p.reorder_level}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={isLow ? 'danger' : 'success'}>{isLow ? 'Low Stock' : 'OK'}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
