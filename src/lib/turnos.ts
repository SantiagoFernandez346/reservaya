import "server-only";
import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { obtenerDb, esSuperposicion, type DB } from "@/db";
import { disponibilidad, eventosPago, profesionales, turnos, usuarios } from "@/db/schema";
import { calcularSena, generarHorariosLibres, type Intervalo } from "./horarios";

/** Minutos que se guarda un turno mientras el cliente paga la seña */
export const MINUTOS_PARA_PAGAR = 15;
const ACTIVOS = ["pendiente", "confirmado"] as const;

export class ErrorReserva extends Error {}

export async function listarProfesionales() {
  const db = await obtenerDb();
  return db
    .select({
      id: profesionales.id,
      slug: profesionales.slug,
      nombre: usuarios.nombre,
      profesion: profesionales.profesion,
      descripcion: profesionales.descripcion,
      zona: profesionales.zona,
      duracionMin: profesionales.duracionMin,
      precio: profesionales.precio,
      senaPorcentaje: profesionales.senaPorcentaje,
    })
    .from(profesionales)
    .innerJoin(usuarios, eq(usuarios.id, profesionales.usuarioId))
    .orderBy(asc(profesionales.id));
}

export type ProfesionalPublico = Awaited<ReturnType<typeof listarProfesionales>>[number];

export async function buscarProfesional(filtro: { slug: string } | { id: number }) {
  const db = await obtenerDb();
  const [pro] = await db
    .select({
      id: profesionales.id,
      slug: profesionales.slug,
      nombre: usuarios.nombre,
      profesion: profesionales.profesion,
      descripcion: profesionales.descripcion,
      zona: profesionales.zona,
      duracionMin: profesionales.duracionMin,
      precio: profesionales.precio,
      senaPorcentaje: profesionales.senaPorcentaje,
    })
    .from(profesionales)
    .innerJoin(usuarios, eq(usuarios.id, profesionales.usuarioId))
    .where("slug" in filtro ? eq(profesionales.slug, filtro.slug) : eq(profesionales.id, filtro.id));
  return pro ?? null;
}

/** Pasa a "vencido" los turnos cuya seña no se pagó a tiempo, liberando el horario */
async function liberarVencidos(db: DB | Parameters<Parameters<DB["transaction"]>[0]>[0], profesionalId?: number) {
  await db
    .update(turnos)
    .set({ estado: "vencido" })
    .where(
      and(
        eq(turnos.estado, "pendiente"),
        lt(turnos.expiraEn, sql`now()`),
        profesionalId ? eq(turnos.profesionalId, profesionalId) : undefined,
      ),
    );
}

export async function horariosLibres(profesionalId: number, { dias = 14, ahora = new Date() } = {}) {
  const db = await obtenerDb();
  await liberarVencidos(db, profesionalId);
  const [pro] = await db.select().from(profesionales).where(eq(profesionales.id, profesionalId));
  if (!pro) return [];
  const franjas = await db.select().from(disponibilidad).where(eq(disponibilidad.profesionalId, profesionalId));
  const ocupados = await db
    .select({ inicio: turnos.inicio, fin: turnos.fin })
    .from(turnos)
    .where(and(eq(turnos.profesionalId, profesionalId), inArray(turnos.estado, ACTIVOS), gt(turnos.fin, ahora)));
  return generarHorariosLibres({ franjas, duracionMin: pro.duracionMin, ocupados, ahora, dias });
}

/**
 * Crea un turno. Si el profesional cobra seña, queda "pendiente" unos minutos
 * hasta que llegue el pago; si no, se confirma directamente.
 */
export async function reservarTurno({
  profesionalId,
  clienteId,
  inicio,
  nota = "",
  ahora = new Date(),
}: {
  profesionalId: number;
  clienteId: number;
  inicio: Date;
  nota?: string;
  ahora?: Date;
}) {
  const db = await obtenerDb();
  const pro = await buscarProfesional({ id: profesionalId });
  if (!pro) throw new ErrorReserva("El profesional no existe.");

  // El horario tiene que coincidir con uno de los turnos ofrecidos
  const libres = await horariosLibres(profesionalId, { ahora, dias: 60 });
  const elegido = libres.find((h) => h.inicio.getTime() === inicio.getTime());
  if (!elegido) throw new ErrorReserva("Ese horario ya no está disponible. Elegí otro.");

  const montoSena = calcularSena(pro.precio, pro.senaPorcentaje);
  try {
    const [turno] = await db
      .insert(turnos)
      .values({
        profesionalId,
        clienteId,
        inicio: elegido.inicio,
        fin: elegido.fin,
        montoSena,
        nota: nota.slice(0, 300),
        estado: montoSena > 0 ? "pendiente" : "confirmado",
        expiraEn: montoSena > 0 ? new Date(ahora.getTime() + MINUTOS_PARA_PAGAR * 60_000) : null,
      })
      .returning();
    return turno;
  } catch (error) {
    // Dos personas eligieron el mismo horario a la vez: la base rechaza la segunda
    if (esSuperposicion(error)) throw new ErrorReserva("Alguien acaba de reservar ese horario. Elegí otro.");
    throw error;
  }
}

