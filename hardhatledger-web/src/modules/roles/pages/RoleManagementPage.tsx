import { useEffect, useState, useMemo } from 'react';
import { Card } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import {
  HiShieldCheck, HiUserGroup, HiSave, HiPlus, HiTrash,
  HiPencil, HiDuplicate, HiSearch, HiChevronDown, HiLockClosed,
  HiShoppingCart, HiArchive, HiCalculator, HiCog, HiCollection,
  HiChevronUp, HiCheckCircle, HiMinusCircle,
} from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Role {
  id: number;
  name: string;
  guard_name: string;
  permissions: string[];
  users_count: number;
  created_at: string;
}

// ─── Permission metadata ──────────────────────────────────────────────────────
const PERMISSION_META: Record<string, { label: string; description: string }> = {
  // Dashboard
  'dashboard.view':         { label: 'View Dashboard',        description: 'Access the main dashboard with KPIs, sales trends, and business overview' },
  // POS
  'pos.access':             { label: 'Access POS',           description: 'Open and use the point-of-sale terminal' },
  'pos.create-sale':        { label: 'Create Sale',          description: 'Process new sales transactions' },
  'pos.void-sale':          { label: 'Void Sale',            description: 'Cancel and void completed sales' },
  'pos.process-refund':     { label: 'Process Refund',       description: 'Issue refunds on past transactions' },
  'pos.apply-discount':     { label: 'Apply Discount',       description: 'Apply discounts during checkout' },
  'pos.view-daily-summary': { label: 'Daily Summary',        description: 'View end-of-day sales summaries' },
  // Clients
  'clients.view':           { label: 'View Clients',         description: 'Browse and search client records' },
  'clients.create':         { label: 'Add Clients',          description: 'Register new clients in the system' },
  'clients.edit':           { label: 'Edit Clients',         description: 'Modify existing client information' },
  'clients.delete':         { label: 'Delete Clients',       description: 'Permanently remove client records' },
  'client-tiers.view':      { label: 'View Tiers',           description: 'Browse client pricing tiers' },
  'client-tiers.create':    { label: 'Add Tiers',            description: 'Create new client pricing tiers' },
  'client-tiers.edit':      { label: 'Edit Tiers',           description: 'Modify client tier settings' },
  'client-tiers.delete':    { label: 'Delete Tiers',         description: 'Remove client pricing tiers' },
  // Products
  'products.view':          { label: 'View Products',        description: 'Browse and search the product catalog' },
  'products.create':        { label: 'Add Products',         description: 'Create new product listings' },
  'products.edit':          { label: 'Edit Products',        description: 'Update product details and pricing' },
  'products.delete':        { label: 'Delete Products',      description: 'Remove products from the catalog' },
  // Categories
  'categories.view':        { label: 'View Categories',      description: 'Browse product categories' },
  'categories.create':      { label: 'Add Categories',       description: 'Create new product categories' },
  'categories.edit':        { label: 'Edit Categories',      description: 'Rename and modify categories' },
  'categories.delete':      { label: 'Delete Categories',    description: 'Remove product categories' },
  // Inventory
  'inventory.view':         { label: 'View Stock',           description: 'See current stock levels and movements' },
  'inventory.adjust':       { label: 'Adjust Stock',         description: 'Manually adjust inventory quantities' },
  // Purchase Orders
  'purchase-orders.view':   { label: 'View POs',             description: 'Browse purchase orders' },
  'purchase-orders.create': { label: 'Create POs',           description: 'Create new purchase orders' },
  'purchase-orders.edit':   { label: 'Edit POs',             description: 'Modify existing purchase orders' },
  'purchase-orders.receive':{ label: 'Receive Stock',        description: 'Mark purchase order items as received' },
  'purchase-orders.cancel': { label: 'Cancel POs',           description: 'Cancel existing purchase orders' },
  // Suppliers
  'suppliers.view':         { label: 'View Suppliers',       description: 'Browse supplier records' },
  'suppliers.create':       { label: 'Add Suppliers',        description: 'Register new suppliers' },
  'suppliers.edit':         { label: 'Edit Suppliers',       description: 'Update supplier information' },
  'suppliers.delete':       { label: 'Delete Suppliers',     description: 'Remove supplier records' },
  // Accounting
  'accounting.view':            { label: 'View Accounting',       description: 'Access the accounting module and general ledger' },
  'accounting.journal-entries': { label: 'Journal Entries',       description: 'Create and manage manual journal entries' },
  'reports.income-statement':   { label: 'Income Statement',      description: 'Generate profit & loss reports' },
  'reports.balance-sheet':      { label: 'Balance Sheet',         description: 'View assets and liabilities report' },
  'reports.cash-flow':          { label: 'Cash Flow',             description: 'View cash flow statements' },
  'reports.client-statements':  { label: 'Client Statements',     description: 'Generate per-client account statements' },
  'reports.sales-report':       { label: 'Sales Report',          description: 'View sales analytics and summaries' },
  'bank-reconciliation.view':   { label: 'View Reconciliation',   description: 'Access bank reconciliation records' },
  'bank-reconciliation.manage': { label: 'Manage Reconciliation', description: 'Perform and finalize bank reconciliation' },
  // System
  'users.view':    { label: 'View Users',       description: 'See user accounts and their assigned roles' },
  'users.create':  { label: 'Add Users',        description: 'Create new user accounts' },
  'users.edit':    { label: 'Edit Users',       description: 'Modify user accounts and assign roles' },
  'users.delete':  { label: 'Delete Users',     description: 'Deactivate or remove user accounts' },
  'roles.view':    { label: 'View Roles',       description: 'See role definitions and their permissions' },
  'roles.manage':  { label: 'Manage Roles',     description: 'Create, edit, clone, and delete roles' },
  'audit-logs.view':  { label: 'Audit Logs',      description: 'View system activity and the full audit trail' },
  'settings.manage':  { label: 'System Settings', description: 'Configure application-wide settings' },
  'database-control.access': { label: 'Database Control', description: 'Access database management and purge tools' },
};

