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
