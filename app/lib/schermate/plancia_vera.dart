/// La plancia vera: quella di DashboardModern, dentro l'app.
///
/// Non una plancia che le somiglia — **quella**. La stessa pagina che si apre
/// in Home Assistant, con le sue tessere, le sue finestre, la sua barra, la
/// sua configurazione, gira qui dentro un WebView, e quello che si configura
/// di la' si vede di qua senza fare niente. E' l'unico modo di avere davvero
/// la propria casa nell'app invece di una copia che insegue.
///
/// Da dove arriva: dal **servitore**, il server locale che sta dentro l'app
/// (`plancia/servitore.dart`). I file li prende dal ponte, sul filo, e li
/// tiene sul disco; il WebSocket della pagina lo cuce sullo stesso filo.
/// Nessuna credenziale di Home Assistant tocca ne' la pagina ne' il telefono.
///
/// Questa schermata sa tre cose: quando la casa non e' pronta lo dice, quando
/// il ponte non ha la plancia lo dice, e quando ce l'ha apre la pagina e la
/// copre finche' non e' arrivata.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../casa/collegamento.dart';
import '../casa/impostazioni.dart';
import '../plancia/servitore_qui/qui.dart';
import '../ponte/filo.dart';
import '../vestito/pezzi.dart';
import 'da_dove.dart';
import 'riquadro/qui.dart' as riquadro;

/// Un servitore acceso a parte, invece di quello che l'app si apre da se'.
///
/// Serve al collaudo, che nel browser fa girare l'app contro
/// `bin/servitore.dart`. Vuoto — cioe' quasi sempre — la plancia arriva dal
/// servitore di questo sistema: un server vero sul telefono, un service worker
/// nel browser.
const String _planciaSulWeb = String.fromEnvironment('PLANCIA_URL');

/// Come si apre la plancia vera su questo sistema: il servitore, e il
/// riquadro che la mostra.
///
/// E' una classe e non due funzioni perche' si sostituisce nelle prove, dove
/// non c'e' ne' un WebView ne' un disco: li' il servitore e' finto e il
/// riquadro e' una scritta, e quello che si prova e' dove si finisce.
class FabbricaDellaPlancia {
  FabbricaDellaPlancia();

  Future<ServitoreDiQuestoSistema?>? _servitore;

  /// Il servitore, acceso una volta sola per tutta la vita dell'app: cambia
  /// casa, cade il filo, si gira lo schermo, e lui resta.
  Future<ServitoreDiQuestoSistema?> servitore(
    Filo? Function() filo, {
    String lingua = 'it',
  }) => _servitore ??= alzaIlServitore(filo: filo, lingua: lingua);

  /// Il riquadro che mostra una pagina.
  Widget riquadro(
    Uri pagina, {
    required Key chiave,
    required VoidCallback quandoCaricata,
    required void Function(String perche) quandoFallisce,
    bool ibrido = false,
    ({double alto, double basso}) margini = (alto: 0, basso: 0),
    void Function(String pagina)? quandoCambiaPagina,
    void Function()? quandoChiedeIlMenu,
  }) => RiquadroDellaPlancia(
    key: chiave,
    pagina: pagina,
    ibrido: ibrido,
    margini: margini,
    quandoCaricata: quandoCaricata,
    quandoFallisce: quandoFallisce,
    quandoCambiaPagina: quandoCambiaPagina,
    quandoChiedeIlMenu: quandoChiedeIlMenu,
  );
}

class PlanciaVera extends StatefulWidget {
  const PlanciaVera({
    super.key,
    required this.collegamento,
    required this.fabbrica,
    required this.impostazioni,
    this.vaiAlleCase,
    this.quandoCambiaPagina,
    this.quandoChiedeIlMenu,
  });

  final Collegamento collegamento;
  final FabbricaDellaPlancia fabbrica;
  final Impostazioni impostazioni;
  final VoidCallback? vaiAlleCase;

  /// Quale pagina della plancia si e' accesa, quando cambia. Serve al menu
  /// dell'app: la barra della plancia resta anche sulla Configurazione, e da
  /// li' si va dove si vuole — il menu non puo' restare segnato su una voce
  /// mentre sotto c'e' un'altra pagina.
  final void Function(String pagina)? quandoCambiaPagina;

