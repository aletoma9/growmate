import { XMLParser } from "fast-xml-parser";
import type { IvaRegimeType } from "@/generated/prisma/client";

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type ParsedVatGroup = {
  taxableAmount: number;
  vatRate: number;
  taxAmount: number;
  regimeType: IvaRegimeType;
  naturaCode?: string;
};

export type ParsedInvoice = {
  direction: "VENDITA" | "ACQUISTO";
  documentType: string;
  isCreditNote: boolean;
  documentNumber: string;
  documentDate: Date;
  totalAmount: number;
  partner: { name: string; vatNumber?: string; taxCode?: string };
  vatGroups: ParsedVatGroup[];
};

const CREDIT_NOTE_TYPES = new Set(["TD04", "TD08"]);

function mapNaturaToRegime(natura: string | undefined, esigibilita: string | undefined): IvaRegimeType {
  if (esigibilita === "S") return "SPLIT_PAYMENT";
  if (esigibilita === "D") return "IVA_DIFFERITA";
  if (!natura) return "ORDINARIA";
  if (natura.startsWith("N6")) return "REVERSE_CHARGE_INTERNO";
  if (natura.startsWith("N3")) return "NON_IMPONIBILE";
  if (natura === "N4") return "ESENTE";
  if (natura.startsWith("N2")) return "FUORI_CAMPO";
  if (natura === "N1" || natura.startsWith("N5") || natura === "N7") return "NON_IMPONIBILE";
  return "ORDINARIA";
}

function anagraficaName(anagrafici: Record<string, unknown>): string {
  const anagrafica = anagrafici?.Anagrafica as Record<string, unknown> | undefined;
  if (!anagrafica) return "Sconosciuto";
  if (anagrafica.Denominazione) return String(anagrafica.Denominazione);
  const nome = anagrafica.Nome ? String(anagrafica.Nome) : "";
  const cognome = anagrafica.Cognome ? String(anagrafica.Cognome) : "";
  return `${nome} ${cognome}`.trim() || "Sconosciuto";
}

function vatNumberOf(datiAnagrafici: Record<string, unknown>): string | undefined {
  const id = datiAnagrafici?.IdFiscaleIVA as Record<string, unknown> | undefined;
  if (!id?.IdCodice) return undefined;
  return `${id.IdPaese ?? "IT"}${id.IdCodice}`;
}

/**
 * Estrae i dati rilevanti da una fattura elettronica FatturaPA (XML SdI),
 * determinando la direzione (vendita/acquisto) dal confronto tra la partita
 * IVA dell'azienda e cedente/cessionario, e il regime IVA di ogni riga di
 * riepilogo dai codici Natura / EsigibilitaIVA.
 */
export function parseFatturaPA(xml: string, companyVatNumber: string | null, companyTaxCode: string | null): ParsedInvoice {
  // parseTagValue disabilitato: altrimenti codici come partita IVA/codice
  // fiscale con zeri iniziali verrebbero convertiti in numero, perdendoli.
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, parseTagValue: false });
  const doc = parser.parse(xml);

  const root = doc.FatturaElettronica;
  if (!root) throw new Error("XML non riconosciuto: manca l'elemento FatturaElettronica.");

  const header = root.FatturaElettronicaHeader;
  const cedente = header?.CedentePrestatore;
  const cessionario = header?.CessionarioCommittente;
  if (!cedente || !cessionario) throw new Error("XML incompleto: mancano cedente o cessionario.");

  const cedenteDati = cedente.DatiAnagrafici;
  const cessionarioDati = cessionario.DatiAnagrafici;
  const cedenteVat = vatNumberOf(cedenteDati);
  const cedenteCf = cedenteDati?.CodiceFiscale ? String(cedenteDati.CodiceFiscale) : undefined;
  const cessionarioVat = vatNumberOf(cessionarioDati);
  const cessionarioCf = cessionarioDati?.CodiceFiscale ? String(cessionarioDati.CodiceFiscale) : undefined;

  const normalizedCompanyVat = companyVatNumber?.replace(/^IT/i, "");
  const isCedenteCompany =
    (cedenteVat && normalizedCompanyVat && cedenteVat.replace(/^IT/i, "") === normalizedCompanyVat) ||
    (cedenteCf && companyTaxCode && cedenteCf === companyTaxCode);
  const isCessionarioCompany =
    (cessionarioVat && normalizedCompanyVat && cessionarioVat.replace(/^IT/i, "") === normalizedCompanyVat) ||
    (cessionarioCf && companyTaxCode && cessionarioCf === companyTaxCode);

  let direction: "VENDITA" | "ACQUISTO";
  let partnerDati: Record<string, unknown>;
  if (isCedenteCompany) {
    direction = "VENDITA";
    partnerDati = cessionarioDati;
  } else if (isCessionarioCompany) {
    direction = "ACQUISTO";
    partnerDati = cedenteDati;
  } else {
    throw new Error(
      "Impossibile determinare se la fattura è emessa o ricevuta: la partita IVA/codice fiscale dell'azienda non compare né come cedente né come cessionario. Verifica i dati anagrafici dell'azienda."
    );
  }

  const body = asArray(root.FatturaElettronicaBody)[0];
  if (!body) throw new Error("XML incompleto: manca FatturaElettronicaBody.");

  const datiGenerali = body.DatiGenerali?.DatiGeneraliDocumento;
  if (!datiGenerali) throw new Error("XML incompleto: mancano i dati generali del documento.");

  const documentType = String(datiGenerali.TipoDocumento ?? "TD01");
  const documentNumber = String(datiGenerali.Numero ?? "");
  const documentDate = new Date(String(datiGenerali.Data));
  const totalAmount = round2(Number(datiGenerali.ImportoTotaleDocumento ?? 0));

  const riepiloghi = asArray(body.DatiBeniServizi?.DatiRiepilogo);
  if (riepiloghi.length === 0) throw new Error("XML incompleto: manca il riepilogo IVA (DatiRiepilogo).");

  const vatGroups: ParsedVatGroup[] = riepiloghi.map((r) => {
    const natura = r.Natura ? String(r.Natura) : undefined;
    const esigibilita = r.EsigibilitaIVA ? String(r.EsigibilitaIVA) : undefined;
    return {
      taxableAmount: round2(Number(r.ImponibileImporto ?? 0)),
      vatRate: round2(Number(r.AliquotaIVA ?? 0)),
      taxAmount: round2(Number(r.Imposta ?? 0)),
      regimeType: mapNaturaToRegime(natura, esigibilita),
      naturaCode: natura,
    };
  });

  return {
    direction,
    documentType,
    isCreditNote: CREDIT_NOTE_TYPES.has(documentType),
    documentNumber,
    documentDate,
    totalAmount,
    partner: {
      name: anagraficaName(partnerDati),
      vatNumber: vatNumberOf(partnerDati),
      taxCode: partnerDati?.CodiceFiscale ? String(partnerDati.CodiceFiscale) : undefined,
    },
    vatGroups,
  };
}
