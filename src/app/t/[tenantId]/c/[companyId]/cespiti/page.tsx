import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { CespiteList } from "./cespite-list";
import { GenerateAmortizationForm } from "./generate-amortization-form";

export default async function CespitiPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
}) {
  const { tenantId, companyId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const [cespiti, categorie, fiscalYears] = await Promise.all([
    prisma.cespite.findMany({
      where: { companyId },
      include: { categoria: true, movimenti: true },
      orderBy: { activationDate: "asc" },
    }),
    prisma.cespiteCategoria.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.fiscalYear.findMany({ where: { companyId }, orderBy: { startDate: "desc" } }),
  ]);

  const rows = cespiti.map((c) => {
    const base = Number(c.historicalCost) + Number(c.accessoryCharges);
    const civilAccumulated = c.movimenti
      .filter((m) => m.type === "AMMORTAMENTO_CIVILE")
      .reduce((s, m) => s + Number(m.amount), 0);
    const fiscalAccumulated = c.movimenti
      .filter((m) => m.type === "AMMORTAMENTO_FISCALE")
      .reduce((s, m) => s + Number(m.amount), 0);
    return {
      cespite: c,
      base,
      civilAccumulated,
      netBookValue: base - civilAccumulated,
      differenzaTemporanea: civilAccumulated - fiscalAccumulated,
    };
  });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Libro cespiti</h1>
        <p className="text-sm text-gray-500">
          Registro dei beni ammortizzabili (art. 16 DPR 600/73). Le quote fiscali seguono i
          coefficienti ministeriali (DM 31/12/1988) con riduzione al 50% nel primo anno; la
          differenza tra ammortamento civile e fiscale genera fiscalità differita.
        </p>
      </div>

      <GenerateAmortizationForm tenantId={tenantId} companyId={companyId} fiscalYears={fiscalYears} />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3">Descrizione</th>
            <th className="py-2 pr-3">Categoria</th>
            <th className="py-2 pr-3">Entrata in funzione</th>
            <th className="py-2 pr-3 text-right">Costo storico</th>
            <th className="py-2 pr-3 text-right">Fondo civile</th>
            <th className="py-2 pr-3 text-right">Valore netto</th>
            <th className="py-2 pr-3 text-right">Diff. temporanea</th>
            <th className="py-2">Stato</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cespite, base, civilAccumulated, netBookValue, differenzaTemporanea }) => (
            <tr key={cespite.id} className="border-b border-gray-100">
              <td className="py-2 pr-3">
                <a href={`/t/${tenantId}/c/${companyId}/cespiti/${cespite.id}`} className="underline">
                  {cespite.description}
                </a>
              </td>
              <td className="py-2 pr-3 text-gray-500">{cespite.categoria.name}</td>
              <td className="py-2 pr-3">{new Date(cespite.activationDate).toLocaleDateString("it-IT")}</td>
              <td className="py-2 pr-3 text-right font-mono">{base.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right font-mono">{civilAccumulated.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right font-mono">{netBookValue.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right font-mono">{differenzaTemporanea !== 0 ? differenzaTemporanea.toFixed(2) : "—"}</td>
              <td className="py-2 text-xs">{cespite.status}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="py-4 text-center text-gray-500">
                Nessun cespite ancora registrato.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <CespiteList
        tenantId={tenantId}
        companyId={companyId}
        categorie={categorie.map((c) => ({ id: c.id, name: c.name, coefficientOrdinario: Number(c.coefficientOrdinario) }))}
      />
    </div>
  );
}
