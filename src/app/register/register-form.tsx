"use client";

import { useActionState } from "react";
import { registerAction } from "@/lib/actions/auth";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Il tuo nome
        </label>
        <input id="name" name="name" required className="rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" required className="rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input id="password" name="password" type="password" required minLength={8} className="rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="studioName" className="text-sm font-medium">
          Nome studio / organizzazione
        </label>
        <input id="studioName" name="studioName" required className="rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="companyName" className="text-sm font-medium">
          Nome prima azienda cliente
        </label>
        <input id="companyName" name="companyName" required className="rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creazione in corso…" : "Crea account"}
      </button>
    </form>
  );
}