// ─── Permission dependencies ──────────────────────────────────────────────────
// Enabling a permission must also enable everything in its deps array.
const PERMISSION_DEPS: Record<string, string[]> = {
  'pos.create-sale':          ['pos.access'],
  'pos.void-sale':            ['pos.access', 'pos.create-sale'],
  'pos.process-refund':       ['pos.access', 'pos.create-sale'],
  'pos.apply-discount':       ['pos.access', 'pos.create-sale'],
  'pos.view-daily-summary':   ['pos.access'],
  'clients.create':           ['clients.view'],
  'clients.edit':             ['clients.view'],
  'clients.delete':           ['clients.view'],
  'client-tiers.create':      ['client-tiers.view'],
  'client-tiers.edit':        ['client-tiers.view'],
  'client-tiers.delete':      ['client-tiers.view'],
  'products.create':          ['products.view'],
  'products.edit':            ['products.view'],
  'products.delete':          ['products.view'],
  'categories.create':        ['categories.view'],
  'categories.edit':          ['categories.view'],
  'categories.delete':        ['categories.view'],
  'inventory.adjust':         ['inventory.view'],
  'purchase-orders.create':   ['purchase-orders.view'],
  'purchase-orders.edit':     ['purchase-orders.view'],
  'purchase-orders.receive':  ['purchase-orders.view'],
  'purchase-orders.cancel':   ['purchase-orders.view'],
  'suppliers.create':         ['suppliers.view'],
  'suppliers.edit':           ['suppliers.view'],
  'suppliers.delete':         ['suppliers.view'],
  'accounting.journal-entries':     ['accounting.view'],
  'reports.income-statement':       ['accounting.view'],
  'reports.balance-sheet':          ['accounting.view'],
  'reports.cash-flow':              ['accounting.view'],
  'reports.client-statements':      ['accounting.view'],
  'reports.sales-report':           ['accounting.view'],
  'bank-reconciliation.view':       ['accounting.view'],
  'bank-reconciliation.manage':     ['accounting.view', 'bank-reconciliation.view'],
  'users.create':  ['users.view'],
  'users.edit':    ['users.view'],
  'users.delete':  ['users.view'],
  'roles.manage':  ['roles.view'],
};

// Build reverse dependency map: disabling P also disables every Q that requires P
function buildReverseDeps(): Record<string, string[]> {
  const rev: Record<string, string[]> = {};
  for (const [perm, deps] of Object.entries(PERMISSION_DEPS)) {
    for (const dep of deps) {
      if (!rev[dep]) rev[dep] = [];
      rev[dep].push(perm);
    }
  }
  return rev;
}
const REVERSE_DEPS = buildReverseDeps();

