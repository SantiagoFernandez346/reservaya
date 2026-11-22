"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { eq, like } from "drizzle-orm";
import { z } from "zod";
import { obtenerDb } from "@/db";
import { disponibilidad, profesionales, usuarios } from "@/db/schema";
import { cerrarSesion, crearSesion } from "@/lib/sesion";

export type EstadoFormulario = { error?: string; errores?: Record<string, string> } | undefined;

/** Solo permite volver a rutas internas (evita redirecciones a otros sitios) */
function rutaSegura(valor: FormDataEntryValue | null) {
  const ruta = typeof valor === "string" ? valor : "";
  return ruta.startsWith("/") && !ruta.startsWith("//") ? ruta : "/panel";
}

function erroresDe(error: z.ZodError) {
  const errores: Record<string, string> = {};
  for (const issue of error.issues) errores[String(issue.path[0])] ??= issue.message;
  return errores;
}

const esquemaIngreso = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
  clave: z.string().min(1, "Ingresá tu contraseña."),
});

export async function ingresar(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const r = esquemaIngreso.safeParse(Object.fromEntries(datos));
  if (!r.success) return { errores: erroresDe(r.error) };

  const db = await obtenerDb();
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, r.data.email));
  // Mismo mensaje si no existe el email o si la clave es incorrecta: no revela qué cuentas existen
  if (!usuario || !(await bcrypt.compare(r.data.clave, usuario.hash))) {
    return { error: "Email o contraseña incorrectos." };
  }
  await crearSesion({ usuarioId: usuario.id, rol: usuario.rol });
  redirect(rutaSegura(datos.get("volver")));
}

const esquemaRegistro = z.discriminatedUnion("rol", [
  z.object({
    rol: z.literal("cliente"),
    nombre: z.string().trim().min(2, "Ingresá tu nombre.").max(80),
    email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
    clave: z.string().min(8, "La contraseña necesita al menos 8 caracteres.").max(72),
  }),
  z.object({
    rol: z.literal("profesional"),
    nombre: z.string().trim().min(2, "Ingresá tu nombre.").max(80),
    email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
    clave: z.string().min(8, "La contraseña necesita al menos 8 caracteres.").max(72),
    profesion: z.string().trim().min(3, "Contanos a qué te dedicás.").max(60),
    zona: z.string().trim().max(60).default(""),
    precio: z.coerce.number({ message: "Ingresá un precio." }).int().min(1000, "El precio mínimo es $1.000.").max(10_000_000),
    duracionMin: z.coerce.number().int().min(15).max(240),
  }),
]);

/** "Laura Méndez" → "laura-mendez" */
function aSlug(texto: string) {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "profesional"
  );
}

export async function registrarse(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const r = esquemaRegistro.safeParse(Object.fromEntries(datos));
  if (!r.success) return { errores: erroresDe(r.error) };
  const d = r.data;

  const db = await obtenerDb();
  const [existe] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, d.email));
  if (existe) return { errores: { email: "Ya hay una cuenta con ese email." } };

  const hash = await bcrypt.hash(d.clave, 10);
  const usuarioId = await db.transaction(async (tx) => {
    const [usuario] = await tx.insert(usuarios).values({ nombre: d.nombre, email: d.email, hash, rol: d.rol }).returning();
    if (d.rol === "profesional") {
      const base = aSlug(d.nombre);
      const usados = await tx.select({ slug: profesionales.slug }).from(profesionales).where(like(profesionales.slug, `${base}%`));
      const slug = usados.length ? `${base}-${usados.length + 1}` : base;
      const [pro] = await tx
        .insert(profesionales)
        .values({ usuarioId: usuario.id, slug, profesion: d.profesion, zona: d.zona, precio: d.precio, duracionMin: d.duracionMin })
        .returning();
      // Horario inicial: lunes a viernes de 9 a 18 (se cambia desde la agenda)
      await tx
        .insert(disponibilidad)
        .values([1, 2, 3, 4, 5].map((dia) => ({ profesionalId: pro.id, diaSemana: dia, desdeMin: 9 * 60, hastaMin: 18 * 60 })));
    }
    return usuario.id;
  });

  await crearSesion({ usuarioId, rol: d.rol });
  redirect(rutaSegura(datos.get("volver")));
}

export async function salir() {
  await cerrarSesion();
  redirect("/");
}
