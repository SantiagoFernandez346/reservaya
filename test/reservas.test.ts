/**
 * Tests de integración contra un Postgres real (PGlite en memoria):
 * prueban las reglas que garantiza la base, no un mock.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { obtenerDb, esSuperposicion } from "@/db";
import { turnos, usuarios } from "@/db/schema";
import {
  buscarProfesional,
  cancelarTurno,
  ErrorReserva,
  horariosLibres,
  listarProfesionales,
  registrarPago,
  reservarTurno,
} from "@/lib/turnos";

let clienteId: number;
let laura: NonNullable<Awaited<ReturnType<typeof buscarProfesional>>>;

beforeAll(async () => {
  const db = await obtenerDb();
  const [cliente] = await db.select().from(usuarios).where(eq(usuarios.email, "cliente@demo.reservaya.app"));
  clienteId = cliente.id;
  laura = (await buscarProfesional({ slug: "laura-mendez" }))!;
});

describe("datos demo", () => {
  it("carga tres profesionales con horarios", async () => {
    const pros = await listarProfesionales();
    expect(pros.map((p) => p.slug)).toEqual(["laura-mendez", "tomas-rivero", "carla-ibanez"]);
    expect((await horariosLibres(laura.id)).length).toBeGreaterThan(20);
  });
});

describe("reservas", () => {
  it("reserva un horario libre con seña pendiente y lo saca de la lista", async () => {
    const [primero] = await horariosLibres(laura.id);
    const turno = await reservarTurno({ profesionalId: laura.id, clienteId, inicio: primero.inicio });
    expect(turno.estado).toBe("pendiente");
    expect(turno.montoSena).toBe(9000); // 30% de $30.000
    const despues = await horariosLibres(laura.id);
    expect(despues.some((h) => h.inicio.getTime() === primero.inicio.getTime())).toBe(false);
  });

  it("rechaza un horario que no está en la agenda", async () => {
    const domingo3am = new Date("2026-12-06T06:00:00Z");
    await expect(reservarTurno({ profesionalId: laura.id, clienteId, inicio: domingo3am })).rejects.toBeInstanceOf(ErrorReserva);
  });

  it("la base impide dos turnos superpuestos aunque se salteen las validaciones", async () => {
    const db = await obtenerDb();
    const [h] = await horariosLibres(laura.id);
    const fila = { profesionalId: laura.id, clienteId, inicio: h.inicio, fin: h.fin, montoSena: 0, estado: "confirmado" as const };
    await db.insert(turnos).values(fila);
    const corrido = { ...fila, inicio: new Date(h.inicio.getTime() + 20 * 60_000), fin: new Date(h.fin.getTime() + 20 * 60_000) };
    const error = await db.insert(turnos).values(corrido).catch((e) => e);
    expect(esSuperposicion(error)).toBe(true);
  });

  it("dos reservas simultáneas del mismo horario: entra una sola", async () => {
    const [h] = await horariosLibres(laura.id);
    const intentos = await Promise.allSettled([
      reservarTurno({ profesionalId: laura.id, clienteId, inicio: h.inicio }),
      reservarTurno({ profesionalId: laura.id, clienteId, inicio: h.inicio }),
    ]);
    expect(intentos.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("un turno con la seña vencida libera el horario", async () => {
    const db = await obtenerDb();
    const [h] = await horariosLibres(laura.id);
    const turno = await reservarTurno({ profesionalId: laura.id, clienteId, inicio: h.inicio });
    await db.update(turnos).set({ expiraEn: new Date(Date.now() - 1000) }).where(eq(turnos.id, turno.id));
    const libres = await horariosLibres(laura.id);
    expect(libres[0].inicio.getTime()).toBe(h.inicio.getTime());
  });
});

describe("pagos", () => {
  it("confirma el turno una sola vez aunque el aviso de pago llegue repetido", async () => {
    const [h] = await horariosLibres(laura.id);
    const turno = await reservarTurno({ profesionalId: laura.id, clienteId, inicio: h.inicio });
    expect(await registrarPago({ turnoId: turno.id, pagoId: "pago-1", aprobado: true })).toBe("confirmado");
    expect(await registrarPago({ turnoId: turno.id, pagoId: "pago-1", aprobado: true })).toBe("repetido");
    const db = await obtenerDb();
    const [actual] = await db.select().from(turnos).where(eq(turnos.id, turno.id));
    expect(actual.estado).toBe("confirmado");
    expect(actual.pagoId).toBe("pago-1");
  });

  it("un pago rechazado deja el turno pendiente", async () => {
    const [h] = await horariosLibres(laura.id);
    const turno = await reservarTurno({ profesionalId: laura.id, clienteId, inicio: h.inicio });
    expect(await registrarPago({ turnoId: turno.id, pagoId: "pago-rechazado", aprobado: false })).toBe("rechazado");
  });

  it("si pagó tarde y otro tomó el horario, no se pisan los turnos", async () => {
    const db = await obtenerDb();
    const [h] = await horariosLibres(laura.id);
    const tardio = await reservarTurno({ profesionalId: laura.id, clienteId, inicio: h.inicio });
    await db.update(turnos).set({ expiraEn: new Date(Date.now() - 1000) }).where(eq(turnos.id, tardio.id));
    await reservarTurno({ profesionalId: laura.id, clienteId, inicio: h.inicio }); // otro lo reserva
    expect(await registrarPago({ turnoId: tardio.id, pagoId: "pago-tardio", aprobado: true })).toBe("sin-turno");
  });
});

describe("cancelaciones", () => {
  it("el cliente cancela su turno y el horario vuelve a estar libre", async () => {
    const [h] = await horariosLibres(laura.id);
    const turno = await reservarTurno({ profesionalId: laura.id, clienteId, inicio: h.inicio });
    await cancelarTurno(turno.id, { id: clienteId, profesionalId: null });
    expect((await horariosLibres(laura.id))[0].inicio.getTime()).toBe(h.inicio.getTime());
  });

  it("otra persona no puede cancelar un turno ajeno", async () => {
    const [h] = await horariosLibres(laura.id);
    const turno = await reservarTurno({ profesionalId: laura.id, clienteId, inicio: h.inicio });
    await expect(cancelarTurno(turno.id, { id: 9999, profesionalId: null })).rejects.toThrow("No podés cancelar");
  });
});
