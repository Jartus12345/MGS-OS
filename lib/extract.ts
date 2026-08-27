import mammoth from "mammoth";

const TEXT_EXTENSIONS = [".txt", ".md", ".csv"];

export async function extractTextFromFile(
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return buffer.toString("utf-8");
  }

  // Fall back to treating unknown types as plain text rather than
  // silently dropping the upload.
  return buffer.toString("utf-8");
}
