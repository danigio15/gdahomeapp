/// La barra delle sezioni: laterale, a scomparsa.
///
/// Sta fuori dallo schermo, oltre il bordo sinistro, e non si vede finche' non
/// la si chiama. Non e' un vezzo: una barra sempre presente si mangia una
/// fascia di schermo su ogni pagina, e su un telefono quella fascia e' l'unica
/// cosa che non si puo' comprare. Cosi' invece la si vede quando serve e
/// sparisce da sola quando non serve piu'.
///
/// **Da dove si chiama.** Da nessun gesto e da nessuna pillola disegnata
/// sopra la pagina: quelli li aveva, ed erano sul bordo sinistro dello
/// schermo, dove la Configurazione della plancia ha le sue sezioni — si
/// toccava una sezione e si apriva il menu. Adesso le porte sono due, e sono
/// due porte che c'erano gia':
///
///  - sulla **plancia**, i suoi tre trattini in alto a sinistra. Dentro Home
///    Assistant quel tasto apre la barra di chi la ospita; qui chi la ospita
///    e' l'app, e apre questa (`plancia/premesse.dart`);
///  - sulle **altre sezioni**, il ☰ nella barra del titolo, che e' dove lo
///    cerca chiunque abbia un telefono in mano.
///
/// E il **tasto indietro**, dappertutto: apre la barra, e con la barra aperta
/// esce dall'app — le sezioni sono la pagina sotto, la sezione aperta e' la
/// pagina sopra, e indietro va sempre verso fuori (`home.dart`).
///
/// Sta di lato e non in fondo perche' le sezioni sono venti: in orizzontale se
/// ne vedono cinque per volta e per arrivare all'ultima si scorre al buio, in
/// verticale se ne vedono dodici col nome intero accanto al disegno. E il
/// pollice, su un telefono tenuto in mano, il bordo sinistro ce l'ha sotto.
///
/// La forma e' quella della plancia: vetro smerigliato, angoli tondi, il
/// disegno della sezione — lo stesso disegno, non uno che gli somiglia — e la
/// voce scelta come pastiglia scura. Chi passa dal telefono alla dashboard non
/// deve reimparare dove si va.
///
/// Si chiude da sola in tre modi, gli stessi dappertutto: scegliendo una
/// sezione, toccando fuori, o lasciandola stare.
///
/// **Dove lo schermo avanza, non si nasconde affatto.** Nascondersi e' la
/// scelta giusta dove la fascia di schermo e' l'unica cosa che non si puo'
/// comprare; su un computer, o su un tablet di lato, e' un gesto in piu' per
/// ogni cambio di pagina e non serve a niente. Sopra i novecento punti la
/// barra resta, il ☰ sparisce, e toccare fuori non la chiude piu'
/// — vedi `vestito/quanto_e_largo.dart`.
library;

import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../parole.dart';
import '../vestito/oggetti.dart';
import '../vestito/quanto_e_largo.dart';
import '../vestito/tema.dart';
import 'da_dove.dart';
import 'da_parte.dart';
import 'firma.dart';
import 'menu.dart';

/// Quanto resta aperta se non si tocca niente.
const _daSola = Duration(seconds: 4);

/// Quanto resta dopo che si e' scelto: il tempo di vedere che si e' premuto.
const _dopoLaScelta = Duration(milliseconds: 700);

