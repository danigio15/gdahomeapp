/// La schermata del cruscotto di chi installa.
///
/// Non disegna niente di quello che c'e' nel cruscotto: **lo apre**. Il
/// cruscotto vero sta sul quadro, e rifarlo qui vorrebbe dire un terzo posto
/// dove stanno le stesse regole — cos'e' una casa muta, quando un collaudo e'
/// chiuso, quando un impianto e' da guardare. Tre posti che dicono la stessa
/// cosa prima o poi ne dicono tre diverse, ed e' un errore che questo progetto
/// ha gia' pagato una volta.
///
/// Si apre **fuori dall'app**, nel browser, e non dentro una finestra:
///
///  - la chiave della flotta il cruscotto se la tiene nel browser, e il browser
///    e' uno solo — aprendolo in una finestra dell'app sarebbe un altro posto
///    dove digitarla, e un'altra copia da ricordare;
///  - e quella pagina si guarda sul portatile molto piu' spesso che sul
///    telefono. Portarcisi e' il gesto giusto.
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../parole.dart';

class SchermataDelCruscotto extends StatelessWidget {
  const SchermataDelCruscotto({super.key, required this.dove});

  /// L'indirizzo del cruscotto, come l'ha detto il ponte. Vuoto non arriva
  /// mai: senza, questa schermata non si apre nemmeno.
  final String dove;

  Future<void> _apri() async {
    final indirizzo = Uri.tryParse(dove);
    if (indirizzo == null) return;
    await launchUrl(indirizzo, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                inLingua(it: 'Il mio cruscotto', en: 'My panel'),
                style: tema.textTheme.headlineSmall,
              ),
              const SizedBox(height: 12),
              Text(
                inLingua(
                  it: 'Gli impianti che hai montato, tutti insieme: quali tacciono, quali '
                      'sono da guardare, quali sono ancora da consegnare.',
                  en: 'The systems you installed, all together: which ones are quiet, which '
                      'need looking at, which are still to be signed off.',
                ),
                style: tema.textTheme.bodyMedium,
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _apri,
                icon: const Icon(Icons.open_in_new_rounded),
                label: Text(inLingua(it: 'Apri il cruscotto', en: 'Open the panel')),
              ),
              const SizedBox(height: 16),
              Text(
                inLingua(
                  it: 'Si apre nel browser, che e\' dove sta la tua chiave: qui dentro non c\'e\', '
                      'e sul telefono non ci finisce.',
                  en: 'It opens in the browser, which is where your key lives: it is not in '
                      'here, and it does not end up on the phone.',
                ),
                style: tema.textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
