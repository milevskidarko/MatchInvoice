
import formidable from 'formidable';
import fs from 'fs';
import Tesseract from 'tesseract.js';
// pdfjsLib will be imported dynamically - ONLY for PDF files

export const config = {
  api: {
    bodyParser: false,
  },
};

async function extractTextFromPDF(filepath) {
  // PDF support removed - only images supported for now
  throw new Error("PDF support not available. Please use image files (JPG, PNG, etc.)");
}

function normalizeDate(dateStr) {
  if (!dateStr) return '';

  // Handle DD.MM.YYYY format
  const dotMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotMatch) {
    return `${dotMatch[3]}-${String(dotMatch[2]).padStart(2, '0')}-${String(dotMatch[1]).padStart(2, '0')}`;
  }

  // Handle DD/MM/YYYY format
  const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return `${slashMatch[3]}-${String(slashMatch[2]).padStart(2, '0')}-${String(slashMatch[1]).padStart(2, '0')}`;
  }

  return dateStr;
}

function parseInvoiceData(text, confidence = 100) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let invoiceNumber = '';
  let invoiceDate = '';
  let dueDate = '';
  let supplier = '';
  let currency = 'MKD';
  let items = [];

  console.log('[API OCR] Parsing with confidence:', confidence);

  // Skip expensive extraction attempts when OCR quality is too low
  if (confidence < 30) {
    console.log('[API OCR] Confidence too low (<30), returning minimal data');
    return { invoiceNumber: '', invoiceDate: '', dueDate: '', supplier: '', currency: 'MKD', items: [] };
  }

  // Extract invoice number - pattern like "001/2017" or "00003/15"
  const invoiceNumberMatch = text.match(/(?:Фактура|Invoice|Број)?\s*(\d+\/\d{2,4})/i);
  if (invoiceNumberMatch) {
    invoiceNumber = invoiceNumberMatch[1];
    console.log('[API OCR] Found invoice number:', invoiceNumber);
  } else {
    console.log('[API OCR] Invoice number NOT found');
  }

  // Extract dates - look for DD.MM.YYYY pattern
  const dateMatches = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g);
  if (dateMatches && dateMatches.length > 0) {
    invoiceDate = normalizeDate(dateMatches[0]);
    console.log('[API OCR] Found invoice date:', invoiceDate);
    if (dateMatches.length > 1) {
      dueDate = normalizeDate(dateMatches[1]);
      console.log('[API OCR] Found due date:', dueDate);
    }
  } else {
    console.log('[API OCR] No dates found');
  }

  // Find table header
  let headerLines = [];
  let tableLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/Бр\.|ОПИС|КОЛ|ЦЕНА|Item|Qty|Price/i)) {
      headerLines = lines.slice(0, i);
      tableLines = lines.slice(i + 1);
      break;
    }
  }
  if (headerLines.length === 0) headerLines = lines;

  // Extract supplier from header
  for (const line of headerLines) {
    if (line.match(/^(Назив|Адреса|Град|Phone|Email)$/i) || line.match(/^[\d\s]+$/) || line.length < 3) continue;
    if (line.includes('до:')) {
      supplier = line.split('до:')[1]?.trim() || '';
      break;
    }
    if (!supplier && line.length > 5) {
      supplier = line;
      break;
    }
  }

  // Extract currency
  if (text.match(/ден|денар/i)) currency = 'MKD';
  else if (text.match(/EUR|евро/i)) currency = 'EUR';
  else if (text.match(/USD|долар/i)) currency = 'USD';
  else if (text.match(/GBP|фунта/i)) currency = 'GBP';

  // Extract items - ONLY if confidence is acceptable
  // When confidence < 40, don't extract items at all - let user enter manually
  if (confidence >= 40) {
    console.log('[API OCR] Extracting items (confidence:', confidence, ')');

    // Try to extract from tableLines first (proper table structure)
    for (const line of tableLines) {
      if (line.match(/Бр\.|ОПИС|КОЛ|Артикол|Вкупно|вкупно|За плаќање|Цена без|ДДВ|Износ/i)) continue;
      if (line.length < 5 || line.match(/^[\d\s\.\,\-]+$/)) continue;

      // Pattern: "01 Производ 1 2 100,00 ден 200,00 ден"
      // Strategy: Split by "ден", extract numbers properly
      const denParts = line.split(/\s+ден/i);
      if (denParts.length >= 2) {
        const firstPart = denParts[0].trim();
        const parts = firstPart.split(/\s+/);
        
        // Find all numeric parts with their indices
        const numbers = [];
        for (let i = 0; i < parts.length; i++) {
          if (parts[i].match(/^[\d.,]+$/)) {
            numbers.push({ idx: i, val: parts[i] });
          }
        }
        
        // Should have at least 3 numbers: row, qty, price
        if (numbers.length >= 3) {
          // LAST TWO are always qty and price
          const qty = parseInt(numbers[numbers.length - 2].val) || 1;
          // Remove dots (thousands separator) and convert comma to decimal point
          const unitPrice = parseFloat(numbers[numbers.length - 1].val.toString().replace(/\./g, '').replace(',', '.')) || 0;
          
          // Extract name: from after row (first number) to before qty (second-to-last number)
          const nameStart = numbers[0].idx + 1;
          const nameEnd = numbers[numbers.length - 2].idx;
          const itemName = parts.slice(nameStart, nameEnd).join(' ').trim();
          
          if (itemName.length > 2 && unitPrice > 0) {
            items.push({
              name: itemName,
              qty: qty,
              unitPrice: unitPrice,
              vat: 0
            });
            console.log('[API OCR] Found item from table:', itemName, 'qty:', qty, 'price:', unitPrice);
          }
        }
      }

    }

    // If no items found in tableLines, try ALL lines (for different table formats)
    if (items.length === 0) {
      console.log('[API OCR] No items in tableLines, searching all lines');
      
      for (const line of lines) {
        // Skip non-item lines
        if (line.match(/Бр\.|ОПИС|КОЛ|Артикол|Вкупно|За плаќање|Издавање|Доспевање|Фактура|купувач|Добавувач|Налог|Намена|Датум|Бројот|Редослед/i)) continue;
        if (line.length < 5 || line.match(/^[\d\s\.\,\-]+$/) || line.match(/@|http|com|Tel|Phone/i)) continue;
        
        // Look for item lines starting with number (with or without dot)
        if (line.match(/^[\d]+[\.]?/)) {
          console.log('[API OCR] Checking line:', line.substring(0, 60));
          
          // Try standard pattern first - THIS SHOULD WORK FOR MOST CASES
          // Format: "01 Производ 1 2 100,00 ден 200,00 ден"
          // Strategy: Split by "ден", extract numbers to get qty and unitPrice
          const denParts = line.split(/\s+ден/i);
          if (denParts.length >= 2) {
            // First part: "01 Производ 1 2 100,00"
            // Need to extract: row(01) name(Производ 1) qty(2) price(100,00)
            const firstPart = denParts[0].trim();
            const parts = firstPart.split(/\s+/);
            
            // Find all numeric parts with their indices
            const numbers = [];
            for (let i = 0; i < parts.length; i++) {
              if (parts[i].match(/^[\d.,]+$/)) {
                numbers.push({ idx: i, val: parts[i] });
              }
            }
            
            // Should have at least 3 numbers: row, qty, price
            if (numbers.length >= 3) {
              // LAST TWO are always qty and price
              const qty = parseInt(numbers[numbers.length - 2].val) || 1;
              // Remove dots (thousands separator) and convert comma to decimal point
              const price = parseFloat(numbers[numbers.length - 1].val.toString().replace(/\./g, '').replace(',', '.')) || 0;
              
              // Extract name: from after row (first number) to before qty (second-to-last number)
              // Skip row number part[0], take everything until before qty number
              const nameStart = numbers[0].idx + 1;
              const nameEnd = numbers[numbers.length - 2].idx;
              const itemName = parts.slice(nameStart, nameEnd).join(' ').trim();
              
              console.log('[API OCR] DEBUG - parts:', parts);
              console.log('[API OCR] DEBUG - numbers:', numbers.map(n => `${n.val}@${n.idx}`));
              console.log('[API OCR] DEBUG - nameStart:', nameStart, 'nameEnd:', nameEnd, 'name:', itemName);
              
              if (itemName.length > 2 && price > 0) {
                items.push({
                  name: itemName,
                  qty: qty,
                  unitPrice: price,
                  vat: 0
                });
                console.log('[API OCR] Found item (standard):', itemName, 'qty:', qty, 'price:', price);
              }
            }
          }
          
          if (items.length === 0) {
            // ONLY use fallback if regex didn't work
            // For lines like: "1. Транлотниусути too sss 180 Tass"
            // Extract only the LAST two numeric values (qty and price)
            const parts = line.split(/\s+/);
            const numericParts = [];
            
            for (let i = 0; i < parts.length; i++) {
              if (parts[i].match(/^[\d.,]+$/)) {
                numericParts.push({ idx: i, val: parts[i] });
              }
            }
            
            // ONLY use fallback if we have at least 2 numbers and EXACTLY one clear name part
            if (numericParts.length >= 2) {
              const lastQty = parseInt(numericParts[numericParts.length - 2].val) || 1;
              const lastPrice = parseFloat(numericParts[numericParts.length - 1].val.toString().replace(',', '.')) || 0;
              const lastNumIdx = numericParts[numericParts.length - 1].idx;
              
              // Extract name from between index and last number
              let itemName = parts.slice(1, lastNumIdx - (numericParts.length - 2)).join(' ').trim();
              
              console.log('[API OCR] Fallback - name:', itemName, 'qty:', lastQty, 'price:', lastPrice);
              
              if (itemName.length > 2 && !itemName.match(/^[\d\s\.]+$/) && lastPrice > 0 && lastPrice < 100000) {
                itemMatch = [line, '1', itemName, lastQty, lastPrice];
              }
            }
          }
          
          if (itemMatch && itemMatch[2]) {
            const itemName = itemMatch[2].trim();
            const qty = parseInt(itemMatch[3]) || 1;
            const unitPrice = parseFloat((itemMatch[4] || '0').toString().replace(',', '.')) || 0;

            console.log('[API OCR] Potential item - name:', itemName, 'qty:', qty, 'price:', unitPrice);

            // Validate: name is text, qty and price are reasonable
            if (itemName.length > 2 && !itemName.match(/^[\d\s\.]+$/) && unitPrice > 0 && unitPrice < 100000) {
              items.push({
                name: itemName,
                qty: qty,
                unitPrice: unitPrice,
                vat: 0
              });
              console.log('[API OCR] Found item from all lines:', itemName, 'qty:', qty, 'price:', unitPrice);
            }
          }
        }
      }
    }
  } else {
    console.log('[API OCR] Confidence too low (', confidence, ') - skipping item extraction, leave for manual entry');
  }

  console.log('[API OCR] Final result - Invoice:', invoiceNumber, 'Supplier:', supplier, 'Items:', items.length);

  return {
    invoiceNumber,
    invoiceDate,
    dueDate,
    supplier,
    currency,
    items,
    rawText: text,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const form = formidable();

  try {
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];


    if (!file) {
      console.error('No file uploaded');
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    console.log('Uploaded file:', file);
    let text = '';

    if (file.mimetype === 'application/pdf') {
      text = await extractTextFromPDF(file.filepath);
    } else if (file.mimetype?.startsWith('image/')) {
      try {
        const result = await Tesseract.recognize(file.filepath, 'eng+mkd');
        console.log('Tesseract result:', result);
        text = result.data.text;

        // Get confidence for parsing decisions
        const confidence = result.data.confidence;
        const parsed = parseInvoiceData(text, confidence);
        res.status(200).json({
          success: true,
          data: parsed
        });
        return;

      } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    }
  } catch (error) {
    console.error('Formidable parse error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}