"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ingresar, registrarse, type EstadoFormulario } from "@/app/acciones/auth";

function Campo({
  nombre,
  etiqueta,
  error,
  ...props
}: { nombre: string; etiqueta: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={nombre} className="etiqueta">
        {etiqueta}
      </label>
      <input
        id={nombre}
        name={nombre}
        className="campo"
        aria-invalid={!!error}
        aria-describedby={error ? `${nombre}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${nombre}-error`} className="mt-1 text-sm text-alerta">
          {error}
        </p>
      )}
    </div>
  );
}

function ErrorGeneral({ estado }: { estado: EstadoFormulario }) {
  if (!estado?.error) return null;
  return (
    <p role="alert" className="rounded-xl bg-alerta/10 px-4 py-3 text-sm font-medium text-alerta">
      {estado.error}
    </p>
  );
}

const CUENTAS_DEMO = [
  { etiqueta: "Cliente", email: "cliente@demo.reservaya.app" },
  { etiqueta: "Psicóloga", email: "laura@demo.reservaya.app" },
  { etiqueta: "Barbero", email: "tomas@demo.reservaya.app" },
];

export function FormularioIngreso({ volver }: { volver: string }) {
  const [estado, accion, enviando] = useActionState(ingresar, undefined);
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");

  return (
    <form action={accion} className="space-y-4" noValidate>
      <input type="hidden" name="volver" value={volver} />
      <ErrorGeneral estado={estado} />
      <Campo nombre="email" etiqueta="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={estado?.errores?.email} />
      <Campo nombre="clave" etiqueta="Contraseña" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} error={estado?.errores?.clave} />
      <button className="boton w-full" disabled={enviando}>
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>

      <div className="rounded-2xl bg-arena p-4 text-sm">
        <p className="font-semibold">¿Solo querés probar?</p>
        <p className="mt-1 text-suave">Usá una cuenta demo (contraseña demo1234):</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CUENTAS_DEMO.map((c) => (
            <button
              key={c.email}
              type="button"
              className="rounded-full border border-linea bg-hoja px-3 py-1.5 font-semibold hover:border-terracota"
              onClick={() => {
                setEmail(c.email);
                setClave("demo1234");
              }}
            >
              {c.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-suave">
        ¿No tenés cuenta?{" "}
        <Link href={`/registro?volver=${encodeURIComponent(volver)}`} className="font-semibold text-terracota underline-offset-4 hover:underline">
          Creá una
        </Link>
      </p>
    </form>
  );
}

export function FormularioRegistro({ volver, rolInicial }: { volver: string; rolInicial: "cliente" | "profesional" }) {
  const [estado, accion, enviando] = useActionState(registrarse, undefined);
  const [rol, setRol] = useState(rolInicial);
  const e = estado?.errores ?? {};

  return (
    <form action={accion} className="space-y-4" noValidate>
      <input type="hidden" name="volver" value={rol === "profesional" ? "/panel" : volver} />
      <input type="hidden" name="rol" value={rol} />
      <ErrorGeneral estado={estado} />

      <fieldset>
        <legend className="etiqueta">¿Cómo vas a usar ReservaYa?</legend>
        <div className="grid grid-cols-2 gap-2 rounded-full bg-arena p-1">
          {(["cliente", "profesional"] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={rol === opcion}
              onClick={() => setRol(opcion)}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${rol === opcion ? "bg-hoja shadow-sm" : "text-suave"}`}
            >
              {opcion === "cliente" ? "Quiero reservar" : "Doy turnos"}
            </button>
          ))}
        </div>
      </fieldset>

      <Campo nombre="nombre" etiqueta="Nombre y apellido" autoComplete="name" error={e.nombre} />
      <Campo nombre="email" etiqueta="Email" type="email" autoComplete="email" error={e.email} />
      <Campo nombre="clave" etiqueta="Contraseña" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" error={e.clave} />

      {rol === "profesional" && (
        <div className="space-y-4 rounded-2xl border border-dashed border-linea p-4">
          <Campo nombre="profesion" etiqueta="Profesión" placeholder="Ej: nutricionista, tatuador, profe de guitarra" error={e.profesion} />
          <Campo nombre="zona" etiqueta="Zona (opcional)" placeholder="Ej: Belgrano, CABA u Online" error={e.zona} />
          <div className="grid grid-cols-2 gap-3">
            <Campo nombre="precio" etiqueta="Precio por turno ($)" type="number" inputMode="numeric" min={1000} step={500} defaultValue={15000} error={e.precio} />
            <div>
              <label htmlFor="duracionMin" className="etiqueta">
                Duración
              </label>
              <select id="duracionMin" name="duracionMin" className="campo" defaultValue="60">
                {[30, 45, 50, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <button className="boton w-full" disabled={enviando}>
        {enviando ? "Creando cuenta…" : "Crear cuenta"}
      </button>
      <p className="text-center text-sm text-suave">
        ¿Ya tenés cuenta?{" "}
        <Link href={`/ingresar?volver=${encodeURIComponent(volver)}`} className="font-semibold text-terracota underline-offset-4 hover:underline">
          Ingresá
        </Link>
      </p>
    </form>
  );
}
