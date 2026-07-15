"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCompanyAccess } from "@/lib/tenant";
import { computeIvaEffects } from "@/lib/iva-engine";
import { isDateLocked } from "@/lib/fiscal-period";
import type { ActionState } from "@/lib/actions/auth";

const lineSchema = z.object({
  accountId: z.string().min(1),
  partnerId: z.string().optional(),
  description: z.string().optional(),
  debit: z.coerce.number().min(0),
  credit: z.coerce.number().min(0),
});

const ivaInputSchema = z.object({
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
  taxableAmount: z.coerce.number().min(0),
  vatRate: z.coerce.number().min(0).max(100),
  naturaCode: z.string().trim().optional(),
});

const createEntrySchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  causaleId: z.string().min(1),
  date: z.string().min(1),
  documentNumber: z.string().trim().optional(),
  documentDate: z.string().optional(),
  partnerId: z.string().optional(),
  description: z.string().trim().min(1, "Descrizione obbligatoria"),
  lines: z.array(lineSchema).min(1, "Inserisci almeno una riga"),
  iva: ivaInputSchema.optional(),
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function createJournalEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  let linesRaw: unknown;
  let ivaRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get("linesJson") ?? "[]"));
    const ivaJson = formData.get("ivaJson");
    ivaRaw = ivaJson ? JSON.parse(String(ivaJson)) : undefined;
  } catch {
    return { error: "Righe non valide." };
  }

  const parsed = createEntrySchema.safeParse({
    tenantId,
    companyId,
    fiscalYearId: formData.get("fiscalYearId"),
    causaleId: formData.get("causaleId"),
    date: formData.get("date"),
    documentNumber: formData.get("documentNumber") || undefined,
    documentDate: formData.get("documentDate") || undefined,
    partnerId: formData.get("partnerId") || undefined,
    description: formData.get("description"),
    lines: linesRaw,
    iva: ivaRaw,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  const data = parsed.data;

  const [fiscalYear, causale, company] = await Promise.all([
    prisma.fiscalYear.findFirst({ where: { id: data.fiscalYearId, companyId } }),
    prisma.causaleContabile.findFirst({ where: { id: data.causaleId, companyId } }),
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
  ]);
  if (!fiscalYear) return { error: "Esercizio non valido." };
  if (!causale) return { error: "Causale non valida." };

  const entryDate = new Date(data.date);
  if (isDateLocked(entryDate, fiscalYear, company.ivaSettlementPeriod)) {
    return { error: "Il periodo di questa data è già stato bloccato per liquidazione IVA." };
  }
  if (entryDate < fiscalYear.startDate || entryDate > fiscalYear.endDate) {
    return { error: "La data non rientra nell'esercizio selezionato." };
  }

  if (causale.generatesIvaMovement && !data.iva) {
    return { error: "Questa causale richiede i dati IVA (imponibile, aliquota, regime)." };
  }

  const manualLines = data.lines.map((l) => ({ ...l, debit: round2(l.debit), credit: round2(l.credit) }));
  let autoLines: { accountCode: string; debit: number; credit: number; description: string }[] = [];
  let autoMovements: ReturnType<typeof computeIvaEffects>["movements"] = [];

  if (causale.generatesIvaMovement && data.iva) {
    if (!causale.ivaRegisterType) return { error: "Causale IVA senza registro configurato." };
    const effects = computeIvaEffects({
      registerType: causale.ivaRegisterType,
      regimeType: data.iva.regimeType,
      taxableAmount: data.iva.taxableAmount,
      vatRate: data.iva.vatRate,
      naturaCode: data.iva.naturaCode,
    });
    autoLines = effects.lines;
    autoMovements = effects.movements;
  }

  const accountIds = [...new Set(manualLines.map((l) => l.accountId))];
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds }, companyId } });
  if (accounts.length !== accountIds.length) return { error: "Uno o più conti selezionati non sono validi." };
  for (const line of manualLines) {
    const account = accounts.find((a) => a.id === line.accountId)!;
    if (account.isPartnerLedger && !line.partnerId) {
      return { error: `Il conto "${account.name}" richiede un'anagrafica cliente/fornitore.` };
    }
  }

  let autoAccountsByCode = new Map<string, { id: string }>();
  if (autoLines.length > 0) {
    const codes = [...new Set(autoLines.map((l) => l.accountCode))];
    const found = await prisma.account.findMany({ where: { companyId, code: { in: codes } } });
    if (found.length !== codes.length) {
      return { error: "Conti IVA standard (Erario c/IVA) non trovati nel piano dei conti." };
    }
    autoAccountsByCode = new Map(found.map((a) => [a.code, a]));
  }

  const totalDebit = round2(
    manualLines.reduce((s, l) => s + l.debit, 0) + autoLines.reduce((s, l) => s + l.debit, 0)
  );
  const totalCredit = round2(
    manualLines.reduce((s, l) => s + l.credit, 0) + autoLines.reduce((s, l) => s + l.credit, 0)
  );
  if (totalDebit !== totalCredit) {
    return { error: `La registrazione non quadra: dare ${totalDebit.toFixed(2)} ≠ avere ${totalCredit.toFixed(2)}.` };
  }
  if (totalDebit === 0) return { error: "L'importo totale non può essere zero." };

  const entryId = await prisma.$transaction(async (tx) => {
    const lastNumber = await tx.journalEntry.aggregate({
      where: { companyId, fiscalYearId: data.fiscalYearId },
      _max: { number: true },
    });
    const number = (lastNumber._max.number ?? 0) + 1;

    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        fiscalYearId: data.fiscalYearId,
        causaleId: data.causaleId,
        number,
        date: entryDate,
        description: data.description,
        documentNumber: data.documentNumber,
        documentDate: data.documentDate ? new Date(data.documentDate) : undefined,
        partnerId: data.partnerId,
        status: "POSTED",
        postedAt: new Date(),
        lines: {
          create: [
            ...manualLines.map((l, idx) => ({
              accountId: l.accountId,
              partnerId: l.partnerId,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              sortOrder: idx,
            })),
            ...autoLines.map((l, idx) => ({
              accountId: autoAccountsByCode.get(l.accountCode)!.id,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              sortOrder: manualLines.length + idx,
            })),
          ],
        },
      },
    });

    for (const movement of autoMovements) {
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
          partnerId: data.partnerId,
          protocolNumber,
          documentDate: data.documentDate ? new Date(data.documentDate) : entryDate,
          documentNumber: data.documentNumber ?? `#${number}`,
          regimeType: movement.regimeType,
          taxableAmount: movement.taxableAmount,
          vatRate: movement.vatRate,
          taxAmount: movement.taxAmount,
          naturaCode: movement.naturaCode,
        },
      });
    }

    return entry.id;
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/journal`);
  redirect(`/t/${tenantId}/c/${companyId}/journal/${entryId}`);
}

export async function stornoJournalEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  const entryId = formData.get("entryId");
  if (typeof tenantId !== "string" || typeof companyId !== "string" || typeof entryId !== "string") {
    return { error: "Parametri non validi." };
  }

  await requireCompanyAccess(tenantId, companyId);

  const original = await prisma.journalEntry.findFirst({
    where: { id: entryId, companyId },
    include: { lines: true, fiscalYear: true, reversedBy: true, ivaMovements: true },
  });
  if (!original) return { error: "Registrazione non trovata." };
  if (original.status !== "POSTED") return { error: "Solo le registrazioni definitive possono essere stornate." };
  if (original.reversedBy) return { error: "Questa registrazione è già stata stornata." };
  if (original.ivaMovements.length > 0) {
    return { error: "Le registrazioni con movimento IVA si correggono con una nota di credito, non con lo storno." };
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const today = new Date();
  if (isDateLocked(today, original.fiscalYear, company.ivaSettlementPeriod)) {
    return { error: "Il periodo corrente è bloccato: impossibile registrare lo storno." };
  }

  await prisma.$transaction(async (tx) => {
    const lastNumber = await tx.journalEntry.aggregate({
      where: { companyId, fiscalYearId: original.fiscalYearId },
      _max: { number: true },
    });
    const number = (lastNumber._max.number ?? 0) + 1;

    await tx.journalEntry.create({
      data: {
        companyId,
        fiscalYearId: original.fiscalYearId,
        causaleId: original.causaleId,
        number,
        date: today,
        description: `Storno di registrazione n. ${original.number}: ${original.description}`,
        partnerId: original.partnerId,
        status: "POSTED",
        postedAt: today,
        reversalOfId: original.id,
        lines: {
          create: original.lines.map((l, idx) => ({
            accountId: l.accountId,
            partnerId: l.partnerId,
            description: l.description,
            debit: l.credit,
            credit: l.debit,
            sortOrder: idx,
          })),
        },
      },
    });

    await tx.journalEntry.update({ where: { id: original.id }, data: { status: "STORNATA" } });
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/journal`);
}
