/* Porta l'`.aab` sul Play Console, dalla corsa che l'ha costruito.
 *
 * Prima si faceva a mano, e i passaggi erano cinque: scaricare l'artefatto,
 * scompattare lo zip, aprire il Play Console, trascinare il pacchetto,
 * incollare le novita' in due lingue. Cinque passaggi da rifare a ogni
 * versione sono cinque posti dove sbagliare, e uno di quelli — le novita'
 * scritte a mano nella casella — non lascia traccia da nessuna parte: quello
 * che il negozio racconta di una versione non si puo' rileggere qui dentro.
 *
 * Adesso le novita' stanno in `app/negozio/`, si guardano nei diff come tutto
 * il resto, e le porta su questo programma.
 *
 * ─── Perche' un programma nostro e non un'azione di qualcun altro ──────────
 *
 * Perche' quel credenziale **pubblica sul negozio**. Un'azione di terzi nella
 * corsa che ce l'ha in mano potrebbe caricare qualunque pacchetto sotto il
 * nome di chi la usa, e il giorno che quell'azione cambia padrone non se ne
 * accorgerebbe nessuno. Qui invece l'unica cosa che parla con Google sta
 * scritta in fondo a questo file, in chiaro, e non porta dietro nessuna
 * libreria: Node sa firmare un JWT da se'.
 *
 * ─── Come si usa ───────────────────────────────────────────────────────────
 *
 *     node strumenti/porta-nel-negozio.mjs app-release.aab --pista=internal
 *     node strumenti/porta-nel-negozio.mjs app-release.aab --pista=internal --prova
 *     node strumenti/porta-nel-negozio.mjs --piste
 *
 * `--prova` fa tutto tranne l'ultimo passo: carica, prepara la pista, chiede
 * a Google se va bene, e poi **butta la modifica** invece di pubblicarla.
 * Serve la prima volta, per vedere che il credenziale funzioni senza che
 * nessuno si ritrovi una versione nuova.
 *
 * `--piste` dice come si chiamano davvero le piste di questa app: una prova
 * chiusa fatta a mano nel Play Console non si chiama «prova chiusa», si
 * chiama qualcosa come `custom-12345`, e indovinarlo non si puo'.
 *
 * Il credenziale arriva da `NEGOZIO_GOOGLE`: il JSON dell'account di servizio,
 * cosi' com'e' o in base64. Non si scrive mai nel registro, e non si scrive
 * mai in questa repository.
 */

import { createSign } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));

/* Chi e' questa app per Android. Non e' il nome del progetto Flutter: e'
 * `applicationId` in `app/android/app/build.gradle.kts`, ed e' il nome con cui
 * il negozio la conosce. Se i due non tornano, Google risponde che
 * l'applicazione non esiste. */
export const COME_SI_CHIAMA = "com.gdahome.gdahome";

/* Dove stanno le novita', una per lingua: `app/negozio/it-IT.txt`. Il nome del
 * file **e'** la lingua, perche' il negozio le vuole per codice di lingua e un
 * elenco scritto altrove sarebbe una cosa in piu' da tenere allineata. */
export const CARTELLA_DELLE_NOVITA = join("app", "negozio");

/* Quanto il Play Console lascia scrivere in «Novita'». Lo si controlla qui e
 * non li': una casella rifiutata dopo aver caricato settanta megabyte e' un
 * giro di corsa buttato, e il numero lo sappiamo prima. */
export const QUANTO_SI_PUO_SCRIVERE = 500;

/* Le piste di serie del negozio. Le prove chiuse fatte a mano hanno un nome
 * loro, e per quelle c'e' `--piste`. */
export const PISTE_DI_SERIE = ["internal", "alpha", "beta", "production"];

const NEGOZIO = "https://androidpublisher.googleapis.com";
const CAMPO = "https://www.googleapis.com/auth/androidpublisher";

/* ─── Quello che non sa cosa sia la rete ───────────────────────────────────
 *
 * Tutto quello che sta qui sotto si prova senza Google (`ponte/test/
 * il-negozio.test.js`). Quello che parla con lui sta in fondo.
 */

/**
 * Il credenziale, da quello che c'e' scritto nel segreto.
 *
 * Si accettano due forme perche' esistono due modi di incollarlo e sbagliare
 * la scelta e' normale: il JSON com'e' — che ha degli a-capo dentro, e in
 * qualche posto si perdono — oppure lo stesso JSON in base64, che di a-capo
 * non ne ha. Chi non sa quale usare usa la seconda e non ci pensa.
 */
