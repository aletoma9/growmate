// Motore di estrazione dei movimenti da estratto conto PDF: un estrattore
// tabellare generico che tollera le variazioni di spaziatura tipiche del testo
// estratto da PDF. Per istituti con tracciati noti si possono aggiungere
// template dedicati (vedi BANK_TEMPLATES) che hanno la precedenza sul fallback.

export type ParsedTransaction = {
  operationDate: Date;
  valueDate: Date;
  amount: number; // positivo = accredito, negativo = addebito
  description: string;
  balanceAfter?: number;
};

export type ParsedStatement = {
  openingBalance: number | null;
  closingBalance: number | null;
  transactions: ParsedTransaction[];
  balanceReconciles: boolean | null; // null se non verificabile (saldi mancanti)
  sourceFormat: string;
};

const DATE_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;
const AMOUNT_RE = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;

function parseItalianNumber(raw: string): number {
  return Number(raw.replace(/\./g, "").replace(",", "."));
}

function parseItalianDate(day: string, month: string, year: string): Date {
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const SALDO_LINE_RE = /saldo\s+(iniziale|final[ei])/i;

/** Estrattore tabellare generico: due date + descrizione + importo + saldo opzionale. */
function parseLine(line: string): ParsedTransaction | null {
  if (SALDO_LINE_RE.test(line)) return null;

  const dates = [...line.matchAll(DATE_RE)];
  if (dates.length === 0) return null;

  const amounts = [...line.matchAll(AMOUNT_RE)];
  if (amounts.length === 0) return null;

  const operationDate = parseItalianDate(dates[0][1], dates[0][2], dates[0][3]);
  const valueDate = dates.length > 1 ? parseItalianDate(dates[1][1], dates[1][2], dates[1][3]) : operationDate;

  const amountMatch = amounts.length > 1 ? amounts[amounts.length - 2] : amounts[amounts.length - 1];
  const balanceMatch = amounts.length > 1 ? amounts[amounts.length - 1] : null;

  const lastDate = dates[dates.length - 1];
  const descStart = (lastDate.index ?? 0) + lastDate[0].length;
  const descEnd = amountMatch.index ?? line.length;
  const description = line.slice(descStart, descEnd).trim().replace(/\s{2,}/g, " ");
  if (!description) return null;

  return {
    operationDate,
    valueDate,
    amount: parseItalianNumber(amountMatch[0]),
    description,
    balanceAfter: balanceMatch ? parseItalianNumber(balanceMatch[0]) : undefined,
  };
}

function findLabeledAmount(lines: string[], labelRe: RegExp): number | null {
  const line = lines.find((l) => labelRe.test(l));
  if (!line) return null;
  const numberMatches = [...line.matchAll(AMOUNT_RE)];
  return numberMatches.length > 0 ? parseItalianNumber(numberMatches[numberMatches.length - 1][0]) : null;
}

export function parseGenericTabularStatement(text: string): ParsedStatement {
  const lines = text.split(/\r?\n/);
  const transactions: ParsedTransaction[] = [];
  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) transactions.push(parsed);
  }

  let openingBalance = findLabeledAmount(lines, /saldo\s+iniziale/i);
  let closingBalance = findLabeledAmount(lines, /saldo\s+final[ei]/i);

  if (openingBalance == null && transactions[0]?.balanceAfter != null) {
    openingBalance = round2(transactions[0].balanceAfter! - transactions[0].amount);
  }
  if (closingBalance == null && transactions.length > 0) {
    const last = transactions[transactions.length - 1];
    closingBalance = last.balanceAfter ?? null;
  }

  const totalMovements = round2(transactions.reduce((s, t) => s + t.amount, 0));
  const balanceReconciles =
    openingBalance != null && closingBalance != null
      ? Math.abs(round2(openingBalance + totalMovements) - closingBalance) < 0.01
      : null;

  return {
    openingBalance,
    closingBalance,
    transactions,
    balanceReconciles,
    sourceFormat: "PDF_GENERIC",
  };
}
