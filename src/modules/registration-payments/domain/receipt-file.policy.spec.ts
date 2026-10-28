import {
  assertValidReceiptFile,
  RECEIPT_MAX_BYTES,
  RECEIPT_MIME_TYPES,
} from './receipt-file.policy';

describe('assertValidReceiptFile (BR3)', () => {
  it.each([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
  ])('accepts %s', (mime) => {
    expect(() => assertValidReceiptFile(mime, 1000)).not.toThrow();
  });

  it.each(['image/gif', 'text/plain', 'application/zip', ''])(
    'rejects %s with INVALID_RECEIPT_FILE',
    (mime) => {
      expect(() => assertValidReceiptFile(mime, 1000)).toThrow(
        expect.objectContaining({
          code: 'INVALID_RECEIPT_FILE',
          statusCode: 400,
        }),
      );
    },
  );

  it('accepts exactly 5 MB and rejects one byte more', () => {
    expect(RECEIPT_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(() =>
      assertValidReceiptFile('image/png', RECEIPT_MAX_BYTES),
    ).not.toThrow();
    expect(() =>
      assertValidReceiptFile('image/png', RECEIPT_MAX_BYTES + 1),
    ).toThrow(expect.objectContaining({ code: 'INVALID_RECEIPT_FILE' }));
  });

  it('rejects an empty file', () => {
    expect(() => assertValidReceiptFile('image/png', 0)).toThrow(
      expect.objectContaining({ code: 'INVALID_RECEIPT_FILE' }),
    );
  });

  it('exposes the allowed MIME list', () => {
    expect(RECEIPT_MIME_TYPES).toContain('application/pdf');
  });
});
