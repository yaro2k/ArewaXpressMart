import { AppError } from '../../../shared/domain/AppError.js';
import type { CartRepository } from '../domain/CartRepository.js';

export class CartService {
  constructor(private readonly repository: CartRepository) {}

  getCart(userId: string) { return this.repository.getOrCreateCart(userId); }
  addItem(userId: string, input: { productVariantId: string; quantity: number }) { return this.repository.addItem(userId, input); }
  async updateItem(userId: string, cartItemId: string, quantity: number) { await this.assertItemOwner(userId, cartItemId); return this.repository.updateItem(cartItemId, quantity); }
  async deleteItem(userId: string, cartItemId: string) { await this.assertItemOwner(userId, cartItemId); return this.repository.deleteItem(cartItemId); }

  private async assertItemOwner(userId: string, cartItemId: string): Promise<void> {
    const item = await this.repository.findCartItemOwner(cartItemId);
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Cart item not found.');
    if (item.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You do not own this cart item.');
  }
}
