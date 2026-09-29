// I piani della casa, nella scheda Stanze del Config (#17).
import { expect, test } from "@playwright/test";

import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SCATTI =
  "/tmp/claude-0/-home-user-gdahomeapp/f4ada8d3-2c6c-5763-b6bf-70aa075aba84/scratchpad";

const STANZE = [
  { id: "room_a", name: "Cucina", icon: "mdi:countertop", floor: "Piano terra" },
  { id: "room_b", name: "Salone", icon: "mdi:sofa", floor: "Piano terra" },
  { id: "room_c", name: "Bagno", icon: "mdi:shower", floor: "Piano terra" },
  { id: "room_d", name: "Camera", icon: "mdi:bed", floor: "Primo piano" },
  { id: "room_e", name: "Bagno", icon: "mdi:shower", floor: "Primo piano" },
  { id: "room_f", name: "Studio", icon: "mdi:desk" },
];

async function apriLeStanze(
  page,
  testInfo,
  stanze = STANZE,
  piani = ["Piano terra", "Primo piano"],
) {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, { rooms: stanze });
  await page.evaluate(
    ({ stanze: sue, piani: suoi }) => {
      window.localStorage.setItem("cd_stanze", JSON.stringify(sue));
      window.localStorage.setItem("cd_floors", JSON.stringify(suoi));
    },
    { stanze, piani },
  );
  await page.evaluate(() => {
    window.apriConfigEntita?.();
    window.editorSwitch?.("stanze");
  });
  await expect(page.locator("#dm-piani-pannello")).toBeVisible();
}

const nomiDeiPiani = (page) =>
  page.locator("#dm-piani-pannello .dm-piano:not([data-senza]) .dm-piano-nome").allInnerTexts();

test("il pannello nasce sotto la riga che spiega la scheda, coi suoi conti", async ({
  page,
}, testInfo) => {
  await apriLeStanze(page, testInfo);
  const pannello = page.locator("#dm-piani-pannello");
  expect(await nomiDeiPiani(page)).toEqual(["Piano terra", "Primo piano"]);
  await expect(pannello.locator(".dm-piani-conto")).toHaveText("2 piani · 6 stanze");
  /* Le stanze di ogni piano si leggono senza aprire niente. */
  await expect(pannello.locator(".dm-piano-stanze").first()).toHaveText(
    "3 stanze · Cucina · Salone · Bagno",
  );
  /* Lo Studio non sta in nessun piano, e la sua riga lo dice. */
  await expect(pannello.locator('.dm-piano[data-senza="si"] .dm-piano-stanze')).toHaveText(
    "1 stanza · Studio",
  );
  /* Il posto: subito dopo la riga che spiega la scheda. */
  expect(
    await page.evaluate(
      () => document.getElementById("dm-piani-pannello").previousElementSibling.className,
    ),
  ).toContain("ed-intro");
  /* E il vecchio elenco in fondo se n'è andato: due posti per aggiungere un
   * piano e uno solo per ordinarlo sarebbero peggio di nessuno. */
  await expect(page.locator("#ed-floor-name")).toHaveCount(0);
});

test("le stanze si raggruppano sotto il loro piano, e le omonime lo dicono", async ({
  page,
}, testInfo) => {
  await apriLeStanze(page, testInfo);
  /* Il foglio li scrive in maiuscolo: si confronta quello che dicono, non come
   * è stampato. */
  const titoli = await page.locator("#ed-body .dm-piano-titolo-lista").allInnerTexts();
  expect(titoli.map((testo) => testo.replace(/^\S+\s/, "").toLowerCase())).toEqual([
    "piano terra",
    "primo piano",
    "senza piano",
  ]);
  /* Il cartellino del piano sulla riga non serve più: lo dice il titolo. */
  await expect(page.locator("#ed-body .dm-room-config-row .ed-row-old")).toHaveCount(0);
  /* E l'elenco salvato è nello stesso ordine di quello che si vede: è l'unico
   * modo di avere dei gruppi senza spostare le righe sotto i piedi alle frecce
   * del guscio, che contano dal documento. */
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("cd_stanze")).map((stanza) => stanza.name),
    ),
  ).toEqual(["Cucina", "Salone", "Bagno", "Camera", "Bagno", "Studio"]);
  /* Due stanze che si chiamano uguale: si dice, e si dice su tutte e due. */
  await expect(page.locator("#ed-body .dm-piano-doppio")).toHaveCount(2);
  /* Per lo scatto il corpo dell'editor si lascia alto quanto serve: di suo
   * scorre, e una foto ne prenderebbe un terzo. */
  await page.addStyleTag({
    content: `#editor-modal,#editor-modal>*,#ed-body{max-height:none!important;height:auto!important;overflow:visible!important}
      #editor-modal{position:static!important}
      .bottom-nav-bar,.bottom-nav-handle{display:none!important}`,
  });
  await page.setViewportSize({ width: 1180, height: 1500 });
  await page.locator("#ed-body").screenshot({ path: `${SCATTI}/piani-vero.png` });
  await page.setViewportSize({ width: 390, height: 1500 });
  await page.locator("#ed-body").screenshot({ path: `${SCATTI}/piani-vero-telefono.png` });
});

