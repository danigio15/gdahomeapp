/* Il report del riscaldamento e del raffrescamento, nella pagina Clima.
 *
 * «Report giornaliero/mensile sulle varie stanze di quanto sono state
 * accese, con che media di apertura valvola, quanto e' stata accesa la
 * caldaia ecc.» Quattro stanze con la loro storia finta — una con la valvola
 * come entita' a parte, due con la valvola fra gli attributi — una caldaia
 * configurata, e una casa senza caldaia dove il tempo dell'impianto e' una
 * stima. Con DM_FOTO le fotografie: telefono e computer, chiaro e scuro.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

test.use({ deviceScaleFactor: 2 });

const STANZE = [
  { id: "room-sala", name: "Sala", icon: "🛋️", metadata: {} },
  { id: "room-cucina", name: "Cucina", icon: "🍳", metadata: {} },
  { id: "room-camera", name: "Camera", icon: "🛏️", metadata: {} },
  { id: "room-bagno", name: "Bagno", icon: "🛁", metadata: {} },
  { id: "room-studio", name: "Studio", icon: "💻", metadata: {} },
];

const seme = () => ({
  schema_version: 4,
  sections: {
    rooms: STANZE,
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      {
        id: "c1",
        name: "Termosifone Sala",
        entity: "climate.sala",
        room: "room-sala",
        type: "termo",
      },
      {
        id: "c2",
        name: "Termosifone Cucina",
        entity: "climate.cucina",
        room: "room-cucina",
        type: "termo",
      },
      {
        id: "c3",
        name: "Termosifone Camera",
        entity: "climate.camera",
        room: "room-camera",
        type: "termo",
        valvola: "sensor.valvola_camera",
      },
      {
        id: "c4",
        name: "Termosifone Bagno",
        entity: "climate.bagno",
        room: "room-bagno",
        type: "termo",
      },
      {
        id: "c5",
        name: "Pompa Studio",
        entity: "climate.studio",
        room: "room-studio",
        type: "pompa",
      },
      {
        id: "c6",
        name: "Split Sala",
        entity: "climate.split_sala",
        room: "room-sala",
        type: "clima",
      },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { clima: true },
});

async function avvia(page, testInfo, { caldaia = true, tema = "light" } = {}) {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme());
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ caldaia, tema }) => {
      document.documentElement.setAttribute("data-theme", tema);
      if (caldaia)
        window.localStorage.setItem(
          "cd_caldaia",
          JSON.stringify({ name: "Caldaia", stato: "switch.caldaia" }),
        );
      else window.localStorage.removeItem("cd_caldaia");
      const H = 3_600_000;
      /* Un numero che cambia col giorno ma sempre uguale per lo stesso giorno:
       * la stessa foto torna uguale. */
      const caso = (giorno, sale) => {
        const x = Math.sin(giorno / 86_400_000 + sale * 7.13) * 10_000;
        return x - Math.floor(x);
      };
      const STANZE = {
        "climate.sala": { sale: 1, mattina: [6, 8.5], sera: [17.5, 22.5], valvola: "attr" },
        "climate.cucina": { sale: 2, mattina: [6.5, 8], sera: [18, 21], valvola: null },
        "climate.camera": { sale: 3, mattina: [6, 7], sera: [21, 23], valvola: "entita" },
        "climate.bagno": { sale: 4, mattina: [6, 7.5], sera: [19.5, 21], valvola: "attr" },
        "climate.studio": { sale: 5, mattina: [8.5, 12], sera: [14, 17.5], valvola: null },
      };
      /* Le finestre di richiesta di un giorno, per stanza. */
      const finestre = (entity, giorno) => {
        const s = STANZE[entity];
        if (!s) return [];
        const r = caso(giorno, s.sale);
        /* Il bagno qualche giorno resta spento. */
        if (entity === "climate.bagno" && r < 0.25) return [];
        const allunga = (r - 0.5) * 1.2;
        return [
          [giorno + s.mattina[0] * H, giorno + (s.mattina[1] + allunga * 0.5) * H],
          [giorno + s.sera[0] * H, giorno + (s.sera[1] + allunga) * H],
        ];
      };
      const giorniFra = (da, a) => {
        const giorni = [];
        const d = new Date(da);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - 1);
        while (d.getTime() <= a) {
          giorni.push(d.getTime());
          d.setDate(d.getDate() + 1);
        }
        return giorni;
      };
      const righeDelClima = (entity, da, a) => {
        const s = STANZE[entity];
        const righe = [];
        for (const giorno of giorniFra(da, a)) {
          const spento = entity === "climate.bagno" && caso(giorno, s.sale) < 0.25;
          const base = 18 + caso(giorno, s.sale + 9) * 1.2;
          const voluto = entity === "climate.bagno" ? 22 : entity === "climate.camera" ? 19.5 : 21;
          const attr = (azione, corrente, obiettivo, valvola) => ({
            hvac_action: azione,
            current_temperature: Math.round(corrente * 10) / 10,
            temperature: obiettivo,
            ...(s.valvola === "attr" ? { valve_position: valvola } : {}),
          });
          righe.push({
            t: giorno,
            s: spento ? "off" : "heat",
            a: attr(spento ? "off" : "idle", base, 17, 0),
          });
          for (const [inizio, fine] of finestre(entity, giorno)) {
            const valvola = 45 + Math.round(caso(inizio, s.sale) * 45);
            /* La fascia di comfort: scalda, arriva, si ferma, riparte un poco
             * e alla fine torna alla temperatura ridotta. */
            const al = (quota) => inizio + (fine - inizio) * quota;
            righe.push({ t: inizio, s: "heat", a: attr("heating", base, voluto, valvola) });
            righe.push({ t: al(0.25), s: "heat", a: attr("idle", voluto, voluto, 0) });
            righe.push({
              t: al(0.6),
              s: "heat",
              a: attr("heating", voluto - 0.3, voluto, Math.round(valvola * 0.6)),
            });
            righe.push({ t: al(0.8), s: "heat", a: attr("idle", voluto + 0.1, voluto, 0) });
            righe.push({ t: fine, s: "heat", a: attr("idle", voluto - 0.2, 17, 0) });
          }
          if (entity === "climate.studio") {
            /* La pompa di calore d'estate raffresca: nel finto, il pomeriggio. */
            righe.splice(righe.findIndex((r) => r.t === giorno));
            righe.push({
              t: giorno,
              s: "cool",
              a: { hvac_action: "idle", current_temperature: 25.5, temperature: 24 },
            });
            for (const [inizio, fine] of finestre(entity, giorno)) {
              righe.push({
                t: inizio,
                s: "cool",
                a: { hvac_action: "cooling", current_temperature: 26.4, temperature: 24 },
              });
              righe.push({
                t: fine,
                s: "cool",
                a: { hvac_action: "idle", current_temperature: 24.2, temperature: 24 },
              });
            }
          }
        }
        return righe;
      };
      const righeDelloSplit = (da, a) => {
        const righe = [];
        for (const giorno of giorniFra(da, a)) {
          const r = caso(giorno, 11);
          righe.push({ t: giorno, s: "off", a: { current_temperature: 26 } });
          if (r < 0.3) continue;
          righe.push({
            t: giorno + 13 * H,
            s: "cool",
            a: { hvac_action: "cooling", current_temperature: 27.2, temperature: 24.5 },
          });
          righe.push({
            t: giorno + (15 + r * 2) * H,
            s: "cool",
            a: { hvac_action: "idle", current_temperature: 24.6, temperature: 24.5 },
          });
          righe.push({ t: giorno + (18 + r) * H, s: "off", a: { current_temperature: 25.4 } });
        }
        return righe;
      };
      const righeDellaValvola = (da, a) => {
        const righe = [];
        for (const giorno of giorniFra(da, a)) {
          righe.push({ t: giorno, s: "0", a: { unit_of_measurement: "%" } });
          for (const [inizio, fine] of finestre("climate.camera", giorno)) {
            righe.push({
              t: inizio,
              s: String(60 + Math.round(caso(inizio, 3) * 30)),
              a: { unit_of_measurement: "%" },
            });
            righe.push({ t: fine, s: "0", a: { unit_of_measurement: "%" } });
          }
        }
        return righe;
      };
      /* La caldaia: accesa quando chiede almeno una stanza, qualche minuto prima
       * e dopo, piu' un giro breve di notte per l'antigelo. */
      const righeDellaCaldaia = (da, a) => {
        const righe = [];
        for (const giorno of giorniFra(da, a)) {
          const pezzi = Object.keys(STANZE)
            .filter((e) => e !== "climate.studio")
            .flatMap((e) => finestre(e, giorno))
            .sort((x, y) => x[0] - y[0]);
          const uniti = [];
          for (const [i, f] of pezzi) {
            const ultimo = uniti.at(-1);
            if (ultimo && i <= ultimo[1] + 10 * 60_000) ultimo[1] = Math.max(ultimo[1], f);
            else uniti.push([i - 5 * 60_000, f]);
          }
          uniti.unshift([giorno + 3 * H, giorno + 3.25 * H]);
          righe.push({ t: giorno, s: "off", a: {} });
          for (const [i, f] of uniti) {
            righe.push({ t: i, s: "on", a: {} });
            righe.push({ t: f, s: "off", a: {} });
          }
        }
        return righe;
      };
      const storia = (entity, da, a) => {
        if (entity === "switch.caldaia") return righeDellaCaldaia(da, a);
        if (entity === "sensor.valvola_camera") return righeDellaValvola(da, a);
        if (entity === "climate.split_sala") return righeDelloSplit(da, a);
        if (STANZE[entity]) return righeDelClima(entity, da, a);
        return [];
      };
      /* Come risponde Home Assistant: compresse, in secondi, con lo stato
       * d'inizio al bordo del periodo. */
      const comprimi = (righe, da, a) => {
        const dentro = righe.filter((r) => r.t > da && r.t <= a);
        const prima = righe.filter((r) => r.t <= da).at(-1);
        const tutte = prima ? [{ ...prima, t: da }, ...dentro] : dentro;
        return tutte.map((r) => ({ s: r.s, a: r.a, lu: r.t / 1000 }));
      };
      window.__DOMANDE_DEL_REPORT__ = [];
      const broker = window.DashboardModernEnergyService.broker;
      const prima = broker.request.bind(broker);
      broker.request = async (domanda, ...resto) => {
        if (domanda?.type === "history/history_during_period" && domanda.no_attributes === false) {
          window.__DOMANDE_DEL_REPORT__.push(domanda);
          const da = Date.parse(domanda.start_time);
          const a = Date.parse(domanda.end_time);
          return Object.fromEntries(
            domanda.entity_ids.map((id) => [id, comprimi(storia(id, da, a), da, a)]),
          );
        }
        return prima(domanda, ...resto);
      };
      const grezzi = window.eval("_RAW_STATES");
      const clima = (id, stato, nome, extra = {}) => ({
        entity_id: id,
        state: stato,
        attributes: {
          friendly_name: nome,
          hvac_modes: ["off", "heat"],
          hvac_action: "idle",
          current_temperature: 20.4,
          temperature: 21,
          min_temp: 5,
          max_temp: 30,
          ...extra,
        },
      });
      Object.assign(grezzi, {
        "climate.sala": clima("climate.sala", "heat", "Sala", { valve_position: 0 }),
        "climate.cucina": clima("climate.cucina", "heat", "Cucina"),
        "climate.camera": clima("climate.camera", "heat", "Camera"),
        "climate.bagno": clima("climate.bagno", "off", "Bagno"),
        "climate.studio": clima("climate.studio", "cool", "Studio", {
          hvac_modes: ["off", "heat", "cool"],
        }),
        "climate.split_sala": clima("climate.split_sala", "off", "Split", {
          hvac_modes: ["off", "cool"],
        }),
        "sensor.valvola_camera": {
          entity_id: "sensor.valvola_camera",
          state: "0",
          attributes: { unit_of_measurement: "%" },
        },
      });
      /* Senza caldaia non c'e' nemmeno la sua entita': lo Stato termico la
       * riconoscerebbe dal nome anche senza configurazione. */
      if (caldaia)
        grezzi["switch.caldaia"] = {
          entity_id: "switch.caldaia",
          state: "off",
          attributes: { friendly_name: "Caldaia" },
        };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { caldaia, tema },
  );
  await page
    .locator('.tab[data-tab="clima"]')
    .first()
    .evaluate((b) => b.click());
  const tasto = page.locator("#page-clima [data-dm-rcl-apri]");
  await expect(tasto).toBeVisible({ timeout: 15_000 });
  return tasto;
}

