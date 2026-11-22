"use client";

import { useActionState, useState, useTransition } from "react";
import { guardarHorarios, guardarPerfil, pedirResumen } from "@/app/acciones/panel";
import type { Resumen } from "@/lib/asistente/resumen";
import { DIAS, minutosATexto } from "@/lib/fechas";

function Aviso({ estado }: { estado: { ok?: string; error?: string } | undefined }) {
  if (!estado) return null;
  return (
    <p role="status" className={`text-sm font-medium ${estado.error ? "text-alerta" : "text-oliva"}`}>
      {estado.error ?? estado.ok}
    </p>
  );
}

export function ResumenSemanal() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <section className="tarjeta overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-tinta px-6 py-5 text-hoja">
        <div>
          <h2 className="titulo text-2xl">
            Tu semana <span className="italic text-[#f0a37f]">en resumen</span>
          </h2>
          <p className="text-sm text-hoja/70">Los próximos 7 días, contados por el asistente.</p>
        </div>
        <button
          className="rounded-full bg-hoja px-4 py-2 text-sm font-semibold text-tinta hover:bg-arena disabled:opacity-60"
          disabled={pendiente}
          onClick={() => iniciar(async () => setResumen(await pedirResumen()))}
        >
          {pendiente ? "Pensando…" : resumen ? "Actualizar" : "Generar resumen"}
        </button>
      </div>
      {resumen && (
        <div className="space-y-4 p-6" aria-live="polite">
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              ["Turnos", resumen.datos.turnos],
              ["Señas cobradas", new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(resumen.datos.senasCobradas)],
              ["Horarios libres", resumen.datos.horariosLibres],
            ].map(([dt, dd]) => (
              <div key={dt} className="rounded-2xl bg-arena px-2 py-3">
                <dd className="titulo text-2xl">{dd}</dd>
                <dt className="text-xs text-suave">{dt}</dt>
              </div>
            ))}
          </dl>
          <p className="leading-relaxed">{resumen.texto}</p>
          <p className="text-xs text-suave">{resumen.modo === "ia" ? "Redactado con Claude" : "Resumen automático (sin IA)"}</p>
        </div>
      )}
    </section>
  );
}

type Franja = { diaSemana: number; desdeMin: number; hastaMin: number };

export function EditorHorarios({ franjas }: { franjas: Franja[] }) {
  const [estado, accion, guardando] = useActionState(guardarHorarios, undefined);
  const orden = [1, 2, 3, 4, 5, 6, 0];

  return (
    <form action={accion} className="tarjeta space-y-4 p-6">
      <div>
        <h2 className="titulo text-xl">Horarios de atención</h2>
        <p className="text-sm text-suave">Hasta dos franjas por día (por ejemplo, mañana y tarde).</p>
      </div>
      <ul className="space-y-3">
        {orden.map((dia) => {
          const delDia = franjas.filter((f) => f.diaSemana === dia);
          return (
            <li key={dia} className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-semibold capitalize">
                <input type="checkbox" name={`d${dia}_activo`} defaultChecked={delDia.length > 0} className="size-4 accent-terracota" />
                {DIAS[dia]}
              </label>
              <div className="grid gap-1.5 pl-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {[1, 2].map((n) => {
                  const f = delDia[n - 1];
                  return (
                    <div key={n} className="flex items-center gap-1 text-sm">
                      <input
                        aria-label={`${DIAS[dia]}, franja ${n}, desde`}
                        name={`d${dia}_desde${n}`}
                        type="time"
                        defaultValue={f ? minutosATexto(f.desdeMin) : ""}
                        className="campo !px-1.5 !py-1 text-xs"
                      />
                      <span aria-hidden>–</span>
                      <input
                        aria-label={`${DIAS[dia]}, franja ${n}, hasta`}
                        name={`d${dia}_hasta${n}`}
                        type="time"
                        defaultValue={f ? minutosATexto(f.hastaMin) : ""}
                        className="campo !px-1.5 !py-1 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <Aviso estado={estado} />
      <button className="boton w-full" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar horarios"}
      </button>
    </form>
  );
}

type Perfil = { profesion: string; zona: string; descripcion: string; precio: number; duracionMin: number; senaPorcentaje: number };

export function EditorPerfil({ perfil }: { perfil: Perfil }) {
  const [estado, accion, guardando] = useActionState(guardarPerfil, undefined);
  return (
    <form action={accion} className="tarjeta space-y-4 p-6">
      <h2 className="titulo text-xl">Tu perfil</h2>
      <div>
        <label htmlFor="profesion" className="etiqueta">
          Profesión
        </label>
        <input id="profesion" name="profesion" defaultValue={perfil.profesion} className="campo" />
      </div>
      <div>
        <label htmlFor="zona" className="etiqueta">
          Zona
        </label>
        <input id="zona" name="zona" defaultValue={perfil.zona} className="campo" />
      </div>
      <div>
        <label htmlFor="descripcion" className="etiqueta">
          Descripción
        </label>
        <textarea id="descripcion" name="descripcion" rows={3} maxLength={600} defaultValue={perfil.descripcion} className="campo resize-none" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="precio" className="etiqueta">
            Precio $
          </label>
          <input id="precio" name="precio" type="number" min={1000} step={500} defaultValue={perfil.precio} className="campo !px-2" />
        </div>
        <div>
          <label htmlFor="duracionMin" className="etiqueta">
            Minutos
          </label>
          <input id="duracionMin" name="duracionMin" type="number" min={15} max={240} step={5} defaultValue={perfil.duracionMin} className="campo !px-2" />
        </div>
        <div>
          <label htmlFor="senaPorcentaje" className="etiqueta">
            Seña %
          </label>
          <input id="senaPorcentaje" name="senaPorcentaje" type="number" min={0} max={100} step={5} defaultValue={perfil.senaPorcentaje} className="campo !px-2" />
        </div>
      </div>
      <Aviso estado={estado} />
      <button className="boton w-full" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar perfil"}
      </button>
    </form>
  );
}
