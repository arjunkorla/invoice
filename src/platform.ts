/**
 * Browser helpers for exported documents. Everything runs locally in the
 * browser — nothing is uploaded.
 */

export interface SavedFile {
  fileName: string;
  mimeType: string;
  /** Human-readable location, e.g. "your browser's downloads". */
  location: string;
}

export const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

/** Hand a generated document to the browser as a download. */
export async function saveDocument(
  blob: Blob,
  fileName: string,
  mimeType: string,
): Promise<SavedFile> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return { fileName, mimeType, location: "your browser's downloads" };
}

/** Print the currently rendered page (print CSS shows only the invoice). */
export function printPage() {
  window.print();
}

/**
 * Convert any uploaded logo (PNG/JPG/WebP/SVG…) into a PNG data URL so both
 * jsPDF and docx can embed it. Returns null if the image cannot be decoded.
 */
export async function logoAsPng(
  dataUrl?: string,
): Promise<{ dataUrl: string; bytes: Uint8Array; width: number; height: number } | null> {
  if (!dataUrl) return null;
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const scale = Math.min(1, 600 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || 300) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 300) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    const png = canvas.toDataURL("image/png");
    const binary = atob(png.split(",")[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { dataUrl: png, bytes, width, height };
  } catch {
    return null;
  }
}
