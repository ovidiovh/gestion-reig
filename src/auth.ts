import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getUsuario, registrarLogin } from "@/lib/usuarios";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email?.endsWith("@farmaciareig.net")) {
        return false;
      }
      const dbUser = await getUsuario(user.email);
      if (!dbUser || dbUser.activo !== 1) {
        return false;
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user?.email) {
        const dbUser = await getUsuario(user.email);
        if (dbUser) {
          token.role = dbUser.role;
          token.departamento = dbUser.departamento;
          token.nombre = dbUser.nombre;
          token.activo = dbUser.activo;
          await registrarLogin(user.email);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.departamento = token.departamento as string;
        session.user.nombre = token.nombre as string;
        session.user.activo = token.activo as number;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
});
