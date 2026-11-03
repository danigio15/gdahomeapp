/* Il report del clima per gli split senza valvola e senza presa.
 *
 * «Continua a non funzionare, i dati storici non mi da il valore.» Quattro
 * split — Camera da Letto, Cameretta, Cucina, Salone — e un giugno che la
 * storia di Home Assistant non ha piu': restano le statistiche a lungo
 * termine. Tre case:
 *
 *  - **nessuno**: gli split non pubblicano consumi. Il report dice «non
 *    noto», mai «0 min», e il grafico non e' una fila di barre vuote;
 *  - **potenza**: ogni split ha il suo sensore di potenza sullo stesso
 *    dispositivo, e il report lo trova da solo — ore e kWh per stanza;
 *  - **energia**: lo stesso con un contatore in kWh — ore con consumo e kWh;
 *  - **condiviso**: Camera da Letto e Cameretta sono due zone dello stesso
 *    multisplit, un dispositivo solo con un sensore di potenza solo. Quei
 *    watt sono della macchina, non di una stanza: non si danno a tutte e
 *    due (sarebbero il doppio), e la nota lo dice.
 *
 * E la scheda dell'unita' nel Config, che mostra il sensore trovato.
 * Con DM_FOTO le fotografie: telefono e computer, chiaro e scuro.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

test.use({ deviceScaleFactor: 2 });

const SPLIT = [
  { id: "camera", nome: "Camera da Letto", temp: 26.6, dalle: 14, per: 3 },
  { id: "cameretta", nome: "Cameretta", temp: 26.8, dalle: 21, per: 2 },
  { id: "cucina", nome: "Cucina", temp: 27.1, dalle: 12, per: 1.5 },
  { id: "salone", nome: "Salone", temp: 27.4, dalle: 15, per: 4 },
];

const seme = () => ({
  schema_version: 4,
  sections: {
    rooms: SPLIT.map((s) => ({
      id: `room-${s.id}`,
      name: s.nome,
      icon: "🛏️",
      temp: `sensor.t_${s.id}`,
      metadata: {},
    })),
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: SPLIT.map((s, i) => ({
      id: `c${i + 1}`,
      name: s.nome,
      entity: `climate.split_${s.id}`,
      room: `room-${s.id}`,
      type: "clima",
    })),
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { clima: true },
});

const OGGI = new Date();
/* L'ultimo giugno passato, qualunque sia il giorno in cui la prova gira. */
const GIUGNO = new Date(OGGI.getMonth() > 5 ? OGGI.getFullYear() : OGGI.getFullYear() - 1, 5, 15);

