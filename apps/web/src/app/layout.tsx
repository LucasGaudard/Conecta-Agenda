import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "@/providers/auth-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Conecta Agenda",
  description: "Plataforma de agendamento online para profissionais e pequenos negocios.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
