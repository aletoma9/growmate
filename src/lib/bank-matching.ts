import { prisma } from "@/lib/prisma";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86400000));
}

function normalize(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export type MatchCandidate = {
  journalEntryId: string;
  journalLineId: string;
  entryNumber: number | null;
  entryDescription: string;
  entryDate: Date;
  amount: number;
  score: number; // 0-100
};

/**
 * Cerca partite aperte (righe di prima nota sul conto banca collegato, non
 * ancora riconciliate) compatibili con un movimento estratto conto, per
 * importo, data valuta e riferimenti testuali, con un punteggio di confidenza.
 */
export async function findMatchCandidates(
  companyId: string,
  bankLedgerAccountId: string,
  transaction: { amount: number; valueDate: Date; description: string }
): Promise<MatchCandidate[]> {
  const alreadyMatchedEntryIds = (
    await prisma.bankTransaction.findMany({
      where: { bankAccount: { companyId }, matchedJournalEntryId: { not: null } },
      select: { matchedJournalEntryId: true },
    })
  ).map((t) => t.matchedJournalEntryId!);

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: bankLedgerAccountId,
      journalEntry: {
        companyId,
        status: "POSTED",
        id: alreadyMatchedEntryIds.length > 0 ? { notIn: alreadyMatchedEntryIds } : undefined,
      },
    },
    include: { journalEntry: { include: { partner: true } } },
  });

  const normalizedDesc = normalize(transaction.description);
  const descTokens = normalizedDesc.split(" ").filter((t) => t.length >= 4);

  const candidates: MatchCandidate[] = lines.map((line) => {
    const amount = round2(Number(line.debit) - Number(line.credit));
    let score = 0;

    if (Math.abs(amount - transaction.amount) < 0.01) score += 60;
    else if (Math.abs(Math.abs(amount) - Math.abs(transaction.amount)) < 0.01) score += 20;

    const days = daysBetween(line.journalEntry.date, transaction.valueDate);
    if (days === 0) score += 20;
    else if (days <= 3) score += 12;
    else if (days <= 10) score += 5;

    const haystack = normalize(`${line.journalEntry.description} ${line.journalEntry.partner?.name ?? ""} ${line.journalEntry.documentNumber ?? ""}`);
    if (descTokens.some((t) => haystack.includes(t))) score += 20;

    return {
      journalEntryId: line.journalEntry.id,
      journalLineId: line.id,
      entryNumber: line.journalEntry.number,
      entryDescription: line.journalEntry.description,
      entryDate: line.journalEntry.date,
      amount,
      score: Math.min(100, score),
    };
  });

  return candidates.filter((c) => c.score >= 40).sort((a, b) => b.score - a.score);
}

/** Cerca una causale appresa (pattern ricorrente) applicabile a una descrizione. */
export async function findReconciliationRule(companyId: string, description: string) {
  const rules = await prisma.reconciliationRule.findMany({ where: { companyId }, include: { account: true } });
  const normalizedDesc = normalize(description);
  return rules.find((r) => normalizedDesc.includes(normalize(r.descriptionPattern))) ?? null;
}
