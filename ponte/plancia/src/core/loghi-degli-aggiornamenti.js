/* I segni degli aggiornamenti: chi li chiede, quando si richiedono, e quando
 * si rinuncia.
 *
 * «Sull'iPhone, nella finestra degli aggiornamenti, una lettera per riga.»
 * L'app, nella sua schermata, quelle stesse icone le aveva: la domanda e' la
 * stessa (`ponte/aggiornamenti/logo`), e il ponte risponde coi byte. Erano tre
 * difetti della plancia, uno sopra l'altro:
 *
 *  1. La domanda partiva **prima che la porta fosse aperta.** `bridgeRequest`
 *     apre una presa sua per ogni domanda e, per i ponti che non dicono
 *     `auth_ok`, dopo 25 ms manda lo stesso. Dentro l'app la presa la apre il
 *     servitore sul telefono, subito, ma l'`auth_ok` lo dice la cucitura solo
 *     quando il filo verso casa e' su (`app/lib/plancia/cucitura.dart`) — e
 *     quello che arriva prima lo butta. Su un iPhone che si riapre il filo e'
 *     ancora giu' (iOS lo chiude quando l'app va in secondo piano), e da fuori
 *     casa passa dal centralino: tutte le domande partite in quel momento
 *     andavano perse, e la risposta non arrivava mai.
 *  2. **Un no si teneva per sempre.** Una domanda che non tornava entro otto
 *     secondi lasciava la riga «senza logo» fino a che la pagina non si
 *     ricaricava: un intoppo di un momento diventava la lettera per giorni.
 *     L'app lo aveva gia' imparato — si tiene solo «non ce n'e' uno», che e'
 *     una risposta; una caduta si riprova.
 *  3. **L'icona arrivata non entrava nella finestra.** Il corpo della finestra
 *     si ritravasa solo dal giro della griglia, e solo se la tessera in Home
 *     c'e': aperta per nome — un'azione rapida, l'assistente — o con la tessera
 *     tolta dalla Home, restava la lettera. Adesso il segno lo posa chi lo ha
 *     ricevuto (vedi la sezione).
 *
 * Qui stanno le regole, senza documento e senza rete: chi chiede le passa.
 *
 * ─── Gli indirizzi diretti ───────────────────────────────────────────────
 *
 * Un `<img>` con dentro `entity_picture` non e' la strada, e dentro l'app non
 * lo e' mai — ne' in quella che serve il ponte: la pagina dell'app sta su 127.0.0.1, un `/api/hassio/...` va al servitore
 * del telefono e non a Home Assistant, e un marchio da
 * `brands.home-assistant.io` e' un host di fuori che la plancia dell'app non
 * chiama. Resta l'ultima spiaggia solo **dentro Home Assistant** (il pannello
 * dell'integrazione), dove il ponte non c'e' — la domanda torna «non
 * conosco» — e dove quegli stessi indirizzi li usa la pagina di Home
 * Assistant: l'icona di un add-on la' passa senza segno, e i marchi sono i
 * suoi. Due forme e basta, e nessun gettone dentro un indirizzo.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Quanto si aspetta un segno: quanto l'app (`casa/aggiornamenti.dart`). */
export const ATTESA_DEL_LOGO = 12_000;

/** Quanti se ne chiedono insieme: quanti l'app. */
export const QUANTI_INSIEME = 4;

/* I marchi di Home Assistant, e l'icona di un add-on vista da Home Assistant.
 * Sono le stesse due forme che il ponte lascia passare (`ponte/src/
 * aggiornamenti.js`, `ilLogoDi`), piu' strette: niente `..`, niente `?`. */
const I_MARCHI = /^https:\/\/brands\.home-assistant\.io\/[A-Za-z0-9_./-]+\.(?:png|svg)$/;
const ICONA_DI_UN_ADDON = /^\/api\/hassio\/addons\/[a-z0-9_-]+\/(?:icon|logo)$/;

