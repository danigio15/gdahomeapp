import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* L'auto elettrica nel pianificatore: la batteria e le soste di ricarica.
 *
 * «Arrivo a Milano con la carica che ho, o mi devo fermare?» La pagina gdanav
 * legge l'auto della pagina Auto — la batteria, l'autonomia, l'obiettivo e la
 * carica di casa — e manda alla casa, con la strada, con quanta carica si
 * parte; la casa risponde con le soste. Qui la casa e' finta, e risponde come
 * `ponte/src/viaggi.js`: si guarda che il riquadro «L'auto» dica batteria ed
 * esito, che le soste stiano in elenco sotto la cartina con le ore e sulla
 * cartina coi fulmini, che «Parti alle» le conti, che le scelte tornino alla
 * casa, e che senza un'auto elettrica l'invito a collegarla lo veda solo chi
 * amministra la casa.
 *
 * Con `DM_FOTO=<cartella>` lascia le fotografie della pagina.
 */

const MAPPA = {
  "dm.ev_batteria_auto": "sensor.leap_batteria",
  "dm.ev_autonomia": "sensor.leap_autonomia",
  "dm.ev_target_soc": "number.leap_obiettivo",
  "dm.ev_stato_ricarica": "sensor.wallbox_stato",
  "dm.ev_potenza_wallbox": "sensor.wallbox_potenza",
};

const AUTO = [
  {
    id: "auto1",
    uid: "auto-1",
    name: "Leapmotor C10",
    brand: "Leapmotor",
    model: "C10",
    kwh: "70",
    ov: { ...MAPPA },
  },
  { id: "auto2", uid: "auto-2", name: "Ibrida di casa", tipo: "ibrida", kwh: "18", ov: {} },
];

const seme = (ev) => ({
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev,
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: ev.length ? { ...MAPPA } : {},
  },
  visibility: { home: true, ev: Boolean(ev.length) },
});

const DOMANI = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

/* La strada Napoli – Milano, dritta, e le soste che la casa ci trova. */
const LINEA = Array.from({ length: 41 }, (_v, i) => [
  14.25 + ((9.19 - 14.25) * i) / 40,
  40.85 + ((45.46 - 40.85) * i) / 40,
]);
const sulla = (f) => LINEA[Math.round(f * 40)];
const SOSTE_LUNGHE = [
  {
    km: 268,
    nome: "Area di servizio Feronia Ovest",
    operatore: "A1",
    kw: 300,
    lon: sulla(268 / 788)[0],
    lat: sulla(268 / 788)[1],
    da: 15,
    a: 80,
    min: 22,
  },
  {
    km: 528,
    nome: "Ionity <Aglio>",
    operatore: "A1",
    kw: 350,
    lon: sulla(528 / 788)[0],
    lat: sulla(528 / 788)[1],
    da: 17,
    a: 80,
    min: 23,
  },
];

const VIAGGI = (domani) => [
  {
    id: "v_1",
    tipo: "una",
    nome: "",
    da: null,
    tappe: [{ nome: "Caserta · Piazza Dante", lat: 41.07, lon: 14.33 }],
    quando: { modo: "arrivo", ora: "09:00", giorno: domani, giorni: [] },
    avviso: { acceso: true, minuti: 10 },
    prepara: { clima: null, garage: null },
    stima: { durataS: 2880, km: 41.3, fonte: "traffico" },
    prossima: { partenza: Date.parse(`${domani}T08:12`), arrivo: Date.parse(`${domani}T09:00`) },
  },
  {
    id: "v_2",
    tipo: "tappe",
    nome: "",
    da: null,
    tappe: [
      { nome: "Aversa · Caserta, Campania", lat: 40.97, lon: 14.2 },
      { nome: "Milano · Lombardia", lat: 45.46, lon: 9.19 },
    ],
    quando: { modo: "partenza", ora: "09:00", giorno: domani, giorni: [] },
    avviso: { acceso: true, minuti: 10 },
    prepara: { clima: null, garage: null },
    stima: { durataS: 31044, km: 788, fonte: "strada" },
    prossima: { partenza: Date.parse(`${domani}T09:00`), arrivo: Date.parse(`${domani}T19:40`) },
  },
];

