import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { HiCog, HiInformationCircle, HiCheckCircle } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';

interface SettingItem {
  value: string;
  label: string;
  description: string;
}

interface SettingsMap {
  tax_rate?: SettingItem;
}

export function TaxSettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [taxInput, setTaxInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then((r) => {
        const data: SettingsMap = r.data.data;
        setSettings(data);
        setTaxInput(data.tax_rate?.value ?? '12');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const val = parseFloat(taxInput);
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error('Tax rate must be a number between 0 and 100.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/settings/tax_rate', { value: taxInput });
      toast.success('Tax rate updated successfully.');
      setSettings((prev) => ({
        ...prev,
        tax_rate: { ...prev.tax_rate!, value: taxInput },
      }));
    } catch {
      toast.error('Failed to update tax rate.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner size="lg" />
      </div>
    );
  }

  const currentRate = settings.tax_rate?.value ?? '12';

  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: '1.5rem' }}>Tax Settings</h1>

      <div className="max-w-lg space-y-4">
        {/* Current rate info card */}
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-[var(--n-success-glow)] text-[var(--n-success)]">
            <HiCheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide">Current System Tax Rate</p>
            <p className="text-2xl font-bold text-[var(--n-text)]">{currentRate}%</p>
          </div>
        </Card>

        {/* Edit card */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <HiCog className="w-5 h-5 text-[var(--n-text-secondary)]" />
            <h3 className="neu-section-title">{settings.tax_rate?.label ?? 'VAT / Sales Tax Rate'}</h3>
          </div>

          <p className="text-sm text-[var(--n-text-secondary)]">
            {settings.tax_rate?.description ?? 'Applied to VATable sales and purchases.'}
          </p>

          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">
              Tax Rate (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxInput}
                onChange={(e) => setTaxInput(e.target.value)}
                className="neu-inline-input w-32 text-lg font-semibold"
              />
              <span className="text-lg font-semibold text-[var(--n-text-secondary)]">%</span>
            </div>
          </div>

          {/* Info notice */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--n-info-glow)] border border-[var(--n-info)]/20">
            <HiInformationCircle className="w-5 h-5 text-[var(--n-info)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--n-info)]">
              This rate applies to all VATable journal entries — both sales (wholesale/contractor clients)
              and purchases from VAT-registered suppliers. It also auto-fills the tax amount when adding
              a VATable expense.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="amber" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Save Tax Rate'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
