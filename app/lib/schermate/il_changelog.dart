/// Cosa cambia in questa versione, **dentro l'app**.
///
/// Prima questo era un link: il campo che Home Assistant mette nell'entita' —
/// `release_url` — e un tasto che lo apriva nel browser. Leggere cosa cambia
/// voleva dire uscire da gdahome, trovarsi una pagina di GitHub su un telefono,
/// e tornare indietro a memoria. La finestra di Home Assistant non fa cosi': le
/// note della versione le chiede e le mostra dentro di se'.
///
/// Questo e' lo stesso foglio: sale dal basso, dice di che versione parla, e
/// **porta «Installa» con se'** — si legge e si installa senza tornare
/// indietro. Il markdown lo disegna `vestito/markdown.dart`, che sa le cinque
/// cose che un changelog usa.
///
/// Su uno schermo da computer non si allarga a tutta pagina: un testo lungo
/// millequattrocento punti non si legge. Si tiene alla larghezza a cui una riga
/// si legge, e si mette in mezzo.
///
/// ## Il testo arriva dal filo
///
/// Le note lunghe non stanno negli attributi dell'entita': Home Assistant le
/// calcola quando gliele si chiede. Quindi fra il tocco e il testo c'e' un
/// giro — in casa un niente, da fuori casa il tempo del centralino — e il
/// foglio si apre **prima** che il testo ci sia: si apre e dice che sta
/// arrivando. Aprire due secondi dopo il tocco vorrebbe dire un tasto che non
/// fa niente, e un tasto che non fa niente si preme due volte.
///
/// E quando non arriva, il foglio non resta bianco: dice cosa e' andato
/// storto, e se c'e' un indirizzo offre di aprire quello — che e' da dove
/// veniamo, ed e' meglio di niente.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../casa/segnalazioni.dart' show spiegaLErrore;
import '../parole.dart';
import '../vestito/markdown.dart';

/// Quanto larga si tiene la colonna del testo.
///
/// Una riga si legge bene fra i sessanta e i settantacinque caratteri; oltre,
/// l'occhio perde il capo della riga dopo. Seicento punti col nostro corpo del
/// testo stanno in quella misura.
const double _quantoLarga = 600;

/// Quanto alto puo' venire il foglio: tre quarti dello schermo. Il resto resta
/// la pagina di sotto, che si vede e dice dove si torna.
const double _quantoAlto = 0.78;

/// Il foglio delle note di una versione.
///
/// [testo] e' il markdown. Vuoto vuol dire che non ci sono note: allora il
/// foglio non si apre affatto, e chi chiama lo sa prima (`ceQualcosaDaLeggere`).
Future<void> apriIlChangelog(
  BuildContext context, {
  required String nome,
  required String versioni,
  required Future<String> Function() testo,
  String laVersioneNuova = '',
  String? riassunto,
  String fuori = '',
  VoidCallback? quandoInstalla,
  void Function(String dove)? quandoApreUnLink,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    constraints: const BoxConstraints(maxWidth: _quantoLarga),
    builder: (context) => _IlFoglio(
      nome: nome,
      versioni: versioni,
      testo: testo,
      laVersioneNuova: laVersioneNuova,
      riassunto: riassunto,
      fuori: fuori,
      quandoInstalla: quandoInstalla,
      quandoApreUnLink: quandoApreUnLink,
    ),
  );
}

class _IlFoglio extends StatefulWidget {
  const _IlFoglio({
    required this.nome,
    required this.versioni,
    required this.testo,
    this.laVersioneNuova = '',
    this.riassunto,
    this.fuori = '',
    this.quandoInstalla,
    this.quandoApreUnLink,
  });

  final String nome;
  final String versioni;

  /// Come si chiede il markdown.
  ///
  /// Una funzione e non un `Future` gia' avviato, per una ragione precisa: un
  /// `Future` che fallisce **prima** che qualcuno lo ascolti e' un errore che
  /// nessuno ha raccolto, e Dart lo urla. Il foglio lo chiama quando e' in
  /// piedi, e da quel momento c'e' qualcuno che ascolta.
  final Future<String> Function() testo;

  /// La versione che si installa: da li' si comincia a leggere.
  final String laVersioneNuova;

  final String? riassunto;

  /// L'indirizzo delle note, per l'ultima spiaggia: si offre solo se il testo
  /// non arriva.
  final String fuori;

  final VoidCallback? quandoInstalla;
  final void Function(String dove)? quandoApreUnLink;

  @override
  State<_IlFoglio> createState() => _IlFoglioState();
}

class _IlFoglioState extends State<_IlFoglio> {
  String? _testo;
  Object? _perche;

