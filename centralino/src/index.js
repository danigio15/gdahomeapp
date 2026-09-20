/* Il centralino si alza. */

import { join } from "node:path";

import { Case } from "./case.js";
import { ArchivioDellaChat, Chat } from "./chat.js";
import { Centralino } from "./centralino.js";
import { Contatti, Postino } from "./posta.js";
import { apriIlRegistro } from "./registro.js";
import { costruisciIlServer } from "./server.js";
import { Sportello } from "./sportello.js";

const POTATURA = 12 * 60 * 60 * 1000;

export async function alzaIlCentralino({
  porta = Number(process.env.CENTRALINO_PORTA || 8099),
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
  /* La chiave con cui si apre la console della chat. Una sola, e vede tutte le
   * linee: senza, le case possono scrivere ma nessuno puo' leggere, ed e' una
   * cosa che `/salute` dice invece di farla scoprire il giorno in cui qualcuno
   * chiede aiuto. */
  chiaveDellaConsole = process.env.CHIAVE_CONSOLE || "",
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
} = {}) {
  const registro = apriIlRegistro(livello);
  const case_ = new Case({ cartella, giorniDiSilenzio });
  const centralino = new Centralino({ case: case_, registro });
  const sportello = new Sportello({
    case: case_,
    cartella,
    gettone: gettoneDiGitHub,
    repo: repoDiGitHub,
    repoAllegati: repoDegliAllegati,
  });
  const chat = new Chat({
    archivio: new ArchivioDellaChat(join(cartella, "chat.sqlite")),
    chiaveDellaConsole,
  });
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
    registro,
  });
  const server = costruisciIlServer({
    centralino,
    sportello,
    chat,
    contatti,
    registro,
    dove: { sito: ilSito, app: lApp },
  });

  await new Promise((riuscito, fallito) => {
    server.once("error", fallito);
    server.listen(porta, "0.0.0.0", () => {
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
  registro.info(
    contatti.pronto
      ? `il modulo dei contatti spedisce a ${postaA} passando da ${postaServer}`
      : "il modulo dei contatti e' spento: manca il server di posta, il mittente o il destinatario",
  );

  const giro = setInterval(() => {
    const andate = case_.potatura();
    if (andate) registro.info(`${andate} case tolte perche' sparite da troppo tempo`);
    const chiuse = chat.archivio.potatura();
    if (chiuse) registro.info(`${chiuse} conversazioni chiuse perche' ferme da sei mesi`);
  }, POTATURA);
  giro.unref?.();

  const abbassa = async () => {
    registro.info("il centralino si spegne");
    clearInterval(giro);
    centralino.chiudiTutto();
    await new Promise((ok) => server.close(ok));
    chat.archivio.chiudi();
  };

  return { centralino, case: case_, sportello, chat, contatti, server, registro, abbassa };
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
