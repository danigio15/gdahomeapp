/// La scheda «Novità» dopo un aggiornamento, e la pagina con tutte le note.
///
/// «Cosa è cambiato? Non ci sto più dietro.» L'app si aggiorna da sola dai
/// negozi, e da una settimana all'altra un menu ha una voce in piu' o il
/// navigatore fa una cosa nuova senza che nessuno l'abbia detto. Le note
/// c'erano — `app/CHANGELOG.md`, le stesse della release — ma stavano su
/// GitHub, dove chi usa l'app non va.
///
/// Adesso le dice l'app, in due posti:
///
///  - una **scheda breve** la prima volta che si apre dopo un aggiornamento:
///    il titolo con la versione, i punti di questa versione (cinque al
///    massimo, ognuno col suo titolo in grassetto e una frase) e «Ho capito».
///    Sul telefono sale dal basso; su un tablet o sul Mac, dove un foglio
///    largo tutto lo schermo sarebbe una riga da novecento punti, e' una
///    finestra in mezzo;
///  - la **pagina «Novità»** in Impostazioni app, che si ritrova sempre e
///    tiene le versioni una sotto l'altra, dalla piu' nuova.
///
/// Quando e se mostrare la scheda lo decide `casa/novita.dart`; quando la si
/// puo' mostrare — l'app davanti, la home a schermo, niente lucchetto sopra —
/// lo decide la home (`home.dart`), che e' l'unica a saperlo.
///
/// ## La lingua
///
/// Le note si scrivono in italiano, e solo in italiano. In inglese la scheda
/// mette in inglese quello che e' dell'app (il titolo, i tasti) e lascia le
/// note come sono, dicendolo in una riga: una traduzione inventata qui
/// sarebbe una seconda versione delle note che nessuno ha riletto.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;

import '../casa/impostazioni.dart';
import '../casa/novita.dart';
import '../parole.dart';
import '../versione.dart';
import '../vestito/markdown.dart' show iSegniDi;
import '../vestito/pezzi.dart';
import '../vestito/quanto_e_largo.dart';
import '../vestito/tema.dart';

/// Dove sta il `CHANGELOG.md` dentro il pacchetto (`pubspec.yaml`).
const doveStannoLeNote = 'CHANGELOG.md';

/// Il `CHANGELOG.md` dell'app, come e' entrato nel pacchetto.
Future<String> leggiLeNoteDellApp() => rootBundle.loadString(doveStannoLeNote);

/// Quanti punti al massimo nella scheda dell'apertura: e' una scheda da
/// leggere in dieci secondi, non la pagina delle note.
const quantiPuntiNellaScheda = 5;

/// Le novita' di questa app: le note lette una volta, e cosa si e' gia' visto.
class LeNovitaDellApp {
  LeNovitaDellApp({
    required this.impostazioni,
    this.adesso = versioneDiQuestApp,
    Future<String> Function()? note,
  }) : _leggi = note ?? leggiLeNoteDellApp;

  final Impostazioni impostazioni;

  /// La versione di questa app.
  final String adesso;

  final Future<String> Function() _leggi;
  Future<List<LeNoteDiUnaVersione>>? _note;

  /// Le note di tutte le versioni, lette la prima volta che servono. Un file
  /// che non si legge vale come un file senza note: niente scheda, e la
  /// pagina lo dice.
  Future<List<LeNoteDiUnaVersione>> note() => _note ??= () async {
    try {
      return leNoteDelChangelog(await _leggi());
    } catch (_) {
      return const <LeNoteDiUnaVersione>[];
    }
  }();

  /// Le note da far vedere nella pagina: fino a questa versione.
  Future<List<LeNoteDiUnaVersione>> perLaPagina() async =>
      leNoteFinoA(adesso, await note());