/* `consumi`: «nessuno», «potenza», «energia» o «condiviso». */
async function avvia(page, testInfo, { tema = "light", consumi = "nessuno" } = {}) {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme());
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ tema, consumi, SPLIT }) => {
      document.documentElement.setAttribute("data-theme", tema);
      window.localStorage.removeItem("cd_caldaia");
      const H = 3_600_000;
      /* Il registro dei dispositivi, come lo ricorda la plancia: ogni split
       * col suo sensore sullo stesso dispositivo, e una presa di un altro. */
      const di = { "sensor.lavatrice_potenza": "dev-lavatrice" };
      for (const s of SPLIT) {
        di[`climate.split_${s.id}`] = `dev-${s.id}`;
        di[`sensor.split_${s.id}_temperatura_esterna`] = `dev-${s.id}`;
        if (consumi === "potenza") di[`sensor.split_${s.id}_power`] = `dev-${s.id}`;
        if (consumi === "energia") di[`sensor.split_${s.id}_energy`] = `dev-${s.id}`;
        if (consumi === "condiviso" && !["camera", "cameretta"].includes(s.id))
          di[`sensor.split_${s.id}_power`] = `dev-${s.id}`;
      }
      if (consumi === "condiviso") {
        di["climate.split_camera"] = "dev-multi";
        di["climate.split_cameretta"] = "dev-multi";
        di["sensor.multisplit_power"] = "dev-multi";
      }
      window.localStorage.setItem(
        "dm_dispositivi_di_home_assistant",
        JSON.stringify({ di, nomi: {}, modelli: {} }),
      );
      const caso = (t, sale) => {
        const x = Math.sin(t / 86_400_000 + sale * 7.13) * 10_000;
        return x - Math.floor(x);
      };
      const ilSuo = (id) => SPLIT.find((s) => id.includes(`_${s.id}`));
      /* Quanto di quell'ora lo split ha lavorato: la sua fascia, un po'
       * diversa ogni giorno, e qualche giorno di riposo. */
      const quota = (s, t) => {
        const giorno = new Date(t).setHours(0, 0, 0, 0);
        const r = caso(giorno, SPLIT.indexOf(s) + 1);
        if (r < 0.15) return 0;
        const inizio = giorno + s.dalle * H;
        const fine = inizio + (s.per + (r - 0.5)) * H;
        return Math.max(0, Math.min(fine, t + H) - Math.max(inizio, t)) / H;
      };
      const oraDelleStatistiche = (id, t) => {
        const s = ilSuo(id);
        if (!s) return null;
        if (id.startsWith("sensor.t_")) {
          const v = s.temp + (caso(t, 3) - 0.5) * 0.4;
          return { mean: Math.round(v * 10) / 10, max: v + 0.3, min: v - 0.3 };
        }
        if (id.endsWith("_power")) {
          const q = quota(s, t);
          return { mean: 3 + q * 780, max: q ? 820 : 4, min: 2 };
        }
        if (id.endsWith("_energy")) {
          const q = quota(s, t);
          return { change: Math.round((0.004 + q * 0.78) * 1000) / 1000 };
        }
        return null;
      };
      const broker = window.DashboardModernEnergyService.broker;
      const prima = broker.request.bind(broker);
      broker.request = async (domanda, ...resto) => {
        /* La storia di giugno non c'e' piu'. */
        if (domanda?.type === "history/history_during_period" && domanda.no_attributes === false)
          return Object.fromEntries(domanda.entity_ids.map((id) => [id, []]));
        if (domanda?.type === "ponte/clima/storico")
          return { giorni: {}, primo: null, ultimo: null };
        if (domanda?.type === "recorder/statistics_during_period" && domanda.period === "hour") {
          const da = Date.parse(domanda.start_time);
          const a = Date.parse(domanda.end_time);
          const fuori = {};
          for (const id of domanda.statistic_ids) {
            const ore = [];
            for (let t = new Date(da).setMinutes(0, 0, 0); t < a; t += H) {
              const voce = oraDelleStatistiche(id, t);
              if (voce) ore.push({ start: t, end: t + H, ...voce });
            }
            if (ore.length) fuori[id] = ore;
          }
          return fuori;
        }
        return prima(domanda, ...resto);
      };
      const grezzi = window.eval("_RAW_STATES");
      const sensore = (id, unita, classe, statistica, nome) => ({
        entity_id: id,
        state: "0",
        attributes: {
          unit_of_measurement: unita,
          device_class: classe,
          state_class: statistica,
          friendly_name: nome,
        },
      });
      for (const s of SPLIT) {
        grezzi[`climate.split_${s.id}`] = {
          entity_id: `climate.split_${s.id}`,
          state: "off",
          attributes: {
            friendly_name: s.nome,
            hvac_modes: ["off", "cool", "dry", "fan_only"],
            current_temperature: s.temp,
            temperature: 25,
            min_temp: 16,
            max_temp: 30,
          },
        };
        grezzi[`sensor.t_${s.id}`] = sensore(
          `sensor.t_${s.id}`,
          "°C",
          "temperature",
          "measurement",
          `Temperatura ${s.nome}`,
        );
        grezzi[`sensor.split_${s.id}_temperatura_esterna`] = sensore(
          `sensor.split_${s.id}_temperatura_esterna`,
          "°C",
          "temperature",
          "measurement",
          `${s.nome} esterna`,
        );
        grezzi[`sensor.split_${s.id}_power`] = sensore(
          `sensor.split_${s.id}_power`,
          "W",
          "power",
          "measurement",
          `${s.nome} Power`,
        );
        grezzi[`sensor.split_${s.id}_energy`] = sensore(
          `sensor.split_${s.id}_energy`,
          "kWh",
          "energy",
          "total_increasing",
          `${s.nome} Energy`,
        );
      }
      grezzi["sensor.multisplit_power"] = sensore(
        "sensor.multisplit_power",
        "W",
        "power",
        "measurement",
        "Multisplit Power",
      );
      grezzi["sensor.lavatrice_potenza"] = sensore(
        "sensor.lavatrice_potenza",
        "W",
        "power",
        "measurement",
        "Lavatrice potenza",
      );
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { tema, consumi, SPLIT },
  );
  await page
    .locator('.tab[data-tab="clima"]')
    .first()
    .evaluate((b) => b.click());
  const tasto = page.locator("#page-clima [data-dm-rcl-apri]");
  await expect(tasto).toBeVisible({ timeout: 15_000 });
  return tasto;
}

