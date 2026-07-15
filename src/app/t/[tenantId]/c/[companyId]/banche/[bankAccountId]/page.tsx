import { notFound } from "next/navigation";
import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { findReconciliationRule } from "@/lib/bank-matching";
import { ImportForm } from "./import-form";
import { TransactionRow } from "./transaction-row";

export default async function BankAccountDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string; bankAccountId: string }>;
}) {
  const { tenantId, companyId, bankAccountId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId },
    include: { account: true },
  });
  if (!bankAccount) notFound();

  const [ledgerLines, imports, transactions, fiscalYears, causali, accounts] = await Promise.all([
    prisma.journalLine.findMany({
      where: { accountId: bankAccount.accountId, journalEntry: { companyId, status: "POSTED" } },
    }),
    prisma.bankStatementImport.findMany({ where: { bankAccountId }, orderBy: { importedAt: "desc" } }),
    prisma.bankTransaction.findMany({
      where: { bankAccountId },
      include: { matchedJournalEntry: { include: { causale: true } } },
      orderBy: { valueDate: "desc" },
    }),
    prisma.fiscalYear.findMany({ where: { companyId, status: { not: "CLOSED" } }, orderBy: { startDate: "desc" } }),
    prisma.causaleContabile.findMany({ where: { companyId, active: true, generatesIvaMovement: false }, orderBy: { code: "asc" } }),
    prisma.account.findMany({ where: { companyId, active: true, isReconcilable: true }, orderBy: { code: "asc" } }),
  ]);

  const saldoContabile = ledgerLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
  const latestImport = imports[0];
  const saldoEstrattoConto = latestImport?.closingBalance != null ? Number(latestImport.closingBalance) : null;
  const differenza = saldoEstrattoConto != null ? saldoContabile - saldoEstrattoConto : null;

  const suggestionByTransactionId = new Map<string, { accountId: string; accountLabel: string; pattern: string } | null>();
  for (const t of transactions) {
    if (t.matchStatus !== "UNMATCHED") continue;
    const rule = await findReconciliationRule(companyId, t.description);
    suggestionByTransactionId.set(
      t.id,
      rule ? { accountId: rule.accountId, accountLabel: `${rule.account.code} — ${rule.account.name}`, pattern: rule.descriptionPattern } : null
    );
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{bankAccount.account.name}</h1>
        <p className="text-sm text-gray-500">{bankAccount.bankName ?? ""} {bankAccount.iban ?? ""}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 rounded border border-gray-200 p-4 text-sm">
        <div>
          <p className="text-gray-500">Saldo contabile</p>
          <p className="font-mono text-lg">{saldoContabile.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-500">Saldo estratto conto (ultimo import)</p>
          <p className="font-mono text-lg">{saldoEstrattoConto != null ? saldoEstrattoConto.toFixed(2) : "—"}</p>
        </div>
        <div>
          <p className="text-gray-500">Differenza</p>
          <p className={`font-mono text-lg ${differenza != null && Math.abs(differenza) > 0.01 ? "text-red-600" : "text-green-700"}`}>
            {differenza != null ? differenza.toFixed(2) : "—"}
          </p>
        </div>
      </div>

      <ImportForm tenantId={tenantId} companyId={companyId} bankAccountId={bankAccountId} />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3">Data valuta</th>
            <th className="py-2 pr-3">Descrizione</th>
            <th className="py-2 pr-3 text-right">Importo</th>
            <th className="py-2 pr-3">Stato</th>
            <th className="py-2">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <TransactionRow
              key={t.id}
              tenantId={tenantId}
              companyId={companyId}
              transaction={{
                id: t.id,
                valueDate: t.valueDate.toISOString(),
                description: t.description,
                amount: Number(t.amount),
                matchStatus: t.matchStatus,
                matchConfidence: t.matchConfidence != null ? Number(t.matchConfidence) : null,
                matchedEntryNumber: t.matchedJournalEntry?.number ?? null,
                matchedEntryDescription: t.matchedJournalEntry?.description ?? null,
              }}
              suggestion={suggestionByTransactionId.get(t.id) ?? null}
              fiscalYears={fiscalYears.map((fy) => ({ id: fy.id, year: new Date(fy.startDate).getFullYear() }))}
              causali={causali.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` }))}
              accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} — ${a.name}` }))}
            />
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-gray-500">
                Nessun movimento importato.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
