import "server-only";
import type { Turno } from "@/db/schema";
import { formatearFecha, formatearHora } from "@/lib/fechas";

/**
 * Dos formas de cobrar la seña, con la misma interfaz:
 * - Mercado Pago real (Checkout Pro) cuando existe MP_ACCESS_TOKEN.
 * - Un checkout simulado para la demo y los tests end-to-end.
 */
export const modoPagos = () => (process.env.MP_ACCESS_TOKEN ? "mercadopago" : "simulado");

type DatosPago = {
  turno: Turno;
  profesional: { nombre: string; profesion: string };
  emailCliente: string;
  urlBase: string;
};

export async function crearPagoDeSena({ turno, profesional, emailCliente, urlBase }: DatosPago): Promise<string> {
  if (modoPagos() === "simulado") return `/pago/simulado/${turno.id}`;

  const { MercadoPagoConfig, Preference } = await import("mercadopago");
  const cliente = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
  const esPublica = urlBase.startsWith("https://");

  const preferencia = await new Preference(cliente).create({
    body: {
      items: [
        {
          id: `turno-${turno.id}`,
          title: `Seña: ${profesional.profesion} con ${profesional.nombre}`,
          description: `${formatearFecha(turno.inicio)} a las ${formatearHora(turno.inicio)}`,
          quantity: 1,
          unit_price: turno.montoSena,
          currency_id: "ARS",
        },
      ],
      payer: { email: emailCliente },
      external_reference: String(turno.id),
      back_urls: {
        success: `${urlBase}/pago/resultado?turno=${turno.id}`,
        failure: `${urlBase}/pago/resultado?turno=${turno.id}`,
        pending: `${urlBase}/pago/resultado?turno=${turno.id}`,
      },
      // MP solo vuelve solo y avisa por webhook a direcciones públicas con https
      ...(esPublica && { auto_return: "approved", notification_url: `${urlBase}/api/webhooks/mercadopago` }),
      // El link de pago vence junto con la reserva del lugar
      expires: true,
      expiration_date_to: turno.expiraEn?.toISOString(),
      statement_descriptor: "RESERVAYA",
    },
  });

  const url = process.env.MP_ACCESS_TOKEN!.startsWith("TEST-") ? preferencia.sandbox_init_point : preferencia.init_point;
  if (!url) throw new Error("Mercado Pago no devolvió el link de pago.");
  return url;
}

/** Consulta un pago en Mercado Pago (nunca se confía en lo que dice el navegador) */
export async function consultarPago(pagoId: string): Promise<{ aprobado: boolean; turnoId: number | null }> {
  const { MercadoPagoConfig, Payment } = await import("mercadopago");
  const cliente = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
  const pago = await new Payment(cliente).get({ id: pagoId });
  const turnoId = Number(pago.external_reference);
  return { aprobado: pago.status === "approved", turnoId: Number.isInteger(turnoId) ? turnoId : null };
}
