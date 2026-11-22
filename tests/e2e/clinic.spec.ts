import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

type Inbox = {
  messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
};

async function verificationLink(request: APIRequestContext, email: string, flow: "signup" | "recovery"): Promise<string> {
  let url = "";
  await expect.poll(async () => {
    const inbox = await request.get("http://127.0.0.1:54324/api/v1/messages");
    if (!inbox.ok()) return false;
    const { messages } = (await inbox.json()) as Inbox;
    const matching = (messages ?? []).filter(({ To }) => To.some(({ Address }) => Address === email));
    for (const message of matching) {
      const response = await request.get(`http://127.0.0.1:54324/api/v1/message/${message.ID}`);
      if (!response.ok()) continue;
      const { HTML, Text } = (await response.json()) as { HTML: string; Text: string };
      const raw = `${HTML}\n${Text}`.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+/)?.[0];
      if (!raw) continue;
      const candidate = new URL(raw.replaceAll("&amp;", "&"));
      if (candidate.searchParams.get("type") !== flow) continue;
      expect(["127.0.0.1", "localhost", "[::1]"]).toContain(candidate.hostname);
      url = candidate.toString();
      return true;
    }
    return false;
  }, { timeout: 30_000, message: "O Mailpit deve receber o link de autenticação" }).toBe(true);
  return url;
}

test("cadastro confirmado, cadastros da clínica, agenda, cancelamento e recuperação", async ({ page, request }, testInfo) => {
  test.skip(process.env.PIXELBLOOM_E2E_LOCAL !== "1" || testInfo.project.name !== "desktop",
    "Exige Supabase local com Mailpit e execução opt-in");
  test.setTimeout(120_000);
  const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(supabaseUrl.hostname);
  const id = randomUUID().slice(0, 12);
  const slug = `e2e-${id}`;
  const email = `pixelbloom-${id}@example.com`;
  const password = randomUUID();
  const newPassword = randomUUID();
  const clinic = `Clínica sintética ${id}`;
  const service = "Serviço sintético";
  const professional = "Profissional sintético";
  const patient = "Paciente sintético";

  await page.goto("/register");
  await page.getByLabel("Nome", { exact: true }).fill("Titular sintético");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("confirmar o cadastro");

  await page.goto(await verificationLink(request, email, "signup"));
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Nome da clínica").fill(clinic);
  await page.getByLabel("Endereço da organização").fill(slug);
  await page.getByRole("button", { name: "Criar organização" }).click();
  await expect(page).toHaveURL(`/dashboard/${slug}`);

  const nav = page.getByRole("navigation", { name: "Navegação da organização" });
  await nav.getByRole("link", { name: "Serviços" }).click();
  await expect(page.getByRole("heading", { name: "Cadastrar serviço", exact: true })).toBeVisible();
  await page.getByLabel("Nome do serviço").fill(service);
  await page.getByLabel("Duração em minutos").fill("30");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByText(service, { exact: true })).toBeVisible();

  await nav.getByRole("link", { name: "Profissionais" }).click();
  await expect(page.getByRole("heading", { name: "Cadastrar profissional", exact: true })).toBeVisible();
  await page.getByLabel("Nome completo").fill(professional);
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByText(professional, { exact: true })).toBeVisible();

  await nav.getByRole("link", { name: "Pacientes" }).click();
  await expect(page.getByRole("heading", { name: "Cadastrar paciente", exact: true })).toBeVisible();
  await page.getByLabel("Nome completo").fill(patient);
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByText(patient, { exact: true })).toBeVisible();

  await page.goto(`/dashboard/${slug}/agenda?day=2099-11-22`);
  await page.getByRole("combobox", { name: "Paciente", exact: true }).selectOption({ label: patient });
  await page.getByRole("combobox", { name: "Profissional", exact: true }).selectOption({ label: professional });
  await page.getByRole("combobox", { name: "Serviço", exact: true }).selectOption({ label: service });
  await page.getByRole("button", { name: "Agendar atendimento" }).click();
  await expect(page.getByText("Agendado", { exact: true })).toBeVisible();
  await expect(page.getByText(`09:00 – 09:30 · ${service}`)).toBeVisible();

  await page.getByText("Cancelar atendimento", { exact: true }).click();
  await page.getByLabel("Motivo do cancelamento").fill("Cancelamento de teste");
  await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await expect(page.getByRole("heading", { name: "Recuperar senha", exact: true })).toBeVisible();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("status")).toContainText("link de recuperação");

  const recoveryUrl = await verificationLink(request, email, "recovery");
  await page.goto(recoveryUrl);
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("Senha", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page).toHaveURL(`/dashboard/${slug}`);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(`/dashboard/${slug}`);
});