  /// La plancia chiede il menu dell'app: si sono premuti i suoi tre trattini,
  /// che dentro Home Assistant aprono la barra di chi la ospita e qui aprono
  /// la nostra (`plancia/premesse.dart`).
  final void Function()? quandoChiedeIlMenu;

  @override
  State<PlanciaVera> createState() => PlanciaVeraState();
}

class PlanciaVeraState extends State<PlanciaVera> {
  final _riquadro = GlobalKey<RiquadroDellaPlanciaState>();
  ServitoreDiQuestoSistema? _servitore;
  bool _servitoreChiesto = false;

  /// La pagina che si sta mostrando, e come sta: `null` finche' non se ne
  /// apre una.
  Uri? _pagina;
  bool _caricata = false;
  String? _perche;
  StreamSubscription<void>? _ascoltoLeImpostazioni;
  StreamSubscription<void>? _ascoltoLaConfigurazione;
  late bool _leggera = widget.impostazioni.planciaLeggera;
  late bool _ibrida = widget.impostazioni.composizioneIbrida;

  /* La pagina si e' aperta mentre la casa non c'era.
   *
   * Succede riaprendo l'app fuori casa: il riquadro parte subito, e il filo
   * col centralino ci mette qualche secondo. La plancia allora non riesce a
   * rileggersi la configurazione dal ponte e mostra quella che ha — e la
   * prima volta, su un telefono appena aggiornato, non ha niente: si vede
   * «la dashboard e' quasi pronta», e sembra che la configurazione sia
   * andata persa. Quando la casa arriva le si da' un'altra occasione, una
   * volta sola. */
  bool _apertaSenzaCasa = false;
  bool _giaRicaricata = false;

  @override
  void initState() {
    super.initState();
    _ascoltoLeImpostazioni = widget.impostazioni.cambiamenti.listen(
      (_) => _impostazioniCambiate(),
    );
    /* La configurazione cambiata dalla schermata Configurazione: la pagina la
     * legge all'avvio e basta, quindi si riparte da capo. Non e' uno spreco —
     * succede quando si preme «Salva», non a ogni evento della casa. */
    _ascoltoLaConfigurazione = widget.collegamento.planciaCambiata.listen(
      (_) => ricarica(),
    );
    if (!kIsWeb) unawaited(_accendi());
  }

  @override
  void dispose() {
    _ascoltoLeImpostazioni?.cancel();
    _ascoltoLaConfigurazione?.cancel();
    super.dispose();
  }

  Future<void> _accendi() async {
    _servitoreChiesto = true;
    final servitore = await widget.fabbrica.servitore(
      () => widget.collegamento.filo,
    );
    if (!mounted) return;
    servitore?.leggera = widget.impostazioni.planciaLeggera;
    setState(() => _servitore = servitore);
  }

  /* Un interruttore cambiato vale dalla pagina dopo: la plancia leggera
   * la scrive il servitore in testa alla pagina, e la composizione e' del
   * riquadro. In tutti e due i casi si ricarica. */
  void _impostazioniCambiate() {
    if (!mounted) return;
    final leggera = widget.impostazioni.planciaLeggera;
    final ibrida = widget.impostazioni.composizioneIbrida;
    final cambiaLaComposizione = ibrida != _ibrida;
    if (leggera == _leggera && !cambiaLaComposizione) return;
    _servitore?.leggera = leggera;
    setState(() {
      _leggera = leggera;
      _ibrida = ibrida;
      _caricata = false;
      _perche = null;
    });
    /* Con la composizione cambiata il riquadro rinasce da solo, chiave
     * nuova, e ricarica la pagina da se'. Con la sola leggerezza cambiata
     * il riquadro e' lo stesso, e la pagina va ricaricata. */
    if (!cambiaLaComposizione) _riquadro.currentState?.ricarica();
  }

  /// Ricarica la pagina: e' quello che fa toccare di nuovo «Plancia» nella
  /// barra quando ci si e' gia'.
  void ricarica() {
    if (!mounted) return;
    setState(() {
      _caricata = false;
      _perche = null;
    });
    _riquadro.currentState?.ricarica();
  }

