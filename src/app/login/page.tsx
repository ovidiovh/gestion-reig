"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    desactivado: "Tu cuenta ha sido desactivada. Contacta con el administrador.",
    AccessDenied: "Tu cuenta no tiene acceso autorizado. Contacta con el administrador.",
    OAuthSignin: "Error al conectar con Google. Inténtalo de nuevo.",
    default: "Error de autenticación. Inténtalo de nuevo.",
  };

  const errorMessage = error
    ? errorMessages[error] || errorMessages.default
    : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#e8f5ec" }}
    >
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: "#1a8c3a" }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path
                  d="M16 4v24M4 16h24"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1
              className="text-2xl"
              style={{
                color: "#2a2e2b",
                fontFamily: "'DM Serif Display', serif",
              }}
            >
              Gestión VR
            </h1>
            <p className="text-sm mt-1" style={{ color: "#5a615c" }}>
              Panel de Gestión
            </p>
          </div>

          {/* Error */}
          {errorMessage && (
            <div
              className="mb-6 p-3 rounded-lg text-sm text-center"
              style={{
                background: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fecaca",
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Botón Google */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border text-sm font-medium transition-all hover:bg-gray-50 active:scale-[0.98]"
            style={{
              borderColor: "#d1d5db",
              color: "#2a2e2b",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {/* Google icon */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Acceder con Google
          </button>

          <p
            className="text-xs text-center mt-4"
            style={{ color: "#9ca3af" }}
          >
            Acceso restringido a personal autorizado
          </p>
        </div>

        <p
          className="text-center text-xs mt-6"
          style={{ color: "#5a615c" }}
        >
          © Gestión VR
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
