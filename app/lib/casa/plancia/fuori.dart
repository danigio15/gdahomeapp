/// Quali entita' restano fuori dalle tessere della Home, tessera per tessera.
///
/// E' il porto fedele di `core/fuori-dai-widget.js`. Le tessere del ponte
/// leggono la configurazione della sezione che raccontano, tutta: le luci
/// sono quelle della scheda Luci, le tapparelle quelle della scheda
/// Tapparelle. Va bene finche' uno le vuole tutte, ma la sezione e la
/// tessera non servono la stessa cosa — in Home si guarda di sfuggita — e
/// senza una parola in contrario non c'era modo di dire «questa no».
///
/// La parola in contrario sta in `cd_widgets.excluded`, e ogni voce e' o
/// un'entita' nuda — fuori da tutte le tessere — o `tessera|entita'`, fuori
/// da quella sola: lo stesso contatto sta scritto nelle Finestre e nei
/// Varchi, e spegnerlo nei Varchi non deve farlo sparire dalle Finestre.
library;

/// Il segno che divide la tessera dall'entita' dentro una voce.
const separatoreDellaVoce = '|';

/// Com'e' fatto un entity_id, per riconoscerlo dentro una riga.
final formaDellEntita = RegExp(r'^[a-z_]+\.[a-z0-9_]+$', caseSensitive: false);

String _pulito(Object? valore) => '${valore ?? ''}'.trim();

/// Le due meta' di una voce: la tessera (o «») e l'entita'.
({String tessera, String entita})? leggiLaVoce(Object? voce) {
  final testo = _pulito(voce);
  if (testo.isEmpty) return null;
  final taglio = testo.indexOf(separatoreDellaVoce);
  if (taglio < 0) return (tessera: '', entita: testo);
  final tessera = testo.substring(0, taglio).trim();
  final entita = testo.substring(taglio + separatoreDellaVoce.length).trim();
  if (tessera.isEmpty || entita.isEmpty) return null;
  return (tessera: tessera, entita: entita);
}

/// Come si scrive la scelta: nuda se la tessera non si sa, con la tessera se
/// si sa.
String scriviLaVoce(String tessera, String entita) {
  final id = _pulito(entita);
  if (id.isEmpty) return '';
  final quale = _pulito(tessera);
  return quale.isEmpty ? id : '$quale$separatoreDellaVoce$id';
}

/// Come si chiamava prima la tessera che adesso si chiama cosi'.
///
/// Le porte e i cancelli stavano dentro la tessera della Sicurezza, e
/// l'interruttore accanto a ogni apertura scriveva «sicurezza|...». Adesso
/// hanno tessera loro (#457), ma quelle voci sono gia' scritte in casa di chi
/// le ha spente: senza questa riga un'apertura tolta dalla Home ci tornerebbe
/// da sola. Vale in lettura; rimettere dentro un'apertura porta via anche la
/// voce vecchia, e le scelte nuove nascono col nome nuovo.
const nomiDiPrima = <String, List<String>>{
  'porte': ['sicurezza'],
};

Set<String> _eISuoiNomiDiPrima(String tessera) => {
  tessera,
  ...?nomiDiPrima[tessera],
};

List<String> _voci(Iterable<Object?>? elenco) => [
  for (final voce in elenco ?? const <Object?>[])
    if (_pulito(voce).isNotEmpty) _pulito(voce),
];

/// Le entita' che questa tessera non mostra: le voci nude — che valgono per
/// tutte — e quelle scritte per questa tessera. Quelle scritte per un'altra
/// restano fuori dal conto: e' tutto il senso della faccenda.
Set<String> escluseDellaTessera(
  Iterable<Object?>? elenco, [
  String tessera = '',
]) {
  final nomi = _eISuoiNomiDiPrima(_pulito(tessera));
  final fuori = <String>{};
  for (final voce in _voci(elenco)) {
    final letta = leggiLaVoce(voce);
    if (letta == null) continue;
    if (letta.tessera.isEmpty || nomi.contains(letta.tessera)) {
      fuori.add(letta.entita);
    }
  }
  return fuori;
}

