/**
 * Fechas en hora de Argentina (UTC−3, sin horario de verano).
 * Una "fecha local" es un texto "AAAA-MM-DD"; los instantes reales son Date en UTC.
 */
export const ZONA = "America/Argentina/Buenos_Aires";
const DESFASE_MIN = 3 * 60; // Argentina está 3 horas detrás de UTC
const MIN = 60_000;

export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

/** Fecha local "AAAA-MM-DD" de un instante */
export function fechaLocal(instante: Date): string {
  return new Date(instante.getTime() - DESFASE_MIN * MIN).toISOString().slice(0, 10);
}

/** Minutos desde la medianoche local */
export function minutosLocales(instante: Date): number {
  const local = new Date(instante.getTime() - DESFASE_MIN * MIN);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** 0 = domingo … 6 = sábado */
export function diaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Instante real de una fecha local + minutos desde la medianoche */
export function aInstante(fecha: string, minutos: number): Date {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + (minutos + DESFASE_MIN) * MIN);
}

export function formatearHora(instante: Date): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false }).format(instante);
}

/** "Lunes 23 de noviembre" (con la primera letra en mayúscula) */
export function formatearFecha(instante: Date, opciones: Intl.DateTimeFormatOptions = {}): string {
  const texto = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...opciones,
  })
    .format(instante)
    .replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatearPesos(monto: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(monto);
}

/** "14:30" → 870 */
export function textoAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 870 → "14:30" */
export function minutosATexto(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}
