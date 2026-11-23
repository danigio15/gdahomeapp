/* Il filo col telefono, dal polso.
 *
 * Come su Wear OS (`IlTelefono.kt`): l'orologio con la casa non parla. Chiede
 * al servizio di fianco, nell'app Zepp sul telefono, e quello risponde con la
 * fotografia o con la frase da mostrare. Le domande sono due:
 *
 *     { method: "foto" }                         → { abbinato, foto?, testo? }
 *     { method: "comando", params: { id, cosa, valore? } }
 *                                                → { ok, testo, foto? }
 *
 * `cosa` e' «gira» (accendi o spegni, apri o chiudi), «luminosita» (con
 * `valore` da 1 a 100) o «azione». Le serrature e l'antifurto non ci sono:
 * dal polso non partono, come sugli altri orologi.
 */

import { Vibrator } from "@zos/sensor";
import { leggiLaFoto } from "./la-foto";

/* Quanto si aspetta il telefono: un comando fa il giro della casa. E' poco
 * piu' dell'attesa del telefono Android (`ATTESA_MS` in
 * `IlTramiteDellOrologio.kt`). */
const ATTESA_MS = 10000;

function conIlTempo(promessa) {
  return new Promise((bene, male) => {
    const tardi = setTimeout(() => male(new Error("tardi")), ATTESA_MS);
    promessa.then(
      (r) => {
        clearTimeout(tardi);
        bene(r);
      },
      (e) => {
        clearTimeout(tardi);
        male(e);
      },
    );
  });
}

/** La fotografia di adesso. Mette via quella buona in `globalData`. */
export function chiediLaFoto(pagina) {
  return conIlTempo(pagina.request({ method: "foto" })).then((r) => {
    if (!r || r.abbinato !== true) return { abbinato: false, testo: r?.testo || "" };
    const foto = leggiLaFoto(r.foto);
    if (foto) getApp()._options.globalData.foto = foto;
    return { abbinato: true, foto };
  });
}

/** Un comando. Risponde sempre, anche quando il telefono non c'e'. */
export function manda(pagina, params) {
  return conIlTempo(pagina.request({ method: "comando", params }))
    .then((r) => {
      const foto = leggiLaFoto(r?.foto);
      if (foto) getApp()._options.globalData.foto = foto;
      return { ok: r?.ok === true, testo: r?.testo || (r?.ok ? "Fatto" : "Non è partito"), foto };
    })
    .catch(() => ({
      ok: false,
      testo: "Il telefono non risponde. È vicino, col Bluetooth acceso?",
    }));
}

/** L'ultima fotografia vista, se c'e'. */
export function laFotoDiPrima() {
  return getApp()._options.globalData.foto;
}

/** Il colpetto al polso: il tocco si sente subito, com'e' andata arriva dopo. */
export function colpetto() {
  try {
    new Vibrator().start();
  } catch (e) {
    // Un orologio senza vibrazione: pazienza.
  }
}