/// Quanto e' larga la barra, e quanto sta indietro quando e' fuori.
const double _larghezzaDellaBarra = 192;
const double _fuori = _larghezzaDellaBarra + 24;

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
  });

  /* Quanti aggiornamenti aspettano di essere fatti.
   *
   * E' l'unico numero che compare sulle voci, e c'e' per il motivo per cui
   * esiste quella sezione: in Home Assistant il pallino rosso degli
   * aggiornamenti sta in una pagina che chi usa l'app non apre piu', e una
   * sezione che si scopre solo entrandoci non risolve granche'. Il numero
   * addosso alla voce si vede aprendo il menu, che e' il gesto che si fa
   * comunque venti volte al giorno.
   *
   * Zero vuol dire niente da fare, e niente da fare vuol dire **niente
   * disegnato**: un bollino «0» e' un allarme che dice «tutto bene», e si
   * impara a non guardarlo. */
  final int daAggiornare;

  /// Le sezioni da mostrare, nell'ordine in cui vanno.
  final List<Sezione> sezioni;

  /// La casa in cui si e', per scriverla in cima alla barra: il nome, e da
  /// dove ci si sta passando. E' l'unico posto dell'app che lo dice mentre
  /// si guarda la plancia, che di suo non lo sa.
  final Collegamento? collegamento;

  /// Quella che si sta guardando: e' la pastiglia accesa.
  final Sezione aperta;

  final void Function(Sezione dove) vai;
  final VoidCallback vaiAlleCase;

  /// Se sotto la barra c'e' la plancia.
  ///
  /// Nel browser cambia tutto. La plancia e' un `iframe`, e un `iframe` si
  /// mangia i tocchi di quello che gli sta sopra: a barra aperta le sue voci
  /// si vedono e non si premono. Allora, mentre la barra lo copre, il riquadro
  /// si fa da parte. Dove sotto la barra c'e' una pagina dell'app non c'e'
  /// niente da spostare: i tocchi le arrivano da se' — vedi `da_parte.dart`.
  final bool sopraLaPlancia;

  /// Chi sposta il riquadro perche' i tocchi arrivino alla barra.
  /// Sostituibile nelle prove.
  final LaPlanciaDaParte daParte;

  @override
  State<BarraDelleSezioni> createState() => BarraDelleSezioniState();
}

