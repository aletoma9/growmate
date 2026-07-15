"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant";
import { provisionCompanyDefaults } from "@/lib/provisioning";
import type { ActionState } from "@/lib/actions/auth";

const createCompanySchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(2, "Nome azienda troppo corto"),
  legalForm: z.enum(["SRL", "SRLS", "SPA", "SAPA", "ALTRA"]),
  vatNumber: z.string().trim().optional(),
  taxCode: z.string().trim().optional(),
  ivaSettlementPeriod: z.enum(["MONTHLY", "QUARTERLY"]),
});

export async function createCompanyAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  if (typeof tenantId !== "string") return { error: "Tenant non valido." };

  await requireTenantAccess(tenantId);

  const parsed = createCompanySchema.safeParse({
    tenantId,
    name: formData.get("name"),
    legalForm: formData.get("legalForm"),
    vatNumber: formData.get("vatNumber") || undefined,
    taxCode: formData.get("taxCode") || undefined,
    ivaSettlementPeriod: formData.get("ivaSettlementPeriod"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const company = await prisma.company.create({ data: parsed.data });
  await provisionCompanyDefaults(company.id);

  revalidatePath(`/t/${tenantId}`);
  redirect(`/t/${tenantId}/c/${company.id}`);
}
