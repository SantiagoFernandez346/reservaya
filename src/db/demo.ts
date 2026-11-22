import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import type { DB } from "./index";
import { usuarios, profesionales, disponibilidad } from "./schema";

/** Contraseña de todas las cuentas demo (publicada en el README para quien pruebe el sitio) */
export const CLAVE_DEMO = "demo1234";

const h = (horas: number) => horas * 60;

const PROFESIONALES_DEMO = [
  {
    nombre: "Laura Méndez",
    email: "laura@demo.reservaya.app",
    slug: "laura-mendez",
    profesion: "Psicóloga",
    descripcion:
      "Terapia cognitivo-conductual para adultos. Ansiedad, estrés laboral y procesos de cambio. Sesiones presenciales en Palermo.",
    zona: "Palermo, CABA",
    duracionMin: 50,
    precio: 30000,
    senaPorcentaje: 30,
    // lunes a viernes, 10 a 13 y 15 a 19
    franjas: [1, 2, 3, 4, 5].flatMap((d) => [
      { diaSemana: d, desdeMin: h(10), hastaMin: h(13) },
      { diaSemana: d, desdeMin: h(15), hastaMin: h(19) },
    ]),
  },
  {
    nombre: "Tomás Rivero",
    email: "tomas@demo.reservaya.app",
    slug: "tomas-rivero",
    profesion: "Barbero",
    descripcion: "Cortes clásicos y modernos, perfilado de barba y afeitado con navaja. Café incluido.",
    zona: "Villa Crespo, CABA",
    duracionMin: 30,
    precio: 12000,
    senaPorcentaje: 50,
    // martes a sábado, 11 a 20
    franjas: [2, 3, 4, 5, 6].map((d) => ({ diaSemana: d, desdeMin: h(11), hastaMin: h(20) })),
  },
  {
    nombre: "Carla Ibáñez",
    email: "carla@demo.reservaya.app",
    slug: "carla-ibanez",
    profesion: "Profesora de inglés",
    descripcion: "Clases individuales online para entrevistas de trabajo, exámenes internacionales y conversación.",
    zona: "Online",
    duracionMin: 60,
    precio: 18000,
    senaPorcentaje: 30,
    // lunes, miércoles y jueves de 17 a 21; sábados de 9 a 13
    franjas: [
      ...[1, 3, 4].map((d) => ({ diaSemana: d, desdeMin: h(17), hastaMin: h(21) })),
      { diaSemana: 6, desdeMin: h(9), hastaMin: h(13) },
    ],
  },
];

/** Carga profesionales y un cliente de ejemplo si la base está vacía. */
export async function cargarDatosDemo(db: DB) {
  const [{ cantidad }] = await db.select({ cantidad: sql<number>`count(*)::int` }).from(usuarios);
  if (Number(cantidad) > 0) return;

  const hash = await bcrypt.hash(CLAVE_DEMO, 10);
  await db.transaction(async (tx) => {
    await tx.insert(usuarios).values({ nombre: "Martina (cliente demo)", email: "cliente@demo.reservaya.app", hash, rol: "cliente" });
    for (const { nombre, email, franjas, ...perfil } of PROFESIONALES_DEMO) {
      const [usuario] = await tx.insert(usuarios).values({ nombre, email, hash, rol: "profesional" }).returning();
      const [pro] = await tx.insert(profesionales).values({ ...perfil, usuarioId: usuario.id }).returning();
      await tx.insert(disponibilidad).values(franjas.map((f) => ({ ...f, profesionalId: pro.id })));
    }
  });
}
