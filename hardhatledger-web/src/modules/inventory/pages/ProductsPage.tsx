import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { ImportPreviewModal } from '../components/ImportPreviewModal';
import type { ImportPreviewData } from '../components/ImportPreviewModal';
import { HiPlus, HiPencil, HiTrash, HiSearch, HiDocumentDownload, HiUpload, HiChevronDown, HiDocumentText, HiTable, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Product, Category, Supplier } from '../../../types';

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 15 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', sku: '', description: '', category_id: '', supplier_id: '', unit: 'pc', cost_price: '', base_selling_price: '', reorder_level: '10' });

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);

  // Export dropdown
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, filterCategory, filterStatus]);

  // Fetch products whenever page or filters change
  useEffect(() => {
    setLoading(true);
    const params: Record<string, unknown> = { page, per_page: 15 };
    if (search) params.search = search;
    if (filterCategory) params.category_id = filterCategory;
    if (filterStatus !== 'all') params.is_active = filterStatus === 'active' ? 1 : 0;
    api.get('/products', { params })
      .then((res) => { setProducts(res.data.data); setMeta(res.data.meta); })
      .finally(() => setLoading(false));
  }, [page, search, filterCategory, filterStatus]);

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.data));
    api.get('/suppliers', { params: { per_page: 100 } }).then((res) => setSuppliers(res.data.data));
  }, []);

  // Flat list for the filter bar (plain names)
  const flatCategories = categories.flatMap((c) => [c, ...(c.children || [])]);

  // Structured list for the modal category dropdown � shows parent/sub-category hierarchy
  const categoryOptions = categories.flatMap((parent) => {
    const isParent = (parent.children?.length ?? 0) > 0;
    const parentEntry = {
      value: String(parent.id),
      label: isParent ? `?? ${parent.name}` : parent.name,
    };
    const childEntries = (parent.children || []).map((child) => ({
      value: String(child.id),
      label: `    ? ${child.name}  (${parent.name})`,
    }));
    return [parentEntry, ...childEntries];
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getPageNumbers = (current: number, total: number): (number | null)[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const range: (number | null)[] = [1];
    const lo = Math.max(2, current - 1);
    const hi = Math.min(total - 1, current + 1);
    if (lo > 2) range.push(null);
    for (let i = lo; i <= hi; i++) range.push(i);
    if (hi < total - 1) range.push(null);
    range.push(total);
    return range;
  };

  // ── Export ───────────────────────────────────────────────────────────────

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const buildExportParams = () => {
    const params: Record<string, unknown> = {};
    if (search) params.search = search;
    if (filterCategory) params.category_id = filterCategory;
    if (filterStatus !== 'all') params.is_active = filterStatus === 'active' ? 1 : 0;
    return params;
  };

  const handleExportPdf = async () => {
    setExportOpen(false); setExporting(true);
    try {
      const res = await api.get('/products/export/pdf', { responseType: 'blob', params: buildExportParams() });
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `products-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch { toast.error('Failed to export PDF'); }
    finally { setExporting(false); }
  };

  const handleExportCsv = async () => {
    setExportOpen(false); setExporting(true);
    try {
      const res = await api.get('/products/export/csv', { responseType: 'blob', params: buildExportParams() });
      downloadBlob(new Blob([res.data], { type: 'text/csv' }), `products-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch { toast.error('Failed to export CSV'); }
    finally { setExporting(false); }
  };

  const handleExportXlsx = async () => {
    setExportOpen(false); setExporting(true);
    try {
      const res = await api.get('/products/export/xlsx', { responseType: 'blob', params: buildExportParams() });
      downloadBlob(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `products-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { toast.error('Failed to export XLSX'); }
    finally { setExporting(false); }
  };

  // ── Import ───────────────────────────────────────────────────────────────

  const handlePreview = async () => {
    if (!importFile) return;
    setPreviewing(true);
    try {
      const data = new FormData();
      data.append('file', importFile);
      const res = await api.post('/products/import/preview', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewData(res.data as ImportPreviewData);
      setImportOpen(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to analyse file');
    } finally {
      setPreviewing(false);
    }
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportFile(null);
    setPreviewData(null);
  };

  const handleImportSuccess = () => {
    setPreviewData(null);
    setImportFile(null);
    setPage(1);
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────

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
      setPage(1);
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to save product'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`);
    toast.success('Product deleted');
    setPage(1);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="neu-page-title">Products</h1>
          {!loading && <p className="text-sm text-[var(--n-text-secondary)] mt-0.5">{meta.total} product{meta.total !== 1 ? 's' : ''} total</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* Export Dropdown */}
          <div className="relative" ref={exportRef}>
            <Button onClick={() => setExportOpen((v) => !v)} variant="secondary" disabled={exporting}>
              <HiDocumentDownload className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting…' : 'Export'}
              <HiChevronDown className="w-3.5 h-3.5 ml-2" />
            </Button>
            {exportOpen && (
              <div className="neu-dropdown">
                <button onClick={handleExportPdf} className="neu-dropdown-item">
                  <HiDocumentText className="w-4 h-4 text-red-500" /> Export as PDF
                </button>
                <button onClick={handleExportCsv} className="neu-dropdown-item">
                  <HiTable className="w-4 h-4 text-green-600" /> Export as CSV
                </button>
                <button onClick={handleExportXlsx} className="neu-dropdown-item">
                  <HiTable className="w-4 h-4 text-emerald-600" /> Export as XLSX
                </button>
              </div>
            )}
          </div>

          <Button onClick={() => setImportOpen(true)} variant="secondary">
            <HiUpload className="w-4 h-4 mr-2" /> Import
          </Button>
          <Button onClick={openCreate} variant="amber">
            <HiPlus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-[3]">
            <HiSearch className="absolute left-3 top-2.5 text-[var(--n-text-dim)] w-4 h-4" />
            <input
              className="neu-inline-input w-full" style={{ paddingLeft: "2.25rem" }}
              placeholder="Search by name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-44 shrink-0">
            <Select
              inline
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              options={[{ value: '', label: 'All Categories' }, ...flatCategories.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div className="w-44 shrink-0">
            <Select
              inline
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
          {(search || filterCategory || filterStatus !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterCategory(''); setFilterStatus('all'); }}
              className="px-3 py-2 text-sm text-[var(--n-text-secondary)] hover:text-[var(--n-text)] hover:bg-[var(--n-inset)] rounded-lg transition-colors whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead >
                <tr>
                  <th >SKU</th>
                  <th >Name</th>
                  <th >Category</th>
                  <th className="text-center px-4 py-3 font-medium text-[var(--n-text-secondary)]">Unit</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Selling</th>
                  <th className="text-center px-4 py-3 font-medium text-[var(--n-text-secondary)]">Stock</th>
                  <th className="text-center px-4 py-3 font-medium text-[var(--n-text-secondary)]">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody >
                {products.map((p) => (
                  <tr key={p.id} >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--n-text-secondary)]">{p.sku}</td>
                    <td className="font-medium">{p.name}</td>
                    <td style={{ color: "var(--n-text-secondary)" }}>{p.category?.name || '—'}</td>
                    <td className="px-4 py-3 text-center text-[var(--n-text-secondary)]">{p.unit}</td>
                    <td className="text-right">{Number(p.cost_price).toFixed(2)}</td>
                    <td className="text-right font-semibold">{Number(p.base_selling_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${(p.stock?.quantity_on_hand ?? 0) <= p.reorder_level ? 'text-red-600' : 'text-green-600'}`}>
                        {p.stock?.quantity_on_hand ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={p.is_active ? 'success' : 'neutral'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="text-right">
                      <button onClick={() => openEdit(p)} className="neu-btn-icon info"><HiPencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(p.id)} className="neu-btn-icon danger ml-1"><HiTrash className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && (
              <p className="text-center text-[var(--n-text-dim)] py-12">No products found{(search || filterCategory || filterStatus !== 'all') ? ' — try adjusting your filters' : ''}</p>
            )}
          </div>
        )}

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="neu-pagination">
            <p className="neu-pagination-info">
              Page {meta.current_page} of {meta.last_page} &nbsp;·&nbsp; {meta.total} results
            </p>
            <div className="neu-pagination-buttons">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={meta.current_page === 1} className="neu-pagination-btn" aria-label="Previous page">
                <HiChevronLeft className="w-4 h-4" />
              </button>
              {getPageNumbers(meta.current_page, meta.last_page).map((n, i) =>
                n === null ? (
                  <span key={`ellipsis-${i}`} className="neu-pagination-dots">…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)} className={`neu-pagination-btn ${meta.current_page === n ? 'active' : ''}`}>{n}</button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))} disabled={meta.current_page === meta.last_page} className="neu-pagination-btn" aria-label="Next page">
                <HiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Import Modal */}
      <Modal isOpen={importOpen} onClose={closeImport} title="Import Products" width="md">
        <div className="space-y-4">
          <p className="text-sm text-[var(--n-text-secondary)]">
            Upload a <strong>.csv</strong>, <strong>.tsv</strong>, or <strong>.xlsx</strong> file.
            The first row must be a header row. Include only the columns you have — all are optional except <code>name</code>:
          </p>
          <div className="bg-[var(--n-input-bg)] rounded-lg p-3 text-xs font-mono text-[var(--n-text)] leading-relaxed">
            name, sku, category, unit, cost_price, retail_price, wholesale_price, reorder_level, quantity, description
          </div>
          <div className="text-xs text-[var(--n-text-secondary)] space-y-1">
            <div><span className="font-semibold text-amber-600">Required:</span> <code>name</code>. All other columns are optional.</div>
            <div>SKU is auto-generated (IMP-XXXX) if omitted. Existing SKUs will have their <strong>stock updated</strong>, not replaced.</div>
            <div>Include a <code>quantity</code> (or <code>stock</code>) column to set stock levels on import.</div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-[var(--n-text)]">Select file</span>
            <input
              type="file"
              accept=".csv,.tsv,.xlsx,.xls"
              className="mt-1 block w-full text-sm text-[var(--n-text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-navy file:text-white hover:file:bg-navy/80 cursor-pointer"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeImport}>Close</Button>
            <Button variant="amber" onClick={handlePreview} disabled={!importFile || previewing}>
              {previewing ? (
                <><Spinner size="sm" /><span className="ml-2">Analysing…</span></>
              ) : (
                <><HiUpload className="w-4 h-4 mr-2" />Preview &amp; Import</>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Preview Modal */}
      {previewData && importFile && (
        <ImportPreviewModal
          file={importFile}
          previewData={previewData}
          onClose={() => { setPreviewData(null); setImportOpen(true); }}
          onSuccess={handleImportSuccess}
        />
      )}

      {/* Add / Edit Product Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'New Product'} width="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Product Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <Select label="Category" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} options={categoryOptions} placeholder="Select category" />
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