class BarraDelleSezioniState extends State<BarraDelleSezioni>
    with SingleTickerProviderStateMixin {
  late final AnimationController _molla = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 380),
    reverseDuration: const Duration(milliseconds: 260),
  );
  Timer? _daChiudere;

  /* La barra si apre sulla voce scelta: con quindici sezioni, quella che si
   * sta guardando puo' stare fuori vista, e una barra che si apre sempre
   * dall'inizio obbliga a scorrerla ogni volta. */
  final _scorrimento = ScrollController();

  /// Se qui la barra resta invece di nascondersi.
  bool _resta = false;

  /// Se in questo momento la barra copre quello che c'e' sotto.
  bool _copre = false;

  bool get aperta => _resta || _molla.value > 0.02;

  @override
  void initState() {
    super.initState();
    _molla.addListener(_seLaBarraCopre);
  }

  @override
  void dispose() {
    _daChiudere?.cancel();
    /* La barra se ne va, e quello che aveva spostato si rimette a posto: se no
     * la plancia resta a non prendere tocchi. */
    if (_copre) widget.daParte.siFaDaParte(false);
    _molla.dispose();
    _scorrimento.dispose();
    super.dispose();
  }

  void apri() {
    _molla.forward();
    _rimanda(_daSola);
    /* Dopo il primo fotogramma, quando le misure ci sono. */
    WidgetsBinding.instance.addPostFrameCallback((_) => _portaSullaScelta());
  }

  void chiudi() {
    _daChiudere?.cancel();
    _molla.reverse();
  }

  void _rimanda(Duration quanto) {
    _daChiudere?.cancel();
    _daChiudere = Timer(quanto, chiudi);
  }

  void _portaSullaScelta() {
    if (!_scorrimento.hasClients) return;
    final dove = widget.sezioni.indexOf(widget.aperta);
    if (dove < 0) return;
    const passo = _Voce.altezza + _Voce.spazio;
    final schermo = MediaQuery.sizeOf(context).height;
    final meta = (dove * passo) - (schermo / 2) + (passo / 2);
    _scorrimento.jumpTo(meta.clamp(0, _scorrimento.position.maxScrollExtent));
  }

  void _scelta(Sezione dove) {
    if (!_resta) _rimanda(_dopoLaScelta);
    /* Anche la voce **gia' segnata**: se un tocco serve o no non lo decide la
     * barra.
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

  /* Finche' la si sta usando non se ne va. Scorrere quindici voci per trovare
   * la propria non si fa in quattro secondi, e una barra che sparisce sotto il
   * dito mentre la si scorre e' peggio di una barra che resta. Il conto alla
   * rovescia riparte a ogni tocco: quando il dito si ferma, riprende a
   * scorrere il tempo, non prima. */
  void _laStaUsando() {
    if (_trattenuta) return;
    if (aperta && !_resta) _rimanda(_daSola);
  }

  /* Un menu aperto sopra la barra la trattiene.
   *
   * Senza, la barra scivolerebbe via dopo quattro secondi lasciando il menu a
   * mezz'aria: nessun tocco arriva a lei mentre si legge un elenco che le sta
   * sopra, e il conto alla rovescia non lo sa. */
  bool _trattenuta = false;

  void _trattieni() {
    _trattenuta = true;
    _daChiudere?.cancel();
  }

  void _lascia() {
    _trattenuta = false;
    if (aperta && !_resta) _rimanda(_daSola);
  }

  /* Mentre la barra copre la plancia, il riquadro si fa da parte.
   *
   * Serve nel browser, dove la plancia e' un `iframe` e si mangia i tocchi di
   * tutto quello che gli sta sopra: senza questo le voci della barra si
   * vedrebbero e non si premerebbero, e toccare fuori non la chiuderebbe
   * (`da_parte.dart`). Sul telefono non fa niente.
   *
   * Dove la barra **resta** non copre niente — il posto glielo si lascia per
   * davvero, e la plancia comincia dopo — e allora non si sposta nessuno. E
   * dove sotto non c'e' la plancia non c'e' niente da spostare: le pagine
   * dell'app le disegna l'app, e i tocchi le arrivano da se'.
   *
   * Si guarda a ogni scatto dell'animazione e a ogni ridisegno: il primo e' la
   * barra che si apre e si chiude, il secondo la finestra che si rimpicciolisce
   * mentre la barra e' aperta. */
  void _seLaBarraCopre() {
    final copre = !_resta && widget.sopraLaPlancia && _molla.value > 0.02;
    if (copre == _copre) return;
    _copre = copre;
    widget.daParte.siFaDaParte(copre);
  }

  @override
  Widget build(BuildContext context) {
    final alto = MediaQuery.paddingOf(context).top;
    final basso = MediaQuery.paddingOf(context).bottom;
    /* Si guarda a ogni ridisegno, non una volta all'avvio: su un computer la
     * finestra si rimpicciolisce di continuo, e una barra che resta larga
     * quanto mezza finestra stretta e' peggio di una che si nasconde. */
    _resta = QuantoELargo.di(context).laBarraResta;
    if (_resta && _molla.value != 1) {
      _daChiudere?.cancel();
      _molla.value = 1;
    }
    _seLaBarraCopre();
    return AnimatedBuilder(
      animation: _molla,
      builder: (context, _) {
        final quanto = Curves.easeOutBack.transform(_molla.value.clamp(0, 1));
        return Stack(
          children: [
            /* Toccare fuori la chiude. Prende i tocchi solo quando c'e': a
             * barra chiusa non deve rubare niente alla pagina. */
            if (aperta && !_resta)
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: chiudi,
                ),
              ),
            Positioned(
              /* Da oltre il bordo fino a dieci punti da dentro. */
              left: -_fuori + (_fuori + 10) * quanto,
              top: alto + 10,
              bottom: basso + 10,
              /* La larghezza va data qui, prima di centrare.
               *
               * Un riquadro messo con la sola coordinata sinistra non ha un
               * limite a destra: e' largo quanto vuole. Centrare dentro un
               * limite che non c'e' non e' una domanda con risposta, e quel
               * pezzo di schermo restava non impaginato: la barra c'era
               * nell'albero e non si vedeva. Niente errori, niente segni —
               * che e' il modo peggiore di rompersi. */
              child: SizedBox(
                width: _larghezzaDellaBarra,
                child: Center(
                  child: IgnorePointer(
                    ignoring: !aperta,
                    child: Opacity(
                      opacity: _molla.value.clamp(0, 1),
                      child: Listener(
                        onPointerDown: (_) => _laStaUsando(),
                        onPointerMove: (_) => _laStaUsando(),
                        onPointerUp: (_) => _laStaUsando(),
                        onPointerSignal: (_) => _laStaUsando(),
                        child: _IlVetro(
                          child: SizedBox(
                            width: _larghezzaDellaBarra,
                            /* Alta quanto le sue voci, e non un punto di piu': una
                         * barra che arriva sempre in fondo allo schermo sembra
                         * un pannello, e un pannello non si chiude da solo. */
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (widget.collegamento != null)
                                  _LaCasa(
                                    collegamento: widget.collegamento!,
                                    quandoPremuta: widget.vaiAlleCase,
                                  ),
                                /* Quale plancia, per chi ne ha piu' d'una.
                                 *
                                 * Sotto la casa perche' e' la stessa domanda
                                 * un gradino piu' in basso: prima in quale
                                 * casa si e', poi quale delle sue plance si
                                 * guarda. E non c'e' affatto per chi ne ha
                                 * una sola, che sono quasi tutti: una riga
                                 * per scegliere fra una cosa sola e' una riga
                                 * di troppo. */
                                if (widget.collegamento?.pannello?.piuDiUna ??
                                    false)
                                  _LePlance(
                                    collegamento: widget.collegamento!,
                                    trattieni: _trattieni,
                                    lascia: _lascia,
                                  ),
                                Flexible(
                                  child: ListView.separated(
                                    controller: _scorrimento,
                                    shrinkWrap: true,
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 8,
                                    ),
                                    itemCount: widget.sezioni.length,
                                    separatorBuilder: (_, _) =>
                                        const SizedBox(height: _Voce.spazio),
                                    itemBuilder: (context, posto) {
                                      final sezione = widget.sezioni[posto];
                                      return _Voce(
                                        sezione: sezione,
                                        scelta: sezione == widget.aperta,
                                        quandoPremuta: () => _scelta(sezione),
                                        quanti: sezione == Sezione.aggiornamenti
                                            ? widget.daAggiornare
                                            : 0,
                                      );
                                    },
                                  ),
                                ),
                                /* Che versione e' questa.
                                 *
                                 * Era in fondo a «Le case» e nella
                                 * diagnostica, e non bastava: «io non so che
                                 * versione app ho» e' arrivato da chi le
                                 * pubblica. Il menu e' la schermata che si
                                 * apre ogni giorno, e una riga grigia in
                                 * fondo alle voci si legge senza cercarla —
                                 * che e' la differenza fra un'informazione
                                 * che c'e' e una che si trova. */
                                const Padding(
                                  padding: EdgeInsets.only(bottom: 10),
                                  child: Firma(
                                    spazioSopra: 2,
                                    conIlCentralino: false,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
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
}

/// Il vetro smerigliato su cui sta la barra.
class _IlVetro extends StatelessWidget {
  const _IlVetro({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final scuro = Theme.of(context).brightness == Brightness.dark;
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 42, sigmaY: 42),
        child: Container(
          decoration: BoxDecoration(
            /* Quasi pieno, non velato. Un vetro troppo trasparente sopra una
             * pagina di schede lascia leggere quello che c'e' sotto, e allora
             * non sembra una barra: sembra una velatura. Quello che passa
             * sotto si deve intuire e non leggere — e' il punto di un vetro
             * smerigliato. */
            color: colori.surface.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: scuro
                  ? Colors.white.withValues(alpha: 0.12)
                  : Colors.white.withValues(alpha: 0.8),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: scuro ? 0.5 : 0.16),
                blurRadius: 38,
                offset: const Offset(0, 18),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

/// In cima alla barra: la casa in cui si e', e da dove ci si sta passando.
///
/// Si tocca per passare a un'altra casa. E' qui e non sulla plancia perche'
/// la plancia e' una pagina web che di case ne conosce una sola, la sua: il
/// nome che scrive in testata e' quello di Home Assistant, e «in casa» o
/// «da fuori» non lo puo' sapere.
class _LaCasa extends StatelessWidget {
  const _LaCasa({required this.collegamento, required this.quandoPremuta});

  final Collegamento collegamento;
  final VoidCallback quandoPremuta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    /* Il nome per chi non la vede — e per le prove — sta nel suggerimento,
     * non in un'etichetta che coprirebbe il nome della casa e da dove si
     * passa: quelle due righe le deve leggere anche un lettore di schermo. */
    return Tooltip(
      message: nomeDelleCase,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          onTap: quandoPremuta,
          child: Container(
            padding: const EdgeInsets.fromLTRB(19, 16, 12, 12),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: colori.onSurface.withValues(alpha: 0.08),
                ),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        collegamento.casa?.nome ??
                            inLingua(it: 'Casa', en: 'Home'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: testi.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 3),
                      DaDoveSiPassa(collegamento, piccolo: true),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: colori.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Quale plancia si guarda, per chi ne ha piu' d'una.
///
/// Nella dashboard le plance sono voci di Home Assistant, e si scelgono dalla
/// sua barra laterale. Nell'app non c'e' nessuna barra laterale di Home
/// Assistant, e allora la scelta sta dov'e' l'altra dello stesso tipo: sotto
/// la casa, in cima alla barra delle sezioni.
///
/// Un menu e non un elenco di righe: le plance sono al massimo otto, e otto
/// righe in cima alla barra mangerebbero il posto delle venti sezioni — che
/// sono la ragione per cui quella barra esiste.
class _LePlance extends StatelessWidget {
  const _LePlance({
    required this.collegamento,
    required this.trattieni,
    required this.lascia,
  });

  final Collegamento collegamento;

  /// La barra si chiude da sola dopo qualche secondo, e mentre si legge un
  /// menu che le sta sopra non le arriva nessun tocco: la si trattiene finche'
  /// il menu e' aperto, e la si lascia quando si chiude.
  final VoidCallback trattieni;
  final VoidCallback lascia;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final plance = collegamento.plance;
    final scelta = collegamento.planciaScelta;
    final trovate = plance.where((una) => una.profilo == scelta);
    final quale = trovate.isEmpty ? plance.first : trovate.first;

    return Material(
      color: Colors.transparent,
      child: PopupMenuButton<String>(
        tooltip: inLingua(it: 'Quale plancia', en: 'Which dashboard'),
        position: PopupMenuPosition.under,
        onOpened: trattieni,
        onCanceled: lascia,
        onSelected: (profilo) {
          lascia();
          unawaited(collegamento.cambiaPlancia(profilo));
        },
        itemBuilder: (context) => [
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
                    ),
                  ),
                ],
              ),
            ),
        ],
        child: Container(
          padding: const EdgeInsets.fromLTRB(19, 9, 12, 9),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: colori.onSurface.withValues(alpha: 0.08),
              ),
            ),
          ),
          child: Row(
            children: [
              Icon(
                Icons.dashboard_rounded,
                size: 17,
                color: colori.onSurfaceVariant,
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  quale.titolo,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: testi.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.1,
                  ),
                ),
              ),
              Icon(
                Icons.expand_more_rounded,
                size: 18,
                color: colori.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Una voce della barra: il disegno a sinistra, il nome accanto.
///
/// In riga e non in colonna perche' la barra e' alta: accanto al disegno c'e'
/// il posto per il nome intero, e «ELETTRODOMESTICI» si legge in un colpo
/// invece di doverlo indovinare da «ELETTR.».
class _Voce extends StatelessWidget {
  const _Voce({
    required this.sezione,
    required this.scelta,
    required this.quandoPremuta,
    this.quanti = 0,
  });

  static const double altezza = 40;
  static const double spazio = 2;

  final Sezione sezione;
  final bool scelta;
  final VoidCallback quandoPremuta;

  /// Quante cose aspettano dentro questa voce. Zero non si disegna.
  final int quanti;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    /* La pastiglia scelta e' l'inverso della pagina: scura sul chiaro, chiara
     * sullo scuro. Cosi' salta all'occhio in tutti e due i vestiti senza
     * scegliere un colore che in uno dei due stona. */
    final fondo = colori.onSurface;
    final sopra = colori.surface;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutBack,
      height: altezza,
      margin: const EdgeInsets.symmetric(horizontal: 8),
      transform: Matrix4.translationValues(scelta ? 3 : 0, 0, 0),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: scelta
            ? LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  fondo,
                  Color.lerp(fondo, colori.onSurfaceVariant, 0.35)!,
                ],
              )
            : null,
        boxShadow: scelta
            ? [
                BoxShadow(
                  color: fondo.withValues(alpha: 0.3),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: sezione.pronta ? quandoPremuta : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 11),
            child: Row(
              children: [
                /* Il disegno della sezione, lo stesso della plancia. Quella
                 * che non si sta guardando lo tiene smorzato: il colore e'
                 * l'unica cosa che dice «sei qui», e se ce l'hanno tutte non
                 * lo dice nessuna. */
                Oggetto(
                  sezione.disegno,
                  lato: 21,
                  quantoSpento: scelta ? 0 : 0.28,
                  velo: sezione.pronta ? 1 : 0.45,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _NomeDellaVoce(
                    sezione.titolo,
                    colore: scelta
                        ? sopra
                        : fondo.withValues(alpha: sezione.pronta ? 0.78 : 0.3),
                  ),
                ),
                if (quanti > 0) ...[const SizedBox(width: 6), _Quanti(quanti)],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Il numero addosso a una voce: quante cose ci aspettano dentro.
///
/// Ambra e non rosso, come la tessera della plancia: un aggiornamento non e'
/// un guasto, e' una cosa da fare con calma. Il rosso, in questa casa, vuol
/// dire «vai a vedere adesso», e speso qui non vorrebbe piu' dire niente
/// quando servira' davvero.
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
      constraints: const BoxConstraints(minWidth: 18),
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: Colori.ambraScura,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        quanti > 9 ? '9+' : '$quanti',
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 10,
          height: 1.2,
          fontWeight: FontWeight.w800,
          color: Colors.white,
        ),
      ),
    );
  }
}

/// Il nome di una voce, in maiuscoletto minuto e per intero.
///
/// «ELETTRODOMESTICI» non diventa «Elettr.»: un nome accorciato si legge due
/// volte — la prima per capire cos'era — e su una barra che si scorre col
/// pollice quella mezza attesa e' tutto il tempo che c'e'. Dove il nome non
/// entra si rimpicciolisce quanto basta a entrare intero, e le voci restano
/// tutte della stessa misura: una fila di nomi di corpo diverso non e' una
/// scala, e' disordine.
class _NomeDellaVoce extends StatelessWidget {
  const _NomeDellaVoce(this.testo, {required this.colore});

  final String testo;
  final Color colore;

  @override
  Widget build(BuildContext context) {
    return FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.centerLeft,
      child: Text(
        testo.toUpperCase(),
        maxLines: 1,
        softWrap: false,
        style: TextStyle(
          fontSize: 10.5,
          height: 1,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
          color: colore,
        ),
      ),
    );
  }
}

/// Le voci della barra: la plancia, i dispositivi, e quello che verra'.
///
/// Tutte tranne una. La **Console** — la coda delle richieste di aiuto di
/// tutte le case — la vede solo chi risponde, cioe' la casa che nelle opzioni
/// del ponte ha la chiave della console. In tutte le altre quella voce non c'e'
/// proprio: una porta che non si apre e' peggio di una porta che non c'e'.
List<Sezione> vociDellaBarra({bool conLaConsole = false}) => conLaConsole
    ? Sezione.values
    : [
        for (final una in Sezione.values)
          if (una != Sezione.console) una,
      ];

/// Come si chiama il tasto che apre la barra: il ☰ nella barra del titolo.
/// Il lettore di schermo lo legge cosi', e le prove lo cercano con questo
/// nome.
///
/// Non «Sezioni» e basta: quella parola sta anche nell'intestazione dei widget
/// — «22 sezioni · 2 chiedono attenzione» — e chi cerca per testo finirebbe a
/// premere quella riga. Un nome deve essere di una cosa sola.
String get nomeDelTastoDellaBarra =>
    inLingua(it: 'Barra delle sezioni', en: 'Sections bar');

/// Come si chiama, per chi non la vede, la riga in cima alla barra che porta
/// all'elenco delle case.
String get nomeDelleCase => inLingua(it: 'Le tue case', en: 'Your homes');

/// Quanto posto vuole la barra quando resta aperta: la sua larghezza piu'
/// l'aria che si tiene ai due lati.
const double spazioPerLaBarraFerma = _larghezzaDellaBarra + 22;

/// Quanto lasciare a sinistra al contenuto, su questo schermo.
///
/// Dove la barra si nasconde, niente: non c'e' piu' niente di suo sul bordo
/// sinistro — nessuna pillola, nessuna fascia — e la pagina arriva al bordo.
double quantoPerLaBarra(BuildContext contesto) =>
    QuantoELargo.di(contesto).laBarraResta ? spazioPerLaBarraFerma : 0;
