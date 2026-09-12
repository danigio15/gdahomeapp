/// La console dell'assistenza: la coda di tutte le case, per chi risponde.
///
/// E' l'altra meta' della chat. Da una parte c'e' chi chiede aiuto — una casa
/// qualunque, un filo solo, la schermata Assistenza — e dall'altra c'e' chi
/// risponde: **una casa sola al mondo**, quella che nelle opzioni del ponte ha
/// scritto la chiave della console.
///
/// Non e' una cosa nuova: nella dashboard e' il Cruscotto, ed e' li' da quando
/// la chat esiste. Quello che cambia e' dove si apre — prima solo dentro una
/// plancia in Home Assistant, adesso anche da qui, che e' il posto da cui si
/// guarda quando si e' fuori casa.
///
/// La chiave non passa mai di qua. Sta nelle opzioni dell'add-on, il ponte la
/// usa per bussare al centralino, e al telefono arrivano solo le
/// conversazioni: cosi' non c'e' niente da ricordarsi e niente da perdere.
library;

import '../ponte/filo.dart';
import 'segnalazioni.dart' show Messaggio;

/// Una linea aperta: una casa che ha scritto, come si vede dall'elenco.
class Linea {
  const Linea({
    required this.id,
    this.nome = '',
    this.note = '',
    this.nonLetti = 0,
    this.ultimo = '',
    this.ultimoIl,
  });

  /// Il nome della linea: `casa_` e trentadue cifre. Di quella casa non si sa
  /// altro, ed e' voluto — chi chiede aiuto non lascia in giro nient'altro.
  final String id;

  /// Come si e' presentata, se si e' presentata.
  final String nome;

  /// Le tre note che arrivano insieme alle parole: la versione di cui si
  /// parla, Home Assistant, la lingua di chi scrive. Sono la meta' delle
  /// domande che chi risponde farebbe per prime.
  final String note;

  /// Quante cose ha detto che non sono ancora state lette.
  final int nonLetti;

  /// L'ultima cosa detta, il principio: serve a scegliere quale aprire.
  final String ultimo;
  final DateTime? ultimoIl;

  /// Come si chiama nell'elenco. Senza nome si mostra il principio
  /// dell'identificativo: intero non ci sta e non direbbe niente di piu'.
  String get comeSiChiama {
    if (nome.trim().isNotEmpty) return nome.trim();
    return id.length > 13 ? '${id.substring(0, 13)}…' : id;
  }

  static Linea leggi(Map<String, dynamic> grezza) {
    final note = [grezza['versione'], grezza['ha'], grezza['lingua']]
        .map((una) => una?.toString().trim() ?? '')
        .where((una) => una.isNotEmpty)
        .join(' · ');
    return Linea(
      id: grezza['id']?.toString() ?? '',
      nome: grezza['nome']?.toString() ?? '',
      note: note,
      nonLetti: int.tryParse('${grezza['non_letti'] ?? 0}') ?? 0,
      ultimo: grezza['ultimo']?.toString() ?? '',
      ultimoIl: _quando(grezza['ultimo_il']),
    );
  }
}

/// Il centralino conta i secondi; qui si contano i millisecondi. Uno zero non
/// e' una data e non si inventa.
DateTime? _quando(Object? valore) {
  final secondi = int.tryParse('${valore ?? 0}') ?? 0;
  if (secondi <= 0) return null;
  return DateTime.fromMillisecondsSinceEpoch(
    secondi > 100000000000 ? secondi : secondi * 1000,
  ).toLocal();
}

/// I quattro sportelli di chi risponde, passando dal ponte.
class LaConsole {
  const LaConsole(this._filo);

  final Filo _filo;

  /// Se da questa casa si risponde alle altre.
  ///
  /// Se il ponte non conosce il comando — uno vecchio, di prima — la risposta
  /// e' no, ed e' quella giusta: una console che non c'e' non si disegna.
  Future<bool> cE() async {
    try {
      final detto = await _filo.risultato({'type': 'ponte/chat/stato'});
      return detto is Map && detto['console'] == true;
    } catch (_) {
      return false;
    }
  }

  /// Le conversazioni aperte, quella con piu' cose da leggere per prima.
  Future<List<Linea>> coda() async {
    final detto = await _filo.risultato({'type': 'ponte/console/coda'});
    final righe = detto is Map ? detto['conversations'] : null;
    if (righe is! List) return const [];
    return righe
        .whereType<Map>()
        .map((una) => Linea.leggi(Map<String, dynamic>.from(una)))
        .where((una) => una.id.isNotEmpty)
        .toList();
  }

  /// Una conversazione intera.
  ///
  /// I fumetti sono gli stessi dell'Assistenza, e `dallaCasa` vuol dire «mio»:
  /// a destra, nel colore pieno. Qui pero' il mio non e' il messaggio della
  /// casa — quello e' di chi ha chiesto aiuto — ma quello della console. Lo
  /// stesso filo, guardato dall'altra parte, si specchia.
  Future<List<Messaggio>> apri(String linea) async {
    final detto = await _filo.risultato({
      'type': 'ponte/console/apri',
      'linea': linea,
    });
    final righe = detto is Map ? detto['messages'] : null;
    if (righe is! List) return const [];
    return righe.whereType<Map>().map((una) {
      return Messaggio(
        dallaCasa: '${una['da']}' == 'console',
        testo: una['testo']?.toString() ?? '',
        il: _quando(una['scritto_il']),
      );
    }).toList();
  }

  /// Rispondi a una casa.
  Future<void> rispondi(String linea, String testo) async {
    await _filo.risultato({
      'type': 'ponte/console/rispondi',
      'linea': linea,
      'testo': testo,
    });
  }

  /// Butta via una conversazione.
  ///
  /// Cancella davvero, e per tutti e due: la linea sparisce dal centralino e
  /// con lei quello che si erano detti — anche dalla plancia di quella casa.
  /// E' il verso giusto della promessa scritta prima della prima riga.
  Future<bool> butta(String linea) async {
    final detto = await _filo.risultato({
      'type': 'ponte/console/butta',
      'linea': linea,
    });
    return detto is Map && detto['dropped'] == true;
  }
}
