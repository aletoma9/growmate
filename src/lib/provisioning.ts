import { prisma } from "@/lib/prisma";
import {
  AccountLevel,
  AccountNature,
  CausaleType,
  IvaRegisterType,
} from "@/generated/prisma/client";

type AccountSeed = {
  code: string;
  name: string;
  nature: AccountNature;
  balanceSheetItem?: string;
  isReconcilable?: boolean;
  isPartnerLedger?: boolean;
  isCashOrBank?: boolean;
  children?: AccountSeed[];
};

// Piano dei conti standard (tipo CNDCEC), riclassificato ex art. 2424/2425 c.c.
// Tre livelli: mastro -> conto -> sottoconto.
const CHART_OF_ACCOUNTS: AccountSeed[] = [
  {
    code: "10",
    name: "Immobilizzazioni immateriali",
    nature: "ATTIVO",
    balanceSheetItem: "SP.B.I",
    children: [
      {
        code: "10.10",
        name: "Costi di impianto e ampliamento",
        nature: "ATTIVO",
        balanceSheetItem: "SP.B.I.1",
        children: [{ code: "10.10.10", name: "Costi di impianto e ampliamento", nature: "ATTIVO", balanceSheetItem: "SP.B.I.1" }],
      },
      {
        code: "10.30",
        name: "Diritti di brevetto e utilizzazione opere ingegno",
        nature: "ATTIVO",
        balanceSheetItem: "SP.B.I.3",
        children: [{ code: "10.30.10", name: "Software", nature: "ATTIVO", balanceSheetItem: "SP.B.I.3" }],
      },
      {
        code: "10.40",
        name: "Concessioni, licenze, marchi e diritti simili",
        nature: "ATTIVO",
        balanceSheetItem: "SP.B.I.4",
        children: [{ code: "10.40.10", name: "Marchi", nature: "ATTIVO", balanceSheetItem: "SP.B.I.4" }],
      },
      {
        code: "10.70",
        name: "Altre immobilizzazioni immateriali",
        nature: "ATTIVO",
        balanceSheetItem: "SP.B.I.7",
        children: [
          { code: "10.70.10", name: "Migliorie su beni di terzi", nature: "ATTIVO", balanceSheetItem: "SP.B.I.7" },
          { code: "10.70.90", name: "Fondo ammortamento immobilizzazioni immateriali", nature: "ATTIVO", balanceSheetItem: "SP.B.I.7" },
        ],
      },
    ],
  },
  {
    code: "11",
    name: "Immobilizzazioni materiali",
    nature: "ATTIVO",
    balanceSheetItem: "SP.B.II",
    children: [
      {
        code: "11.10",
        name: "Terreni e fabbricati",
        nature: "ATTIVO",
        balanceSheetItem: "SP.B.II.1",
        children: [
          { code: "11.10.10", name: "Fabbricati industriali", nature: "ATTIVO", balanceSheetItem: "SP.B.II.1" },
          { code: "11.10.90", name: "Fondo ammortamento fabbricati", nature: "ATTIVO", balanceSheetItem: "SP.B.II.1" },
        ],
      },
      {
        code: "11.20",
        name: "Impianti e macchinario",
        nature: "ATTIVO",
        balanceSheetItem: "SP.B.II.2",
        children: [
          { code: "11.20.10", name: "Impianti e macchinari", nature: "ATTIVO", balanceSheetItem: "SP.B.II.2" },
          { code: "11.20.90", name: "Fondo ammortamento impianti e macchinari", nature: "ATTIVO", balanceSheetItem: "SP.B.II.2" },
        ],
      },
      {
        code: "11.30",
        name: "Attrezzature industriali e commerciali",
        nature: "ATTIVO",
        balanceSheetItem: "SP.B.II.3",
        children: [
          { code: "11.30.10", name: "Attrezzature", nature: "ATTIVO", balanceSheetItem: "SP.B.II.3" },
          { code: "11.30.90", name: "Fondo ammortamento attrezzature", nature: "ATTIVO", balanceSheetItem: "SP.B.II.3" },
        ],
      },
      {
        code: "11.40",
        name: "Altri beni",
        nature: "ATTIVO",
        balanceSheetItem: "SP.B.II.4",
        children: [
          { code: "11.40.10", name: "Mobili e arredi", nature: "ATTIVO", balanceSheetItem: "SP.B.II.4" },
          { code: "11.40.20", name: "Macchine elettroniche e computer", nature: "ATTIVO", balanceSheetItem: "SP.B.II.4" },
          { code: "11.40.30", name: "Autoveicoli", nature: "ATTIVO", balanceSheetItem: "SP.B.II.4" },
          { code: "11.40.90", name: "Fondo ammortamento altri beni", nature: "ATTIVO", balanceSheetItem: "SP.B.II.4" },
        ],
      },
    ],
  },
  {
    code: "12",
    name: "Immobilizzazioni finanziarie",
    nature: "ATTIVO",
    balanceSheetItem: "SP.B.III",
    children: [
      {
        code: "12.10",
        name: "Partecipazioni",
        nature: "ATTIVO",
        balanceSheetItem: "SP.B.III.1",
        children: [{ code: "12.10.10", name: "Partecipazioni in imprese controllate/collegate", nature: "ATTIVO", balanceSheetItem: "SP.B.III.1" }],
      },
      {
        code: "12.30",
        name: "Crediti finanziari immobilizzati",
        nature: "ATTIVO",
        balanceSheetItem: "SP.B.III.2",
        children: [{ code: "12.30.10", name: "Depositi cauzionali", nature: "ATTIVO", balanceSheetItem: "SP.B.III.2" }],
      },
    ],
  },
  {
    code: "13",
    name: "Rimanenze",
    nature: "ATTIVO",
    balanceSheetItem: "SP.C.I",
    children: [
      {
        code: "13.10",
        name: "Materie prime, sussidiarie e di consumo",
        nature: "ATTIVO",
        balanceSheetItem: "SP.C.I.1",
        children: [{ code: "13.10.10", name: "Materie prime", nature: "ATTIVO", balanceSheetItem: "SP.C.I.1" }],
      },
      {
        code: "13.40",
        name: "Prodotti finiti e merci",
        nature: "ATTIVO",
        balanceSheetItem: "SP.C.I.4",
        children: [{ code: "13.40.10", name: "Merci", nature: "ATTIVO", balanceSheetItem: "SP.C.I.4" }],
      },
    ],
  },
  {
    code: "14",
    name: "Crediti commerciali e diversi",
    nature: "ATTIVO",
    balanceSheetItem: "SP.C.II",
    children: [
      {
        code: "14.10",
        name: "Crediti verso clienti",
        nature: "ATTIVO",
        balanceSheetItem: "SP.C.II.1",
        children: [
          { code: "14.10.10", name: "Clienti c/fatture", nature: "ATTIVO", balanceSheetItem: "SP.C.II.1", isPartnerLedger: true },
          { code: "14.10.20", name: "Clienti c/fatture da emettere", nature: "ATTIVO", balanceSheetItem: "SP.C.II.1", isPartnerLedger: true },
          { code: "14.10.90", name: "Fondo svalutazione crediti", nature: "ATTIVO", balanceSheetItem: "SP.C.II.1" },
        ],
      },
      {
        code: "14.30",
        name: "Crediti tributari",
        nature: "ATTIVO",
        balanceSheetItem: "SP.C.II.4-bis",
        children: [
          { code: "14.30.10", name: "Erario c/IVA a credito", nature: "ATTIVO", balanceSheetItem: "SP.C.II.4-bis" },
          { code: "14.30.20", name: "Erario c/ritenute subite", nature: "ATTIVO", balanceSheetItem: "SP.C.II.4-bis" },
          { code: "14.30.30", name: "Crediti IRES/IRAP", nature: "ATTIVO", balanceSheetItem: "SP.C.II.4-bis" },
        ],
      },
      {
        code: "14.50",
        name: "Crediti diversi",
        nature: "ATTIVO",
        balanceSheetItem: "SP.C.II.5",
        children: [{ code: "14.50.10", name: "Crediti verso dipendenti", nature: "ATTIVO", balanceSheetItem: "SP.C.II.5" }],
      },
    ],
  },
  {
    code: "15",
    name: "Disponibilità liquide",
    nature: "ATTIVO",
    balanceSheetItem: "SP.C.IV",
    children: [
      {
        code: "15.10",
        name: "Depositi bancari e postali",
        nature: "ATTIVO",
        balanceSheetItem: "SP.C.IV.1",
        children: [{ code: "15.10.10", name: "Banca c/c ordinario", nature: "ATTIVO", balanceSheetItem: "SP.C.IV.1", isCashOrBank: true }],
      },
      {
        code: "15.30",
        name: "Denaro e valori in cassa",
        nature: "ATTIVO",
        balanceSheetItem: "SP.C.IV.3",
        children: [{ code: "15.30.10", name: "Cassa contanti", nature: "ATTIVO", balanceSheetItem: "SP.C.IV.3", isCashOrBank: true }],
      },
    ],
  },
  {
    code: "16",
    name: "Ratei e risconti attivi",
    nature: "ATTIVO",
    balanceSheetItem: "SP.D",
    children: [
      { code: "16.10", name: "Ratei attivi", nature: "ATTIVO", balanceSheetItem: "SP.D", children: [{ code: "16.10.10", name: "Ratei attivi", nature: "ATTIVO", balanceSheetItem: "SP.D" }] },
      { code: "16.20", name: "Risconti attivi", nature: "ATTIVO", balanceSheetItem: "SP.D", children: [{ code: "16.20.10", name: "Risconti attivi", nature: "ATTIVO", balanceSheetItem: "SP.D" }] },
    ],
  },
  {
    code: "20",
    name: "Patrimonio netto",
    nature: "PASSIVO",
    balanceSheetItem: "SP.A",
    children: [
      { code: "20.10", name: "Capitale sociale", nature: "PASSIVO", balanceSheetItem: "SP.A.I", children: [{ code: "20.10.10", name: "Capitale sociale", nature: "PASSIVO", balanceSheetItem: "SP.A.I" }] },
      { code: "20.40", name: "Riserva legale", nature: "PASSIVO", balanceSheetItem: "SP.A.IV", children: [{ code: "20.40.10", name: "Riserva legale", nature: "PASSIVO", balanceSheetItem: "SP.A.IV" }] },
      { code: "20.60", name: "Altre riserve", nature: "PASSIVO", balanceSheetItem: "SP.A.VI", children: [{ code: "20.60.10", name: "Riserva straordinaria", nature: "PASSIVO", balanceSheetItem: "SP.A.VI" }] },
      { code: "20.80", name: "Utili (perdite) portati a nuovo", nature: "PASSIVO", balanceSheetItem: "SP.A.VIII", children: [{ code: "20.80.10", name: "Utili/perdite a nuovo", nature: "PASSIVO", balanceSheetItem: "SP.A.VIII" }] },
      { code: "20.90", name: "Utile (perdita) dell'esercizio", nature: "PASSIVO", balanceSheetItem: "SP.A.IX", children: [{ code: "20.90.10", name: "Utile/perdita d'esercizio", nature: "PASSIVO", balanceSheetItem: "SP.A.IX" }] },
    ],
  },
  {
    code: "21",
    name: "Fondi per rischi e oneri",
    nature: "PASSIVO",
    balanceSheetItem: "SP.B",
    children: [{ code: "21.10", name: "Fondo imposte differite", nature: "PASSIVO", balanceSheetItem: "SP.B.2", children: [{ code: "21.10.10", name: "Fondo imposte differite", nature: "PASSIVO", balanceSheetItem: "SP.B.2" }] }],
  },
  {
    code: "22",
    name: "Trattamento di fine rapporto",
    nature: "PASSIVO",
    balanceSheetItem: "SP.C",
    children: [{ code: "22.10", name: "Fondo TFR", nature: "PASSIVO", balanceSheetItem: "SP.C", children: [{ code: "22.10.10", name: "Fondo TFR", nature: "PASSIVO", balanceSheetItem: "SP.C" }] }],
  },
  {
    code: "23",
    name: "Debiti",
    nature: "PASSIVO",
    balanceSheetItem: "SP.D",
    children: [
      {
        code: "23.10",
        name: "Debiti verso banche",
        nature: "PASSIVO",
        balanceSheetItem: "SP.D.4",
        children: [{ code: "23.10.10", name: "Mutui passivi", nature: "PASSIVO", balanceSheetItem: "SP.D.4" }],
      },
      {
        code: "23.20",
        name: "Debiti verso fornitori",
        nature: "PASSIVO",
        balanceSheetItem: "SP.D.7",
        children: [
          { code: "23.20.10", name: "Fornitori c/fatture", nature: "PASSIVO", balanceSheetItem: "SP.D.7", isPartnerLedger: true },
          { code: "23.20.20", name: "Fornitori c/fatture da ricevere", nature: "PASSIVO", balanceSheetItem: "SP.D.7", isPartnerLedger: true },
        ],
      },
      {
        code: "23.40",
        name: "Debiti tributari",
        nature: "PASSIVO",
        balanceSheetItem: "SP.D.12",
        children: [
          { code: "23.40.10", name: "Erario c/IVA a debito", nature: "PASSIVO", balanceSheetItem: "SP.D.12" },
          { code: "23.40.20", name: "Erario c/ritenute da versare", nature: "PASSIVO", balanceSheetItem: "SP.D.12" },
          { code: "23.40.30", name: "Debiti IRES/IRAP", nature: "PASSIVO", balanceSheetItem: "SP.D.12" },
        ],
      },
      {
        code: "23.50",
        name: "Debiti verso istituti previdenziali",
        nature: "PASSIVO",
        balanceSheetItem: "SP.D.13",
        children: [{ code: "23.50.10", name: "INPS c/contributi", nature: "PASSIVO", balanceSheetItem: "SP.D.13" }],
      },
      {
        code: "23.60",
        name: "Altri debiti",
        nature: "PASSIVO",
        balanceSheetItem: "SP.D.14",
        children: [
          { code: "23.60.10", name: "Debiti verso dipendenti c/stipendi", nature: "PASSIVO", balanceSheetItem: "SP.D.14" },
          { code: "23.60.20", name: "Debiti verso soci per finanziamenti", nature: "PASSIVO", balanceSheetItem: "SP.D.14" },
        ],
      },
    ],
  },
  {
    code: "24",
    name: "Ratei e risconti passivi",
    nature: "PASSIVO",
    balanceSheetItem: "SP.E",
    children: [
      { code: "24.10", name: "Ratei passivi", nature: "PASSIVO", balanceSheetItem: "SP.E", children: [{ code: "24.10.10", name: "Ratei passivi", nature: "PASSIVO", balanceSheetItem: "SP.E" }] },
      { code: "24.20", name: "Risconti passivi", nature: "PASSIVO", balanceSheetItem: "SP.E", children: [{ code: "24.20.10", name: "Risconti passivi", nature: "PASSIVO", balanceSheetItem: "SP.E" }] },
    ],
  },
  {
    code: "30",
    name: "Ricavi delle vendite e delle prestazioni",
    nature: "RICAVO",
    balanceSheetItem: "CE.A.1",
    children: [
      { code: "30.10", name: "Ricavi vendite merci", nature: "RICAVO", balanceSheetItem: "CE.A.1", children: [{ code: "30.10.10", name: "Ricavi vendite merci", nature: "RICAVO", balanceSheetItem: "CE.A.1" }] },
      { code: "30.20", name: "Ricavi prestazioni di servizi", nature: "RICAVO", balanceSheetItem: "CE.A.1", children: [{ code: "30.20.10", name: "Ricavi prestazioni di servizi", nature: "RICAVO", balanceSheetItem: "CE.A.1" }] },
    ],
  },
  {
    code: "31",
    name: "Altri ricavi e proventi",
    nature: "RICAVO",
    balanceSheetItem: "CE.A.5",
    children: [
      { code: "31.10", name: "Plusvalenze da alienazioni", nature: "RICAVO", balanceSheetItem: "CE.A.5", children: [{ code: "31.10.10", name: "Plusvalenze ordinarie", nature: "RICAVO", balanceSheetItem: "CE.A.5" }] },
      { code: "31.20", name: "Ricavi e proventi diversi", nature: "RICAVO", balanceSheetItem: "CE.A.5", children: [{ code: "31.20.10", name: "Sopravvenienze attive", nature: "RICAVO", balanceSheetItem: "CE.A.5" }] },
    ],
  },
  {
    code: "32",
    name: "Proventi finanziari",
    nature: "RICAVO",
    balanceSheetItem: "CE.C.16",
    children: [{ code: "32.10", name: "Interessi attivi", nature: "RICAVO", balanceSheetItem: "CE.C.16", children: [{ code: "32.10.10", name: "Interessi attivi bancari", nature: "RICAVO", balanceSheetItem: "CE.C.16" }] }],
  },
  {
    code: "40",
    name: "Costi per materie prime, sussidiarie, di consumo e merci",
    nature: "COSTO",
    balanceSheetItem: "CE.B.6",
    children: [
      { code: "40.10", name: "Acquisti materie prime", nature: "COSTO", balanceSheetItem: "CE.B.6", children: [{ code: "40.10.10", name: "Acquisti materie prime", nature: "COSTO", balanceSheetItem: "CE.B.6" }] },
      { code: "40.20", name: "Acquisti merci", nature: "COSTO", balanceSheetItem: "CE.B.6", children: [{ code: "40.20.10", name: "Acquisti merci", nature: "COSTO", balanceSheetItem: "CE.B.6" }] },
    ],
  },
  {
    code: "41",
    name: "Costi per servizi",
    nature: "COSTO",
    balanceSheetItem: "CE.B.7",
    children: [
      { code: "41.10", name: "Consulenze professionali", nature: "COSTO", balanceSheetItem: "CE.B.7", children: [{ code: "41.10.10", name: "Consulenze professionali", nature: "COSTO", balanceSheetItem: "CE.B.7" }] },
      { code: "41.20", name: "Utenze", nature: "COSTO", balanceSheetItem: "CE.B.7", children: [
        { code: "41.20.10", name: "Energia elettrica", nature: "COSTO", balanceSheetItem: "CE.B.7" },
        { code: "41.20.20", name: "Telefoniche e internet", nature: "COSTO", balanceSheetItem: "CE.B.7" },
      ] },
      { code: "41.30", name: "Spese bancarie", nature: "COSTO", balanceSheetItem: "CE.B.7", children: [{ code: "41.30.10", name: "Commissioni e spese bancarie", nature: "COSTO", balanceSheetItem: "CE.B.7" }] },
      { code: "41.40", name: "Assicurazioni", nature: "COSTO", balanceSheetItem: "CE.B.7", children: [{ code: "41.40.10", name: "Premi assicurativi", nature: "COSTO", balanceSheetItem: "CE.B.7" }] },
    ],
  },
  {
    code: "42",
    name: "Costi per godimento beni di terzi",
    nature: "COSTO",
    balanceSheetItem: "CE.B.8",
    children: [{ code: "42.10", name: "Affitti e locazioni", nature: "COSTO", balanceSheetItem: "CE.B.8", children: [{ code: "42.10.10", name: "Affitti passivi", nature: "COSTO", balanceSheetItem: "CE.B.8" }] }],
  },
  {
    code: "43",
    name: "Costi del personale",
    nature: "COSTO",
    balanceSheetItem: "CE.B.9",
    children: [
      { code: "43.10", name: "Salari e stipendi", nature: "COSTO", balanceSheetItem: "CE.B.9.a", children: [{ code: "43.10.10", name: "Salari e stipendi", nature: "COSTO", balanceSheetItem: "CE.B.9.a" }] },
      { code: "43.20", name: "Oneri sociali", nature: "COSTO", balanceSheetItem: "CE.B.9.b", children: [{ code: "43.20.10", name: "Contributi INPS/INAIL a carico azienda", nature: "COSTO", balanceSheetItem: "CE.B.9.b" }] },
      { code: "43.30", name: "Trattamento di fine rapporto", nature: "COSTO", balanceSheetItem: "CE.B.9.c", children: [{ code: "43.30.10", name: "Accantonamento TFR", nature: "COSTO", balanceSheetItem: "CE.B.9.c" }] },
    ],
  },
  {
    code: "44",
    name: "Ammortamenti e svalutazioni",
    nature: "COSTO",
    balanceSheetItem: "CE.B.10",
    children: [
      { code: "44.10", name: "Ammortamento immobilizzazioni immateriali", nature: "COSTO", balanceSheetItem: "CE.B.10.a", children: [{ code: "44.10.10", name: "Ammortamento immobilizzazioni immateriali", nature: "COSTO", balanceSheetItem: "CE.B.10.a" }] },
      { code: "44.20", name: "Ammortamento immobilizzazioni materiali", nature: "COSTO", balanceSheetItem: "CE.B.10.b", children: [{ code: "44.20.10", name: "Ammortamento immobilizzazioni materiali", nature: "COSTO", balanceSheetItem: "CE.B.10.b" }] },
      { code: "44.30", name: "Svalutazione crediti", nature: "COSTO", balanceSheetItem: "CE.B.10.d", children: [{ code: "44.30.10", name: "Svalutazione crediti", nature: "COSTO", balanceSheetItem: "CE.B.10.d" }] },
    ],
  },
  {
    code: "45",
    name: "Variazione delle rimanenze",
    nature: "COSTO",
    balanceSheetItem: "CE.B.11",
    children: [{ code: "45.10", name: "Variazione rimanenze materie prime", nature: "COSTO", balanceSheetItem: "CE.B.11", children: [{ code: "45.10.10", name: "Variazione rimanenze materie prime", nature: "COSTO", balanceSheetItem: "CE.B.11" }] }],
  },
  {
    code: "46",
    name: "Oneri diversi di gestione",
    nature: "COSTO",
    balanceSheetItem: "CE.B.14",
    children: [
      { code: "46.10", name: "Imposte e tasse indeducibili", nature: "COSTO", balanceSheetItem: "CE.B.14", children: [{ code: "46.10.10", name: "Imposta di bollo", nature: "COSTO", balanceSheetItem: "CE.B.14" }] },
      { code: "46.20", name: "Sopravvenienze passive", nature: "COSTO", balanceSheetItem: "CE.B.14", children: [{ code: "46.20.10", name: "Sopravvenienze passive", nature: "COSTO", balanceSheetItem: "CE.B.14" }] },
    ],
  },
  {
    code: "47",
    name: "Oneri finanziari",
    nature: "COSTO",
    balanceSheetItem: "CE.C.17",
    children: [{ code: "47.10", name: "Interessi passivi", nature: "COSTO", balanceSheetItem: "CE.C.17", children: [
      { code: "47.10.10", name: "Interessi passivi bancari", nature: "COSTO", balanceSheetItem: "CE.C.17" },
      { code: "47.10.20", name: "Interessi passivi di mora", nature: "COSTO", balanceSheetItem: "CE.C.17" },
    ] }],
  },
  {
    code: "48",
    name: "Imposte sul reddito dell'esercizio",
    nature: "COSTO",
    balanceSheetItem: "CE.20",
    children: [
      { code: "48.10", name: "IRES", nature: "COSTO", balanceSheetItem: "CE.20", children: [{ code: "48.10.10", name: "IRES corrente", nature: "COSTO", balanceSheetItem: "CE.20" }] },
      { code: "48.20", name: "IRAP", nature: "COSTO", balanceSheetItem: "CE.20", children: [{ code: "48.20.10", name: "IRAP corrente", nature: "COSTO", balanceSheetItem: "CE.20" }] },
      { code: "48.30", name: "Imposte differite/anticipate", nature: "COSTO", balanceSheetItem: "CE.20", children: [{ code: "48.30.10", name: "Imposte differite/anticipate", nature: "COSTO", balanceSheetItem: "CE.20" }] },
    ],
  },
  {
    code: "90",
    name: "Conti d'ordine",
    nature: "CONTO_ORDINE",
    children: [{ code: "90.10", name: "Beni di terzi presso l'azienda", nature: "CONTO_ORDINE", children: [{ code: "90.10.10", name: "Beni di terzi in deposito", nature: "CONTO_ORDINE" }] }],
  },
];

