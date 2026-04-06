import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { HiPlus, HiPencil, HiTrash, HiSearch, HiShieldCheck } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';
import type { User } from '../../../types';

const ROLES = ['Sales Clerk', 'Admin', 'Manager', 'Super Admin'];

const ROLE_COLORS: Record<string, string> = {
  'Super Admin': 'neu-badge neu-badge-danger',
  'Admin': 'neu-badge neu-badge-info',
  'Manager': 'neu-badge neu-badge-warning',
  'Sales Clerk': 'neu-badge neu-badge-success',
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
          <h1 className="neu-page-title">User Management</h1>
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
            <HiSearch className="absolute left-3 top-2.5 text-[var(--n-text-dim)] w-4 h-4" />
            <input
              className="neu-inline-input w-full" style={{ paddingLeft: "2.25rem" }}
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-44 shrink-0">
            <Select
              label=""
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[{ value: '', label: 'All Roles' }, ...ROLES.map((r) => ({ value: r, label: r }))]}
            />
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : users.length === 0 ? (
          <p className="text-center text-[var(--n-text-dim)] py-12">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead >
                <tr>
                  <th >Name</th>
                  <th >Email</th>
                  <th >Role</th>
                  <th >Status</th>
                  <th >Last Login</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody >
                {users.map((u) => (
                  <tr key={u.id} >
                    <td >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 neu-stat-icon" style={{ width: '2rem', height: '2rem', borderRadius: '9999px' }}>
                          <span className="text-xs font-bold" style={{ color: 'var(--n-accent)' }}>{u.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium">
                          {u.name}
                          {u.id === currentUser?.id && (
                            <span className="ml-2 text-xs text-[var(--n-text-dim)]">(you)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: "var(--n-text-secondary)" }}>{u.email}</td>
                    <td >
                      {u.roles[0] ? (
                        <span className={ROLE_COLORS[u.roles[0]] || 'neu-badge neu-badge-neutral'}>
                          {u.roles[0]}
                        </span>
                      ) : (
                        <span className="text-[var(--n-text-dim)] text-xs">No role</span>
                      )}
                    </td>
                    <td >
                      <Badge variant={u.is_active ? 'success' : 'danger'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--n-text-secondary)] text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => openEdit(u)}
                        className="neu-btn-icon info"
                        title="Edit user"
                      >
                        <HiPencil className="w-4 h-4" />
                      </button>
                      {canManageUsers && u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(u)}
                          className="neu-btn-icon danger ml-1"
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
