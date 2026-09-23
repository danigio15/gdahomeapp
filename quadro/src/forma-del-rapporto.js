/* La forma del rapporto: quello che una casa puo' scrivere qui, e niente di
 * piu'.
 *
 * Il rapporto arriva da una macchina che non e' nostra, e finisce in due
 * posti che contano: nell'archivio, dove resta, e nella pagina di chi installa,
 * dove si disegna. Prima si teneva **cosi' com'era arrivato**, e la pagina si
 * fidava che un numero fosse un numero. Un rapporto scritto a mano — da un
 * ponte bucato, o da chi ha la chiave di una casa e la usa con `curl` — poteva
 * mettere un pezzo di pagina dove la pagina si aspettava una cifra.
 *
 * Adesso si tiene **la forma**, e basta:
 *
 *  - un numero e' un numero finito, o `null` («non lo dice»);
 *  - un si'/no e' `true` o `false`, e un `null` resta `null` dove vuol dire
 *    «non si sa»;
 *  - una parola ha una lunghezza massima, e oltre si taglia;
 *  - un elenco ha un tetto, e oltre si taglia;
 *  - un campo che qui non si conosce si lascia fuori;
 *  - un pezzo con la struttura sbagliata — un oggetto dove ci va un numero,
 *    un elenco dove ci va un oggetto — si lascia fuori tutto, e la pagina lo
 *    disegna come «non lo dice», che e' quello che e'.
 *
 * La forma e' quella che fabbrica il ponte (`ponte/src/rapporto.js`,
 * `compila`, e `ferro.js`/`salute.js` per i pezzi). Un campo nuovo del ponte
 * che qui non c'e' semplicemente non arriva: e' il verso giusto dello sbaglio,
 * e si aggiunge qui quando serve.
 *
 * Non e' al posto di `testo()` nelle pagine: e' in piu'. Due controlli, uno
 * per parte, perche' uno solo e' un controllo che un giorno qualcuno toglie.
 */

/* ─── I mattoni ───────────────────────────────────────────────────────── */

/* Un valore che si lascia fuori. Diverso da `null`, che e' un valore: vuol
 * dire «la casa ha detto che non lo sa». */
const FUORI = undefined;

/** Un numero finito, o `null`. Una stringa che e' un numero passa. */
export const numero = (valore) => {
  if (valore === null || valore === undefined) return null;
  if (typeof valore === "number") return Number.isFinite(valore) ? valore : null;
  if (typeof valore === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(valore)) {
    const letto = Number(valore);
    return Number.isFinite(letto) ? letto : null;
  }
  return null;
};

/** Si' o no. Solo `true` e' si'. */
const siNo = (valore) => valore === true;

/** Si', no, o «non si sa». */
const forse = (valore) => (valore === true ? true : valore === false ? false : null);

/** Una parola, tagliata. Un oggetto non e' una parola, e resta fuori. */
const parola =
  (quanto = 80) =>
  (valore) => {
    if (valore === null || valore === undefined) return "";
    if (typeof valore === "string") return valore.slice(0, quanto);
    if (typeof valore === "number" || typeof valore === "boolean") return String(valore);
    return FUORI;
  };

/** Una parola che deve avere una certa forma, o niente. */
const fatta =
  (forma, quanto = 80) =>
  (valore) => {
    const detta = parola(quanto)(valore);
    return typeof detta === "string" && forma.test(detta) ? detta : FUORI;
  };

