/// L'attesa dell'app, una sola dall'inizio alla fine.
///
/// All'avvio si vedevano tre attese una dopo l'altra: una rotella sola, poi
/// «Casa · da fuori · Apro la plancia…», poi il velo della plancia dentro il
/// WebView, col suo marchio e «Caricamento…». Tre disegni diversi per la
/// stessa cosa — la plancia che arriva — e ogni cambio sembrava un intoppo.
///
/// Adesso l'attesa e' questa, e copre tutto: l'app che si apre, la casa che
/// si cerca, la plancia che si accende e la pagina che si apre **fino a che
/// il velo della pagina non se ne va** (`Premesse.laPrimaSchermata`). Il velo
/// della pagina resta sotto, e non si vede mai: si vede un'attesa sola.
///
/// ## Com'e' fatta
///
/// I primi due secondi sono uno spettacolo breve, poi l'attesa respira:
///
///  1. **Le iniziali si scrivono** (0–0,9 s): G, d e A, grandi, al centro,
///     come nastri di luce — la G d'argento che va nel blu, la d d'argento,
///     la A d'oro — tracciate da sole, una dopo l'altra, con una testa
///     luminosa che corre lungo il tratto ([_Iniziali]).
///  2. **Si fondono nel marchio** (0,9–1,2 s): accelerano verso il centro,
///     si rimpiccioliscono fino alla misura delle lettere del marchio, e si
///     posano ognuna dove sta nel disegno; sotto di loro il marchio compare.
///  3. **Si accende** (1,2 s): un lampo caldo, un'onda d'urto d'oro che si
///     allarga, e il marchio fa un piccolo rimbalzo elastico. Dal lampo
///     escono i granelli di luce che poi gli girano attorno, davanti e
///     dietro, come attorno a un pianeta.
///  4. **La casetta si sveglia** (1,4 s): le quattro finestrelle si
///     accendono una alla volta, e le onde del Wi-Fi partono in fila — il
///     puntino, il primo arco, il secondo, e un terzo che va oltre e sfuma:
///     il segnale verso casa. Si ripete piano finche' si aspetta.
///  5. **Il nome della casa** entra lettera per lettera, con un filo d'oro
///     sotto; attorno al marchio gira un anello di luce, blu in coda e oro in
///     testa, al posto della rotella; una riflessione del marchio sul
///     «pavimento» lucido; e sul fondo raggi lenti e un alone che respira.
///  6. **Se ne va aprendosi** ([UscitaDelCaricamento]): un cerchio si apre
///     dal centro del marchio, bordato d'oro, e rivela la plancia sotto.
///
/// ## Le regole
///
///  - **Non allunga niente.** Non c'e' un tempo minimo: l'attesa se ne va
///    quando la cosa che aspetta e' pronta, anche a meta' dell'entrata, e
///    dal primo fotogramma dell'uscita i tocchi passano alla plancia.
///  - **Un orologio solo.** Un [Ticker] per attesa, e le attese che si danno
///    il cambio — `main.dart`, le fasi di `plancia_vera.dart` — leggono lo
///    stesso tempo ([_Orologio]): lo spettacolo c'e' una volta, e non
///    riparte da capo a ogni fase.
///  - **Il primo fotogramma e' quello del sistema.** Al tempo zero il fondo e'
///    pieno, del colore della schermata d'avvio di Android e di iOS, e il
///    marchio non c'e' ancora: si accende tutto da li', senza lampi.
///  - **«Riduci animazioni».** Con le animazioni spente dal sistema
///    ([MediaQuery.disableAnimationsOf]) si disegna fermo e pieno: niente
///    lampi, niente iniziali che si scrivono, niente granelli, tre punti al
///    posto dell'anello, e l'uscita e' immediata. La riga sotto cambia lo
///    stesso.
///  - **Leggera.** Niente sfocature e niente shader scritti a mano: archi,
///    cerchi, gradienti, e le iniziali sono tracciati misurati una volta
///    sola, di cui a ogni fotogramma si prende un pezzo. Il fondo, il marchio e la sua riflessione stanno
///    ognuno nel suo [RepaintBoundary]: finita l'entrata, il marchio non si
///    ridipinge piu', e a ogni fotogramma si ridisegnano solo i tratti di luce.
///
/// Le schermate che dicono qualcosa di vero — la casa non si trova, la
/// plancia non c'e', la licenza — restano le loro: questa e' solo l'attesa.
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show PathMetric;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../parole.dart';
import '../vestito/marchio.dart';

/// A che punto e' l'attesa. Non si scrive — l'attesa e' una sola — ma lo
/// sanno le prove, e chi legge lo schermo lo sente.
enum FaseDelCaricamento {
  /// L'app che si apre: le case non sono ancora lette.
  app,

  /// Si cerca dove sta la plancia della casa.
  cerco,

  /// Si accende il servitore che la porta sul telefono.
  accendo,

  /// La pagina c'e' e si sta aprendo, sotto.
  apro,
}

/// Il fondo dell'attesa: lo stesso della schermata d'avvio di Android
/// (`res/values/colors.xml`) e di iOS (`FondoAvvio`), e dello stesso velo
/// della plancia che resta sotto. Chi ne cambia uno cambia gli altri.
const fondoDelCaricamentoChiaro = Color(0xFFE8EDF3);
const fondoDelCaricamentoScuro = Color(0xFF0B1220);

/// Il fondo del caricamento per quella luminosita'.
Color fondoDelCaricamento(Brightness luce) => luce == Brightness.dark
    ? fondoDelCaricamentoScuro
    : fondoDelCaricamentoChiaro;

/* I colori del marchio: il blu della G, l'oro caldo della A e delle onde. */
const _blu = Color(0xFF3B82F6);
const _bluElettrico = Color(0xFF2563EB);
const _oro = Color(0xFFF6B85C);
const _oroChiaro = Color(0xFFFFDDA6);

/* I tempi dello spettacolo, in secondi dall'inizio. Le iniziali stanno
 * tutte prima dell'accensione: al piu' 1,2 secondi prima del marchio. */
const _inizialiDa = 0.08;
const _passoIniziali = 0.14;
const _scriveDura = 0.5;
const _fondonoDa = 0.88;
const _accensione = 1.2;
const _finestreDa = 1.4;
const _ondeDa = 1.75;
const _respiro = 4.8;

/// Le righe sotto, una dopo l'altra se l'attesa dura: quando cambiano, in
/// secondi dall'inizio.
const _quandoCambiaLaRiga = [0.0, 2.5, 6.0, 12.0];

String _rigaNumero(int quale) => switch (quale) {
  0 => inLingua(it: 'Caricamento…', en: 'Loading…'),
  1 => inLingua(it: 'Mi collego a casa…', en: 'Connecting to your home…'),
  2 => inLingua(it: 'Quasi pronto…', en: 'Almost ready…'),
  _ => inLingua(it: 'Ancora un attimo…', en: 'Just a moment longer…'),
};

int _qualeRiga(double secondi) {
  var quale = 0;
  for (var i = 0; i < _quandoCambiaLaRiga.length; i += 1) {
    if (secondi >= _quandoCambiaLaRiga[i]) quale = i;
  }
  return quale;
}

/// Quale riga si legge a quel tempo.
@visibleForTesting
String rigaDelCaricamento(double secondi) => _rigaNumero(_qualeRiga(secondi));