/**
 * Registra el resultado de un pago. Es idempotente: si Mercado Pago avisa
 * dos veces del mismo pago, el turno se confirma una sola vez.
 */
export async function registrarPago({
  turnoId,
  pagoId,
  aprobado,
}: {
  turnoId: number;
  pagoId: string;
  aprobado: boolean;
}): Promise<"confirmado" | "repetido" | "rechazado" | "sin-turno"> {
  const db = await obtenerDb();
  return db.transaction(async (tx) => {
    const nuevo = await tx
      .insert(eventosPago)
      .values({ pagoId, turnoId, estado: aprobado ? "aprobado" : "rechazado" })
      .onConflictDoNothing()
      .returning();
    if (nuevo.length === 0) return "repetido";
    if (!aprobado) return "rechazado";

    const [turno] = await tx.select().from(turnos).where(eq(turnos.id, turnoId));
    if (!turno) return "sin-turno";
    if (turno.estado === "confirmado") return "repetido";

    if (turno.estado === "pendiente") {
      await tx.update(turnos).set({ estado: "confirmado", pagoId, expiraEn: null }).where(eq(turnos.id, turnoId));
      return "confirmado";
    }
    // Pagó después de que venció el plazo: se reactiva solo si el horario sigue libre
    // (en un savepoint, para que un rechazo no anule el registro del pago)
    try {
      await tx.transaction(async (sp) => {
        await sp.update(turnos).set({ estado: "confirmado", pagoId, expiraEn: null }).where(eq(turnos.id, turnoId));
      });
      return "confirmado";
    } catch (error) {
      if (esSuperposicion(error)) return "sin-turno"; // caso para devolver la seña a mano
      throw error;
    }
  });
}

export async function obtenerTurno(id: number) {
  const db = await obtenerDb();
  const [turno] = await db.select().from(turnos).where(eq(turnos.id, id));
  return turno ?? null;
}

/** Cancela un turno futuro. Puede hacerlo el cliente que lo reservó o el profesional. */
export async function cancelarTurno(turnoId: number, usuario: { id: number; profesionalId: number | null }) {
  const db = await obtenerDb();
  const turno = await obtenerTurno(turnoId);
  if (!turno) throw new ErrorReserva("El turno no existe.");
  const esDuenio = turno.clienteId === usuario.id || turno.profesionalId === usuario.profesionalId;
  if (!esDuenio) throw new ErrorReserva("No podés cancelar este turno.");
  if (!ACTIVOS.includes(turno.estado as (typeof ACTIVOS)[number])) throw new ErrorReserva("El turno ya no está activo.");
  if (turno.inicio <= new Date()) throw new ErrorReserva("No se puede cancelar un turno que ya pasó.");
  await db.update(turnos).set({ estado: "cancelado" }).where(eq(turnos.id, turnoId));
}

export async function turnosDelCliente(clienteId: number) {
  const db = await obtenerDb();
  await liberarVencidos(db);
  return db
    .select({
      id: turnos.id,
      inicio: turnos.inicio,
      fin: turnos.fin,
      estado: turnos.estado,
      montoSena: turnos.montoSena,
      profesional: usuarios.nombre,
      profesion: profesionales.profesion,
      slug: profesionales.slug,
      zona: profesionales.zona,
    })
    .from(turnos)
    .innerJoin(profesionales, eq(profesionales.id, turnos.profesionalId))
    .innerJoin(usuarios, eq(usuarios.id, profesionales.usuarioId))
    .where(eq(turnos.clienteId, clienteId))
    .orderBy(desc(turnos.inicio));
}

export async function agendaDelProfesional(profesionalId: number, desde = new Date()) {
  const db = await obtenerDb();
  await liberarVencidos(db, profesionalId);
  return db
    .select({
      id: turnos.id,
      inicio: turnos.inicio,
      fin: turnos.fin,
      estado: turnos.estado,
      montoSena: turnos.montoSena,
      nota: turnos.nota,
      cliente: usuarios.nombre,
      email: usuarios.email,
    })
    .from(turnos)
    .innerJoin(usuarios, eq(usuarios.id, turnos.clienteId))
    .where(and(eq(turnos.profesionalId, profesionalId), gt(turnos.fin, desde), inArray(turnos.estado, ACTIVOS)))
    .orderBy(asc(turnos.inicio));
}

export async function franjasDelProfesional(profesionalId: number) {
  const db = await obtenerDb();
  return db
    .select()
    .from(disponibilidad)
    .where(eq(disponibilidad.profesionalId, profesionalId))
    .orderBy(asc(disponibilidad.diaSemana), asc(disponibilidad.desdeMin));
}

export type { Intervalo };
