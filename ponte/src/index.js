/* Il ponte si alza.
 *
 * Due server, un archivio, un filo verso Home Assistant. Niente altro gira in
 * questo processo, e non c'e' niente da installare: la presa WebSocket, il
 * server HTTP e la crittografia vengono tutti da Node.
 */

import { pathToFileURL } from "node:url";

import { join } from "node:path";

import { Abbinamento } from "./abbinamento.js";
import { Aggiornamento } from "./aggiornamento.js";
import { fabbricaIlRapporto, Postino, QUADRO_DI_DIFETTO } from "./rapporto.js";
import { Segni } from "./segni.js";
import { Casa } from "./casa.js";
import { Chat } from "./chat.js";
import { Chiamata } from "./chiamata.js";
import { Commissioni } from "./commissioni.js";
import { Catalogo } from "./catalogo.js";
import { Configurazione } from "./configurazione.js";
import { Ferro } from "./ferro.js";
import { BASE_DI_CASA, Foto } from "./foto.js";
import { inventarioSenzaDati } from "./inventario.js";
import { Plancia } from "./plancia.js";
import { Plance } from "./plance.js";
import { PlanceInCasa } from "./plance-in-casa.js";
import { IL_CRUSCOTTO, LA_GESTIONE, VoceNellaBarra } from "./voci-nella-barra.js";
import { UtentiDiCasa } from "./utenti.js";
import { Identita } from "./identita.js";
import { Dispositivi } from "./dispositivi.js";
import { leggiLeOpzioni } from "./opzioni.js";
import { Ponte } from "./ponte.js";
import { Portiere } from "./portiere.js";
import { Ritorno } from "./ritorno.js";
import { Segnalazioni } from "./segnalazioni.js";
import { Spegnimento } from "./spegnimento.js";
import { Zigbee } from "./zigbee.js";
import { Aggiornamenti } from "./aggiornamenti.js";
import { Lavori } from "./lavori.js";
import { Installatore } from "./installatore.js";
import { apriIlRegistro } from "./registro.js";
import { costruisciLaConsole, costruisciLaPortaDellApp, PROXY_DELL_INGRESS } from "./server.js";

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
  /* Chi ha montato questo impianto: il nome e il logo che la plancia indossa.
   *
   * Nasce **prima** della plancia perche' e' lei a doverlo chiedere, e nasce
   * anche quando la casa ha detto di no: cosi' il logo che ha gia' in `/data`
   * lo puo' buttare. Il perche' per esteso sta in `installatore.js`. */
  const installatore = new Installatore({
    cartella: opzioni.cartella,
    quadro: opzioni.quadro?.dove || "",
    registro,
  });
  if (!opzioni.marchioDellInstallatore) {
    installatore.dimentica();
    installatore.svesti();
  }

  /* La plancia, dentro l'add-on, e la sua configurazione: il telefono
   * chiede i file e la configurazione al ponte, e in Home Assistant non serve
   * nessuna integrazione.
   *
   * Si veste al momento di servire: se questa casa ha un installatore col suo
   * marchio, la pagina esce col suo nome e col suo logo. `vestito()` e non un
   * oggetto, perche' la risposta cambia mentre il ponte gira. */
  const plancia = new Plancia({
    installatore: (profilo) =>
      opzioni.marchioDellInstallatore ? installatore.vestito(profilo) : null,
  });
  const configurazione = new Configurazione({ cartella: opzioni.cartella });
  /* Quante plance ha questa casa. Una c'e' sempre — quella di sempre — e chi
   * ne vuole un'altra la aggiunge dalla scheda dell'add-on o dall'app, come
   * nella dashboard si aggiunge una seconda istanza. */
  const plance = new Plance({ cartella: opzioni.cartella, registro });
  /* Le plance si vestono come dice chi le segue: il titolo che ha scelto per
   * ognuna, dal cruscotto, va nel menu laterale. Si tocca **solo il titolo**:
   * la configurazione della plancia sta sotto il profilo, e quello non si
   * sfiora — il perche' sta su `Plance.vesti`. Con l'interruttore spento
   * non si veste niente, e quello che era vestito si sveste. */
  installatore.alVestire = (vesti) => {
    if (opzioni.marchioDellInstallatore) plance.vesti(vesti);
  };
  if (!opzioni.marchioDellInstallatore) plance.vesti({});
  if (plancia.cE) {
    registro.info(
      `la plancia c'e': ${plancia.descrizione().file} file, impronta ${plancia.impronta}`,
    );
    /* E da dove viene. Nel registro all'avvio perche' e' la riga che si
     * chiede a chi segnala qualcosa di strano: una plancia toccata spiega da
     * sola meta' delle stranezze. */
    const detto = plancia.provenienzaInDueParole;
    if (plancia.provenienza.stato === "modificata") registro.attenzione(detto);
    else registro.info(detto);
  } else {
    registro.attenzione("senza plancia: in ponte/plancia non c'e' niente da servire");
  }
  /* Il catalogo delle integrazioni — per scegliere elettrodomestici, auto e
   * robot — e le foto caricate dalla plancia: le altre due cose che la
   * plancia chiedeva all'integrazione, e che qui fa il ponte. */
  const catalogo = new Catalogo({ casa, registro });
  const foto = new Foto({ cartella: join(opzioni.cartella, "www") });
  /* E quelle che stanno gia' in Home Assistant, in sola lettura.
   *
   * Chi ha una casa da qualche anno ha duecento immagini in `config/www` e le
   * sceglieva da li'. Senza questa riga la maschera delle foto gli diceva
   * «nessuna foto, ancora», che e' una risposta sbagliata detta con
   * sicurezza. */
  const fotoDiCasa = new Foto({
    cartella: opzioni.wwwDiCasa,
    base: BASE_DI_CASA,
    scrivibile: false,
  });
  /* Chi e' questa casa per il centralino: serve alla chiamata, e alle
   * segnalazioni, che al centralino si presentano allo stesso modo. */
  const identita = new Identita({ cartella: opzioni.cartella });
  /* Le segnalazioni e la chat dell'app: dal ponte al centralino, e da li' a
   * chi mantiene il progetto. */
  const segnalazioni = new Segnalazioni({
    identita,
    centralino: opzioni.centralino,
    cartella: opzioni.cartella,
    versione: opzioni.versione,
    registro,
  });
  /* Lo spegnimento programmato del clima (#364): il conto alla rovescia che
   * nella dashboard tiene l'integrazione, e qui tiene il ponte — sul disco,
   * cosi' un riavvio nel mezzo della notte non lascia acceso niente. */
  const spegnimento = new Spegnimento({ casa, cartella: opzioni.cartella, registro });
  spegnimento.carica();
  /* La rete Zigbee di questa casa (#54): l'app non chiede «che rete hai», lo
   * guarda il ponte. Si costruisce sempre — costa niente finche' nessuno
   * chiede — e la voce nell'app compare solo dove una rete c'e' davvero. */
  const zigbee = new Zigbee({ casa, registro });
  /* La chat di assistenza della plancia: quella della dashboard, che non passa
   * da GitHub. Nell'integrazione la fa `chat.py`; qui la fa il ponte, e la
   * finestra dell'assistenza resta la sua senza saperlo. */
  const chat = new Chat({
    cartella: opzioni.cartella,
    centralino: opzioni.chat,
    versione: opzioni.versione,
    /* La versione della plancia che questo ponte serve: e' quella che
     * l'integrazione manda al centralino, ed e' quella di cui si parla
     * quando si chiede aiuto. */
    plancia: plancia.cE ? plancia.provenienza.versione : "",
    /* E se questa e' la casa di chi risponde, anche la chiave per farlo.
     * Dove non c'e' — cioe' dappertutto tranne una — quella meta' della chat
     * non si accende. */
    chiaveDellaConsole: opzioni.chiaveDellaConsole,
    registro,
  });
  /* Cosa c'e' da aggiornare in casa. In Home Assistant si vede da una pagina
   * che chi usa l'app non apre piu': qui l'elenco si legge dalle entita'
   * `update.` e si manda al telefono, che con tre righe sa quello che nella
   * dashboard si vede col pallino rosso. */
  const aggiornamenti = new Aggiornamenti({ casa, registro });
  /* Chi c'e' in questa casa, e chi la amministra.
   *
   * Non si tiene niente sul disco: si chiede a Home Assistant e la risposta
   * vale un minuto. Serve a tre cose: disegnare le spunte di «chi la vede»,
   * rispondere alla sola domanda che l'ingress non sa — «questo utente
   * amministra?» — e dire al ponte se il telefono che chiede una plancia
   * riservata a chi amministra ne ha il diritto — e alle commissioni, per
   * decidere se dare all'app i due codici del quadro.
   *
   * Sta **prima** delle commissioni perche' e' loro: dichiararlo dopo e
   * passarlo lo stesso vuol dire un ponte che non si accende. */
  const utenti = new UtentiDiCasa({ casa, registro });

  const commissioni = new Commissioni({
    casa,
    registro,
    plancia,
    plance,
    configurazione,
    catalogo,
    foto,
    fotoDiCasa,
    segnalazioni,
    chat,
    installatore: opzioni.installatore,
    gestore: opzioni.gestore,
    /* I due codici, per non farli ribattere nell'app: il perche' sta su
     * `_ilQuadro`, e li vede solo chi amministra questa casa. */
    chiaveDelCruscotto: opzioni.chiaveDelCruscotto,
    chiaveDellaGestione: opzioni.chiaveDellaGestione,
    /* E chi amministra: serve a decidere se quei due codici si danno. Senza,
     * `_ilQuadro` puo' solo leggere la memoria — che quando la domanda arriva
     * e' ancora vuota — e non darli mai. */
    utenti,
    spegnimento,
    zigbee,
    aggiornamenti,
  });
  const ponte = new Ponte({ casa, dispositivi, registro, commissioni, utenti });

  /* Le plance fra le «Plance» di Home Assistant, una voce per ognuna.
   *
   * E' quello che faceva l'integrazione, e che da qui in avanti fa il ponte:
   * chi apre Home Assistant trova la sua plancia nella barra laterale, dove
   * l'ha sempre trovata, senza sapere che sotto e' cambiato tutto.
   *
   * Si rifa' a ogni accensione e ogni volta che le plance cambiano — non
   * appena, perche' una plancia aggiunta che compare al prossimo riavvio e'
   * una plancia che sembra non essere stata aggiunta. */
  const planceInCasa = new PlanceInCasa({
    casa,
    plance,
    www: opzioni.wwwDiCasa,
    versione: opzioni.versione,
    registro,
  });
  plance.quandoCambia = () => planceInCasa.sistema();

  /* La chiamata verso il centralino: e' cosi' che si entra da fuori casa,
   * senza che chi ha installato l'add-on apra o configuri niente. */
  /* Nessuno parla col ponte direttamente: si passa dal portiere, che fa la
   * stretta di mano e da li' in poi cifra. Vale per chi arriva dalla porta di
   * casa e per chi arriva dal centralino, allo stesso modo. */
  /* Quello che si dice a un telefono che si abbina: chi e' questa casa, dove
   * si chiama per entrare da fuori, e dove sta sulla rete di casa. Senza,
   * chi ha inquadrato un QR code non saprebbe dove ribussare. */
  const ritorno = new Ritorno({
    identita,
    centralino: opzioni.centralino,
    porta: opzioni.portaDellApp,
    registro,
  });
  /* Il ponte si aggiorna da se'.
   *
   * Un add-on locale non ha nessun negozio dietro: se nessuno porta i file
   * nuovi in `/addons/gdahome`, in Home Assistant non compare mai nessun
   * «Aggiorna». Prima quei file li portava dentro un comando da terminale con
   * un gettone da incollare ogni volta; adesso e' un bottone nella console. */
  const aggiornamento = new Aggiornamento({
    mia: opzioni.versione,
    gettone: opzioni.gettone,
    registro,
  });
  if (aggiornamento.locale()) {
    registro.info(
      aggiornamento.gettone
        ? "questo ponte si sa aggiornare da se': il bottone sta nella console"
        : "questo ponte si aggiornerebbe da se', ma nella scheda dell'add-on non c'e' nessun gettone",
    );
  }

  /* E lo stesso Ritorno risponde al telefono che lo chiede sul filo, invece
   * che solo a chi si sta abbinando: un indirizzo di casa detto una volta
   * sola invecchia, e chi ha abbinato stando fuori non ne ha mai sentito
   * nessuno. Si mette qui e non nel costruttore delle commissioni perche' il
   * Ritorno nasce dopo: gli serve la porta vera, che la sa solo il server. */
  commissioni.ritorno = ritorno;

  /* Il rapporto al quadro di chi ha fatto l'impianto.
   *
   * **Spenta, a meno che in quella casella non ci sia un codice.** Senza, qui
   * non parte niente e non si apre nessuna connessione: in una casa qualunque
   * — cioe' in quasi tutte — questo pezzo e' codice che non gira.
   *
   * Chi ce l'ha se l'e' fatto dare da chi gli ha montato la casa, e legge
   * quello che parte nella scheda «Il quadro» della console, dove c'e' anche
   * il tasto per smettere. */
  const ferro = new Ferro({ registro });
  /* Il secondo verbo del quadro: installare un aggiornamento che questa casa
   * ha gia' in attesa. Il comando arriva nella risposta a un rapporto — non
   * c'e' nessuna porta aperta — e chi dice di si' o di no e' questa casa, con
   * la casella della manutenzione. Il perche' per esteso sta in `lavori.js`. */
  const lavori = new Lavori({
    aggiornamenti,
    registro,
    aperta: () => opzioni.manutenzione === true,
    /* Il terzo verbo: configurare la plancia da lontano, con la sua casella.
     * Quello che l'installatore ha scritto lo ritira il postino — che nasce qui
     * sotto, e si chiama solo quando un lavoro arriva — e lo scrive
     * `configurazione`, con le stesse regole che valgono per un telefono di
     * casa: la revisione attesa, il rifiuto di svuotare. */
    plancia: {
      aperta: () => opzioni.configurazionePlancia === true,
      prendi: (profilo, id) => postino.prendiLaPlanciaChiesta(profilo, id),
      scrivi: (profilo, valori, come) => configurazione.scrivi(profilo, valori, come),
      titoloDi: (profilo) => plance.elenco().find((una) => una.profilo === profilo)?.titolo ?? "",
      /* Com'e' adesso, per rimettere al loro posto i flussi che il quadro non
       * ha mai visto. */
      correnti: (profilo) => configurazione.leggi(profilo)?.snapshot?.values ?? null,
    },
  });

  const postino = new Postino({
    ...(opzioni.quadro ?? {}),
    casa: identita.casa,
    /* Il segreto della casa per il quadro, e l'ultima chiave buona: in
     * `/data`, dove il ponte tiene le sue cose. */
    cartella: opzioni.cartella,
    ogni: opzioni.quadroOgni,
    fai: (detto) => lavori.fai(detto),
    /* Solo se questa casa lo vuole. Spento, il quadro puo' mandare quello che
     * gli pare: qui non si guarda. */
    installatore: opzioni.marchioDellInstallatore ? installatore : null,
    /* Com'e' fatta una plancia, per il quadro che ne chiede lo scatto: solo
     * con la casella accesa, e solo per le plance che questa casa ha. */
    plancia: {
      attiva: () => opzioni.configurazionePlancia === true,
      scatta: (profilo) => {
        const quale = plance.elenco().find((una) => una.profilo === profilo);
        if (!quale) return null;
        const dentro = configurazione.leggi(profilo)?.snapshot ?? null;
        return {
          titolo: quale.titolo,
          revisione: Number(dentro?.revision) || 0,
          /* I tre numeri con cui l'editor capisce se lo scatto e' della sua
           * generazione: senza, alla prima apertura riscriverebbe la plancia
           * per «aggiornarla» a una che e' gia' aggiornata. */
          chiavi: Number(dentro?.keys_revision) || 0,
          generazione: Number(dentro?.writer_generation) || 0,
          aggiornataIl: Number(dentro?.updated_at) || 0,
          valori: dentro?.values ?? {},
        };
      },
      /* L'inventario di casa per l'editor del cruscotto: cosa c'e', non cosa
       * succede. Le cinque liste si chiedono a Home Assistant e passano dal
       * setaccio di `inventario.js`; i piani sono facoltativi, perche' su
       * una Home Assistant di ieri quel registro non c'e'. */
      inventario: async () => {
        const forse = async (comando) => {
          try {
            return await casa.chiedi(comando);
          } catch (_errore) {
            return [];
          }
        };
        const [stati, entita, dispositivi, stanze, piani] = await Promise.all([
          casa.chiedi({ type: "get_states" }),
          casa.chiedi({ type: "config/entity_registry/list" }),
          casa.chiedi({ type: "config/device_registry/list" }),
          forse({ type: "config/area_registry/list" }),
          forse({ type: "config/floor_registry/list" }),
        ]);
        return inventarioSenzaDati({ stati, entita, dispositivi, stanze, piani });
      },
    },
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
  /* E qui il postino riceve da dove prendere i suoi numeri.
   *
   * Si monta adesso e non insieme a lui perche' gli serve la **chiamata**, che
   * nasce qui sotto: e' guardando quel filo che il rapporto sa dire se questa
   * casa vede fuori — la prova piu' onesta che esista, non un ping a un
   * indirizzo scelto da noi ma la cosa vera che deve funzionare. Stessa strada
   * del Ritorno delle commissioni, e per lo stesso motivo. */
  postino.fabbrica = fabbricaIlRapporto({
    identita,
    casa,
    ferro,
    aggiornamenti,
    /* Le icone vere degli aggiornamenti e le loro note intere, per il quadro.
     *
     * Le scarica il ponte — dal Supervisor per un add-on, dai marchi per
     * un'integrazione — esattamente come fa per l'app. Non finiscono in ogni
     * rapporto: e' il quadro a dire quali non ha, e partono solo quelle. Il
     * perche' sta in cima a `segni.js`. */
    segni: new Segni({
      aggiornamenti,
      casa,
      registro,
      /* L'icona che sta in casa si chiede per **la stessa strada dell'app**, e
       * non se ne apre una seconda accanto: due strade per la stessa icona
       * vuol dire due schermi che ne mostrano una sola, ed e' successo — nel
       * cruscotto restavano le letterine mentre nell'app le icone c'erano. */
      ilLogoDiCasa: (entita) =>
        commissioni.rispondi({ id: null, type: "ponte/aggiornamenti/logo", entity_id: entita }),
    }),
    segniChiesti: () => postino.segniChiesti,
    lavori,
    manutenzione: opzioni.manutenzione,
    configurazionePlancia: () => opzioni.configurazionePlancia === true,
    marchioDellInstallatore: opzioni.marchioDellInstallatore === true,
    plance,
    configurazione,
    dispositivi,
    chiamata,
    versioni: {
      ponte: opzioni.versione,
      plancia: plancia.cE ? plancia.provenienza.versione : "",
    },
    ogni: opzioni.quadroOgni,
    registro,
  });

  const app = costruisciLaPortaDellApp({
    portiere,
    registro,
    /* I file — dell'app e della plancia — anche da questa porta: e' l'unica
     * che si raggiunge dalla rete di casa, ed e' quella che fa aprire gdahome
     * in un browser senza fare il giro del centralino. La pagina della
     * plancia, col suo cancello, resta dall'altra parte. */
    cartellaDellApp: opzioni.app,
    plancia,
  });
  const console_ = costruisciLaConsole({
    ponte,
    casa,
    /* Cos'ha trovato guardando la rete Zigbee: la console lo scrive, cosi'
     * chi la voce «Zigbee» nell'app non la vede sa perche'. */
    zigbee,
    dispositivi,
    abbinamento,
    opzioni,
    registro,
    chiamata,
    identita,
    /* Anche la console ha bisogno di sapere dove si trova questa casa: nel
     * QR code ci va scritto dentro, cosi' chi lo inquadra non deve
     * cercare niente. */
    ritorno,
    /* Da dove viene la plancia che questo ponte serve: la console lo dice,
     * cosi' chi si chiede se sia quella originale ha la risposta li'. */
    plancia,
    /* E quante plance ha questa casa: la scheda dell'add-on e' il posto dove
     * se ne aggiunge una, come in Home Assistant si aggiunge una seconda
     * istanza dell'integrazione. */
    plance,
    /* E chi c'e' in casa: le spunte di «chi la vede», e la risposta a
     * «amministra?» per le plance riservate a chi amministra. */
    utenti,
    /* La chat di assistenza: alla console serve per dire se questa casa
     * risponde, che e' l'unico modo di sapere che la chiave e' arrivata. */
    chat,
    /* E com'e' andata a metterle fra le «Plance» di Home Assistant: la scheda
     * dell'add-on e' il posto dove si guarda quando una voce nella barra
     * laterale non c'e'. */
    planceInCasa,
    configurazione,
    /* Le commissioni servono anche qui: la plancia servita dentro Home
     * Assistant chiede al ponte le stesse cose che gli chiede quella dentro
     * l'app, e le fa lo stesso oggetto. */
    commissioni,
    /* Il rapporto al quadro, e come farla smettere: la scheda «Il quadro»
     * fa leggere l'ultima spedita parola per parola, e ha li' il tasto. */
    postino,
    ferro,
    /* Se c'e' una versione nuova del ponte, e il bottone per portarsela
     * dentro: l'unico posto da cui chi non ha un computer puo' aggiornare. */
    aggiornamento,
    cartellaDellaConsole: opzioni.console,
    /* Da dove arriva l'ingress del Supervisor: l'unico che puo' bussare alla
     * console. Nelle prove e' `127.0.0.1`; nell'add-on non si cambia. */
    proxyDellIngress: opzioni.proxyDellIngress ?? [PROXY_DELL_INGRESS],
    /* E gdahome da aprire in un browser, se questo add-on se la porta dietro.
     * E' il link: chi ha l'add-on ha gia' l'app, e non deve installare
     * niente da nessuna parte. */
    cartellaDellApp: opzioni.app,
  });

  await ascolta(app, opzioni.portaDellApp);
  await ascolta(console_, opzioni.portaDellaConsole);

  /* La porta vera, non quella chiesta: sono la stessa cosa quando l'add-on
   * gira, ma nelle prove si chiede la zero e la sceglie il sistema, e un
   * indirizzo con dentro la porta zero non porterebbe da nessuna parte. */
  ritorno.porta = app.address().port;

  registro.info(`la porta dell'app e' la ${opzioni.portaDellApp}`);
  /* Una riga sola, e solo dove serve: la chiave della console ce l'ha una
   * installazione al mondo, e chi l'ha appena messa deve poter leggere da
   * qualche parte che e' arrivata. Della chiave non si dice niente — si dice
   * che c'e'. */
  if (chat.eLaConsole) registro.info("la console dell'assistenza e' accesa");
  registro.info(`${dispositivi.quanti()} dispositivi abbinati`);

  chiamata.avvia();
  postino.parti();

  const saluto = await casa.saluta();
  if (saluto.viva) registro.info("Home Assistant risponde");
  else registro.attenzione(`Home Assistant non risponde: ${saluto.perche}`);

  /* E che rete Zigbee c'e' in questa casa.
   *
   * Qui e non solo nella console: la console il suo riquadro lo riempiva
   * soltanto **dopo** che qualcuno avesse aperto la schermata Zigbee nell'app,
   * e chi quella schermata non ce l'ha — perche' la voce nel menu non compare,
   * che e' la domanda — non poteva aprirla per sapere perche' non compare.
   *
   * Non si aspetta: sono due secondi di posta, e se la casa sta ancora
   * partendo si riguarda da se' fra mezzo minuto. */
  void zigbee.dilloAlRegistro();

  /* Le voci fra le Plance.
   *
   * Non si aspetta, e si riprova: all'avvio dell'add-on Home Assistant sta
   * spesso ancora partendo, e i comandi di Lovelace arrivano a nessuno.
   * Aspettare qui vorrebbe dire tenere giu' il ponte — l'app e la plancia
   * funzionano comunque — e non riprovare vorrebbe dire una voce che compare
   * solo al riavvio dopo. */
  void planceInCasa.sistemaConCalma().then(() => planceInCasa.sorveglia());

  /* La voce «Cruscotto», per chi gli impianti li monta.
   *
   * Si dice **anche quando l'interruttore e' spento**: e' l'unico modo perche'
   * spegnendolo la voce sparisca subito invece che al riavvio dopo. E non si
   * aspetta, per lo stesso motivo delle Plance qui sopra — all'accensione
   * l'integrazione i suoi comandi non li ha ancora registrati, e una voce di
   * menu non vale il ritardo di tutto il resto. */
  const leVoci = [
    { quale: IL_CRUSCOTTO, acceso: opzioni.installatore, chiave: opzioni.chiaveDelCruscotto },
    { quale: LA_GESTIONE, acceso: opzioni.gestore, chiave: opzioni.chiaveDellaGestione },
  ].map(
    ({ quale, acceso, chiave }) =>
      new VoceNellaBarra({ casa, quale, acceso, chiave, quadro: QUADRO_DI_DIFETTO, registro }),
  );
  for (const una of leVoci) void una.dilloConCalma();

  const giro = setInterval(() => {
    const andati = dispositivi.potatura();
    if (andati) registro.info(`${andati} dispositivi tolti perche' spariti da troppo tempo`);
  }, POTATURA);
  giro.unref?.();

  const abbassa = async () => {
    registro.info("il ponte si abbassa");
    planceInCasa.smettiDiSorvegliare();
    for (const una of leVoci) una.ferma();
    clearInterval(giro);
    chiamata.spegni();
    postino.ferma();
    ponte.chiudiTutto();
    spegnimento.chiudi();
    zigbee.spegni();
    casa.chiudiIlFiloMio();
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
    postino,
    app,
    console: console_,
    planceInCasa,
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
  /* Un errore che nessuno ha raccolto: si scrive, e si resta in piedi.
   *
   * Uscire sarebbe piu' pulito solo se qualcuno riaccendesse il ponte, e
   * nessuno lo fa: l'add-on non ha un `watchdog` — la porta dell'app si
   * sceglie nella scheda, e un controllo su una porta fissa fallirebbe sempre
   * per chi l'ha cambiata — e un ponte uscito resta spento finche' qualcuno
   * non se ne accorge. Meglio un errore scritto nel registro e le porte
   * aperte. Le domande storte che arrivano da fuori non devono comunque
   * arrivare fin qui: le ferma chi le riceve. */
  const scrivi = (come) => (errore) => {
    try {
      process.stderr.write(`[ponte] ${come}: ${errore?.stack || errore}\n`);
    } catch (_ancora) {
      /* Nemmeno il registro: non c'e' altro da fare. */
    }
  };
  process.on("uncaughtException", scrivi("errore non raccolto"));
  process.on("unhandledRejection", scrivi("promessa rifiutata senza nessuno che ascolta"));
  const avviato = await alzaIlPonte();
  for (const segnale of ["SIGTERM", "SIGINT"]) {
    process.on(segnale, () => {
      avviato.abbassa().finally(() => process.exit(0));
    });
  }
}
