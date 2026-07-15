"use client";

import { useActionState, useEffect, useRef } from "react";
import { importBankStatementAction } from "@/lib/actions/bank";

export function ImportForm({ tenantId, companyId, bankAccountId }: { tenantId: string; companyId: string; bankAccountId: string }) {
  const [state, formAction, pending] = useActionState(importBankStatementAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const prevPending = useRef(pending);

  useEffect(() => {
    if (prevPending.current && !pending) formRef.current?.reset();
    prevPending.current = pending;
  }, [pending]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 rounded border border-gray-200 p-4 text-sm">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="bankAccountId" value={bankAccountId} />
      <div className="flex items-center gap-3">
        <input type="file" name="file" accept="application/pdf" required className="text-sm" />
        <button type="submit" disabled={pending} className="rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? "Importazione…" : "Importa estratto conto PDF"}
        </button>
      </div>
      {state?.error && <p className="text-amber-700">{state.error}</p>}
    </form>
  );
}
