"use client";

import { useActionState } from "react";
import {
  confirmMatchAction,
  createEntryFromTransactionAction,
  ignoreTransactionAction,
  rejectMatchAction,
} from "@/lib/actions/bank";

type Transaction = {
  id: string;
  valueDate: string;
  description: string;
  amount: number;
  matchStatus: string;
  matchConfidence: number | null;
  matchedEntryNumber: number | null;
  matchedEntryDescription: string | null;
};

type Suggestion = { accountId: string; accountLabel: string; pattern: string } | null;

const STATUS_LABELS: Record<string, string> = {
  UNMATCHED: "Da riconciliare",
  SUGGESTED: "Da confermare",
  MATCHED: "Riconciliato",
  IGNORED: "Ignorato",
};

const STATUS_COLORS: Record<string, string> = {
  UNMATCHED: "bg-gray-100 text-gray-700",
  SUGGESTED: "bg-amber-100 text-amber-800",
  MATCHED: "bg-green-100 text-green-800",
  IGNORED: "bg-gray-100 text-gray-400",
};

function guessPattern(description: string): string {
  return description
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

export function TransactionRow({
  tenantId,
  companyId,
  transaction,
  suggestion,
  fiscalYears,
  causali,
  accounts,
}: {
  tenantId: string;
  companyId: string;
  transaction: Transaction;
  suggestion: Suggestion;
  fiscalYears: Array<{ id: string; year: number }>;
  causali: Array<{ id: string; label: string }>;
  accounts: Array<{ id: string; label: string }>;
}) {
  return (
    <>
      <tr className="border-b border-gray-100">
        <td className="py-2 pr-3">{new Date(transaction.valueDate).toLocaleDateString("it-IT")}</td>
        <td className="py-2 pr-3">{transaction.description}</td>
        <td className="py-2 pr-3 text-right font-mono">{transaction.amount.toFixed(2)}</td>
        <td className="py-2 pr-3">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[transaction.matchStatus]}`}>
            {STATUS_LABELS[transaction.matchStatus]}
            {transaction.matchConfidence != null && ` (${transaction.matchConfidence}%)`}
          </span>
        </td>
        <td className="py-2 text-xs">
          {transaction.matchStatus === "MATCHED" && (
            <div className="flex items-center gap-2">
              {transaction.matchedEntryNumber != null && <span className="text-gray-500">Reg. n. {transaction.matchedEntryNumber}</span>}
              <UndoButton tenantId={tenantId} companyId={companyId} transactionId={transaction.id} />
            </div>
          )}
          {transaction.matchStatus === "SUGGESTED" && (
            <div className="flex flex-col gap-1">
              <span className="text-gray-500">
                Reg. n. {transaction.matchedEntryNumber}: {transaction.matchedEntryDescription}
              </span>
              <div className="flex gap-2">
                <ConfirmButton tenantId={tenantId} companyId={companyId} transactionId={transaction.id} />
                <UndoButton tenantId={tenantId} companyId={companyId} transactionId={transaction.id} label="Rifiuta" />
              </div>
            </div>
          )}
          {transaction.matchStatus === "IGNORED" && (
            <UndoButton tenantId={tenantId} companyId={companyId} transactionId={transaction.id} label="Riattiva" />
          )}
        </td>
      </tr>
      {transaction.matchStatus === "UNMATCHED" && (
        <tr className="border-b border-gray-200 bg-gray-50">
          <td colSpan={5} className="py-2">
            <CreateEntryForm
              tenantId={tenantId}
              companyId={companyId}
              transactionId={transaction.id}
              suggestion={suggestion}
              defaultPattern={guessPattern(transaction.description)}
              fiscalYears={fiscalYears}
              causali={causali}
              accounts={accounts}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ConfirmButton({ tenantId, companyId, transactionId }: { tenantId: string; companyId: string; transactionId: string }) {
  const [, formAction, pending] = useActionState(confirmMatchAction, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <button type="submit" disabled={pending} className="rounded bg-black px-2 py-1 text-white disabled:opacity-50">
        Conferma
      </button>
    </form>
  );
}

function UndoButton({
  tenantId,
  companyId,
  transactionId,
  label = "Annulla",
}: {
  tenantId: string;
  companyId: string;
  transactionId: string;
  label?: string;
}) {
  const [, formAction, pending] = useActionState(rejectMatchAction, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <button type="submit" disabled={pending} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">
        {label}
      </button>
    </form>
  );
}

function IgnoreButton({ tenantId, companyId, transactionId }: { tenantId: string; companyId: string; transactionId: string }) {
  const [, formAction, pending] = useActionState(ignoreTransactionAction, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <button type="submit" disabled={pending} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">
        Ignora
      </button>
    </form>
  );
}

function CreateEntryForm({
  tenantId,
  companyId,
  transactionId,
  suggestion,
  defaultPattern,
  fiscalYears,
  causali,
  accounts,
}: {
  tenantId: string;
  companyId: string;
  transactionId: string;
  suggestion: Suggestion;
  defaultPattern: string;
  fiscalYears: Array<{ id: string; year: number }>;
  causali: Array<{ id: string; label: string }>;
  accounts: Array<{ id: string; label: string }>;
}) {
  const [state, formAction, pending] = useActionState(createEntryFromTransactionAction, undefined);

  return (
    <div className="flex flex-col gap-2 px-1">
      <form action={formAction} className="flex flex-wrap items-end gap-2 text-xs">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="transactionId" value={transactionId} />
        <label className="flex flex-col gap-0.5">
          <span className="text-gray-500">Esercizio</span>
          <select name="fiscalYearId" defaultValue={fiscalYears[0]?.id} className="rounded border border-gray-300 px-1 py-0.5">
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.year}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-gray-500">Causale</span>
          <select name="causaleId" className="rounded border border-gray-300 px-1 py-0.5">
            {causali.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-gray-500">Contropartita {suggestion && "(suggerita)"}</span>
          <select name="counterpartAccountId" defaultValue={suggestion?.accountId ?? ""} className="rounded border border-gray-300 px-1 py-0.5">
            <option value="">Seleziona conto…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-gray-500">Memorizza pattern per il futuro</span>
          <input name="rememberPattern" defaultValue={defaultPattern} className="rounded border border-gray-300 px-1 py-0.5" />
        </label>
        <button type="submit" disabled={pending} className="rounded bg-black px-2 py-1 text-white disabled:opacity-50">
          {pending ? "Registrazione…" : "Registra"}
        </button>
      </form>
      <div className="flex items-center gap-2">
        {state?.error && <p className="text-red-600">{state.error}</p>}
        <IgnoreButton tenantId={tenantId} companyId={companyId} transactionId={transactionId} />
      </div>
    </div>
  );
}
