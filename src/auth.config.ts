import type { NextAuthConfig } from "next-auth";

// Configurazione "edge-safe": nessuna dipendenza da Prisma/bcrypt, usata sia
// dal middleware (Edge runtime) sia dalla configurazione completa in auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
