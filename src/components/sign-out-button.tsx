"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
    >
      Esci
    </button>
  );
}
