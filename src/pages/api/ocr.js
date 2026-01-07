
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

function normalizeDate(dateStr, language = 'mk') {
  if (!dateStr) return '';

  // Handle DD.MM.YYYY format (European/Macedonian)
  const dotMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotMatch) {
    return `${dotMatch[3]}-${String(dotMatch[2]).padStart(2, '0')}-${String(dotMatch[1]).padStart(2, '0')}`;
  }

  // Handle slash format - MM/DD/YYYY for English, DD/MM/YYYY for others
  const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    if (language === 'en') {
      // MM/DD/YYYY (US format)
      return `${slashMatch[3]}-${String(slashMatch[1]).padStart(2, '0')}-${String(slashMatch[2]).padStart(2, '0')}`;
    } else {
      // DD/MM/YYYY (European format)
      return `${slashMatch[3]}-${String(slashMatch[2]).padStart(2, '0')}-${String(slashMatch[1]).padStart(2, '0')}`;
    }
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

  // Detect language: Check for Macedonian patterns first (even garbled OCR)
  // Macedonian invoices often have: "ден" currency, DD.MM.YYYY dates, "/YYYY" invoice numbers
  const hasMacedonianPatterns = /\b(ден|ФАКТУРА|БРОЈ|ДАТУМ|ВАЛУТА|ОПИС|КОЛ|ЦЕНА|ИЗНОС|peH|neH|aeH|oeH|Производ)\b/i.test(text);
  const hasGarbledMacedonian = /\b(AKTYPA|AKTYPATA|ATYM|ASTYTA|powuse|ONUC|CMETKA|KOPUCT|MOJIUME)\b/i.test(text);
  const hasMacedonianDateFormat = /\d{2}\.\d{2}\.\d{4}/.test(text);
  const hasMacedonianInvoiceNum = /\d{3}\/\d{4}/.test(text);
  
  const isEnglish = /\b(invoice|item|description|quantity|price|total|due|amount|unit|design|construction|services?|installation|maintenance|consultation|company)\b/i.test(text) && !hasMacedonianPatterns && !hasGarbledMacedonian;
  const isCyrillic = /[а-яА-ЯѐёЀЁ]/.test(text);
  
  // Determine language - prioritize Macedonian detection
  let language;
  if (hasMacedonianPatterns || hasGarbledMacedonian || isCyrillic) {
    language = 'mk';
  } else if (hasMacedonianDateFormat && hasMacedonianInvoiceNum) {
    language = 'mk'; // European date format + invoice pattern = likely Macedonian
  } else if (isEnglish) {
    language = 'en';
  } else {
    language = 'en'; // Default
  }
  
  console.log('[API OCR] Detected language:', language, '(patterns:', hasMacedonianPatterns, 'garbled:', hasGarbledMacedonian, 'cyrillic:', isCyrillic, ')');

  // Even with low confidence, try to extract basic info - don't skip entirely
  // Only skip item extraction for very low confidence

  // Extract invoice number - try multiple patterns
  let invoiceNumberMatch = null;
  
  if (language === 'en') {
    // For English: try INV-XXXX-XXX pattern first
    invoiceNumberMatch = text.match(/Invoice\s*#?:?\s*([A-Z]{2,4}[\-\s]?\d+[\-\s]?\d*)/i);
    if (!invoiceNumberMatch) {
      // Try just "Invoice # XXXX" or "Invoice: XXXX"
      invoiceNumberMatch = text.match(/Invoice\s*#?:?\s*(\d+)/i);
    }
  } else {
    // For Macedonian: pattern like "001/2017" or "00003/15"
    invoiceNumberMatch = text.match(/(?:Фактура|Invoice|Број)?\s*(\d+\/\d{2,4})/i);
  }
  
  if (invoiceNumberMatch) {
    invoiceNumber = invoiceNumberMatch[1].trim();
    console.log('[API OCR] Found invoice number:', invoiceNumber);
  } else {
    console.log('[API OCR] Invoice number NOT found');
  }

  // Extract dates - look for DD.MM.YYYY or MM/DD/YYYY patterns
  let dateMatches;
  if (language === 'mk') {
    // For Macedonian: DD.MM.YYYY
    dateMatches = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g);
  } else {
    // For English: MM/DD/YYYY or MM-DD-YYYY or DD.MM.YYYY
    dateMatches = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g);
  }
  if (dateMatches && dateMatches.length > 0) {
    invoiceDate = normalizeDate(dateMatches[0], language);
    console.log('[API OCR] Found invoice date:', invoiceDate);
    if (dateMatches.length > 1) {
      dueDate = normalizeDate(dateMatches[1], language);
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
    // Skip common header/non-supplier lines
    if (line.match(/^(Назив|Адреса|Град|Phone|Email)$/i) || line.match(/^[\d\s]+$/) || line.length < 3) continue;
    // Skip header row patterns (Macedonian and English)
    if (line.match(/^(ФАКТУРА|ДАТУМ|ВАЛУТА|Invoice|Bill\s*To|From:|To:|Description|Qty|Price|Amount|Total|YOUR\s*INFORMATION|CLIENT\s*INFORMATION|ISSUED|DUE\s*DATE|ITEM|QUANTITY|UNIT|TOTAL\s*PRICE)$/i)) continue;
    if (line.match(/Invoice\s*(Number|Date|#)/i)) continue;
    // Skip lines that are mostly numbers or punctuation or emails
    if (line.match(/^[\d\s\.\,\-\/]+$/) || line.length < 4) continue;
    if (line.match(/@|\.com|\.org|Street|Anytown|Anycity/i)) continue;
    
    if (line.includes('до:')) {
      supplier = line.split('до:')[1]?.trim() || '';
      break;
    }
    // For English: look for "From:" or "Bill From:"
    if (line.match(/^(From|Bill\s*From):/i)) {
      supplier = line.replace(/^(From|Bill\s*From):/i, '').trim();
      break;
    }
    // For English: look for company indicators (ACME COMPANY, etc)
    if (language === 'en' && line.match(/(Ltd|LLC|Inc|Corp|Company|Co\.|Limited)/i)) {
      supplier = line.trim();
      break;
    }
    // For English: look for ALL CAPS company names (like ACME COMPANY)
    if (language === 'en' && line.match(/^[A-Z][A-Z\s]+$/) && line.length > 3) {
      supplier = line.trim();
      break;
    }
    if (!supplier && line.length > 5 && !line.match(/^\d+/) && !line.match(/^[a-z]/)) {
      supplier = line;
      break;
    }
  }

  // Extract currency - check language first to avoid false positives
  if (language === 'en') {
    // For English: look for explicit currency markers
    if (text.match(/EUR|€/i)) currency = 'EUR';
    else if (text.match(/GBP|£|pounds?|sterling/i)) currency = 'GBP';
    else currency = 'USD'; // Default USD for English
  } else {
    // For Macedonian/other
    if (text.match(/\bден\b|денар/i)) currency = 'MKD';
    else if (text.match(/EUR|евро|€/i)) currency = 'EUR';
    else if (text.match(/USD|долар|\$/i)) currency = 'USD';
    else if (text.match(/GBP|фунта|£/i)) currency = 'GBP';
    else currency = 'MKD'; // Default MKD for Macedonian
  }

  console.log('[API OCR] Currency detected:', currency);

  // Extract items - try even with low confidence, just be more careful
  // Lower threshold to 15 to attempt extraction on most images
  if (confidence >= 15) {
    console.log('[API OCR] Extracting items (confidence:', confidence, ')');

    // For Macedonian, use tableLines if available, otherwise all lines
    // For English, always use all lines (garbled OCR needs more flexibility)
    let linesToProcess;
    if (language === 'mk') {
      linesToProcess = tableLines.length > 0 ? tableLines : lines;
    } else {
      linesToProcess = lines;
    }
    
    // Try to extract items from lines
    for (const line of linesToProcess) {
      if (language === 'mk') {
        // For Macedonian: skip only Macedonian header/summary words
        if (line.match(/Бр\.|ОПИС|КОЛ|Артикол|Вкупно|вкупно|За плаќање|Цена без|ДДВ|Износ|Основа|НАПЛАТА|УПЛАТА|БАНКА|СМЕТКА/i)) continue;
        // Skip lines without "ден" currency marker (likely not item lines)
        // But only if we have tableLines (structured invoice)
        if (tableLines.length > 0 && !line.match(/ден/i) && !line.match(/^\d+/)) continue;
      } else {
        // For English: skip header, summary, address, and metadata rows
        if (line.match(/^\s*(item|description|quantity|unit|price|total|amount|tax|subtotal|due|invoice|from|to|bill|date)\s*$/i)) continue;
        if (line.match(/item|description|quantity|unit|price|total|amount|tax|subtotal|due/i) && line.split(/\s+/).length < 3) continue;
        // Skip total/subtotal/tax lines
        if (line.match(/^\s*(subtotal|total|tax|amount\s*due|total\s*due)/i)) continue;
        // Skip address lines (contain city/state patterns or zip codes)
        if (line.match(/\b(ave|street|st|road|rd|blvd|drive|dr|lane|ln)\b/i)) continue;
        if (line.match(/\b[A-Z]{2}\s+\d{5}\b/)) continue; // State + ZIP
        if (line.match(/,\s*[A-Z]{2}\s+\d{5}/)) continue; // City, State ZIP
        // Skip email lines
        if (line.match(/@[a-z]+\.[a-z]+/i)) continue;
        // Skip invoice details header lines
        if (line.match(/bill\s*to|invoice\s*details|payment\s*terms|net\s*\d+/i)) continue;
        // Skip thank you and payment method lines
        if (line.match(/thank\s*you|payment\s*method/i)) continue;
      }
      if (line.length < 3 || line.match(/^[\d\s\.\,\-$]+$/)) continue;
      // Skip supplier line
      if (supplier && line.includes(supplier)) continue;

      // Strategy depends on language
      if (language === 'mk') {
        // For Macedonian: Split by "ден", extract numbers properly
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
      } else {
        // For English: look for pattern like "Description qty price total"
        // Also handle patterns like "1. Item Name  qty  price  total"
        // Handle garbled OCR like "s250" for "$250", "ss00" for "$500", etc.
        const parts = line.split(/\s+/);
        const numbers = [];
        
        console.log('[API OCR] EN parsing line:', line);
        
        // Find numeric parts (including currency symbols and garbled patterns)
        for (let i = 0; i < parts.length; i++) {
          let part = parts[i];
          // Handle garbled OCR patterns:
          // "s250" -> "250", "s1000" -> "1000", "ss00" -> "500", "s300" -> "300"
          // "5500" stays as "5500"
          let cleaned = part.replace(/[$€£]/g, '');
          // Handle "sXXX" pattern where s is garbled $
          cleaned = cleaned.replace(/^s(\d+)/i, '$1');
          // Handle "ssXX" pattern where ss might be garbled "5" + something
          cleaned = cleaned.replace(/^ss(\d+)/i, '5$1');
          
          // Also try to extract numbers from mixed text
          const numMatch = cleaned.match(/(\d+[\d.,]*)/);
          if (numMatch) {
            cleaned = numMatch[1];
          }
          if (cleaned.match(/^[\d.,]+$/) && cleaned.length > 0) {
            numbers.push({ idx: i, val: cleaned, original: part });
          }
        }
        
        // Need at least 1 number (price), we'll figure out qty
        if (numbers.length >= 1 && parts.length >= 2) {
          let qty = 1;
          let unitPrice = 0;
          let itemName = '';
          
          console.log('[API OCR] EN numbers found:', numbers.map(n => `${n.val}@${n.idx}(${n.original})`).join(', '));
          
          if (numbers.length >= 2) {
            // Multiple numbers: usually qty and price(s)
            // Check if first number is small (likely qty) or large (likely price)
            const firstNum = parseFloat(numbers[0].val.replace(/,/g, ''));
            const secondNum = numbers.length >= 2 ? parseFloat(numbers[1].val.replace(/,/g, '')) : 0;
            const lastNum = parseFloat(numbers[numbers.length - 1].val.replace(/,/g, ''));
            
            // If we have 3+ numbers and first is reasonable qty (1-100), second is unit price
            if (numbers.length >= 3 && firstNum >= 1 && firstNum <= 100 && secondNum > firstNum) {
              qty = parseInt(numbers[0].val) || 1;
              unitPrice = secondNum; // Second number is unit price
              itemName = parts.slice(0, numbers[0].idx).join(' ').trim();
            } else if (firstNum <= 100 && lastNum > firstNum) {
              // First is qty, use second-to-last as unit price if 3+ numbers
              qty = parseInt(numbers[0].val) || 1;
              if (numbers.length >= 3) {
                unitPrice = parseFloat(numbers[numbers.length - 2].val.replace(/,/g, '')) || 0;
              } else {
                unitPrice = lastNum;
              }
              itemName = parts.slice(0, numbers[0].idx).join(' ').trim();
              // If name is empty, take text between first and second number
              if (!itemName && numbers.length >= 2) {
                itemName = parts.slice(numbers[0].idx + 1, numbers[1].idx).join(' ').trim();
              }
            } else {
              // First number might be row number or part of garbled text
              // Take the second-to-last as unit price if available
              if (numbers.length >= 2) {
                unitPrice = parseFloat(numbers[numbers.length - 2].val.replace(/,/g, '')) || parseFloat(numbers[numbers.length - 1].val.replace(/,/g, ''));
              } else {
                unitPrice = lastNum || firstNum;
              }
              itemName = parts.slice(0, numbers[0].idx).join(' ').trim();
            }
          } else {
            // Single number: assume it's the price, qty=1
            unitPrice = parseFloat(numbers[0].val.replace(/,/g, '')) || 0;
            itemName = parts.slice(0, numbers[0].idx).join(' ').trim();
          }
          
          // Clean up item name - remove row numbers at start and garbled chars
          itemName = itemName.replace(/^\d+\.?\s*/, '').trim();
          itemName = itemName.replace(/^[а-яА-ЯѐёЀЁ\s]+/, '').trim(); // Remove leading Cyrillic garbage
          
          console.log('[API OCR] EN extracted - name:', itemName, 'qty:', qty, 'price:', unitPrice);
          
          if (itemName.length > 1 && unitPrice > 0 && !itemName.match(/total|subtotal|tax|amount|due|invoice|company/i)) {
            items.push({
              name: itemName,
              qty: qty,
              unitPrice: unitPrice,
              vat: 0
            });
            console.log('[API OCR] Found item from table (EN):', itemName, 'qty:', qty, 'price:', unitPrice);
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
            let itemMatch = null; // Define itemMatch here
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
                items.push({
                  name: itemName,
                  qty: lastQty,
                  unitPrice: lastPrice,
                  vat: 0
                });
                console.log('[API OCR] Found item from fallback:', itemName, 'qty:', lastQty, 'price:', lastPrice);
              }
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
        // Try BOTH English and Macedonian OCR and pick the better one
        console.log('[OCR] Running dual OCR (English + Macedonian)...');
        
        // Run both in parallel for speed
        const [engResult, mkdResult] = await Promise.all([
          Tesseract.recognize(file.filepath, 'eng', {
            tessedit_pageseg_mode: '3',
            preserve_interword_spaces: '1',
          }),
          Tesseract.recognize(file.filepath, 'mkd', {
            tessedit_pageseg_mode: '3',
            preserve_interword_spaces: '1',
          })
        ]);
        
        console.log('[OCR] English confidence:', engResult.data.confidence);
        console.log('[OCR] Macedonian confidence:', mkdResult.data.confidence);
        
        // Check for Macedonian patterns in Macedonian result
        const mkdText = mkdResult.data.text;
        const engText = engResult.data.text;
        
        // Check for REAL Macedonian patterns in Macedonian result
        // These are actual Macedonian words, not garbled Latin->Cyrillic conversion
        const hasMkdPatterns = /(ден|денар|ФАКТУРА|БРОЈ|Производ|ОПИС|ЦЕНА|ИЗНОС|ВКУПНО|Добавувач|плаќање)/i.test(mkdText);
        
        // Check for English patterns in English result
        const hasEngPatterns = /\b(Invoice|Description|Quantity|Price|Total|Amount|Due|Date|Bill|Payment|Subtotal)\b/i.test(engText);
        
        // Count real Cyrillic (not converted Latin) - look for uniquely Cyrillic letters
        // Letters like ж, ш, щ, ц, ч, ъ, ь, ю, я, љ, њ, ќ, ѓ, џ are uniquely Cyrillic
        const uniqueCyrillicCount = (mkdText.match(/[жшщцчъьюяљњќѓџЖШЩЦЧЪЬЮЯЉЊЌЃЏ]/g) || []).length;
        
        console.log('[OCR] Macedonian patterns found:', hasMkdPatterns, 'Unique Cyrillic count:', uniqueCyrillicCount);
        console.log('[OCR] English patterns found:', hasEngPatterns, 'English confidence:', engResult.data.confidence);
        
        // Choose the best result based on patterns and confidence
        let result, text, confidence;
        
        // Priority 1: English with high confidence AND English patterns
        if (engResult.data.confidence >= 80 && hasEngPatterns) {
          console.log('[OCR] Using English result (high confidence + English patterns)');
          result = engResult;
          text = engText;
          confidence = engResult.data.confidence;
        }
        // Priority 2: Macedonian with real Macedonian patterns
        else if (hasMkdPatterns || uniqueCyrillicCount > 20) {
          console.log('[OCR] Using Macedonian result (has real Macedonian content)');
          result = mkdResult;
          text = mkdText;
          confidence = mkdResult.data.confidence;
        }
        // Priority 3: English if significantly better confidence
        else if (engResult.data.confidence > mkdResult.data.confidence + 20) {
          console.log('[OCR] Using English result (significantly better confidence)');
          result = engResult;
          text = engText;
          confidence = engResult.data.confidence;
        }
        // Priority 4: Whichever has higher confidence
        else if (engResult.data.confidence >= mkdResult.data.confidence) {
          console.log('[OCR] Using English result (higher or equal confidence)');
          result = engResult;
          text = engText;
          confidence = engResult.data.confidence;
        }
        else {
          console.log('[OCR] Using Macedonian result (default)');
          result = mkdResult;
          text = mkdText;
          confidence = mkdResult.data.confidence;
        }
        
        console.log('[OCR] Final text:', text.substring(0, 300));
        
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