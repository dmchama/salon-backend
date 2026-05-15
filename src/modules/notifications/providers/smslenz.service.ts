import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmslenzService {
  private readonly logger = new Logger(SmslenzService.name);
  private readonly userId: string;
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor(private readonly config: ConfigService) {
    this.userId = this.config.get<string>('smslenz.userId') ?? '';
    this.apiKey = this.config.get<string>('smslenz.apiKey') ?? '';
    this.senderId = this.config.get<string>('smslenz.senderId') ?? 'SMSlenzDEMO';
  }

  async sendBulkSms(contacts: string[], message: string): Promise<void> {
    if (!this.userId || !this.apiKey || contacts.length === 0) {
      this.logger.debug('SMS skipped: no credentials or empty contacts');
      return;
    }
    try {
      const res = await fetch('https://smslenz.lk/api/send-bulk-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: this.userId,
          api_key: this.apiKey,
          sender_id: this.senderId,
          contacts,
          message,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`SMS API ${res.status}: ${text}`);
      } else {
        this.logger.log(`SMS sent to ${contacts.length} recipient(s)`);
      }
    } catch (err) {
      this.logger.warn(`SMS send failed: ${(err as Error).message}`);
    }
  }
}
