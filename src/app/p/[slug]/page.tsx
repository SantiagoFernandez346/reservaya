import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { buscarProfesional, franjasDelProfesional, horariosLibres } from "@/lib/turnos";
import { calcularSena } from "@/lib/horarios";
import { DIAS, formatearPesos, minutosATexto } from "@/lib/fechas";
import { usuarioActual } from "@/lib/sesion";
import { ReservaInteractiva } from "@/components/reserva-interactiva";

async function Perfil({ params, searchParams }: Pick<PageProps<"/p/[slug]">, "params" | "searchParams">) {
  await connection();
  const { slug } = await params;
  const { horario } = await searchParams;
  const pro = await buscarProfesional({ slug });
  if (!pro) notFound();

  const [libres, franjas, usuario] = await Promise.all([horariosLibres(pro.id), franjasDelProfesional(pro.id), usuarioActual()]);
  const sena = calcularSena(pro.precio, pro.senaPorcentaje);

  // Resumen de horarios de atención: "lunes 10:00–13:00 · 15:00–19:00"
  const porDia = new Map<number, string[]>();
  for (const f of franjas) porDia.set(f.diaSemana, [...(porDia.get(f.diaSemana) ?? []), `${minutosATexto(f.desdeMin)}–${minutosATexto(f.hastaMin)}`]);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-6">
        <div>
          <p className="sello bg-arena">{pro.profesion}</p>
          <h1 className="titulo mt-4 text-5xl">{pro.nombre}</h1>
          <p className="mt-2 text-suave">{pro.zona}</p>
        </div>
        <p className="leading-relaxed">{pro.descripcion}</p>
        <dl className="tarjeta divide-y divide-linea text-sm">
          {[
            ["Duración", `${pro.duracionMin} minutos`],
            ["Precio", formatearPesos(pro.precio)],
            ["Seña para reservar", sena > 0 ? `${formatearPesos(sena)} (${pro.senaPorcentaje}%)` : "No pide seña"],
          ].map(([dt, dd]) => (
            <div key={dt} className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-suave">{dt}</dt>
              <dd className="font-semibold">{dd}</dd>
            </div>
          ))}
        </dl>
        <div>
          <h2 className="titulo text-xl">Horarios de atención</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {[1, 2, 3, 4, 5, 6, 0]
              .filter((d) => porDia.has(d))
              .map((d) => (
                <li key={d} className="flex justify-between gap-4">
                  <span className="capitalize text-suave">{DIAS[d]}</span>
                  <span>{porDia.get(d)!.join(" · ")}</span>
                </li>
              ))}
          </ul>
        </div>
      </aside>

      <ReservaInteractiva
        profesional={{ id: pro.id, nombre: pro.nombre, slug: pro.slug }}
        horarios={libres.map((h) => h.inicio.toISOString())}
        horarioInicial={typeof horario === "string" ? horario : null}
        sena={sena}
        sesion={usuario ? { rol: usuario.rol, esElMismo: usuario.profesionalId === pro.id } : null}
      />
    </div>
  );
}

export default function PaginaProfesional({ params, searchParams }: PageProps<"/p/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-6xl animate-pulse px-5 py-12" />}>
      <Perfil params={params} searchParams={searchParams} />
    </Suspense>
  );
}
