"use client";

import { useActionState, useState } from "react";
import { parseInvoiceXmlAction, createEntryFromInvoiceAction, type InvoicePreview } from "@/lib/actions/sdi";
import { computeIvaEffects, type IvaComputationInput } from "@/lib/iva-engine";

type CausaleOption = { id: string; code: string; name: string; type: string };
type AccountOption = { id: string; code: string; name: string; nature: string; isPartnerLedger: boolean };
type PartnerOption = { id: string; name: string; vatNumber: string | null; taxCode: string | null };

const REGIME_LABELS: Record<string, string> = {
  ORDINARIA: "Ordinaria",
  REVERSE_CHARGE_INTERNO: "Reverse charge interno",
  REVERSE_CHARGE_ESTERO: "Reverse charge estero",
  SPLIT_PAYMENT: "Split payment",
  NON_IMPONIBILE: "Non imponibile",
  ESENTE: "Esente",
  FUORI_CAMPO: "Fuori campo",
  IVA_DIFFERITA: "IVA per cassa",
};

export function InvoiceImportForm({
  tenantId,
  companyId,
  fiscalYears,
  causali,
  accounts,
  partners,
}: {
  tenantId: string;
  companyId: string;
  fiscalYears: Array<{ id: string; year: number }>;
  causali: CausaleOption[];
  accounts: AccountOption[];
  partners: PartnerOption[];
}) {
  const [parseState, parseAction, parsing] = useActionState(parseInvoiceXmlAction, undefined);

  return (
    <div className="flex flex-col gap-6">
      <form action={parseAction} className="flex items-center gap-3 rounded border border-gray-200 p-4 text-sm">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="companyId" value={companyId} />
        <input type="file" name="file" accept=".xml,text/xml,application/xml" required />
        <button type="submit" disabled={parsing} className="rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {parsing ? "Lettura…" : "Leggi fattura XML"}
        </button>
      </form>
      {parseState?.error && <p className="text-sm text-red-600">{parseState.error}</p>}

      {parseState?.preview && (
        <ReviewForm
          tenantId={tenantId}
          companyId={companyId}
          preview={parseState.preview}
          fiscalYears={fiscalYears}
          causali={causali}
          accounts={accounts}
          partners={partners}
        />
      )}
    </div>
  );
}