/**
 * L'indirizzo da mettere in un `<img>`, o stringa vuota.
 *
 * @param {string} foto `entity_picture` dell'entita'
 * @param {{colPonte?: boolean}} dove `colPonte` quando la pagina la serve
 *   l'app o il ponte (`__GDAHOME__`): li' non c'e' mai un indirizzo diretto
 */
export function indirizzoDiretto(foto, { colPonte = false } = {}) {
  if (colPonte) return "";
  const dove = pulito(foto);
  if (!dove || dove.includes("..")) return "";
  if (ICONA_DI_UN_ADDON.test(dove)) return dove;
  if (I_MARCHI.test(dove)) return dove;
  return "";
}

/* I no che sono risposte: quell'icona non c'e', e domani non ci sara' in un
 * altro modo. Gli stessi dell'app. */
const STATI_DEL_NO = new Set([403, 404, 410]);
const CODICI_DEL_NO = new Set(["not_found", "unauthorized"]);
/* Chi non conosce la domanda: un pannello di Home Assistant senza ponte, o un
 * ponte piu' vecchio della plancia. Non si richiede — non cambiera' — ma si
 * prova l'indirizzo diretto. */
const CODICI_DI_CHI_NON_SA = new Set(["unknown_command", "not_supported"]);

const SOLO_IMMAGINI = /^image\/(?:png|jpeg|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)$/;

/**
 * Cosa vuol dire una risposta del ponte.
 *
 * @returns {{esito:"preso", url:string} | {esito:"niente"} | {esito:"caduto"}}
 */
export function esitoDellaRisposta(risposta) {
  if (!risposta || typeof risposta !== "object") return { esito: "caduto" };
  const stato = Number(risposta.stato);
  if (STATI_DEL_NO.has(stato)) return { esito: "niente" };
  if (stato !== 200) return { esito: "caduto" };
  const corpo = pulito(risposta.corpo);
  if (!corpo || !/^[A-Za-z0-9+/=]+$/.test(corpo)) return { esito: "niente" };
  /* Il ponte le immagini non le comprime; se lo dicesse, qui non si sa aprire. */
  if (pulito(risposta.compresso)) return { esito: "niente" };
  const tipo = pulito(risposta.tipo).toLowerCase().split(";")[0].trim() || "image/png";
  if (!SOLO_IMMAGINI.test(tipo)) return { esito: "niente" };
  return { esito: "preso", url: `data:${tipo};base64,${corpo}` };
}

/**
 * Cosa vuol dire un no del filo.
 *
 * @returns {"niente"|"nonSa"|"caduto"}
 */
export function esitoDelGuasto(errore) {
  const codice = pulito(errore?.code).toLowerCase();
  if (CODICI_DEL_NO.has(codice)) return "niente";
  if (CODICI_DI_CHI_NON_SA.has(codice)) return "nonSa";
  /* `bridgeRequest` il codice non lo porta: lo dice nella frase. */
  const frase = pulito(errore?.message).toLowerCase();
  if (/unknown[_ ]command|non conosco/.test(frase)) return "nonSa";
  return "caduto";
}

/** Fra quanto si richiede un segno che non e' arrivato: 3 s, 6, 12… fino a 2 min. */
export function fraQuantoSiRiprova(tentativi) {
  const quanti = Math.max(1, Number(tentativi) || 1);
  return Math.min(120_000, 3_000 * 2 ** Math.min(quanti - 1, 6));
}

