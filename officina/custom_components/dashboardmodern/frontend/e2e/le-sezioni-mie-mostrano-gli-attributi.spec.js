/* «Nelle sezioni personalizzate non si vedono gli attributi» (#256).
 *
 * Un sensore della scuola dice la media nello stato e tutto il resto negli
 * attributi: l'ultimo voto, la materia, il giorno, i compiti da fare. Chi se
 * l'era messo in una sezione sua vedeva un nome e basta — nemmeno lo stato.
 *
 * Qui si fa quello che fa una persona: nell'editor si apre «Attributi da
 * mostrare», si spuntano quelli che servono, si cambia un nome, si salva, e
 * nella sezione si trovano sotto lo stato, con i nomi scelti e i valori
 * scritti come si dicono. E si controlla anche quello che NON deve esserci:
 * gli attributi tecnici nell'elenco, quelli non spuntati nella sezione, e
 * il «0 accese su 2» di una sezione che non ha niente da accendere.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { saveSection } from "./helpers/entity-field.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const STATI = {
  "sensor.scuola_media_voti": {
    entity_id: "sensor.scuola_media_voti",
    state: "7.8",
    attributes: {
      ultimo_voto: 8.5,
      materia: "Storia",
      data: "2026-10-14",
      tipo: "Interrogazione",
      voti_totali: 12,
      materia_migliore: "Matematica",
      friendly_name: "Media voti",
      icon: "mdi:school",
      state_class: "measurement",
      attribution: "Dati del registro di classe",
    },
  },
  "sensor.scuola_compiti": {
    entity_id: "sensor.scuola_compiti",
    state: "5",
    attributes: {
      unit_of_measurement: "compiti",
      friendly_name: "Compiti",
      prossima_consegna: "2026-10-17",
      da_fare: [
        { materia: "Matematica", cosa: "Esercizi da pag. 42 a pag. 44", consegna: "2026-10-17" },
        { materia: "Italiano", cosa: "Tema sul capitolo letto in classe", consegna: "2026-10-19" },
        { materia: "Inglese", cosa: "Unit 3, workbook", consegna: "2026-10-20" },
        { materia: "Scienze", cosa: "Ripasso", consegna: "2026-10-21" },
        { materia: "Storia", cosa: "Capitolo 4", consegna: "2026-10-22" },
      ],
      /* Un valore che arriva da fuori e prova a farsi HTML: deve restare
       * testo. */
      nota: "<img src=x onerror=window.__BUCATO__=1>",
    },
  },
};

const SEZIONI = [
  {
    id: "scuola",
    titolo: "Scuola",
    icona: "🎓",
    voci: [
      { entity: "sensor.scuola_media_voti", nome: "Media voti", icona: "📊" },
      {
        entity: "sensor.scuola_compiti",
        nome: "Compiti",
        icona: "📚",
        attributi: [
          { chiave: "prossima_consegna", nome: "Prossima consegna" },
          { chiave: "da_fare", nome: "Da fare" },
          { chiave: "nota", nome: "Nota" },
        ],
      },
    ],
  },
];

async function metteGliStati(page) {
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, structuredClone(valori));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
}

function sezioniSalvate(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("cd_sezioni_mie") || "[]"));
}

