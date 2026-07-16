"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCompanyAccess } from "@/lib/tenant";
import { parseFatturaPA, type ParsedInvoice } from "@/lib/fatturapa-parser";
import { computeIvaEffects } from "@/lib/iva-engine";
import type { ActionState } from "@/lib/actions/auth";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type InvoicePreview = {
  direction: "VENDITA" | "ACQUISTO";
  documentType: string;
  isCreditNote: boolean;
  documentNumber: string;
  documentDate: string;
  totalAmount: number;
  partner: { name: string; vatNumber?: string; taxCode?: string };
  vatGroups: ParsedInvoice["vatGroups"];
  existingPartnerId: string | null;
  suggestedCausaleId: string | null;
};

export type ParseInvoiceState = { error?: string; preview?: InvoicePreview };

const parseSchema = z.object({ tenantId: z.string().min(1), companyId: z.string().min(1) });

export async function parseInvoiceXmlAction(_prevState: ParseInvoiceState | undefined, formData: FormData): Promise<ParseInvoiceState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);
  const parsedParams = parseSchema.safeParse({ tenantId, companyId });
  if (!parsedParams.success) return { error: "Parametri non validi." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Carica un file XML." };

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (!company.vatNumber && !company.taxCode) {
    return { error: "Imposta la partita IVA o il codice fiscale dell'azienda prima di importare fatture elettroniche." };
  }

  let parsed: ParsedInvoice;
  try {
    const xml = await file.text();
    parsed = parseFatturaPA(xml, company.vatNumber, company.taxCode);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Impossibile leggere il file XML." };
  }

  const existingPartner = parsed.partner.vatNumber
    ? await prisma.partner.findFirst({ where: { companyId, vatNumber: parsed.partner.vatNumber } })
    : parsed.partner.taxCode
      ? await prisma.partner.findFirst({ where: { companyId, taxCode: parsed.partner.taxCode } })
      : null;

  const causaleType = parsed.direction === "VENDITA"
    ? (parsed.isCreditNote ? "NOTA_CREDITO_VENDITA" : "FATTURA_VENDITA")
    : (parsed.isCreditNote ? "NOTA_CREDITO_ACQUISTO" : "FATTURA_ACQUISTO");
  const suggestedCausale = await prisma.causaleContabile.findFirst({ where: { companyId, type: causaleType } });

  return {
    preview: {
      direction: parsed.direction,
      documentType: parsed.documentType,
      isCreditNote: parsed.isCreditNote,
      documentNumber: parsed.documentNumber,
      documentDate: parsed.documentDate.toISOString().slice(0, 10),
      totalAmount: parsed.totalAmount,
      partner: parsed.partner,
      vatGroups: parsed.vatGroups,
      existingPartnerId: existingPartner?.id ?? null,
      suggestedCausaleId: suggestedCausale?.id ?? null,
    },
  };
}

const vatGroupSchema = z.object({
  taxableAmount: z.coerce.number(),
  vatRate: z.coerce.number(),
  taxAmount: z.coerce.number(),
  regimeType: z.enum([
    "ORDINARIA",
    "REVERSE_CHARGE_INTERNO",
    "REVERSE_CHARGE_ESTERO",
    "SPLIT_PAYMENT",
    "NON_IMPONIBILE",
    "ESENTE",
    "FUORI_CAMPO",
    "IVA_DIFFERITA",
  ]),
  naturaCode: z.string().optional(),
  accountId: z.string().min(1, "Seleziona un conto per ogni riga IVA"),
});

const createSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  causaleId: z.string().min(1),
  documentNumber: z.string().trim().min(1),
  documentDate: z.string().min(1),
  description: z.string().trim().min(1),
  isCreditNote: z.coerce.boolean(),
  counterpartAccountId: z.string().min(1, "Seleziona il conto Clienti/Fornitori"),
  partnerId: z.string().optional(),
  newPartnerName: z.string().trim().optional(),
  newPartnerVatNumber: z.string().trim().optional(),
  newPartnerTaxCode: z.string().trim().optional(),
  direction: z.enum(["VENDITA", "ACQUISTO"]),
  vatGroups: z.array(vatGroupSchema).min(1),
});

