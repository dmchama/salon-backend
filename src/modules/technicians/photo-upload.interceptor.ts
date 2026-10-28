import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
  Type,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Observable } from 'rxjs';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PHOTO_MAX_BYTES } from './domain/technician-photo.policy';

const MulterPhoto: Type<NestInterceptor> = FileInterceptor('photo', {
  storage: memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES, files: 1 },
});

/** Multipart field `photo` kept in memory (max 1 MB). Oversized files become `400 INVALID_IMAGE_FILE`. */
@Injectable()
export class PhotoUploadInterceptor implements NestInterceptor {
  private readonly multer = new MulterPhoto();

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    try {
      return await this.multer.intercept(context, next);
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw new DomainException(
          'INVALID_IMAGE_FILE',
          'Photo must be at most 1 MB',
          400,
        );
      }
      throw err;
    }
  }
}
