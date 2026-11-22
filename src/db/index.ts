import "server-only";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { MIGRACIONES } from "./migraciones";
import { cargarDatosDemo } from "./demo";

export type DB = PostgresJsDatabase<typeof schema>;

type Conexion = { db: DB; ejecutar: (sql: string) => Promise<void> };

/**
 * Elige la base según el entorno:
 * - DATABASE_URL (Neon, Supabase, Postgres propio) → driver postgres-js.
 * - Sin DATABASE_URL → PGlite: Postgres real compilado a WebAssembly, guardado en
 *   la carpeta .pglite. Así el proyecto corre con `npm run dev` sin instalar nada.
 */
async function conectar(): Promise<Conexion> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const cliente = postgres(url, { max: 5, prepare: false });
    return {
      db: drizzlePostgres(cliente, { schema }),
      ejecutar: async (sql) => {
        await cliente.unsafe(sql);
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  // En local va dentro de node_modules/.cache para que el observador de archivos de Next no la vigile
  const carpeta = process.env.PGLITE_DIR ?? (process.env.VERCEL ? "/tmp/pglite" : "./node_modules/.cache/reservaya-pglite");
  const cliente = new PGlite(carpeta === "memoria" ? undefined : carpeta);
  return {
    // Ambos drivers exponen la misma API de consultas; el tipo común es el de postgres-js
    db: drizzlePglite(cliente, { schema }) as unknown as DB,
    ejecutar: async (sql) => {
      await cliente.exec(sql);
    },
  };
}

async function migrar({ ejecutar, db }: Conexion) {
  await ejecutar(
    "CREATE TABLE IF NOT EXISTS esquema_version (id integer PRIMARY KEY, nombre text NOT NULL, aplicada_en timestamptz NOT NULL DEFAULT now())",
  );
  const filas = (await db.execute("SELECT id FROM esquema_version")) as unknown;
  const lista = (Array.isArray(filas) ? filas : (filas as { rows: { id: number }[] }).rows) as { id: number }[];
  const aplicadas = new Set(lista.map((f) => Number(f.id)));
  for (const m of MIGRACIONES) {
    if (aplicadas.has(m.id)) continue;
    await ejecutar(`BEGIN; ${m.sql}; INSERT INTO esquema_version (id, nombre) VALUES (${m.id}, '${m.nombre}'); COMMIT;`);
  }
  if (process.env.DATOS_DEMO !== "no") await cargarDatosDemo(db);
}

// En desarrollo Next recarga módulos: se guarda la conexión en globalThis para no abrir una por recarga
const global = globalThis as unknown as { __reservaya?: Promise<DB> };

/** Devuelve la base lista para usar (conectada, migrada y con datos demo). */
export function obtenerDb(): Promise<DB> {
  global.__reservaya ??= (async () => {
    const conexion = await conectar();
    await migrar(conexion);
    return conexion.db;
  })().catch((error) => {
    global.__reservaya = undefined;
    throw error;
  });
  return global.__reservaya;
}

/** Código de Postgres cuando se viola el exclusion constraint (turno superpuesto) */
export function esSuperposicion(error: unknown): boolean {
  let actual: unknown = error;
  for (let i = 0; i < 4 && actual; i++) {
    const e = actual as { code?: string; cause?: unknown };
    if (e.code === "23P01") return true;
    actual = e.cause;
  }
  return false;
}
