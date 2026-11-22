import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioRegistro } from "@/components/formularios-acceso";

export const metadata: Metadata = { title: "Crear cuenta" };

async function Formulario({ searchParams }: { searchParams: PageProps<"/registro">["searchParams"] }) {
  const { volver, rol } = await searchParams;
  return (
    <FormularioRegistro
      volver={typeof volver === "string" ? volver : "/panel"}
      rolInicial={rol === "profesional" ? "profesional" : "cliente"}
    />
  );
}

export default function PaginaRegistro({ searchParams }: PageProps<"/registro">) {
  return (
    <div className="mx-auto max-w-md px-5 py-14">
      <h1 className="titulo text-4xl">Creá tu cuenta</h1>
      <p className="mt-2 text-suave">Para reservar turnos o para empezar a recibirlos.</p>
      <div className="tarjeta mt-8 p-6">
        <Suspense>
          <Formulario searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
