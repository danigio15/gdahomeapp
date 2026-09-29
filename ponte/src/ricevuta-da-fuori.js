/* La ricevuta di chi compra fuori casa, arrivata dal centralino.
 *
 * Premium si compra dall'app, e la ricevuta del negozio la porta al quadro la
 * casa (`licenze.negozio`). Di solito arriva sul filo cifrato del telefono,
 * come comando `ponte/licenza/negozio`. Ma chi compra fuori casa ha la casa
 * chiusa proprio dal centralino — il fuori casa e' Premium — e un filo non ce
 * l'ha. Allora la consegna al centralino (`POST /licenza/<casa>`), che la
 * gira qui sul filo della casa, `{t: "ricevuta", n, corpo}`, e aspetta la
 * risposta (`chiamata.js`).
 *
 * Al centralino passa in chiaro, e chiunque su internet potrebbe bussare a
 * quella porta col nome di questa casa. Per questo la ricevuta arriva
 * **firmata dal telefono** con la chiave del filo: la conoscono solo lui e la
 * casa, al centralino non e' mai passata. Qui si controlla la firma, e solo
 * una ricevuta di un telefono abbinato a questa casa va al quadro. Il resto si
 * rifiuta senza chiedere niente a nessuno.
 *
 *   corpo = {v: 1, chi, quando, app, piattaforma, prodotto, ricevuta, firma}
 *
 *   chiave = HKDF-SHA256(chiave del filo, sale = "casa_…", info = ETICHETTA, 32 byte)
 *   firma  = base64url(HMAC-SHA256(chiave, JSON di
 *            [ETICHETTA, casa, chi, quando, app, piattaforma, prodotto, ricevuta]))
 *
 * `quando` sono i millisecondi del telefono: una firma vale un quarto d'ora
 * prima e dopo l'ora di qui. Rimandata uguale da chi sta in mezzo porterebbe
 * al quadro la stessa ricevuta un'altra volta, e il quadro non ne fa niente di
 * diverso dalla prima. L'app fa la stessa cosa in `app/lib/licenza/ricevuta_da_fuori.dart`.
 */

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import { LicenzaNo } from "./licenze.js";

/* Il nome di questa firma: sta nella chiave e nel testo firmato, cosi' una
 * firma fatta per qualcos'altro qui non vale. */
export const ETICHETTA_DELLA_RICEVUTA = "gdahome/ricevuta/v1";

/* Quanto puo' essere lontana l'ora del telefono da quella di qui. */
export const SCARTO_MASSIMO = 15 * 60 * 1000;

/* I campi sono tutti testo stampabile: sono numeri di transazione, nomi di
 * prodotti e identificativi. Cosi' le due punte scrivono lo stesso JSON byte
 * per byte, senza sorprese su come si scrive un carattere strano. */
const STAMPABILE = /^[\x20-\x7e]*$/;

/* La firma di una ricevuta: la usano le prove, e dice all'app come si fa. */
export function firmaDellaRicevuta({
  chiaveDelFilo,
  casa,
  chi,
  quando,
  app,
  piattaforma,
  prodotto,
  ricevuta,
}) {
  const chiave = Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(chiaveDelFilo, "hex"),
      Buffer.from(casa, "utf8"),
      ETICHETTA_DELLA_RICEVUTA,
      32,
    ),
  );
  const testo = JSON.stringify([
    ETICHETTA_DELLA_RICEVUTA,
    casa,
    chi,
    quando,
    app,
    piattaforma,
    prodotto,
    ricevuta,
  ]);
  return createHmac("sha256", chiave).update(testo, "utf8").digest("base64url");
}

const no = (stato, errore) => ({ stato, corpo: { errore } });

/* Controlla la ricevuta e, se e' di un telefono di questa casa, la porta al
 * quadro. Torna `{stato, corpo}` come in HTTP: e' quello che il centralino
 * rimanda al telefono. */
export async function laRicevutaDaFuori(
  corpo,
  { casa, dispositivi, licenze, adesso = () => Date.now() },
) {
  const detto = corpo && typeof corpo === "object" && !Array.isArray(corpo) ? corpo : {};
  const { v, chi, quando, app, piattaforma, prodotto, ricevuta, firma } = detto;
  const testi = [chi, app, piattaforma, prodotto, ricevuta, firma];
  if (
    v !== 1 ||
    !Number.isSafeInteger(quando) ||
    !testi.every((uno) => typeof uno === "string" && STAMPABILE.test(uno))
  )
    return no(400, "ricevuta-storta");

  /* Il telefono: uno abbinato adesso, con la sua chiave del filo. Uno
   * staccato non ce l'ha piu', e da qui non passa. */
  const chiaveDelFilo = dispositivi.chiaveDi(chi);
  if (!chiaveDelFilo) return no(403, "telefono-sconosciuto");
  const giusta = Buffer.from(
    firmaDellaRicevuta({ chiaveDelFilo, casa, chi, quando, app, piattaforma, prodotto, ricevuta }),
  );
  const sua = Buffer.from(firma);
  if (giusta.length !== sua.length || !timingSafeEqual(giusta, sua))
    return no(403, "firma-sbagliata");
  if (Math.abs(adesso() - quando) > SCARTO_MASSIMO) return no(403, "ricevuta-scaduta");

  try {
    const stato = await licenze.negozio({ app, piattaforma, prodotto, ricevuta });
    /* Al telefono serve il gettone, per sapere da se' che la casa e'
     * Premium; il resto dello stato resta qui. */
    return {
      stato: 200,
      corpo: { gdahome: stato.gdahome, gdanav: stato.gdanav, gettoni: stato.gettoni },
    };
  } catch (errore) {
    if (!(errore instanceof LicenzaNo)) throw errore;
    return no(statoDelNo(errore), errore.codice);
  }
}

/* Come si dice un no del quadro a chi sta fuori. Una ricevuta che il negozio
 * non conferma e' un 402, come al quadro; tutto quello che dipende dalla
 * strada, dal quadro o dal negozio e' un 5xx, e l'app lo riprova. */
function statoDelNo(errore) {
  switch (errore.codice) {
    case "ricevuta-non-valida":
      return 402;
    case "troppe-richieste":
      return 429;
    case "verifica-non-configurata":
      return 503;
    case "app-sconosciuta":
    case "piattaforma-sconosciuta":
    case "prodotto-sconosciuto":
    case "ricevuta-mancante":
      return 400;
    default:
      return 502;
  }
}
