/* Il quadro si alza.
 *
 * Un server, tre archivi su disco, niente altro. Non c'e' niente da
 * installare: HTTP e la crittografia vengono da Node, e il resto sono seicento
 * righe di programma.
 *
 * **Ce n'e' uno solo, e sta su una macchina di gdahome.** Non uno per
 * installatore: chi installa non accende niente, non prende un dominio e non
 * apre una porta — gli si da' una chiave e apre una pagina. Dentro ci stanno
 * le case di installatori diversi, e tenerle separate e' mestiere di questo
 * programma, non di macchine diverse.
 *
 * E' anche l'unico modo perche' un limite sia un limite. Un quadro che gira in
 * casa di chi lo usa i propri conti se li fa da se': il numero di case che un
 * installatore puo' seguire lo decide chi tiene il quadro, e lo puo' decidere
 * solo se il quadro e' suo.
 *
 * Non sta dentro il centralino, che e' un'altra cosa e sta su un'altra porta:
 * quello instrada senza capire, e c'e' una prova che guarda cosa lo
 * attraversa. Sulla stessa macchina si', nello stesso programma no.
 */

import { CaseSeguite } from "./case.js";
import { Chiavi } from "./chiavi.js";
import { Fattorino } from "./fattorino.js";
import { Giro } from "./giro.js";
import { Installatori } from "./installatori.js";
import { apriIlRegistro } from "./registro.js";
import { costruisciIlServer } from "./server.js";

/** Ogni quanto si buttano gli inviti scaduti. */
const POTATURA = 60 * 60 * 1000;

export async function alzaIlQuadro({
  porta = Number(process.env.QUADRO_PORTA || 8100),
  cartella = process.env.QUADRO_DATI || "./dati",
  livello = process.env.QUADRO_REGISTRO || "info",
  /* La chiave di gestione: quella di chi **tiene** il quadro.
   *
   * Non e' la chiave di un installatore — quelle le fa questo quadro, una a
   * testa, e le vede solo chi le riceve. Questa aggiunge gli installatori e mette i limiti, e
   * senza non si puo' iscrivere nessuno: un quadro cosi' riceve rapporti di
   * case gia' abbinate e non ne fa entrare di nuove. Va lunga. */
  chiaveDelGestore = process.env.QUADRO_GESTORE || "",
} = {}) {
  const registro = apriIlRegistro(livello);
  const case_ = new CaseSeguite({ cartella });
  const chiavi = new Chiavi({ cartella });
  const installatori = new Installatori({ cartella });

  const fattorino = new Fattorino({ registro });

  const server = costruisciIlServer({
    case: case_,
    chiavi,
    installatori,
    chiaveDelGestore,
    cartella,
    fattorino,
    registro,
  });

  /* Il giro degli avvisi: quello che fa lavorare il quadro mentre nessuno lo
   * guarda. Parte insieme al server e non dice niente al primo passaggio —
   * un quadro appena acceso non sa cosa e' successo mentre era spento. */
  const giro = new Giro({ case: case_, installatori, fattorino, registro });

  await new Promise((riuscito, fallito) => {
    server.once("error", fallito);
    server.listen(porta, "0.0.0.0", () => {
      server.removeListener("error", fallito);
      riuscito();
    });
  });

  const vera = server.address().port;
  registro.info(`il quadro ascolta sulla ${vera}`);
  registro.info(
    `${installatori.lista.length} installatori, ${case_.lista.length} case seguite, ` +
      `${chiavi.elenco().length} codici in attesa`,
  );
  if (String(chiaveDelGestore).length >= 16)
    registro.info("la gestione degli installatori e' aperta su /gestore/");
  else
    registro.attenzione(
      "senza QUADRO_GESTORE non si puo' aggiungere nessun installatore: le case gia' abbinate continuano a depositare",
    );

  giro.parti();

  const potatura = setInterval(() => {
    const andati = chiavi.potatura();
    if (andati) registro.info(`${andati} codici scaduti sono stati buttati`);
  }, POTATURA);
  potatura.unref?.();

  return {
    server,
    porta: vera,
    case: case_,
    chiavi,
    installatori,
    giro,
    registro,
    spegni: () =>
      new Promise((ok) => {
        giro.ferma();
        clearInterval(potatura);
        /* Prima i fili tenuti aperti, poi il server: `close` aspetta che le
         * richieste in corso finiscano, e quelle per definizione non
         * finiscono da sole. */
        server.lasciaAndareIFili?.();
        server.close(ok);
      }),
  };
}

/* Avviato a mano, invece che importato da una prova. */
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const acceso = await alzaIlQuadro();
  for (const segnale of ["SIGTERM", "SIGINT"]) {
    process.on(segnale, () => {
      acceso.spegni().finally(() => process.exit(0));
    });
  }
}
