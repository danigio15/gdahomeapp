/* L'auto che arriva dal portale dei dati europeo.
 *
 * «Ho messo l'entita' della batteria ausiliaria, km, batteria elettrica,
 * temperatura esterna, freno di stazionamento e l'ultimo aggiornamento, ma non
 * li prende tutti.» Una Cupra Terramar letta da un'integrazione «garage» che
 * prende i dati dal portale EU Data Act: la batteria da 12 V in volt, il
 * contachilometri senza statistiche a lungo termine, il freno come
 * binary_sensor, un livello di batteria ausiliaria che e' un numero piccolo
 * senza unita'. Nessuna autonomia, nessun carburante.
 *
 * La configurazione e' quella fatta nella scheda Veicoli, nessun profilo auto,
 * il motore dichiarato «termica»: ogni dato scelto deve arrivare in pagina.
 */
import { expect, test } from "@playwright/test";
import { saveSection } from "./helpers/entity-field.js";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

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
  visibility: { home: true, ev: true },
};

const ADESSO = "2026-11-05T11:44:00+01:00";

const s = (entity_id, state, attributes = {}) => ({
  entity_id,
  state: String(state),
  attributes: { friendly_name: entity_id.split(".")[1].replace(/_/g, " "), ...attributes },
  last_changed: "2026-11-05T10:41:00+00:00",
  last_updated: "2026-11-05T10:41:00+00:00",
});

const C = "garage_cupra_000001";
/* Gli stati, come li scrive l'integrazione: niente `state_class`, e quindi
 * niente statistiche a lungo termine del contachilometri. */
const STATI = [
  s(`binary_sensor.${C}_astina_olio_attiva`, "on", { friendly_name: "Astina olio attiva" }),
  s(`binary_sensor.${C}_dati_obsoleti`, "off", {
    friendly_name: "Dati obsoleti",
    device_class: "problem",
  }),
  s(`binary_sensor.${C}_fonte_eu_data_act_portal`, "on", {
    friendly_name: "Fonte: EU Data Act portal",
  }),
  s(`binary_sensor.${C}_freno_di_stazionamento`, "on", { friendly_name: "Freno di stazionamento" }),
  s(`sensor.${C}_avvisi_del_cruscotto_grezzi`, "1", {
    friendly_name: "Avvisi del cruscotto (grezzi)",
  }),
  s(`sensor.${C}_batteria_12v`, "12.25", {
    friendly_name: "Batteria 12V",
    unit_of_measurement: "V",
    device_class: "voltage",
  }),
  s(`sensor.${C}_contachilometri`, "5341", {
    friendly_name: "Contachilometri",
    unit_of_measurement: "km",
    device_class: "distance",
  }),
  s(`sensor.${C}_data_del_tagliando`, "2028-05-09", {
    friendly_name: "Data del tagliando",
    device_class: "date",
  }),
  s(`sensor.${C}_livello_batteria_ausiliaria`, "2", {
    friendly_name: "Livello batteria ausiliaria",
  }),
  /* Una carica dell'auto, per la prova in cui e' mappata: il portale non la
   * da' a tutte. */
  s(`sensor.${C}_stato_di_carica`, "64", {
    friendly_name: "Stato di carica",
    unit_of_measurement: "%",
    device_class: "battery",
  }),
  /* Il resto del dispositivo, come lo pubblica: anche la temperatura senza
   * unita', e due istanti — quando l'auto ha mandato i dati (tre giorni fa) e
   * quando la casa li ha ricevuti (adesso). */
  s(`sensor.${C}_luci_di_posizione`, "off", { friendly_name: "Luci di posizione" }),
  s(`sensor.${C}_minuti_dall_ultimo_snapshot`, "0", {
    friendly_name: "Minuti dall'ultimo snapshot",
  }),
  s(`sensor.${C}_ora_di_allerta_batteria_ausiliaria`, "2026-11-02T18:31:49+00:00", {
    friendly_name: "Ora di allerta batteria ausiliaria",
    device_class: "timestamp",
  }),
  s(`sensor.${C}_prossimo_tagliando`, "24700", { friendly_name: "Prossimo tagliando" }),
  s(`sensor.${C}_richiesta_dati_creata`, "2026-10-25T20:03:46+00:00", {
    friendly_name: "Richiesta dati creata",
    device_class: "timestamp",
  }),
  s(`sensor.${C}_stato_connessione`, "online", { friendly_name: "Stato connessione" }),
  s(`sensor.${C}_stato_del_feed_del_portale`, "ok", {
    friendly_name: "Stato del feed del portale",
  }),
  s(`sensor.${C}_tagliando_tra`, "551", { friendly_name: "Tagliando tra" }),
  s(`sensor.${C}_temperatura_esterna`, "7.0", { friendly_name: "Temperatura esterna" }),
  s(`sensor.${C}_ultimo_snapshot_ricevuto`, "2026-11-05T10:41:00+00:00", {
    friendly_name: "Ultimo snapshot ricevuto",
    device_class: "timestamp",
  }),
  s(`sensor.${C}_veicolo_ultimo_report`, "2026-11-02T18:31:49+00:00", {
    friendly_name: "Veicolo ultimo report",
    device_class: "timestamp",
  }),
  s("sensor.garage_cupra_terramar_canale_sorgente_dati", "EU Data Act portal", {
    friendly_name: "Canale sorgente dati",
  }),
];

