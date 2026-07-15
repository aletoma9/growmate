"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { provisionCompanyDefaults } from "@/lib/provisioning";

const registerSchema = z.object({
  name: z.string().min(2, "Nome troppo corto"),
  email: z.string().email("Email non valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
  studioName: z.string().min(2, "Nome studio/azienda troppo corto"),
  companyName: z.string().min(2, "Nome azienda troppo corto"),
});

export type ActionState = { error?: string } | undefined;

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Credenziali non valide." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Email o password errati." };
    }
    throw err;
  }
}

export async function registerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    studioName: formData.get("studioName"),
    companyName: formData.get("companyName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const { name, email, password, studioName, companyName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Esiste già un utente con questa email." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const company = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash } });
    const tenant = await tx.tenant.create({
      data: {
        name: studioName,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    return tx.company.create({
      data: { tenantId: tenant.id, name: companyName },
    });
  });

  await provisionCompanyDefaults(company.id);

  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Registrazione completata ma login automatico fallito. Accedi manualmente." };
    }
    throw err;
  }
}
