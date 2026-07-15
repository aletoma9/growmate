"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAccess } from "@/lib/tenant";
import type { ActionState } from "@/lib/actions/auth";

const createFiscalYearSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export async function createFiscalYearAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = createFiscalYearSchema.safeParse({
    tenantId,
    companyId,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate <= startDate) return { error: "La data di fine deve essere successiva alla data di inizio." };

  const overlapping = await prisma.fiscalYear.findFirst({
    where: {
      companyId,
      AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }],
    },
  });
  if (overlapping) return { error: "Esiste già un esercizio che si sovrappone a questo periodo." };

  await prisma.fiscalYear.create({
    data: { companyId, startDate, endDate, status: "OPEN" },
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/fiscal-years`);
}

const lockFiscalYearSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  fiscalYearId: z.string().min(1),
  lastLockedIvaPeriod: z.coerce.number().int().min(1).max(12).optional(),
});

export async function lockFiscalYearAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = lockFiscalYearSchema.safeParse({
    tenantId,
    companyId,
    fiscalYearId: formData.get("fiscalYearId"),
    lastLockedIvaPeriod: formData.get("lastLockedIvaPeriod") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  await prisma.fiscalYear.update({
    where: { id: parsed.data.fiscalYearId },
    data: {
      status: "LOCKED",
      lastLockedIvaPeriod: parsed.data.lastLockedIvaPeriod,
    },
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/fiscal-years`);
}

export async function reopenFiscalYearAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  const fiscalYearId = formData.get("fiscalYearId");
  if (typeof tenantId !== "string" || typeof companyId !== "string" || typeof fiscalYearId !== "string") {
    return { error: "Parametri non validi." };
  }

  const { membership } = await requireCompanyAccess(tenantId, companyId);
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return { error: "Solo un amministratore può riaprire un esercizio." };
  }

  await prisma.fiscalYear.update({
    where: { id: fiscalYearId },
    data: { status: "OPEN" },
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/fiscal-years`);
}
