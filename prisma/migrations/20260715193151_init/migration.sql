-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "LegalForm" AS ENUM ('SRL', 'SRLS', 'SPA', 'SAPA', 'ALTRA');

-- CreateEnum
CREATE TYPE "IvaSettlementPeriod" AS ENUM ('MONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "FiscalYearStatus" AS ENUM ('OPEN', 'LOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccountLevel" AS ENUM ('MASTRO', 'CONTO', 'SOTTOCONTO');

-- CreateEnum
CREATE TYPE "AccountNature" AS ENUM ('ATTIVO', 'PASSIVO', 'COSTO', 'RICAVO', 'CONTO_ORDINE');

-- CreateEnum
CREATE TYPE "CausaleType" AS ENUM ('FATTURA_VENDITA', 'FATTURA_ACQUISTO', 'NOTA_CREDITO_VENDITA', 'NOTA_CREDITO_ACQUISTO', 'CORRISPETTIVO', 'INCASSO', 'PAGAMENTO', 'GIROCONTO', 'F24', 'STIPENDI', 'AMMORTAMENTO', 'RATEI_RISCONTI', 'RETTIFICA', 'APERTURA', 'CHIUSURA', 'ALTRA');

-- CreateEnum
CREATE TYPE "IvaRegisterType" AS ENUM ('VENDITE', 'ACQUISTI', 'CORRISPETTIVI');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'STORNATA');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('CLIENTE', 'FORNITORE', 'ENTRAMBI');

-- CreateEnum
CREATE TYPE "IvaRegimeType" AS ENUM ('ORDINARIA', 'REVERSE_CHARGE_INTERNO', 'REVERSE_CHARGE_ESTERO', 'SPLIT_PAYMENT', 'NON_IMPONIBILE', 'ESENTE', 'FUORI_CAMPO', 'IVA_DIFFERITA');

-- CreateEnum
CREATE TYPE "IvaLiquidazioneStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "CespiteStatus" AS ENUM ('ACTIVE', 'DISMESSO', 'CEDUTO');

-- CreateEnum
CREATE TYPE "CespiteMovimentoType" AS ENUM ('AMMORTAMENTO_CIVILE', 'AMMORTAMENTO_FISCALE', 'DISMISSIONE', 'CESSIONE', 'RIVALUTAZIONE');

-- CreateEnum
CREATE TYPE "BankImportStatus" AS ENUM ('PENDING', 'VALIDATED', 'ERROR');