async function giugno(page, tasto) {
  await tasto.click();
  await expect(page.locator("#dm-rcl .dm-rcl-tessere")).toBeVisible({ timeout: 15_000 });
  await page.evaluate((quando) => {
    window.__DASHBOARDMODERN_REPORT_DEL_CLIMA__.giorno = quando;
  }, GIUGNO.getTime());
  await page.locator('#dm-rcl [data-dm-rcl-vista="mese"]').click();
  await expect(page.locator("#dm-rcl [data-dm-rcl-quando]")).toContainText(/giugno/i);
  await expect(page.locator("#dm-rcl .dm-rcl-tessere")).toBeVisible({ timeout: 15_000 });
}

async function foto(page, nome) {
  if (!process.env.DM_FOTO) return;
  await page.waitForTimeout(250);
  await page.addStyleTag({
    content:
      "#dm-rcl{position:absolute!important;inset:0 auto auto 0!important;width:100%!important;min-height:100vh}#dm-rcl .dm-rcl-foglio{max-height:none!important;height:auto!important;overflow:visible!important}",
  });
  await page
    .locator("#dm-rcl .dm-rcl-foglio")
    .screenshot({ path: `${process.env.DM_FOTO}/${nome}.png` });
  await page.evaluate(() =>
    document
      .querySelectorAll("style")
      .forEach((s) => s.textContent.startsWith("#dm-rcl{position:absolute") && s.remove()),
  );
}

const ultimo = (page) => page.evaluate(() => window.__DM_REPORT_CLIMA_ULTIMO__);

