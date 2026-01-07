// OCR extraction logic with confidence per field will be implemented here.

export interface OcrField<T = string> {
  value: T;
  confidence: number;
}

export interface ExtractedInvoiceData {
  invoiceNumber?: OcrField;
  invoiceDate?: OcrField;
  dueDate?: OcrField;
  supplier?: OcrField;
  currency?: OcrField;
  items?: Array<{
    name: OcrField;
    qty: OcrField<number>;
    unitPrice: OcrField<number>;
    vat: OcrField<number>;
  }>;
}

// TODO: Implement OCR extraction and confidence calculation
