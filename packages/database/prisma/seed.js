"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('--- Starting Database Seeder ---');
    // 1. Clean existing records if any
    await prisma.providerRequestLog.deleteMany();
    await prisma.orderStatusHistory.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.order.deleteMany();
    await prisma.providerProductMapping.deleteMany();
    await prisma.productPackage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.game.deleteMany();
    await prisma.category.deleteMany();
    await prisma.provider.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.session.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.supportTicket.deleteMany();
    await prisma.coupon.deleteMany();
    await prisma.user.deleteMany();
    // 2. Create Users
    const passwordHash = await bcrypt.hash('Admin@123456', 10);
    const customerPasswordHash = await bcrypt.hash('Customer@123456', 10);
    const superAdmin = await prisma.user.create({
        data: {
            email: 'admin@digitaltopup.com',
            phone: '+9647700000001',
            fullName: 'Super Administrator',
            passwordHash: passwordHash,
            role: client_1.UserRole.SUPER_ADMIN,
            isVerified: true,
            wallet: {
                create: {
                    currency: 'USD',
                    balance: 0,
                },
            },
        },
        include: { wallet: true },
    });
    const financeOfficer = await prisma.user.create({
        data: {
            email: 'finance@digitaltopup.com',
            phone: '+9647700000002',
            fullName: 'Chief Financial Officer',
            passwordHash: passwordHash,
            role: client_1.UserRole.FINANCIAL_OFFICER,
            isVerified: true,
            wallet: {
                create: {
                    currency: 'USD',
                    balance: 0,
                },
            },
        },
        include: { wallet: true },
    });
    const testCustomer = await prisma.user.create({
        data: {
            email: 'customer@gmail.com',
            phone: '+9647700000003',
            fullName: 'Ahmed Mohammed (Test Gamer)',
            passwordHash: customerPasswordHash,
            role: client_1.UserRole.CUSTOMER,
            isVerified: true,
            wallet: {
                create: {
                    currency: 'USD',
                    balance: 100.0, // Seed with $100 for testing
                },
            },
        },
        include: { wallet: true },
    });
    // 3. Create initial Ledger Entry for Customer's initial balance
    if (testCustomer.wallet) {
        await prisma.ledgerEntry.create({
            data: {
                walletId: testCustomer.wallet.id,
                userId: testCustomer.id,
                type: client_1.LedgerEntryType.DEPOSIT,
                amount: 100.0,
                balanceAfter: 100.0,
                currency: 'USD',
                referenceType: 'INITIAL_SEED',
                referenceId: 'SEED-DEPOSIT-001',
                idempotencyKey: 'SEED-IDEMPOTENCY-001',
                notes: 'Initial test balance credited during database seeding',
                performedByUserId: superAdmin.id,
            },
        });
    }
    // 4. Create Categories
    const gamesCategory = await prisma.category.create({
        data: {
            slug: 'mobile-games',
            name: 'Mobile Games Direct TopUp',
            nameAr: 'شحن ألعاب الموبايل المباشر',
            icon: 'gamepad-2',
            displayOrder: 1,
        },
    });
    const cardsCategory = await prisma.category.create({
        data: {
            slug: 'gift-cards',
            name: 'Digital Gift Cards & Vouchers',
            nameAr: 'بطاقات الهدايا والقسائم الرقمية',
            icon: 'credit-card',
            displayOrder: 2,
        },
    });
    // 5. Create Providers
    const mockProvider = await prisma.provider.create({
        data: {
            code: 'MOCK',
            name: 'Simulated Topup Provider (Demo Mode)',
            type: client_1.ProviderType.MOCK,
            baseUrl: 'http://localhost:4000/api/mock-provider',
            apiKey: 'mock-key-development-12345',
            apiSecret: 'mock-secret-development-67890',
            isActive: true,
            balance: 10000.0,
            balanceCurrency: 'USD',
            lastBalanceCheck: new Date(),
        },
    });
    await prisma.provider.create({
        data: {
            code: 'SMILE_ONE',
            name: 'Smile.one Global Gateway',
            type: client_1.ProviderType.SMILE_ONE,
            baseUrl: 'https://www.smile.one/smilecoin/api',
            isActive: false, // inactive until real credentials added
            balance: 0.0,
        },
    });
    await prisma.provider.create({
        data: {
            code: 'UNIPIN',
            name: 'UniPin Electronic Voucher API',
            type: client_1.ProviderType.UNIPIN,
            baseUrl: 'https://api.unipin.com/v1',
            isActive: false,
            balance: 0.0,
        },
    });
    // 6. Create Games & Dynamic Player Fields
    // A. PUBG Mobile
    const pubgGame = await prisma.game.create({
        data: {
            slug: 'pubg-mobile',
            name: 'PUBG Mobile',
            nameAr: 'ببجي موبايل',
            description: 'Instant PUBG Mobile Unknown Cash (UC) direct player recharge',
            descriptionAr: 'شحن شدات ببجي موبايل (UC) الفوري عبر الآيدي مباشرة',
            logoUrl: '/images/games/pubg.png',
            bannerUrl: '/images/games/pubg-banner.jpg',
            categoryId: gamesCategory.id,
            displayOrder: 1,
            playerFields: [
                {
                    key: 'player_id',
                    label: 'Player ID',
                    labelAr: 'معرف اللاعب (Player ID)',
                    type: 'text',
                    required: true,
                    validationRegex: '^[0-9]{5,15}$',
                    placeholder: 'e.g. 5123456789',
                    placeholderAr: 'مثال: 5123456789',
                    helperText: 'You can find your Player ID in your in-game profile',
                    helperTextAr: 'تجد معرف الحساب (ID) بالضغط على صورتك داخل اللعبة',
                },
            ],
        },
    });
    const pubgProduct = await prisma.product.create({
        data: {
            gameId: pubgGame.id,
            name: 'PUBG UC Direct Topup',
            nameAr: 'شحن شدات ببجي مباشر',
            type: client_1.ProductType.GAME_DIRECT_TOPUP,
        },
    });
    const pubgPackagesData = [
        { name: '60 UC', nameAr: '60 شدة', sku: 'PUBG-60-UC', amountValue: '60 UC', costPrice: 0.88, retailPrice: 1.05 },
        { name: '325 UC', nameAr: '325 شدة', sku: 'PUBG-325-UC', amountValue: '325 UC', costPrice: 4.5, retailPrice: 5.25 },
        { name: '660 UC', nameAr: '660 شدة', sku: 'PUBG-660-UC', amountValue: '660 UC', costPrice: 9.1, retailPrice: 10.49 },
        { name: '1800 UC', nameAr: '1800 شدة', sku: 'PUBG-1800-UC', amountValue: '1800 UC', costPrice: 22.5, retailPrice: 25.99 },
        { name: '3850 UC', nameAr: '3850 شدة', sku: 'PUBG-3850-UC', amountValue: '3850 UC', costPrice: 45.0, retailPrice: 51.99 },
    ];
    for (let i = 0; i < pubgPackagesData.length; i++) {
        const pkg = pubgPackagesData[i];
        const createdPkg = await prisma.productPackage.create({
            data: {
                productId: pubgProduct.id,
                name: pkg.name,
                nameAr: pkg.nameAr,
                sku: pkg.sku,
                amountValue: pkg.amountValue,
                costPrice: pkg.costPrice,
                retailPrice: pkg.retailPrice,
                displayOrder: i + 1,
            },
        });
        // Map to Mock provider
        await prisma.providerProductMapping.create({
            data: {
                providerId: mockProvider.id,
                packageId: createdPkg.id,
                providerSku: `MOCK-${pkg.sku}`,
                priority: 1,
            },
        });
    }
    // B. Free Fire
    const ffGame = await prisma.game.create({
        data: {
            slug: 'free-fire',
            name: 'Free Fire',
            nameAr: 'فري فاير',
            description: 'Top up Free Fire Diamonds directly using Player ID',
            descriptionAr: 'شحن جواهر فري فاير الفوري عبر معرف اللاعب',
            logoUrl: '/images/games/freefire.png',
            bannerUrl: '/images/games/freefire-banner.jpg',
            categoryId: gamesCategory.id,
            displayOrder: 2,
            playerFields: [
                {
                    key: 'player_id',
                    label: 'Player ID',
                    labelAr: 'معرف اللاعب (Player ID)',
                    type: 'text',
                    required: true,
                    validationRegex: '^[0-9]{6,15}$',
                    placeholder: 'e.g. 192837465',
                    placeholderAr: 'مثال: 192837465',
                    helperText: 'Your Free Fire User ID',
                    helperTextAr: 'معرف الحساب في فري فاير',
                },
            ],
        },
    });
    const ffProduct = await prisma.product.create({
        data: {
            gameId: ffGame.id,
            name: 'Free Fire Diamonds',
            nameAr: 'جواهر فري فاير',
            type: client_1.ProductType.GAME_DIRECT_TOPUP,
        },
    });
    const ffPackagesData = [
        { name: '100 Diamonds', nameAr: '100 جوهرة', sku: 'FF-100-DIA', amountValue: '100 Diamonds', costPrice: 0.90, retailPrice: 1.10 },
        { name: '310 Diamonds', nameAr: '310 جوهرة', sku: 'FF-310-DIA', amountValue: '310 Diamonds', costPrice: 2.70, retailPrice: 3.15 },
        { name: '520 Diamonds', nameAr: '520 جوهرة', sku: 'FF-520-DIA', amountValue: '520 Diamonds', costPrice: 4.50, retailPrice: 5.25 },
        { name: '1060 Diamonds', nameAr: '1060 جوهرة', sku: 'FF-1060-DIA', amountValue: '1060 Diamonds', costPrice: 9.00, retailPrice: 10.50 },
    ];
    for (let i = 0; i < ffPackagesData.length; i++) {
        const pkg = ffPackagesData[i];
        const createdPkg = await prisma.productPackage.create({
            data: {
                productId: ffProduct.id,
                name: pkg.name,
                nameAr: pkg.nameAr,
                sku: pkg.sku,
                amountValue: pkg.amountValue,
                costPrice: pkg.costPrice,
                retailPrice: pkg.retailPrice,
                displayOrder: i + 1,
            },
        });
        await prisma.providerProductMapping.create({
            data: {
                providerId: mockProvider.id,
                packageId: createdPkg.id,
                providerSku: `MOCK-${pkg.sku}`,
                priority: 1,
            },
        });
    }
    // C. Mobile Legends (Multi-field: User ID + Zone ID)
    const mlbbGame = await prisma.game.create({
        data: {
            slug: 'mobile-legends',
            name: 'Mobile Legends: Bang Bang',
            nameAr: 'موبايل ليجندز',
            description: 'Instant MLBB Diamonds delivery with Server Zone ID verification',
            descriptionAr: 'شحن فوري لماسات موبايل ليجندز مع دعم الزون والسيرفر',
            logoUrl: '/images/games/mlbb.png',
            bannerUrl: '/images/games/mlbb-banner.jpg',
            categoryId: gamesCategory.id,
            displayOrder: 3,
            playerFields: [
                {
                    key: 'player_id',
                    label: 'User ID',
                    labelAr: 'معرف المستخدم (User ID)',
                    type: 'text',
                    required: true,
                    validationRegex: '^[0-9]{5,12}$',
                    placeholder: 'e.g. 12345678',
                    placeholderAr: 'مثال: 12345678',
                },
                {
                    key: 'zone_id',
                    label: 'Zone ID',
                    labelAr: 'رمز النطاق (Zone ID)',
                    type: 'text',
                    required: true,
                    validationRegex: '^[0-9]{4,6}$',
                    placeholder: 'e.g. 2001',
                    placeholderAr: 'مثال: 2001 (بين القوسين)',
                },
            ],
        },
    });
    const mlbbProduct = await prisma.product.create({
        data: {
            gameId: mlbbGame.id,
            name: 'MLBB Diamonds Direct',
            nameAr: 'ماسات موبايل ليجندز مباشر',
            type: client_1.ProductType.GAME_DIRECT_TOPUP,
        },
    });
    const mlbbPackagesData = [
        { name: '86 Diamonds', nameAr: '86 ماسة', sku: 'MLBB-86-DIA', amountValue: '86 Diamonds', costPrice: 1.25, retailPrice: 1.49 },
        { name: '172 Diamonds', nameAr: '172 ماسة', sku: 'MLBB-172-DIA', amountValue: '172 Diamonds', costPrice: 2.50, retailPrice: 2.95 },
        { name: '257 Diamonds', nameAr: '257 ماسة', sku: 'MLBB-257-DIA', amountValue: '257 Diamonds', costPrice: 3.70, retailPrice: 4.30 },
    ];
    for (let i = 0; i < mlbbPackagesData.length; i++) {
        const pkg = mlbbPackagesData[i];
        const createdPkg = await prisma.productPackage.create({
            data: {
                productId: mlbbProduct.id,
                name: pkg.name,
                nameAr: pkg.nameAr,
                sku: pkg.sku,
                amountValue: pkg.amountValue,
                costPrice: pkg.costPrice,
                retailPrice: pkg.retailPrice,
                displayOrder: i + 1,
            },
        });
        await prisma.providerProductMapping.create({
            data: {
                providerId: mockProvider.id,
                packageId: createdPkg.id,
                providerSku: `MOCK-${pkg.sku}`,
                priority: 1,
            },
        });
    }
    // D. Google Play Card (US)
    const gplayGame = await prisma.game.create({
        data: {
            slug: 'google-play-us',
            name: 'Google Play Gift Card (US)',
            nameAr: 'بطاقات جوجل بلاي (المتجر الأمريكي)',
            description: 'Official digital voucher code for US Google Play accounts',
            descriptionAr: 'كود رقمي فوري لمتجر جوجل بلاي الأمريكي لشراء التطبيقات والألعاب',
            logoUrl: '/images/cards/googleplay.png',
            categoryId: cardsCategory.id,
            displayOrder: 4,
            playerFields: [], // No player ID required for digital gift cards
        },
    });
    const gplayProduct = await prisma.product.create({
        data: {
            gameId: gplayGame.id,
            name: 'Google Play US Gift Card',
            nameAr: 'بطاقة جوجل بلاي أمريكي',
            type: client_1.ProductType.GIFT_CARD,
        },
    });
    const gplayPackages = [
        { name: '$10 Gift Card', nameAr: 'بطاقة 10 دولار', sku: 'GP-US-10', amountValue: '$10', costPrice: 9.50, retailPrice: 10.25 },
        { name: '$25 Gift Card', nameAr: 'بطاقة 25 دولار', sku: 'GP-US-25', amountValue: '$25', costPrice: 24.00, retailPrice: 25.50 },
        { name: '$50 Gift Card', nameAr: 'بطاقة 50 دولار', sku: 'GP-US-50', amountValue: '$50', costPrice: 48.00, retailPrice: 50.75 },
    ];
    for (let i = 0; i < gplayPackages.length; i++) {
        const pkg = gplayPackages[i];
        const createdPkg = await prisma.productPackage.create({
            data: {
                productId: gplayProduct.id,
                name: pkg.name,
                nameAr: pkg.nameAr,
                sku: pkg.sku,
                amountValue: pkg.amountValue,
                costPrice: pkg.costPrice,
                retailPrice: pkg.retailPrice,
                displayOrder: i + 1,
            },
        });
        await prisma.providerProductMapping.create({
            data: {
                providerId: mockProvider.id,
                packageId: createdPkg.id,
                providerSku: `MOCK-${pkg.sku}`,
                priority: 1,
            },
        });
    }
    // 7. Initial Audit Log
    await prisma.auditLog.create({
        data: {
            userId: superAdmin.id,
            userRole: superAdmin.role,
            action: 'SYSTEM_INITIALIZATION',
            entityName: 'SYSTEM',
            entityId: 'ROOT',
            newValues: {
                version: '1.0.0',
                environment: 'development',
                seededGamesCount: 4,
                seededPackagesCount: 15,
            },
            ipAddress: '127.0.0.1',
            userAgent: 'Prisma Seeder Script',
        },
    });
    console.log('--- Database Seeding Completed Successfully ---');
    console.log(`Super Admin created: admin@digitaltopup.com (Pass: Admin@123456)`);
    console.log(`Finance Officer created: finance@digitaltopup.com (Pass: Finance@123456)`);
    console.log(`Test Customer created: customer@gmail.com (Pass: Customer@123456) - Balance: $100.00`);
}
main()
    .catch((e) => {
    console.error('Seeding Error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