export function ilCredenziale(testo) {
  const scritto = String(testo || "").trim();
  if (!scritto) {
    throw new Error(
      "manca NEGOZIO_GOOGLE: e' il JSON dell'account di servizio del Play Console, " +
        "cosi' com'e' o in base64",
    );
  }
  let crudo = scritto;
  if (!crudo.startsWith("{")) {
    try {
      crudo = Buffer.from(scritto, "base64").toString("utf8");
    } catch (_errore) {
      crudo = "";
    }
  }
  let dentro = null;
  try {
    dentro = JSON.parse(crudo);
  } catch (_errore) {
    throw new Error("NEGOZIO_GOOGLE non e' un JSON: ne' in chiaro ne' in base64");
  }
  const posta = String(dentro?.client_email || "");
  const chiave = String(dentro?.private_key || "");
  if (!posta || !chiave) {
    throw new Error(
      "in NEGOZIO_GOOGLE mancano «client_email» o «private_key»: " +
        "e' il file di una **chiave** dell'account di servizio, non quello del progetto",
    );
  }
  return {
    posta,
    chiave,
    dove: String(dentro?.token_uri || "https://oauth2.googleapis.com/token"),
  };
}

const aUrl = (byte) =>
  Buffer.from(byte).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Il biglietto firmato con cui si chiede il permesso di parlare.
 *
 * Non c'e' nessuna libreria: un JWT sono tre pezzi separati da un punto, e il
 * terzo e' la firma dei primi due. Node firma con la chiave dell'account di
 * servizio, e Google in cambio da' un gettone che vale un'ora.
 */
export function ilBiglietto(credenziale, { adesso = Date.now() } = {}) {
  const quando = Math.floor(adesso / 1000);
  const testa = aUrl(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const dentro = aUrl(
    JSON.stringify({
      iss: credenziale.posta,
      scope: CAMPO,
      aud: credenziale.dove,
      iat: quando,
      exp: quando + 3600,
    }),
  );
  const firma = createSign("RSA-SHA256").update(`${testa}.${dentro}`).sign(credenziale.chiave);
  return `${testa}.${dentro}.${aUrl(firma)}`;
}

/**
 * Le novita', una per lingua, lette dai file.
 *
 * Il negozio le vuole cosi': `[{language: "it-IT", text: "…"}]`. Se una e'
 * troppo lunga non si carica niente e si dice **quale file** e di quanto
 * sfora: scoprirlo dopo il caricamento vorrebbe dire rifare tutto.
 */
export function leNovita(cartella, { quanto = QUANTO_SI_PUO_SCRIVERE } = {}) {
  let nomi = [];
  try {
    nomi = readdirSync(cartella)
      .filter((nome) => nome.endsWith(".txt"))
      .sort();
  } catch (_errore) {
    throw new Error(`le novita' non ci sono: manca la cartella ${cartella}`);
  }
  if (!nomi.length) throw new Error(`in ${cartella} non c'e' nessun .txt: le novita' mancano`);
  const dette = [];
  for (const nome of nomi) {
    const lingua = basename(nome, ".txt");
    const testo = readFileSync(join(cartella, nome), "utf8").trim();
    if (!testo) throw new Error(`${nome} e' vuoto: una casella vuota nel negozio non si scrive`);
    if (testo.length > quanto) {
      throw new Error(
        `${nome} e' ${testo.length} caratteri, e il Play Console ne prende ${quanto}: ` +
          `${testo.length - quanto} di troppo`,
      );
    }
    dette.push({ language: lingua, text: testo });
  }
  return dette;
}

/**
 * La pista su cui va, e il freno su quella che conta.
 *
 * `production` e' l'unica da cui non si torna indietro con un bottone: chi la
 * chiede deve dirlo due volte. Non e' burocrazia — le altre tre pubblicano a
 * chi ha accettato di provare, quella pubblica a tutti.
 */
export function laPista(nome, { davvero = false } = {}) {
  const quale = String(nome || "").trim();
  if (!quale) {
    throw new Error(`su quale pista? Le solite sono ${PISTE_DI_SERIE.join(", ")}; --piste le dice`);
  }
  if (quale === "production" && !davvero) {
    throw new Error(
      "«production» pubblica a tutti e non si torna indietro premendo un tasto: " +
        "se e' quello che vuoi, aggiungi --davvero",
    );
  }
  return quale;
}

/** Quanto pesa, detto come lo dice un essere umano. */
export function quantoPesa(byte) {
  const mega = byte / (1024 * 1024);
  return mega >= 10 ? `${Math.round(mega)} MB` : `${mega.toFixed(1)} MB`;
}

/* ─── Quello che parla con Google ──────────────────────────────────────────── */

async function chiedi(prendi, dove, { metodo = "GET", gettone, corpo, tipo } = {}) {
  const risposta = await prendi(dove, {
    method: metodo,
    headers: {
      authorization: `Bearer ${gettone}`,
      ...(tipo ? { "content-type": tipo } : {}),
    },
    ...(corpo === undefined ? {} : { body: corpo }),
  });
  const testo = await risposta.text();
  if (!risposta.ok) {
    /* Quello che Google dice del perche', che e' quasi sempre una frase
     * sensata: «the caller does not have permission», «Package not found». Un
     * numero da solo manderebbe a cercare dalla parte sbagliata. */
    let perche = testo.slice(0, 400);
    try {
      perche = JSON.parse(testo)?.error?.message || perche;
    } catch (_errore) {
      /* Non era JSON: si tiene il testo. */
    }
    throw new Error(`il negozio ha risposto ${risposta.status}: ${perche}`);
  }
  if (!testo) return {};
  try {
    return JSON.parse(testo);
  } catch (_errore) {
    return {};
  }
}

/** Il gettone che vale un'ora, in cambio del biglietto firmato. */
export async function ilGettone(credenziale, prendi = globalThis.fetch) {
  const risposta = await prendi(credenziale.dove, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: ilBiglietto(credenziale),
    }).toString(),
  });
  const detto = await risposta.json().catch(() => ({}));
  if (!risposta.ok || !detto?.access_token) {
    /* `invalid_grant` qui vuol dire quasi sempre una cosa sola, e conviene
     * dirla: l'account di servizio esiste ma nel Play Console non e' stato
     * invitato, oppure l'orologio della macchina e' fuori di qualche minuto. */
    throw new Error(
      `Google non da' il gettone (${risposta.status} ${detto?.error || ""}): ` +
        "l'account di servizio va invitato nel Play Console, con il permesso di pubblicare",
    );
  }
  return String(detto.access_token);
}

