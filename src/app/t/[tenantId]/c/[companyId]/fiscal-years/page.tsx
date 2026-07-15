import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { CreateFiscalYearForm } from "./create-form";
import { FiscalYearRow } from "./fiscal-year-row";

export default async function FiscalYearsPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
}) {
  const { tenantId, companyId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const fiscalYears = await prisma.fiscalYear.findMany({
    where: { companyId },
    orderBy: { startDate: "desc" },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Esercizi contabili</h1>
        <p className="text-sm text-gray-500">
          Un esercizio LOCKED blocca le registrazioni nei periodi IVA già liquidati; CLOSED chiude
          definitivamente l&apos;esercizio dopo il riporto saldi.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2">Periodo</th>
            <th className="py-2">Stato</th>
            <th className="py-2">Ultimo periodo IVA bloccato</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {fiscalYears.map((fy) => (
            <FiscalYearRow key={fy.id} tenantId={tenantId} companyId={companyId} fiscalYear={fy} />
          ))}
        </tbody>
      </table>

      <div className="rounded border border-gray-200 p-4">
        <h2 className="mb-4 text-lg font-medium">Nuovo esercizio</h2>
        <CreateFiscalYearForm tenantId={tenantId} companyId={companyId} />
      </div>
    </div>
  );
}
