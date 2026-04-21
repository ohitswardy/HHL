import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { useDebounce } from '../../../lib/useDebounce';
import {
  HiPlus, HiPencil, HiTrash,
  HiUpload, HiCheckCircle, HiXCircle, HiMinusCircle,
  HiChevronLeft, HiChevronRight,
} from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Client, ClientTier } from '../../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportPreviewRow {
  row_num: number;
  name: string;
  status: 'new' | 'duplicate' | 'skip';
  reason: string | null;
  data: {
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
  } | null;
}

interface ImportSummary {
  new_count: number;
  dup_count: number;
  skip_count: number;
  total: number;
}

// ── Import Modal ──────────────────────────────────────────────────────────────

function ClientImportModal({
  isOpen,
  onClose,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);

  const reset = () => {
    setFile(null);
    setRows([]);
    setSummary(null);
    setDone(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      toast.error('Only CSV and XLSX files are supported');
      return;
    }
    setFile(f);
    setRows([]);
    setSummary(null);
    setDone(null);
  };

  const handlePreview = async () => {
    if (!file) return;
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/clients/import/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRows(res.data.rows);
      setSummary(res.data.summary);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/clients/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDone({ imported: res.data.imported, skipped: res.data.skipped });
      toast.success(res.data.message);
      onImported();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Clients" width="xl">
      {/* ── Step 1: File pick ── */}
      {!summary && !done && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFileChange(e.dataTransfer.files[0] ?? null);
            }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--n-accent)' : 'var(--n-border)'}`,
              borderRadius: '0.75rem',
              padding: '2rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'rgba(245,166,35,0.06)' : 'var(--n-bg-inset)',
              transition: 'all 0.2s',
            }}
          >
            <HiUpload className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--n-text-secondary)' }} />
            {file ? (
              <p className="font-semibold" style={{ color: 'var(--n-text-primary)' }}>{file.name}</p>
            ) : (
              <>
                <p className="font-semibold" style={{ color: 'var(--n-text-primary)' }}>
                  Drop your file here or click to browse
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--n-text-secondary)' }}>
                  Supports CSV and XLSX — Loyverse export format accepted
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: 'var(--n-bg-inset)', color: 'var(--n-text-secondary)' }}>
            <strong style={{ color: 'var(--n-text-primary)' }}>Expected columns:</strong>{' '}
            <code>Customer name</code>, <code>Email</code>, <code>Phone</code>,{' '}
            <code>Address</code>, <code>City</code>, <code>Province</code>, <code>Note</code>
            <br />
            <span className="opacity-70">
              Loyverse CSV export is directly supported. Columns like Points balance, Total visits, and Customer code are ignored.
            </span>
          </div>

          {file && (
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button variant="amber" onClick={handlePreview} disabled={previewing}>
                {previewing ? <><Spinner /> Analyzing…</> : 'Preview Import'}
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Step 2: Preview ── */}
      {summary && !done && (
        <>
          <div className="flex gap-3 mt-4 mb-3 flex-wrap">
            <span className="neu-badge" style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>
              <HiCheckCircle className="inline w-4 h-4 mr-1" />{summary.new_count} new
            </span>
            <span className="neu-badge" style={{ background: 'rgba(245,166,35,0.12)', color: '#d97706' }}>
              <HiMinusCircle className="inline w-4 h-4 mr-1" />{summary.dup_count} duplicate
            </span>
            <span className="neu-badge" style={{ background: 'rgba(107,114,128,0.12)', color: '#6b7280' }}>
              <HiXCircle className="inline w-4 h-4 mr-1" />{summary.skip_count} skipped
            </span>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            <table className="neu-table text-sm">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row_num}>
                    <td style={{ color: 'var(--n-text-secondary)' }}>{r.row_num}</td>
                    <td className="font-medium">{r.name}</td>
                    <td style={{ color: 'var(--n-text-secondary)' }}>{r.data?.phone ?? '—'}</td>
                    <td style={{ color: 'var(--n-text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.data?.address ?? '—'}
                    </td>
                    <td>
                      {r.status === 'new' && (
                        <span className="neu-badge" style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>New</span>
                      )}
                      {r.status === 'duplicate' && (
                        <span className="neu-badge" style={{ background: 'rgba(245,166,35,0.12)', color: '#d97706' }}>Duplicate</span>
                      )}
                      {r.status === 'skip' && (
                        <span className="neu-badge" style={{ background: 'rgba(107,114,128,0.12)', color: '#6b7280' }} title={r.reason ?? ''}>
                          Skip
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary.new_count === 0 && (
            <p className="mt-3 text-sm text-center" style={{ color: 'var(--n-text-secondary)' }}>
              No new clients to import — all entries are duplicates or invalid.
            </p>
          )}

          <div className="flex justify-between items-center mt-4">
            <button onClick={reset} className="text-sm" style={{ color: 'var(--n-text-secondary)' }}>
              ← Choose different file
            </button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button
                variant="amber"
                onClick={handleImport}
                disabled={importing || summary.new_count === 0}
              >
                {importing
                  ? <><Spinner /> Importing…</>
                  : `Import ${summary.new_count} Client${summary.new_count !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Step 3: Done ── */}
      {done && (
        <div className="text-center py-6">
          <HiCheckCircle className="w-14 h-14 mx-auto mb-3" style={{ color: '#16a34a' }} />
          <p className="text-xl font-bold" style={{ color: 'var(--n-text-primary)' }}>
            {done.imported} client{done.imported !== 1 ? 's' : ''} imported
          </p>
          {done.skipped > 0 && (
            <p className="text-sm mt-1" style={{ color: 'var(--n-text-secondary)' }}>
              {done.skipped} rows skipped (duplicates or invalid)
            </p>
          )}
          <Button variant="amber" onClick={handleClose} className="mt-5">Close</Button>
        </div>
      )}
    </Modal>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

function getPageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const range: (number | null)[] = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  if (lo > 2) range.push(null);
  for (let i = lo; i <= hi; i++) range.push(i);
  if (hi < total - 1) range.push(null);
  range.push(total);
  return range;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [tiers, setTiers] = useState<ClientTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ business_name: '', contact_person: '', phone: '', email: '', address: '', client_tier_id: '', credit_limit: '0', notes: '' });

  const fetchClients = (p = page) => {
    setLoading(true);
    api.get('/clients', { params: { search: debouncedSearch, per_page: 10, page: p } })
      .then((res) => {
        setClients(res.data.data);
        setMeta(res.data.meta);
      })
      .finally(() => setLoading(false));
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchClients(p);
  };

  // Reset to page 1 when debounced search settles
  useEffect(() => {
    setPage(1);
    fetchClients(1);
  }, [debouncedSearch]);

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
      fetchClients(page);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="neu-page-title">Clients</h1>
        <div className="flex gap-2">
          <Button onClick={() => setImportOpen(true)} variant="secondary">
            <HiUpload className="w-4 h-4 mr-2" /> Import CSV / XLSX
          </Button>
          <Button onClick={openCreate} variant="amber">
            <HiPlus className="w-4 h-4 mr-2" /> Add Client
          </Button>
        </div>
      </div>
      <Card className="p-4 mb-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search clients…"
        />
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
                      <button onClick={async () => { if (confirm('Delete?')) { await api.delete(`/clients/${c.id}`); toast.success('Deleted'); fetchClients(page); } }} className="neu-btn-icon danger ml-1"><HiTrash className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.last_page > 1 && (
          <div className="neu-pagination">
            <p className="neu-pagination-info">
              Page {meta.current_page} of {meta.last_page} &nbsp;·&nbsp; {meta.total} results
            </p>
            <div className="neu-pagination-buttons">
              <button onClick={() => handlePageChange(page - 1)} disabled={meta.current_page === 1} className="neu-pagination-btn" aria-label="Previous page">
                <HiChevronLeft className="w-4 h-4" />
              </button>
              {getPageNumbers(meta.current_page, meta.last_page).map((n, i) =>
                n === null ? (
                  <span key={`ellipsis-${i}`} className="neu-pagination-dots">…</span>
                ) : (
                  <button key={n} onClick={() => handlePageChange(n)} className={`neu-pagination-btn ${meta.current_page === n ? 'active' : ''}`}>{n}</button>
                )
              )}
              <button onClick={() => handlePageChange(page + 1)} disabled={meta.current_page === meta.last_page} className="neu-pagination-btn" aria-label="Next page">
                <HiChevronRight className="w-4 h-4" />
              </button>
            </div>
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

      <ClientImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { setPage(1); fetchClients(1); }}
      />
    </div>
  );
}