  @override
  void initState() {
    super.initState();
    unawaited(_aspetta());
  }

  Future<void> _aspetta() async {
    try {
      final arrivato = await widget.testo();
      if (!mounted) return;
      setState(
        () => _testo = daQuellaVersione(arrivato, widget.laVersioneNuova),
      );
    } catch (errore) {
      if (!mounted) return;
      setState(() => _perche = errore);
    }
  }

  String get nome => widget.nome;
  String get versioni => widget.versioni;
  String? get riassunto => widget.riassunto;
  VoidCallback? get quandoInstalla => widget.quandoInstalla;
  void Function(String dove)? get quandoApreUnLink => widget.quandoApreUnLink;

  /// Se la riga breve aggiunge qualcosa, o ripete quello che si legge sotto.
  bool get _ilRiassuntoServe {
    final breve = riassunto?.trim() ?? '';
    return breve.isNotEmpty && !(_testo ?? '').contains(breve);
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final alto = MediaQuery.sizeOf(context).height * _quantoAlto;

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: alto),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          /* In testa: di che cosa e di che versione. Chi apre un foglio da un
           * elenco di sei aggiornamenti deve sapere quale ha aperto. */
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  inLingua(it: 'Cosa cambia', en: 'What changes'),
                  style: testi.labelSmall?.copyWith(
                    color: colori.onSurfaceVariant,
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        nome,
                        style: testi.titleMedium,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (versioni.isNotEmpty) ...[
                      const SizedBox(width: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 9,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: colori.primaryContainer,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          versioni,
                          style: testi.labelSmall?.copyWith(
                            color: colori.onPrimaryContainer,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Divider(height: 1, color: colori.onSurface.withValues(alpha: 0.08)),
          Flexible(
            child: ListView(
              /* Alto quanto quello che c'e' dentro, fino al massimo.
               *
               * Senza questo il foglio e' sempre alto tre quarti di schermo:
               * mentre il testo arriva sono seicento punti di bianco sotto
               * cinque righe finte, e per una versione che non ha niente da
               * dire sono seicento punti di bianco sotto una frase. Costa
               * niente: il markdown e' un documento finito, e le sue righe le
               * disegna comunque tutte. */
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
              children: [
                /* La riga breve che Home Assistant si porta dentro
                 * l'entita', quando c'e': e' un riassunto, e sta sopra il
                 * racconto. Se il racconto la dice gia' — e nel nostro
                 * changelog la dice, e' la prima riga in grassetto — non si
                 * scrive due volte di fila. */
                if (_ilRiassuntoServe) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: colori.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      riassunto!.trim(),
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                _IlCorpo(
                  testo: _testo,
                  perche: _perche,
                  fuori: widget.fuori,
                  quandoApre: quandoApreUnLink,
                ),
              ],
            ),
          ),
          /* «Installa» viaggia col foglio: si legge cosa cambia e si installa
           * da qui, senza tornare indietro e ritrovare la riga giusta. */
          if (quandoInstalla != null) ...[
            /* Una riga, perche' «Installa» non sembri l'ultima riga del
             * racconto: quello scorre, questo sta fermo. */
            Divider(height: 1, color: colori.onSurface.withValues(alpha: 0.08)),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      quandoInstalla!();
                    },
                    child: Text(inLingua(it: 'Installa', en: 'Install')),
                  ),
                ),
              ),
            ),
          ] else
            const SafeArea(top: false, child: SizedBox(height: 8)),
        ],
      ),
    );
  }
}

/// Il corpo del foglio: che sta arrivando, quello che e' arrivato, o cosa e'
/// andato storto.
///
/// Tre stati e nessun quarto: un foglio che non dice niente e' la cosa peggiore
/// che possa fare, perche' chi guarda non sa se aspettare o riprovare.
class _IlCorpo extends StatelessWidget {
  const _IlCorpo({
    required this.testo,
    required this.perche,
    required this.fuori,
    this.quandoApre,
  });

  /// Il markdown, quando e' arrivato. `null` vuol dire «sta arrivando».
  final String? testo;

  /// Cosa e' andato storto, quando e' andato storto.
  final Object? perche;

  /// L'indirizzo di fuori, se c'e': l'ultima spiaggia.
  final String fuori;

  final void Function(String dove)? quandoApre;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;