/// Il tempo dell'attesa, uno per tutte le attese che si danno il cambio.
///
/// Fra una fase e l'altra l'attesa cambia posto nell'albero — da `main.dart`
/// alla plancia, dalla plancia che si cerca alla pagina che si apre — e con
/// lei nasce un widget nuovo. Se ognuno avesse il suo tempo, il marchio
/// rientrerebbe a ogni cambio. Il tempo si conta dal fotogramma in cui
/// l'attesa si e' vista la prima volta, e riparte da zero solo se per un
/// momento di attese non ce n'e' stata nessuna.
abstract final class _Orologio {
  static Duration? _inizio;
  static double ultimo = 0;
  static int _vive = 0;
  static DateTime? _vuotoDa;

  /// Il nome della casa e da quando c'e', per farlo entrare quando arriva.
  static String nome = '';
  static double nomeDa = 0;

  static void entra() {
    if (_vive == 0) {
      final vuoto = _vuotoDa;
      if (vuoto == null ||
          DateTime.now().difference(vuoto) >
              const Duration(milliseconds: 600)) {
        riparti();
      }
    }
    _vive += 1;
  }

  static void esce() {
    _vive -= 1;
    if (_vive == 0) _vuotoDa = DateTime.now();
  }

  static void riparti() {
    _inizio = null;
    ultimo = 0;
    nome = '';
    nomeDa = 0;
  }

  /// I secondi passati, al fotogramma [adesso].
  static double segna(Duration adesso) {
    final inizio = _inizio;
    if (inizio == null || adesso < inizio) {
      _inizio = adesso - Duration(microseconds: (ultimo * 1e6).round());
    }
    ultimo = (adesso - _inizio!).inMicroseconds / 1e6;
    return ultimo;
  }
}

/// Riporta l'attesa all'inizio: per le prove e le fotografie, che fanno
/// nascere tante attese una dopo l'altra nello stesso programma.
@visibleForTesting
void ripartiLAttesa() => _Orologio.riparti();

double _tra(double t, double da, double durata) =>
    ((t - da) / durata).clamp(0.0, 1.0);

double _morbido(double x) => Curves.easeOutCubic.transform(x.clamp(0.0, 1.0));

/// Quanto e' acceso un tratto che va e viene fra [da] e [da] + [durata].
double _gobba(double fase, double da, double durata) {
  final x = (fase - da) / durata;
  if (x <= 0 || x >= 1) return 0;
  return math.sin(math.pi * x);
}

/// Un lampo: sale in fretta e scende piano.
double _lampo(double t, double da, double sale, double scende) {
  if (t < da) return 0;
  if (t < da + sale) return Curves.easeOut.transform((t - da) / sale);
  return 1 - Curves.easeOutCubic.transform(_tra(t, da + sale, scende));
}

/// Quanto si vede il marchio: compare sotto le iniziali che arrivano.
double _marchioAppare(double t) =>
    _morbido(_tra(t, _fondonoDa + 0.16, _accensione - _fondonoDa - 0.16));

/// La scala del marchio: cresce mentre le iniziali gli cadono dentro, poi il
/// rimbalzo dell'accensione.
double _scalaDelMarchio(double t) {
  if (t < _accensione) {
    return 0.72 + 0.2 * _morbido(_tra(t, _fondonoDa, _accensione - _fondonoDa));
  }
  final x = _tra(t, _accensione, 0.9);
  return 0.92 + 0.08 * const ElasticOutCurve(0.42).transform(x);
}

/// Le misure, secondo lo schermo: un telefono in piedi, un telefono
/// sdraiato (basso), un tablet a muro (grande).
class _Misure {
  _Misure(Size schermo) {
    final corto = schermo.shortestSide;
    var s = (corto / 400).clamp(0.85, 1.4);
    /* Un telefono sdraiato e' basso: si stringe, che stia tutto. */
    if (schermo.height < 520) s = math.min(s, schermo.height / 520);
    scala = s;
    larga = schermo.width;
  }

  late final double scala;
  late final double larga;

  /// L'altezza delle iniziali grandi: quasi quella del marchio, ma la parola
  /// intera — 2,8 volte l'altezza — non passa i tre quarti dello schermo.
  double get iniziali => math.min(logo * 0.92, larga * 0.74 / _GdA.larga);
  double get logo => 112 * scala;
  double get pavimento => logo * 0.06;
  double get riflesso => logo * 0.34;
  double get sottoRiflesso => 6 * scala;
  double get nome => 24 * scala;
  double get filo => 2 * scala;
  double get sottoNome => 22 * scala;
  double get punti => 10 * scala;
  double get sottoPunti => 8 * scala;
  double get riga => 18 * scala;

  /// Quanto e' alta la colonna, per sapere dov'e' il marchio senza misurare.
  double get alta =>
      logo +
      pavimento +
      riflesso +
      sottoRiflesso +
      nome +
      6 * scala +
      filo +
      sottoNome +
      punti +
      sottoPunti +
      riga;

  /// Di quanto il centro del marchio sta sopra il centro della pagina.
  double get marchioSopra => alta / 2 - logo / 2;
}

class CaricamentoDellaPlancia extends StatefulWidget {
  const CaricamentoDellaPlancia({
    super.key,
    this.fase = FaseDelCaricamento.app,
    this.inFondo = 0,
    this.carattere,
    this.nome,
  });

  final FaseDelCaricamento fase;

  /// Quanto resta sotto la pagina, tolto al riquadro (i tasti di Android):
  /// l'attesa sta al centro della pagina, non dello schermo, e in tutte le
  /// fasi nello stesso punto.
  final double inFondo;

  /// Il carattere delle scritte. Di serie Inter, quello dell'app; le prove
  /// che disegnano ne passano uno caricato a mano.
  final String? carattere;

  /// Il nome della casa, quando si sa: entra lettera per lettera.
  final String? nome;

  @override
  State<CaricamentoDellaPlancia> createState() =>
      _CaricamentoDellaPlanciaState();
}