  /* La Config chiesta prima che la pagina fosse pronta: si apre appena
   * arriva. Succede aprendo l'app e andando subito sulla Config — il
   * riquadro sta ancora leggendo i suoi script. */
  bool _laConfigAppenaSiPuo = false;

  /// Apre la Configurazione della plancia: **quella** della dashboard — la
  /// sua pagina, con la sua insegna e le sue tessere — e non una rifatta.
  /// E' la voce «Configurazione» del menu dell'app: di dentro la plancia e'
  /// uscita la porta, la pagina no.
  void apriLaConfig() {
    if (!mounted) return;
    if (!_caricata) {
      _laConfigAppenaSiPuo = true;
      return;
    }
    _riquadro.currentState?.apriLaConfig();
  }

  /// Torna dov'era la plancia prima della Configurazione. E' la voce
  /// «Plancia» del menu quando si viene dalla Config: nella dashboard si
  /// tocca un'altra linguetta, qui la linguetta e' la voce del menu.
  void tornaDallaConfig() {
    if (!mounted) return;
    _laConfigAppenaSiPuo = false;
    _riquadro.currentState?.tornaDallaConfig();
  }

  @override
  Widget build(BuildContext context) {
    final collegamento = widget.collegamento;
    /* Quanto prendono l'orologio in cima e i tasti in fondo.
     *
     * Prese **dalla finestra**, non dall'albero. Quello che si legge
     * nell'albero e' quello che resta dopo che chi sta sopra se n'e' preso
     * la sua parte — un `SafeArea`, una barra del titolo — e per i tasti in
     * fondo tornava zero: l'app credeva che i tasti non ci fossero, non
     * diceva niente alla pagina, e la barra della plancia finiva sotto.
     * `MediaQuery` si legge lo stesso, che e' quello che fa ridisegnare
     * quando lo schermo cambia — si gira il telefono, si apre la tastiera. */
    final dallAlbero = MediaQuery.viewPaddingOf(context);
    final vista = View.of(context);
    final punti = vista.devicePixelRatio;
    final inCima = math.max(dallAlbero.top, vista.viewPadding.top / punti);
    final inFondo = math.max(
      dallAlbero.bottom,
      vista.viewPadding.bottom / punti,
    );

    /* In fondo non si chiede niente alla pagina: si accorcia il riquadro.
     *
     * Tre volte ho scritto la regola di stile che doveva tenere la barra
     * della plancia sopra i tasti di Android, e tre volte non ha funzionato:
     * il numero non arrivava, poi arrivava e vinceva un altro `!important`,
     * poi la barra stava li' in un modo che il selettore non prendeva. Il
     * difetto vero non era nessuno di quei tre — era **aver chiesto alla
     * pagina di stare attenta**. Una pagina che deve ricordarsi di lasciare
     * spazio in fondo se lo dimentica in tutti i modi che ci sono.
     *
     * Adesso il riquadro finisce **dove cominciano i tasti**, e sotto ci
     * resta il fondo dell'app, che e' dello stesso grigio: si legge come una
     * pagina sola, e non c'e' nessuna regola di stile che possa sbagliare.
     * Sopra invece resta com'era — li' la pagina se lo tiene bene, e
     * accorciare vorrebbe dire una fascia vuota sotto l'orologio.
     *
     * `basso: 0` non e' una svista: alla pagina si dice che in fondo non
     * deve lasciare niente, se no lo spazio verrebbe contato due volte. */
    final margini = (alto: inCima, basso: 0.0);
    switch (collegamento.comeVa) {
      case ComeVa.nessunaCasa:
        return _Stato(
          collegamento: collegamento,
          vaiAlleCase: widget.vaiAlleCase,
          icona: Icons.home_outlined,
          titolo: 'Nessuna casa',
          sotto: 'Aggiungine una per cominciare.',
        );
      case ComeVa.segnoScaduto:
        return _Stato(
          collegamento: collegamento,
          vaiAlleCase: widget.vaiAlleCase,
          icona: Icons.link_off_rounded,
          titolo: 'Questo telefono è stato staccato',
          sotto:
              collegamento.perche ??
              'Riabbina la casa con un QR code nuovo, dalla scheda gdahome in '
                  'Home Assistant.',
        );
      case ComeVa.irraggiungibile:
        return _Stato(
          collegamento: collegamento,
          vaiAlleCase: widget.vaiAlleCase,
          icona: Icons.cloud_off_rounded,
          titolo: 'Non trovo la casa',
          sotto: collegamento.perche ?? 'Sto continuando a provare.',
        );
      case ComeVa.inCammino:
      case ComeVa.aperta:
        break;
    }

    if (!collegamento.pannelloLetto) {
      return _Attesa(collegamento: collegamento, cosa: 'Cerco la plancia…');
    }
    final pannello = collegamento.pannello;
    if (pannello == null) {
      /* Le plance ci sono, e nessuna e' di chi guarda.
       *
       * E' una cosa diversa da «qui non c'e' la plancia», e si risolve in un
       * altro modo: non aggiornando l'add-on, ma chiedendo a chi amministra la
       * casa di abilitare la propria utenza. Dirlo e' anche l'unico modo
       * onesto di non aprire niente: prima, chi non aveva nessuna plancia si
       * vedeva aprire quella di un altro. */
      if (collegamento.nessunaPlanciaPerMe) {
        return _Stato(
          collegamento: collegamento,
          vaiAlleCase: widget.vaiAlleCase,
          icona: Icons.lock_person_rounded,
          titolo: 'Non hai plance associate alla tua utenza',
          sotto:
              'In questa casa le plance sono riservate ad altri utenti. '
              'Chiedi a chi amministra la casa di abilitare la tua utenza: '
              'in Home Assistant, nella pagina di gdahome, ogni plancia ha '
              '«Chi la vede».',
        );
      }
      return _Stato(
        collegamento: collegamento,
        vaiAlleCase: widget.vaiAlleCase,
        icona: Icons.dashboard_customize_rounded,
        titolo: 'L\'add-on non ha la plancia',
        sotto:
            'La plancia arriva con l\'add-on: aggiorna gdahome in Home '
            'Assistant e comparirà qui. Intanto, dalla barra, ci sono i '
            'dispositivi.',
      );
    }

    final servitore = _servitore;
    if (servitore == null) {
      if (!_servitoreChiesto) {
        unawaited(_accendi());
        return _Attesa(collegamento: collegamento, cosa: 'Accendo la plancia…');
      }
      /* Chiesto e non arrivato. Sul telefono non succede; nel browser si', e
       * per una ragione sola: la plancia la serve un service worker, e un
       * browser i service worker li fa girare **solo** su `https` o su
       * `localhost`. E' una regola sua, non nostra, e non si aggira.
       *
       * Il resto dell'app funziona lo stesso: la casa, i dispositivi, la
       * configurazione. Manca la plancia, ed e' meglio dire perche' che
       * lasciare un riquadro bianco. */
      return _Stato(
        collegamento: collegamento,
        vaiAlleCase: widget.vaiAlleCase,
        icona: Icons.lock_outline_rounded,
        titolo: kIsWeb
            ? 'La plancia vuole un indirizzo sicuro'
            : 'Non riesco ad accendere la plancia',
        sotto: kIsWeb
            ? 'Il browser fa girare quello che serve alla plancia solo su un '
                  'indirizzo che comincia per https, o su localhost. Da un '
                  'indirizzo http la casa si comanda lo stesso — dispositivi, '
                  'configurazione, tutto — ma la plancia resta fuori. Apri '
                  'gdahome dall\'indirizzo sicuro della tua Home Assistant.'
            : 'Riprova, o riapri l\'app.',
      );
    }
    /* Prima di chiedere la pagina, cosi' le misure ci sono gia' dentro e non
     * si vede un salto al primo fotogramma. */
    servitore.margini = margini;
    final pagina = _planciaSulWeb.isNotEmpty
        ? Uri.parse(_planciaSulWeb)
        : servitore.paginaDi(pannello);

    if (_pagina != pagina) {
      /* Una pagina nuova — un'altra casa, un'integrazione aggiornata — si
       * copre di nuovo finche' non arriva. */
      _pagina = pagina;
      _caricata = false;
      _perche = null;
      _apertaSenzaCasa = false;
      _giaRicaricata = false;
    }

    /* La casa e' arrivata dopo la pagina: la pagina si rifa', cosi' si
     * rilegge la configurazione dal ponte invece di restare quella vuota di
     * un momento fa. Una volta sola, che un filo ballerino non deve far
     * lampeggiare la plancia. */
    if (_apertaSenzaCasa && collegamento.dentro) {
      _apertaSenzaCasa = false;
      _giaRicaricata = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ricarica();
      });
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        /* La chiave sulla composizione: cambiarla rifa' il riquadro da capo,
         * perche' un WebView nasce in un modo e in quello resta. */
        Padding(
          padding: EdgeInsets.only(bottom: inFondo),
          child: KeyedSubtree(
            key: ValueKey<bool>(_ibrida),
            child: widget.fabbrica.riquadro(
              pagina,
              chiave: _riquadro,
              ibrido: _ibrida,
              margini: margini,
              quandoCaricata: () {
                if (!mounted) return;
                if (!collegamento.dentro && !_giaRicaricata) {
                  _apertaSenzaCasa = true;
                }
                if (!_caricata) setState(() => _caricata = true);
                if (_laConfigAppenaSiPuo) {
                  _laConfigAppenaSiPuo = false;
                  _riquadro.currentState?.apriLaConfig();
                }
              },
              quandoFallisce: (perche) {
                if (mounted) setState(() => _perche = perche);
              },
              quandoCambiaPagina: widget.quandoCambiaPagina,
              quandoChiedeIlMenu: widget.quandoChiedeIlMenu,
            ),
          ),
        ),
        if (_perche != null)
          _Velo(
            child: StatoVuoto(
              icona: Icons.wifi_tethering_error_rounded,
              titolo: 'La plancia non è arrivata',
              sotto: _perche!,
              azione: FilledButton.tonalIcon(
                onPressed: ricarica,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Riprova'),
              ),
            ),
          )
        else if (!_caricata)
          _Velo(
            child: _Attesa(
              collegamento: collegamento,
              cosa: 'Apro la plancia…',
            ),
          ),
        /* Una riga sottile che dice «sto ricollegando»: la plancia resta a
         * schermo coi suoi dati, e si vede che stanno per cambiare. */
        if (collegamento.comeVa == ComeVa.inCammino)
          const Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: LinearProgressIndicator(minHeight: 3),
          ),
      ],
    );
  }
}

