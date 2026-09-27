/// Il menu delle sezioni: un pannello che entra di fianco.
///
/// ## Come ci si e' arrivati
///
/// Tre volte rifatto, e le prime due non erano rifacimenti.
///
/// Era una **striscia laterale** di duecento punti con quattordici voci
/// dentro. La prima volta le voci sono diventate tessere a due colonne, la
/// seconda righe ordinate: il vestito, non l'idea. Il difetto era la
/// **striscia** — duecento punti sono un posto dove non ci sta niente comodo:
/// i nomi lunghi si rimpiccioliscono o si tagliano, le tessere diventano
/// francobolli, le righe diventano una lista e basta.
///
/// La terza volta e' diventato una schermata che saliva dal basso. Larghezza
/// intera, mattonelle grandi, una casella per cercare, la casa scritta grande
/// in testa. Le tre cose buone erano quelle, e restano tutte; ma il menu di
/// un'app che ha la plancia sotto **deve stare di lato**: e' da li' che lo si
/// chiama (i tre trattini in alto a sinistra), ed e' da li' che ci si aspetta
/// che esca. Uno che arriva dal basso copre la pagina dalla parte opposta a
/// quella che si e' toccata.
///
/// ## Com'e' adesso
///
/// Entra **da sinistra**, dal bordo del tasto che lo chiama, e si prende quasi
/// tutta la larghezza — `_quantoLargo`. Non e' la striscia di prima girata:
/// dentro c'e' tutto quello che la schermata aveva, e ci sta perche' la
/// larghezza c'e':
///
///  - le sezioni come **mattonelle in rilievo**, due per riga, col disegno
///    grosso e il nome intero sotto. Hanno un fianco e un'ombra, e premendole
///    scendono sul loro fianco come un tasto vero — vedi `_Mattonella`;
///  - una **casella per cercare**. Con quattordici sezioni, e domani venti, la
///    cosa piu' veloce e' scrivere tre lettere;
///  - la **casa in testa** scritta grande, col tasto per cambiarla.
///
/// La striscia di pagina resta scoperta **a destra**: dice che sotto c'e'
/// ancora la propria casa, e da' un posto dove toccare per richiudere che non
/// sia un tasto.
///
/// **Da dove si chiama.** Le porte sono le stesse di sempre:
///
///  - sulla **plancia**, i suoi tre trattini in alto a sinistra. Dentro Home
///    Assistant quel tasto apre la barra di chi la ospita; qui chi la ospita
///    e' l'app, e apre questo (`plancia/premesse.dart`);
///  - sulle **altre sezioni**, il ☰ nella barra del titolo, che e' dove lo
///    cerca chiunque abbia un telefono in mano.
///
/// E il **tasto indietro**, dappertutto: apre il menu, e col menu aperto esce
/// dall'app — le sezioni sono la pagina sotto, la sezione aperta e' la pagina
/// sopra, e indietro va sempre verso fuori (`home.dart`).
///
/// Si chiude in quattro modi: scegliendo una sezione, spingendolo verso
/// sinistra, toccando la striscia di pagina che resta scoperta, o lasciandolo
/// stare.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../parole.dart';
import '../plancia/pannello.dart';
import '../vestito/oggetti.dart';
import '../vestito/tema.dart';
import 'da_dove.dart';
import 'da_parte.dart';
import 'firma.dart';
import 'menu.dart';

/// Quanto resta aperto se non si tocca niente.
///
/// Piu' di prima (erano quattro secondi), perche' adesso e' una schermata e
/// non una striscia: quattordici mattonelle si guardano, e quattro secondi
/// sono il tempo di leggerne cinque. Ogni tocco fa ripartire il conto, e
/// mentre si scrive nella casella non corre affatto.
const _daSola = Duration(seconds: 7);

/// Quanto resta dopo che si e' scelto: il tempo di vedere che si e' premuto.
const _dopoLaScelta = Duration(milliseconds: 700);

/// Quanto si scurisce la pagina dietro il menu aperto.
///
/// Alto, perche' della pagina resta scoperta solo una striscia: o e' chiaro
/// che quella striscia e' «la pagina di sotto», o sembra un pezzo del menu.
const double _quantoVelo = 0.55;

/// Quanta pagina resta scoperta a destra del pannello.
///
/// Serve a due cose: dire che sotto c'e' ancora la propria casa — un menu che
/// prende tutto lo schermo e' una pagina nuova, e da una pagina nuova ci si
/// aspetta un «indietro» — e dare un posto dove toccare per richiudere che
/// non sia un tasto.
const double _strisciaDiPagina = 44;

/// Oltre quanto il pannello non si allarga piu'.
///
/// Su un telefono vince la striscia: il pannello si prende quello che resta.
/// Su un tablet o nel browser no — un menu largo mille punti sarebbe una
/// pagina, non un menu — e allora si ferma qui, e la pagina sotto si vede
/// tutta.
const double _quantoLargo = 430;

/// L'angolo tondo del fianco destro del pannello.
const double _angolo = 30;

/// Quanto e' alta una mattonella, fianco compreso.
const double _mattonella = 116;

