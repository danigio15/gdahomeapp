/* «Quando entro nel widget energia e ritorno nella home spariscono le 3
 * lineette in alto a sinistra, il nome della Dashboard e sulla destra l'icona
 * della configurazione. Per farli rientrare, devo chiudere e rilanciare
 * l'app.»
 *
 * Le tre cose che spariscono stanno tutte nella fascia in cima: il tasto del
 * menu, il nome della casa e l'ingranaggio. Cioe' la fascia e' spenta mentre
 * sotto gli occhi c'e' la Home — che e' l'unico posto dove deve stare accesa.
 *
 * Un guardiano che la riaccenda c'era gia' (`la-testata-di-home-si-ripara`), e
 * il giro dritto — tessera, «Apri sezione», ritorno — lo ripara benissimo: lo
 * si e' percorso in un browser vero e la fascia torna ogni volta. Ma quel
 * guardiano da' per scontato che una pagina aperta ci sia, e che sia una.
 * Quando non e' cosi' non ripara niente, e non ripara MAI PIU': ed e' la firma
 * della segnalazione, «devo chiudere e rilanciare l'app».
 *
 * Gli stati senza uscita sono due, e questa prova li mette tutt'e due:
 *
 *   A. nessuna pagina attiva. Ogni sezione nata dopo il guscio si apre
 *      togliendo l'attivo a tutte e poi facendo
 *      `ensureXPage()?.classList.add("active")`: se la pagina non nasce, non
 *      succede niente e non resta aperta nessuna pagina. Il guscio intanto ha
 *      gia' spento la fascia col suo stile in linea.
 *
 *   B. due pagine attive, la Home e un'altra. La regola col peso massimo dice
 *      «la pagina aperta non e' la Home» e spegne la fascia, mentre la Home e'
 *      quella che si sta guardando.
 *
 * Misurato prima della cura: in tutt'e due, dopo un cambio di stato, un
 * `pageshow` e un `visibilitychange` — i tre eventi che svegliano il guardiano
 * — la fascia resta alta zero. La cura non rincorre nessuno dei due: rimette
 * l'invariante che la regola presuppone, una pagina aperta e una sola.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    lights: [],
    climate: [],
    covers: [],
    ev: [],
    loads: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* I tre eventi che svegliano il guardiano della testata. Si mandano tutti e
 * tre perche' la prova non deve dipendere da quale dei tre arriva prima in
 * casa: quello che si pretende e' che dopo uno qualunque la fascia sia a
 * posto. */
const sveglia = (page) =>
  page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
  });

const laFascia = (page) => page.locator("body>header:not(.dm-page-mast)");
const attive = (page) =>
  page.evaluate(() => [...document.querySelectorAll(".page.active")].map((n) => n.id));

test("senza nessuna pagina aperta la fascia della Home torna", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await sveglia(page);
  await expect(laFascia(page)).toBeVisible();

  /* Lo stato rotto, scritto come lo scrive la plancia: l'attivo tolto a tutte
   * e la pagina che non nasce, piu' la fascia spenta dal guscio. */
  await page.evaluate(() => {
    for (const nodo of document.querySelectorAll(".page")) nodo.classList.remove("active");
    document.querySelector("body>header:not(.dm-page-mast)").style.display = "none";
  });
  await expect(laFascia(page)).toBeHidden();

  await sveglia(page);
  await expect(laFascia(page)).toBeVisible({ timeout: 10_000 });
  /* E si e' tornati dove si puo' stare: la Home, che c'e' sempre. */
  await expect.poll(() => attive(page)).toEqual(["page-home"]);
});

test("con due pagine aperte insieme la fascia della Home torna", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await sveglia(page);
  await expect(laFascia(page)).toBeVisible();

  await page.evaluate(() => {
    document.getElementById("page-home").classList.add("active");
    document.getElementById("page-energy")?.classList.add("active");
  });
  /* Qui la fascia e' spenta da un `!important`: togliere lo stile in linea —
   * che e' quello che il guardiano sapeva fare — non la riaccende. */
  await expect(laFascia(page)).toBeHidden();

  await sveglia(page);
  await expect(laFascia(page)).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => attive(page)).toEqual(["page-home"]);
});

test("e la pagina che resta e' quella della linguetta accesa, non sempre la Home", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await sveglia(page);

  /* Si va sull'Energia per la strada di sempre, e poi si sporca lo stato
   * accendendo anche la Home: chi sta guardando l'Energia deve restare
   * sull'Energia — riportarlo alla Home sarebbe una cura peggiore del male. */
  await page.locator('.tab[data-tab="energy"]').evaluate((nodo) => nodo.click());
  await expect.poll(() => attive(page)).toEqual(["page-energy"]);
  await page.evaluate(() => document.getElementById("page-home").classList.add("active"));
  await sveglia(page);
  await expect.poll(() => attive(page)).toEqual(["page-energy"]);
  /* E li' la fascia sta spenta, che e' giusto. */
  await expect(laFascia(page)).toBeHidden();
});