const perApp = (coda) =>
  `${NEGOZIO}/androidpublisher/v3/applications/${encodeURIComponent(COME_SI_CHIAMA)}${coda}`;

/**
 * Porta il pacchetto su, e lo pubblica sulla pista.
 *
 * Il negozio lavora a «modifiche»: si apre una modifica, ci si mette dentro
 * tutto, e alla fine si consegna. Se qualcosa non va, la modifica **si butta**
 * — se no resta aperta e la volta dopo non si capisce piu' cosa c'e' dentro.
 */
export async function porta({
  pacco,
  pista,
  novita,
  segreto = process.env.NEGOZIO_GOOGLE || "",
  prendi = globalThis.fetch,
  prova = false,
  dillo = () => {},
  /* Quanto si aspetta fra un tentativo e l'altro di riguardare la pista: le
   * prove lo passano a zero, che se no aspettano davvero. */
  aspetta = (quanto) => new Promise((ok) => setTimeout(ok, quanto)),
}) {
  const credenziale = ilCredenziale(segreto);
  const byte = readFileSync(pacco);
  dillo(`${basename(pacco)}: ${quantoPesa(byte.length)}`);

  const gettone = await ilGettone(credenziale, prendi);
  dillo(`entrato nel negozio come ${credenziale.posta}`);

  const modifica = await chiedi(prendi, perApp("/edits"), { metodo: "POST", gettone });
  const quale = String(modifica?.id || "");
  if (!quale) throw new Error("il negozio non ha aperto nessuna modifica");

  try {
    const salito = await chiedi(
      prendi,
      `${NEGOZIO}/upload/androidpublisher/v3/applications/${encodeURIComponent(
        COME_SI_CHIAMA,
      )}/edits/${quale}/bundles?uploadType=media`,
      { metodo: "POST", gettone, corpo: byte, tipo: "application/octet-stream" },
    );
    const numero = Number(salito?.versionCode);
    if (!Number.isInteger(numero) || numero <= 0) {
      throw new Error("il negozio ha preso il pacchetto ma non dice quale versione sia");
    }
    dillo(`caricato: versione ${numero}`);

    await chiedi(prendi, perApp(`/edits/${quale}/tracks/${encodeURIComponent(pista)}`), {
      metodo: "PATCH",
      gettone,
      tipo: "application/json",
      corpo: JSON.stringify({
        releases: [{ versionCodes: [String(numero)], status: "completed", releaseNotes: novita }],
      }),
    });
    dillo(`messo sulla pista «${pista}», con le novita' in ${novita.length} lingue`);

    /* Prima di consegnare si chiede a lui se va bene: e' l'unico modo di
     * scoprire un guaio **senza** averlo pubblicato. */
    await chiedi(prendi, perApp(`/edits/${quale}:validate`), { metodo: "POST", gettone });
    dillo("il negozio dice che va bene");

    if (prova) {
      await chiedi(prendi, perApp(`/edits/${quale}`), { metodo: "DELETE", gettone });
      dillo("--prova: la modifica e' stata buttata, nel negozio non e' cambiato niente");
      return { versione: numero, pista, pubblicato: false };
    }

    await chiedi(prendi, perApp(`/edits/${quale}:commit`), { metodo: "POST", gettone });
    dillo(`pubblicato: la ${numero} e' sulla pista «${pista}»`);

    /* E adesso si guarda se c'e' davvero. Un `commit` riuscito dice che il
     * negozio ha preso la modifica, non che i tester vedranno qualcosa: fra le
     * due cose c'e' la lavorazione del pacchetto, e a volte una revisione. */
    const sulla = await cosaCEeSullaPista({ pista, gettone, prendi, aspetta });
    const mia = (sulla || []).find((una) => una.versioni.includes(numero));
    if (mia) {
      dillo(`il negozio conferma: la ${numero} e' sulla pista «${pista}», stato ${mia.stato}`);
      return { versione: numero, pista, pubblicato: true, confermato: true, stato: mia.stato };
    }
    /* Non si fa fallire: la modifica e' stata consegnata davvero, e dire di no
     * sarebbe sbagliato quanto il verde di prima. Si dice quello che si sa. */
    const altre = (sulla || []).flatMap((una) => una.versioni);
    dillo(
      `ATTENZIONE: il negozio non mi conferma la ${numero} sulla pista «${pista}»` +
        (altre.length ? ` (li' vedo la ${altre.join(", ")})` : " (non vedo nessuna versione)") +
        ". La consegna e' andata: il pacchetto puo' essere ancora in lavorazione o in revisione. " +
        "Da controllare nella Play Console, o con --piste.",
    );
    return { versione: numero, pista, pubblicato: true, confermato: false, stato: "" };
  } catch (errore) {
    /* Una modifica aperta e mai consegnata resta li' a scadere, e la prossima
     * volta nessuno sa cosa ci fosse dentro. */
    try {
      await chiedi(prendi, perApp(`/edits/${quale}`), { metodo: "DELETE", gettone });
      dillo("la modifica e' stata buttata: nel negozio non e' cambiato niente");
    } catch (_altro) {
      dillo(`attenzione: la modifica ${quale} e' rimasta aperta, e scadra' da se'`);
    }
    throw errore;
  }
}

