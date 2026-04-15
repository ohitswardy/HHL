import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { HiDocumentReport, HiCash, HiChartBar, HiDocumentText, HiUserGroup, HiCurrencyDollar, HiClipboardList, HiLibrary, HiAdjustments, HiLockClosed } from 'react-icons/hi';
import { useAuthStore } from '../../../stores/authStore';

const links = [
  { to: '/accounting/journal', label: 'Journal Entries', desc: 'View all double-entry journal records', icon: <HiDocumentReport className="w-8 h-8" />, color: 'text-[var(--n-info)] bg-[var(--n-info-glow)]', permission: 'accounting.journal-entries' },
  { to: '/accounting/expenses', label: 'Expenses', desc: 'Track and manage all business expenses', icon: <HiCurrencyDollar className="w-8 h-8" />, color: 'text-[var(--n-danger)] bg-[var(--n-danger-glow)]', permission: 'accounting.view' },
  { to: '/accounting/bank-transactions', label: 'Summary of Business Bank Transactions', desc: 'Track all money in and out of the business bank', icon: <HiLibrary className="w-8 h-8" />, color: 'text-[var(--n-info)] bg-[var(--n-info-glow)]', permission: 'bank-reconciliation.view' },
  { to: '/accounting/reports/income', label: 'Income Statement', desc: 'Revenue, COGS, and expenses', icon: <HiCash className="w-8 h-8" />, color: 'text-[var(--n-success)] bg-[var(--n-success-glow)]', permission: 'reports.income-statement' },
  { to: '/accounting/reports/balance-sheet', label: 'Balance Sheet', desc: 'Assets, liabilities, and equity', icon: <HiChartBar className="w-8 h-8" />, color: 'text-[var(--n-accent)] bg-[var(--n-accent-glow)]', permission: 'reports.balance-sheet' },
  { to: '/accounting/reports/cash-flow', label: 'Cash Flow', desc: 'Inflows and outflows of cash', icon: <HiDocumentText className="w-8 h-8" />, color: 'text-[var(--n-warning)] bg-[var(--n-warning-glow)]', permission: 'reports.cash-flow' },
  { to: '/accounting/reports/client-statements', label: 'Client Statements', desc: 'Account statements per client', icon: <HiUserGroup className="w-8 h-8" />, color: 'text-[var(--n-text-secondary)] bg-[var(--n-inset)]', permission: 'reports.client-statements' },
  { to: '/accounting/chart-of-accounts', label: 'Chart of Accounts', desc: 'Manage and organize all accounts', icon: <HiClipboardList className="w-8 h-8" />, color: 'text-[var(--n-info)] bg-[var(--n-info-glow)]', permission: 'accounting.view' },
  { to: '/accounting/tax-settings', label: 'Tax Settings', desc: 'Configure the system-wide VAT / sales tax rate', icon: <HiAdjustments className="w-8 h-8" />, color: 'text-[var(--n-warning)] bg-[var(--n-warning-glow)]', permission: 'settings.manage' },
];

export function AccountingDashboard() {
  const { hasPermission, hasRole } = useAuthStore();
  const isSuperAdmin = hasRole('Super Admin');

  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: "1.5rem" }}>Accounting</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link) => {
          const allowed = isSuperAdmin || hasPermission(link.permission);
          return allowed ? (
            <Link key={link.to} to={link.to}>
              <Card className="p-6 hover:border-amber cursor-pointer transition-all">
                <div className={`p-3 rounded-xl w-fit mb-4 ${link.color}`}>{link.icon}</div>
                <h3 className="neu-section-title">{link.label}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--n-text-secondary)' }}>{link.desc}</p>
              </Card>
            </Link>
          ) : (
            <div key={link.to} title="You don't have permission to access this">
              <Card className="p-6 opacity-40 cursor-not-allowed transition-all select-none">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl w-fit ${link.color}`}>{link.icon}</div>
                  <HiLockClosed className="w-4 h-4 mt-1" style={{ color: 'var(--n-text-dim)' }} />
                </div>
                <h3 className="neu-section-title">{link.label}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--n-text-secondary)' }}>{link.desc}</p>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