  /// L'installazione nuova: si segna la versione e basta, cosi' la scheda
  /// non compare a chi l'app non l'ha mai vista prima.
  ///
  /// [primaVolta] lo sa chi apre l'app: nessuna casa nell'archivio, e
  /// nessuna versione scritta nelle impostazioni.
  Future<void> seEAppenaArrivata({required bool primaVolta}) async {
    if (!primaVolta || impostazioni.novitaViste != null) return;
    await impostazioni.metti(novitaViste: adesso);
  }

  /// Cosa c'e' da mostrare adesso, se c'e'. `null` anche quando le
  /// impostazioni non sono ancora lette: senza, non si sa cosa si e' visto.
  Future<LeNovitaDaMostrare?> daMostrare() async {
    if (!impostazioni.caricate) return null;
    return cosaMostrareAllApertura(
      vista: impostazioni.novitaViste,
      adesso: adesso,
      note: await note(),
    );
  }

  /// Viste: da qui in poi la scheda non ricompare fino alla prossima
  /// versione. Si scrive anche quando non c'era niente da far vedere (una
  /// versione senza note, un'app tornata indietro), cosi' la volta dopo il
  /// conto parte da qui.
  Future<void> viste() async {
    if (impostazioni.novitaViste == adesso) return;
    await impostazioni.metti(novitaViste: adesso);
  }
}

/// Apre la scheda delle novita': sale dal basso sul telefono, e in mezzo
/// allo schermo su un tablet o sul Mac. Torna quando si chiude, comunque la
/// si chiuda.
///
/// [versioniPrecedenti] apre la pagina con tutte le note: il link c'e' solo
/// se c'e' qualcosa in piu' da leggere (versioni saltate, o punti oltre i
/// cinque della scheda).
Future<void> apriLaSchedaDelleNovita(
  BuildContext context, {
  required LeNovitaDaMostrare cosa,
  VoidCallback? versioniPrecedenti,
}) async {
  final ferma = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
  final largo = QuantoELargo.di(context) != QuantoELargo.telefono;
  var aprireLaPagina = false;
  final altro =
      versioniPrecedenti != null &&
      (cosa.saltate > 0 || cosa.note.punti.length > quantiPuntiNellaScheda);
  Widget laScheda(BuildContext dentro) => SchedaDelleNovita(
    cosa: cosa,
    inFinestra: largo,
    quandoHoCapito: () => Navigator.of(dentro).pop(),
    quandoVersioniPrecedenti: altro
        ? () {
            aprireLaPagina = true;
            Navigator.of(dentro).pop();
          }
        : null,
  );
  if (largo) {
    await showDialog<void>(
      context: context,
      animationStyle: ferma ? AnimationStyle.noAnimation : null,
      builder: (dentro) => Dialog(
        key: const Key('novita-finestra'),
        backgroundColor: Theme.of(dentro).colorScheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(32),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        clipBehavior: Clip.antiAlias,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: 480,
            maxHeight: MediaQuery.sizeOf(dentro).height * 0.86,
          ),
          child: laScheda(dentro),
        ),
      ),
    );
  } else {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      sheetAnimationStyle: ferma ? AnimationStyle.noAnimation : null,
      constraints: const BoxConstraints(maxWidth: 600),
      builder: (dentro) => ConstrainedBox(
        key: const Key('novita-foglio'),
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(dentro).height * 0.86,
        ),
        child: laScheda(dentro),
      ),
    );
  }
  if (aprireLaPagina) versioniPrecedenti?.call();
}

/// Il contenuto della scheda: lo stesso nel foglio e nella finestra.
class SchedaDelleNovita extends StatelessWidget {
  const SchedaDelleNovita({
    super.key,
    required this.cosa,
    required this.quandoHoCapito,
    this.quandoVersioniPrecedenti,
    this.inFinestra = false,
  });

  final LeNovitaDaMostrare cosa;
  final VoidCallback quandoHoCapito;
  final VoidCallback? quandoVersioniPrecedenti;