async function apri(page, testInfo, { auto = true, inCarica = true, amministra = true } = {}) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* Le tessere della cartina: quelle di Esri, finte. */
  await page.route("https://server.arcgisonline.com/**", (route) => {
    const [, x, y] = route.request().url().split("/").slice(-3);
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#f1efe9"/><path d="M0 ${(Number(x) * 37) % 256} L256 ${(Number(y) * 53) % 256}" stroke="#fff" stroke-width="9"/><path d="M${(Number(y) * 29) % 256} 0 L${(Number(x) * 71) % 256} 256" stroke="#f8d38a" stroke-width="5"/><rect x="${(Number(x) * 13) % 200}" y="${(Number(y) * 17) % 200}" width="46" height="34" fill="#d5e8cc"/></svg>`,
    });
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme(auto ? AUTO : []));
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(
    ({ auto, inCarica, amministra, mappa, domani, viaggi, soste, linea }) => {
      if (auto) {
        localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
        window.cdApplyCanonicalOverrides?.(mappa);
      }
      const stati = window.eval("_RAW_STATES");
      const metti = (id, state, attributes = {}) =>
        (stati[id] = { entity_id: id, state, attributes: { friendly_name: id, ...attributes } });
      if (auto) {
        metti("sensor.leap_batteria", "62", { unit_of_measurement: "%" });
        metti("sensor.leap_autonomia", "245", { unit_of_measurement: "km" });
        metti("number.leap_obiettivo", "80", { unit_of_measurement: "%" });
        /* Ferma col cavo dentro: «Ferma a casa». */
        metti("sensor.wallbox_stato", inCarica ? "charging" : "connected");
        metti("sensor.wallbox_potenza", inCarica ? "7.4" : "0", { unit_of_measurement: "kW" });
      }
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.dmPuoConfigurare = () => amministra;
      window.__APERTA__ = "";
      window.apriConfigEntita = () => (window.__APERTA__ = "config");
      window.editorSwitch = (scheda) => (window.__APERTA__ += `:${scheda}`);
      window.__VIAGGI__ = viaggi;
      window.__STRADE__ = [];
      window.__SALVATI__ = [];
      const vero = window.eval("ws");
      const finto = {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (!String(m.type).startsWith("ponte/viaggi/")) return vero?.send?.(grezzo);
          const rispondi = (success, result, error) =>
            setTimeout(() => {
              const attese = window.eval("pendingWsCallbacks");
              const torna = attese[m.id];
              delete attese[m.id];
              torna?.({ id: m.id, type: "result", success, result, error });
            }, 15);
          if (m.type === "ponte/viaggi/elenco")
            return rispondi(true, {
              sbloccato: true,
              viaggi: window.__VIAGGI__,
              casa: { nome: "Casa", lat: 40.85, lon: 14.25 },
            });
          if (m.type === "ponte/viaggi/strada") {
            window.__STRADE__.push(m);
            const lunga = m.tappe.length > 1;
            const conAuto = m.auto
              ? {
                  soste: lunga
                    ? {
                        elenco: soste,
                        arrivo: 17,
                        ricaricaMin: 45,
                        partenza: m.auto.batteria,
                        tappeKm: [16, 788],
                        archivio: true,
                        fonte: "casa",
                      }
                    : {
                        elenco: [],
                        arrivo: m.auto.batteria - 8,
                        ricaricaMin: 0,
                        partenza: m.auto.batteria,
                        tappeKm: [41.3],
                        archivio: true,
                        fonte: "casa",
                      },
                }
              : {};
            return rispondi(true, {
              stima: lunga
                ? { durataS: 31044, km: 788, fonte: "strada" }
                : { durataS: 2700, km: 41.3, fonte: "strada" },
              linea: lunga
                ? linea
                : [
                    [14.25, 40.85],
                    [14.33, 41.07],
                  ],
              da: { nome: "Casa", lat: 40.85, lon: 14.25 },
              ...conAuto,
            });
          }
          if (m.type === "ponte/viaggi/salva") {
            window.__SALVATI__.push(m.viaggio);
            return rispondi(true, { viaggio: { ...m.viaggio, prossima: null } });
          }
          return rispondi(false, null, { code: "unknown_command", message: "?" });
        },
      };
      window.__FINTO__ = finto;
      window.eval("ws = window.__FINTO__");
    },
    {
      auto,
      inCarica,
      amministra,
      mappa: MAPPA,
      domani: DOMANI,
      viaggi: VIAGGI(DOMANI),
      soste: SOSTE_LUNGHE,
      linea: LINEA,
    },
  );
  const voce = page.locator('nav.tabs .tab[data-tab="gdanav"]');
  await expect(voce).toBeVisible();
  await voce.click();
  const pagina = page.locator("#dm-gn");
  await expect(pagina.locator(".dm-gn-viaggio")).toHaveCount(2);
  return pagina;
}

