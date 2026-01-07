import formidable from "formidable";
import Tesseract from "tesseract.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function extractTextFromPDF() {
  throw new Error(
    "PDF support not available. Please use image files (JPG, PNG, etc.)"
  );
}

function normalizeDate(dateStr, language = "mk") {
  if (!dateStr) return "";

  const dotMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotMatch) {
    return `${dotMatch[3]}-${String(dotMatch[2]).padStart(2, "0")}-${String(
      dotMatch[1]
    ).padStart(2, "0")}`;
  }

  const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    if (language === "en") {
      return `${slashMatch[3]}-${String(slashMatch[1]).padStart(
        2,
        "0"
      )}-${String(slashMatch[2]).padStart(2, "0")}`;
    } else {
      return `${slashMatch[3]}-${String(slashMatch[2]).padStart(
        2,
        "0"
      )}-${String(slashMatch[1]).padStart(2, "0")}`;
    }
  }

  return dateStr;
}

function parseInvoiceData(text, confidence = 100) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let invoiceNumber = "";
  let invoiceDate = "";
  let dueDate = "";
  let supplier = "";
  let currency = "MKD";
  let items = [];

  const hasMacedonianPatterns =
    /\b(ден|ФАКТУРА|БРОЈ|ДАТУМ|ВАЛУТА|ОПИС|КОЛ|ЦЕНА|ИЗНОС|peH|neH|aeH|oeH|Производ)\b/i.test(
      text
    );
  const hasGarbledMacedonian =
    /\b(AKTYPA|AKTYPATA|ATYM|ASTYTA|powuse|ONUC|CMETKA|KOPUCT|MOJIUME)\b/i.test(
      text
    );
  const hasMacedonianDateFormat = /\d{2}\.\d{2}\.\d{4}/.test(text);
  const hasMacedonianInvoiceNum = /\d{3}\/\d{4}/.test(text);

  const isEnglish =
    /\b(invoice|item|description|quantity|price|total|due|amount|unit|design|construction|services?|installation|maintenance|consultation|company)\b/i.test(
      text
    ) &&
    !hasMacedonianPatterns &&
    !hasGarbledMacedonian;
  const isCyrillic = /[а-яА-ЯѐёЀЁ]/.test(text);

  let language;
  if (hasMacedonianPatterns || hasGarbledMacedonian || isCyrillic) {
    language = "mk";
  } else if (hasMacedonianDateFormat && hasMacedonianInvoiceNum) {
    language = "mk";
  } else if (isEnglish) {
    language = "en";
  } else {
    language = "en";
  }

  let invoiceNumberMatch = null;

  if (language === "en") {
    invoiceNumberMatch = text.match(
      /Invoice\s*#?:?\s*([A-Z]{2,4}[\-\s]?\d+[\-\s]?\d*)/i
    );
    if (!invoiceNumberMatch) {
      invoiceNumberMatch = text.match(/Invoice\s*#?:?\s*(\d+)/i);
    }
  } else {
    invoiceNumberMatch = text.match(
      /(?:Фактура|Invoice|Број)?\s*(\d+\/\d{2,4})/i
    );
  }

  if (invoiceNumberMatch) {
    invoiceNumber = invoiceNumberMatch[1].trim();
  }

  let dateMatches;
  if (language === "mk") {
    dateMatches = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g);
  } else {
    dateMatches = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/g);
  }
  if (dateMatches && dateMatches.length > 0) {
    invoiceDate = normalizeDate(dateMatches[0], language);
    console.log("[API OCR] Found invoice date:", invoiceDate);
    if (dateMatches.length > 1) {
      dueDate = normalizeDate(dateMatches[1], language);
    }
  }

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

  for (const line of headerLines) {
    // Skip common header/non-supplier lines
    if (
      line.match(/^(Назив|Адреса|Град|Phone|Email)$/i) ||
      line.match(/^[\d\s]+$/) ||
      line.length < 3
    )
      continue;
    // Skip header row patterns (Macedonian and English)
    if (
      line.match(
        /^(ФАКТУРА|ДАТУМ|ВАЛУТА|Invoice|Bill\s*To|From:|To:|Description|Qty|Price|Amount|Total|YOUR\s*INFORMATION|CLIENT\s*INFORMATION|ISSUED|DUE\s*DATE|ITEM|QUANTITY|UNIT|TOTAL\s*PRICE)$/i
      )
    )
      continue;
    if (line.match(/Invoice\s*(Number|Date|#)/i)) continue;
    // Skip lines that are mostly numbers or punctuation or emails
    if (line.match(/^[\d\s\.\,\-\/]+$/) || line.length < 4) continue;
    if (line.match(/@|\.com|\.org|Street|Anytown|Anycity/i)) continue;

    if (line.includes("до:")) {
      supplier = line.split("до:")[1]?.trim() || "";
      break;
    }

    if (line.match(/^(From|Bill\s*From):/i)) {
      supplier = line.replace(/^(From|Bill\s*From):/i, "").trim();
      break;
    }

    if (
      language === "en" &&
      line.match(/(Ltd|LLC|Inc|Corp|Company|Co\.|Limited)/i)
    ) {
      supplier = line.trim();
      break;
    }

    if (language === "en" && line.match(/^[A-Z][A-Z\s]+$/) && line.length > 3) {
      supplier = line.trim();
      break;
    }
    if (
      !supplier &&
      line.length > 5 &&
      !line.match(/^\d+/) &&
      !line.match(/^[a-z]/)
    ) {
      supplier = line;
      break;
    }
  }

  if (language === "en") {
    if (text.match(/EUR|€/i)) currency = "EUR";
    else if (text.match(/GBP|£|pounds?|sterling/i)) currency = "GBP";
    else currency = "USD";
  } else {
    if (text.match(/\bден\b|денар/i)) currency = "MKD";
    else if (text.match(/EUR|евро|€/i)) currency = "EUR";
    else if (text.match(/USD|долар|\$/i)) currency = "USD";
    else if (text.match(/GBP|фунта|£/i)) currency = "GBP";
    else currency = "MKD";
  }

  if (confidence >= 15) {
    let linesToProcess;
    if (language === "mk") {
      linesToProcess = tableLines.length > 0 ? tableLines : lines;
    } else {
      linesToProcess = lines;
    }

    for (const line of linesToProcess) {
      if (language === "mk") {
        if (
          line.match(
            /Бр\.|ОПИС|КОЛ|Артикол|Вкупно|вкупно|За плаќање|Цена без|ДДВ|Износ|Основа|НАПЛАТА|УПЛАТА|БАНКА|СМЕТКА/i
          )
        )
          continue;

        if (tableLines.length > 0 && !line.match(/ден/i) && !line.match(/^\d+/))
          continue;
      } else {
        s;
        if (
          line.match(
            /^\s*(item|description|quantity|unit|price|total|amount|tax|subtotal|due|invoice|from|to|bill|date)\s*$/i
          )
        )
          continue;
        if (
          line.match(
            /item|description|quantity|unit|price|total|amount|tax|subtotal|due/i
          ) &&
          line.split(/\s+/).length < 3
        )
          continue;

        if (line.match(/^\s*(subtotal|total|tax|amount\s*due|total\s*due)/i))
          continue;

        if (line.match(/\b(ave|street|st|road|rd|blvd|drive|dr|lane|ln)\b/i))
          continue;
        if (line.match(/\b[A-Z]{2}\s+\d{5}\b/)) continue; // State + ZIP
        if (line.match(/,\s*[A-Z]{2}\s+\d{5}/)) continue; // City, State ZIP

        if (line.match(/@[a-z]+\.[a-z]+/i)) continue;

        if (
          line.match(/bill\s*to|invoice\s*details|payment\s*terms|net\s*\d+/i)
        )
          continue;
        s;
        if (line.match(/thank\s*you|payment\s*method/i)) continue;
      }
      if (line.length < 3 || line.match(/^[\d\s\.\,\-$]+$/)) continue;

      if (supplier && line.includes(supplier)) continue;

      if (language === "mk") {
        const denParts = line.split(/\s+ден/i);
        if (denParts.length >= 2) {
          const firstPart = denParts[0].trim();
          const parts = firstPart.split(/\s+/);

          const numbers = [];
          for (let i = 0; i < parts.length; i++) {
            if (parts[i].match(/^[\d.,]+$/)) {
              numbers.push({ idx: i, val: parts[i] });
            }
          }

          if (numbers.length >= 3) {
            const qty = parseInt(numbers[numbers.length - 2].val) || 1;

            const unitPrice =
              parseFloat(
                numbers[numbers.length - 1].val
                  .toString()
                  .replace(/\./g, "")
                  .replace(",", ".")
              ) || 0;

            const nameStart = numbers[0].idx + 1;
            const nameEnd = numbers[numbers.length - 2].idx;
            const itemName = parts.slice(nameStart, nameEnd).join(" ").trim();

            if (itemName.length > 2 && unitPrice > 0) {
              items.push({
                name: itemName,
                qty: qty,
                unitPrice: unitPrice,
                vat: 0,
              });
            }
          }
        }
      } else {
        const parts = line.split(/\s+/);
        const numbers = [];

        for (let i = 0; i < parts.length; i++) {
          let part = parts[i];

          let cleaned = part.replace(/[$€£]/g, "");

          cleaned = cleaned.replace(/^s(\d+)/i, "$1");

          cleaned = cleaned.replace(/^ss(\d+)/i, "5$1");

          const numMatch = cleaned.match(/(\d+[\d.,]*)/);
          if (numMatch) {
            cleaned = numMatch[1];
          }
          if (cleaned.match(/^[\d.,]+$/) && cleaned.length > 0) {
            numbers.push({ idx: i, val: cleaned, original: part });
          }
        }

        if (numbers.length >= 1 && parts.length >= 2) {
          let qty = 1;
          let unitPrice = 0;
          let itemName = "";

          if (numbers.length >= 2) {
            const firstNum = parseFloat(numbers[0].val.replace(/,/g, ""));
            const secondNum =
              numbers.length >= 2
                ? parseFloat(numbers[1].val.replace(/,/g, ""))
                : 0;
            const lastNum = parseFloat(
              numbers[numbers.length - 1].val.replace(/,/g, "")
            );

            if (
              numbers.length >= 3 &&
              firstNum >= 1 &&
              firstNum <= 100 &&
              secondNum > firstNum
            ) {
              qty = parseInt(numbers[0].val) || 1;
              unitPrice = secondNum;
              itemName = parts.slice(0, numbers[0].idx).join(" ").trim();
            } else if (firstNum <= 100 && lastNum > firstNum) {
              qty = parseInt(numbers[0].val) || 1;
              if (numbers.length >= 3) {
                unitPrice =
                  parseFloat(
                    numbers[numbers.length - 2].val.replace(/,/g, "")
                  ) || 0;
              } else {
                unitPrice = lastNum;
              }
              itemName = parts.slice(0, numbers[0].idx).join(" ").trim();

              if (!itemName && numbers.length >= 2) {
                itemName = parts
                  .slice(numbers[0].idx + 1, numbers[1].idx)
                  .join(" ")
                  .trim();
              }
            } else {
              if (numbers.length >= 2) {
                unitPrice =
                  parseFloat(
                    numbers[numbers.length - 2].val.replace(/,/g, "")
                  ) ||
                  parseFloat(numbers[numbers.length - 1].val.replace(/,/g, ""));
              } else {
                unitPrice = lastNum || firstNum;
              }
              itemName = parts.slice(0, numbers[0].idx).join(" ").trim();
            }
          } else {
            unitPrice = parseFloat(numbers[0].val.replace(/,/g, "")) || 0;
            itemName = parts.slice(0, numbers[0].idx).join(" ").trim();
          }

          itemName = itemName.replace(/^\d+\.?\s*/, "").trim();
          itemName = itemName.replace(/^[а-яА-ЯѐёЀЁ\s]+/, "").trim();

          if (
            itemName.length > 1 &&
            unitPrice > 0 &&
            !itemName.match(/total|subtotal|tax|amount|due|invoice|company/i)
          ) {
            items.push({
              name: itemName,
              qty: qty,
              unitPrice: unitPrice,
              vat: 0,
            });
          }
        }
      }
    }

    if (items.length === 0) {
      console.log("[API OCR] No items in tableLines, searching all lines");

      for (const line of lines) {
        if (
          line.match(
            /Бр\.|ОПИС|КОЛ|Артикол|Вкупно|За плаќање|Издавање|Доспевање|Фактура|купувач|Добавувач|Налог|Намена|Датум|Бројот|Редослед/i
          )
        )
          continue;
        if (
          line.length < 5 ||
          line.match(/^[\d\s\.\,\-]+$/) ||
          line.match(/@|http|com|Tel|Phone/i)
        )
          continue;

        if (line.match(/^[\d]+[\.]?/)) {
          const denParts = line.split(/\s+ден/i);
          if (denParts.length >= 2) {
            const firstPart = denParts[0].trim();
            const parts = firstPart.split(/\s+/);

            const numbers = [];
            for (let i = 0; i < parts.length; i++) {
              if (parts[i].match(/^[\d.,]+$/)) {
                numbers.push({ idx: i, val: parts[i] });
              }
            }

            if (numbers.length >= 3) {
              const qty = parseInt(numbers[numbers.length - 2].val) || 1;
              const price =
                parseFloat(
                  numbers[numbers.length - 1].val
                    .toString()
                    .replace(/\./g, "")
                    .replace(",", ".")
                ) || 0;

              const nameStart = numbers[0].idx + 1;
              const nameEnd = numbers[numbers.length - 2].idx;
              const itemName = parts.slice(nameStart, nameEnd).join(" ").trim();

              if (itemName.length > 2 && price > 0) {
                items.push({
                  name: itemName,
                  qty: qty,
                  unitPrice: price,
                  vat: 0,
                });
              }
            }
          }

          if (items.length === 0) {
            const parts = line.split(/\s+/);
            const numericParts = [];

            for (let i = 0; i < parts.length; i++) {
              if (parts[i].match(/^[\d.,]+$/)) {
                numericParts.push({ idx: i, val: parts[i] });
              }
            }

            if (numericParts.length >= 2) {
              const lastQty =
                parseInt(numericParts[numericParts.length - 2].val) || 1;
              const lastPrice =
                parseFloat(
                  numericParts[numericParts.length - 1].val
                    .toString()
                    .replace(",", ".")
                ) || 0;
              const lastNumIdx = numericParts[numericParts.length - 1].idx;

              let itemName = parts
                .slice(1, lastNumIdx - (numericParts.length - 2))
                .join(" ")
                .trim();

              if (
                itemName.length > 2 &&
                !itemName.match(/^[\d\s\.]+$/) &&
                lastPrice > 0 &&
                lastPrice < 100000
              ) {
                items.push({
                  name: itemName,
                  qty: lastQty,
                  unitPrice: lastPrice,
                  vat: 0,
                });
              }
            }
          }
        }
      }
    }
  }

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
  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const form = formidable();

  try {
    const [files] = await form.parse(req);
    const file = files.file?.[0];

    if (!file) {
      res.status(400).json({ success: false, error: "No file uploaded" });
      return;
    }

    console.log("Uploaded file:", file);
    let text = "";

    if (file.mimetype === "application/pdf") {
      text = await extractTextFromPDF(file.filepath);
    } else if (file.mimetype?.startsWith("image/")) {
      try {
        const [engResult, mkdResult] = await Promise.all([
          Tesseract.recognize(file.filepath, "eng", {
            tessedit_pageseg_mode: "3",
            preserve_interword_spaces: "1",
          }),
          Tesseract.recognize(file.filepath, "mkd", {
            tessedit_pageseg_mode: "3",
            preserve_interword_spaces: "1",
          }),
        ]);

        const mkdText = mkdResult.data.text;
        const engText = engResult.data.text;

        const hasMkdPatterns =
          /(ден|денар|ФАКТУРА|БРОЈ|Производ|ОПИС|ЦЕНА|ИЗНОС|ВКУПНО|Добавувач|плаќање)/i.test(
            mkdText
          );

        const hasEngPatterns =
          /\b(Invoice|Description|Quantity|Price|Total|Amount|Due|Date|Bill|Payment|Subtotal)\b/i.test(
            engText
          );

        const uniqueCyrillicCount = (
          mkdText.match(/[жшщцчъьюяљњќѓџЖШЩЦЧЪЬЮЯЉЊЌЃЏ]/g) || []
        ).length;

        let result, text, confidence;

        if (engResult.data.confidence >= 80 && hasEngPatterns) {
          result = engResult;
          text = engText;
          confidence = engResult.data.confidence;
        } else if (hasMkdPatterns || uniqueCyrillicCount > 20) {
          result = mkdResult;
          text = mkdText;
          confidence = mkdResult.data.confidence;
        } else if (engResult.data.confidence > mkdResult.data.confidence + 20) {
          result = engResult;
          text = engText;
          confidence = engResult.data.confidence;
        } else if (engResult.data.confidence >= mkdResult.data.confidence) {
          result = engResult;
          text = engText;
          confidence = engResult.data.confidence;
        } else {
          result = mkdResult;
          text = mkdText;
          confidence = mkdResult.data.confidence;
        }

        console.log("[OCR] Final text:", text.substring(0, 300));

        const parsed = parseInvoiceData(text, confidence);
        res.status(200).json({
          success: true,
          data: parsed,
        });
        return;
      } catch (error) {
        console.error("Handler error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    }
  } catch (error) {
    console.error("Formidable parse error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
