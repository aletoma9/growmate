"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAccess } from "@/lib/tenant";
import { computeAnnualQuota } from "@/lib/cespiti-engine";
import { isDateLocked } from "@/lib/fiscal-period";
import type { ActionState } from "@/lib/actions/auth";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const createCespiteSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  categoriaId: z.string().min(1),
  description: z.string().trim().min(1, "Descrizione obbligatoria"),
  purchaseDate: z.string().min(1),
  activationDate: z.string().min(1),
  historicalCost: z.coerce.number().min(0),
  accessoryCharges: z.coerce.number().min(0).default(0),
  civilCoefficientPercent: z.coerce.number().min(0).max(100),
  fiscalCoefficientPercent: z.coerce.number().min(0).max(100),
  firstYearReduced: z.coerce.boolean().default(true),
  isMinorGood: z.coerce.boolean().default(false),
});

export async function createCespiteAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = createCespiteSchema.safeParse({
    tenantId,
    companyId,
    categoriaId: formData.get("categoriaId"),
    description: formData.get("description"),
    purchaseDate: formData.get("purchaseDate"),
    activationDate: formData.get("activationDate"),
    historicalCost: formData.get("historicalCost"),
    accessoryCharges: formData.get("accessoryCharges") || 0,
    civilCoefficientPercent: formData.get("civilCoefficientPercent"),
    fiscalCoefficientPercent: formData.get("fiscalCoefficientPercent"),
    firstYearReduced: formData.get("firstYearReduced") === "on",
    isMinorGood: formData.get("isMinorGood") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  const data = parsed.data;

  const categoria = await prisma.cespiteCategoria.findFirst({ where: { id: data.categoriaId, companyId } });
  if (!categoria) return { error: "Categoria non valida." };

  await prisma.cespite.create({
    data: {
      companyId,
      categoriaId: data.categoriaId,
      description: data.description,
      purchaseDate: new Date(data.purchaseDate),
      activationDate: new Date(data.activationDate),
      historicalCost: data.historicalCost,
      accessoryCharges: data.accessoryCharges,
      civilCoefficientPercent: data.civilCoefficientPercent,
      fiscalCoefficientPercent: data.fiscalCoefficientPercent,
      firstYearReduced: data.firstYearReduced,
      isMinorGood: data.isMinorGood,
    },
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/cespiti`);
}

const generateSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  fiscalYearId: z.string().min(1),
});

export async function generateAmortizationEntriesAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = generateSchema.safeParse({ tenantId, companyId, fiscalYearId: formData.get("fiscalYearId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  const { fiscalYearId } = parsed.data;

  const [fiscalYear, company, causale] = await Promise.all([
    prisma.fiscalYear.findFirst({ where: { id: fiscalYearId, companyId } }),
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.causaleContabile.findFirst({ where: { companyId, code: "AMM" } }),
  ]);
  if (!fiscalYear) return { error: "Esercizio non valido." };
  if (!causale) return { error: "Causale di ammortamento non trovata." };
  if (isDateLocked(fiscalYear.endDate, fiscalYear, company.ivaSettlementPeriod)) {
    return { error: "Il periodo di fine esercizio è già bloccato per liquidazione IVA." };
  }

  const cespiti = await prisma.cespite.findMany({
    where: { companyId, status: "ACTIVE" },
    include: { categoria: true, movimenti: true },
  });

  type LineToCreate = { accountCode: string; debit: number; credit: number; description: string };
  const lines: LineToCreate[] = [];
  const movementsToCreate: Array<{ cespiteId: string; type: "AMMORTAMENTO_CIVILE" | "AMMORTAMENTO_FISCALE"; amount: number }> = [];
  const skipped: string[] = [];
  let processedCount = 0;

  for (const cespite of cespiti) {
    const alreadyDone = cespite.movimenti.some(
      (m) => m.fiscalYearId === fiscalYearId && m.type === "AMMORTAMENTO_CIVILE"
    );
    if (alreadyDone) continue;

    if (!cespite.categoria.fondoAccountCode || !cespite.categoria.depreciationExpenseAccountCode) {
      skipped.push(`${cespite.description} (categoria "${cespite.categoria.name}" senza conti collegati)`);
      continue;
    }

    const civilAccumulatedBefore = cespite.movimenti
      .filter((m) => m.type === "AMMORTAMENTO_CIVILE")
      .reduce((s, m) => s + Number(m.amount), 0);
    const fiscalAccumulatedBefore = cespite.movimenti
      .filter((m) => m.type === "AMMORTAMENTO_FISCALE")
      .reduce((s, m) => s + Number(m.amount), 0);

    const quota = computeAnnualQuota(
      {
        activationDate: cespite.activationDate,
        historicalCost: Number(cespite.historicalCost),
        accessoryCharges: Number(cespite.accessoryCharges),
        civilCoefficientPercent: Number(cespite.civilCoefficientPercent),
        fiscalCoefficientPercent: Number(cespite.fiscalCoefficientPercent),
        firstYearReduced: cespite.firstYearReduced,
        isMinorGood: cespite.isMinorGood,
      },
      fiscalYear,
      civilAccumulatedBefore,
      fiscalAccumulatedBefore
    );

    processedCount += 1;

    if (quota.civilQuota > 0) {
      lines.push({
        accountCode: cespite.categoria.depreciationExpenseAccountCode,
        debit: quota.civilQuota,
        credit: 0,
        description: cespite.description,
      });
      lines.push({
        accountCode: cespite.categoria.fondoAccountCode,
        debit: 0,
        credit: quota.civilQuota,
        description: cespite.description,
      });
      movementsToCreate.push({ cespiteId: cespite.id, type: "AMMORTAMENTO_CIVILE", amount: quota.civilQuota });
    }
    if (quota.fiscalQuota > 0) {
      movementsToCreate.push({ cespiteId: cespite.id, type: "AMMORTAMENTO_FISCALE", amount: quota.fiscalQuota });
    }
  }

  if (processedCount === 0) {
    return { error: skipped.length > 0 ? `Nessun cespite da ammortizzare. Esclusi: ${skipped.join("; ")}` : "Ammortamenti già generati per questo esercizio." };
  }

  const accountCodes = [...new Set(lines.map((l) => l.accountCode))];
  const accounts = await prisma.account.findMany({ where: { companyId, code: { in: accountCodes } } });
  const accountsByCode = new Map(accounts.map((a) => [a.code, a]));
  if (accounts.length !== accountCodes.length) {
    return { error: "Conti di ammortamento non trovati nel piano dei conti." };
  }

  await prisma.$transaction(async (tx) => {
    if (lines.length > 0) {
      const lastNumber = await tx.journalEntry.aggregate({
        where: { companyId, fiscalYearId },
        _max: { number: true },
      });
      const number = (lastNumber._max.number ?? 0) + 1;

      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          fiscalYearId,
          causaleId: causale.id,
          number,
          date: fiscalYear.endDate,
          description: `Ammortamenti esercizio ${fiscalYear.endDate.getFullYear()}`,
          status: "POSTED",
          postedAt: new Date(),
          lines: {
            create: lines.map((l, idx) => ({
              accountId: accountsByCode.get(l.accountCode)!.id,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              sortOrder: idx,
            })),
          },
        },
      });

      for (const m of movementsToCreate) {
        await tx.cespiteMovimento.create({
          data: {
            cespiteId: m.cespiteId,
            fiscalYearId,
            type: m.type,
            amount: m.amount,
            journalEntryId: m.type === "AMMORTAMENTO_CIVILE" ? entry.id : undefined,
          },
        });
      }
    } else {
      for (const m of movementsToCreate) {
        await tx.cespiteMovimento.create({
          data: { cespiteId: m.cespiteId, fiscalYearId, type: m.type, amount: m.amount },
        });
      }
    }
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/cespiti`);
  if (skipped.length > 0) return { error: `Generati ${processedCount} ammortamenti. Esclusi: ${skipped.join("; ")}` };
}

const disposeSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  cespiteId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  disposalDate: z.string().min(1),
  saleAmount: z.coerce.number().min(0).default(0),
  counterpartAccountId: z.string().optional(),
});