/// Se questa entita' e' fuori da questa tessera.
bool eFuori(Iterable<Object?>? elenco, String tessera, String entita) =>
    escluseDellaTessera(elenco, tessera).contains(_pulito(entita));

/// Toglie un'entita' da una tessera.
///
/// Se c'e' gia' una voce nuda quell'entita' e' fuori da tutte, e aggiungerne
/// una per questa tessera direbbe due volte la stessa cosa: l'elenco resta
/// com'e'.
List<String> togliDallaTessera(
  Iterable<Object?>? elenco,
  String tessera,
  String entita,
) {
  final id = _pulito(entita);
  final voci = _voci(elenco);
  if (id.isEmpty) return voci;
  if (eFuori(voci, tessera, id)) return voci;
  return [...voci, scriviLaVoce(tessera, id)];
}

/// Rimette un'entita' dentro una tessera.
///
/// Se ne va la voce di questa tessera e se ne va quella nuda — che teneva
/// l'entita' fuori da tutte, e che chi tocca l'interruttore adesso ha appena
/// smentito. Le voci scritte per ALTRE tessere restano dove sono.
List<String> rimettiNellaTessera(
  Iterable<Object?>? elenco,
  String tessera,
  String entita,
) {
  final id = _pulito(entita);
  final quale = _pulito(tessera);
  final voci = _voci(elenco);
  if (id.isEmpty) return voci;
  final nomi = _eISuoiNomiDiPrima(quale);
  return [
    for (final voce in voci)
      if (switch (leggiLaVoce(voce)) {
        null => true,
        final letta when letta.entita != id => true,
        /* Senza tessera non c'e' un «qui» da cui rimettere dentro: si
         * rimette dentro dappertutto. */
        _ when quale.isEmpty => false,
        /* Anche la voce col nome di prima se ne va: e' la stessa scelta,
         * scritta quando questa tessera si chiamava in un altro modo. */
        final letta =>
          letta.tessera.isNotEmpty && !nomi.contains(letta.tessera),
      })
        voce,
  ];
}

/// La tessera di una linguetta del Config, quando ne serve una sola:
/// `TESSERE_PER_SCHEDA`. Le linguette che ne servono piu' d'una — gli Avvisi,
/// le liste con le evidenze — non ci sono apposta: li' la scelta resta nuda.
const tesserePerScheda = <String, String>{
  'luci': 'luci',
  'tapp': 'tapparelle',
  'pool': 'piscina',
  'irr': 'irrigazione',
  'appliances': 'elettrodomestici',
  'robot': 'robot',
  'ups': 'ups',
  'prese': 'prese',
  'media': 'media',
  'batterie': 'batterie',
  'varchi': 'varchi',
  'presenza': 'presenza',
  'rifiuti': 'rifiuti',
  'doors': 'porte',
  'allerte': 'allerte',
};

/// La tessera di un blocco delle linguette «sezN», per posto in fila:
/// `TESSERE_PER_BLOCCO`. I posti che mancano non hanno una tessera: la Home,
/// l'Energia, le azioni rapide.
const tesserePerBlocco = <int, String>{
  2: 'ev',
  3: 'solare',
  4: 'sicurezza',
  6: 'minipc',
  7: 'temperatura',
  9: 'clima',
  10: 'telecamere',
};

/// I marchi che i moduli si mettono addosso quando disegnano una scheda
/// propria dentro la linguetta di un'altra sezione (`MARCHIO_TESSERA`): la
/// VMC nel Clima, lo scaldabagno e la caldaia nel Solare.
const tessereMarchiate = <String>['vmc', 'solare', 'scaldabagno', 'caldaia'];

/// La tessera di una linguetta, o «» se quella linguetta ne serve piu' d'una.
String tesseraDellaScheda(String scheda) =>
    tesserePerScheda[_pulito(scheda)] ?? '';

/// La tessera del blocco che sta in questo posto, o «» se non ne ha una.
String tesseraDelBlocco(int posto) => tesserePerBlocco[posto] ?? '';