const CAUSALI: Array<{
  code: string;
  name: string;
  type: CausaleType;
  generatesIvaMovement?: boolean;
  ivaRegisterType?: IvaRegisterType;
}> = [
  { code: "VE", name: "Fattura di vendita", type: "FATTURA_VENDITA", generatesIvaMovement: true, ivaRegisterType: "VENDITE" },
  { code: "VA", name: "Fattura di acquisto", type: "FATTURA_ACQUISTO", generatesIvaMovement: true, ivaRegisterType: "ACQUISTI" },
  { code: "NCV", name: "Nota di credito a cliente", type: "NOTA_CREDITO_VENDITA", generatesIvaMovement: true, ivaRegisterType: "VENDITE" },
  { code: "NCA", name: "Nota di credito da fornitore", type: "NOTA_CREDITO_ACQUISTO", generatesIvaMovement: true, ivaRegisterType: "ACQUISTI" },
  { code: "CORR", name: "Corrispettivo", type: "CORRISPETTIVO", generatesIvaMovement: true, ivaRegisterType: "CORRISPETTIVI" },
  { code: "INC", name: "Incasso da cliente", type: "INCASSO" },
  { code: "PAG", name: "Pagamento a fornitore", type: "PAGAMENTO" },
  { code: "GIR", name: "Giroconto", type: "GIROCONTO" },
  { code: "F24", name: "Versamento F24", type: "F24" },
  { code: "STIP", name: "Liquidazione stipendi", type: "STIPENDI" },
  { code: "AMM", name: "Scrittura di ammortamento", type: "AMMORTAMENTO" },
  { code: "RR", name: "Ratei e risconti", type: "RATEI_RISCONTI" },
  { code: "RETT", name: "Scrittura di rettifica", type: "RETTIFICA" },
  { code: "APE", name: "Apertura conti", type: "APERTURA" },
  { code: "CHI", name: "Chiusura conti", type: "CHIUSURA" },
];