/* Quello che si legge nella sua scheda Veicoli: la 12 V finita nella casella
 * «Batteria auto (%)», il livello della ausiliaria in «Stato ricarica». */
const COME_LE_HA_MESSE = {
  "dm.ev_batteria_auto": `sensor.${C}_batteria_12v`,
  "dm.ev_odometro": `sensor.${C}_contachilometri`,
  "dm.ev_stato_ricarica": `sensor.${C}_livello_batteria_ausiliaria`,
  "dm.ev_freno_stazionamento": `binary_sensor.${C}_freno_di_stazionamento`,
  "dm.ev_temperatura_esterna": `sensor.${C}_temperatura_esterna`,
  "dm.ev_ultimo_aggiornamento": `sensor.${C}_ultimo_snapshot_ricevuto`,
};

async function avvia(
  page,
  testInfo,
  { mappa = COME_LE_HA_MESSE, motore = "termica", senzaUnita = false } = {},
) {
  /* La stessa 12 V, pubblicata senza unita' e senza classe. */
  const elenco = STATI.map((voce) =>
    senzaUnita && voce.entity_id.endsWith("_batteria_12v")
      ? { ...voce, attributes: { friendly_name: voce.attributes.friendly_name } }
      : voce,
  );
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date(ADESSO));
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ elenco }) => {
      class PonteFinto extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        onopen = null;
        onmessage = null;
        onclose = null;
        constructor() {
          super();
          queueMicrotask(() => {
            this.onopen?.({});
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          });
        }
        send(grezzo) {
          const messaggio = JSON.parse(grezzo);
          if (messaggio.type === "auth") return;
          let risultato = null;
          if (messaggio.type === "get_states") risultato = elenco;
          else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
          else if (messaggio.type === "call_service") risultato = {};
          else if (messaggio.type === "recorder/statistics_during_period") {
            /* Senza `state_class` il Recorder non tiene statistiche: niente. */
            window.__statistiche = [...(window.__statistiche || []), messaggio.statistic_ids];
            risultato = {};
          } else if (messaggio.type === "history/history_during_period") {
            /* La storia vera del contachilometri: il portale lo aggiorna di
             * rado, e in una settimana l'auto ha fatto 141 km in quattro giorni. */
            const da = new Date(messaggio.start_time).getTime();
            const a = new Date(messaggio.end_time || Date.now()).getTime();
            const letture = [
              ["2026-10-25T08:00:00+01:00", "5200"],
              ["2026-10-31T09:00:00+01:00", "5246"],
              ["2026-11-02T19:00:00+01:00", "5283"],
              ["2026-11-04T18:30:00+01:00", "5329"],
              ["2026-11-05T10:41:00+01:00", "5341"],
            ].map(([quando, stato]) => ({ s: stato, lu: new Date(quando).getTime() / 1000 }));
            risultato = Object.fromEntries(
              messaggio.entity_ids.map((id) => {
                if (!id.endsWith("_contachilometri")) return [id, []];
                const prima = letture.filter((r) => r.lu * 1000 <= da).at(-1);
                const dentro = letture.filter((r) => r.lu * 1000 > da && r.lu * 1000 <= a);
                return [id, [...(prima ? [{ ...prima, lu: da / 1000 }] : []), ...dentro]];
              }),
            );
          }
          queueMicrotask(() =>
            this.onmessage?.({
              data: JSON.stringify({
                id: messaggio.id,
                type: "result",
                success: true,
                result: risultato,
              }),
            }),
          );
        }
        close() {}
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
      window.WebSocket = PonteFinto;
    },
    { elenco },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction((primo) => Boolean(eval("_RAW_STATES")[primo]), STATI[0].entity_id);
  await page.waitForFunction(() => Boolean(window.cdEvApplyCar?.__dmEvSection), null, {
    timeout: 30_000,
  });
  await page.evaluate(
    ({ mappa, motore }) => {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
      window.cdApplyCanonicalOverrides?.(mappa);
      localStorage.removeItem("cd_ev_cars");
      localStorage.setItem("cd_ev_motore", JSON.stringify(motore));
      localStorage.removeItem("cd_auto_nuova");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { mappa, motore },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.locator('.tab[data-tab="ev"]').first().click();
  await expect(page.locator("#page-ev")).toHaveClass(/active/);
  await page.waitForTimeout(900);
}

async function foto(page, nome) {
  if (!process.env.DM_FOTO) return;
  await page.evaluate(() => {
    for (const nodo of document.body.querySelectorAll("*")) {
      if (nodo.closest("#page-ev")) continue;
      if (getComputedStyle(nodo).position === "fixed") nodo.style.visibility = "hidden";
    }
    window.scrollTo(0, 0);
    for (const nodo of document.querySelectorAll("*")) if (nodo.scrollTop) nodo.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  const prima = page.viewportSize();
  const alta = await page.evaluate(() => {
    const pagina = document.getElementById("page-ev");
    return Math.ceil(
      pagina.getBoundingClientRect().top + window.scrollY + pagina.scrollHeight + 40,
    );
  });
  if (alta > prima.height) await page.setViewportSize({ width: prima.width, height: alta });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${process.env.DM_FOTO}/${nome}.png`, fullPage: true });
  await page.setViewportSize(prima);
}

const na = (page) => page.locator("#dm-na");

/* Lo stato dell'auto non si deve cercare: ogni dato scelto ha il suo posto. */
async function guardaTutto(page, testInfo, nome) {
  const pagina = na(page);
  await expect(pagina).toBeVisible();
  /* L'eroe: niente autonomia mappata, quindi il contachilometri; il freno;
   * l'ora dell'ultimo aggiornamento. E nessuna 12 V spacciata per carica. */
  await expect(pagina.locator(".dm-na-dato-km")).toContainText("Contachilometri");
  await expect(pagina.locator(".dm-na-dato-km")).toContainText("5.341");
  await expect(pagina.locator(".dm-na-eroe-pills")).toContainText("Freno tirato");
  await expect(pagina.locator(".dm-na-quando")).toContainText("11:41");
  await expect(pagina.locator(".dm-na-eroe")).not.toContainText("12%");
  /* Senza marca il simbolo si vede anche fuori da Home Assistant. */
  await expect(pagina.locator(".dm-na-eroe-nome .dm-na-simbolo")).toHaveText("🚗");
  /* Viaggi: le statistiche sono vuote, i km arrivano dalla storia. */
  await pagina.locator('[data-na-linguetta="viaggi"]').click();
  const totali = pagina.locator(".dm-na-storico .dm-na-tessera");
  await expect(totali.nth(0)).toContainText("141");
  await expect(totali.nth(1)).toContainText("4");
  await expect(totali.nth(2)).toContainText("35");
  await foto(page, `${nome}-viaggi-${testInfo.project.name}`);
  /* Stato auto: la 12 V in volt, il contachilometri, la temperatura di fuori,
   * l'aggiornamento. */
  await pagina.locator('[data-na-linguetta="stato"]').click();
  const auto = pagina.locator(".dm-na-griglia-stato");
  await expect(auto).toContainText(/Batteria 12 V\s*12,[23] V/);
  await expect(auto).toContainText(/Contachilometri\s*5\.341 km/);
  await expect(auto).toContainText(/Fuori\s*7/);
  await expect(auto).toContainText(/Aggiornata\s*11:41/);
  await expect(auto).not.toContainText("%");
  await foto(page, `${nome}-stato-${testInfo.project.name}`);
}

test("la configurazione della Cupra: ogni dato scelto arriva in pagina", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await guardaTutto(page, testInfo, "cupra");
  /* La statistica e' stata chiesta, e solo dopo la storia. */
  expect(await page.evaluate(() => window.__statistiche?.length || 0)).toBeGreaterThan(0);
});

test("la 12 V senza unita' resta in volt", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { senzaUnita: true });
  await guardaTutto(page, testInfo, "cupra-senza-unita");
});

test("con la carica dell'auto e la 12 V al posto giusto, si vedono tutte e due", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, {
    mappa: {
      ...COME_LE_HA_MESSE,
      "dm.ev_batteria_auto": `sensor.${C}_stato_di_carica`,
      "dm.ev_batteria_servizio": `sensor.${C}_batteria_12v`,
      "dm.ev_stato_ricarica": "",
    },
  });
  const pagina = na(page);
  /* Il motore dice «termica», ma la carica scelta si vede accanto. */
  await expect(pagina.locator(".dm-na-dato[data-tipo='batteria']")).toContainText("64");
  await pagina.locator('[data-na-linguetta="stato"]').click();
  await expect(pagina.locator(".dm-na-griglia-stato")).toContainText(/Batteria 12 V\s*12,[23] V/);
  await foto(page, `cupra-con-la-carica-${testInfo.project.name}`);
});

/* «Batteria elettrica»: fra le sue entita' non ce n'e' una di trazione, e
 * quella che somiglia di piu' e' il livello della ausiliaria, «2» senza unita'.
 * Non e' una carica al 2%: e' un gradino della batteria ausiliaria. */
test("il livello della ausiliaria nella casella della carica non diventa 2%", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, {
    mappa: {
      ...COME_LE_HA_MESSE,
      "dm.ev_batteria_auto": `sensor.${C}_livello_batteria_ausiliaria`,
      "dm.ev_stato_ricarica": "",
    },
  });
  const pagina = na(page);
  await expect(pagina.locator(".dm-na-dato-km")).toContainText("5.341");
  await expect(pagina.locator(".dm-na-dato[data-tipo='batteria']")).toHaveCount(0);
  await expect(pagina.locator(".dm-na-eroe")).not.toContainText("2%");
  await pagina.locator('[data-na-linguetta="stato"]').click();
  await expect(pagina.locator(".dm-na-griglia-stato")).toContainText(/Batteria 12 V\s*Livello 2/);
  await expect(pagina.locator(".dm-na-griglia-stato")).not.toContainText("2%");
});

/* Due istanti: quando l'auto ha mandato i dati e quando la casa li ha
 * ricevuti. Con quello dell'auto la pagina dice il giorno: i dati sono di tre
 * giorni fa, non di adesso. */
test("l'ultimo report dell'auto si legge col suo giorno", async ({ page }, testInfo) => {
  await avvia(page, testInfo, {
    mappa: {
      ...COME_LE_HA_MESSE,
      "dm.ev_ultimo_aggiornamento": `sensor.${C}_veicolo_ultimo_report`,
    },
  });
  const pagina = na(page);
  await expect(pagina.locator(".dm-na-quando")).toContainText(/2 nov.*19:31/);
  await pagina.locator('[data-na-linguetta="stato"]').click();
  await expect(pagina.locator(".dm-na-griglia-stato")).toContainText(/Aggiornata\s*2 nov.*19:31/);
});

/* Dalla scheda Veicoli, come l'ha fatto lui: si scrive ogni entita' nella sua
 * casella, si salva, e la pagina Auto le mostra tutte. */
test("configurate dalla scheda Veicoli, arrivano tutte sulla pagina Auto", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { mappa: {} });
  const pagina = na(page);
  await expect(pagina.locator(".dm-na-dato-km")).toContainText("Autonomia");
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
    for (const nodo of document.querySelectorAll("#ed-body details.ed-acc"))
      if (nodo.querySelector('.ed-slot-in[data-ref^="dm.ev_"]')) nodo.open = true;
  });
  /* L'etichetta dice quale batteria va nella prima casella. */
  await expect(
    page.locator(
      '#ed-body .ed-slot:has(.ed-slot-in[data-ref="dm.ev_batteria_auto"]) .ed-slot-lbl input',
    ),
  ).toHaveValue("Batteria di trazione (%), non la 12 V");
  const scelte = {
    "dm.ev_batteria_servizio": `sensor.${C}_batteria_12v`,
    "dm.ev_odometro": `sensor.${C}_contachilometri`,
    "dm.ev_temperatura_esterna": `sensor.${C}_temperatura_esterna`,
    "dm.ev_freno_stazionamento": `binary_sensor.${C}_freno_di_stazionamento`,
    "dm.ev_ultimo_aggiornamento": `sensor.${C}_veicolo_ultimo_report`,
  };
  /* Il campo grezzo sta dietro la pastiglia «Scegli entita'»: si scrive li'
   * e si manda il «change» che la scheda ascolta, come fa la matita. */
  for (const [ref, entita] of Object.entries(scelte))
    await page.evaluate(
      ({ ref, entita }) => {
        const campo = document.querySelector(`#ed-body .ed-slot-in[data-ref="${ref}"]`);
        campo.value = entita;
        campo.dispatchEvent(new Event("input", { bubbles: true }));
        campo.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { ref, entita },
    );
  await saveSection(page);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("cd_entity_overrides") || "{}")),
    )
    .toMatchObject(scelte);
  /* «Salvato — ricarica per applicare»: si ricarica, come fa chi configura. */
  await page.reload();
  await page.waitForFunction((primo) => Boolean(eval("_RAW_STATES")[primo]), STATI[0].entity_id);
  /* Il seme della prova rimette la pagina classica a ogni avvio: si torna a
   * quella nuova, che e' la pagina di tutti. */
  await page.evaluate(() => {
    localStorage.removeItem("cd_auto_nuova");
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.locator('.tab[data-tab="ev"]').first().click();
  await expect(page.locator("#page-ev")).toHaveClass(/active/);
  await expect(pagina.locator(".dm-na-dato-km")).toContainText("Contachilometri");
  await expect(pagina.locator(".dm-na-dato-km")).toContainText("5.341");
  await expect(pagina.locator(".dm-na-eroe-pills")).toContainText("Freno tirato");
  await expect(pagina.locator(".dm-na-quando")).toContainText(/2 nov.*19:31/);
  await pagina.locator('[data-na-linguetta="stato"]').click();
  const auto = pagina.locator(".dm-na-griglia-stato");
  await expect(auto).toContainText(/Batteria 12 V\s*12,[23] V/);
  await expect(auto).toContainText(/Contachilometri\s*5\.341 km/);
  await expect(auto).toContainText(/Fuori\s*7/);
  await foto(page, `cupra-dalla-scheda-${testInfo.project.name}`);
});