/* Le fotografie: senza la barra in basso e le bolle che stanno ferme sopra la
 * pagina, e la pagina intera alta quanto il suo contenuto. */
async function foto(page, nome, quale = null) {
  if (!process.env.DM_FOTO) return;
  await page.evaluate(() => {
    for (const nodo of document.querySelectorAll("body *")) {
      if (nodo.closest("#page-gdanav")) continue;
      if (getComputedStyle(nodo).position === "fixed") nodo.style.visibility = "hidden";
    }
  });
  await page.waitForTimeout(700);
  const percorso = `${process.env.DM_FOTO}/${nome}.png`;
  /* Tutta la pagina in una finestra alta quanto lei: niente testate che
   * scorrono sopra il pezzo da fotografare. */
  const prima = page.viewportSize();
  await page.evaluate(() => window.scrollTo(0, 0));
  const alta = await page.evaluate(() => {
    const fondo = document.getElementById("dm-gn")?.getBoundingClientRect().bottom || 0;
    return Math.ceil(fondo + window.scrollY + 40);
  });
  await page.setViewportSize({ width: prima.width, height: Math.max(prima.height, alta) });
  await page.waitForTimeout(500);
  const riquadro = quale ? await quale.boundingBox() : null;
  await page.screenshot({ path: percorso, ...(riquadro ? { clip: riquadro } : {}) });
  await page.setViewportSize(prima);
}

