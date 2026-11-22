import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { listarProfesionales } from "@/lib/turnos";
import { calcularSena } from "@/lib/horarios";
import { formatearPesos } from "@/lib/fechas";

async function ListaProfesionales() {
  await connection(); // datos frescos en cada visita
  const pros = await listarProfesionales();
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {pros.map((p, i) => (
        <li key={p.id}>
          <Link
            href={`/p/${p.slug}`}
            className="tarjeta group flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:border-terracota"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`titulo grid size-12 place-items-center rounded-full text-xl text-hoja ${["bg-terracota", "bg-oliva", "bg-tinta"][i % 3]}`}
              >
                {p.nombre[0]}
              </span>
              <div>
                <p className="titulo text-xl">{p.nombre}</p>
                <p className="text-sm text-suave">
                  {p.profesion} · {p.zona}
                </p>
              </div>
            </div>
            <p className="mt-4 line-clamp-3 flex-1 text-sm text-suave">{p.descripcion}</p>
            <div className="mt-5 flex items-end justify-between border-t border-dashed border-linea pt-4 text-sm">
              <div>
                <p className="font-semibold">{formatearPesos(p.precio)}</p>
                <p className="text-suave">
                  {p.duracionMin} min · seña {formatearPesos(calcularSena(p.precio, p.senaPorcentaje))}
                </p>
              </div>
              <span className="font-semibold text-terracota group-hover:underline">Ver turnos →</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EsqueletoLista() {
  return (
    <div className="grid gap-4 md:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="tarjeta h-64 animate-pulse bg-arena/50" />
      ))}
    </div>
  );
}

const PASOS = [
  { titulo: "Elegí día y hora", texto: "Ves solo los horarios realmente libres, o le pedís al asistente algo como “el jueves a la tarde”." },
  { titulo: "Dejá la seña", texto: "Pagás una parte con Mercado Pago. Tu lugar queda guardado 15 minutos mientras pagás." },
  { titulo: "Listo, confirmado", texto: "El turno aparece en tu cuenta y en la agenda del profesional. Si no podés ir, lo cancelás." },
];

export default function Inicio() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-20 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="sello bg-oliva-claro text-oliva">Turnos online con seña</p>
          <h1 className="titulo mt-5 text-5xl md:text-7xl">
            Reservá en un minuto.
            <br />
            <em className="text-terracota">Sin mensajes</em> de ida y vuelta.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-suave">
            Profesionales que publican su agenda, clientes que eligen horario y aseguran su lugar con una seña. Nadie
            pierde un turno por un “¿te queda bien el martes?”.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#profesionales" className="boton">
              Buscar un turno
            </a>
            <Link href="/registro?rol=profesional" className="boton-linea">
              Doy turnos, quiero mi agenda
            </Link>
          </div>
        </div>

        {/* Tarjeta ilustrativa de un turno confirmado */}
        <div aria-hidden className="relative mx-auto w-full max-w-sm">
          <div className="absolute -inset-3 -rotate-3 rounded-[26px] bg-oliva/15" />
          <div className="tarjeta relative rotate-1 p-6 shadow-[0_20px_50px_-25px_rgba(43,36,32,0.45)]">
            <div className="flex items-center justify-between">
              <span className="sello bg-oliva-claro text-oliva">● Confirmado</span>
              <span className="text-sm text-suave">Seña pagada</span>
            </div>
            <p className="titulo mt-6 text-6xl">
              17:30<span className="text-terracota">h</span>
            </p>
            <p className="mt-1 text-lg">Jueves 26 de noviembre</p>
            <div className="my-6 border-t-2 border-dotted border-linea" />
            <p className="font-semibold">Laura Méndez · Psicóloga</p>
            <p className="text-sm text-suave">Palermo, CABA · 50 minutos</p>
          </div>
        </div>
      </section>

      <section className="border-y border-linea bg-hoja">
        <ol className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-3">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo}>
              <span className="titulo text-5xl text-terracota/80">0{i + 1}</span>
              <h2 className="titulo mt-3 text-2xl">{paso.titulo}</h2>
              <p className="mt-2 text-suave">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="profesionales" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <h2 className="titulo text-4xl">Profesionales con turnos</h2>
          <p className="text-suave">Elegí uno para ver su agenda de las próximas dos semanas.</p>
        </div>
        <Suspense fallback={<EsqueletoLista />}>
          <ListaProfesionales />
        </Suspense>
      </section>
    </>
  );
}
