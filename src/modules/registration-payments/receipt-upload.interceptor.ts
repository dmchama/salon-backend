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
import { RECEIPT_MAX_BYTES } from './domain/receipt-file.policy';

const MulterReceipt: Type<NestInterceptor> = FileInterceptor('receipt', {
  storage: memoryStorage(),
  limits: { fileSize: RECEIPT_MAX_BYTES, files: 1 },
});

/**
 * Accepts an optional multipart file field `receipt` (kept in memory, max 5 MB).
 * JSON requests pass through untouched. Oversized files become `400 INVALID_RECEIPT_FILE`.
 */
@Injectable()
export class ReceiptUploadInterceptor implements NestInterceptor {
  private readonly multer = new MulterReceipt();

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    try {
      return await this.multer.intercept(context, next);
    } catch (err) {
      if (err instanceof PayloadTooLargeException) {
        throw new DomainException(
          'INVALID_RECEIPT_FILE',
          'Receipt must be at most 5 MB',
          400,
        );
      }
      throw err;
    }
  }
}
