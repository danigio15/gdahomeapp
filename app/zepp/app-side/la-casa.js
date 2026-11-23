/* La strada verso la casa, dentro l'app Zepp.
 *
 * Gli altri orologi la casa non la toccano: passano dall'app GdAHome sul
 * telefono (`IlTramiteDellOrologio.kt`, `LOrologio.swift`). Un Amazfit non
 * puo': il servizio di fianco gira dentro l'app Zepp, e dall'app Zepp
 * all'app GdAHome non c'e' nessuna porta. Allora l'Amazfit si abbina alla
 * casa **come un telefono in piu'**, con lo stesso codice del riquadro
 * «Abbina un telefono» nella scheda GdAHome di Home Assistant: compare nella
 * console fra i telefoni, e da li' si stacca. Con la sua chiave chiede solo
 * la fotografia e un comando (`ponte/src/il-polso.js`).
 *
 * Il filo lo tiene il centralino (`il-filo.js`): qui si tiene il legame
 * nella memoria delle impostazioni dell'app Zepp, e si traduce `fetch` di
 * Zepp in quello che il filo si aspetta.
 */

import { settingsLib } from "@zeppos/zml/base-side";

import { daEsadecimale, inByte } from "./cifra.js";
import { ilCaso } from "./caso.js";
import { abbina as abbinaAlCentralino, FiloRotto, IlFilo } from "./il-filo.js";

/* Dove si tengono le cose, nella memoria delle impostazioni dell'app Zepp. */
export const CHIAVI = Object.freeze({
  codice: "codice",
  vetrina: "vetrina",
  stato: "stato",
  legame: "legame",
  stacca: "stacca",
});

/* La posta: `fetch` dell'app Zepp vuole un oggetto e torna `{status, body}`,
 * con `body` gia' letto o ancora testo a seconda del telefono. */
async function posta(url, corpo) {
  const risposta = await fetch({
    url,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  let letto = risposta?.body;
  if (typeof letto === "string") {
    try {
      letto = JSON.parse(letto);
    } catch (_errore) {
      letto = null;
    }
  }
  return { stato: Number(risposta?.status) || 0, corpo: letto };
}

function ilLegame() {
  try {
    const legame = JSON.parse(settingsLib.getItem(CHIAVI.legame) || "null");
    return legame && typeof legame.chiave === "string" && legame.chiave.length === 64
      ? legame
      : null;
  } catch (_errore) {
    return null;
  }
}

export function abbinato() {
  return Boolean(ilLegame());
}

export function scriviLoStato(collegato, testo, altro = {}) {
  settingsLib.setItem(
    CHIAVI.stato,
    JSON.stringify({ collegato, testo, quando: Date.now(), ...altro }),
  );
}

/* Il filo di adesso: uno per il servizio di fianco, finche' il legame e'
 * quello. */
let filo = null;
let diQualeChiave = "";

function ilFilo() {
  const legame = ilLegame();
  if (!legame) return null;
  if (!filo || diQualeChiave !== legame.chiave) {
    const { caso } = ilCaso({ segreto: daEsadecimale(legame.chiave) });
    filo = new IlFilo({ legame, posta, caso });
    diQualeChiave = legame.chiave;
  }
  return filo;
}

/** Il codice scritto nelle impostazioni: la stretta di mano col centralino. */
export async function abbina(codice) {
  const { caso, daDove } = ilCaso({ segreto: inByte(String(codice || "")) });
  try {
    const legame = await abbinaAlCentralino({ codice, posta, caso });
    settingsLib.setItem(CHIAVI.legame, JSON.stringify(legame));
    filo = null;
    return { ok: true, testo: "Collegato alla casa", daDove };
  } catch (errore) {
    return {
      ok: false,
      testo: errore instanceof FiloRotto ? errore.message : "Non ha funzionato: riprova",
      daDove,
    };
  }
}

/* Uno staccato dalla console: le chiavi non valgono piu', e si dice di
 * ricollegarlo. */
function seStaccato(errore) {
  if (errore instanceof FiloRotto && errore.staccato) {
    settingsLib.removeItem(CHIAVI.legame);
    filo = null;
    scriviLoStato(false, errore.message);
  }
}

export async function laFoto() {
  const ilMio = ilFilo();
  if (!ilMio) return { abbinato: false };
  try {
    const risposta = await ilMio.chiedi({ t: "foto" });
    if (risposta.ok !== true) return { abbinato: true, testo: String(risposta.testo || "") };
    return { abbinato: true, foto: risposta.foto };
  } catch (errore) {
    seStaccato(errore);
    return {
      abbinato: !(errore instanceof FiloRotto && errore.staccato),
      testo: errore?.message || "",
    };
  }
}

export async function comando({ id, cosa, valore }) {
  const ilMio = ilFilo();
  if (!ilMio) return { ok: false, testo: "L'orologio non è collegato alla casa" };
  try {
    const risposta = await ilMio.chiedi({
      t: "comando",
      id,
      cosa,
      ...(valore != null ? { valore } : {}),
    });
    return {
      ok: risposta.ok === true,
      testo: String(risposta.testo || (risposta.ok ? "Fatto" : "Non è partito")),
      ...(risposta.foto ? { foto: risposta.foto } : {}),
    };
  } catch (errore) {
    seStaccato(errore);
    return { ok: false, testo: errore?.message || "Non è partito" };
  }
}

/** Stacca l'orologio da qui: le chiavi si buttano. Dalla casa si stacca in console. */
export function dimentica() {
  settingsLib.removeItem(CHIAVI.legame);
  filo = null;
  scriviLoStato(false, "");
}
