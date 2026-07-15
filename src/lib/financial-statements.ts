import { prisma } from "@/lib/prisma";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  nature: string;
  totalDebit: number;
  totalCredit: number;
  balance: number; // dare - avere
};

/** Bilancio di verifica: saldi per conto sulle registrazioni definitive dell'esercizio. */
export async function computeTrialBalance(companyId: string, fiscalYearId: string): Promise<TrialBalanceRow[]> {
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { companyId, fiscalYearId, status: "POSTED" },
    },
    include: { account: true },
  });

  const byAccount = new Map<string, TrialBalanceRow>();
  for (const line of lines) {
    const existing = byAccount.get(line.accountId) ?? {
      accountId: line.accountId,
      code: line.account.code,
      name: line.account.name,
      nature: line.account.nature,
      totalDebit: 0,
      totalCredit: 0,
      balance: 0,
    };
    existing.totalDebit += Number(line.debit);
    existing.totalCredit += Number(line.credit);
    byAccount.set(line.accountId, existing);
  }

  return [...byAccount.values()]
    .map((row) => ({ ...row, totalDebit: round2(row.totalDebit), totalCredit: round2(row.totalCredit), balance: round2(row.totalDebit - row.totalCredit) }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

const SP_ATTIVO_LABELS: Record<string, string> = {
  "SP.B.I": "Immobilizzazioni immateriali",
  "SP.B.I.1": "Costi di impianto e ampliamento",
  "SP.B.I.3": "Diritti di brevetto e software",
  "SP.B.I.4": "Concessioni, licenze e marchi",
  "SP.B.I.7": "Altre immobilizzazioni immateriali",
  "SP.B.II": "Immobilizzazioni materiali",
  "SP.B.II.1": "Terreni e fabbricati",
  "SP.B.II.2": "Impianti e macchinario",
  "SP.B.II.3": "Attrezzature industriali e commerciali",
  "SP.B.II.4": "Altri beni materiali",
  "SP.B.III": "Immobilizzazioni finanziarie",
  "SP.B.III.1": "Partecipazioni",
  "SP.B.III.2": "Crediti finanziari immobilizzati",
  "SP.C.I": "Rimanenze",
  "SP.C.I.1": "Materie prime, sussidiarie e di consumo",
  "SP.C.I.4": "Prodotti finiti e merci",
  "SP.C.II": "Crediti",
  "SP.C.II.1": "Crediti verso clienti",
  "SP.C.II.4-bis": "Crediti tributari",
  "SP.C.II.5": "Crediti diversi",
  "SP.C.IV": "Disponibilità liquide",
  "SP.C.IV.1": "Depositi bancari e postali",
  "SP.C.IV.3": "Denaro e valori in cassa",
  "SP.D": "Ratei e risconti attivi",
};

const SP_PASSIVO_LABELS: Record<string, string> = {
  "SP.A.I": "Capitale sociale",
  "SP.A.IV": "Riserva legale",
  "SP.A.VI": "Altre riserve",
  "SP.A.VIII": "Utili (perdite) portati a nuovo",
  "SP.A.IX": "Utile (perdita) dell'esercizio",
  "SP.B": "Fondi per rischi e oneri",
  "SP.B.2": "Fondo imposte differite",
  "SP.C": "Trattamento di fine rapporto",
  "SP.D.4": "Debiti verso banche",
  "SP.D.7": "Debiti verso fornitori",
  "SP.D.12": "Debiti tributari",
  "SP.D.13": "Debiti verso istituti previdenziali",
  "SP.D.14": "Altri debiti",
  "SP.E": "Ratei e risconti passivi",
};

const CE_LABELS: Record<string, string> = {
  "CE.A.1": "Ricavi delle vendite e delle prestazioni",
  "CE.A.5": "Altri ricavi e proventi",
  "CE.B.6": "Costi per materie prime, sussidiarie, di consumo e merci",
  "CE.B.7": "Costi per servizi",
  "CE.B.8": "Costi per godimento di beni di terzi",
  "CE.B.9.a": "Salari e stipendi",
  "CE.B.9.b": "Oneri sociali",
  "CE.B.9.c": "Trattamento di fine rapporto",
  "CE.B.10.a": "Ammortamento immobilizzazioni immateriali",
  "CE.B.10.b": "Ammortamento immobilizzazioni materiali",
  "CE.B.10.d": "Svalutazione crediti",
  "CE.B.11": "Variazione delle rimanenze",
  "CE.B.14": "Oneri diversi di gestione",
  "CE.C.16": "Proventi finanziari",
  "CE.C.17": "Interessi e altri oneri finanziari",
  "CE.20": "Imposte sul reddito dell'esercizio",
};

export type StatementGroup = {
  code: string;
  label: string;
  total: number;
  accounts: Array<{ code: string; name: string; balance: number }>;
};

function buildGroups(
  rows: Array<TrialBalanceRow & { balanceSheetItem: string | null }>,
  labels: Record<string, string>,
  sign: 1 | -1
): StatementGroup[] {
  const groups = new Map<string, StatementGroup>();
  for (const row of rows) {
    const code = row.balanceSheetItem ?? "ALTRO";
    const label = labels[code] ?? (code === "ALTRO" ? "Non riclassificato" : code);
    const group = groups.get(code) ?? { code, label, total: 0, accounts: [] };
    const balance = round2(row.balance * sign);
    group.total = round2(group.total + balance);
    group.accounts.push({ code: row.code, name: row.name, balance });
    groups.set(code, group);
  }
  return [...groups.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export type FinancialStatements = {
  attivo: StatementGroup[];
  passivo: StatementGroup[];
  valoreProduzione: StatementGroup[];
  costiProduzione: StatementGroup[];
  proventiOneriFinanziari: StatementGroup[];
  imposte: StatementGroup[];
  totaleAttivo: number;
  totalePassivo: number;
  totaleValoreProduzione: number;
  totaleCostiProduzione: number;
  risultatoOperativo: number;
  saldoFinanziario: number;
  risultatoEsercizio: number;
  quadra: boolean;
};

/** Riclassifica il bilancio di verifica secondo lo schema civilistico SP (2424) / CE (2425). */
export async function computeFinancialStatements(companyId: string, fiscalYearId: string): Promise<FinancialStatements> {
  const trialBalance = await computeTrialBalance(companyId, fiscalYearId);
  const accounts = await prisma.account.findMany({ where: { companyId }, select: { id: true, balanceSheetItem: true } });
  const balanceSheetItemByAccountId = new Map(accounts.map((a) => [a.id, a.balanceSheetItem]));

  const rowsWithItem = trialBalance.map((row) => ({
    ...row,
    balanceSheetItem: balanceSheetItemByAccountId.get(row.accountId) ?? null,
  }));

  const attivoRows = rowsWithItem.filter((r) => r.nature === "ATTIVO");
  const passivoRows = rowsWithItem.filter((r) => r.nature === "PASSIVO");
  const ricavoRows = rowsWithItem.filter((r) => r.nature === "RICAVO");
  const costoRows = rowsWithItem.filter((r) => r.nature === "COSTO");

  const attivo = buildGroups(attivoRows, SP_ATTIVO_LABELS, 1);
  const passivo = buildGroups(passivoRows, SP_PASSIVO_LABELS, -1);

  const ceRicavi = buildGroups(ricavoRows, CE_LABELS, -1);
  const ceCosti = buildGroups(costoRows, CE_LABELS, 1);

  const valoreProduzione = ceRicavi.filter((g) => !g.code.startsWith("CE.C"));
  const proventiFinanziari = ceRicavi.filter((g) => g.code.startsWith("CE.C"));
  const costiProduzione = ceCosti.filter((g) => !g.code.startsWith("CE.C") && g.code !== "CE.20");
  const oneriFinanziari = ceCosti.filter((g) => g.code.startsWith("CE.C"));
  const imposte = ceCosti.filter((g) => g.code === "CE.20");

  const totaleValoreProduzione = round2(valoreProduzione.reduce((s, g) => s + g.total, 0));
  const totaleCostiProduzione = round2(costiProduzione.reduce((s, g) => s + g.total, 0));
  const risultatoOperativo = round2(totaleValoreProduzione - totaleCostiProduzione);

  const totaleProventiFinanziari = round2(proventiFinanziari.reduce((s, g) => s + g.total, 0));
  const totaleOneriFinanziari = round2(oneriFinanziari.reduce((s, g) => s + g.total, 0));
  const saldoFinanziario = round2(totaleProventiFinanziari - totaleOneriFinanziari);

  const totaleImposte = round2(imposte.reduce((s, g) => s + g.total, 0));
  const risultatoEsercizio = round2(risultatoOperativo + saldoFinanziario - totaleImposte);

  // Il risultato d'esercizio calcolato dal CE sostituisce il saldo (spesso ancora a zero
  // prima delle scritture di chiusura) della voce SP.A.IX, per un bilancio interinale coerente.
  const passivoWithResult = passivo.map((g) =>
    g.code === "SP.A.IX" ? { ...g, total: risultatoEsercizio } : g
  );
  if (!passivoWithResult.some((g) => g.code === "SP.A.IX")) {
    passivoWithResult.push({ code: "SP.A.IX", label: SP_PASSIVO_LABELS["SP.A.IX"], total: risultatoEsercizio, accounts: [] });
  }

  const totaleAttivo = round2(attivo.reduce((s, g) => s + g.total, 0));
  const totalePassivo = round2(passivoWithResult.reduce((s, g) => s + g.total, 0));

  return {
    attivo,
    passivo: passivoWithResult.sort((a, b) => a.code.localeCompare(b.code)),
    valoreProduzione,
    costiProduzione,
    proventiOneriFinanziari: [...proventiFinanziari, ...oneriFinanziari],
    imposte,
    totaleAttivo,
    totalePassivo,
    totaleValoreProduzione,
    totaleCostiProduzione,
    risultatoOperativo,
    saldoFinanziario,
    risultatoEsercizio,
    quadra: Math.abs(totaleAttivo - totalePassivo) < 0.01,
  };
}
