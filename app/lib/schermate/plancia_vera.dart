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
/// in casa non c'e' DashboardModern lo dice, e quando c'e' apre la pagina e
/// la copre finche' non e' arrivata.
library;

import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../casa/collegamento.dart';
import '../plancia/servitore_qui/qui.dart';
import '../ponte/filo.dart';
import '../vestito/pezzi.dart';
import 'da_dove.dart';
import 'riquadro/qui.dart' as riquadro;

/// Dove sta la plancia quando l'app gira sul web: li' un server dentro la
/// pagina non si puo' aprire, e il riquadro punta a un servitore acceso a
/// parte — quello del collaudo, `bin/servitore.dart`. Sul telefono questa
/// riga non c'e'.
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
  }) => RiquadroDellaPlancia(
    key: chiave,
    pagina: pagina,
    quandoCaricata: quandoCaricata,
    quandoFallisce: quandoFallisce,
  );
}

class PlanciaVera extends StatefulWidget {
  const PlanciaVera({
    super.key,
    required this.collegamento,
    required this.fabbrica,
    this.vaiAlleCase,
  });

  final Collegamento collegamento;
  final FabbricaDellaPlancia fabbrica;
  final VoidCallback? vaiAlleCase;

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

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) unawaited(_accendi());
  }

  Future<void> _accendi() async {
    _servitoreChiesto = true;
    final servitore = await widget.fabbrica.servitore(
      () => widget.collegamento.filo,
    );
    if (!mounted) return;
    setState(() => _servitore = servitore);
  }

  /// Ricarica la pagina: e' quello che fa toccare di nuovo «Plancia» nella
  /// barra quando ci si e' gia'.
  void ricarica() {
    setState(() {
      _caricata = false;
      _perche = null;
    });
    _riquadro.currentState?.ricarica();
  }

  @override
  Widget build(BuildContext context) {
    final collegamento = widget.collegamento;
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
          titolo: 'Questo telefono e\' stato staccato',
          sotto: collegamento.perche ?? 'Riabbina la casa con un quadretto nuovo dalla console del ponte.',
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
      return _Stato(
        collegamento: collegamento,
        vaiAlleCase: widget.vaiAlleCase,
        icona: Icons.dashboard_customize_rounded,
        titolo: 'Qui non c\'e\' DashboardModern',
        sotto:
            'La plancia dell\'app e\' la tua plancia di DashboardModern: '
            'installala in Home Assistant e comparira\' qui, com\'e\' li\'. '
            'Intanto, dalla barra, ci sono i dispositivi.',
      );
    }

    final Uri pagina;
    if (kIsWeb) {
      if (_planciaSulWeb.isEmpty) {
        return _Stato(
          collegamento: collegamento,
          vaiAlleCase: widget.vaiAlleCase,
          icona: Icons.phone_android_rounded,
          titolo: 'La plancia si vede sul telefono',
          sotto:
              'Sul web l\'app non puo\' aprire il server che le serve. '
              'Installala su un telefono, o accendi il servitore a parte.',
        );
      }
      pagina = Uri.parse(_planciaSulWeb);
    } else {
      final servitore = _servitore;
      if (servitore == null) {
        if (!_servitoreChiesto) unawaited(_accendi());
        return _Attesa(collegamento: collegamento, cosa: 'Accendo la plancia…');
      }
      pagina = servitore.paginaDi(pannello);
    }

    if (_pagina != pagina) {
      /* Una pagina nuova — un'altra casa, un'integrazione aggiornata — si
       * copre di nuovo finche' non arriva. */
      _pagina = pagina;
      _caricata = false;
      _perche = null;
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        widget.fabbrica.riquadro(
          pagina,
          chiave: _riquadro,
          quandoCaricata: () {
            if (mounted && !_caricata) setState(() => _caricata = true);
          },
          quandoFallisce: (perche) {
            if (mounted) setState(() => _perche = perche);
          },
        ),
        if (_perche != null)
          _Velo(
            child: StatoVuoto(
              icona: Icons.wifi_tethering_error_rounded,
              titolo: 'La plancia non e\' arrivata',
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
  });

  final Uri pagina;
  final VoidCallback quandoCaricata;
  final void Function(String perche) quandoFallisce;

  @override
  State<RiquadroDellaPlancia> createState() => RiquadroDellaPlanciaState();
}

class RiquadroDellaPlanciaState extends State<RiquadroDellaPlancia> {
  late final WebViewController _controllore = riquadro.costruisciIlControllore(
    quandoCaricata: () => widget.quandoCaricata(),
    quandoFallisce: (perche) => widget.quandoFallisce(perche),
    siPuoAndare: _dentroCasa,
  );

  /// Dal riquadro non si esce: la plancia sta tutta sul servitore, e un
  /// indirizzo di fuori e' un collegamento che non ha senso aprire qui.
  bool _dentroCasa(String indirizzo) =>
      indirizzo.startsWith(widget.pagina.origin) ||
      indirizzo.startsWith('about:');

  @override
  void initState() {
    super.initState();
    unawaited(_controllore.loadRequest(widget.pagina));
  }

  @override
  void didUpdateWidget(RiquadroDellaPlancia oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pagina != widget.pagina) {
      unawaited(_controllore.loadRequest(widget.pagina));
    }
  }

  void ricarica() => unawaited(riquadro.ricarica(_controllore, widget.pagina));

  @override
  Widget build(BuildContext context) => WebViewWidget(controller: _controllore);
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
