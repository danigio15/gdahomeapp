/// «C'è una versione nuova di gdahome: aggiornala per continuare».
///
/// Il giorno dei pagamenti (`docs/LICENZE.md`) le app della prova — che hanno
/// tutto aperto — si devono fermare, se no chi le ha non paghera' mai. Il
/// numero sotto cui ci si ferma lo decide chi tiene il centralino
/// (`VERSIONE_MINIMA_APP`) e lo dice a tutti su `GET /versioni`:
///
///     {"gdahome": {"minima": 1070000}}
///
/// **Di serie e' zero**, e zero non ferma nessuno.
///
/// ─── Chi guarda ───────────────────────────────────────────────────────────
///
/// Due, e basta uno:
///
///  - **l'app stessa**: chiede la minima al centralino di difetto
///    (`ponte/centralino.dart`, in `https`) all'avvio, tornando davanti e ogni
///    sei ore, e se [costruzioneDiQuestApp] e' piu' piccolo si copre tutta con
///    [PaginaAggiornala]. L'ultima minima la ricorda sul telefono: senza rete
///    non si riapre;
///  - **la casa**: l'app le dice il suo numero nella stretta di mano
///    (`ponte/stretta.dart`, campo `app`), e l'add-on rifiuta chi e' sotto con
///    `aggiorna-l-app`. Le app di oggi quel numero non lo dicono e questo file
///    non ce l'hanno: le ferma la casa aggiornata. Quando la casa lo dice
///    anche a quest'app, la pagina e' la stessa.
///
/// ─── Chi non si ferma mai ────────────────────────────────────────────────
///
/// L'app nel browser: la serve l'add-on, sempre fresca, ed e' sempre della
/// stessa costruzione dell'add-on. E le costruzioni di prova e le prove
/// (`kReleaseMode` falso), a meno di accenderlo apposta con
/// `--dart-define=VERSIONE_MINIMA_SEMPRE=true`.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import 'casa/dispensa/dispensa.dart';
import 'parole.dart';
import 'ponte/centralino.dart';
import 'ponte/stretta.dart' show quandoLaCasaDiceAggiorna;
import 'vestito/marchio.dart';
import 'versione.dart';

/// Ogni quanto si richiede la minima, oltre all'avvio e al ritorno davanti.
const Duration ogniQuantoSiRichiede = Duration(hours: 6);

/// Il pacchetto nel Play Store: quello pubblico, anche per chi ha la
/// costruzione di prova (`.prova`), che e' proprio chi deve passare a questa.
const String pacchettoNelPlayStore = 'com.gdahome.gdahome';

/// Il numero dell'app nell'App Store: in App Store Connect, «Informazioni
/// sull'app» → «Apple ID», solo cifre. Si scrive qui quando l'app e' nel
/// negozio; vuoto, il bottone apre la ricerca di gdahome nell'App Store.
const String numeroNellAppStore = '';

/// Dove si aggiorna sull'iPhone.
Uri get indirizzoNellAppStore => numeroNellAppStore.isEmpty
    ? Uri.parse('https://apps.apple.com/search?term=gdahome')
    : Uri.parse('https://apps.apple.com/app/id$numeroNellAppStore');

/// Dove si aggiorna su Android: prima l'app del Play Store, poi la pagina.
final Uri indirizzoNelPlayStore = Uri.parse(
  'market://details?id=$pacchettoNelPlayStore',
);
final Uri paginaDelPlayStore = Uri.parse(
  'https://play.google.com/store/apps/details?id=$pacchettoNelPlayStore',
);

/// Se quest'app si controlla da se'. Nel browser mai; nelle prove e nelle
/// costruzioni di prova solo se acceso apposta.
const bool _sempre = bool.fromEnvironment('VERSIONE_MINIMA_SEMPRE');
const bool siControllaDaSe = !kIsWeb && (kReleaseMode || _sempre);

/// Chiede la minima al centralino di difetto. `null` quando non si sa:
/// nessun centralino, nessuna rete, una risposta che non si capisce.
Future<int?> chiediLaMinimaAlCentralino() async {
  final centralino = centralinoDiDifetto;
  if (centralino == null) return null;
  try {
    final risposta = await http
        .get(centralino.versioni, headers: {'accept': 'application/json'})
        .timeout(const Duration(seconds: 15));
    if (risposta.statusCode != 200) return null;
    return minimaDa(jsonDecode(risposta.body));
  } catch (_) {
    return null;
  }
}

