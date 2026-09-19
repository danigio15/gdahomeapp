/* Il cruscotto di chi installa, dentro Home Assistant.
 *
 * Questo pannello non disegna un cruscotto: **mostra quello che esiste gia'**,
 * sul quadro. Rifarlo qui vorrebbe dire un terzo posto dove vivono le stesse
 * regole — cos'e' una casa muta, quando un collaudo e' chiuso, quando un
 * impianto e' da guardare — e tre posti che dicono la stessa cosa prima o poi
 * ne dicono tre diverse.
 *
 * ─── Perche' un riquadro e non un collegamento ────────────────────────────
 *
 * Perche' l'installatore Home Assistant ce l'ha **sua**, e questa e' casa sua.
 * Il vincolo di riservatezza del progetto riguarda l'Home Assistant dei
 * clienti — li' dentro un elenco di altri clienti non ci va mai — e qui non
 * siamo li'.
 *
 * ─── La cosa che sorprende, detta prima che sorprenda ─────────────────────
 *
 * La chiave della flotta il cruscotto se la tiene nella memoria del browser, e
 * i browser quella memoria la tengono **separata** per una pagina dentro
 * un'altra: e' una difesa contro chi segue le persone da un sito all'altro, e
 * fa bene a esistere. L'effetto pero' e' che la chiave gia' incollata sul
 * cruscotto aperto da solo qui dentro non c'e', e va incollata una volta
 * anche qui. Da quella volta in poi resta.
 *
 * Su qualche browser — Safari soprattutto — quella memoria puo' non restare
 * proprio. Per questo in cima c'e' sempre il collegamento per aprirlo fuori:
 * non e' un ripiego nascosto, e' la via di scampo scritta dove si vede.
 */

/* Il nome dell'elemento porta la firma degli asset, come fa `panel.js`: due
 * versioni dell'integrazione nella stessa pagina non si contendono lo stesso
 * nome, che in `customElements` si registra una volta sola e poi e' quello. */
const TAG = (() => {
  try {
    const m = /dashboardmodern_static\/([a-z0-9]+)\//.exec(import.meta.url);
    if (m?.[1]) return `dashboardmodern-cruscotto-${m[1].slice(0, 8)}`;
  } catch (_error) {}
  return "dashboardmodern-cruscotto";
})();

/* Dove sta, nella memoria del browser, il fatto che l'avviso sia gia' stato
 * letto. Sta qui e non sul quadro perche' e' una cosa di **questo** riquadro. */
const LETTO = "gdahome.cruscotto.avviso-letto";

const STILE = `
  :host {
    display: block;
    height: 100%;
    background: var(--primary-background-color, #fafafa);
    color: var(--primary-text-color, #212121);
  }
  .tutto {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .avviso {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--card-background-color, #fff);
    border-bottom: 1px solid var(--divider-color, #e0e0e0);
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .avviso p {
    margin: 0;
    flex: 1 1 320px;
    min-width: 0;
  }
  .tasti {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  a.tasto,
  button.tasto {
    font: inherit;
    font-weight: 500;
    color: var(--primary-color, #03a9f4);
    background: none;
    border: 1px solid var(--divider-color, #e0e0e0);
    border-radius: 8px;
    padding: 7px 13px;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
  }
  a.tasto:hover,
  button.tasto:hover {
    background: var(--secondary-background-color, #f0f0f0);
  }
  a.tasto:focus-visible,
  button.tasto:focus-visible {
    outline: 2px solid var(--primary-color, #03a9f4);
    outline-offset: 2px;
  }
  iframe {
    flex: 1 1 auto;
    width: 100%;
    border: 0;
    display: block;
  }
  .senza {
    padding: 24px 16px;
    text-align: center;
    color: var(--secondary-text-color, #727272);
  }
`;

class CruscottoDiChiInstalla extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._dove = "";
    this._disegnato = false;
  }

  /* Home Assistant passa `hass` a ogni cambio di stato. Qui non serve niente
   * di quello che c'e' dentro, e prenderlo per poi ignorarlo vorrebbe dire
   * ridisegnare a ogni sensore che si muove. */
  set hass(_valore) {}

  set panel(valore) {
    this._dove = String(valore?.config?.dove || "");
    this._disegnato = false;
    this.disegna();
  }

  connectedCallback() {
    if (!this._disegnato) this.disegna();
  }

  /** Se l'avviso e' gia' stato letto. Un browser che non lo sa dire dice no. */
  get letto() {
    try {
      return localStorage.getItem(LETTO) === "si";
    } catch (_error) {
      return false;
    }
  }

  segnaLetto() {
    try {
      localStorage.setItem(LETTO, "si");
    } catch (_error) {
      /* Memoria negata: l'avviso ricompare, ed e' meglio che sparire. */
    }
  }

  disegna() {
    this._disegnato = true;
    const radice = this.shadowRoot;
    if (!radice) return;
    if (!this._dove) {
      radice.innerHTML = `<style>${STILE}</style>
        <div class="senza">
          <p>Non so a quale quadro mandarti: manca l'indirizzo.</p>
        </div>`;
      return;
    }
    const dove = this._dove;
    const avviso = this.letto
      ? ""
      : `<div class="avviso">
           <p>
             La prima volta la chiave va incollata anche qui: i browser tengono
             separata la memoria di una pagina aperta dentro un'altra. Da qui
             in poi resta. Se non restasse, aprilo fuori.
           </p>
           <span class="tasti">
             <button type="button" class="tasto" data-ho-capito>Ho capito</button>
           </span>
         </div>`;
    radice.innerHTML = `<style>${STILE}</style>
      <div class="tutto">
        ${avviso}
        <div class="avviso">
          <p>Il cruscotto dei tuoi impianti, sul quadro di gdahome.</p>
          <span class="tasti">
            <a class="tasto" href="${dove}" target="_blank" rel="noopener noreferrer"
              >Aprilo fuori da qui</a
            >
          </span>
        </div>
        <iframe
          title="Il cruscotto dei tuoi impianti"
          src="${dove}"
          allow="clipboard-write"
          referrerpolicy="no-referrer"
        ></iframe>
      </div>`;
    radice.querySelector("[data-ho-capito]")?.addEventListener("click", () => {
      this.segnaLetto();
      this.disegna();
    });
  }
}

if (!customElements.get(TAG)) customElements.define(TAG, CruscottoDiChiInstalla);

export { TAG, CruscottoDiChiInstalla };
