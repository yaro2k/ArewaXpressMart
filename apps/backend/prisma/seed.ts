import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const nigeriaStates = [
  ['AB', 'Abia', 'Umuahia'], ['AD', 'Adamawa', 'Yola'], ['AK', 'Akwa Ibom', 'Uyo'], ['AN', 'Anambra', 'Awka'], ['BA', 'Bauchi', 'Bauchi'], ['BY', 'Bayelsa', 'Yenagoa'], ['BE', 'Benue', 'Makurdi'], ['BO', 'Borno', 'Maiduguri'], ['CR', 'Cross River', 'Calabar'], ['DE', 'Delta', 'Asaba'], ['EB', 'Ebonyi', 'Abakaliki'], ['ED', 'Edo', 'Benin City'], ['EK', 'Ekiti', 'Ado-Ekiti'], ['EN', 'Enugu', 'Enugu'], ['GO', 'Gombe', 'Gombe'], ['IM', 'Imo', 'Owerri'], ['JI', 'Jigawa', 'Dutse'], ['KD', 'Kaduna', 'Kaduna'], ['KN', 'Kano', 'Kano'], ['KT', 'Katsina', 'Katsina'], ['KE', 'Kebbi', 'Birnin Kebbi'], ['KO', 'Kogi', 'Lokoja'], ['KW', 'Kwara', 'Ilorin'], ['LA', 'Lagos', 'Ikeja'], ['NA', 'Nasarawa', 'Lafia'], ['NI', 'Niger', 'Minna'], ['OG', 'Ogun', 'Abeokuta'], ['ON', 'Ondo', 'Akure'], ['OS', 'Osun', 'Osogbo'], ['OY', 'Oyo', 'Ibadan'], ['PL', 'Plateau', 'Jos'], ['RI', 'Rivers', 'Port Harcourt'], ['SO', 'Sokoto', 'Sokoto'], ['TA', 'Taraba', 'Jalingo'], ['YO', 'Yobe', 'Damaturu'], ['ZA', 'Zamfara', 'Gusau'], ['FC', 'Federal Capital Territory', 'Abuja'],
] as const;
const categories = [
  { name: 'Electronics', slug: 'electronics', children: ['Phones & Tablets', 'Computers & Accessories', 'Home Electronics'] },
  { name: 'Fashion', slug: 'fashion', children: ['Clothing', 'Shoes', 'Bags & Accessories'] },
  { name: 'Home & Kitchen', slug: 'home-kitchen', children: ['Furniture', 'Kitchen Appliances', 'Home Decor'] },
  { name: 'Beauty & Personal Care', slug: 'beauty-personal-care', children: ['Skincare', 'Hair Care', 'Fragrances'] },
  { name: 'Groceries', slug: 'groceries', children: ['Food Cupboard', 'Beverages'] },
  { name: 'Agriculture', slug: 'agriculture', children: ['Farm Produce', 'Farm Supplies'] },
  { name: 'Automotive', slug: 'automotive', children: ['Car Accessories', 'Motorcycle Accessories'] },
  { name: 'Books & Stationery', slug: 'books-stationery', children: ['Books', 'Office Supplies'] },
] as const;
const brands = [
  ['Generic', 'generic', 'Unbranded or locally sourced products'], ['Arewa Select', 'arewa-select', 'Development reference brand'], ['Samsung', 'samsung', null], ['Tecno', 'tecno', null], ['Infinix', 'infinix', null], ['Nike', 'nike', null], ['Zara', 'zara', null],
] as const;

