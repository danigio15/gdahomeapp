/* Le finestre del gruppo «servizi», aperte nella plancia vera.
 *
 * Aria, piante, acquario, animali, agenda, rifiuti, allerte e stampanti
 * aprivano tutte la stessa finestra generica — il verdetto, «Le misure», «Lo
 * stato» — riempita con quello che c'era. Le bozze approvate le hanno
 * ridisegnate una per una: qui si semina una casa come la scrivono le sue
 * integrazioni, si apre la tessera e si guarda che la finestra nuova ci sia,
 * col suo numero in cima, i suoi comandi e senza la finestra generica sotto.
 *
 * Con `DM_FOTO_FINESTRE=<cartella>` ogni prova lascia anche la fotografia
 * della finestra, per confrontarla con la bozza.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    /* Una luce qualunque: tiene in piedi la striscia dei widget in Home, come
     * nelle altre prove delle tessere. */
    lights: [{ entity: "light.salotto", name: "Salotto" }],
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

const stato = (entity_id, state, attributes = {}) => ({
  entity_id,
  state: String(state),
  attributes,
  last_changed: new Date().toISOString(),
});

async function avvia(page, testInfo, { stati = {}, config = {}, dopo = null } = {}) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    async ({ stati: tutti, config: scritte }) => {
      const shared = await import("/src/sections/shared.js");
      for (const [chiave, valore] of Object.entries(scritte))
        shared.writeJsonIfChanged(chiave, valore);
      tutti["light.salotto"] = {
        entity_id: "light.salotto",
        state: "off",
        attributes: { friendly_name: "Salotto" },
      };
      window.__HASS__ = { ...(window.__HASS__ || {}), states: { ...tutti } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, tutti);
      window.__chiamate = [];
      window.dmCallHaService = (dominio, servizio, dati) => {
        window.__chiamate.push({ dominio, servizio, dati });
        return Promise.resolve(true);
      };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati, config },
  );
  if (dopo) await page.evaluate(dopo);
  await page.evaluate(() => window.renderHomeWidgets?.());
}

async function apri(page, chiave) {
  const tessera = page.locator(`#dm-widgets .dm-tile[data-dm-widget="${chiave}"]`).first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await tessera.evaluate((nodo) => nodo.click());
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra.locator(`.dm-f-${chiave}`)).toBeVisible({ timeout: 10_000 });
  /* La finestra generica non c'e' piu': niente verdetto, niente caselle. */
  await expect(finestra.locator(".dm-w-verdetto")).toHaveCount(0);
  await expect(finestra.locator(".dm-w-caselle")).toHaveCount(0);
  return finestra;
}

/* La fotografia della finestra intera, sul telefono: la si allunga quanto
 * serve, perche' la bozza si confronta tutta e non solo il primo schermo. */
async function fotografa(page, testInfo, chiave) {
  const cartella = process.env.DM_FOTO_FINESTRE;
  if (!cartella || testInfo.project.name !== "mobile") return;
  const scheda = page.locator("#dm-widget-popup .dm-widget-detail");
  const alta = await scheda.evaluate((nodo) => {
    const corpo = nodo.querySelector(".dm-w-body");
    return nodo.scrollHeight + (corpo ? corpo.scrollHeight - corpo.clientHeight : 0);
  });
  await page.setViewportSize({ width: 390, height: Math.min(4000, Math.max(844, alta + 140)) });
  await page.waitForTimeout(500);
  await scheda.evaluate((nodo) => {
    nodo.scrollTop = 0;
    const corpo = nodo.querySelector(".dm-w-body");
    if (corpo) corpo.scrollTop = 0;
    document.activeElement?.blur?.();
    /* Per la fotografia la finestra si allunga quanto il suo contenuto. */
    for (const pezzo of [nodo, corpo, nodo.parentElement]) {
      if (!pezzo) continue;
      pezzo.style.maxHeight = "none";
      pezzo.style.height = "auto";
      pezzo.style.overflow = "visible";
    }
  });
  await page.waitForTimeout(200);
  await scheda.screenshot({ path: `${cartella}/fatta-${chiave}.png` });
}

/* La larghezza non scappa: niente scorrimento di traverso nel corpo. */
async function nienteDiTraverso(finestra) {
  const corpo = finestra.locator(".dm-w-body");
  const [largo, visibile] = await corpo.evaluate((nodo) => [nodo.scrollWidth, nodo.clientWidth]);
  expect(largo).toBeLessThanOrEqual(visibile + 1);
}