for (const [schermo, misura] of [
  ["telefono", { width: 390, height: 844 }],
  ["computer", { width: 1280, height: 900 }],
]) {
  for (const tema of ["light", "dark"]) {
    const luce = tema === "light" ? "chiaro" : "scuro";

    test(`split senza consumi: «non noto», mai zero (${schermo}, ${luce})`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(misura);
      const tasto = await avvia(page, testInfo, { tema, consumi: "nessuno" });
      await giugno(page, tasto);
      const report = await ultimo(page);
      expect(report.fonti.statistiche).toBe(30);
      expect(report.totali.msGeneratore).toBe(null);
      const generatore = page.locator('#dm-rcl [data-dm-rcl-tessera="generatore"]');
      await expect(generatore).toContainText("—");
      await expect(generatore).toContainText("non noto");
      await expect(generatore).not.toContainText("0 min");
      await expect(page.locator("#dm-rcl [data-dm-rcl-grafico-ignoto]")).toBeVisible();
      await expect(page.locator("#dm-rcl .dm-rcl-col")).toHaveCount(0);
      await expect(page.locator("#dm-rcl .dm-rcl-stanza")).toHaveCount(4);
      await expect(
        page.locator('#dm-rcl [data-dm-rcl-stanza="climate.split_salone"] [data-dm-rcl-richiesta]'),
      ).toHaveText("richiesta non nota");
      await expect(page.locator("#dm-rcl [data-dm-rcl-statistiche]")).toContainText(
        "sensore di consumo del climatizzatore",
      );
      await foto(page, `01-raffrescamento-giugno-senza-consumi-${schermo}-${luce}`);
    });

    for (const consumi of ["potenza", "energia"]) {
      test(`split coi consumi del dispositivo (${consumi}): ore e kWh (${schermo}, ${luce})`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize(misura);
        const tasto = await avvia(page, testInfo, { tema, consumi });
        await giugno(page, tasto);
        const report = await ultimo(page);
        expect(report.totali.msGeneratore).toBeGreaterThan(30 * 3_600_000);
        expect(report.secchielli.every((s) => s.noto)).toBe(true);
        for (const s of report.stanze) {
          expect(s.stimaDa).toEqual(["dispositivo"]);
          expect(s.kwh).toBeGreaterThan(10);
        }
        const salone = page.locator('#dm-rcl [data-dm-rcl-stanza="climate.split_salone"]');
        await expect(salone.locator("[data-dm-rcl-richiesta]")).toContainText(
          "dai consumi del climatizzatore",
        );
        await expect(salone.locator("[data-dm-rcl-kwh]")).toContainText("kWh");
        /* Il sensore di un altro dispositivo non si chiede mai. */
        expect(JSON.stringify(report)).not.toContain("lavatrice");
        await foto(
          page,
          `0${consumi === "potenza" ? 2 : 3}-raffrescamento-giugno-${consumi}-${schermo}-${luce}`,
        );
      });
    }

    test(`due zone dello stesso multisplit: il sensore comune non si divide (${schermo}, ${luce})`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(misura);
      const tasto = await avvia(page, testInfo, { tema, consumi: "condiviso" });
      await giugno(page, tasto);
      const report = await ultimo(page);
      /* Il sensore della macchina non si chiede per le stanze. */
      expect(JSON.stringify(report)).not.toContain("multisplit");
      for (const id of ["climate.split_camera", "climate.split_cameretta"])
        await expect(
          page.locator(`#dm-rcl [data-dm-rcl-stanza="${id}"] [data-dm-rcl-richiesta]`),
        ).toHaveText("richiesta non nota");
      await expect(
        page.locator('#dm-rcl [data-dm-rcl-stanza="climate.split_salone"] [data-dm-rcl-richiesta]'),
      ).toContainText("dai consumi del climatizzatore");
      await expect(page.locator("#dm-rcl")).toContainText(
        "sensor.multisplit_power misura tutta la macchina",
      );
      await foto(page, `05-due-zone-sensore-condiviso-${schermo}-${luce}`);
    });

    test(`la scheda dell'unita' mostra il sensore trovato (${schermo}, ${luce})`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(misura);
      await avvia(page, testInfo, { tema, consumi: "potenza" });
      /* La scheda dell'unita' come la apre una persona: Config, Sezioni, la
       * matita del Salone. */
      await page.evaluate(() => {
        if (!document.getElementById("editor-modal")?.classList.contains("show"))
          apriConfigEntita();
      });
      await expect(page.locator("#editor-modal")).toBeVisible();
      /* Le unita' clima stanno in una delle schede «sez…»: si cerca quella
       * che ha la matita del clima. */
      await page.evaluate(async () => {
        const schede = [...document.querySelectorAll(".ed-tab[data-tab^='sez']")]
          .map((b) => b.dataset.tab)
          .filter((t) => t !== "sezioni");
        for (const scheda of schede) {
          editorSwitch(scheda);
          await new Promise((r) => setTimeout(r, 400));
          document.querySelectorAll("#ed-body details").forEach((d) => (d.open = true));
          await new Promise((r) => setTimeout(r, 400));
          if (document.querySelector('[data-dm-edit-kind="climate"]')) return;
        }
      });
      const matita = page.locator('[data-dm-edit-kind="climate"][data-dm-edit-index="3"]').first();
      await expect(matita).toBeAttached({ timeout: 15_000 });
      await matita.evaluate((b) => b.click());
      const trovato = page.locator("[data-dm-consumo-trovato]");
      await expect(trovato).toBeVisible({ timeout: 15_000 });
      await expect(trovato).toContainText("sensor.split_salone_power");
      await trovato.scrollIntoViewIfNeeded();
      if (process.env.DM_FOTO) {
        const modale = page
          .locator("#dm-climate-editor-modal .ed-modal, #dm-climate-editor-modal")
          .first();
        await modale.screenshot({
          path: `${process.env.DM_FOTO}/04-scheda-unita-sensore-trovato-${schermo}-${luce}.png`,
        });
      }
      await trovato.locator("[data-usa-consumo]").click();
      await expect(page.locator('#dm-climate-editor-modal [name="consumo"]')).toHaveValue(
        "sensor.split_salone_power",
      );
      await expect(trovato).toHaveCount(0);
    });
  }
}
