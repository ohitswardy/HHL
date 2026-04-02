import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { HiPlus, HiPencil, HiTrash, HiSearch, HiShieldCheck } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';
import type { User } from '../../../types';

const ROLES = ['Sales Clerk', 'Admin', 'Manager', 'Super Admin'];

const ROLE_COLORS: Record<string, string> = {
  'Super Admin': 'bg-purple-100 text-purple-800',
  'Admin': 'bg-navy/10 text-navy',
  'Manager': 'bg-amber/20 text-amber-800',
  'Sales Clerk': 'bg-green-100 text-green-800',
};

const emptyForm = {
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  role: 'Sales Clerk',
  is_active: 'true',
};

export function UsersPage() {
  const { user: currentUser, hasRole } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const canManageUsers = hasRole('Super Admin') || hasRole('Manager');

  const fetchUsers = () => {
    setLoading(true);
    api.get('/users', { params: { search: search || undefined, role: roleFilter || undefined, per_page: 50 } })
      .then((res) => setUsers(res.data.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [search, roleFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      password_confirmation: '',
      role: u.roles[0] || 'Sales Clerk',
      is_active: u.is_active ? 'true' : 'false',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    if (!editing && !form.password) {
      toast.error('Password is required for new users');
      return;
    }
    if (form.password && form.password !== form.password_confirmation) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        is_active: form.is_active === 'true',
      };
      if (form.password) {
        payload.password = form.password;
        payload.password_confirmation = form.password_confirmation;
      }

      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', payload);
        toast.success('User created');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      if (errors) {
        const first = Object.values(errors)[0] as string[];
        toast.error(first[0]);
      } else {
        toast.error(err.response?.data?.message || 'Failed to save user');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.id) {
      toast.error('You cannot delete your own account');
      return;
    }
    if (!confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HiShieldCheck className="w-7 h-7 text-navy" />
          <h1 className="text-2xl font-bold text-navy-dark">User Management</h1>
        </div>
        {canManageUsers && (
          <Button onClick={openCreate} variant="amber">
            <HiPlus className="w-4 h-4 mr-2" /> Add User
          </Button>
        )}
      </div>

      <Card className="p-4 mb-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <HiSearch className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            label=""
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={[{ value: '', label: 'All Roles' }, ...ROLES.map((r) => ({ value: r, label: r }))]}
          />
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : users.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-navy/10 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-navy text-xs font-bold">{u.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium">
                          {u.name}
                          {u.id === currentUser?.id && (
                            <span className="ml-2 text-xs text-gray-400">(you)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.roles[0] ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.roles[0]] || 'bg-gray-100 text-gray-700'}`}>
                          {u.roles[0]}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No role</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 hover:bg-blue-50 rounded text-blue-600"
                        title="Edit user"
                      >
                        <HiPencil className="w-4 h-4" />
                      </button>
                      {canManageUsers && u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 hover:bg-red-50 rounded text-red-600 ml-1"
                          title="Delete user"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit User' : 'New User'}
        width="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Email Address"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={ROLES.map((r) => ({ value: r, label: r }))}
          />
          <Select
            label="Status"
            value={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.value })}
            options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
          />
          <Input
            label={editing ? 'New Password (leave blank to keep)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editing}
          />
          <Input
            label="Confirm Password"
            type="password"
            value={form.password_confirmation}
            onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
            required={!editing || !!form.password}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="amber" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Update User' : 'Create User'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
