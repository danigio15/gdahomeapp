/// Che pacchetto e' questo.
///
/// Una riga in grigio, in fondo, che dice la versione e a quale centralino
/// punta. Sembra un vezzo da programmatore e invece e' l'unica risposta a una
/// domanda che ci si fa davvero: **quello che ho installato e' quello nuovo?**
///
/// Senza, l'unico modo di esserne sicuri e' disinstallare e reinstallare — e
/// disinstallando si perde l'abbinamento, perche' il segno della casa sta nel
/// portachiavi del telefono. Una riga di testo evita quel giro intero.
library;

import 'package:flutter/material.dart';

import '../ponte/centralino.dart';

/// La passa il workflow che costruisce il pacchetto. Fuori da li' non c'e' —
/// e allora lo si dice, invece di far finta di essere una versione.
const String _detta = String.fromEnvironment('VERSIONE');

String get versioneDelPacchetto => _detta.isEmpty ? 'dal codice' : _detta;

class Firma extends StatelessWidget {
  const Firma({super.key});

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final dove = centralinoDiDifetto?.casa ?? 'nessun centralino';

    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Text(
        'gdahome $versioneDelPacchetto · $dove',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: colori.onSurfaceVariant.withValues(alpha: 0.7),
          fontSize: 11,
        ),
      ),
    );
  }
}
