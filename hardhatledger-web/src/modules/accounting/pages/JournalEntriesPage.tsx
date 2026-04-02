import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import type { JournalEntry } from '../../../types';
import dayjs from 'dayjs';

export function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/accounting/journal-entries', { params: { per_page: 50 } })
      .then((res) => setEntries(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-dark mb-6">Journal Entries</h1>
      <div className="space-y-4">
        {entries.map((entry) => (
          <Card key={entry.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-navy-dark">{entry.description}</p>
                <p className="text-xs text-gray-500">{dayjs(entry.date).format('MMM D, YYYY')} | {entry.reference_type} #{entry.reference_id}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-xs">
                <th className="text-left py-1">Account</th><th className="text-right py-1">Debit</th><th className="text-right py-1">Credit</th>
              </tr></thead>
              <tbody>{entry.lines?.map((line) => (
                <tr key={line.id} className="border-t border-gray-50">
                  <td className="py-1.5">{line.account?.code} - {line.account?.name}</td>
                  <td className="py-1.5 text-right font-mono">{line.debit > 0 ? line.debit.toFixed(2) : ''}</td>
                  <td className="py-1.5 text-right font-mono">{line.credit > 0 ? line.credit.toFixed(2) : ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        ))}
        {entries.length === 0 && <p className="text-center text-gray-400 py-8">No journal entries yet</p>}
      </div>
    </div>
  );
}
