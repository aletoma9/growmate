"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { extractText, getDocumentProxy } from "unpdf";
import { prisma } from "@/lib/prisma";
import { requireCompanyAccess } from "@/lib/tenant";
import { parseGenericTabularStatement } from "@/lib/bank-statement-parser";
import { findMatchCandidates } from "@/lib/bank-matching";
import type { ActionState } from "@/lib/actions/auth";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const createBankAccountSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  accountId: z.string().min(1),
  iban: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
});

export async function createBankAccountAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = createBankAccountSchema.safeParse({
    tenantId,
    companyId,
    accountId: formData.get("accountId"),
    iban: formData.get("iban") || undefined,
    bankName: formData.get("bankName") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  const account = await prisma.account.findFirst({ where: { id: parsed.data.accountId, companyId, isCashOrBank: true } });
  if (!account) return { error: "Conto banca/cassa non valido." };

  await prisma.bankAccount.create({
    data: { companyId, accountId: account.id, iban: parsed.data.iban, bankName: parsed.data.bankName },
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/banche`);
}

const importSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  bankAccountId: z.string().min(1),
});

export async function importBankStatementAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = importSchema.safeParse({ tenantId, companyId, bankAccountId: formData.get("bankAccountId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  const bankAccount = await prisma.bankAccount.findFirst({ where: { id: parsed.data.bankAccountId, companyId } });
  if (!bankAccount) return { error: "Conto bancario non valido." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Carica un file PDF." };

  const buffer = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try {
    const pdf = await getDocumentProxy(buffer);
    // mergePages:true collasserebbe gli "a capo" tra i movimenti in un unico
    // blocco di testo, rendendo impossibile l'estrazione riga per riga.
    const result = await extractText(pdf, { mergePages: false });
    text = result.text.join("\n");
  } catch (err) {
    console.error("PDF parse error", err);
    return { error: "Impossibile leggere il PDF: file non valido o corrotto." };
  }

  const statement = parseGenericTabularStatement(text);
  if (statement.transactions.length === 0) {
    return { error: "Nessun movimento riconosciuto nel PDF. Il tracciato di questa banca potrebbe richiedere un template dedicato." };
  }

  const importRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.bankStatementImport.create({
      data: {
        bankAccountId: bankAccount.id,
        fileName: file.name,
        sourceFormat: statement.sourceFormat,
        openingBalance: statement.openingBalance ?? undefined,
        closingBalance: statement.closingBalance ?? undefined,
        status: statement.balanceReconciles === false ? "ERROR" : "VALIDATED",
      },
    });

    await tx.bankTransaction.createMany({
      data: statement.transactions.map((t) => ({
        bankAccountId: bankAccount.id,
        importId: created.id,
        operationDate: t.operationDate,
        valueDate: t.valueDate,
        amount: t.amount,
        description: t.description,
        balanceAfter: t.balanceAfter,
      })),
    });

    return created;
  });

  const transactions = await prisma.bankTransaction.findMany({ where: { importId: importRecord.id } });
  for (const transaction of transactions) {
    const candidates = await findMatchCandidates(companyId, bankAccount.accountId, {
      amount: Number(transaction.amount),
      valueDate: transaction.valueDate,
      description: transaction.description,
    });
    const best = candidates[0];
    if (!best) continue;
    await prisma.bankTransaction.update({
      where: { id: transaction.id },
      data: {
        matchStatus: best.score >= 90 ? "MATCHED" : "SUGGESTED",
        matchConfidence: best.score,
        matchedJournalEntryId: best.journalEntryId,
      },
    });
  }

  revalidatePath(`/t/${tenantId}/c/${companyId}/banche/${bankAccount.id}`);

  if (statement.balanceReconciles === false) {
    return {
      error: `Import completato ma il saldo non quadra: iniziale ${statement.openingBalance?.toFixed(2)} + movimenti ≠ finale ${statement.closingBalance?.toFixed(2)}. Verifica il tracciato.`,
    };
  }
}

const idSchema = z.object({ tenantId: z.string().min(1), companyId: z.string().min(1), transactionId: z.string().min(1) });

async function loadTransactionOrThrow(companyId: string, transactionId: string) {
  const transaction = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, bankAccount: { companyId } },
    include: { bankAccount: true },
  });
  if (!transaction) throw new Error("Movimento non trovato.");
  return transaction;
}

export async function confirmMatchAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };
  await requireCompanyAccess(tenantId, companyId);

  const parsed = idSchema.safeParse({ tenantId, companyId, transactionId: formData.get("transactionId") });
  if (!parsed.success) return { error: "Dati non validi." };

  const transaction = await loadTransactionOrThrow(companyId, parsed.data.transactionId);
  if (transaction.matchStatus !== "SUGGESTED") return { error: "Il movimento non è in stato di revisione." };

  await prisma.bankTransaction.update({ where: { id: transaction.id }, data: { matchStatus: "MATCHED" } });
  revalidatePath(`/t/${tenantId}/c/${companyId}/banche/${transaction.bankAccountId}`);
}

export async function rejectMatchAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };
  await requireCompanyAccess(tenantId, companyId);

  const parsed = idSchema.safeParse({ tenantId, companyId, transactionId: formData.get("transactionId") });
  if (!parsed.success) return { error: "Dati non validi." };

  const transaction = await loadTransactionOrThrow(companyId, parsed.data.transactionId);
  await prisma.bankTransaction.update({
    where: { id: transaction.id },
    data: { matchStatus: "UNMATCHED", matchedJournalEntryId: null, matchConfidence: null },
  });
  revalidatePath(`/t/${tenantId}/c/${companyId}/banche/${transaction.bankAccountId}`);
}

export async function ignoreTransactionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };
  await requireCompanyAccess(tenantId, companyId);

  const parsed = idSchema.safeParse({ tenantId, companyId, transactionId: formData.get("transactionId") });
  if (!parsed.success) return { error: "Dati non validi." };

  const transaction = await loadTransactionOrThrow(companyId, parsed.data.transactionId);
  await prisma.bankTransaction.update({ where: { id: transaction.id }, data: { matchStatus: "IGNORED" } });
  revalidatePath(`/t/${tenantId}/c/${companyId}/banche/${transaction.bankAccountId}`);
}

const createEntrySchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  transactionId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  causaleId: z.string().min(1),
  counterpartAccountId: z.string().min(1),
  rememberPattern: z.string().trim().optional(),
});

export async function createEntryFromTransactionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };
  await requireCompanyAccess(tenantId, companyId);

  const parsed = createEntrySchema.safeParse({
    tenantId,
    companyId,
    transactionId: formData.get("transactionId"),
    fiscalYearId: formData.get("fiscalYearId"),
    causaleId: formData.get("causaleId"),
    counterpartAccountId: formData.get("counterpartAccountId"),
    rememberPattern: formData.get("rememberPattern") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  const data = parsed.data;

  const transaction = await loadTransactionOrThrow(companyId, data.transactionId);
  if (transaction.matchStatus === "MATCHED") return { error: "Movimento già riconciliato." };

  const [fiscalYear, causale, counterpartAccount] = await Promise.all([
    prisma.fiscalYear.findFirst({ where: { id: data.fiscalYearId, companyId } }),
    prisma.causaleContabile.findFirst({ where: { id: data.causaleId, companyId } }),
    prisma.account.findFirst({ where: { id: data.counterpartAccountId, companyId } }),
  ]);
  if (!fiscalYear) return { error: "Esercizio non valido." };
  if (!causale) return { error: "Causale non valida." };
  if (!counterpartAccount) return { error: "Conto in contropartita non valido." };

  const amount = round2(Math.abs(Number(transaction.amount)));
  const isCredit = Number(transaction.amount) > 0; // accredito: banca in dare

  await prisma.$transaction(async (tx) => {
    const lastNumber = await tx.journalEntry.aggregate({ where: { companyId, fiscalYearId: data.fiscalYearId }, _max: { number: true } });
    const number = (lastNumber._max.number ?? 0) + 1;

    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        fiscalYearId: data.fiscalYearId,
        causaleId: data.causaleId,
        number,
        date: transaction.valueDate,
        description: transaction.description,
        status: "POSTED",
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: transaction.bankAccount.accountId,
              debit: isCredit ? amount : 0,
              credit: isCredit ? 0 : amount,
              sortOrder: 0,
            },
            {
              accountId: counterpartAccount.id,
              debit: isCredit ? 0 : amount,
              credit: isCredit ? amount : 0,
              sortOrder: 1,
            },
          ],
        },
      },
    });

    await tx.bankTransaction.update({
      where: { id: transaction.id },
      data: { matchStatus: "MATCHED", matchedJournalEntryId: entry.id, matchConfidence: 100 },
    });

    if (data.rememberPattern) {
      await tx.reconciliationRule.upsert({
        where: { companyId_descriptionPattern: { companyId, descriptionPattern: data.rememberPattern } },
        create: { companyId, descriptionPattern: data.rememberPattern, accountId: counterpartAccount.id, timesApplied: 1 },
        update: { accountId: counterpartAccount.id, timesApplied: { increment: 1 } },
      });
    }

    return entry.id;
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/banche/${transaction.bankAccountId}`);
}
