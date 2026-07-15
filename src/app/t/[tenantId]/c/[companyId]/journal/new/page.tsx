import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { JournalEntryForm } from "./journal-entry-form";

export default async function NewJournalEntryPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
}) {
  const { tenantId, companyId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const [fiscalYears, causali, accounts, partners] = await Promise.all([
    prisma.fiscalYear.findMany({
      where: { companyId, status: { not: "CLOSED" } },
      orderBy: { startDate: "desc" },
    }),
    prisma.causaleContabile.findMany({ where: { companyId, active: true }, orderBy: { code: "asc" } }),
    prisma.account.findMany({
      where: { companyId, active: true, isReconcilable: true },
      orderBy: { code: "asc" },
    }),
    prisma.partner.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nuova registrazione</h1>
        <p className="text-sm text-gray-500">
          Seleziona la causale contabile: pilota le righe dare/avere e, per fatture e
          corrispettivi, genera automaticamente il movimento IVA nel registro corretto.
        </p>
      </div>
      <JournalEntryForm
        tenantId={tenantId}
        companyId={companyId}
        fiscalYears={fiscalYears}
        causali={causali}
        accounts={accounts}
        partners={partners}
      />
    </div>
  );
}
