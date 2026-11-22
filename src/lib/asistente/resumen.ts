import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DIAS, diaSemana, fechaLocal, formatearPesos } from "../fechas";
import { agendaDelProfesional, horariosLibres } from "../turnos";

export type Resumen = { texto: string; modo: "ia" | "basico"; datos: DatosSemana };

type DatosSemana = {
  turnos: number;
  confirmados: number;
  pendientes: number;
  senasCobradas: number;
  horariosLibres: number;
  diaMasCargado: string | null;
  diaMasLibre: string | null;
};

/** Junta los números de los próximos 7 días */
export async function datosDeLaSemana(profesionalId: number, ahora = new Date()): Promise<DatosSemana> {
  const hasta = new Date(ahora.getTime() + 7 * 24 * 3_600_000);
  const agenda = (await agendaDelProfesional(profesionalId, ahora)).filter((t) => t.inicio < hasta);
  const libres = await horariosLibres(profesionalId, { ahora, dias: 7 });

  const contar = (fechas: Date[]) => {
    const mapa = new Map<string, number>();
    for (const f of fechas) {
      const dia = DIAS[diaSemana(fechaLocal(f))];
      mapa.set(dia, (mapa.get(dia) ?? 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  };
  const ocupacion = contar(agenda.map((t) => t.inicio));
  const libresPorDia = contar(libres.map((h) => h.inicio));

  return {
    turnos: agenda.length,
    confirmados: agenda.filter((t) => t.estado === "confirmado").length,
    pendientes: agenda.filter((t) => t.estado === "pendiente").length,
    senasCobradas: agenda.filter((t) => t.estado === "confirmado").reduce((s, t) => s + t.montoSena, 0),
    horariosLibres: libres.length,
    diaMasCargado: ocupacion[0]?.[0] ?? null,
    diaMasLibre: libresPorDia[0]?.[0] ?? null,
  };
}

function textoBasico(d: DatosSemana) {
  if (d.turnos === 0) {
    return `Todavía no tenés turnos para los próximos 7 días y quedan ${d.horariosLibres} horarios libres. Compartí el link de tu página para empezar a recibir reservas.`;
  }
  return [
    `Tenés ${d.turnos} ${d.turnos === 1 ? "turno" : "turnos"} en los próximos 7 días (${d.confirmados} ${d.confirmados === 1 ? "confirmado" : "confirmados"}${d.pendientes ? `, ${d.pendientes} esperando la seña` : ""}).`,
    `Ya cobraste ${formatearPesos(d.senasCobradas)} en señas.`,
    d.diaMasCargado ? `El día más cargado es el ${d.diaMasCargado}.` : "",
    d.diaMasLibre ? `El ${d.diaMasLibre} es el que tiene más lugar (${d.horariosLibres} horarios libres en total).` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Resumen de la semana para el profesional, redactado por Claude (o por plantilla sin clave) */
export async function resumirSemana(profesional: { id: number; nombre: string; profesion: string }): Promise<Resumen> {
  const datos = await datosDeLaSemana(profesional.id);
  if (!process.env.ANTHROPIC_API_KEY) return { texto: textoBasico(datos), modo: "basico", datos };

  try {
    const cliente = new Anthropic({ timeout: 30_000, maxRetries: 1 });
    const respuesta = await cliente.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        `Escribís el resumen semanal de agenda de ${profesional.nombre} (${profesional.profesion}) en una app argentina de turnos. ` +
        "En 3 o 4 oraciones, en español rioplatense y de vos: cómo viene la semana, plata cobrada en señas y una sugerencia concreta " +
        "para llenar los huecos. Usá solo los números que te pasan, sin inventar datos. Texto plano, sin listas ni títulos.",
      messages: [{ role: "user", content: `Datos de los próximos 7 días:\n${JSON.stringify(datos, null, 2)}` }],
    });
    if (respuesta.stop_reason === "refusal") throw new Error("El modelo declinó el pedido");
    const texto = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    if (texto) return { texto, modo: "ia", datos };
  } catch (error) {
    console.error("El resumen con IA falló; uso la plantilla.", error);
  }
  return { texto: textoBasico(datos), modo: "basico", datos };
}