function ReviewForm({
  tenantId,
  companyId,
  preview,
  fiscalYears,
  causali,
  accounts,
  partners,
}: {
  tenantId: string;
  companyId: string;
  preview: InvoicePreview;
  fiscalYears: Array<{ id: string; year: number }>;
  causali: CausaleOption[];
  accounts: AccountOption[];
  partners: PartnerOption[];
}) {
  const [state, formAction, pending] = useActionState(createEntryFromInvoiceAction, undefined);

  const matchingCausali = causali.filter((c) => {
    const wantsCredit = preview.isCreditNote;
    const wantsVendita = preview.direction === "VENDITA";
    if (wantsVendita) return wantsCredit ? c.type === "NOTA_CREDITO_VENDITA" : c.type === "FATTURA_VENDITA";
    return wantsCredit ? c.type === "NOTA_CREDITO_ACQUISTO" : c.type === "FATTURA_ACQUISTO";
  });
  const [causaleId, setCausaleId] = useState(preview.suggestedCausaleId ?? matchingCausali[0]?.id ?? causali[0]?.id ?? "");
  const [fiscalYearId, setFiscalYearId] = useState(fiscalYears[0]?.id ?? "");
  const [documentDate, setDocumentDate] = useState(preview.documentDate);
  const [description, setDescription] = useState(`${preview.documentType} ${preview.documentNumber} - ${preview.partner.name}`);

  const counterpartOptions = accounts.filter(
    (a) => a.isPartnerLedger && a.nature === (preview.direction === "VENDITA" ? "ATTIVO" : "PASSIVO")
  );
  const [counterpartAccountId, setCounterpartAccountId] = useState(counterpartOptions[0]?.id ?? "");

  const [partnerId, setPartnerId] = useState(preview.existingPartnerId ?? "__new__");
  const [newPartnerName, setNewPartnerName] = useState(preview.partner.name);

  const revenueCostOptions = accounts.filter((a) => a.nature === (preview.direction === "VENDITA" ? "RICAVO" : "COSTO"));
  const [groupAccountIds, setGroupAccountIds] = useState<string[]>(preview.vatGroups.map(() => revenueCostOptions[0]?.id ?? ""));

  const isVenditaSide = matchingCausali.find((c) => c.id === causaleId)?.type.includes("VENDITA") ?? preview.direction === "VENDITA";

  let previewDebit = 0;
  let previewCredit = 0;
  for (const g of preview.vatGroups) {
    const effects = computeIvaEffects({
      registerType: isVenditaSide ? "VENDITE" : "ACQUISTI",
      regimeType: g.regimeType as IvaComputationInput["regimeType"],
      taxableAmount: g.taxableAmount,
      vatRate: g.vatRate,
      naturaCode: g.naturaCode,
    });
    previewDebit += effects.lines.reduce((s, l) => s + l.debit, 0);
    previewCredit += effects.lines.reduce((s, l) => s + l.credit, 0);
    if (isVenditaSide) previewCredit += g.taxableAmount;
    else previewDebit += g.taxableAmount;
  }
  const grossTotalPreview = preview.vatGroups.reduce((s, g) => s + g.taxableAmount + g.taxAmount, 0);
  if (isVenditaSide) previewDebit += grossTotalPreview;
  else previewCredit += grossTotalPreview;
  const preview_totals = { debit: previewDebit, credit: previewCredit };

  const vatGroupsJson = JSON.stringify(
    preview.vatGroups.map((g, idx) => ({
      taxableAmount: g.taxableAmount,
      vatRate: g.vatRate,
      taxAmount: g.taxAmount,
      regimeType: g.regimeType,
      naturaCode: g.naturaCode,
      accountId: groupAccountIds[idx],
    }))
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded border border-gray-200 p-4 text-sm">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="fiscalYearId" value={fiscalYearId} />
      <input type="hidden" name="causaleId" value={causaleId} />
      <input type="hidden" name="documentNumber" value={preview.documentNumber} />
      <input type="hidden" name="documentDate" value={documentDate} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="isCreditNote" value={String(preview.isCreditNote)} />
      <input type="hidden" name="direction" value={preview.direction} />
      <input type="hidden" name="counterpartAccountId" value={counterpartAccountId} />
      <input type="hidden" name="vatGroupsJson" value={vatGroupsJson} />
      {partnerId !== "__new__" && <input type="hidden" name="partnerId" value={partnerId} />}
      {partnerId === "__new__" && <input type="hidden" name="newPartnerName" value={newPartnerName} />}
      {partnerId === "__new__" && preview.partner.vatNumber && <input type="hidden" name="newPartnerVatNumber" value={preview.partner.vatNumber} />}
      {partnerId === "__new__" && preview.partner.taxCode && <input type="hidden" name="newPartnerTaxCode" value={preview.partner.taxCode} />}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-600">Direzione</p>
          <p>{preview.direction === "VENDITA" ? "Fattura emessa" : "Fattura ricevuta"} ({preview.documentType})</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600">Totale documento</p>
          <p className="font-mono">{preview.totalAmount.toFixed(2)}</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Causale</span>
          <select value={causaleId} onChange={(e) => setCausaleId(e.target.value)} className="input">
            {matchingCausali.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Esercizio</span>
          <select value={fiscalYearId} onChange={(e) => setFiscalYearId(e.target.value)} className="input">
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.year}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Data registrazione</span>
          <input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Conto {preview.direction === "VENDITA" ? "Clienti" : "Fornitori"}</span>
          <select value={counterpartAccountId} onChange={(e) => setCounterpartAccountId(e.target.value)} className="input">
            {counterpartOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">Descrizione</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
      </label>

      <div>
        <p className="mb-1 text-xs font-medium text-gray-600">Anagrafica</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="input">
            <option value="__new__">— Crea nuova anagrafica —</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.vatNumber ? `(${p.vatNumber})` : ""}
              </option>
            ))}
          </select>
          {partnerId === "__new__" && (
            <input
              value={newPartnerName}
              onChange={(e) => setNewPartnerName(e.target.value)}
              placeholder="Ragione sociale"
              className="input flex-1"
            />
          )}
        </div>
        {partnerId === "__new__" && (preview.partner.vatNumber || preview.partner.taxCode) && (
          <p className="mt-1 text-xs text-gray-400">
            P.IVA/CF da XML: {preview.partner.vatNumber ?? preview.partner.taxCode}
          </p>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-gray-600">Righe IVA (da XML)</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-1 pr-2">Imponibile</th>
              <th className="py-1 pr-2">Aliquota</th>
              <th className="py-1 pr-2">Imposta</th>
              <th className="py-1 pr-2">Regime</th>
              <th className="py-1">Conto {preview.direction === "VENDITA" ? "ricavo" : "costo"}</th>
            </tr>
          </thead>
          <tbody>
            {preview.vatGroups.map((g, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-1 pr-2 font-mono">{g.taxableAmount.toFixed(2)}</td>
                <td className="py-1 pr-2 font-mono">{g.vatRate.toFixed(2)}%</td>
                <td className="py-1 pr-2 font-mono">{g.taxAmount.toFixed(2)}</td>
                <td className="py-1 pr-2">{REGIME_LABELS[g.regimeType] ?? g.regimeType}</td>
                <td className="py-1">
                  <select
                    value={groupAccountIds[idx]}
                    onChange={(e) =>
                      setGroupAccountIds((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                    }
                    className="input"
                  >
                    {revenueCostOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Anteprima totali: dare <span className="font-mono">{preview_totals.debit.toFixed(2)}</span> · avere{" "}
        <span className="font-mono">{preview_totals.credit.toFixed(2)}</span>
      </p>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Registrazione…" : "Conferma e registra"}
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
