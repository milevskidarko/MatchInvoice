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
    try {
      const result = parseInvoiceData(text);
      console.log("[OCR PARSED RESULT]", result);
      return result;
    } catch (error) {
      console.error("[OCR PARSE ERROR]", error);
      throw error;
    }
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

  console.log(
    "[DEBUG] Starting parseInvoiceData with text length:",
    text.length
  );

  /* Extract invoice number - look for pattern XXX/YYYY */
  const invoiceNumMatch = text.match(/(\d{1,3}\/\d{4})/);
  if (invoiceNumMatch) {
    result.invoiceNumber = invoiceNumMatch[1];
    console.log("[DEBUG] Invoice number found:", result.invoiceNumber);
  } else {
    console.log("[DEBUG] Invoice number NOT found");
  }

  /* Extract dates - format DD.MM.YYYY */
  const dateMatches = Array.from(
    text.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g)
  );
  console.log("[DEBUG] Date matches found:", dateMatches.length);

  if (dateMatches.length > 0) {
    result.invoiceDate = normalizeDate(dateMatches[0][0]);
    console.log("[DEBUG] Invoice date parsed:", result.invoiceDate);

    if (dateMatches.length > 1) {
      result.dueDate = normalizeDate(dateMatches[1][0]);
      console.log("[DEBUG] Due date parsed:", result.dueDate);
    }
  }

  /* Extract currency */
  const currencyMatch = text.match(/(MKD|EUR|USD|GBP|ден|денар)/i);
  if (currencyMatch) {
    const c = currencyMatch[1].toUpperCase();
    if (c.includes("MKD") || c.includes("ДЕН")) result.currency = "MKD";
    else if (c.includes("EUR")) result.currency = "EUR";
    else if (c.includes("USD")) result.currency = "USD";
    else if (c.includes("GBP")) result.currency = "GBP";
    console.log("[DEBUG] Currency set:", result.currency);
  }

  /* Extract supplier - from "до:" section, skip all placeholder/number lines */
  const supplierLines: string[] = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);

  let inSupplierSection = false;
  for (const line of lines) {
    if (/^до:/i.test(line)) {
      inSupplierSection = true;
      continue;
    }
    if (inSupplierSection) {
      if (/ФАКТУРИРАЛ|ОПИС|Бр\./i.test(line)) {
        break; // End of supplier section
      }
      // Add line if it's not a placeholder or pure numbers
      if (
        line.length > 2 &&
        !/^(назив\s+на\s+фирма|име|адреса|град|name|address|city)$/i.test(
          line
        ) &&
        !/^\d+(\s+\d+)*$/.test(line)
      ) {
        supplierLines.push(line);
      }
    }
  }

  if (supplierLines.length > 0) {
    result.supplier = supplierLines.join(" ");
    console.log("[DEBUG] Supplier found:", result.supplier);
  } else {
    console.log("[DEBUG] No supplier found");
  }

  /* Extract items from table rows */
  const items: ExtractedInvoiceData["items"] = [];

  // Find rows that start with "01", "02", etc. (row numbers)
  // Pattern: "01 Производ 1 2 100,00 ден 200,00 ден"
  // Better pattern: capture row, name, qty (before last 2 numbers), price, total
  for (const line of lines) {
    // Skip header and non-item lines
    if (line.match(/ОПИС|КОЛ|ЦЕНА|ИЗНОС|ден\s*$|^(Основа|ДДВ|За плаќање)/i))
      continue;

    // Match: row_num at start, then product name, then numbers at end
    // Format: "01 Производ 1 2 100,00 ден 200,00 ден"
    // Strategy: Split by "ден", extract numbers to get qty and unitPrice
    const denParts = line.split(/\s+ден/i);
    if (denParts.length >= 2) {
      // First part: "01 Производ 1 2 100,00"
      // Need to extract: row(01) name(Производ 1) qty(2) price(100,00)
      // Key: last two numbers are qty and price, everything in between is name
      const firstPart = denParts[0].trim();
      const numbers: Array<{ idx: number; val: string }> = [];
      const parts = firstPart.split(/\s+/);
      
      // Find all numeric parts with their indices
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].match(/^[\d.,]+$/)) {
          numbers.push({ idx: i, val: parts[i] });
        }
      }
      
      // Should have at least 3 numbers: row, qty, price
      if (numbers.length >= 3) {
        const qty = parseInt(numbers[numbers.length - 2].val, 10);
        // Remove dots (thousands separator) and convert comma to decimal point
        const price = parseFloat(numbers[numbers.length - 1].val.replace(/\./g, "").replace(",", "."));
        
        // Extract name: from after row number to before qty
        const nameStart = numbers[0].idx + 1;
        const nameEnd = numbers[numbers.length - 2].idx;
        const name = parts.slice(nameStart, nameEnd).join(" ").trim();
        
        console.log(`[DEBUG] Item: name="${name}", qty=${qty}, price=${price}`);
        
        if (name && name.length > 2 && qty > 0 && price > 0) {
          items.push({
            name,
            qty,
            unitPrice: price,
            vat: 18,
          });
        }
      }
    }

    // If no items found in tableLines, try ALL lines (for different table formats)
    // (You can add more parsing logic here for other formats if needed)
  }

  result.items = items;
  if (items.length > 0) {
    console.log("[DEBUG] Total items extracted:", items.length);
  } else {
    console.log("[DEBUG] No items extracted");
  }

  console.log("[DEBUG] Final result:", result);
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
