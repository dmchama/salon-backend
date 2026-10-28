import { assertValidPhoto, PHOTO_MAX_BYTES } from './technician-photo.policy';

describe('assertValidPhoto (spec 005 BR2)', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', (mime) => {
    expect(() => assertValidPhoto(mime, 1000)).not.toThrow();
  });

  it.each(['image/gif', 'image/heic', 'application/pdf', ''])(
    'rejects %s with INVALID_IMAGE_FILE',
    (mime) => {
      expect(() => assertValidPhoto(mime, 1000)).toThrow(
        expect.objectContaining({
          code: 'INVALID_IMAGE_FILE',
          statusCode: 400,
        }),
      );
    },
  );

  it('accepts exactly 1 MB and rejects more or empty', () => {
    expect(PHOTO_MAX_BYTES).toBe(1024 * 1024);
    expect(() => assertValidPhoto('image/png', PHOTO_MAX_BYTES)).not.toThrow();
    expect(() => assertValidPhoto('image/png', PHOTO_MAX_BYTES + 1)).toThrow(
      expect.objectContaining({ code: 'INVALID_IMAGE_FILE' }),
    );
    expect(() => assertValidPhoto('image/png', 0)).toThrow(
      expect.objectContaining({ code: 'INVALID_IMAGE_FILE' }),
    );
  });
});
