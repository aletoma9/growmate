"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Account } from "@/generated/prisma/client";
import { createAccountAction, updateAccountAction } from "@/lib/actions/account";

const NATURE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ATTIVO", label: "Patrimoniale attivo" },
  { value: "PASSIVO", label: "Patrimoniale passivo" },
  { value: "COSTO", label: "Economico di costo" },
  { value: "RICAVO", label: "Economico di ricavo" },
  { value: "CONTO_ORDINE", label: "Conto d'ordine" },
];

const BALANCE_SHEET_SUGGESTIONS = [
  "SP.A.I", "SP.A.IV", "SP.A.VIII", "SP.A.IX",
  "SP.B.I", "SP.B.II", "SP.B.III",
  "SP.C.I", "SP.C.II", "SP.C.IV",
  "SP.D", "SP.E",
  "CE.A.1", "CE.A.5", "CE.B.6", "CE.B.7", "CE.B.8", "CE.B.9.a", "CE.B.9.b", "CE.B.9.c",
  "CE.B.10.a", "CE.B.10.b", "CE.B.11", "CE.B.14",
  "CE.C.16", "CE.C.17", "CE.20",
];

export function AccountForm({
  tenantId,
  companyId,
  parentAccount,
  existingAccount,
  onDone,
}: {
  tenantId: string;
  companyId: string;
  parentAccount?: Account;
  existingAccount?: Account;
  onDone: () => void;
}) {
  const isEdit = !!existingAccount;
  const action = isEdit ? updateAccountAction : createAccountAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const prevPending = useRef(pending);

  useEffect(() => {
    if (prevPending.current && !pending && !state?.error) {
      onDone();
    }
    prevPending.current = pending;
  }, [pending, state, onDone]);

  const defaults = existingAccount ?? {
    code: "",
    name: "",
    nature: parentAccount?.nature ?? "ATTIVO",
    balanceSheetItem: parentAccount?.balanceSheetItem ?? "",
    isReconcilable: !parentAccount,
    isPartnerLedger: false,
    isCashOrBank: false,
  };

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border border-gray-300 bg-gray-50 p-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      {isEdit && <input type="hidden" name="accountId" value={existingAccount!.id} />}
      {!isEdit && parentAccount && <input type="hidden" name="parentId" value={parentAccount.id} />}

      <div className="grid grid-cols-[8rem_1fr] gap-2">
        <input
          name="code"
          defaultValue={defaults.code}
          placeholder="Codice"
          required
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          name="name"
          defaultValue={defaults.name}
          placeholder="Nome conto"
          required
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select name="nature" defaultValue={defaults.nature} className="rounded border border-gray-300 px-2 py-1 text-sm">
          {NATURE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          name="balanceSheetItem"
          defaultValue={defaults.balanceSheetItem ?? ""}
          placeholder="Voce di bilancio (es. SP.B.II)"
          list="balance-sheet-items"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <datalist id="balance-sheet-items">
          {BALANCE_SHEET_SUGGESTIONS.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <label className="flex items-center gap-1">
          <input type="checkbox" name="isReconcilable" defaultChecked={defaults.isReconcilable} />
          Movimentabile in prima nota
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="isPartnerLedger" defaultChecked={defaults.isPartnerLedger} />
          Richiede anagrafica (partitario)
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="isCashOrBank" defaultChecked={defaults.isCashOrBank} />
          Conto cassa/banca
        </label>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva"}
        </button>
        <button type="button" onClick={onDone} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
          Annulla
        </button>
      </div>
    </form>
  );
}
