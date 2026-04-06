import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { HiPlus, HiPencil, HiTrash, HiSearch, HiChevronDown, HiChevronRight, HiFolderOpen, HiFolder } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Category } from '../../../types';

interface FormState {
  name: string;
  parent_id: string;
}

const EMPTY_FORM: FormState = { name: '', parent_id: '' };

/** Flatten tree to a single array for the parent dropdown (exclude the editing item and its descendants) */
function flattenCategories(cats: Category[], excludeId?: number): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = [];
  const walk = (list: Category[], depth: number) => {
    for (const c of list) {
      if (c.id === excludeId) continue;
      result.push({ value: String(c.id), label: `${'— '.repeat(depth)}${c.name}` });
      if (c.children?.length) walk(c.children, depth + 1);
    }
  };
  walk(cats, 0);
  return result;
}

/** Compute total product count (own + all descendants) */
function totalProducts(cat: Category): number {
  const own = cat.products_count ?? 0;
  const childSum = (cat.children ?? []).reduce((sum, c) => sum + totalProducts(c), 0);
  return own + childSum;
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const fetchCategories = () => {
    setLoading(true);
    api.get('/categories')
      .then((res) => {
        setCategories(res.data.data);
        // Auto-expand all top-level by default
        setExpanded(new Set(res.data.data.map((c: Category) => c.id)));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const parentOptions = useMemo(
    () => flattenCategories(categories, editing?.id ?? undefined),
    [categories, editing]
  );

  // Filtered view — matches name anywhere in tree
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    const matchCat = (c: Category): Category | null => {
      const matchedChildren = (c.children ?? []).map(matchCat).filter(Boolean) as Category[];
      if (c.name.toLowerCase().includes(q) || matchedChildren.length > 0) {
        return { ...c, children: matchedChildren };
      }
      return null;
    };
    return categories.map(matchCat).filter(Boolean) as Category[];
  }, [categories, search]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, parent_id: cat.parent_id ? String(cat.parent_id) : '' });
    setErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      parent_id: form.parent_id ? Number(form.parent_id) : null,
    };

    const request = editing
      ? api.put(`/categories/${editing.id}`, payload)
      : api.post('/categories', payload);

    request
      .then(() => {
        toast.success(editing ? 'Category updated' : 'Category created');
        setModalOpen(false);
        fetchCategories();
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Error saving category'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (cat: Category) => {
    const count = totalProducts(cat);
    const warning = count > 0
      ? `\n\nThis category has ${count} product(s) assigned.`
      : '';
    if (!confirm(`Delete "${cat.name}"?${warning}`)) return;
    api.delete(`/categories/${cat.id}`)
      .then(() => { toast.success('Category deleted'); fetchCategories(); })
      .catch((err) => toast.error(err.response?.data?.message || 'Error deleting category'));
  };

  // Stats
  const totalCount = categories.length + categories.reduce((s, c) => s + (c.children?.length ?? 0), 0);
  const topLevelCount = categories.length;

  if (loading) return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {topLevelCount} top-level &middot; {totalCount} total
          </p>
        </div>
        <Button onClick={openCreate}>
          <HiPlus className="mr-1.5 w-4 h-4" /> Add Category
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
          />
        </div>
      </div>

      {/* Category Tree */}
      <Card>
        {filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-10">
            {search ? 'No categories match your search.' : 'No categories yet. Create your first one.'}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                depth={0}
                expanded={expanded}
                onToggle={toggleExpand}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Category' : 'New Category'}
        width="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Cement & Binders"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            required
          />
          <Select
            label="Parent Category (optional)"
            value={form.parent_id}
            onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
            options={parentOptions}
            placeholder="None (top-level)"
          />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ─── Category Row (recursive) ─────────────────────────────────────────── */

interface RowProps {
  cat: Category;
  depth: number;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}

function CategoryRow({ cat, depth, expanded, onToggle, onEdit, onDelete }: RowProps) {
  const hasChildren = (cat.children?.length ?? 0) > 0;
  const isExpanded = expanded.has(cat.id);
  const ownCount = cat.products_count ?? 0;
  const total = totalProducts(cat);

  return (
    <>
      <div
        className={`flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors ${depth > 0 ? 'bg-white' : ''}`}
        style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => hasChildren && onToggle(cat.id)}
          className={`w-5 h-5 flex items-center justify-center text-gray-400 flex-shrink-0 ${hasChildren ? 'cursor-pointer hover:text-navy' : 'cursor-default'}`}
        >
          {hasChildren
            ? (isExpanded ? <HiChevronDown className="w-4 h-4" /> : <HiChevronRight className="w-4 h-4" />)
            : <span className="w-4" />}
        </button>

        {/* Folder icon */}
        {hasChildren
          ? <HiFolderOpen className="w-4 h-4 text-amber flex-shrink-0" />
          : <HiFolder className="w-4 h-4 text-gray-400 flex-shrink-0" />}

        {/* Name */}
        <span className={`flex-1 text-sm ${depth === 0 ? 'font-semibold text-navy-800' : 'text-gray-700'}`}>
          {cat.name}
        </span>

        {/* Product count badge */}
        <div className="flex items-center gap-1.5 mr-3">
          {ownCount > 0 && (
            <Badge variant="info">{ownCount} product{ownCount !== 1 ? 's' : ''}</Badge>
          )}
          {hasChildren && total > ownCount && (
            <Badge variant="neutral">{total} total</Badge>
          )}
          {ownCount === 0 && !hasChildren && (
            <span className="text-xs text-gray-400">No products</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => onEdit(cat)} title="Edit">
            <HiPencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(cat)} title="Delete">
            <HiTrash className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && cat.children!.map((child) => (
        <CategoryRow
          key={child.id}
          cat={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}
