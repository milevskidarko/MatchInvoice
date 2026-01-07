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

export async function extractTextFromImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const { data } = await Tesseract.recognize(file, "eng+mkd", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        const progress = Math.round(m.progress * 100);
        onProgress(progress);
      }
    },
  });
  return data.text;
}

export function parseInvoiceData(text: string): ExtractedInvoiceData {
  const result: ExtractedInvoiceData = {};
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Extract invoice number
  const invoiceNumberPatterns = [
    /(?:invoice|faktura|фактура)[\s#:]*([A-Z0-9\-\/]+)/i,
    /(?:broj|број|number)[\s:]*([A-Z0-9\-\/]+)/i,
    /#[\s]*([A-Z0-9\-\/]+)/i,
  ];
  for (const pattern of invoiceNumberPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.invoiceNumber = match[1];
      break;
    }
  }

  // Extract dates
  const datePatterns = [
    /(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/g,
    /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/g,
  ];
  const dates: string[] = [];
  for (const pattern of datePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        dates.push(match[1]);
      }
    }
  }
  if (dates.length > 0) {
    result.invoiceDate = normalizeDate(dates[0]);
    if (dates.length > 1) {
      result.dueDate = normalizeDate(dates[1]);
    }
  }

  // Extract supplier
  const supplierPatterns = [
    /(?:supplier|dodavuvac|добавувач|from|од)[\s:]*([A-ZА-Я][A-ZА-Яa-zа-я\s&]+)/i,
  ];
  const firstLines = lines.slice(0, 5).join(" ");
  for (const pattern of supplierPatterns) {
    const match = firstLines.match(pattern);
    if (match && match[1]) {
      result.supplier = match[1].trim();
      break;
    }
  }
  if (!result.supplier && lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length > 3 && !firstLine.match(/^\d/)) {
      result.supplier = firstLine;
    }
  }

  // Extract currency
  const currencyPatterns = [/(MKD|EUR|USD|GBP|ден|денар|euro|dollar)/i];
  for (const pattern of currencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      const currency = match[1].toUpperCase();
      if (currency.includes("MKD") || currency.includes("ДЕН")) {
        result.currency = "MKD";
      } else if (currency.includes("EUR") || currency.includes("EURO")) {
        result.currency = "EUR";
      } else if (currency.includes("USD") || currency.includes("DOLLAR")) {
        result.currency = "USD";
      } else if (currency.includes("GBP")) {
        result.currency = "GBP";
      }
      break;
    }
  }

  // Extract global VAT
  let globalVat: number | undefined = undefined;
  for (const line of lines) {
    const vatMatch = line.match(/ДДВ\s*([0-9]{1,2}(?:[\.,][0-9]+)?)%/i);
    if (vatMatch && vatMatch[1]) {
      globalVat = parseFloat(vatMatch[1].replace(',', '.'));
      break;
    }
  }

  // Extract items (robust, works with OCR noise)
  const items: ExtractedInvoiceData["items"] = [];
  for (const line of lines) {
    if (/вкупно|total|основа|ДДВ|наплата|за\s+плаќање|основица|итог|sum|subtotal|grand/i.test(line)) continue;
    // Match lines like: 01 Производ 1 2 100,00 ден 200,00 ден
    const itemMatch = line.match(/^\s*\d+\s+([A-Za-zА-Яа-я0-9\s]+)\s+(\d+)\s+([\d\.]+,[\d]{2})\s*ден\s+([\d\.]+,[\d]{2})\s*ден/i);
    if (itemMatch) {
      const name = itemMatch[1].trim();
      const qty = parseInt(itemMatch[2]);
      const unitPrice = parseFloat(itemMatch[3].replace(/\./g, '').replace(',', '.'));
      // const amount = parseFloat(itemMatch[4].replace(/\./g, '').replace(',', '.'));
      const vat = globalVat !== undefined ? globalVat : 18;
      items.push({
        name,
        qty: isNaN(qty) ? 1 : qty,
        unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
        vat,
      });
      continue;
    }
    // fallback: old logic for other lines
    const numbers = Array.from(line.matchAll(/([\d\.]+,[\d]{2}|[\d]+,[\d]{2}|[\d]+)/g)).map(m => m[1].replace(/\./g, '').replace(',', '.'));
    const parsedNumbers = numbers.map(n => parseFloat(n)).filter(n => !isNaN(n));
    if (parsedNumbers.length >= 3) {
      let bestMatch = {qty: 1, unitPrice: 0, amount: 0, diff: Number.POSITIVE_INFINITY};
      for (let i = 0; i < parsedNumbers.length - 1; i++) {
        for (let j = i + 1; j < parsedNumbers.length; j++) {
          const a = parsedNumbers[i];
          const b = parsedNumbers[j];
          const c = parsedNumbers.find(x => Math.abs(x - a * b) < 2);
          if (Number.isInteger(a) && !Number.isInteger(b) && c !== undefined) {
            const diff = Math.abs(c - a * b);
            if (diff < bestMatch.diff) {
              bestMatch = {qty: a, unitPrice: b, amount: c, diff};
            }
          }
          if (Number.isInteger(b) && !Number.isInteger(a) && c !== undefined) {
            const diff = Math.abs(c - a * b);
            if (diff < bestMatch.diff) {
              bestMatch = {qty: b, unitPrice: a, amount: c, diff};
            }
          }
        }
      }
      const qtyStr = String(bestMatch.qty);
      let name = line.split(qtyStr)[0].replace(/^\s*\d+\s+/, '').trim();
      name = name.replace(/\s*\d+$/, '').trim();
      const vat = globalVat !== undefined ? globalVat : 18;
      if (name && bestMatch.unitPrice > 0) {
        items.push({
          name,
          qty: bestMatch.qty,
          unitPrice: bestMatch.unitPrice,
          vat,
        });
      }
    }
  }
  if (items.length > 0) {
    result.items = items.slice(0, 20);
  }
  return result;
}

function normalizeDate(dateStr: string): string {
  const formats = [
    /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/,
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/,
    /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2})/,
  ];
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let day: string, month: string, year: string;
      if (match[3].length === 4) {
        if (dateStr.includes(match[3]) && parseInt(match[3]) > 31) {
          year = match[3];
          month = match[2].padStart(2, "0");
          day = match[1].padStart(2, "0");
        } else {
          day = match[1].padStart(2, "0");
          month = match[2].padStart(2, "0");
          year = match[3];
        }
      } else {
        day = match[1].padStart(2, "0");
        month = match[2].padStart(2, "0");
        year = "20" + match[3];
      }
      return `${year}-${month}-${day}`;
    }
  }
  return dateStr;
}

export async function extractInvoiceData(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ExtractedInvoiceData> {
  const text = await extractTextFromImage(file, onProgress);
  // Debug: log raw OCR text for analysis
  console.log("[OCR RAW TEXT]", text);
  return parseInvoiceData(text);
}
