/* La disposizione delle sezioni, dopo la revisione indipendente (#379).
 *
 * La revisione aveva trovato modi in cui la pagina finiva diversa da quella
 * vista o salvata: l'Auto nuova che dimenticava la sua disposizione, bozze
 * che restavano sulla pagina senza essere salvate, l'ordine di serie che
 * diventava quello dell'utente, la tastiera che perdeva il fuoco dopo ogni
 * spostamento, il ✏️ della Home sopra la striscia della casa. Qui ognuna, nel
 * browser, come la farebbe una persona.
 */
import { expect, test } from "@playwright/test";
import { apri, nellaCasaDemo, pronta } from "./helpers/casa-demo.js";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";
import { SEME, lAuto, pontefinto } from "./helpers/disposizione-finta.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

const voci = (page, chiave) =>
  page.evaluate(
    (k) => window.dmDisposizione.elenchi().find((e) => e.chiave === k)?.voci || [],
    chiave,
  );
const salvata = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_disposizione") || "{}"));
const nascoste = (page, sezione) =>
  page.evaluate(
    (s) =>
      [...document.querySelectorAll(`#page-${s} [data-dm-nascosto]`)].map(
        (el) => el.getAttribute("data-dm-blocco") || el.id || el.className,
      ),
    sezione,
  );
const inModifica = (page) => page.evaluate(() => document.documentElement.dataset.dmModifica || "");
const occhio = (page, sezione, id) =>
  page.locator(
    `#page-${sezione} [data-dm-disp-voce="${id}"] > [data-dm-disp-ctrl] [data-dm-disp-occhio]`,
  );
const maniglia = (page, sezione, id) =>
  page.locator(
    `#page-${sezione} [data-dm-disp-voce="${id}"] > [data-dm-disp-ctrl] .dm-disp-maniglia`,
  );

async function inModificaSu(page, sezione) {
  await page.evaluate(() => window.dmDisposizione.entraInModifica());
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", sezione);
}

/* ── 1. l'Auto nuova ritrova la sua disposizione ─────────────────────────── */

test("Auto nuova: «Dettagli» nascosto e salvato resta nascosto dopo aver ricaricato", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await nellaCasaDemo(page);
  await apri(page, "ev");
  await expect.poll(() => voci(page, "ev@dm-na")).toContain("dettagli");
  await inModificaSu(page, "ev");
  await occhio(page, "ev", "dettagli").click();
  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect.poll(() => inModifica(page)).toBe("");
  expect((await salvata(page))["ev@dm-na"].nascosti).toContain("dettagli");
  await expect(page.locator("#page-ev .dm-na-pannello")).toBeHidden();

  await page.reload();
  await pronta(page);
  await apri(page, "ev");
  await expect(page.locator("#page-ev .dm-na-pannello")).toBeHidden({ timeout: 15_000 });
  await expect(page.locator("#page-ev .dm-na-eroe")).toBeVisible();
});

/* ── 2. quello che non si e' salvato non resta sulla pagina ─────────────── */

/* Sulla plancia non c'e' piu' il ✏️ da ripremere (#379): la modifica la
 * chiude «Annulla», nella barra dell'anteprima del Config come qui. */
test("«Annulla» chiude la modifica: la bozza non resta sulla pagina", async ({ page }) => {
  test.setTimeout(150_000);
  await nellaCasaDemo(page);
  await apri(page, "security");
  await expect.poll(() => voci(page, "security")).toContain("fumo");
  await inModificaSu(page, "security");
  await occhio(page, "security", "fumo").click();
  await page.locator('[data-dm-disp-azione="annulla"]').click();
  await expect.poll(() => inModifica(page)).toBe("");
  expect(await nascoste(page, "security")).toEqual([]);
  await expect(page.locator("#page-security .dm-sec-smoke")).toBeVisible();
  expect(await salvata(page)).toEqual({});
});

