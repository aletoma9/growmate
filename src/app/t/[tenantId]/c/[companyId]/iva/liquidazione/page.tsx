import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { computeLiquidazione, LAST_PERIOD } from "@/lib/iva-liquidazione";
import { ivaPeriodOf } from "@/lib/fiscal-period";
import { FinalizeButton } from "./finalize-button";

export default async function LiquidazionePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
  searchParams: Promise<{ fiscalYearId?: string; period?: string; acconto?: string }>;
}) {
  const { tenantId, companyId } = await params;
  const { company } = await requireCompanyAccess(tenantId, companyId);
  const query = await searchParams;

  const fiscalYears = await prisma.fiscalYear.findMany({ where: { companyId }, orderBy: { startDate: "desc" } });
  const fiscalYearId = query.fiscalYearId ?? fiscalYears[0]?.id;
  const fiscalYear = fiscalYears.find((fy) => fy.id === fiscalYearId);

  const settlementPeriod = company.ivaSettlementPeriod;
  const period = query.period ? Number(query.period) : ivaPeriodOf(new Date(), settlementPeriod);
  const acconto = query.acconto ? Number(query.acconto) : 0;

  const computation = fiscalYear ? await computeLiquidazione(companyId, fiscalYearId!, period, acconto) : null;

  const existingFinal = fiscalYearId
    ? await prisma.ivaLiquidazione.findFirst({
        where: { companyId, fiscalYearId, period, periodType: settlementPeriod, status: "FINAL" },
      })
    : null;

  const periodOptions = Array.from({ length: LAST_PERIOD[settlementPeriod] }, (_, i) => i + 1);
  const periodLabel = settlementPeriod === "QUARTERLY" ? "Trimestre" : "Mese";

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Liquidazione IVA periodica</h1>
        <p className="text-sm text-gray-500">
          {`Periodicità ${settlementPeriod === "QUARTERLY" ? "trimestrale" : "mensile"} per questa azienda. Calcola il debito/credito IVA, il pro-rata di detraibilità, il credito riportato e la maggiorazione dell'1% per i trimestrali.`}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Esercizio</span>
          <select name="fiscalYearId" defaultValue={fiscalYearId} className="rounded border border-gray-300 px-2 py-1">
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {new Date(fy.startDate).getFullYear()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">{periodLabel}</span>
          <select name="period" defaultValue={period} className="rounded border border-gray-300 px-2 py-1">
            {periodOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {computation?.isLastPeriod && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Acconto versato</span>
            <input
              type="number"
              step="0.01"
              name="acconto"
              defaultValue={acconto}
              className="w-28 rounded border border-gray-300 px-2 py-1"
            />
          </label>
        )}
        <button type="submit" className="rounded border border-gray-300 px-3 py-1.5">
          Calcola
        </button>
      </form>

      {computation && (
        <div className="rounded border border-gray-200 p-4 text-sm">
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-gray-500">IVA a debito</dt>
            <dd className="text-right font-mono">{computation.ivaDebito.toFixed(2)}</dd>
            <dt className="text-gray-500">IVA a credito (lorda)</dt>
            <dd className="text-right font-mono">{computation.ivaCreditoLordo.toFixed(2)}</dd>
            {computation.proRataPercent != null && (
              <>
                <dt className="text-gray-500">Pro-rata di detraibilità</dt>
                <dd className="text-right font-mono">{computation.proRataPercent.toFixed(2)}%</dd>
              </>
            )}
            <dt className="text-gray-500">IVA a credito detraibile</dt>
            <dd className="text-right font-mono">{computation.ivaCreditoDetraibile.toFixed(2)}</dd>
            <dt className="text-gray-500">Credito periodo precedente</dt>
            <dd className="text-right font-mono">-{computation.creditoPrecedente.toFixed(2)}</dd>
            {computation.maggiorazione > 0 && (
              <>
                <dt className="text-gray-500">Maggiorazione 1%</dt>
                <dd className="text-right font-mono">+{computation.maggiorazione.toFixed(2)}</dd>
              </>
            )}
            {computation.isLastPeriod && acconto > 0 && (
              <>
                <dt className="text-gray-500">Acconto versato</dt>
                <dd className="text-right font-mono">-{acconto.toFixed(2)}</dd>
              </>
            )}
            <dt className="border-t border-gray-200 pt-2 font-semibold">
              {computation.importoDovuto >= 0 ? "IVA da versare" : "Credito da riportare"}
            </dt>
            <dd className="border-t border-gray-200 pt-2 text-right font-mono font-semibold">
              {Math.abs(computation.importoDovuto).toFixed(2)}
            </dd>
          </dl>

          <div className="mt-4">
            {existingFinal ? (
              <p className="text-sm text-green-700">Periodo già liquidato in via definitiva.</p>
            ) : (
              <FinalizeButton
                tenantId={tenantId}
                companyId={companyId}
                fiscalYearId={fiscalYearId!}
                period={period}
                acconto={acconto}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
