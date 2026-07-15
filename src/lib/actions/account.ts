"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCompanyAccess } from "@/lib/tenant";
import type { ActionState } from "@/lib/actions/auth";
import type { AccountLevel } from "@/generated/prisma/client";

const NATURE_VALUES = ["ATTIVO", "PASSIVO", "COSTO", "RICAVO", "CONTO_ORDINE"] as const;

const baseAccountFields = {
  code: z.string().trim().min(1, "Codice obbligatorio"),
  name: z.string().trim().min(1, "Nome obbligatorio"),
  nature: z.enum(NATURE_VALUES),
  balanceSheetItem: z.string().trim().optional(),
  isReconcilable: z.coerce.boolean().optional(),
  isPartnerLedger: z.coerce.boolean().optional(),
  isCashOrBank: z.coerce.boolean().optional(),
};

const createAccountSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  parentId: z.string().optional(),
  ...baseAccountFields,
});

function childLevelOf(level: AccountLevel): AccountLevel | null {
  if (level === "MASTRO") return "CONTO";
  if (level === "CONTO") return "SOTTOCONTO";
  return null;
}

export async function createAccountAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = createAccountSchema.safeParse({
    tenantId,
    companyId,
    parentId: formData.get("parentId") || undefined,
    code: formData.get("code"),
    name: formData.get("name"),
    nature: formData.get("nature"),
    balanceSheetItem: formData.get("balanceSheetItem") || undefined,
    isReconcilable: formData.get("isReconcilable") === "on",
    isPartnerLedger: formData.get("isPartnerLedger") === "on",
    isCashOrBank: formData.get("isCashOrBank") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  let level: AccountLevel = "MASTRO";
  if (parsed.data.parentId) {
    const parent = await prisma.account.findFirst({
      where: { id: parsed.data.parentId, companyId },
    });
    if (!parent) return { error: "Conto padre non valido." };
    const childLevel = childLevelOf(parent.level);
    if (!childLevel) return { error: "I sottoconti non possono avere ulteriori sottoconti." };
    level = childLevel;
  }

  const existing = await prisma.account.findUnique({
    where: { companyId_code: { companyId, code: parsed.data.code } },
  });
  if (existing) return { error: "Esiste già un conto con questo codice." };

  await prisma.account.create({
    data: {
      companyId,
      parentId: parsed.data.parentId ?? null,
      code: parsed.data.code,
      name: parsed.data.name,
      level,
      nature: parsed.data.nature,
      balanceSheetItem: parsed.data.balanceSheetItem,
      isReconcilable: parsed.data.isReconcilable ?? level === "SOTTOCONTO",
      isPartnerLedger: parsed.data.isPartnerLedger ?? false,
      isCashOrBank: parsed.data.isCashOrBank ?? false,
    },
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/accounts`);
}

const updateAccountSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
  accountId: z.string().min(1),
  ...baseAccountFields,
});

export async function updateAccountAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  if (typeof tenantId !== "string" || typeof companyId !== "string") return { error: "Parametri non validi." };

  await requireCompanyAccess(tenantId, companyId);

  const parsed = updateAccountSchema.safeParse({
    tenantId,
    companyId,
    accountId: formData.get("accountId"),
    code: formData.get("code"),
    name: formData.get("name"),
    nature: formData.get("nature"),
    balanceSheetItem: formData.get("balanceSheetItem") || undefined,
    isReconcilable: formData.get("isReconcilable") === "on",
    isPartnerLedger: formData.get("isPartnerLedger") === "on",
    isCashOrBank: formData.get("isCashOrBank") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };

  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, companyId },
  });
  if (!account) return { error: "Conto non trovato." };

  if (parsed.data.code !== account.code) {
    const existing = await prisma.account.findUnique({
      where: { companyId_code: { companyId, code: parsed.data.code } },
    });
    if (existing) return { error: "Esiste già un conto con questo codice." };
  }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      nature: parsed.data.nature,
      balanceSheetItem: parsed.data.balanceSheetItem,
      isReconcilable: parsed.data.isReconcilable ?? account.isReconcilable,
      isPartnerLedger: parsed.data.isPartnerLedger ?? false,
      isCashOrBank: parsed.data.isCashOrBank ?? false,
    },
  });

  revalidatePath(`/t/${tenantId}/c/${companyId}/accounts`);
}

export async function toggleAccountActiveAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const tenantId = formData.get("tenantId");
  const companyId = formData.get("companyId");
  const accountId = formData.get("accountId");
  if (typeof tenantId !== "string" || typeof companyId !== "string" || typeof accountId !== "string") {
    return { error: "Parametri non validi." };
  }

  await requireCompanyAccess(tenantId, companyId);

  const account = await prisma.account.findFirst({ where: { id: accountId, companyId } });
  if (!account) return { error: "Conto non trovato." };

  await prisma.account.update({ where: { id: accountId }, data: { active: !account.active } });

  revalidatePath(`/t/${tenantId}/c/${companyId}/accounts`);
}