  /// Nella finestra in mezzo (tablet, Mac) la maniglia del foglio non c'e',
  /// e l'aria in cima la mette la scheda.
  final bool inFinestra;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final punti = cosa.note.punti.take(quantiPuntiNellaScheda).toList();
    final inFondo = MediaQuery.viewPaddingOf(context).bottom;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Flexible(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(24, inFinestra ? 28 : 0, 24, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Testata(versione: cosa.note.versione),
                const SizedBox(height: 20),
                for (final (quale, punto) in punti.indexed) ...[
                  if (quale > 0) const SizedBox(height: 16),
                  _Punto(punto),
                ],
                if (laLingua != Lingua.italiano) ...[
                  const SizedBox(height: 18),
                  Text(
                    'Release notes are written in Italian only.',
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(
            24,
            12,
            24,
            (inFinestra ? 24 : 16) + (inFinestra ? 0 : inFondo),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (quandoVersioniPrecedenti != null) ...[
                TextButton.icon(
                  key: const Key('novita-precedenti'),
                  onPressed: quandoVersioniPrecedenti,
                  icon: const Icon(Icons.history_rounded, size: 20),
                  label: Text(
                    cosa.saltate > 0
                        ? inLingua(
                            it: 'Versioni precedenti',
                            en: 'Previous versions',
                          )
                        : inLingua(it: 'Tutte le novità', en: 'All the news'),
                  ),
                ),
                const SizedBox(height: 4),
              ],
              FilledButton(
                key: const Key('novita-ho-capito'),
                onPressed: quandoHoCapito,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: testi.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                child: Text(inLingua(it: 'Ho capito', en: 'Got it')),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// La testa della scheda: il segno della notte del benvenuto, piccolo, e il
/// titolo con la versione.
class _Testata extends StatelessWidget {
  const _Testata({required this.versione});

  final String versione;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Row(
      children: [
        const _IlSegno(),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                inLingua(it: 'App aggiornata', en: 'App updated'),
                style: testi.labelMedium?.copyWith(
                  color: colori.onSurfaceVariant,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                inLingua(
                  /* Lo spazio che non va a capo tiene il numero attaccato
                   * a «versione»: sul telefono il titolo sta su due righe, e
                   * «1.19.25» da solo sulla seconda si legge come un'altra
                   * cosa. */
                  it: 'Novità della versione\u00A0$versione',
                  en: 'What\'s new in version\u00A0$versione',
                ),
                style: testi.titleLarge,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Un tondo col cielo della prima schermata e la stellina d'ambra: lo
/// stesso cielo del benvenuto e di Premium, in piccolo. Sta bene in chiaro
/// e in scuro perche' e' notte in tutti e due.
class _IlSegno extends StatelessWidget {
  const _IlSegno();

  static const lato = 48.0;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: lato,
      height: lato,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1E3A8A), Color(0xFF0A1128), Color(0xFF2A1A08)],
        ),
        /* Al buio la notte del tondo e quella della scheda si toccano: un
         * filo d'ambra lo stacca. */
        border: Theme.of(context).brightness == Brightness.dark
            ? Border.all(color: Colori.ambra.withValues(alpha: 0.35))
            : null,
        boxShadow: [
          BoxShadow(
            color: Colori.notte.withValues(alpha: 0.18),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Icon(
        Icons.auto_awesome_rounded,
        size: lato * 0.5,
        color: const Color(0xFFFCD34D),
      ),
    );
  }
}

/// Un punto: il titolo in grassetto, e sotto la sua frase.
class _Punto extends StatelessWidget {
  const _Punto(this.punto);

  final UnaNovita punto;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final scuro = Theme.of(context).brightness == Brightness.dark;
    final frase = (testi.bodyMedium ?? const TextStyle()).copyWith(
      color: colori.onSurfaceVariant,
      height: 1.4,
    );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 7, right: 12),
          child: Pallino(scuro ? Colori.ambra : Colori.ambraScura),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (punto.titolo.isNotEmpty) ...[
                Text(
                  punto.titolo,
                  style: testi.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colori.onSurface,
                  ),
                ),
                const SizedBox(height: 3),
              ],
              Text.rich(
                TextSpan(
                  children: iSegniDi(
                    _conLaMaiuscola(punto.frase),
                    base: frase,
                    accento: colori.primary,
                    fondoDelCodice: colori.surfaceContainerHighest,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// La frase con la maiuscola in testa.
///
/// Nel CHANGELOG la frase segue il titolo dopo i due punti, e comincia
/// minuscola: «**Il benvenuto**: una pagina sola». Qui sta su una riga sua,
/// sotto il titolo, e minuscola sembrerebbe un pezzo tagliato. Si cambia
/// solo la prima lettera, e solo se e' una lettera: un `codice` in testa
/// resta com'e'.
String _conLaMaiuscola(String frase) {
  if (frase.isEmpty) return frase;
  final prima = frase[0];
  final grande = prima.toUpperCase();
  if (prima == grande) return frase;
  return '$grande${frase.substring(1)}';
}

/// Apre la pagina «Novità».
Future<void> apriLaPaginaDelleNovita(
  BuildContext context,
  LeNovitaDellApp novita,
) => Navigator.of(context).push<void>(
  MaterialPageRoute(builder: (_) => PaginaDelleNovita(novita: novita)),
);

/// La pagina «Novità» di Impostazioni app: le note delle ultime versioni,
/// una sotto l'altra, dalla piu' nuova.
class PaginaDelleNovita extends StatefulWidget {
  const PaginaDelleNovita({super.key, required this.novita});

  final LeNovitaDellApp novita;

  @override
  State<PaginaDelleNovita> createState() => _StatoDellaPaginaDelleNovita();
}

class _StatoDellaPaginaDelleNovita extends State<PaginaDelleNovita> {
  late final Future<List<LeNoteDiUnaVersione>> _note = widget.novita
      .perLaPagina();

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(inLingua(it: 'Novità', en: 'What\'s new')),
      ),
      body: FutureBuilder<List<LeNoteDiUnaVersione>>(
        future: _note,
        builder: (context, letto) {
          if (letto.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final note = letto.data ?? const <LeNoteDiUnaVersione>[];
          if (note.isEmpty) {
            return StatoVuoto(
              icona: Icons.auto_awesome_rounded,
              titolo: inLingua(it: 'Nessuna nota', en: 'No notes'),
              sotto: inLingua(
                it: 'Le note di questa versione non ci sono.',
                en: 'There are no notes for this version.',
              ),
            );
          }
          return QuantoCiSta(
            quanto: 720,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 20),
                  child: Text(
                    inLingua(
                      it:
                          'Cosa è cambiato nelle ultime versioni dell\'app. '
                          'L\'add-on in Home Assistant ha le sue note.',
                      en:
                          'What changed in the latest versions of the app '
                          '(notes in Italian). The Home Assistant add-on has '
                          'its own notes.',
                    ),
                    style: testi.bodyMedium?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ),
                for (final una in note) ...[
                  _UnaVersione(
                    note: una,
                    questa:
                        confrontaLeVersioni(
                          una.versione,
                          widget.novita.adesso,
                        ) ==
                        0,
                  ),
                  const SizedBox(height: 22),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Una versione nella pagina: il numero, e la scheda coi suoi punti.
class _UnaVersione extends StatelessWidget {
  const _UnaVersione({required this.note, required this.questa});

  final LeNoteDiUnaVersione note;

  /// Se e' la versione che si sta usando: lo dice un bollino.
  final bool questa;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Insegna(
          inLingua(
            it: 'Versione ${note.versione}',
            en: 'Version ${note.versione}',
          ),
          azione: questa
              ? Bollino(
                  inLingua(it: 'Questa', en: 'This one'),
                  colore: colori.onPrimaryContainer,
                  fondo: colori.primaryContainer,
                )
              : null,
        ),
        Scheda(
          padding: const EdgeInsets.fromLTRB(16, 18, 18, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final (quale, punto) in note.punti.indexed) ...[
                if (quale > 0) const SizedBox(height: 14),
                _Punto(punto),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