/* Quello che c'e' davvero su una pista, chiesto al negozio.
 *
 * Il `commit` dice che la modifica e' stata consegnata, e finiva li': il
 * registro scriveva «pubblicato» e il lavoro diventava verde. Ma «consegnata»
 * e «sulla pista» sono due cose, e la differenza si scopre soltanto
 * riguardando — «l'apk dell'ultima release non e' arrivato nello store» e' la
 * domanda a cui questo passo risponde senza aprire la console.
 *
 * Si riguarda con una modifica NUOVA, perche' quella consegnata non esiste
 * piu'; e si riprova un paio di volte, perche' il negozio ci mette qualche
 * istante a farlo vedere. Chi chiede non passa il segreto: passa il gettone
 * che ha gia' in mano. */
export async function cosaCEeSullaPista({
  pista,
  gettone,
  prendi = globalThis.fetch,
  tentativi = 3,
  aspetta = (quanto) => new Promise((ok) => setTimeout(ok, quanto)),
}) {
  let ultimo = null;
  for (let giro = 0; giro < Math.max(1, tentativi); giro += 1) {
    if (giro > 0) await aspetta(2000 * giro);
    const modifica = await chiedi(prendi, perApp("/edits"), { metodo: "POST", gettone });
    const quale = String(modifica?.id || "");
    if (!quale) continue;
    try {
      const dentro = await chiedi(
        prendi,
        perApp(`/edits/${quale}/tracks/${encodeURIComponent(pista)}`),
        {
          gettone,
        },
      );
      ultimo = (Array.isArray(dentro?.releases) ? dentro.releases : []).map((uno) => ({
        stato: String(uno?.status || ""),
        versioni: (Array.isArray(uno?.versionCodes) ? uno.versionCodes : []).map(Number),
      }));
      if (ultimo.length) return ultimo;
    } catch (_errore) {
      /* Una lettura andata male non e' una pubblicazione andata male: si
       * riprova, e se non viene si dice che non si sa. */
    } finally {
      try {
        await chiedi(prendi, perApp(`/edits/${quale}`), { metodo: "DELETE", gettone });
      } catch (_errore) {
        /* Scadra' da se'. */
      }
    }
  }
  return ultimo;
}