// Coefficienti di ammortamento ordinario da tabelle ministeriali (DM 31/12/1988)
const CESPITE_CATEGORIE: Array<{ name: string; coefficientOrdinario: number }> = [
  { name: "Fabbricati industriali", coefficientOrdinario: 3 },
  { name: "Impianti e macchinari generici", coefficientOrdinario: 15 },
  { name: "Attrezzatura varia e minuta", coefficientOrdinario: 15 },
  { name: "Mobili e macchine ordinarie d'ufficio", coefficientOrdinario: 12 },
  { name: "Macchine d'ufficio elettromeccaniche ed elettroniche", coefficientOrdinario: 20 },
  { name: "Autovetture e autoveicoli da trasporto", coefficientOrdinario: 25 },
];

async function createAccountTree(companyId: string, nodes: AccountSeed[], parentId: string | null, level: AccountLevel) {
  for (const node of nodes) {
    const created = await prisma.account.create({
      data: {
        companyId,
        code: node.code,
        name: node.name,
        level,
        nature: node.nature,
        balanceSheetItem: node.balanceSheetItem,
        isReconcilable: node.isReconcilable ?? !node.children,
        isPartnerLedger: node.isPartnerLedger ?? false,
        isCashOrBank: node.isCashOrBank ?? false,
        parentId,
      },
    });
    if (node.children?.length) {
      const childLevel: AccountLevel = level === "MASTRO" ? "CONTO" : "SOTTOCONTO";
      await createAccountTree(companyId, node.children, created.id, childLevel);
    }
  }
}

