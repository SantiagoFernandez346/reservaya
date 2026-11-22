import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { buscarProfesional, obtenerTurno, registrarPago, MINUTOS_PARA_PAGAR } from "@/lib/turnos";
import { usuarioActual } from "@/lib/sesion";
import { consultarPago, modoPagos } from "@/lib/pagos";
import { formatearFecha, formatearHora, formatearPesos } from "@/lib/fechas";

async function Resultado({ searchParams }: { searchParams: PageProps<"/pago/resultado">["searchParams"] }) {
  await connection();
  const parametros = await searchParams;
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar");

  let turno = await obtenerTurno(Number(parametros.turno));
  if (!turno || turno.clienteId !== usuario.id) notFound();

  // Al volver de Mercado Pago llega el id del pago: se verifica contra la API de MP
  // (por si el webhook todavía no llegó, o si se prueba en local donde MP no puede avisar).
  const pagoId = typeof parametros.payment_id === "string" ? parametros.payment_id : null;
  if (modoPagos() === "mercadopago" && pagoId && turno.estado !== "confirmado") {
    const pago = await consultarPago(pagoId).catch(() => null);
    if (pago?.turnoId === turno.id) {
      await registrarPago({ turnoId: turno.id, pagoId, aprobado: pago.aprobado });
      turno = (await obtenerTurno(turno.id))!;
    }
  }

  const pro = await buscarProfesional({ id: turno.profesionalId });
  const rechazado = parametros.estado === "rechazado" || parametros.status === "rejected";

  const vistas = {
    confirmado: { sello: "● Confirmado", color: "bg-oliva-claro text-oliva", titulo: "¡Listo, tenés turno!", texto: "La seña quedó registrada y el turno ya figura en la agenda." },
    pendiente: rechazado
      ? { sello: "Pago rechazado", color: "bg-alerta/10 text-alerta", titulo: "El pago no se aprobó", texto: `Tu lugar sigue guardado ${MINUTOS_PARA_PAGAR} minutos desde que reservaste. Podés intentar de nuevo desde tus turnos.` }
      : { sello: "Esperando el pago", color: "bg-arena", titulo: "Estamos esperando la confirmación", texto: "Apenas Mercado Pago confirme la seña, el turno queda confirmado. Podés recargar esta página." },
    vencido: { sello: "Vencido", color: "bg-arena", titulo: "Se venció el tiempo para pagar", texto: "El horario se liberó. Podés elegir otro." },
    cancelado: { sello: "Cancelado", color: "bg-arena", titulo: "Este turno fue cancelado", texto: "Si querés, elegí otro horario." },
  } as const;
  const vista = vistas[turno.estado];

  return (
    <div className="tarjeta p-8 text-center">
      <span className={`sello ${vista.color}`}>{vista.sello}</span>
      <h1 className="titulo mt-5 text-4xl">{vista.titulo}</h1>
      <p className="mx-auto mt-3 max-w-sm text-suave">{vista.texto}</p>
      <div className="my-8 border-t-2 border-dotted border-linea" />
      <p className="titulo text-5xl">
        {formatearHora(turno.inicio)}
        <span className="text-terracota">h</span>
      </p>
      <p className="mt-1 text-lg">{formatearFecha(turno.inicio)}</p>
      <p className="mt-4 font-semibold">
        {pro?.nombre} · {pro?.profesion}
      </p>
      <p className="text-sm text-suave">
        {pro?.zona} · seña {formatearPesos(turno.montoSena)}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/panel" className="boton">
          Ver mis turnos
        </Link>
        {turno.estado !== "confirmado" && pro && (
          <Link href={`/p/${pro.slug}`} className="boton-linea">
            Elegir otro horario
          </Link>
        )}
      </div>
    </div>
  );
}

export default function PaginaResultado({ searchParams }: PageProps<"/pago/resultado">) {
  return (
    <div className="mx-auto max-w-lg px-5 py-14">
      <Suspense fallback={<div className="tarjeta h-96 animate-pulse" />}>
        <Resultado searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
