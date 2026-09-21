/// L'app di casa.
///
/// Il portone tiene aperto **un** collegamento — una casa alla volta — e decide
/// cosa far vedere: la schermata per aggiungere una casa se non ce n'e'
/// nessuna, la home se c'e'. Tutto quello che le schermate sanno della rete
/// passa da li'.
library;

import 'dart:async';

import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'casa/archivio_delle_case.dart';
import 'casa/cassaforte.dart';
import 'casa/collegamento.dart';
import 'casa/il_lucchetto.dart';
import 'casa/impostazioni.dart';
import 'casa/la_guardia.dart';
import 'parole.dart';
import 'ponte/centralino.dart';
import 'schermate/aggiungi_casa.dart';
import 'schermate/home.dart';
import 'schermate/le_case.dart';
import 'schermate/misure.dart';
import 'schermate/plancia_vera.dart';
import 'schermate/riconoscimento.dart';
import 'vestito/sfondo.dart';
import 'vestito/tema.dart';

/// Acceso solo nella versione costruita per il collaudo, con
/// `--dart-define=COLLAUDO=true`.
///
/// Serve a una cosa sola: **poter guardare l'app da fuori**. Flutter disegna
/// su una tela, quindi in una pagina web non c'e' nessun bottone da premere e
/// nessun testo da leggere per chi non ha gli occhi — un programma che guida
/// il browser, o una persona che usa un lettore di schermo. L'albero
/// dell'accessibilita' e' quello che li rimette, ed e' anche il motivo per cui
/// tenerlo acceso non e' un trucco da collaudo: e' la stessa cosa che serve a
/// chi l'app la usa senza vederla.
///
/// `bool.fromEnvironment` si decide quando si costruisce, non quando si gira:
/// nella versione che va sui telefoni questa riga non c'e' proprio.
const bool _perIlCollaudo = bool.fromEnvironment('COLLAUDO');

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  /* **Niente app a tutto schermo.**
   *
   * L'avevo accesa perche' la plancia sembrasse una pagina sola invece che
   * una pagina dentro una cornice. Il prezzo, sul telefono, era che il
   * riquadro finiva sotto i tasti di Android: la barra della plancia sta a
   * diciotto punti dal fondo della sua finestra, e se la finestra arriva
   * sotto i tasti quei diciotto punti ci finiscono in mezzo. Per rimetterla
   * a posto bisogna sapere quanto sono alti quei tasti, e quel numero — qui,
   * su questo telefono — non arrivava: si leggeva zero. Senza il numero non
   * c'e' regola che tenga, e allora si lascia fare al telefono: la finestra
   * si ferma dove cominciano i tasti, e la barra della plancia sta dove
   * deve. L'aria in cima resta poca lo stesso, che quella la decide la
   * pagina. */
  if (_perIlCollaudo) {
    SemanticsBinding.instance.ensureSemantics();
  }
  /* In che lingua parla l'app: la decide il telefono.
   *
   * Si decide **prima** di disegnare, e non dentro una schermata, perche' le
   * frasi non stanno tutte dentro una schermata: ci sono quelle del filo e
   * quelle della pagina che il servitore compone da se' (vedi
   * `parole.dart`). */
  laLingua = linguaPer([
    for (final quale in WidgetsBinding.instance.platformDispatcher.locales)
      quale.languageCode,
  ]);
  runApp(const AppDiCasa());
}

class AppDiCasa extends StatefulWidget {
  const AppDiCasa({
    super.key,
    this.cassaforte,
    this.collegamento,
    this.plancia,
  });

  /// Sostituibili nelle prove, dove il portachiavi, la rete e il WebView non
  /// ci sono.
  final Cassaforte? cassaforte;
  final Collegamento? collegamento;
  final FabbricaDellaPlancia? plancia;

  @override
  State<AppDiCasa> createState() => _AppDiCasaState();
}

