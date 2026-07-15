"use client";

import { useActionState, useMemo, useState } from "react";
import type { Account, CausaleContabile, FiscalYear, Partner } from "@/generated/prisma/client";
import { computeIvaEffects, type IvaComputationInput } from "@/lib/iva-engine";
import { createJournalEntryAction } from "@/lib/actions/journal";

type Line = {
  accountId: string;
  partnerId: string;
  description: string;
  debit: string;
  credit: string;
};

const REGIME_OPTIONS: Array<{ value: IvaComputationInput["regimeType"]; label: string }> = [
  { value: "ORDINARIA", label: "Ordinaria" },
  { value: "REVERSE_CHARGE_INTERNO", label: "Reverse charge interno" },
  { value: "REVERSE_CHARGE_ESTERO", label: "Reverse charge estero" },
  { value: "SPLIT_PAYMENT", label: "Split payment" },
  { value: "NON_IMPONIBILE", label: "Non imponibile (art. 8/8-bis/9/41)" },
  { value: "ESENTE", label: "Esente (art. 10)" },
  { value: "FUORI_CAMPO", label: "Fuori campo" },
  { value: "IVA_DIFFERITA", label: "IVA per cassa (differita)" },
];

function emptyLine(): Line {
  return { accountId: "", partnerId: "", description: "", debit: "", credit: "" };
}

