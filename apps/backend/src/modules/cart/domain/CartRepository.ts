export type CartOwner = { kind: 'authenticated'; userId: string } | { kind: 'anonymous'; tokenHash: string };

export interface CartRepository {
  getCart(owner: CartOwner): Promise<unknown>;
  addItem(owner: CartOwner, input: { productVariantId: string; quantity: number; expiresAt?: Date }): Promise<unknown>;
  updateItem(owner: CartOwner, cartItemId: string, quantity: number): Promise<unknown>;
  deleteItem(owner: CartOwner, cartItemId: string): Promise<void>;
  mergeAnonymousCart(userId: string, anonymousTokenHash?: string): Promise<unknown>;
}
