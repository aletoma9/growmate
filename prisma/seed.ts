import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { provisionCompanyDefaults } from "@/lib/provisioning";

async function main() {
  const email = "demo@contsocieta.it";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Seed già eseguito: utente demo esistente, nessuna azione.");
    return;
  }

  const passwordHash = await bcrypt.hash("Demo1234!", 10);

  const user = await prisma.user.create({
    data: { email, passwordHash, name: "Utente Demo" },
  });

  const tenant = await prisma.tenant.create({
    data: {
      name: "Studio Demo",
      memberships: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  const company = await prisma.company.create({
    data: {
      tenantId: tenant.id,
      name: "Alfa Servizi S.r.l.",
      legalForm: "SRL",
      vatNumber: "01234567890",
      taxCode: "01234567890",
      ivaSettlementPeriod: "MONTHLY",
    },
  });

  await provisionCompanyDefaults(company.id);

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);

  await prisma.fiscalYear.create({
    data: {
      companyId: company.id,
      startDate: yearStart,
      endDate: yearEnd,
      status: "OPEN",
    },
  });

  console.log("Seed completato:");
  console.log(`  Utente demo: ${email} / Demo1234!`);
  console.log(`  Tenant: ${tenant.name}`);
  console.log(`  Azienda: ${company.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