/** Un indirizzo da far cliccare: solo `https://`, se no vuoto. */
const indirizzo =
  (quanto = 300) =>
  (valore) => {
    const detto = typeof valore === "string" ? valore.trim() : "";
    return detto.length <= quanto && /^https:\/\/[^\s"'<>`]+$/i.test(detto) ? detto : "";
  };

/** Un oggetto con questi campi, e solo questi. */
const oggetto = (campi) => (valore) => {
  if (!valore || typeof valore !== "object" || Array.isArray(valore)) return FUORI;
  const fuori = {};
  for (const [nome, forma] of Object.entries(campi)) {
    if (!Object.hasOwn(valore, nome)) continue;
    const suo = forma(valore[nome]);
    if (suo !== FUORI) fuori[nome] = suo;
  }
  return fuori;
};

/** Un elenco di cose di una forma, fino a un tetto. */
const elenco =
  (forma, tetto = 50) =>
  (valore) => {
    if (!Array.isArray(valore)) return FUORI;
    const fuori = [];
    for (const uno of valore.slice(0, tetto)) {
      const suo = forma(uno);
      if (suo !== FUORI) fuori.push(suo);
    }
    return fuori;
  };

/* ─── La forma ────────────────────────────────────────────────────────── */

/* I tetti degli elenchi sono quelli del ponte, o un po' sopra: tagliare qui
 * quello che il ponte manda per davvero vorrebbe dire far sparire un nome. */
const UN_PROFILO = /^[a-z0-9][a-z0-9-]{0,63}$/;
const UN_SEGNO = /^[0-9a-f]{16}$/;

const LA_FORMA = oggetto({
  casa: parola(40),
  quando: parola(40),
  ogni: numero,
  ponte: parola(40),
  plancia: parola(40),
  ha: parola(40),
  supervisor: parola(40),
  sistema: parola(80),
  manutenzione: siNo,
  configurazione: siNo,
  marchio: siNo,
  macchina: oggetto({
    scheda: parola(80),
    cpu: numero,
    ram: numero,
    temperatura: numero,
    disco: numero,
    discoLiberi: numero,
    discoVita: numero,
    accesaDa: numero,
  }),
  nodi: elenco(
    oggetto({
      nome: parola(80),
      acceso: forse,
      muto: siNo,
      cpu: numero,
      ram: numero,
      disco: numero,
      temperatura: numero,
    }),
    16,
  ),
  rete: oggetto({
    internet: siNo,
    schede: elenco(
      oggetto({
        nome: parola(40),
        tipo: parola(20),
        su: siNo,
        principale: siNo,
        ip: parola(64),
        segnale: numero,
      }),
      16,
    ),
    sorvegliate: oggetto({ quante: numero, giu: numero }),
  }),
  addon: oggetto({
    quanti: numero,
    accesi: numero,
    spentiCheDovrebbero: numero,
    elenco: elenco(
      oggetto({ nome: parola(80), su: siNo, allAvvio: siNo, aggiornabile: siNo }),
      200,
    ),
  }),
  aggiornamenti: oggetto({
    quanti: numero,
    ha: siNo,
    gdahome: siNo,
    firmware: numero,
    addon: numero,
    elenco: elenco(
      oggetto({
        nome: parola(120),
        da: parola(40),
        a: parola(40),
        nostra: siNo,
        installabile: siNo,
        stacca: siNo,
        segno: fatta(UN_SEGNO, 16),
        marchio: parola(40),
        cosaCambia: parola(300),
        note: indirizzo(),
      }),
      100,
    ),
  }),
  lavoro: oggetto({
    id: parola(64),
    cosa: parola(40),
    nome: parola(120),
    da: parola(40),
    a: parola(40),
    riavvio: siNo,
    configurazione: siNo,
    stato: parola(40),
    perche: parola(300),
    stacca: siNo,
    quando: numero,
    finitoIl: numero,
  }),
  plance: oggetto({
    quante: numero,
    configurate: numero,
    elenco: elenco((una) => {
      const detta = oggetto({
        profilo: fatta(UN_PROFILO, 64),
        titolo: parola(80),
        revisione: numero,
      })(una);
      /* Una plancia senza un profilo buono non e' una plancia: il profilo
       * finisce in un indirizzo, e un indirizzo storto non si compone. */
      return detta && detta.profilo ? detta : FUORI;
    }, 16),
  }),
  telefoni: oggetto({ abbinati: numero, visti7gg: numero }),
  fuori: oggetto({ acceso: siNo, filo: siNo }),
  entita: oggetto({
    totali: numero,
    giu: numero,
    dispositivi: numero,
    nomi: elenco(parola(120), 200),
  }),
  batterie: oggetto({ scariche: numero, piuBassa: numero }),
  backup: oggetto({ giorniFa: numero }),
  registro: oggetto({ errori24h: numero }),
});

/**
 * Il rapporto, nella forma che si tiene.
 *
 * Torna un oggetto sempre, anche vuoto. Le icone e le note intere che il
 * rapporto porta per `segni.js` qui **non** passano: quelle le prende chi le
 * vuole dal rapporto com'e' arrivato, e nell'archivio non devono restare —
 * sono byte che in una riga di numeri non ci stanno.
 */
export function laFormaDel(carta) {
  return LA_FORMA(carta) ?? {};
}

/**
 * Le righe degli aggiornamenti con quello che serve a `segni.js`: il nome, la
 * versione, il segno, e le icone e le note se ci sono. Anche qui una forma,
 * con i suoi tetti: il resto lo guarda `segni.js`, che i byte li ricontrolla.
 */
export const leRigheDeiSegni = (carta) =>
  elenco(
    oggetto({
      nome: parola(120),
      a: parola(40),
      segno: fatta(UN_SEGNO, 16),
      logo: parola(96 * 1024),
      logoTipo: parola(40),
      leNote: parola(16 * 1024),
      senzaLogo: siNo,
      senzaNote: siNo,
    }),
    100,
  )(carta?.aggiornamenti?.elenco) ?? [];