/**
 * La memoria dei segni, con chi li chiede.
 *
 * `logo(entita, foto)` risponde subito con quello che sa — un indirizzo, o
 * stringa vuota — e se non sa ancora niente, o se e' ora di riprovare, fa
 * partire la domanda. Quando arriva qualcosa di nuovo chiama `arrivato`.
 *
 * @param {object} cosa
 * @param {(entita:string) => Promise<object|null>} [cosa.chiedi] la domanda al
 *   ponte; senza, si va solo di indirizzi diretti
 * @param {(entita:string, url:string) => void} [cosa.arrivato]
 * @param {(entita:string, fra:number) => void} [cosa.riprova] chi vuole
 *   richiederlo da se' quando e' ora (la sezione ci mette un timer)
 * @param {() => boolean} [cosa.colPonte]
 * @param {() => number} [cosa.adesso]
 * @param {number} [cosa.insieme]
 */
export function creaLaMemoriaDeiLoghi({
  chiedi = null,
  arrivato = () => {},
  riprova = () => {},
  colPonte = () => false,
  adesso = () => Date.now(),
  insieme = QUANTI_INSIEME,
} = {}) {
  /** entita -> {esito:"attesa"|"preso"|"niente"|"caduto", url, tentativi, dopo} */
  const memoria = new Map();
  const coda = [];
  let inCorso = 0;

  const diretto = (foto) => indirizzoDiretto(foto, { colPonte: colPonte() === true });

  function segna(entita, voce) {
    const prima = memoria.get(entita);
    memoria.set(entita, voce);
    if (voce.url && voce.url !== prima?.url) arrivato(entita, voce.url);
  }

  function cadutoDi(entita, foto) {
    const prima = memoria.get(entita);
    const tentativi = (prima?.tentativi || 0) + 1;
    const fra = fraQuantoSiRiprova(tentativi);
    /* Intanto, se c'e', l'indirizzo diretto: meglio di una lettera. */
    segna(entita, { esito: "caduto", url: diretto(foto), tentativi, dopo: adesso() + fra });
    riprova(entita, fra);
  }

  function prossimo() {
    while (inCorso < insieme && coda.length) {
      const { entita, foto } = coda.shift();
      inCorso += 1;
      Promise.resolve()
        .then(() => chiedi(entita))
        .then(
          (risposta) => {
            /* Un ponte che non c'e' — la plancia fuori dall'app e fuori dal
             * ponte — risponde `null`: e' come «non conosco». */
            if (risposta === null || risposta === undefined) {
              segna(entita, { esito: "niente", url: diretto(foto), tentativi: 0, dopo: 0 });
              return;
            }
            const detto = esitoDellaRisposta(risposta);
            if (detto.esito === "preso")
              segna(entita, { esito: "preso", url: detto.url, tentativi: 0, dopo: 0 });
            else if (detto.esito === "niente")
              segna(entita, { esito: "niente", url: diretto(foto), tentativi: 0, dopo: 0 });
            else cadutoDi(entita, foto);
          },
          (errore) => {
            const detto = esitoDelGuasto(errore);
            if (detto === "caduto") cadutoDi(entita, foto);
            else segna(entita, { esito: "niente", url: diretto(foto), tentativi: 0, dopo: 0 });
          },
        )
        .finally(() => {
          inCorso -= 1;
          prossimo();
        });
    }
  }

  function logo(entita, foto = "") {
    const chi = pulito(entita);
    if (!chi) return "";
    const voce = memoria.get(chi);
    if (voce?.esito === "preso" || voce?.esito === "niente" || voce?.esito === "attesa")
      return voce.url || "";
    if (voce?.esito === "caduto" && adesso() < voce.dopo) return voce.url || "";
    if (typeof chiedi !== "function") {
      const url = diretto(foto);
      memoria.set(chi, { esito: "niente", url, tentativi: 0, dopo: 0 });
      return url;
    }
    memoria.set(chi, {
      esito: "attesa",
      url: voce?.url || "",
      tentativi: voce?.tentativi || 0,
      dopo: 0,
    });
    coda.push({ entita: chi, foto });
    prossimo();
    return voce?.url || "";
  }

  return {
    logo,
    /** Cosa sa di quell'entita' (per le prove). */
    voce: (entita) => memoria.get(pulito(entita)) || null,
  };
}
