/* Il quadro si alza.
 *
 * Un server, due archivi su disco, niente altro. Non c'e' niente da
 * installare: HTTP e la crittografia vengono da Node, e il resto sono seicento
 * righe di programma.
 *
 * Gira su una macchina dell'installatore — un VPS da cinque euro, un mini PC
 * in ufficio. Non gira sul centralino di gdahome, e quello e' il punto: le case
 * che questo quadro guarda sono di clienti di qualcun altro.
 *
 * E non gira su Cloudflare, a differenza del centralino. Il Worker in `nuvola/`
 * esiste per non chiedere cinque euro al mese a chi vuole accendere una luce da
 * fuori casa; qui chi accende e' un installatore, che un server ce l'ha gia'.
 * Il resto del conto — l'archivio da rifare su KV o D1, e le regole da tenere
 * allineate in due copie — sta in fondo al README.
 */

import { CaseSeguite } from "./case.js";
import { Chiavi } from "./chiavi.js";
import { Installatori } from "./installatori.js";
import { apriIlRegistro } from "./registro.js";
import { costruisciIlServer } from "./server.js";

/** Ogni quanto si buttano gli inviti scaduti. */
const POTATURA = 60 * 60 * 1000;

export async function alzaIlQuadro({
  porta = Number(process.env.QUADRO_PORTA || 8100),
  cartella = process.env.QUADRO_DATI || "./dati",
  livello = process.env.QUADRO_REGISTRO || "info",
  /* La chiave dello sgabuzzino: quella di chi **tiene** il quadro.
   *
   * Non e' la chiave di un installatore — quelle le fa questo quadro, una per
   * conto, e le vede solo chi le riceve. Questa apre i conti e mette i tetti, e
   * senza non si puo' iscrivere nessuno: un quadro cosi' riceve cartoline di
   * case gia' abbinate e non ne fa entrare di nuove. Va lunga. */
  chiaveDelGestore = process.env.QUADRO_GESTORE || "",
} = {}) {
  const registro = apriIlRegistro(livello);
  const case_ = new CaseSeguite({ cartella });
  const chiavi = new Chiavi({ cartella });
  const installatori = new Installatori({ cartella });

  const server = costruisciIlServer({
    case: case_,
    chiavi,
    installatori,
    chiaveDelGestore,
    registro,
  });

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
  if (String(chiaveDelGestore).length >= 16) registro.info("lo sgabuzzino e' aperto su /gestore/");
  else
    registro.attenzione(
      "senza QUADRO_GESTORE non si puo' iscrivere nessun installatore: le case gia' abbinate continuano a depositare",
    );

  const giro = setInterval(() => {
    const andati = chiavi.potatura();
    if (andati) registro.info(`${andati} codici scaduti sono stati buttati`);
  }, POTATURA);
  giro.unref?.();

  return {
    server,
    porta: vera,
    case: case_,
    chiavi,
    installatori,
    registro,
    spegni: () =>
      new Promise((ok) => {
        clearInterval(giro);
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
