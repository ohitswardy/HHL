import { useEffect, useRef, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { DatePicker } from '../../../components/ui/DatePicker';
import { HiClipboardList, HiSearch, HiChevronDown, HiChevronUp, HiRefresh, HiX, HiDownload } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../stores/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditUser {
  id: number;
  name: string;
}

interface AuditLog {
  id: number;
  user: AuditUser | null;
  action: string;
  table_name: string;
  record_id: number | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface Meta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface Stats {
  total: number;
  today: number;
  unique_users: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TABLE_LABELS: Record<string, string> = {
  users: 'Users',
  roles: 'Roles',
  products: 'Products',
  categories: 'Categories',
  clients: 'Clients',
  suppliers: 'Suppliers',
  inventory_stocks: 'Stock',
  inventory_movements: 'Stock Movements',
  purchase_orders: 'Purchase Orders',
  pos_transactions: 'POS Sales',
  expenses: 'Expenses',
  journal_entries: 'Journal Entries',
  chart_of_accounts: 'Chart of Accounts',
};

const ACTION_CONFIG: Record<string, { variant: 'success' | 'info' | 'danger' | 'warning' | 'neutral'; label: string }> = {
  created:             { variant: 'success', label: 'Created' },
  updated:             { variant: 'info',    label: 'Updated' },
  deleted:             { variant: 'danger',  label: 'Deleted' },
  permissions_updated: { variant: 'warning', label: 'Permissions' },
  login:               { variant: 'neutral', label: 'Login' },
  logout:              { variant: 'neutral', label: 'Logout' },
};

function actionConfig(action: string) {
  return ACTION_CONFIG[action] ?? { variant: 'neutral' as const, label: action };
}

function friendlyTable(name: string) {
  return TABLE_LABELS[name] ?? name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── Diff Viewer ─────────────────────────────────────────────────────────────

function DiffViewer({ oldVal, newVal }: { oldVal: Record<string, unknown> | null; newVal: Record<string, unknown> | null }) {
  if (!oldVal && !newVal) {
    return <p className="text-xs italic" style={{ color: 'var(--n-text-dim)' }}>No data snapshot recorded.</p>;
  }

  // Collect all keys
  const keys = Array.from(new Set([...Object.keys(oldVal ?? {}), ...Object.keys(newVal ?? {})]));

  if (!oldVal) {
    // Pure create — show new values
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--n-text-dim)' }}>Created Values</p>
        <div className="space-y-1">
          {keys.map((k) => (
            <div key={k} className="flex gap-2 text-xs">
              <span className="font-mono w-36 shrink-0 truncate" style={{ color: 'var(--n-text-dim)' }}>{k}</span>
              <span className="font-mono" style={{ color: 'var(--n-accent)' }}>{String(newVal![k] ?? '')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!newVal) {
    // Pure delete — show old values
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--n-text-dim)' }}>Deleted Snapshot</p>
        <div className="space-y-1">
          {keys.map((k) => (
            <div key={k} className="flex gap-2 text-xs">
              <span className="font-mono w-36 shrink-0 truncate" style={{ color: 'var(--n-text-dim)' }}>{k}</span>
              <span className="font-mono line-through" style={{ color: 'var(--n-danger, #ef4444)' }}>{String(oldVal[k] ?? '')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Update diff
  const changed = keys.filter((k) => JSON.stringify(oldVal[k]) !== JSON.stringify(newVal[k]));
  const unchanged = keys.filter((k) => JSON.stringify(oldVal[k]) === JSON.stringify(newVal[k]));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--n-text-dim)' }}>Before</p>
        <div className="space-y-1">
          {changed.map((k) => (
            <div key={k} className="flex gap-2 text-xs">
              <span className="font-mono w-36 shrink-0 truncate font-semibold" style={{ color: 'var(--n-text-secondary)' }}>{k}</span>
              <span className="font-mono line-through" style={{ color: 'var(--n-danger, #ef4444)' }}>
                {typeof oldVal[k] === 'object' ? JSON.stringify(oldVal[k]) : String(oldVal[k] ?? '')}
              </span>
            </div>
          ))}
          {unchanged.map((k) => (
            <div key={k} className="flex gap-2 text-xs opacity-40">
              <span className="font-mono w-36 shrink-0 truncate" style={{ color: 'var(--n-text-dim)' }}>{k}</span>
              <span className="font-mono" style={{ color: 'var(--n-text-secondary)' }}>
                {typeof oldVal[k] === 'object' ? JSON.stringify(oldVal[k]) : String(oldVal[k] ?? '')}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--n-text-dim)' }}>After</p>
        <div className="space-y-1">
          {changed.map((k) => (
            <div key={k} className="flex gap-2 text-xs">
              <span className="font-mono w-36 shrink-0 truncate font-semibold" style={{ color: 'var(--n-text-secondary)' }}>{k}</span>
              <span className="font-mono font-semibold" style={{ color: 'var(--n-accent)' }}>
                {typeof newVal[k] === 'object' ? JSON.stringify(newVal[k]) : String(newVal[k] ?? '')}
              </span>
            </div>
          ))}
          {unchanged.map((k) => (
            <div key={k} className="flex gap-2 text-xs opacity-40">
              <span className="font-mono w-36 shrink-0 truncate" style={{ color: 'var(--n-text-dim)' }}>{k}</span>
              <span className="font-mono" style={{ color: 'var(--n-text-secondary)' }}>
                {typeof newVal[k] === 'object' ? JSON.stringify(newVal[k]) : String(newVal[k] ?? '')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function AuditRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = actionConfig(log.action);
  const hasDiff = log.old_value !== null || log.new_value !== null;

  return (
    <>
      <tr
        className={`transition-colors ${hasDiff ? 'cursor-pointer hover:bg-[var(--n-inset)]' : ''}`}
        onClick={() => hasDiff && setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--n-text-secondary)' }}>
          {formatTs(log.created_at)}
        </td>
        <td className="px-4 py-3">
          {log.user ? (
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                style={{ background: 'var(--n-accent-glow)', color: 'var(--n-accent)' }}
              >
                {log.user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm" style={{ color: 'var(--n-text)' }}>{log.user.name}</span>
            </div>
          ) : (
            <span className="text-xs italic" style={{ color: 'var(--n-text-dim)' }}>System</span>
          )}
        </td>
        <td className="px-4 py-3">
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        </td>
        <td className="px-4 py-3 text-sm" style={{ color: 'var(--n-text-secondary)' }}>
          {friendlyTable(log.table_name)}
        </td>
        <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--n-text-dim)' }}>
          {log.record_id ?? '—'}
        </td>
        <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--n-text-dim)' }}>
          {log.ip_address ?? '—'}
        </td>
        <td className="px-4 py-3 text-right">
          {hasDiff && (
            <span style={{ color: 'var(--n-text-dim)' }}>
              {expanded ? <HiChevronUp className="w-4 h-4 inline" /> : <HiChevronDown className="w-4 h-4 inline" />}
            </span>
          )}
        </td>
      </tr>

      {expanded && hasDiff && (
        <tr>
          <td colSpan={7} className="px-6 pb-4 pt-1">
            <div
              className="rounded-xl p-4"
              style={{
                background: 'var(--n-inset)',
                boxShadow: 'inset 2px 2px 4px var(--n-shadow-dark-sm), inset -2px -2px 4px var(--n-shadow-light-sm)',
              }}
            >
              <DiffViewer oldVal={log.old_value} newVal={log.new_value} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const emptyFilters = { search: '', action: '', table_name: '', date_from: '', date_to: '' };

export function AuditTrailPage() {
  const { hasRole } = useAuthStore();
  const canAccess = hasRole('Super Admin');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<Meta>({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [tableOptions, setTableOptions] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  // debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canAccess) return;
    fetchStats();
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    fetchLogs();
  }, [appliedFilters, page, canAccess]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const fetchStats = () => {
    api.get('/audit-logs/stats')
      .then((res) => setStats(res.data.data))
      .catch(() => {/* non-critical */});
  };

  const fetchLogs = () => {
    setLoading(true);
    const params: Record<string, string | number> = { page, per_page: 25 };
    if (appliedFilters.search)     params.search     = appliedFilters.search;
    if (appliedFilters.action)     params.action     = appliedFilters.action;
    if (appliedFilters.table_name) params.table_name = appliedFilters.table_name;
    if (appliedFilters.date_from)  params.date_from  = appliedFilters.date_from;
    if (appliedFilters.date_to)    params.date_to    = appliedFilters.date_to;

    api.get('/audit-logs', { params })
      .then((res) => {
        setLogs(res.data.data);
        setMeta(res.data.meta);
        if (res.data.filters?.actions?.length)    setActionOptions(res.data.filters.actions);
        if (res.data.filters?.table_names?.length) setTableOptions(res.data.filters.table_names);
      })
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false));
  };

  const handleSearchChange = (val: string) => {
    setFilters((f) => ({ ...f, search: val }));
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setAppliedFilters((f) => ({ ...f, search: val }));
      setPage(1);
    }, 400);
  };

  const applyFilter = (key: keyof typeof filters, val: string) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setAppliedFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  const isFiltered = Object.values(appliedFilters).some(Boolean);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: 'var(--n-text-dim)' }}>You do not have access to this page.</p>
      </div>
    );
  }

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params: Record<string, string | number> = { per_page: 5000 };
      if (appliedFilters.search)     params.search     = appliedFilters.search;
      if (appliedFilters.action)     params.action     = appliedFilters.action;
      if (appliedFilters.table_name) params.table_name = appliedFilters.table_name;
      if (appliedFilters.date_from)  params.date_from  = appliedFilters.date_from;
      if (appliedFilters.date_to)    params.date_to    = appliedFilters.date_to;

      const res = await api.get('/audit-logs', { params });
      const rows: AuditLog[] = res.data.data;

      const header = ['ID', 'Timestamp', 'User', 'Action', 'Module', 'Record ID', 'IP Address'];
      const lines = rows.map((r) => [
        r.id,
        formatTs(r.created_at),
        r.user?.name ?? 'System',
        r.action,
        friendlyTable(r.table_name),
        r.record_id ?? '',
        r.ip_address ?? '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

      const csv = [header.join(','), ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HiClipboardList className="w-7 h-7" style={{ color: 'var(--n-accent)' }} />
          <h1 className="neu-page-title">Audit Trail</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={fetchLogs} disabled={loading}>
            <HiRefresh className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="secondary" onClick={exportCsv} disabled={exporting || loading}>
            <HiDownload className="w-4 h-4 mr-1.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Events', value: stats.total.toLocaleString() },
            { label: 'Events Today', value: stats.today.toLocaleString() },
            { label: 'Active Users', value: stats.unique_users.toLocaleString() },
          ].map(({ label, value }) => (
            <Card key={label} className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--n-text-dim)' }}>
                {label}
              </p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'var(--n-font-display)', color: 'var(--n-text)' }}>
                {value}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <HiSearch className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--n-text-dim)' }} />
            <input
              className="neu-inline-input w-full"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search user, module, action, IP..."
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Action filter */}
          <div className="w-44 shrink-0">
            <Select
              label=""
              value={filters.action}
              onChange={(e) => applyFilter('action', e.target.value)}
              options={[
                { value: '', label: 'All Actions' },
                ...actionOptions.map((a) => ({ value: a, label: actionConfig(a).label })),
              ]}
            />
          </div>

          {/* Module filter */}
          <div className="w-44 shrink-0">
            <Select
              label=""
              value={filters.table_name}
              onChange={(e) => applyFilter('table_name', e.target.value)}
              options={[
                { value: '', label: 'All Modules' },
                ...tableOptions.map((t) => ({ value: t, label: friendlyTable(t) })),
              ]}
            />
          </div>

          {/* Date range */}
          <div className="shrink-0 w-36">
            <label className="neu-label">From</label>
            <DatePicker
              inline
              value={filters.date_from}
              onChange={(e) => applyFilter('date_from', e.target.value)}
              placeholder="From"
              max={filters.date_to || undefined}
            />
          </div>
          <div className="shrink-0 w-36">
            <label className="neu-label">To</label>
            <DatePicker
              inline
              value={filters.date_to}
              onChange={(e) => applyFilter('date_to', e.target.value)}
              placeholder="To"
              min={filters.date_from || undefined}
            />
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl transition-colors"
              style={{ color: 'var(--n-text-dim)', background: 'var(--n-inset)' }}
            >
              <HiX className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <Spinner />
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <HiClipboardList className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--n-text-dim)' }} />
            <p style={{ color: 'var(--n-text-dim)' }}>
              {isFiltered ? 'No events match your filters.' : 'No audit events recorded yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="neu-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Module</th>
                    <th>Record ID</th>
                    <th>IP Address</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <AuditRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.last_page > 1 && (
              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--n-divider)' }}>
                <p className="text-xs" style={{ color: 'var(--n-text-dim)' }}>
                  Page {meta.current_page} of {meta.last_page} &mdash; {meta.total.toLocaleString()} total events
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={meta.current_page === 1}
                  >
                    Previous
                  </Button>

                  {/* Page number pills */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, meta.last_page) }, (_, i) => {
                      const start = Math.max(1, Math.min(meta.current_page - 2, meta.last_page - 4));
                      const p = start + i;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                          style={
                            p === meta.current_page
                              ? { background: 'var(--n-accent)', color: '#fff' }
                              : { background: 'var(--n-inset)', color: 'var(--n-text-secondary)' }
                          }
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                    disabled={meta.current_page === meta.last_page}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