async function seedReferenceData(): Promise<void> {
  await prisma.userStatus.createMany({ data: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.role.createMany({ data: [{ code: 'CUSTOMER', name: 'Customer' }, { code: 'SELLER', name: 'Seller' }, { code: 'ADMIN', name: 'Administrator' }], skipDuplicates: true });
  const permissionCodes = ['user:read:any', 'user:manage', 'role:assign', 'seller:review', 'catalog:manage', 'product:moderate', 'order:read:any', 'order:manage:any', 'audit:read', 'invoice:read:any', 'invoice:issue', 'return:manage', 'refund:create', 'notification:manage', 'report:read', 'metrics:read', 'shipping:manage'];
  await prisma.permission.createMany({ data: permissionCodes.map((code) => ({ code })), skipDuplicates: true });
  const admin = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const adminPermissions = await prisma.permission.findMany({ where: { code: { in: permissionCodes } }, select: { id: true } });
  await prisma.rolePermission.createMany({ data: adminPermissions.map(({ id }) => ({ roleId: admin.id, permissionId: id })), skipDuplicates: true });
  await prisma.sellerVerificationStatus.createMany({ data: ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.storeStatus.createMany({ data: ['DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.productStatus.createMany({ data: ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'ARCHIVED', 'REJECTED'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.orderStatus.createMany({ data: ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.orderAddressType.createMany({ data: ['SHIPPING', 'BILLING'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.paymentProvider.createMany({ data: [{ code: 'PAYSTACK', name: 'Paystack' }, { code: 'STRIPE', name: 'Stripe' }], skipDuplicates: true });
  await prisma.paymentStatus.createMany({ data: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.inventoryMovementType.createMany({ data: ['RECEIVE', 'ADJUSTMENT', 'RESERVE', 'RELEASE', 'SALE', 'RETURN'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.shipmentStatus.createMany({ data: ['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.returnStatus.createMany({ data: ['REQUESTED', 'APPROVED', 'RECEIVED', 'REJECTED', 'CLOSED'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.returnReason.createMany({ data: [{ code: 'DAMAGED', description: 'Item arrived damaged' }, { code: 'WRONG_ITEM', description: 'Wrong item received' }, { code: 'NOT_AS_DESCRIBED', description: 'Item differs from listing' }], skipDuplicates: true });
  await prisma.refundStatus.createMany({ data: ['REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.invoiceStatus.createMany({ data: ['DRAFT', 'ISSUED', 'VOID', 'PAID'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.notificationChannel.createMany({ data: ['EMAIL', 'SMS', 'PUSH', 'IN_APP'].map((code) => ({ code })), skipDuplicates: true });
  await prisma.notificationStatus.createMany({ data: ['QUEUED', 'SENDING', 'SENT', 'FAILED'].map((code) => ({ code })), skipDuplicates: true });

  const country = await prisma.country.upsert({ where: { iso2: 'NG' }, update: { name: 'Nigeria', phoneCode: '+234' }, create: { iso2: 'NG', name: 'Nigeria', phoneCode: '+234' } });
  for (const [code, name, capital] of nigeriaStates) {
    const state = await prisma.stateProvince.upsert({ where: { countryId_code: { countryId: country.id, code } }, update: { name }, create: { countryId: country.id, code, name } });
    await prisma.city.upsert({ where: { stateProvinceId_name: { stateProvinceId: state.id, name: capital } }, update: {}, create: { stateProvinceId: state.id, name: capital } });
    if (code === 'KN') await prisma.city.upsert({ where: { stateProvinceId_name: { stateProvinceId: state.id, name: 'Wudil' } }, update: {}, create: { stateProvinceId: state.id, name: 'Wudil' } });
    if (code === 'FC') await prisma.city.upsert({ where: { stateProvinceId_name: { stateProvinceId: state.id, name: 'Gwagwalada' } }, update: {}, create: { stateProvinceId: state.id, name: 'Gwagwalada' } });
  }
  for (const category of categories) {
    const parent = await prisma.category.upsert({ where: { slug: category.slug }, update: { name: category.name, isActive: true, parentCategoryId: null }, create: { name: category.name, slug: category.slug } });
    for (const childName of category.children) { const childSlug = `${category.slug}-${childName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; await prisma.category.upsert({ where: { slug: childSlug }, update: { name: childName, parentCategoryId: parent.id, isActive: true }, create: { name: childName, slug: childSlug, parentCategoryId: parent.id } }); }
  }
  for (const [name, slug, description] of brands) await prisma.brand.upsert({ where: { slug }, update: { name, description }, create: { name, slug, description } });
  const carriers = [{ name: 'Arewa Local Delivery', methods: [{ code: 'STANDARD', name: 'Standard delivery', serviceLevel: '3-7 business days' }, { code: 'EXPRESS', name: 'Express delivery', serviceLevel: '1-3 business days' }] }, { name: 'DHL', methods: [{ code: 'EXPRESS', name: 'DHL Express', serviceLevel: 'International express' }] }];
  for (const carrierInput of carriers) { const carrier = await prisma.shippingCarrier.upsert({ where: { name: carrierInput.name }, update: {}, create: { name: carrierInput.name } }); for (const method of carrierInput.methods) await prisma.shippingMethod.upsert({ where: { carrierId_code: { carrierId: carrier.id, code: method.code } }, update: { name: method.name, serviceLevel: method.serviceLevel, isActive: true }, create: { carrierId: carrier.id, code: method.code, name: method.name, serviceLevel: method.serviceLevel } }); }
}

async function seedDevelopmentFixtures(): Promise<void> {
  if (process.env.NODE_ENV === 'production' || process.env.SEED_DEVELOPMENT_FIXTURES !== 'true') return;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD; const sellerPassword = process.env.SEED_SELLER_PASSWORD;
  if (!adminPassword || !sellerPassword) throw new Error('SEED_ADMIN_PASSWORD and SEED_SELLER_PASSWORD are required when SEED_DEVELOPMENT_FIXTURES=true.');
  if (adminPassword.length < 12 || sellerPassword.length < 12) throw new Error('Development fixture passwords must be at least 12 characters.');
  const active = await prisma.userStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } }); const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } }); const sellerRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SELLER' } });
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin.dev@arewaxpressmart.local'; const sellerEmail = process.env.SEED_SELLER_EMAIL ?? 'seller.dev@arewaxpressmart.local';
  const admin = await prisma.user.upsert({ where: { email: adminEmail }, update: { statusId: active.id, passwordHash: await bcrypt.hash(adminPassword, 12) }, create: { email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 12), firstName: 'Development', lastName: 'Admin', emailVerifiedAt: new Date(), statusId: active.id } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } }, update: {}, create: { userId: admin.id, roleId: adminRole.id } });
  const seller = await prisma.user.upsert({ where: { email: sellerEmail }, update: { statusId: active.id, passwordHash: await bcrypt.hash(sellerPassword, 12) }, create: { email: sellerEmail, passwordHash: await bcrypt.hash(sellerPassword, 12), firstName: 'Development', lastName: 'Seller', emailVerifiedAt: new Date(), statusId: active.id } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: seller.id, roleId: sellerRole.id } }, update: {}, create: { userId: seller.id, roleId: sellerRole.id } });
  const verified = await prisma.sellerVerificationStatus.findUniqueOrThrow({ where: { code: 'VERIFIED' } }); const activeStore = await prisma.storeStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } }); const profile = await prisma.sellerProfile.upsert({ where: { userId: seller.id }, update: { verificationStatusId: verified.id }, create: { userId: seller.id, legalName: 'Development Seller Ltd', verificationStatusId: verified.id } });
  const store = await prisma.store.upsert({ where: { slug: 'development-market' }, update: { sellerProfileId: profile.id, statusId: activeStore.id }, create: { sellerProfileId: profile.id, slug: 'development-market', displayName: 'Development Market', statusId: activeStore.id } });
  const warehouse = await prisma.warehouse.upsert({ where: { storeId_code: { storeId: store.id, code: 'DEV-01' } }, update: { isActive: true }, create: { storeId: store.id, code: 'DEV-01', name: 'Development Warehouse' } });
  const brand = await prisma.brand.findUniqueOrThrow({ where: { slug: 'arewa-select' } }); const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'home-kitchen' } }); const productStatus = await prisma.productStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } });
  const product = await prisma.product.upsert({ where: { slug: 'development-handcrafted-basket' }, update: { statusId: productStatus.id, storeId: store.id, brandId: brand.id }, create: { storeId: store.id, brandId: brand.id, name: 'Development Handcrafted Basket', slug: 'development-handcrafted-basket', description: 'A deterministic development fixture product.', statusId: productStatus.id } });
  await prisma.productCategory.upsert({ where: { productId_categoryId: { productId: product.id, categoryId: category.id } }, update: {}, create: { productId: product.id, categoryId: category.id } });
  const variant = await prisma.productVariant.upsert({ where: { sku: 'DEV-BASKET-001' }, update: { productId: product.id, isActive: true }, create: { productId: product.id, sku: 'DEV-BASKET-001', isActive: true } });
  const existingPrice = await prisma.productVariantPrice.findFirst({ where: { productVariantId: variant.id, endsAt: null } }); if (!existingPrice) await prisma.productVariantPrice.create({ data: { productVariantId: variant.id, currency: 'NGN', amountMinor: 250000n } });
  await prisma.inventory.upsert({ where: { warehouseId_productVariantId: { warehouseId: warehouse.id, productVariantId: variant.id } }, update: {}, create: { warehouseId: warehouse.id, productVariantId: variant.id, onHandQty: 100 } });
  // Development-only fixture: production rates are maintained through the protected shipping configuration API.
  const kano = await prisma.city.findFirstOrThrow({ where: { name: 'Kano', stateProvince: { code: 'KN' } } }); const local = await prisma.shippingCarrier.findUniqueOrThrow({ where: { name: 'Arewa Local Delivery' } }); const standard = await prisma.shippingMethod.findUniqueOrThrow({ where: { carrierId_code: { carrierId: local.id, code: 'STANDARD' } } });
  await prisma.shippingRate.upsert({ where: { storeId_shippingMethodId_cityId: { storeId: store.id, shippingMethodId: standard.id, cityId: kano.id } }, update: { amountMinor: 150000n, currency: 'NGN', isActive: true }, create: { storeId: store.id, shippingMethodId: standard.id, cityId: kano.id, amountMinor: 150000n, currency: 'NGN' } });
}

async function main(): Promise<void> { await seedReferenceData(); await seedDevelopmentFixtures(); }
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Seed failed.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
