export interface CartItemOwner { userId: string; }

export interface CartRepository {
  getOrCreateCart(userId: string): Promise<unknown>;
  addItem(userId: string, input: { productVariantId: string; quantity: number }): Promise<unknown>;
  findCartItemOwner(cartItemId: string): Promise<CartItemOwner | null>;
  updateItem(cartItemId: string, quantity: number): Promise<unknown>;
  deleteItem(cartItemId: string): Promise<void>;
}
