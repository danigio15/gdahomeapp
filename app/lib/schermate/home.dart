/// La home: la plancia vera, e una barra laterale per tutto il resto.
///
/// Aprendo l'app si vede la casa — la plancia di DashboardModern, quella
/// vera, dentro un riquadro — e nient'altro. Niente elenco di entita', niente
/// tessere rifatte: chi si e' disegnato la casa la vuole vedere cosi'. Quello
/// che di solito le sta intorno (i dispositivi, gli aiutanti, Zigbee, le
/// automazioni, le case) sta nella barra.
///
/// La barra si chiama da tre posti, e nessuno dei tre e' disegnato sopra la
/// plancia: i **tre trattini della plancia**, che dentro Home Assistant
/// aprono la barra di chi la ospita e qui aprono la nostra; il **☰** nella
/// barra del titolo, sulle sezioni che una barra del titolo ce l'hanno; e il
/// **tasto indietro**, che apre la barra e — se la barra e' gia' aperta —
/// esce dall'app. Prima si chiamava da una fascia invisibile sul bordo
/// sinistro dello schermo, e quella fascia stava sopra la plancia: sulla
/// Configurazione, dove la plancia sul bordo sinistro ha le sue sezioni, si
/// toccava una sezione e si apriva il menu.
///
/// Le pagine della plancia — le luci, il clima, l'energia — stanno dentro la
/// plancia, nella sua barra: qui non si ripetono. La **configurazione** no:
/// quella esce dalla plancia e diventa una sezione dell'app (vedi
/// `menu.dart`), perche' e' una cosa della casa e non una pagina della
/// dashboard.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemNavigator;

import '../casa/aggiornamenti.dart';
import '../casa/collegamento.dart';
import '../casa/console.dart';
import '../casa/cruscotto.dart';
import '../casa/impostazioni.dart';
import '../casa/zigbee.dart';
import '../misure/lavori.dart';
import '../parole.dart';
import '../vestito/marchio.dart';
import '../vestito/pezzi.dart';
import '../vestito/quanto_e_largo.dart';
import 'aggiornamenti.dart';
import 'assistenza.dart';
import 'barra.dart';
import 'console.dart';
import 'cruscotto.dart';
import 'diagnostica.dart';
import 'dispositivi.dart';
import 'firma.dart';
import 'menu.dart';
import 'zigbee.dart';
import 'misure.dart';
import 'plancia_vera.dart';
import 'segnalazioni.dart';

class Home extends StatefulWidget {
  const Home({
    super.key,
    required this.collegamento,
    required this.vaiAlleCase,
    required this.plancia,
    required this.impostazioni,
  });

  final Collegamento collegamento;
  final Impostazioni impostazioni;
  final VoidCallback vaiAlleCase;

  /// Come si apre la plancia vera: il servitore e il riquadro. Sostituibile
  /// nelle prove.
  final FabbricaDellaPlancia plancia;

  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  final _barra = GlobalKey<BarraDelleSezioniState>();
  final _plancia = GlobalKey<PlanciaVeraState>();
  Sezione _sezione = Sezione.plancia;