/// La minima di gdahome in una risposta di `/versioni`, o `null`.
int? minimaDa(Object? detto) {
  if (detto is! Map) return null;
  final gdahome = detto['gdahome'];
  if (gdahome is! Map) return null;
  final minima = gdahome['minima'];
  return minima is int && minima >= 0 ? minima : null;
}

/// Quello che l'app sa della versione minima, e se deve fermarsi.
class VersioneMinima extends ChangeNotifier {
  VersioneMinima({
    this.questa = costruzioneDiQuestApp,
    Future<int?> Function()? chiedi,
    Dispensa? dispensa,
    this.attiva = siControllaDaSe,
    this.ogni = ogniQuantoSiRichiede,
  }) : _chiedi = chiedi ?? chiediLaMinimaAlCentralino,
       // ignore: prefer_initializing_formals
       _dispensa = dispensa;

  /// Il numero di quest'app.
  final int questa;

  /// Se si puo' fermare. Spenta, non chiede niente e non copre niente.
  final bool attiva;

  final Duration ogni;
  final Future<int?> Function() _chiedi;
  Dispensa? _dispensa;

  Dispensa get _laDispensa =>
      _dispensa ??= dispensaDiQuestoSistema(nome: 'versione_minima.json');

  int _minima = 0;
  bool _laCasa = false;
  Timer? _orologio;
  Future<void>? _inCorso;
  bool _partita = false;

  /// L'ultima minima saputa. Zero: nessuna.
  int get minima => _minima;

  /// Se l'app va coperta con [PaginaAggiornala].
  bool get bloccata => attiva && (questa < _minima || _laCasa);

  /// Si accende: legge l'ultima minima, la richiede, e poi ogni [ogni].
  Future<void> parti() async {
    if (!attiva || _partita) return;
    _partita = true;
    await _leggi();
    _orologio = Timer.periodic(ogni, (_) => unawaited(chiedi()));
    await chiedi();
  }

  /// Chiede la minima. Non solleva: senza risposta resta quella di prima.
  Future<void> chiedi() {
    if (!attiva) return Future<void>.value();
    return _inCorso ??= () async {
      try {
        final detta = await _chiedi();
        if (detta != null) await _segna(detta);
      } catch (_) {
        /* Resta quella di prima. */
      } finally {
        _inCorso = null;
      }
    }();
  }

  /// La casa ha rifiutato quest'app con `aggiorna-l-app`.
  ///
  /// Se ha detto la minima e quest'app e' sotto, la si ricorda come quella
  /// del centralino; comunque sia, per questa volta si copre l'app. Non si
  /// ricorda il «no» in se': la prossima volta lo si richiede alla casa, e se
  /// nel frattempo la minima e' tornata giu' si riapre.
  void laCasaHaDettoDiNo(int? minima) {
    if (!attiva) return;
    final prima = bloccata;
    _laCasa = true;
    if (minima != null && minima > questa && minima != _minima) {
      unawaited(_segna(minima));
      return;
    }
    if (bloccata != prima) notifyListeners();
  }

  Future<void> _leggi() async {
    try {
      final testo = await _laDispensa.leggi();
      if (testo == null) return;
      final letta = jsonDecode(testo);
      final minima = letta is Map ? letta['minima'] : null;
      if (minima is int && minima >= 0 && minima != _minima) {
        _minima = minima;
        notifyListeners();
      }
    } catch (_) {
      /* Illeggibile: come se non ci fosse. */
    }
  }

  Future<void> _segna(int minima) async {
    if (minima == _minima) return;
    _minima = minima;
    notifyListeners();
    try {
      await _laDispensa.scrivi(jsonEncode({'minima': minima}));
    } catch (_) {
      /* Resta in memoria. */
    }
  }

  @override
  void dispose() {
    _orologio?.cancel();
    super.dispose();
  }
}

/// Quella dell'app: una sola, perche' la stessa cosa la dicono il centralino
/// e la casa (`ponte/stretta.dart`), e la pagina e' una.
final VersioneMinima laVersioneMinima = VersioneMinima();

/// Accende tutto, da `main`: la domanda al centralino, e l'orecchio al «no»
/// della casa.
void accendiLaVersioneMinima([VersioneMinima? versione]) {
  final quale = versione ?? laVersioneMinima;
  quandoLaCasaDiceAggiorna = quale.laCasaHaDettoDiNo;
  unawaited(quale.parti());
}