/// Di quanto affonda una mattonella mentre la si preme.
///
/// ── Come ci si e' arrivati ───────────────────────────────────────────────
///
/// «Riesci a fare le card come se avessero un effetto 3d?» Il primo giro
/// disegnava un fianco di sei punti sotto la faccia. Poi: «i bordi troppo
/// scuri e doppi» — il fianco era un bordo, e sotto c'era l'ombra: due righe.
/// Ammorbidito. Poi: «riduci ancora, vedo 3 bordi», e li aveva contati
/// giusti. Sotto ogni mattonella c'erano **tre** salti di tono, uno sopra
/// l'altro:
///
///   1. il fondo della faccia, che una sfumatura scuriva del tre per cento;
///   2. il fianco, quattro punti piu' scuro ancora;
///   3. l'ombra sotto il fianco.
///
/// Ognuno era tenue. Tre tenui in fila fanno un bordo spesso.
///
/// ── Adesso ───────────────────────────────────────────────────────────────
///
/// **Uno solo**: un'ombra morbida. La faccia e' di tinta piena, senza
/// sfumature, e il fianco non c'e' piu'.
///
/// Il volume non l'hanno mai fatto i bordi: lo fa il **movimento**. Premuta,
/// la mattonella affonda di questi tre punti e l'ombra si stringe sotto di
/// lei — e' quello che fa un tasto vero quando lo si spinge, ed e' la cosa che
/// di solito manca. Un rilievo disegnato e fermo e' il disegno di un tasto;
/// un rilievo che si muove al dito e' un tasto.
const double _quantoScende = 3;

class BarraDelleSezioni extends StatefulWidget {
  const BarraDelleSezioni({
    super.key,
    required this.sezioni,
    required this.aperta,
    required this.vai,
    required this.vaiAlleCase,
    this.collegamento,
    this.sopraLaPlancia = false,
    this.daParte = const LaPlanciaDaParte(),
    this.daAggiornare = 0,
    this.tessera,
  });

  /// La tessera in testa: gdanav, vivo — l'auto della plancia, la batteria,
  /// Casa e Lavoro (`navigatore_qui/`). Quando c'e', la mattonella del
  /// navigatore non si ripete. Chi la mette chiama
  /// [BarraDelleSezioniState.sceltaFatta] quando la si tocca.
  final Widget? tessera;

  /* Quanti aggiornamenti aspettano di essere fatti.
   *
   * E' l'unico numero che compare sulle mattonelle, e c'e' per il motivo per
   * cui esiste quella sezione: in Home Assistant il pallino rosso degli
   * aggiornamenti sta in una pagina che chi usa l'app non apre piu', e una
   * sezione che si scopre solo entrandoci non risolve granche'. Il numero
   * addosso alla mattonella si vede aprendo il menu, che e' il gesto che si fa
   * comunque venti volte al giorno.
   *
   * Zero vuol dire niente da fare, e niente da fare vuol dire **niente
   * disegnato**: un bollino «0» e' un allarme che dice «tutto bene», e si
   * impara a non guardarlo. */
  final int daAggiornare;

  /// Le sezioni da mostrare, nell'ordine in cui vanno.
  final List<Sezione> sezioni;

  /// La casa in cui si e', per scriverla in testa: il nome, e da dove ci si
  /// sta passando. E' l'unico posto dell'app che lo dice mentre si guarda la
  /// plancia, che di suo non lo sa.
  final Collegamento? collegamento;

  /// Quella che si sta guardando: e' la mattonella accesa.
  final Sezione aperta;

  final void Function(Sezione dove) vai;
  final VoidCallback vaiAlleCase;

  /// Se sotto il menu c'e' la plancia.
  ///
  /// Nel browser cambia tutto. La plancia e' un `iframe`, e un `iframe` si
  /// mangia i tocchi di quello che gli sta sopra: a menu aperto le sue
  /// mattonelle si vedono e non si premono. Allora, mentre il menu lo copre,
  /// il riquadro si fa da parte. Dove sotto c'e' una pagina dell'app non c'e'
  /// niente da spostare: i tocchi le arrivano da se' — vedi `da_parte.dart`.
  final bool sopraLaPlancia;

  /// Chi sposta il riquadro perche' i tocchi arrivino al menu.
  /// Sostituibile nelle prove.
  final LaPlanciaDaParte daParte;

  @override
  State<BarraDelleSezioni> createState() => BarraDelleSezioniState();
}

