import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Nessun login richiesto per l'uso normale dell'app: se non c'è una sessione
 * attiva (nessuno ha fatto login esplicitamente da /login), si usa in modo
 * trasparente il primo utente esistente. Se il database è del tutto vuoto,
 * serve prima registrare uno studio da /register.
 */
export async function requireUser() {
  const session = await auth();
  if (session?.user?.id) {
    return session.user;
  }

  const defaultUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!defaultUser) {
    redirect("/register");
  }
  return defaultUser;
}

export async function getUserMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: { tenant: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Verifica che l'utente corrente abbia accesso al tenant e restituisce il ruolo.
 * Da chiamare in ogni layout/route/server action che opera su dati di un tenant.
 */
export async function requireTenantAccess(tenantId: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId } },
    include: { tenant: true },
  });
  if (!membership) {
    notFound();
  }
  return { user, membership };
}

/**
 * Verifica che l'azienda appartenga al tenant a cui l'utente ha accesso.
 */
export async function requireCompanyAccess(tenantId: string, companyId: string) {
  const { user, membership } = await requireTenantAccess(tenantId);
  const company = await prisma.company.findFirst({
    where: { id: companyId, tenantId },
  });
  if (!company) {
    notFound();
  }
  return { user, membership, company };
}
