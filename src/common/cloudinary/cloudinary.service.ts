import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('cloudinary.cloudName'),
      api_key: this.config.get<string>('cloudinary.apiKey'),
      api_secret: this.config.get<string>('cloudinary.apiSecret'),
    });
  }

  uploadImage(buffer: Buffer, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder, resource_type: 'image' }, (err, result: UploadApiResponse | undefined) => {
          if (err) return reject(err);
          resolve(result!.secure_url);
        })
        .end(buffer);
    });
  }

  /**
   * Upload a private ("authenticated") asset, e.g. a payment receipt. It can only be viewed
   * through a signed URL from `signedReceiptUrl`. PDFs and HEIC are image resources on Cloudinary.
   */
  uploadPrivate(buffer: Buffer, folder: string): Promise<{ publicId: string; format: string }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder, resource_type: 'image', type: 'authenticated' },
          (err, result: UploadApiResponse | undefined) => {
            if (err || !result) return reject(err ?? new Error('Empty Cloudinary response'));
            resolve({ publicId: result.public_id, format: result.format });
          },
        )
        .end(buffer);
    });
  }

  /** Short-lived signed URL for a private asset. HEIC/HEIF is delivered as JPG so browsers can show it. */
  signedReceiptUrl(publicId: string, format: string, ttlSec = 600): string {
    const deliveryFormat = format === 'heic' || format === 'heif' ? 'jpg' : format;
    return cloudinary.utils.private_download_url(publicId, deliveryFormat, {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + ttlSec,
    });
  }

  /** Delete a private asset. Silently ignores failures (used for cleanup only). */
  async deleteAuthenticated(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image', type: 'authenticated' });
    } catch {
      // Non-fatal — orphaned asset stays on Cloudinary
    }
  }

  /** Extract public_id from a Cloudinary secure_url and delete the asset. Silently ignores failures. */
  async deleteByUrl(url: string): Promise<void> {
    try {
      // URL format: https://res.cloudinary.com/<cloud>/image/upload/v<ver>/<public_id>.<ext>
      const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
      if (!match) return;
      await cloudinary.uploader.destroy(match[1], { resource_type: 'image' });
    } catch {
      // Non-fatal — old asset stays on Cloudinary but doesn't break the upload
    }
  }
}
