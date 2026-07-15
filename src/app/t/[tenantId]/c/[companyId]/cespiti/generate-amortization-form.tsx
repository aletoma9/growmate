"use client";

import { useActionState } from "react";
import type { FiscalYear } from "@/generated/prisma/client";
import { generateAmortizationEntriesAction } from "@/lib/actions/cespiti";

export function GenerateAmortizationForm({
  tenantId,
  companyId,
  fiscalYears,
}: {
  tenantId: string;
  companyId: string;
  fiscalYears: FiscalYear[];
}) {
  const [state, formAction, pending] = useActionState(generateAmortizationEntriesAction, undefined);

  return (
    <form action={formAction} className="flex items-end gap-3 rounded border border-gray-200 p-4 text-sm">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">Esercizio</span>
        <select name="fiscalYearId" defaultValue={fiscalYears[0]?.id} className="rounded border border-gray-300 px-2 py-1">
          {fiscalYears.map((fy) => (
            <option key={fy.id} value={fy.id}>
              {new Date(fy.startDate).getFullYear()}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Generazione…" : "Genera ammortamenti esercizio"}
      </button>
      {state?.error && <p className="text-amber-700">{state.error}</p>}
    </form>
  );
}
