import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { HiPlus, HiPencil, HiTrash, HiSearch } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Client, ClientTier } from '../../../types';

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [tiers, setTiers] = useState<ClientTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ business_name: '', contact_person: '', phone: '', email: '', address: '', client_tier_id: '', credit_limit: '0', notes: '' });

  const fetchClients = () => {
    setLoading(true);
    api.get('/clients', { params: { search, per_page: 50 } })
      .then((res) => setClients(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchClients(); }, [search]);
  useEffect(() => { api.get('/client-tiers').then((res) => setTiers(res.data.data)); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ business_name: '', contact_person: '', phone: '', email: '', address: '', client_tier_id: tiers[0]?.id?.toString() || '', credit_limit: '0', notes: '' });
    setModalOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ business_name: c.business_name, contact_person: c.contact_person || '', phone: c.phone || '', email: c.email || '', address: c.address || '', client_tier_id: String(c.client_tier_id), credit_limit: String(c.credit_limit), notes: c.notes || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = { ...form, client_tier_id: Number(form.client_tier_id), credit_limit: parseFloat(form.credit_limit) };
      if (editing) {
        await api.put(`/clients/${editing.id}`, payload);
        toast.success('Client updated');
      } else {
        await api.post('/clients', payload);
        toast.success('Client created');
      }
      setModalOpen(false);
      fetchClients();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="neu-page-title">Clients</h1>
        <Button onClick={openCreate} variant="amber"><HiPlus className="w-4 h-4 mr-2" /> Add Client</Button>
      </div>
      <Card className="p-4 mb-4">
        <div className="neu-search">
          <HiSearch className="neu-search-icon w-4 h-4" />
          <div className="neu-inset w-full">
            <input className="neu-input" style={{ paddingLeft: '2.5rem' }} placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </Card>
      <Card>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead><tr>
                <th>Business Name</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Tier</th>
                <th className="text-right">Credit Limit</th>
                <th className="text-right">Balance</th>
                <th className="text-right">Actions</th>
              </tr></thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.business_name}</td>
                    <td style={{ color: 'var(--n-text-secondary)' }}>{c.contact_person}</td>
                    <td style={{ color: 'var(--n-text-secondary)' }}>{c.phone}</td>
                    <td><span className="neu-badge neu-badge-info">{c.tier?.name}</span></td>
                    <td className="text-right">{c.credit_limit.toFixed(2)}</td>
                    <td className="text-right font-semibold">{c.outstanding_balance.toFixed(2)}</td>
                    <td className="text-right">
                      <button onClick={() => openEdit(c)} className="neu-btn-icon info"><HiPencil className="w-4 h-4" /></button>
                      <button onClick={async () => { if (confirm('Delete?')) { await api.delete(`/clients/${c.id}`); toast.success('Deleted'); fetchClients(); } }} className="neu-btn-icon danger ml-1"><HiTrash className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Client' : 'New Client'} width="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Business Name" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} required />
          <Input label="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Select label="Client Tier" value={form.client_tier_id} onChange={(e) => setForm({ ...form, client_tier_id: e.target.value })} options={tiers.map((t) => ({ value: t.id, label: t.name }))} />
          <Input label="Credit Limit" type="number" step="0.01" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
          <div className="col-span-2"><Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="amber" onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>
    </div>
  );
}
