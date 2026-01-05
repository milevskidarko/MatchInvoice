import Link from "next/link";

import { prisma } from "@/lib/prisma";

async function getDocuments() {
  const orders = await prisma.document.findMany({
    where: { type: "ORDER" },
    include: { files: true },
    orderBy: { createdAt: "desc" },
  });
  const invoices = await prisma.document.findMany({
    where: { type: "INVOICE" },
    include: { files: true },
    orderBy: { createdAt: "desc" },
  });
  return { orders, invoices };
}

export default async function Documents() {
  const { orders, invoices } = await getDocuments();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-4">Documents</h1>
      <div className="flex gap-4 mb-8">
        <Link href="/order" className="bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-700 transition">Add Order</Link>
        <Link href="/invoice" className="bg-green-600 text-white px-6 py-2 rounded font-semibold hover:bg-green-700 transition">Add Invoice</Link>
      </div>
      <div className="w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-2">Orders</h2>
        {orders.length === 0 ? (
          <div className="mb-6 p-4 bg-zinc-100 rounded text-zinc-500 text-center">
            <p className="mb-2">No orders yet.</p>
            <Link href="/order" className="text-blue-600 underline">Create your first order →</Link>
          </div>
        ) : (
          <ul className="mb-6">
            {orders.map(order => (
              <li key={order.id} className="mb-2 p-3 bg-zinc-50 rounded border flex flex-col gap-1">
                <span className="font-semibold">Order #{order.id}</span>
                <span>Date: {order.createdAt?.toLocaleString?.() || order.createdAt}</span>
                {order.files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {order.files.map(f => (
                      <a key={f.id} href={`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/documents/${f.storagePath}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">{f.fileName}</a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <h2 className="text-2xl font-semibold mb-2">Invoices</h2>
        {invoices.length === 0 ? (
          <div className="p-4 bg-zinc-100 rounded text-zinc-500 text-center">
            <p className="mb-2">No invoices yet.</p>
            <Link href="/invoice" className="text-green-600 underline">Create your first invoice →</Link>
          </div>
        ) : (
          <ul>
            {invoices.map(invoice => (
              <li key={invoice.id} className="mb-2 p-3 bg-zinc-50 rounded border flex flex-col gap-1">
                <span className="font-semibold">Invoice #{invoice.id}</span>
                <span>Date: {invoice.createdAt?.toLocaleString?.() || invoice.createdAt}</span>
                {invoice.files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {invoice.files.map(f => (
                      <a key={f.id} href={`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/documents/${f.storagePath}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">{f.fileName}</a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
