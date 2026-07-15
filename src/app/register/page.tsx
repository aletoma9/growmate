import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Registra il tuo studio</h1>
        <p className="text-sm text-gray-500">
          Crea l&apos;account, lo studio (tenant) e la prima azienda cliente.
        </p>
      </div>
      <RegisterForm />
      <p className="text-sm text-gray-500">
        Hai già un account?{" "}
        <Link href="/login" className="font-medium underline">
          Accedi
        </Link>
      </p>
    </div>
  );
}
