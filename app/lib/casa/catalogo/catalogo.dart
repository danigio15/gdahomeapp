/// Il catalogo delle integrazioni: cosa c'e' collegato a Home Assistant.
///
/// Un elettrodomestico moderno non e' un'entita': e' **un dispositivo con
/// dentro venti o trenta entita'**. hOn per Hoover, Candy e Haier; Home
/// Connect per Bosch e Siemens; Miele; LG ThinQ. Lo stesso vale per un'auto o
/// per un robot: il programma, la fase, il tempo che manca, l'energia del
/// ciclo, l'oblo', ognuno per conto suo.
///
/// Chi configura la sua lavatrice non deve battere venti identificativi: deve
/// scegliere l'integrazione, poi il dispositivo, e le entita' le trova gia'
/// li'. E' quello che fa la Config della dashboard, ed e' il motivo per cui
/// configurare l'auto elettrica a mano — diciassette caselle — non e' una
/// cosa che si chiede a qualcuno.
///
/// Il pezzo difficile e' gia' fatto e sta nel ponte (`ponte/src/catalogo.js`):
/// legge i registri di Home Assistant e serve il menu con la stessa forma che
/// aveva l'integrazione. Qui c'e' solo chi lo chiede.
library;

import '../../ponte/filo.dart';

/// Quanto si aspetta il catalogo: legge quattro registri e li mette insieme.
const attesaDelCatalogo = Duration(seconds: 25);

/// Il comando del ponte.
const comandoDelCatalogo = 'dashboardmodern/integrations/catalog';

/// Un'integrazione: hOn, Home Connect, Miele.
class Integrazione {
  const Integrazione({
    required this.dominio,
    required this.nome,
    required this.quantiDispositivi,
    required this.diQualcunAltro,
  });

  /// Come si chiama nel codice: `hon`, `home_connect`.
  final String dominio;

  /// Come si chiama per chi guarda: «hOn», «Home Connect».
  final String nome;

  final int quantiDispositivi;

  /// `true` quando non e' una delle integrazioni di serie di Home Assistant:
  /// e' arrivata da HACS o da una cartella. Non cambia niente, ma chi cerca la
  /// sua lavatrice e non la trova vuole sapere se l'integrazione e' quella
  /// giusta.
  final bool diQualcunAltro;
}

/// Un dispositivo: la lavatrice, l'auto, il robot.
class Dispositivo {
  const Dispositivo({
    required this.id,
    required this.nome,
    required this.marca,
    required this.modello,
    required this.integrazione,
    required this.stanza,
    required this.quanteEntita,
    required this.spento,
  });

  final String id;
  final String nome;
  final String marca;
  final String modello;
  final String integrazione;
  final String stanza;
  final int quanteEntita;

  /// Disabilitato in Home Assistant: si vede, ma le sue entita' non
  /// risponderanno.
  final bool spento;

  /// Marca e modello in una riga, per chi ha tre lavatrici uguali di nome.
  String get sotto => [
    if (marca.isNotEmpty) marca,
    if (modello.isNotEmpty) modello,
    if (stanza.isNotEmpty) stanza,
  ].join(' · ');
}

/// Un'entita' di un dispositivo.
class EntitaDelDispositivo {
  const EntitaDelDispositivo({
    required this.id,
    required this.nome,
    required this.classe,
    required this.unita,
    required this.categoria,
    required this.spenta,
  });

  final String id;

  /// Il nome **senza quello del dispositivo davanti**: nel menu di una
  /// lavatrice «Lavatrice Tempo rimanente» diventa «Tempo rimanente», che e'
  /// l'unica meta' che serve a distinguerlo dalle altre diciannove.
  final String nome;

  final String classe;
  final String unita;

  /// `config` o `diagnostic`: entita' di servizio, che di solito non si
  /// mettono in una tessera.
  final String categoria;

  final bool spenta;
}

