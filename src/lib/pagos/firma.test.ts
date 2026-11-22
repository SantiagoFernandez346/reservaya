import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verificarFirmaMercadoPago } from "./firma";

const SECRETO = "clave-de-prueba";
const AHORA = 1_795_000_000_000;

function firmar(id: string, idSolicitud: string, ts: number, secreto = SECRETO) {
  const v1 = createHmac("sha256", secreto).update(`id:${id};request-id:${idSolicitud};ts:${ts};`).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("verificarFirmaMercadoPago", () => {
  const base = { idSolicitud: "req-123", idDato: "987654", secreto: SECRETO, ahora: AHORA };

  it("acepta una firma válida", () => {
    expect(verificarFirmaMercadoPago({ ...base, firma: firmar("987654", "req-123", AHORA) })).toBe(true);
  });

  it("acepta la marca de tiempo en segundos", () => {
    const enSegundos = Math.floor(AHORA / 1000);
    expect(verificarFirmaMercadoPago({ ...base, firma: firmar("987654", "req-123", enSegundos) })).toBe(true);
  });

  it("rechaza una firma hecha con otra clave", () => {
    expect(verificarFirmaMercadoPago({ ...base, firma: firmar("987654", "req-123", AHORA, "otra") })).toBe(false);
  });

  it("rechaza si cambiaron el id del pago", () => {
    expect(verificarFirmaMercadoPago({ ...base, idDato: "111", firma: firmar("987654", "req-123", AHORA) })).toBe(false);
  });

  it("rechaza avisos viejos reenviados", () => {
    const hace1h = AHORA - 60 * 60_000;
    expect(verificarFirmaMercadoPago({ ...base, firma: firmar("987654", "req-123", hace1h) })).toBe(false);
  });

  it("rechaza headers ausentes o mal formados", () => {
    expect(verificarFirmaMercadoPago({ ...base, firma: null })).toBe(false);
    expect(verificarFirmaMercadoPago({ ...base, firma: "basura" })).toBe(false);
    expect(verificarFirmaMercadoPago({ ...base, firma: `ts=${AHORA},v1=zz` })).toBe(false);
  });
});
