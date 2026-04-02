import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { HiPlus, HiPencil, HiTrash, HiSearch } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Product, Category, Supplier } from '../../../types';

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [form, setForm] = useState({ name: '', sku: '', description: '', category_id: '', supplier_id: '', unit: 'pc', cost_price: '', base_selling_price: '', reorder_level: '10' });

  const fetchProducts = (page = 1) => {
    setLoading(true);
    api.get('/products', { params: { search, page, per_page: 15 } })
      .then((res) => { setProducts(res.data.data); setMeta(res.data.meta); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, [search]);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.data));
    api.get('/suppliers', { params: { per_page: 100 } }).then((res) => setSuppliers(res.data.data));
  }, []);

  const flatCategories = categories.flatMap((c) => [c, ...(c.children || [])]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', sku: '', description: '', category_id: '', supplier_id: '', unit: 'pc', cost_price: '', base_selling_price: '', reorder_level: '10' });
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku, description: p.description || '', category_id: String(p.category_id || ''), supplier_id: String(p.supplier_id || ''), unit: p.unit, cost_price: String(p.cost_price), base_selling_price: String(p.base_selling_price), reorder_level: String(p.reorder_level) });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = { ...form, category_id: form.category_id || null, supplier_id: form.supplier_id || null, cost_price: parseFloat(form.cost_price), base_selling_price: parseFloat(form.base_selling_price), reorder_level: parseInt(form.reorder_level) };
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product created');
      }
      setModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`);
    toast.success('Product deleted');
    fetchProducts();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy-dark">Products</h1>
        <Button onClick={openCreate} variant="amber"><HiPlus className="w-4 h-4 mr-2" /> Add Product</Button>
      </div>

      <Card className="p-4 mb-4">
        <div className="relative">
          <HiSearch className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          <input className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" placeholder="Search products by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Cost</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Selling</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Stock</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.category?.name || '-'}</td>
                    <td className="px-4 py-3 text-right">{p.cost_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{p.base_selling_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${(p.stock?.quantity_on_hand ?? 0) <= p.reorder_level ? 'text-red-600' : 'text-green-600'}`}>
                        {p.stock?.quantity_on_hand ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={p.is_active ? 'success' : 'neutral'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><HiPencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600 ml-1"><HiTrash className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && <p className="text-center text-gray-400 py-8">No products found</p>}
          </div>
        )}
        {meta.last_page > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t">
            {Array.from({ length: meta.last_page }, (_, i) => (
              <button key={i} onClick={() => fetchProducts(i + 1)} className={`px-3 py-1 rounded text-sm ${meta.current_page === i + 1 ? 'bg-navy text-white' : 'hover:bg-gray-100'}`}>{i + 1}</button>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'New Product'} width="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Product Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <Select label="Category" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} options={flatCategories.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select category" />
          <Select label="Supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select supplier" />
          <Input label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <Input label="Reorder Level" type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
          <Input label="Cost Price" type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} required />
          <Input label="Selling Price" type="number" step="0.01" value={form.base_selling_price} onChange={(e) => setForm({ ...form, base_selling_price: e.target.value })} required />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="amber" onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  );
}