export async function disposeCespiteAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = disposeSchema.safeParse({
    tenantId,
    companyId,
    cespiteId: formData.get("cespiteId"),
    fiscalYearId: formData.get("fiscalYearId"),
    disposalDate: formData.get("disposalDate"),
    saleAmount: formData.get("saleAmount") || 0,
    counterpartAccountId: formData.get("counterpartAccountId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  const data = parsed.data;

  if (data.saleAmount > 0 && !data.counterpartAccountId) {
    return { error: "Seleziona il conto di incasso per la cessione." };
  }

  const cespite = await prisma.cespite.findFirst({
    where: { id: data.cespiteId, companyId },
    include: { categoria: true, movimenti: true },
  });
  if (!cespite) return { error: "Cespite non trovato." };
  if (cespite.status !== "ACTIVE") return { error: "Il cespite non è più attivo." };
  if (!cespite.categoria.assetAccountCode || !cespite.categoria.fondoAccountCode) {
    return { error: "La categoria del cespite non ha i conti collegati configurati." };
  }

  const fiscalYear = await prisma.fiscalYear.findFirst({ where: { id: data.fiscalYearId, companyId } });
  if (!fiscalYear) return { error: "Esercizio non valido." };

  const base = round2(Number(cespite.historicalCost) + Number(cespite.accessoryCharges));
  const civilAccumulated = round2(
    cespite.movimenti.filter((m) => m.type === "AMMORTAMENTO_CIVILE").reduce((s, m) => s + Number(m.amount), 0)
  );
  const netBookValue = round2(base - civilAccumulated);
  const gainLoss = round2(data.saleAmount - netBookValue);

  const causale = await prisma.causaleContabile.findFirst({ where: { companyId, code: "RETT" } });
  if (!causale) return { error: "Causale di rettifica non trovata." };

  const requiredCodes = [cespite.categoria.assetAccountCode, cespite.categoria.fondoAccountCode];
  if (gainLoss > 0) requiredCodes.push("31.10.10");
  if (gainLoss < 0) requiredCodes.push("46.30.10");
  const accounts = await prisma.account.findMany({ where: { companyId, code: { in: requiredCodes } } });
  const accountsByCode = new Map(accounts.map((a) => [a.code, a]));
  if (accounts.length !== new Set(requiredCodes).size) {
    return { error: "Conti di plusvalenza/minusvalenza non trovati nel piano dei conti." };
  }

  await prisma.$transaction(async (tx) => {
    const lines: Array<{ accountId: string; debit: number; credit: number; description: string }> = [
      { accountId: accountsByCode.get(cespite.categoria.assetAccountCode!)!.id, debit: 0, credit: base, description: cespite.description },
      { accountId: accountsByCode.get(cespite.categoria.fondoAccountCode!)!.id, debit: civilAccumulated, credit: 0, description: cespite.description },
    ];
    if (data.saleAmount > 0 && data.counterpartAccountId) {
      lines.push({ accountId: data.counterpartAccountId, debit: data.saleAmount, credit: 0, description: cespite.description });
    }
    if (gainLoss > 0) {
      lines.push({ accountId: accountsByCode.get("31.10.10")!.id, debit: 0, credit: gainLoss, description: "Plusvalenza da cessione" });
    } else if (gainLoss < 0) {
      lines.push({ accountId: accountsByCode.get("46.30.10")!.id, debit: -gainLoss, credit: 0, description: "Minusvalenza da cessione" });
    }

    const lastNumber = await tx.journalEntry.aggregate({ where: { companyId, fiscalYearId: data.fiscalYearId }, _max: { number: true } });
    const number = (lastNumber._max.number ?? 0) + 1;

    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        fiscalYearId: data.fiscalYearId,
        causaleId: causale.id,
        number,
        date: new Date(data.disposalDate),
        description: `${data.saleAmount > 0 ? "Cessione" : "Dismissione"} cespite: ${cespite.description}`,
        status: "POSTED",
        postedAt: new Date(),
        lines: { create: lines.map((l, idx) => ({ ...l, sortOrder: idx })) },
      },
    });

    await tx.cespiteMovimento.create({
      data: {
        cespiteId: cespite.id,
        fiscalYearId: data.fiscalYearId,
        type: data.saleAmount > 0 ? "CESSIONE" : "DISMISSIONE",
        amount: netBookValue,
        gainLoss,
        journalEntryId: entry.id,
      },
    });

    await tx.cespite.update({
      where: { id: cespite.id },
      data: { status: data.saleAmount > 0 ? "CEDUTO" : "DISMESSO" },
    });
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/cespiti`);
}
