"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { reservar } from "@/app/acciones/turnos";
import { fechaLocal, formatearFecha, formatearHora, formatearPesos } from "@/lib/fechas";
import { Asistente } from "./asistente";

type Props = {
  profesional: { id: number; nombre: string; slug: string };
  horarios: string[]; // ISO
  sena: number;
  sesion: { rol: "cliente" | "profesional"; esElMismo: boolean } | null;
  /** Horario que el cliente había elegido antes de ingresar */
  horarioInicial?: string | null;
};

export function ReservaInteractiva({ profesional, horarios, sena, sesion, horarioInicial }: Props) {
  const inicial = horarios.find((h) => horarioInicial && new Date(h).getTime() === new Date(horarioInicial).getTime()) ?? null;
  const dias = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const h of horarios) {
      const clave = fechaLocal(new Date(h));
      mapa.set(clave, [...(mapa.get(clave) ?? []), h]);
    }
    return [...mapa.entries()];
  }, [horarios]);

  const [diaElegido, setDiaElegido] = useState(inicial ? fechaLocal(new Date(inicial)) : (dias[0]?.[0] ?? ""));
  const [elegido, setElegido] = useState<string | null>(inicial);
  const [estado, accion, enviando] = useActionState(reservar, undefined);

  /** El asistente propone un horario: se selecciona en el calendario */
  function elegirDesdeAsistente(iso: string) {
    setDiaElegido(fechaLocal(new Date(iso)));
    setElegido(iso);
    document.getElementById("confirmar-reserva")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const horariosDelDia = dias.find(([d]) => d === diaElegido)?.[1] ?? [];

  return (
    <section aria-labelledby="titulo-reserva" className="min-w-0 space-y-6">
      <Asistente profesionalId={profesional.id} onElegir={elegirDesdeAsistente} />

      <div className="tarjeta p-6">
        <h2 id="titulo-reserva" className="titulo text-3xl">
          Elegí tu turno
        </h2>

        {dias.length === 0 ? (
          <p className="mt-4 text-suave">No hay turnos libres en las próximas dos semanas. Volvé a mirar en unos días.</p>
        ) : (
          <>
            <div role="tablist" aria-label="Días disponibles" className="-mx-2 mt-5 flex gap-2 overflow-x-auto px-2 pb-2">
              {dias.map(([dia, lista]) => {
                const fecha = new Date(lista[0]);
                const activo = dia === diaElegido;
                return (
                  <button
                    key={dia}
                    role="tab"
                    aria-selected={activo}
                    onClick={() => {
                      setDiaElegido(dia);
                      setElegido(null);
                    }}
                    className={`flex min-w-[76px] shrink-0 flex-col items-center rounded-2xl border px-3 py-2.5 transition ${
                      activo ? "border-tinta bg-tinta text-hoja" : "border-linea hover:border-tinta"
                    }`}
                  >
                    <span className="text-xs uppercase tracking-wider opacity-75">{formatearFecha(fecha, { weekday: "short", day: undefined, month: undefined })}</span>
                    <span className="titulo text-2xl">{formatearFecha(fecha, { weekday: undefined, day: "numeric", month: undefined })}</span>
                    <span className="text-xs opacity-75">{lista.length} libres</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-sm font-semibold">{diaElegido && formatearFecha(new Date(horariosDelDia[0]))}</p>
            <div role="radiogroup" aria-label="Horarios" className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {horariosDelDia.map((h) => (
                <button
                  key={h}
                  role="radio"
                  aria-checked={elegido === h}
                  onClick={() => setElegido(h)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold tabular-nums transition ${
                    elegido === h ? "border-terracota bg-terracota text-hoja" : "border-linea bg-papel/60 hover:border-terracota"
                  }`}
                >
                  {formatearHora(new Date(h))}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <form id="confirmar-reserva" action={accion} className="tarjeta space-y-4 bg-arena/60 p-6">
        <input type="hidden" name="profesionalId" value={profesional.id} />
        <input type="hidden" name="inicio" value={elegido ?? ""} />
        {elegido ? (
          <p className="titulo text-2xl">
            <span >{formatearFecha(new Date(elegido))}</span>, {formatearHora(new Date(elegido))} h
          </p>
        ) : (
          <p className="text-suave">Elegí un horario para continuar.</p>
        )}
        <div>
          <label htmlFor="nota" className="etiqueta">
            Nota para {profesional.nombre.split(" ")[0]} (opcional)
          </label>
          <textarea id="nota" name="nota" maxLength={300} rows={2} className="campo resize-none" placeholder="Ej: es mi primera consulta" />
        </div>
        {estado?.error && (
          <p role="alert" className="rounded-xl bg-alerta/10 px-4 py-3 text-sm font-medium text-alerta">
            {estado.error}
          </p>
        )}
        {sesion?.esElMismo ? (
          <p className="text-sm text-suave">Esta es tu propia página: así la ven tus clientes.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button className="boton" disabled={!elegido || enviando}>
              {enviando ? "Reservando…" : sena > 0 ? `Reservar y pagar seña de ${formatearPesos(sena)}` : "Confirmar turno"}
            </button>
            {!sesion && (
              <span className="text-sm text-suave">
                Te vamos a pedir que{" "}
                <Link className="font-semibold underline" href={`/ingresar?volver=/p/${profesional.slug}`}>
                  ingreses
                </Link>{" "}
                primero.
              </span>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
