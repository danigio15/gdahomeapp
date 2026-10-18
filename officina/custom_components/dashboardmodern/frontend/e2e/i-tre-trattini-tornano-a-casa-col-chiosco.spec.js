/* I tre trattini riportano a Home Assistant anche col chiosco acceso.
 *
 * «Su Google Chrome con la modalita' kiosk i 3 trattini per tornare a Home
 * Assistant non vanno. Su iPhone, dall'app, funziona. Su Safari nemmeno. Se
 * tolgo il kiosk va tutto.»
 *
 * Il chiosco stende la plancia sopra tutta la pagina di Home Assistant,
 * barra laterale compresa, e quando si preme ☰ deve farsi da parte. Lo faceva
 * contando i `hass-toggle-menu` che passano dalla finestra di Home Assistant:
 * uno, giu'; un altro, su. Ma il ☰ della plancia di quell'evento ne mandava
 * DUE — uno a `home-assistant` e uno a `home-assistant-main` — e il chiosco
 * scendeva e risaliva nello stesso istante. Su un telefono lo salvava il
 * cassetto, che si apre sopra la pagina e si fa vedere aperto; su uno schermo
 * largo la barra laterale non e' un cassetto, non si «apre», e la plancia
 * restava sopra a coprirla.
 *
 * Qui si rifa' la casa come la costruisce Home Assistant — `home-assistant` >
 * `home-assistant-main` > `ha-drawer` con la barra laterale e il contenuto —
 * con le sue regole: stretto il cassetto si apre sopra la pagina, largo la
 * barra sta di lato e il comando la allarga o la stringe. E la plancia ci sta
 * dentro nei due modi in cui ci arriva: dentro la tessera nostra di una volta
 * e dentro la tessera «pagina web» di Home Assistant che apre `apri.html`.
 */
import { expect, test } from "@playwright/test";

const LARGHEZZA_BARRA = 256;
const BARRA_STRETTA = 56;

const CASA = (ospite) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#fafafa;font-family:sans-serif}</style>
</head><body><home-assistant></home-assistant>
<script type="module">
const stretto = () => matchMedia("(max-width: 870px)").matches;

/* La tessera nostra di una volta: un'ombra e il riquadro dentro. */
class GdahomePlancia extends HTMLElement {
  constructor() {
    super();
    const ombra = this.attachShadow({ mode: "open" });
    ombra.innerHTML =
      "<style>:host{display:block;height:100%}.tutto{height:100%}" +
      "iframe{border:0;width:100%;height:100%;display:block}</style>" +
      '<div class="tutto"><iframe title="gdahome"></iframe></div>';
  }
}
customElements.define("gdahome-plancia", GdahomePlancia);

/* La tessera «pagina web» di Home Assistant, come la scrive lui. */
class HuiIframeCard extends HTMLElement {
  constructor() {
    super();
    const ombra = this.attachShadow({ mode: "open" });
    ombra.innerHTML =
      "<style>:host{display:block;height:100%}ha-card{display:block;height:100%;overflow:hidden}" +
      "#root{width:100%;height:100%;position:relative}" +
      "iframe{position:absolute;inset:0;border:0;width:100%;height:100%}</style>" +
      '<ha-card><div id="root"><iframe title="gdahome" data-gdahome="apri"></iframe></div></ha-card>';
  }
}
customElements.define("hui-iframe-card", HuiIframeCard);

class HuiRoot extends HTMLElement {
  constructor() {
    super();
    const ombra = this.attachShadow({ mode: "open" });
    ombra.innerHTML =
      "<style>:host{display:block;height:100%}" +
      ".header{position:fixed;top:0;left:var(--mdc-drawer-width,0);right:0;height:56px;z-index:4;background:#03a9f4;color:#fff}" +
      "#view{padding-top:56px;height:calc(100% - 56px);box-sizing:content-box}" +
      /* Nella Plancia di GdAHome la barra della dashboard non c'e': la toglie
       * chi la apre, la tessera o \`apri.html\`, con questo stesso foglio. */
      ".header{display:none!important}:host{--header-height:0px}#view{padding-top:0;height:100%}" +
      "hui-panel-view{display:block;height:100%}</style>" +
      '<div class="header" id="testata">Home Assistant</div><div id="view"><hui-panel-view></hui-panel-view></div>';
    const tessera = document.createElement("${ospite}");
    ombra.querySelector("hui-panel-view").append(tessera);
  }
}
customElements.define("hui-root", HuiRoot);