  /* Se da questa casa si risponde alle chat delle altre.
   *
   * Lo dice il ponte, e lo dice una volta sola per collegamento: la chiave
   * della console sta nelle sue opzioni, e l'app non ha modo di saperlo — ne'
   * deve — prima di chiederglielo. Falso finche' non risponde, cosi' una casa
   * qualunque non vede mai comparire e sparire una voce di menu. */
  bool _console = false;
  /* Dove sta il cruscotto di chi installa, se questa casa e' la sua. Vuoto
   * vuol dire che non lo e', e la voce del menu non c'e'. */
  String _cruscotto = '';
  /* E dove sta la gestione, per l'unica casa al mondo che tiene il quadro.
   * Stessa regola: vuoto vuol dire che la voce non c'e'. */
  String _gestione = '';
  /* Se questa casa ha una rete Zigbee da aprire. Falso finche' il ponte non
   * risponde, cosi' una casa che non ce l'ha non vede mai comparire e sparire
   * una voce di menu. */
  bool _zigbee = false;
  /* E i due codici, per chi amministra questa casa: senza, la pagina dentro
   * il riquadro li fa ribattere anche se stanno gia' nella scheda
   * dell'add-on. */
  String _chiave = '';
  String _chiaveGestione = '';
  /* Quante volte si e' gia' chiesto per questa casa.
   *
   * La domanda si fa una volta per casa, e va bene per «questa casa ha il
   * cruscotto?»: quella risposta non cambia sotto il naso. Per il **codice**
   * invece puo' cambiare: il ponte lo da' solo a chi amministra, e per saperlo
   * deve conoscere gli utenti di casa — cosa che nell'istante in cui il filo
   * si alza puo' ancora non sapere.
   *
   * Tenersi quel «niente codice» per sempre vuol dire una pagina che lo chiede
   * per tutta la sessione anche quando il ponte l'avrebbe dato. Quindi finche'
   * c'e' una porta senza il suo codice si riprova — poche volte, e poi si
   * smette: chi non amministra il codice non lo avra' mai, e continuare a
   * chiederlo sarebbe un giro che non finisce. */
  static const _quanteVolteSiRichiede = 3;
  int _chieste = 0;
  String? _chiestoPer;

  /* Quanti aggiornamenti aspettano in casa.
   *
   * E' il numero che compare sulla voce del menu, e ci compare perche' senza
   * di lui la sezione la scoprirebbe solo chi ci entra apposta — cioe'
   * esattamente il problema di Home Assistant, spostato di una schermata.
   *
   * Si chiede al ponte, che risponde con tre righe invece che con tutta la
   * casa: una volta quando il filo si alza, e poi ogni tanto. «Ogni tanto» e'
   * mezz'ora, non un minuto: un aggiornamento non compare al secondo, e un
   * giro piu' fitto sarebbe una domanda a Home Assistant per niente. Chi apre
   * la sezione il numero se lo porta a casa fresco — e' lei a dirlo qui,
   * appena ha letto l'elenco. */
  static const _ogniTanto = Duration(minutes: 30);
  int _daAggiornare = 0;
  Timer? _giroDegliAggiornamenti;
  bool _aggiornamentiChiesti = false;

  @override
  void initState() {
    super.initState();
    _seRisponde();
    _quantiAggiornamenti();
    _giroDegliAggiornamenti = Timer.periodic(
      _ogniTanto,
      (_) => _quantiAggiornamenti(),
    );
  }