test("un viaggio lungo: l'auto, le soste in elenco e sulla cartina, e l'ora d'arrivo", async ({
  page,
}, testInfo) => {
  const pagina = await apri(page, testInfo);
  await pagina.locator(".dm-gn-viaggio", { hasText: "Casa – Milano" }).click();
  const auto = pagina.locator(".dm-gn-auto");
  await expect(auto).toBeVisible();
  await expect(auto.locator(".dm-gn-auto-nome")).toHaveText("Leapmotor C10");
  await expect(auto.locator(".dm-gn-auto-stato")).toContainText(/In carica a casa · 80% alle \d/);
  await expect(auto.locator(".dm-gn-num")).toHaveText([
    /62%\s*adesso/,
    /245 km\s*autonomia/,
    /7,4 kW\s*in carica/,
  ]);
  /* In carica: si parte con l'obiettivo, l'80%. Lo sa la casa. */
  await expect.poll(() => page.evaluate(() => window.__STRADE__.at(-1)?.auto?.batteria)).toBe(80);
  const chiesta = await page.evaluate(() => window.__STRADE__.at(-1).auto);
  expect(chiesta).toMatchObject({ kwh: 70, minimaArrivo: 15, kwColonnine: 100, kwMax: null });
  /* Il consumo dall'autonomia: 70 kWh al 62% per 245 km. */
  expect(chiesta.consumo).toBeCloseTo(17.7, 1);
  await expect(auto.locator('[data-gn-esito="soste"]')).toContainText(
    "Arrivi col 17% con 2 soste di ricarica",
  );
  await expect(auto.locator('[data-gn-esito="soste"]')).toContainText(
    "45 minuti di ricarica in tutto",
  );
  await expect(auto.locator(".dm-gn-barra-dida")).toContainText("alla partenza 80%");
  await expect(auto.locator("[data-gn-partenza].on")).toHaveText("80%");
  /* Due auto che si ricaricano: si sceglie quale. */
  await expect(auto.locator('[data-gn-campo="autoUid"] option')).toHaveText([
    "Leapmotor C10",
    "Ibrida di casa",
  ]);

  const parti = pagina.locator(".dm-gn-parti");
  await expect(parti.locator(".dm-gn-ora")).toHaveText("9:00");
  await expect(parti.locator("[data-gn-arrivo]")).toHaveText(
    "🏁 Arrivi verso le 19:40 con 2 soste di ricarica",
  );
  await expect(parti).toContainText("⚡ Ricarica: 45 min in 2 soste");
  await expect(parti).toContainText("Strada: 9 h 55 min · 788 km");

  const elenco = pagina.locator("[data-gn-soste]");
  await expect(elenco.locator(".dm-gn-soste-capo")).toContainText(
    "2 soste · 45 min · arrivi col 17%",
  );
  await expect(elenco.locator(".dm-gn-fila")).toHaveCount(5);
  const prima = elenco.locator('[data-gn-sosta-di-ricarica="1"]');
  await expect(prima).toContainText("Sosta 1 · dopo 268 km");
  await expect(prima).toContainText("Area di servizio Feronia Ovest · A1 · fino a 300 kW");
  await expect(prima).toContainText("dal 15% all'80% · 22 min");
  await expect(prima).toContainText("12:22");
  await expect(prima).toContainText("riparti 12:44");
  /* Il nome viene dall'archivio: si scrive, non si esegue. */
  await expect(elenco.locator('[data-gn-sosta-di-ricarica="2"]')).toContainText("Ionity <Aglio>");
  await expect(elenco.locator(".dm-gn-fila.arrivo")).toContainText("19:40");
  await expect(elenco.locator(".dm-gn-fila.tappa")).toContainText("dopo 16 km");
  await expect(elenco.locator(".dm-gn-fonti")).toContainText(
    "Colonnine: © OpenStreetMap e Piattaforma Unica Nazionale",
  );
  /* Sulla cartina, i fulmini numerati. */
  await expect(pagina.locator(".dm-gn-mappa [data-gn-fulmine]")).toHaveCount(2);
  await expect(pagina.locator('.dm-gn-mappa [data-gn-fulmine="2"] text')).toHaveText("2");

  const larga = (page.viewportSize()?.width || 0) > 900;
  await foto(page, larga ? "desktop-1-lungo-con-soste" : "telefono-1-lungo-con-soste");
  await foto(
    page,
    larga ? "desktop-1b-lungo-dettaglio" : "telefono-1b-lungo-tappe-e-soste",
    larga ? pagina.locator(".dm-gn-dett") : pagina.locator(".dm-gn-dett > div").first(),
  );
  if (!larga)
    await foto(page, "telefono-1c-lungo-auto", pagina.locator(".dm-gn-dett > div").nth(1));

  /* Colonnine da 150 kW: la casa lo sa, e lo salva col viaggio. */
  await auto.locator('[data-gn-campo="kwColonnine"]').selectOption("150");
  await expect
    .poll(() => page.evaluate(() => window.__STRADE__.at(-1)?.auto?.kwColonnine))
    .toBe(150);
  await expect(pagina.locator("[data-gn-soste] .dm-gn-fila")).toHaveCount(5);
  await auto.locator('[data-gn-partenza="100"]').click();
  await expect.poll(() => page.evaluate(() => window.__STRADE__.at(-1)?.auto?.batteria)).toBe(100);
  await expect(pagina.locator("[data-gn-soste] .dm-gn-fila.sosta")).toHaveCount(2);
  await pagina.locator("[data-gn-salva]").click();
  await expect.poll(() => page.evaluate(() => window.__SALVATI__.length)).toBe(1);
  const salvato = await page.evaluate(() => window.__SALVATI__[0]);
  expect(salvato.auto).toEqual({
    uid: "auto-1",
    partenza: 100,
    minimaArrivo: 15,
    kwColonnine: 150,
  });
  expect(salvato.soste.elenco).toHaveLength(2);
  expect(salvato.soste.arrivo).toBe(17);
});

