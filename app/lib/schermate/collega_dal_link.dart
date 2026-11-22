/// «Collegare questa casa?» — il foglio che si apre quando arriva un link con
/// un invito (`ponte/il_link.dart`).
///
/// Il QR code lo inquadra chi sta davanti alla console, e inquadrare e' gia'
/// un si'. Un link invece lo puo' aprire chiunque — una pagina, un messaggio,
/// un'altra app — e allora prima di abbinare si chiede. Il foglio dice cosa
/// sta per succedere, e mostra il codice: e' lo stesso che la console ha
/// sotto il QR, e chi ha appena premuto il bottone lo riconosce.
library;

import 'package:flutter/material.dart';

import '../parole.dart';
import '../ponte/cifra.dart' show codicePulito;
import '../ponte/invito.dart';

/// Chiede se collegare la casa dell'[invito]: `true` solo per «Collega».
///
/// [soloCaseGiaNote]: con Base e una casa gia' nell'app, questo link puo'
/// solo ricollegare quella (vedi `AggiungiCasa.soloCaseGiaNote`), e il foglio
/// lo dice prima.
Future<bool> chiediSeCollegare(
  BuildContext context,
  Invito invito, {
  bool soloCaseGiaNote = false,
}) async {
  final si = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) =>
        FoglioDelCollega(invito: invito, soloCaseGiaNote: soloCaseGiaNote),
  );
  return si ?? false;
}

/// Le sedici lettere in quattro gruppi, come le scrive la console.
String codiceAGruppi(String codice) =>
    codicePulito(codice)
        .replaceAllMapped(RegExp(r'(.{4})(?=.)'), (pezzo) => '${pezzo[1]}-');

/// Il foglio di [chiediSeCollegare]. Pubblico per le prove e le fotografie.
class FoglioDelCollega extends StatelessWidget {
  const FoglioDelCollega({
    super.key,
    required this.invito,
    this.soloCaseGiaNote = false,
  });

  final Invito invito;
  final bool soloCaseGiaNote;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final inCasa = invito.indirizzi.isEmpty ? null : invito.indirizzi.first;
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: CircleAvatar(
                radius: 28,
                backgroundColor: colori.primaryContainer,
                child: Icon(
                  Icons.add_home_rounded,
                  size: 30,
                  color: colori.onPrimaryContainer,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              inLingua(it: 'Collegare questa casa?', en: 'Connect this home?'),
              textAlign: TextAlign.center,
              style: testi.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              inLingua(
                it:
                    'Un link ha aperto GdAHome con un invito per collegare '
                    'una casa. Collegala solo se l\'hai appena chiesto tu, '
                    'dalla console di GdAHome in Home Assistant.',
                en:
                    'A link opened GdAHome with an invitation to connect a '
                    'home. Only connect it if you just asked for it yourself, '
                    'from the GdAHome console in Home Assistant.',
              ),
              textAlign: TextAlign.center,
              style: testi.bodyMedium?.copyWith(color: colori.onSurfaceVariant),
            ),
            const SizedBox(height: 18),
            DecoratedBox(
              decoration: BoxDecoration(
                color: colori.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      inLingua(
                        it: 'Lo stesso codice della console',
                        en: 'The same code as in the console',
                      ),
                      textAlign: TextAlign.center,
                      style: testi.labelMedium?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 6),
                    /* Le cifre tutte larghe uguali, come le lettere in
                     * colonna nella console: si confrontano a gruppi. */
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        codiceAGruppi(invito.codice),
                        style: testi.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          letterSpacing: 2,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                    if (inCasa != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        inLingua(
                          it: 'In casa: ${inCasa.casa}',
                          en: 'At home: ${inCasa.casa}',
                        ),
                        textAlign: TextAlign.center,
                        style: testi.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (soloCaseGiaNote) ...[
              const SizedBox(height: 12),
              DecoratedBox(
                decoration: BoxDecoration(
                  border: Border.all(color: colori.outlineVariant),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.workspace_premium_rounded,
                        color: Color(0xFFF59E0B),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          inLingua(
                            it:
                                'Con GdAHome Base questo link ricollega una '
                                'casa che hai già nell\'app. Per aggiungerne '
                                'un\'altra serve Premium.',
                            en:
                                'With GdAHome Base this link reconnects a home '
                                'you already have in the app. Adding another '
                                'one needs Premium.',
                          ),
                          style: testi.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton.icon(
              key: const Key('collega-dal-link-si'),
              onPressed: () => Navigator.of(context).pop(true),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
              icon: const Icon(Icons.link_rounded),
              label: Text(inLingua(it: 'Collega', en: 'Connect')),
            ),
            const SizedBox(height: 6),
            TextButton(
              key: const Key('collega-dal-link-no'),
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(inLingua(it: 'Annulla', en: 'Cancel')),
            ),
          ],
        ),
      ),
    );
  }
}