/* home-assistant-main: le regole del cassetto sono quelle di Home Assistant. */
class HomeAssistantMain extends HTMLElement {
  constructor() {
    super();
    const ombra = this.attachShadow({ mode: "open" });
    ombra.innerHTML =
      "<style>:host{display:block;height:100%}" +
      "ha-drawer{display:block;height:100%}" +
      "aside{position:fixed;top:0;left:0;bottom:0;width:var(--mdc-drawer-width);z-index:6;background:#1e293b;color:#fff;transition:transform .15s}" +
      "ha-drawer[data-tipo=modal] aside{transform:translateX(-100%);width:${LARGHEZZA_BARRA}px}" +
      "ha-drawer[data-tipo=modal][open] aside{transform:none;z-index:200}" +
      ".velo{display:none;position:fixed;inset:0;z-index:5;background:rgba(0,0,0,.32)}" +
      "ha-drawer[data-tipo=modal][open] .velo{display:block}" +
      ".contenuto{height:100%;padding-left:var(--mdc-drawer-width);box-sizing:border-box}" +
      "ha-drawer[data-tipo=modal] .contenuto{padding-left:0}" +
      "ha-sidebar{display:block;height:100%}ha-sidebar a{display:block;padding:14px;color:#fff}</style>" +
      '<ha-drawer><aside><ha-sidebar><a href="#" id="panoramica">Panoramica</a></ha-sidebar></aside>' +
      '<div class="velo"></div><div class="contenuto"><hui-root></hui-root></div></ha-drawer>';
    this.cassetto = ombra.querySelector("ha-drawer");
    ombra.querySelector(".velo").addEventListener("click", () => this.chiudi());
    this.addEventListener("hass-toggle-menu", (ev) => {
      window.__MENU__.push(ev.detail ?? null);
      const hass = this.getRootNode().host.hass;
      if (this.stretto()) {
        if (this.cassetto.hasAttribute("open")) this.chiudi();
        else this.cassetto.setAttribute("open", "");
      } else {
        hass.dockedSidebar = ev.detail?.open ? "docked" : hass.dockedSidebar === "auto" ? "docked" : "auto";
      }
      this.disegna();
    });
    addEventListener("resize", () => this.disegna());
  }
  connectedCallback() {
    this.disegna();
  }
  stretto() {
    const hass = this.getRootNode?.().host?.hass;
    return stretto() || hass?.dockedSidebar === "always_hidden";
  }
  chiudi() {
    this.cassetto.removeAttribute("open");
  }
  disegna() {
    const hass = this.getRootNode?.().host?.hass || { dockedSidebar: "docked" };
    const modale = this.stretto();
    this.cassetto.dataset.tipo = modale ? "modal" : "";
    if (!modale) this.cassetto.removeAttribute("open");
    const larga = hass.dockedSidebar === "docked" ? ${LARGHEZZA_BARRA} : ${BARRA_STRETTA};
    this.style.setProperty("--mdc-drawer-width", modale ? "0px" : larga + "px");
    this.cassetto.querySelector("aside").style.width = modale ? "" : larga + "px";
  }
}
customElements.define("home-assistant-main", HomeAssistantMain);

