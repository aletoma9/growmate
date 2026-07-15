import { prisma } from "@/lib/prisma";
import type { IvaSettlementPeriod } from "@/generated/prisma/client";
import { ivaPeriodOf } from "@/lib/fiscal-period";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function periodBounds(fiscalYear: { startDate: Date; endDate: Date }, period: number, periodType: IvaSettlementPeriod) {
  const year = fiscalYear.startDate.getFullYear();
  const startMonth = periodType === "QUARTERLY" ? (period - 1) * 3 : period - 1;
  const endMonth = periodType === "QUARTERLY" ? startMonth + 2 : startMonth;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export const LAST_PERIOD: Record<IvaSettlementPeriod, number> = { MONTHLY: 12, QUARTERLY: 4 };

export type LiquidazioneComputation = {
  period: number;
  periodType: IvaSettlementPeriod;
  ivaDebito: number;
  ivaCreditoLordo: number;
  proRataPercent: number | null;
  ivaCreditoDetraibile: number;
  creditoPrecedente: number;
  isLastPeriod: boolean;
  saldoAnteAcconto: number;
  maggiorazione: number;
  importoDovuto: number;
};

/**
 * Calcola la liquidazione IVA per un periodo, aggregando i movimenti IVA
 * registrati (i registri sezionali reverse charge confluiscono naturalmente
 * nei totali debito/credito, neutralizzandosi nel saldo netto).
 * Il pro-rata di detraibilità si applica qui, sul totale del credito del periodo.
 */
export async function computeLiquidazione(
  companyId: string,
  fiscalYearId: string,
  period: number,
  acconto = 0
): Promise<LiquidazioneComputation> {
  const [company, fiscalYear] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.fiscalYear.findUniqueOrThrow({ where: { id: fiscalYearId } }),
  ]);
  const periodType = company.ivaSettlementPeriod;
  const { start, end } = periodBounds(fiscalYear, period, periodType);

  const movements = await prisma.ivaMovement.findMany({
    where: { companyId, fiscalYearId, documentDate: { gte: start, lte: end } },
    include: { ivaRegister: true },
  });

  let ivaDebito = 0;
  let ivaCreditoLordo = 0;
  for (const m of movements) {
    if (ivaPeriodOf(m.documentDate, periodType) !== period) continue;
    if (m.ivaRegister.type === "VENDITE" || m.ivaRegister.type === "CORRISPETTIVI") {
      ivaDebito += Number(m.taxAmount);
    } else {
      ivaCreditoLordo += Number(m.taxAmount);
    }
  }
  ivaDebito = round2(ivaDebito);
  ivaCreditoLordo = round2(ivaCreditoLordo);

  const proRataPercent = company.proRataPercent ? Number(company.proRataPercent) : null;
  const ivaCreditoDetraibile = round2(
    proRataPercent != null ? ivaCreditoLordo * (proRataPercent / 100) : ivaCreditoLordo
  );

  const previous = await prisma.ivaLiquidazione.findFirst({
    where: { companyId, fiscalYearId, periodType, period: period - 1 },
  });
  const creditoPrecedente = previous && Number(previous.importoDovuto) < 0 ? round2(-Number(previous.importoDovuto)) : 0;

  const saldoAnteAcconto = round2(ivaDebito - ivaCreditoDetraibile - creditoPrecedente);
  const isLastPeriod = period === LAST_PERIOD[periodType];

  let maggiorazione = 0;
  if (periodType === "QUARTERLY" && !isLastPeriod && saldoAnteAcconto > 0) {
    maggiorazione = round2(saldoAnteAcconto * 0.01);
  }

  const importoDovuto = round2(saldoAnteAcconto + maggiorazione - (isLastPeriod ? acconto : 0));

  return {
    period,
    periodType,
    ivaDebito,
    ivaCreditoLordo,
    proRataPercent,
    ivaCreditoDetraibile,
    creditoPrecedente,
    isLastPeriod,
    saldoAnteAcconto,
    maggiorazione,
    importoDovuto,
  };
}
