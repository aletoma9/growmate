import { notFound } from "next/navigation";
import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export default async function PartnerLedgerPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string; partnerId: string }>;
}) {
  const { tenantId, companyId, partnerId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const partner = await prisma.partner.findFirst({ where: { id: partnerId, companyId } });
  if (!partner) notFound();

  const lines = await prisma.journalLine.findMany({
    where: { partnerId, journalEntry: { companyId } },
    include: { journalEntry: { include: { causale: true } }, account: true },
    orderBy: [{ journalEntry: { date: "asc" } }, { journalEntry: { number: "asc" } }],
  });

  const today = new Date();
  const rows: Array<{ line: (typeof lines)[number]; saldo: number; dueDate: Date | null; overdue: boolean }> = [];
  let running = 0;
  for (const line of lines) {
    running += Number(line.debit) - Number(line.credit);
    const dueDate =
      partner.paymentTermsDays != null
        ? new Date((line.journalEntry.documentDate ?? line.journalEntry.date).getTime() + partner.paymentTermsDays * 86400000)
        : null;
    rows.push({ line, saldo: running, dueDate, overdue: dueDate ? dueDate < today : false });
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{partner.name}</h1>
        <p className="text-sm text-gray-500">
          {partner.vatNumber ?? partner.taxCode ?? ""} {partner.paymentTermsDays != null && `· termini ${partner.paymentTermsDays} gg`}
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3">Data</th>
            <th className="py-2 pr-3">Causale / documento</th>
            <th className="py-2 pr-3">Conto</th>
            <th className="py-2 pr-3 text-right">Dare</th>
            <th className="py-2 pr-3 text-right">Avere</th>
            <th className="py-2 pr-3 text-right">Saldo progressivo</th>
            <th className="py-2">Scadenza</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ line, saldo, dueDate, overdue }) => (
            <tr key={line.id} className="border-b border-gray-100">
              <td className="py-2 pr-3">{new Date(line.journalEntry.date).toLocaleDateString("it-IT")}</td>
              <td className="py-2 pr-3">
                {line.journalEntry.causale.name}
                {line.journalEntry.documentNumber && ` · ${line.journalEntry.documentNumber}`}
              </td>
              <td className="py-2 pr-3 text-gray-500">{line.account.name}</td>
              <td className="py-2 pr-3 text-right font-mono">{Number(line.debit) ? Number(line.debit).toFixed(2) : ""}</td>
              <td className="py-2 pr-3 text-right font-mono">{Number(line.credit) ? Number(line.credit).toFixed(2) : ""}</td>
              <td className="py-2 pr-3 text-right font-mono">{saldo.toFixed(2)}</td>
              <td className={`py-2 ${overdue ? "font-medium text-red-600" : "text-gray-500"}`}>
                {dueDate ? dueDate.toLocaleDateString("it-IT") : "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-gray-500">
                Nessun movimento registrato per questa anagrafica.
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2" colSpan={5}>
                Saldo attuale
              </td>
              <td className="py-2 text-right font-mono">{rows[rows.length - 1].saldo.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
