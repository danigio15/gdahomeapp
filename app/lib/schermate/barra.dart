/// La barra delle sezioni: laterale, a scomparsa.
///
/// Sta fuori dallo schermo, oltre il bordo sinistro, e si chiama con la
/// **maniglia** — la pillola sempre visibile a meta' altezza — o tirandola
/// dentro col dito. Non e' un vezzo: una barra sempre presente si mangia una
/// fascia di schermo su ogni pagina, e su un telefono quella fascia e' l'unica
/// cosa che non si puo' comprare. Cosi' invece la si vede quando serve e
/// sparisce da sola quando non serve piu'.
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
/// barra resta, la maniglia sparisce, e toccare fuori non la chiude piu'
/// — vedi `vestito/quanto_e_largo.dart`.
library;

import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../vestito/oggetti.dart';
import '../vestito/quanto_e_largo.dart';
import 'da_dove.dart';
import 'menu.dart';

/// Quanto resta aperta se non si tocca niente.
const _daSola = Duration(seconds: 4);

/// Quanto resta dopo che si e' scelto: il tempo di vedere che si e' premuto.
const _dopoLaScelta = Duration(milliseconds: 700);

/// Quanto e' larga la fascia sul bordo dove il dito la puo' tirare dentro.
const double _fasciaDelGesto = 44;

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
  });

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

  bool get aperta => _resta || _molla.value > 0.02;

  @override
  void dispose() {
    _daChiudere?.cancel();
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
    if (dove != widget.aperta) widget.vai(dove);
  }

  /* Finche' la si sta usando non se ne va. Scorrere quindici voci per trovare
   * la propria non si fa in quattro secondi, e una barra che sparisce sotto il
   * dito mentre la si scorre e' peggio di una barra che resta. Il conto alla
   * rovescia riparte a ogni tocco: quando il dito si ferma, riprende a
   * scorrere il tempo, non prima. */
  void _laStaUsando() {
    if (aperta && !_resta) _rimanda(_daSola);
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
               * pezzo di schermo restava non impaginato — la barra c'era
               * nell'albero e non si vedeva, e la maniglia accanto continuava
               * a funzionare, che e' il modo peggiore di rompersi. */
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
                                      );
                                    },
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
            /* La maniglia serve a chiamare una barra che non c'e'. Dove la
             * barra c'e' sempre, e' una pillola che non fa niente accanto a
             * una cosa gia' aperta. */
            if (!_resta)
              _LaManiglia(
                quanto: quanto,
                alzata: aperta,
                quandoPremuta: () => aperta ? chiudi() : apri(),
                quandoTirata: (dentro) => dentro ? apri() : chiudi(),
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
                        collegamento.casa?.nome ?? 'Casa',
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
  });

  static const double altezza = 40;
  static const double spazio = 2;

  final Sezione sezione;
  final bool scelta;
  final VoidCallback quandoPremuta;

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
              ],
            ),
          ),
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

/// La maniglia: la pillola sempre visibile che chiama la barra.
///
/// E' l'unica cosa che resta a schermo, ed e' anche l'unica indicazione che
/// una barra ci sia: percio' non si nasconde mai, e la fascia che raccoglie il
/// dito e' molto piu' larga della pillola che si vede.
class _LaManiglia extends StatelessWidget {
  const _LaManiglia({
    required this.quanto,
    required this.alzata,
    required this.quandoPremuta,
    required this.quandoTirata,
  });

  final double quanto;
  final bool alzata;
  final VoidCallback quandoPremuta;

  /// `true` quando il dito la tira dentro, `false` quando la butta fuori.
  final void Function(bool dentro) quandoTirata;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Positioned(
      /* Sta sul bordo, e quando la barra e' dentro si sposta accanto a lei. */
      left: 2 + (_larghezzaDellaBarra + 12) * quanto.clamp(0, 1),
      top: 0,
      bottom: 0,
      child: Center(
        child: Semantics(
          button: true,
          label: nomeDellaManiglia,
          /* L'azione va dichiarata qui, non solo sul riconoscitore di gesti
           * sotto: chi non vede preme il **nome**, e sul web il browser stende
           * sopra la tela un riquadro invisibile per ogni cosa che ha un nome.
           * Se quel riquadro non sa cosa fare, il tocco muore li' e sotto non
           * arriva niente. */
          onTap: quandoPremuta,
          child: GestureDetector(
            excludeFromSemantics: true,
            behavior: HitTestBehavior.opaque,
            onTap: quandoPremuta,
            /* Tirare dentro la chiama, buttare fuori la manda via: e' il gesto
             * che si fa senza pensarci, e non c'e' niente da imparare. */
            onHorizontalDragEnd: (gesto) {
              final velocita = gesto.velocity.pixelsPerSecond.dx;
              if (velocita > 60) {
                quandoTirata(true);
              } else if (velocita < -60) {
                quandoTirata(false);
              }
            },
            child: SizedBox(
              width: _fasciaDelGesto,
              height: 160,
              child: Center(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 6,
                  height: 70,
                  decoration: BoxDecoration(
                    color: colori.onSurface.withValues(
                      alpha: alzata ? 0.45 : 0.3,
                    ),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ),
          ),
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

/// Come si chiama la maniglia per chi non la vede: il lettore di schermo la
/// legge cosi', e le prove la cercano con questo nome.
///
/// Non «Sezioni» e basta: quella parola sta anche nell'intestazione dei widget
/// — «22 sezioni · 2 chiedono attenzione» — e chi cerca per testo finirebbe a
/// premere quella riga. Un nome deve essere di una cosa sola.
const nomeDellaManiglia = 'Barra delle sezioni';

/// Come si chiama, per chi non la vede, la riga in cima alla barra che porta
/// all'elenco delle case.
const nomeDelleCase = 'Le tue case';

/// Quanta aria lasciare sul fianco sinistro della pagina, per non finire
/// sotto la maniglia.
const double spazioPerLaBarra = 10;

/// Quanto posto vuole la barra quando resta aperta: la sua larghezza piu'
/// l'aria che si tiene ai due lati.
const double spazioPerLaBarraFerma = _larghezzaDellaBarra + 22;

/// Quanto lasciare a sinistra al contenuto, su questo schermo.
double quantoPerLaBarra(BuildContext contesto) =>
    QuantoELargo.di(contesto).laBarraResta
    ? spazioPerLaBarraFerma
    : spazioPerLaBarra;