    if (perche != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            inLingua(
              it: 'Le note di questa versione non sono arrivate',
              en: 'The notes for this version didn\'t arrive',
            ),
            style: testi.titleSmall,
          ),
          const SizedBox(height: 6),
          Text(
            /* Una frase gia' scritta si legge com'e'; un errore che arriva dal
             * filo lo spiega chi sa spiegarlo. */
            perche is String ? perche! as String : spiegaLErrore(perche!),
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
          /* Da dove veniamo: la pagina di fuori. Non e' la strada buona — e'
           * quella che stiamo togliendo — ma con le note che non arrivano e'
           * meglio di un foglio bianco. */
          if (fuori.isNotEmpty && quandoApre != null) ...[
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: () => quandoApre!(fuori),
              icon: const Icon(Icons.open_in_new_rounded, size: 18),
              label: Text(
                inLingua(it: 'Aprile nel browser', en: 'Open in the browser'),
              ),
            ),
          ],
        ],
      );
    }

    final dentro = testo;
    if (dentro == null) {
      /* Sta arrivando. Tre righe finte al posto del testo, e non una rotella
       * in mezzo al foglio: dicono «qui viene del testo», che e' quello che
       * sta succedendo. */
      return const _StaArrivando();
    }

    if (dentro.trim().isEmpty) {
      return Text(
        inLingua(
          it: 'Per questa versione non c\'è scritto niente.',
          en: 'Nothing was written for this version.',
        ),
        style: testi.bodyMedium?.copyWith(color: colori.onSurfaceVariant),
      );
    }

    return IlMarkdown(testo: dentro, quandoApre: quandoApre);
  }
}

/// Le righe finte dell'attesa: si vede la forma di quello che arriva.
class _StaArrivando extends StatelessWidget {
  const _StaArrivando();

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    /* Le larghezze non sono tutte uguali: tre barre identiche sembrano un
     * disegno, tre righe di lunghezza diversa sembrano un testo. */
    const quanto = [0.62, 1.0, 1.0, 0.84, 1.0, 0.45];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (quante, larga) in quanto.indexed)
          FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: larga,
            child: Container(
              height: quante == 0 ? 17 : 11,
              margin: EdgeInsets.only(bottom: quante == 0 ? 16 : 10),
              decoration: BoxDecoration(
                color: colori.onSurface.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(6),
              ),
            ),
          ),
      ],
    );
  }
}

/// Il markdown, disegnato.
///
/// Sta qui e non in `markdown.dart` per la stessa ragione per cui `laPagina`
/// sta fuori da `vestiDiGdahome`: quello legge e si prova senza uno schermo,
/// questo disegna.
class IlMarkdown extends StatelessWidget {
  const IlMarkdown({super.key, required this.testo, this.quandoApre});

  final String testo;
  final void Function(String dove)? quandoApre;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final corpo =
        testi.bodyMedium?.copyWith(height: 1.45, color: colori.onSurface) ??
        const TextStyle();
    final fondoDelCodice = colori.surfaceContainerHighest;

    List<InlineSpan> segni(String riga, TextStyle stile) => iSegniDi(
      riga,
      base: stile,
      accento: colori.primary,
      fondoDelCodice: fondoDelCodice,
      quandoApre: quandoApre,
    );

    final fuori = <Widget>[];
    for (final pezzo in iPezziDi(testo)) {
      switch (pezzo) {
        case UnTitolo(:final livello, :final testo):
          final stile = switch (livello) {
            1 => testi.titleLarge,
            2 => testi.titleMedium,
            _ => testi.titleSmall,
          };
          fuori.add(
            Padding(
              padding: EdgeInsets.only(top: fuori.isEmpty ? 0 : 18, bottom: 7),
              child: Text.rich(
                TextSpan(children: segni(testo, stile ?? corpo)),
              ),
            ),
          );
        case UnParagrafo(:final testo):
          fuori.add(
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text.rich(TextSpan(children: segni(testo, corpo))),
            ),
          );
        case UnPunto(:final testo, :final rientro):
          fuori.add(
            Padding(
              padding: EdgeInsets.only(left: 2 + rientro * 16, bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 7, right: 9),
                    child: Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        color: colori.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text.rich(TextSpan(children: segni(testo, corpo))),
                  ),
                ],
              ),
            ),
          );
        case UnaRiga():
          fuori.add(
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Divider(
                height: 1,
                color: colori.onSurface.withValues(alpha: 0.10),
              ),
            ),
          );
        case UnBlocco(:final testo):
          fuori.add(
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: fondoDelCodice,
                borderRadius: BorderRadius.circular(10),
              ),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Text(
                  testo,
                  style: corpo.copyWith(
                    fontFamily: 'monospace',
                    fontFamilyFallback: aSpaziaturaFissa,
                    fontSize: (corpo.fontSize ?? 14) * 0.9,
                    height: 1.35,
                  ),
                ),
              ),
            ),
          );
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: fuori,
    );
  }
}
