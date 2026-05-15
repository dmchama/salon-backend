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
}