// ─── Module map ───────────────────────────────────────────────────────────────
const MODULE_MAP: { group: string; label: string; permissions: string[] }[] = [
  { group: 'General', label: 'Dashboard',
    permissions: ['dashboard.view'] },
  { group: 'POS', label: 'Point of Sale',
    permissions: ['pos.access', 'pos.create-sale', 'pos.void-sale', 'pos.process-refund', 'pos.apply-discount', 'pos.view-daily-summary'] },
  { group: 'POS', label: 'Clients',
    permissions: ['clients.view', 'clients.create', 'clients.edit', 'clients.delete', 'client-tiers.view', 'client-tiers.create', 'client-tiers.edit', 'client-tiers.delete'] },
  { group: 'Inventory', label: 'Products',
    permissions: ['products.view', 'products.create', 'products.edit', 'products.delete'] },
  { group: 'Inventory', label: 'Categories',
    permissions: ['categories.view', 'categories.create', 'categories.edit', 'categories.delete'] },
  { group: 'Inventory', label: 'Stock & Movements',
    permissions: ['inventory.view', 'inventory.adjust'] },
  { group: 'Inventory', label: 'Purchase Orders',
    permissions: ['purchase-orders.view', 'purchase-orders.create', 'purchase-orders.edit', 'purchase-orders.receive', 'purchase-orders.cancel'] },
  { group: 'Inventory', label: 'Suppliers',
    permissions: ['suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.delete'] },
  { group: 'Accounting', label: 'Accounting & Ledger',
    permissions: ['accounting.view', 'accounting.journal-entries'] },
  { group: 'Accounting', label: 'Reports',
    permissions: ['reports.income-statement', 'reports.balance-sheet', 'reports.cash-flow', 'reports.client-statements', 'reports.sales-report'] },
  { group: 'Accounting', label: 'Bank Reconciliation',
    permissions: ['bank-reconciliation.view', 'bank-reconciliation.manage'] },
  { group: 'Admin', label: 'User Management',
    permissions: ['users.view', 'users.create', 'users.edit', 'users.delete'] },
  { group: 'Admin', label: 'Role Management',
    permissions: ['roles.view', 'roles.manage'] },
  { group: 'Admin', label: 'System',
    permissions: ['audit-logs.view', 'settings.manage', 'database-control.access'] },
];

const ALL_PERMISSIONS = MODULE_MAP.flatMap((m) => m.permissions);

const GROUP_META: Record<string, { icon: React.ReactNode; color: string }> = {
  General:    { icon: <HiCollection className="w-4 h-4" />,    color: '#8B5CF6' },
  POS:        { icon: <HiShoppingCart className="w-4 h-4" />,  color: 'var(--n-success)' },
  Inventory:  { icon: <HiArchive className="w-4 h-4" />,       color: 'var(--n-info)' },
  Accounting: { icon: <HiCalculator className="w-4 h-4" />,    color: 'var(--n-accent)' },
  Admin:      { icon: <HiCog className="w-4 h-4" />,           color: 'var(--n-danger)' },
};

const GROUPED_MODULES = MODULE_MAP.reduce<Record<string, typeof MODULE_MAP>>((acc, mod) => {
  if (!acc[mod.group]) acc[mod.group] = [];
  acc[mod.group].push(mod);
  return acc;
}, {});

const ROLE_BADGE: Record<string, 'danger' | 'info' | 'warning' | 'success' | 'neutral'> = {
  'Super Admin': 'danger',
  'Admin':       'info',
  'Manager':     'warning',
  'Sales Clerk': 'success',
};

const SYSTEM_ROLES = ['Super Admin', 'Admin', 'Manager', 'Sales Clerk'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Enable a permission + all its required dependencies (BFS) */
function enableWithDeps(perm: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  const queue = [perm];
  while (queue.length) {
    const p = queue.shift()!;
    if (!next.has(p)) {
      next.add(p);
      (PERMISSION_DEPS[p] ?? []).forEach((d) => queue.push(d));
    }
  }
  return next;
}

/** Disable a permission + cascade disable every permission that depends on it */
function disableWithCascade(perm: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  const queue = [perm];
  while (queue.length) {
    const p = queue.shift()!;
    if (next.has(p)) {
      next.delete(p);
      (REVERSE_DEPS[p] ?? []).forEach((d) => queue.push(d));
    }
  }
  return next;
}

// ─── PermToggle ───────────────────────────────────────────────────────────────
function PermToggle({
  on, partial = false, disabled, size = 'md', onToggle, label,
}: {
  on: boolean; partial?: boolean; disabled: boolean;
  size?: 'sm' | 'md'; onToggle: () => void; label: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`neu-perm-toggle ${on ? 'neu-perm-toggle--on' : ''} ${partial ? 'neu-perm-toggle--partial' : ''} ${size === 'sm' ? 'neu-perm-toggle--sm' : ''}`}
      disabled={disabled}
      aria-label={label}
    >
      <span className="neu-perm-toggle-knob" />
    </button>
  );
}

