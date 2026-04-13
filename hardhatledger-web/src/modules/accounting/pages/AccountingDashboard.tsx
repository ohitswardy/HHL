import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { HiDocumentReport, HiCash, HiChartBar, HiDocumentText, HiUserGroup, HiCurrencyDollar, HiClipboardList, HiLibrary } from 'react-icons/hi';

const links = [
  { to: '/accounting/journal', label: 'Journal Entries', desc: 'View all double-entry journal records', icon: <HiDocumentReport className="w-8 h-8" />, color: 'text-[var(--n-info)] bg-[var(--n-info-glow)]' },
  { to: '/accounting/expenses', label: 'Expenses', desc: 'Track and manage all business expenses', icon: <HiCurrencyDollar className="w-8 h-8" />, color: 'text-[var(--n-danger)] bg-[var(--n-danger-glow)]' },
  { to: '/accounting/bank-transactions', label: 'Summary of Business Bank Transactions', desc: 'Track all money in and out of the business bank', icon: <HiLibrary className="w-8 h-8" />, color: 'text-[var(--n-info)] bg-[var(--n-info-glow)]' },
  { to: '/accounting/reports/income', label: 'Income Statement', desc: 'Revenue, COGS, and expenses', icon: <HiCash className="w-8 h-8" />, color: 'text-[var(--n-success)] bg-[var(--n-success-glow)]' },
  { to: '/accounting/reports/balance-sheet', label: 'Balance Sheet', desc: 'Assets, liabilities, and equity', icon: <HiChartBar className="w-8 h-8" />, color: 'text-[var(--n-accent)] bg-[var(--n-accent-glow)]' },
  { to: '/accounting/reports/cash-flow', label: 'Cash Flow', desc: 'Inflows and outflows of cash', icon: <HiDocumentText className="w-8 h-8" />, color: 'text-[var(--n-warning)] bg-[var(--n-warning-glow)]' },
  { to: '/accounting/reports/client-statements', label: 'Client Statements', desc: 'Account statements per client', icon: <HiUserGroup className="w-8 h-8" />, color: 'text-[var(--n-text-secondary)] bg-[var(--n-inset)]' },
  { to: '/accounting/chart-of-accounts', label: 'Chart of Accounts', desc: 'Manage and organize all accounts', icon: <HiClipboardList className="w-8 h-8" />, color: 'text-[var(--n-info)] bg-[var(--n-info-glow)]' },
];

export function AccountingDashboard() {
  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: "1.5rem" }}>Accounting</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="p-6 hover:border-amber cursor-pointer transition-all">
              <div className={`p-3 rounded-xl w-fit mb-4 ${link.color}`}>{link.icon}</div>
              <h3 className="neu-section-title">{link.label}</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--n-text-secondary)' }}>{link.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