test("cambiare pagina con la modifica aperta: tornati, la pagina e' com'era", async ({ page }) => {
  test.setTimeout(150_000);
  await nellaCasaDemo(page);
  await apri(page, "security");
  await expect.poll(() => voci(page, "security")).toContain("fumo");
  const prima = await voci(page, "security");
  await inModificaSu(page, "security");
  await occhio(page, "security", "fumo").click();
  /* Spostato anche: il primo in fondo, dalla tastiera. */
  await maniglia(page, "security", prima[0]).focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => (await voci(page, "security"))[1]).toBe(prima[0]);
  /* Si va altrove senza passare dalla barra (l'assistente, «indietro»). */
  await page.evaluate(() => {
    for (const p of document.querySelectorAll("section.page")) p.classList.remove("active");
    document.getElementById("page-luci").classList.add("active");
  });
  await expect.poll(() => inModifica(page)).toBe("");
  await apri(page, "security");
  await expect.poll(() => voci(page, "security")).toEqual(prima);
  expect(await nascoste(page, "security")).toEqual([]);
  await expect(page.locator("#page-security .dm-sec-smoke")).toBeVisible();
  expect(await salvata(page)).toEqual({});
});

async function salvaFumoNascosto(page) {
  await apri(page, "security");
  await expect.poll(() => voci(page, "security")).toContain("fumo");
  await inModificaSu(page, "security");
  await occhio(page, "security", "fumo").click();
  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect.poll(() => inModifica(page)).toBe("");
  await expect(page.locator("#page-security .dm-sec-smoke")).toBeHidden();
}

test("«Ripristina» nel Config rimette la pagina subito, senza ricaricare", async ({ page }) => {
  test.setTimeout(150_000);
  await nellaCasaDemo(page);
  await salvaFumoNascosto(page);
  await page.evaluate(() => {
    apriConfigEntita();
    editorSwitch("visib");
  });
  const ripristina = page.locator('#ed-body [data-dm-disp-ripristina="security"]');
  await expect(ripristina).toBeVisible({ timeout: 15_000 });
  await ripristina.click();
  await expect.poll(() => salvata(page)).toEqual({});
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await expect(page.locator("#page-security .dm-sec-smoke")).toBeVisible({ timeout: 15_000 });
  expect(await nascoste(page, "security")).toEqual([]);
});

test("una disposizione tolta da un altro dispositivo se ne va anche da qui", async ({ page }) => {
  test.setTimeout(150_000);
  await nellaCasaDemo(page);
  await salvaFumoNascosto(page);
  /* La copia condivisa arriva senza la scelta della Sicurezza. */
  await page.evaluate(() => {
    localStorage.setItem("cd_disposizione", "{}");
    window.dispatchEvent(new Event("dashboardmodern:config-synced"));
  });
  await expect(page.locator("#page-security .dm-sec-smoke")).toBeVisible({ timeout: 10_000 });
  expect(await nascoste(page, "security")).toEqual([]);
});

test("chi chiama da fuori con la pagina la rimette quella pagina", async ({ page }) => {
  test.setTimeout(150_000);
  await nellaCasaDemo(page);
  await salvaFumoNascosto(page);
  /* Senza nessun evento: solo la chiamata, con la pagina. */
  await page.evaluate(() => {
    localStorage.setItem("cd_disposizione", "{}");
    window.dmDisposizione.applicaLaDisposizione(document.getElementById("page-security"));
  });
  expect(await nascoste(page, "security")).toEqual([]);
  await expect(page.locator("#page-security .dm-sec-smoke")).toBeVisible();
});

/* ── 3. l'ordine di serie resta di serie ───────────────────────────────── */

