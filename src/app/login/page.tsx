import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">ContSocietà</h1>
        <p className="text-sm text-gray-500">Accedi al tuo studio</p>
      </div>
      <LoginForm callbackUrl={callbackUrl ?? "/"} />
      <p className="text-sm text-gray-500">
        Non hai un account?{" "}
        <Link href="/register" className="font-medium underline">
          Registra il tuo studio
        </Link>
      </p>
    </div>
  );
}
