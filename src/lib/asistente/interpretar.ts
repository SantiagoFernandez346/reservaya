import { diaSemana, fechaLocal, minutosLocales, sumarDias } from "../fechas";
import { franjaDelDia, type FranjaDelDia } from "../horarios";

/** Lo que el cliente pidió, en forma de filtro sobre los horarios libres */
export type Filtro = {
  fechaDesde: string;
  fechaHasta: string;
  franja: FranjaDelDia | "cualquiera";
  desdeMin?: number;
  hastaMin?: number;
};

const DIAS_TEXTO: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Intérprete sin IA, por reglas: entiende pedidos comunes como
 * "el jueves a la tarde", "mañana temprano" o "después de las 18".
 * Se usa cuando no hay ANTHROPIC_API_KEY o si la API falla.
 */
export function interpretarSinIA(mensaje: string, ahora: Date): Filtro {
  const t = normalizar(mensaje);
  const hoy = fechaLocal(ahora);
  let fechaDesde = hoy;
  let fechaHasta = sumarDias(hoy, 13);
  let franja: Filtro["franja"] = "cualquiera";
  let desdeMin: number | undefined;
  let hastaMin: number | undefined;

  // Franja: "a la mañana", "por la tarde", "a la noche", "temprano"
  if (/\b(a|por) la manana\b|\btemprano\b/.test(t)) franja = "mañana";
  else if (/\btarde\b/.test(t)) franja = "tarde";
  else if (/\bnoche\b/.test(t)) franja = "noche";

  // Día: "pasado mañana", "mañana" (como día), "hoy", nombres de días, fin de semana
  const semanaQueViene = /semana que viene|proxima semana/.test(t);
  if (/pasado manana/.test(t)) {
    fechaDesde = fechaHasta = sumarDias(hoy, 2);
  } else if (/\bmanana\b/.test(t.replace(/\b(a|por) la manana\b/g, ""))) {
    fechaDesde = fechaHasta = sumarDias(hoy, 1);
  } else if (/\bhoy\b/.test(t)) {
    fechaDesde = fechaHasta = hoy;
  } else if (/fin de semana|finde/.test(t)) {
    const hastaSabado = (6 - diaSemana(hoy) + 7) % 7;
    fechaDesde = sumarDias(hoy, hastaSabado + (semanaQueViene ? 7 : 0));
    fechaHasta = sumarDias(fechaDesde, 1);
  } else {
    const dia = Object.keys(DIAS_TEXTO).find((d) => new RegExp(`\\b${d}\\b`).test(t));
    if (dia) {
      let diferencia = (DIAS_TEXTO[dia] - diaSemana(hoy) + 7) % 7;
      if (semanaQueViene && diferencia < 7) diferencia += 7;
      fechaDesde = fechaHasta = sumarDias(hoy, diferencia);
    } else if (semanaQueViene) {
      fechaDesde = sumarDias(hoy, 7 - ((diaSemana(hoy) + 6) % 7)); // próximo lunes
      fechaHasta = sumarDias(fechaDesde, 6);
    } else if (/esta semana/.test(t)) {
      fechaHasta = sumarDias(hoy, 6 - ((diaSemana(hoy) + 6) % 7)); // hasta el domingo
    }
  }

  // Horas: "a las 17", "despues de las 18:30", "antes de las 12"
  const hora = (h: string, m?: string) => Number(h) * 60 + (m ? Number(m) : 0);
  const despues = t.match(/(?:despues|desde|a partir) de las (\d{1,2})(?::(\d{2}))?/);
  const antes = t.match(/(?:antes|hasta) de las (\d{1,2})(?::(\d{2}))?|hasta las (\d{1,2})(?::(\d{2}))?/);
  const exacta = t.match(/\ba las (\d{1,2})(?::(\d{2}))?/);
  if (despues) desdeMin = hora(despues[1], despues[2]);
  if (antes) hastaMin = hora(antes[1] ?? antes[3], antes[2] ?? antes[4]);
  if (exacta && !despues && !antes) {
    desdeMin = hora(exacta[1], exacta[2]);
    hastaMin = desdeMin + 60;
  }

  return { fechaDesde, fechaHasta, franja, desdeMin, hastaMin };
}

/** Aplica el filtro a los horarios libres */
export function filtrarHorarios(horarios: Date[], filtro: Filtro): Date[] {
  return horarios.filter((h) => {
    const fecha = fechaLocal(h);
    if (fecha < filtro.fechaDesde || fecha > filtro.fechaHasta) return false;
    if (filtro.franja !== "cualquiera" && franjaDelDia(h) !== filtro.franja) return false;
    const m = minutosLocales(h);
    if (filtro.desdeMin !== undefined && m < filtro.desdeMin) return false;
    if (filtro.hastaMin !== undefined && m >= filtro.hastaMin) return false;
    return true;
  });
}
