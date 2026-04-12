import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { HiShieldCheck, HiUserGroup, HiSave, HiPlus, HiTrash } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';

interface Role {
  id: number;
  name: string;
  guard_name: string;
  permissions: string[];
  users_count: number;
  created_at: string;
}

// Module definitions matching the Sidebar nav structure
const MODULE_MAP: { group: string; label: string; permissions: string[] }[] = [
  {
    group: 'POS',
    label: 'Point of Sale',
    permissions: ['pos.access', 'pos.create-sale', 'pos.void-sale', 'pos.process-refund', 'pos.apply-discount', 'pos.view-daily-summary'],
  },
  {
    group: 'POS',
    label: 'Clients',
    permissions: ['clients.view', 'clients.create', 'clients.edit', 'clients.delete', 'client-tiers.view', 'client-tiers.create', 'client-tiers.edit', 'client-tiers.delete'],
  },
  {
    group: 'Inventory',
    label: 'Products',
    permissions: ['products.view', 'products.create', 'products.edit', 'products.delete'],
  },
  {
    group: 'Inventory',
    label: 'Categories',
    permissions: ['categories.view', 'categories.create', 'categories.edit', 'categories.delete'],
  },
  {
    group: 'Inventory',
    label: 'Stock & Movements',
    permissions: ['inventory.view', 'inventory.adjust'],
  },
  {
    group: 'Inventory',
    label: 'Purchase Orders',
    permissions: ['purchase-orders.view', 'purchase-orders.create', 'purchase-orders.edit', 'purchase-orders.receive'],
  },
  {
    group: 'Inventory',
    label: 'Suppliers',
    permissions: ['suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.delete'],
  },
  {
    group: 'Accounting',
    label: 'Accounting & Reports',
    permissions: ['accounting.view', 'accounting.journal-entries', 'reports.income-statement', 'reports.balance-sheet', 'reports.cash-flow', 'reports.client-statements', 'reports.sales-report', 'bank-reconciliation.view', 'bank-reconciliation.manage'],
  },
  {
    group: 'Admin',
    label: 'User Management',
    permissions: ['users.view', 'users.create', 'users.edit', 'users.delete'],
  },
  {
    group: 'Admin',
    label: 'Role Management',
    permissions: ['roles.view', 'roles.manage'],
  },
  {
    group: 'Admin',
    label: 'Audit Trail',
    permissions: ['audit-logs.view'],
  },
  {
    group: 'Admin',
    label: 'System',
    permissions: ['settings.manage'],
  },
];

const ROLE_BADGE: Record<string, 'danger' | 'info' | 'warning' | 'success' | 'neutral'> = {
  'Super Admin': 'danger',
  'Admin': 'info',
  'Manager': 'warning',
  'Sales Clerk': 'success',
};

// Group modules by their group
const GROUPED_MODULES = MODULE_MAP.reduce<Record<string, typeof MODULE_MAP>>((acc, mod) => {
  if (!acc[mod.group]) acc[mod.group] = [];
  acc[mod.group].push(mod);
  return acc;
}, {});

