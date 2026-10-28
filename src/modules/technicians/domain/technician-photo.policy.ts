import { DomainException } from '../../../common/exceptions/domain.exception';

/** Team member photo rules (spec 005 BR2). The browser resizes photos before upload. */
export const PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const PHOTO_MAX_BYTES = 1024 * 1024;

export function assertValidPhoto(mimetype: string, sizeBytes: number): void {
  if (!(PHOTO_MIME_TYPES as readonly string[]).includes(mimetype)) {
    throw new DomainException(
      'INVALID_IMAGE_FILE',
      'Photo must be a JPG, PNG or WEBP image',
      400,
    );
  }
  if (sizeBytes <= 0 || sizeBytes > PHOTO_MAX_BYTES) {
    throw new DomainException(
      'INVALID_IMAGE_FILE',
      'Photo must be at most 1 MB',
      400,
    );
  }
}
