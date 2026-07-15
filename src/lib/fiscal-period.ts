import type { IvaSettlementPeriod } from "@/generated/prisma/client";

/** Numero di periodo IVA (mese 1-12, o trimestre 1-4) per una data. */
export function ivaPeriodOf(date: Date, settlementPeriod: IvaSettlementPeriod): number {
  const month = date.getMonth() + 1;
  return settlementPeriod === "QUARTERLY" ? Math.ceil(month / 3) : month;
}

/**
 * Verifica se una data cade in un periodo dell'esercizio già bloccato per
 * liquidazione IVA, per impedire registrazioni retroattive che sfaserebbero i registri.
 */
export function isDateLocked(
  date: Date,
  fiscalYear: { status: string; lastLockedIvaPeriod: number | null },
  settlementPeriod: IvaSettlementPeriod
): boolean {
  if (fiscalYear.status === "CLOSED") return true;
  if (fiscalYear.status !== "LOCKED") return false;
  if (fiscalYear.lastLockedIvaPeriod == null) return true;
  return ivaPeriodOf(date, settlementPeriod) <= fiscalYear.lastLockedIvaPeriod;
}
