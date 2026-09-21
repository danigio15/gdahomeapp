// «Dove lo metto?»: il foglietto che accoglie un dispositivo appena abbinato (#54).
import { expect, test } from "@playwright/test";

import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SCATTI =
  "/tmp/claude-0/-home-user-gdahomeapp/f4ada8d3-2c6c-5763-b6bf-70aa075aba84/scratchpad";

const STANZE = [
  { id: "room_a", name: "Cucina", icon: "mdi:countertop" },
  { id: "room_b", name: "Salone", icon: "mdi:sofa" },
];

async function apri(page, testInfo, dispositivo) {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, { rooms: STANZE });
  await page.evaluate(
    (stanze) => localStorage.setItem("cd_stanze", JSON.stringify(stanze)),
    STANZE,
  );
  await page.evaluate((voce) => window.gdahomeDoveLoMetto(voce), dispositivo);
  await expect(page.locator("#dm-dove-lo-metto .dm-dove-foglio")).toBeVisible();
}

test("una lampadina si propone da sola, e fa vedere cosa sta per scrivere", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo, {
    entity: "light.lampadario_cucina",
    nome: "Lampadario cucina",
    stanza_id: "room_a",
  });
  const foglio = page.locator("#dm-dove-lo-metto");
  await expect(foglio.locator(".dm-dove-nome")).toHaveText("Luci");
  await expect(foglio.locator(".dm-dove-perche")).toContainText("lampadina");
  /* Il riquadro «riempio io così» è l'unico momento in cui chi guarda può
   * accorgersi che il nome è sbagliato. */
  const righe = await foglio.locator(".dm-dove-riga").allInnerTexts();
  expect(righe.join(" | ")).toContain("light.lampadario_cucina");
  expect(righe.join(" | ")).toContain("Lampadario cucina");
  expect(righe.join(" | ")).toContain("Cucina");
  await expect(foglio.locator("[data-dm-dove-salva]")).toContainText("Luci");
  /* Sul telefono, che è dove lo si guarda davvero: è un foglietto che sale dal
   * basso, come nel disegno. */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${SCATTI}/dove-lo-metto.png` });
});

test("accettare scrive nella forma che vuole quella sezione", async ({ page }, testInfo) => {
  await apri(page, testInfo, {
    entity: "light.lampadario_cucina",
    nome: "Lampadario cucina",
    stanza_id: "room_a",
  });
  await page.locator("[data-dm-dove-salva]").click();
  await expect(page.locator("#dm-dove-lo-metto")).toHaveCount(0);
  /* La luce in una mappa, la sua stanza in un'altra: è l'unica sezione fatta
   * così, ed è il motivo per cui questo passo non lo fa l'app. */
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cd_luci")))).toEqual({
    "light.lampadario_cucina": "Lampadario cucina",
  });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cd_luci_rooms")))).toEqual({
    "light.lampadario_cucina": "room_a",
  });
});

test("una presa finisce in un elenco di righe, con la stanza addosso", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo, {
    entity: "switch.presa_lavatrice",
    nome: "Presa lavatrice",
    device_class: "outlet",
    stanza_id: "room_b",
  });
  await expect(page.locator(".dm-dove-nome")).toHaveText("Prese");
  await page.locator("[data-dm-dove-salva]").click();
  const prese = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_prese")));
  expect(prese.length).toBe(1);
  /* Si guardano i campi che abbiamo scritto noi, non tutta la riga: dopo il
   * salvataggio la plancia la normalizza per conto suo — le mette un `id`, un
   * posto nell'ordine, la casella del wattmetro — ed è esattamente quello che
   * deve fare. È il motivo per cui a scrivere è lei. */
  expect(prese[0]).toMatchObject({
    entity: "switch.presa_lavatrice",
    name: "Presa lavatrice",
    icon: "🔌",
    room_id: "room_b",
  });
});

test("quello che non si sa dove mettere lo dice, e non si può salvare al buio", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo, { entity: "sensor.qualcosa", nome: "Boh" });
  await expect(page.locator(".dm-dove-vuoto")).toBeVisible();
  await expect(page.locator("[data-dm-dove-salva]")).toBeDisabled();
  /* Ma si sceglie a mano, e allora si può. */
  await page.locator('[data-dm-dove-sezione="entita_mie"]').click();
  await expect(page.locator(".dm-dove-nome")).toHaveText("Le tue entità");
  await expect(page.locator(".dm-dove-perche")).toContainText(/scelta/i);
  await page.locator("[data-dm-dove-salva]").click();
  const mie = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_entita_mie")));
  expect(mie[0].entity).toBe("sensor.qualcosa");
  expect(mie[0].sezione).toBe("home");
});

test("la sezione scelta non compare fra le «oppure»", async ({ page }, testInfo) => {
  /* «Oppure» con dentro anche quella scelta direbbe «oppure quella lì». */
  await apri(page, testInfo, { entity: "light.x", nome: "Luce" });
  const altre = await page
    .locator("[data-dm-dove-sezione]")
    .evaluateAll((n) => n.map((b) => b.dataset.dmDoveSezione));
  expect(altre).not.toContain("luci");
  /* Ci sono tutte le altre: quante siano lo dice il nucleo, e inchiodare un
   * numero qui vorrebbe dire rompere questa prova ogni volta che una sezione
   * nuova può accogliere un dispositivo. */
  const quante = await page.evaluate(async () => {
    const { LE_SEZIONI } = await import("/src/core/dove-lo-metto.js");
    return LE_SEZIONI.length;
  });
  expect(altre.length).toBe(quante - 1);
});

test("la stanza si cambia dal foglietto, e l'anteprima lo dice subito", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo, { entity: "light.x", nome: "Luce", stanza_id: "room_a" });
  await page.locator("[data-dm-dove-stanza]").selectOption("room_b");
  await expect(page.locator(".dm-dove-riga").last()).toContainText("Salone");
  await page.locator("[data-dm-dove-salva]").click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cd_luci_rooms")))).toEqual({
    "light.x": "room_b",
  });
});

test("«più tardi» non scrive niente, e l'Escape nemmeno", async ({ page }, testInfo) => {
  await apri(page, testInfo, { entity: "light.x", nome: "Luce" });
  await page.locator(".dm-dove-dopo").click();
  await expect(page.locator("#dm-dove-lo-metto")).toHaveCount(0);
  /* Il cassetto delle luci il guscio ce l'ha già, vuoto, dall'accensione: quel
   * che conta è che questa luce non ci sia finita dentro. */
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("cd_luci") || "{}")),
  ).not.toHaveProperty("light.x");

  await page.evaluate(() => window.gdahomeDoveLoMetto({ entity: "light.x", nome: "Luce" }));
  await expect(page.locator(".dm-dove-foglio")).toBeVisible();
  /* Un foglietto che si apre da solo e non si chiude col gesto di sempre è un
   * foglietto in cui uno resta chiuso dentro. */
  await page.keyboard.press("Escape");
  await expect(page.locator("#dm-dove-lo-metto")).toHaveCount(0);
});

test("rifare il giro corregge, non duplica", async ({ page }, testInfo) => {
  await apri(page, testInfo, { entity: "switch.x", nome: "Vecchio", device_class: "outlet" });
  await page.locator("[data-dm-dove-salva]").click();
  await page.evaluate(() =>
    window.gdahomeDoveLoMetto({ entity: "switch.x", nome: "Nuovo", device_class: "outlet" }),
  );
  await page.locator("[data-dm-dove-salva]").click();
  const prese = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_prese")));
  expect(prese.length).toBe(1);
  expect(prese[0].name).toBe("Nuovo");
});

test("quello che arriva da fuori è testo, non codice", async ({ page }, testInfo) => {
  /* Il nome lo scrive l'app, e l'app lo prende dal registro di Home Assistant:
   * è testo di qualcun altro, e a schermo ci va passando dalla stessa
   * scappatoia di tutto il resto. */
  await apri(page, testInfo, {
    entity: "light.x",
    nome: '<img src=x onerror="window.__bucato=1">Luce',
  });
  await expect(page.locator(".dm-dove-testa p")).toContainText("<img src=x");
  expect(await page.evaluate(() => window.__bucato)).toBeUndefined();
  expect(await page.locator(".dm-dove-testa img").count()).toBe(0);
});

test("senza entità non si apre niente", async ({ page }, testInfo) => {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, { rooms: STANZE });
  expect(await page.evaluate(() => window.gdahomeDoveLoMetto({ nome: "Senza" }))).toBe(false);
  await expect(page.locator("#dm-dove-lo-metto")).toHaveCount(0);
});

test("un sensore di temperatura vuole una stanza, e senza non si salva", async ({
  page,
}, testInfo) => {
  /* È la forma più diversa di tutte: non un elenco, una casella su una riga
   * delle Stanze. Senza stanza non c'è dove metterla, e il tasto lo dice
   * invece di scrivere a vuoto. */
  await apri(page, testInfo, {
    entity: "sensor.camera_temperatura",
    nome: "Temperatura camera",
    device_class: "temperature",
  });
  /* «Temperature», al plurale: è come si chiama la scheda del Config, e il
   * foglietto chiama le sezioni come le chiama lei. */
  await expect(page.locator(".dm-dove-nome")).toHaveText("Temperature");
  await expect(page.locator("[data-dm-dove-salva]")).toBeDisabled();
  await expect(page.locator("[data-dm-dove-salva]")).toContainText(/stanza/i);

  await page.locator("[data-dm-dove-stanza]").selectOption("room_a");
  await expect(page.locator("[data-dm-dove-salva]")).toBeEnabled();
  await page.locator("[data-dm-dove-salva]").click();
  const stanze = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_stanze")));
  expect(stanze[0].temp).toBe("sensor.camera_temperatura");
});

test("una porta finisce nel foglietto dei varchi", async ({ page }, testInfo) => {
  await apri(page, testInfo, {
    entity: "binary_sensor.porta_ingresso",
    nome: "Porta d'ingresso",
    device_class: "door",
  });
  /* E «Varchi»: stessa ragione. Porte, finestre e serrature stanno tutte lì,
   * e quella scheda nel Config si chiama così. */
  await expect(page.locator(".dm-dove-nome")).toHaveText("Varchi");
  await page.locator("[data-dm-dove-salva]").click();
  const varchi = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_varchi")));
  expect(varchi.aggiunte).toEqual(["binary_sensor.porta_ingresso"]);
  expect(varchi.nomi["binary_sensor.porta_ingresso"]).toBe("Porta d'ingresso");
});

test("di una presa con sei entità va in sezione l'interruttore, non il wattmetro", async ({
  page,
}, testInfo) => {
  /* Da una rete Zigbee entra un dispositivo, non un'entità: mettere in
   * sezione il wattmetro al posto dell'interruttore vuol dire una riga che
   * non si accende. */
  await apri(page, testInfo, {
    nome: "Presa lavatrice",
    entity: "sensor.presa_potenza",
    stanza_id: "room_b",
    entities: [
      { entity: "sensor.presa_potenza", device_class: "power" },
      { entity: "sensor.presa_batteria", device_class: "battery" },
      { entity: "switch.presa_lavatrice", device_class: "outlet" },
      { entity: "update.presa_firmware" },
    ],
  });
  await expect(page.locator(".dm-dove-nome")).toHaveText("Prese");
  /* E si dice che le altre non sono sparite. */
  await expect(page.locator(".dm-dove-porta")).toContainText("3");
  await page.locator("[data-dm-dove-salva]").click();
  const prese = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_prese")));
  expect(prese[0].entity).toBe("switch.presa_lavatrice");
});

test("un rilevatore che porta anche una temperatura lo dice", async ({ page }, testInfo) => {
  await apri(page, testInfo, {
    nome: "Corridoio",
    entity: "binary_sensor.corridoio_occupazione",
    entities: [
      { entity: "binary_sensor.corridoio_occupazione", device_class: "occupancy" },
      { entity: "sensor.corridoio_temperatura", device_class: "temperature" },
      { entity: "sensor.corridoio_batteria", device_class: "battery" },
    ],
  });
  await expect(page.locator(".dm-dove-nome")).toHaveText("Presenza");
  await expect(page.locator(".dm-dove-perche")).toContainText(/occupata/i);
  await expect(page.locator(".dm-dove-porta")).toContainText(/posto suo/i);
});
