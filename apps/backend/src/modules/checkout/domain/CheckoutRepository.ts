export interface CheckoutRepository {
  listCountries(): Promise<unknown[]>;
  listStates(countryId?: string): Promise<unknown[]>;
  listCities(stateProvinceId?: string): Promise<unknown[]>;
  listAddresses(userId: string): Promise<unknown[]>;
  createAddress(userId: string, input: AddressInput): Promise<unknown>;
  findAddressOwner(addressId: string): Promise<{ userId: string } | null>;
  updateAddress(addressId: string, input: Partial<AddressInput>): Promise<unknown>;
  deleteAddress(addressId: string): Promise<void>;
  quote(userId: string, input: CheckoutInput): Promise<unknown>;
  findOrderByIdempotencyKey(userId: string, idempotencyKey: string): Promise<unknown | null>;
  placeOrder(userId: string, input: CheckoutInput & { idempotencyKey: string }): Promise<unknown>;
}

export interface AddressInput {
  recipientName: string;
  phoneE164: string;
  line1: string;
  line2?: string | null;
  cityId: string;
  postalCode?: string | null;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

export interface CheckoutInput { shippingAddressId: string; billingAddressId?: string; }