class _AppDiCasaState extends State<AppDiCasa> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /* La lingua del telefono cambiata mentre l'app e' aperta.
   *
   * Succede: si va nelle impostazioni, si cambia lingua, si torna. L'app si
   * ridisegna nella lingua nuova senza riaprirla.
   *
   * La plancia no: quella e' una pagina, e la sua lingua l'ha decisa il
   * servitore quando l'ha aperta. Si rimette in pari alla prima ricarica —
   * toccare «Plancia» quando ci si e' gia' — e non si ricarica da qui: una
   * pagina che si ricarica da sola mentre uno guarda la casa e' peggio di una
   * scritta in due lingue per un minuto. */
  @override
  void didChangeLocales(List<Locale>? quelle) {
    final adesso = linguaPer([
      for (final quale in quelle ?? const <Locale>[]) quale.languageCode,
    ]);
    if (adesso == laLingua) return;
    setState(() => laLingua = adesso);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'gdahome',
      debugShowCheckedModeBanner: false,
      theme: temaChiaro(),
      darkTheme: temaScuro(),
      /* La lingua: la stessa che hanno scelto le nostre frasi, e non una che
       * Flutter si ricava da se'. Se le due divergessero si vedrebbe un'app
       * italiana col menu «Paste» dentro le sue caselle. */
      locale: Locale(laLingua.codice),
      supportedLocales: [
        for (final quale in Lingua.values) Locale(quale.codice),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      /* Il fondo vivo sta qui, sotto tutte le schermate e una volta sola: se
       * lo mettesse ogni pagina, gli aloni ripartirebbero da capo a ogni
       * cambio di pagina, e sarebbe un lampo invece di un cielo. */
      builder: (context, schermata) =>
          SfondoVivo(child: schermata ?? const SizedBox.shrink()),
      home: Portone(
        cassaforte: widget.cassaforte,
        collegamento: widget.collegamento,
        plancia: widget.plancia,
      ),
    );
  }
}

class Portone extends StatefulWidget {
  const Portone({
    super.key,
    this.cassaforte,
    this.collegamento,
    this.plancia,
    this.impostazioni,
    this.guardia,
  });

  final Cassaforte? cassaforte;
  final Collegamento? collegamento;
  final FabbricaDellaPlancia? plancia;
  final Impostazioni? impostazioni;

  /// Chi chiede il volto e l'impronta. Nelle prove se ne mette una finta.
  final LaGuardia? guardia;

  @override
  State<Portone> createState() => _PortoneState();
}

/// Quanto si aspetta, con l'app non davanti, prima di chiudere il filo.
///
/// Mezzo minuto: chi guarda un messaggio e torna, o chi cambia finestra sul
/// computer, non rifa' la strada da capo; chi mette il telefono in tasca o
/// lascia una scheda aperta dietro le altre smette di far pagare richieste a
/// nessuno.
const quantoSiAspettaPrimaDiRiposare = Duration(seconds: 30);

class _PortoneState extends State<Portone> with WidgetsBindingObserver {
  late final Collegamento _collegamento;
  /* La guardia del telefono: nel browser e nelle prove non c'e', e allora il
   * lucchetto non si mette e l'app si apre com'e' sempre stata. */
  late final LaGuardia _guardia =
      widget.guardia ??
      (kIsWeb ? const NessunaGuardia() : LaGuardiaDelTelefono());
  late final FabbricaDellaPlancia _plancia =
      widget.plancia ?? FabbricaDellaPlancia();
  late final Impostazioni _impostazioni =
      widget.impostazioni ??
      Impostazioni(
        sulTelefono: !kIsWeb,
        android: !kIsWeb && defaultTargetPlatform == TargetPlatform.android,
      );
  bool _pronto = false;
  StreamSubscription<void>? _ascolto;

  /* ─── Il lucchetto (#54) ───────────────────────────────────────────────── */