async function autoAlRovescio(page, testInfo) {
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await lAuto(page);
  await clickBottomTab(page, "ev", testInfo);
  await expect.poll(() => voci(page, "ev")).toContain("sessione");
  await page.waitForTimeout(600);
  const fabbrica = await voci(page, "ev");
  const rovescio = [...fabbrica].reverse();
  await page.evaluate((ordine) => {
    localStorage.setItem(
      "cd_disposizione",
      JSON.stringify({ ev: { ordine, nascosti: [], misure: {} } }),
    );
    window.dispatchEvent(new Event("storage"));
  }, rovescio);
  await expect.poll(() => voci(page, "ev")).toEqual(rovescio);
  /* Un riquadro che la pagina aggiunge dopo, in fondo (come la temperatura
   * dell'Auto o «Le tue entita'»). */
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.setAttribute("data-dm-blocco", "tardivo");
    d.setAttribute("data-dm-disp-nome", "Arrivato dopo");
    d.style.cssText = "height:90px;border-radius:16px;background:var(--card-bg,#fff)";
    document.querySelector("#lm-hero-card").parentElement.appendChild(d);
  });
  await expect.poll(() => voci(page, "ev")).toContain("tardivo");
  return { fabbrica, rovescio };
}

test("un riquadro arrivato dopo non fa diventare «di serie» l'ordine dell'utente", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const { fabbrica } = await autoAlRovescio(page, testInfo);
  await inModificaSu(page, "ev");
  await page.locator('[data-dm-disp-azione="ripristina"]').click();
  await expect.poll(() => voci(page, "ev")).toEqual([...fabbrica, "tardivo"]);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect.poll(() => inModifica(page)).toBe("");
  expect((await salvata(page)).ev).toBeUndefined();
  await expect.poll(() => voci(page, "ev")).toEqual([...fabbrica, "tardivo"]);
});

test("spegnere e riaccendere un riquadro e salvare non cancella la disposizione", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const { rovescio } = await autoAlRovescio(page, testInfo);
  await inModificaSu(page, "ev");
  await occhio(page, "ev", "sessione").click();
  await occhio(page, "ev", "sessione").click();
  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect.poll(() => inModifica(page)).toBe("");
  /* La scelta c'e' ancora, con l'ordine dell'utente (il riquadro nuovo sta
   * accanto a quello che di serie gli sta prima). */
  const scritta = (await salvata(page)).ev;
  expect(scritta?.ordine.filter((id) => id !== "tardivo")).toEqual(rovescio);
});

/* ── 4. la tastiera tiene il fuoco ─────────────────────────────────────── */

test("dalla tastiera si sposta di piu' posti senza riprendere la maniglia", async ({ page }) => {
  test.setTimeout(150_000);
  await nellaCasaDemo(page);
  await apri(page, "security");
  await expect.poll(() => voci(page, "security")).toContain("telecamere");
  const prima = await voci(page, "security");
  expect(prima.length).toBeGreaterThan(2);
  await inModificaSu(page, "security");
  /* Il fuoco si prende una volta sola. */
  await maniglia(page, "security", prima[0]).focus();
  for (let i = 1; i < prima.length; i += 1) {
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await voci(page, "security")).indexOf(prima[0])).toBe(i);
    /* Anche dopo che la pagina ha avuto tempo di ridisegnarsi. */
    await page.waitForTimeout(400);
    await expect(maniglia(page, "security", prima[0])).toBeFocused();
  }
  /* E chi non vede sente il nome di cosa si e' spostato. */
  await expect(page.locator("#page-security .dm-riordina-voce")).toContainText(
    `posizione ${prima.length} / ${prima.length}`,
  );
  await expect(page.locator("#page-security .dm-riordina-voce")).toContainText(/\p{L}{3,}: /u);
  await page.locator('[data-dm-disp-azione="annulla"]').click();
  await expect.poll(() => inModifica(page)).toBe("");
  await expect(page.locator(".dm-riordina-voce, [data-dm-disp-annuncio]")).toHaveCount(0);
});

test("in modifica, con la pagina che si aggiorna, i tasti non si rifanno", async ({ page }) => {
  test.setTimeout(120_000);
  await nellaCasaDemo(page);
  await apri(page, "security");
  await expect.poll(() => voci(page, "security")).toContain("telecamere");
  await inModificaSu(page, "security");
  await expect(page.locator("[data-dm-disp-annuncio]")).toContainText(/Modifica disposizione/);
  await page.evaluate(() => {
    for (const ctrl of document.querySelectorAll("#page-security [data-dm-disp-ctrl]"))
      ctrl.__vecchio = true;
  });
  /* Uno stato che cambia nella pagina (la pagina ridisegna un suo pezzo). */
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate((n) => {
      const nota = document.createElement("span");
      nota.textContent = String(n);
      document.querySelector("#page-security .dm-sec-smoke")?.appendChild(nota);
    }, i);
    await page.waitForTimeout(250);
  }
  const rifatti = await page.evaluate(
    () =>
      [...document.querySelectorAll("#page-security [data-dm-disp-ctrl]")].filter(
        (c) => !c.__vecchio,
      ).length,
  );
  expect(rifatti).toBe(0);
});

