/* Quante case hanno gdahome, e quante continuano ad aggiornarlo.
 *
 * «Deve contare quante persone effettuano download della repository tramite
 * Home Assistant e quanti continuano ad aggiornare.»
 *
 * Il contatore dei download delle release, quello della dashboard, qui non
 * misura niente — e non e' un difetto del badge, sono due strade diverse.
 * L'integrazione la installa HACS, che **scarica lo zip** della release: ogni
 * installazione e ogni aggiornamento e' un download, e GitHub lo conta. Un
 * add-on no: si aggiunge la repository fra gli Archivi e da li' in poi e' il
 * **Supervisor a clonarla con git**, a ogni giro del negozio. Per GitHub un
 * clone non e' un download, e quel numero resterebbe a zero per sempre.
 *
 * I cloni pero' GitHub li conta, e li tiene nella pagina del traffico. Quella
 * pagina non e' pubblica — la vede chi ha i permessi sulla repository — ed e'
 * l'unica ragione per cui qui serve un gettone: non per scrivere niente, solo
 * per **leggere un numero che GitHub ha gia'**.
 *
 * Due cose che rendono questo conto onesto, e vanno sapute leggendo i numeri:
 *
 *  - **una casa che ha gdahome clona ogni volta che rinfresca il negozio**, e
 *    Home Assistant lo rinfresca da se'. Quindi le case distinte di un giorno
 *    sono le case **vive**, quelle accese e aggiornate — che e' esattamente la
 *    seconda domanda: chi continua ad aggiornare. Chi ha spento tutto sparisce
 *    dal conto in un paio di giorni, ed e' giusto cosi';
 *  - **GitHub tiene quattordici giorni, e poi butta.** Per avere un totale che
 *    cresce bisogna passare tutti i giorni a segnarsi quello che c'e', e
 *    tenerselo. Lo fa il lavoro «Quante case», una volta al giorno, e i conti
 *    li scrive su un ramo suo (`contatori`) per non sporcare la storia del
 *    programma. Un giorno saltato si recupera al giro dopo — la finestra e'
 *    lunga due settimane — e un giorno gia' scritto non si riscrive mai al
 *    ribasso: quello di oggi e' ancora a meta'.
 *
 * Qui dentro il conto e' separato dal viaggio: `unisci`, `iConti` e
 * `ilBollino` non sanno cosa sia la rete e si provano senza
 * (`ponte/test/le-case.test.js`). Quello che chiama GitHub e scrive i file sta
 * in fondo, e gira solo quando questo file si lancia da se'.
 *
 *     node strumenti/conta-le-case.mjs <cartella-dei-conti>
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* I colori sono quelli del marchio: il verde di «tutto a posto» per le case,
 * l'azzurro che nella plancia vuol dire «premi qui» per il totale. */
const VERDE = "16a34a";
const AZZURRO = "0ea5e9";

/** Il nome del file dove stanno i conti, sul ramo che li tiene. */
export const IL_FILE = "traffico.json";

/* Quanti giorni indietro guarda GitHub. Non e' una nostra scelta: e' la
 * finestra della sua pagina del traffico, e serve saperla per dire quanti
 * giorni di storia si possono ancora recuperare dopo un'interruzione. */
export const FINESTRA = 14;

const numero = (valore) => {
  const quanto = Number(valore);
  return Number.isFinite(quanto) && quanto > 0 ? Math.round(quanto) : 0;
};

/** Il giorno, nella forma `2026-09-17`. Quello che manda GitHub e' un'ora. */
export function ilGiorno(quando) {
  const data = new Date(quando);
  if (Number.isNaN(data.getTime())) return "";
  return data.toISOString().slice(0, 10);
}

/**
 * Mette insieme quello che si sapeva e quello che GitHub dice adesso.
 *
 * La regola e' una sola, e vale per ogni giorno: **si tiene il numero piu'
 * alto**. Il giorno in corso lo si vede a meta' — la corsa e' di mattina, la
 * giornata finisce a mezzanotte — e riscriverlo domani col numero pieno e'
 * giusto; riscriverlo col numero di stamattina, quando domani si guarda
 * indietro, sarebbe buttare via meta' giornata.
 *
 * @param {object} vecchi i giorni gia' scritti: `{"2026-09-16": {cloni, case}}`
 * @param {object} traffico la risposta di GitHub (`traffic/clones`)
 */
export function unisci(vecchi, traffico) {
  const giorni = { ...(vecchi && typeof vecchi === "object" ? vecchi : {}) };
  const arrivati = Array.isArray(traffico?.clones) ? traffico.clones : [];
  for (const uno of arrivati) {
    const giorno = ilGiorno(uno?.timestamp);
    if (!giorno) continue;
    const prima = giorni[giorno] || { cloni: 0, case: 0 };
    giorni[giorno] = {
      cloni: Math.max(numero(prima.cloni), numero(uno?.count)),
      case: Math.max(numero(prima.case), numero(uno?.uniques)),
    };
  }
  return Object.fromEntries(
    Object.entries(giorni).sort(([una], [altra]) => una.localeCompare(altra)),
  );
}

/**
 * I due numeri che si mostrano.
 *
 *  - **`case`**: quante case distinte, negli ultimi quattordici giorni. Non e'
 *    la somma dei giorni — una casa che clona tutti i giorni conterebbe
 *    quattordici volte — ed e' per questo che si prende quello che dice
 *    GitHub, che le distingue lui su tutta la finestra. Senza quel numero si
 *    ripiega sul giorno piu' affollato della finestra, che e' la stima piu'
 *    vicina che si possa fare da soli: **per difetto**, che e' il verso giusto
 *    in cui sbagliare un numero che si mostra in pubblico.
 *  - **`scaricamenti`**: tutti i cloni di tutti i giorni che si sono visti, da
 *    quando si conta. Cresce e non torna indietro, come il contatore della
 *    dashboard — e come quello conta i passaggi, non le persone.
 */
