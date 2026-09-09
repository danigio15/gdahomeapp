/// La configurazione della plancia, letta e scritta dall'app.
///
/// E' **la stessa** che scrive la dashboard: le stesse chiavi, gli stessi
/// comandi sul filo (`dashboardmodern/config/get` e `config/set`), lo stesso
/// file sul ponte. L'app non ha un suo formato e non c'e' niente da migrare:
/// chi ha configurato dal browser apre l'app e trova le sue cose.
///
/// I valori sono **testo**: la plancia li tiene come li terrebbe un browser,
/// cioe' JSON dentro una stringa. Qui si aprono quando servono e si
/// richiudono quando si scrive, e le chiavi che non si conoscono si passano
/// avanti com'erano — una scrittura non deve mai perdere quello che ha
/// scritto qualcun altro.
library;

import 'dart:async';
import 'dart:convert';

import '../../ponte/filo.dart';

/// Quanto si aspetta la configurazione: e' un file, non un comando.
const attesaDellaConfigurazione = Duration(seconds: 20);

/// Uno scatto della configurazione: cosa c'e' dentro, e a che revisione.
class Scatto {
  const Scatto({required this.revisione, required this.valori});

  const Scatto.vuoto() : revisione = 0, valori = const {};

  /// La revisione del ponte. Cresce e basta, e i conflitti si decidono su
  /// questa — mai sull'orologio di un telefono, che fra due telefoni non e'
  /// mai lo stesso.
  final int revisione;

  /// Le chiavi come stanno sul ponte: testo, che quasi sempre e' JSON.
  final Map<String, String> valori;

  /// Il valore di una chiave, aperto. `null` se non c'e' o se non si apre.
  dynamic aperto(String chiave) {
    final testo = valori[chiave];
    if (testo == null || testo.isEmpty) return null;
    try {
      return jsonDecode(testo);
    } on FormatException {
      /* Non tutte le chiavi sono JSON: `cd_theme` e' una parola, e
       * `cd_ev_car_active` un numero scritto. Chi la chiede come mappa o come
       * elenco non la trova, e si tiene il suo difetto. */
      return testo;
    }
  }

  /// Una chiave che tiene una mappa: `{'light.cucina': 'Cucina'}`.
  Map<String, dynamic> mappa(String chiave) {
    final letto = aperto(chiave);
    return letto is Map<String, dynamic> ? letto : const {};
  }

  /// Una chiave che tiene un elenco: le stanze, le telecamere, le tapparelle.
  List<Map<String, dynamic>> oggetti(String chiave) {
    final letto = aperto(chiave);
    if (letto is! List) return const [];
    return [
      for (final uno in letto)
        if (uno is Map) Map<String, dynamic>.from(uno),
    ];
  }

  /// Una chiave che tiene un elenco di parole: l'ordine della barra.
  List<String> parole(String chiave) {
    final letto = aperto(chiave);
    if (letto is! List) return const [];
    return [
      for (final una in letto)
        if (una is String) una,
    ];
  }

  /// Quante chiavi portano davvero una configurazione. Le tre di servizio non
  /// contano: e' lo stesso conto che fa il ponte per non farsi azzerare da un
  /// telefono che non era riuscito a leggere.
  int get quanteChiavi =>
      valori.keys.where((chiave) => !_diServizio.contains(chiave)).length;

  static const _diServizio = {
    'dm_schema_version',
    'dm_persistence_meta',
    'cd_sections',
  };
}

/// Quando il ponte rifiuta una scrittura.
class ScritturaRifiutata implements Exception {
  const ScritturaRifiutata(this.perche);
  final String perche;
  @override
  String toString() => perche;
}

/// Una revisione tenuta da parte, che si puo' rimettere.
class RevisioneTenuta {
  const RevisioneTenuta({
    required this.revisione,
    required this.quando,
    required this.chiavi,
  });

  final int revisione;
  final DateTime quando;

  /// Quante chiavi con dentro qualcosa: e' quello che distingue «la
  /// configurazione di ieri» da «una plancia vuota».
  final int chiavi;
}

