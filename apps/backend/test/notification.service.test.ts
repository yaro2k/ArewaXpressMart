import { describe, expect, it } from 'vitest';
import { NotificationService } from '../src/modules/notifications/application/NotificationService.js';
import type { NotificationRepository } from '../src/modules/notifications/domain/NotificationRepository.js';
const repository = (overrides: Partial<NotificationRepository> = {}): NotificationRepository => ({ listForUser: async () => [], markRead: async () => ({ id: 'n1' }), listAdmin: async () => [], retry: async () => ({ id: 'n1', status: 'QUEUED' }), ...overrides });
describe('NotificationService', () => { it('enforces recipient ownership', async () => { await expect(new NotificationService(repository({ markRead: async () => null })).markRead('u1', 'n1')).rejects.toMatchObject({ status: 404 }); }); it('delegates retry idempotency', async () => { await expect(new NotificationService(repository()).retry('n1', 'retry-key-2026-001')).resolves.toMatchObject({ status: 'QUEUED' }); }); });
