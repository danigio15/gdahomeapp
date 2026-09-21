/* «Quando seleziono di non vederlo nella barra non scompare, rimane li'» (#68).
 *
 * La diagnostica della segnalazione dice dov'era: `panel_section: config`,
 * `sezione: server`. Cioe' il MiniPC, spento dalla configurazione.
 *
 * Spegnerlo funziona: la voce sparisce subito. Torna al primo salvataggio, e
 * il perche' e' una parola che non veniva detta.
 *
 * Nella mappa delle visibilita' un `false` vuol dire due cose opposte: «non
 * l'ho ancora configurata», che ci scrive la procedura iniziale, oppure «non
 * la voglio vedere», che ci scrive chi preme. La passata che accende le
 * sezioni configurate — `repairConfiguredVisibility`, che corre a ogni
 * salvataggio — le distingue leggendo un segno a parte, `cd_sections_manual`:
 * su una sezione segnata li' non torna. Il segno pero' lo scriveva un ascolto
 * sul documento che guarda una cosa sola, se il bottone premuto porta un
 * `data-key`. La fascia verde dentro la scheda di una sezione ce l'ha —
 * ed e' per questo che `minipc-stays-hidden` passa — mentre l'interruttore
 * dell'elenco delle sezioni porta il suo `data-dm-sezione-int`, e per giunta
 * chiama `edSecTog` a mano, senza nessun clic che risalga.
 *
 * Risultato misurato: il MiniPC, che ha due entita' mappate, si spegneva e al
 * primo salvataggio tornava su. Questa prova percorre i tre momenti — acceso,
 * spento, dopo un salvataggio — e guarda insieme le tre cose che devono
 * andare d'accordo: la mappa, il segno, e la voce nella barra.
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
    /* Due caselle mappate: e' quello che rende il MiniPC «configurato», ed e'
     * la condizione in cui la riparazione lo riaccendeva. */
    entityOverrides: { "dm.server_cpu": "sensor.cpu", "dm.server_ram": "sensor.ram" },
  },
  visibility: { home: true, server: true },
};

/** Le tre cose che devono dire la stessa cosa. */
const comeSta = (page) =>
  page.evaluate(() => {
    const leggi = (chiave) => {
      try {
        return JSON.parse(localStorage.getItem(chiave) || "{}");
      } catch (_errore) {
        return {};
      }
    };
    const voce = document.querySelector('.tab[data-tab="server"]');
    return {
      sezioni: leggi("cd_sections").server ?? null,
      aMano: leggi("cd_sections_manual").server ?? null,
      voce: !voce ? "assente" : getComputedStyle(voce).display === "none" ? "nascosta" : "in vista",
    };
  });

/* Un salvataggio qualunque, che e' quello che nella vita capita subito dopo:
 * si nasconde una sezione e si continua a configurare. */
const unSalvataggio = (page) =>
  page.evaluate(() => {
    document.dispatchEvent(new Event("submit", { bubbles: true }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });

test("il MiniPC nascosto dall'elenco delle sezioni resta nascosto", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    const grezzi = eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    for (const id of ["sensor.cpu", "sensor.ram"]) {
      const voce = {
        entity_id: id,
        state: "42",
        attributes: { friendly_name: id, unit_of_measurement: "%" },
      };
      if (grezzi) grezzi[id] = voce;
      if (typeof STATES !== "undefined") STATES[id] = voce;
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await expect.poll(() => comeSta(page).then((s) => s.voce)).toBe("in vista");

  /* Configurazione → Impostazioni → l'elenco delle sezioni. */
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show"))
      window.apriConfigEntita?.();
  });
  await page.evaluate(() => {
    [...document.querySelectorAll("#editor-modal .ed-tab")]
      .find((nodo) => nodo.dataset.tab === "visib")
      ?.click();
  });
  const interruttore = page.locator('#dm-elenco-sezioni [data-dm-sezione-int="server"]');
  await expect(interruttore, "l'elenco delle sezioni non offre il MiniPC").toBeVisible();

  await interruttore.click();
  await expect.poll(() => comeSta(page)).toMatchObject({
    sezioni: false,
    /* Il segno: e' la sola cosa che distingue «non la voglio vedere» da «non
     * l'ho ancora configurata», e prima non lo scriveva nessuno. */
    aMano: true,
    voce: "nascosta",
  });

  /* E adesso il momento in cui tornava su. */
  await unSalvataggio(page);
  await page.waitForTimeout(1200);
  await expect.poll(() => comeSta(page), { message: "il MiniPC e' tornato nella barra" }).toMatchObject({
    sezioni: false,
    aMano: true,
    voce: "nascosta",
  });
});

test("e riaccenderlo dall'elenco lo riporta nella barra", async ({ page }, testInfo) => {
  /* La stessa porta, nell'altro verso: chi cambia idea deve poterla cambiare.
   *
   * Si parte dallo stesso seme dell'altra prova e si spegne col gesto vero,
   * invece di scrivere `false` nel seme: quel `false` li' vorrebbe dire «non
   * l'ho ancora configurata», e la riparazione la riaccenderebbe — come deve.
   * E' proprio la distinzione che questa correzione difende, quindi la prova
   * non puo' permettersi di confonderla. */
  test.setTimeout(180_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show"))
      window.apriConfigEntita?.();
    [...document.querySelectorAll("#editor-modal .ed-tab")]
      .find((nodo) => nodo.dataset.tab === "visib")
      ?.click();
  });
  const interruttore = page.locator('#dm-elenco-sezioni [data-dm-sezione-int="server"]');
  await expect(interruttore).toBeVisible();

  await interruttore.click();
  await expect.poll(() => comeSta(page)).toMatchObject({ sezioni: false, voce: "nascosta" });

  await interruttore.click();
  await expect.poll(() => comeSta(page)).toMatchObject({ sezioni: true, voce: "in vista" });
  /* E ci resta: riacceso a mano e' una decisione quanto spento a mano. */
  await unSalvataggio(page);
  await page.waitForTimeout(1200);
  await expect.poll(() => comeSta(page)).toMatchObject({ sezioni: true, voce: "in vista" });
});
