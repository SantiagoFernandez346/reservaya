import { aInstante, diaSemana, fechaLocal, minutosLocales, sumarDias } from "./fechas";

export type Franja = { diaSemana: number; desdeMin: number; hastaMin: number };
export type Intervalo = { inicio: Date; fin: Date };

/** Horas mínimas de anticipación para reservar */
export const ANTICIPACION_MIN = 2 * 60;

type Opciones = {
  franjas: Franja[];
  duracionMin: number;
  ocupados: Intervalo[];
  ahora: Date;
  dias?: number;
};

const seSuperponen = (a: Intervalo, b: Intervalo) => a.inicio < b.fin && b.inicio < a.fin;

/**
 * Genera los turnos libres de los próximos días: recorre cada franja de atención
 * en bloques de la duración del turno y descarta los ya ocupados o demasiado próximos.
 */
export function generarHorariosLibres({ franjas, duracionMin, ocupados, ahora, dias = 14 }: Opciones): Intervalo[] {
  const limite = new Date(ahora.getTime() + ANTICIPACION_MIN * 60_000);
  const hoy = fechaLocal(ahora);
  const libres: Intervalo[] = [];

  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(hoy, i);
    const delDia = franjas
      .filter((f) => f.diaSemana === diaSemana(fecha))
      .sort((a, b) => a.desdeMin - b.desdeMin);

    for (const franja of delDia) {
      for (let m = franja.desdeMin; m + duracionMin <= franja.hastaMin; m += duracionMin) {
        const turno = { inicio: aInstante(fecha, m), fin: aInstante(fecha, m + duracionMin) };
        if (turno.inicio < limite) continue;
        if (ocupados.some((o) => seSuperponen(o, turno))) continue;
        libres.push(turno);
      }
    }
  }
  return libres;
}

/** Agrupa horarios por fecha local, para mostrarlos como calendario */
export function agruparPorDia(horarios: Intervalo[]): Map<string, Intervalo[]> {
  const dias = new Map<string, Intervalo[]>();
  for (const h of horarios) {
    const clave = fechaLocal(h.inicio);
    dias.set(clave, [...(dias.get(clave) ?? []), h]);
  }
  return dias;
}

export type FranjaDelDia = "mañana" | "tarde" | "noche";

/** mañana: antes de las 13; tarde: 13 a 19; noche: desde las 19 */
export function franjaDelDia(instante: Date): FranjaDelDia {
  const m = minutosLocales(instante);
  if (m < 13 * 60) return "mañana";
  if (m < 19 * 60) return "tarde";
  return "noche";
}

/** Seña redondeada a pesos enteros */
export function calcularSena(precio: number, porcentaje: number): number {
  return Math.round((precio * porcentaje) / 100);
}
