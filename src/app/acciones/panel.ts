"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { obtenerDb } from "@/db";
import { disponibilidad, profesionales } from "@/db/schema";
import { usuarioActual } from "@/lib/sesion";
import { buscarProfesional } from "@/lib/turnos";
import { textoAMinutos } from "@/lib/fechas";
import { resumirSemana, type Resumen } from "@/lib/asistente/resumen";

export type EstadoPanel = { ok?: string; error?: string } | undefined;

async function profesionalActual() {
  const usuario = await usuarioActual();
  if (!usuario?.profesionalId) throw new Error("Solo para profesionales.");
  return usuario.profesionalId;
}

const esquemaPerfil = z.object({
  profesion: z.string().trim().min(3).max(60),
  zona: z.string().trim().max(60),
  descripcion: z.string().trim().max(600),
  precio: z.coerce.number().int().min(1000).max(10_000_000),
  duracionMin: z.coerce.number().int().min(15).max(240),
  senaPorcentaje: z.coerce.number().int().min(0).max(100),
});

export async function guardarPerfil(_: EstadoPanel, datos: FormData): Promise<EstadoPanel> {
  const id = await profesionalActual();
  const r = esquemaPerfil.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Revisá los datos: " + r.error.issues.map((i) => String(i.path[0])).join(", ") };
  const db = await obtenerDb();
  await db.update(profesionales).set(r.data).where(eq(profesionales.id, id));
  revalidatePath("/panel");
  return { ok: "Perfil guardado." };
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Recibe hasta dos franjas por día: d{dia}_activo, d{dia}_desde1, d{dia}_hasta1, d{dia}_desde2, d{dia}_hasta2 */
export async function guardarHorarios(_: EstadoPanel, datos: FormData): Promise<EstadoPanel> {
  const id = await profesionalActual();
  const franjas: { diaSemana: number; desdeMin: number; hastaMin: number }[] = [];

  for (let dia = 0; dia < 7; dia++) {
    if (datos.get(`d${dia}_activo`) !== "on") continue;
    const delDia: { desdeMin: number; hastaMin: number }[] = [];
    for (const n of [1, 2]) {
      const desde = String(datos.get(`d${dia}_desde${n}`) ?? "");
      const hasta = String(datos.get(`d${dia}_hasta${n}`) ?? "");
      if (!desde && !hasta) continue;
      if (!HORA.test(desde) || !HORA.test(hasta)) return { error: "Usá horas con formato HH:MM." };
      const f = { desdeMin: textoAMinutos(desde), hastaMin: textoAMinutos(hasta) };
      if (f.hastaMin <= f.desdeMin) return { error: "La hora de fin tiene que ser posterior a la de inicio." };
      delDia.push(f);
    }
    delDia.sort((a, b) => a.desdeMin - b.desdeMin);
    if (delDia[1] && delDia[1].desdeMin < delDia[0].hastaMin) return { error: "Las dos franjas de un mismo día no pueden superponerse." };
    franjas.push(...delDia.map((f) => ({ ...f, diaSemana: dia })));
  }

  const db = await obtenerDb();
  await db.transaction(async (tx) => {
    await tx.delete(disponibilidad).where(eq(disponibilidad.profesionalId, id));
    if (franjas.length) await tx.insert(disponibilidad).values(franjas.map((f) => ({ ...f, profesionalId: id })));
  });
  revalidatePath("/panel");
  return { ok: "Horarios guardados. Los turnos ya reservados se mantienen." };
}

export async function pedirResumen(): Promise<Resumen> {
  const id = await profesionalActual();
  const pro = await buscarProfesional({ id });
  return resumirSemana(pro!);
}
