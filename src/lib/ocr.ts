import Tesseract from 'tesseract.js';

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
 * Extract text from image using OCR
 */
export async function extractTextFromImage(
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string> {
  const { data } = await Tesseract.recognize(file, 'eng+mkd', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        const progress = Math.round(m.progress * 100);
        onProgress(progress);
      }
    },
  });
  return data.text;
}

/**
 * Parse invoice data from OCR text
 */
export function parseInvoiceData(text: string): ExtractedInvoiceData {
  const result: ExtractedInvoiceData = {};
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Extract invoice number (look for patterns like "Invoice #123", "Faktura br. 123", etc.)
  const invoiceNumberPatterns = [
    /(?:invoice|faktura|фактура)[\s#:]*([A-Z0-9\-]+)/i,
    /(?:broj|број|number)[\s:]*([A-Z0-9\-]+)/i,
    /#[\s]*([A-Z0-9\-]+)/i,
  ];
  for (const pattern of invoiceNumberPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.invoiceNumber = match[1];
      break;
    }
  }

  // Extract dates (look for date patterns)
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
  
  // Try to identify invoice date and due date
  if (dates.length > 0) {
    // First date is usually invoice date
    result.invoiceDate = normalizeDate(dates[0]);
    if (dates.length > 1) {
      // Look for "due date" or "dospelost" patterns
      const dueDatePatterns = [
        /(?:due|dospelost|достасување|due date)[\s:]*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/i,
        /(?:плаќање|payment)[\s:]*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/i,
      ];
      let foundDueDate = false;
      for (const pattern of dueDatePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          result.dueDate = normalizeDate(match[1]);
          foundDueDate = true;
          break;
        }
      }
      if (!foundDueDate && dates.length >= 2) {
        result.dueDate = normalizeDate(dates[1]);
      }
    }
  }

  // Extract supplier (look for company name patterns, usually at the top)
  const supplierPatterns = [
    /(?:supplier|dodavuvac|добавувач|from|од)[\s:]*([A-ZА-Я][A-ZА-Яa-zа-я\s&]+)/i,
  ];
  // Try to get company name from first few lines
  const firstLines = lines.slice(0, 5).join(' ');
  for (const pattern of supplierPatterns) {
    const match = firstLines.match(pattern);
    if (match && match[1]) {
      result.supplier = match[1].trim();
      break;
    }
  }
  // If no supplier found, try first non-empty line (often company name)
  if (!result.supplier && lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length > 3 && !firstLine.match(/^\d/)) {
      result.supplier = firstLine;
    }
  }

  // Extract currency
  const currencyPatterns = [
    /(MKD|EUR|USD|GBP|ден|денар|euro|dollar)/i,
  ];
  for (const pattern of currencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      const currency = match[1].toUpperCase();
      if (currency.includes('MKD') || currency.includes('ДЕН')) {
        result.currency = 'MKD';
      } else if (currency.includes('EUR') || currency.includes('EURO')) {
        result.currency = 'EUR';
      } else if (currency.includes('USD') || currency.includes('DOLLAR')) {
        result.currency = 'USD';
      } else if (currency.includes('GBP')) {
        result.currency = 'GBP';
      }
      break;
    }
  }

  // Extract items (look for table-like structures)
  const items: ExtractedInvoiceData['items'] = [];
  
  // Look for patterns like: "Item Name | Qty | Price | VAT"
  // Try to find rows with numbers that might be items
  const itemPatterns = [
    /([A-ZА-Я][A-ZА-Яa-zа-я\s]+?)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/g,
    /([A-ZА-Я][A-ZА-Яa-zа-я\s]+?)\s+(\d+\.?\d*)\s+x\s+(\d+\.?\d*)/gi,
  ];
  
  for (const pattern of itemPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[2] && match[3]) {
        const name = match[1].trim();
        // Skip if it looks like a header or total row
        if (name.toLowerCase().includes('total') || 
            name.toLowerCase().includes('вкупно') ||
            name.toLowerCase().includes('subtotal') ||
            name.length < 3) {
          continue;
        }
        
        const qty = parseFloat(match[2]) || 1;
        const unitPrice = parseFloat(match[3]) || 0;
        const vat = match[4] ? parseFloat(match[4]) : 18;
        
        items.push({
          name,
          qty,
          unitPrice,
          vat: isNaN(vat) ? 18 : vat,
        });
      }
    }
  }

  // If no items found with patterns, try to find any line with numbers that might be an item
  if (items.length === 0) {
    for (const line of lines) {
      // Look for lines with product-like names followed by numbers
      const itemMatch = line.match(/^([A-ZА-Я][A-ZА-Яa-zа-я\s]{3,}?)\s+.*?(\d+\.?\d*)\s+.*?(\d+\.?\d*)/);
      if (itemMatch && itemMatch[1] && itemMatch[2] && itemMatch[3]) {
        const name = itemMatch[1].trim();
        if (name.length > 3 && !name.toLowerCase().includes('total')) {
          items.push({
            name,
            qty: parseFloat(itemMatch[2]) || 1,
            unitPrice: parseFloat(itemMatch[3]) || 0,
            vat: 18,
          });
        }
      }
    }
  }

  if (items.length > 0) {
    result.items = items.slice(0, 20); // Limit to 20 items
  }

  return result;
}

/**
 * Normalize date format to YYYY-MM-DD
 */
function normalizeDate(dateStr: string): string {
  // Try different date formats
  const formats = [
    /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/, // DD.MM.YYYY or DD-MM-YYYY
    /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/, // YYYY-MM-DD
    /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2})/, // DD.MM.YY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let day: string, month: string, year: string;
      
      if (match[3].length === 4) {
        // YYYY-MM-DD format
        if (dateStr.includes(match[3]) && parseInt(match[3]) > 31) {
          year = match[3];
          month = match[2].padStart(2, '0');
          day = match[1].padStart(2, '0');
        } else {
          // DD-MM-YYYY format
          day = match[1].padStart(2, '0');
          month = match[2].padStart(2, '0');
          year = match[3];
        }
      } else {
        // DD-MM-YY format
        day = match[1].padStart(2, '0');
        month = match[2].padStart(2, '0');
        year = '20' + match[3];
      }
      
      return `${year}-${month}-${day}`;
    }
  }
  
  return dateStr; // Return as-is if can't parse
}

/**
 * Extract invoice data from image file
 */
export async function extractInvoiceData(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ExtractedInvoiceData> {
  const text = await extractTextFromImage(file, onProgress);
  return parseInvoiceData(text);
}
