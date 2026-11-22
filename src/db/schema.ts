import {
  pgTable,
  integer,
  text,
  timestamp,
  smallint,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Tablas tipadas para las consultas con Drizzle.
 * El DDL real (con el exclusion constraint que evita turnos superpuestos)
 * vive en src/db/migraciones.ts, porque Drizzle no puede expresarlo.
 */

export const usuarios = pgTable("usuarios", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull().unique(),
  hash: text("hash").notNull(),
  rol: text("rol", { enum: ["cliente", "profesional"] }).notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const profesionales = pgTable("profesionales", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  usuarioId: integer("usuario_id")
    .notNull()
    .unique()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  profesion: text("profesion").notNull(),
  descripcion: text("descripcion").notNull().default(""),
  zona: text("zona").notNull().default(""),
  duracionMin: smallint("duracion_min").notNull().default(60),
  precio: numeric("precio", { precision: 12, scale: 2, mode: "number" }).notNull(),
  senaPorcentaje: smallint("sena_porcentaje").notNull().default(30),
});

/** Franjas semanales en que atiende: día 0 = domingo, minutos desde las 00:00 (hora de Argentina) */
export const disponibilidad = pgTable(
  "disponibilidad",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    profesionalId: integer("profesional_id")
      .notNull()
      .references(() => profesionales.id, { onDelete: "cascade" }),
    diaSemana: smallint("dia_semana").notNull(),
    desdeMin: smallint("desde_min").notNull(),
    hastaMin: smallint("hasta_min").notNull(),
  },
  (t) => [uniqueIndex("disponibilidad_unica").on(t.profesionalId, t.diaSemana, t.desdeMin)],
);

export const ESTADOS_TURNO = ["pendiente", "confirmado", "cancelado", "vencido"] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

export const turnos = pgTable("turnos", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  profesionalId: integer("profesional_id")
    .notNull()
    .references(() => profesionales.id, { onDelete: "cascade" }),
  clienteId: integer("cliente_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  inicio: timestamp("inicio", { withTimezone: true }).notNull(),
  fin: timestamp("fin", { withTimezone: true }).notNull(),
  estado: text("estado", { enum: ESTADOS_TURNO }).notNull().default("pendiente"),
  montoSena: numeric("monto_sena", { precision: 12, scale: 2, mode: "number" }).notNull(),
  nota: text("nota").notNull().default(""),
  /** Hasta cuándo se guarda el lugar mientras se paga la seña */
  expiraEn: timestamp("expira_en", { withTimezone: true }),
  pagoId: text("pago_id"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

/** Notificaciones de pago ya procesadas: evita confirmar dos veces el mismo pago */
export const eventosPago = pgTable("eventos_pago", {
  pagoId: text("pago_id").primaryKey(),
  turnoId: integer("turno_id").references(() => turnos.id, { onDelete: "set null" }),
  estado: text("estado").notNull(),
  recibidoEn: timestamp("recibido_en", { withTimezone: true }).notNull().defaultNow(),
});

export type Usuario = typeof usuarios.$inferSelect;
export type Profesional = typeof profesionales.$inferSelect;
export type Disponibilidad = typeof disponibilidad.$inferSelect;
export type Turno = typeof turnos.$inferSelect;
