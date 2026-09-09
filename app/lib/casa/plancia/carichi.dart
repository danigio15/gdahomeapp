/// I carichi dell'energia: i cerchi sotto la Home, con dentro i loro
/// elettrodomestici.
///
/// Cosa sostituisce: un carico era descritto in due posti che non
/// combaciavano. Cinque cerchi fissi stavano in `cd_flow_nodes` con un nome,
/// un'icona, un colore e una tendina che puntava a un gruppo; i gruppi e i
/// loro elettrodomestici in `cd_subload_groups` e `cd_subloads_extra`; e la
/// sezione `cd_loads` teneva una terza copia dei figli. Il cerchio e il gruppo
/// che mostrava erano legati solo da quella tendina, e le due meta' potevano —
/// e lo facevano — separarsi.
///
/// Adesso il palco si disegna dai carichi stessi, quindi la configurazione e'
/// un elenco solo: carichi in ordine, ognuno un cerchio, ognuno coi suoi
/// elettrodomestici. `cd_loads` e' l'unica verita'; le tre chiavi storiche si
/// scrivono lo stesso, **come specchio**, perche' la finestrella dei
/// sottocarichi dentro la plancia le legge ancora — ma nessuno le rilegge
/// dentro il modello.
///
/// Puro: niente schermo, niente scrittura. E' `core/energy-loads-config.js`.
library;

import 'energia.dart';

/// Otto cerchi per impianto. Il tetto vale li' dentro, non sulla somma: due
/// impianti non si dividono i cerchi, ne hanno otto ciascuno.
const massimoDeiCarichi = 8;

/// Dodici elettrodomestici dentro un cerchio.
const massimoDeiSottocarichi = 12;

/// I carichi nati dai cinque cerchi fissi tengono il loro gruppo, cosi' gli
/// elettrodomestici gia' salvati sotto «cucina» o «lavanderia» restano dove
/// sono. Quelli creati da adesso si raggruppano sotto il proprio id.
const caselleStoriche = ['boiler', 'wb', 'clima', 'lav', 'cuc'];

const tavolozza = [
  '#ea580c',
  '#06b6d4',
  '#0ea5e9',
  '#7c3aed',
  '#e11d48',
  '#16a34a',
  '#f59e0b',
  '#6366f1',
];

/// Le caselle di questa maschera sono la parola definitiva.
///
/// Un carico salvato di qui porta il segno: chi tira a indovinare — il
/// contratto dei dispositivi, che riempie le caselle vuote leggendo i nomi
/// delle entita' — sa che qui non c'e' niente da indovinare. Senza il segno
/// svuotare una casella non serviva a niente: si salvava vuota e un istante
/// dopo tornava scritta.
const campiScelti = 'dm_campi_scelti';

/// Lo specchio piatto delle entita', rifatto da capo a ogni salvataggio.
const _campiDiEntita = [
  'control_entity',
  'power_entity',
  'energy_entity',
  'daily_energy_entity',
  'monthly_energy_entity',
  'total_energy_entity',
  'history_entity',
  'report_entity',
  'state_entity',
];

String _pulito(dynamic valore) => '${valore ?? ''}'.trim();

Map<String, dynamic> _mappa(dynamic valore) =>
    valore is Map ? Map<String, dynamic>.from(valore) : <String, dynamic>{};

List<Map<String, dynamic>> _elenco(dynamic valore) => valore is List
    ? [
        for (final uno in valore)
          if (uno is Map) Map<String, dynamic>.from(uno),
      ]
    : const [];

