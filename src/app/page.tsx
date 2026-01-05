"use client";
import { useLanguage } from "./layout";
import { useTranslations } from "../lib/useTranslations";
import "./globals.css";

export default function Home() {
  const { lang, setLang } = useLanguage();
  const t = useTranslations();
  console.log({ lang });
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center gap-8 p-8 bg-white rounded shadow">
        <div className="flex flex-col items-center gap-4 w-full">
          <h1 className="text-4xl font-bold mb-2">InvoiceGuard</h1>

          {/* Language Selection */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              className={`px-4 py-2 rounded font-medium transition ${lang === "mk"
                ? "bg-blue-600 text-white"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                }`}
              onClick={() => setLang("mk")}
            >
              Македонски
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded font-medium transition ${lang === "en"
                ? "bg-blue-600 text-white"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                }`}
              onClick={() => setLang("en")}
            >
              English
            </button>
          </div>

          <p className="text-lg text-zinc-600 mb-4">
            {t("welcome")}
          </p>
        </div>

        <nav className="flex flex-col gap-4 w-full">
          <a href="/dashboard" className="px-6 py-3 rounded bg-blue-600 text-white text-center font-semibold hover:bg-blue-700 transition">
            {t("dashboard")}
          </a>
          <a href="/documents" className="px-6 py-3 rounded bg-green-600 text-white text-center font-semibold hover:bg-green-700 transition">
            {t("documents")}
          </a>
          <a href="/order" className="px-6 py-3 rounded bg-orange-600 text-white text-center font-semibold hover:bg-orange-700 transition">
            {t("createOrder")}
          </a>
          <a href="/invoice" className="px-6 py-3 rounded bg-green-600 text-white text-center font-semibold hover:bg-green-700 transition">
            {t("createInvoice")}
          </a>
          <a href="/validate" className="px-6 py-3 rounded bg-purple-600 text-white text-center font-semibold hover:bg-purple-700 transition">
            {t("validate")}
          </a>
        </nav>
      </main>
    </div>
  );
}
