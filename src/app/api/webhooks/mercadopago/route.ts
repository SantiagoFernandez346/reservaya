import { NextResponse, type NextRequest } from "next/server";
import { verificarFirmaMercadoPago } from "@/lib/pagos/firma";
import { consultarPago } from "@/lib/pagos";
import { registrarPago } from "@/lib/turnos";

/**
 * Mercado Pago avisa acá cada vez que cambia un pago.
 * 1. Verifica la firma (que el aviso venga de verdad de MP).
 * 2. Consulta el pago en la API de MP (el aviso solo trae el id).
 * 3. Confirma el turno de forma idempotente.
 */
export async function POST(request: NextRequest) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!process.env.MP_ACCESS_TOKEN || !secreto) {
    return NextResponse.json({ error: "Mercado Pago no está configurado" }, { status: 503 });
  }

  const url = request.nextUrl;
  const cuerpo = (await request.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const tipo = url.searchParams.get("type") ?? cuerpo.type;
  const idDato = url.searchParams.get("data.id") ?? (cuerpo.data?.id != null ? String(cuerpo.data.id) : null);

  const valida = verificarFirmaMercadoPago({
    firma: request.headers.get("x-signature"),
    idSolicitud: request.headers.get("x-request-id"),
    idDato,
    secreto,
  });
  if (!valida) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });

  // Otros tipos de aviso (reembolsos, contracargos…) se aceptan pero no se procesan
  if (tipo !== "payment" || !idDato) return NextResponse.json({ ok: true });

  const pago = await consultarPago(idDato);
  if (!pago.turnoId) return NextResponse.json({ ok: true });

  const resultado = await registrarPago({ turnoId: pago.turnoId, pagoId: idDato, aprobado: pago.aprobado });
  if (resultado === "sin-turno") console.warn(`Pago ${idDato} aprobado pero el turno ${pago.turnoId} ya no está disponible: devolver la seña.`);
  return NextResponse.json({ ok: true, resultado });
}
