import { makePdf } from '../../test/fixtures/make-pdf.js';
import { extractPdfText, looksLikePdf, PdfReadError } from './pdf-text.js';

describe('extractPdfText', () => {
  it('returns the text and page count', async () => {
    const pdf = makePdf(['Jane Doe\nSenior Engineer', 'Skills: TypeScript, PostgreSQL']);
    const result = await extractPdfText(pdf);
    expect(result.pages).toBe(2);
    expect(result.text).toContain('Jane Doe');
    expect(result.text).toContain('Skills: TypeScript, PostgreSQL');
  });

  it('leaves the input buffer usable', async () => {
    const pdf = makePdf(['Hello']);
    await extractPdfText(pdf);
    expect(looksLikePdf(pdf)).toBe(true);
  });

  it('gives empty text for a page without a text layer', async () => {
    const result = await extractPdfText(makePdf(['']));
    expect(result).toEqual({ text: '', pages: 1 });
  });

  it('rejects files that are not PDFs', async () => {
    await expect(extractPdfText(Buffer.from('<html>not a pdf</html>'))).rejects.toMatchObject({
      reason: 'not_pdf',
    });
  });

  it('rejects damaged PDFs', async () => {
    const error = await extractPdfText(Buffer.from('%PDF-1.4\ngarbage')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PdfReadError);
    expect(error).toMatchObject({ reason: 'unreadable' });
  });
});
