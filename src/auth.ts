import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getUsuario, registrarLogin } from "@/lib/usuarios";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      // Solo permitir emails de @farmaciareig.net
      if (!user.email?.endsWith("@farmaciareig.net")) {
        return false;
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      // En el primer login, cargar rol y departamento desde Turso
      if (user?.email) {
        const dbUser = await getUsuario(user.email);
        if (dbUser) {
          token.role = dbUser.role;
          token.departamento = dbUser.departamento;
          token.nombre = dbUser.nombre;
          token.activo = dbUser.activo;
          // Registrar último login
          await registrarLogin(user.email);
        } else {
          // Usuario con email @farmaciareig.net pero sin registro en BD
          // Se le asigna rol por defecto: usuario, departamento farmacia
          token.role = "usuario";
          token.departamento = "farmacia";
          token.nombre = user.name || user.email.split("@")[0];
          token.activo = 1;
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
