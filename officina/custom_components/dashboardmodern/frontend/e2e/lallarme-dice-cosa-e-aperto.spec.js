/* «Se provo ad attivare l'allarme e ho una finestra aperta mi segnali quale è
 * aperta» (#116).
 *
 * I sensori si dichiarano già — sono gli «Ingressi di quest'area» della
 * centrale — e la pagina li elenca. Quello che mancava è il momento in cui
 * servono davvero: il tocco sul tasto d'inserimento. Prima una finestra aperta
 * la si scopriva dalla centrale che rifiuta, o da un allarme che suona alle
 * tre di notte.
 *
 * Questa prova pretende le due cose che un modello non può dimostrare: che la
 * domanda arrivi col NOME di quello che è aperto, e che rispondendo di sì
 * l'inserimento parta lo stesso — la plancia chiede, non impedisce.
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
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, security: true },
};

const STATI = {
  "binary_sensor.finestra_cucina": {
    entity_id: "binary_sensor.finestra_cucina",
    state: "on",
    attributes: { device_class: "window", friendly_name: "Finestra cucina" },
  },
  "binary_sensor.porta_garage": {
    entity_id: "binary_sensor.porta_garage",
    state: "off",
    attributes: { device_class: "door", friendly_name: "Porta garage" },
  },
};

const CENTRALI = [
  {
    id: "area1",
    nome: "Area 1",
    entita: "alarm_control_panel.casa",
    corrente: true,
    ingressi: ["binary_sensor.finestra_cucina", "binary_sensor.porta_garage"],
  },
];

async function apri(page, testInfo) {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ stati, centrali }) => {
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      localStorage.setItem("cd_centrali", JSON.stringify(centrali));
      localStorage.setItem(
        "cd_varchi",
        JSON.stringify({
          righe: [
            { entity: "binary_sensor.finestra_cucina", name: "Finestra cucina" },
            { entity: "binary_sensor.porta_garage", name: "Porta garage" },
          ],
        }),
      );
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, centrali: CENTRALI },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await page.waitForTimeout(600);
}

test("inserendo con una finestra aperta la plancia dice quale, e non impedisce", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo);

  /* Si preme il tasto come lo premono tutte e tre le file: chiamando
   * `promptPinAndSet` col servizio della centrale, che è il posto dove il
   * controllo si è agganciato. */
  const esito = await page.evaluate(async () => {
    const visto = { titolo: "", messaggio: "", partito: "" };
    /* Si mette da parte quello che il guscio fa davvero, e si guarda solo se
     * ci arriva: questa prova non deve chiamare nessun servizio. */
    const primaPrompt = window.promptPinAndSet;
    const primaConferma = window.confermaAzione;
    let conferma = null;
    window.confermaAzione = (voce) => {
      visto.titolo = voce?.title || "";
      visto.messaggio = voce?.message || "";
      conferma = voce?.onConfirm;
    };
    /* Il controllo si aggancia a `promptPinAndSet`: sotto di lui si mette una
     * spia che dice se l'inserimento è partito. */
    window.__dmSpia = (servizio) => {
      visto.partito = servizio;
    };
    window.promptPinAndSet = window.__dmSpia;
    window.dispatchEvent(new CustomEvent("dashboardmodern:runtime-ready"));
    window.promptPinAndSet("alarm_arm_away");
    /* Finché non si risponde, niente è partito. */
    visto.primaDellaRisposta = visto.partito;
    conferma?.();
    window.promptPinAndSet = primaPrompt;
    window.confermaAzione = primaConferma;
    return visto;
  });

  expect(esito.titolo, "la domanda deve avere un titolo").toBeTruthy();
  expect(esito.messaggio).toContain("Finestra cucina");
  expect(esito.messaggio, "quella chiusa non si nomina").not.toContain("Porta garage");
  expect(esito.primaDellaRisposta, "finché non si risponde non parte niente").toBe("");
  expect(esito.partito, "rispondendo di sì l'inserimento parte lo stesso").toBe("alarm_arm_away");
});

test("lo sblocco non chiede niente: chi rientra non va fermato", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  const esito = await page.evaluate(() => {
    let chiesto = false;
    let partito = "";
    const primaPrompt = window.promptPinAndSet;
    const primaConferma = window.confermaAzione;
    window.confermaAzione = () => {
      chiesto = true;
    };
    window.promptPinAndSet = (servizio) => {
      partito = servizio;
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:runtime-ready"));
    window.promptPinAndSet("alarm_disarm");
    window.promptPinAndSet = primaPrompt;
    window.confermaAzione = primaConferma;
    return { chiesto, partito };
  });
  expect(esito.chiesto).toBe(false);
  expect(esito.partito).toBe("alarm_disarm");
});
