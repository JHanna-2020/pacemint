import { ChangeEvent, useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { downloadBudgetWorkbook } from '../lib/excelExport';

type Props = {
  onExport: () => Promise<Record<string, unknown> | null>;
  onImport: (payload: Record<string, unknown>) => Promise<void>;
  onMessage: (message: string) => void;
};

export function DataPortability({ onExport, onImport, onMessage }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function exportData() {
    const payload = await onExport();
    if (!payload) return;
    await downloadBudgetWorkbook(payload);
    onMessage('Excel export downloaded.');
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const payload = JSON.parse(await file.text()) as Record<string, unknown>;
    await onImport(payload);
    event.target.value = '';
    onMessage('Import complete.');
  }

  return (
    <div className="data-actions">
      <button className="secondary-button" type="button" onClick={exportData}>
        <Download size={17} />
        Export Excel
      </button>
      <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
        <Upload size={17} />
        Import JSON
      </button>
      <input ref={inputRef} type="file" accept="application/json" hidden onChange={importData} />
    </div>
  );
}
