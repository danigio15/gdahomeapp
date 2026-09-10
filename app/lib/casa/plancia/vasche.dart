/// Le vasche della piscina, che nella dashboard sono piu' d'una.
///
/// E' il porto fedele di `core/pool-model.js`, e vale la stessa regola scritta
/// in `core/piu-di-uno.js`: **non si sposta niente**. La prima vasca resta in
/// cima all'oggetto salvato, dove il runtime l'ha sempre cercata, e le altre
/// stanno nell'elenco `pools` accanto. Cosi' chi ha una piscina sola non ha un
/// elenco, non ha un id, non ha niente da migrare, e la plancia continua a
/// leggere l'unico posto che ha sempre letto.
///
/// Nell'app la piscina era una sola: la schermata scriveva la mappa in cima e
/// l'elenco accanto non lo apriva nessuno. Chi ha due vasche — la piscina e
/// l'idromassaggio — dalla dashboard le configura tutte e due e dall'app ne
/// vedeva una.
library;

/// I campi di una vasca, con gli stessi nomi che la configurazione usa da
/// sempre. Da `POOL_FIELDS`.
const campiDellaVasca = <String>[
  'name',
  'tempEnt',
  'pumpEnt',
  'heatEnt',
  'lightEnt',
  'phEnt',
  'clEnt',
  'phMin',
  'phMax',
  'clMin',
  'clMax',
  'autoHours',
  'filterHours',
  'filterStart',
  'enabled',
];

/// Gli stessi valori di partenza del runtime: cambiarli qui vorrebbe dire due
/// idee diverse di cosa sia una piscina appena configurata. Da `POOL_DEFAULTS`.
const partenzeDellaVasca = <String, Object>{
  'phMin': 7.0,
  'phMax': 7.6,
  'filterStart': '09:00',
  'filterHours': 8,
  'autoHours': true,
};

String _pulito(Object? valore) => '${valore ?? ''}'.trim();

/// Una vasca ripulita, con l'id che le tocca.
Map<String, dynamic> _normalizzata(Map<String, dynamic> da, int quale) {
  final vasca = <String, dynamic>{
    'id': _pulito(da['id']).isNotEmpty
        ? _pulito(da['id'])
        : (quale == 0 ? 'piscina' : 'piscina-${quale + 1}'),
  };
  for (final campo in campiDellaVasca) {
    final valore = da[campo];
    if (valore != null) {
      vasca[campo] = valore;
    } else if (partenzeDellaVasca.containsKey(campo)) {
      vasca[campo] = partenzeDellaVasca[campo];
    }
  }
  vasca['name'] = _pulito(da['name']);
  return vasca;
}

/// Tutte le vasche, la prima per prima.
List<Map<String, dynamic>> leVasche(Object? scritto) {
  /* Una configurazione gia' scritta come elenco — un'esportazione, un
   * ripristino da un'altra plancia — non deve perdere la prima vasca. */
  if (scritto is List) {
    return [
      for (final (quale, una) in scritto.indexed)
        _normalizzata(
          una is Map ? Map<String, dynamic>.from(una) : <String, dynamic>{},
          quale,
        ),
    ];
  }
  final da = scritto is Map
      ? Map<String, dynamic>.from(scritto)
      : <String, dynamic>{};
  final altre = da['pools'];
  return [
    _normalizzata(da, 0),
    if (altre is List)
      for (final (quale, una) in altre.indexed)
        _normalizzata(
          una is Map ? Map<String, dynamic>.from(una) : <String, dynamic>{},
          quale + 1,
        ),
  ];
}

/// Se vale la pena disegnarla: da `poolIsConfigured`.
bool vascaConfigurata(Map<String, dynamic> vasca) => const [
  'tempEnt',
  'pumpEnt',
  'phEnt',
  'clEnt',
  'heatEnt',
  'lightEnt',
].any((campo) => _pulito(vasca[campo]).isNotEmpty);

/// L'oggetto da salvare, nella forma che il runtime sa gia' leggere.
///
/// Quello che non appartiene alle vasche — l'ultima accensione, una chiave
/// aggiunta da una versione futura — resta dov'e': riscrivere l'oggetto da
/// zero vorrebbe dire buttare via cio' che non si conosce.
Map<String, dynamic> vascheDaSalvare(
  List<Map<String, dynamic>> elenco,
  Map<String, dynamic> prima,
) {
  final vasche = [
    for (final (quale, una) in elenco.indexed) _normalizzata(una, quale),
  ];
  final fuori = Map<String, dynamic>.from(prima)..remove('pools');
  for (final campo in campiDellaVasca) {
    fuori.remove(campo);
  }
  if (vasche.isEmpty) return fuori;
  final capofila = vasche.first;
  fuori['id'] = capofila['id'];
  for (final campo in campiDellaVasca) {
    if (capofila[campo] != null) fuori[campo] = capofila[campo];
  }
  final altre = vasche.skip(1).toList();
  if (altre.isNotEmpty) fuori['pools'] = altre;
  return fuori;
}

/// Come si chiama, quando non gliel'hanno data un nome.
String comeSiChiamaLaVasca(Map<String, dynamic> vasca, int quale) {
  final suo = _pulito(vasca['name']);
  if (suo.isNotEmpty) return suo;
  return quale == 0 ? 'La piscina' : 'Vasca ${quale + 1}';
}
