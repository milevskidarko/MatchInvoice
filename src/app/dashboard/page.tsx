import "../globals.css";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getStats() {
  const [ordersCount, invoicesCount, pairsCount] = await Promise.all([
    prisma.document.count({ where: { type: "ORDER" } }),
    prisma.document.count({ where: { type: "INVOICE" } }),
    prisma.documentPair.count(),
  ]);
  return { ordersCount, invoicesCount, pairsCount };
}

export default async function Dashboard() {
  const { ordersCount, invoicesCount, pairsCount } = await getStats();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-6">Dashboard</h1>
      <div className="w-full max-w-4xl">
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded shadow">
            <div className="text-3xl font-bold text-blue-600 mb-2">{ordersCount}</div>
            <div className="text-zinc-600">Orders</div>
            <Link href="/order" className="text-blue-600 text-sm mt-2 inline-block hover:underline">
              Create Order →
            </Link>
          </div>
          <div className="bg-white p-6 rounded shadow">
            <div className="text-3xl font-bold text-green-600 mb-2">{invoicesCount}</div>
            <div className="text-zinc-600">Invoices</div>
            <Link href="/invoice" className="text-green-600 text-sm mt-2 inline-block hover:underline">
              Create Invoice →
            </Link>
          </div>
          <div className="bg-white p-6 rounded shadow">
            <div className="text-3xl font-bold text-purple-600 mb-2">{pairsCount}</div>
            <div className="text-zinc-600">Validations</div>
            <Link href="/validate" className="text-purple-600 text-sm mt-2 inline-block hover:underline">
              Validate →
            </Link>
          </div>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <Link href="/order" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
              Create Order
            </Link>
            <Link href="/invoice" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">
              Create Invoice
            </Link>
            <Link href="/documents" className="px-4 py-2 bg-zinc-600 text-white rounded hover:bg-zinc-700 transition">
              View Documents
            </Link>
            <Link href="/validate" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition">
              Validate Documents
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
