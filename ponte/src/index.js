/* Il ponte si alza.
 *
 * Due server, un archivio, un filo verso Home Assistant. Niente altro gira in
 * questo processo, e non c'e' niente da installare: la presa WebSocket, il
 * server HTTP e la crittografia vengono tutti da Node.
 */

import { pathToFileURL } from "node:url";

import { Abbinamento } from "./abbinamento.js";
import { Casa } from "./casa.js";
import { Chiamata } from "./chiamata.js";
import { Commissioni } from "./commissioni.js";
import { Configurazione } from "./configurazione.js";
import { Plancia } from "./plancia.js";
import { Identita } from "./identita.js";
import { Dispositivi } from "./dispositivi.js";
import { leggiLeOpzioni } from "./opzioni.js";
import { Ponte } from "./ponte.js";
import { Portiere } from "./portiere.js";
import { Ritorno } from "./ritorno.js";
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
  /* La plancia, dentro l'add-on, e la sua configurazione: il telefono
   * chiede i file e la configurazione al ponte, e in Home Assistant non serve
   * nessuna integrazione. */
  const plancia = new Plancia();
  const configurazione = new Configurazione({ cartella: opzioni.cartella });
  if (plancia.cE) {
    registro.info(
      `la plancia c'e': ${plancia.descrizione().file} file, impronta ${plancia.impronta}`,
    );
  } else {
    registro.attenzione("senza plancia: in ponte/plancia non c'e' niente da servire");
  }
  const commissioni = new Commissioni({ casa, registro, plancia, configurazione });
  const ponte = new Ponte({ casa, dispositivi, registro, commissioni });

  /* La chiamata verso il centralino: e' cosi' che si entra da fuori casa,
   * senza che chi ha installato l'add-on apra o configuri niente. */
  const identita = new Identita({ cartella: opzioni.cartella });
  /* Nessuno parla col ponte direttamente: si passa dal portiere, che fa la
   * stretta di mano e da li' in poi cifra. Vale per chi arriva dalla porta di
   * casa e per chi arriva dal centralino, allo stesso modo. */
  /* Quello che si dice a un telefono che si abbina: chi e' questa casa, dove
   * si chiama per entrare da fuori, e dove sta sulla rete di casa. Senza,
   * chi ha inquadrato un quadretto non saprebbe dove ribussare. */
  const ritorno = new Ritorno({
    identita,
    centralino: opzioni.centralino,
    porta: opzioni.portaDellApp,
    registro,
  });
  const portiere = new Portiere({ ponte, dispositivi, abbinamento, registro, ritorno });
  const chiamata = new Chiamata({
    dove: opzioni.centralino,
    identita,
    portiere,
    registro,
  });
  portiere.chiamata = chiamata;

  const app = costruisciLaPortaDellApp({
    ponte,
    portiere,
    dispositivi,
    abbinamento,
    registro,
    chiamata,
    ritorno,
  });
  const console_ = costruisciLaConsole({
    ponte,
    casa,
    dispositivi,
    abbinamento,
    opzioni,
    registro,
    chiamata,
    identita,
    /* Anche la console ha bisogno di sapere dove si trova questa casa: nel
     * codice a quadretti ci va scritto dentro, cosi' chi lo inquadra non deve
     * cercare niente. */
    ritorno,
    cartellaDellaConsole: opzioni.console,
  });

  await ascolta(app, opzioni.portaDellApp);
  await ascolta(console_, opzioni.portaDellaConsole);

  /* La porta vera, non quella chiesta: sono la stessa cosa quando l'add-on
   * gira, ma nelle prove si chiede la zero e la sceglie il sistema, e un
   * indirizzo con dentro la porta zero non porterebbe da nessuna parte. */
  ritorno.porta = app.address().port;

  registro.info(`la porta dell'app e' la ${opzioni.portaDellApp}`);
  registro.info(`${dispositivi.quanti()} dispositivi abbinati`);

  chiamata.avvia();

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
    chiamata.spegni();
    ponte.chiudiTutto();
    await Promise.all([chiudi(app), chiudi(console_)]);
  };

  return {
    ponte,
    portiere,
    dispositivi,
    abbinamento,
    casa,
    identita,
    chiamata,
    ritorno,
    registro,
    app,
    console: console_,
    abbassa,
  };
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
