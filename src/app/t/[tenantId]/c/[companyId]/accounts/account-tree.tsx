"use client";

import { useActionState, useMemo, useState } from "react";
import type { Account } from "@/generated/prisma/client";
import { toggleAccountActiveAction } from "@/lib/actions/account";
import { AccountForm } from "./account-form";

const NATURE_LABELS: Record<string, string> = {
  ATTIVO: "Patrimoniale attivo",
  PASSIVO: "Patrimoniale passivo",
  COSTO: "Economico di costo",
  RICAVO: "Economico di ricavo",
  CONTO_ORDINE: "Conto d'ordine",
};

type FormTarget =
  | { mode: "create"; parentId: string | null }
  | { mode: "edit"; account: Account };

export function AccountTree({
  tenantId,
  companyId,
  accounts,
}: {
  tenantId: string;
  companyId: string;
  accounts: Account[];
}) {
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Account[]>();
    for (const account of accounts) {
      const key = account.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(account);
    }
    return map;
  }, [accounts]);

  function renderNodes(parentId: string | null, depth: number): React.ReactNode {
    const nodes = childrenByParent.get(parentId) ?? [];
    return nodes.map((account) => (
      <div key={account.id}>
        <AccountRow
          account={account}
          depth={depth}
          canHaveChildren={account.level !== "SOTTOCONTO"}
          onEdit={() => setFormTarget({ mode: "edit", account })}
          onAddChild={() => setFormTarget({ mode: "create", parentId: account.id })}
          tenantId={tenantId}
          companyId={companyId}
        />
        {formTarget?.mode === "create" && formTarget.parentId === account.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 1.5}rem` }} className="py-2">
            <AccountForm
              tenantId={tenantId}
              companyId={companyId}
              parentAccount={account}
              onDone={() => setFormTarget(null)}
            />
          </div>
        )}
        {formTarget?.mode === "edit" && formTarget.account.id === account.id && (
          <div style={{ paddingLeft: `${depth * 1.5}rem` }} className="py-2">
            <AccountForm
              tenantId={tenantId}
              companyId={companyId}
              existingAccount={account}
              onDone={() => setFormTarget(null)}
            />
          </div>
        )}
        {renderNodes(account.id, depth + 1)}
      </div>
    ));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded border border-gray-200">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
          <div>Conto</div>
          <div>Natura</div>
          <div>Voce di bilancio</div>
          <div>Azioni</div>
        </div>
        <div className="divide-y divide-gray-100">{renderNodes(null, 0)}</div>
      </div>

      {formTarget?.mode === "create" && formTarget.parentId === null && (
        <AccountForm tenantId={tenantId} companyId={companyId} onDone={() => setFormTarget(null)} />
      )}

      {!formTarget && (
        <button
          onClick={() => setFormTarget({ mode: "create", parentId: null })}
          className="self-start rounded bg-black px-3 py-2 text-sm font-medium text-white"
        >
          Nuovo mastro
        </button>
      )}
    </div>
  );
}

function AccountRow({
  account,
  depth,
  canHaveChildren,
  onEdit,
  onAddChild,
  tenantId,
  companyId,
}: {
  account: Account;
  depth: number;
  canHaveChildren: boolean;
  onEdit: () => void;
  onAddChild: () => void;
  tenantId: string;
  companyId: string;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-1.5 text-sm ${
        account.active ? "" : "opacity-40"
      }`}
    >
      <div style={{ paddingLeft: `${depth * 1.5}rem` }} className="flex items-center gap-2">
        <span className="font-mono text-xs text-gray-400">{account.code}</span>
        <span className={depth === 0 ? "font-semibold" : ""}>{account.name}</span>
        {account.isCashOrBank && <Badge>cassa/banca</Badge>}
        {account.isPartnerLedger && <Badge>partitario</Badge>}
      </div>
      <div className="text-xs text-gray-500">{NATURE_LABELS[account.nature]}</div>
      <div className="text-xs text-gray-400">{account.balanceSheetItem ?? "—"}</div>
      <div className="flex gap-2 text-xs">
        {canHaveChildren && (
          <button onClick={onAddChild} className="underline">
            + Sotto
          </button>
        )}
        <button onClick={onEdit} className="underline">
          Modifica
        </button>
        <ToggleActiveButton tenantId={tenantId} companyId={companyId} accountId={account.id} />
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{children}</span>;
}

function ToggleActiveButton({
  tenantId,
  companyId,
  accountId,
}: {
  tenantId: string;
  companyId: string;
  accountId: string;
}) {
  const [, formAction, pending] = useActionState(toggleAccountActiveAction, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" disabled={pending} className="underline">
        Attiva/disattiva
      </button>
    </form>
  );
}
