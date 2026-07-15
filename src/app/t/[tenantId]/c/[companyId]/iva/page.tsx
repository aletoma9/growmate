import Link from "next/link";
import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export default async function IvaRegistersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
  searchParams: Promise<{ fiscalYearId?: string }>;
}) {
  const { tenantId, companyId } = await params;
  await requireCompanyAccess(tenantId, companyId);
  const { fiscalYearId: requestedFiscalYearId } = await searchParams;

  const fiscalYears = await prisma.fiscalYear.findMany({ where: { companyId }, orderBy: { startDate: "desc" } });
  const fiscalYearId = requestedFiscalYearId ?? fiscalYears[0]?.id;

  const registers = await prisma.ivaRegister.findMany({
    where: { companyId },
    include: {
      movements: {
        where: { fiscalYearId },
        include: { partner: true },
        orderBy: { protocolNumber: "asc" },
      },
    },
    orderBy: [{ type: "asc" }, { sectionalCode: "asc" }],
  });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Registri IVA</h1>
          <p className="text-sm text-gray-500">
            Ogni fattura genera automaticamente il protocollo progressivo annuale nel registro
            corretto.
          </p>
        </div>
        <Link
          href={`/t/${tenantId}/c/${companyId}/iva/liquidazione${fiscalYearId ? `?fiscalYearId=${fiscalYearId}` : ""}`}
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white"
        >
          Liquidazione periodica
        </Link>
      </div>

      <form className="flex items-center gap-2 text-sm">
        <label htmlFor="fiscalYearId" className="text-gray-500">
          Esercizio:
        </label>
        <select
          id="fiscalYearId"
          name="fiscalYearId"
          defaultValue={fiscalYearId}
          className="rounded border border-gray-300 px-2 py-1"
        >
          {fiscalYears.map((fy) => (
            <option key={fy.id} value={fy.id}>
              {new Date(fy.startDate).getFullYear()}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded border border-gray-300 px-2 py-1">
          Filtra
        </button>
      </form>

      {registers.map((register) => (
        <div key={register.id}>
          <h2 className="mb-2 text-lg font-medium">
            {register.name} <span className="text-sm font-normal text-gray-400">({register.movements.length} movimenti)</span>
          </h2>
          {register.movements.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-3">Protocollo</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Documento</th>
                  <th className="py-2 pr-3">Anagrafica</th>
                  <th className="py-2 pr-3">Regime</th>
                  <th className="py-2 pr-3 text-right">Imponibile</th>
                  <th className="py-2 pr-3 text-right">Aliquota</th>
                  <th className="py-2 text-right">Imposta</th>
                </tr>
              </thead>
              <tbody>
                {register.movements.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-mono text-xs">{m.protocolNumber}</td>
                    <td className="py-2 pr-3">{new Date(m.documentDate).toLocaleDateString("it-IT")}</td>
                    <td className="py-2 pr-3">{m.documentNumber}</td>
                    <td className="py-2 pr-3 text-gray-500">{m.partner?.name ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{m.regimeType}</td>
                    <td className="py-2 pr-3 text-right font-mono">{Number(m.taxableAmount).toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{Number(m.vatRate).toFixed(2)}%</td>
                    <td className="py-2 text-right font-mono">{Number(m.taxAmount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
