"use client";

import { useActionState } from "react";
import { stornoJournalEntryAction } from "@/lib/actions/journal";

export function StornoButton({
  tenantId,
  companyId,
  entryId,
}: {
  tenantId: string;
  companyId: string;
  entryId: string;
}) {
  const [state, formAction, pending] = useActionState(stornoJournalEntryAction, undefined);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="entryId" value={entryId} />
      <button type="submit" disabled={pending} className="text-xs underline disabled:opacity-50">
        {pending ? "Storno…" : "Storna"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
