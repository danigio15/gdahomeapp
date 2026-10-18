/* «Luce scale» non si leggeva.
 *
 * Una card dei Dispositivi della Home accesa e SENZA immagine, col tema scuro,
 * restava azzurro chiaro: la versione notturna del guscio stava sotto
 * `body.dark-theme`, che nessuno mette, mentre il nome prendeva il testo del
 * tema scuro, quasi bianco. Bianco su azzurro chiaro.
 *
 * Qui si misura il contrasto vero fra il nome (e lo stato) e ogni colore del
 * fondo della card — i colori trasparenti dello sfumato stesi su quelli pieni
 * e sul fondo della carta — e deve stare almeno a 4,5. Col tema scuro e con
 * quello chiaro; col chiaro la card accesa resta l'azzurro di sempre.
 * Quando si tolgono le righe della correzione, la prova al buio cade. */
import { expect, test } from "@playwright/test";
import { STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const STATI = {
  ...STATI_A_MURO,
  "switch.scale": { state: "on", attributes: { friendly_name: "Luce scale" } },
  "switch.boiler": { state: "off", attributes: { friendly_name: "Boiler" } },
};

const DISPOSITIVI = [
  { name: "Luce scale", icon: "💡", switch: "switch.scale" },
  { name: "Boiler", icon: "🔥", switch: "switch.boiler" },
];

/* Il contrasto peggiore fra un testo della card e i colori del suo fondo. */
function contrastoPeggiore(page, selettore) {
  return page.evaluate((sel) => {
    const card = document.querySelector("#dev-card-0");
    const testo = card.querySelector(sel);
    /* I colori, scritti come rgb()/rgba() o come color(srgb …) — il modo in
     * cui il browser restituisce un color-mix. */
    const leggi = (valore) => {
      const colori = [];
      for (const m of valore.matchAll(/rgba?\(([^)]+)\)/g)) {
        const [r, g, b, a = 1] = m[1]
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        colori.push({ r, g, b, a });
      }
      for (const m of valore.matchAll(/color\(srgb ([^)]+)\)/g)) {
        const [r, g, b, a = 1] = m[1]
          .split(/[\s/]+/)
          .filter(Boolean)
          .map(Number);
        colori.push({ r: r * 255, g: g * 255, b: b * 255, a });
      }
      return colori;
    };
    const stile = getComputedStyle(card);
    const carta = leggi(getComputedStyle(document.body).backgroundColor)[0] || {
      r: 255,
      g: 255,
      b: 255,
      a: 1,
    };
    const colori = [...leggi(stile.backgroundImage), ...leggi(stile.backgroundColor)].filter(
      (c) => c.a > 0,
    );
    const pieni = colori.filter((c) => c.a >= 1);
    if (!pieni.length) pieni.push(carta);
    const fondi = [...pieni];
    for (const c of colori.filter((x) => x.a < 1))
      for (const sotto of pieni)
        fondi.push({
          r: c.r * c.a + sotto.r * (1 - c.a),
          g: c.g * c.a + sotto.g * (1 - c.a),
          b: c.b * c.a + sotto.b * (1 - c.a),
        });
    const luce = ({ r, g, b }) => {
      const lin = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const colore = leggi(getComputedStyle(testo).color)[0];
    const rapporti = fondi.map((f) => {
      const [chiaro, scuro] = [luce(colore), luce(f)].sort((x, y) => y - x);
      return (chiaro + 0.05) / (scuro + 0.05);
    });
    return {
      peggiore: Math.min(...rapporti),
      fondo: stile.backgroundImage,
      luceDelFondo: Math.max(...fondi.map(luce)),
    };
  }, selettore);
}

for (const tema of ["dark", "light"]) {
  test(`col tema ${tema === "dark" ? "scuro" : "chiaro"} il dispositivo acceso senza immagine si legge`, async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      premium: false,
      muro: null,
      stati: STATI,
      caselle: { cd_devices: DISPOSITIVI },
    });
    await page.evaluate((scelto) => {
      document.documentElement.setAttribute("data-theme", scelto);
      window.buildDeviceCards();
    }, tema);
    const accesa = page.locator("#dev-card-0");
    await expect(accesa).toHaveClass(/\bon\b/);
    await expect(accesa).not.toHaveClass(/dm-rq/);
    await expect(accesa.locator(".dev-nm")).toHaveText("Luce scale");
    await expect(page.locator("#dev-card-1")).not.toHaveClass(/\bon\b/);

    /* Lo stato col chiaro e' l'azzurro scuro del guscio sull'azzurro chiaro
     * (4,47): il tema chiaro qui non si tocca, e si misura il nome. */
    for (const sel of tema === "dark" ? [".dev-nm", ".dev-st"] : [".dev-nm"]) {
      const misura = await contrastoPeggiore(page, sel);
      expect(misura.peggiore, `${sel} su ${misura.fondo}`).toBeGreaterThanOrEqual(4.5);
      if (tema === "dark") {
        /* Al buio il fondo della card accesa e' scuro, non l'azzurro chiaro. */
        expect(misura.luceDelFondo, misura.fondo).toBeLessThan(0.2);
      } else {
        /* Col chiaro, la card accesa e' quella di sempre. */
        expect(misura.fondo).toBe(
          "linear-gradient(135deg, rgb(224, 242, 254), rgb(186, 230, 253))",
        );
      }
    }
  });
}
