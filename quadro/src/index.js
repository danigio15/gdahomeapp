/* Il quadro si alza.
 *
 * Un server, due archivi su disco, niente altro. Non c'e' niente da
 * installare: HTTP e la crittografia vengono da Node, e il resto sono seicento
 * righe di programma.
 *
 * Gira su una macchina dell'installatore — un VPS da cinque euro, un mini PC
 * in ufficio — oppure su Cloudflare, quando ci sara' la versione per il Worker.
 * Non gira sul centralino di gdahome, e quello e' il punto: le case che questo
 * quadro guarda sono di clienti di qualcun altro.
 */

import { CaseSeguite } from "./case.js";
import { Chiavi } from "./chiavi.js";
import { apriIlRegistro } from "./registro.js";
import { costruisciIlServer } from "./server.js";

/** Ogni quanto si buttano gli inviti scaduti. */
const POTATURA = 60 * 60 * 1000;

export async function alzaIlQuadro({
  porta = Number(process.env.QUADRO_PORTA || 8100),
  cartella = process.env.QUADRO_DATI || "./dati",
  livello = process.env.QUADRO_REGISTRO || "info",
  /* La chiave con cui si apre la console.
   *
   * Senza, questo quadro riceve le cartoline e non le fa vedere a nessuno —
   * meta' inutile, e lo dice all'accensione invece di farlo scoprire a chi
   * apre la pagina. Va lunga: e' l'unica cosa fra un indirizzo pubblico e
   * l'elenco degli impianti di qualcuno. */
  chiaveDellaConsole = process.env.QUADRO_CHIAVE || "",
} = {}) {
  const registro = apriIlRegistro(livello);
  const case_ = new CaseSeguite({ cartella });
  const chiavi = new Chiavi({ cartella });

  const server = costruisciIlServer({
    case: case_,
    chiavi,
    chiaveDellaConsole,
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
  registro.info(`${case_.lista.length} case seguite, ${chiavi.elenco().length} codici in attesa`);
  if (String(chiaveDellaConsole).length >= 16) registro.info("la console e' aperta su /console/");
  else
    registro.attenzione(
      "senza QUADRO_CHIAVE la console non si apre: le cartoline arrivano e non le guarda nessuno",
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