class BarraDelleSezioniState extends State<BarraDelleSezioni>
    with SingleTickerProviderStateMixin {
  late final AnimationController _molla = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 340),
    reverseDuration: const Duration(milliseconds: 230),
  );
  Timer? _daChiudere;

  final _scorrimento = ScrollController();
  final _scritto = TextEditingController();
  final _fuoco = FocusNode();

  /// Se in questo momento il menu copre quello che c'e' sotto.
  bool _copre = false;

  bool get aperta => _molla.value > 0.02;

  /// Cosa si sta cercando, gia' in minuscolo.
  String get _cercato => _scritto.text.trim().toLowerCase();

  @override
  void initState() {
    super.initState();
    _molla.addListener(_seIlMenuCopre);
    /* Quello che si era scritto non si porta dietro: riaprendo il menu si
     * ricomincia da tutte le sezioni, non dalla ricerca di ieri. Si pulisce
     * **quando e' arrivato in fondo**, non appena si chiude: se no lo si
     * vedrebbe cambiare mentre scende. */
    _molla.addStatusListener((come) {
      if (come == AnimationStatus.dismissed && _scritto.text.isNotEmpty) {
        _scritto.clear();
      }
    });
    /* Mentre si scrive il conto alla rovescia non corre: si sta cercando, e
     * un menu che si chiude sotto la tastiera e' un menu rotto. */
    _fuoco.addListener(() {
      if (_fuoco.hasFocus) {
        _trattieni();
      } else {
        _lascia();
      }
    });
  }

  @override
  void dispose() {
    _daChiudere?.cancel();
    /* Il menu se ne va, e quello che aveva spostato si rimette a posto: se no
     * la plancia resta a non prendere tocchi. */
    if (_copre) widget.daParte.siFaDaParte(false);
    _molla.dispose();
    _scorrimento.dispose();
    _scritto.dispose();
    _fuoco.dispose();
    super.dispose();
  }

  void apri() {
    _molla.forward();
    _rimanda(_daSola);
    /* Si riapre sempre **dall'inizio**.
     *
     * L'elenco tiene il punto dove si era arrivati a scorrere — se lo scrive
     * da se', in `PageStorage` — e riaprendo il menu ci si ritrovava a meta',
     * con la casa e le prime sezioni gia' scivolate via. Chi apre il menu
     * vuole vedere la prima cosa, non l'ultima che aveva guardato. */
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scorrimento.hasClients) _scorrimento.jumpTo(0);
    });
  }

  void chiudi() {
    _daChiudere?.cancel();
    _fuoco.unfocus();
    _molla.reverse();
  }

  void _rimanda(Duration quanto) {
    _daChiudere?.cancel();
    _daChiudere = Timer(quanto, chiudi);
  }

  /// Si e' scelto qualcosa fuori dalle mattonelle (la tessera di gdanav): il
  /// menu si toglie di mezzo come dopo una sezione.
  void sceltaFatta() => _rimanda(_dopoLaScelta);

  /// I gruppi del menu, con le loro sezioni: prima la casa, poi le avanzate,
  /// e in fondo l'aiuto. Un gruppo senza sezioni non si scrive, e il
  /// navigatore non si ripete quando c'e' la sua tessera.
  ///
  /// Mentre si cerca i gruppi non ci sono: chi ha scritto tre lettere vuole
  /// vedere cosa risponde, non in che scatola sta.
  List<({GruppoDellaBarra titolo, List<Sezione> sezioni})> get _gruppi => [
    for (final gruppo in GruppoDellaBarra.values)
      if (_diQuesto(gruppo) case final sue when sue.isNotEmpty)
        (titolo: gruppo, sezioni: sue),
  ];

  List<Sezione> _diQuesto(GruppoDellaBarra gruppo) => [
    for (final una in _leSezioni)
      if (una.gruppo == gruppo) una,
  ];

  /// Le sezioni da mostrare adesso: tutte, o quelle che rispondono a quello
  /// che si sta cercando.
  List<Sezione> get _leSezioni => [
    for (final una in widget.sezioni)
      if (!(una == Sezione.navigatore && widget.tessera != null) &&
          (_cercato.isEmpty || una.titolo.toLowerCase().contains(_cercato)))
        una,
  ];

  void _scelta(Sezione dove) {
    sceltaFatta();
    /* Anche la sezione **gia' segnata**: se un tocco serve o no non lo decide
     * il menu.
     *
     * Segnata vuol dire «l'app crede di essere li'», e quel «crede» si puo'
     * perdere: dov'e' la plancia lo dice la plancia, e basta una ricarica in
     * mezzo perche' il menu resti segnato sulla Plancia mentre sotto c'e'
     * ancora la Configurazione. Toccare «Plancia» allora non faceva
     * **niente** — il tocco si fermava qui — e da fuori era un tasto rotto:
     * «se vanno in configurazione dal menu poi non mi torna in plancia».
     *
     * E si mangiava anche il tocco su «Plancia» stando sulla plancia, che e'
     * il gesto piu' vicino a tirare giu' per aggiornare: la ricarica c'era
     * scritta (`home.dart`) e non era mai partita. */
    widget.vai(dove);
  }

  /* Finche' lo si sta usando non se ne va. Il conto alla rovescia riparte a
   * ogni tocco: quando il dito si ferma, riprende a scorrere il tempo, non
   * prima. */
  void _laStaUsando() {
    if (_trattenuta) return;
    if (aperta) _rimanda(_daSola);
  }

  /* Un menu aperto sopra il menu lo trattiene — la tendina delle plance — e
   * cosi' la tastiera mentre si cerca.
   *
   * Senza, il foglio scivolerebbe via lasciando la tendina a mezz'aria:
   * nessun tocco arriva a lui mentre si legge un elenco che gli sta sopra, e
   * il conto alla rovescia non lo sa. */
  bool _trattenuta = false;

  void _trattieni() {
    _trattenuta = true;
    _daChiudere?.cancel();
  }

  void _lascia() {
    _trattenuta = false;
    if (aperta) _rimanda(_daSola);
  }

  /* Mentre il menu copre la plancia, il riquadro si fa da parte.
   *
   * Serve nel browser, dove la plancia e' un `iframe` e si mangia i tocchi di
   * tutto quello che gli sta sopra: senza questo le mattonelle si vedrebbero
   * e non si premerebbero, e toccare fuori non lo chiuderebbe
   * (`da_parte.dart`). Sul telefono non fa niente.
   *
   * Si guarda a ogni scatto dell'animazione e a ogni ridisegno. */
  void _seIlMenuCopre() {
    final copre = widget.sopraLaPlancia && _molla.value > 0.02;
    if (copre == _copre) return;
    _copre = copre;
    widget.daParte.siFaDaParte(copre);
  }

  /* Spingendolo giu' se ne va, e tirandolo su torna.
   *
   * Il foglio segue il dito punto per punto: e' il gesto che si fa a ogni
   * foglio che sale dal basso, su tutti e due i sistemi, e va seguito
   * davvero — un foglio che si muove a scatti o che aspetta la fine del
   * gesto per decidere sembra rotto. Lasciato sotto i tre quarti, o
   * lasciato andando giu' di corsa, si chiude; se no risale. */
  /// Quanto e' largo il pannello su questo schermo.
  ///
  /// Quello che resta togliendo la striscia di pagina, fino a [_quantoLargo].
  /// E' anche la misura su cui si conta la spinta: spingere di mezzo pannello
  /// deve valere mezzo pannello, non mezzo schermo.
  double _quantoLargoQui(BuildContext contesto) {
    final larghezza = MediaQuery.sizeOf(contesto).width;
    return (larghezza - _strisciaDiPagina).clamp(0.0, _quantoLargo);
  }

  void _spinto(DragUpdateDetails quanto) {
    final largo = _quantoLargoQui(context);
    if (largo <= 0) return;
    _daChiudere?.cancel();
    _molla.value = (_molla.value + quanto.primaryDelta! / largo).clamp(
      0.0,
      1.0,
    );
  }

  void _lasciato(DragEndDetails come) {
    if (_molla.value < 0.75 || come.velocity.pixelsPerSecond.dx < -700) {
      chiudi();
    } else {
      _molla.forward();
      _rimanda(_daSola);
    }
  }

  @override
  Widget build(BuildContext context) {
    _seIlMenuCopre();
    return AnimatedBuilder(
      animation: _molla,
      builder: (context, _) {
        /* Chiuso non si disegna affatto.
         *
         * Prima il menu stava nell'albero sempre, anche tutto fuori schermo:
         * quattordici mattonelle disegnate per niente sopra ogni pagina
         * dell'app, e — peggio — i nomi delle sezioni erano li' dentro anche
         * a menu chiuso. Chi cerca «Dispositivi» sulla pagina della plancia
         * lo trovava, e non c'era. */
        if (_molla.value <= 0) return const SizedBox.shrink();
        final quanto = Curves.easeOutCubic.transform(_molla.value.clamp(0, 1));
        return Stack(
          children: [
            /* Il velo, e il tocco fuori che chiude.
             *
             * Il velo prima non c'era: il menu si apriva e la pagina restava
             * accesa com'era, cosi' quello che ci passava sotto — i numeri
             * grossi delle tessere, una mappa — si leggeva insieme alle voci.
             * Un menu che copre e non scurisce non sembra un menu: sembra un
             * foglietto appoggiato. Prende i tocchi solo quando c'e': a menu
             * chiuso non deve rubare niente alla pagina. */
            if (aperta)
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: chiudi,
                  child: ColoredBox(
                    color: Colors.black.withValues(alpha: _quantoVelo * quanto),
                  ),
                ),
              ),
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: IgnorePointer(
                ignoring: !aperta,
                /* Scorre di tutta la sua larghezza: a zero e' fuori dal bordo
                 * sinistro, a uno e' al suo posto. */
                child: FractionalTranslation(
                  translation: Offset(quanto - 1, 0),
                  child: SizedBox(
                    width: _quantoLargoQui(context),
                    /* Il gesto sta qui e prende tutto il pannello, come in
                     * qualunque cassetto: si spinge verso sinistra da dove
                     * capita, e non solo da una maniglia che bisogna trovare.
                     * Orizzontale, quindi non litiga con l'elenco che scorre
                     * in verticale. */
                    child: GestureDetector(
                      onHorizontalDragUpdate: _spinto,
                      onHorizontalDragEnd: _lasciato,
                      child: Listener(
                        onPointerDown: (_) => _laStaUsando(),
                        onPointerMove: (_) => _laStaUsando(),
                        onPointerUp: (_) => _laStaUsando(),
                        onPointerSignal: (_) => _laStaUsando(),
                        child: _IlFoglio(child: _dentro(context)),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _dentro(BuildContext context) {
    final bordi = MediaQuery.paddingOf(context);
    final trovate = _leSezioni;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        /* Il pannello e' alto quanto lo schermo, orologio e tacca compresi:
         * quello che ha dentro comincia sotto. */
        SizedBox(height: bordi.top + 8),
        if (widget.collegamento case final c?)
          _LaCasaInTesta(collegamento: c, quandoPremuta: widget.vaiAlleCase),
        _Cerca(
          scritto: _scritto,
          fuoco: _fuoco,
          riscrivi: () => setState(() {}),
        ),
        Flexible(
          child: ListView(
            controller: _scorrimento,
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
            children: [
              if (widget.tessera case final t?) ...[
                if (_cercato.isEmpty) ...[t, const SizedBox(height: 14)],
              ],
              if (trovate.isEmpty)
                _NienteCosi(cercato: _scritto.text.trim())
              else if (_cercato.isNotEmpty)
                _LeMattonelle(
                  sezioni: trovate,
                  aperta: widget.aperta,
                  scegli: _scelta,
                  daAggiornare: widget.daAggiornare,
                  collegamento: widget.collegamento,
                  trattieni: _trattieni,
                  lascia: _lascia,
                )
              else
                for (final (i, gruppo) in _gruppi.indexed) ...[
                  if (i > 0) const SizedBox(height: 16),
                  _TitoloDelGruppo(gruppo.titolo.titolo),
                  _LeMattonelle(
                    sezioni: gruppo.sezioni,
                    aperta: widget.aperta,
                    scegli: _scelta,
                    daAggiornare: widget.daAggiornare,
                    collegamento: widget.collegamento,
                    trattieni: _trattieni,
                    lascia: _lascia,
                  ),
                ],
            ],
          ),
        ),
        /* Che versione e', **fissa** in fondo e fuori dall'elenco.
         *
         * «Io non so che versione app ho» e' arrivato da chi le pubblica, con
         * la versione gia' scritta in fondo a «Le case» e nella diagnostica:
         * un'informazione che c'e' e non si trova vale come una che non c'e'.
         * In coda all'elenco si vedeva solo scorrendo fino in fondo — e in
         * una casa piena l'elenco arriva al tetto e scorre davvero. Qui si
         * legge sempre, che e' il motivo per cui e' nel menu. */
        Padding(
          padding: EdgeInsets.fromLTRB(14, 2, 14, bordi.bottom + 12),
          child: const Firma(spazioSopra: 0, conIlCentralino: false),
        ),
      ],
    );
  }
}

/// Il pannello: fondo pieno, tondo sul fianco destro, con la sua maniglia.
///
/// **Pieno**, non smerigliato. Un vetro trasparente sopra una pagina di schede
/// lascia leggere quello che c'e' sotto, e allora non sembra un menu: sembra
/// una velatura, e le voci si leggono male — segnalato con la foto. Quello che
/// passa sotto lo copre il velo, che e' il posto giusto per dirlo.
///
/// L'ombra cade **verso destra**, da dove entra il pannello: e' quella che lo
/// stacca dalla pagina e gli da' uno spessore, come alle mattonelle che ha
/// dentro.
class _IlFoglio extends StatelessWidget {
  const _IlFoglio({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final scuro = Theme.of(context).brightness == Brightness.dark;
    const tondo = BorderRadius.horizontal(right: Radius.circular(_angolo));
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colori.surface,
        borderRadius: tondo,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: scuro ? 0.6 : 0.26),
            blurRadius: 34,
            offset: const Offset(6, 0),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: tondo,
        child: Stack(
          children: [
            child,
            /* La maniglia sta sul fianco da cui si spinge, a meta' altezza:
               e' dove sta il pollice di chi tiene il telefono, ed e' l'unico
               punto del pannello che non e' ne' un nome ne' un disegno. */
            const Positioned(right: 0, top: 0, bottom: 0, child: _Maniglia()),
          ],
        ),
      ),
    );
  }
}

/// La barretta sul fianco: dice «questo si spinge di lato» senza scriverlo.
class _Maniglia extends StatelessWidget {
  const _Maniglia();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.only(right: 7),
          child: Container(
            width: 5,
            height: 46,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.onSurface
                  .withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ),
      ),
    );
  }
}