test("un viaggio corto: nessuna sosta, e il ritorno", async ({ page }, testInfo) => {
  const pagina = await apri(page, testInfo, { inCarica: false });
  await pagina.locator(".dm-gn-viaggio", { hasText: "Casa – Caserta" }).click();
  const auto = pagina.locator(".dm-gn-auto");
  await expect(auto.locator(".dm-gn-auto-stato")).toHaveText("🔌 Ferma a casa · non in carica");
  await expect(auto.locator('[data-gn-esito="nessuna"]')).toContainText(
    "Arrivi col 54% · nessuna sosta",
  );
  await expect(auto.locator('[data-gn-esito="nessuna"]')).toContainText(
    "Al ritorno ti resta il 46%: basta senza ricaricare",
  );
  await expect(auto.locator(".dm-gn-num").nth(2)).toContainText("il viaggio");
  await expect(auto.locator(".dm-gn-barra-dida")).toContainText("all'arrivo 54%");
  /* Niente soste: niente elenco, niente fulmini, e le scelte non servono. */
  await expect(pagina.locator("[data-gn-soste]")).toHaveCount(0);
  await expect(pagina.locator("[data-gn-fulmine]")).toHaveCount(0);
  await expect(auto.locator(".dm-gn-scelte")).toHaveCount(0);
  expect(await page.evaluate(() => window.__STRADE__.at(-1).auto.batteria)).toBe(62);
  const larga = (page.viewportSize()?.width || 0) > 900;
  await foto(
    page,
    larga ? "desktop-2-breve-nessuna-sosta" : "telefono-2-breve-nessuna-sosta",
    pagina.locator(".dm-gn-dett > div").nth(1),
  );
});

test("senza un'auto elettrica: nessun riquadro, e nessun invito al Config", async ({
  page,
}, testInfo) => {
  const pagina = await apri(page, testInfo, { auto: false });
  await pagina.locator(".dm-gn-viaggio", { hasText: "Casa – Milano" }).click();
  await expect(pagina.locator(".dm-gn-ora")).toHaveText("9:00");
  /* Anche a chi amministra: le sezioni non rimandano al Config. */
  await expect(pagina.locator("[data-gn-invito], [data-gn-collega]")).toHaveCount(0);
  await expect(pagina).not.toContainText("Collega l'auto");
  await expect(pagina.locator(".dm-gn-auto")).toHaveCount(0);
  await expect(pagina.locator("[data-gn-soste]")).toHaveCount(0);
  /* Senza auto la casa non riceve niente dell'auto. */
  expect(await page.evaluate(() => window.__STRADE__.every((m) => !m.auto))).toBe(true);
  const larga = (page.viewportSize()?.width || 0) > 900;
  await foto(
    page,
    larga ? "desktop-3-senza-auto" : "telefono-3-senza-auto",
    pagina.locator(".dm-gn-dett > div").nth(1),
  );
  await expect.poll(() => page.evaluate(() => window.__APERTA__ || "")).not.toContain("config");
});