export function RoleManagementPage() {
  const { hasRole, checkAuth } = useAuthStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [localPerms, setLocalPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const SYSTEM_ROLES = ['Super Admin', 'Admin', 'Manager', 'Sales Clerk'];
  const canManage = hasRole('Super Admin');

  const fetchRoles = () => {
    setLoading(true);
    api.get('/roles')
      .then((res) => {
        setRoles(res.data.data);
        // Auto-select first role
        if (res.data.data.length > 0) {
          const first = res.data.data[0];
          setSelectedRole(first);
          setLocalPerms(new Set(first.permissions));
        }
      })
      .catch(() => toast.error('Failed to load roles'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRoles(); }, []);

  const selectRole = (role: Role) => {
    if (dirty && !confirm('You have unsaved changes. Discard?')) return;
    setSelectedRole(role);
    setLocalPerms(new Set(role.permissions));
    setDirty(false);
  };

  // Check if a module's permissions are all granted
  const isModuleFullyOn = (mod: typeof MODULE_MAP[0]) =>
    mod.permissions.every((p) => localPerms.has(p));

  // Check if a module has some but not all permissions
  const isModulePartial = (mod: typeof MODULE_MAP[0]) =>
    mod.permissions.some((p) => localPerms.has(p)) && !isModuleFullyOn(mod);

  // Toggle all permissions for a module
  const toggleModule = (mod: typeof MODULE_MAP[0]) => {
    if (!canManage || selectedRole?.name === 'Super Admin') return;
    const next = new Set(localPerms);
    const allOn = isModuleFullyOn(mod);
    mod.permissions.forEach((p) => {
      if (allOn) next.delete(p);
      else next.add(p);
    });
    setLocalPerms(next);
    setDirty(true);
  };

  // Toggle a single permission
  const togglePermission = (perm: string) => {
    if (!canManage || selectedRole?.name === 'Super Admin') return;
    const next = new Set(localPerms);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    setLocalPerms(next);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await api.put(`/roles/${selectedRole.id}`, {
        permissions: Array.from(localPerms),
      });
      toast.success(`Permissions updated for ${selectedRole.name}`);
      setDirty(false);
      // Update local roles state
      setRoles((prev) =>
        prev.map((r) => (r.id === selectedRole.id ? res.data.data : r))
      );
      setSelectedRole(res.data.data);
      setLocalPerms(new Set(res.data.data.permissions));
      // Refresh current user's permissions so sidebar/routes update immediately
      await checkAuth();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newRoleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/roles', { name: newRoleName.trim() });
      toast.success(`Role "${res.data.data.name}" created`);
      setRoles((prev) => [...prev, res.data.data].sort((a, b) => a.name.localeCompare(b.name)));
      setCreateOpen(false);
      setNewRoleName('');
      // Auto-select the new role
      setSelectedRole(res.data.data);
      setLocalPerms(new Set(res.data.data.permissions));
      setDirty(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const errors = error.response?.data?.errors;
      if (errors) {
        const first = Object.values(errors)[0];
        toast.error(first[0]);
      } else {
        toast.error(error.response?.data?.message || 'Failed to create role');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/roles/${role.id}`);
      toast.success(`Role "${role.name}" deleted`);
      const remaining = roles.filter((r) => r.id !== role.id);
      setRoles(remaining);
      if (selectedRole?.id === role.id) {
        const next = remaining[0] ?? null;
        setSelectedRole(next);
        setLocalPerms(new Set(next?.permissions ?? []));
        setDirty(false);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  if (!hasRole('Super Admin') && !hasRole('Manager')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: 'var(--n-text-dim)' }}>You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HiShieldCheck className="w-7 h-7" style={{ color: 'var(--n-accent)' }} />
          <h1 className="neu-page-title">Role Management</h1>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <Button variant="secondary" onClick={() => { setNewRoleName(''); setCreateOpen(true); }}>
              <HiPlus className="w-4 h-4 mr-2" /> New Role
            </Button>
          )}
          {canManage && dirty && selectedRole && selectedRole.name !== 'Super Admin' && (
            <Button variant="amber" onClick={handleSave} disabled={saving}>
              <HiSave className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Role cards */}
          <div className="lg:col-span-1 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--n-text-dim)' }}>Roles</p>
            {roles.map((role) => (
              <Card
                key={role.id}
                className={`p-4 cursor-pointer transition-all ${selectedRole?.id === role.id ? 'ring-2 ring-(--n-accent)' : ''}`}
                onClick={() => selectRole(role)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant={ROLE_BADGE[role.name] || 'neutral'}>{role.name}</Badge>
                    <div className="flex items-center gap-1.5 mt-2">
                      <HiUserGroup className="w-3.5 h-3.5" style={{ color: 'var(--n-text-dim)' }} />
                      <span className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>
                        {role.users_count} user{role.users_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs font-mono" style={{ color: 'var(--n-text-dim)' }}>
                      {role.permissions.length} perms
                    </span>
                    {canManage && !SYSTEM_ROLES.includes(role.name) && (
                      <button
                        type="button"
                        className="neu-btn-icon danger"
                        disabled={deleting}
                        onClick={(e) => { e.stopPropagation(); handleDelete(role); }}
                        title="Delete role"
                      >
                        <HiTrash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Permissions panel */}
          <div className="lg:col-span-3">
            {selectedRole ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--n-font-display)', color: 'var(--n-text)' }}>
                      {selectedRole.name} Permissions
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--n-text-secondary)' }}>
                      {selectedRole.name === 'Super Admin'
                        ? 'Super Admin has full access to all modules. Permissions cannot be modified.'
                        : 'Toggle modules on/off to control access. Expand to configure individual permissions.'}
                    </p>
                  </div>
                  {dirty && (
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--n-accent-glow)', color: 'var(--n-accent)' }}>
                      Unsaved changes
                    </span>
                  )}
                </div>

                {Object.entries(GROUPED_MODULES).map(([group, modules]) => (
                  <div key={group} className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--n-text-dim)' }}>
                      {group}
                    </p>
                    <div className="space-y-2">
                      {modules.map((mod) => (
                        <ModuleToggleRow
                          key={mod.label}
                          mod={mod}
                          isOn={isModuleFullyOn(mod)}
                          isPartial={isModulePartial(mod)}
                          localPerms={localPerms}
                          onToggleModule={() => toggleModule(mod)}
                          onTogglePermission={togglePermission}
                          disabled={!canManage || selectedRole.name === 'Super Admin'}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            ) : (
              <Card className="p-12">
                <p className="text-center" style={{ color: 'var(--n-text-dim)' }}>Select a role to manage permissions.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Role" width="sm">
        <div className="space-y-4">
          <Input
            label="Role Name"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="e.g. Warehouse Staff"
            required
          />
          <p className="text-xs" style={{ color: 'var(--n-text-dim)' }}>
            The new role starts with no permissions. Use the permission toggles to configure access after creating.
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="amber" onClick={handleCreate} disabled={creating || !newRoleName.trim()}>
            {creating ? 'Creating...' : 'Create Role'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ModuleToggleRow({
  mod,
  isOn,
  isPartial,
  localPerms,
  onToggleModule,
  onTogglePermission,
  disabled,
}: {
  mod: typeof MODULE_MAP[0];
  isOn: boolean;
  isPartial: boolean;
  localPerms: Set<string>;
  onToggleModule: () => void;
  onTogglePermission: (perm: string) => void;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl transition-all"
      style={{
        background: 'var(--n-inset)',
        boxShadow: 'inset 2px 2px 4px var(--n-shadow-dark-sm), inset -2px -2px 4px var(--n-shadow-light-sm)',
      }}
    >
      {/* Module header with toggle */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-medium" style={{ color: 'var(--n-text)' }}>{mod.label}</span>
          {isPartial && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--n-accent-glow)', color: 'var(--n-accent)' }}>
              Partial
            </span>
          )}
          <span className="text-[10px] font-mono" style={{ color: 'var(--n-text-dim)' }}>
            {mod.permissions.filter((p) => localPerms.has(p)).length}/{mod.permissions.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Expand chevron */}
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--n-text-dim)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>

          {/* Toggle switch — same style as theme toggle */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleModule(); }}
            className={`neu-perm-toggle ${isOn ? 'neu-perm-toggle--on' : ''} ${isPartial ? 'neu-perm-toggle--partial' : ''}`}
            disabled={disabled}
            aria-label={`Toggle ${mod.label} access`}
          >
            <span className="neu-perm-toggle-knob" />
          </button>
        </div>
      </div>

      {/* Expanded: individual permissions */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-1.5" style={{ borderTop: '1px solid var(--n-divider)' }}>
          {mod.permissions.map((perm) => (
            <div key={perm} className="flex items-center justify-between py-1">
              <span className="text-xs font-mono" style={{ color: 'var(--n-text-secondary)' }}>
                {perm}
              </span>
              <button
                type="button"
                onClick={() => onTogglePermission(perm)}
                className={`neu-perm-toggle neu-perm-toggle--sm ${localPerms.has(perm) ? 'neu-perm-toggle--on' : ''}`}
                disabled={disabled}
                aria-label={`Toggle ${perm}`}
              >
                <span className="neu-perm-toggle-knob" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
