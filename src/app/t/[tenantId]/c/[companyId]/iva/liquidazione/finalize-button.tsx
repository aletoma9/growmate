"use client";

import { useActionState } from "react";
import { finalizeLiquidazioneAction } from "@/lib/actions/iva";

export function FinalizeButton({
  tenantId,
  companyId,
  fiscalYearId,
  period,
  acconto,
}: {
  tenantId: string;
  companyId: string;
  fiscalYearId: string;
  period: number;
  acconto: number;
}) {
  const [state, formAction, pending] = useActionState(finalizeLiquidazioneAction, undefined);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="fiscalYearId" value={fiscalYearId} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="acconto" value={acconto} />
      <button type="submit" disabled={pending} className="rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Registrazione…" : "Registra liquidazione definitiva"}
      </button>
      <p className="text-xs text-gray-500">
        La registrazione definitiva blocca le scritture del periodo per evitare modifiche
        retroattive ai registri IVA.
      </p>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
