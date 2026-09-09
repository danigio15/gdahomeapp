/// Le stanze delle entita', dai registri di Home Assistant.
///
/// In che stanza sta un'entita' **non e' scritto nel suo stato**: gli stati
/// portano il nome, il valore, la classe e l'unita', e basta. La stanza sta
/// nei registri, e per saperla vanno messi insieme tre elenchi — le entita',
/// gli apparecchi, le aree — esattamente come fa la plancia (`areaResolver`
/// in `entity-search-section.js`) e come fa gia' il ponte per il catalogo
/// delle integrazioni.
///
/// Senza, il cercatore e' cieco proprio dove servirebbe di piu': chi
/// configura la temperatura della cameretta cerca «cameretta», e se la parola
/// sta solo nella stanza e non nel nome dell'entita' non trova niente.
///
/// Si legge una volta e ci si tiene la risposta: i registri cambiano quando si
/// aggiunge un apparecchio, non mentre si configura.
library;

import '../../ponte/filo.dart';

/// Quanto si aspettano i tre elenchi. Sono piccoli — nomi, non stati — ma
/// passano dal centralino come tutto il resto.
const attesaDeiRegistri = Duration(seconds: 20);

class RegistroDelleStanze {
  RegistroDelleStanze();

  final _stanzaDi = <String, String>{};
  bool _letto = false;
  Future<void>? _sto;

  /// `true` quando i registri sono arrivati, anche se erano vuoti.
  bool get letto => _letto;

  /// Quante entita' hanno una stanza.
  int get quante => _stanzaDi.length;

  /// La stanza di un'entita', o stringa vuota.
  String stanzaDi(String id) => _stanzaDi[id] ?? '';

  /// Li legge, una volta sola. Chiamarla di nuovo mentre sta leggendo aspetta
  /// la lettura in corso invece di farne una seconda.
  Future<void> leggi(Filo filo) {
    if (_letto) return Future.value();
    return _sto ??= _leggiDavvero(filo).whenComplete(() => _sto = null);
  }

  Future<void> _leggiDavvero(Filo filo) async {
    /* Le aree sono facoltative: una casa senza stanze e' una casa normale, e
     * un Home Assistant vecchio potrebbe non conoscere il comando. Senza di
     * loro il cercatore funziona lo stesso, un po' piu' cieco. */
    final tutti = await Future.wait([
      _forse(filo, 'config/entity_registry/list'),
      _forse(filo, 'config/device_registry/list'),
      _forse(filo, 'config/area_registry/list'),
    ]);
    final entita = tutti[0];
    final apparecchi = tutti[1];
    final aree = tutti[2];

    final nomeDellArea = <String, String>{};
    for (final una in aree) {
      final quale = '${una['area_id'] ?? ''}';
      final nome = '${una['name'] ?? ''}';
      if (quale.isEmpty || nome.isEmpty) continue;
      nomeDellArea[quale] = nome;
    }

    final areaDellApparecchio = <String, String>{};
    for (final uno in apparecchi) {
      final quale = '${uno['id'] ?? ''}';
      final area = '${uno['area_id'] ?? ''}';
      if (quale.isEmpty || area.isEmpty) continue;
      areaDellApparecchio[quale] = area;
    }

    _stanzaDi.clear();
    for (final una in entita) {
      final id = '${una['entity_id'] ?? ''}';
      if (id.isEmpty) continue;
      /* L'area dell'entita' vince su quella del suo apparecchio: e' la
       * stessa precedenza della plancia, ed e' quella giusta — chi sposta una
       * sola entita' in un'altra stanza lo fa apposta. */
      var area = '${una['area_id'] ?? ''}';
      if (area.isEmpty) {
        area = areaDellApparecchio['${una['device_id'] ?? ''}'] ?? '';
      }
      final nome = nomeDellArea[area] ?? '';
      if (nome.isNotEmpty) _stanzaDi[id] = nome;
    }
    _letto = true;
  }

  Future<List<Map<String, dynamic>>> _forse(Filo filo, String cosa) async {
    try {
      final letto = await filo.risultato({
        'type': cosa,
      }, entro: attesaDeiRegistri);
      if (letto is! List) return const [];
      return [
        for (final uno in letto)
          if (uno is Map) Map<String, dynamic>.from(uno),
      ];
    } on Object {
      /* Un comando che Home Assistant non conosce, o un filo caduto a meta':
       * si va avanti senza le stanze invece di non far vedere niente. */
      return const [];
    }
  }
}
