import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import type { Client } from '../../../types';
import dayjs from 'dayjs';

export function ClientStatementsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/clients', { params: { per_page: 100 } }).then((res) => setClients(res.data.data)); }, []);

  const fetch = () => {
    if (!clientId) return;
    setLoading(true);
    api.get('/accounting/reports/client-statement', { params: { client_id: clientId, start_date: startDate, end_date: endDate } })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-dark mb-6">Client Statements</h1>
      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-end flex-wrap">
          <Select label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)} options={clients.map((c) => ({ value: c.id, label: c.business_name }))} placeholder="Select client" className="w-64" />
          <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Button variant="amber" onClick={fetch} loading={loading}>Generate</Button>
        </div>
      </Card>
      {loading && <Spinner />}
      {data && (
        <Card className="p-6">
          <h2 className="text-xl font-bold text-navy-dark mb-1">{data.client.business_name}</h2>
          <p className="text-sm text-gray-500 mb-4">Statement: {dayjs(data.period.start).format('MMM D')} - {dayjs(data.period.end).format('MMM D, YYYY')} | Tier: {data.client.tier}</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg"><p className="text-xs text-gray-500">Total Charges</p><p className="text-lg font-bold">{data.total_charges.toFixed(2)}</p></div>
            <div className="text-center p-3 bg-green-50 rounded-lg"><p className="text-xs text-gray-500">Total Payments</p><p className="text-lg font-bold text-green-700">{data.total_payments.toFixed(2)}</p></div>
            <div className="text-center p-3 bg-red-50 rounded-lg"><p className="text-xs text-gray-500">Balance</p><p className="text-lg font-bold text-red-700">{data.balance.toFixed(2)}</p></div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Transaction</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Amount</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Paid</th>
            </tr></thead>
            <tbody className="divide-y">{data.transactions?.map((t: any) => (
              <tr key={t.id}><td className="px-4 py-2">{t.date}</td><td className="px-4 py-2 font-mono text-xs">{t.transaction_number}</td><td className="px-4 py-2 text-right">{t.total_amount.toFixed(2)}</td><td className="px-4 py-2 text-right text-green-600">{t.total_paid.toFixed(2)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
