import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export default async function CompanyDashboard({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
}) {
  const { tenantId, companyId } = await params;
  const { company } = await requireCompanyAccess(tenantId, companyId);

  const [accountsCount, openFiscalYear, journalCount, partnersCount] = await Promise.all([
    prisma.account.count({ where: { companyId } }),
    prisma.fiscalYear.findFirst({ where: { companyId, status: "OPEN" }, orderBy: { startDate: "desc" } }),
    prisma.journalEntry.count({ where: { companyId, status: "POSTED" } }),
    prisma.partner.count({ where: { companyId } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <p className="text-sm text-gray-500">
          {company.legalForm} {company.vatNumber && `· P.IVA ${company.vatNumber}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Conti in piano dei conti" value={accountsCount} />
        <StatCard label="Registrazioni definitive" value={journalCount} />
        <StatCard label="Anagrafiche" value={partnersCount} />
        <StatCard
          label="Esercizio aperto"
          value={openFiscalYear ? new Date(openFiscalYear.startDate).getFullYear() : "—"}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-gray-200 p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}
