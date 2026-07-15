import Link from "next/link";
import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { BankAccountForm } from "./bank-account-form";

export default async function BankAccountsPage({
  params,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
}) {
  const { tenantId, companyId } = await params;
  await requireCompanyAccess(tenantId, companyId);

  const [bankAccounts, ledgerAccounts] = await Promise.all([
    prisma.bankAccount.findMany({ where: { companyId }, include: { account: true, transactions: true } }),
    prisma.account.findMany({ where: { companyId, isCashOrBank: true, active: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Riconciliazione bancaria</h1>
        <p className="text-sm text-gray-500">
          Importa l&apos;estratto conto PDF: i movimenti vengono estratti automaticamente e
          confrontati con le partite aperte in prima nota.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-3">Conto</th>
            <th className="py-2 pr-3">Banca</th>
            <th className="py-2 pr-3">IBAN</th>
            <th className="py-2 text-right">Movimenti importati</th>
          </tr>
        </thead>
        <tbody>
          {bankAccounts.map((ba) => (
            <tr key={ba.id} className="border-b border-gray-100">
              <td className="py-2 pr-3">
                <Link href={`/t/${tenantId}/c/${companyId}/banche/${ba.id}`} className="underline">
                  {ba.account.code} — {ba.account.name}
                </Link>
              </td>
              <td className="py-2 pr-3 text-gray-500">{ba.bankName ?? "—"}</td>
              <td className="py-2 pr-3 text-gray-500">{ba.iban ?? "—"}</td>
              <td className="py-2 text-right font-mono">{ba.transactions.length}</td>
            </tr>
          ))}
          {bankAccounts.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-gray-500">
                Nessun conto bancario collegato.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <BankAccountForm tenantId={tenantId} companyId={companyId} ledgerAccounts={ledgerAccounts} />
    </div>
  );
}