/// Apre il negozio giusto per aggiornare.
Future<void> apriIlNegozio() async {
  Future<bool> prova(Uri dove) async {
    try {
      return await launchUrl(dove, mode: LaunchMode.externalApplication);
    } catch (_) {
      return false;
    }
  }

  if (defaultTargetPlatform == TargetPlatform.iOS) {
    await prova(indirizzoNellAppStore);
    return;
  }
  if (await prova(indirizzoNelPlayStore)) return;
  await prova(paginaDelPlayStore);
}

/// Sta sopra tutta l'app e, quando serve, la copre con [PaginaAggiornala].
///
/// Si mette in cima all'albero, sopra il navigatore e sopra il velo del
/// lucchetto: quando e' bloccata non si vede e non si tocca nient'altro.
/// Tornando davanti richiede la minima.
class AggiornamentoObbligatorio extends StatefulWidget {
  const AggiornamentoObbligatorio({
    super.key,
    required this.child,
    this.versione,
    this.apri,
  });

  final Widget child;

  /// Di solito [laVersioneMinima]; nelle prove una fatta apposta.
  final VersioneMinima? versione;

  /// Cosa fa il bottone: di solito [apriIlNegozio].
  final Future<void> Function()? apri;

  @override
  State<AggiornamentoObbligatorio> createState() =>
      _AggiornamentoObbligatorioState();
}

class _AggiornamentoObbligatorioState extends State<AggiornamentoObbligatorio>
    with WidgetsBindingObserver {
  VersioneMinima get _versione => widget.versione ?? laVersioneMinima;

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

  @override
  void didChangeAppLifecycleState(AppLifecycleState stato) {
    if (stato == AppLifecycleState.resumed) unawaited(_versione.chiedi());
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _versione,
      child: widget.child,
      builder: (context, sotto) {
        final ferma = _versione.bloccata;
        return Stack(
          fit: StackFit.expand,
          children: [
            Offstage(
              offstage: ferma,
              child: TickerMode(
                enabled: !ferma,
                child: sotto ?? const SizedBox.shrink(),
              ),
            ),
            if (ferma) PaginaAggiornala(apri: widget.apri ?? apriIlNegozio),
          ],
        );
      },
    );
  }
}

/// La pagina che ferma l'app: cosa succede, e il bottone per il negozio.
class PaginaAggiornala extends StatelessWidget {
  const PaginaAggiornala({super.key, required this.apri, this.iPhone});

  final Future<void> Function() apri;

  /// Per le fotografie: di solito lo dice il sistema.
  final bool? iPhone;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final suIPhone = iPhone ?? defaultTargetPlatform == TargetPlatform.iOS;
    return Material(
      color: const Color(0xFF0B1220),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 48, 28, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(child: Marchio(lato: 76)),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 88,
                      height: 88,
                      decoration: BoxDecoration(
                        color: const Color(0xFF16233A),
                        borderRadius: BorderRadius.circular(26),
                        border: Border.all(color: const Color(0xFF24344F)),
                      ),
                      child: const Icon(
                        Icons.system_update_rounded,
                        size: 44,
                        color: Color(0xFF7DD3FC),
                      ),
                    ),
                    const SizedBox(height: 26),
                    Text(
                      inLingua(
                        it: 'C\'è una versione nuova di gdahome',
                        en: 'There\'s a new version of gdahome',
                      ),
                      textAlign: TextAlign.center,
                      style: testi.headlineSmall?.copyWith(
                        color: const Color(0xFFF8FAFC),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      inLingua(
                        it:
                            'Aggiornala per continuare. Le tue case, le '
                            'plance e i telefoni abbinati restano come sono.',
                        en:
                            'Update it to continue. Your homes, dashboards '
                            'and paired phones stay as they are.',
                      ),
                      textAlign: TextAlign.center,
                      style: testi.bodyMedium?.copyWith(
                        color: const Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                onPressed: () => unawaited(apri()),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(54),
                ),
                icon: const Icon(Icons.download_rounded),
                label: Text(
                  suIPhone
                      ? inLingua(
                          it: 'Aggiorna dall\'App Store',
                          en: 'Update from the App Store',
                        )
                      : inLingua(
                          it: 'Aggiorna dal Play Store',
                          en: 'Update from Google Play',
                        ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                inLingua(
                  it: 'Questa è la $numeroDiQuestApp',
                  en: 'This is $numeroDiQuestApp',
                ),
                textAlign: TextAlign.center,
                style: testi.bodySmall?.copyWith(
                  color: const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
