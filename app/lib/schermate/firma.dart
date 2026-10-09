/// Che pacchetto e' questo.
///
/// Una riga in grigio, in fondo, che dice la versione. Sembra un vezzo da programmatore e invece e' l'unica risposta a una
/// domanda che ci si fa davvero: **quello che ho installato e' quello nuovo?**
///
/// Senza, l'unico modo di esserne sicuri e' disinstallare e reinstallare — e
/// disinstallando si perde l'abbinamento, perche' il segno della casa sta nel
/// portachiavi del telefono. Una riga di testo evita quel giro intero.
///
/// **Il centralino no.** C'era anche «· tramite.gdahome.org»: «in qualsiasi
/// maschera devi togliere l'indirizzo, non si deve leggere
/// dall'interfaccia». L'indirizzo del centralino non serve a chi usa l'app,
/// e scritto li' e' solo un indirizzo in piu' da conoscere.
library;

import 'package:flutter/material.dart';

import '../parole.dart';
import '../versione.dart';

/// La passa il workflow che costruisce il pacchetto. Fuori da li' non c'e' —
/// e allora lo si dice, invece di far finta di essere una versione.
const String _detta = String.fromEnvironment('VERSIONE');

/// Quale pacchetto e' questo, per chi lo deve sapere fuori da qui: finisce
/// nelle segnalazioni, raccolto da solo.
const String versioneDellApp = _detta;

String get versioneDelPacchetto =>
    _detta.isEmpty ? inLingua(it: 'dal codice', en: 'from source') : _detta;

class Firma extends StatelessWidget {
  const Firma({super.key, this.spazioSopra = 24});

  /// Quanto stare sotto quello che c'e' prima: in fondo a una lista lunga
  /// serve aria, in fondo a un menu no.
  final double spazioSopra;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.only(top: spazioSopra),
      child: Text(
        'gdahome $numeroDiQuestApp',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: colori.onSurfaceVariant.withValues(alpha: 0.7),
          fontSize: 11,
        ),
      ),
    );
  }
}
