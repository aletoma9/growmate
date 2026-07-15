import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { PartnerList } from "./partner-list";

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
}) {
  const { tenantId, companyId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const partners = await prisma.partner.findMany({ where: { companyId }, orderBy: { name: "asc" } });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Anagrafiche clienti e fornitori</h1>
        <p className="text-sm text-gray-500">
          Ogni anagrafica alimenta il partitario e i movimenti IVA collegati alle registrazioni.
        </p>
      </div>
      <PartnerList tenantId={tenantId} companyId={companyId} partners={partners} />
    </div>
  );
}