class _CaricamentoDellaPlanciaState extends State<CaricamentoDellaPlancia>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker = createTicker((_) => _segna());
  final ValueNotifier<double> _tempo = ValueNotifier(_Orologio.ultimo);
  Timer? _fermo;
  bool _statico = false;

  String get _perche => switch (widget.fase) {
    FaseDelCaricamento.app => inLingua(
      it: 'Apro l\'app…',
      en: 'Opening the app…',
    ),
    FaseDelCaricamento.cerco => inLingua(
      it: 'Cerco la plancia…',
      en: 'Looking for the dashboard…',
    ),
    FaseDelCaricamento.accendo => inLingua(
      it: 'Accendo la plancia…',
      en: 'Starting the dashboard…',
    ),
    FaseDelCaricamento.apro => inLingua(
      it: 'Apro la plancia…',
      en: 'Opening the dashboard…',
    ),
  };

  @override
  void initState() {
    super.initState();
    _Orologio.entra();
    _tempo.value = _Orologio.ultimo;
  }

  /* Il tempo si legge dal fotogramma, che nelle prove e' quello finto: cosi'
   * le fotografie a 0,3 secondi sono davvero a 0,3 secondi. */
  void _segna() {
    final nome = widget.nome?.trim() ?? '';
    final t = _Orologio.segna(SchedulerBinding.instance.currentFrameTimeStamp);
    if (nome != _Orologio.nome) {
      _Orologio.nome = nome;
      _Orologio.nomeDa = t;
    }
    _tempo.value = t;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final statico = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (statico == _statico && (_ticker.isActive || _fermo != null)) return;
    _statico = statico;
    _ticker.stop();
    _fermo?.cancel();
    _fermo = null;
    if (statico) {
      /* Fermo, ma la riga sotto cambia lo stesso: due volte al secondo si
       * chiede un fotogramma e si legge il tempo. */
      void chiedi() =>
          SchedulerBinding.instance.scheduleFrameCallback((_) => _segna());
      chiedi();
      _fermo = Timer.periodic(const Duration(milliseconds: 500), (_) {
        chiedi();
        SchedulerBinding.instance.scheduleFrame();
      });
    } else {
      _ticker.start();
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    _fermo?.cancel();
    _tempo.dispose();
    _Orologio.esce();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scuro = Theme.of(context).brightness == Brightness.dark;
    final statico = _statico;
    final nome = widget.nome?.trim() ?? '';
    final via = _UscitaInCorso.di(context);
    return Semantics(
      label: _perche,
      liveRegion: true,
      child: ExcludeSemantics(
        child: LayoutBuilder(
          builder: (context, spazio) {
            final pagina = Size(
              spazio.maxWidth,
              math.max(0, spazio.maxHeight - widget.inFondo),
            );
            final m = _Misure(pagina);
            final centro = Offset(
              pagina.width / 2,
              pagina.height / 2 - m.marchioSopra,
            );
            final velo = ColoredBox(
              color: fondoDelCaricamento(
                scuro ? Brightness.dark : Brightness.light,
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  RepaintBoundary(
                    child: CustomPaint(
                      painter: _Fondo(
                        tempo: _tempo,
                        scuro: scuro,
                        statico: statico,
                        centro: centro,
                        logo: m.logo,
                        raggio: math.max(pagina.shortestSide * 0.62, 260),
                      ),
                    ),
                  ),
                  Padding(
                    padding: EdgeInsets.only(bottom: widget.inFondo),
                    child: Center(
                      child: _Colonna(
                        tempo: _tempo,
                        via: via,
                        misure: m,
                        scuro: scuro,
                        statico: statico,
                        nome: nome,
                        carattere: widget.carattere ?? 'Inter',
                      ),
                    ),
                  ),
                ],
              ),
            );
            if (via == null) return velo;
            /* L'uscita: un cerchio che si apre dal centro del marchio, col
             * bordo d'oro. */
            return AnimatedBuilder(
              animation: via,
              child: velo,
              builder: (context, velo) {
                final p = via.value;
                final lontano = _piuLontano(centro, spazio.biggest);
                final r = Curves.easeInCubic.transform(p) * (lontano + 8);
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipPath(
                      clipper: _Foro(centro: centro, raggio: r),
                      clipBehavior: p > 0 ? Clip.antiAlias : Clip.none,
                      child: velo,
                    ),
                    if (p > 0 && p < 1)
                      CustomPaint(
                        painter: _BordoDelForo(
                          centro: centro,
                          raggio: r,
                          forza: 1 - Curves.easeIn.transform(p),
                          scala: m.scala,
                        ),
                      ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }
}

double _piuLontano(Offset c, Size s) => [
  c,
  c - Offset(s.width, 0),
  c - Offset(0, s.height),
  c - Offset(s.width, s.height),
].map((d) => d.distance).reduce(math.max);

class _Colonna extends StatelessWidget {
  const _Colonna({
    required this.tempo,
    required this.via,
    required this.misure,
    required this.scuro,
    required this.statico,
    required this.nome,
    required this.carattere,
  });

  final ValueNotifier<double> tempo;
  final Animation<double>? via;
  final _Misure misure;
  final bool scuro;
  final bool statico;
  final String nome;
  final String carattere;

  @override
  Widget build(BuildContext context) {
    final m = misure;
    final colNome = scuro ? const Color(0xFFE6ECF5) : const Color(0xFF0F172A);
    final colRiga = scuro ? const Color(0xFF8C9CB5) : const Color(0xFF5B6B82);
    TextStyle stile(
      double misura,
      FontWeight peso,
      Color colore,
      double spazio,
    ) => TextStyle(
      inherit: false,
      fontFamily: carattere,
      fontSize: misura,
      fontWeight: peso,
      letterSpacing: spazio,
      color: colore,
      height: 1.2,
    );

    /* Il marchio, nel suo strato: finita l'entrata non si ridipinge piu'. */
    final marchio = RepaintBoundary(child: Marchio(lato: m.logo));

    final luci = statico
        ? const SizedBox.shrink()
        : RepaintBoundary(
            child: CustomPaint(
              painter: _Luci(tempo: tempo, scuro: scuro, scala: m.scala),
            ),
          );

    final riflesso = RepaintBoundary(child: Marchio(lato: m.logo));

    return ValueListenableBuilder<double>(
      valueListenable: tempo,
      builder: (context, t, _) {
        final pieno = statico ? 10.0 : t;
        final esce = via?.value ?? 0;
        final scala =
            _scalaDelMarchio(pieno) *
            (1 + 0.35 * Curves.easeIn.transform(esce));
        final riflessoQuanto = statico
            ? 1.0
            : _morbido(_tra(t, _accensione - 0.1, 0.6));
        final nomeDa = math.max(_Orologio.nomeDa, _accensione + 0.15);
        final filoQuanto = statico
            ? 1.0
            : _morbido(_tra(t, nomeDa + 0.25, 0.7));
        final sotto = _morbido(_tra(pieno, _accensione + 0.3, 0.5));
        final appare = statico ? 1.0 : _marchioAppare(t);
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox.square(
              dimension: m.logo,
              child: Stack(
                clipBehavior: Clip.none,
                fit: StackFit.expand,
                children: [
                  /* Dietro: l'anello di luce e i granelli che passano dietro
                   * al marchio. */
                  if (!statico)
                    RepaintBoundary(
                      child: CustomPaint(
                        painter: _Orbita(
                          tempo: tempo,
                          scuro: scuro,
                          scala: m.scala,
                          davanti: false,
                        ),
                      ),
                    ),
                  Transform.scale(
                    scale: scala,
                    child: Stack(
                      clipBehavior: Clip.none,
                      fit: StackFit.expand,
                      children: [
                        /* Sotto le iniziali che arrivano compare il marchio. */
                        Opacity(opacity: appare, child: marchio),
                        luci,
                      ],
                    ),
                  ),
                  if (!statico)
                    RepaintBoundary(
                      child: CustomPaint(
                        painter: _Orbita(
                          tempo: tempo,
                          scuro: scuro,
                          scala: m.scala,
                          davanti: true,
                        ),
                      ),
                    ),
                  /* Davanti a tutto: le iniziali, finche' non si fondono. */
                  if (!statico && t < _accensione)
                    RepaintBoundary(
                      child: CustomPaint(
                        painter: _Iniziali(
                          tempo: tempo,
                          scuro: scuro,
                          alte: m.iniziali,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            SizedBox(height: m.pavimento),
            /* La riflessione, sul pavimento lucido: il marchio capovolto, che
             * sfuma. */
            SizedBox(
              height: m.riflesso,
              width: m.logo,
              child: riflessoQuanto <= 0
                  ? null
                  : Opacity(
                      opacity: riflessoQuanto * (scuro ? 0.5 : 0.28),
                      child: ClipRect(
                        child: OverflowBox(
                          alignment: Alignment.topCenter,
                          minHeight: m.logo,
                          maxHeight: m.logo,
                          child: ShaderMask(
                            blendMode: BlendMode.dstIn,
                            shaderCallback: (r) => LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: const [
                                Color(0xCCFFFFFF),
                                Color(0x00FFFFFF),
                              ],
                              stops: [0, m.riflesso / m.logo],
                            ).createShader(r),
                            child: Transform(
                              alignment: Alignment.center,
                              transform: Matrix4.diagonal3Values(
                                scala,
                                -scala,
                                1,
                              ),
                              child: riflesso,
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
            SizedBox(height: m.sottoRiflesso),
            SizedBox(
              height: m.nome,
              child: nome.isEmpty
                  ? null
                  : _NomeLetteraPerLettera(
                      nome: nome.toUpperCase(),
                      t: statico ? 100 : t,
                      da: nomeDa,
                      stile: stile(
                        16 * m.scala,
                        FontWeight.w800,
                        colNome,
                        16 * m.scala * 0.22,
                      ),
                      scala: m.scala,
                    ),
            ),
            SizedBox(height: 6 * m.scala),
            /* Il filo d'oro sotto il nome: cresce dal centro. */
            SizedBox(
              height: m.filo,
              width: 56 * m.scala,
              child: nome.isEmpty
                  ? null
                  : Center(
                      child: Container(
                        width: 56 * m.scala * filoQuanto,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(m.filo),
                          gradient: LinearGradient(
                            colors: [
                              _oro.withValues(alpha: 0),
                              _oro,
                              _oro.withValues(alpha: 0),
                            ],
                          ),
                        ),
                      ),
                    ),
            ),
            SizedBox(height: m.sottoNome),
            /* Fermi, tre punti al posto dell'anello che gira. */
            SizedBox(
              height: m.punti,
              child: statico ? _TrePunti(scuro: scuro, misura: m.punti) : null,
            ),
            SizedBox(height: m.sottoPunti),
            Opacity(
              opacity: sotto,
              child: SizedBox(
                height: m.riga,
                child: _Riga(
                  t: t,
                  statico: statico,
                  stile: stile(13 * m.scala, FontWeight.w600, colRiga, 0.1),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Il nome della casa, una lettera dopo l'altra: ognuna sale di poco e si
/// accende.
class _NomeLetteraPerLettera extends StatelessWidget {
  const _NomeLetteraPerLettera({
    required this.nome,
    required this.t,
    required this.da,
    required this.stile,
    required this.scala,
  });

  final String nome;
  final double t;
  final double da;
  final TextStyle stile;
  final double scala;

  @override
  Widget build(BuildContext context) {
    final lettere = nome.characters.toList();
    /* Un nome lungo non deve metterci un'eternita': il passo si accorcia. */
    final passo = math.min(0.045, 0.6 / math.max(1, lettere.length));
    final tutto = _tra(t, da + (lettere.length - 1) * passo, 0.42) >= 1;
    /* Entrate tutte, e' una scritta sola: si legge e si cerca come tale. */
    if (tutto) {
      return FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(nome, maxLines: 1, style: stile),
      );
    }
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < lettere.length; i += 1)
            Builder(
              builder: (context) {
                final q = Curves.easeOutCubic.transform(
                  _tra(t, da + i * passo, 0.42),
                );
                return Opacity(
                  opacity: q,
                  child: Transform.translate(
                    offset: Offset(0, (1 - q) * 9 * scala),
                    child: Text(lettere[i], style: stile),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

/// La riga sotto: cambia sfumando, la vecchia che sale e se ne va e la
/// nuova che arriva da sotto.
class _Riga extends StatelessWidget {
  const _Riga({required this.t, required this.statico, required this.stile});

  final double t;
  final bool statico;
  final TextStyle stile;

  @override
  Widget build(BuildContext context) {
    final quale = _qualeRiga(t);
    final passa = statico || quale == 0
        ? 1.0
        : _morbido(_tra(t, _quandoCambiaLaRiga[quale], 0.45));
    Widget riga(int i, double quanto, double su) => Opacity(
      opacity: quanto,
      child: Transform.translate(
        offset: Offset(0, su),
        child: Text(
          _rigaNumero(i),
          maxLines: 1,
          overflow: TextOverflow.fade,
          softWrap: false,
          style: stile,
        ),
      ),
    );
    return Stack(
      alignment: Alignment.center,
      clipBehavior: Clip.none,
      children: [
        if (passa < 1) riga(quale - 1, 1 - passa, -6 * passa),
        riga(quale, passa, 6 * (1 - passa)),
      ],
    );
  }
}

/// Il fondo vivo: il colore pieno della schermata d'avvio, e sopra un alone
/// che respira dietro il marchio, raggi lenti che girano, il lampo
/// dell'accensione e il pavimento lucido sotto il marchio.
class _Fondo extends CustomPainter {
  _Fondo({
    required this.tempo,
    required this.scuro,
    required this.statico,
    required this.centro,
    required this.logo,
    required this.raggio,
  }) : super(repaint: statico ? null : tempo);

  final ValueNotifier<double> tempo;
  final bool scuro;
  final bool statico;
  final Offset centro;
  final double logo;
  final double raggio;

  @override
  void paint(Canvas canvas, Size size) {
    final t = statico ? 10.0 : tempo.value;
    final arriva = _morbido(_tra(t, 0.0, 0.7));
    if (arriva <= 0) return;
    final respiro = statico
        ? 0.5
        : 0.5 - 0.5 * math.cos(2 * math.pi * t / _respiro);
    final tutto = Offset.zero & size;

    /* La profondita': in alto e in basso un velo appena piu' scuro (di sera)
     * o piu' chiaro (di giorno). */
    canvas.drawRect(
      tutto,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: scuro
              ? [
                  Color.fromRGBO(6, 10, 22, 0.55 * arriva),
                  const Color(0x00060A14),
                  Color.fromRGBO(4, 7, 15, 0.85 * arriva),
                ]
              : [
                  Color.fromRGBO(255, 255, 255, 0.55 * arriva),
                  const Color(0x00FFFFFF),
                  Color.fromRGBO(200, 211, 227, 0.6 * arriva),
                ],
          stops: const [0, 0.45, 1],
        ).createShader(tutto),
    );

    /* L'alone dietro il marchio: blu elettrico di sera, bianco di giorno. */
    final r = raggio * (0.92 + 0.1 * respiro);
    final forza = arriva * (0.75 + 0.25 * respiro);
    canvas.drawCircle(
      centro,
      r,
      Paint()
        ..shader = RadialGradient(
          colors: scuro
              ? [
                  _bluElettrico.withValues(alpha: 0.42 * forza),
                  const Color(0xFF16307A).withValues(alpha: 0.30 * forza),
                  const Color(0x000B1220),
                ]
              : [
                  Color.fromRGBO(255, 255, 255, 0.95 * forza),
                  Color.fromRGBO(248, 251, 255, 0.55 * forza),
                  const Color(0x00F8FBFF),
                ],
          stops: const [0, 0.45, 1],
        ).createShader(Rect.fromCircle(center: centro, radius: r)),
    );

    /* I raggi: sette lame di luce larghe e tenui che girano piano attorno
     * al marchio, accese dal lampo. */
    final raggi = statico ? 0.6 : _morbido(_tra(t, _accensione, 0.9));
    if (raggi > 0) {
      final lunghi = raggio * 1.25;
      final giro = statico ? 0.0 : t * 0.07;
      final pennello = Paint()
        ..blendMode = scuro ? BlendMode.plus : BlendMode.srcOver
        ..shader = RadialGradient(
          colors: scuro
              ? [
                  _blu.withValues(alpha: 0.16 * raggi),
                  _blu.withValues(alpha: 0.05 * raggi),
                  _blu.withValues(alpha: 0),
                ]
              : [
                  Colors.white.withValues(alpha: 0.85 * raggi),
                  Colors.white.withValues(alpha: 0.3 * raggi),
                  Colors.white.withValues(alpha: 0),
                ],
          stops: const [0.12, 0.5, 1],
        ).createShader(Rect.fromCircle(center: centro, radius: lunghi));
      for (var i = 0; i < 7; i += 1) {
        final a = giro + i * 2 * math.pi / 7 + (i.isEven ? 0 : 0.18);
        final largo = i.isEven ? 0.15 : 0.08;
        final lama = Path()
          ..moveTo(centro.dx, centro.dy)
          ..lineTo(
            centro.dx + lunghi * math.cos(a - largo),
            centro.dy + lunghi * math.sin(a - largo),
          )
          ..lineTo(
            centro.dx + lunghi * math.cos(a + largo),
            centro.dy + lunghi * math.sin(a + largo),
          )
          ..close();
        canvas.drawPath(lama, pennello);
      }
    }

    /* Il pavimento lucido: una pozza di luce schiacciata sotto il marchio. */
    final sotto = centro + Offset(0, logo * 0.53);
    final pozza = statico ? 1.0 : _morbido(_tra(t, _accensione - 0.1, 0.7));
    if (pozza > 0) {
      canvas.save();
      canvas.translate(sotto.dx, sotto.dy);
      canvas.scale(1, 0.16);
      final rp = logo * 1.15;
      canvas.drawCircle(
        Offset.zero,
        rp,
        Paint()
          ..shader = RadialGradient(
            colors: scuro
                ? [
                    _blu.withValues(alpha: 0.55 * pozza),
                    _blu.withValues(alpha: 0.12 * pozza),
                    _blu.withValues(alpha: 0),
                  ]
                : [
                    const Color(0xFF0B1A3A).withValues(alpha: 0.20 * pozza),
                    const Color(0xFF0B1A3A).withValues(alpha: 0.05 * pozza),
                    const Color(0x000B1A3A),
                  ],
            stops: const [0, 0.5, 1],
          ).createShader(Rect.fromCircle(center: Offset.zero, radius: rp)),
      );
      canvas.restore();
    }

    if (statico) return;

    /* Il lampo dell'accensione: una luce calda che si allarga dal marchio,
     * e l'onda d'urto d'oro che corre verso i bordi. */
    final lampo = _lampo(t, _accensione, 0.08, 0.7);
    if (lampo > 0) {
      final rl = logo * (1.0 + 0.9 * _morbido(_tra(t, _accensione, 0.6)));
      canvas.drawCircle(
        centro,
        rl,
        Paint()
          ..blendMode = scuro ? BlendMode.plus : BlendMode.srcOver
          ..shader = RadialGradient(
            colors: [
              _oroChiaro.withValues(alpha: (scuro ? 0.55 : 0.5) * lampo),
              _oro.withValues(alpha: (scuro ? 0.22 : 0.18) * lampo),
              _oro.withValues(alpha: 0),
            ],
            stops: const [0, 0.4, 1],
          ).createShader(Rect.fromCircle(center: centro, radius: rl)),
      );
    }
    final onda = _tra(t, _accensione, 1.0);
    if (onda > 0 && onda < 1) {
      final ro = logo * (0.62 + 2.6 * Curves.easeOutCubic.transform(onda));
      final f = 1 - onda;
      canvas.drawCircle(
        centro,
        ro,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = logo * 0.05 * f
          ..color = _oro.withValues(alpha: 0.18 * f),
      );
      canvas.drawCircle(
        centro,
        ro,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = math.max(1, logo * 0.012 * f)
          ..color = _oroChiaro.withValues(alpha: 0.85 * f),
      );
    }
  }

  @override
  bool shouldRepaint(_Fondo prima) =>
      prima.scuro != scuro ||
      prima.statico != statico ||
      prima.centro != centro ||
      prima.logo != logo ||
      prima.raggio != raggio ||
      prima.tempo != tempo;
}

/// Quello che si accende sopra il marchio: il bagliore dell'accensione, le finestrelle, le onde della casetta e il
/// riflesso che lo attraversa.
///
/// Le misure sono quelle del disegno (`assets/marchio/gda.png`, 384 pixel):
/// il centro delle onde a (264, 138), i due archi a 30 e 48 di raggio, il
/// puntino a (267, 129); le finestrelle centrate a (189, 172), (206, 172),
/// (189, 190), (206, 190), di dodici pixel e mezzo.
class _Luci extends CustomPainter {
  _Luci({required this.tempo, required this.scuro, required this.scala})
    : super(repaint: tempo);

  final ValueNotifier<double> tempo;
  final bool scuro;
  final double scala;

  @override
  void paint(Canvas canvas, Size size) {
    final t = tempo.value;
    final l = size.shortestSide;
    final forma = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(l * 0.22),
    );
    _bagliore(canvas, size, forma, t);
    _finestre(canvas, l, t);
    _onde(canvas, l, t);
    _riflesso(canvas, size, forma, t);
  }

  /// Il marchio che si accende: per un attimo brucia, poi si calma.
  void _bagliore(Canvas canvas, Size size, RRect forma, double t) {
    final f = _lampo(t, _accensione, 0.06, 0.55);
    if (f <= 0) return;
    canvas.save();
    canvas.clipRRect(forma);
    final c = size.center(Offset.zero);
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..blendMode = BlendMode.plus
        ..shader = RadialGradient(
          colors: [
            _oroChiaro.withValues(alpha: 0.55 * f),
            _blu.withValues(alpha: 0.18 * f),
          ],
        ).createShader(Rect.fromCircle(center: c, radius: size.width * 0.75)),
    );
    canvas.restore();
  }

  /// Le quattro finestrelle: si accendono una alla volta dopo il lampo, e di
  /// nuovo, piano, a ogni respiro.
  void _finestre(Canvas canvas, double l, double t) {
    const dove = [
      Offset(189, 172),
      Offset(206, 172),
      Offset(206, 190),
      Offset(189, 190),
    ];
    final lato = l * 12.5 / 384;
    for (var i = 0; i < dove.length; i += 1) {
      final da = _finestreDa + i * 0.11;
      var f = _lampo(t, da, 0.07, 0.6);
      if (t > da + 1) {
        /* Poi, a ogni respiro, una dopo l'altra, piano. */
        f = 0.55 * _gobba((t - da) % _respiro, 2.4, 0.7);
      }
      if (f <= 0.01) continue;
      final c = dove[i] * (l / 384);
      canvas.drawCircle(
        c,
        lato * 1.6,
        Paint()
          ..blendMode = BlendMode.plus
          ..shader = RadialGradient(
            colors: [
              _oro.withValues(alpha: 0.5 * f),
              _oro.withValues(alpha: 0),
            ],
          ).createShader(Rect.fromCircle(center: c, radius: lato * 1.6)),
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: c, width: lato, height: lato),
          Radius.circular(lato * 0.15),
        ),
        Paint()
          ..blendMode = BlendMode.plus
          ..color = _oroChiaro.withValues(alpha: 0.7 * f),
      );
    }
  }

  /// Le onde della casetta: il puntino, il primo arco, il secondo, e un
  /// terzo che va oltre e sfuma. Ogni 1,6 secondi.
  void _onde(Canvas canvas, double l, double t) {
    if (t < _ondeDa) return;
    final arriva = _morbido(_tra(t, _ondeDa, 0.4));
    final fase = ((t - _ondeDa) % 1.6) / 1.6;
    final centro = Offset(l * 264 / 384, l * 138 / 384);
    final spessore = l * 7 / 384;

    void arco(double raggio, double forza, {double sottile = 1}) {
      if (forza <= 0.01) return;
      final r = Rect.fromCircle(center: centro, radius: raggio);
      canvas.drawArc(
        r,
        -math.pi / 2,
        math.pi / 2,
        false,
        Paint()
          ..blendMode = BlendMode.plus
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = spessore * 2.6 * sottile
          ..color = _oro.withValues(alpha: 0.2 * forza),
      );
      canvas.drawArc(
        r,
        -math.pi / 2,
        math.pi / 2,
        false,
        Paint()
          ..blendMode = BlendMode.plus
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = spessore * sottile
          ..color = _oroChiaro.withValues(alpha: 0.85 * forza),
      );
    }

    final puntino = _gobba(fase, 0.0, 0.30) * arriva;
    if (puntino > 0.01) {
      final p = Offset(l * 267 / 384, l * 129 / 384);
      canvas.drawCircle(
        p,
        l * 16 / 384,
        Paint()
          ..blendMode = BlendMode.plus
          ..color = _oro.withValues(alpha: 0.25 * puntino),
      );
      canvas.drawCircle(
        p,
        l * 7.5 / 384,
        Paint()
          ..blendMode = BlendMode.plus
          ..color = _oroChiaro.withValues(alpha: 0.8 * puntino),
      );
    }
    arco(l * 30 / 384, _gobba(fase, 0.14, 0.34) * arriva);
    arco(l * 48 / 384, _gobba(fase, 0.28, 0.34) * arriva);
    final via = _tra(fase, 0.42, 0.55);
    if (via > 0 && via < 1) {
      arco(
        l * (66 + 34 * via) / 384,
        (1 - via) * math.sin(math.pi * math.min(1, via * 3)) * arriva,
        sottile: 0.85,
      );
    }
  }

  /// Il riflesso che attraversa la superficie lucida, come sulle icone: la
  /// prima volta subito dopo il lampo, poi una volta per respiro.
  void _riflesso(Canvas canvas, Size size, RRect forma, double t) {
    const dura = 0.85;
    const primo = _accensione + 0.35;
    if (t < primo) return;
    final da = primo + ((t - primo) ~/ _respiro) * _respiro;
    final x = _tra(t, da, dura);
    if (x <= 0 || x >= 1) return;
    final dove = Curves.easeInOutSine.transform(x);
    canvas.save();
    canvas.clipRRect(forma);
    final c = -0.7 + 2.4 * dove;
    final rettangolo = Offset.zero & size;
    canvas.drawRect(
      rettangolo,
      Paint()
        ..blendMode = BlendMode.plus
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: const [
            Color(0x00FFFFFF),
            Color(0x00FFFFFF),
            Color(0x52FFFFFF),
            Color(0x00FFFFFF),
            Color(0x00FFFFFF),
          ],
          stops: [
            0,
            (c - 0.14).clamp(0.0, 1.0),
            c.clamp(0.0, 1.0),
            (c + 0.14).clamp(0.0, 1.0),
            1,
          ],
        ).createShader(rettangolo),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_Luci prima) =>
      prima.tempo != tempo || prima.scuro != scuro || prima.scala != scala;
}

/// Una delle iniziali, come tracciato da scrivere: in un quadrato alto uno,
/// largo [larga], nell'ordine in cui la penna la scrive.
class _Lettera {
  _Lettera(this.larga, Path tracciato)
    : tratti = tracciato.computeMetrics().toList() {
    lunga = tratti.fold(0, (somma, tratto) => somma + tratto.length);
  }

  final double larga;
  final List<PathMetric> tratti;
  late final double lunga;

  /// Il pezzo scritto fino a [quanto] (da 0 a 1), e dove sta la penna.
  (Path, Offset?) finoA(double quanto) {
    final scritto = Path();
    var resta = quanto.clamp(0.0, 1.0) * lunga;
    Offset? penna;
    for (final tratto in tratti) {
      if (resta <= 0) break;
      final qui = math.min(resta, tratto.length);
      scritto.addPath(tratto.extractPath(0, qui), Offset.zero);
      if (qui < tratto.length) {
        penna = tratto.getTangentForOffset(qui)?.position;
      }
      resta -= qui;
    }
    return (scritto, penna);
  }
}

/// Le tre iniziali del marchio, G, d, A: tracciati a una linea sola, come le
/// scriverebbe una penna di luce. Misurati una volta sola, all'inizio.
abstract final class _GdA {
  /* Lo spazio fra una lettera e l'altra, e quanto e' larga la parola. */
  static const spazio = 0.16;
  static double get larga =>
      lettere.fold(0.0, (somma, l) => somma + l.larga) +
      spazio * (lettere.length - 1);

  static final List<_Lettera> lettere = [
    /* La G: un cerchio quasi chiuso da in alto a destra, in senso
     * antiorario, poi giu' e dentro col trattino. */
    _Lettera(
      0.9,
      Path()
        ..addArc(
          Rect.fromCircle(center: const Offset(0.45, 0.5), radius: 0.45),
          -0.62,
          -(2 * math.pi - 1.08),
        )
        ..lineTo(0.88, 0.53)
        ..lineTo(0.52, 0.53),
    ),
    /* La d: la pancia, in senso antiorario dalla destra, poi l'asta dall'alto
     * in giu'. */
    _Lettera(
      0.72,
      Path()
        ..addArc(
          Rect.fromCircle(center: const Offset(0.33, 0.66), radius: 0.32),
          0,
          -2 * math.pi + 0.001,
        )
        ..moveTo(0.66, 0)
        ..lineTo(0.66, 1),
    ),
    /* La A: su e giu', poi la traversa. */
    _Lettera(
      0.86,
      Path()
        ..moveTo(0, 1)
        ..lineTo(0.43, 0)
        ..lineTo(0.86, 1)
        ..moveTo(0.18, 0.64)
        ..lineTo(0.68, 0.64),
    ),
  ];

  /// Dove ognuna si posa dentro il marchio — il centro, rispetto al centro
  /// del marchio, in lati del marchio — e quanto e' alta li'.
  static const arrivi = [
    Offset(-0.22, 0.06),
    Offset(-0.03, 0.0),
    Offset(0.2, 0.06),
  ];
  static const altaArrivata = 0.42;
}

/// Le iniziali che si scrivono e poi si fondono nel marchio.
///
/// Ognuna si scrive col suo colore — la G d'argento che va nel blu, la d
/// d'argento, la A d'oro come nel marchio — con un alone largo e tenue sotto
/// il tratto, e una testa luminosa dove sta la penna. Scritte tutte e tre,
/// accelerano verso il centro rimpicciolendo, ognuna verso il punto dove sta
/// nel disegno, e svaniscono dentro il marchio che compare: il lampo
/// dell'accensione e' il momento in cui ci entrano.
class _Iniziali extends CustomPainter {
  _Iniziali({required this.tempo, required this.scuro, required this.alte})
    : super(repaint: tempo);

  final ValueNotifier<double> tempo;
  final bool scuro;

  /// Quanto sono alte le iniziali grandi.
  final double alte;

  List<Color> _colori(int quale) => switch ((quale, scuro)) {
    (0, true) => const [Color(0xFFDCE8FF), Color(0xFF4F8BFF)],
    (1, true) => const [Color(0xFFFFFFFF), Color(0xFFB8C4D6)],
    (_, true) => const [Color(0xFFFFE2B0), Color(0xFFEFA445)],
    (0, false) => const [Color(0xFF1E3A8A), Color(0xFF3B82F6)],
    (1, false) => const [Color(0xFF334155), Color(0xFF7C8BA1)],
    (_, false) => const [Color(0xFFE8A13E), Color(0xFFC77812)],
  };

  @override
  void paint(Canvas canvas, Size size) {
    final t = tempo.value;
    if (t >= _accensione) return;
    final l = size.shortestSide;
    final c = size.center(Offset.zero);
    /* Quanto sono gia' andate verso il marchio: accelerano entrando. */
    final dentro = Curves.easeInCubic.transform(
      _tra(t, _fondonoDa, _accensione - _fondonoDa),
    );
    final larga = _GdA.larga * alte;
    var x = c.dx - larga / 2;
    for (var i = 0; i < _GdA.lettere.length; i += 1) {
      final lettera = _GdA.lettere[i];
      final scrive = Curves.easeInOutSine.transform(
        _tra(t, _inizialiDa + i * _passoIniziali, _scriveDura),
      );
      final grande = Offset(x + lettera.larga * alte / 2, c.dy);
      x += (lettera.larga + _GdA.spazio) * alte;
      if (scrive <= 0) continue;
      /* Dalla parola grande al suo posto nel marchio. */
      final arrivo = c + _GdA.arrivi[i] * l;
      final dove = Offset.lerp(grande, arrivo, dentro)!;
      final u = alte + (l * _GdA.altaArrivata - alte) * dentro;
      final svanisce = 1 - _tra(dentro, 0.35, 0.6);
      /* Scritte tutte e tre, un luccichio le percorre da sinistra. */
      final luccica = _gobba(t, _fondonoDa - 0.1 + i * 0.05, 0.22);
      if (svanisce <= 0) continue;
      final (scritto, penna) = lettera.finoA(scrive);
      final colori = _colori(i);

      canvas.save();
      canvas.translate(dove.dx - lettera.larga * u / 2, dove.dy - u / 2);
      canvas.scale(u);
      final rettangolo = Rect.fromLTWH(0, 0, lettera.larga, 1);
      /* L'alone sotto il tratto, in tre passate sempre piu' strette: sfuma
       * come una luce, non come un tubo. Piu' forte mentre entrano nel
       * marchio. */
      final alone = (scuro ? 1.0 : 0.55) * (1 + dentro + luccica) * svanisce;
      for (final (largo, alfa) in const [
        (0.30, 0.05),
        (0.2, 0.08),
        (0.13, 0.14),
      ]) {
        canvas.drawPath(
          scritto,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round
            ..strokeWidth = largo
            ..blendMode = scuro ? BlendMode.plus : BlendMode.srcOver
            ..color = colori.last.withValues(alpha: alfa * alone),
        );
      }
      canvas.drawPath(
        scritto,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..strokeWidth = 0.085
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              colori.first.withValues(alpha: svanisce),
              colori.last.withValues(alpha: svanisce),
            ],
          ).createShader(rettangolo),
      );
      /* Un filo di luce dentro il nastro: lo fa sembrare di metallo. */
      if (scuro) {
        canvas.drawPath(
          scritto,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round
            ..strokeWidth = 0.022
            ..blendMode = BlendMode.plus
            ..color = Colors.white.withValues(
              alpha: (0.45 + 0.5 * luccica) * svanisce,
            ),
        );
      } else if (luccica > 0) {
        canvas.drawPath(
          scritto,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round
            ..strokeWidth = 0.03
            ..color = Colors.white.withValues(alpha: 0.7 * luccica * svanisce),
        );
      }
      /* La testa: dove sta scrivendo la penna. */
      if (penna != null) {
        const rp = 0.16;
        canvas.drawCircle(
          penna,
          rp,
          Paint()
            ..blendMode = scuro ? BlendMode.plus : BlendMode.srcOver
            ..shader = RadialGradient(
              colors: [
                Colors.white.withValues(alpha: scuro ? 0.95 : 0.9),
                _oro.withValues(alpha: 0.5),
                _oro.withValues(alpha: 0),
              ],
              stops: const [0, 0.35, 1],
            ).createShader(Rect.fromCircle(center: penna, radius: rp)),
        );
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_Iniziali prima) =>
      prima.tempo != tempo || prima.scuro != scuro || prima.alte != alte;
}

/// Un granello di luce in orbita: sempre lo stesso, da un seme.
class _Granello {
  _Granello(math.Random caso)
    : raggio = 0.78 + caso.nextDouble() * 0.6,
      velocita = 0.28 + caso.nextDouble() * 0.35,
      fase = caso.nextDouble() * 2 * math.pi,
      brilla = caso.nextDouble() * 2 * math.pi,
      grande = 1.1 + caso.nextDouble() * 1.7,
      sale = (caso.nextDouble() - 0.5) * 0.25;

  final double raggio;
  final double velocita;
  final double fase;
  final double brilla;
  final double grande;
  final double sale;
}

final List<_Granello> _granelli = () {
  final caso = math.Random(7);
  return [for (var i = 0; i < 22; i += 1) _Granello(caso)];
}();

/// L'orbita attorno al marchio: l'anello di luce che gira al posto della
/// rotella, e i granelli d'oro usciti dal lampo. Si disegna due volte, dietro
/// e davanti al marchio: la meta' di sopra dell'orbita passa dietro, quella
/// di sotto davanti.
class _Orbita extends CustomPainter {
  _Orbita({
    required this.tempo,
    required this.scuro,
    required this.scala,
    required this.davanti,
  }) : super(repaint: tempo);

  final ValueNotifier<double> tempo;
  final bool scuro;
  final double scala;
  final bool davanti;

  @override
  void paint(Canvas canvas, Size size) {
    final t = tempo.value;
    final l = size.shortestSide;
    final c = size.center(Offset.zero);
    if (!davanti) _anello(canvas, c, l, t);
    _iGranelli(canvas, c, l, t);
  }

  void _anello(Canvas canvas, Offset c, double l, double t) {
    final quanto = _morbido(_tra(t, _accensione + 0.2, 0.6));
    if (quanto <= 0) return;
    final r = l * (0.80 + 0.06 * (1 - quanto));
    final spessore = 2.2 * scala;
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = spessore
        ..color = (scuro ? Colors.white : const Color(0xFF0B1A3A)).withValues(
          alpha: 0.08 * quanto,
        ),
    );
    final giro = (t / 1.5) % 1.0;
    const lungo = math.pi * 0.9;
    final cerchio = Rect.fromCircle(center: c, radius: r);
    final inizio = 2 * math.pi * giro - math.pi / 2;
    canvas.drawArc(
      cerchio,
      inizio,
      lungo,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = spessore
        ..shader = SweepGradient(
          transform: GradientRotation(inizio),
          endAngle: lungo,
          colors: [
            _blu.withValues(alpha: 0),
            _blu.withValues(alpha: quanto),
            _oro.withValues(alpha: quanto),
          ],
          stops: const [0, 0.6, 1],
        ).createShader(cerchio),
    );
    /* La testa: una scintilla. */
    final a = inizio + lungo;
    final testa = c + Offset(math.cos(a), math.sin(a)) * r;
    final rt = 7 * scala;
    canvas.drawCircle(
      testa,
      rt,
      Paint()
        ..blendMode = scuro ? BlendMode.plus : BlendMode.srcOver
        ..shader = RadialGradient(
          colors: [
            _oroChiaro.withValues(alpha: 0.95 * quanto),
            _oro.withValues(alpha: 0.3 * quanto),
            _oro.withValues(alpha: 0),
          ],
        ).createShader(Rect.fromCircle(center: testa, radius: rt)),
    );
  }

  void _iGranelli(Canvas canvas, Offset c, double l, double t) {
    if (t < _accensione) return;
    /* Escono dal lampo: dal centro fino alla loro orbita. */
    final escono = Curves.easeOutCubic.transform(_tra(t, _accensione, 0.9));
    final appaiono = _tra(t, _accensione, 0.15);
    const inclinata = -0.22;
    final ci = math.cos(inclinata), si = math.sin(inclinata);
    for (final g in _granelli) {
      final a = g.fase + t * g.velocita;
      final sotto = math.sin(a) > 0;
      if (sotto != davanti) continue;
      final r = l * g.raggio * (0.25 + 0.75 * escono);
      final x = r * math.cos(a);
      final y = r * 0.36 * math.sin(a) + l * g.sale;
      final p = c + Offset(x * ci - y * si, x * si + y * ci);
      final luce = 0.55 + 0.45 * math.sin(t * 2.6 + g.brilla);
      /* Dietro sono piu' piccoli e piu' spenti: la profondita'. */
      final vicino = 0.7 + 0.3 * math.sin(a);
      final rg = g.grande * scala * (0.75 + 0.35 * vicino) * (scuro ? 1 : 1.15);
      final alfa = appaiono * luce * (0.45 + 0.55 * vicino);
      canvas.drawCircle(
        p,
        rg * 2.3,
        Paint()
          ..blendMode = scuro ? BlendMode.plus : BlendMode.srcOver
          ..color = _oro.withValues(alpha: (scuro ? 0.12 : 0.07) * alfa),
      );
      canvas.drawCircle(
        p,
        rg,
        Paint()
          ..blendMode = scuro ? BlendMode.plus : BlendMode.srcOver
          ..color = (scuro ? _oroChiaro : const Color(0xFFE09A35)).withValues(
            alpha: 0.9 * alfa,
          ),
      );
    }
  }

  @override
  bool shouldRepaint(_Orbita prima) =>
      prima.tempo != tempo ||
      prima.scuro != scuro ||
      prima.scala != scala ||
      prima.davanti != davanti;
}

/// Con le animazioni spente: tre punti fermi, blu, argento e oro.
class _TrePunti extends StatelessWidget {
  const _TrePunti({required this.scuro, required this.misura});

  final bool scuro;
  final double misura;

  @override
  Widget build(BuildContext context) {
    final d = misura * 0.7;
    Widget punto(Color c) => Container(
      width: d,
      height: d,
      margin: EdgeInsets.symmetric(horizontal: d * 0.45),
      decoration: BoxDecoration(color: c, shape: BoxShape.circle),
    );
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          punto(_blu),
          punto(scuro ? const Color(0xFFB8C4D6) : const Color(0xFF94A3B8)),
          punto(_oro),
        ],
      ),
    );
  }
}

/// Il foro che si apre nell'attesa quando se ne va.
class _Foro extends CustomClipper<Path> {
  const _Foro({required this.centro, required this.raggio});

  final Offset centro;
  final double raggio;

  @override
  Path getClip(Size size) => Path()
    ..fillType = PathFillType.evenOdd
    ..addRect(Offset.zero & size)
    ..addOval(Rect.fromCircle(center: centro, radius: raggio));

  @override
  bool shouldReclip(_Foro prima) =>
      prima.centro != centro || prima.raggio != raggio;
}

/// Il bordo d'oro del foro.
class _BordoDelForo extends CustomPainter {
  const _BordoDelForo({
    required this.centro,
    required this.raggio,
    required this.forza,
    required this.scala,
  });

  final Offset centro;
  final double raggio;
  final double forza;
  final double scala;

  @override
  void paint(Canvas canvas, Size size) {
    if (raggio <= 0) return;
    canvas.drawCircle(
      centro,
      raggio,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 14 * scala
        ..color = _oro.withValues(alpha: 0.18 * forza),
    );
    canvas.drawCircle(
      centro,
      raggio,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5 * scala
        ..color = _oroChiaro.withValues(alpha: 0.95 * forza),
    );
  }

  @override
  bool shouldRepaint(_BordoDelForo prima) =>
      prima.centro != centro ||
      prima.raggio != raggio ||
      prima.forza != forza ||
      prima.scala != scala;
}

/// L'uscita in corso, per l'attesa che sta sotto: da 0 (c'e') a 1 (andata).
class _UscitaInCorso extends InheritedWidget {
  const _UscitaInCorso({required this.via, required super.child});

  final Animation<double> via;

  static Animation<double>? di(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_UscitaInCorso>()?.via;

  @override
  bool updateShouldNotify(_UscitaInCorso prima) => prima.via != via;
}

/// L'attesa che se ne va: quando [su] diventa falso si apre in un cerchio
/// dal centro del marchio e rivela la schermata sotto, in poco piu' di mezzo
/// secondo — e da subito lascia passare i tocchi, perche' la schermata sotto
/// e' gia' li', intera. L'attesa non trattiene niente: l'uscita e' sopra una
/// schermata che funziona gia'.
///
/// Se torna [su] (una pagina che si ricarica) c'e' subito, senza entrare.
/// Con «riduci animazioni» se ne va di colpo.
class UscitaDelCaricamento extends StatefulWidget {
  const UscitaDelCaricamento({
    super.key,
    required this.su,
    required this.child,
  });

  final bool su;
  final Widget child;

  /// Quanto dura l'uscita.
  static const quantoDura = Duration(milliseconds: 560);

  @override
  State<UscitaDelCaricamento> createState() => _UscitaDelCaricamentoState();
}

class _UscitaDelCaricamentoState extends State<UscitaDelCaricamento>
    with SingleTickerProviderStateMixin {
  /* 0 l'attesa c'e', 1 e' andata. */
  late final AnimationController _via = AnimationController(
    vsync: this,
    duration: UscitaDelCaricamento.quantoDura,
    value: widget.su ? 0 : 1,
  )..addStatusListener((_) => setState(() {}));

  /* Alla fine l'ultimo pezzo sfuma: il bordo d'oro non resta tagliato. */
  late final Animation<double> _quanto = ReverseAnimation(
    CurvedAnimation(parent: _via, curve: const Interval(0.7, 1)),
  );

  @override
  void didUpdateWidget(UscitaDelCaricamento prima) {
    super.didUpdateWidget(prima);
    if (prima.su == widget.su) return;
    if (widget.su) {
      _via.value = 0;
    } else if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      _via.value = 1;
    } else {
      _via.forward();
    }
  }

  @override
  void dispose() {
    _via.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.su && _via.isCompleted) return const SizedBox.shrink();
    return IgnorePointer(
      ignoring: !widget.su,
      child: FadeTransition(
        opacity: _quanto,
        child: _UscitaInCorso(via: _via, child: widget.child),
      ),
    );
  }
}
