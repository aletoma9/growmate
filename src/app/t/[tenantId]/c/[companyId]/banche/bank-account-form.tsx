"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Account } from "@/generated/prisma/client";
import { createBankAccountAction } from "@/lib/actions/bank";

export function BankAccountForm({
  tenantId,
  companyId,
  ledgerAccounts,
}: {
  tenantId: string;
  companyId: string;
  ledgerAccounts: Account[];
}) {
  const [creating, setCreating] = useState(false);
  const [state, formAction, pending] = useActionState(createBankAccountAction, undefined);
  const prevPending = useRef(pending);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (prevPending.current && !pending && !state?.error) {
      setCreating(false);
      formRef.current?.reset();
    }
    prevPending.current = pending;
  }, [pending, state]);

  if (!creating) {
    return (
      <button onClick={() => setCreating(true)} className="self-start rounded bg-black px-3 py-2 text-sm font-medium text-white">
        Collega conto bancario
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded border border-gray-300 bg-gray-50 p-4 text-sm">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <div className="grid grid-cols-2 gap-3">
        <select name="accountId" required className="rounded border border-gray-300 px-2 py-1">
          <option value="">Seleziona conto di mastro…</option>
          {ledgerAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
        <input name="bankName" placeholder="Nome banca" className="rounded border border-gray-300 px-2 py-1" />
        <input name="iban" placeholder="IBAN" className="col-span-2 rounded border border-gray-300 px-2 py-1" />
      </div>
      {state?.error && <p className="text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva"}
        </button>
        <button type="button" onClick={() => setCreating(false)} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
          Annulla
        </button>
      </div>
    </form>
  );
}