class HomeAssistant extends HTMLElement {
  constructor() {
    super();
    this.hass = { dockedSidebar: "docked" };
    const ombra = this.attachShadow({ mode: "open" });
    ombra.innerHTML =
      "<style>:host{display:block;height:100%}</style><home-assistant-main></home-assistant-main>";
  }
}
window.__MENU__ = [];
window.__PASSATI__ = 0;
addEventListener("hass-toggle-menu", () => (window.__PASSATI__ += 1), true);
customElements.define("home-assistant", HomeAssistant);
const main = document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main");
main.disegna();
const tessera = main.shadowRoot.querySelector("hui-root").shadowRoot.querySelector("${ospite}");
tessera.shadowRoot.querySelector("iframe").src = "/legacy/dashboard.html?dmi=e2e-chiosco";
window.__CASA_PRONTA__ = true;
</script></body></html>`;

const OSPITI = {
  "tessera nostra": "gdahome-plancia",
  "pagina web di Home Assistant": "hui-iframe-card",
};
const MISURE = {
  stretto: { width: 390, height: 844 },
  largo: { width: 1280, height: 800 },
};

async function apriLaCasa(page, { ospite, chiosco, misura }) {
  await page.setViewportSize(MISURE[misura]);
  await page.addInitScript(() => {
    class PresaFinta extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        setTimeout(() => this.dispatchEvent(new Event("open")), 0);
      }
      send() {}
      close() {}
    }
    window.WebSocket = PresaFinta;
    /* Una casa gia' collegata: senza, la plancia apre il primo collegamento. */
    try {
      localStorage.setItem(
        "cd_e2e-chiosco_cd_connection",
        JSON.stringify({ token: "e2e-token", ws_url: "ws://home-assistant.test/api/websocket" }),
      );
    } catch (_errore) {}
  });
  const indirizzo = `http://127.0.0.1:4173/casa-col-chiosco-${ospite}.html`;
  await page.route(`${indirizzo}*`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: CASA(ospite) }),
  );
  await page.goto(`${indirizzo}?kiosk=${chiosco ? 1 : 0}`);
  await page.waitForFunction(() => window.__CASA_PRONTA__ === true);
  const plancia = page.frameLocator("iframe");
  await plancia.locator(".ha-menu-btn").waitFor();
  const html = plancia.locator("html");
  if (chiosco) await expect(html).toHaveAttribute("data-dm-ios-kiosk", "true");
  else await expect(html).not.toHaveAttribute("data-dm-ios-kiosk", "true");
  return plancia;
}

/* Cosa c'e' davvero sotto il dito, attraverso tutte le ombre. */
function sottoIlDito(page, x, y) {
  return page.evaluate(
    ([x, y]) => {
      let radice = document;
      let trovato = null;
      for (let giri = 0; giri < 20; giri += 1) {
        const qui = radice.elementFromPoint(x, y);
        if (!qui || qui === trovato) break;
        trovato = qui;
        if (!qui.shadowRoot) break;
        radice = qui.shadowRoot;
      }
      const strada = [];
      for (let nodo = trovato; nodo; nodo = nodo.parentNode || nodo.host) {
        if (nodo.localName) strada.push(nodo.localName);
      }
      return strada;
    },
    [x, y],
  );
}

const nellaBarra = async (page) => (await sottoIlDito(page, 24, 300)).includes("ha-sidebar");

for (const [nomeOspite, ospite] of Object.entries(OSPITI)) {
  for (const misura of Object.keys(MISURE)) {
    for (const chiosco of [true, false]) {
      test(`☰ apre il menu di Home Assistant — ${nomeOspite}, ${misura}, chiosco ${
        chiosco ? "acceso" : "spento"
      }`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "desktop", "la misura la decide la prova");
        const plancia = await apriLaCasa(page, { ospite, chiosco, misura });
        if (chiosco) {
          expect(await nellaBarra(page), "il chiosco copre gia' la barra").toBe(false);
        }
        await plancia.locator(".ha-menu-btn").click();
        /* Un comando solo: due si annullano. */
        await expect.poll(() => page.evaluate(() => window.__MENU__.length)).toBe(1);
        expect(await page.evaluate(() => window.__PASSATI__)).toBe(1);
        await expect
          .poll(() => nellaBarra(page), "la barra di Home Assistant non si vede")
          .toBe(true);
        if (misura === "largo") {
          /* Largo la barra si apre coi nomi, non si stringe. */
          const larga = await page.evaluate(
            () => document.querySelector("home-assistant").hass.dockedSidebar,
          );
          if (chiosco) expect(larga).toBe("docked");
        }
        if (process.env.DM_FOTO && chiosco) {
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `${process.env.DM_FOTO}/${ospite}-${misura}-dopo.png`,
          });
        }
        if (!chiosco) return;

        /* La voce della barra si tocca davvero: niente sopra di lei. */
        expect(await sottoIlDito(page, 24, 30)).toContain("ha-sidebar");

        /* E tornando sulla plancia, la plancia torna a tutto schermo. */
        if (misura === "stretto") {
          await page.mouse.click(MISURE.stretto.width - 20, 400);
        } else {
          await page.mouse.click(800, 400);
        }
        await expect.poll(() => nellaBarra(page), "la plancia non e' tornata sopra").toBe(false);
        await expect(plancia.locator("html")).toHaveAttribute("data-dm-ios-kiosk", "true");
      });
    }
  }
}
