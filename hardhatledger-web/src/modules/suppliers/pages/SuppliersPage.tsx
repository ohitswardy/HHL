import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Spinner } from '../../../components/ui/Spinner';
import { HiPlus, HiPencil, HiTrash, HiSearch } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Supplier } from '../../../types';

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', payment_terms: '', notes: '' });

  const fetch = () => {
    setLoading(true);
    api.get('/suppliers', { params: { search, per_page: 50 } }).then((res) => setSuppliers(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [search]);

  const openCreate = () => { setEditing(null); setForm({ name: '', contact_person: '', phone: '', email: '', address: '', payment_terms: '', notes: '' }); setModalOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '', payment_terms: s.payment_terms || '', notes: s.notes || '' }); setModalOpen(true); };

  const handleSave = async () => {
    try {
      if (editing) { await api.put(`/suppliers/${editing.id}`, form); toast.success('Updated'); }
      else { await api.post('/suppliers', form); toast.success('Created'); }
      setModalOpen(false); fetch();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy-dark">Suppliers</h1>
        <Button onClick={openCreate} variant="amber"><HiPlus className="w-4 h-4 mr-2" /> Add Supplier</Button>
      </div>
      <Card className="p-4 mb-4"><div className="relative"><HiSearch className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" /><input className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} /></div></Card>
      <Card>{loading ? <Spinner /> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 border-b"><tr>
          <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th><th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th><th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th><th className="text-left px-4 py-3 font-medium text-gray-600">Email</th><th className="text-left px-4 py-3 font-medium text-gray-600">Terms</th><th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
        </tr></thead><tbody className="divide-y">{suppliers.map((s) => (
          <tr key={s.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">{s.name}</td><td className="px-4 py-3 text-gray-600">{s.contact_person}</td><td className="px-4 py-3 text-gray-600">{s.phone}</td><td className="px-4 py-3 text-gray-600">{s.email}</td><td className="px-4 py-3 text-gray-600">{s.payment_terms}</td>
            <td className="px-4 py-3 text-right">
              <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><HiPencil className="w-4 h-4" /></button>
              <button onClick={async () => { if (confirm('Delete?')) { await api.delete(`/suppliers/${s.id}`); toast.success('Deleted'); fetch(); } }} className="p-1.5 hover:bg-red-50 rounded text-red-600 ml-1"><HiTrash className="w-4 h-4" /></button>
            </td>
          </tr>
        ))}</tbody></table></div>
      )}</Card>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'New Supplier'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Payment Terms" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-6"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="amber" onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button></div>
      </Modal>
    </div>
  );
}
