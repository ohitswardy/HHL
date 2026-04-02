import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { HiDocumentReport, HiCash, HiChartBar, HiDocumentText, HiUserGroup } from 'react-icons/hi';

const links = [
  { to: '/accounting/journal', label: 'Journal Entries', desc: 'View all double-entry journal records', icon: <HiDocumentReport className="w-8 h-8" />, color: 'text-blue-600 bg-blue-50' },
  { to: '/accounting/reports/income', label: 'Income Statement', desc: 'Revenue, COGS, and expenses', icon: <HiCash className="w-8 h-8" />, color: 'text-green-600 bg-green-50' },
  { to: '/accounting/reports/balance-sheet', label: 'Balance Sheet', desc: 'Assets, liabilities, and equity', icon: <HiChartBar className="w-8 h-8" />, color: 'text-purple-600 bg-purple-50' },
  { to: '/accounting/reports/cash-flow', label: 'Cash Flow', desc: 'Inflows and outflows of cash', icon: <HiDocumentText className="w-8 h-8" />, color: 'text-amber bg-amber/10' },
  { to: '/accounting/client-statements', label: 'Client Statements', desc: 'Account statements per client', icon: <HiUserGroup className="w-8 h-8" />, color: 'text-navy bg-navy/5' },
];

export function AccountingDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-dark mb-6">Accounting</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="p-6 hover:border-amber cursor-pointer transition-all">
              <div className={`p-3 rounded-xl w-fit mb-4 ${link.color}`}>{link.icon}</div>
              <h3 className="text-lg font-semibold text-navy-dark">{link.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{link.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