test("un piano sale, e l'ordine resta salvato", async ({ page }, testInfo) => {
  await apriLeStanze(page, testInfo);
  await page.locator('#dm-piani-pannello [data-dm-piano="Primo piano"] [data-dm-piano-su]').click();
  await expect.poll(() => nomiDeiPiani(page)).toEqual(["Primo piano", "Piano terra"]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cd_floors")))).toEqual([
    "Primo piano",
    "Piano terra",
  ]);
  /* Il primo della fila non può salire oltre. */
  await expect(
    page.locator('#dm-piani-pannello [data-dm-piano="Primo piano"] [data-dm-piano-su]'),
  ).toBeDisabled();
});

test("rinominare un piano si porta dietro le sue stanze", async ({ page }, testInfo) => {
  await apriLeStanze(page, testInfo);
  const riga = page.locator('#dm-piani-pannello [data-dm-piano="Primo piano"]');
  await riga.locator("[data-dm-piano-rinomina]").click();
  const campo = page.locator("#dm-piani-pannello [data-dm-piano-nuovo-nome]");
  await expect(campo).toBeVisible();
  await campo.fill("Piano 1");
  await campo.press("Enter");

  await expect.poll(() => nomiDeiPiani(page)).toEqual(["Piano terra", "Piano 1"]);
  const stanze = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_stanze")));
  expect(stanze.filter((stanza) => stanza.floor === "Piano 1").map((s) => s.name)).toEqual([
    "Camera",
    "Bagno",
  ]);
  expect(stanze.some((stanza) => stanza.floor === "Primo piano")).toBe(false);
});

test("il cestino chiede prima, e dice quante stanze restano scoperte", async ({
  page,
}, testInfo) => {
  await apriLeStanze(page, testInfo);
  const riga = page.locator('#dm-piani-pannello [data-dm-piano="Piano terra"]');
  await riga.locator("[data-dm-piano-chiedi]").click();
  const domanda = page.locator('#dm-piani-pannello [data-chiede="si"]');
  await expect(domanda).toBeVisible();
  await expect(domanda).toContainText("3 stanze");
  await expect(domanda).toContainText("non si cancellano");

  /* Annullando non succede niente. */
  await domanda.locator("[data-dm-piano-annulla]").click();
  await expect.poll(() => nomiDeiPiani(page)).toEqual(["Piano terra", "Primo piano"]);

  await riga.locator("[data-dm-piano-chiedi]").click();
  await page.locator("#dm-piani-pannello [data-dm-piano-cancella]").click();
  await expect.poll(() => nomiDeiPiani(page)).toEqual(["Primo piano"]);
  /* Le stanze restano: cancellare un piano non è cancellare il salone. */
  const stanze = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_stanze")));
  expect(stanze.length).toBe(6);
  expect(stanze.filter((stanza) => !stanza.floor).map((s) => s.name)).toEqual([
    "Cucina",
    "Salone",
    "Bagno",
    "Studio",
  ]);
});

test("un piano nuovo si aggiunge, e un nome già preso lo dice", async ({ page }, testInfo) => {
  await apriLeStanze(page, testInfo);
  const campo = page.locator("#dm-piani-pannello [data-dm-piano-nome]");
  await campo.fill("Piano terra");
  await page.locator("#dm-piani-pannello [data-dm-piano-aggiungi]").click();
  await expect(page.locator("#dm-piani-pannello [data-dm-piano-errore]")).toHaveText(
    /si chiama già così/i,
  );
  expect(await nomiDeiPiani(page)).toEqual(["Piano terra", "Primo piano"]);

  await campo.fill("Mansarda");
  await campo.press("Enter");
  await expect.poll(() => nomiDeiPiani(page)).toEqual(["Piano terra", "Primo piano", "Mansarda"]);
  /* Un piano appena creato e ancora vuoto resta nell'elenco: sparire sarebbe
   * sembrare cancellato. */
  await expect(
    page.locator('#dm-piani-pannello [data-dm-piano="Mansarda"] .dm-piano-stanze'),
  ).toHaveText("0 stanze");
});

test("senza piani il pannello c'è lo stesso, e dice cosa farne", async ({ page }, testInfo) => {
  await apriLeStanze(
    page,
    testInfo,
    STANZE.map(({ floor: _floor, ...resto }) => resto),
    [],
  );
  await expect(page.locator("#dm-piani-pannello .dm-piani-vuoto")).toBeVisible();
  /* Con tutte le stanze senza piano non si intitola niente: un titolo solo
   * sopra tutte direbbe quello che si sa già. */
  await expect(page.locator("#ed-body .dm-piano-titolo-lista")).toHaveCount(0);
});