/// In testa al menu: la casa in cui si e', e da dove ci si sta passando.
///
/// Si tocca il tondo a destra per passare a un'altra casa. E' qui e non sulla
/// plancia perche' la plancia e' una pagina web che di case ne conosce una
/// sola, la sua: il nome che scrive in testata e' quello di Home Assistant, e
/// «in casa» o «da fuori» non lo puo' sapere.
///
/// Il nome e' grande perche' adesso c'e' il posto: nella striscia stava in
/// dodici punti schiacciato contro il bordo, e su una schermata larga la prima
/// cosa che si legge deve essere **dove si e'**.
class _LaCasaInTesta extends StatelessWidget {
  const _LaCasaInTesta({
    required this.collegamento,
    required this.quandoPremuta,
  });

  final Collegamento collegamento;
  final VoidCallback quandoPremuta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 6, 14, 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  collegamento.casa?.nome ?? inLingua(it: 'Casa', en: 'Home'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: testi.headlineSmall?.copyWith(
                    fontSize: 25,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.6,
                  ),
                ),
                const SizedBox(height: 4),
                DaDoveSiPassa(collegamento, piccolo: true),
              ],
            ),
          ),
          /* Il nome per chi non la vede — e per le prove — sta nel
           * suggerimento: il tondo non ha scritte, e il verso del segno e'
           * quello che fa, cioe' portare **via** da questa casa. */
          Tooltip(
            message: nomeDelleCase,
            child: Material(
              color: colori.onSurface.withValues(alpha: 0.06),
              shape: const CircleBorder(),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: quandoPremuta,
                child: SizedBox(
                  width: 44,
                  height: 44,
                  child: Icon(
                    Icons.swap_horiz_rounded,
                    size: 22,
                    color: colori.onSurface.withValues(alpha: 0.75),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// La casella per cercare una sezione.
///
/// E' la cosa che la striscia non poteva avere, ed e' quella che cambia il
/// menu piu' di tutte: con quattordici sezioni — e domani venti — tre lettere
/// arrivano prima di qualunque elenco. Non si apre da sola la tastiera: il
/// menu si apre venti volte al giorno e quasi sempre per toccare la seconda
/// mattonella, e una tastiera che salta su ogni volta sarebbe una tassa.
class _Cerca extends StatelessWidget {
  const _Cerca({
    required this.scritto,
    required this.fuoco,
    required this.riscrivi,
  });

  final TextEditingController scritto;
  final FocusNode fuoco;
  final VoidCallback riscrivi;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
      child: TextField(
        controller: scritto,
        focusNode: fuoco,
        onChanged: (_) => riscrivi(),
        textInputAction: TextInputAction.search,
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(vertical: 13),
          hintText: inLingua(it: 'Cerca una sezione', en: 'Search a section'),
          prefixIcon: Icon(
            Icons.search_rounded,
            size: 20,
            color: colori.onSurfaceVariant,
          ),
          suffixIcon: scritto.text.isEmpty
              ? null
              : IconButton(
                  icon: const Icon(Icons.close_rounded, size: 18),
                  onPressed: () {
                    scritto.clear();
                    riscrivi();
                  },
                ),
          filled: true,
          fillColor: colori.onSurface.withValues(alpha: 0.05),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: colori.primary, width: 1.4),
          ),
        ),
      ),
    );
  }
}

