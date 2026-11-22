import { expect, test } from "@playwright/test";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
const email = process.env.PIXELBLOOM_E2E_EMAIL;
const password = process.env.PIXELBLOOM_E2E_PASSWORD;

test("uma sessão anônima recebe o fluxo de entrada ou de configuração", async ({ page }) => {
  await page.goto("/dashboard");
  if (!configured) {
    await expect(page).toHaveURL(/\/configuracao\/?(?:\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Configure o ambiente" })).toBeVisible();
    return;
  }

  await expect(page).toHaveURL(/\/login\/?(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Entrar no PixelBloom" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("os formulários públicos de cadastro e recuperação estão disponíveis", async ({ page }) => {
  test.skip(!configured, "Requer configuração Supabase de teste");

  await page.goto("/register");
  await expect(page.getByLabel("Nome", { exact: true })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar conta", exact: true })).toBeVisible();

  await page.goto("/forgot-password");
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar link", exact: true })).toBeVisible();
});

test("a tela de login permite alternar entre acesso corporativo e familiar", async ({ page }) => {
  test.skip(!configured, "Requer configuração Supabase de teste");

  await page.goto("/login");
  const access = page.getByRole("navigation", { name: "Tipos de conta" });
  await access.getByRole("link", { name: "Conta de paciente ou responsável" }).click();
  await expect(page.getByRole("heading", { name: "Entrar na área da família" })).toBeVisible();
  await expect(access.getByRole("link", { name: "Conta de paciente ou responsável" })).toHaveAttribute("aria-current", "page");

  await access.getByRole("link", { name: "Conta corporativa" }).click();
  await expect(page.getByRole("heading", { name: "Entrar no PixelBloom", exact: true })).toBeVisible();
  await expect(access.getByRole("link", { name: "Conta corporativa" })).toHaveAttribute("aria-current", "page");
});

test("as duas demonstrações abrem sem autenticação", async ({ page }) => {
  if (configured) {
    await page.goto("/login");
    const demo = page.getByRole("navigation", { name: "Demonstração sem login" });
    await demo.getByRole("link", { name: "Acesso corporativo" }).click();
  } else {
    await page.goto("/demo/corporativo");
  }
  await expect(page.getByRole("heading", { name: "Painel corporativo" })).toBeVisible();
  await page.getByRole("link", { name: "Família", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Área de pacientes e responsáveis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Controle parental" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("um usuário de teste entra e encerra a sessão", async ({ page }) => {
  test.skip(!configured || !email || !password, "Requer conta sintética confirmada e vinculada em Supabase de teste");
  if (!email || !password) return;

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login\/?(?:\?.*)?$/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\/?(?:\?.*)?$/);
});

test("a demo da loja permite experimentar, resgatar e equipar um item", async ({ page }) => {
  await page.goto("/demo/avatares");
  await expect(page.getByText("65 itens", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Regador de jardim" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /navalha|barbear|barber club/i })).toHaveCount(0);
  const item = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Camiseta básica branca" }) });
  await item.getByRole("button", { name: "Experimentar Camiseta básica branca" }).click();
  await expect(page.getByRole("img", { name: "Avatar experimentando Camiseta básica branca" })).toBeVisible();
  await item.getByRole("button", { name: "Resgatar", exact: true }).click();
  await expect(page.getByText("34 pontos", { exact: true }).first()).toBeVisible();
  await item.getByRole("button", { name: "Equipar", exact: true }).click();
  await expect(item.getByText("Comum · Equipado")).toBeVisible();
});
