/* Il centralino si alza. */

import { join } from "node:path";

import { Case } from "./case.js";
import { ArchivioDellaChat, Chat } from "./chat.js";
import { Centralino } from "./centralino.js";
import { CHIAVE_PUBBLICA_LICENZE } from "./chiave-licenze.js";
import { FotoDiPassaggio } from "./foto.js";
import { numeroDa } from "./freno.js";
import { Contatti, Postino } from "./posta.js";
import { ilModoDelleLicenze } from "./modo-delle-licenze.js";
import { apriIlRegistro } from "./registro.js";
import { REVOCHE_DI_SERIE, Revoche } from "./revoche.js";
import { Ricevute } from "./ricevute.js";
import { costruisciIlServer } from "./server.js";
import { Sportello } from "./sportello.js";
import { leggiLaChiaveDiFirebase, Spinte } from "./spinte.js";
import { versioneMinimaDa } from "./versioni.js";

const POTATURA = 12 * 60 * 60 * 1000;

export async function alzaIlCentralino({
  porta = Number(process.env.CENTRALINO_PORTA || 8099),
  /* Su quale indirizzo ascolta. Di serie solo su questa macchina: davanti
   * c'e' Caddy, che parla con lui da qui, e da fuori si passa da Caddy — in
   * https — e mai dritti su questa porta in chiaro. Chi lo fa girare senza
   * Caddy davanti lo apre di proposito, con `CENTRALINO_INDIRIZZO=0.0.0.0`. */
  indirizzo = process.env.CENTRALINO_INDIRIZZO || "127.0.0.1",
  cartella = process.env.CENTRALINO_DATI || "./dati",
  giorniDiSilenzio = Number(process.env.CENTRALINO_SILENZIO || 180),
  livello = process.env.CENTRALINO_REGISTRO || "info",
  /* Il gettone delle segnalazioni e la repository dove finiscono. Sono del
   * manutentore e restano **qui**: non stanno in nessun ponte e su nessun
   * telefono, e da qui vanno solo verso api.github.com. Senza, lo sportello
   * risponde lo stesso e dice che non e' configurato. */
  gettoneDiGitHub = process.env.GITHUB_SEGNALAZIONI || "",
  repoDiGitHub = process.env.GITHUB_REPO || "",
  /* E dove vanno le foto e i video, che puo' essere un'altra repository.
   *
   * Gli allegati non sono allegati di GitHub: si **committano**, sotto
   * `allegati/<numero>/`, e restano nella storia di git per sempre. La
   * repository del progetto e' quella che Home Assistant clona per installare
   * l'add-on: le foto delle case degli altri non ci vanno. Vuota vuol dire
   * «la stessa delle issue», che e' come stava prima. */
  repoDegliAllegati = process.env.GITHUB_REPO_ALLEGATI || "",
  /* E su quale ramo di quella repository. Vuoto vuol dire il principale —
   * che e' anche quello che Home Assistant scarica, se la repository e' la
   * stessa del progetto — e per questo lo script che accende la macchina ci
   * scrive `allegati`. */
  ramoDegliAllegati = process.env.GITHUB_RAMO_ALLEGATI || "",
  /* Quante case nuove all'ora, da un indirizzo e in tutto. */
  caseNuovePerIndirizzo = numeroDa(process.env.CENTRALINO_CASE_NUOVE_PER_INDIRIZZO, undefined),
  caseNuoveInTutto = numeroDa(process.env.CENTRALINO_CASE_NUOVE_IN_TUTTO, undefined),
  /* Quante scritture verso GitHub all'ora, da un indirizzo e in tutto. */
  scritturePerIndirizzo = numeroDa(process.env.CENTRALINO_SCRITTURE_PER_INDIRIZZO, undefined),
  scrittureInTutto = numeroDa(process.env.CENTRALINO_SCRITTURE_IN_TUTTO, undefined),
  /* La chiave con cui si apre la console della chat. Una sola, e vede tutte le
   * linee: senza, le case possono scrivere ma nessuno puo' leggere, ed e' una
   * cosa che `/salute` dice invece di farla scoprire il giorno in cui qualcuno
   * chiede aiuto. */
  chiaveDellaConsole = process.env.CHIAVE_CONSOLE || "",
  /* La chiave pubblica delle licenze. Di serie quella scritta nel codice
   * (`chiave-licenze.js`), ed e' l'unica strada in produzione: qui non c'e'
   * nessuna variabile d'ambiente che la cambi. Si passa solo da chi chiama
   * questa funzione — le prove dell'app, che accendono il centralino vero e
   * provano la strada da fuori, non la licenza. */
  chiaveLicenze = undefined,
  /* Cosa si fa dei gettoni: `spento`, `registra` o `impone`
   * (`modo-delle-licenze.js`). Vuoto vuol dire quello di sempre: `spento`
   * con la chiave vuota, `impone` con la chiave scritta. `registra` conta
   * senza chiudere; con una chiave vuota o storta non si impone comunque. */
  modoLicenze = process.env.MODO_LICENZE || "",
  /* Dove chiedere al quadro le licenze tolte (`revoche.js`). Di serie il
   * quadro vero: una licenza tolta deve chiudere subito, non alla fine del
   * suo gettone, e sulla macchina `QUADRO_REVOCHE` non era mai stato
   * scritto. Chi accende il centralino dalle prove passa "" e non chiede. */
  dellaRevoche = process.env.QUADRO_REVOCHE || REVOCHE_DI_SERIE,
  /* Se una linea della chat nasce solo col nome e il segreto di una casa
   * gia' presentata dal filo. Vedi `chat.js`: si accende quando il ponte
   * scrivera' in chat con l'identita' del filo. */
  chatSoloCaseConosciute = process.env.CHAT_SOLO_CASE_CONOSCIUTE === "1",
  /* Come si chiamano il sito e l'app di questo centralino. Non servono a
   * lavorare — servono alla soglia, cioe' a chi apre l'indirizzo nudo e va
   * mandato dove si va davvero. Senza, la soglia c'e' comunque e dice una
   * riga in meno: un centralino proprio non e' detto che abbia un sito. */
  ilSito = process.env.NOME_DEL_SITO || "",
  lApp = process.env.NOME_DELL_APP || "",
  /* La posta del modulo «Contatti» del sito. Il modulo sta su gdahome.org,
   * cioe' su Caddy, che lo passa qui: `POST /contatto`. La lettera si consegna
   * a un server di posta che esiste gia' — la casella che risponde — con
   * utente e password, come farebbe un programma di posta qualunque. Senza
   * server il modulo risponde «non configurato» e dice a chi scrive dove
   * scrivere, invece di far finta di aver spedito. */
  postaServer = process.env.POSTA_SERVER || "",
  postaPorta = Number(process.env.POSTA_PORTA || 587),
  postaSicurezza = process.env.POSTA_SICUREZZA || "",
  postaUtente = process.env.POSTA_UTENTE || "",
  postaPassword = process.env.POSTA_PASSWORD || "",
  postaDa = process.env.POSTA_DA || "",
  postaA = process.env.POSTA_A || "",
  /* Da quali origini un browser puo' mandare il modulo dei contatti. Di
   * serie quelle del sito — `https://<sito>` e `https://www.<sito>` — e
   * nessun controllo se il sito non ha un nome. */
  originiDelModulo = process.env.CONTATTO_ORIGINI || "",
  /* Il giorno dei pagamenti: il numero di costruzione della prima versione
   * pubblica a pagamento. Le app con un numero piu' piccolo si fermano e
   * chiedono di essere aggiornate (`versioni.js`, `docs/LICENZE.md`). Vuoto
   * o zero: non si ferma nessuno. */
  versioneMinimaDellApp = process.env.VERSIONE_MINIMA_APP || "",
  /* La chiave di Firebase per le notifiche (`spinte.js`): un file, mai una
   * variabile. Di serie quello che systemd passa al servizio
   * (`LoadCredential=firebase-invio`, in `accendi.sh`); `FIREBASE_INVIO`
   * dice un altro percorso, per chi lo fa girare a mano. Senza, le notifiche
   * sono spente. */
  chiaveDiFirebase = undefined,
  percorsoDellaChiaveDiFirebase = process.env.FIREBASE_INVIO || "",
} = {}) {
  const registro = apriIlRegistro(livello);
  const definiti = (oggetto) =>
    Object.fromEntries(Object.entries(oggetto).filter(([, valore]) => valore !== undefined));
  const case_ = new Case({
    cartella,
    giorniDiSilenzio,
    ...definiti({ nuovePerIndirizzo: caseNuovePerIndirizzo, nuoveInTutto: caseNuoveInTutto }),
  });
  const chiaveVera = chiaveLicenze === undefined ? CHIAVE_PUBBLICA_LICENZE : chiaveLicenze;
  const modo = ilModoDelleLicenze(modoLicenze, { chiave: chiaveVera, registro });
  /* Le licenze tolte si chiedono solo se servono a qualcosa: a licenze spente
   * nessuno guarda i gettoni. */
  const revoche =
    modo !== "spento" && dellaRevoche
      ? new Revoche({ dove: dellaRevoche, chiave: chiaveVera, registro })
      : null;
  const spinte = new Spinte({
    cartella,
    registro,
    chiave:
      chiaveDiFirebase === undefined
        ? leggiLaChiaveDiFirebase({ percorso: percorsoDellaChiaveDiFirebase, registro })
        : chiaveDiFirebase,
  });
  /* Le istantanee delle notifiche elaborate: in memoria, dieci minuti. */
  const foto = new FotoDiPassaggio();
  const centralino = new Centralino({
    case: case_,
    registro,
    chiaveLicenze: chiaveVera,
    modoLicenze: modo,
    revoche,
    spinte,
    foto,
  });
  const sportello = new Sportello({
    case: case_,
    cartella,
    gettone: gettoneDiGitHub,
    repo: repoDiGitHub,
    repoAllegati: repoDegliAllegati,
    ramoAllegati: ramoDegliAllegati,
    registro,
    ...definiti({ scritturePerIndirizzo, scrittureInTutto }),
  });
  const chat = new Chat({
    archivio: new ArchivioDellaChat(join(cartella, "chat.sqlite")),
    chiaveDellaConsole,
    case: case_,
    soloCaseConosciute: chatSoloCaseConosciute,
  });
  if (chiaveDellaConsole && !chat.consoleAperta) {
    registro.attenzione(
      "la chiave della console e' troppo corta (ne servono almeno 32 caratteri): la console resta chiusa",
    );
  }
  const origini = originiDelModulo
    ? originiDelModulo.split(",")
    : ilSito
      ? [`https://${ilSito}`, `https://www.${ilSito}`]
      : [];
  const contatti = new Contatti({
    postino: postaServer
      ? new Postino({
          server: postaServer,
          porta: postaPorta,
          sicurezza: postaSicurezza,
          utente: postaUtente,
          password: postaPassword,
          miChiamo: ilSito || undefined,
        })
      : null,
    da: postaDa || postaUtente,
    a: postaA,
    sito: ilSito,
    origini,
    registro,
  });
  const minima = versioneMinimaDa(versioneMinimaDellApp);
  const server = costruisciIlServer({
    centralino,
    sportello,
    chat,
    contatti,
    ricevute: new Ricevute({ centralino, registro }),
    foto,
    registro,
    dove: { sito: ilSito, app: lApp },
    versioneMinima: minima,
  });

  await new Promise((riuscito, fallito) => {
    server.once("error", fallito);
    server.listen(porta, indirizzo, () => {
      server.removeListener("error", fallito);
      riuscito();
    });
  });

  registro.info(`il centralino ascolta sulla ${server.address().port}`);
  registro.info(`${case_.quante()} case conosciute`);
  registro.info(
    sportello.pronto
      ? `le segnalazioni finiscono su ${repoDiGitHub}`
      : "le segnalazioni sono spente: manca il gettone di GitHub o la repository",
  );
  registro.info(
    chat.consoleAperta
      ? `la chat ha ${chat.archivio.quanteLinee()} conversazioni`
      : "la chat riceve, ma la console e' chiusa: manca la chiave",
  );
  if (!minima && !/^0*$/.test(String(versioneMinimaDellApp).trim())) {
    registro.attenzione(
      `VERSIONE_MINIMA_APP non e' un numero di costruzione («${versioneMinimaDellApp}»): non si ferma nessuna app`,
    );
  }
  registro.info(
    minima
      ? `le app sotto la ${minima} si fermano e chiedono di essere aggiornate`
      : "nessuna versione minima dell'app: non si ferma nessuno",
  );
  /* Il modo delle licenze si dice sempre, all'accensione: e' la riga da
   * cercare nel registro quando qualcuno dice «da fuori non entro». */
  registro.info(
    {
      spento: "licenze spente: da fuori entrano tutti",
      registra:
        "licenze in registra: i gettoni si verificano e si contano (/salute), ma da fuori entrano tutti",
      impone: "licenze in impone: da fuori si entra con GdAHome Premium",
    }[modo],
  );
  if (dellaRevoche && !revoche) {
    registro.info("QUADRO_REVOCHE c'e', ma a licenze spente le licenze tolte non si chiedono");
  }
  revoche?.avvia();
  /* Delle notifiche si dice se sono accese, e quanti telefoni le aspettano.
   * Della chiave niente: che c'e', e basta. */
  registro.info(
    spinte.accese
      ? `le notifiche sono accese: ${spinte.quanti()} telefoni le aspettano`
      : "le notifiche sono spente: manca la chiave di Firebase",
  );

  registro.info(
    contatti.pronto
      ? `il modulo dei contatti spedisce a ${postaA} passando da ${postaServer}`
      : "il modulo dei contatti e' spento: manca il server di posta, il mittente o il destinatario",
  );

  const giro = setInterval(() => {
    const andate = case_.potatura();
    if (andate) registro.info(`${andate} case addormentate perche' sparite da troppo tempo`);
    const chiuse = chat.archivio.potatura();
    if (chiuse) registro.info(`${chiuse} conversazioni chiuse perche' ferme da sei mesi`);
  }, POTATURA);
  giro.unref?.();

  const abbassa = async () => {
    registro.info("il centralino si spegne");
    clearInterval(giro);
    centralino.chiudiTutto();
    await new Promise((ok) => server.close(ok));
    case_.chiudi();
    chat.archivio.chiudi();
  };

  return {
    centralino,
    case: case_,
    spinte,
    foto,
    sportello,
    chat,
    contatti,
    server,
    registro,
    abbassa,
  };
}

if (
  process.argv[1] &&
  import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href
) {
  const acceso = await alzaIlCentralino();
  for (const segnale of ["SIGTERM", "SIGINT"]) {
    process.on(segnale, () => {
      acceso.abbassa().finally(() => process.exit(0));
    });
  }
}