/** Come si chiamano davvero le piste di questa app. */
export async function lePiste({
  segreto = process.env.NEGOZIO_GOOGLE || "",
  prendi = globalThis.fetch,
} = {}) {
  const credenziale = ilCredenziale(segreto);
  const gettone = await ilGettone(credenziale, prendi);
  const modifica = await chiedi(prendi, perApp("/edits"), { metodo: "POST", gettone });
  const quale = String(modifica?.id || "");
  try {
    const dentro = await chiedi(prendi, perApp(`/edits/${quale}/tracks`), { gettone });
    return (Array.isArray(dentro?.tracks) ? dentro.tracks : []).map((una) => ({
      nome: String(una?.track || ""),
      versioni: (Array.isArray(una?.releases) ? una.releases : []).flatMap((uno) =>
        (Array.isArray(uno?.versionCodes) ? uno.versionCodes : []).map(Number),
      ),
      /* E in che stato sta ognuna: «completed» e' distribuita a tutti quelli
       * della pista, «inProgress» e' a una fetta, «draft» non e' uscita. Senza
       * questa parola l'elenco diceva un numero e lasciava la domanda. */
      stati: (Array.isArray(una?.releases) ? una.releases : [])
        .map((uno) => String(uno?.status || ""))
        .filter(Boolean),
    }));
  } finally {
    try {
      await chiedi(prendi, perApp(`/edits/${quale}`), { metodo: "DELETE", gettone });
    } catch (_errore) {
      /* Scadra' da se'. */
    }
  }
}

/* ─── Lanciato da se' ──────────────────────────────────────────────────────── */

if (process.argv[1] && process.argv[1].endsWith("porta-nel-negozio.mjs")) {
  const detto = process.argv.slice(2);
  const parola = (nome) => {
    const trovata = detto.find((una) => una.startsWith(`--${nome}=`));
    return trovata ? trovata.slice(nome.length + 3) : "";
  };
  const dillo = (cosa) => console.log(cosa);

  const vaMale = (errore) => {
    console.error(errore?.message || errore);
    process.exit(1);
  };

  if (detto.includes("--piste")) {
    lePiste()
      .then((piste) => {
        if (!piste.length) return dillo("questa app non ha nessuna pista con qualcosa sopra");
        for (const una of piste) {
          const stati = (una.stati || []).filter(Boolean);
          dillo(
            `${una.nome}${una.versioni.length ? `: versione ${una.versioni.join(", ")}` : ""}` +
              (stati.length ? ` (${stati.join(", ")})` : ""),
          );
        }
      })
      .catch(vaMale);
  } else {
    const pacco = detto.find((una) => !una.startsWith("--")) || "";
    try {
      if (!pacco)
        throw new Error("uso: node strumenti/porta-nel-negozio.mjs <pacco.aab> --pista=…");
      /* Il pacchetto prima di tutto il resto, e detto con parole: un `ENOENT`
       * in mezzo a una corsa manda a cercare un guasto che non c'e'. Quasi
       * sempre e' una cosa sola — lo zip di GitHub non e' stato scompattato, e
       * l'`.aab` sta dentro. */
      try {
        statSync(pacco);
      } catch (_errore) {
        throw new Error(
          `quel pacchetto non c'e': ${pacco}\n` +
            "(l'artefatto di GitHub e' uno zip: dentro c'e' app-release.aab)",
        );
      }
      const pista = laPista(parola("pista"), { davvero: detto.includes("--davvero") });
      const novita = leNovita(join(RADICE, CARTELLA_DELLE_NOVITA));
      porta({ pacco, pista, novita, prova: detto.includes("--prova"), dillo }).catch(vaMale);
    } catch (errore) {
      vaMale(errore);
    }
  }
}