/// Il WebView con dentro la plancia.
class RiquadroDellaPlancia extends StatefulWidget {
  const RiquadroDellaPlancia({
    super.key,
    required this.pagina,
    required this.quandoCaricata,
    required this.quandoFallisce,
    this.quandoCambiaPagina,
    this.quandoChiedeIlMenu,
    this.ibrido = false,
    this.margini = (alto: 0, basso: 0),
  });

  final Uri pagina;

  /// Su Android: composizione ibrida. Vedi `riquadro/sul_telefono.dart`.
  final bool ibrido;

  /// Quanto prendono le barre del telefono. Cambiando — si gira lo schermo —
  /// si ridicono alla pagina, che si risistema senza ricaricare.
  final ({double alto, double basso}) margini;
  final VoidCallback quandoCaricata;
  final void Function(String perche) quandoFallisce;

  /// Quale pagina della plancia si e' accesa: lo dice la pagina servita, e
  /// arriva da un canale del WebView o da un messaggio del riquadro.
  final void Function(String pagina)? quandoCambiaPagina;

  /// La pagina chiede il menu dell'app, dalla stessa strada.
  final void Function()? quandoChiedeIlMenu;

  @override
  State<RiquadroDellaPlancia> createState() => RiquadroDellaPlanciaState();
}

