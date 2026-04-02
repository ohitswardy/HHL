import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import dayjs from 'dayjs';

export function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(dayjs().format('YYYY-MM-DD'));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetch = () => {
    setLoading(true);
    api.get('/accounting/reports/balance-sheet', { params: { as_of_date: asOf } })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  const renderAccounts = (accounts: any[]) => accounts?.map((a: any) => (
    <div key={a.code} className="flex justify-between text-sm py-1"><span className="text-gray-600 pl-4">{a.code} {a.name}</span><span>{a.balance.toFixed(2)}</span></div>
  ));

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-dark mb-6">Balance Sheet</h1>
      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-end">
          <Input label="As of Date" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          <Button variant="amber" onClick={fetch} loading={loading}>Generate</Button>
        </div>
      </Card>
      {loading && <Spinner />}
      {data && (
        <Card className="p-6">
          <h2 className="text-xl font-bold text-center text-navy-dark mb-1">HardhatLedger</h2>
          <p className="text-center text-sm text-gray-500 mb-6">Balance Sheet as of {dayjs(data.as_of_date).format('MMMM D, YYYY')}</p>
          <div className="max-w-md mx-auto space-y-4">
            <div><h3 className="font-semibold text-blue-700 border-b pb-1">Assets</h3>{renderAccounts(data.assets.accounts)}<div className="flex justify-between font-bold pt-1 border-t"><span>Total Assets</span><span>{data.assets.total.toFixed(2)}</span></div></div>
            <div><h3 className="font-semibold text-red-700 border-b pb-1">Liabilities</h3>{renderAccounts(data.liabilities.accounts)}<div className="flex justify-between font-bold pt-1 border-t"><span>Total Liabilities</span><span>{data.liabilities.total.toFixed(2)}</span></div></div>
            <div><h3 className="font-semibold text-purple-700 border-b pb-1">Equity</h3>{renderAccounts(data.equity.accounts)}<div className="flex justify-between font-bold pt-1 border-t"><span>Total Equity</span><span>{data.equity.total.toFixed(2)}</span></div></div>
            <div className="flex justify-between font-bold text-lg border-t-2 border-navy pt-3"><span>Total L + E</span><span>{data.total_liabilities_equity.toFixed(2)}</span></div>
          </div>
        </Card>
      )}
    </div>
  );
}
