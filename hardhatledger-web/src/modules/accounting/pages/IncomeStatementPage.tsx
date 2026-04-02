import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import dayjs from 'dayjs';

export function IncomeStatementPage() {
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetch = () => {
    setLoading(true);
    api.get('/accounting/reports/income-statement', { params: { start_date: startDate, end_date: endDate } })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-dark mb-6">Income Statement</h1>
      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-end">
          <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Button variant="amber" onClick={fetch} loading={loading}>Generate</Button>
        </div>
      </Card>
      {loading && <Spinner />}
      {data && (
        <Card className="p-6">
          <h2 className="text-xl font-bold text-center text-navy-dark mb-1">HardhatLedger</h2>
          <p className="text-center text-sm text-gray-500 mb-6">Income Statement: {dayjs(data.period.start).format('MMM D, YYYY')} - {dayjs(data.period.end).format('MMM D, YYYY')}</p>
          <div className="max-w-md mx-auto space-y-4">
            <div><h3 className="font-semibold text-green-700 border-b pb-1">Revenue</h3>
              {data.revenue_accounts?.map((a: any) => <div key={a.code} className="flex justify-between text-sm py-1"><span className="text-gray-600">{a.code} {a.name}</span><span>{a.amount.toFixed(2)}</span></div>)}
              <div className="flex justify-between font-semibold text-green-700 pt-1"><span>Total Revenue</span><span>{data.revenue.toFixed(2)}</span></div>
            </div>
            <div><div className="flex justify-between text-sm py-1 text-red-600"><span>Cost of Goods Sold</span><span>({data.cost_of_goods_sold.toFixed(2)})</span></div></div>
            <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Gross Profit</span><span>{data.gross_profit.toFixed(2)}</span></div>
            <div><h3 className="font-semibold text-red-700 border-b pb-1">Expenses</h3>
              {data.expense_accounts?.map((a: any) => <div key={a.code} className="flex justify-between text-sm py-1"><span className="text-gray-600">{a.code} {a.name}</span><span>{a.amount.toFixed(2)}</span></div>)}
              <div className="flex justify-between font-semibold text-red-700 pt-1"><span>Total Expenses</span><span>{data.expenses.toFixed(2)}</span></div>
            </div>
            <div className={`flex justify-between font-bold text-xl border-t-2 border-navy pt-3 ${data.net_income >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              <span>Net Income</span><span>{data.net_income.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