/// Quando quello che si cerca non c'e'.
///
/// Si dice cosa si e' cercato, non «nessun risultato»: chi legge deve poter
/// vedere il refuso senza tornare nella casella.
class _NienteCosi extends StatelessWidget {
  const _NienteCosi({required this.cercato});

  final String cercato;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          Icon(
            Icons.search_off_rounded,
            size: 34,
            color: colori.onSurfaceVariant,
          ),
          const SizedBox(height: 12),
          Text(
            inLingua(
              it: 'Nessuna sezione si chiama «$cercato»',
              en: 'No section is called "$cercato"',
            ),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: colori.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

/// Le sezioni in mattonelle, tre per riga.
class _LeMattonelle extends StatelessWidget {
  const _LeMattonelle({
    required this.sezioni,
    required this.aperta,
    required this.scegli,
    required this.daAggiornare,
    required this.collegamento,
    required this.trattieni,
    required this.lascia,
  });

  final List<Sezione> sezioni;
  final Sezione aperta;
  final void Function(Sezione) scegli;
  final int daAggiornare;

  /// Da dove si leggono le plance: con piu' d'una, la mattonella della
  /// plancia porta anche quale si sta guardando e il modo di cambiarla.
  final Collegamento? collegamento;
  final VoidCallback trattieni;
  final VoidCallback lascia;

  @override
  Widget build(BuildContext context) {
    final collegamento = this.collegamento;
    final piuDiUna = collegamento?.pannello?.piuDiUna ?? false;
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      itemCount: sezioni.length,
      /* **Due per riga**, non tre. Tre stavano nella schermata che prendeva
         tutto lo schermo; qui la larghezza e' quella del pannello, e a tre un
         nome come «Gestione installatore» tornerebbe a essere un francobollo.
         A due ci sta intero, e il rilievo si vede. */
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        mainAxisExtent: _mattonella,
      ),
      itemBuilder: (context, i) {
        final sezione = sezioni[i];
        return _Mattonella(
          sezione: sezione,
          scelta: sezione == aperta,
          quanti: sezione == Sezione.aggiornamenti ? daAggiornare : 0,
          premuta: () => scegli(sezione),
          plance: sezione == Sezione.plancia && piuDiUna ? collegamento : null,
          trattieni: trattieni,
          lascia: lascia,
        );
      },
    );
  }
}

