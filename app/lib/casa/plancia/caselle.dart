/// Le caselle della configurazione, quelle della plancia.
///
/// «Potenza fotovoltaico (W)», «Batteria auto (%)», «Interruttore boiler»:
/// sono cento, e ognuna vuole un'entita' di Home Assistant. Nella plancia
/// stanno in `CD_SLOTS`, dentro il runtime della dashboard; qui arrivano da
/// `assets/plancia/caselle.json`, che `strumenti/leggi-le-caselle.mjs` legge
/// da li' e riscrive a ogni aggiornamento della plancia.
///
/// Non sono ricopiate a mano apposta: cento etichette da tenere allineate a
/// mano sono cento occasioni di scollegarsi senza che nessuno se ne accorga.
library;

import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

/// Una casella: cosa chiede, e dove finisce quello che ci si scrive.
class Casella {
  const Casella({required this.chiave, required this.etichetta});

  /// La chiave dentro `cd_entity_overrides`, tipo `dm.energy_potenza_batteria`.
  final String chiave;

  /// Come si chiama, con le stesse parole della plancia.
  final String etichetta;
}

/// Le caselle di una sezione.
class SezioneDiCaselle {
  const SezioneDiCaselle({required this.etichetta, required this.caselle});
  final String etichetta;
  final List<Casella> caselle;
}

/// Tutte le sezioni, per nome: `home`, `energy`, `ev`, `boiler`, `security`,
/// `lavatrice`, `server`.
Map<String, SezioneDiCaselle>? _lette;

/// Le carica una volta sola. Chiamarla piu' volte non rilegge il file.
Future<Map<String, SezioneDiCaselle>> leggiLeCaselle() async {
  final gia = _lette;
  if (gia != null) return gia;
  final testo = await rootBundle.loadString('assets/plancia/caselle.json');
  return _lette = daJson(testo);
}

/// Quello che c'e' gia', per chi disegna e non puo' aspettare. Vuoto finche'
/// [leggiLeCaselle] non ha finito.
Map<String, SezioneDiCaselle> get caselleLette => _lette ?? const {};

/// Separata da chi legge il file, cosi' le prove non hanno bisogno di Flutter.
Map<String, SezioneDiCaselle> daJson(String testo) {
  final letto = jsonDecode(testo);
  if (letto is! Map) return const {};
  final fuori = <String, SezioneDiCaselle>{};
  for (final voce in letto.entries) {
    final dentro = voce.value;
    if (dentro is! Map) continue;
    fuori['${voce.key}'] = SezioneDiCaselle(
      etichetta: '${dentro['etichetta'] ?? voce.key}',
      caselle: [
        for (final una in (dentro['caselle'] as List? ?? const []))
          if (una is Map)
            Casella(
              chiave: '${una['chiave']}',
              etichetta: '${una['etichetta'] ?? una['chiave']}',
            ),
      ],
    );
  }
  return fuori;
}