  @override
  void dispose() {
    _giroDegliAggiornamenti?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(Home vecchia) {
    super.didUpdateWidget(vecchia);
    _seRisponde();
    _quantiAggiornamenti();
  }

  /* Il conto, chiesto al ponte.
   *
   * Un ponte piu' vecchio dell'app questo comando non lo conosce e risponde
   * «non conosco»: il conto resta a zero, la voce non porta nessun numero, e
   * la sezione lo spiega a chi la apre. Non e' un errore da mostrare in cima
   * al menu. */
  Future<void> _quantiAggiornamenti() async {
    final filo = widget.collegamento.filo;
    if (filo == null || !filo.dentro) return;
    if (_aggiornamentiChiesti) return;
    _aggiornamentiChiesti = true;
    try {
      final fila = await GliAggiornamenti(filo).elenco();
      if (mounted) _contati(fila.length);
    } catch (_) {
      /* Il filo caduto, un ponte vecchio, Home Assistant che non risponde:
       * niente di tutto questo e' una cosa da dire qui. Si riprova al giro
       * dopo. */
    } finally {
      _aggiornamentiChiesti = false;
    }
  }

  void _contati(int quanti) {
    if (quanti != _daAggiornare) setState(() => _daAggiornare = quanti);
  }

  Future<void> _seRisponde() async {
    final filo = widget.collegamento.filo;
    if (filo == null || !filo.dentro) {
      /* Il filo e' giu': quando torna su si richiede. */
      _chiestoPer = null;
      return;
    }
    /* Una volta per casa, e non una volta sola: cambiando casa cambia anche
     * la risposta, e una voce di menu rimasta da prima sarebbe una porta che
     * non si apre. */
    final quale = widget.collegamento.casa?.id ?? '';
    if (_chiestoPer != quale) {
      _chiestoPer = quale;
      _chieste = 0;
    } else if (!_mancaUnCodice || _chieste >= _quanteVolteSiRichiede) {
      return;
    }
    _chieste += 1;
    final risponde = await LaConsole(filo).cE();
    /* Cruscotto e Gestione sono la stessa domanda fatta a chi la sa, e il
     * ponte le risponde in un giro solo. */
    final quadro = await IlCruscotto(filo).dove();
    /* E che rete Zigbee c'e'. La domanda sta qui insieme alle altre perche'
     * e' la stessa domanda — «cosa sa fare questa casa» — e perche' la
     * risposta decide una voce del menu, come le altre tre. */
    final rete = await Zigbee(filo).stato();
    if (!mounted) return;
    if (risponde != _console ||
        rete.rete.siApre != _zigbee ||
        quadro.cruscotto != _cruscotto ||
        quadro.gestione != _gestione ||
        quadro.chiave != _chiave ||
        quadro.chiaveGestione != _chiaveGestione) {
      setState(() {
        _console = risponde;
        _zigbee = rete.rete.siApre;
        _cruscotto = quadro.cruscotto;
        _gestione = quadro.gestione;
        _chiave = quadro.chiave;
        _chiaveGestione = quadro.chiaveGestione;
      });
    }
  }

  /// Se c'e' una porta di cui si sa l'indirizzo ma non il codice.
  ///
  /// E' l'unico caso in cui vale la pena richiedere: la porta c'e', e quello
  /// che manca il ponte potrebbe darlo appena sa chi sta chiedendo.
  bool get _mancaUnCodice =>
      (_cruscotto.isNotEmpty && _chiave.isEmpty) ||
      (_gestione.isNotEmpty && _chiaveGestione.isEmpty);

  /// Quello che una segnalazione porta con se' senza che nessuno lo scriva:
  /// e' la meta' delle domande che chi legge farebbe per prime.
  Map<String, String> _diagnostica() {
    final collegamento = widget.collegamento;
    return {
      'app': versioneDellApp.isEmpty ? 'sviluppo' : versioneDellApp,
      'sistema': kIsWeb ? 'web' : defaultTargetPlatform.name,
      'casa': collegamento.casa?.nome ?? '',
      'da_dove': collegamento.daDove?.name ?? '',
      'stato': collegamento.comeVa.name,
      if (collegamento.perche != null) 'perche': collegamento.perche!,
      if (collegamento.traffico != null) 'filo': collegamento.traffico!,
      'schermo': Misure.io.riassunto,
      'lavori': Lavori.io.riassunto,
      'plancia': widget.impostazioni.riassunto,
    };
  }

  /// Consegna alla plancia un dispositivo appena abbinato, e ci porta sopra.
  ///
  /// I due passi in quest'ordine, e non e' indifferente: la plancia sta in
  /// un'altra sezione, e un foglietto che si apre su una schermata che non si
  /// guarda e' un foglietto che nessuno vede. Prima si va li', poi si
  /// consegna — dopo un fotogramma, perche' fra il cambio di sezione e il
  /// riquadro che torna a disegnare passa un giro.
  ///
  /// A scrivere nella configurazione e' la plancia, con le sue regole: le sue
  /// sezioni hanno cinque forme diverse, e scriverle da qui vorrebbe dire
  /// scriverle due volte.
  void _loMettiNellaPlancia(DispositivoEntrato suo) {
    _vai(Sezione.plancia);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _plancia.currentState?.doveLoMetto(jsonEncode(suo.perLaPlancia));
    });
  }

  void _vai(Sezione dove) {
    /* La Configurazione non e' una schermata dell'app: e' la pagina
     * Configurazione della plancia, quella della dashboard, e si apre dentro
     * il riquadro com'e'. Della voce del menu resta la porta — e' quello che
     * vuol dire «uscita da dentro la plancia» — e dietro la porta c'e' la
     * sua pagina, intatta: la tessera che apre l'editor, il Tema, la
     * Tavolozza, la Barra, «Sostieni il progetto».
     *
     * La sezione resta segnata «Configurazione» anche se sotto si vede il
     * riquadro: e' li' che si e', e il menu deve dirlo. */
    if (dove == Sezione.configurazione) {
      if (_sezione != dove) setState(() => _sezione = dove);
      /* La Config l'abbiamo chiesta noi: la pagina lo confermera' appena si
       * apre, e fino a quel momento vale quello che le abbiamo chiesto. */
      _laPaginaENellaConfig = true;
      _plancia.currentState?.apriLaConfig();
      return;
    }
    /* «Plancia» riporta alla plancia. **Sempre**, senza chiedere al menu dove
     * crede di essere.
     *
     * Con lo stesso tocco si chiedono due cose diverse: uscire dalla
     * Configurazione, se la si sta guardando, e ricaricare, se la plancia c'e'
     * gia' — che e' il gesto piu' vicino a tirare giu' per aggiornare, che
     * dentro un riquadro non c'e'. A dire quale delle due e' **la pagina**:
     * quello che il menu ha segnato e' quello che si e' scelto, e le due cose
     * si scollano. Basta una ricarica in mezzo: la plancia riparte dalla sua
     * Home e lo dice — il menu si segna sulla Plancia — e un momento dopo
     * l'ordine nell'indirizzo riapre la Config. Il menu dice una cosa, lo
     * schermo un'altra.
     *
     * Chiedere al menu, allora, voleva dire ricaricare la plancia per
     * ritrovarsi la Configurazione. Chiedere alla pagina vuol dire uscirne. */
    if (dove == Sezione.plancia) {
      if (_laPaginaENellaConfig) {
        _laPaginaENellaConfig = false;
        _plancia.currentState?.tornaDallaConfig();
      } else if (_sezione == dove) {
        _plancia.currentState?.ricarica();
      }
      if (_sezione != dove) setState(() => _sezione = dove);
      return;
    }
    if (dove == _sezione) return;
    setState(() => _sezione = dove);
  }

  /* Il tasto indietro, e il gesto che fa la stessa cosa.
   *
   * Prima non era gestito affatto: premerlo sulla plancia chiudeva l'app, e
   * il gesto che ogni telefono ha si buttava via. Adesso la strada e' quella
   * che uno si aspetta da un'app: la pagina di sotto sono le sezioni, la
   * sezione aperta e' la pagina di sopra, e indietro va sempre verso fuori.
   * Quindi: se il menu non c'e', indietro lo apre; se c'e' gia', sotto non
   * c'e' piu' niente e si esce.
   *
   * Uscire vuole due indietro **di fila**: la barra si richiude da sola dopo
   * quattro secondi, e allora il secondo indietro la riapre invece di
   * uscire. E' il «premi due volte per uscire» di mezza Android, senza
   * scriverlo da nessuna parte.
   *
   * Nel browser non si tocca niente: quel tasto e' del browser, e l'app che
   * se lo prende e' una pagina da cui non si esce piu'. Li' il menu si apre
   * dai tre trattini della plancia e dal ☰. */
  void _indietro() {
    final barra = _barra.currentState;
    if (barra == null) return;
    if (!barra.aperta) {
      barra.apri();
      return;
    }
    SystemNavigator.pop();
  }

  /* La plancia e' andata su un'altra sua pagina.
   *
   * La sua barra in fondo resta anche sulla Configurazione — e' una pagina
   * come le altre, e da li' si tocca «Energia» e si va sull'energia — ma il
   * menu dell'app restava segnato su «Configurazione» con sotto un'altra
   * pagina. Adesso la pagina lo dice (`plancia/premesse.dart`) e il menu si
   * sposta da se': sulla Configurazione ci si resta finche' ci si e'. */
  /// Se la pagina dice di stare mostrando la sua Configurazione.
  ///
  /// Non e' `_sezione`: quella e' la voce segnata nel menu, cioe' quello che
  /// si e' **scelto**. Questo e' dove la pagina dice di essere, e le due cose
  /// si scollano — l'ordine nell'indirizzo puo' riaprire la Config sotto un
  /// menu segnato sulla Plancia. Serve a sapere cosa vuole chi tocca
  /// «Plancia»: uscire dalla Config, o ricaricare.
  bool _laPaginaENellaConfig = false;

  void _laPlanciaEAltrove(String pagina) {
    if (!mounted) return;
    /* Non ridisegna niente: non e' una cosa che si vede, e' una cosa che si
     * sa. */
    _laPaginaENellaConfig = pagina == 'config';
    if (_sezione != Sezione.configurazione || pagina == 'config') return;
    setState(() => _sezione = Sezione.plancia);
  }

  @override
  Widget build(BuildContext context) {
    final collegamento = widget.collegamento;
    /* Sulla plancia la barra del titolo non c'e': la plancia ha la sua
     * testata, col nome della casa e il meteo, e una seconda riga sopra
     * direbbe le stesse cose a tre centimetri di distanza. */
    final sullaPlancia =
        _sezione == Sezione.plancia || _sezione == Sezione.configurazione;
    /* Dove la barra resta non ci vuole nessun tasto per aprirla: e' aperta. */
    final laBarraResta = QuantoELargo.di(context).laBarraResta;
    return PopScope(
      /* Indietro lo decide l'app, e non sempre: nel browser quel tasto e' del
       * browser (vedi [_indietro]). */
      canPop: kIsWeb,
      onPopInvokedWithResult: (fatto, _) {
        if (fatto) return;
        _indietro();
      },
      child: Scaffold(
        appBar: sullaPlancia
            ? null
            : AppBar(
                /* Il ☰: la porta del menu su queste schermate. Sulla
                 * plancia la porta sono i suoi tre trattini, che stanno nella
                 * pagina; qui la pagina e' dell'app, e il tasto e' dove lo
                 * cerca chiunque abbia un telefono in mano.
                 *
                 * Il marchio si sposta accanto al titolo e non porta piu' da
                 * nessuna parte: le case sono il tasto in fondo a destra, che
                 * c'era gia' e lo dice a parole. */
                leading: laBarraResta
                    ? Padding(
                        padding: const EdgeInsets.only(
                          left: 12,
                          top: 8,
                          bottom: 8,
                        ),
                        child: GestureDetector(
                          onTap: widget.vaiAlleCase,
                          child: const Marchio(lato: 30),
                        ),
                      )
                    : IconButton(
                        icon: const Icon(Icons.menu_rounded),
                        tooltip: nomeDelTastoDellaBarra,
                        onPressed: () => _barra.currentState?.apri(),
                      ),
                leadingWidth: laBarraResta ? 54 : null,
                titleSpacing: laBarraResta ? 4 : null,
                title: laBarraResta
                    ? Text(_sezione.titolo)
                    : Row(
                        children: [
                          const Marchio(lato: 26),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _sezione.titolo,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.home_work_rounded),
                    tooltip: nomeDelleCase,
                    onPressed: widget.vaiAlleCase,
                  ),
                ],
                /* Una riga sottile che dice «sto ricollegando»: i dati vecchi
                 * restano a schermo, e si vede che stanno per cambiare. */
                bottom: collegamento.comeVa == ComeVa.inCammino
                    ? const PreferredSize(
                        preferredSize: Size.fromHeight(3),
                        child: LinearProgressIndicator(minHeight: 3),
                      )
                    : null,
              ),
        /* La barra sta **sopra** la pagina, non accanto: e' una dock, si chiama
         * quando serve e sparisce quando non serve. */
        body: Stack(
          children: [
            /* Sulla plancia il fondo dell'app non si vede.
             *
             * Dietro le bande del sistema — l'orologio in cima, i gesti in
             * fondo — ci va lo stesso grigio della pagina, piatto, senza gli
             * aloni: cosi' quelle bande non sembrano il bordo di un'altra
             * cosa, e la plancia si legge come una pagina sola che arriva
             * fino ai lati dello schermo. Sotto ci sta comunque il fondo
             * vivo, che si rivede appena si esce dalla plancia. */
            if (sullaPlancia)
              Positioned.fill(
                child: ColoredBox(color: Theme.of(context).colorScheme.surface),
              ),
            /* Senza barra del titolo la pagina comincia sotto l'orologio del
             * telefono: l'aria in cima gliela lascia questo, e solo dove la
             * barra non c'e' — dove c'e', quell'aria l'ha gia' lasciata lei.
             * In fondo lo stesso: la plancia ha la sua barra proprio li', e
             * non deve finire sotto i gesti del telefono. */
            SafeArea(
              /* Alla plancia lo schermo si da' tutto, barre di sistema
               * comprese: dove non scrivere lo sa la pagina, e se lo tiene lei
               * (vedi `Servitore.margini`). Sulle altre sezioni la barra del
               * titolo pensa alla cima, e qui si toglie solo l'aria in fondo,
               * che se no l'ultima riga finisce sotto i tasti del telefono. */
              top: false,
              bottom: !sullaPlancia,
              child: Padding(
                /* Dove la barra si nasconde non le si lascia niente: sul
                 * bordo sinistro non c'e' piu' nulla di suo — nessuna pillola,
                 * nessuna fascia — e le pagine arrivano al bordo.
                 *
                 * Dove la barra **resta** invece — su un computer, su un tablet
                 * di lato — il posto glielo si lascia per davvero, e anche alla
                 * plancia: li' la barra non galleggia sopra niente, sta accanto,
                 * e una plancia che le finisce sotto e' una plancia con una
                 * fascia che non si puo' toccare. */
                padding: EdgeInsets.only(left: quantoPerLaBarra(context)),
                /* Le sezioni restano in piedi anche quando non si guardano: la
                 * plancia e' una pagina web, e rifarla da capo a ogni ritorno
                 * vorrebbe dire riaprirla ogni volta. */
                child: IndexedStack(
                  /* La Configurazione mostra il riquadro: la sua pagina sta
                   * dentro la plancia, e la voce del menu la apre li'. */
                  index: Sezione.values.indexOf(
                    _sezione == Sezione.configurazione
                        ? Sezione.plancia
                        : _sezione,
                  ),
                  children: [
                    for (final sezione in Sezione.values)
                      /* Le pagine dell'app si fermano dove si legge ancora e
                       * restano in mezzo: una riga lunga duemila punti l'occhio
                       * non la segue, e su un computer una configurazione larga
                       * tutta la finestra e' un modulo che si attraversa col
                       * collo. La plancia no: quella ha un disegno suo che si
                       * adatta, e le si da' tutto quello che c'e'. */
                      QuantoCiSta(
                        quanto: sezione == Sezione.plancia
                            ? double.infinity
                            : null,
                        child: switch (sezione) {
                          Sezione.plancia => PlanciaVera(
                            key: _plancia,
                            collegamento: collegamento,
                            /* La plancia e' l'unica sezione che resta al
                               lavoro anche da spenta: e' una pagina web, e
                               una pagina web non si accorge da sola che
                               nessuno la guarda. Glielo si dice. */
                            visibile: sullaPlancia,
                            fabbrica: widget.plancia,
                            impostazioni: widget.impostazioni,
                            vaiAlleCase: widget.vaiAlleCase,
                            quandoCambiaPagina: _laPlanciaEAltrove,
                            /* I tre trattini della plancia: sono la porta del
                             * menu, qui dove la barra del titolo non c'e'. */
                            quandoChiedeIlMenu: () =>
                                _barra.currentState?.apri(),
                          ),
                          Sezione.dispositivi => Dispositivi(
                            collegamento: collegamento,
                            visibile: _sezione == Sezione.dispositivi,
                          ),
                          /* La Configurazione qui non ha una schermata: la
                           * voce apre la pagina della plancia, dentro il
                           * riquadro, e la fila mostra quello. Il posto resta
                           * perche' le sezioni e le voci del menu sono la
                           * stessa cosa. */
                          Sezione.configurazione => const SizedBox.shrink(),
                          /* «Come va l'app»: la stessa schermata che apre
                           * l'Assistenza, senza la sua barra — qui la barra
                           * la mette la home. */
                          Sezione.comeVaLApp => SchermataDellaDiagnostica(
                            collegamento: collegamento,
                            impostazioni: widget.impostazioni,
                            nuda: true,
                          ),
                          /* Cosa c'e' da aggiornare in casa: l'unica
                           * sezione che porta un numero addosso alla voce,
                           * ed e' lei a dirlo qui appena l'ha letto. */
                          Sezione.aggiornamenti => SchermataDegliAggiornamenti(
                            collegamento: collegamento,
                            visibile: _sezione == Sezione.aggiornamenti,
                            quandoContati: _contati,
                          ),
                          Sezione.segnalazioni => SchermataDelleSegnalazioni(
                            collegamento: collegamento,
                            diagnostica: _diagnostica,
                          ),
                          Sezione.assistenza => SchermataDellAssistenza(
                            collegamento: collegamento,
                            diagnostica: _diagnostica,
                            impostazioni: widget.impostazioni,
                          ),
                          /* La coda di chi risponde: c'e' in una casa sola al
                           * mondo, e in quella la voce del menu compare. */
                          Sezione.console => SchermataDellaConsole(
                            collegamento: collegamento,
                          ),
                          /* Gli impianti di chi installa: la voce c'e' solo
                           * dove le opzioni del ponte l'hanno accesa. */
                          Sezione.cruscotto => SchermataDelCruscotto(
                            dove: _cruscotto,
                            chiave: _chiave,
                            visibile: _sezione == Sezione.cruscotto,
                          ),
                          /* Chi tiene il quadro: la stessa schermata del
                           * cruscotto, con un altro indirizzo dentro. La
                           * pagina e' quella che esiste gia' sul quadro, e
                           * rifarla qui vorrebbe dire un secondo posto dove
                           * stanno le stesse regole. */
                          Sezione.gestione => SchermataDelCruscotto(
                            dove: _gestione,
                            chiave: _chiaveGestione,
                            visibile: _sezione == Sezione.gestione,
                          ),
                          /* Un dispositivo nuovo dal telefono: la voce
                           * c'e' solo dove una rete Zigbee c'e' davvero. */
                          Sezione.zigbee => SchermataZigbee(
                            collegamento: collegamento,
                            visibile: _sezione == Sezione.zigbee,
                            quandoVaMessoNellaPlancia: _loMettiNellaPlancia,
                          ),
                          _ => _InArrivo(sezione),
                        },
                      ),
                  ],
                ),
              ),
            ),
            BarraDelleSezioni(
              key: _barra,
              sezioni: vociDellaBarra(
                conLaConsole: _console,
                conIlCruscotto: _cruscotto.isNotEmpty,
                conLaGestione: _gestione.isNotEmpty,
                conZigbee: _zigbee,
              ),
              aperta: _sezione,
              daAggiornare: _daAggiornare,
              vai: _vai,
              vaiAlleCase: widget.vaiAlleCase,
              collegamento: collegamento,
              /* Sotto la barra c'e' la plancia: e' l'unica sezione che nel
               * browser sta in un riquadro, e un riquadro si mangia i tocchi di
               * quello che gli sta sopra. La barra lo sa e se ne occupa (vedi
               * `da_parte.dart`). */
              sopraLaPlancia: sullaPlancia,
            ),
          ],
        ),
      ),
    );
  }
}

/// Una sezione che non c'e' ancora.
class _InArrivo extends StatelessWidget {
  const _InArrivo(this.sezione);
  final Sezione sezione;

  @override
  Widget build(BuildContext context) => StatoVuoto(
    icona: Icons.construction_rounded,
    titolo: inLingua(
      it: '${sezione.titolo}: in arrivo',
      en: '${sezione.titolo}: coming soon',
    ),
    sotto: inLingua(
      it: 'Questa parte dell\'app non è ancora scritta.',
      en: 'This part of the app isn\'t written yet.',
    ),
  );
}
