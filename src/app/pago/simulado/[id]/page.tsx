import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { obtenerTurno, buscarProfesional } from "@/lib/turnos";
import { usuarioActual } from "@/lib/sesion";
import { modoPagos } from "@/lib/pagos";
import { pagarSimulado } from "@/app/acciones/turnos";
import { formatearFecha, formatearHora, formatearPesos } from "@/lib/fechas";

async function Checkout({ params }: { params: PageProps<"/pago/simulado/[id]">["params"] }) {
  await connection();
  if (modoPagos() !== "simulado") notFound();
  const { id } = await params;
  const [turno, usuario] = await Promise.all([obtenerTurno(Number(id)), usuarioActual()]);
  if (!usuario) redirect("/ingresar");
  if (!turno || turno.clienteId !== usuario.id) notFound();
  if (turno.estado !== "pendiente") redirect(`/pago/resultado?turno=${turno.id}`);
  const pro = await buscarProfesional({ id: turno.profesionalId });

  return (
    <div className="tarjeta overflow-hidden">
      <div className="bg-[#009ee3] px-6 py-4 text-white">
        <p className="text-sm font-semibold uppercase tracking-wider opacity-90">Checkout de prueba</p>
        <p className="text-lg">Simula el pago con Mercado Pago</p>
      </div>
      <div className="space-y-5 p-6">
        <div>
          <p className="text-sm text-suave">Seña del turno</p>
          <p className="titulo text-5xl">{formatearPesos(turno.montoSena)}</p>
        </div>
        <div className="rounded-2xl bg-arena p-4 text-sm">
          <p className="font-semibold">
            {pro?.profesion} con {pro?.nombre}
          </p>
          <p className="text-suave">
            {formatearFecha(turno.inicio)} · {formatearHora(turno.inicio)} h
          </p>
        </div>
        <p className="text-sm text-suave">
          En esta demo no se cobra nada. Con las credenciales de Mercado Pago configuradas, este paso abre el checkout
          real de Mercado Pago.
        </p>
        <form action={pagarSimulado} className="flex flex-wrap gap-3">
          <input type="hidden" name="turnoId" value={turno.id} />
          <button name="resultado" value="aprobado" className="boton">
            Pagar {formatearPesos(turno.montoSena)}
          </button>
          <button name="resultado" value="rechazado" className="boton-linea">
            Simular pago rechazado
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PaginaPagoSimulado({ params }: PageProps<"/pago/simulado/[id]">) {
  return (
    <div className="mx-auto max-w-lg px-5 py-14">
      <Suspense fallback={<div className="tarjeta h-96 animate-pulse" />}>
        <Checkout params={params} />
      </Suspense>
    </div>
  );
}