test("gli attributi scelti nell'editor si leggono nella sezione, sotto lo stato", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((sezioni) => {
    localStorage.setItem("cd_sezioni_mie", JSON.stringify(sezioni));
  }, SEZIONI);
  await metteGliStati(page);

  /* ── l'editor ─────────────────────────────────────────────────────── */
  /* La linguetta «Le tue sezioni» la mette il suo modulo appena il pannello
   * nasce: si aspetta che ci sia, e poi la si chiede. */
  await page.evaluate(() => globalThis.apriConfigEntita?.());
  await expect(page.locator('.ed-tab[data-tab="mie"]')).toHaveCount(1, { timeout: 20_000 });
  await page.evaluate(() => globalThis.editorSwitch?.("mie"));
  const voce = page.locator('#ed-body [data-mia-sezione="0"] [data-mia-voce="0"]');
  const blocco = voce.locator("[data-mia-attr-blocco]");
  await expect(blocco).toHaveCount(1, { timeout: 20_000 });

  /* Nasce chiuso, e da chiuso dice gia' quanti ce ne sono. */
  const testata = blocco.locator("[data-mia-attr-apri]");
  await expect(testata).toContainText("Attributi da mostrare");
  await expect(blocco.locator("[data-mia-attr-conto]")).toHaveText("0 di 6");
  await expect(blocco.locator(".dm-mia-ed-attr-corpo")).toBeHidden();
  await testata.click();
  await expect(blocco.locator(".dm-mia-ed-attr-corpo")).toBeVisible();

  /* Gli attributi di adesso, nell'ordine dell'entita', senza i tecnici, e
   * ognuno col suo valore di adesso. */
  const righe = blocco.locator("[data-mia-attr]");
  await expect(righe).toHaveCount(6);
  expect(await righe.evaluateAll((nodi) => nodi.map((nodo) => nodo.dataset.miaAttr))).toEqual([
    "ultimo_voto",
    "materia",
    "data",
    "tipo",
    "voti_totali",
    "materia_migliore",
  ]);
  await expect(blocco).not.toContainText("friendly_name");
  await expect(blocco).not.toContainText("attribution");
  await expect(blocco.locator('[data-mia-attr="ultimo_voto"]')).toContainText("adesso: 8,5");
  await expect(blocco.locator('[data-mia-attr="data"]')).toContainText("adesso: mer 14 ott");
  await expect(blocco).toContainText("Sono quelli che l'entità ha adesso");

  /* Spuntato, compare il nome — gia' scritto, leggibile. */
  const nomeDi = (chiave) => blocco.locator(`[data-mia-attr="${chiave}"] [data-mia-attr-nome]`);
  await expect(nomeDi("ultimo_voto")).toBeHidden();
  for (const chiave of ["ultimo_voto", "materia", "data"])
    await blocco.locator(`[data-mia-attr="${chiave}"] [data-mia-attr-spunta]`).check();
  await expect(nomeDi("ultimo_voto")).toBeVisible();
  await expect(nomeDi("ultimo_voto")).toHaveValue("Ultimo voto");
  await expect(nomeDi("materia")).toHaveValue("Materia");
  await expect(nomeDi("tipo")).toBeHidden();
  await nomeDi("data").fill("Giorno");
  await expect(blocco.locator("[data-mia-attr-conto]")).toHaveText("3 di 6");

  await saveSection(page);
  await expect
    .poll(async () => (await sezioniSalvate(page))[0]?.voci?.[0]?.attributi)
    .toEqual([
      { chiave: "ultimo_voto", nome: "Ultimo voto" },
      { chiave: "materia", nome: "Materia" },
      { chiave: "data", nome: "Giorno" },
    ]);
  /* Le scelte dell'altra voce restano come erano. */
  expect((await sezioniSalvate(page))[0].voci[1].attributi).toEqual(SEZIONI[0].voci[1].attributi);
  /* E il blocco aperto resta aperto dopo il salvataggio, con le spunte. */
  await expect(page.locator('#ed-body [data-mia-voce="0"] [data-mia-attr-conto]')).toHaveText(
    "3 di 6",
  );

  /* ── la sezione ───────────────────────────────────────────────────── */
  await page.evaluate(() => {
    document.getElementById("editor-modal")?.remove();
    document.querySelector('.tab[data-tab="mia-scuola"]')?.click();
  });
  const pagina = page.locator("#page-mia-scuola");
  await expect(pagina).toHaveClass(/active/, { timeout: 20_000 });
  const schede = pagina.locator(".dm-mia-riga");
  await expect(schede).toHaveCount(2);

  /* Lo stato torna a destra: il numero nella lingua di casa, con l'unita'. */
  const media = schede.nth(0);
  await expect(media.locator(".dm-mia-val")).toHaveText("7,8");
  await expect(schede.nth(1).locator(".dm-mia-val")).toHaveText("5 compiti");

  /* Sotto, solo quelli spuntati, coi nomi scelti e nell'ordine scelto. */
  const etichette = media.locator(".dm-mia-attr dt");
  await expect(etichette).toHaveText(["Ultimo voto", "Materia", "Giorno"]);
  await expect(media.locator(".dm-mia-attr dd")).toHaveText(["8,5", "Storia", "mer 14 ott"]);
  await expect(media).not.toContainText("Interrogazione");

  /* La lista: tre voci, materia in grassetto e il resto dopo, poi «e altri 2». */
  const compiti = schede.nth(1);
  await expect(compiti.locator(".dm-mia-attr dt")).toHaveText([
    "Prossima consegna",
    "Da fare",
    "Nota",
  ]);
  const voci = compiti.locator(".dm-mia-attr-lista li");
  await expect(voci).toHaveCount(3);
  await expect(voci.nth(0).locator("b")).toHaveText("Matematica");
  await expect(voci.nth(0)).toContainText("Esercizi da pag. 42 a pag. 44 · sab 17 ott");
  await expect(compiti.locator(".dm-mia-attr-altri")).toHaveText("e altri 2");

  /* Quello che arriva da Home Assistant resta testo. */
  await expect(compiti.locator(".dm-mia-attr dd").nth(2)).toHaveText(
    STATI["sensor.scuola_compiti"].attributes.nota,
  );
  expect(await page.evaluate(() => window.__BUCATO__)).toBeUndefined();

  /* Niente da accendere: si dice quante sono, non «0 accese su 2». */
  await expect(pagina).toContainText("2 entità");
  await expect(pagina).not.toContainText("accese su");

  /* L'attributo sparito dall'entita' non lascia una riga vuota. */
  await page.evaluate(() => {
    const stato = structuredClone(window.__HASS__.states["sensor.scuola_media_voti"]);
    delete stato.attributes.materia;
    window.__HASS__.states["sensor.scuola_media_voti"] = stato;
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) raw["sensor.scuola_media_voti"] = structuredClone(stato);
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(etichette).toHaveText(["Ultimo voto", "Giorno"]);

  /* Nel formato «Piccole» i primi due, ognuno su una riga sola. */
  await page.evaluate(() => {
    const sezioni = JSON.parse(localStorage.getItem("cd_sezioni_mie"));
    sezioni[0].formato = "piccole";
    localStorage.setItem("cd_sezioni_mie", JSON.stringify(sezioni));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(pagina.locator('.dm-mia-lista[data-formato="piccole"]')).toHaveCount(1);
  await expect(compiti.locator(".dm-mia-attr dt")).toHaveText(["Prossima consegna", "Da fare"]);
  await expect(compiti.locator(".dm-mia-attr-lista")).toHaveCount(0);
  const unaRiga = await compiti.locator(".dm-mia-attr dd").evaluateAll((nodi) =>
    nodi.map((nodo) => {
      const alta = parseFloat(getComputedStyle(nodo).lineHeight) || 16;
      return nodo.getBoundingClientRect().height <= alta * 1.5;
    }),
  );
  expect(unaRiga).toEqual([true, true]);
});
