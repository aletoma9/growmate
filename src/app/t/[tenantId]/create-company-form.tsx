"use client";

import { useActionState } from "react";
import { createCompanyAction } from "@/lib/actions/company";

export function CreateCompanyForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState(createCompanyAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Ragione sociale
        </label>
        <input id="name" name="name" required className="rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="legalForm" className="text-sm font-medium">
            Forma giuridica
          </label>
          <select id="legalForm" name="legalForm" defaultValue="SRL" className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="SRL">S.r.l.</option>
            <option value="SRLS">S.r.l.s.</option>
            <option value="SPA">S.p.A.</option>
            <option value="SAPA">S.a.p.A.</option>
            <option value="ALTRA">Altra</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ivaSettlementPeriod" className="text-sm font-medium">
            Liquidazione IVA
          </label>
          <select
            id="ivaSettlementPeriod"
            name="ivaSettlementPeriod"
            defaultValue="MONTHLY"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="MONTHLY">Mensile</option>
            <option value="QUARTERLY">Trimestrale</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="vatNumber" className="text-sm font-medium">
            Partita IVA
          </label>
          <input id="vatNumber" name="vatNumber" className="rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="taxCode" className="text-sm font-medium">
            Codice fiscale
          </label>
          <input id="taxCode" name="taxCode" className="rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creazione…" : "Crea azienda"}
      </button>
    </form>
  );
}
