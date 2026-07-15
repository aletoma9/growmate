"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createCespiteAction } from "@/lib/actions/cespiti";

const MINOR_GOOD_THRESHOLD = 516.46;

type CategoriaOption = { id: string; name: string; coefficientOrdinario: number };

export function CespiteList({
  tenantId,
  companyId,
  categorie,
}: {
  tenantId: string;
  companyId: string;
  categorie: CategoriaOption[];
}) {
  const [creating, setCreating] = useState(false);

  if (!creating) {
    return (
      <button
        onClick={() => setCreating(true)}
        className="self-start rounded bg-black px-3 py-2 text-sm font-medium text-white"
      >
        Nuovo cespite
      </button>
    );
  }

  return (
    <CespiteForm tenantId={tenantId} companyId={companyId} categorie={categorie} onDone={() => setCreating(false)} />
  );
}

function CespiteForm({
  tenantId,
  companyId,
  categorie,
  onDone,
}: {
  tenantId: string;
  companyId: string;
  categorie: CategoriaOption[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(createCespiteAction, undefined);
  const prevPending = useRef(pending);

  const [categoriaId, setCategoriaId] = useState(categorie[0]?.id ?? "");
  const categoria = categorie.find((c) => c.id === categoriaId);
  const [civilCoefficient, setCivilCoefficient] = useState(categoria ? Number(categoria.coefficientOrdinario) : 0);
  const [fiscalCoefficient, setFiscalCoefficient] = useState(categoria ? Number(categoria.coefficientOrdinario) : 0);
  const [historicalCost, setHistoricalCost] = useState("");
  const [accessoryCharges, setAccessoryCharges] = useState("0");
  const [isMinorGood, setIsMinorGood] = useState(false);

  useEffect(() => {
    if (prevPending.current && !pending && !state?.error) onDone();
    prevPending.current = pending;
  }, [pending, state, onDone]);

  function handleCategoriaChange(id: string) {
    setCategoriaId(id);
    const c = categorie.find((cat) => cat.id === id);
    if (c) {
      setCivilCoefficient(Number(c.coefficientOrdinario));
      setFiscalCoefficient(Number(c.coefficientOrdinario));
    }
  }

  const totalCost = (Number(historicalCost) || 0) + (Number(accessoryCharges) || 0);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border border-gray-300 bg-gray-50 p-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="companyId" value={companyId} />

      <div className="grid grid-cols-2 gap-3">
        <input name="description" placeholder="Descrizione del bene" required className="col-span-2 rounded border border-gray-300 px-2 py-1 text-sm" />
        <select
          name="categoriaId"
          value={categoriaId}
          onChange={(e) => handleCategoriaChange(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          {categorie.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({Number(c.coefficientOrdinario)}%)
            </option>
          ))}
        </select>
        <div />
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Data acquisto
          <input type="date" name="purchaseDate" required className="rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Data entrata in funzione
          <input type="date" name="activationDate" required className="rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Costo storico
          <input
            type="number"
            step="0.01"
            name="historicalCost"
            value={historicalCost}
            onChange={(e) => setHistoricalCost(e.target.value)}
            required
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Oneri accessori capitalizzati
          <input
            type="number"
            step="0.01"
            name="accessoryCharges"
            value={accessoryCharges}
            onChange={(e) => setAccessoryCharges(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Coefficiente civile %
          <input
            type="number"
            step="0.01"
            name="civilCoefficientPercent"
            value={civilCoefficient}
            onChange={(e) => setCivilCoefficient(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          Coefficiente fiscale % (DM 31/12/1988)
          <input
            type="number"
            step="0.01"
            name="fiscalCoefficientPercent"
            value={fiscalCoefficient}
            onChange={(e) => setFiscalCoefficient(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="firstYearReduced" defaultChecked />
        Riduzione al 50% nel primo anno (fiscale)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isMinorGood" checked={isMinorGood} onChange={(e) => setIsMinorGood(e.target.checked)} />
        Bene di costo unitario ≤ 516,46 € (deducibile integralmente)
        {totalCost > 0 && totalCost <= MINOR_GOOD_THRESHOLD && !isMinorGood && (
          <span className="text-xs text-amber-600">consigliato per questo importo</span>
        )}
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva cespite"}
        </button>
        <button type="button" onClick={onDone} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
          Annulla
        </button>
      </div>
    </form>
  );
}
