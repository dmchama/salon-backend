import { DomainException } from '../../../common/exceptions/domain.exception';

/** Receipt files an owner may upload as payment proof (spec 002 BR3). */
export const RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export function assertValidReceiptFile(
  mimetype: string,
  sizeBytes: number,
): void {
  if (!(RECEIPT_MIME_TYPES as readonly string[]).includes(mimetype)) {
    throw new DomainException(
      'INVALID_RECEIPT_FILE',
      'Receipt must be a JPG, PNG, WEBP, HEIC image or a PDF',
      400,
    );
  }
  if (sizeBytes <= 0 || sizeBytes > RECEIPT_MAX_BYTES) {
    throw new DomainException(
      'INVALID_RECEIPT_FILE',
      'Receipt must be at most 5 MB',
      400,
    );
  }
}
