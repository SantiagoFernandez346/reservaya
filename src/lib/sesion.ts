import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { obtenerDb } from "@/db";
import { usuarios, profesionales } from "@/db/schema";

const COOKIE = "reservaya_sesion";
const DURACION_DIAS = 7;

export type Sesion = { usuarioId: number; rol: "cliente" | "profesional" };

function clave() {
  const secreto = process.env.SESION_SECRETO;
  if (!secreto && process.env.NODE_ENV === "production" && !process.env.CI) {
    throw new Error("Falta la variable SESION_SECRETO para firmar las sesiones.");
  }
  return new TextEncoder().encode(secreto ?? "secreto-solo-para-desarrollo-local");
}

export async function crearSesion(sesion: Sesion) {
  const token = await new SignJWT({ rol: sesion.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(sesion.usuarioId))
    .setIssuedAt()
    .setExpirationTime(`${DURACION_DIAS}d`)
    .sign(clave());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true, // el JavaScript del navegador no puede leerla
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_DIAS * 24 * 60 * 60,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

export async function leerSesion(): Promise<Sesion | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    const rol = payload.rol === "profesional" ? "profesional" : "cliente";
    return { usuarioId: Number(payload.sub), rol };
  } catch {
    return null; // token vencido o adulterado
  }
}

/** Usuario con sesión iniciada (y su perfil profesional, si tiene) */
export async function usuarioActual() {
  const sesion = await leerSesion();
  if (!sesion) return null;
  const db = await obtenerDb();
  const [fila] = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      profesionalId: profesionales.id,
      slug: profesionales.slug,
    })
    .from(usuarios)
    .leftJoin(profesionales, eq(profesionales.usuarioId, usuarios.id))
    .where(eq(usuarios.id, sesion.usuarioId));
  return fila ?? null;
}

export type UsuarioActual = NonNullable<Awaited<ReturnType<typeof usuarioActual>>>;
