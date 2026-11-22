import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buscarProfesional } from "@/lib/turnos";
import { responderAsistente } from "@/lib/asistente";

const esquema = z.object({
  profesionalId: z.number().int().positive(),
  mensaje: z.string().trim().min(2).max(300),
});

// Límite simple por IP para que la demo pública no gaste la clave de la API.
// (En memoria: alcanza para una demo; en producción real iría en Redis o similar.)
const pedidos = new Map<string, number[]>();
const LIMITE = 8;
const VENTANA_MS = 60_000;

function superaLimite(ip: string) {
  const ahora = Date.now();
  const recientes = (pedidos.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  recientes.push(ahora);
  pedidos.set(ip, recientes);
  return recientes.length > LIMITE;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (superaLimite(ip)) {
    return NextResponse.json({ error: "Muchas consultas seguidas. Esperá un minuto." }, { status: 429 });
  }

  const datos = esquema.safeParse(await request.json().catch(() => null));
  if (!datos.success) return NextResponse.json({ error: "Escribí qué turno buscás." }, { status: 400 });

  const profesional = await buscarProfesional({ id: datos.data.profesionalId });
  if (!profesional) return NextResponse.json({ error: "El profesional no existe." }, { status: 404 });

  const respuesta = await responderAsistente({ profesional, mensaje: datos.data.mensaje });
  return NextResponse.json(respuesta);
}
