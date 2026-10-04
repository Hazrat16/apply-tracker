import { extractText, getDocumentProxy } from 'unpdf';

/** Enough for any real resume; keeps prompts for AI matching bounded. */
const MAX_TEXT_LENGTH = 100_000;

export class PdfReadError extends Error {
  constructor(
    readonly reason: 'not_pdf' | 'encrypted' | 'unreadable',
    message: string,
  ) {
    super(message);
  }
}

/** Every PDF starts with this header (some tools put a few junk bytes in front). */
export function looksLikePdf(data: Uint8Array): boolean {
  return Buffer.from(data.subarray(0, 1024)).includes('%PDF-');
}

/** Plain text and page count of a PDF. Scanned PDFs without a text layer give empty text. */
export async function extractPdfText(data: Uint8Array): Promise<{ text: string; pages: number }> {
  if (!looksLikePdf(data)) throw new PdfReadError('not_pdf', 'This file is not a PDF');

  let pdf;
  try {
    // pdf.js takes ownership of the buffer it is given, so hand it a copy.
    pdf = await getDocumentProxy(new Uint8Array(data));
  } catch (error) {
    if ((error as Error).name === 'PasswordException') {
      throw new PdfReadError(
        'encrypted',
        'This PDF is password-protected — upload an unlocked copy',
      );
    }
    throw new PdfReadError('unreadable', 'This PDF could not be read — it may be damaged');
  }

  try {
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return { text: normalise(text).slice(0, MAX_TEXT_LENGTH), pages: totalPages };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
