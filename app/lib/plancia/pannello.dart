/// Il pannello di DashboardModern: dove Home Assistant tiene la plancia vera.
///
/// L'integrazione registra un pannello nella barra laterale di Home Assistant
/// e, nella sua configurazione, scrive tutto quello che serve per aprire la
/// plancia da fuori dal pannello: **dove stanno i file** — un percorso con
/// dentro un'impronta, che cambia a ogni aggiornamento — quale istanza e',
/// quale profilo di configurazione usa, e in quali lingue esiste.
///
/// Si legge con `get_panels`, che e' un comando di Home Assistant come gli
/// altri e passa dal ponte senza che il ponte lo sappia. Una casa senza
/// DashboardModern non ha quel pannello, e allora la plancia non c'e': e' una
/// cosa da dire, non un guasto.
library;

import '../ponte/filo.dart';

/// Il nome con cui l'integrazione registra il pannello. Quello principale ha
/// proprio questo percorso; gli altri gli mettono dietro un trattino.
const _dominio = 'dashboardmodern';

class PannelloDellaPlancia {
  const PannelloDellaPlancia({
    required this.percorso,
    required this.titolo,
    required this.base,
    required this.istanza,
    required this.profilo,
    required this.primario,
    required this.varianti,
  });

  /// Il percorso del pannello in Home Assistant: `dashboardmodern`, o
  /// `dashboardmodern-mare` per una seconda plancia.
  final String percorso;

  /// Come si chiama la plancia: «DashboardModern», o come l'ha chiamata chi
  /// ne ha piu' d'una.
  final String titolo;

  /// Dove stanno i file: `/dashboardmodern_static/<impronta>`. L'impronta
  /// cambia a ogni aggiornamento dell'integrazione, ed e' cosi' che un
  /// telefono che tiene i file sul disco si accorge che sono cambiati.
  final String base;

  /// L'identificativo dell'istanza, che la plancia usa per tenere separate le
  /// cose di una plancia da quelle di un'altra sullo stesso telefono.
  final String istanza;

  /// Il profilo della configurazione condivisa: `primary` per la principale.
  final String profilo;

  /// `true` per la plancia principale.
  final bool primario;

  /// I file della plancia che ci sono davvero: `dashboard.html`,
  /// `dashboard-en.html`.
  final List<String> varianti;

  /// La pagina da aprire per questa lingua, relativa a [base].
  ///
  /// Italiano e' `dashboard.html`; le altre lingue hanno il loro suffisso, e
  /// se per una lingua la pagina non c'e' si torna all'italiano, che c'e'
  /// sempre.
  String pagina(String lingua) {
    final voluta = lingua == 'it' ? 'dashboard.html' : 'dashboard-$lingua.html';
    if (varianti.contains(voluta)) return voluta;
    if (lingua != 'en' && varianti.contains('dashboard-en.html')) {
      return 'dashboard-en.html';
    }
    return 'dashboard.html';
  }

  /// Il percorso completo della pagina, dalla radice di Home Assistant.
  String percorsoDellaPagina(String lingua) => '$base/legacy/${pagina(lingua)}';

  @override
  String toString() => 'PannelloDellaPlancia($percorso → $base)';
}

/// Chiede a Home Assistant i pannelli e trova quello della plancia.
///
/// `null` se DashboardModern non c'e'. Con piu' plance si prende la
/// principale.
Future<PannelloDellaPlancia?> trovaLaPlancia(Filo filo) async {
  final risposta = await filo.risultato({'type': 'get_panels'});
  return leggiIPannelli(risposta);
}

/// Da quello che risponde `get_panels` al pannello della plancia.
///
/// Sta fuori dalla chiamata perche' e' la parte che si sbaglia, e la parte che
/// si prova: la forma di quella risposta non la decidiamo noi.
PannelloDellaPlancia? leggiIPannelli(Object? risposta) {
  if (risposta is! Map) return null;
  final trovati = <PannelloDellaPlancia>[];
  for (final voce in risposta.entries) {
    final pannello = voce.value;
    if (pannello is! Map) continue;
    final config = pannello['config'];
    if (config is! Map) continue;
    final base = config['static_base'];
    /* E' il pannello di DashboardModern se sa dove stanno i suoi file: e'
     * l'unica cosa che lo distingue da un altro pannello personalizzato, e
     * l'unica che ci serve. */
    if (base is! String || !base.startsWith('/dashboardmodern_static/')) {
      continue;
    }
    final percorso = pannello['url_path'];
    final varianti = config['legacy_variants'];
    trovati.add(
      PannelloDellaPlancia(
        percorso: percorso is String && percorso.isNotEmpty
            ? percorso
            : voce.key.toString(),
        titolo: switch (config['title']) {
          final String s when s.isNotEmpty => s,
          _ => 'DashboardModern',
        },
        base: base.replaceAll(RegExp(r'/+$'), ''),
        istanza: config['instance_id']?.toString() ?? '',
        profilo: switch (config['config_profile']) {
          final String s when s.isNotEmpty => s,
          _ => 'primary',
        },
        primario: config['primary'] == true,
        varianti: [
          if (varianti is List)
            for (final una in varianti)
              if (una is String && una.isNotEmpty) una,
        ],
      ),
    );
  }
  if (trovati.isEmpty) return null;
  for (final uno in trovati) {
    if (uno.primario) return uno;
  }
  for (final uno in trovati) {
    if (uno.percorso == _dominio) return uno;
  }
  return trovati.first;
}
