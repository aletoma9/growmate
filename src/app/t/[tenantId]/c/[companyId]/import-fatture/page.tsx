import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { InvoiceImportForm } from "./invoice-import-form";

export default async function ImportFatturePage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
}) {
  const { tenantId, companyId } = await params;
  const { company } = await requireCompanyAccess(tenantId, companyId);

  const [fiscalYears, causali, accounts, partners] = await Promise.all([
    prisma.fiscalYear.findMany({ where: { companyId, status: { not: "CLOSED" } }, orderBy: { startDate: "desc" } }),
    prisma.causaleContabile.findMany({
      where: { companyId, active: true, type: { in: ["FATTURA_VENDITA", "FATTURA_ACQUISTO", "NOTA_CREDITO_VENDITA", "NOTA_CREDITO_ACQUISTO"] } },
      orderBy: { code: "asc" },
    }),
    prisma.account.findMany({ where: { companyId, active: true, isReconcilable: true }, orderBy: { code: "asc" } }),
    prisma.partner.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Import fatture elettroniche (SdI)</h1>
        <p className="text-sm text-gray-500">
          Carica il file XML della fattura elettronica (FatturaPA): direzione, anagrafica,
          imponibili e regime IVA vengono riconosciuti automaticamente. Verifica i conti
          proposti e conferma per registrare in prima nota.
        </p>
        {!company.vatNumber && !company.taxCode && (
          <p className="mt-2 text-sm text-amber-700">
            Imposta la partita IVA o il codice fiscale dell&apos;azienda (Esercizi → dati
            anagrafici) per determinare se una fattura è emessa o ricevuta.
          </p>
        )}
      </div>

      <InvoiceImportForm
        tenantId={tenantId}
        companyId={companyId}
        fiscalYears={fiscalYears.map((fy) => ({ id: fy.id, year: new Date(fy.startDate).getFullYear() }))}
        causali={causali.map((c) => ({ id: c.id, code: c.code, name: c.name, type: c.type }))}
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, nature: a.nature, isPartnerLedger: a.isPartnerLedger }))}
        partners={partners.map((p) => ({ id: p.id, name: p.name, vatNumber: p.vatNumber, taxCode: p.taxCode }))}
      />
    </div>
  );
}