/* ── 5. Esc, le viste, il fantasma, il segno appeso ────────────────────── */

test("Esc con modifiche chiede conferma, e non chiude chi sta chiudendo un'altra finestra", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await nellaCasaDemo(page);
  await apri(page, "security");
  await expect.poll(() => voci(page, "security")).toContain("fumo");
  await inModificaSu(page, "security");
  await occhio(page, "security", "fumo").click();
  /* Una finestra aperta sopra: il suo Esc e' suo. */
  await page.evaluate(() => {
    const f = document.createElement("div");
    f.id = "finestra-di-prova";
    f.setAttribute("role", "dialog");
    f.setAttribute("aria-modal", "true");
    f.style.cssText = "position:fixed;inset:30%;background:#fff;z-index:99999";
    document.body.appendChild(f);
  });
  await page.keyboard.press("Escape");
  expect(await inModifica(page)).toBe("security");
  await page.evaluate(() => document.getElementById("finestra-di-prova").remove());
  /* La prima volta lo dice, la seconda esce. */
  await page.keyboard.press("Escape");
  expect(await inModifica(page)).toBe("security");
  await expect(page.locator("[data-dm-disp-barra] .dm-disp-conta")).toContainText("Esc");
  await page.keyboard.press("Escape");
  await expect.poll(() => inModifica(page)).toBe("");
  expect(await nascoste(page, "security")).toEqual([]);
});

test("le viste dell'Energia si spostano ma non si spengono", async ({ page }) => {
  test.setTimeout(120_000);
  await nellaCasaDemo(page);
  await apri(page, "energy");
  await expect.poll(async () => (await voci(page, "energy")).length).toBeGreaterThan(1);
  const viste = (await voci(page, "energy")).filter((id) => id.startsWith("#view-"));
  expect(viste.length).toBeGreaterThan(0);
  await inModificaSu(page, "energy");
  for (const id of viste) {
    await expect(maniglia(page, "energy", id)).toBeVisible();
    await expect(occhio(page, "energy", id)).toHaveCount(0);
  }
});

test("il fantasma che si trascina non ha id doppi", async ({ page }) => {
  test.setTimeout(120_000);
  await nellaCasaDemo(page);
  await apri(page, "security");
  await expect.poll(() => voci(page, "security")).toContain("telecamere");
  const prima = await voci(page, "security");
  await inModificaSu(page, "security");
  const presa = maniglia(page, "security", prima[0]);
  await presa.scrollIntoViewIfNeeded();
  const box = await presa.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 6 });
  const fantasma = await page.evaluate(() => {
    const f = document.querySelector("[data-dm-fantasma]");
    return f
      ? {
          id: f.querySelectorAll("[id]").length,
          diretta: f.querySelectorAll("video,iframe,img[src*='stream']").length,
        }
      : null;
  });
  await expect(page.locator("#page-security .dm-riordina-voce")).toContainText("in movimento");
  await page.mouse.up();
  expect(fantasma).toEqual({ id: 0, diretta: 0 });
});

test("un segno «sto trascinando» rimasto appeso non fa girare la pagina per sempre", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await nellaCasaDemo(page);
  await apri(page, "security");
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-dm-trascinando", "true");
    window.dispatchEvent(new Event("storage"));
  });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.hasAttribute("data-dm-trascinando")))
    .toBe(false);
  const giri = await page.evaluate(() => window.dmDisposizione.giri());
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.dmDisposizione.giri())).toBeLessThan(giri + 3);
});
