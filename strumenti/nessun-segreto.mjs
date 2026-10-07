/* Nessun segreto, in una repository che tutti possono leggere.
 *
 * «Blinda le app, che mi preoccupa.»
 *
 * La prima cosa da dire e' che il codice in chiaro non e' la falla:
 * `danigio15/gdahomeapp` e' pubblica, e deve restarlo — e' lei l'archivio di
 * add-on che il Supervisor legge (`repository.yaml` lo dice: «non serve nessun
 * gettone, perche' questa repository e' pubblica»), quindi chiuderla vorrebbe
 * dire che nessuno installa e nessuno aggiorna piu' niente. La plancia, poi,
 * viaggia leggibile per scelta dichiarata, e un pezzo di codice che gira in
 * casa di chi paga non e' il posto dove si tiene chiuso quello che si paga.
 * Di tutto questo si discute: `LICENSE` dice cosa si puo' fare del codice, e
 * un fork che lo ripubblica e' un problema da avvocato, non da programma.
 *
 * Quello che invece non si discute e non si ripara e' una credenziale. Una
 * chiave finita in un commit non si toglie cancellandola dopo: il commit di
 * prima resta, chi ha fatto un fork ce l'ha comunque, e i programmi che
 * setacciano GitHub la trovano in minuti. L'unica difesa che funziona e' che
 * non entri. Questo programma serve a quello, e a niente altro.
 *
 * ─── Cosa guarda ───────────────────────────────────────────────────────────
 *
 * I file **tracciati da git**, cioe' esattamente quello che e' pubblico — non
 * `node_modules`, non quello che `.gitignore` tiene fuori, non i file che stanno
 * solo sul disco di chi lavora. Compreso `ponte/app/`, l'app web costruita:
 * un valore passato con `--dart-define` non si vede in `app/lib`, si vede solo
 * li' dentro.
 *
 * Non guarda la **storia**: un giro su 357 commit a ogni push sarebbe lento e
 * servirebbe a poco, perche' una volta che una chiave e' nella storia questo
 * programma non la puo' piu' togliere. Per la storia c'e' la scansione di
 * GitHub, che sulle repository pubbliche e' gratis, e sopra c'e' la
 * **protezione al push**, che rifiuta il push prima che la chiave arrivi.
 * Questo programma sta un passo prima ancora: in casa, e nelle prove.
 *
 * ─── Perche' queste regole e non cento ────────────────────────────────────
 *
 * Perche' un guardiano che grida ogni giorno lo si spegne entro la settimana.
 * Una regola generica su «password» prende ogni finta password di ogni prova —
 * e questa repository ne ha tante — e il giorno che prende quella vera nessuno
 * la sta piu' guardando. Le regole qui sotto sono quelle il cui incontro e'
 * **sempre** una perdita vera: la forma di una chiave privata, di un gettone,
 * di un'utenza di servizio. Quando una di queste suona, c'e' qualcosa da fare.
 *
 * ─── Le eccezioni ─────────────────────────────────────────────────────────
 *
 * Dichiarate una per una, col file e col motivo. Un'eccezione e' una decisione,
 * e una decisione senza il perche' scritto accanto, fra un anno, e' solo un
 * buco di cui nessuno sa piu' niente. Tre delle quattro di oggi sono chiavi
 * **di prova**, che stanno in chiaro proprio perche' non proteggono nulla.
 *
 * ─── Come si usa ──────────────────────────────────────────────────────────
 *
 *     node strumenti/nessun-segreto.mjs
 *
 * Zero se non ha trovato niente, uno se ha trovato qualcosa — e allora dice
 * file, riga, quale regola e cosa fare. Gira nelle prove (`npm run
 * check:segreti`).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));

/* I nomi delle credenziali di questo progetto: quelle che stanno nelle
 * variabili d'ambiente delle macchine e nei segreti dei workflow, e che nel
 * codice non devono comparire mai con un valore accanto. Scritte qui perche'
 * la regola generica non le riconoscerebbe: il JSON di un'utenza di servizio
 * si vede, una chiave Ed25519 grezza e' quarantatre caratteri qualunque. */
export const I_NOMI_DEI_SEGRETI = Object.freeze([
  "NEGOZIO_GOOGLE",
  "CHIAVE_ANDROID",
  "CHIAVE_ANDROID_PASSWORD",
  "QUADRO_LICENZE_CHIAVE",
  "QUADRO_GOOGLE_SERVICE_ACCOUNT",
  "QUADRO_APPLE_CHIAVE",
  "QUADRO_CHIAVE_GESTORE",
  "CENTRALINO_SEGRETO",
  "MQTT_PASSWORD",
]);

/* Ogni segno ha un nome corto (quello che si legge nell'errore), la forma, e
 * il perche': l'errore deve dire cosa si e' perso, non «schema 4 violato». */
