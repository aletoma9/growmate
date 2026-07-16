import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenantAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { CreateCompanyForm } from "./create-company-form";

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { membership } = await requireTenantAccess(tenantId);

  const companies = await prisma.company.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });

  if (companies.length === 1) {
    redirect(`/t/${tenantId}/c/${companies[0].id}`);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">{membership.tenant.name}</h1>
        <p className="text-sm text-gray-500">Seleziona un&apos;azienda o creane una nuova.</p>
      </div>

      <ul className="flex flex-col gap-2">
        {companies.map((c) => (
          <li key={c.id}>
            <Link
              href={`/t/${tenantId}/c/${c.id}`}
              className="block rounded border border-gray-200 px-4 py-3 text-sm hover:bg-gray-50"
            >
              <span className="font-medium">{c.name}</span>
              <span className="ml-2 text-gray-500">{c.legalForm}</span>
              {c.vatNumber && <span className="ml-2 text-gray-400">P.IVA {c.vatNumber}</span>}
            </Link>
          </li>
        ))}
        {companies.length === 0 && (
          <p className="text-sm text-gray-500">Nessuna azienda ancora creata.</p>
        )}
      </ul>

      <div className="rounded border border-gray-200 p-4">
        <h2 className="mb-4 text-lg font-medium">Nuova azienda</h2>
        <CreateCompanyForm tenantId={tenantId} />
      </div>
    </div>
  );
}
