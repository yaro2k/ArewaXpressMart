export interface NotificationRepository {
  listForUser(userId: string): Promise<unknown[]>;
  markRead(userId: string, notificationId: string): Promise<unknown | null>;
  listAdmin(): Promise<unknown[]>;
  retry(notificationId: string, idempotencyKey: string): Promise<unknown>;
}