/**
 * Popola una nuova azienda con piano dei conti standard, causali contabili,
 * registri IVA di base e categorie cespiti da tabelle ministeriali.
 * Il piano dei conti creato è una copia editabile, non un template condiviso.
 */
export async function provisionCompanyDefaults(companyId: string) {
  await createAccountTree(companyId, CHART_OF_ACCOUNTS, null, "MASTRO");

  await prisma.causaleContabile.createMany({
    data: CAUSALI.map((c) => ({
      companyId,
      code: c.code,
      name: c.name,
      type: c.type,
      generatesIvaMovement: c.generatesIvaMovement ?? false,
      ivaRegisterType: c.ivaRegisterType,
    })),
  });

  await prisma.ivaRegister.createMany({
    data: [
      { companyId, type: "VENDITE", sectionalCode: "1", name: "Registro vendite" },
      { companyId, type: "ACQUISTI", sectionalCode: "1", name: "Registro acquisti" },
      { companyId, type: "CORRISPETTIVI", sectionalCode: "1", name: "Registro corrispettivi" },
      { companyId, type: "VENDITE", sectionalCode: "RC", name: "Registro vendite - reverse charge" },
      { companyId, type: "ACQUISTI", sectionalCode: "RC", name: "Registro acquisti - reverse charge" },
    ],
  });

  await prisma.cespiteCategoria.createMany({
    data: CESPITE_CATEGORIE.map((c) => ({
      companyId,
      name: c.name,
      coefficientOrdinario: c.coefficientOrdinario,
    })),
  });
}
