import type { IvaRegimeType, IvaRegisterType } from "@/generated/prisma/client";

// Conti IVA standard del piano dei conti (vedi src/lib/provisioning.ts)
export const IVA_DEBITO_ACCOUNT_CODE = "23.40.10"; // Erario c/IVA a debito
export const IVA_CREDITO_ACCOUNT_CODE = "14.30.10"; // Erario c/IVA a credito

export type IvaComputationInput = {
  registerType: IvaRegisterType;
  regimeType: IvaRegimeType;
  taxableAmount: number;
  vatRate: number;
  naturaCode?: string;
};

export type IvaAutoLine = {
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
};

export type IvaAutoMovement = {
  registerType: IvaRegisterType;
  sectionalCode: string;
  taxableAmount: number;
  vatRate: number;
  taxAmount: number;
  regimeType: IvaRegimeType;
  naturaCode?: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const ZERO_TAX_REGIMES: IvaRegimeType[] = ["NON_IMPONIBILE", "ESENTE", "FUORI_CAMPO"];

/**
 * Calcola l'effetto contabile e sui registri IVA di una fattura/nota di credito
 * in base al regime. Il pro-rata di detraibilità (art. 19-bis) non è applicato
 * qui: agisce a livello di liquidazione periodica (vedi lib/iva-liquidazione.ts),
 * non sulla singola registrazione, coerentemente con la prassi.
 */
export function computeIvaEffects(input: IvaComputationInput): {
  lines: IvaAutoLine[];
  movements: IvaAutoMovement[];
} {
  const { registerType, regimeType, taxableAmount, vatRate, naturaCode } = input;
  const isVenditeSide = registerType === "VENDITE" || registerType === "CORRISPETTIVI";

  if (ZERO_TAX_REGIMES.includes(regimeType)) {
    return {
      lines: [],
      movements: [
        { registerType, sectionalCode: "1", taxableAmount, vatRate: 0, taxAmount: 0, regimeType, naturaCode },
      ],
    };
  }

  const taxAmount = round2(taxableAmount * (vatRate / 100));
  const isReverseCharge = regimeType === "REVERSE_CHARGE_INTERNO" || regimeType === "REVERSE_CHARGE_ESTERO";

  if (isReverseCharge) {
    // Autofattura: doppia registrazione (acquisti + vendite sezionale RC),
    // effetto neutro in prima nota (IVA a credito = IVA a debito).
    return {
      lines: [
        { accountCode: IVA_CREDITO_ACCOUNT_CODE, debit: taxAmount, credit: 0, description: "IVA reverse charge - detrazione" },
        { accountCode: IVA_DEBITO_ACCOUNT_CODE, debit: 0, credit: taxAmount, description: "IVA reverse charge - debito" },
      ],
      movements: [
        { registerType: "ACQUISTI", sectionalCode: "RC", taxableAmount, vatRate, taxAmount, regimeType, naturaCode },
        { registerType: "VENDITE", sectionalCode: "RC", taxableAmount, vatRate, taxAmount, regimeType, naturaCode },
      ],
    };
  }

  if (isVenditeSide) {
    return {
      lines: [{ accountCode: IVA_DEBITO_ACCOUNT_CODE, debit: 0, credit: taxAmount, description: "IVA a debito" }],
      movements: [{ registerType, sectionalCode: "1", taxableAmount, vatRate, taxAmount, regimeType, naturaCode }],
    };
  }

  return {
    lines: [{ accountCode: IVA_CREDITO_ACCOUNT_CODE, debit: taxAmount, credit: 0, description: "IVA a credito" }],
    movements: [{ registerType, sectionalCode: "1", taxableAmount, vatRate, taxAmount, regimeType, naturaCode }],
  };
}
