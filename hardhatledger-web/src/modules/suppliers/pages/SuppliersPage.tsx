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
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '', payment_terms: '', notes: '', is_vatable: false });

  const fetch = () => {
    setLoading(true);
    api.get('/suppliers', { params: { search, per_page: 50 } }).then((res) => setSuppliers(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [search]);

  const openCreate = () => { setEditing(null); setForm({ name: '', contact_person: '', phone: '', email: '', address: '', payment_terms: '', notes: '', is_vatable: false }); setModalOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '', payment_terms: s.payment_terms || '', notes: s.notes || '', is_vatable: s.is_vatable ?? false }); setModalOpen(true); };

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
        <h1 className="neu-page-title">Suppliers</h1>
        <Button onClick={openCreate} variant="amber"><HiPlus className="w-4 h-4 mr-2" /> Add Supplier</Button>
      </div>
      <Card className="p-4 mb-4"><div className="neu-search"><HiSearch className="neu-search-icon w-4 h-4" /><div className="neu-inset w-full"><input className="neu-input" style={{ paddingLeft: "2.5rem" }} placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} /></div></div></Card>
      <Card>{loading ? <Spinner /> : (
        <div className="overflow-x-auto"><table className="neu-table"><thead ><tr>
          <th >Name</th><th >Contact</th><th >Phone</th><th >Email</th><th >Terms</th><th >VAT</th><th className="text-right">Actions</th>
        </tr></thead><tbody >{suppliers.map((s) => (
          <tr key={s.id} >
            <td className="font-medium">{s.name}</td><td style={{ color: "var(--n-text-secondary)" }}>{s.contact_person}</td><td style={{ color: "var(--n-text-secondary)" }}>{s.phone}</td><td style={{ color: "var(--n-text-secondary)" }}>{s.email}</td><td style={{ color: "var(--n-text-secondary)" }}>{s.payment_terms}</td>
            <td>{s.is_vatable ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">VAT</span> : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Non-VAT</span>}</td>
            <td className="text-right">
              <button onClick={() => openEdit(s)} className="neu-btn-icon info"><HiPencil className="w-4 h-4" /></button>
              <button onClick={async () => { if (confirm('Delete?')) { await api.delete(`/suppliers/${s.id}`); toast.success('Deleted'); fetch(); } }} className="neu-btn-icon danger ml-1"><HiTrash className="w-4 h-4" /></button>
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
          <label className="flex items-center gap-3 cursor-pointer">
            <span className="relative inline-flex items-center">
              <input type="checkbox" checked={form.is_vatable} onChange={(e) => setForm({ ...form, is_vatable: e.target.checked })} className="sr-only peer" />
              <div className="w-10 h-5 rounded-full bg-gray-300 peer-checked:bg-amber-500 transition-colors"></div>
              <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></div>
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--n-text)' }}>VAT-Registered Supplier</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-6"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="amber" onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button></div>
      </Modal>
    </div>
  );
}
