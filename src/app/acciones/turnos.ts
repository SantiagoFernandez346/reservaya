"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { usuarioActual } from "@/lib/sesion";
import { buscarProfesional, cancelarTurno, ErrorReserva, obtenerTurno, registrarPago, reservarTurno } from "@/lib/turnos";
import { crearPagoDeSena, modoPagos } from "@/lib/pagos";

export type EstadoReserva = { error?: string } | undefined;

async function urlBase() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocolo = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

const esquemaReserva = z.object({
  profesionalId: z.coerce.number().int().positive(),
  inicio: z.iso.datetime(),
  nota: z.string().max(300).default(""),
});

export async function reservar(_: EstadoReserva, datos: FormData): Promise<EstadoReserva> {
  const r = esquemaReserva.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Elegí un horario." };

  const usuario = await usuarioActual();
  const pro = await buscarProfesional({ id: r.data.profesionalId });
  if (!pro) return { error: "El profesional no existe." };
  // Sin sesión: ingresa y vuelve al perfil con el mismo horario ya elegido
  if (!usuario) redirect(`/ingresar?volver=${encodeURIComponent(`/p/${pro.slug}?horario=${r.data.inicio}`)}`);
  if (usuario.profesionalId === pro.id) return { error: "No podés reservarte un turno a vos mismo." };

  let destino: string;
  try {
    const turno = await reservarTurno({ profesionalId: pro.id, clienteId: usuario.id, inicio: new Date(r.data.inicio), nota: r.data.nota });
    destino =
      turno.estado === "confirmado"
        ? `/pago/resultado?turno=${turno.id}`
        : await crearPagoDeSena({ turno, profesional: pro, emailCliente: usuario.email, urlBase: await urlBase() });
  } catch (error) {
    if (error instanceof ErrorReserva) return { error: error.message };
    console.error(error);
    return { error: "No pudimos crear la reserva. Probá de nuevo en unos minutos." };
  }
  revalidatePath(`/p/${pro.slug}`);
  redirect(destino);
}

/** Checkout simulado: solo existe cuando no hay Mercado Pago configurado */
export async function pagarSimulado(datos: FormData) {
  if (modoPagos() !== "simulado") throw new Error("El pago simulado está desactivado.");
  const turnoId = Number(datos.get("turnoId"));
  const usuario = await usuarioActual();
  const turno = await obtenerTurno(turnoId);
  if (!usuario || !turno || turno.clienteId !== usuario.id) redirect("/panel");

  const aprobado = datos.get("resultado") === "aprobado";
  if (aprobado) await registrarPago({ turnoId, pagoId: `sim-${turnoId}-${Date.now()}`, aprobado: true });
  redirect(`/pago/resultado?turno=${turnoId}${aprobado ? "" : "&estado=rechazado"}`);
}

/** Vuelve a abrir el pago de una seña pendiente (si el cliente cerró el checkout) */
export async function pagarSena(datos: FormData) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar");
  const turno = await obtenerTurno(Number(datos.get("turnoId")));
  if (!turno || turno.clienteId !== usuario.id || turno.estado !== "pendiente") redirect("/panel");
  const pro = await buscarProfesional({ id: turno.profesionalId });
  const destino = await crearPagoDeSena({ turno, profesional: pro!, emailCliente: usuario.email, urlBase: await urlBase() });
  redirect(destino);
}

export async function cancelar(datos: FormData) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar");
  try {
    await cancelarTurno(Number(datos.get("turnoId")), usuario);
  } catch (error) {
    if (!(error instanceof ErrorReserva)) throw error;
  }
  revalidatePath("/panel");
}
