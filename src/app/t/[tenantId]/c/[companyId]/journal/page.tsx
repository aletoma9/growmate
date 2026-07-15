import Link from "next/link";
import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { StornoButton } from "./storno-button";

export default async function JournalPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
}) {
  const { tenantId, companyId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const entries = await prisma.journalEntry.findMany({
    where: { companyId },
    include: { causale: true, lines: true, reversedBy: { select: { id: true } } },
    orderBy: [{ fiscalYearId: "desc" }, { number: "desc" }],
  });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prima nota / Libro giornale</h1>
          <p className="text-sm text-gray-500">
            Ogni registrazione è numerata progressivamente ed è immodificabile una volta
            definitiva: le correzioni avvengono per storno o nota di credito.
          </p>
        </div>
        <Link
          href={`/t/${tenantId}/c/${companyId}/journal/new`}
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
        >
          Nuova registrazione
        </Link>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3">N.</th>
            <th className="py-2 pr-3">Data</th>
            <th className="py-2 pr-3">Causale</th>
            <th className="py-2 pr-3">Descrizione</th>
            <th className="py-2 pr-3 text-right">Importo</th>
            <th className="py-2 pr-3">Stato</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const total = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
            return (
              <tr key={entry.id} className="border-b border-gray-100">
                <td className="py-2 pr-3 font-mono text-xs">{entry.number}</td>
                <td className="py-2 pr-3">{new Date(entry.date).toLocaleDateString("it-IT")}</td>
                <td className="py-2 pr-3">{entry.causale.name}</td>
                <td className="py-2 pr-3">
                  <Link href={`/t/${tenantId}/c/${companyId}/journal/${entry.id}`} className="underline">
                    {entry.description}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-right font-mono">{total.toFixed(2)}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={entry.status} />
                </td>
                <td className="py-2">
                  {entry.status === "POSTED" && !entry.reversedBy && (
                    <StornoButton tenantId={tenantId} companyId={companyId} entryId={entry.id} />
                  )}
                </td>
              </tr>
            );
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-gray-500">
                Nessuna registrazione ancora inserita.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    POSTED: "bg-green-100 text-green-800",
    STORNATA: "bg-red-100 text-red-700",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? ""}`}>{status}</span>;
}
