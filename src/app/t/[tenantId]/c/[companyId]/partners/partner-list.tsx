"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Partner } from "@/generated/prisma/client";
import { createPartnerAction, updatePartnerAction, togglePartnerActiveAction } from "@/lib/actions/partner";

const TYPE_LABELS: Record<string, string> = {
  CLIENTE: "Cliente",
  FORNITORE: "Fornitore",
  ENTRAMBI: "Cliente e fornitore",
};

export function PartnerList({
  tenantId,
  companyId,
  partners,
}: {
  tenantId: string;
  companyId: string;
  partners: Partner[];
}) {
  const [editing, setEditing] = useState<Partner | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3">Nome</th>
            <th className="py-2 pr-3">Tipo</th>
            <th className="py-2 pr-3">P.IVA / CF</th>
            <th className="py-2 pr-3">Termini pag.</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => (
            <tr key={p.id} className={`border-b border-gray-100 ${p.active ? "" : "opacity-40"}`}>
              <td className="py-2 pr-3">
                <Link href={`/t/${tenantId}/c/${companyId}/partners/${p.id}`} className="underline">
                  {p.name}
                </Link>
              </td>
              <td className="py-2 pr-3 text-gray-500">{TYPE_LABELS[p.type]}</td>
              <td className="py-2 pr-3 text-gray-500">{p.vatNumber ?? p.taxCode ?? "—"}</td>
              <td className="py-2 pr-3 text-gray-500">{p.paymentTermsDays ? `${p.paymentTermsDays}gg` : "—"}</td>
              <td className="py-2 flex gap-2 text-xs">
                <button onClick={() => setEditing(p)} className="underline">
                  Modifica
                </button>
                <ToggleActiveButton tenantId={tenantId} companyId={companyId} partnerId={p.id} />
              </td>
            </tr>
          ))}
          {partners.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-gray-500">
                Nessuna anagrafica ancora creata.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editing && (
        <PartnerForm
          tenantId={tenantId}
          companyId={companyId}
          existingPartner={editing}
          onDone={() => setEditing(null)}
        />
      )}

      {creating && (
        <PartnerForm tenantId={tenantId} companyId={companyId} onDone={() => setCreating(false)} />
      )}

      {!creating && !editing && (
        <button
          onClick={() => setCreating(true)}
          className="self-start rounded bg-black px-3 py-2 text-sm font-medium text-white"
        >
          Nuova anagrafica
        </button>
      )}
    </div>
  );
}

function ToggleActiveButton({
  tenantId,
  companyId,
  partnerId,
}: {
  tenantId: string;
  companyId: string;
  partnerId: string;
}) {
  const [, formAction, pending] = useActionState(togglePartnerActiveAction, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="partnerId" value={partnerId} />
      <button type="submit" disabled={pending} className="underline">
        Attiva/disattiva
      </button>
    </form>
  );
}

function PartnerForm({
  tenantId,
  companyId,
  existingPartner,
  onDone,
}: {
  tenantId: string;
  companyId: string;
  existingPartner?: Partner;
  onDone: () => void;
}) {
  const isEdit = !!existingPartner;
  const action = isEdit ? updatePartnerAction : createPartnerAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const prevPending = useRef(pending);

  useEffect(() => {
    if (prevPending.current && !pending && !state?.error) {
      onDone();
    }
    prevPending.current = pending;
  }, [pending, state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border border-gray-300 bg-gray-50 p-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      {isEdit && <input type="hidden" name="partnerId" value={existingPartner!.id} />}

      <div className="grid grid-cols-2 gap-3">
        <input
          name="name"
          defaultValue={existingPartner?.name}
          placeholder="Ragione sociale / nome"
          required
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <select name="type" defaultValue={existingPartner?.type ?? "CLIENTE"} className="rounded border border-gray-300 px-2 py-1 text-sm">
          <option value="CLIENTE">Cliente</option>
          <option value="FORNITORE">Fornitore</option>
          <option value="ENTRAMBI">Cliente e fornitore</option>
        </select>
        <input
          name="vatNumber"
          defaultValue={existingPartner?.vatNumber ?? ""}
          placeholder="Partita IVA"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          name="taxCode"
          defaultValue={existingPartner?.taxCode ?? ""}
          placeholder="Codice fiscale"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          name="address"
          defaultValue={existingPartner?.address ?? ""}
          placeholder="Indirizzo"
          className="col-span-2 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          name="iban"
          defaultValue={existingPartner?.iban ?? ""}
          placeholder="IBAN"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          name="paymentTermsDays"
          type="number"
          min={0}
          defaultValue={existingPartner?.paymentTermsDays ?? ""}
          placeholder="Termini di pagamento (gg)"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <SubmitButton pending={pending} />
        <button type="button" onClick={onDone} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
          Annulla
        </button>
      </div>
    </form>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
      {pending ? "Salvataggio…" : "Salva"}
    </button>
  );
}
