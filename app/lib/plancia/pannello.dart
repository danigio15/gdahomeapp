/// Dove sta la plancia vera, e com'e' fatta.
///
/// Quello che serve per aprirla: **dove stanno i file** — un percorso con
/// dentro un'impronta, che cambia a ogni aggiornamento — quale istanza e',
/// quale profilo di configurazione usa, e in quali lingue esiste.
///
/// Lo dice il ponte, con `ponte/plancia`: la plancia sta dentro l'add-on, e
/// in Home Assistant non serve nessuna integrazione. Se il ponte non ce l'ha,
/// si guarda se in Home Assistant c'e' l'integrazione, che registra un
/// pannello con le stesse informazioni e si legge con `get_panels`. Se non
/// c'e' da nessuna parte, la plancia non c'e': e' una cosa da dire, non un
/// guasto.
library;

import '../ponte/errori.dart';
import '../ponte/filo.dart';

/// Il nome con cui l'integrazione registra il pannello. Quello principale ha
/// proprio questo percorso; gli altri gli mettono dietro un trattino.
const _dominio = 'dashboardmodern';

/// Una delle plance di questa casa, nell'elenco che si sceglie.
///
/// Nella dashboard ognuna e' una **istanza** dell'integrazione, e chi ne ha due
/// le trova come due voci in Home Assistant. Qui l'integrazione non c'e' e
/// l'elenco lo tiene il ponte (`ponte/plance`), ma le tre cose che distinguono
/// una plancia dall'altra sono le stesse — e sono tre, non una:
///
///  - il **profilo** e' il nome del cassetto dov'e' la sua configurazione, e
///    non si vede da nessuna parte;
///  - il **titolo** e' come la chiama chi ci abita, ed e' quello che si legge;
///  - l'**istanza** e' il nome con cui la pagina tiene separate le proprie cose
///    nel deposito del browser: il tema, la tavolozza, la barra.
///
/// Tenerle separate non e' pignoleria: confonderle vorrebbe dire che
/// rinominare una plancia le cancella il tema.
class UnaPlancia {
  const UnaPlancia({
    required this.profilo,
    required this.titolo,
    required this.istanza,
    required this.primaria,
  });

  final String profilo;
  final String titolo;
  final String istanza;

  /// `true` per quella di sempre. E' la plancia che si apre quando nessuno ha
  /// scelto niente, ed e' l'unica che non si puo' togliere.
  final bool primaria;

  static UnaPlancia? daJson(Object? grezza) {
    if (grezza is! Map) return null;
    final profilo = grezza['profilo'];
    if (profilo is! String || profilo.isEmpty) return null;
    final titolo = grezza['titolo'];
    return UnaPlancia(
      profilo: profilo,
      titolo: titolo is String && titolo.isNotEmpty ? titolo : profilo,
      istanza: switch (grezza['istanza']) {
        final String s when s.isNotEmpty => s,
        _ => 'ponte',
      },
      primaria: grezza['primaria'] == true,
    );
  }

  @override
  String toString() => 'UnaPlancia($profilo, «$titolo»)';
}

class PannelloDellaPlancia {
  const PannelloDellaPlancia({
    required this.percorso,
    required this.titolo,
    required this.base,
    required this.istanza,
    required this.profilo,
    required this.primario,
    required this.varianti,
    this.plance = const [],
  });

  /// Il percorso del pannello in Home Assistant: `dashboardmodern`, o
  /// `dashboardmodern-mare` per una seconda plancia.
  final String percorso;

  /// Come si chiama la plancia: «gdahome», o come l'ha chiamata chi ne ha
  /// piu' d'una. Il nome glielo dice il ponte; questo e' il ripiego per un
  /// ponte che non lo dice.
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

  /// Le plance di questa casa, tutte, questa compresa.
  ///
  /// Viaggia insieme a dove sta la plancia e non si chiede a parte: il
  /// selettore lo disegna chi ha appena chiesto quale plancia aprire, e una
  /// seconda domanda per sapere quante sono sarebbe un secondo giro sul filo
  /// per niente. Vuota vuol dire un ponte che non le sa tenere — uno di ieri —
  /// e allora di plancia ce n'e' una, com'e' sempre stato.
  final List<UnaPlancia> plance;

  /// Ce n'e' piu' d'una? E' la domanda che decide se il selettore si vede:
  /// una riga per scegliere fra una cosa sola e' una riga di troppo.
  bool get piuDiUna => plance.length > 1;

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

/// Trova la plancia: prima nel ponte, poi in Home Assistant.
///
/// Il posto giusto e' il ponte, `ponte/plancia`: la plancia sta dentro
/// l'add-on, e in Home Assistant non serve nessuna integrazione. Un ponte
/// che non ce l'ha — uno vecchio, o uno sul banco senza la cartella — dice
/// di no, e allora si guarda se in Home Assistant c'e' l'integrazione, che
/// la serve allo stesso modo. `null` se non c'e' da nessuna parte.
///
/// [profilo] e' quale plancia aprire, per chi ne ha piu' d'una e ne ha scelta
/// una. Vuoto vuol dire la prima, che e' la risposta di sempre. Una plancia
/// che nel frattempo non c'e' piu' — l'hanno tolta da un altro telefono — non
/// e' un guasto: si riprova senza chiederne una in particolare, e si apre
/// quella di sempre invece di una schermata vuota.
Future<PannelloDellaPlancia?> trovaLaPlancia(
  Filo filo, {
  String profilo = '',
}) async {
  for (final quale in profilo.isEmpty ? [''] : [profilo, '']) {
    try {
      final dalPonte = leggiLaPlanciaDelPonte(
        await filo.risultato({
          'type': 'ponte/plancia',
          if (quale.isNotEmpty) 'profilo': quale,
        }),
      );
      if (dalPonte != null) return dalPonte;
    } on ComandoRifiutato catch (rifiuto) {
      /* «Quella plancia non c'e'» con un profilo chiesto: si riprova senza.
       * Qualunque altro no vuol dire che questo ponte non ha la plancia, e
       * allora si guarda in Home Assistant. */
      if (!(quale.isNotEmpty && rifiuto.codice == 'not_found')) break;
    }
  }
  final risposta = await filo.risultato({'type': 'get_panels'});
  return leggiIPannelli(risposta);
}

/// Da quello che risponde `ponte/plancia` al pannello della plancia.
PannelloDellaPlancia? leggiLaPlanciaDelPonte(Object? risposta) {
  if (risposta is! Map) return null;
  final base = risposta['base'];
  if (base is! String || !base.startsWith('/dashboardmodern_static/')) {
    return null;
  }
  final varianti = risposta['varianti'];
  final elenco = risposta['plance'];
  return PannelloDellaPlancia(
    percorso: 'ponte',
    titolo: switch (risposta['titolo']) {
      final String s when s.isNotEmpty => s,
      _ => 'gdahome',
    },
    base: base.replaceAll(RegExp(r'/+$'), ''),
    istanza: risposta['istanza']?.toString() ?? 'ponte',
    profilo: switch (risposta['profilo']) {
      final String s when s.isNotEmpty => s,
      _ => 'primary',
    },
    primario: risposta['primario'] != false,
    varianti: [
      if (varianti is List)
        for (final una in varianti)
          if (una is String && una.isNotEmpty) una,
    ],
    plance: [
      if (elenco is List)
        for (final una in elenco)
          if (UnaPlancia.daJson(una) case final letta?) letta,
    ],
  );
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
          _ => 'gdahome',
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