-- CreateEnum
CREATE TYPE "BankMatchStatus" AS ENUM ('UNMATCHED', 'SUGGESTED', 'MATCHED', 'IGNORED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalForm" "LegalForm" NOT NULL DEFAULT 'SRL',
    "vatNumber" TEXT,
    "taxCode" TEXT,
    "address" TEXT,
    "ivaSettlementPeriod" "IvaSettlementPeriod" NOT NULL DEFAULT 'MONTHLY',
    "proRataPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalYearStatus" NOT NULL DEFAULT 'OPEN',
    "lastLockedIvaPeriod" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "AccountLevel" NOT NULL,
    "nature" "AccountNature" NOT NULL,
    "balanceSheetItem" TEXT,
    "isReconcilable" BOOLEAN NOT NULL DEFAULT true,
    "isPartnerLedger" BOOLEAN NOT NULL DEFAULT false,
    "isCashOrBank" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "causali_contabili" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CausaleType" NOT NULL,
    "generatesIvaMovement" BOOLEAN NOT NULL DEFAULT false,
    "ivaRegisterType" "IvaRegisterType",
    "defaultIvaAccountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "causali_contabili_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "causaleId" TEXT NOT NULL,
    "number" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "documentNumber" TEXT,
    "documentDate" TIMESTAMP(3),
    "partnerId" TEXT,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "reversalOfId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partnerId" TEXT,
    "description" TEXT,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL,
    "name" TEXT NOT NULL,
    "vatNumber" TEXT,
    "taxCode" TEXT,
    "address" TEXT,
    "iban" TEXT,
    "paymentTermsDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iva_registers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "IvaRegisterType" NOT NULL,
    "sectionalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "iva_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iva_movements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "ivaRegisterId" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "partnerId" TEXT,
    "protocolNumber" INTEGER NOT NULL,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "regimeType" "IvaRegimeType" NOT NULL DEFAULT 'ORDINARIA',
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "naturaCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iva_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iva_liquidazioni" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "periodType" "IvaSettlementPeriod" NOT NULL,
    "ivaDebito" DECIMAL(14,2) NOT NULL,
    "ivaCredito" DECIMAL(14,2) NOT NULL,
    "creditoPrecedente" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "proRataPercent" DECIMAL(5,2),
    "acconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maggiorazione" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importoDovuto" DECIMAL(14,2) NOT NULL,
    "status" "IvaLiquidazioneStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iva_liquidazioni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cespite_categorie" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coefficientOrdinario" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "cespite_categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cespiti" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "activationDate" TIMESTAMP(3) NOT NULL,
    "historicalCost" DECIMAL(14,2) NOT NULL,
    "accessoryCharges" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "civilCoefficientPercent" DECIMAL(5,2) NOT NULL,
    "fiscalCoefficientPercent" DECIMAL(5,2) NOT NULL,
    "firstYearReduced" BOOLEAN NOT NULL DEFAULT true,
    "isMinorGood" BOOLEAN NOT NULL DEFAULT false,
    "status" "CespiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cespiti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cespite_movimenti" (
    "id" TEXT NOT NULL,
    "cespiteId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "type" "CespiteMovimentoType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "gainLoss" DECIMAL(14,2),
    "journalEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cespite_movimenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "iban" TEXT,
    "bankName" TEXT,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_imports" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sourceFormat" TEXT NOT NULL,
    "openingBalance" DECIMAL(14,2),
    "closingBalance" DECIMAL(14,2),
    "status" "BankImportStatus" NOT NULL DEFAULT 'PENDING',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "operationDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "balanceAfter" DECIMAL(14,2),
    "matchStatus" "BankMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchConfidence" DECIMAL(5,2),
    "matchedJournalEntryId" TEXT,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_rules" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "descriptionPattern" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "timesApplied" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_tenantId_key" ON "memberships"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenantId_vatNumber_key" ON "companies"("tenantId", "vatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_years_companyId_startDate_key" ON "fiscal_years"("companyId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_companyId_code_key" ON "accounts"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "causali_contabili_companyId_code_key" ON "causali_contabili"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversalOfId_key" ON "journal_entries"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_companyId_fiscalYearId_number_key" ON "journal_entries"("companyId", "fiscalYearId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "partners_companyId_vatNumber_key" ON "partners"("companyId", "vatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "iva_registers_companyId_type_sectionalCode_key" ON "iva_registers"("companyId", "type", "sectionalCode");

-- CreateIndex
CREATE UNIQUE INDEX "iva_movements_ivaRegisterId_fiscalYearId_protocolNumber_key" ON "iva_movements"("ivaRegisterId", "fiscalYearId", "protocolNumber");

-- CreateIndex
CREATE UNIQUE INDEX "iva_liquidazioni_companyId_fiscalYearId_periodType_period_key" ON "iva_liquidazioni"("companyId", "fiscalYearId", "periodType", "period");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_rules_companyId_descriptionPattern_key" ON "reconciliation_rules"("companyId", "descriptionPattern");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "causali_contabili" ADD CONSTRAINT "causali_contabili_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_causaleId_fkey" FOREIGN KEY ("causaleId") REFERENCES "causali_contabili"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_registers" ADD CONSTRAINT "iva_registers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_movements" ADD CONSTRAINT "iva_movements_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_movements" ADD CONSTRAINT "iva_movements_ivaRegisterId_fkey" FOREIGN KEY ("ivaRegisterId") REFERENCES "iva_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_movements" ADD CONSTRAINT "iva_movements_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_movements" ADD CONSTRAINT "iva_movements_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iva_liquidazioni" ADD CONSTRAINT "iva_liquidazioni_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cespite_categorie" ADD CONSTRAINT "cespite_categorie_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cespiti" ADD CONSTRAINT "cespiti_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cespiti" ADD CONSTRAINT "cespiti_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "cespite_categorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cespite_movimenti" ADD CONSTRAINT "cespite_movimenti_cespiteId_fkey" FOREIGN KEY ("cespiteId") REFERENCES "cespiti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cespite_movimenti" ADD CONSTRAINT "cespite_movimenti_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cespite_movimenti" ADD CONSTRAINT "cespite_movimenti_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_importId_fkey" FOREIGN KEY ("importId") REFERENCES "bank_statement_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matchedJournalEntryId_fkey" FOREIGN KEY ("matchedJournalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
