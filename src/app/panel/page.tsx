import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { usuarioActual, type UsuarioActual } from "@/lib/sesion";
import { agendaDelProfesional, buscarProfesional, franjasDelProfesional, turnosDelCliente } from "@/lib/turnos";
import { fechaLocal, formatearFecha, formatearHora, formatearPesos } from "@/lib/fechas";
import { cancelar, pagarSena } from "@/app/acciones/turnos";
import { EditorHorarios, EditorPerfil, ResumenSemanal } from "@/components/panel-profesional";
import type { EstadoTurno } from "@/db/schema";

export const metadata: Metadata = { title: "Mi panel" };

const SELLOS: Record<EstadoTurno, string> = {
  confirmado: "bg-oliva-claro text-oliva",
  pendiente: "bg-arena text-tinta",
  cancelado: "bg-linea/60 text-suave",
  vencido: "bg-linea/60 text-suave",
};
const NOMBRES: Record<EstadoTurno, string> = {
  confirmado: "Confirmado",
  pendiente: "Falta la seña",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

function Sello({ estado }: { estado: EstadoTurno }) {
  return <span className={`sello ${SELLOS[estado]}`}>{NOMBRES[estado]}</span>;
}

function BotonCancelar({ turnoId }: { turnoId: number }) {
  return (
    <form action={cancelar}>
      <input type="hidden" name="turnoId" value={turnoId} />
      <button className="text-sm font-semibold text-suave underline-offset-4 hover:text-alerta hover:underline">Cancelar</button>
    </form>
  );
}

async function PanelCliente({ usuario }: { usuario: UsuarioActual }) {
  const turnos = await turnosDelCliente(usuario.id);
  const ahora = new Date();
  const proximos = turnos.filter((t) => t.fin > ahora && (t.estado === "confirmado" || t.estado === "pendiente")).reverse();
  const historial = turnos.filter((t) => !proximos.includes(t));

  return (
    <div className="space-y-10">
      <section>
        <h2 className="titulo text-2xl">Próximos turnos</h2>
        {proximos.length === 0 ? (
          <div className="tarjeta mt-4 p-8 text-center">
            <p className="text-suave">No tenés turnos reservados.</p>
            <Link href="/#profesionales" className="boton mt-4">
              Buscar un turno
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {proximos.map((t) => (
              <li key={t.id} className="tarjeta flex flex-col p-6" data-testid="turno">
                <div className="flex items-center justify-between">
                  <Sello estado={t.estado} />
                  <span className="text-sm text-suave">Seña {formatearPesos(t.montoSena)}</span>
                </div>
                <p className="titulo mt-4 text-4xl">
                  {formatearHora(t.inicio)}
                  <span className="text-terracota">h</span>
                </p>
                <p >{formatearFecha(t.inicio)}</p>
                <p className="mt-3 font-semibold">
                  <Link href={`/p/${t.slug}`} className="hover:underline">
                    {t.profesional}
                  </Link>{" "}
                  · {t.profesion}
                </p>
                <p className="text-sm text-suave">{t.zona}</p>
                <div className="mt-5 flex items-center gap-4 border-t border-dashed border-linea pt-4">
                  {t.estado === "pendiente" && (
                    <form action={pagarSena}>
                      <input type="hidden" name="turnoId" value={t.id} />
                      <button className="boton !py-2">Pagar seña</button>
                    </form>
                  )}
                  <BotonCancelar turnoId={t.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {historial.length > 0 && (
        <section>
          <h2 className="titulo text-2xl">Historial</h2>
          <ul className="tarjeta mt-4 divide-y divide-linea">
            {historial.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span >{formatearFecha(t.inicio, { weekday: "short" })}</span> {formatearHora(t.inicio)} h · {t.profesional}
                </span>
                <Sello estado={t.estado} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

async function PanelProfesional({ usuario }: { usuario: UsuarioActual }) {
  const id = usuario.profesionalId!;
  const [pro, agenda, franjas] = await Promise.all([buscarProfesional({ id }), agendaDelProfesional(id), franjasDelProfesional(id)]);
  if (!pro) redirect("/");

  const porDia = new Map<string, typeof agenda>();
  for (const t of agenda) {
    const clave = fechaLocal(t.inicio);
    porDia.set(clave, [...(porDia.get(clave) ?? []), t]);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-10">
        <ResumenSemanal />
        <section>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="titulo text-2xl">Agenda</h2>
            <Link href={`/p/${pro.slug}`} className="text-sm font-semibold text-terracota hover:underline">
              Ver mi página pública →
            </Link>
          </div>
          {agenda.length === 0 ? (
            <p className="tarjeta mt-4 p-8 text-center text-suave">Todavía no tenés turnos. Compartí el link de tu página para recibir reservas.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {[...porDia.entries()].map(([dia, lista]) => (
                <div key={dia}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-suave">{formatearFecha(lista[0].inicio)}</h3>
                  <ul className="tarjeta divide-y divide-linea">
                    {lista.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4" data-testid="turno-agenda">
                        <span className="titulo w-16 text-2xl tabular-nums">{formatearHora(t.inicio)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{t.cliente}</p>
                          {t.nota && <p className="truncate text-sm text-suave">“{t.nota}”</p>}
                        </div>
                        <Sello estado={t.estado} />
                        <BotonCancelar turnoId={t.id} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <EditorHorarios franjas={franjas.map((f) => ({ diaSemana: f.diaSemana, desdeMin: f.desdeMin, hastaMin: f.hastaMin }))} />
        <EditorPerfil perfil={pro} />
      </aside>
    </div>
  );
}

async function Contenido() {
  await connection();
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?volver=/panel");
  const esPro = usuario.rol === "profesional" && usuario.profesionalId;

  return (
    <>
      <p className="sello bg-arena">{esPro ? "Panel profesional" : "Tu cuenta"}</p>
      <h1 className="titulo mt-4 text-5xl">{esPro ? "Tu agenda" : "Tus turnos"}</h1>
      <p className="mt-2 text-suave">Hola, {usuario.nombre}.</p>
      <div className="mt-10">{esPro ? <PanelProfesional usuario={usuario} /> : <PanelCliente usuario={usuario} />}</div>
    </>
  );
}

export default function PaginaPanel() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Suspense fallback={<div className="h-[60vh] animate-pulse" />}>
        <Contenido />
      </Suspense>
    </div>
  );
}
