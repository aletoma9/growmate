function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type CespiteForQuota = {
  activationDate: Date;
  historicalCost: number;
  accessoryCharges: number;
  civilCoefficientPercent: number;
  fiscalCoefficientPercent: number;
  firstYearReduced: boolean;
  isMinorGood: boolean;
};

export type QuotaResult = {
  civilQuota: number;
  fiscalQuota: number;
  civilResidualBefore: number;
  fiscalResidualBefore: number;
  isFirstYear: boolean;
  differenzaTemporanea: number; // civile - fiscale: genera fiscalità differita/anticipata
};

function monthsInService(activationDate: Date, yearStart: Date, yearEnd: Date): number {
  const from = activationDate > yearStart ? activationDate : yearStart;
  if (from > yearEnd) return 0;
  const months = (yearEnd.getFullYear() - from.getFullYear()) * 12 + (yearEnd.getMonth() - from.getMonth()) + 1;
  return Math.min(12, Math.max(0, months));
}

/**
 * Calcola le quote di ammortamento civile e fiscale di un cespite per un esercizio,
 * a partire da quanto già accumulato nei periodi precedenti (per il plafond e per
 * capire se questo è il "primo anno" ai fini della riduzione al 50%).
 */
export function computeAnnualQuota(
  cespite: CespiteForQuota,
  fiscalYear: { startDate: Date; endDate: Date },
  civilAccumulatedBefore: number,
  fiscalAccumulatedBefore: number
): QuotaResult {
  const base = round2(cespite.historicalCost + cespite.accessoryCharges);
  const civilResidual = round2(base - civilAccumulatedBefore);
  const fiscalResidual = round2(base - fiscalAccumulatedBefore);
  const isFirstYear =
    cespite.activationDate >= fiscalYear.startDate && cespite.activationDate <= fiscalYear.endDate;

  if (cespite.isMinorGood) {
    // Beni di costo unitario <= 516,46 €: deducibili integralmente nell'esercizio di entrata in funzione.
    const quota = isFirstYear ? Math.min(civilResidual, base) : 0;
    return {
      civilQuota: Math.max(0, quota),
      fiscalQuota: Math.max(0, quota),
      civilResidualBefore: civilResidual,
      fiscalResidualBefore: fiscalResidual,
      isFirstYear,
      differenzaTemporanea: 0,
    };
  }

  const months = monthsInService(cespite.activationDate, fiscalYear.startDate, fiscalYear.endDate);
  const civilAnnual = round2(base * (cespite.civilCoefficientPercent / 100));
  const civilQuota = Math.max(
    0,
    Math.min(civilResidual, isFirstYear ? round2(civilAnnual * (months / 12)) : civilAnnual)
  );

  const fiscalAnnual = round2(base * (cespite.fiscalCoefficientPercent / 100));
  const fiscalReduction = isFirstYear && cespite.firstYearReduced ? 0.5 : 1;
  const fiscalQuota = Math.max(0, Math.min(fiscalResidual, round2(fiscalAnnual * fiscalReduction)));

  return {
    civilQuota: round2(civilQuota),
    fiscalQuota: round2(fiscalQuota),
    civilResidualBefore: civilResidual,
    fiscalResidualBefore: fiscalResidual,
    isFirstYear,
    differenzaTemporanea: round2(civilQuota - fiscalQuota),
  };
}