class RiquadroDellaPlanciaState extends State<RiquadroDellaPlancia> {
  /* Nasce alla prima occasione in cui c'e' un tema da cui prendere il
   * colore del fondo — non in `initState`, dove il tema non si puo' ancora
   * leggere — e da li' resta lo stesso per tutta la vita del riquadro. */
  WebViewController? _controllore;

  /// Cosa e' di casa. La plancia sta tutta sul servitore: dentro il riquadro
  /// ci va lei e nient'altro. Un indirizzo di fuori non si carica qui — se lo
  /// portasse via, la plancia sarebbe finita — e si apre nel browser del
  /// telefono (`riquadro/sul_telefono.dart`).
  ///
  /// «Di casa» non e' tutta l'origine, ed e' una lezione: la plancia ha
  /// qualche collegamento scritto **dalla radice**, che dentro Home Assistant
  /// porta a una pagina di Home Assistant — «Aprila», sotto il campo RTSP
  /// nelle telecamere, va a `/config/integrations/...`. Qui quell'indirizzo
  /// comincia con l'origine del servitore, quindi passava: il riquadro se ne
  /// andava dalla plancia e il servitore rispondeva «qui non c'e' niente» in
  /// testo nudo. Si torna solo ricaricando. Passa quello che il servitore
  /// serve davvero, e nient'altro.
  /// I tre percorsi che il servitore serve: i file della plancia, le
  /// immagini di `config/www`, e le chiamate REST a Home Assistant.
  static const _diCasa = ['/dashboardmodern_static/', '/local/', '/api/'];