export function iConti(giorni, { distinte = null, finestra = FINESTRA } = {}) {
  const righe = Object.entries(giorni || {}).sort(([una], [altra]) => una.localeCompare(altra));
  const scaricamenti = righe.reduce((somma, [, uno]) => somma + numero(uno.cloni), 0);
  const ultimi = righe.slice(-finestra);
  const piuAffollato = ultimi.reduce((massimo, [, uno]) => Math.max(massimo, numero(uno.case)), 0);
  return {
    case: distinte === null || distinte === undefined ? piuAffollato : numero(distinte),
    scaricamenti,
    dal: righe.length ? righe[0][0] : "",
    giorni: righe.length,
  };
}

/** Un bollino nella forma che shields.io sa disegnare. */
export function ilBollino(etichetta, testo, colore) {
  return {
    schemaVersion: 1,
    label: etichetta,
    message: String(testo),
    color: colore,
  };
}

/** I tre file che si scrivono sul ramo dei conti. */
export function iFile(giorni, conti) {
  return {
    [IL_FILE]: {
      aggiornato: new Date().toISOString(),
      dal: conti.dal,
      case: conti.case,
      scaricamenti: conti.scaricamenti,
      giorni,
    },
    "bollino-case.json": ilBollino("case con gdahome", conti.case, VERDE),
    "bollino-scaricamenti.json": ilBollino(
      conti.dal ? `scaricamenti dal ${conti.dal}` : "scaricamenti",
      conti.scaricamenti,
      AZZURRO,
    ),
  };
}

/* ─── Il viaggio: GitHub, e i file sul disco ─────────────────────────────── */

async function ilTraffico(repository, gettone, prendi = globalThis.fetch) {
  const risposta = await prendi(`https://api.github.com/repos/${repository}/traffic/clones`, {
    headers: {
      authorization: `Bearer ${gettone}`,
      accept: "application/vnd.github+json",
      "user-agent": "gdahome-conti",
      "x-github-api-version": "2022-11-28",
    },
  });
  /* Il 401 e' un'altra cosa, e confonderlo col permesso costa un pomeriggio.
   *
   * 403 e 404 vogliono dire «questa credenziale non puo' leggere il
   * traffico»: e' un permesso che manca. **401 vuol dire che GitHub la
   * credenziale non l'ha nemmeno accettata** — scaduta, revocata, o con un
   * ritorno a capo dentro il segreto, che e' il classico del copia-incolla.
   * Cercare un permesso quando il gettone non vale e' cercare dalla parte
   * sbagliata, e la prima volta e' andata proprio cosi': «GitHub ha risposto
   * 401» e via a guardare i permessi. */
  if (risposta.status === 401) {
    throw new Error(
      "GitHub non ha accettato il gettone (401). Non e' un permesso che manca: " +
        "quel gettone e' scaduto, revocato, o nel segreto c'e' dentro uno spazio " +
        "o un ritorno a capo. Se esiste `GETTONE_CONTI` vince lui su " +
        "`GETTONE_SEGNALAZIONI`, quindi guarda prima quello.",
    );
  }
  if (risposta.status === 403 || risposta.status === 404) {
    /* Le due risposte che riceve un gettone che non puo' leggere il traffico.
     * Non e' un guasto: e' un permesso che manca, e va detto con quelle
     * parole invece che con un numero. */
    throw new Error(
      `GitHub non fa leggere il traffico di ${repository} (${risposta.status}). ` +
        "Al gettone serve il permesso «Administration: Read-only» su questa repository.",
    );
  }
  if (!risposta.ok) throw new Error(`GitHub ha risposto ${risposta.status}`);
  return risposta.json();
}

function leggiIVecchi(cartella) {
  const via = join(cartella, IL_FILE);
  if (!existsSync(via)) return {};
  try {
    return JSON.parse(readFileSync(via, "utf8"))?.giorni || {};
  } catch (_errore) {
    /* Un file rotto non ferma il conto: si riparte dalla finestra di GitHub,
     * che e' meglio di niente e si riempie da se'. */
    return {};
  }
}

export async function conta({
  cartella,
  repository = process.env.GITHUB_REPOSITORY || "danigio15/gdahomeapp",
  gettone = process.env.GETTONE || "",
  prendi = globalThis.fetch,
} = {}) {
  if (!gettone) throw new Error("manca il gettone per leggere il traffico");
  const traffico = await ilTraffico(repository, gettone, prendi);
  const giorni = unisci(leggiIVecchi(cartella), traffico);
  const conti = iConti(giorni, { distinte: traffico?.uniques });
  mkdirSync(cartella, { recursive: true });
  for (const [nome, cosa] of Object.entries(iFile(giorni, conti))) {
    writeFileSync(join(cartella, nome), `${JSON.stringify(cosa, null, 2)}\n`);
  }
  return conti;
}

/* Lanciato da se': `node strumenti/conta-le-case.mjs <cartella>`. */
if (process.argv[1] && process.argv[1].endsWith("conta-le-case.mjs")) {
  const cartella = process.argv[2] || "conti";
  conta({ cartella })
    .then((conti) => {
      console.log(
        `case negli ultimi ${FINESTRA} giorni: ${conti.case} · ` +
          `scaricamenti dal ${conti.dal || "primo giro"}: ${conti.scaricamenti} · ` +
          `giorni contati: ${conti.giorni}`,
      );
    })
    .catch((errore) => {
      console.error(errore.message);
      process.exit(1);
    });
}
