import { requireCompanyAccess } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { computeTrialBalance, computeFinancialStatements, type StatementGroup } from "@/lib/financial-statements";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; companyId: string }>;
  searchParams: Promise<{ fiscalYearId?: string }>;
}) {
  const { tenantId, companyId } = await params;
  await requireCompanyAccess(tenantId, companyId);
  const query = await searchParams;

  const fiscalYears = await prisma.fiscalYear.findMany({ where: { companyId }, orderBy: { startDate: "desc" } });
  const fiscalYearId = query.fiscalYearId ?? fiscalYears[0]?.id;

  const [trialBalance, statements] = fiscalYearId
    ? await Promise.all([
        computeTrialBalance(companyId, fiscalYearId),
        computeFinancialStatements(companyId, fiscalYearId),
      ])
    : [[], null];

  const totalDebit = trialBalance.reduce((s, r) => s + r.totalDebit, 0);
  const totalCredit = trialBalance.reduce((s, r) => s + r.totalCredit, 0);

  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold">Bilanci</h1>
        <p className="text-sm text-gray-500">
          Bilancio di verifica sulle registrazioni definitive e riclassifica civilistica
          Stato Patrimoniale / Conto Economico (art. 2424-2425 c.c.).
        </p>
      </div>

      <form method="get" className="flex items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Esercizio</span>
          <select name="fiscalYearId" defaultValue={fiscalYearId} className="rounded border border-gray-300 px-2 py-1">
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {new Date(fy.startDate).getFullYear()}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded border border-gray-300 px-3 py-1.5">
          Filtra
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-medium">Bilancio di verifica</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-3">Conto</th>
              <th className="py-2 pr-3 text-right">Totale dare</th>
              <th className="py-2 pr-3 text-right">Totale avere</th>
              <th className="py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {trialBalance.map((row) => (
              <tr key={row.accountId} className="border-b border-gray-100">
                <td className="py-2 pr-3">
                  <span className="font-mono text-xs text-gray-400">{row.code}</span> {row.name}
                </td>
                <td className="py-2 pr-3 text-right font-mono">{row.totalDebit.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right font-mono">{row.totalCredit.toFixed(2)}</td>
                <td className="py-2 text-right font-mono">{row.balance.toFixed(2)}</td>
              </tr>
            ))}
            {trialBalance.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  Nessuna registrazione definitiva in questo esercizio.
                </td>
              </tr>
            )}
          </tbody>
          {trialBalance.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2 pr-3">Totale</td>
                <td className="py-2 pr-3 text-right font-mono">{totalDebit.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right font-mono">{totalCredit.toFixed(2)}</td>
                <td className="py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      {statements && (
        <>
          <section>
            <h2 className="mb-3 text-lg font-medium">Stato Patrimoniale</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-600">Attivo</h3>
                <GroupTable groups={statements.attivo} />
                <TotalRow label="Totale Attivo" value={statements.totaleAttivo} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-600">Passivo</h3>
                <GroupTable groups={statements.passivo} />
                <TotalRow label="Totale Passivo" value={statements.totalePassivo} />
              </div>
            </div>
            <p className={`mt-2 text-sm ${statements.quadra ? "text-green-700" : "text-red-600"}`}>
              {statements.quadra ? "Attivo = Passivo" : "Attivo ≠ Passivo: verificare le registrazioni"}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium">Conto Economico</h2>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-600">Valore della produzione</h3>
                <GroupTable groups={statements.valoreProduzione} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-600">Costi della produzione</h3>
                <GroupTable groups={statements.costiProduzione} />
              </div>
              <TotalRow label="Differenza tra valore e costi della produzione (A - B)" value={statements.risultatoOperativo} />
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-600">Proventi e oneri finanziari</h3>
                <GroupTable groups={statements.proventiOneriFinanziari} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-600">Imposte sul reddito</h3>
                <GroupTable groups={statements.imposte} />
              </div>
              <TotalRow label="Risultato d'esercizio" value={statements.risultatoEsercizio} emphasis />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function GroupTable({ groups }: { groups: StatementGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-gray-400">—</p>;
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {groups.map((g) => (
          <tr key={g.code} className="border-b border-gray-100">
            <td className="py-1.5 pr-3">{g.label}</td>
            <td className="py-1.5 text-right font-mono">{g.total.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalRow({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`flex justify-between border-t border-gray-300 pt-2 text-sm ${emphasis ? "text-base font-semibold" : "font-medium"}`}>
      <span>{label}</span>
      <span className="font-mono">{value.toFixed(2)}</span>
    </div>
  );
}
