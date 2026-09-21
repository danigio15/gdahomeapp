/* Un'azione rapida che apre tutte le prese (#25).
 *
 * «Si potrebbe inserire NELLE Azioni rapide UN POP UP DI TUTTE LE PRESE?»
 *
 * Fra i tipi di azione rapida «Popup TUTTE le luci» c'era già; per le prese
 * no. E una finestra delle prese la plancia ce l'ha: è quella della tessera
 * Prese, con l'elenco, lo stato di ognuna e i suoi comandi. Mancava solo il
 * modo di aprirla da un tasto che non è la tessera.
 *
 * Quindi non una seconda finestra delle prese — sarebbe la stessa cosa
 * disegnata due volte, e alla prima modifica se ne aggiusterebbe una sola —
 * ma una porta: si dice il nome della tessera, e si apre la sua.
 *
 * Qui si pretende quello che succede premendo: la finestra giusta, con dentro
 * le prese di casa. E il caso storto, che è quello che fa i tasti morti: una
 * casa senza prese non deve lasciare il dito su un tasto che non fa niente.
 */
import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const PRESE = [
  { id: "p1", name: "TV Salotto", entity: "switch.tv_salotto", room: "Salotto" },
  { id: "p2", name: "Firestick", entity: "switch.firestick", room: "Salotto" },
  { id: "p3", name: "Modem", entity: "switch.modem", room: "Studio" },
];
const STATI = {
  "switch.tv_salotto": { state: "on", attributes: { friendly_name: "TV Salotto" } },
  "switch.firestick": { state: "off", attributes: { friendly_name: "Firestick" } },
  "switch.modem": { state: "on", attributes: { friendly_name: "Modem" } },
};

/* L'azione rapida come la salva l'editor: il tipo `builtin_prese` diventa
 * `{ type: 'builtin', builtin: 'prese' }`. */
const AZIONI = [{ type: "builtin", builtin: "prese", name: "Prese", icon: "🔌" }];

const seme = (prese) => ({
  schema_version: 4,
  sections: {
    rooms: [
      { id: "r1", name: "Salotto", icon: "🛋️", metadata: {} },
      { id: "r2", name: "Studio", icon: "💻", metadata: {} },
    ],
    cameras: [], appliances: [], loads: [], lights: [], climate: [], ev: [],
    covers: [], pool: {}, irrigation: { zones: [] }, energy: {}, entityOverrides: {},
    prese,
  },
  visibility: { home: true, prese: true },
});

async function avvia(page, testInfo, prese = PRESE) {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme(prese));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ s, prese, azioni }) => {
      Object.assign(eval("_RAW_STATES"), s);
      localStorage.setItem("cd_prese", JSON.stringify(prese));
      localStorage.setItem("cd_quick_actions", JSON.stringify(azioni));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { s: STATI, prese, azioni: AZIONI },
  );
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.waitForTimeout(600);
}

test("il tipo «Popup TUTTE le prese» si offre dove si offre quello delle luci", async () => {
  /* Tre posti, e devono dirlo tutti e tre: la procedura iniziale e l'editor
   * del guscio (uno per lingua, e le due lingue sono lo stesso programma
   * scritto due volte), piu' la tendina dell'editor moderno. Una voce che
   * c'e' in due su tre e' una voce che meta' delle case non trova. */
  const dove = [
    "../../../../../ponte/plancia/legacy/dashboard-runtime-it.js",
    "../../../../../ponte/plancia/legacy/dashboard-runtime-en.js",
  ];
  for (const quale of dove) {
    const sorgente = await readFile(new URL(quale, import.meta.url), "utf8");
    /* Due volte: la procedura e l'editor. Accanto a quella delle luci, che e'
     * dove chi configura la va a cercare. */
    expect(sorgente.split('value="builtin_prese"').length - 1).toBe(2);
    expect(sorgente).toContain("prese:     { name:");
    expect(sorgente).toContain("function apriTuttePrese()");
  }
  const moderno = await readFile(
    new URL("../../../../../ponte/plancia/src/sections/unified-editors-section.js", import.meta.url),
    "utf8",
  );
  expect(moderno).toContain('["builtin_prese", "Prese", "Sockets"]');
  /* E il segno: senza la sua riga nel catalogo prenderebbe la stella di
   * ripiego, cioe' il disegno di «non so cos'e' questo». */
  const catalogo = await readFile(
    new URL("../../../../../ponte/plancia/src/core/personalization-catalog.js", import.meta.url),
    "utf8",
  );
  /* E dev'essere un segno del catalogo DELLE AZIONI: uno che quel catalogo non
   * conosce farebbe ripiegare sull'emoji di sistema, diversa su ogni telefono. */
  expect(catalogo).toContain('prese: "mdi:power-plug"');
});

test("premendo l'azione si apre la finestra delle prese, con dentro le prese di casa", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  await page.evaluate(() => window.qaRun(0));
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra).toBeVisible();
  /* È LA finestra delle prese, non una nuova: la stessa che apre la tessera. */
  await expect(finestra).toHaveAttribute("data-dm-popup-of", "prese");
  for (const nome of ["TV Salotto", "Firestick", "Modem"])
    await expect(finestra).toContainText(nome);
});

test("la finestra si apre anche se la tessera Prese è stata tolta dalla Home", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  /* Chi ha aggiunto l'azione apposta deve vederla funzionare: una tessera
   * spenta nella scheda Widget è una scelta su cosa mostrare in Home, non su
   * cosa fa un tasto che si è messo da sé. */
  await page.evaluate(() => {
    const scelte = JSON.parse(localStorage.getItem("cd_widgets") || "{}");
    scelte.hidden = [...(scelte.hidden || []), "prese"];
    localStorage.setItem("cd_widgets", JSON.stringify(scelte));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  /* Prima si pretende che la tessera sia sparita davvero, o questa prova
   * passerebbe senza aver provato niente. */
  await expect(page.locator('#dm-widgets [data-dm-widget="prese"]')).toHaveCount(0);
  await page.evaluate(() => window.qaRun(0));
  await expect(page.locator("#dm-widget-popup")).toHaveAttribute("data-dm-popup-of", "prese");
});

test("una casa senza prese non lascia il dito su un tasto morto: porta dove si configurano", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, []);
  await page.evaluate(() => {
    localStorage.setItem("cd_prese", "[]");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.qaRun(0));
  await page.waitForTimeout(600);
  /* Nessuna finestra — non c'è niente da mostrare — ma nemmeno niente. */
  const dove = await page.evaluate(() => ({
    finestra: document.getElementById("dm-widget-popup")?.hidden !== false,
    pagina: document.querySelector(".page.active")?.id || "",
  }));
  expect(dove.finestra).toBe(true);
  expect(dove.pagina).toBe("page-prese");
});
