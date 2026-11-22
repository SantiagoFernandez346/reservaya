import { describe, expect, it } from "vitest";
import { filtrarHorarios, interpretarSinIA } from "./interpretar";
import { aInstante } from "../fechas";

// Domingo 22 de noviembre de 2026, 10:00 en Argentina
const AHORA = new Date("2026-11-22T13:00:00Z");

describe("interpretarSinIA", () => {
  it("entiende un día de la semana y una franja", () => {
    expect(interpretarSinIA("quiero un turno el jueves a la tarde", AHORA)).toMatchObject({
      fechaDesde: "2026-11-26",
      fechaHasta: "2026-11-26",
      franja: "tarde",
    });
  });

  it("distingue 'mañana' como día de 'a la mañana' como franja", () => {
    expect(interpretarSinIA("mañana a la tarde", AHORA)).toMatchObject({ fechaDesde: "2026-11-23", franja: "tarde" });
    expect(interpretarSinIA("el viernes a la mañana", AHORA)).toMatchObject({ fechaDesde: "2026-11-27", franja: "mañana" });
    expect(interpretarSinIA("pasado mañana", AHORA)).toMatchObject({ fechaDesde: "2026-11-24", fechaHasta: "2026-11-24" });
  });

  it("ignora acentos y mayúsculas", () => {
    expect(interpretarSinIA("MIÉRCOLES TEMPRANO", AHORA)).toMatchObject({ fechaDesde: "2026-11-25", franja: "mañana" });
  });

  it("entiende la semana que viene y el fin de semana", () => {
    expect(interpretarSinIA("la semana que viene", AHORA)).toMatchObject({ fechaDesde: "2026-11-23", fechaHasta: "2026-11-29" });
    expect(interpretarSinIA("el martes de la semana que viene", AHORA)).toMatchObject({ fechaDesde: "2026-12-01" });
    expect(interpretarSinIA("algo para el finde", AHORA)).toMatchObject({ fechaDesde: "2026-11-28", fechaHasta: "2026-11-29" });
  });

  it("entiende horas", () => {
    expect(interpretarSinIA("después de las 18", AHORA)).toMatchObject({ desdeMin: 18 * 60 });
    expect(interpretarSinIA("antes de las 12:30", AHORA)).toMatchObject({ hastaMin: 12 * 60 + 30 });
    expect(interpretarSinIA("el lunes a las 15", AHORA)).toMatchObject({ desdeMin: 15 * 60, hastaMin: 16 * 60 });
  });

  it("sin pistas busca en las próximas dos semanas", () => {
    expect(interpretarSinIA("cualquier horario", AHORA)).toMatchObject({ fechaDesde: "2026-11-22", fechaHasta: "2026-12-05", franja: "cualquiera" });
  });
});

describe("filtrarHorarios", () => {
  const horarios = [9, 14, 20].map((h) => aInstante("2026-11-26", h * 60));

  it("filtra por fecha y franja", () => {
    const filtro = interpretarSinIA("el jueves a la tarde", AHORA);
    expect(filtrarHorarios(horarios, filtro)).toEqual([horarios[1]]);
  });

  it("filtra por rango de horas", () => {
    const filtro = interpretarSinIA("el jueves después de las 13", AHORA);
    expect(filtrarHorarios(horarios, filtro)).toEqual([horarios[1], horarios[2]]);
  });
});