test("aria: il numero che conta con la sua scala, e le misure stanza per stanza", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, {
    stati: {
      "sensor.salotto_co2": stato("sensor.salotto_co2", 1150, {
        friendly_name: "Salotto CO2",
        device_class: "carbon_dioxide",
        unit_of_measurement: "ppm",
      }),
      "sensor.salotto_pm25": stato("sensor.salotto_pm25", 9, {
        friendly_name: "Salotto PM2.5",
        device_class: "pm25",
        unit_of_measurement: "µg/m³",
      }),
      "sensor.cucina_voc": stato("sensor.cucina_voc", 310, {
        friendly_name: "Cucina VOC",
        device_class: "volatile_organic_compounds",
        unit_of_measurement: "µg/m³",
      }),
    },
  });
  const finestra = await apri(page, "aria");
  await expect(finestra.locator(".dm-f-aria-eroe")).toContainText(/Da cambiare/);
  await expect(finestra.locator(".dm-f-aria-scala")).toHaveCount(1);
  await expect(finestra.locator(".dm-f-aria-consiglio")).toContainText("Apri una finestra");
  await expect(finestra).toContainText("Polveri fini PM2.5");
  await expect(finestra).toContainText("Composti volatili");
  await nienteDiTraverso(finestra);
  await fotografa(page, testInfo, "aria");
});

test("stampanti: una scheda per stampante con le cartucce disegnate", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, {
    stati: {
      "sensor.laser_ufficio": stato("sensor.laser_ufficio", "idle", {
        friendly_name: "Laser ufficio",
      }),
      "sensor.laser_ufficio_toner_nero": stato("sensor.laser_ufficio_toner_nero", 8, {
        friendly_name: "Toner nero",
        unit_of_measurement: "%",
      }),
      "sensor.inkjet_soggiorno": stato("sensor.inkjet_soggiorno", "printing", {
        friendly_name: "Inkjet soggiorno",
      }),
      "sensor.inkjet_soggiorno_black_ink": stato("sensor.inkjet_soggiorno_black_ink", 54, {
        friendly_name: "Black ink",
        unit_of_measurement: "%",
      }),
      "sensor.inkjet_soggiorno_cyan_ink": stato("sensor.inkjet_soggiorno_cyan_ink", 71, {
        friendly_name: "Cyan ink",
        unit_of_measurement: "%",
      }),
      "sensor.inkjet_soggiorno_magenta_ink": stato("sensor.inkjet_soggiorno_magenta_ink", 33, {
        friendly_name: "Magenta ink",
        unit_of_measurement: "%",
      }),
      "sensor.inkjet_soggiorno_yellow_ink": stato("sensor.inkjet_soggiorno_yellow_ink", 62, {
        friendly_name: "Yellow ink",
        unit_of_measurement: "%",
      }),
    },
    config: {
      cd_stampanti: [
        { id: "s1", nome: "Laser ufficio", entity: "sensor.laser_ufficio" },
        { id: "s2", nome: "Inkjet soggiorno", entity: "sensor.inkjet_soggiorno" },
      ],
    },
  });
  const finestra = await apri(page, "stampanti");
  await expect(finestra.locator(".dm-f-stampanti-st")).toHaveCount(2);
  /* Chi ha qualcosa da dire sta in cima, col suo consiglio. */
  await expect(finestra.locator(".dm-f-stampanti-st").first()).toContainText("Laser ufficio");
  await expect(finestra.locator(".dm-f-stampanti-consiglio")).toContainText("ricambio");
  await expect(finestra.locator(".dm-f-stampanti-tubo")).toHaveCount(5);
  await expect(page.locator("#dm-widget-popup [data-dm-detail-caption]")).toHaveText(
    "2 stampanti · 1 da ricaricare",
  );
  await nienteDiTraverso(finestra);
  await fotografa(page, testInfo, "stampanti");
});

