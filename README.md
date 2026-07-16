# ContSocietà

SaaS multi-tenant di contabilità ordinaria per società di capitali (S.r.l., S.p.A.).
Next.js (App Router) + TypeScript + PostgreSQL + Prisma.

## Requisiti

- Node.js 20+
- PostgreSQL 14+ (locale o Docker)

## Setup locale

1. Installa le dipendenze:

   ```bash
   npm install
   ```

2. Crea il database e copia il file d'ambiente:

   ```bash
   createdb contsocieta   # oppure: docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
   cp .env.example .env
   ```

   Modifica `.env` se la tua connection string a PostgreSQL è diversa da quella di default
   (`postgresql://postgres:postgres@localhost:5432/contsocieta`).

3. Applica le migrazioni e popola i dati di base (piano dei conti standard, causali
   contabili, registri IVA, categorie cespiti, un utente/azienda demo):

   ```bash
   npx prisma migrate dev
   ```

   Il seed viene eseguito automaticamente dopo la migrazione (configurato in
   `prisma.config.ts`). Per rieseguirlo manualmente: `npx tsx prisma/seed.ts`.

4. Avvia il server di sviluppo:

   ```bash
   npm run dev
   ```

5. Apri [http://localhost:3000](http://localhost:3000): si atterra direttamente sulla dashboard
   dell'azienda demo, senza login. Non è richiesto alcun accesso: l'app usa in modo
   trasparente il primo utente presente nel database (quello creato dal seed).

   Il login con email/password resta disponibile su `/login` solo per chi vuole
   accedere esplicitamente con un utente specifico (utile con più utenti/studi).

## Struttura

- `prisma/schema.prisma` — modello dati (tenant, aziende, esercizi, piano dei conti,
  prima nota/libro giornale, registri IVA, cespiti, riconciliazione bancaria).
- `prisma/seed.ts` / `src/lib/provisioning.ts` — dati di base per una nuova azienda.
- `src/app/t/[tenantId]/c/[companyId]/...` — area applicativa per azienda (dashboard,
  piano dei conti, prima nota, anagrafiche, registri IVA, bilanci, cespiti, banche, esercizi).
- `src/auth.ts` / `src/auth.config.ts` — autenticazione (NextAuth, credentials + JWT).
- `src/lib/bank-statement-parser.ts` / `src/lib/bank-matching.ts` — estrazione dei
  movimenti da estratto conto PDF (via `unpdf`) e motore di matching automatico
  contro le partite aperte in prima nota.
- `src/lib/fatturapa-parser.ts` — import fatture elettroniche SdI (XML FatturaPA):
  riconoscimento automatico di direzione, anagrafica e regime IVA per la
  registrazione in prima nota (`/import-fatture`).