/// Legge e scrive la configurazione della plancia sul filo.
class LaConfigurazione {
  LaConfigurazione(this._filo);

  final Filo _filo;

  /// L'ultimo scatto letto. Serve a chi apre una schermata e non vuole
  /// aspettare il filo per far vedere qualcosa.
  Scatto? ultimo;

  List<RevisioneTenuta> tenute = const [];

  /// Chiede al ponte la configurazione.
  Future<Scatto> leggi() async {
    final detto = await _filo.chiedi({
      'type': 'dashboardmodern/config/get',
    }, entro: attesaDellaConfigurazione);
    return _spacchetta(detto['result']);
  }

  /// Cambia alcune chiavi, lasciando stare tutte le altre.
  ///
  /// Il valore `null` cancella la chiave. Quello che non e' una stringa si
  /// scrive come JSON, che e' come lo scrive la plancia.
  ///
  /// Si rilegge **prima** di scrivere e si scrive con la revisione attesa: se
  /// un altro telefono ha scritto nel frattempo, il ponte lo dice invece di
  /// lasciare che uno dei due cancelli il lavoro dell'altro. In quel caso si
  /// riprova una volta sola, ripartendo dallo scatto nuovo — il secondo
  /// tentativo fonde su quello che c'e' adesso, e le due modifiche stanno
  /// insieme se non toccavano la stessa chiave.
  Future<Scatto> cambia(Map<String, Object?> chiavi) async {
    for (var tentativo = 0; tentativo < 2; tentativo += 1) {
      final adesso = await leggi();
      final valori = Map<String, String>.from(adesso.valori);
      for (final voce in chiavi.entries) {
        final valore = voce.value;
        if (valore == null) {
          valori.remove(voce.key);
        } else {
          valori[voce.key] = valore is String ? valore : jsonEncode(valore);
        }
      }
      final detto = await _filo.chiedi({
        'type': 'dashboardmodern/config/set',
        'expected_revision': adesso.revisione,
        'snapshot': {
          'values': valori,
          'updated_at': DateTime.now().millisecondsSinceEpoch,
        },
      }, entro: attesaDellaConfigurazione);
      final risposta = detto['result'];
      final stato = risposta is Map ? risposta['status'] : null;
      if (stato == 'conflict') continue;
      if (stato == 'refused-empty') {
        throw const ScritturaRifiutata(
          'Il ponte non ha accettato: sarebbe rimasta una plancia vuota.',
        );
      }
      return _spacchetta(risposta);
    }
    throw const ScritturaRifiutata(
      'Qualcun altro sta scrivendo la configurazione in questo momento. '
      'Riprova fra un attimo.',
    );
  }

  /// Rimette una revisione tenuta da parte.
  Future<Scatto> rimetti(int revisione) async {
    final detto = await _filo.chiedi({
      'type': 'dashboardmodern/config/restore',
      'revision': revisione,
    }, entro: attesaDellaConfigurazione);
    return _spacchetta(detto['result']);
  }

  Scatto _spacchetta(dynamic risultato) {
    if (risultato is! Map) return const Scatto.vuoto();
    tenute = [
      for (final una in (risultato['recoverable'] as List? ?? const []))
        if (una is Map)
          RevisioneTenuta(
            revisione: _intero(una['revision']),
            quando: DateTime.fromMillisecondsSinceEpoch(
              _intero(una['updated_at']),
            ),
            chiavi: _intero(una['content_keys']),
          ),
    ];
    final scatto = risultato['snapshot'];
    if (scatto is! Map) return ultimo = const Scatto.vuoto();
    final valori = <String, String>{};
    final dentro = scatto['values'];
    if (dentro is Map) {
      for (final voce in dentro.entries) {
        if (voce.value is String) valori['${voce.key}'] = voce.value as String;
      }
    }
    return ultimo = Scatto(
      revisione: _intero(scatto['revision']),
      valori: valori,
    );
  }
}

int _intero(dynamic valore) => switch (valore) {
  final int numero => numero,
  final num numero => numero.toInt(),
  final String testo => int.tryParse(testo) ?? 0,
  _ => 0,
};
