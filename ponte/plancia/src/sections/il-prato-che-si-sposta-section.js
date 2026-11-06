/* Spostare le zone sul prato dell'irrigazione.
 *
 * «Vedi come poter spostare le cose anche nei disegni.» Il prato della pagina
 * Irrigazione mette un irrigatore per zona su due file, una dietro e una
 * davanti; casa per casa, pero', il vialetto, l'aiuola e l'orto stanno dove
 * stanno. Nell'anteprima del Config ogni irrigatore ha la sua maniglia
 * (`disegni-che-si-spostano-section.js`) e si mette dove sta davvero in
 * giardino. Fra le zone non ci sono tubi: si sposta l'irrigatore con la sua
 * etichetta, e l'acqua (il getto, l'erba bagnata) gli va dietro da sola.
 *
 * Una zona si riconosce dalla sua elettrovalvola (`zona:switch.orto`), non dal
 * posto nell'elenco: riordinando le zone nel Config, ognuna resta dove l'ha
 * messa l'utente. Senza una scelta il prato non si tocca: le zone stanno dove
 * le mette `lawnPlacement`, con lo stile scritto dal prato.
 */

import { posizioniInUso, registraIlDisegno } from "./disegni-che-si-spostano-section.js";
import { doc, root, senzaCadere, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_IL_PRATO_CHE_SI_SPOSTA__";
const state = (root[KEY] ||= { installed: false });

export const DISEGNO_DEL_PRATO = "irrigazione";

/* Il prato cambia faccia sotto i 760 pixel (piu' basso, niente alberi): li'
 * comincia il disegno del telefono. */
const TELEFONO = "(max-width: 760px)";
const variante = () => (root.matchMedia?.(TELEFONO)?.matches ? "telefono" : "computer");

const visibile = (el) => {
  const r = el?.getBoundingClientRect?.();
  return Boolean(r && (r.width > 0 || r.height > 0));
};

function scatola() {
  const zone = doc?.querySelector?.("#page-irrigazione [data-dm-lawn] [data-dm-lawn-zones]");
  return zone && visibile(zone.closest("[data-dm-lawn]")) ? zone : null;
}

const zoneDi = (box) => [...(box?.querySelectorAll?.(":scope > .dm-zone[data-dm-pezzo]") || [])];

/* Il posto di serie, scritto dal prato nello stile in linea. */
function dalloStile(stile) {
  const x = /--zx:\s*(-?[\d.]+)%/.exec(stile || "");
  const y = /--zy:\s*(-?[\d.]+)%/.exec(stile || "");
  return x && y ? { x: Number(x[1]), y: Number(y[1]) } : null;
}

const stileDiSerie = (el) =>
  el.hasAttribute("data-dm-serie") ? el.getAttribute("data-dm-serie") : el.getAttribute("style");

/** Mette il prato com'e' scelto adesso. Senza una scelta tutto torna di serie. */
function posa() {
  const box = scatola();
  if (!box) return;
  const P = posizioniInUso(DISEGNO_DEL_PRATO, variante());
  for (const el of zoneDi(box)) {
    const punto = P[el.getAttribute("data-dm-pezzo")];
    if (punto) {
      if (!el.hasAttribute("data-dm-serie")) el.setAttribute("data-dm-serie", el.getAttribute("style") || "");
      el.style.setProperty("--zx", `${punto.x}%`);
      el.style.setProperty("--zy", `${punto.y}%`);
    } else if (el.hasAttribute("data-dm-serie")) {
      el.setAttribute("style", el.getAttribute("data-dm-serie"));
      el.removeAttribute("data-dm-serie");
    }
  }
  /* Il prato e' un disegno e basta (`aria-hidden`): in modifica, pero', dentro
   * ci sono le maniglie, e devono poterle trovare anche la tastiera e chi
   * legge lo schermo. */
  const prato = box.closest("[data-dm-lawn]");
  if (prato && !box.querySelector(":scope > [data-dm-disegno-strato]"))
    prato.setAttribute("aria-hidden", "true");
}

function nodi() {
  const box = scatola();
  if (!box) return [];
  box.closest("[data-dm-lawn]")?.removeAttribute("aria-hidden");
  return zoneDi(box)
    .map((el) => {
      const nome = el.querySelector(".dm-zone-tag em")?.textContent?.trim() || t("Zona", "Zone");
      return {
        id: el.getAttribute("data-dm-pezzo"),
        nome,
        centro: dalloStile(stileDiSerie(el)),
        pezzi: () => [el.querySelector(".dm-sprinkler"), el.querySelector(".dm-zone-tag")].filter(Boolean),
      };
    })
    .filter((nodo) => nodo.centro);
}

function iscrivi() {
  registraIlDisegno({
    id: DISEGNO_DEL_PRATO,
    pagina: "irrigazione",
    nome: () => t("Prato dell'irrigazione", "Irrigation lawn"),
    scatola,
    variante,
    nodi,
    ridisegna: posa,
  });
}

/** Dopo che la pagina Irrigazione ha riscritto il prato: la scelta
 * dell'utente, e le maniglie se si sta modificando. */
export function dopoIlPrato() {
  posa();
  iscrivi();
}

export function installIlPratoCheSiSposta() {
  if (!doc || state.installed) return;
  state.installed = true;
  iscrivi();
  root.matchMedia?.(TELEFONO)?.addEventListener?.("change", posa);
}

/* Per le prove. */
root.dmPrato = { posa };

senzaCadere(installIlPratoCheSiSposta);
