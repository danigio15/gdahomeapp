/* «L'entita' assist che ho, in questo caso ollama, non resta salvata» (#70).
 *
 * La diagnostica dice dov'era: `panel_section: config`, `funzione: L'editor
 * delle entita'`. Si sceglie l'assistente con la lente, il nome compare nella
 * casella, e non arriva mai in configurazione: riaprendo la scheda la casella
 * e' di nuovo vuota.
 *
 * Il perche' e' una parola sola. Quando si sceglie una riga dal catalogo, il
 * guscio scrive il valore nella casella e annuncia il cambio cosi':
 *
 *     ref.dispatchEvent(new Event('change'))
 *
 * Un `change` vero, quello che nasce quando una persona scrive e poi esce dal
 * campo, RISALE il documento. Questo no: `new Event` senza dirglielo non
 * risale. Chi ascolta sull'elemento lo sente — ed e' il caso delle caselle del
 * guscio, che hanno il loro `onchange=` scritto sopra — e chi ascolta sul
 * documento no.
 *
 * Contati: undici moduli ascoltano il `change` sul documento e usano la lente.
 * Quattro lo fanno in CATTURA, e quelli funzionavano da sempre, perche' la
 * cattura scende e non ha bisogno che l'evento risalga. Gli altri sette — fra
 * cui Assist — aspettavano un evento che non arrivava.
 *
 * La correzione e' far risalire quel `change` come risale quello vero. Questa
 * prova percorre il giro della segnalazione: la lente, la scelta, e la scheda
 * riaperta — che e' il momento in cui «non resta salvata» si vede.
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
  visibility: { home: true },
};

/* Due assistenti, come in casa di chi ha segnalato: quello di serie e Ollama. */
const CONVERSAZIONI = ["conversation.home_assistant", "conversation.ollama"];

/** Cosa c'e' scritto in configurazione, e cosa si legge nella casella. */
const comeSta = (page) =>
  page.evaluate(() => {
    let assist = {};
    try {
      assist = JSON.parse(localStorage.getItem("cd_assist") || "{}");
    } catch (_errore) {}
    const casella = document.getElementById("dm-assist-agente");
    return { salvato: assist.agente ?? null, nellaCasella: casella ? casella.value : null };
  });

const apriLeImpostazioni = (page) =>
  page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show"))
      window.apriConfigEntita?.();
    [...document.querySelectorAll("#editor-modal .ed-tab")]
      .find((nodo) => nodo.dataset.tab === "visib")
      ?.click();
  });

test("l'assistente scelto con la lente resta scritto in configurazione", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((elenco) => {
    const grezzi = eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    for (const id of elenco) {
      const voce = {
        entity_id: id,
        state: "unknown",
        attributes: { friendly_name: id.split(".")[1] },
      };
      if (grezzi) grezzi[id] = voce;
      if (typeof STATES !== "undefined") STATES[id] = voce;
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, CONVERSAZIONI);

  await apriLeImpostazioni(page);
  const lente = page.locator('[data-dm-assist-pick="dm-assist-agente"]');
  await expect(lente, "la casella di Assist non ha la lente").toBeVisible();
  await expect.poll(() => comeSta(page)).toMatchObject({ salvato: null, nellaCasella: "" });

  await lente.click();
  await expect(page.locator("#cd-entpick")).toBeVisible();
  /* Si sceglie come sceglie un dito: la riga del catalogo. */
  await page.evaluate(() => {
    [...document.querySelectorAll("#cd-entpick [onclick]")]
      .find((riga) => /ollama/.test(riga.dataset?.entity || riga.getAttribute("onclick") || ""))
      ?.click();
  });

  /* Salvata subito, senza bisogno di uscire dal campo. */
  await expect
    .poll(() => comeSta(page), {
      message: "la scelta della lente non e' arrivata in configurazione",
    })
    .toMatchObject({ salvato: "conversation.ollama", nellaCasella: "conversation.ollama" });

  /* E il momento in cui la segnalazione se ne accorgeva: si cambia scheda e si
   * torna. La casella si ridisegna da quello che c'e' scritto, quindi vuota
   * qui vuol dire «non e' mai stata salvata». */
  await page.evaluate(() => {
    [...document.querySelectorAll("#editor-modal .ed-tab")]
      .find((nodo) => nodo.dataset.tab === "sez0")
      ?.click();
  });
  await apriLeImpostazioni(page);
  await expect
    .poll(() => comeSta(page), { message: "riaprendo la scheda la casella e' tornata vuota" })
    .toMatchObject({ salvato: "conversation.ollama", nellaCasella: "conversation.ollama" });
});

test("il catalogo annuncia la scelta con un evento che risale", async ({ page }, testInfo) => {
  /* La regola sotto la correzione, provata da sola: chi ascolta sul documento
   * — e sono sette moduli — deve sentire la scelta del catalogo. Si mette un
   * ascolto sulla risalita e si guarda se arriva.
   *
   * Non si guarda il codice: si guarda l'evento. Il giorno in cui qualcuno
   * riscrive quella riga in un altro modo, quello che conta e' che l'evento
   * arrivi lo stesso. */
  test.setTimeout(180_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  const arrivato = await page.evaluate((elenco) => {
    const grezzi = eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    for (const id of elenco) {
      const voce = { entity_id: id, state: "unknown", attributes: { friendly_name: id } };
      if (grezzi) grezzi[id] = voce;
      if (typeof STATES !== "undefined") STATES[id] = voce;
    }
    const casella = document.createElement("input");
    casella.type = "text";
    casella.id = "dm-prova-lente";
    document.body.append(casella);
    const sentiti = [];
    /* Sulla risalita, come i sette: niente terzo argomento. */
    document.addEventListener("change", (evento) => {
      if (evento.target === casella) sentiti.push(evento.type);
    });
    window.wzPickEntity?.(casella);
    [...document.querySelectorAll("#cd-entpick [onclick]")]
      .find((riga) => /ollama/.test(riga.dataset?.entity || riga.getAttribute("onclick") || ""))
      ?.click();
    const esito = { sentiti, valore: casella.value };
    casella.remove();
    return esito;
  }, CONVERSAZIONI);

  expect(arrivato.valore, "il catalogo non ha scritto niente nella casella").toBe(
    "conversation.ollama",
  );
  expect(arrivato.sentiti, "l'annuncio della scelta non risale il documento").toEqual(["change"]);
});
