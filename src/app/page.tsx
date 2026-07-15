import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, getUserMemberships } from "@/lib/tenant";

export default async function Home() {
  const user = await requireUser();
  const memberships = await getUserMemberships(user.id);

  if (memberships.length === 1) {
    redirect(`/t/${memberships[0].tenantId}`);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">I tuoi studi</h1>
      {memberships.length === 0 && (
        <p className="text-sm text-gray-500">Non fai parte di nessuno studio.</p>
      )}
      <ul className="flex flex-col gap-2">
        {memberships.map((m) => (
          <li key={m.id}>
            <Link
              href={`/t/${m.tenantId}`}
              className="block rounded border border-gray-200 px-4 py-3 text-sm hover:bg-gray-50"
            >
              <span className="font-medium">{m.tenant.name}</span>
              <span className="ml-2 text-gray-500">({m.role})</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
