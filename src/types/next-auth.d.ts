import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      departamento: string;
      nombre: string;
      activo: number;
    };
  }

  interface User {
    role?: string;
    departamento?: string;
    nombre?: string;
    activo?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    departamento?: string;
    nombre?: string;
    activo?: number;
  }
}