test("allerte: l'avviso vero in cima col suo testo, le altre fonti sotto", async ({
  page,
}, testInfo) => {
  const adesso = Date.now();
  await avvia(page, testInfo, {
    stati: {
      "sensor.protezione_civile": stato("sensor.protezione_civile", "Allerta gialla", {
        friendly_name: "Allerta Protezione Civile",
        severity: "Moderate",
        description:
          "Dalle 12:00 di oggi e per le successive 18 ore: piogge diffuse, anche a carattere di rovescio o temporale.",
        zone: ["Bacini Costieri"],
        onset: new Date(adesso - 3600000).toISOString(),
        expires: new Date(adesso + 18 * 3600000).toISOString(),
      }),
      "sensor.fulmini": stato("sensor.fulmini", 4, { friendly_name: "Fulmini", distance: 38 }),
      "geo_location.terremoto": stato("geo_location.terremoto", 84, {
        friendly_name: "Terremoto",
        unit_of_measurement: "km",
        magnitude: 3.2,
        title: "Norcia (PG)",
      }),
      "sensor.pollini": stato("sensor.pollini", "moderate", { friendly_name: "Pollini" }),
    },
    config: {
      cd_allerte: {
        meteo: { entity: "sensor.protezione_civile", nome: "Protezione civile" },
        fulmini: { entity: "sensor.fulmini" },
        terremoti: { entity: "geo_location.terremoto" },
        pollini: { entity: "sensor.pollini" },
      },
    },
  });
  const finestra = await apri(page, "allerte");
  const avviso = finestra.locator(".dm-f-allerte-avviso");
  await expect(avviso).toHaveCount(1);
  await expect(avviso).toContainText("Allerta gialla");
  await expect(avviso).toContainText("piogge diffuse");
  await expect(avviso.locator(".dm-f-allerte-quando span")).toHaveCount(2);
  await expect(finestra).toContainText("84 km");
  await nienteDiTraverso(finestra);
  await fotografa(page, testInfo, "allerte");
});

test("rifiuti: il bidone di domani in grande e la settimana colorata", async ({
  page,
}, testInfo) => {
  const ritiro = (entity, giorni, nome) =>
    stato(entity, giorni, { friendly_name: nome, daysTo: giorni });
  await avvia(page, testInfo, {
    stati: {
      "sensor.ritiro_plastica": ritiro("sensor.ritiro_plastica", 1, "Plastica"),
      "sensor.ritiro_organico": ritiro("sensor.ritiro_organico", 2, "Organico"),
      "sensor.ritiro_carta": ritiro("sensor.ritiro_carta", 3, "Carta"),
      "sensor.ritiro_secco": ritiro("sensor.ritiro_secco", 5, "Secco"),
      "sensor.ritiro_vetro": ritiro("sensor.ritiro_vetro", 6, "Vetro"),
    },
    config: {
      cd_rifiuti: {
        righe: [
          { entity: "sensor.ritiro_plastica", materiale: "plastica" },
          { entity: "sensor.ritiro_organico", materiale: "organico" },
          { entity: "sensor.ritiro_carta", materiale: "carta" },
          { entity: "sensor.ritiro_secco", materiale: "indifferenziato" },
          { entity: "sensor.ritiro_vetro", materiale: "vetro" },
        ],
      },
    },
  });
  const finestra = await apri(page, "rifiuti");
  await expect(finestra.locator(".dm-f-rifiuti-eroe")).toContainText(/Stasera fuori/);
  await expect(finestra.locator(".dm-f-rifiuti-bidone svg")).toHaveCount(1);
  await expect(finestra.locator(".dm-f-rifiuti-giorno")).toHaveCount(7);
  await expect(finestra.locator(".dm-f-rifiuti-riga")).toHaveCount(5);
  await nienteDiTraverso(finestra);
  await fotografa(page, testInfo, "rifiuti");
});

