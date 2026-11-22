import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica la firma de una notificación de Mercado Pago.
 * MP envía el header x-signature con el formato "ts=<marca>,v1=<hmac>", y el
 * HMAC-SHA256 se calcula sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * con la clave secreta del webhook. Así nadie puede confirmar turnos falsificando avisos.
 */
export function verificarFirmaMercadoPago({
  firma,
  idSolicitud,
  idDato,
  secreto,
  ahora = Date.now(),
  toleranciaMs = 10 * 60_000,
}: {
  firma: string | null;
  idSolicitud: string | null;
  idDato: string | null;
  secreto: string;
  ahora?: number;
  toleranciaMs?: number;
}): boolean {
  if (!firma || !idDato) return false;
  const partes = Object.fromEntries(
    firma.split(",").map((p) => {
      const [clave, ...resto] = p.trim().split("=");
      return [clave, resto.join("=")];
    }),
  );
  const { ts, v1 } = partes as { ts?: string; v1?: string };
  if (!ts || !v1) return false;

  // Rechaza avisos viejos reenviados (ataque de repetición). ts puede venir en segundos o milisegundos.
  const marca = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);
  if (!Number.isFinite(marca) || Math.abs(ahora - marca) > toleranciaMs) return false;

  const id = /^[a-z0-9]+$/i.test(idDato) ? idDato.toLowerCase() : idDato;
  let manifiesto = `id:${id};`;
  if (idSolicitud) manifiesto += `request-id:${idSolicitud};`;
  manifiesto += `ts:${ts};`;

  const esperado = createHmac("sha256", secreto).update(manifiesto).digest("hex");
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
