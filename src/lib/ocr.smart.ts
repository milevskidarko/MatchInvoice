import Tesseract from "tesseract.js";

export interface ExtractedInvoiceData {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  supplier?: string;
  currency?: string;
  items?: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    vat: number;
  }>;
}

/**
 * OCR from IMAGE only (browser-safe)
 */
export async function extractTextFromImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const { data } = await Tesseract.recognize(file, "eng+mkd", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  return data.text;
}

/**
 * Main entry point
 */
export async function extractInvoiceData(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ExtractedInvoiceData> {
  if (file.type.startsWith("image/")) {
    const text = await extractTextFromImage(file, onProgress);
    console.log("[OCR RAW TEXT]", text);
    return parseInvoiceData(text);
  }

  if (file.type === "application/pdf") {
    throw new Error(
      "PDF extraction is not supported in the browser. Use server-side PDF parsing."
    );
  }

  throw new Error("Unsupported file type for OCR");
}

/**
 * Parse OCR text into structured invoice data
 */
export function parseInvoiceData(text: string): ExtractedInvoiceData {
  const result: ExtractedInvoiceData = {};

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  /* ---------------- Invoice number ---------------- */
  const invoiceNumberPatterns = [
    /(?:invoice|faktura|фактура)[\s#:]*([A-Z0-9\-\/]+)/i,
    /(?:broj|број|number)[\s:]*([A-Z0-9\-\/]+)/i,
    /#\s*([A-Z0-9\-\/]+)/i,
  ];

  for (const p of invoiceNumberPatterns) {
    const m = text.match(p);
    if (m?.[1]) {
      result.invoiceNumber = m[1];
      break;
    }
  }

  /* ---------------- Dates ---------------- */
  const dateMatches = Array.from(
    text.matchAll(/(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/g)
  ).map((m) => m[1]);

  if (dateMatches.length > 0) {
    result.invoiceDate = normalizeDate(dateMatches[0]);
    if (dateMatches[1]) {
      result.dueDate = normalizeDate(dateMatches[1]);
    }
  }

  /* ---------------- Supplier ---------------- */
  const firstLines = lines.slice(0, 5).join(" ");
  const supplierMatch = firstLines.match(
    /(?:supplier|dodavuvac|добавувач|from|од)[\s:]*([A-ZА-Я][A-ZА-Яa-zа-я\s&]+)/i
  );

  if (supplierMatch?.[1]) {
    result.supplier = supplierMatch[1].trim();
  } else if (lines[0] && !/^\d/.test(lines[0])) {
    result.supplier = lines[0];
  }

  /* ---------------- Currency ---------------- */
  const currencyMatch = text.match(/(MKD|EUR|USD|GBP|ден|денар|euro|dollar)/i);
  if (currencyMatch) {
    const c = currencyMatch[1].toUpperCase();
    if (c.includes("MKD") || c.includes("ДЕН")) result.currency = "MKD";
    else if (c.includes("EUR")) result.currency = "EUR";
    else if (c.includes("USD")) result.currency = "USD";
    else if (c.includes("GBP")) result.currency = "GBP";
  }

  /* ---------------- Global VAT ---------------- */
  let globalVat: number | undefined;
  for (const line of lines) {
    const m = line.match(/ДДВ\s*([0-9]{1,2}(?:[.,][0-9]+)?)%/i);
    if (m?.[1]) {
      globalVat = parseFloat(m[1].replace(",", "."));
      break;
    }
  }

  /* ---------------- Items ---------------- */
  const items: ExtractedInvoiceData["items"] = [];

  for (const line of lines) {
    if (/вкупно|total|subtotal|sum|итог|наплата|за\s+плаќање/i.test(line)) continue;

    const nums = Array.from(
      line.matchAll(/([\d\.]+,[\d]{2}|\d+)/g)
    ).map((m) => parseFloat(m[1].replace(/\./g, "").replace(",", ".")));

    if (nums.length >= 2) {
      const qty = Number.isInteger(nums[0]) ? nums[0] : 1;
      const unitPrice = nums.find((n) => !Number.isInteger(n)) ?? 0;

      const name = line
        .replace(/[0-9.,]+/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (name && unitPrice > 0) {
        items.push({
          name,
          qty,
          unitPrice,
          vat: globalVat ?? 18,
        });
      }
    }
  }

  if (items.length) result.items = items.slice(0, 20);

  return result;
}

/**
 * Normalize date to YYYY-MM-DD
 */
function normalizeDate(dateStr: string): string {
  const m =
    dateStr.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/) ??
    dateStr.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/) ??
    dateStr.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2})/);

  if (!m) return dateStr;

  let y = m[3] ?? m[1];
  const mth = m[2];
  const d = m[1];

  if (y.length === 2) y = "20" + y;

  return `${y}-${mth.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
