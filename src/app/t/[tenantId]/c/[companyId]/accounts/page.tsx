import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { AccountTree } from "./account-tree";

export default async function AccountsPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
}) {
  const { tenantId, companyId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const accounts = await prisma.account.findMany({
    where: { companyId },
    orderBy: { code: "asc" },
  });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Piano dei conti</h1>
        <p className="text-sm text-gray-500">
          Struttura gerarchica mastro / conto / sottoconto, riclassificabile secondo lo schema di
          bilancio civilistico (SP/CE).
        </p>
      </div>
      <AccountTree tenantId={tenantId} companyId={companyId} accounts={accounts} />
    </div>
  );
}
