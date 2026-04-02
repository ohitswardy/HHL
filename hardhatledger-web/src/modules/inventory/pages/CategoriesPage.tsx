import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { HiPlus, HiPencil, HiTrash } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Category } from '../../../types';

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', parent_id: '' });

  const fetchCategories = () => {
    setLoading(true);
    api.get('/categories')
      .then((res) => setCategories(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const parentOptions = categories.map((c) => ({ value: String(c.id), label: c.name }));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', parent_id: '' });
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, parent_id: cat.parent_id ? String(cat.parent_id) : '' });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
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
      .catch((err) => toast.error(err.response?.data?.message || 'Error saving category'));
  };

  const handleDelete = (id: number) => {
    if (!confirm('Delete this category?')) return;
    api.delete(`/categories/${id}`)
      .then(() => { toast.success('Category deleted'); fetchCategories(); })
      .catch((err) => toast.error(err.response?.data?.message || 'Error deleting category'));
  };

  if (loading) return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Categories</h1>
        <Button onClick={openCreate}><HiPlus className="mr-2" /> Add Category</Button>
      </div>

      <Card>
        <div className="space-y-2">
          {categories.length === 0 && (
            <p className="text-center text-gray-500 py-8">No categories found. Create your first category.</p>
          )}
          {categories.map((cat) => (
            <div key={cat.id}>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-semibold text-navy-800">{cat.name}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(cat)}>
                    <HiPencil />
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(cat.id)}>
                    <HiTrash />
                  </Button>
                </div>
              </div>
              {cat.children && cat.children.length > 0 && (
                <div className="ml-8 mt-1 space-y-1">
                  {cat.children.map((child) => (
                    <div key={child.id} className="flex items-center justify-between p-2 bg-white border rounded">
                      <span className="text-navy-700">{child.name}</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(child)}>
                          <HiPencil />
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(child.id)}>
                          <HiTrash />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Category Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select
            label="Parent Category (optional)"
            value={form.parent_id}
            onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
            options={parentOptions}
            placeholder="None (top-level)"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
