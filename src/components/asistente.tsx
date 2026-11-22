"use client";

import { useState } from "react";
import { formatearFecha, formatearHora } from "@/lib/fechas";

type Respuesta = { respuesta: string; horarios: string[]; modo: "ia" | "basico" };

const EJEMPLOS = ["El jueves a la tarde", "Mañana temprano", "La semana que viene después de las 18"];

export function Asistente({ profesionalId, onElegir }: { profesionalId: number; onElegir: (iso: string) => void }) {
  const [mensaje, setMensaje] = useState("");
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function preguntar(texto: string) {
    if (texto.trim().length < 2 || cargando) return;
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profesionalId, mensaje: texto }),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error ?? "No pude responder.");
      setRespuesta(datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude responder.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="tarjeta overflow-hidden">
      <div className="flex items-center gap-3 border-b border-linea bg-oliva px-6 py-4 text-hoja">
        <span aria-hidden className="titulo text-2xl italic">
          ✦
        </span>
        <div>
          <h2 className="titulo text-xl">Pedilo con tus palabras</h2>
          <p className="text-sm text-hoja/80">El asistente busca en la agenda real y te propone horarios.</p>
        </div>
      </div>
      <div className="space-y-4 p-6">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            preguntar(mensaje);
          }}
        >
          <label htmlFor="mensaje-asistente" className="sr-only">
            ¿Qué turno buscás?
          </label>
          <input
            id="mensaje-asistente"
            className="campo"
            placeholder="Ej: quiero un turno el jueves a la tarde"
            maxLength={300}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
          <button className="boton shrink-0" disabled={cargando}>
            {cargando ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {!respuesta && !error && (
          <div className="flex flex-wrap gap-2">
            {EJEMPLOS.map((ej) => (
              <button
                key={ej}
                type="button"
                onClick={() => {
                  setMensaje(ej);
                  preguntar(ej);
                }}
                className="rounded-full border border-dashed border-linea px-3 py-1.5 text-sm text-suave hover:border-oliva hover:text-oliva"
              >
                “{ej}”
              </button>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-alerta">
            {error}
          </p>
        )}

        {respuesta && (
          <div aria-live="polite" className="space-y-3">
            <p className="rounded-2xl rounded-tl-sm bg-oliva-claro px-4 py-3">{respuesta.respuesta}</p>
            {respuesta.horarios.length > 0 && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {respuesta.horarios.map((h) => (
                  <li key={h}>
                    <button
                      type="button"
                      onClick={() => onElegir(h)}
                      className="flex w-full items-center justify-between rounded-xl border border-linea px-4 py-2.5 text-left text-sm hover:border-terracota"
                    >
                      <span >{formatearFecha(new Date(h), { month: undefined })}</span>
                      <span className="font-semibold tabular-nums">{formatearHora(new Date(h))} →</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-suave">{respuesta.modo === "ia" ? "Respondido con Claude" : "Modo básico (sin IA)"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
