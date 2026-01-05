import "../globals.css";
"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "../../lib/useTranslations";
import { useLanguage } from "../../contexts/LanguageContext";

type Document = {
  id: string;
  type: string;
  createdAt: string;
  items: Array<{ name: string; qty: number; unitPrice: number; vatPercent: number }>;
  files: Array<{ id: string; fileName: string; storagePath: string }>;
};

type ValidationResult = {
  id: string;
  category: string;
  message: string;
  severity: string;
};

type ValidationSummary = {
  itemsStatus: string;
  vatStatus: string;
  datesStatus: string;
  totalsStatus: string;
  finalStatus: string;
};

type Pair = {
  id: string;
  order: Document;
  invoice: Document;
  validations: ValidationResult[];
  summary: ValidationSummary | null;
};

export default function Validate() {
  const { lang } = useLanguage();
  const t = useTranslations();
  const [orders, setOrders] = useState<Document[]>([]);
  const [invoices, setInvoices] = useState<Document[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationPair, setValidationPair] = useState<Pair | null>(null);
  const [totals, setTotals] = useState<{ order: any; invoice: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const [ordersRes, invoicesRes] = await Promise.all([
        fetch("/api/documents?type=ORDER"),
        fetch("/api/documents?type=INVOICE"),
      ]);
      const ordersData = await ordersRes.json();
      const invoicesData = await invoicesRes.json();
      setOrders(ordersData.documents || []);
      setInvoices(invoicesData.documents || []);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  const handleValidate = async () => {
    if (!selectedOrderId || !selectedInvoiceId) {
      setError(t("selectBoth"));
      return;
    }

    setValidating(true);
    setError(null);
    setValidationPair(null);
    setTotals(null);

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrderId,
          invoiceId: selectedInvoiceId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setValidationPair(data.pair);
        setTotals(data.totals);
      } else {
        setError(data.error || t("error"));
      }
    } catch (err: any) {
      setError(err.message || t("error"));
    } finally {
      setValidating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "valid") return "✅";
    if (status === "warning") return "⚠️";
    if (status === "error") return "❌";
    return "❓";
  };

  const getStatusColor = (status: string) => {
    if (status === "valid") return "text-green-600";
    if (status === "warning") return "text-yellow-600";
    if (status === "error") return "text-red-600";
    return "text-zinc-600";
  };

  const getSeverityColor = (severity: string) => {
    if (severity === "error") return "bg-red-50 border-red-200";
    if (severity === "warning") return "bg-yellow-50 border-yellow-200";
    return "bg-blue-50 border-blue-200";
  };

  const getFileUrl = (path: string) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!supabaseUrl) return "#";
    return `${supabaseUrl}/storage/v1/object/public/documents/${path}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-zinc-50">
      <h1 className="text-4xl font-bold mb-6">{t("validateTitle")}</h1>

      <div className="w-full max-w-4xl bg-white p-8 rounded shadow-lg">
        {/* Selection */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block mb-2 font-semibold">{t("selectOrder")}</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={validating}
            >
              <option value="">{t("noOrderSelected")}</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  Order #{order.id.slice(0, 8)} - {new Date(order.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2 font-semibold">{t("selectInvoice")}</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={validating}
            >
              <option value="">{t("noInvoiceSelected")}</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  Invoice #{invoice.id.slice(0, 8)} - {new Date(invoice.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleValidate}
          disabled={!selectedOrderId || !selectedInvoiceId || validating}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          {validating ? t("validating") : t("validate")}
        </button>

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded">{error}</div>
        )}

        {/* Validation Results */}
        {validationPair && validationPair.summary && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="border rounded p-4 bg-zinc-50">
              <h2 className="text-2xl font-bold mb-4">{t("validationResults")}</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className={`text-2xl mb-1 ${getStatusColor(validationPair.summary.itemsStatus)}`}>
                    {getStatusIcon(validationPair.summary.itemsStatus)}
                  </div>
                  <div className="text-sm font-medium">{t("items")}</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl mb-1 ${getStatusColor(validationPair.summary.vatStatus)}`}>
                    {getStatusIcon(validationPair.summary.vatStatus)}
                  </div>
                  <div className="text-sm font-medium">VAT</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl mb-1 ${getStatusColor(validationPair.summary.datesStatus)}`}>
                    {getStatusIcon(validationPair.summary.datesStatus)}
                  </div>
                  <div className="text-sm font-medium">{t("dates")}</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl mb-1 ${getStatusColor(validationPair.summary.totalsStatus)}`}>
                    {getStatusIcon(validationPair.summary.totalsStatus)}
                  </div>
                  <div className="text-sm font-medium">{t("totals")}</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl mb-1 ${getStatusColor(validationPair.summary.finalStatus)}`}>
                    {getStatusIcon(validationPair.summary.finalStatus)}
                  </div>
                  <div className="text-sm font-medium">{t("finalStatus") || "Final"}</div>
                </div>
              </div>
            </div>

            {/* Totals Comparison */}
            {totals && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-2">{t("orderTotals")}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>{t("subtotal")}:</span>
                      <span>{totals.order.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("vatTotal")}:</span>
                      <span>{totals.order.vatTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>{t("grandTotal")}:</span>
                      <span>{totals.order.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-2">{t("invoiceTotals")}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>{t("subtotal")}:</span>
                      <span>{totals.invoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("vatTotal")}:</span>
                      <span>{totals.invoice.vatTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>{t("grandTotal")}:</span>
                      <span>{totals.invoice.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Errors */}
            {validationPair.validations.length > 0 ? (
              <div>
                <h3 className="text-xl font-semibold mb-3">{t("validationResults")}</h3>
                <div className="space-y-2">
                  {validationPair.validations.map((result) => (
                    <div
                      key={result.id}
                      className={`p-3 rounded border ${getSeverityColor(result.severity)}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg">
                          {result.severity === "error" ? "❌" : "⚠️"}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-zinc-600 mb-1">
                            {result.category.toUpperCase()}
                          </div>
                          <div className="text-sm">{result.message}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded text-center">
                <div className="text-2xl mb-2">✅</div>
                <div className="font-semibold text-green-800">
                  {t("allValidationsPassed")}
                </div>
              </div>
            )}

            {/* Files */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Order Files</h3>
                {validationPair.order.files.length > 0 ? (
                  <div className="space-y-1">
                    {validationPair.order.files.map((file) => (
                      <a
                        key={file.id}
                        href={getFileUrl(file.storagePath)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-blue-600 underline text-sm"
                      >
                        {file.fileName}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No files</p>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2">Invoice Files</h3>
                {validationPair.invoice.files.length > 0 ? (
                  <div className="space-y-1">
                    {validationPair.invoice.files.map((file) => (
                      <a
                        key={file.id}
                        href={getFileUrl(file.storagePath)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-blue-600 underline text-sm"
                      >
                        {file.fileName}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No files</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!validationPair && !validating && (
          <div className="text-center text-zinc-500 py-8">
            {t("noResults")}
          </div>
        )}
      </div>
    </div>
  );
}
