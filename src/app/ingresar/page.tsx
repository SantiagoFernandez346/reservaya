import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioIngreso } from "@/components/formularios-acceso";

export const metadata: Metadata = { title: "Ingresar" };

async function Formulario({ searchParams }: { searchParams: PageProps<"/ingresar">["searchParams"] }) {
  const { volver } = await searchParams;
  return <FormularioIngreso volver={typeof volver === "string" ? volver : "/panel"} />;
}

export default function PaginaIngreso({ searchParams }: PageProps<"/ingresar">) {
  return (
    <div className="mx-auto max-w-md px-5 py-14">
      <h1 className="titulo text-4xl">Hola de nuevo</h1>
      <p className="mt-2 text-suave">Ingresá para ver tus turnos o tu agenda.</p>
      <div className="tarjeta mt-8 p-6">
        <Suspense>
          <Formulario searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
