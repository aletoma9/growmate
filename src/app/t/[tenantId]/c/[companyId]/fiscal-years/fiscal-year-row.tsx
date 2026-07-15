"use client";

import { useActionState, useState } from "react";
import { lockFiscalYearAction, reopenFiscalYearAction } from "@/lib/actions/fiscal-year";
import type { FiscalYear } from "@/generated/prisma/client";

export function FiscalYearRow({
  tenantId,
  companyId,
  fiscalYear,
}: {
  tenantId: string;
  companyId: string;
  fiscalYear: FiscalYear;
}) {
  const [lockState, lockAction, lockPending] = useActionState(lockFiscalYearAction, undefined);
  const [reopenState, reopenAction, reopenPending] = useActionState(reopenFiscalYearAction, undefined);
  const [showLockForm, setShowLockForm] = useState(false);

  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="py-2">
        {new Date(fiscalYear.startDate).toLocaleDateString("it-IT")} –{" "}
        {new Date(fiscalYear.endDate).toLocaleDateString("it-IT")}
      </td>
      <td className="py-2">
        <StatusBadge status={fiscalYear.status} />
      </td>
      <td className="py-2">{fiscalYear.lastLockedIvaPeriod ?? "—"}</td>
      <td className="py-2">
        {fiscalYear.status === "OPEN" && !showLockForm && (
          <button onClick={() => setShowLockForm(true)} className="text-sm underline">
            Blocca periodo
          </button>
        )}
        {fiscalYear.status === "OPEN" && showLockForm && (
          <form action={lockAction} className="flex items-center gap-2">
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="fiscalYearId" value={fiscalYear.id} />
            <input
              name="lastLockedIvaPeriod"
              type="number"
              min={1}
              max={12}
              placeholder="Periodo IVA"
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button type="submit" disabled={lockPending} className="rounded bg-black px-2 py-1 text-sm text-white">
              Conferma
            </button>
          </form>
        )}
        {fiscalYear.status === "LOCKED" && (
          <form action={reopenAction}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="fiscalYearId" value={fiscalYear.id} />
            <button type="submit" disabled={reopenPending} className="text-sm underline">
              Riapri
            </button>
          </form>
        )}
        {lockState?.error && <p className="text-xs text-red-600">{lockState.error}</p>}
        {reopenState?.error && <p className="text-xs text-red-600">{reopenState.error}</p>}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "bg-green-100 text-green-800",
    LOCKED: "bg-amber-100 text-amber-800",
    CLOSED: "bg-gray-200 text-gray-700",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? ""}`}>{status}</span>
  );
}
