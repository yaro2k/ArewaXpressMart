import type { CartOwner, CartRepository } from '../domain/CartRepository.js';

export class CartService {
  constructor(private readonly repository: CartRepository) {}

  getCart(owner: CartOwner) { return this.repository.getCart(owner); }
  addItem(owner: CartOwner, input: { productVariantId: string; quantity: number; expiresAt?: Date }) { return this.repository.addItem(owner, input); }
  updateItem(owner: CartOwner, cartItemId: string, quantity: number) { return this.repository.updateItem(owner, cartItemId, quantity); }
  deleteItem(owner: CartOwner, cartItemId: string) { return this.repository.deleteItem(owner, cartItemId); }
  mergeAnonymousCart(userId: string, anonymousTokenHash?: string) { return this.repository.mergeAnonymousCart(userId, anonymousTokenHash); }
}
