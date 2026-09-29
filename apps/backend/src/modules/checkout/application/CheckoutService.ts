import { AppError } from '../../../shared/domain/AppError.js';
import type { AddressInput, CheckoutInput, CheckoutRepository } from '../domain/CheckoutRepository.js';

export class CheckoutService {
  constructor(private readonly repository: CheckoutRepository) {}
  listCountries() { return this.repository.listCountries(); }
  listStates(countryId?: string) { return this.repository.listStates(countryId); }
  listCities(stateProvinceId?: string) { return this.repository.listCities(stateProvinceId); }
  listAddresses(userId: string) { return this.repository.listAddresses(userId); }
  createAddress(userId: string, input: AddressInput) { return this.repository.createAddress(userId, input); }
  async updateAddress(userId: string, addressId: string, input: Partial<AddressInput>) { await this.assertAddressOwner(userId, addressId); return this.repository.updateAddress(addressId, input); }
  async deleteAddress(userId: string, addressId: string) { await this.assertAddressOwner(userId, addressId); return this.repository.deleteAddress(addressId); }
  quote(userId: string, input: CheckoutInput) { return this.repository.quote(userId, input); }
  async checkout(userId: string, input: CheckoutInput, idempotencyKey: string) {
    const existing = await this.repository.findOrderByIdempotencyKey(userId, idempotencyKey);
    return existing ?? this.repository.placeOrder(userId, { ...input, idempotencyKey });
  }

  private async assertAddressOwner(userId: string, addressId: string): Promise<void> {
    const address = await this.repository.findAddressOwner(addressId);
    if (!address) throw new AppError(404, 'NOT_FOUND', 'Address not found.');
    if (address.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You do not own this address.');
  }
}
