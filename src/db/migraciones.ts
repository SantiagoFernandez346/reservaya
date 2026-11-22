/**
 * Migraciones en SQL plano, en orden. Cada una se aplica una sola vez
 * y queda anotada en la tabla esquema_version.
 */
export const MIGRACIONES: { id: number; nombre: string; sql: string }[] = [
  {
    id: 1,
    nombre: "inicial",
    sql: /* sql */ `
      CREATE TABLE usuarios (
        id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        nombre    text NOT NULL CHECK (length(nombre) BETWEEN 2 AND 80),
        email     text NOT NULL UNIQUE,
        hash      text NOT NULL,
        rol       text NOT NULL CHECK (rol IN ('cliente', 'profesional')),
        creado_en timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE profesionales (
        id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        usuario_id      integer NOT NULL UNIQUE REFERENCES usuarios (id) ON DELETE CASCADE,
        slug            text NOT NULL UNIQUE,
        profesion       text NOT NULL,
        descripcion     text NOT NULL DEFAULT '',
        zona            text NOT NULL DEFAULT '',
        duracion_min    smallint NOT NULL DEFAULT 60 CHECK (duracion_min BETWEEN 15 AND 240),
        precio          numeric(12, 2) NOT NULL CHECK (precio > 0),
        sena_porcentaje smallint NOT NULL DEFAULT 30 CHECK (sena_porcentaje BETWEEN 0 AND 100)
      );

      CREATE TABLE disponibilidad (
        id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        profesional_id integer NOT NULL REFERENCES profesionales (id) ON DELETE CASCADE,
        dia_semana     smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
        desde_min      smallint NOT NULL CHECK (desde_min BETWEEN 0 AND 1439),
        hasta_min      smallint NOT NULL CHECK (hasta_min BETWEEN 1 AND 1440),
        CHECK (hasta_min > desde_min)
      );
      CREATE UNIQUE INDEX disponibilidad_unica ON disponibilidad (profesional_id, dia_semana, desde_min);

      CREATE TABLE turnos (
        id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        profesional_id integer NOT NULL REFERENCES profesionales (id) ON DELETE CASCADE,
        cliente_id     integer NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
        inicio         timestamptz NOT NULL,
        fin            timestamptz NOT NULL,
        estado         text NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente', 'confirmado', 'cancelado', 'vencido')),
        monto_sena     numeric(12, 2) NOT NULL CHECK (monto_sena >= 0),
        nota           text NOT NULL DEFAULT '',
        expira_en      timestamptz,
        pago_id        text,
        creado_en      timestamptz NOT NULL DEFAULT now(),
        CHECK (fin > inicio),
        -- La regla clave: un profesional no puede tener dos turnos activos que se pisen.
        -- La garantiza la base, así que ni dos pedidos simultáneos pueden romperla.
        -- El profesional se compara como rango de un solo valor ([id, id]) para que
        -- GiST lo indexe sin la extensión btree_gist: así funciona en cualquier Postgres.
        CONSTRAINT turnos_sin_superposicion EXCLUDE USING gist (
          int4range(profesional_id, profesional_id, '[]') WITH &&,
          tstzrange(inicio, fin, '[)') WITH &&
        ) WHERE (estado IN ('pendiente', 'confirmado'))
      );
      CREATE INDEX turnos_cliente_idx ON turnos (cliente_id, inicio DESC);

      CREATE TABLE eventos_pago (
        pago_id     text PRIMARY KEY,
        turno_id    integer REFERENCES turnos (id) ON DELETE SET NULL,
        estado      text NOT NULL,
        recibido_en timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
];
