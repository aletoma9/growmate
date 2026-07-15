import { notFound } from "next/navigation";
import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { DisposeForm } from "./dispose-form";

export default async function CespiteDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string; cespiteId: string }>;
}) {
  const { tenantId, companyId, cespiteId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const cespite = await prisma.cespite.findFirst({
    where: { id: cespiteId, companyId },
    include: {
      categoria: true,
      movimenti: { include: { fiscalYear: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!cespite) notFound();

  const base = Number(cespite.historicalCost) + Number(cespite.accessoryCharges);
  const civilAccumulated = cespite.movimenti
    .filter((m) => m.type === "AMMORTAMENTO_CIVILE")
    .reduce((s, m) => s + Number(m.amount), 0);
  const fiscalAccumulated = cespite.movimenti
    .filter((m) => m.type === "AMMORTAMENTO_FISCALE")
    .reduce((s, m) => s + Number(m.amount), 0);
  const netBookValue = base - civilAccumulated;

  const [fiscalYears, bankAndCashAccounts] = await Promise.all([
    prisma.fiscalYear.findMany({ where: { companyId }, orderBy: { startDate: "desc" } }),
    prisma.account.findMany({ where: { companyId, isCashOrBank: true, active: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{cespite.description}</h1>
        <p className="text-sm text-gray-500">
          {cespite.categoria.name} · entrata in funzione {new Date(cespite.activationDate).toLocaleDateString("it-IT")} · stato {cespite.status}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-y-2 rounded border border-gray-200 p-4 text-sm">
        <dt className="text-gray-500">Costo storico (incl. oneri accessori)</dt>
        <dd className="text-right font-mono">{base.toFixed(2)}</dd>
        <dt className="text-gray-500">Fondo ammortamento civile</dt>
        <dd className="text-right font-mono">{civilAccumulated.toFixed(2)}</dd>
        <dt className="text-gray-500">Ammortamento fiscale cumulato</dt>
        <dd className="text-right font-mono">{fiscalAccumulated.toFixed(2)}</dd>
        <dt className="text-gray-500">Differenza temporanea (civile - fiscale)</dt>
        <dd className="text-right font-mono">{(civilAccumulated - fiscalAccumulated).toFixed(2)}</dd>
        <dt className="border-t border-gray-200 pt-2 font-semibold">Valore netto contabile</dt>
        <dd className="border-t border-gray-200 pt-2 text-right font-mono font-semibold">{netBookValue.toFixed(2)}</dd>
      </dl>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3">Esercizio</th>
            <th className="py-2 pr-3">Tipo</th>
            <th className="py-2 pr-3 text-right">Importo</th>
            <th className="py-2 text-right">Plus/minusvalenza</th>
          </tr>
        </thead>
        <tbody>
          {cespite.movimenti.map((m) => (
            <tr key={m.id} className="border-b border-gray-100">
              <td className="py-2 pr-3">{new Date(m.fiscalYear.startDate).getFullYear()}</td>
              <td className="py-2 pr-3 text-xs">{m.type}</td>
              <td className="py-2 pr-3 text-right font-mono">{Number(m.amount).toFixed(2)}</td>
              <td className="py-2 text-right font-mono">{m.gainLoss != null ? Number(m.gainLoss).toFixed(2) : "—"}</td>
            </tr>
          ))}
          {cespite.movimenti.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-gray-500">
                Nessun movimento registrato.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {cespite.status === "ACTIVE" && (
        <DisposeForm
          tenantId={tenantId}
          companyId={companyId}
          cespiteId={cespite.id}
          fiscalYears={fiscalYears}
          bankAndCashAccounts={bankAndCashAccounts}
          netBookValue={netBookValue}
        />
      )}
    </div>
  );
}
