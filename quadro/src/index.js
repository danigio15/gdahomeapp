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
import { Licenze } from "./licenze.js";
import { Negozi } from "./negozi.js";
import { PlanciaServita } from "./plancia-servita.js";
import { apriIlRegistro } from "./registro.js";
import { costruisciIlServer } from "./server.js";

/** Ogni quanto si buttano gli inviti scaduti. */
const POTATURA = 60 * 60 * 1000;

/** Ogni quanto si richiedono ai negozi le licenze vicine alla scadenza. */
const RINNOVI = 60 * 60 * 1000;

export async function alzaIlQuadro({
  porta = Number(process.env.QUADRO_PORTA || 8100),
  /* Dove ascolta. Di serie **solo su questa macchina**: davanti c'e' Caddy,
   * che parla TLS e passa qui in chiaro, e il quadro in chiaro sulla rete non
   * lo deve raggiungere nessun altro — con dentro chiavi e nomi di clienti.
   * Chi lo mette dietro un altro proxy, su un'altra macchina, lo dice qui
   * (`QUADRO_ASCOLTO=0.0.0.0`) sapendo cosa fa. */
  ascolto = process.env.QUADRO_ASCOLTO || "127.0.0.1",
  cartella = process.env.QUADRO_DATI || "./dati",
  livello = process.env.QUADRO_REGISTRO || "info",
  /* La chiave di gestione: quella di chi **tiene** il quadro.
   *
   * Non e' la chiave di un installatore — quelle le fa questo quadro, una a
   * testa, e le vede solo chi le riceve. Questa aggiunge gli installatori e mette i limiti, e
   * senza non si puo' iscrivere nessuno: un quadro cosi' riceve rapporti di
   * case gia' abbinate e non ne fa entrare di nuove. Va lunga. */
  chiaveDelGestore = process.env.QUADRO_GESTORE || "",
  /* Dove sta la plancia da servire nell'editor: vuoto, la si cerca accanto a
   * `src/` e poi nella repository (`plancia-servita.js`). */
  cartellaDellaPlancia = process.env.QUADRO_PLANCIA || undefined,
  /* Dove il tramite dice i suoi numeri, se sta su questa stessa macchina:
   * la gestione li mostra accanto a quelli del quadro. Chiesti da qui, il
   * tramite li dice per intero; da fuori non li dice a nessuno. */
  saluteDelTramite = process.env.QUADRO_TRAMITE_SALUTE ?? "http://127.0.0.1:8099/salute",
  /* La chiave privata delle licenze: il `d` di una JWK Ed25519, in base64url
   * (`docs/LICENZE.md`, «La chiave»). Sta **solo** su questa macchina.
   * Senza, le vie di `/v1/licenze` rispondono 503 e tutti restano Base. */
  chiaveDelleLicenze = process.env.QUADRO_LICENZE_CHIAVE || "",
  /* Chi controlla le ricevute dei negozi: di serie legge le sue chiavi
   * dall'ambiente (`negozi.js`). Le prove ne passano uno col fetch finto. */
  negozi = undefined,
  /* Quanto si aspetta il negozio per un rinnovo mentre una casa aspetta i
   * suoi gettoni: di serie cinque secondi (`licenze.js`). */
  attesaDelNegozio = undefined,
} = {}) {
  const registro = apriIlRegistro(livello);
  const case_ = new CaseSeguite({ cartella });
  const chiavi = new Chiavi({ cartella });
  const installatori = new Installatori({ cartella });
  const licenze = new Licenze({ cartella, chiave: chiaveDelleLicenze });

  const fattorino = new Fattorino({ registro });
  const iNegozi = negozi ?? new Negozi({ registro });

  /* La plancia per l'editor dentro il cruscotto: quella dell'add-on, che
   * `accendi.sh` mette accanto a `src/` e che nella repository sta in
   * `ponte/plancia`. Senza, il cruscotto lo dice e il resto va avanti. */
  const plancia = new PlanciaServita({ cartella: cartellaDellaPlancia });
  if (plancia.cE)
    registro.info(
      `la plancia per l'editor c'e': ${plancia.file} file, versione ${plancia.versione() || "?"}, impronta ${plancia.impronta}`,
    );
  else
    registro.attenzione(
      `senza plancia: in ${plancia.cartella} non c'e' niente da servire, e dal cruscotto la Configurazione non si apre`,
    );

  const server = costruisciIlServer({
    case: case_,
    chiavi,
    installatori,
    chiaveDelGestore,
    cartella,
    fattorino,
    plancia,
    registro,
    saluteDelTramite,
    licenze,
    negozi: iNegozi,
    attesaDelNegozio,
  });

  /* Il giro degli avvisi: quello che fa lavorare il quadro mentre nessuno lo
   * guarda. Parte insieme al server e non dice niente al primo passaggio —
   * un quadro appena acceso non sa cosa e' successo mentre era spento. */
  const giro = new Giro({ case: case_, installatori, fattorino, registro });

  await new Promise((riuscito, fallito) => {
    server.once("error", fallito);
    server.listen(porta, ascolto, () => {
      server.removeListener("error", fallito);
      riuscito();
    });
  });

  const vera = server.address().port;
  registro.info(`il quadro ascolta su ${ascolto}:${vera}`);
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

  if (licenze.accese) registro.info(`le licenze sono accese: la pubblica e' ${licenze.pubblica}`);
  else if (String(chiaveDelleLicenze).trim())
    registro.errore(
      "QUADRO_LICENZE_CHIAVE non e' una chiave Ed25519 buona: le licenze restano spente",
    );
  else
    registro.attenzione("senza QUADRO_LICENZE_CHIAVE le licenze sono spente: tutti restano Base");
  for (const [piattaforma, nome] of [
    ["android", "Google Play"],
    ["ios", "App Store"],
  ])
    if (!iNegozi.configurato(piattaforma))
      registro.info(`senza le chiavi di ${nome} le sue ricevute non si controllano (503)`);

  giro.parti();

  const potatura = setInterval(() => {
    const andati = chiavi.potatura();
    if (andati) registro.info(`${andati} codici scaduti sono stati buttati`);
  }, POTATURA);
  potatura.unref?.();

  /* I rinnovi: ogni ora, le licenze del negozio che scadono entro un giorno o
   * sono scadute da poco si richiedono al negozio, anche quelle di chi non
   * chiede (`licenze.js`, «I rinnovi»). Poi, nello stesso giro, gli
   * abbonamenti non richiesti da un giorno: chi ha disdetto si sa il giorno
   * dopo, non alla scadenza («Gli abbonamenti»). Uno alla volta: se il giro
   * prima non ha finito, questo salta. */
  let rinnoviInCorso = false;
  const rinnovi = setInterval(() => {
    if (rinnoviInCorso || !licenze.accese) return;
    rinnoviInCorso = true;
    licenze
      .rinnova(iNegozi, { registro })
      .then((quante) => {
        if (quante) registro.info(`${quante} abbonamenti rinnovati dal negozio`);
        return licenze.aggiorna(iNegozi, { registro });
      })
      .catch((errore) =>
        registro.attenzione(`il giro dei rinnovi non e' andato: ${errore?.message}`),
      )
      .finally(() => {
        rinnoviInCorso = false;
      });
  }, RINNOVI);
  rinnovi.unref?.();

  return {
    server,
    porta: vera,
    case: case_,
    chiavi,
    installatori,
    licenze,
    negozi: iNegozi,
    giro,
    plancia,
    registro,
    spegni: () =>
      new Promise((ok) => {
        giro.ferma();
        clearInterval(potatura);
        clearInterval(rinnovi);
        /* Prima i fili tenuti aperti, poi il server: `close` aspetta che le
         * richieste in corso finiscano, e quelle per definizione non
         * finiscono da sole. */
        server.lasciaAndareIFili?.();
        /* Quello che l'archivio delle case teneva da scrivere, adesso. */
        try {
          case_.salvaSeServe();
        } catch (_errore) {
          /* Al massimo si perde il conto di un rapporto. */
        }
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