test("agenda: il prossimo impegno, la settimana e la spesa coi suoi gesti", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, {
    stati: {
      "todo.spesa": stato("todo.spesa", 3, { friendly_name: "Spesa" }),
      "calendar.casa": stato("calendar.casa", "off", { friendly_name: "Casa" }),
    },
    config: {
      cd_todo: [{ id: "l1", name: "Spesa", entity: "todo.spesa" }],
      cd_calendari: [{ entity: "calendar.casa", name: "Casa" }],
    },
    dopo: () => {
      const modulo = window.__DASHBOARDMODERN_HOME_WIDGETS__;
      const ora = Date.now();
      const giorno = (n, h, m = 0) => {
        const d = new Date();
        d.setDate(d.getDate() + n);
        d.setHours(h, m, 0, 0);
        return d.getTime();
      };
      const inizio = ora + 2 * 3600000 + 10 * 60000;
      modulo.calendari.set("calendar.casa", {
        fetchedAt: ora,
        inflight: null,
        eventi: [
          {
            summary: "Dentista",
            location: "Studio Bianchi",
            inizio,
            fine: inizio + 45 * 60000,
            tuttoIlGiorno: false,
          },
          {
            summary: "Riunione condominio",
            inizio: giorno(1, 18, 30),
            fine: giorno(1, 19, 30),
            tuttoIlGiorno: false,
          },
          {
            summary: "Compleanno nonna",
            inizio: giorno(2, 0),
            fine: giorno(3, 0),
            tuttoIlGiorno: true,
          },
        ],
      });
      modulo.lists.set("todo.spesa", {
        fetchedAt: ora,
        inflight: null,
        items: [
          { uid: "1", summary: "Pane", status: "needs_action", due: "" },
          { uid: "2", summary: "Latte", status: "needs_action", due: "" },
          { uid: "3", summary: "Detersivo piatti", status: "needs_action", due: "" },
        ],
      });
    },
  });
  const finestra = await apri(page, "agenda");
  await expect(finestra.locator(".dm-f-agenda-eroe")).toContainText("Dentista");
  await expect(finestra.locator(".dm-f-agenda-eroe")).toContainText(/fra 2 ore/);
  await expect(finestra.locator(".dm-f-sv-settimana .dm-f-sv-giorno")).toHaveCount(7);
  await expect(finestra.locator(".dm-todo-item")).toHaveCount(3);
  /* La spunta e la riga nuova sono quelle di sempre: chiamano la lista. */
  await finestra.locator('.dm-todo-check[data-dm-todo-uid="1"]').evaluate((nodo) => nodo.click());
  await finestra.locator('[data-dm-todo-new="l1"]').fill("Caffè");
  await finestra.locator('[data-dm-todo-add="l1"]').evaluate((nodo) => nodo.click());
  const chiamate = await page.evaluate(() => window.__chiamate);
  expect(chiamate.map((c) => c.servizio)).toEqual(
    expect.arrayContaining(["update_item", "add_item"]),
  );
  await expect(page.locator("#dm-widget-popup [data-dm-detail-caption]")).toContainText(
    "1 impegno oggi",
  );
  await nienteDiTraverso(finestra);
  await fotografa(page, testInfo, "agenda");
});

test("animali: chi ha bisogno in cima, coi tasti che la scheda conosce", async ({
  page,
}, testInfo) => {
  const fa = (minuti) => new Date(Date.now() - minuti * 60000).toISOString();
  await avvia(page, testInfo, {
    stati: {
      "sensor.micio_cibo": stato("sensor.micio_cibo", 14, { unit_of_measurement: "%" }),
      "sensor.micio_acqua": stato("sensor.micio_acqua", 62, { unit_of_measurement: "%" }),
      "sensor.micio_sabbia": stato("sensor.micio_sabbia", 48, { unit_of_measurement: "%" }),
      "sensor.micio_ultimo_pasto": stato("sensor.micio_ultimo_pasto", fa(180), {
        device_class: "timestamp",
      }),
      "sensor.micio_visite": stato("sensor.micio_visite", 5, {}),
      "button.micio_eroga": stato("button.micio_eroga", "unknown", { friendly_name: "Eroga" }),
      "button.micio_pulisci": stato("button.micio_pulisci", "unknown", {
        friendly_name: "Pulisci",
      }),
      "sensor.fido_collare": stato("sensor.fido_collare", 64, {
        unit_of_measurement: "%",
        device_class: "battery",
      }),
      "sensor.fido_peso": stato("sensor.fido_peso", 18.4, {
        unit_of_measurement: "kg",
        device_class: "weight",
      }),
    },
    config: {
      cd_animali: [
        {
          id: "micio",
          nome: "Micio",
          specie: "gatto",
          cibo_livello: "sensor.micio_cibo",
          acqua_livello: "sensor.micio_acqua",
          lettiera_sabbia: "sensor.micio_sabbia",
          cibo_ultima: "sensor.micio_ultimo_pasto",
          lettiera_visite: "sensor.micio_visite",
          cibo_eroga: "button.micio_eroga",
          lettiera_pulisci: "button.micio_pulisci",
        },
        {
          id: "fido",
          nome: "Fido",
          specie: "cane",
          collare_batteria: "sensor.fido_collare",
          peso: "sensor.fido_peso",
        },
      ],
    },
  });
  const finestra = await apri(page, "animali");
  const schede = finestra.locator(".dm-f-animali-bestia");
  await expect(schede).toHaveCount(2);
  await expect(schede.first()).toContainText("Micio");
  await expect(schede.first().locator(".dm-f-animali-avv")).toContainText("Crocchette");
  await expect(schede.nth(1)).toContainText("Tutto a posto");
  const porzione = schede.first().locator(".dm-f-animali-forte");
  await expect(porzione).toContainText("Una porzione");
  await porzione.evaluate((nodo) => nodo.click());
  expect(await page.evaluate(() => window.__chiamate)).toContainEqual({
    dominio: "button",
    servizio: "press",
    dati: { entity_id: "button.micio_eroga" },
  });
  await nienteDiTraverso(finestra);
  await fotografa(page, testInfo, "animali");
});

