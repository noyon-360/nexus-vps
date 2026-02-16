import prisma from './src/lib/prisma';

async function main() {
    try {
        const settings = await prisma.systemSettings.findMany();
        console.log("Current System Settings in DB:");
        console.log(JSON.stringify(settings, null, 2));

        const users = await prisma.user.findMany({
            include: { systemSettings: true }
        });
        console.log("\nUsers and their settings:");
        console.log(JSON.stringify(users.map((u: any) => ({ email: u.email, settings: u.systemSettings })), null, 2));
    } catch (error) {
        console.error("Error checking settings:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