export function JournalEntryForm({
  tenantId,
  companyId,
  fiscalYears,
  causali,
  accounts,
  partners,
}: {
  tenantId: string;
  companyId: string;
  fiscalYears: FiscalYear[];
  causali: CausaleContabile[];
  accounts: Account[];
  partners: Partner[];
}) {
  const [state, formAction, pending] = useActionState(createJournalEntryAction, undefined);

  const [fiscalYearId, setFiscalYearId] = useState(fiscalYears[0]?.id ?? "");
  const [causaleId, setCausaleId] = useState(causali[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);

  const [ivaRegimeType, setIvaRegimeType] = useState<IvaComputationInput["regimeType"]>("ORDINARIA");
  const [ivaTaxable, setIvaTaxable] = useState("");
  const [ivaRate, setIvaRate] = useState("22");
  const [ivaNaturaCode, setIvaNaturaCode] = useState("");

  const causale = causali.find((c) => c.id === causaleId);
  const needsIva = !!causale?.generatesIvaMovement;

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const ivaPreview = useMemo(() => {
    if (!needsIva || !causale?.ivaRegisterType) return null;
    const taxable = Number(ivaTaxable) || 0;
    const rate = Number(ivaRate) || 0;
    return computeIvaEffects({
      registerType: causale.ivaRegisterType,
      regimeType: ivaRegimeType,
      taxableAmount: taxable,
      vatRate: rate,
      naturaCode: ivaNaturaCode || undefined,
    });
  }, [needsIva, causale, ivaTaxable, ivaRate, ivaRegimeType, ivaNaturaCode]);

  const manualDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const manualCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const autoDebit = ivaPreview?.lines.reduce((s, l) => s + l.debit, 0) ?? 0;
  const autoCredit = ivaPreview?.lines.reduce((s, l) => s + l.credit, 0) ?? 0;
  const totalDebit = manualDebit + autoDebit;
  const totalCredit = manualCredit + autoCredit;
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  const linesJson = JSON.stringify(
    lines
      .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
      .map((l) => ({
        accountId: l.accountId,
        partnerId: l.partnerId || undefined,
        description: l.description || undefined,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }))
  );
  const ivaJson = needsIva
    ? JSON.stringify({
        regimeType: ivaRegimeType,
        taxableAmount: Number(ivaTaxable) || 0,
        vatRate: Number(ivaRate) || 0,
        naturaCode: ivaNaturaCode || undefined,
      })
    : "";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="fiscalYearId" value={fiscalYearId} />
      <input type="hidden" name="causaleId" value={causaleId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="documentNumber" value={documentNumber} />
      <input type="hidden" name="documentDate" value={documentDate} />
      <input type="hidden" name="partnerId" value={partnerId} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="linesJson" value={linesJson} />
      <input type="hidden" name="ivaJson" value={ivaJson} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Esercizio">
          <select value={fiscalYearId} onChange={(e) => setFiscalYearId(e.target.value)} className="input">
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {new Date(fy.startDate).getFullYear()} ({fy.status})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Causale">
          <select value={causaleId} onChange={(e) => setCausaleId(e.target.value)} className="input">
            {causali.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data registrazione">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" required />
        </Field>
        <Field label="Anagrafica (opzionale)">
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="input">
            <option value="">—</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="N. documento">
          <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className="input" />
        </Field>
        <Field label="Data documento">
          <input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} className="input" />
        </Field>
      </div>

      <Field label="Descrizione">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="input"
          placeholder="es. Fattura n. 12 del 10/01 - Cliente Rossi"
        />
      </Field>

      <div>
        <h2 className="mb-2 text-sm font-medium">Righe dare / avere</h2>
        <div className="flex flex-col gap-2">
          {lines.map((line, idx) => {
            const account = accountsById.get(line.accountId);
            return (
              <div key={idx} className="grid grid-cols-[2fr_1.2fr_1fr_6rem_6rem_auto] items-center gap-2">
                <select
                  value={line.accountId}
                  onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                  className="input"
                >
                  <option value="">Seleziona conto…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
                <select
                  value={line.partnerId}
                  onChange={(e) => updateLine(idx, { partnerId: e.target.value })}
                  className="input"
                  disabled={!account?.isPartnerLedger}
                >
                  <option value="">{account?.isPartnerLedger ? "Seleziona anagrafica…" : "—"}</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Descrizione"
                  value={line.description}
                  onChange={(e) => updateLine(idx, { description: e.target.value })}
                  className="input"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Dare"
                  value={line.debit}
                  onChange={(e) => updateLine(idx, { debit: e.target.value, credit: "" })}
                  className="input text-right"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Avere"
                  value={line.credit}
                  onChange={(e) => updateLine(idx, { credit: e.target.value, debit: "" })}
                  className="input text-right"
                />
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-xs text-red-600 underline"
                >
                  rimuovi
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="mt-2 text-sm underline"
        >
          + Aggiungi riga
        </button>
      </div>

      {needsIva && (
        <div className="rounded border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-medium">Dati IVA ({causale?.ivaRegisterType})</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Regime">
              <select
                value={ivaRegimeType}
                onChange={(e) => setIvaRegimeType(e.target.value as IvaComputationInput["regimeType"])}
                className="input"
              >
                {REGIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Codice natura (se non imponibile/esente/RC)">
              <input value={ivaNaturaCode} onChange={(e) => setIvaNaturaCode(e.target.value)} className="input" placeholder="es. N6.1" />
            </Field>
            <Field label="Imponibile">
              <input type="number" step="0.01" value={ivaTaxable} onChange={(e) => setIvaTaxable(e.target.value)} className="input" />
            </Field>
            <Field label="Aliquota %">
              <input type="number" step="0.01" value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} className="input" />
            </Field>
          </div>
          {ivaPreview && ivaPreview.lines.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Genera automaticamente: {ivaPreview.lines.map((l) => `${l.description} ${(l.debit || l.credit).toFixed(2)}`).join(", ")}
            </p>
          )}
          {ivaPreview && ivaPreview.movements.length > 1 && (
            <p className="mt-1 text-xs text-gray-500">
              Doppia registrazione: {ivaPreview.movements.map((m) => `${m.registerType}/${m.sectionalCode}`).join(" + ")}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded border border-gray-200 p-3 text-sm">
        <span>
          Totale dare: <strong className="font-mono">{totalDebit.toFixed(2)}</strong> · Totale avere:{" "}
          <strong className="font-mono">{totalCredit.toFixed(2)}</strong>
        </span>
        <span className={balanced ? "text-green-700" : "text-red-600"}>
          {balanced ? "Quadratura OK" : "Non quadra"}
        </span>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || !balanced}
        className="self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Registrazione…" : "Registra in definitiva"}
      </button>

      <style jsx>{`
        .input {
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
          padding: 0.375rem 0.5rem;
          font-size: 0.875rem;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm" data-field={label}>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}
