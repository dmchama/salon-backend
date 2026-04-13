export const NOTIFICATIONS_QUEUE = 'notifications';

export enum NotificationJobName {
  BookingCreated = 'booking.created',
  BookingStatusUpdated = 'booking.status_updated',
  SubscriptionExpiring = 'subscription.expiring',
}
