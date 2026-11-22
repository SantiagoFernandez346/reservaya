import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { DM_Sans, Fraunces } from "next/font/google";
import { Navegacion } from "@/components/navegacion";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  title: { default: "ReservaYa · Turnos online con seña", template: "%s · ReservaYa" },
  description: "Reservá turnos con profesionales y asegurá tu lugar pagando una seña con Mercado Pago.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-linea">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
            <Link href="/" className="titulo text-2xl" aria-label="ReservaYa, inicio">
              Reserva<span className="italic text-terracota">Ya</span>
              <span className="text-oliva">.</span>
            </Link>
            <Suspense fallback={<div className="h-10" />}>
              <Navegacion />
            </Suspense>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-linea">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-6 text-sm text-suave">
            <p>Proyecto de portfolio: los pagos son de prueba y no se cobra nada.</p>
            <p>
              Hecho por{" "}
              <a className="underline decoration-terracota underline-offset-4" href="https://santiagofernandez346.github.io/portafolio-2/">
                Santiago Fernandez
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
