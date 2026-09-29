/// Un'entita' di Home Assistant, ridotta a quello che serve per farla vedere.
library;

class Entita {
  const Entita({
    required this.id,
    required this.stato,
    required this.attributi,
    this.cambiataIl,
    this.aggiornataIl,
  });

  final String id;
  final String stato;
  final Map<String, dynamic> attributi;

  /// Quando il **valore** e' cambiato l'ultima volta. Un sensore che ridice lo
  /// stesso numero non la sposta.
  final DateTime? cambiataIl;

  /// Quando Home Assistant ha scritto questo stato, anche se il valore e' lo
  /// stesso di prima.
  ///
  /// E' quella che serve per sapere quanto ci mette un cambiamento ad
  /// arrivare fin qui: [cambiataIl] su un sensore che ripete lo stesso valore
  /// resta ferma a ore fa, e misurata come ritardo direbbe una bugia grossa.
  final DateTime? aggiornataIl;

  /// Il pezzo prima del punto: `light`, `sensor`, `switch`.
  String get dominio => id.split('.').first;

  /// Il nome che ha dato l'utente, o l'identificativo quando non ce n'e' uno.
  String get nome {
    final scritto = attributi['friendly_name'];
    return scritto is String && scritto.isNotEmpty ? scritto : id;
  }

  String? get unita => attributi['unit_of_measurement'] as String?;

  /// Home Assistant dice `unavailable` quando l'apparecchio non risponde e
  /// `unknown` quando risponde ma non sa cosa dire. Per chi guarda sono la
  /// stessa cosa: un numero che non c'e'.
  bool get muta => stato == 'unavailable' || stato == 'unknown';

  bool get accesa => stato == 'on' || stato == 'open' || stato == 'home';

  static Entita? leggi(Object? grezza) {
    if (grezza is! Map) return null;
    final id = grezza['entity_id'];
    final stato = grezza['state'];
    if (id is! String || stato is! String) return null;
    final attributi = grezza['attributes'];
    return Entita(
      id: id,
      stato: stato,
      attributi: attributi is Map
          ? Map<String, dynamic>.from(attributi)
          : const {},
      cambiataIl: DateTime.tryParse(grezza['last_changed'] as String? ?? ''),
      aggiornataIl: DateTime.tryParse(
        grezza['last_updated'] as String? ??
            grezza['last_changed'] as String? ??
            '',
      ),
    );
  }

  /// Un'entita' nella forma stretta di `subscribe_entities`: `s` lo stato,
  /// `a` gli attributi, `lc` e `lu` i secondi dal 1970. `lu` c'e' solo quando
  /// non e' uguale a `lc`.
  static Entita? daStretta(String id, Object? stretta) {
    if (stretta is! Map) return null;
    final stato = stretta['s'];
    if (stato is! String) return null;
    final attributi = stretta['a'];
    final cambiata = _daiSecondi(stretta['lc']);
    return Entita(
      id: id,
      stato: stato,
      attributi: attributi is Map
          ? Map<String, dynamic>.from(attributi)
          : const {},
      cambiataIl: cambiata,
      aggiornataIl: _daiSecondi(stretta['lu']) ?? cambiata,
    );
  }

  /// Questa entita' dopo un cambiamento di `subscribe_entities`: in `+` quello
  /// che e' nuovo (lo stato, gli attributi cambiati, `lc` oppure `lu`), in
  /// `-` gli attributi che non ci sono piu'.
  Entita conIlCambio(Object? cambio) {
    if (cambio is! Map) return this;
    final piu = cambio['+'];
    final meno = cambio['-'];
    final nuovi = Map<String, dynamic>.of(attributi);
    var nuovo = stato;
    var cambiata = cambiataIl;
    var aggiornata = aggiornataIl;
    if (piu is Map) {
      if (piu['s'] case final String s) nuovo = s;
      if (piu['a'] case final Map a) nuovi.addAll(Map<String, dynamic>.from(a));
      /* Col valore cambia anche l'ora della scrittura: Home Assistant manda
       * `lc` e sottintende `lu`. */
      if (_daiSecondi(piu['lc']) case final lc?) {
        cambiata = lc;
        aggiornata = lc;
      }
      if (_daiSecondi(piu['lu']) case final lu?) aggiornata = lu;
    }
    if (meno is Map && meno['a'] is List) {
      for (final tolto in meno['a'] as List) {
        nuovi.remove('$tolto');
      }
    }
    return Entita(
      id: id,
      stato: nuovo,
      attributi: nuovi,
      cambiataIl: cambiata,
      aggiornataIl: aggiornata,
    );
  }

  static DateTime? _daiSecondi(Object? secondi) => secondi is num
      ? DateTime.fromMicrosecondsSinceEpoch(
          (secondi * 1000000).round(),
          isUtc: true,
        )
      : null;

  @override
  String toString() => '$id = $stato';
}