  /// Il velo e' su: finche' non si passa, l'app non c'e'.
  bool _chiuso = false;

  /// Con cosa questo telefono puo' rispondere, adesso.
  Set<ComeRiconosce> _conCosa = const {};

  /// Il telefono non sa proprio rispondere: allora non si propone «Riprova»,
  /// che non porterebbe da nessuna parte.
  bool _nonSaFarlo = false;

  /// Quando l'app e' stata lasciata. `null` finche' non se ne va.
  DateTime? _lasciataIl;

  /// Una domanda per volta: il sistema ne tiene aperta una sola, e chiederne
  /// due vuol dire la seconda che fallisce da sola.
  bool _staChiedendo = false;
  /* Se l'app non torna davanti entro questo tempo, il filo si chiude. */
  Timer? _seNonTorna;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Misure.io.accendi();
    unawaited(_impostazioni.carica());
    _collegamento =
        widget.collegamento ??
        Collegamento(
          archivio: ArchivioDelleCase(
            widget.cassaforte ?? const CassaforteDelSistema(),
          ),
        );
    _accendi();
  }

  /* Quando l'app torna in primo piano il filo si controlla subito: un
   * telefono messo in tasca ha quasi sempre un socket morto in mano, e
   * aspettare che se ne accorga il battito voleva dire una plancia ferma per
   * un paio di minuti.
   *
   * E quando l'app se ne va, dopo un po' il filo si chiude. Non per la
   * batteria: per le **richieste**. Da fuori casa ogni messaggio passa dal
   * centralino, dove e' una richiesta contata — centomila al giorno sul piano
   * gratuito — e la casa continuava a mandare i suoi cinque eventi al secondo
   * anche con l'app in tasca e con la scheda del browser nascosta dietro le
   * altre. Una scheda dimenticata aperta si mangiava la giornata di tutti.
   *
   * Non subito, pero': chi guarda un messaggio e torna dopo due secondi non
   * deve rifare la strada da capo. */
  @override
  void didChangeAppLifecycleState(AppLifecycleState stato) {
    if (stato == AppLifecycleState.resumed) {
      _seNonTorna?.cancel();
      _seNonTorna = null;
      _collegamento.sveglia();
      unawaited(_seSiRichiude());
      return;
    }
    /* Da quando e' stata lasciata: il lucchetto al ritorno si chiude solo se
     * e' passato piu' di un minuto, e senza quest'ora non si saprebbe. Si
     * segna la prima volta che se ne va e non a ogni scossone: `inactive` e
     * `paused` arrivano tutt'e due, e riscriverla vorrebbe dire un conto che
     * riparte da zero mentre il telefono e' gia' in tasca. */
    _lasciataIl ??= DateTime.now();
    _seNonTorna ??= Timer(quantoSiAspettaPrimaDiRiposare, () {
      _seNonTorna = null;
      unawaited(_collegamento.riposa());
    });
  }

  /* ─── Il lucchetto ─────────────────────────────────────────────────────── */

  /// Il lucchetto all'apertura dell'app.
  Future<void> _seSiApre() async {
    final sa = await _guardia.cosaSaFare();
    if (!mounted) return;
    if (!siDeveChiedere(_impostazioni.lucchetto, sa)) return;
    setState(() {
      _chiuso = true;
      _conCosa = conCosaSiChiede(_impostazioni.lucchetto, sa);
    });
    await _chiedi();
  }

  /// E tornandoci, se e' stata lasciata abbastanza a lungo.
  Future<void> _seSiRichiude() async {
    final lasciata = _lasciataIl;
    _lasciataIl = null;
    if (lasciata == null || _chiuso) return;
    final sa = await _guardia.cosaSaFare();
    if (!mounted) return;
    final quanto = DateTime.now().difference(lasciata);
    if (!siDeveChiedere(_impostazioni.lucchetto, sa, lasciataDa: quanto)) {
      return;
    }
    setState(() {
      _chiuso = true;
      _conCosa = conCosaSiChiede(_impostazioni.lucchetto, sa);
    });
    await _chiedi();
  }

  /// Chiede, e apre se si passa.
  Future<void> _chiedi() async {
    if (_staChiedendo) return;
    _staChiedendo = true;
    try {
      final andata = await _guardia.chiedi(perche: perche(null));
      if (!mounted) return;
      setState(() {
        /* «Non sa farlo» apre lo stesso, e non e' clemenza: e' che un'app che
         * non si apre piu' si cura disinstallandola, e con lei se ne va
         * l'abbinamento. Il velo resta con scritto cosa e' successo finche'
         * chi guarda non preme «Entra lo stesso». */
        if (andata == ComeEAndata.si) _chiuso = false;
        _nonSaFarlo = andata == ComeEAndata.nonSaFarlo;
      });
    } finally {
      _staChiedendo = false;
    }
  }

  Future<void> _accendi() async {
    if (!_collegamento.archivio.aperto) await _collegamento.archivio.apri();
    /* Una volta sola. Da li' in poi il collegamento si gestisce da solo — si
     * riconnette, cambia approdo, cambia casa — e riavviarlo a ogni
     * ricostruzione vorrebbe dire buttare giu' il filo ogni volta che gira lo
     * schermo. */
    if (!_collegamento.avviato) await _collegamento.apri();
    if (!mounted) return;
    setState(() => _pronto = true);
    /* Il lucchetto qui e non prima: si decide su quello che c'e' scritto
     * nelle impostazioni, e quelle si leggono dal disco. Chiederlo prima
     * vorrebbe dire chiederlo sempre col lucchetto spento. */
    unawaited(_seSiApre());
    /* Solo i cambiamenti del collegamento — la casa, lo stato, l'approdo —
     * non quelli delle entita': quelli arrivano decine di volte al secondo,
     * e da qui si ridisegna tutta l'app. */
    _ascolto = _collegamento.cambiamenti.listen((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _seNonTorna?.cancel();
    _ascolto?.cancel();
    Misure.io.spegni();
    _impostazioni.chiudi();
    _collegamento.chiudi();
    super.dispose();
  }

  Future<void> _aggiungiUnaCasa() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (contesto) => AggiungiCasa(
          centralino: centralinoDiDifetto,
          archivio: _collegamento.archivio,
          quandoFatto: (_) async {
            Navigator.of(contesto).pop();
            await _collegamento.apri();
          },
        ),
      ),
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (!_pronto) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    /* Il velo sta **sopra** tutto, e non dentro una schermata: sotto non ci
     * deve essere niente da vedere — non l'elenco delle case, non il nome
     * della casa aperta, non una plancia che intanto si carica. */
    if (_chiuso) {
      return Scaffold(
        body: IlVeloDelRiconoscimento(
          conCosa: _conCosa,
          casa: _collegamento.casa?.nome ?? '',
          nonSaFarlo: _nonSaFarlo,
          quandoRiprova: _nonSaFarlo
              ? () => setState(() => _chiuso = false)
              : () => unawaited(_chiedi()),
        ),
      );
    }
    if (_collegamento.archivio.vuoto) {
      return AggiungiCasa(
        centralino: centralinoDiDifetto,
        archivio: _collegamento.archivio,
        quandoFatto: (_) => _collegamento.apri(),
      );
    }
    return Home(
      collegamento: _collegamento,
      plancia: _plancia,
      impostazioni: _impostazioni,
      vaiAlleCase: () async {
        await Navigator.of(context).push<void>(
          MaterialPageRoute(
            builder: (_) => LeCase(
              collegamento: _collegamento,
              aggiungiUnaCasa: _aggiungiUnaCasa,
              impostazioni: _impostazioni,
              guardia: _guardia,
            ),
          ),
        );
        if (mounted) setState(() {});
      },
    );
  }
}
