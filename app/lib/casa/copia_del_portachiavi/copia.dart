/// La copia del portachiavi, per il ponte (`../ponte_del_portachiavi.dart`).
///
/// Sul telefono e' un file nella cartella di supporto dell'app; nel browser
/// non c'e', perche' li' il ponte e' spento. Chi la usa non lo sa: riceve una
/// [CopiaDelPortachiavi].
library;

export 'sul_web.dart'
    if (dart.library.io) 'su_disco.dart'
    show copiaDiQuestoSistema;

/// Dove stanno i segni copiati dal portachiavi: tutti insieme, chiave per
/// chiave, come li ridarebbe `readAll`.
abstract interface class CopiaDelPortachiavi {
  /// I segni copiati; `null` se la copia non c'e' o non si legge.
  Future<Map<String, String>?> leggi();

  /// Sostituisce la copia con [segni], tutta insieme: o va tutta o non va.
  Future<void> scrivi(Map<String, String> segni);
}