const foglio = (page) => page.locator("#dm-rcl .dm-rcl-foglio");

async function attendiIlReport(page) {
  await expect(page.locator("#dm-rcl .dm-rcl-tessere")).toBeVisible({ timeout: 15_000 });
}

async function scegli(page, { impianto = "", vista = "", indietro = 0 } = {}) {
  if (impianto) await page.locator(`#dm-rcl [data-dm-rcl-impianto="${impianto}"]`).click();
  if (vista) await page.locator(`#dm-rcl [data-dm-rcl-vista="${vista}"]`).click();
  for (let i = 0; i < indietro; i += 1) {
    const prima = await page.locator("#dm-rcl [data-dm-rcl-quando]").textContent();
    await page.locator('#dm-rcl [data-dm-rcl-sposta="-1"]').click();
    await expect(page.locator("#dm-rcl [data-dm-rcl-quando]")).not.toHaveText(prima);
  }
  await attendiIlReport(page);
}

/* La foto del foglio intero: sul telefono il foglio e' alto quanto lo
 * schermo e scorre, e la foto lo vuole tutto. */
async function foto(page, nome) {
  if (!process.env.DM_FOTO) return;
  await page.waitForTimeout(250);
  await page.addStyleTag({
    content:
      "#dm-rcl{position:absolute!important;inset:0 auto auto 0!important;width:100%!important;min-height:100vh}#dm-rcl .dm-rcl-foglio{max-height:none!important;height:auto!important;overflow:visible!important}",
  });
  await foglio(page).screenshot({ path: `${process.env.DM_FOTO}/${nome}.png` });
  await page.evaluate(() =>
    document
      .querySelectorAll("style")
      .forEach((s) => s.textContent.startsWith("#dm-rcl{position:absolute") && s.remove()),
  );
}

