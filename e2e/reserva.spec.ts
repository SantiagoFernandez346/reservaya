import { expect, test, type Page } from "@playwright/test";

/** Crea un cliente nuevo con un email único (contraseña de prueba, solo para la base en memoria) */
async function registrarCliente(page: Page, volver = "/") {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@prueba.test`;
  await page.goto(`/registro?volver=${encodeURIComponent(volver)}`);
  await page.getByLabel("Nombre y apellido").fill("Cliente de Prueba");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("clave-e2e-segura");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/registro"));
  return email;
}

async function elegirPrimerHorario(page: Page) {
  const horario = page.getByRole("radiogroup", { name: "Horarios" }).getByRole("radio").first();
  const hora = (await horario.textContent())!.trim();
  await horario.click();
  return hora;
}

test("un cliente reserva, paga la seña y ve el turno confirmado", async ({ page }) => {
  await registrarCliente(page);

  await page.goto("/");
  await page.getByRole("link", { name: /Tomás Rivero/ }).click();
  await expect(page.getByRole("heading", { name: "Tomás Rivero" })).toBeVisible();

  const hora = await elegirPrimerHorario(page);
  await page.getByLabel(/Nota para Tomás/).fill("Corte y barba");
  await page.getByRole("button", { name: /Reservar y pagar seña de \$\s?6\.000/ }).click();

  // Checkout simulado (sin credenciales de Mercado Pago)
  await expect(page.getByText("Checkout de prueba")).toBeVisible();
  await page.getByRole("button", { name: /Pagar \$\s?6\.000/ }).click();

  await expect(page.getByRole("heading", { name: "¡Listo, tenés turno!" })).toBeVisible();
  await expect(page.getByText(`${hora}h`)).toBeVisible();

  // Aparece en "Mis turnos" y el horario ya no se ofrece
  await page.getByRole("link", { name: "Ver mis turnos" }).click();
  const turno = page.getByTestId("turno").first();
  await expect(turno).toContainText("Confirmado");
  await expect(turno).toContainText("Tomás Rivero");

  // Cancelarlo libera el horario
  await turno.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("No tenés turnos reservados.")).toBeVisible();
});

test("si no ingresó, se le pide la cuenta y vuelve con el horario elegido", async ({ page }) => {
  await page.goto("/p/carla-ibanez");
  const hora = await elegirPrimerHorario(page);
  await page.getByRole("button", { name: /Reservar y pagar seña/ }).click();

  await expect(page).toHaveURL(/\/ingresar\?volver=/);
  await page.getByRole("link", { name: "Creá una" }).click();
  await registrarCliente(page, new URL(page.url()).searchParams.get("volver") ?? "/");

  await expect(page.getByRole("heading", { name: "Carla Ibáñez" })).toBeVisible();
  await expect(page.getByRole("radio", { name: hora, checked: true })).toBeVisible();
});

test("un pago rechazado deja el turno esperando la seña", async ({ page }) => {
  await registrarCliente(page);
  await page.goto("/p/laura-mendez");
  await elegirPrimerHorario(page);
  await page.getByRole("button", { name: /Reservar y pagar seña/ }).click();
  await page.getByRole("button", { name: "Simular pago rechazado" }).click();

  await expect(page.getByRole("heading", { name: "El pago no se aprobó" })).toBeVisible();
  await page.goto("/panel");
  await expect(page.getByTestId("turno").first()).toContainText("Falta la seña");
  await expect(page.getByRole("button", { name: "Pagar seña" })).toBeVisible();
});

test("el asistente propone horarios y al elegir uno queda seleccionado", async ({ page }) => {
  await page.goto("/p/laura-mendez");
  await page.getByLabel("¿Qué turno buscás?").fill("la semana que viene a la tarde");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();

  const propuestas = page.getByRole("button", { name: /→$/ });
  await expect(propuestas.first()).toBeVisible();
  await expect(page.getByText("Modo básico (sin IA)")).toBeVisible();

  await propuestas.first().click();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(1);
});

test("el profesional ve en su agenda el turno que le reservaron", async ({ page }) => {
  await registrarCliente(page);
  await page.goto("/p/laura-mendez");
  const hora = await elegirPrimerHorario(page);
  await page.getByRole("button", { name: /Reservar y pagar seña/ }).click();
  await page.getByRole("button", { name: /Pagar \$/ }).click();
  await expect(page.getByRole("heading", { name: "¡Listo, tenés turno!" })).toBeVisible();
  await page.getByRole("button", { name: "Salir" }).click();

  // Ingresa Laura (cuenta demo)
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Psicóloga" }).click();
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Tu agenda" })).toBeVisible();

  const fila = page.getByTestId("turno-agenda").filter({ hasText: "Cliente de Prueba" }).filter({ hasText: hora });
  await expect(fila.first()).toContainText("Confirmado");

  await page.getByRole("button", { name: "Generar resumen" }).click();
  await expect(page.getByText(/Tenés \d+ turnos? en los próximos 7 días/)).toBeVisible();
});
