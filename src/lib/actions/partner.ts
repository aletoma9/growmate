"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAccess } from "@/lib/tenant";
import type { ActionState } from "@/lib/actions/auth";

const baseFields = {
  type: z.enum(["CLIENTE", "FORNITORE", "ENTRAMBI"]),
  name: z.string().trim().min(1, "Nome obbligatorio"),
  vatNumber: z.string().trim().optional(),
  taxCode: z.string().trim().optional(),
  address: z.string().trim().optional(),
  iban: z.string().trim().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).optional(),
};

const createSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  ...baseFields,
});

export async function createPartnerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = createSchema.safeParse({
    tenantId,
    companyId,
    type: formData.get("type"),
    name: formData.get("name"),
    vatNumber: formData.get("vatNumber") || undefined,
    taxCode: formData.get("taxCode") || undefined,
    address: formData.get("address") || undefined,
    iban: formData.get("iban") || undefined,
    paymentTermsDays: formData.get("paymentTermsDays") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  if (parsed.data.vatNumber) {
    const existing = await prisma.partner.findUnique({
      where: { companyId_vatNumber: { companyId, vatNumber: parsed.data.vatNumber } },
    });
    if (existing) return { error: "Esiste già un'anagrafica con questa partita IVA." };
  }

  await prisma.partner.create({
    data: {
      companyId,
      type: parsed.data.type,
      name: parsed.data.name,
      vatNumber: parsed.data.vatNumber,
      taxCode: parsed.data.taxCode,
      address: parsed.data.address,
      iban: parsed.data.iban,
      paymentTermsDays: parsed.data.paymentTermsDays,
    },
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/partners`);
}

const updateSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  partnerId: z.string().min(1),
  ...baseFields,
});

export async function updatePartnerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = updateSchema.safeParse({
    tenantId,
    companyId,
    partnerId: formData.get("partnerId"),
    type: formData.get("type"),
    name: formData.get("name"),
    vatNumber: formData.get("vatNumber") || undefined,
    taxCode: formData.get("taxCode") || undefined,
    address: formData.get("address") || undefined,
    iban: formData.get("iban") || undefined,
    paymentTermsDays: formData.get("paymentTermsDays") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  const partner = await prisma.partner.findFirst({ where: { id: parsed.data.partnerId, companyId } });
  if (!partner) return { error: "Anagrafica non trovata." };

  if (parsed.data.vatNumber && parsed.data.vatNumber !== partner.vatNumber) {
    const existing = await prisma.partner.findUnique({
      where: { companyId_vatNumber: { companyId, vatNumber: parsed.data.vatNumber } },
    });
    if (existing) return { error: "Esiste già un'anagrafica con questa partita IVA." };
  }

  await prisma.partner.update({
    where: { id: partner.id },
    data: {
      type: parsed.data.type,
      name: parsed.data.name,
      vatNumber: parsed.data.vatNumber,
      taxCode: parsed.data.taxCode,
      address: parsed.data.address,
      iban: parsed.data.iban,
      paymentTermsDays: parsed.data.paymentTermsDays,
    },
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/partners`);
}

export async function togglePartnerActiveAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  const partnerId = formData.get("partnerId");
  if (typeof tenantId !== "string" || typeof companyId !== "string" || typeof partnerId !== "string") {
    return { error: "Parametri non validi." };
  }

  await requireCompanyAccess(tenantId, companyId);

  const partner = await prisma.partner.findFirst({ where: { id: partnerId, companyId } });
  if (!partner) return { error: "Anagrafica non trovata." };

  await prisma.partner.update({ where: { id: partnerId }, data: { active: !partner.active } });

  revalidatePath(`/t/${tenantId}/c/${companyId}/partners`);
}
