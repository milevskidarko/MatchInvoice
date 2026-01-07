"use client";
import "../globals.css";

import { useState } from "react";
import { useTranslations } from "../../lib/useTranslations";
import { FileUpload } from "../../components/FileUpload";

export default function OrderForm() {
    const t = useTranslations();

    const [order, setOrder] = useState({
        orderNumber: "",
        orderDate: "",
        supplier: "",
        currency: "MKD",
    });

    type Item = { name: string; qty: number; unitPrice: number; vat: number };
    const [items, setItems] = useState<Item[]>([{ name: "", qty: 1, unitPrice: 0, vat: 18 }]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [files, setFiles] = useState<{ name: string; type: string; path: string }[]>([]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setOrder({ ...order, [e.target.name]: e.target.value });
    };

    const handleItemChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        const key = name as keyof Item;
        const newItems = [...items];
        newItems[idx] = {
            ...newItems[idx],
            [key]: type === "number" ? Number(value) : value,
        };
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { name: "", qty: 1, unitPrice: 0, vat: 18 }]);
    const removeItem = (idx: number) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccess(null);
        setError(null);

        try {
            const res = await fetch("/api/order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order, items, files }),
            });

            const data = await res.json();
            if (data.success) {
                setSuccess(t("success"));
                setOrder({ orderNumber: "", orderDate: "", supplier: "", currency: "MKD" });
                setItems([{ name: "", qty: 1, unitPrice: 0, vat: 18 }]);
                setFiles([]);
            } else {
                setError(data.error || t("error"));
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message || t("error"));
        } finally {
            setLoading(false);
        }
    };

    // Handler for OCR data
    const handleOCRData = (data: any) => {
        if (data) {
            // Fill order fields if present
            setOrder((prev) => ({
                ...prev,
                orderNumber: data.invoiceNumber || prev.orderNumber,
                orderDate: data.invoiceDate || prev.orderDate,
                supplier: data.supplier || prev.supplier,
                currency: data.currency || prev.currency,
            }));
            // Fill items if present
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                setItems(
                    data.items.map((item: any) => ({
                        name: item.name || "",
                        qty: item.qty || 1,
                        unitPrice: item.unitPrice || 0,
                        vat: item.vat || 18,
                    }))
                );
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>

            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 w-full max-w-xl bg-white p-8 rounded shadow"
            >
                <div>
                    <label className="mb-1 font-medium block">{t("addFile") || "Attach PDF/Image"}</label>
                    <FileUpload onUpload={file => setFiles(f => [...f, file])} onOCRData={handleOCRData} />
                    <div className="flex flex-col gap-1 mt-2">
                        {files.map((f, i) => (
                            <span key={i} className="text-sm text-zinc-700">{f.name}</span>
                        ))}
                    </div>
                </div>
                {success && <div className="p-2 mb-2 bg-green-100 text-green-800 rounded">{success}</div>}
                {error && <div className="p-2 mb-2 bg-red-100 text-red-800 rounded">{error}</div>}

                <label className="flex flex-col">
                    <span className="mb-1 font-medium">{t("orderNumber")}</span>
                    <input
                        type="text"
                        name="orderNumber"
                        value={order.orderNumber}
                        onChange={handleChange}
                        className="border rounded px-3 py-2"
                        required
                    />
                </label>

                <label className="flex flex-col">
                    <span className="mb-1 font-medium">{t("orderDate")}</span>
                    <input
                        type="date"
                        name="orderDate"
                        value={order.orderDate}
                        onChange={handleChange}
                        className="border rounded px-3 py-2"
                        required
                    />
                </label>

                <label className="flex flex-col">
                    <span className="mb-1 font-medium">{t("supplier")}</span>
                    <input
                        type="text"
                        name="supplier"
                        value={order.supplier}
                        onChange={handleChange}
                        className="border rounded px-3 py-2"
                        required
                    />
                </label>

                <label className="flex flex-col">
                    <span className="mb-1 font-medium">{t("currency")}</span>
                    <select
                        name="currency"
                        value={order.currency}
                        onChange={handleChange}
                        className="border rounded px-3 py-2"
                    >
                        <option value="MKD">MKD</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                    </select>
                </label>

                {/* Order Items Table */}
                <div className="mt-6">
                    <h2 className="text-xl font-semibold mb-2">{t("items")}</h2>
                    <table className="w-full border mb-2">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2 border">{t("name")}</th>
                                <th className="p-2 border">{t("qty")}</th>
                                <th className="p-2 border">{t("unitPrice")}</th>
                                <th className="p-2 border">{t("vat")}</th>
                                <th className="p-2 border">{t("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="p-2 border">
                                        <input
                                            type="text"
                                            name="name"
                                            value={item.name}
                                            onChange={(e) => handleItemChange(idx, e)}
                                            className="border rounded px-2 py-1 w-full"
                                            required
                                        />
                                    </td>
                                    <td className="p-2 border">
                                        <input
                                            type="number"
                                            name="qty"
                                            value={item.qty}
                                            min={1}
                                            onChange={(e) => handleItemChange(idx, e)}
                                            className="border rounded px-2 py-1 w-20"
                                            required
                                        />
                                    </td>
                                    <td className="p-2 border">
                                        <input
                                            type="number"
                                            name="unitPrice"
                                            value={item.unitPrice}
                                            min={0}
                                            step={0.01}
                                            onChange={(e) => handleItemChange(idx, e)}
                                            className="border rounded px-2 py-1 w-24"
                                            required
                                        />
                                    </td>
                                    <td className="p-2 border">
                                        <input
                                            type="number"
                                            name="vat"
                                            value={item.vat}
                                            min={0}
                                            max={100}
                                            step={0.01}
                                            onChange={(e) => handleItemChange(idx, e)}
                                            className="border rounded px-2 py-1 w-20"
                                            required
                                        />
                                    </td>
                                    <td className="p-2 border text-center">
                                        <button
                                            type="button"
                                            onClick={() => removeItem(idx)}
                                            className="text-red-600 hover:underline disabled:opacity-50"
                                            disabled={items.length === 1}
                                        >
                                            {t("remove")}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button
                        type="button"
                        onClick={addItem}
                        className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700 transition"
                    >
                        {t("addItem")}
                    </button>
                </div>

                <button
                    type="submit"
                    className="mt-6 bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                    disabled={loading}
                >
                    {loading ? t("saving") : t("save")}
                </button>
            </form>
        </div>
    );
}
