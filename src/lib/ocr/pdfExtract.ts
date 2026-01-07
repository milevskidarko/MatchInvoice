export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = (pdfParseModule as any).default || pdfParseModule;
  const data = await pdfParse(buffer);
  return data.text;
}
