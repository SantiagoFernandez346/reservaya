import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DIAS, diaSemana, fechaLocal, formatearFecha, formatearHora, textoAMinutos } from "../fechas";
import { horariosLibres } from "../turnos";
import { filtrarHorarios, interpretarSinIA, type Filtro } from "./interpretar";

export type RespuestaAsistente = { respuesta: string; horarios: string[]; modo: "ia" | "basico" };

const MAX_PROPUESTAS = 6;
const MODELO = "claude-opus-5-5";

const HERRAMIENTA: Anthropic.Beta.BetaTool = {
  name: "buscar_horarios_libres",
  description:
    "Busca los turnos realmente libres del profesional en un rango de fechas (hora de Argentina). " +
    "Usala siempre antes de proponer horarios: nunca inventes un horario que no haya devuelto esta herramienta.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      fecha_desde: { type: "string", description: "Primera fecha a buscar, formato AAAA-MM-DD" },
      fecha_hasta: { type: "string", description: "Última fecha a buscar (inclusive), formato AAAA-MM-DD" },
      franja: {
        type: "string",
        enum: ["mañana", "tarde", "noche", "cualquiera"],
        description: "mañana: antes de las 13; tarde: 13 a 19; noche: desde las 19",
      },
      hora_desde: { type: ["string", "null"], description: "Hora mínima HH:MM, o null" },
      hora_hasta: { type: ["string", "null"], description: "Hora máxima HH:MM (exclusiva), o null" },
    },
    required: ["fecha_desde", "fecha_hasta", "franja", "hora_desde", "hora_hasta"],
    additionalProperties: false,
  },
};

type EntradaHerramienta = {
  fecha_desde: string;
  fecha_hasta: string;
  franja: Filtro["franja"];
  hora_desde: string | null;
  hora_hasta: string | null;
};

const etiqueta = (h: Date) => `${formatearFecha(h)} ${formatearHora(h)}`;

/**
 * Asistente de reservas: entiende pedidos en lenguaje natural y propone horarios libres.
 * Con ANTHROPIC_API_KEY usa Claude con una herramienta que consulta la agenda real;
 * los botones que ve el cliente salen siempre de esa herramienta, nunca del texto del modelo.
 */
export async function responderAsistente({
  profesional,
  mensaje,
  ahora = new Date(),
}: {
  profesional: { id: number; nombre: string; profesion: string };
  mensaje: string;
  ahora?: Date;
}): Promise<RespuestaAsistente> {
  const libres = (await horariosLibres(profesional.id, { ahora })).map((h) => h.inicio);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await conClaude({ profesional, mensaje, ahora, libres });
    } catch (error) {
      console.error("El asistente con IA falló; uso el intérprete básico.", error);
    }
  }
  return basico(mensaje, ahora, libres);
}

function basico(mensaje: string, ahora: Date, libres: Date[]): RespuestaAsistente {
  const encontrados = filtrarHorarios(libres, interpretarSinIA(mensaje, ahora)).slice(0, MAX_PROPUESTAS);
  if (encontrados.length === 0) {
    const proximos = libres.slice(0, 3);
    return {
      modo: "basico",
      respuesta: proximos.length
        ? "No encontré turnos libres con esas condiciones. Estos son los más próximos:"
        : "No hay turnos libres en las próximas dos semanas.",
      horarios: proximos.map((h) => h.toISOString()),
    };
  }
  return { modo: "basico", respuesta: "Encontré estos turnos libres:", horarios: encontrados.map((h) => h.toISOString()) };
}

async function conClaude({
  profesional,
  mensaje,
  ahora,
  libres,
}: {
  profesional: { nombre: string; profesion: string };
  mensaje: string;
  ahora: Date;
  libres: Date[];
}): Promise<RespuestaAsistente> {
  const cliente = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  const hoy = fechaLocal(ahora);
  const sistema = [
    `Sos el asistente de reservas de ${profesional.nombre} (${profesional.profesion}) en ReservaYa, una app argentina de turnos.`,
    `Hoy es ${DIAS[diaSemana(hoy)]} ${hoy} y son las ${formatearHora(ahora)} (hora de Argentina). Solo hay agenda para los próximos 14 días.`,
    "Interpretá lo que pide el cliente, buscá con la herramienta y respondé en una o dos oraciones, en español rioplatense y de vos.",
    "No enumeres los horarios en el texto: la app los muestra como botones debajo de tu respuesta. Si no hay lugar, decilo y sugerí otra opción.",
    "Si el mensaje no tiene que ver con reservar un turno, explicá amablemente que solo podés ayudar con eso.",
  ].join("\n");

  const mensajes: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: mensaje }];
  let propuestos: Date[] = [];

  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const respuesta = await cliente.beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      output_config: { effort: "low" }, // pedido corto y simple: respuesta rápida
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // si el modelo declina por política, reintenta con otro automáticamente
      system: sistema,
      tools: [HERRAMIENTA],
      messages: mensajes,
    });

    if (respuesta.stop_reason === "refusal") break;

    if (respuesta.stop_reason !== "tool_use") {
      const texto = respuesta.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();
      return { modo: "ia", respuesta: texto || "Estos son los turnos que encontré:", horarios: propuestos.map((h) => h.toISOString()) };
    }

    mensajes.push({ role: "assistant", content: respuesta.content });
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const bloque of respuesta.content) {
      if (bloque.type !== "tool_use") continue;
      const entrada = bloque.input as EntradaHerramienta;
      const encontrados = filtrarHorarios(libres, {
        fechaDesde: entrada.fecha_desde,
        fechaHasta: entrada.fecha_hasta,
        franja: entrada.franja,
        desdeMin: entrada.hora_desde ? textoAMinutos(entrada.hora_desde) : undefined,
        hastaMin: entrada.hora_hasta ? textoAMinutos(entrada.hora_hasta) : undefined,
      });
      propuestos = encontrados.slice(0, MAX_PROPUESTAS);
      resultados.push({
        type: "tool_result",
        tool_use_id: bloque.id,
        content: encontrados.length
          ? `${encontrados.length} turnos libres. Primeros: ${encontrados.slice(0, MAX_PROPUESTAS).map(etiqueta).join("; ")}`
          : "No hay turnos libres con esas condiciones.",
      });
    }
    mensajes.push({ role: "user", content: resultados });
  }

  return basico(mensaje, ahora, libres);
}
