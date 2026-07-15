"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAccess } from "@/lib/tenant";
import { computeLiquidazione } from "@/lib/iva-liquidazione";
import type { ActionState } from "@/lib/actions/auth";

const finalizeSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  period: z.coerce.number().int().min(1).max(12),
  acconto: z.coerce.number().min(0).optional(),
});

export async function finalizeLiquidazioneAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = finalizeSchema.safeParse({
    tenantId,
    companyId,
    fiscalYearId: formData.get("fiscalYearId"),
    period: formData.get("period"),
    acconto: formData.get("acconto") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  const { fiscalYearId, period, acconto } = parsed.data;

  const fiscalYear = await prisma.fiscalYear.findFirst({ where: { id: fiscalYearId, companyId } });
  if (!fiscalYear) return { error: "Esercizio non valido." };

  const existing = await prisma.ivaLiquidazione.findFirst({
    where: { companyId, fiscalYearId, period, status: "FINAL" },
  });
  if (existing) return { error: "Questo periodo è già stato liquidato in via definitiva." };

  const computation = await computeLiquidazione(companyId, fiscalYearId, period, acconto ?? 0);

  await prisma.$transaction(async (tx) => {
    await tx.ivaLiquidazione.upsert({
      where: {
        companyId_fiscalYearId_periodType_period: {
          companyId,
          fiscalYearId,
          periodType: computation.periodType,
          period,
        },
      },
      create: {
        companyId,
        fiscalYearId,
        period,
        periodType: computation.periodType,
        ivaDebito: computation.ivaDebito,
        ivaCredito: computation.ivaCreditoLordo,
        creditoPrecedente: computation.creditoPrecedente,
        proRataPercent: computation.proRataPercent,
        acconto: acconto ?? 0,
        maggiorazione: computation.maggiorazione,
        importoDovuto: computation.importoDovuto,
        status: "FINAL",
      },
      update: {
        ivaDebito: computation.ivaDebito,
        ivaCredito: computation.ivaCreditoLordo,
        creditoPrecedente: computation.creditoPrecedente,
        proRataPercent: computation.proRataPercent,
        acconto: acconto ?? 0,
        maggiorazione: computation.maggiorazione,
        importoDovuto: computation.importoDovuto,
        status: "FINAL",
      },
    });

    await tx.fiscalYear.update({
      where: { id: fiscalYearId },
      data: {
        status: "LOCKED",
        lastLockedIvaPeriod: Math.max(fiscalYear.lastLockedIvaPeriod ?? 0, period),
      },
    });
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/iva`);
  revalidatePath(`/t/${tenantId}/c/${companyId}/fiscal-years`);
}