/// Una sezione: il disegno grande, il nome sotto, e sotto ancora il suo fianco.
///
/// ## Il rilievo
///
/// «Riesci a fare le card come se avessero un effetto 3d?»
///
/// Non un'ombra portata e basta — quella la mette chiunque e si legge come
/// «una carta su un foglio». Qui la mattonella e' un **oggetto spesso**:
///
///  - un **fianco** [_spessore] punti sotto la faccia, dello stesso colore ma
///    scurito. E' lui a fare il volume: senza, un'ombra e' un disegno;
///  - una **faccia** con la luce che le arriva da sopra a sinistra, cioe' una
///    sfumatura dal chiaro allo scuro e un filo piu' chiaro sul bordo alto;
///  - un'**ombra** appoggiata sotto il fianco, non sotto la faccia;
///  - e premendo, la faccia **scende sul fianco** e l'ombra si stringe: e'
///    quello che fa un tasto vero quando lo si spinge, ed e' la meta' che di
///    solito manca. Un rilievo che non si muove al tocco e' un disegno di un
///    tasto.
///
/// Scurito e schiarito si calcolano dalla faccia ([_piuScuro], [_piuChiaro]),
/// non scritti a mano: cosi' la stessa regola vale sul chiaro e sullo scuro,
/// sulla mattonella scelta e su quelle spente, e nessuno deve tenere allineate
/// quattro tavolozze.
///
/// **I nomi non sono in maiuscolo.** Erano tutti in maiuscolo e rimpiccioliti
/// quanto bastava a entrare nella striscia: «CONFIGURAZIONE» usciva piu'
/// piccolo di «PLANCIA», e una colonna di nomi di corpo diverso non e' una
/// scala, e' disordine. Qui il posto c'e', e le maiuscole restano dove
/// servono: sui titoli dei gruppi, che non si leggono, si contano.
class _Mattonella extends StatefulWidget {
  const _Mattonella({
    required this.sezione,
    required this.scelta,
    required this.quanti,
    required this.premuta,
    required this.plance,
    required this.trattieni,
    required this.lascia,
  });

  final Sezione sezione;
  final bool scelta;
  final int quanti;
  final VoidCallback premuta;

  /// Non nullo solo sulla plancia, e solo dove le plance sono piu' d'una: in
  /// quel caso la mattonella porta sotto il nome di quella che si guarda, e
  /// in alto a destra il tasto per cambiarla.
  final Collegamento? plance;
  final VoidCallback trattieni;
  final VoidCallback lascia;

  @override
  State<_Mattonella> createState() => _StatoDellaMattonella();
}

class _StatoDellaMattonella extends State<_Mattonella> {
  /* Se il dito e' giu' adesso. E' tutto lo stato che serve al rilievo: la
   * faccia sta su o sta giu'. */
  bool _giu = false;

  void _spingi(bool quanto) {
    if (_giu == quanto) return;
    setState(() => _giu = quanto);
  }

