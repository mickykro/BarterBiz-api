import { PrismaClient, ServiceType } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
    const usersData = [
        { fullName: "Ava Carter", email: "ava@example.com", password: "password123" },
        { fullName: "Liam Brooks", email: "liam@example.com", password: "password123" },
    ];
    for (const user of usersData) {
        const passwordHash = await bcrypt.hash(user.password, 10);
        const createdUser = await prisma.user.upsert({
            where: { email: user.email },
            update: {},
            create: { fullName: user.fullName, email: user.email, passwordHash },
        });
        const business = await prisma.business.upsert({
            where: { userId: createdUser.id },
            update: {},
            create: {
                userId: createdUser.id,
                businessName: `${user.fullName.split(" ")[0]} Creative`,
                category: "creative",
                description: "Sample business for barter testing",
                locationCity: "San Francisco",
                locationRegion: "CA",
                logoUrl: null,
            },
        });
        await prisma.businessService.createMany({
            data: [
                {
                    businessId: business.id,
                    serviceName: "Branding Photography",
                    serviceType: ServiceType.offer,
                    category: "photography",
                    description: "Studio + outdoor branding sets",
                },
                {
                    businessId: business.id,
                    serviceName: "Landing Page",
                    serviceType: ServiceType.need,
                    category: "web",
                    description: "Single-page marketing site",
                },
            ],
            skipDuplicates: true,
        });
        await prisma.opportunity.create({
            data: {
                businessId: business.id,
                title: "Looking for landing page, offering branding shoot",
                description: "Swap a full branding shoot for a polished landing page build.",
                needServiceText: "Landing page build",
                offerServiceText: "Branding photography",
                locationCity: "San Francisco",
                locationRegion: "CA",
                visibilityScope: "local",
                status: "active",
            },
        });
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
