
"use client";
import { useState } from "react";
import { useTranslations } from "../../lib/useTranslations";
import { FileUpload } from "../../components/FileUpload";
import { ExtractedInvoiceData } from "../../lib/ocr.new";
import "../globals.css";

function cleanNumber(value: string | number) {
  if (typeof value === 'string') {
    return Number(value.replace(',', '.').replace(/[^0-9.]/g, ''));
  }
  return value;
}
export default function InvoiceForm() {
  const t = useTranslations();
  const [invoice, setInvoice] = useState({
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    supplier: "",
    currency: "MKD",
  });
  type Item = { name: string; qty: number; unitPrice: number; vat: number };
  const [items, setItems] = useState<Item[]>([{ name: "", qty: 1, unitPrice: 0, vat: 18 }]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<{ name: string; type: string; path: string }[]>([]);
  const [ocrExtracted, setOcrExtracted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setInvoice({ ...invoice, [e.target.name]: e.target.value });
  };
  const handleItemChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const newItems = [...items];
    const key = e.target.name as keyof Item;
    if (key === "qty" || key === "unitPrice" || key === "vat") {
      newItems[idx][key] = Number(e.target.value) as Item[typeof key];
    } else if (key === "name") {
      newItems[idx][key] = e.target.value as Item[typeof key];
    }
    setItems(newItems);
  };
  const addItem = () => setItems([...items, { name: "", qty: 1, unitPrice: 0, vat: 18 }]);
  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleOCRData = (data: ExtractedInvoiceData) => {
    setOcrExtracted(true);
    console.log('[OCR] Raw Extracted Data:', data);
    console.log('[OCR] Invoice Number:', data.invoiceNumber);
    console.log('[OCR] Invoice Date:', data.invoiceDate);
    console.log('[OCR] Due Date:', data.dueDate);
    console.log('[OCR] Supplier:', data.supplier);
    console.log('[OCR] Currency:', data.currency);
    console.log('[OCR] Items count:', data.items?.length || 0);
    
    // Fill invoice fields
    if (data.invoiceNumber) {
      console.log('[OCR] Setting invoiceNumber:', data.invoiceNumber);
      setInvoice(prev => ({ ...prev, invoiceNumber: data.invoiceNumber! }));
    }
    if (data.invoiceDate) {
      console.log('[OCR] Setting invoiceDate:', data.invoiceDate);
      setInvoice(prev => ({ ...prev, invoiceDate: data.invoiceDate! }));
    }
    if (data.dueDate) {
      console.log('[OCR] Setting dueDate:', data.dueDate);
      setInvoice(prev => ({ ...prev, dueDate: data.dueDate! }));
    }
    if (data.supplier) {
      console.log('[OCR] Setting supplier:', data.supplier);
      setInvoice(prev => ({ ...prev, supplier: data.supplier! }));
    }
    if (data.currency) {
      console.log('[OCR] Setting currency:', data.currency);
      setInvoice(prev => ({ ...prev, currency: data.currency! }));
    }
    // Fill items (clean numbers)
    if (data.items && data.items.length > 0) {
      const cleanedItems = data.items.map(item => ({
        ...item,
        qty: cleanNumber(item.qty),
        unitPrice: cleanNumber(item.unitPrice),
        vat: cleanNumber(item.vat),
      }));
      console.log('[OCR] Cleaned items:', cleanedItems);
      setItems(cleanedItems);
      setTimeout(() => {
        console.log('[OCR] Items set in state');
      }, 100);
    } else {
      console.log('[OCR] No items to set');
    }
    // Show success message
    setTimeout(() => {
      setOcrExtracted(false);
    }, 3000);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);
    try {
      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice, items, files }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(t("invoiceSuccess"));
        setInvoice({ invoiceNumber: "", invoiceDate: "", dueDate: "", supplier: "", currency: "MKD" });
        setItems([{ name: "", qty: 1, unitPrice: 0, vat: 18 }]);
        setFiles([]);
      } else {
        setError(data.error || t("invoiceError"));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || t("invoiceError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold mb-6">{t("invoiceTitle")}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xl bg-white p-8 rounded shadow">
        <div>
          <label className="mb-1 font-medium block">{t("addFile") || "Attach PDF/Image"}</label>
          <p className="text-xs text-zinc-500 mb-2">
            {t("ocrHint")}
          </p>
          <FileUpload
            onUpload={file => setFiles(f => [...f, file])}
            onOCRData={handleOCRData}
          />
          <div className="flex flex-col gap-1 mt-2">
            {files.map((f, i) => (
              <span key={i} className="text-sm text-zinc-700">{f.name}</span>
            ))}
          </div>
        </div>
        {ocrExtracted && (
          <div className="p-2 mb-2 bg-blue-100 text-blue-800 rounded">
            {t("ocrSuccess")}
          </div>
        )}
        {success && <div className="p-2 mb-2 bg-green-100 text-green-800 rounded">{success}</div>}
        {error && <div className="p-2 mb-2 bg-red-100 text-red-800 rounded">{error}</div>}
        <label className="flex flex-col">
          <span className="mb-1 font-medium">{t("invoiceNumber")}</span>
          <input type="text" name="invoiceNumber" value={invoice.invoiceNumber} onChange={handleChange} className="border rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 font-medium">{t("invoiceDate")}</span>
          <input type="date" name="invoiceDate" value={invoice.invoiceDate} onChange={handleChange} className="border rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 font-medium">{t("dueDate")}</span>
          <input type="date" name="dueDate" value={invoice.dueDate} onChange={handleChange} className="border rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 font-medium">{t("supplier")}</span>
          <input type="text" name="supplier" value={invoice.supplier} onChange={handleChange} className="border rounded px-3 py-2" required />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 font-medium">{t("currency")}</span>
          <select name="currency" value={invoice.currency} onChange={handleChange} className="border rounded px-3 py-2">
            <option value="MKD">MKD</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </label>
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">{t("items")}</h2>
          <table className="w-full border mb-2">
            <thead>
              <tr className="bg-zinc-100">
                <th className="p-2 border">{t("name")}</th>
                <th className="p-2 border">{t("qty")}</th>
                <th className="p-2 border">{t("unitPrice")}</th>
                <th className="p-2 border">{t("vat")}</th>
                <th className="p-2 border">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                console.log('[RENDER] Item', idx, item);
                return (
                  <tr key={idx}>
                    <td className="p-2 border">
                      <input type="text" name="name" value={item.name} onChange={e => handleItemChange(idx, e)} className="border rounded px-2 py-1 w-full" required />
                    </td>
                    <td className="p-2 border">
                      <input type="number" name="qty" value={item.qty} min={1} onChange={e => handleItemChange(idx, e)} className="border rounded px-2 py-1 w-20" required />
                    </td>
                    <td className="p-2 border">
                      <input type="number" name="unitPrice" value={item.unitPrice} min={0} step={0.01} onChange={e => handleItemChange(idx, e)} className="border rounded px-2 py-1 w-24" required />
                    </td>
                    <td className="p-2 border">
                      <input type="number" name="vat" value={item.vat} min={0} max={100} step={0.01} onChange={e => handleItemChange(idx, e)} className="border rounded px-2 py-1 w-20" required />
                    </td>
                    <td className="p-2 border text-center">
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-600 hover:underline disabled:opacity-50" disabled={items.length === 1}>{t("remove")}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" onClick={addItem} className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700 transition">{t("addItem")}</button>
        </div>
        <button type="submit" className="mt-6 bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition disabled:opacity-50" disabled={loading}>{loading ? t("saving") : t("save")}</button>
      </form>
    </div>
  );
}