  @override
  Widget build(BuildContext context) {
    final sezione = widget.sezione;
    final scelta = widget.scelta;
    final colori = Theme.of(context).colorScheme;
    final scuro = Theme.of(context).brightness == Brightness.dark;

    /* La scelta e' l'inverso della pagina: scura sul chiaro, chiara sullo
     * scuro. Cosi' salta all'occhio in tutti e due i vestiti senza scegliere
     * un colore che in uno dei due stona.
     *
     * Le altre sono **piu' chiare del pannello**, non piu' scure. Un primo
     * giro le aveva fatte con un velo scuro sopra il fondo: il fianco si
     * vedeva, ma la faccia era grigia come il pannello e le mattonelle
     * sembravano fantasmi. Un oggetto che si alza prende piu' luce di quello
     * su cui appoggia, non meno.
     *
     * **Tinta piena**, e non un velo: da un velo non si ricava un fianco piu'
     * scuro — verrebbe fuori il fondo del pannello — e senza fianco non c'e'
     * nessun rilievo. */
    /* **Tinta piena, senza sfumature.** La faccia aveva una sfumatura appena
     * accennata che finiva piu' scura del tre per cento: sul fondo della
     * mattonella faceva una riga, e sommata al fianco e all'ombra erano i tre
     * bordi che si contavano. Un colore solo non ne fa nessuno. */
    final faccia = scelta ? colori.onSurface : colori.surfaceContainerLowest;
    final scritta = scelta
        ? colori.surface
        : colori.onSurface.withValues(alpha: sezione.pronta ? 0.9 : 0.32);

    final tondo = BorderRadius.circular(22);
    final puo = sezione.pronta;
    /* Quella che non si puo' ancora aprire non si alza da terra: niente ombra
     * e niente movimento. Il volume dice «questo si preme», e dirlo di una che
     * non si preme sarebbe una bugia in rilievo. */
    final scesa = puo && _giu ? _quantoScende : 0.0;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: puo ? (_) => _spingi(true) : null,
      onTapUp: puo ? (_) => _spingi(false) : null,
      onTapCancel: puo ? () => _spingi(false) : null,
      onTap: puo ? widget.premuta : null,
      /* Tutta la mattonella affonda insieme, ombra compresa, e ci mette quanto
       * ci mette un tasto: ottanta millesimi. Piu' lento sembrerebbe
       * un'animazione, e un tasto non si anima. */
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 80),
        curve: Curves.easeOut,
        transform: Matrix4.translationValues(0, scesa, 0),
        decoration: BoxDecoration(
          color: faccia,
          borderRadius: tondo,
          /* **Una sola ombra, e morbida.** E' l'aria sotto la mattonella, non
           * una riga che la contorna: e' l'unico salto di tono che c'e' sotto
           * di lei, ed e' per questo che non se ne contano tre. Premuta si
           * stringe e si alza. */
          boxShadow: puo
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: scuro ? 0.30 : 0.07),
                    blurRadius: _giu ? 4 : 14,
                    offset: Offset(0, _giu ? 1 : 4),
                  ),
                ]
              : null,
        ),
        child: _laFaccia(context, scritta: scritta, colori: colori),
      ),
    );
  }

  Widget _laFaccia(
    BuildContext context, {
    required Color scritta,
    required ColorScheme colori,
  }) {
    final sezione = widget.sezione;
    final scelta = widget.scelta;
    return Stack(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 12, 8, 10),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              /* Il disegno della sezione, lo stesso della plancia. Quella
               * che non si sta guardando lo tiene smorzato: il colore e'
               * l'unica cosa che dice «sei qui», e se ce l'hanno tutte non
               * lo dice nessuna. */
              Oggetto(
                sezione.disegno,
                lato: 34,
                quantoSpento: scelta ? 0 : 0.25,
                velo: sezione.pronta ? 1 : 0.45,
              ),
              const SizedBox(height: 10),
              Text(
                sezione.titolo,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.1,
                  color: scritta,
                ),
              ),
              if (widget.plance case final c?) ...[
                const SizedBox(height: 2),
                Text(
                  _quale(c).titolo,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10.5,
                    height: 1.1,
                    fontWeight: FontWeight.w600,
                    color: scelta
                        ? colori.surface.withValues(alpha: 0.7)
                        : colori.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (widget.quanti > 0)
          Positioned(top: 8, right: 8, child: _Quanti(widget.quanti)),
        if (widget.plance case final c?)
          Positioned(
            top: 4,
            right: 4,
            child: _QualePlancia(
              collegamento: c,
              colore: scritta,
              trattieni: widget.trattieni,
              lascia: widget.lascia,
              apri: widget.premuta,
            ),
          ),
      ],
    );
  }

  static UnaPlancia _quale(Collegamento c) {
    final trovate = c.plance.where((una) => una.profilo == c.planciaScelta);
    return trovate.isEmpty ? c.plance.first : trovate.first;
  }
}

/// Il tasto in alto a destra della mattonella della plancia: quale plancia.
///
/// Nella dashboard le plance sono voci di Home Assistant, e si scelgono dalla
/// sua barra laterale. Nell'app non c'e' nessuna barra laterale di Home
/// Assistant: la scelta sta sulla mattonella della plancia, dove la si cerca.
///
/// Una tendina e non delle mattonelle: le plance sono al massimo otto, e otto
/// mattonelle in cima al menu mangerebbero il posto delle sezioni.
class _QualePlancia extends StatelessWidget {
  const _QualePlancia({
    required this.collegamento,
    required this.colore,
    required this.trattieni,
    required this.lascia,
    required this.apri,
  });

  final Collegamento collegamento;
  final Color colore;

  /// Il menu si chiude da solo dopo qualche secondo, e mentre si legge una
  /// tendina che gli sta sopra non gli arriva nessun tocco: lo si trattiene
  /// finche' la tendina e' aperta, e lo si lascia quando si chiude.
  final VoidCallback trattieni;
  final VoidCallback lascia;

