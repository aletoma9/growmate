import { notFound } from "next/navigation";
import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export default async function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string; entryId: string }>;
}) {
  const { tenantId, companyId, entryId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, companyId },
    include: {
      causale: true,
      partner: true,
      lines: { include: { account: true, partner: true }, orderBy: { sortOrder: "asc" } },
      ivaMovements: { include: { ivaRegister: true } },
      reversalOf: true,
      reversedBy: true,
    },
  });
  if (!entry) notFound();

  const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Registrazione n. {entry.number ?? "—"} — {entry.causale.name}
        </h1>
        <p className="text-sm text-gray-500">
          {new Date(entry.date).toLocaleDateString("it-IT")} · {entry.description}
        </p>
        {entry.reversalOf && (
          <p className="mt-1 text-xs text-amber-700">Storno della registrazione n. {entry.reversalOf.number}</p>
        )}
        {entry.reversedBy && (
          <p className="mt-1 text-xs text-red-700">Stornata dalla registrazione n. {entry.reversedBy.number}</p>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2">Conto</th>
            <th className="py-2">Anagrafica</th>
            <th className="py-2 text-right">Dare</th>
            <th className="py-2 text-right">Avere</th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((line) => (
            <tr key={line.id} className="border-b border-gray-100">
              <td className="py-2">
                <span className="font-mono text-xs text-gray-400">{line.account.code}</span> {line.account.name}
                {line.description && <span className="text-gray-400"> · {line.description}</span>}
              </td>
              <td className="py-2 text-gray-500">{line.partner?.name ?? "—"}</td>
              <td className="py-2 text-right font-mono">{Number(line.debit) ? Number(line.debit).toFixed(2) : ""}</td>
              <td className="py-2 text-right font-mono">{Number(line.credit) ? Number(line.credit).toFixed(2) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-2" colSpan={2}>
              Totale
            </td>
            <td className="py-2 text-right font-mono">{totalDebit.toFixed(2)}</td>
            <td className="py-2 text-right font-mono">{totalCredit.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {entry.ivaMovements.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-medium">Movimenti IVA</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2">Registro</th>
                <th className="py-2">Protocollo</th>
                <th className="py-2">Regime</th>
                <th className="py-2 text-right">Imponibile</th>
                <th className="py-2 text-right">Aliquota</th>
                <th className="py-2 text-right">Imposta</th>
              </tr>
            </thead>
            <tbody>
              {entry.ivaMovements.map((m) => (
                <tr key={m.id} className="border-b border-gray-100">
                  <td className="py-2">
                    {m.ivaRegister.name} ({m.ivaRegister.sectionalCode})
                  </td>
                  <td className="py-2 font-mono text-xs">{m.protocolNumber}</td>
                  <td className="py-2 text-xs">{m.regimeType}</td>
                  <td className="py-2 text-right font-mono">{Number(m.taxableAmount).toFixed(2)}</td>
                  <td className="py-2 text-right font-mono">{Number(m.vatRate).toFixed(2)}%</td>
                  <td className="py-2 text-right font-mono">{Number(m.taxAmount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
