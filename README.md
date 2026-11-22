# ReservaYa

Plataforma de turnos online para profesionales: el cliente elige día y hora, deja una seña con Mercado Pago y el turno queda confirmado en su cuenta y en la agenda del profesional. Incluye un asistente con IA que entiende pedidos como *"quiero un turno el jueves a la tarde"*.

> Proyecto de portfolio. Los pagos son de prueba: no se cobra nada.

## Probalo

Cuentas demo (contraseña `demo1234`), también disponibles con un clic en la pantalla de ingreso:

| Rol | Email |
|---|---|
| Cliente | `cliente@demo.reservaya.app` |
| Psicóloga | `laura@demo.reservaya.app` |
| Barbero | `tomas@demo.reservaya.app` |
| Profesora de inglés | `carla@demo.reservaya.app` |

## Funcionalidades

**Para clientes**
- Agenda de las próximas dos semanas con solo los horarios realmente libres.
- **Asistente con IA**: se le pide un turno con palabras y propone horarios de la agenda real.
- Seña con **Mercado Pago** (Checkout Pro). El lugar queda guardado 15 minutos mientras se paga.
- "Mis turnos": próximos, historial, reintentar el pago y cancelar.

**Para profesionales**
- Agenda con los turnos confirmados y pendientes de seña.
- Horarios de atención por día (hasta dos franjas), precio, duración y porcentaje de seña.
- **Resumen semanal redactado con IA**: turnos, señas cobradas y sugerencias para llenar huecos.

## Tecnologías

Next.js 16 (App Router, Server Actions, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM · Zod · Mercado Pago SDK · Claude API (Anthropic SDK) · Vitest · Playwright · GitHub Actions

## Decisiones técnicas

- **La base garantiza que no haya turnos superpuestos.** La tabla `turnos` tiene un *exclusion constraint* de Postgres sobre el rango horario de cada profesional. Si dos personas reservan el mismo horario al mismo tiempo, la base rechaza la segunda, sin depender de que la validación de la app llegue primero. El profesional se compara como rango de un solo valor, así funciona sin la extensión `btree_gist`.
- **Pagos idempotentes y verificados.** El webhook de Mercado Pago verifica la firma HMAC (`x-signature`), rechaza avisos viejos, consulta el pago en la API de MP en vez de confiar en el aviso y registra cada pago una sola vez (tabla `eventos_pago`). Si el pago llega después de que venció la reserva, el turno se reactiva solo si el horario sigue libre.
- **La IA no puede inventar horarios.** Claude usa *tool use* con una herramienta `buscar_horarios_libres` que consulta la agenda real. Los botones que ve el cliente salen siempre del resultado de la herramienta, nunca del texto del modelo. Sin clave de API, o si la API falla, un intérprete por reglas resuelve los pedidos comunes.
- **Funciona sin configurar nada.** Sin `DATABASE_URL` usa **PGlite** (Postgres real compilado a WebAssembly); sin credenciales de Mercado Pago, un checkout simulado; sin clave de Anthropic, el asistente básico. Clonar y correr `npm run dev` alcanza.
- **Seguridad.** Contraseñas con bcrypt, sesión en cookie `httpOnly` firmada (JWT con `jose`), validación con Zod en cada Server Action, consultas parametrizadas y redirecciones solo a rutas internas.
- **Hora de Argentina.** Los turnos se guardan en UTC (`timestamptz`) y la agenda se arma en hora local (UTC−3), con tests para los casos que cruzan la medianoche UTC.

## Estructura

```
src/
  app/                  Páginas (inicio, perfil /p/[slug], panel, pago) y API
    acciones/           Server Actions: auth, reservas, panel
    api/asistente/      Endpoint del asistente (con límite por IP)
    api/webhooks/       Webhook de Mercado Pago
  components/           Reserva interactiva, asistente, editores del panel
  db/                   Esquema Drizzle, migraciones SQL, datos demo y conexión
  lib/
    horarios.ts         Cálculo de horarios libres (lógica pura, testeada)
    turnos.ts           Reservar, pagar, cancelar, agendas
    pagos/              Mercado Pago, checkout simulado y verificación de firma
    asistente/          Claude con tool use, intérprete sin IA y resumen semanal
test/                   Tests de integración contra Postgres (PGlite en memoria)
e2e/                    Tests end-to-end con Playwright
```

## Correrlo en local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000. La base local se crea sola, con los datos demo.

Para usar servicios reales, copiá `.env.example` como `.env.local` y completá lo que quieras activar: Postgres en la nube, Mercado Pago de prueba o la API de Claude.

## Tests

```bash
npm test            # unitarios + integración con Postgres en memoria (Vitest)
npm run test:e2e    # flujo completo en el navegador sobre la app compilada (Playwright)
npm run lint && npm run typecheck
```

En cada push y pull request, GitHub Actions corre lint, tipos, los tests unitarios y después los end-to-end.

Los tests de integración prueban reglas de la base, no mocks: el rechazo de turnos superpuestos, la reserva simultánea del mismo horario, la seña vencida que libera el lugar y el aviso de pago duplicado.

## Publicar en Vercel

1. Importá el repositorio en Vercel.
2. Agregá una base Postgres (por ejemplo, Neon desde **Storage**). Eso crea `DATABASE_URL`. Las tablas y los datos demo se crean en la primera visita.
3. Variables de entorno: `SESION_SECRETO` (obligatoria). Opcionales: `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` (credenciales de prueba de Mercado Pago), `ANTHROPIC_API_KEY` y `APP_URL`.
4. En Mercado Pago, configurá el webhook en `https://tu-dominio/api/webhooks/mercadopago` con el evento *Pagos*.

---

Hecho por [Santiago Fernandez](https://santiagofernandez346.github.io/portafolio-2/).
