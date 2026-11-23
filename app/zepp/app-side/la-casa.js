/* La strada vera verso la casa: NON C'E' ANCORA. Qui c'e' dove andra'.
 *
 * Gli altri orologi la casa non la toccano: passano dall'app GdAHome sul
 * telefono, che ha le chiavi (`IlTramiteDellOrologio.kt`, `LOrologio.swift`).
 * Un Amazfit non puo': il servizio di fianco gira dentro l'app Zepp, e
 * dall'app Zepp all'app GdAHome non c'e' nessuna porta — su iPhone nemmeno a
 * cercarla, perche' GdAHome in sottofondo e' ferma.
 *
 * Quindi l'Amazfit si abbina alla casa **come un telefono in piu'**, con le
 * sue chiavi e con lo stesso codice dello stesso riquadro, «Abbina un
 * telefono» nella scheda GdAHome di Home Assistant. Compare nella console fra
 * i telefoni, e da li' si stacca quando si vuole, senza toccare il telefono
 * vero. Come andra', in breve (la proposta intera sta col lavoro):
 *
 *  1. abbinamento: il codice scritto nelle impostazioni dell'app Zepp. Si fa
 *     la stessa stretta di `ponte/src/cifra.js` (`abbina: 2`: X25519, HKDF
 *     col codice dentro, AES-256-GCM), e la casa consegna segno e chiave del
 *     filo solo se la conferma si apre. Il codice non resta da nessuna parte;
 *  2. il filo: il servizio di fianco ha `fetch` e niente WebSocket, quindi
 *     non si tiene un filo aperto. Ogni domanda e' una busta chiusa con la
 *     chiave del filo, mandata al centralino per HTTPS; il centralino la
 *     passa alla casa sul filo che la casa tiene gia' aperto, e riporta la
 *     risposta. Instrada e non legge, come oggi;
 *  3. le domande sono due, «la fotografia» e «un comando», e la risposta e'
 *     la stessa fotografia degli altri orologi (`docs` della proposta). La
 *     prepara la casa, non il telefono: serrature e antifurto restano fuori,
 *     come nelle ricette dell'orologio.
 *
 * Mancano: la porta HTTP del centralino, le due domande nel ponte, e la
 * cifratura qui in JavaScript (senza `crypto` del sistema: una libreria
 * piccola, da scegliere). Finche' non ci sono, l'orologio dice la verita':
 * non si collega, e la casa d'esempio si accende dalle impostazioni.
 */

import { settingsLib } from "@zeppos/zml/base-side";

/* Dove si tengono le cose, nella memoria delle impostazioni dell'app Zepp. */
export const CHIAVI = Object.freeze({
  codice: "codice",
  vetrina: "vetrina",
  stato: "stato",
  legame: "legame",
});

const NON_ANCORA =
  "Questa versione non sa ancora collegarsi alla casa. Per provarla, accendi la casa d'esempio.";

export function abbinato() {
  return Boolean(settingsLib.getItem(CHIAVI.legame));
}

export function scriviLoStato(collegato, testo) {
  settingsLib.setItem(CHIAVI.stato, JSON.stringify({ collegato, testo, quando: Date.now() }));
}

/** Il codice scritto nelle impostazioni: qui partira' la stretta di mano. */
export async function abbina(codice) {
  const pulito = String(codice || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
  if (pulito.length !== 16) {
    return { ok: false, testo: "Il codice ha sedici lettere e numeri: ricontrollalo." };
  }
  return { ok: false, testo: NON_ANCORA };
}

export async function laFoto() {
  return { abbinato: false, testo: NON_ANCORA };
}

export async function comando() {
  return { ok: false, testo: NON_ANCORA };
}

/** Stacca l'orologio da qui: le chiavi si buttano. Dalla casa si stacca in console. */
export function dimentica() {
  settingsLib.removeItem(CHIAVI.legame);
  scriviLoStato(false, "");
}