/// Quello che il ponte risponde.
class IlCatalogo {
  const IlCatalogo({
    required this.integrazioni,
    required this.dispositivi,
    required this.entita,
  });

  const IlCatalogo.vuoto()
    : integrazioni = const [],
      dispositivi = const [],
      entita = const {};

  final List<Integrazione> integrazioni;
  final List<Dispositivo> dispositivi;

  /// Le entita', per dispositivo. Arrivano solo per i dispositivi che si
  /// chiedono: una casa grande ne ha migliaia, e il menu ne vuole vedere venti
  /// alla volta.
  final Map<String, List<EntitaDelDispositivo>> entita;

  List<Dispositivo> dellIntegrazione(String dominio) => [
    for (final uno in dispositivi)
      if (uno.integrazione == dominio) uno,
  ];
}

/// Chiede il catalogo al ponte.
///
/// [dispositivi] chiede anche le entita' di quei dispositivi. Senza, arrivano
/// solo le integrazioni e i dispositivi — che e' quello che serve ai primi due
/// passi del menu.
Future<IlCatalogo> chiediIlCatalogo(
  Filo filo, {
  List<String> dispositivi = const [],
}) async {
  final detto = await filo.chiedi({
    'type': comandoDelCatalogo,
    if (dispositivi.isNotEmpty) 'device_ids': dispositivi,
  }, entro: attesaDelCatalogo);
  return leggiIlCatalogo(detto['result']);
}

/// Separato da chi lo chiede, cosi' le prove non hanno bisogno di un filo.
IlCatalogo leggiIlCatalogo(dynamic risultato) {
  if (risultato is! Map) return const IlCatalogo.vuoto();
  /* Un campo che non e' un elenco vale come un elenco vuoto, non come un
   * errore: il catalogo arriva da fuori, e una risposta storta deve lasciare
   * il menu vuoto, non farlo cadere. Il cast diretto invece sollevava. */
  List<Map<String, dynamic>> elenco(String dove) {
    final letto = risultato[dove];
    if (letto is! List) return const [];
    return [
      for (final uno in letto)
        if (uno is Map) Map<String, dynamic>.from(uno),
    ];
  }

  final entita = <String, List<EntitaDelDispositivo>>{};
  for (final una in elenco('entities')) {
    final quale = '${una['device_id'] ?? ''}';
    if (quale.isEmpty) continue;
    (entita[quale] ??= []).add(
      EntitaDelDispositivo(
        id: '${una['entity_id'] ?? ''}',
        nome: '${una['name'] ?? una['entity_id'] ?? ''}',
        classe: '${una['device_class'] ?? ''}',
        unita: '${una['unit'] ?? ''}',
        categoria: '${una['category'] ?? ''}',
        spenta: una['disabled'] == true || una['hidden'] == true,
      ),
    );
  }

  return IlCatalogo(
    integrazioni: [
      for (final una in elenco('integrations'))
        Integrazione(
          dominio: '${una['domain'] ?? ''}',
          nome: '${una['name'] ?? una['domain'] ?? ''}',
          quantiDispositivi: (una['devices'] as num?)?.toInt() ?? 0,
          /* `custom` puo' essere `null` quando il manifesto non c'e': allora
           * non si sa, e non si dice. */
          diQualcunAltro: una['custom'] == true,
        ),
    ],
    dispositivi: [
      for (final uno in elenco('devices'))
        Dispositivo(
          id: '${uno['id'] ?? ''}',
          nome: '${uno['name'] ?? ''}',
          marca: '${uno['manufacturer'] ?? ''}',
          modello: '${uno['model'] ?? ''}',
          integrazione: '${uno['integration'] ?? ''}',
          stanza: '${uno['area'] ?? ''}',
          quanteEntita: (uno['entities'] as num?)?.toInt() ?? 0,
          spento: uno['disabled'] == true,
        ),
    ],
    entita: entita,
  );
}
