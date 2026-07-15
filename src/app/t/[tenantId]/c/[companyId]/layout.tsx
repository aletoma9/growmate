import Link from "next/link";
import { requireCompanyAccess } from "@/lib/tenant";
import { SignOutButton } from "@/components/sign-out-button";

const NAV_ITEMS = [
  { href: "", label: "Dashboard" },
  { href: "/accounts", label: "Piano dei conti" },
  { href: "/journal", label: "Prima nota" },
  { href: "/partners", label: "Anagrafiche" },
  { href: "/iva", label: "Registri IVA" },
  { href: "/reports", label: "Bilanci" },
  { href: "/fiscal-years", label: "Esercizi" },
];

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string; companyId: string }>;
}) {
  const { tenantId, companyId } = await params;
  const { company } = await requireCompanyAccess(tenantId, companyId);

  const base = `/t/${tenantId}/c/${companyId}`;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col gap-1 border-r border-gray-200 p-4">
        <div className="mb-4">
          <Link href={`/t/${tenantId}`} className="text-xs text-gray-500 hover:underline">
            ← Cambia azienda
          </Link>
          <h2 className="mt-1 font-semibold">{company.name}</h2>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={`${base}${item.href}`}
              className="rounded px-3 py-2 text-sm hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
