export const EMAIL_CHANNEL = 'EMAIL_CHANNEL';
export const SMS_CHANNEL = 'SMS_CHANNEL';
export const WHATSAPP_CHANNEL = 'WHATSAPP_CHANNEL';

export type NotificationContext = {
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export interface EmailNotificationProvider {
  send(to: string, ctx: NotificationContext): Promise<void>;
}

export interface SmsNotificationProvider {
  send(toPhone: string, ctx: NotificationContext): Promise<void>;
}

export interface WhatsAppNotificationProvider {
  send(toPhone: string, ctx: NotificationContext): Promise<void>;
}
