/* Il servizio di fianco: gira dentro l'app Zepp, sul telefono.
 *
 * E' l'equivalente di `IlTramiteDellOrologio.kt`: l'orologio gli chiede la
 * fotografia o un comando, lui risponde. La differenza e' da chi va a
 * chiedere: qui non c'e' l'app GdAHome a fare da tramite, e la strada verso
 * la casa e' sua (`la-casa.js`). Con la casa d'esempio accesa nelle
 * impostazioni, risponde la vetrina (`vetrina.js`).
 */

import { BaseSideService, settingsLib } from "@zeppos/zml/base-side";

import { CHIAVI, abbina, abbinato, comando, dimentica, laFoto, scriviLoStato } from "./la-casa";
import { comandoNellaVetrina, laFotoDellaVetrina } from "./vetrina";

const inVetrina = () => settingsLib.getItem(CHIAVI.vetrina) === "si";

/* Solo questi tre: un comando dal polso non puo' chiedere altro. */
const COSE = new Set(["gira", "luminosita", "azione"]);

async function rispondi(req) {
  if (req.method === "foto") {
    if (inVetrina()) return { abbinato: true, foto: laFotoDellaVetrina() };
    return laFoto();
  }
  if (req.method === "comando") {
    const p = req.params || {};
    if (typeof p.id !== "string" || !COSE.has(p.cosa))
      return { ok: false, testo: "Non so cosa fare" };
    if (inVetrina()) return comandoNellaVetrina(p);
    if (!abbinato()) return { ok: false, testo: "L'orologio non è collegato alla casa" };
    return comando(p);
  }
  return { ok: false, testo: "Non so cosa fare" };
}

AppSideService(
  BaseSideService({
    onInit() {},

    onRequest(req, res) {
      rispondi(req).then(
        (r) => res(null, r),
        () => res(null, { ok: false, testo: "Qualcosa è andato storto sul telefono" }),
      );
    },

    /* Le impostazioni: un codice nuovo si prova subito, e com'e' andata la
     * pagina delle impostazioni la legge in `stato`. */
    onSettingsChange({ key, newValue }) {
      if (key === CHIAVI.codice && newValue) {
        abbina(newValue).then((r) => {
          scriviLoStato(r.ok, r.testo);
          /* Il codice vale una volta sola: non resta scritto. */
          settingsLib.removeItem(CHIAVI.codice);
        });
      } else if (key === "stacca" && newValue) {
        dimentica();
        settingsLib.removeItem("stacca");
      }
    },

    onRun() {},
    onDestroy() {},
  }),
);