// ─── ModuleToggleRow ──────────────────────────────────────────────────────────
function ModuleToggleRow({
  mod, localPerms, onToggleModule, onTogglePermission, disabled, search, forceExpand,
}: {
  mod: typeof MODULE_MAP[0];
  localPerms: Set<string>;
  onToggleModule: () => void;
  onTogglePermission: (perm: string) => void;
  disabled: boolean;
  search: string;
  forceExpand: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const enabledCount = mod.permissions.filter((p) => localPerms.has(p)).length;
  const isOn      = enabledCount === mod.permissions.length;
  const isPartial = enabledCount > 0 && !isOn;

  const filteredPerms = search
    ? mod.permissions.filter((p) => {
        const meta = PERMISSION_META[p];
        const q = search.toLowerCase();
        return p.toLowerCase().includes(q)
          || meta?.label.toLowerCase().includes(q)
          || meta?.description.toLowerCase().includes(q);
      })
    : mod.permissions;

  const showExpanded = expanded || forceExpand || (!!search && filteredPerms.length > 0);

  if (search && filteredPerms.length === 0) return null;

  return (
    <div
      className="rounded-2xl transition-all"
      style={{ background: 'var(--n-inset)', boxShadow: 'inset 2px 2px 4px var(--n-shadow-dark-sm), inset -2px -2px 4px var(--n-shadow-light-sm)' }}
    >
      {/* Module header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--n-text)' }}>
            {mod.label}
          </span>
          {isPartial && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--n-accent-glow)', color: 'var(--n-accent)' }}>
              Partial
            </span>
          )}
          <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--n-text-dim)' }}>
            {enabledCount}/{mod.permissions.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {showExpanded
            ? <HiChevronUp className="w-4 h-4" style={{ color: 'var(--n-text-dim)' }} />
            : <HiChevronDown className="w-4 h-4" style={{ color: 'var(--n-text-dim)' }} />
          }
          <PermToggle on={isOn} partial={isPartial} disabled={disabled} onToggle={onToggleModule} label={`Toggle ${mod.label}`} />
        </div>
      </div>

      {/* Expanded: individual permissions */}
      {showExpanded && (
        <div className="px-4 pb-4 pt-1 space-y-1" style={{ borderTop: '1px solid var(--n-divider)' }}>
          {filteredPerms.map((perm) => {
            const meta = PERMISSION_META[perm];
            const hasDeps = (PERMISSION_DEPS[perm] ?? []).length > 0;
            return (
              <div key={perm} className="flex items-center justify-between py-1.5 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--n-text-secondary)' }}>
                      {meta?.label ?? perm}
                    </span>
                    {hasDeps && (
                      <span className="text-[9px] font-mono px-1 rounded" style={{ background: 'var(--n-divider)', color: 'var(--n-text-dim)' }}>
                        deps
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] block mt-0.5" style={{ color: 'var(--n-text-dim)' }}>
                    {meta?.description ?? perm}
                  </span>
                </div>
                <PermToggle
                  on={localPerms.has(perm)}
                  disabled={disabled}
                  size="sm"
                  onToggle={() => onTogglePermission(perm)}
                  label={`Toggle ${perm}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── GroupSection ─────────────────────────────────────────────────────────────
function GroupSection({
  group, modules, localPerms, onToggleGroup, onToggleModule, onTogglePermission, disabled, search, forceExpand,
}: {
  group: string; modules: typeof MODULE_MAP; localPerms: Set<string>;
  onToggleGroup: () => void; onToggleModule: (mod: typeof MODULE_MAP[0]) => void;
  onTogglePermission: (perm: string) => void; disabled: boolean; search: string; forceExpand: boolean;
}) {
  const allPerms     = modules.flatMap((m) => m.permissions);
  const enabledCount = allPerms.filter((p) => localPerms.has(p)).length;
  const isGroupOn    = enabledCount === allPerms.length;
  const meta         = GROUP_META[group];

  const hasAnyMatch = !search || modules.some((mod) =>
    mod.label.toLowerCase().includes(search.toLowerCase()) ||
    mod.permissions.some((p) => {
      const m = PERMISSION_META[p];
      const q = search.toLowerCase();
      return p.toLowerCase().includes(q) || m?.label.toLowerCase().includes(q) || m?.description.toLowerCase().includes(q);
    })
  );
  if (!hasAnyMatch) return null;

  return (
    <div className="mb-5">
      {/* Group header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span style={{ color: meta?.color ?? 'var(--n-accent)' }}>{meta?.icon}</span>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--n-text-dim)' }}>{group}</span>
          <span className="text-[10px] font-mono" style={{ color: 'var(--n-text-dim)' }}>{enabledCount}/{allPerms.length}</span>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onToggleGroup}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: isGroupOn ? 'var(--n-accent-glow)' : 'var(--n-divider)', color: isGroupOn ? 'var(--n-accent)' : 'var(--n-text-dim)', border: 'none', cursor: 'pointer' }}
          >
            {isGroupOn ? 'Disable All' : 'Enable All'}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {modules.map((mod) => (
          <ModuleToggleRow
            key={mod.label}
            mod={mod}
            localPerms={localPerms}
            onToggleModule={() => onToggleModule(mod)}
            onTogglePermission={onTogglePermission}
            disabled={disabled}
            search={search}
            forceExpand={forceExpand}
          />
        ))}
      </div>
    </div>
  );
}

// ─── PermissionStats ──────────────────────────────────────────────────────────
function PermissionStats({ localPerms }: { localPerms: Set<string> }) {
  const total   = ALL_PERMISSIONS.length;
  const enabled = ALL_PERMISSIONS.filter((p) => localPerms.has(p)).length;
  const pct     = Math.round((enabled / total) * 100);

  return (
    <div className="p-3 rounded-xl mb-4"
      style={{ background: 'var(--n-inset)', boxShadow: 'inset 2px 2px 4px var(--n-shadow-dark-sm), inset -2px -2px 4px var(--n-shadow-light-sm)' }}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-semibold" style={{ color: 'var(--n-text-secondary)' }}>Permission Coverage</span>
        <span className="text-xs font-bold font-mono" style={{ color: 'var(--n-accent)' }}>{enabled}/{total} — {pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--n-divider)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--n-accent), var(--n-accent-hover))' }}
        />
      </div>
    </div>
  );
}

// ─── RoleCard ─────────────────────────────────────────────────────────────────
function RoleCard({
  role, isSelected, canManage, deleting, onSelect, onClone, onRename, onDelete,
}: {
  role: Role; isSelected: boolean; canManage: boolean; deleting: boolean;
  onSelect: () => void; onClone: (e: React.MouseEvent) => void;
  onRename: (e: React.MouseEvent) => void; onDelete: (e: React.MouseEvent) => void;
}) {
  const isSystem = SYSTEM_ROLES.includes(role.name);
  const pct = Math.round((role.permissions.length / ALL_PERMISSIONS.length) * 100);

  return (
    <Card
      className={`p-4 cursor-pointer transition-all ${isSelected ? 'ring-2 ring-(--n-accent)' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={ROLE_BADGE[role.name] || 'neutral'}>{role.name}</Badge>
            {isSystem && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--n-divider)', color: 'var(--n-text-dim)' }}>
                system
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <HiUserGroup className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--n-text-dim)' }} />
            <span className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>
              {role.users_count} user{role.users_count !== 1 ? 's' : ''}
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="mt-2.5">
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-mono" style={{ color: 'var(--n-text-dim)' }}>{role.permissions.length} perms</span>
              <span className="text-[9px] font-mono" style={{ color: 'var(--n-text-dim)' }}>{pct}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--n-divider)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: role.name === 'Super Admin'
                    ? 'var(--n-danger)'
                    : 'linear-gradient(90deg, var(--n-accent), var(--n-accent-hover))',
                }}
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {canManage && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <button type="button" className="neu-btn-icon" onClick={onClone} title="Clone role">
              <HiDuplicate className="w-3.5 h-3.5" />
            </button>
            {!isSystem && (
              <button type="button" className="neu-btn-icon" onClick={onRename} title="Rename role">
                <HiPencil className="w-3.5 h-3.5" />
              </button>
            )}
            {!isSystem && (
              <button type="button" className="neu-btn-icon danger" disabled={deleting} onClick={onDelete} title="Delete role">
                <HiTrash className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function RoleManagementPage() {
  const { hasRole, checkAuth } = useAuthStore();

  const [roles, setRoles]               = useState<Role[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [localPerms, setLocalPerms]     = useState<Set<string>>(new Set());
  const [saving, setSaving]             = useState(false);
  const [dirty, setDirty]               = useState(false);

  // Toolbar state
  const [search, setSearch]             = useState('');
  const [allExpanded, setAllExpanded]   = useState(false);

  // Create modal
  const [createOpen, setCreateOpen]     = useState(false);
  const [newRoleName, setNewRoleName]   = useState('');
  const [creating, setCreating]         = useState(false);

  // Clone modal
  const [cloneOpen, setCloneOpen]       = useState(false);
  const [cloneSource, setCloneSource]   = useState<Role | null>(null);
  const [cloneName, setCloneName]       = useState('');
  const [cloning, setCloning]           = useState(false);

  // Rename modal
  const [renameOpen, setRenameOpen]     = useState(false);
  const [renameTarget, setRenameTarget] = useState<Role | null>(null);
  const [renameValue, setRenameValue]   = useState('');
  const [renaming, setRenaming]         = useState(false);

  const [deleting, setDeleting]         = useState(false);

  const canManage   = hasRole('Super Admin');
  const isSuperAdmin = selectedRole?.name === 'Super Admin';
  const isReadOnly  = !canManage || isSuperAdmin;

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchRoles = () => {
    setLoading(true);
    api.get('/roles')
      .then((res) => {
        setRoles(res.data.data);
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
    setSearch('');
  };

  // ── Permission toggles ──────────────────────────────────────────────────────
  const togglePermission = (perm: string) => {
    if (isReadOnly) return;
    setLocalPerms((prev) => prev.has(perm) ? disableWithCascade(perm, prev) : enableWithDeps(perm, prev));
    setDirty(true);
  };

  const toggleModule = (mod: typeof MODULE_MAP[0]) => {
    if (isReadOnly) return;
    const allOn = mod.permissions.every((p) => localPerms.has(p));
    setLocalPerms((prev) => {
      let next = new Set(prev);
      if (allOn) { mod.permissions.forEach((p) => { next = disableWithCascade(p, next); }); }
      else        { mod.permissions.forEach((p) => { next = enableWithDeps(p, next); }); }
      return next;
    });
    setDirty(true);
  };

  const toggleGroup = (groupModules: typeof MODULE_MAP) => {
    if (isReadOnly) return;
    const allPerms = groupModules.flatMap((m) => m.permissions);
    const allOn = allPerms.every((p) => localPerms.has(p));
    setLocalPerms((prev) => {
      let next = new Set(prev);
      if (allOn) { allPerms.forEach((p) => { next = disableWithCascade(p, next); }); }
      else        { allPerms.forEach((p) => { next = enableWithDeps(p, next); }); }
      return next;
    });
    setDirty(true);
  };

  const selectAll  = () => { if (!isReadOnly) { setLocalPerms(new Set(ALL_PERMISSIONS)); setDirty(true); } };
  const selectNone = () => { if (!isReadOnly) { setLocalPerms(new Set()); setDirty(true); } };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await api.put(`/roles/${selectedRole.id}`, { permissions: Array.from(localPerms) });
      toast.success(`Permissions updated for ${selectedRole.name}`);
      setDirty(false);
      setRoles((prev) => prev.map((r) => r.id === selectedRole.id ? res.data.data : r));
      setSelectedRole(res.data.data);
      setLocalPerms(new Set(res.data.data.permissions));
      await checkAuth();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Failed to update permissions');
    } finally { setSaving(false); }
  };

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newRoleName.trim()) { toast.error('Role name is required'); return; }
    setCreating(true);
    try {
      const res = await api.post('/roles', { name: newRoleName.trim() });
      toast.success(`Role "${res.data.data.name}" created`);
      const updated = [...roles, res.data.data].sort((a, b) => a.name.localeCompare(b.name));
      setRoles(updated);
      setCreateOpen(false);
      setNewRoleName('');
      selectRole(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const errs = e.response?.data?.errors;
      toast.error(errs ? Object.values(errs)[0][0] : e.response?.data?.message || 'Failed to create role');
    } finally { setCreating(false); }
  };

  // ── Rename ──────────────────────────────────────────────────────────────────
  const openRename = (role: Role, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameTarget(role);
    setRenameValue(role.name);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setRenaming(true);
    try {
      const res = await api.patch(`/roles/${renameTarget.id}/rename`, { name: renameValue.trim() });
      toast.success(`Role renamed to "${res.data.data.name}"`);
      const updated = roles.map((r) => r.id === renameTarget.id ? res.data.data : r)
        .sort((a, b) => a.name.localeCompare(b.name));
      setRoles(updated);
      if (selectedRole?.id === renameTarget.id) setSelectedRole(res.data.data);
      setRenameOpen(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const errs = e.response?.data?.errors;
      toast.error(errs ? Object.values(errs)[0][0] : e.response?.data?.message || 'Failed to rename role');
    } finally { setRenaming(false); }
  };

  // ── Clone ───────────────────────────────────────────────────────────────────
  const openClone = (role: Role, e: React.MouseEvent) => {
    e.stopPropagation();
    setCloneSource(role);
    setCloneName(`${role.name} (Copy)`);
    setCloneOpen(true);
  };

  const handleClone = async () => {
    if (!cloneSource || !cloneName.trim()) return;
    setCloning(true);
    try {
      const res = await api.post(`/roles/${cloneSource.id}/clone`, { name: cloneName.trim() });
      toast.success(res.data.message);
      const updated = [...roles, res.data.data].sort((a, b) => a.name.localeCompare(b.name));
      setRoles(updated);
      setCloneOpen(false);
      selectRole(res.data.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const errs = e.response?.data?.errors;
      toast.error(errs ? Object.values(errs)[0][0] : e.response?.data?.message || 'Failed to clone role');
    } finally { setCloning(false); }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (role: Role, e: React.MouseEvent) => {
    e.stopPropagation();
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
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Failed to delete role');
    } finally { setDeleting(false); }
  };

  // ── Filtered groups ─────────────────────────────────────────────────────────
  const filteredGroupEntries = useMemo(() => {
    if (!search) return Object.entries(GROUPED_MODULES);
    return Object.entries(GROUPED_MODULES).filter(([, modules]) =>
      modules.some((mod) =>
        mod.label.toLowerCase().includes(search.toLowerCase()) ||
        mod.permissions.some((p) => {
          const m = PERMISSION_META[p];
          const q = search.toLowerCase();
          return p.toLowerCase().includes(q) || m?.label.toLowerCase().includes(q) || m?.description.toLowerCase().includes(q);
        })
      )
    );
  }, [search]);

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
          <div>
            <h1 className="neu-page-title">Role Management</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--n-text-dim)' }}>Configure role-based access permissions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <Button variant="secondary" onClick={() => { setNewRoleName(''); setCreateOpen(true); }}>
              <HiPlus className="w-4 h-4 mr-2" /> New Role
            </Button>
          )}
          {canManage && dirty && !isSuperAdmin && (
            <Button variant="amber" onClick={handleSave} disabled={saving} loading={saving}>
              <HiSave className="w-4 h-4 mr-2" />
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── Role List ── */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--n-text-dim)' }}>
              Roles ({roles.length})
            </p>
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                isSelected={selectedRole?.id === role.id}
                canManage={canManage}
                deleting={deleting}
                onSelect={() => selectRole(role)}
                onClone={(e) => openClone(role, e)}
                onRename={(e) => openRename(role, e)}
                onDelete={(e) => handleDelete(role, e)}
              />
            ))}
          </div>

          {/* ── Permission Editor ── */}
          <div className="lg:col-span-3">
            {selectedRole ? (
              <Card className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--n-font-display)', color: 'var(--n-text)' }}>
                        {selectedRole.name}
                      </h2>
                      {isSuperAdmin && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--n-danger-glow)', color: 'var(--n-danger)' }}>
                          <HiLockClosed className="w-3 h-3" /> Unrestricted
                        </span>
                      )}
                      {SYSTEM_ROLES.includes(selectedRole.name) && !isSuperAdmin && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--n-info-glow)', color: 'var(--n-info)' }}>
                          <HiCollection className="w-3 h-3" /> Built-in
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--n-text-secondary)' }}>
                      {isSuperAdmin
                        ? 'Super Admin has unrestricted access to everything. Permissions cannot be modified.'
                        : 'Toggle individual permissions or use group controls for bulk changes. Enabling a permission automatically enables its required dependencies.'}
                    </p>
                  </div>
                  {dirty && (
                    <span className="text-xs px-2.5 py-1 rounded-full shrink-0 ml-4"
                      style={{ background: 'var(--n-accent-glow)', color: 'var(--n-accent)' }}>
                      Unsaved changes
                    </span>
                  )}
                </div>

                {/* Stats bar */}
                {!isSuperAdmin && <PermissionStats localPerms={localPerms} />}

                {/* Toolbar */}
                {!isSuperAdmin && (
                  <div className="flex items-center gap-2 mb-5 flex-wrap">
                    {/* Search */}
                    <div className="flex-1 min-w-48">
                      <div className="neu-inset flex items-center px-3 gap-2">
                        <HiSearch className="w-4 h-4 shrink-0" style={{ color: 'var(--n-text-dim)' }} />
                        <input
                          type="text"
                          className="neu-input flex-1"
                          placeholder="Search permissions…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                          <button type="button" onClick={() => setSearch('')}
                            style={{ color: 'var(--n-text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expand/Collapse All */}
                    <button
                      type="button"
                      onClick={() => setAllExpanded((v) => !v)}
                      title={allExpanded ? 'Collapse all' : 'Expand all'}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
                      style={{ background: 'var(--n-inset)', color: 'var(--n-text-secondary)', border: 'none', cursor: 'pointer',
                        boxShadow: 'inset 2px 2px 4px var(--n-shadow-dark-sm), inset -2px -2px 4px var(--n-shadow-light-sm)' }}
                    >
                      {allExpanded ? <HiChevronUp className="w-4 h-4" /> : <HiChevronDown className="w-4 h-4" />}
                    </button>

                    {/* Select All */}
                    {canManage && (
                      <button type="button" onClick={selectAll}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
                        style={{ background: 'var(--n-success-glow)', color: 'var(--n-success)', border: 'none', cursor: 'pointer' }}>
                        <HiCheckCircle className="w-3.5 h-3.5" /> All
                      </button>
                    )}

                    {/* Select None */}
                    {canManage && (
                      <button type="button" onClick={selectNone}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
                        style={{ background: 'var(--n-danger-glow)', color: 'var(--n-danger)', border: 'none', cursor: 'pointer' }}>
                        <HiMinusCircle className="w-3.5 h-3.5" /> None
                      </button>
                    )}
                  </div>
                )}

                {/* Permission groups */}
                {isSuperAdmin ? (
                  <div className="space-y-3">
                    {Object.entries(GROUPED_MODULES).map(([group, modules]) => {
                      const gm = GROUP_META[group];
                      return (
                        <div key={group} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                          style={{ background: 'var(--n-inset)', boxShadow: 'inset 2px 2px 4px var(--n-shadow-dark-sm), inset -2px -2px 4px var(--n-shadow-light-sm)' }}>
                          <span style={{ color: gm?.color ?? 'var(--n-accent)' }}>{gm?.icon}</span>
                          <span className="text-sm font-semibold" style={{ color: 'var(--n-text)' }}>{group}</span>
                          <span className="text-xs ml-auto" style={{ color: 'var(--n-text-dim)' }}>
                            {modules.flatMap((m) => m.permissions).length} permissions
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--n-danger-glow)', color: 'var(--n-danger)' }}>
                            Full Access
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : filteredGroupEntries.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: 'var(--n-text-dim)' }}>
                    No permissions match "{search}"
                  </p>
                ) : (
                  filteredGroupEntries.map(([group, modules]) => (
                    <GroupSection
                      key={group}
                      group={group}
                      modules={modules}
                      localPerms={localPerms}
                      onToggleGroup={() => toggleGroup(modules)}
                      onToggleModule={toggleModule}
                      onTogglePermission={togglePermission}
                      disabled={isReadOnly}
                      search={search}
                      forceExpand={allExpanded}
                    />
                  ))
                )}
              </Card>
            ) : (
              <Card className="p-12">
                <p className="text-center" style={{ color: 'var(--n-text-dim)' }}>Select a role to manage permissions.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── Create Role Modal ── */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create New Role" width="sm">
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
            The new role starts with no permissions. Configure access after creating.
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="amber" onClick={handleCreate} disabled={creating || !newRoleName.trim()} loading={creating}>
            Create Role
          </Button>
        </div>
      </Modal>

      {/* ── Clone Role Modal ── */}
      <Modal isOpen={cloneOpen} onClose={() => setCloneOpen(false)} title="Clone Role" width="sm">
        <div className="space-y-4">
          <div className="p-3 rounded-xl text-sm"
            style={{ background: 'var(--n-inset)', boxShadow: 'inset 2px 2px 4px var(--n-shadow-dark-sm), inset -2px -2px 4px var(--n-shadow-light-sm)' }}>
            <span style={{ color: 'var(--n-text-dim)' }}>Cloning from: </span>
            <span className="font-semibold" style={{ color: 'var(--n-text)' }}>{cloneSource?.name}</span>
            <span className="ml-2 text-xs font-mono" style={{ color: 'var(--n-text-dim)' }}>
              ({cloneSource?.permissions.length} permissions)
            </span>
          </div>
          <Input
            label="New Role Name"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleClone(); }}
            placeholder="e.g. Senior Sales Clerk"
            required
          />
          <p className="text-xs" style={{ color: 'var(--n-text-dim)' }}>
            All permissions from "{cloneSource?.name}" will be copied to the new role.
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setCloneOpen(false)}>Cancel</Button>
          <Button variant="amber" onClick={handleClone} disabled={cloning || !cloneName.trim()} loading={cloning}>
            Clone Role
          </Button>
        </div>
      </Modal>

      {/* ── Rename Role Modal ── */}
      <Modal isOpen={renameOpen} onClose={() => setRenameOpen(false)} title="Rename Role" width="sm">
        <div className="space-y-4">
          <Input
            label="New Role Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
            placeholder="Role name"
            required
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button
            variant="amber"
            onClick={handleRename}
            disabled={renaming || !renameValue.trim() || renameValue.trim() === renameTarget?.name}
            loading={renaming}
          >
            Rename
          </Button>
        </div>
      </Modal>
    </div>
  );
}