export async function createEntryFromInvoiceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  let vatGroupsRaw: unknown;
  try {
    vatGroupsRaw = JSON.parse(String(formData.get("vatGroupsJson") ?? "[]"));
  } catch {
    return { error: "Righe IVA non valide." };
  }

  const parsed = createSchema.safeParse({
    tenantId,
    companyId,
    fiscalYearId: formData.get("fiscalYearId"),
    causaleId: formData.get("causaleId"),
    documentNumber: formData.get("documentNumber"),
    documentDate: formData.get("documentDate"),
    description: formData.get("description"),
    isCreditNote: formData.get("isCreditNote") === "true",
    counterpartAccountId: formData.get("counterpartAccountId"),
    partnerId: formData.get("partnerId") || undefined,
    newPartnerName: formData.get("newPartnerName") || undefined,
    newPartnerVatNumber: formData.get("newPartnerVatNumber") || undefined,
    newPartnerTaxCode: formData.get("newPartnerTaxCode") || undefined,
    direction: formData.get("direction"),
    vatGroups: vatGroupsRaw,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  const data = parsed.data;

  const [fiscalYear, causale, counterpartAccount] = await Promise.all([
    prisma.fiscalYear.findFirst({ where: { id: data.fiscalYearId, companyId } }),
    prisma.causaleContabile.findFirst({ where: { id: data.causaleId, companyId } }),
    prisma.account.findFirst({ where: { id: data.counterpartAccountId, companyId } }),
  ]);
  if (!fiscalYear) return { error: "Esercizio non valido." };
  if (!causale || !causale.ivaRegisterType) return { error: "Causale non valida." };
  if (!counterpartAccount) return { error: "Conto Clienti/Fornitori non valido." };

  let partner = data.partnerId ? await prisma.partner.findFirst({ where: { id: data.partnerId, companyId } }) : null;
  if (!partner) {
    if (!data.newPartnerName) return { error: "Seleziona un'anagrafica esistente o inserisci il nome della nuova." };
    partner = await prisma.partner.create({
      data: {
        companyId,
        type: data.direction === "VENDITA" ? "CLIENTE" : "FORNITORE",
        name: data.newPartnerName,
        vatNumber: data.newPartnerVatNumber,
        taxCode: data.newPartnerTaxCode,
      },
    });
  }

  const revenueCostAccountIds = [...new Set(data.vatGroups.map((g) => g.accountId))];
  const revenueCostAccounts = await prisma.account.findMany({ where: { id: { in: revenueCostAccountIds }, companyId } });
  if (revenueCostAccounts.length !== revenueCostAccountIds.length) return { error: "Uno o più conti selezionati non sono validi." };

  const isVenditaSide = causale.ivaRegisterType === "VENDITE" || causale.ivaRegisterType === "CORRISPETTIVI";
  const sign = data.isCreditNote ? -1 : 1; // nota di credito: inverte il verso delle righe

  type PendingLine =
    | { kind: "auto"; accountCode: string; debit: number; credit: number; description: string }
    | { kind: "manual"; accountId: string; debit: number; credit: number; description: string };
  const pendingLines: PendingLine[] = [];
  type AutoMovement = ReturnType<typeof computeIvaEffects>["movements"][number];
  const movements: AutoMovement[] = [];

  let totalTaxable = 0;
  let totalTax = 0;

  for (const group of data.vatGroups) {
    const effects = computeIvaEffects({
      registerType: causale.ivaRegisterType,
      regimeType: group.regimeType,
      taxableAmount: group.taxableAmount,
      vatRate: group.vatRate,
      naturaCode: group.naturaCode,
    });
    // L'imposta dichiarata nell'XML è autorevole: sostituisce quella
    // ricalcolata da imponibile*aliquota per evitare scarti di arrotondamento
    // rispetto al documento originale.
    for (const l of effects.lines) {
      pendingLines.push({
        kind: "auto",
        accountCode: l.accountCode,
        debit: round2((l.debit !== 0 ? group.taxAmount : 0) * sign),
        credit: round2((l.credit !== 0 ? group.taxAmount : 0) * sign),
        description: l.description,
      });
    }
    movements.push(...effects.movements.map((m) => ({ ...m, taxableAmount: group.taxableAmount, taxAmount: group.taxAmount })));

    // Riga di ricavo/costo: normalmente RICAVO va in avere, COSTO in dare;
    // sulle note di credito il verso si inverte (riduce ricavo/costo).
    const revenueDebit = isVenditaSide ? 0 : group.taxableAmount;
    const revenueCredit = isVenditaSide ? group.taxableAmount : 0;
    pendingLines.push({
      kind: "manual",
      accountId: group.accountId,
      debit: round2(data.isCreditNote ? revenueCredit : revenueDebit),
      credit: round2(data.isCreditNote ? revenueDebit : revenueCredit),
      description: `${data.documentNumber} - ${group.regimeType}`,
    });

    totalTaxable += group.taxableAmount;
    totalTax += group.taxAmount;
  }

  const accountCodes = [...new Set(pendingLines.filter((l) => l.kind === "auto").map((l) => l.accountCode))];
  const autoAccounts = accountCodes.length > 0 ? await prisma.account.findMany({ where: { companyId, code: { in: accountCodes } } }) : [];
  const autoAccountsByCode = new Map(autoAccounts.map((a) => [a.code, a]));
  if (autoAccounts.length !== accountCodes.length) {
    return { error: "Conti IVA standard (Erario c/IVA) non trovati nel piano dei conti." };
  }

  const resolvedLines = pendingLines.map((l) =>
    l.kind === "auto"
      ? { accountId: autoAccountsByCode.get(l.accountCode)!.id, debit: l.debit, credit: l.credit, description: l.description }
      : { accountId: l.accountId, debit: l.debit, credit: l.credit, description: l.description }
  );

  const grossTotal = round2(totalTaxable + totalTax);
  const counterpartDebit = isVenditaSide ? grossTotal : 0;
  const counterpartCredit = isVenditaSide ? 0 : grossTotal;
  resolvedLines.push({
    accountId: counterpartAccount.id,
    debit: round2(data.isCreditNote ? counterpartCredit : counterpartDebit),
    credit: round2(data.isCreditNote ? counterpartDebit : counterpartCredit),
    description: data.documentNumber,
  });

  const totalDebit = round2(resolvedLines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(resolvedLines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: `La registrazione non quadra: dare ${totalDebit.toFixed(2)} ≠ avere ${totalCredit.toFixed(2)}.` };
  }

  const entryId = await prisma.$transaction(async (tx) => {
    const lastNumber = await tx.journalEntry.aggregate({ where: { companyId, fiscalYearId: data.fiscalYearId }, _max: { number: true } });
    const number = (lastNumber._max.number ?? 0) + 1;

    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        fiscalYearId: data.fiscalYearId,
        causaleId: data.causaleId,
        number,
        date: new Date(data.documentDate),
        description: data.description,
        documentNumber: data.documentNumber,
        documentDate: new Date(data.documentDate),
        partnerId: partner.id,
        status: "POSTED",
        postedAt: new Date(),
        lines: { create: resolvedLines.map((l, idx) => ({ ...l, sortOrder: idx })) },
      },
    });

    for (const movement of movements) {
      const register = await tx.ivaRegister.findUnique({
        where: { companyId_type_sectionalCode: { companyId, type: movement.registerType, sectionalCode: movement.sectionalCode } },
      });
      if (!register) throw new Error(`Registro IVA ${movement.registerType}/${movement.sectionalCode} non trovato.`);

      const lastProtocol = await tx.ivaMovement.aggregate({
        where: { ivaRegisterId: register.id, fiscalYearId: data.fiscalYearId },
        _max: { protocolNumber: true },
      });
      const protocolNumber = (lastProtocol._max.protocolNumber ?? 0) + 1;

      await tx.ivaMovement.create({
        data: {
          companyId,
          fiscalYearId: data.fiscalYearId,
          ivaRegisterId: register.id,
          journalEntryId: entry.id,
          partnerId: partner.id,
          protocolNumber,
          documentDate: new Date(data.documentDate),
          documentNumber: data.documentNumber,
          regimeType: movement.regimeType,
          taxableAmount: round2(movement.taxableAmount * sign),
          vatRate: movement.vatRate,
          taxAmount: round2(movement.taxAmount * sign),
          naturaCode: movement.naturaCode,
        },
      });
    }

    return entry.id;
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/import-fatture`);
  redirect(`/t/${tenantId}/c/${companyId}/journal/${entryId}`);
}