const TELEFONO = { width: 390, height: 844 };
const COMPUTER = { width: 1280, height: 900 };

for (const [schermo, misura] of [
  ["telefono", TELEFONO],
  ["computer", COMPUTER],
]) {
  for (const tema of ["light", "dark"]) {
    const luce = tema === "light" ? "chiaro" : "scuro";
    test(`il report del riscaldamento: mese e giorno con la caldaia (${schermo}, ${luce})`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(misura);
      const tasto = await avvia(page, testInfo, { tema });
      if (schermo === "telefono" && tema === "light" && process.env.DM_FOTO) {
        await page.locator("#page-clima .dm-cl-mast").screenshot({
          path: `${process.env.DM_FOTO}/00-clima-col-tasto-report-${schermo}.png`,
        });
      }
      await page.locator("#clima-page-mode-caldo").evaluate((b) => b.click());
      await tasto.click();
      await attendiIlReport(page);
      await expect(page.locator("#dm-rcl")).toHaveAttribute("data-dm-rcl-zona", "caldo");

      /* Il mese scorso, intero: i quattro termosifoni. La pompa di calore ha
       * solo raffrescato, e nel Riscaldamento non c'e'. */
      await scegli(page, { vista: "mese", indietro: 1 });
      const stanze = page.locator("#dm-rcl .dm-rcl-stanza");
      await expect(stanze).toHaveCount(4);
      await expect(page.locator('#dm-rcl [data-dm-rcl-stanza="climate.studio"]')).toHaveCount(0);
      await expect(page.locator("#dm-rcl .dm-rcl-nota").last()).toContainText(
        "Un'unità non ha mai lavorato",
      );
      /* Sotto la barra il valore della richiesta, e la temperatura confrontata
       * con l'obiettivo nelle stesse ore di comfort. */
      const sala = page.locator('#dm-rcl [data-dm-rcl-stanza="climate.sala"]');
      await expect(sala.locator("[data-dm-rcl-richiesta]")).toHaveText(
        /^\d+ h( \d+ min)? di richiesta$/,
      );
      await expect(sala.locator("[data-dm-rcl-temperatura]")).toContainText(/su 21,0° in comfort/);
      await expect(page.locator('#dm-rcl [data-dm-rcl-tessera="temperatura"]')).toContainText(
        "obiettivo in comfort",
      );
      const generatore = page.locator('#dm-rcl [data-dm-rcl-tessera="generatore"]');
      await expect(generatore).toContainText("Caldaia");
      await expect(generatore).not.toHaveAttribute("data-stima");
      await expect(generatore).toContainText(/\d+ accensioni/);
      /* La Camera ha la valvola come entita', la Sala fra gli attributi. */
      await expect(
        page.locator('#dm-rcl [data-dm-rcl-stanza="climate.camera"] [data-dm-rcl-valvola]'),
      ).toBeVisible();
      await expect(
        page.locator('#dm-rcl [data-dm-rcl-stanza="climate.sala"] [data-dm-rcl-valvola]'),
      ).toBeVisible();
      await expect(
        page.locator('#dm-rcl [data-dm-rcl-stanza="climate.cucina"] [data-dm-rcl-valvola]'),
      ).toHaveCount(0);
      const colonne = await page.locator("#dm-rcl .dm-rcl-col").count();
      expect([28, 29, 30, 31]).toContain(colonne);
      /* La storia si chiede una volta per entita', con gli attributi. */
      const domande = await page.evaluate(() =>
        window.__DOMANDE_DEL_REPORT__.map((d) => d.entity_ids[0]),
      );
      expect(domande).toEqual(
        expect.arrayContaining(["climate.sala", "sensor.valvola_camera", "switch.caldaia"]),
      );
      await foto(page, `01-riscaldamento-mese-caldaia-${schermo}-${luce}`);

      /* Ieri, ora per ora. */
      await page.locator('#dm-rcl [data-dm-rcl-sposta="1"]').click();
      await scegli(page, { vista: "giorno", indietro: 1 });
      await expect(page.locator("#dm-rcl .dm-rcl-col")).toHaveCount(
        await page.evaluate(() => window.__DM_REPORT_CLIMA_ULTIMO__.secchielli.length),
      );
      await foto(page, `02-riscaldamento-giorno-caldaia-${schermo}-${luce}`);

      /* E il raffrescamento: la pompa di calore e lo split, senza caldaia. */
      await scegli(page, { impianto: "freddo", vista: "settimana", indietro: 1 });
      await expect(page.locator("#dm-rcl")).toHaveAttribute("data-dm-rcl-zona", "freddo");
      await expect(page.locator("#dm-rcl .dm-rcl-stanza")).toHaveCount(2);
      await expect(page.locator("#dm-rcl [data-dm-rcl-stima]")).toBeVisible();
      await foto(page, `04-raffrescamento-settimana-stima-${schermo}-${luce}`);

      /* Esc chiude. */
      await page.keyboard.press("Escape");
      await expect(page.locator("#dm-rcl")).toBeHidden();
    });

    test(`senza caldaia il tempo dell'impianto e' una stima (${schermo}, ${luce})`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(misura);
      const tasto = await avvia(page, testInfo, { caldaia: false, tema });
      await page.locator("#clima-page-mode-caldo").evaluate((b) => b.click());
      await tasto.click();
      await attendiIlReport(page);
      await scegli(page, { vista: "mese", indietro: 1 });
      await expect(page.locator('#dm-rcl [data-dm-rcl-tessera="generatore"]')).toHaveAttribute(
        "data-stima",
      );
      await expect(page.locator("#dm-rcl [data-dm-rcl-stima]")).toContainText("stima");
      const domande = await page.evaluate(() =>
        window.__DOMANDE_DEL_REPORT__.map((d) => d.entity_ids[0]),
      );
      expect(domande).not.toContain("switch.caldaia");
      await foto(page, `03-riscaldamento-mese-senza-caldaia-stima-${schermo}-${luce}`);
    });
  }
}
