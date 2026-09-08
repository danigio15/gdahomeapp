/// La casa demo di DashboardModern, per le prove.
///
/// E' la stessa casa inventata con cui la plancia web disegna le sue
/// anteprime — `scripts/preview-fixture.mjs` di dashboardmodern-v2 — scritta
/// come JSON in `collaudo/casa-demo.json`: le entita' come le manda
/// `get_states`, e la risposta a `dashboardmodern/config/get` come la da'
/// l'integrazione. Cosi' quello che le prove affermano si puo' confrontare a
/// occhio con le anteprime della plancia web, numero per numero.
library;

import 'dart:convert';
import 'dart:io';

import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/plancia/configurazione.dart';

class CasaDemo {
  CasaDemo._(this.grezze, this.risposta);

  /// Le entita', come le manda `get_states`.
  final List<Map<String, dynamic>> grezze;

  /// La risposta di `dashboardmodern/config/get`.
  final Map<String, dynamic> risposta;

  static CasaDemo? _letta;

  static CasaDemo leggi() {
    if (_letta != null) return _letta!;
    final file = File('../collaudo/casa-demo.json');
    final letto = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    return _letta = CasaDemo._([
      for (final una in letto['entita'] as List) una as Map<String, dynamic>,
    ], letto['configurazione'] as Map<String, dynamic>);
  }

  late final Map<String, Entita> entita = {
    for (final una in grezze)
      if (Entita.leggi(una) case final letta?) letta.id: letta,
  };

  Entita? stato(String id) => entita[id];

  /// Tutta la casa in una volta, come la vede chi rileva da se': le tessere
  /// delle batterie, dell'aria, del fumo e degli allagamenti.
  List<Entita> tutte() => entita.values.toList();

  ConfigurazioneDellaPlancia get configurazione =>
      ConfigurazioneDellaPlancia.dallaRisposta(risposta);

  /// La stessa casa con qualche entita' cambiata.
  Entita? Function(String) con(Map<String, Entita?> cambi) =>
      (id) => cambi.containsKey(id) ? cambi[id] : entita[id];
}

Entita entita(
  String id,
  String stato, {
  Map<String, dynamic> attributi = const {},
  DateTime? cambiataIl,
}) =>
    Entita(id: id, stato: stato, attributi: attributi, cambiataIl: cambiataIl);