  /// Aprire la plancia, dopo averne scelta un'altra.
  final VoidCallback apri;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final plance = collegamento.plance;
    final trovate = plance.where(
      (una) => una.profilo == collegamento.planciaScelta,
    );
    final quale = trovate.isEmpty ? plance.first : trovate.first;
    return PopupMenuButton<String>(
      tooltip: inLingua(it: 'Quale plancia', en: 'Which dashboard'),
      position: PopupMenuPosition.under,
      padding: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      onOpened: trattieni,
      onCanceled: lascia,
      onSelected: (profilo) {
        lascia();
        unawaited(collegamento.cambiaPlancia(profilo));
        apri();
      },
      itemBuilder: (context) => [
        PopupMenuItem<String>(
          enabled: false,
          height: 32,
          child: Text(
            inLingua(
              it: 'PLANCE DI QUESTA CASA',
              en: 'DASHBOARDS IN THIS HOME',
            ),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
              color: colori.onSurfaceVariant,
            ),
          ),
        ),
        for (final una in plance)
          PopupMenuItem<String>(
            value: una.profilo,
            child: Row(
              children: [
                Icon(
                  una.profilo == quale.profilo
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_unchecked_rounded,
                  size: 18,
                  color: una.profilo == quale.profilo
                      ? colori.primary
                      : colori.onSurfaceVariant,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    una.titolo,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontWeight: una.profilo == quale.profilo
                          ? FontWeight.w700
                          : FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
      child: SizedBox(
        width: 30,
        height: 30,
        child: Icon(Icons.unfold_more_rounded, size: 17, color: colore),
      ),
    );
  }
}

/// Il titolo di un gruppo: minuto, spaziato, grigio. Dice dove si e', non
/// chiede di essere letto.
class _TitoloDelGruppo extends StatelessWidget {
  const _TitoloDelGruppo(this.testo);

  final String testo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 0, 4, 9),
      child: Text(
        testo.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          height: 1,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.4,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

/// Il numero addosso a una sezione: quante cose ci aspettano dentro.
///
/// Ambra e non rosso: un aggiornamento non e' un guasto, e' una cosa da fare
/// con calma. Il rosso, in questa casa, vuol dire «vai a vedere adesso», e
/// speso qui non vorrebbe piu' dire niente quando servira' davvero.
///
/// Oltre il nove diventa «9+»: tre cifre dentro una pastiglia da venti punti
/// non si leggono, e la differenza fra dodici e quattordici aggiornamenti non
/// cambia quello che si fa.
class _Quanti extends StatelessWidget {
  const _Quanti(this.quanti);

  final int quanti;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 21),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colori.ambraScura,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        quanti > 9 ? '9+' : '$quanti',
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 11,
          height: 1.2,
          fontWeight: FontWeight.w800,
          color: Colors.white,
        ),
      ),
    );
  }
}

/// Le sezioni del menu: la plancia, i dispositivi, e quello che verra'.
///
/// Tutte tranne una. La **Console** — la coda delle richieste di aiuto di
/// tutte le case — la vede solo chi risponde, cioe' la casa che nelle opzioni
/// del ponte ha la chiave della console. In tutte le altre quella voce non c'e'
/// proprio: una porta che non si apre e' peggio di una porta che non c'e'.
/// E lo stesso vale per **Cruscotto** — gli impianti che ha montato chi
/// installa, che compare solo dove le opzioni del ponte hanno acceso
/// `installatore`, cioe' sul suo Home Assistant e non in casa di un cliente —
/// e per **Gestione**, che compare in una casa sola al mondo: quella che nelle
/// opzioni ha la chiave della gestione. E **Zigbee**, che compare solo dove
/// una rete Zigbee c'e' davvero: in una casa senza ZHA e senza Zigbee2MQTT
/// quella voce aprirebbe una schermata che non puo' fare niente.
///
/// E poi c'e' un taglio di un altro tipo: **Navigatore, Zigbee, Aiutanti e
/// Automazioni non ci sono affatto nella webapp**. Sono cose che vogliono il
/// telefono — aprire una rete Zigbee si fa in piedi davanti al dispositivo,
/// e si guida col GPS e la voce del telefono — e nel
/// browser sarebbero porte che si aprono su meta' di quello che promettono.
/// Lo dichiara la sezione stessa (`soloNellApp`), cosi' aggiungerne una
/// domani vuol dire una parola nel suo elenco e non una riga qui.
/// (Nella barra laterale di Home Assistant la stessa voce si chiama «Cruscotto
/// installatore»: li' sta in mezzo ai pannelli di chiunque, e il nome deve
/// dire di chi e'. Qui no, perche' qui ci si e' gia' dentro.)
List<Sezione> vociDellaBarra({
  bool conLaConsole = false,
  bool conIlCruscotto = false,
  bool conLaGestione = false,
  bool conZigbee = false,
  bool nellApp = true,
}) => [
  for (final una in Sezione.values)
    if ((una != Sezione.console || conLaConsole) &&
        (una != Sezione.cruscotto || conIlCruscotto) &&
        (una != Sezione.gestione || conLaGestione) &&
        (una != Sezione.zigbee || conZigbee) &&
        (nellApp || !una.soloNellApp))
      una,
];

/// Come si chiama il tasto che apre il menu: il ☰ nella barra del titolo.
/// Il lettore di schermo lo legge cosi', e le prove lo cercano con questo
/// nome.
///
/// Non «Sezioni» e basta: quella parola sta anche nell'intestazione dei widget
/// — «22 sezioni · 2 chiedono attenzione» — e chi cerca per testo finirebbe a
/// premere quella riga. Un nome deve essere di una cosa sola.
String get nomeDelTastoDellaBarra =>
    inLingua(it: 'Barra delle sezioni', en: 'Sections bar');

/// Come si chiama, per chi non lo vede, il tondo in testa al menu che porta
/// all'elenco delle case.
String get nomeDelleCase => inLingua(it: 'Le tue case', en: 'Your homes');

/// Quanto lasciare a sinistra al contenuto, su questo schermo.
///
/// **Niente, dappertutto.** Il menu non sta piu' di lato e non resta aperto da
/// nessuna parte: sale dal basso quando lo si chiama e se ne va. Resta qui
/// perche' la pagina la chiede, e perche' il giorno in cui su uno schermo
/// largo il menu tornasse a stare fermo da qualche parte, il posto dove
/// dirlo e' questo.
double quantoPerLaBarra(BuildContext contesto) => 0;
