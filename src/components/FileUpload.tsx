"use client";
import { useRef, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { extractInvoiceData, ExtractedInvoiceData } from "../lib/ocr.smart";

export function FileUpload({ 
  onUpload, 
  onOCRData, 
  accept = ".pdf,.jpg,.jpeg,.png" 
}: { 
  onUpload: (file: { name: string, type: string, path: string }) => void;
  onOCRData?: (data: ExtractedInvoiceData) => void;
  accept?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);
  const [extractingOCR, setExtractingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Cleanup previous preview
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }

    // Create preview
    const fileType = file.type;
    const previewUrl = URL.createObjectURL(file);
    setPreview({ url: previewUrl, type: fileType, name: file.name });

    setUploading(true);
    setError(null);

    try {
      // OCR extraction for both images and PDFs (via API)
      if (onOCRData && (fileType.startsWith('image/') || fileType === 'application/pdf')) {
        setExtractingOCR(true);
        setOcrProgress(0);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/ocr', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (data.success && data.data && Object.keys(data.data).length > 0) {
            onOCRData(data.data);
          } else if (data.error) {
            setError(data.error);
          }
        } catch (ocrError: unknown) {
          console.warn('OCR extraction failed:', ocrError);
        } finally {
          setExtractingOCR(false);
          setOcrProgress(0);
        }
      }

      if (!supabase) {
        throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.');
      }
      const filePath = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;
      onUpload({ name: file.name, type: file.type, path: filePath });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreview(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input ref={inputRef} type="file" accept={accept} onChange={handleFileChange} className="border rounded px-3 py-2" />
      {extractingOCR && (
        <div className="flex items-center gap-2">
          <span className="text-blue-600">Extracting data from image...</span>
          <div className="flex-1 bg-zinc-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${ocrProgress}%` }}></div>
          </div>
        </div>
      )}
      {uploading && !extractingOCR && <span className="text-blue-600">Uploading...</span>}
      {error && <span className="text-red-600">{error}</span>}
      {preview && !uploading && (
        <div className="mt-2 border rounded p-2">
          <p className="text-sm font-medium mb-2">{preview.name}</p>
          {preview.type.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt="Preview" className="max-w-full max-h-48 rounded" />
          ) : preview.type === 'application/pdf' ? (
            <iframe src={preview.url} className="w-full h-64 rounded border" title="PDF Preview" />
          ) : (
            <div className="p-4 bg-zinc-100 rounded text-center">
              <p className="text-sm text-zinc-600">Preview not available for this file type</p>
              <a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm mt-2 inline-block">
                Open file
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