String segnaposto(String valore) {
  const accentate = 'àáâãäåèéêëìíîïòóôõöùúûüçñ';
  const piatte = 'aaaaaaeeeeiiiiooooouuuucn';
  final buffer = StringBuffer();
  for (final rune in valore.trim().toLowerCase().runes) {
    final lettera = String.fromCharCode(rune);
    final dove = accentate.indexOf(lettera);
    buffer.write(dove >= 0 ? piatte[dove] : lettera);
  }
  return buffer
      .toString()
      .replaceAll(RegExp('[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
}

String _idUnico(String base, Set<String> presi) {
  final seme = base.trim().isEmpty ? 'carico' : base.trim();
  var id = seme;
  var contatore = 2;
  while (presi.contains(id)) {
    id = '$seme-${contatore++}';
  }
  presi.add(id);
  return id;
}

/// Il gruppo di un cerchio: la chiave sotto cui stanno i suoi
/// elettrodomestici.
String gruppoDelCarico(Map<String, dynamic> carico) {
  final scritto = _pulito(_mappa(carico['metadata'])['flow_group']);
  return scritto.isNotEmpty ? scritto : _pulito(carico['id']);
}

/// Lo specchio posizionale, quando vuol ancora dire qualcosa.
///
/// `cd_flow_nodes` ha cinque caselle con un nome fisso, una per cerchio, dal
/// tempo in cui gli impianti erano uno solo. Con due impianti i cerchi del
/// secondo occupano le stesse caselle del primo, e quelle caselle portano il
/// nome, l'icona, il colore E l'entita' della potenza: aprire i carichi della
/// casa di sopra faceva vedere il boiler della casa di sotto, col suo sensore
/// — e salvare glielo scriveva addosso.
Map<String, dynamic>? specchioDeiCerchi(
  dynamic nodi, [
  int quantiImpianti = 1,
]) {
  if (nodi is! Map) return null;
  return quantiImpianti > 1 ? null : Map<String, dynamic>.from(nodi);
}

/// Un elettrodomestico dentro un cerchio.
class Sottocarico {
  Sottocarico({
    required this.id,
    required this.nome,
    required this.icona,
    this.potenza = '',
    this.stato = '',
    this.giorno = '',
    this.mese = '',
    this.totale = '',
    this.ritratto = '',
    this.daDove = 'load',
  });

  /// La stessa riga che una rilettura del modello produrrebbe: gli
  /// elettrodomestici arrivano o come carichi (`power_entity`) o come righe
  /// della finestrella storica (`pwr`/`pwrLive`), e di qui esce una forma
  /// sola.
  factory Sottocarico.da(
    Map<String, dynamic> letto,
    int quale, [
    String daDove = 'load',
  ]) {
    final nome = _pulito(letto['name']);
    final id = _pulito(letto['id']);
    return Sottocarico(
      daDove: daDove,
      id: id.isNotEmpty
          ? id
          : '${segnaposto(nome).isEmpty ? 'sottocarico' : segnaposto(nome)}-${quale + 1}',
      nome: nome.isNotEmpty ? nome : 'Carico ${quale + 1}',
      icona: _pulito(letto['icon']).isNotEmpty ? _pulito(letto['icon']) : '🔌',
      potenza: _pulito(
        letto['power'] ??
            letto['pwrLive'] ??
            letto['pwr'] ??
            letto['power_entity'],
      ),
      stato: _pulito(letto['state'] ?? letto['bin'] ?? letto['control_entity']),
      giorno: _pulito(letto['daily'] ?? letto['daily_energy_entity']),
      mese: _pulito(letto['monthly'] ?? letto['monthly_energy_entity']),
      totale: _pulito(letto['total'] ?? letto['total_energy_entity']),
      /* Che elettrodomestico e': serve a disegnarlo come lo disegna la sua
       * sezione. La lavatrice ha un suo ritratto nel catalogo, e qui usciva
       * un'emoji — due sezioni che parlano della stessa lavatrice devono
       * mostrare la stessa lavatrice. */
      ritratto: _pulito(
        letto['visual_key'] ??
            letto['visual'] ??
            letto['device_type'] ??
            letto['type'],
      ),
    );
  }

  final String id;
  String nome;
  String icona;
  String potenza;
  String stato;
  String giorno;
  String mese;
  String totale;
  final String ritratto;

  /// `load` se lo possiede questa maschera, `appliance` se e' un
  /// elettrodomestico configurato nella sua sezione: qui si mostra, non si
  /// riscrive.
  final String daDove;

  bool get altrui => daDove == 'appliance';
}

/// Un cerchio sotto la Home, coi suoi elettrodomestici.
class Carico {
  Carico({
    required this.id,
    required this.ordine,
    required this.nome,
    required this.icona,
    required this.colore,
    required this.gruppo,
    this.visibile = true,
    this.potenza = '',
    this.totale = '',
    this.giorno = '',
    this.mese = '',
    List<Sottocarico>? figli,
    this.impianto = '',
  }) : figli = figli ?? [];

  final String id;
  int ordine;
  String nome;
  String icona;
  String colore;
  bool visibile;
  final String gruppo;
  String potenza;
  String totale;
  String giorno;
  String mese;
  final List<Sottocarico> figli;

  /// Di quale impianto e' questo cerchio. Vuoto vuol dire il primo.
  final String impianto;

  /// Una riga sotto la scheda, cosi' cosa legge un carico si vede senza
  /// aprirlo.
  String get riassunto {
    // Un cerchio con elettrodomestici e senza sensore suo e' la loro somma:
    // dirlo per primo e' piu' utile che elencare quali caselle sono piene.
    if (potenza.isEmpty && figli.isNotEmpty) {
      return figli.length == 1
          ? 'somma di 1 dispositivo'
          : 'somma di ${figli.length} dispositivi';
    }
    final pezzi = <String>[
      if (potenza.isNotEmpty) 'potenza',
      if (totale.isNotEmpty) 'contatore totale',
      if (giorno.isNotEmpty) 'giorno',
      if (mese.isNotEmpty) 'mese',
      if (figli.length == 1)
        '1 dispositivo'
      else if (figli.isNotEmpty)
        '${figli.length} dispositivi',
    ];
    return pezzi.isEmpty ? 'nessuna entita\'' : pezzi.join(' · ');
  }

  /// Cosa fara' il palco con questo carico, detto chiaro: le due cose che gli
  /// utenti sbagliavano erano leggere un totale di sempre come un periodo, e
  /// aspettarsi un cerchio senza avergli legato niente.
  List<String> get avvisi {
    final energia = totale.isNotEmpty || giorno.isNotEmpty || mese.isNotEmpty;
    // Non manca niente quando il cerchio e' la somma di quello che ha dentro:
    // quella e' una configurazione completa, non una vuota.
    if (potenza.isEmpty && !energia && figli.isNotEmpty) return const [];
    if (potenza.isEmpty && !energia) {
      return const [
        'Nessuna entita\' collegata: il cerchio resta vuoto in tutte le viste.',
      ];
    }
    return [
      if (potenza.isEmpty && energia && figli.isEmpty) 'Manca la potenza: la vista Istantaneo non ha niente da mostrare per questo carico.',
      if (totale.isEmpty && giorno.isEmpty && mese.isEmpty && figli.isEmpty) 'Nessun contatore energia: Giorno e Mese restano vuoti. Basta il contatore totale, il periodo viene calcolato da li\'.',
    ];
  }
}

/// La configurazione salvata di un cerchio che stava nella casella N.
///
/// Contano solo i valori che l'utente ha davvero scritto: il modello
/// normalizzato riempiva ogni campo con un valore storico di ripiego, e
/// adottare quelli vorrebbe dire rinominare un carico che l'utente aveva gia'
/// nominato.
Map<String, dynamic>? _dallaCasella(Map<String, dynamic>? nodi, int quale) {
  if (quale >= caselleStoriche.length || nodi == null) return null;
  final salvato = nodi[caselleStoriche[quale]];
  return salvato is Map ? Map<String, dynamic>.from(salvato) : null;
}

bool _daCerchio(Map<String, dynamic> carico) =>
    carico['category'] != 'manual-report' &&
    _pulito(_mappa(carico['metadata'])['beta27_subload_group']).isEmpty &&
    (_pulito(carico['name']).isNotEmpty ||
        _pulito(carico['power_entity']).isNotEmpty ||
        _pulito(carico['daily_energy_entity']).isNotEmpty ||
        _pulito(carico['monthly_energy_entity']).isNotEmpty ||
        _pulito(carico['total_energy_entity']).isNotEmpty ||
        _pulito(carico['history_entity']).isNotEmpty);

/// Tutta la configurazione dei carichi, nell'ordine in cui i cerchi compaiono
/// sotto la Home.
///
/// `carichi` e' la sezione vera; le altre tre sono le chiavi storiche, lette
/// una volta sola perche' una configurazione che c'e' gia' arrivi nella forma
/// nuova senza che nessuno la ribatta a mano.
List<Carico> modelloDeiCarichi({
  List<Map<String, dynamic>> carichi = const [],
  List<Map<String, dynamic>> elettrodomestici = const [],
  Map<String, dynamic>? nodi,
  List<Map<String, dynamic>> gruppi = const [],
  Map<String, dynamic>? sottocarichi,
  Impianto? impianto,
  int quale = 0,
}) {
  /* Un impianto per volta. Senza impianto passato si prende tutto, che e' come
   * si e' sempre comportato chi ne ha uno solo. */
  final suoi = impianto != null
      ? carichiDellImpianto(carichi, impianto, quale)
      : carichi;
  final cerchi = suoi.where(_daCerchio).toList()
    ..sort((a, b) {
      final sinistra = a['order'] is num ? (a['order'] as num).toInt() : 0;
      final destra = b['order'] is num ? (b['order'] as num).toInt() : 0;
      return sinistra.compareTo(destra);
    });
  final primi = cerchi.take(massimoDeiCarichi).toList();

  final perId = <String, Map<String, dynamic>>{
    for (final gruppo in gruppi) _pulito(gruppo['id']): gruppo,
  };
  final extra = _mappa(sottocarichi);
  // Ogni chiave di gruppo che tiene davvero degli elettrodomestici, da una
  // fonte o dall'altra.
  final chiaviDiGruppo = <String>{
    for (final uno in carichi)
      if (_pulito(_mappa(uno['metadata'])['beta27_subload_group']).isNotEmpty)
        _pulito(_mappa(uno['metadata'])['beta27_subload_group']),
    for (final chiave in extra.keys)
      if (_elenco(extra[chiave]).isNotEmpty) chiave,
  };
  final presi = <String>{};

  return [
    for (final (posto, carico) in primi.indexed)
      () {
        final sopra = _dallaCasella(nodi, posto);
        final id = _idUnico(
          _pulito(carico['id']).isNotEmpty
              ? _pulito(carico['id'])
              : (segnaposto(_pulito(carico['name'])).isNotEmpty
                    ? segnaposto(_pulito(carico['name']))
                    : 'carico-${posto + 1}'),
          presi,
        );
        /* Quale gruppo storico questo cerchio possiede: quello con cui i suoi
         * elettrodomestici sono gia' marcati, per id o per nome del carico. */
        final scritto = _pulito(_mappa(carico['metadata'])['flow_group']);
        final daNome = segnaposto(_pulito(carico['name']));
        final gruppo = scritto.isNotEmpty
            ? scritto
            : (chiaviDiGruppo.contains(id)
                  ? id
                  : (daNome.isNotEmpty && chiaviDiGruppo.contains(daNome)
                        ? daNome
                        : id));
        final suo = perId[gruppo];
        /* Solo i figli di QUESTO impianto: due impianti numerano i cerchi allo
         * stesso modo, e i figli del «carico-1» dell'altro finivano nel
         * modello di questo — e al salvataggio ci venivano scritti una seconda
         * volta, rinominati. */
        bool sotto(Map<String, dynamic> uno) =>
            _pulito(_mappa(uno['metadata'])['beta27_subload_group']) == gruppo;
        final miei = [
          for (final (at, figlio) in suoi.where(sotto).toList().indexed)
            Sottocarico.da(figlio, at),
        ];
        final noti = {for (final figlio in miei) figlio.id};
        /* Un elettrodomestico assegnato a questo cerchio dalla sua sezione
         * appartiene qui, ma si configura di la': si mostra, non si
         * riscrive. */
        final assegnati = [
          for (final (at, figlio)
              in elettrodomestici.where(sotto).toList().indexed)
            Sottocarico.da(figlio, at, 'appliance'),
        ].where((figlio) => !noti.contains(figlio.id)).toList();
        for (final figlio in assegnati) {
          noti.add(figlio.id);
        }
        final vecchi = [
          for (final (at, figlio) in _elenco(extra[gruppo]).indexed)
            Sottocarico.da(figlio, at),
        ].where((figlio) => !noti.contains(figlio.id)).toList();

        return Carico(
          id: id,
          ordine: posto,
          nome: [
            _pulito(sopra?['name']),
            _pulito(carico['name']),
            _pulito(suo?['name']),
            'Carico ${posto + 1}',
          ].firstWhere((uno) => uno.isNotEmpty),
          icona: [
            _pulito(sopra?['icon']),
            _pulito(carico['emoji_icon'] ?? carico['icon']),
            _pulito(suo?['icon']),
            '🔌',
          ].firstWhere((uno) => uno.isNotEmpty),
          /* Il colore non fa parte del contratto dei dispositivi, quindi la
           * copia salvata sta nei metadata; il campo piatto si legge lo stesso
           * per un carico che non e' mai passato da un salvataggio. */
          colore: [
            _pulito(sopra?['color']),
            _pulito(carico['color']),
            _pulito(_mappa(carico['metadata'])['flow_color']),
            _pulito(suo?['color']),
            tavolozza[posto % tavolozza.length],
          ].firstWhere((uno) => uno.isNotEmpty),
          visibile: sopra?['enabled'] == false
              ? false
              : carico['show_in_dashboard'] != false,
          gruppo: gruppo,
          potenza: _pulito(sopra?['pwr']).isNotEmpty
              ? _pulito(sopra?['pwr'])
              : _pulito(carico['power_entity']),
          totale: _pulito(
            carico['total_energy_entity'] ?? carico['history_entity'],
          ),
          giorno: _pulito(carico['daily_energy_entity']),
          mese: _pulito(carico['monthly_energy_entity']),
          figli: [
            ...miei,
            ...assegnati,
            ...vecchi,
          ].take(massimoDeiSottocarichi).toList(),
          impianto: _pulito(carico[campoDellImpianto]),
        );
      }(),
  ];
}

/// Un cerchio nuovo. Nasce nell'impianto che si sta guardando, non nel primo:
/// chi apre «casa Donato» e aggiunge un cerchio lo aggiunge li'.
Carico caricoVuoto(List<Carico> modello, {String impianto = ''}) {
  final posto = modello.length;
  final presi = {for (final uno in modello) uno.id};
  final id = _idUnico('carico-${posto + 1}', presi);
  return Carico(
    id: id,
    ordine: posto,
    nome: 'Carico ${posto + 1}',
    icona: '🔌',
    colore: tavolozza[posto % tavolozza.length],
    gruppo: id,
    impianto: impianto.trim(),
  );
}

/// Un elettrodomestico nuovo dentro un cerchio.
Sottocarico sottocaricoVuoto(Carico carico) {
  final posto = carico.figli.length;
  final presi = {for (final figlio in carico.figli) figlio.id};
  return Sottocarico(
    id: _idUnico(
      '${carico.id.isEmpty ? 'carico' : carico.id}-sub-${posto + 1}',
      presi,
    ),
    nome: 'Carico ${posto + 1}',
    icona: '🔌',
  );
}

/// Lo stesso elenco, col carico spostato di un posto.
List<Carico> spostaIlCarico(List<Carico> modello, String id, int di) {
  final valori = [...modello];
  final da = valori.indexWhere((uno) => uno.id == id.trim());
  final a = da + di;
  if (da < 0 || a < 0 || a >= valori.length) return valori;
  valori.insert(a, valori.removeAt(da));
  for (final (posto, uno) in valori.indexed) {
    uno.ordine = posto;
  }
  return valori;
}

/// Quello che si salva.
///
/// `carichi` porta i cerchi e i loro elettrodomestici; le tre chiavi storiche
/// sono uno specchio a senso unico, cosi' la finestrella dei sottocarichi
/// dentro la plancia continua ad aprirsi su una configurazione che sa gia'
/// leggere.
///
/// [prima] e' la sezione com'era salvata: i campi che questa maschera non
/// gestisce — le opzioni del report, le soglie, i prezzi per dispositivo — si
/// riportano invece di essere buttati via al salvataggio.
({
  List<Map<String, dynamic>> carichi,
  List<Map<String, dynamic>> gruppi,
  Map<String, dynamic> sottocarichi,
  Map<String, dynamic> nodi,
})
carichiDaScrivere(
  List<Carico> modello, {
  List<Map<String, dynamic>> prima = const [],
  String? impianto,
}) {
  /* L'impianto di cui parla questo modello. Il primo si scrive vuoto: e' il
   * valore che una configurazione a un impianto solo ha sempre avuto. */
  final quale = (impianto ?? '').trim();
  /* Quello che appartiene a un ALTRO impianto e quello che e' di questo.
   *
   * Erano un'unica mappa per id, e gli id di due impianti coincidono: ogni
   * maschera numera i suoi cerchi «carico-1», «carico-2»… per conto suo. Cosi'
   * il «carico-1» di casa Donato prendeva i campi tenuti del «carico-1» di
   * casa Giovanni, e al salvataggio quello di casa Giovanni non veniva piu'
   * rimesso perche' «c'era gia'»: configurando un carico su uno dei due
   * impianti, dopo il salvataggio spariva quello sull'altro. */
  bool altroImpianto(Map<String, dynamic> uno) =>
      impianto != null && _pulito(uno[campoDellImpianto]) != quale;
  final altrui = prima.where(altroImpianto).toList();
  final idAltrui = {
    for (final uno in altrui)
      if (_pulito(uno['id']).isNotEmpty) _pulito(uno['id']),
  };
  final tenuti = <String, Map<String, dynamic>>{
    for (final uno in prima)
      if (!altroImpianto(uno)) _pulito(uno['id']): uno,
  };
  final presi = <String>{};
  String idLibero(String voluto) {
    final base = voluto.trim();
    var id = base;
    if (idAltrui.contains(id)) {
      id = '${quale.isEmpty ? 'impianto' : quale}-$base';
    }
    var contatore = 2;
    while (idAltrui.contains(id) || presi.contains(id)) {
      id = '${quale.isEmpty ? 'impianto' : quale}-$base-${contatore++}';
    }
    presi.add(id);
    return id;
  }

  /// `entities` (e `entity`) sono la copia di tutte le caselle in un elenco
  /// solo, e finora arrivavano dal salvataggio precedente: svuotare la
  /// «Potenza istantanea» lasciava li' il sensore, e da li' se lo riprendevano
  /// sia chi indovina le caselle sia il cerchio. Adesso lo specchio si ricava
  /// dalle caselle e basta.
  Map<String, dynamic> conSpecchio(Map<String, dynamic> riga) {
    final scritte = <String>[];
    for (final campo in _campiDiEntita) {
      final valore = _pulito(riga[campo]);
      if (valore.isNotEmpty && !scritte.contains(valore)) scritte.add(valore);
    }
    return {...riga, 'entities': scritte, 'entity': scritte.firstOrNull ?? ''};
  }

  final carichi = <Map<String, dynamic>>[];
  final gruppi = <Map<String, dynamic>>[];
  final sottocarichi = <String, dynamic>{};
  final nodi = <String, dynamic>{};

  for (final (posto, carico) in modello.take(massimoDeiCarichi).indexed) {
    final voluto = carico.id.isNotEmpty ? carico.id : 'carico-${posto + 1}';
    final id = idLibero(voluto);
    /* Il gruppo segue l'id quando non ha un nome suo: rinominato l'uno,
     * rinominato l'altro, cosi' gli elettrodomestici restano nel cerchio. */
    final gruppo = carico.gruppo.isNotEmpty && carico.gruppo != voluto
        ? carico.gruppo
        : id;
    final tenuto = tenuti[voluto] ?? const <String, dynamic>{};
    final colore = carico.colore.isNotEmpty
        ? carico.colore
        : tavolozza[posto % tavolozza.length];
    carichi.add(
      conSpecchio({
        ...tenuto,
        'id': id,
        campoDellImpianto: quale,
        'name': carico.nome.isNotEmpty ? carico.nome : 'Carico ${posto + 1}',
        'icon': carico.icona.isNotEmpty ? carico.icona : '🔌',
        'color': colore,
        'order': posto,
        'show_in_dashboard': carico.visibile,
        'power_entity': carico.potenza,
        'total_energy_entity': carico.totale,
        'history_entity': carico.totale,
        'daily_energy_entity': carico.giorno,
        'monthly_energy_entity': carico.mese,
        'metadata': {
          ..._mappa(tenuto['metadata']),
          // Un cerchio non e' mai un elettrodomestico, e possiede il suo
          // gruppo per nome.
          'beta27_subload_group': '',
          'flow_group': gruppo,
          'flow_color': colore,
          campiScelti: true,
        },
      }),
    );

    gruppi.add({
      'id': gruppo,
      'name': carico.nome,
      'icon': carico.icona.isNotEmpty ? carico.icona : '🔌',
      'color': carico.colore,
    });

    final figli = carico.figli.take(massimoDeiSottocarichi).toList();
    sottocarichi[gruppo] = [
      for (final figlio in figli)
        {
          'id': figlio.id,
          'name': figlio.nome,
          'icon': figlio.icona.isNotEmpty ? figlio.icona : '🔌',
          'pwr': figlio.potenza,
          'pwrLive': figlio.potenza,
          'bin': figlio.stato,
          'daily': figlio.giorno,
          'monthly': figlio.mese,
          'total': figlio.totale,
        },
    ];

    for (final figlio in figli) {
      // Gli elettrodomestici restano di chi li possiede: scriverli qui sarebbe
      // la seconda copia che questa riscrittura esiste per togliere.
      if (figlio.altrui) continue;
      final suo = tenuti[figlio.id] ?? const <String, dynamic>{};
      carichi.add(
        conSpecchio({
          ...suo,
          'id': idLibero(figlio.id),
          /* Un elettrodomestico sta nell'impianto del suo cerchio: scriverlo
           * qui e' cio' che permette, piu' sotto, di riconoscere in una riga
           * sola tutto quello che appartiene a un altro impianto. */
          campoDellImpianto: quale,
          'name': figlio.nome,
          'icon': figlio.icona.isNotEmpty ? figlio.icona : '🔌',
          'order': posto,
          'show_in_dashboard': false,
          'power_entity': figlio.potenza,
          'control_entity': _pulito(suo['control_entity']),
          'daily_energy_entity': figlio.giorno,
          'monthly_energy_entity': figlio.mese,
          'total_energy_entity': figlio.totale,
          'history_entity': figlio.totale,
          'metadata': {
            ..._mappa(suo['metadata']),
            'beta27_subload_group': gruppo,
            'beta27_subload_id': figlio.id,
            campiScelti: true,
          },
        }),
      );
    }

    /* La personalizzazione del cerchio adesso e' il carico stesso. Lo specchio
     * posizionale si scrive lo stesso, cosi' un runtime che non ha ancora
     * ricaricato continua a dipingere gli stessi colori — ma e' ricavato, mai
     * riletto. */
    if (posto < caselleStoriche.length) {
      nodi[caselleStoriche[posto]] = {
        'name': carico.nome,
        'icon': carico.icona.isNotEmpty ? carico.icona : '🔌',
        'color': carico.colore,
        'group': gruppo,
        'pwr': carico.potenza,
        'enabled': carico.visibile,
      };
    }
  }

  /* Le righe che questa maschera non ha mostrato sopravvivono al salvataggio.
   *
   * Sono due famiglie. Le voci del report manuale, che non sono cerchi e non
   * sono mai passate di qui. E — da quando gli impianti sono piu' d'uno —
   * tutto quello che appartiene a un ALTRO impianto: la maschera ne mostra uno
   * per volta, e salvare «casa Giovanni» non puo' cancellare i carichi di
   * «casa Donato» solo perche' non erano sullo schermo. */
  carichi.addAll(altrui);
  for (final uno in prima) {
    if (uno['category'] != 'manual-report') continue;
    if (altroImpianto(uno)) continue;
    if (carichi.any((riga) => _pulito(riga['id']) == _pulito(uno['id']))) {
      continue;
    }
    carichi.add(uno);
  }

  return (
    carichi: carichi,
    gruppi: gruppi,
    sottocarichi: sottocarichi,
    nodi: nodi,
  );
}
