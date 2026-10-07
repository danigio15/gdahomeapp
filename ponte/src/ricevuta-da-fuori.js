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
 *
 * ─── Il codice regalo, da fuori ───────────────────────────────────────────
 *
 * Lo stesso giro serve a chi ha in mano un **codice regalo** e sta fuori
 * casa. «Ho provato a generare un codice ma non funziona»: con la casa Base
 * il filo da fuori non si apre, e il regalo si fermava proprio dove serve,
 * con «la casa non e' collegata adesso». Il corpo porta `regalo` al posto
 * della ricevuta, ed e' firmato allo stesso modo con un'etichetta sua:
 *
 *   corpo = {v: 1, chi, quando, regalo, firma}
 *   firma = base64url(HMAC-SHA256(chiave, JSON di
 *           [ETICHETTA_DEL_REGALO, casa, chi, quando, regalo]))
 *
 * dove la chiave viene dalla chiave del filo come sopra, con l'etichetta del
 * regalo. Un codice regalo riscattato una volta non si riscatta di nuovo —
 * lo dice il quadro — e quindi rimandarlo uguale non porta niente.
 */

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import { LicenzaNo } from "./licenze.js";

/* Il nome di questa firma: sta nella chiave e nel testo firmato, cosi' una
 * firma fatta per qualcos'altro qui non vale. */
export const ETICHETTA_DELLA_RICEVUTA = "gdahome/ricevuta/v1";

/* Il nome della firma di un codice regalo portato da fuori. */
export const ETICHETTA_DEL_REGALO = "gdahome/regalo/v1";

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
  return firmata(ETICHETTA_DELLA_RICEVUTA, chiaveDelFilo, casa, [
    chi,
    quando,
    app,
    piattaforma,
    prodotto,
    ricevuta,
  ]);
}

/* La firma di un codice regalo: la usano le prove, e dice all'app come si
 * fa. */
export function firmaDelRegalo({ chiaveDelFilo, casa, chi, quando, regalo }) {
  return firmata(ETICHETTA_DEL_REGALO, chiaveDelFilo, casa, [chi, quando, regalo]);
}

/* La firma con la chiave del filo: la chiave si ricava per etichetta e per
 * casa, e il testo firmato comincia con la stessa etichetta. */
function firmata(etichetta, chiaveDelFilo, casa, campi) {
  const chiave = Buffer.from(
    hkdfSync("sha256", Buffer.from(chiaveDelFilo, "hex"), Buffer.from(casa, "utf8"), etichetta, 32),
  );
  const testo = JSON.stringify([etichetta, casa, ...campi]);
  return createHmac("sha256", chiave).update(testo, "utf8").digest("base64url");
}

/* Se la firma di chi bussa e' quella giusta, senza dirlo dal tempo che ci
 * si mette. */
function stessaFirma(giusta, sua) {
  const a = Buffer.from(giusta);
  const b = Buffer.from(String(sua));
  return a.length === b.length && timingSafeEqual(a, b);
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
  /* Un codice regalo, non una ricevuta: vedi in cima. */
  if (Object.hasOwn(detto, "regalo")) {
    return ilRegaloDaFuori(detto, { casa, dispositivi, licenze, adesso });
  }
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
  const giusta = firmaDellaRicevuta({
    chiaveDelFilo,
    casa,
    chi,
    quando,
    app,
    piattaforma,
    prodotto,
    ricevuta,
  });
  if (!stessaFirma(giusta, firma)) return no(403, "firma-sbagliata");
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

/* Il codice regalo di un telefono di questa casa, portato dal centralino:
 * gli stessi controlli della ricevuta, poi `licenze.riscatta`, come dal filo
 * (`ponte/licenza/riscatta`) e dalla console. */
async function ilRegaloDaFuori(detto, { casa, dispositivi, licenze, adesso }) {
  const { v, chi, quando, regalo, firma } = detto;
  if (
    v !== 1 ||
    !Number.isSafeInteger(quando) ||
    ![chi, regalo, firma].every((uno) => typeof uno === "string" && STAMPABILE.test(uno)) ||
    regalo.length > 64
  )
    return no(400, "regalo-storto");

  const chiaveDelFilo = dispositivi.chiaveDi(chi);
  if (!chiaveDelFilo) return no(403, "telefono-sconosciuto");
  if (!stessaFirma(firmaDelRegalo({ chiaveDelFilo, casa, chi, quando, regalo }), firma))
    return no(403, "firma-sbagliata");
  if (Math.abs(adesso() - quando) > SCARTO_MASSIMO) return no(403, "regalo-scaduto");

  try {
    const stato = await licenze.riscatta(regalo);
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
    /* I no a un codice regalo, come li dice il quadro. */
    case "codice-inesistente":
      return 404;
    case "codice-gia-usato":
      return 409;
    case "codice-storto":
      return 400;
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
