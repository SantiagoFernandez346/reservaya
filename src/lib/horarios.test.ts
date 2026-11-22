import { describe, expect, it } from "vitest";
import { agruparPorDia, calcularSena, franjaDelDia, generarHorariosLibres } from "./horarios";
import { aInstante, diaSemana, fechaLocal, formatearHora, minutosLocales, sumarDias } from "./fechas";

// Lunes 23 de noviembre de 2026, 8:00 en Argentina (11:00 UTC)
const LUNES_8AM = new Date("2026-11-23T11:00:00Z");

describe("fechas en hora de Argentina", () => {
  it("convierte entre fecha local e instante UTC", () => {
    const instante = aInstante("2026-11-23", 14 * 60 + 30);
    expect(instante.toISOString()).toBe("2026-11-23T17:30:00.000Z");
    expect(fechaLocal(instante)).toBe("2026-11-23");
    expect(minutosLocales(instante)).toBe(870);
    expect(formatearHora(instante)).toBe("14:30");
  });

  it("a las 22:00 de Argentina ya es el día siguiente en UTC, pero la fecha local no cambia", () => {
    const noche = aInstante("2026-11-23", 22 * 60);
    expect(noche.toISOString().slice(0, 10)).toBe("2026-11-24");
    expect(fechaLocal(noche)).toBe("2026-11-23");
  });

  it("calcula días de la semana y suma días cruzando meses", () => {
    expect(diaSemana("2026-11-23")).toBe(1);
    expect(sumarDias("2026-11-30", 2)).toBe("2026-12-02");
  });
});

describe("generarHorariosLibres", () => {
  const franjas = [{ diaSemana: 1, desdeMin: 9 * 60, hastaMin: 12 * 60 }]; // lunes de 9 a 12

  it("divide la franja en turnos de la duración indicada", () => {
    const libres = generarHorariosLibres({ franjas, duracionMin: 60, ocupados: [], ahora: LUNES_8AM, dias: 1 });
    // 9:00 queda afuera por la anticipación mínima de 2 horas (ahora son las 8)
    expect(libres.map((h) => formatearHora(h.inicio))).toEqual(["10:00", "11:00"]);
  });

  it("no ofrece un turno que no entra completo en la franja", () => {
    const libres = generarHorariosLibres({ franjas, duracionMin: 50, ocupados: [], ahora: new Date("2026-11-22T12:00:00Z"), dias: 2 });
    expect(libres.map((h) => formatearHora(h.inicio))).toEqual(["09:00", "09:50", "10:40"]);
  });

  it("descarta los horarios que se superponen con turnos ocupados", () => {
    const ocupados = [{ inicio: aInstante("2026-11-23", 10 * 60 + 30), fin: aInstante("2026-11-23", 11 * 60 + 30) }];
    const libres = generarHorariosLibres({ franjas, duracionMin: 60, ocupados, ahora: new Date("2026-11-22T12:00:00Z"), dias: 2 });
    expect(libres.map((h) => formatearHora(h.inicio))).toEqual(["09:00"]);
  });

  it("repite la franja cada semana y agrupa por día", () => {
    const libres = generarHorariosLibres({ franjas, duracionMin: 60, ocupados: [], ahora: new Date("2026-11-22T12:00:00Z"), dias: 14 });
    const dias = agruparPorDia(libres);
    expect([...dias.keys()]).toEqual(["2026-11-23", "2026-11-30"]);
    expect(dias.get("2026-11-30")).toHaveLength(3);
  });
});

describe("utilidades", () => {
  it("clasifica la franja del día", () => {
    expect(franjaDelDia(aInstante("2026-11-23", 9 * 60))).toBe("mañana");
    expect(franjaDelDia(aInstante("2026-11-23", 15 * 60))).toBe("tarde");
    expect(franjaDelDia(aInstante("2026-11-23", 20 * 60))).toBe("noche");
  });

  it("calcula la seña redondeada", () => {
    expect(calcularSena(30000, 30)).toBe(9000);
    expect(calcularSena(12345, 33)).toBe(4074);
    expect(calcularSena(5000, 0)).toBe(0);
  });
});