export const I_SEGNI = Object.freeze([
  {
    nome: "chiave-privata",
    come: /-----BEGIN (?:[A-Z][A-Z ]* )?PRIVATE KEY-----/,
    perche: "una chiave privata in chiaro: firma, o decifra, al posto nostro",
  },
  {
    nome: "utenza-di-servizio",
    come: /"type"\s*:\s*"service_account"/,
    perche: "il JSON di un'utenza di servizio di Google (il negozio, le ricevute)",
  },
  {
    nome: "chiave-google",
    come: /\bAIza[0-9A-Za-z_-]{35}\b/,
    perche: "una chiave delle API di Google, che si spende a nostro nome",
  },
  {
    nome: "gettone-github",
    come: /\b(?:gh[pousr]_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{22,})\b/,
    perche: "un gettone di GitHub: scrive nella repository e pubblica i rilasci",
  },
  {
    nome: "gettone-firmato",
    come: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/,
    perche: "un gettone JWT intero, firma compresa: vale come chi l'ha emesso",
  },
  {
    nome: "chiave-di-pagamento",
    come: /\b(?:sk_live_[0-9A-Za-z]{16,}|rk_live_[0-9A-Za-z]{16,})\b/,
    perche: "una chiave di Stripe che muove soldi veri",
  },
  {
    nome: "chiave-ed25519-grezza",
    /* Quarantatre caratteri base64url non si riconoscono da soli — sono
     * quarantatre caratteri. Si riconoscono dalla parola che gli sta davanti:
     * una chiave privata, in un file, qualcuno l'ha chiamata per nome. */
    come: /\b(?:privata|private|segreta|secret)\b[^\n]{0,24}?[\s"'`=:]([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/i,
    perche:
      "quarantatre caratteri base64url accanto alla parola «privata»: la forma di una chiave Ed25519 grezza",
  },
  {
    nome: "credenziale-del-progetto",
    come: new RegExp(
      `\\b(?:${I_NOMI_DEI_SEGRETI.join("|")})\\b\\s*[:=]\\s*["'\`]?[A-Za-z0-9+/_-]{16,}`,
    ),
    perche: "una credenziale del progetto scritta col suo valore, invece di arrivare dall'ambiente",
  },
]);

/* I file che non sono testo. Letti come testo non direbbero niente di vero, e
 * `canvaskit.wasm` da solo sono sette megabyte. */
const NON_E_TESTO =
  /\.(?:png|jpe?g|gif|webp|ico|icns|bmp|pdf|mp4|mov|webm|mp3|wav|ttf|otf|woff2?|eot|zip|gz|br|jks|keystore|wasm|so|dylib|dll|jar|class|apk|aab|ipa|db|sqlite3?|pyc)$/i;

/* Oltre questa taglia non e' un file di codice, e un file di codice e' quello
 * che si sta guardando. Il piu' grosso di oggi e' `ponte/app/main.dart.js`, che
 * sono quattro megabyte e ci sta dentro per un pelo: e' voluto, perche' e'
 * l'unico posto dove si vedrebbe un valore murato con `--dart-define`. */
const TROPPO_GROSSO = 6 * 1024 * 1024;

/**
 * Le eccezioni, una per una, col motivo.
 *
 * `file` e' il percorso dalla radice, `segno` il nome della regola. Una
 * eccezione vale per quella regola in quel file, e per nient'altro: la stessa
 * chiave in un altro file suona.
 */
export const LE_ECCEZIONI = Object.freeze([
  {
    file: "centralino/test/posta.test.js",
    segno: "chiave-privata",
    perche:
      "il certificato autofirmato per «posta.prova» e 127.0.0.1: la chiave sta accanto al certificato proprio perche' non protegge niente, e senza di lei la prova non puo' alzare un server in TLS",
  },
  {
    file: "docs/LICENZE.md",
    segno: "chiave-ed25519-grezza",
    perche:
      "la coppia di prova delle licenze, scritta nel documento perche' chi prova ne ha bisogno e non deve inventarsene una. Quella vera nasce con `strumenti/chiave-licenze.mjs` e sta solo sulla macchina del quadro",
  },
  {
    file: "quadro/test/le-licenze.test.js",
    segno: "chiave-ed25519-grezza",
    perche:
      "la stessa coppia di prova di `docs/LICENZE.md`: il quadro ci firma i gettoni delle prove, e le prove degli altri pezzi li verificano con la pubblica di prova. Non vale in nessuna casa: la chiave di serie e' vuota, e quella vera nasce con `strumenti/chiave-licenze.mjs`",
  },
  {
    file: "quadro/test/le-licenze.test.js",
    segno: "chiave-privata",
    perche:
      "la chiave della foglia di una catena di certificati di prova (radice e intermedio «di prova»), per provare la verifica delle risposte firmate di Apple senza Apple: non firma niente fuori dalla prova",
  },
  {
    file: "quadro/test/le-licenze-sul-quadro.test.js",
    segno: "credenziale-del-progetto",
    perche:
      "un file d'ambiente finto, in una cartella di passaggio, per provare che lo strumento del quadro (`quadro/le-licenze.mjs`) non tocca una QUADRO_LICENZE_CHIAVE storta gia' scritta: il valore e' «non-e-una-chiave», e le chiavi vere le fa lo strumento sulla macchina del quadro",
  },
]);

const suUnaRiga = (segno, riga) => segno.come.exec(riga);

/**
 * Cosa c'e' in questo testo, riga per riga.
 *
 * Riga per riga e non tutto insieme perche' l'errore deve dire **dove**: in un
 * file di quattromila righe «c'e' una chiave privata» non e' una notizia utile.
 */
export function guardaIlTesto(testo, { segni = I_SEGNI, salta = [] } = {}) {
  const trovati = [];
  const righe = String(testo).split("\n");
  for (const segno of segni) {
    if (salta.includes(segno.nome)) continue;
    for (let i = 0; i < righe.length; i += 1) {
      const incontro = suUnaRiga(segno, righe[i]);
      if (!incontro) continue;
      trovati.push({
        segno: segno.nome,
        perche: segno.perche,
        riga: i + 1,
        /* Il pezzo si mostra mozzato: un errore non e' il posto dove
         * ristampare per intero la chiave che si e' appena trovata. */
        pezzo: `${incontro[0].slice(0, 24)}…`,
      });
      break;
    }
  }
  return trovati;
}

/** I file tracciati da git: quello che e' davvero pubblico. */
export function iFileDellaRepository(radice = RADICE) {
  const fuori = execFileSync("git", ["-C", radice, "ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return fuori.split("\0").filter(Boolean);
}

const leEccezioniDi = (file, eccezioni) =>
  eccezioni.filter((una) => una.file === file).map((una) => una.segno);

/**
 * Il giro su tutta la repository.
 *
 * Torna `{guardati, saltati, trovati}`: quanti file ha letto, quanti ha
 * lasciato stare perche' non sono testo, e cosa ha trovato.
 */
export function guardaLaRepository({
  radice = RADICE,
  file = null,
  segni = I_SEGNI,
  eccezioni = LE_ECCEZIONI,
} = {}) {
  const elenco = file ?? iFileDellaRepository(radice);
  const trovati = [];
  let guardati = 0;
  let saltati = 0;
  for (const nome of elenco) {
    if (NON_E_TESTO.test(nome)) {
      saltati += 1;
      continue;
    }
    const dove = join(radice, nome);
    let quale = null;
    try {
      quale = statSync(dove);
    } catch {
      /* Un file tracciato che sul disco non c'e' non e' affare di questo
       * programma: lo dira' git. */
      saltati += 1;
      continue;
    }
    /* Un sottomodulo git e' tracciato come una voce sola, e quella voce e' una
     * cartella: il suo contenuto sta in un'altra repository e lo guarda il
     * programma di quella. */
    if (!quale.isFile() || quale.size > TROPPO_GROSSO) {
      saltati += 1;
      continue;
    }
    guardati += 1;
    const dentro = guardaIlTesto(readFileSync(dove, "utf8"), {
      segni,
      salta: leEccezioniDi(nome, eccezioni),
    });
    for (const uno of dentro) trovati.push({ file: nome, ...uno });
  }
  return { guardati, saltati, trovati };
}

if (process.argv[1] && process.argv[1].endsWith("nessun-segreto.mjs")) {
  const esito = guardaLaRepository();
  if (esito.trovati.length === 0) {
    console.log(
      `Nessun segreto: ${esito.guardati} file di testo guardati, ${esito.saltati} lasciati stare (non sono testo, o sono troppo grossi).`,
    );
    process.exit(0);
  }
  console.error(
    `Trovato qualcosa che in una repository pubblica non ci va (${esito.trovati.length}):\n`,
  );
  for (const uno of esito.trovati) {
    console.error(`  ${uno.file}:${uno.riga}  [${uno.segno}]  ${uno.pezzo}`);
    console.error(`    ${uno.perche}\n`);
  }
  console.error(
    `Cosa fare, in quest'ordine:
  1. **Cambiala**, quella credenziale, dove la si rilascia. Togliere la riga
     non serve: se e' stata spinta, e' pubblica per sempre.
  2. Fai arrivare il valore dall'ambiente (le variabili della macchina, i
     segreti del workflow), non dal file.
  3. Se quello che ho trovato e' di prova e non protegge niente, scrivilo
     fra LE_ECCEZIONI di strumenti/nessun-segreto.mjs, col motivo.`,
  );
  process.exit(1);
}