  bool _dentroCasa(String indirizzo) {
    if (indirizzo.startsWith('about:')) return true;
    final origine = widget.pagina.origin;
    if (!indirizzo.startsWith(origine)) return false;
    final dopo = indirizzo.substring(origine.length);
    if (dopo.isEmpty || dopo.startsWith('?') || dopo.startsWith('#')) {
      return true;
    }
    /* La pagina stessa, con la sua chiave o il suo ancoraggio. */
    if (dopo.startsWith(widget.pagina.path)) return true;
    return _diCasa.any(dopo.startsWith);
  }

  /* Le tre finestre che un browser ha e un WebView no: `alert`, `confirm`,
   * `prompt`. La pagina le chiama come le chiamerebbe dentro Home Assistant,
   * e a mostrarle e' l'app. Vedi `riquadro/sul_telefono.dart`. */

  Future<void> _laPaginaDice(String messaggio) async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (dove) => AlertDialog(
        content: Text(messaggio),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dove).pop(),
            child: const Text('Va bene'),
          ),
        ],
      ),
    );
  }

  Future<bool> _laPaginaChiede(String domanda) async {
    if (!mounted) return false;
    final risposta = await showDialog<bool>(
      context: context,
      builder: (dove) => AlertDialog(
        content: Text(domanda),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dove).pop(false),
            child: const Text('Lascia stare'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dove).pop(true),
            child: const Text('Vai avanti'),
          ),
        ],
      ),
    );
    return risposta ?? false;
  }

  Future<String> _laPaginaFaScrivere(String domanda, String diSerie) async {
    if (!mounted) return '';
    final penna = TextEditingController(text: diSerie);
    final scritto = await showDialog<String>(
      context: context,
      builder: (dove) => AlertDialog(
        title: Text(domanda),
        content: TextField(
          controller: penna,
          autofocus: true,
          onSubmitted: (cosa) => Navigator.of(dove).pop(cosa),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dove).pop(),
            child: const Text('Lascia stare'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dove).pop(penna.text),
            child: const Text('Va bene'),
          ),
        ],
      ),
    );
    penna.dispose();
    return scritto ?? '';
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_controllore != null) return;
    final controllore = riquadro.costruisciIlControllore(
      quandoCaricata: () {
        /* La pagina e' arrivata: le si ridicono le misure, che nel frattempo
         * possono essere cambiate — la tastiera, una rotazione. */
        _leMisure();
        widget.quandoCaricata();
      },
      quandoFallisce: (perche) => widget.quandoFallisce(perche),
      siPuoAndare: _dentroCasa,
      dice: _laPaginaDice,
      chiede: _laPaginaChiede,
      faScrivere: _laPaginaFaScrivere,
      quandoCambiaPagina: widget.quandoCambiaPagina,
      quandoChiedeIlMenu: widget.quandoChiedeIlMenu,
      /* Lo stesso fondo dell'app: sotto la pagina, finche' non arriva, non
       * si vede un lampo di un altro colore. */
      sfondo: Theme.of(context).colorScheme.surface,
    );
    _controllore = controllore;
    unawaited(riquadro.apriLaPagina(controllore, widget.pagina));
  }

  @override
  void didUpdateWidget(RiquadroDellaPlancia oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pagina != widget.pagina) {
      final controllore = _controllore;
      /* `apriLaPagina` e non `loadRequest`: sul web l'`iframe` non dice
       * quando ha finito, e chi apre la pagina e' anche chi deve dire che e'
       * arrivata. Senza, scegliere un'altra plancia lasciava «Apro la
       * plancia…» sopra una plancia gia' aperta. */
      if (controllore != null) {
        unawaited(riquadro.apriLaPagina(controllore, widget.pagina));
      }
      return;
    }
    if (oldWidget.margini != widget.margini) _leMisure();
  }

  void _leMisure() {
    final controllore = _controllore;
    if (controllore == null) return;
    unawaited(
      riquadro.diciLeMisure(
        controllore,
        alto: widget.margini.alto,
        basso: widget.margini.basso,
      ),
    );
  }

  void ricarica() {
    final controllore = _controllore;
    if (controllore != null) {
      unawaited(riquadro.ricarica(controllore, widget.pagina));
    }
  }

  /// Apre la Config della plancia: la maniglia sta nella pagina, e come si
  /// tira dipende dal sistema — vedi `riquadro/sul_telefono.dart`.
  void apriLaConfig() {
    final controllore = _controllore;
    if (controllore != null) {
      unawaited(riquadro.apriLaConfig(controllore, widget.pagina));
    }
  }

  void tornaDallaConfig() {
    final controllore = _controllore;
    if (controllore != null) {
      unawaited(riquadro.tornaDallaConfig(controllore));
    }
  }

  @override
  Widget build(BuildContext context) =>
      riquadro.riquadroDelWebView(_controllore!, ibrido: widget.ibrido);
}

