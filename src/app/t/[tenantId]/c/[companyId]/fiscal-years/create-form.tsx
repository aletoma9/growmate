"use client";

import { useActionState } from "react";
import { createFiscalYearAction } from "@/lib/actions/fiscal-year";

export function CreateFiscalYearForm({ tenantId, companyId }: { tenantId: string; companyId: string }) {
  const [state, formAction, pending] = useActionState(createFiscalYearAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="startDate" className="text-sm font-medium">
            Data inizio
          </label>
          <input id="startDate" name="startDate" type="date" required className="rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="endDate" className="text-sm font-medium">
            Data fine
          </label>
          <input id="endDate" name="endDate" type="date" required className="rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creazione…" : "Crea esercizio"}
      </button>
    </form>
  );
}
