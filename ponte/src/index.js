/* Il ponte si alza.
 *
 * Due server, un archivio, un filo verso Home Assistant. Niente altro gira in
 * questo processo, e non c'e' niente da installare: la presa WebSocket, il
 * server HTTP e la crittografia vengono tutti da Node.
 */

import { pathToFileURL } from "node:url";

import { Abbinamento } from "./abbinamento.js";
import { Casa } from "./casa.js";
import { Dispositivi } from "./dispositivi.js";
import { leggiLeOpzioni } from "./opzioni.js";
import { Ponte } from "./ponte.js";
import { apriIlRegistro } from "./registro.js";
import { costruisciLaConsole, costruisciLaPortaDellApp } from "./server.js";

/* Ogni quanto si guarda se qualche telefono e' sparito da troppo tempo. */
const POTATURA = 6 * 60 * 60 * 1000;

export async function alzaIlPonte(opzioni = leggiLeOpzioni()) {
  const registro = apriIlRegistro(opzioni.registro);
  const casa = new Casa();
  const dispositivi = new Dispositivi({
    cartella: opzioni.cartella,
    massimi: opzioni.dispositiviMassimi,
    giorniDiSilenzio: opzioni.giorniDiSilenzio,
  });
  const abbinamento = new Abbinamento({ minutiDelCodice: opzioni.minutiDelCodice });
  const ponte = new Ponte({ casa, dispositivi, registro });

  const app = costruisciLaPortaDellApp({ ponte, dispositivi, abbinamento, registro });
  const console_ = costruisciLaConsole({
    ponte,
    casa,
    dispositivi,
    abbinamento,
    opzioni,
    registro,
    cartellaDellaConsole: opzioni.console,
  });

  await ascolta(app, opzioni.portaDellApp);
  await ascolta(console_, opzioni.portaDellaConsole);

  registro.info(`la porta dell'app e' la ${opzioni.portaDellApp}`);
  registro.info(`${dispositivi.quanti()} dispositivi abbinati`);

  const saluto = await casa.saluta();
  if (saluto.viva) registro.info("Home Assistant risponde");
  else registro.attenzione(`Home Assistant non risponde: ${saluto.perche}`);

  const giro = setInterval(() => {
    const andati = dispositivi.potatura();
    if (andati) registro.info(`${andati} dispositivi tolti perche' spariti da troppo tempo`);
  }, POTATURA);
  giro.unref?.();

  const abbassa = async () => {
    registro.info("il ponte si abbassa");
    clearInterval(giro);
    ponte.chiudiTutto();
    await Promise.all([chiudi(app), chiudi(console_)]);
  };

  return { ponte, dispositivi, abbinamento, casa, registro, app, console: console_, abbassa };
}

const ascolta = (server, porta) =>
  new Promise((riuscito, fallito) => {
    server.once("error", fallito);
    server.listen(porta, "0.0.0.0", () => {
      server.removeListener("error", fallito);
      riuscito(server);
    });
  });

const chiudi = (server) => new Promise((ok) => server.close(ok));

/* Avviato a mano — cioe' dall'add-on — invece che importato da una prova. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const avviato = await alzaIlPonte();
  for (const segnale of ["SIGTERM", "SIGINT"]) {
    process.on(segnale, () => {
      avviato.abbassa().finally(() => process.exit(0));
    });
  }
}