test("acquario: la temperatura con la forcella, i valori e i comandi", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, {
    stati: {
      "sensor.vasca_temperatura": stato("sensor.vasca_temperatura", 25.6, {
        unit_of_measurement: "°C",
        device_class: "temperature",
      }),
      "sensor.vasca_ph": stato("sensor.vasca_ph", 7.1, { device_class: "ph" }),
      "sensor.vasca_tds": stato("sensor.vasca_tds", 214, { unit_of_measurement: "ppm" }),
      "light.vasca": stato("light.vasca", "on", { friendly_name: "Luce" }),
      "switch.vasca_co2": stato("switch.vasca_co2", "off", { friendly_name: "CO₂" }),
    },
    config: {
      cd_animali: [
        {
          id: "vasca",
          nome: "Vasca tropicale",
          specie: "acquario",
          litri: "240",
          righe: [
            { entity: "sensor.vasca_temperatura", name: "Temperatura", genere: "temperatura" },
            { entity: "sensor.vasca_ph", name: "pH", genere: "ph" },
            { entity: "sensor.vasca_tds", name: "Sali disciolti", genere: "misura" },
            { entity: "light.vasca", name: "Luce", genere: "luci" },
            { entity: "switch.vasca_co2", name: "CO₂", genere: "comando" },
          ],
        },
      ],
    },
  });
  const finestra = await apri(page, "acquario");
  await expect(finestra.locator(".dm-f-acquario-eroe")).toContainText("25,6°");
  await expect(finestra.locator(".dm-f-acquario-forc")).toHaveCount(1);
  await expect(finestra.locator(".dm-f-acquario-cas")).toHaveCount(2);
  const tasti = finestra.locator(".dm-f-sv-tasto");
  await expect(tasti).toHaveCount(2);
  await expect(tasti.first()).toHaveAttribute("data-on", "true");
  await tasti.nth(1).evaluate((nodo) => nodo.click());
  expect(await page.evaluate(() => window.__chiamate)).toContainEqual({
    dominio: "switch",
    servizio: "toggle",
    dati: { entity_id: "switch.vasca_co2" },
  });
  await expect(page.locator("#dm-widget-popup [data-dm-detail-caption]")).toHaveText(
    "Vasca tropicale · 240 L",
  );
  await nienteDiTraverso(finestra);
  await fotografa(page, testInfo, "acquario");
});

test("piante: quella da innaffiare in cima, poi tutte dalla più asciutta", async ({
  page,
}, testInfo) => {
  const terra = (entity, valore) =>
    stato(entity, valore, { unit_of_measurement: "%", device_class: "moisture" });
  await avvia(page, testInfo, {
    stati: {
      "sensor.basilico_terra": terra("sensor.basilico_terra", 18),
      "sensor.limone_terra": terra("sensor.limone_terra", 32),
      "sensor.limone_temperatura": stato("sensor.limone_temperatura", 17.4, {
        unit_of_measurement: "°C",
        device_class: "temperature",
      }),
      "sensor.ficus_terra": terra("sensor.ficus_terra", 46),
      "sensor.orchidea_terra": terra("sensor.orchidea_terra", 61),
    },
    config: {
      cd_piante: {
        righe: [
          { entity: "sensor.ficus_terra", name: "Ficus", icon: "plant" },
          {
            entity: "sensor.orchidea_terra",
            name: "Orchidea",
            icon: "plant",
            minimo: 40,
            massimo: 80,
          },
          { entity: "sensor.basilico_terra", name: "Basilico", icon: "plant" },
          {
            entity: "sensor.limone_terra",
            name: "Limone",
            icon: "plant",
            fuori: true,
            temperatura: "sensor.limone_temperatura",
          },
        ],
      },
    },
  });
  const finestra = await apri(page, "piante");
  await expect(finestra.locator(".dm-f-piante-eroe")).toContainText("Basilico");
  const righe = finestra.locator(".dm-f-sv-riga");
  await expect(righe).toHaveCount(4);
  await expect(righe.first()).toContainText("Basilico");
  await expect(righe.last()).toContainText("Orchidea");
  await expect(finestra).toContainText("vuole fra 40 e 80%");
  await expect(page.locator("#dm-widget-popup [data-dm-detail-caption]")).toHaveText(
    "4 piante · 1 ha sete",
  );
  await nienteDiTraverso(finestra);
  await fotografa(page, testInfo, "piante");
});
