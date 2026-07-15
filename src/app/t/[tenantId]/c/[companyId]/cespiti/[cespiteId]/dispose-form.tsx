"use client";

import { useActionState, useState } from "react";
import type { Account, FiscalYear } from "@/generated/prisma/client";
import { disposeCespiteAction } from "@/lib/actions/cespiti";

export function DisposeForm({
  tenantId,
  companyId,
  cespiteId,
  fiscalYears,
  bankAndCashAccounts,
  netBookValue,
}: {
  tenantId: string;
  companyId: string;
  cespiteId: string;
  fiscalYears: FiscalYear[];
  bankAndCashAccounts: Account[];
  netBookValue: number;
}) {
  const [state, formAction, pending] = useActionState(disposeCespiteAction, undefined);
  const [saleAmount, setSaleAmount] = useState("0");
  const gainLoss = (Number(saleAmount) || 0) - netBookValue;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border border-gray-300 bg-gray-50 p-4 text-sm">
      <h2 className="font-medium">Dismissione o cessione</h2>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="cespiteId" value={cespiteId} />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Esercizio
          <select name="fiscalYearId" defaultValue={fiscalYears[0]?.id} className="rounded border border-gray-300 px-2 py-1">
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {new Date(fy.startDate).getFullYear()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Data
          <input type="date" name="disposalDate" required className="rounded border border-gray-300 px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Corrispettivo di cessione (0 = dismissione senza corrispettivo)
          <input
            type="number"
            step="0.01"
            name="saleAmount"
            value={saleAmount}
            onChange={(e) => setSaleAmount(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Conto di incasso (se cessione)
          <select name="counterpartAccountId" className="rounded border border-gray-300 px-2 py-1">
            <option value="">—</option>
            {bankAndCashAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-gray-500">
        Valore netto contabile: <span className="font-mono">{netBookValue.toFixed(2)}</span> ·{" "}
        {gainLoss >= 0 ? "Plusvalenza" : "Minusvalenza"} stimata: <span className="font-mono">{Math.abs(gainLoss).toFixed(2)}</span>
      </p>

      {state?.error && <p className="text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="self-start rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Registrazione…" : "Registra dismissione/cessione"}
      </button>
    </form>
  );
}
