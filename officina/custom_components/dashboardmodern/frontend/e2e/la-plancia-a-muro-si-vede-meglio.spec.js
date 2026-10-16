/* La plancia a muro: sezioni da vedere, griglie da scegliere, e un config che
 * mostra quello che fa.
 *
 * «Per la plancia wall riusciamo a fare meglio? Come configuratore e come
 * sezioni da gestire e vedere; i dati devono essere in real time e piu'
 * personalizzabili.» Qui: le pagine Ambienti, Telecamere, Energia e
 * Tapparelle sul tablet, la griglia da quattro, l'energia che cambia mentre
 * la si guarda; nel config l'anteprima dal vivo, la bozza che non si perde
 * cambiando scheda, la pagina duplicata e il colore. */
import { expect, test } from "@playwright/test";
import { SEME_A_MURO, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const salvato = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro") || "null"));

const STATI = {
  ...STATI_A_MURO,
  "sensor.casa_w": { state: "850", attributes: { unit_of_measurement: "W" } },
  "sensor.fv_w": { state: "3.2", attributes: { unit_of_measurement: "kW" } },
  "sensor.rete_w": { state: "-1200", attributes: { unit_of_measurement: "W" } },
  "sensor.batteria": { state: "80", attributes: { unit_of_measurement: "%" } },
};

/* I campi entita' diventano la riga «Scegli entità»: la casella vera resta
 * sotto, nascosta, ed e' quella che la ricerca riempie e fa «change». */
async function scriviLEntita(body, via, valore) {
  await body.locator(`[data-mu-ed-campo="${via}"]`).evaluate((campo, v) => {
    campo.value = v;
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  }, valore);
}

const MURO = {
  attiva: true,
  pagine: [
    { id: "p1", modello: "stanza", stanza: "Soggiorno", griglia: 4, colore: "#ec4899" },
    { id: "p2", modello: "ambienti" },
    {
      id: "p3",
      modello: "energia",
      energia: {
        casa: "sensor.casa_w",
        solare: "sensor.fv_w",
        rete: "sensor.rete_w",
        batteria: "sensor.batteria",
      },
    },
    { id: "p4", modello: "telecamere" },
    { id: "p5", modello: "tapparelle" },
  ],
};

test.describe("la plancia a muro si vede meglio", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("le pagine da guardare, la griglia scelta e l'energia dal vivo", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO, stati: STATI });
    await expect(muro(page)).toBeVisible();
    /* Cinque pagine: le linguette tengono il disegno, il nome solo l'aperta. */
    await expect(muro(page).locator(".mu-pagine.mu-molte")).toBeVisible();
    /* La stanza in quattro posti grandi, due per due, col suo colore. */
    const g = muro(page).locator(".mu-g6");
    await expect(g).toHaveAttribute("style", /--mu-col:2;--mu-righe:2/);
    await expect(g.locator(".mu-card")).toHaveCount(4);
    await expect(muro(page).locator(".mu-testa")).toHaveAttribute("style", /#ec4899/);

    await muro(page).locator('[data-mu-pagina="1"]').click();
    const soggiorno = muro(page).locator(".mu-ambiente").filter({ hasText: "Soggiorno" });
    await expect(soggiorno).toContainText("21,2°");
    await expect(soggiorno).toContainText(/1 luce accesa/i);
    await expect(soggiorno).toContainText(/54%/);

    await muro(page).locator('[data-mu-pagina="2"]').click();
    const misura = (k) => muro(page).locator(`[data-mu-misura="${k}"]`);
    await expect(misura("casa")).toContainText("850 W");
    await expect(misura("solare")).toContainText("3,2 kW");
    await expect(misura("rete")).toContainText(/Cede alla rete/i);
    await expect(misura("rete")).toContainText("1,2 kW");
    await expect(misura("batteria")).toContainText("80%");
    /* Il consumo della casa non e' nella configurazione di nessuna sezione:
     * passa lo stesso dal cancello, perche' il tablet lo sta mostrando. */
    await page.evaluate(() =>
      window.DashboardModernEnergyService.broker.ingestState({
        entity_id: "sensor.casa_w",
        state: "1500",
        attributes: { unit_of_measurement: "W" },
      }),
    );
    await expect(misura("casa")).toContainText("1,5 kW", { timeout: 1500 });

    await muro(page).locator('[data-mu-pagina="3"]').click();
    await muro(page).locator(".mu-cam").first().click();
    await expect(muro(page).locator(".mu-finestra .mu-video-fin")).toBeVisible();
    await muro(page).locator('.mu-finestra [data-mu-fa="chiudi"]').click();

    await muro(page).locator('[data-mu-pagina="4"]').click();
    await muro(page).locator('[data-mu-fa="giu"][data-mu-entita="cover.soggiorno"]').click();
    await expect
      .poll(() => page.evaluate(() => window.__SERVIZI__.map((s) => `${s.domain}.${s.service}`)))
      .toEqual(["cover.close_cover"]);
  });

  test("l'energia con le misure in più: si scelgono nel config e la griglia si allarga", async ({
    page,
  }, testInfo) => {
    const stati = {
      ...STATI,
      "sensor.presa_lavatrice_w": {
        state: "1840",
        attributes: { unit_of_measurement: "W", friendly_name: "Presa lavatrice" },
      },
      "sensor.pompa_di_calore_kw": {
        state: "1.35",
        attributes: { unit_of_measurement: "kW", friendly_name: "Pompa di calore" },
      },
      "sensor.energia_oggi": {
        state: "12.4",
        attributes: { unit_of_measurement: "kWh", friendly_name: "Consumo di oggi" },
      },
      "sensor.wallbox_w": {
        state: "7200",
        attributes: { unit_of_measurement: "W", friendly_name: "Auto in carica" },
      },
    };
    const energia = MURO.pagine.find((p) => p.modello === "energia");
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        attiva: true,
        pagine: [
          {
            ...energia,
            energia: {
              ...energia.energia,
              altre: [
                "sensor.presa_lavatrice_w",
                "sensor.pompa_di_calore_kw",
                "sensor.energia_oggi",
              ],
            },
          },
        ],
      },
      stati,
    });
    await expect(muro(page)).toBeVisible();
    const g = muro(page).locator(".mu-g6");
    await expect(g.locator(".mu-energia")).toHaveCount(7);
    /* Sette tessere: la griglia da otto, quattro per due, senza scorrere. */
    await expect(g).toHaveAttribute("style", /--mu-col:4;--mu-righe:2/);
    await expect(muro(page).locator('[data-mu-misura="altra-0"]')).toContainText("1,8 kW");
    await expect(muro(page).locator('[data-mu-misura="altra-0"]')).toContainText("Presa lavatrice");
    await expect(muro(page).locator('[data-mu-misura="altra-1"]')).toContainText("1,4 kW");
    await expect(muro(page).locator('[data-mu-misura="altra-2"]')).toContainText("12 kWh");
    if (process.env.DM_FOTO)
      await page.screenshot({ path: `${process.env.DM_FOTO}/muro-energia-di-piu.png` });

    /* Nel config: le quattro fisse, e sotto le altre, con un posto vuoto per
     * aggiungerne un'altra. */
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    await expect(body.locator('[data-mu-ed-campo="pagine.0.energia.altre.3"]')).toHaveCount(1);
    await scriviLEntita(body, "pagine.0.energia.altre.3", "sensor.wallbox_w");
    await expect(body.locator('[data-mu-ed-campo="pagine.0.energia.altre.4"]')).toHaveCount(1);
    const anteprima = body.locator(".mu-ed-anteprima .mu-anteprima");
    await expect(anteprima.locator(".mu-energia")).toHaveCount(8);
    if (process.env.DM_FOTO) {
      await body.getByText("Altre misure").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${process.env.DM_FOTO}/muro-energia-config.png` });
    }
  });

  test("il config: anteprima dal vivo, griglia, bozza che resta, pagina duplicata", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: { attiva: true, pagine: [{ id: "p1", modello: "stanza", stanza: "Soggiorno" }] },
      stati: STATI,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");

    /* L'anteprima e' la pagina del tablet, coi suoi sei posti. */
    const anteprima = body.locator(".mu-ed-anteprima .mu-anteprima");
    await expect(anteprima.locator(".mu-g6 .mu-card")).toHaveCount(6);
    await expect(anteprima.locator(".mu-tit")).toHaveText(/Soggiorno/i);

    /* Quattro posti: l'anteprima e i posti del config cambiano insieme. */
    await body.locator('[data-mu-ed-metti="pagine.0.griglia"][data-mu-ed-valore="4"]').click();
    await expect(anteprima.locator(".mu-g6 .mu-card")).toHaveCount(4);
    await expect(body.locator(".mu-ed-posti .mu-ed-posto")).toHaveCount(4);
    await expect(body.locator(".mu-ed-sporca")).toBeVisible();

    /* Il nome scritto cambia l'anteprima senza ridisegnare il campo. */
    await body.locator('[data-mu-ed-campo="pagine.0.titolo"]').fill("Salone");
    await expect(anteprima.locator(".mu-tit")).toHaveText(/Salone/i);

    /* Un'altra scheda e ritorno: la bozza c'e' ancora. */
    const altra = page.locator('.ed-tab:not([data-tab="muro"])').first();
    await altra.click();
    await page.locator('.ed-tab[data-tab="muro"]').click();
    await expect(body.locator(".mu-ed-sporca")).toBeVisible();
    await expect(
      body.locator('[data-mu-ed-metti="pagine.0.griglia"][data-mu-ed-valore="4"]'),
    ).toHaveClass(/si/);

    /* Duplicare e colorare. */
    await body.locator('[data-mu-ed-copia="0"]').click();
    await expect(body.locator('[data-mu-ed-pagina="1"]')).toBeVisible();
    await body.locator('[data-mu-ed-metti="pagine.1.colore"][data-mu-ed-valore="#10b981"]').click();
    await expect(anteprima.locator(".mu-testa")).toHaveAttribute("style", /#10b981/);

    await body.locator("[data-dm-save-all]").click();
    await expect(body.locator(".mu-ed-sporca")).toHaveCount(0);
    const m = await salvato(page);
    expect(m.pagine.map((p) => [p.modello, p.griglia, p.titolo, p.colore])).toEqual([
      ["stanza", 4, "Salone", ""],
      ["stanza", 4, "Salone 2", "#10b981"],
    ]);
    expect(m.pagine[0].id).not.toBe(m.pagine[1].id);
  });

  test("il config dell'energia propone le misure della plancia, e si sceglie il meteo", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: { attiva: true, pagine: [] }, stati: STATI });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    for (const modello of ["energia", "ambienti", "telecamere", "tapparelle"])
      await body.locator(`[data-mu-ed-nuova="${modello}"]`).click();
    await body.locator('[data-mu-ed-apri="0"]').click();
    await scriviLEntita(body, "pagine.0.energia.casa", "sensor.casa_w");
    await expect(body.locator(".mu-anteprima [data-mu-misura='casa']")).toContainText("850 W");
    await body.locator("[data-mu-ed-altro]").click();
    await scriviLEntita(body, "meteo", "weather.casa");
    await body.locator('[data-mu-ed-alterna="riposo.torna"]').click();
    await body.locator("[data-dm-save-all]").click();
    const m = await salvato(page);
    expect(m.pagine.map((p) => p.modello)).toEqual([
      "energia",
      "ambienti",
      "telecamere",
      "tapparelle",
    ]);
    expect(m.pagine[0].energia.casa).toBe("sensor.casa_w");
    expect(m.meteo).toBe("weather.casa");
    expect(m.riposo.torna).toBe(false);
  });

  /* «Me ne devi fare una con sezione musica.» */
  test("la pagina Musica: il lettore grande, i tasti, il volume, gli altri lettori", async ({
    page,
  }, testInfo) => {
    const COPERTINA =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f472b6"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="150" cy="150" r="70" fill="#0f172a" opacity=".85"/><circle cx="150" cy="150" r="14" fill="#f472b6"/></svg>',
      );
    const SA_TUTTO = 1 + 4 + 8 + 16 + 32 + 128 + 256 + 2048 + 16384;
    const stati = {
      ...STATI,
      "media_player.sonos_cucina": {
        state: "playing",
        attributes: {
          friendly_name: "Sonos cucina",
          supported_features: SA_TUTTO,
          media_title: "Nuvole bianche",
          media_artist: "Ludovico Einaudi",
          media_album_name: "Una mattina",
          entity_picture: COPERTINA,
          volume_level: 0.35,
          source: "Spotify",
          source_list: ["Spotify", "Radio", "TV"],
          media_duration: 340,
          media_position: 120,
          media_position_updated_at: new Date().toISOString(),
        },
      },
      "media_player.tv_sala": {
        state: "off",
        attributes: { friendly_name: "TV sala", supported_features: 128 + 256 + 4 },
      },
    };
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        attiva: true,
        pagine: [
          {
            id: "m1",
            modello: "musica",
            lettori: ["media_player.sonos_cucina", "media_player.tv_sala"],
          },
        ],
      },
      stati,
    });
    const grande = muro(page).locator(".mu-mp");
    await expect(grande).toContainText("Nuvole bianche");
    await expect(grande).toContainText("Ludovico Einaudi");
    await expect(grande.locator(".mu-mp-pct")).toHaveText("35%");
    await expect(muro(page).locator(".mu-mp-riga")).toHaveCount(2);

    await grande.locator('[data-mu-cmd="successivo"]').click();
    /* La pausa si vede subito, prima che Home Assistant risponda. */
    await grande.locator('[data-mu-cmd="centro"]').click();
    await expect(grande.locator('[data-mu-cmd="centro"]')).toHaveAttribute(
      "aria-label",
      /Riproduci/,
    );
    await grande.locator('[data-mu-cmd="alza"]').click();
    await expect(grande.locator(".mu-mp-pct")).toHaveText("37%");
    await grande.locator('[data-mu-sorgente="Radio"]').click();
    const chiesti = await page.evaluate(() =>
      window.__SERVIZI__.map((s) => `${s.domain}.${s.service}`),
    );
    expect(chiesti).toEqual([
      "media_player.media_next_track",
      "media_player.media_play_pause",
      "media_player.volume_set",
      "media_player.select_source",
    ]);

    /* Un tocco sull'altro lettore lo porta in grande: la TV spenta si accende. */
    await muro(page).locator('.mu-mp-riga[data-mu-entita="media_player.tv_sala"]').click();
    await expect(grande).toContainText("TV sala");
    await expect(grande.locator('[data-mu-cmd="centro"]')).toHaveAttribute("aria-label", /Accendi/);
  });

  /* «Gli altri comandi che ho abilitato nell'altra plancia, e che vedo, di qua
   * non me li fa vedere.» Quelli scelti accanto al lettore nella sezione
   * Musica stanno anche sul pannello, sotto il lettore grande. */
  test("la pagina Musica mostra gli altri comandi del lettore", async ({ page }, testInfo) => {
    const stati = {
      ...STATI,
      "media_player.sonos_cucina": {
        state: "playing",
        attributes: {
          friendly_name: "Sonos cucina",
          supported_features: 1 + 4 + 16 + 32 + 128 + 256 + 2048 + 16384,
          media_title: "Nuvole bianche",
          media_artist: "Ludovico Einaudi",
          volume_level: 0.35,
          source: "Spotify",
          source_list: ["Spotify", "Radio"],
        },
      },
      "switch.sonos_cucina_loudness": {
        state: "on",
        attributes: { friendly_name: "Loudness" },
      },
      "switch.sonos_cucina_night_sound": {
        state: "off",
        attributes: { friendly_name: "Suono notturno" },
      },
    };
    await apriLaCasaAMuro(page, testInfo, {
      muro: { attiva: true, pagine: [{ id: "m1", modello: "musica" }] },
      stati,
      caselle: {
        cd_media_player: [
          {
            entity: "media_player.sonos_cucina",
            nome: "Cucina",
            comandi: ["switch.sonos_cucina_loudness", "switch.sonos_cucina_night_sound"],
          },
        ],
      },
    });
    const comandi = muro(page).locator(".mu-mp-comandi button");
    await expect(comandi).toHaveCount(2);
    await expect(comandi.first()).toContainText("Loudness");
    await expect(comandi.first()).toHaveClass(/si/);
    if (process.env.DM_FOTO) {
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${process.env.DM_FOTO}/muro-musica-comandi.png` });
    }
    await comandi.nth(1).click();
    expect(await page.evaluate(() => window.__SERVIZI__)).toEqual([
      {
        domain: "homeassistant",
        service: "toggle",
        data: { entity_id: "switch.sonos_cucina_night_sound" },
      },
    ]);
  });

  /* «Metterei disattivo. E quando sono piu' di una partizione andrei a capo,
   * centrato, e con le partizioni attive scritte.» */
  test("il riposo: «Disattivo», e con piu' aree una riga con quelle inserite", async ({
    page,
  }, testInfo) => {
    const stati = {
      ...STATI,
      "alarm_control_panel.perimetrale": { state: "armed_away", attributes: {} },
      "alarm_control_panel.notte": { state: "armed_night", attributes: {} },
      "alarm_control_panel.garage": { state: "disarmed", attributes: {} },
    };
    await apriLaCasaAMuro(page, testInfo, {
      muro: { attiva: true, pagine: [{ id: "p1", modello: "stanza", stanza: "Soggiorno" }] },
      stati,
    });
    /* Un'area sola: nella riga, con la parola nuova. */
    await page.evaluate(() => window.dmMuro.riposa());
    await expect(muro(page).locator(".mu-riposo")).toContainText(/Antifurto · Disattivo/);
    await expect(muro(page).locator(".mu-riposo-aree")).toHaveCount(0);

    const area = (nome, id) => ({ nome, caselle: { "dm.security_centrale_allarme": id } });
    await page.evaluate(
      async (aree) => {
        localStorage.setItem("cd_centrali", JSON.stringify(aree));
        await window.dmMuro.rileggi({ forza: true });
        window.dmMuro.riposa();
      },
      [
        area("Perimetrale", "alarm_control_panel.perimetrale"),
        area("Zona notte", "alarm_control_panel.notte"),
        area("Garage", "alarm_control_panel.garage"),
      ],
    );
    const riga = muro(page).locator(".mu-riposo-aree");
    await expect(riga).toBeVisible();
    await expect(riga).toContainText("Perimetrale");
    /* «Non devi scrivere fuori ma metti inserito»: lo stato dice inserito, e
     * come solo quando non e' l'inserimento pieno. */
    await expect(riga).toContainText(/Perimetrale\s*Inserito/);
    await expect(riga).not.toContainText("Fuori");
    await expect(riga).toContainText(/Zona notte\s*Inserito notte/);
    await expect(riga).not.toContainText("Garage");

    /* Tutte disinserite: «Disattivo». */
    await page.evaluate(() => {
      const raw = eval("_RAW_STATES");
      for (const id of ["alarm_control_panel.perimetrale", "alarm_control_panel.notte"])
        raw[id] = { entity_id: id, state: "disarmed", attributes: {} };
      window.dmMuro.riposa();
    });
    await expect(riga).toContainText(/Antifurto\s*·\s*Disattivo/);
  });

  /* «Quando c'e' antifurto inserito non devi scrivere fuori ma metti inserito
   * e al massimo il nome della partizione inserita. Tipo se e' notte scrivi
   * inserito notte.» */
  test("il riposo con l'antifurto inserito: «Inserito notte», «Inserito», mai «Fuori»", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: { attiva: true, pagine: [{ id: "p1", modello: "stanza", stanza: "Soggiorno" }] },
      stati: {
        ...STATI,
        "alarm_control_panel.casa": { state: "armed_night", attributes: {} },
      },
    });
    await page.evaluate(() => window.dmMuro.riposa());
    const riposo = muro(page).locator(".mu-riposo");
    await expect(riposo).toContainText(/Antifurto · Inserito notte/);
    await page.evaluate(() => {
      const id = "alarm_control_panel.casa";
      eval("_RAW_STATES")[id] = { entity_id: id, state: "armed_away", attributes: {} };
      window.dmMuro.riposa();
    });
    await expect(riposo).toContainText(/Antifurto · Inserito/);
    await expect(riposo).not.toContainText("Fuori");
  });

  /* «Il muro scrive "X° in casa", ma per me quel sensore e' esterno.» Una
   * stanza all'aperto (#251) non e' «in casa». */
  test("la temperatura di una stanza all'aperto e' «fuori», e senza sensore si cerca una stanza al chiuso", async ({
    page,
  }, testInfo) => {
    const seme = structuredClone(SEME_A_MURO);
    seme.sections.rooms.unshift({
      id: "terrazzo",
      name: "Terrazzo",
      outdoor: true,
      temp: "sensor.terrazzo_t",
    });
    const stati = {
      ...STATI,
      "sensor.terrazzo_t": { state: "12.6", attributes: { unit_of_measurement: "°C" } },
    };
    /* Il sensore scelto e' quello del terrazzo: sul riposo «fuori», e i
     * gradi del meteo non ci sono — una temperatura di fuori sola. */
    await apriLaCasaAMuro(page, testInfo, {
      seme,
      stati,
      muro: {
        attiva: true,
        temperatura: "casa",
        riposo: { attivo: true, minuti: 2, torna: true, sensore: "sensor.terrazzo_t" },
        pagine: [{ id: "p1", modello: "stanza", stanza: "Soggiorno" }],
      },
    });
    await expect(muro(page).locator(".mu-meteo b")).toHaveText("12,6°");
    await expect(muro(page).locator(".mu-meteo .mu-et")).toHaveText(/^fuori · poco nuvoloso/i);
    await page.evaluate(() => window.dmMuro.riposa());
    const riga = muro(page).locator(".mu-riposo-riga");
    await expect(riga.locator('[data-mu-riposo="temperatura"]')).toHaveText("12,6° fuori");
    await expect(riga).not.toContainText("in casa");
    await expect(riga).not.toContainText("17°");

    /* Anche con «Temperatura mostrata: meteo» il riposo non mette due
     * temperature di fuori: resta quella del sensore. */
    await apriLaCasaAMuro(page, testInfo, {
      seme,
      stati,
      muro: {
        attiva: true,
        riposo: { attivo: true, minuti: 2, torna: true, sensore: "sensor.terrazzo_t" },
        pagine: [{ id: "p1", modello: "stanza", stanza: "Soggiorno" }],
      },
    });
    await page.evaluate(() => window.dmMuro.riposa());
    await expect(muro(page).locator(".mu-riposo-riga")).toContainText("12,6° fuori");
    await expect(muro(page).locator(".mu-riposo-riga")).not.toContainText("17°");

    /* Senza sensore, con la prima pagina sul terrazzo: «in casa» e' la prima
     * stanza al chiuso con una sonda, il soggiorno. */
    await apriLaCasaAMuro(page, testInfo, {
      seme,
      stati,
      muro: {
        attiva: true,
        temperatura: "casa",
        pagine: [{ id: "p1", modello: "stanza", stanza: "Terrazzo" }],
      },
    });
    await expect(muro(page).locator(".mu-meteo b")).toHaveText("21,2°");
    await expect(muro(page).locator(".mu-meteo .mu-et")).toHaveText(/^in casa/i);
    await page.evaluate(() => window.dmMuro.riposa());
    await expect(muro(page).locator('.mu-riposo-riga [data-mu-riposo="temperatura"]')).toHaveText(
      "21,2° in casa",
    );
  });

  test("la pagina Musica: il gruppo dei Sonos si fa e si scioglie dal tablet", async ({
    page,
  }, testInfo) => {
    const GRUPPO = 524288;
    const stati = {
      ...STATI,
      "media_player.sonos_cucina": {
        state: "playing",
        attributes: {
          friendly_name: "Sonos cucina",
          supported_features: 1 + 4 + 16384 + GRUPPO,
          media_title: "Nuvole bianche",
          volume_level: 0.3,
          group_members: ["media_player.sonos_cucina"],
        },
      },
      "media_player.sonos_sala": {
        state: "idle",
        attributes: { friendly_name: "Sonos sala", supported_features: 1 + 4 + 16384 + GRUPPO },
      },
      "media_player.tv_sala": {
        state: "off",
        attributes: { friendly_name: "TV sala", supported_features: 128 + 256 },
      },
    };
    await apriLaCasaAMuro(page, testInfo, {
      muro: {
        attiva: true,
        pagine: [
          {
            id: "m1",
            modello: "musica",
            lettori: [
              "media_player.sonos_cucina",
              "media_player.sonos_sala",
              "media_player.tv_sala",
            ],
          },
        ],
      },
      stati,
    });
    const grande = muro(page).locator(".mu-mp");
    await grande.locator('[data-mu-fa="mp-gruppo"]').click();
    const finestra = muro(page).locator(".mu-finestra");
    /* La TV non sa stare in gruppo: non si offre. */
    await expect(finestra.locator("[data-mu-altro]")).toHaveCount(1);
    await finestra.locator('[data-mu-altro="media_player.sonos_sala"]').click();
    await expect(finestra.locator('[data-mu-altro="media_player.sonos_sala"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await finestra.locator('[data-mu-fa="chiudi"]').click();
    await expect(grande.locator('[data-mu-fa="mp-gruppo"]')).toContainText("2");
    const chiesti = await page.evaluate(() => window.__SERVIZI__.slice());
    expect(chiesti).toEqual([
      {
        domain: "media_player",
        service: "join",
        data: {
          entity_id: "media_player.sonos_cucina",
          group_members: ["media_player.sonos_sala"],
        },
      },
    ]);
  });
});