/// Un velo sopra il riquadro, col fondo dell'app: copre la pagina finche'
/// non e' pronta, e finche' il WebView non ha niente da far vedere.
class _Velo extends StatelessWidget {
  const _Velo({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      ColoredBox(color: Theme.of(context).colorScheme.surface, child: child);
}

/// Il nome della casa, da dove si passa, e una rotella.
class _Attesa extends StatelessWidget {
  const _Attesa({required this.collegamento, required this.cosa});
  final Collegamento collegamento;
  final String cosa;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(collegamento.casa?.nome ?? 'Casa', style: testi.titleLarge),
          const SizedBox(height: 6),
          DaDoveSiPassa(collegamento),
          const SizedBox(height: 22),
          const SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(strokeWidth: 3),
          ),
          const SizedBox(height: 14),
          Text(
            cosa,
            style: testi.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

/// Quello che si dice quando la plancia non si puo' aprire: la casa e da dove
/// si passa in cima, il perche' in mezzo, e le case a portata di mano.
class _Stato extends StatelessWidget {
  const _Stato({
    required this.collegamento,
    required this.icona,
    required this.titolo,
    required this.sotto,
    this.vaiAlleCase,
  });

  final Collegamento collegamento;
  final IconData icona;
  final String titolo;
  final String sotto;
  final VoidCallback? vaiAlleCase;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    return RefreshIndicator(
      onRefresh: () => collegamento.apri(forza: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      collegamento.casa?.nome ?? 'Casa',
                      style: testi.titleLarge,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    DaDoveSiPassa(collegamento, piccolo: true),
                  ],
                ),
              ),
              if (vaiAlleCase != null)
                IconButton(
                  icon: const Icon(Icons.home_work_rounded),
                  tooltip: 'Le tue case',
                  onPressed: vaiAlleCase,
                ),
            ],
          ),
          const SizedBox(height: 28),
          StatoVuoto(
            dentroUnaLista: true,
            icona: icona,
            titolo: titolo,
            sotto: sotto,
          ),
        ],
      ),
    );
  }
}