test("nella finestra Modifica stanza il Piano è una tendina, non un testo libero", async ({
  page,
}, testInfo) => {
  await apriLeStanze(page, testInfo);
  /* La quinta riga è il Bagno del primo piano: l'ordine salvato è già quello
   * dei piani. */
  await page.locator('[data-dm-edit-kind="room"][data-dm-edit-index="4"]').click();
  const finestra = page.locator("#dm-room-editor-modal .dm-section-dialog");
  await expect(finestra).toBeVisible();
  const tendina = finestra.locator('select[name="floor"]');
  /* Scritto a mano, «primo piano» accanto a un «Primo piano» faceva due piani:
   * la stessa casa divisa in quattro per una lettera. */
  await expect(finestra.locator('input[name="floor"]')).toHaveCount(0);
  await expect(tendina).toHaveValue("Primo piano");
  expect(await tendina.locator("option").allInnerTexts()).toEqual([
    "— Senza piano —",
    "Piano terra",
    "Primo piano",
  ]);

  await tendina.selectOption("Piano terra");
  await finestra.locator('button[type="submit"]').click();
  await expect
    .poll(async () =>
      (await page.evaluate(() => JSON.parse(localStorage.getItem("cd_stanze")))).map(
        (stanza) => `${stanza.name}/${stanza.floor || "—"}`,
      ),
    )
    .toContain("Bagno/Piano terra");
});

test("un piano che l'elenco non conosce resta nella tendina, selezionato", async ({
  page,
}, testInfo) => {
  /* Una configurazione più vecchia non deve perdere il suo piano solo perché
   * non è mai passata dal pannello. */
  await apriLeStanze(
    page,
    testInfo,
    [{ id: "room_z", name: "Soffitta", icon: "mdi:home", floor: "Mansarda" }],
    [],
  );
  await page.locator('[data-dm-edit-kind="room"][data-dm-edit-index="0"]').click();
  const tendina = page.locator('#dm-room-editor-modal select[name="floor"]');
  await expect(tendina).toHaveValue("Mansarda");
});

test("nella pagina Stanze ogni piano porta il suo segno", async ({ page }, testInfo) => {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, { rooms: STANZE });
  await page.evaluate((stanze) => {
    localStorage.setItem("cd_stanze", JSON.stringify(stanze));
    localStorage.setItem("cd_floors", JSON.stringify(["Piano terra", "Primo piano"]));
    localStorage.setItem(
      "cd_floor_icons",
      JSON.stringify({ "Piano terra": "🏠", "Primo piano": "🪜" }),
    );
  }, STANZE);
  await page.reload();
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-stanze")?.classList.add("active");
  });
  const titoli = page.locator("#page-stanze .dm-stanze-piano > span");
  await expect(titoli).toHaveCount(3);
  /* Il foglio li scrive in maiuscolo e `innerText` stringe gli spazi: si
   * confronta quello che dicono. */
  expect(
    (await titoli.allInnerTexts()).map((testo) => testo.replace(/\s+/g, " ").toLowerCase()),
  ).toEqual(["🏠piano terra", "🪜primo piano", "senza piano"]);
  await page.locator("#page-stanze").screenshot({ path: `${SCATTI}/piani-stanze-vero.png` });
});

test("il segno di un piano si sceglie da una striscia, e resta salvato", async ({
  page,
}, testInfo) => {
  await apriLeStanze(page, testInfo);
  const riga = page.locator('#dm-piani-pannello [data-dm-piano="Piano terra"]');
  const segno = riga.locator("[data-dm-piano-segno]");
  /* Senza icona scelta porta quella di serie. */
  await expect(segno).toHaveText("🏢");
  await expect(riga.locator(".dm-piano-segni")).toHaveCount(0);

  await segno.click();
  const striscia = riga.locator(".dm-piano-segni button");
  await expect(striscia).toHaveCount(8);
  await riga.locator('[data-dm-piano-scegli="🪜"]').click();

  await expect(segno).toHaveText("🪜");
  /* La striscia si richiude da sola: scelto è scelto. */
  await expect(riga.locator(".dm-piano-segni")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cd_floor_icons")))).toEqual({
    "Piano terra": "🪜",
  });
  /* E il piano accanto non si è mosso: si cambia uno per volta. */
  await expect(
    page.locator('#dm-piani-pannello [data-dm-piano="Primo piano"] [data-dm-piano-segno]'),
  ).toHaveText("🏢");

  /* Un secondo tocco sul segno richiude senza cambiare niente: la striscia è
   * un cassetto, non una finestra da chiudere con la crocetta. */
  await segno.click();
  await expect(riga.locator(".dm-piano-segni")).toHaveCount(1);
  await segno.click();
  await expect(riga.locator(".dm-piano-segni")).toHaveCount(0);
  await expect(segno).toHaveText("🪜");
});
