import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import dayjs from 'dayjs';

export function CashFlowPage() {
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetch = () => {
    setLoading(true);
    api.get('/accounting/reports/cash-flow', { params: { start_date: startDate, end_date: endDate } })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: "1.5rem" }}>Cash Flow Statement</h1>
      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-end">
          <DatePicker label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <DatePicker label="To" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Button variant="amber" onClick={fetch} loading={loading}>Generate</Button>
        </div>
      </Card>
      {loading && <Spinner />}
      {data && (
        <Card className="p-6">
          <h2 className="text-xl font-bold text-center text-[var(--n-text)] mb-6">Cash Flow Statement</h2>
          <div className="max-w-sm mx-auto space-y-4">
            <div className="flex justify-between text-lg"><span className="text-green-700 font-semibold">Inflows</span><span className="text-green-700 font-bold">{data.inflows.toFixed(2)}</span></div>
            <div className="flex justify-between text-lg"><span className="text-red-700 font-semibold">Outflows</span><span className="text-red-700 font-bold">({data.outflows.toFixed(2)})</span></div>
            <div className={`flex justify-between text-xl font-bold border-t-2 border-navy pt-3 ${data.net_cash_flow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              <span>Net Cash Flow</span><span>{data.net_cash_flow.toFixed(2)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
