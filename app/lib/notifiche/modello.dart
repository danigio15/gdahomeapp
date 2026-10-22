/// Le notifiche, come le vede l'app: le impostazioni di questo telefono per
/// una casa, le notifiche personalizzate della casa, e una notifica arrivata.
///
/// Le impostazioni **stanno sul ponte**, non qui: e' lui a decidere se
/// mandare, e un telefono spento non puo' dire «adesso no». L'app ne tiene una
/// copia per casa (`notifiche.dart`), cosi' la pagina si apre subito anche
/// prima che la casa risponda.
///
/// I nomi dei campi sono quelli del ponte (`ponte/src/notifiche.js`): una
/// parola in meno da tradurre fra le due punte.
library;

import '../parole.dart';

/// Gli eventi di ogni categoria, nell'ordine della pagina. Sono gli stessi di
/// `CATEGORIE` in `ponte/src/sentinella.js`.
const Map<String, List<String>> categorieDelleNotifiche = {
  'urgenti': ['antifurto', 'allarmi', 'campanello', 'blackout'],
  'sicurezza': ['inserimenti', 'uscito', 'aperture', 'movimento'],
  'casa': ['elettrodomestici', 'frigo', 'pioggia', 'animali'],
  'persone': ['arrivi'],
  'assistente': ['suggerimenti'],
  'manutenzione': ['riepilogo'],
  'viaggi': ['viaggi'],
};

final RegExp _orario = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$');

/// Gli eventi che hanno anche la versione «elaborata»: con la scheda
/// disegnata sul telefono, o con la foto della telecamera.
const Set<String> eventiElaborabili = {
  'elettrodomestici',
  'riepilogo',
  'blackout',
  'antifurto',
  'movimento',
};

/// Cosa si puo' mettere dentro la notifica di un elettrodomestico finito.
const List<String> pezziDellElettrodomestico = [
  'durata',
  'kwh',
  'costo',
  'sole',
  'consiglio',
];

/// Le scelte di una voce sola: come arriva quella notifica, su questo
/// telefono. Quello che non si sceglie resta «come tutte».
///
/// I nomi sono quelli del ponte (`su` in `ponte/src/notifiche.js`): il ponte
/// le legge per decidere se mandare, a chi e come scriverla.
class SceltaDellaVoce {
  const SceltaDellaVoce({
    this.stile = 'come-tutte',
    this.quali = const [],
    this.soglia,
    this.suono = 'normale',
    this.dalle,
    this.alle,
    this.come = 'subito',
    this.dentro = pezziDellElettrodomestico,
    this.quando = 'casa-vuota-o-notte',
    this.video = false,
  });

  /// `come-tutte`, `semplice` o `elaborata`.
  final String stile;

  /// Le entita' a cui vale; vuoto vuol dire tutte.
  final List<String> quali;

  /// Euro del ciclo, o minuti del blackout: sotto, non arriva.
  final double? soglia;

  /// `muta`, `normale` o `suo`.
  final String suono;

  /// Fuori da queste ore non arriva. `null` tutte e due: sempre.
  final String? dalle;
  final String? alle;

  /// `subito`, o `riepilogo`: finisce nel riepilogo della sera.
  final String come;

  /// Per gli elettrodomestici: cosa scrivere.
  final List<String> dentro;

  /// Per il movimento: `sempre`, `casa-vuota`, `notte` o
  /// `casa-vuota-o-notte`.
  final String quando;

  /// Per il movimento: il mini video, cinque secondi prima e cinque dopo
  /// (`ponte/src/i-filmati.js`). Spento di serie.
  final bool video;

  bool get haGliOrari => dalle != null && alle != null;

  SceltaDellaVoce con({
    String? stile,
    List<String>? quali,
    double? soglia,
    bool senzaSoglia = false,
    String? suono,
    String? dalle,
    String? alle,
    bool senzaOrari = false,
    String? come,
    List<String>? dentro,
    String? quando,
    bool? video,
  }) => SceltaDellaVoce(
    stile: stile ?? this.stile,
    quali: quali ?? this.quali,
    soglia: senzaSoglia ? null : (soglia ?? this.soglia),
    suono: suono ?? this.suono,
    dalle: senzaOrari ? null : (dalle ?? this.dalle),
    alle: senzaOrari ? null : (alle ?? this.alle),
    come: come ?? this.come,
    dentro: dentro ?? this.dentro,
    quando: quando ?? this.quando,
    video: video ?? this.video,
  );

  Map<String, Object?> inJson() => {
    'stile': stile,
    'quali': quali,
    'soglia': soglia,
    'suono': suono,
    'orari': haGliOrari ? {'dalle': dalle, 'alle': alle} : null,
    'come': come,
    'dentro': dentro,
    'quando': quando,
    'video': video,
  };

  static SceltaDellaVoce leggi(Object? grezzo) {
    if (grezzo is! Map) return const SceltaDellaVoce();
    final quali = grezzo['quali'];
    final dentro = grezzo['dentro'];
    final orari = grezzo['orari'];
    final dalle = orari is Map ? orari['dalle'] : null;
    final alle = orari is Map ? orari['alle'] : null;
    final buoniOrari =
        dalle is String &&
        alle is String &&
        _orario.hasMatch(dalle) &&
        _orario.hasMatch(alle);
    final soglia = grezzo['soglia'];
    return SceltaDellaVoce(
      stile: switch (grezzo['stile']) {
        'semplice' => 'semplice',
        'elaborata' => 'elaborata',
        _ => 'come-tutte',
      },
      quali: [
        if (quali is List)
          for (final una in quali)
            if (una is String && una.contains('.')) una,
      ],
      soglia: soglia is num && soglia >= 0 ? soglia.toDouble() : null,
      suono: switch (grezzo['suono']) {
        'muta' => 'muta',
        'suo' => 'suo',
        _ => 'normale',
      },
      dalle: buoniOrari ? dalle : null,
      alle: buoniOrari ? alle : null,
      come: grezzo['come'] == 'riepilogo' ? 'riepilogo' : 'subito',
      dentro: dentro is List
          ? [
              for (final uno in pezziDellElettrodomestico)
                if (dentro.contains(uno)) uno,
            ]
          : pezziDellElettrodomestico,
      quando: switch (grezzo['quando']) {
        'sempre' => 'sempre',
        'casa-vuota' => 'casa-vuota',
        'notte' => 'notte',
        _ => 'casa-vuota-o-notte',
      },
      video: grezzo['video'] == true,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is SceltaDellaVoce &&
      other.stile == stile &&
      _stessi(other.quali, quali) &&
      other.soglia == soglia &&
      other.suono == suono &&
      other.dalle == dalle &&
      other.alle == alle &&
      other.come == come &&
      _stessi(other.dentro, dentro) &&
      other.quando == quando &&
      other.video == video;

  @override
  int get hashCode => Object.hash(
    stile,
    Object.hashAll(quali),
    soglia,
    suono,
    dalle,
    alle,
    come,
    Object.hashAll(dentro),
    quando,
    video,
  );
}

bool _stessi(List<String> a, List<String> b) {
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; i += 1) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

class OreDiSilenzio {
  const OreDiSilenzio({
    this.acceso = true,
    this.dalle = '23:00',
    this.alle = '07:00',
  });

  final bool acceso;
  final String dalle;
  final String alle;

  OreDiSilenzio con({bool? acceso, String? dalle, String? alle}) =>
      OreDiSilenzio(
        acceso: acceso ?? this.acceso,
        dalle: dalle ?? this.dalle,
        alle: alle ?? this.alle,
      );

  Map<String, Object> inJson() => {
    'acceso': acceso,
    'dalle': dalle,
    'alle': alle,
  };

  static OreDiSilenzio leggi(Object? grezzo) {
    if (grezzo is! Map) return const OreDiSilenzio();
    final dalle = grezzo['dalle'];
    final alle = grezzo['alle'];
    return OreDiSilenzio(
      acceso: grezzo['acceso'] != false,
      dalle: dalle is String && _orario.hasMatch(dalle) ? dalle : '23:00',
      alle: alle is String && _orario.hasMatch(alle) ? alle : '07:00',
    );
  }

  @override
  bool operator ==(Object other) =>
      other is OreDiSilenzio &&
      other.acceso == acceso &&
      other.dalle == dalle &&
      other.alle == alle;

  @override
  int get hashCode => Object.hash(acceso, dalle, alle);
}

/// Le impostazioni di questo telefono, per una casa.
class ImpostazioniDelleNotifiche {
  const ImpostazioniDelleNotifiche({
    this.acceso = true,
    this.eventi = const {},
    this.persone = const [],
    this.assistente = 'importanti',
    this.riepilogo = '20:30',
    this.silenzio = const OreDiSilenzio(),
    this.soloFuori = false,
    this.lingua = 'it',
    this.stile = 'semplici',
    this.su = const {},
  });

  /// L'interruttore generale.
  final bool acceso;

  /// Evento → acceso. Quello che manca e' acceso: e' come nascono.
  final Map<String, bool> eventi;

  /// Le persone (`person.*`) di cui dire arrivi e uscite.
  final List<String> persone;

  /// `importanti` o `tutti`, per l'assistente.
  final String assistente;
  final String riepilogo;
  final OreDiSilenzio silenzio;
  final bool soloFuori;
  final String lingua;

  /// `semplici` (solo testo) o `elaborate` (la scheda disegnata e la foto
  /// della telecamera). Di serie semplici: con le elaborate, sull'iPhone, la
  /// foto passa dal centralino — cifrata — e deve sceglierlo chi la riceve.
  final String stile;

  /// Le scelte di ogni voce: evento → [SceltaDellaVoce].
  final Map<String, SceltaDellaVoce> su;

  bool evento(String quale) => eventi[quale] ?? true;

  SceltaDellaVoce sceltaDi(String evento) =>
      su[evento] ?? const SceltaDellaVoce();

  /// Se quella notifica, su questo telefono, arriva elaborata.
  bool elaborata(String evento) {
    if (!eventiElaborabili.contains(evento)) return false;
    return switch (sceltaDi(evento).stile) {
      'semplice' => false,
      'elaborata' => true,
      _ => stile == 'elaborate',
    };
  }

  /// Una voce cambiata, e le altre come sono.
  ImpostazioniDelleNotifiche conScelta(String evento, SceltaDellaVoce scelta) =>
      con(su: {...su, evento: scelta});

  ImpostazioniDelleNotifiche con({
    bool? acceso,
    Map<String, bool>? eventi,
    List<String>? persone,
    String? assistente,
    String? riepilogo,
    OreDiSilenzio? silenzio,
    bool? soloFuori,
    String? lingua,
    String? stile,
    Map<String, SceltaDellaVoce>? su,
  }) => ImpostazioniDelleNotifiche(
    acceso: acceso ?? this.acceso,
    eventi: eventi ?? this.eventi,
    persone: persone ?? this.persone,
    assistente: assistente ?? this.assistente,
    riepilogo: riepilogo ?? this.riepilogo,
    silenzio: silenzio ?? this.silenzio,
    soloFuori: soloFuori ?? this.soloFuori,
    lingua: lingua ?? this.lingua,
    stile: stile ?? this.stile,
    su: su ?? this.su,
  );

  /// Un evento acceso o spento, e gli altri come sono.
  ImpostazioniDelleNotifiche conEvento(String quale, bool acceso) =>
      con(eventi: {...eventi, quale: acceso});

  Map<String, Object> inJson() => {
    'acceso': acceso,
    'eventi': eventi,
    'persone': persone,
    'assistente': assistente,
    'riepilogo': riepilogo,
    'silenzio': silenzio.inJson(),
    'soloFuori': soloFuori,
    'lingua': lingua,
    'stile': stile,
    'su': {
      for (final MapEntry(:key, :value) in su.entries) key: value.inJson(),
    },
  };

  static ImpostazioniDelleNotifiche leggi(Object? grezzo) {
    if (grezzo is! Map) return const ImpostazioniDelleNotifiche();
    final eventi = grezzo['eventi'];
    final persone = grezzo['persone'];
    final riepilogo = grezzo['riepilogo'];
    return ImpostazioniDelleNotifiche(
      acceso: grezzo['acceso'] != false,
      eventi: {
        if (eventi is Map)
          for (final MapEntry(:key, :value) in eventi.entries)
            if (key is String && value is bool) key: value,
      },
      persone: [
        if (persone is List)
          for (final una in persone)
            if (una is String) una,
      ],
      assistente: grezzo['assistente'] == 'tutti' ? 'tutti' : 'importanti',
      riepilogo: riepilogo is String && _orario.hasMatch(riepilogo)
          ? riepilogo
          : '20:30',
      silenzio: OreDiSilenzio.leggi(grezzo['silenzio']),
      soloFuori: grezzo['soloFuori'] == true,
      lingua: grezzo['lingua'] == 'en' ? 'en' : 'it',
      stile: grezzo['stile'] == 'elaborate' ? 'elaborate' : 'semplici',
      su: {
        if (grezzo['su'] case final Map voci)
          for (final MapEntry(:key, :value) in voci.entries)
            if (key is String) key: SceltaDellaVoce.leggi(value),
      },
    );
  }
}

/// Una notifica personalizzata della casa: entita' + condizione + durata →
/// messaggio.
class NotificaPersonalizzata {
  const NotificaPersonalizzata({
    this.id,
    this.attiva = true,
    required this.entita,
    this.condizione = 'sopra',
    this.valore = '',
    this.per = 10,
    required this.titolo,
    this.testo = '',
    this.conValore = true,
    this.urgenza = 'normale',
    this.chi = const [],
    this.nonRipetere = 60,
    this.modificabile = true,
  });

  /// `null` per una nuova: il ponte gliene da' uno.
  final String? id;
  final bool attiva;
  final String entita;

  /// `sopra`, `sotto`, `uguale`, `diverso`.
  final String condizione;
  final String valore;

  /// Per quanti minuti deve durare.
  final int per;
  final String titolo;
  final String testo;

  /// «Aggiungi il valore e da quanto», sotto il titolo.
  final bool conValore;

  /// `bassa`, `normale`, `urgente`.
  final String urgenza;

  /// Gli utenti di Home Assistant che la ricevono.
  final List<String> chi;

  /// Minuti: se resta vera, al massimo una volta ogni tanto.
  final int nonRipetere;

  /// Se chi guarda la puo' cambiare: lo dice il ponte.
  final bool modificabile;

  NotificaPersonalizzata con({
    bool? attiva,
    String? entita,
    String? condizione,
    String? valore,
    int? per,
    String? titolo,
    String? testo,
    bool? conValore,
    String? urgenza,
    List<String>? chi,
    int? nonRipetere,
  }) => NotificaPersonalizzata(
    id: id,
    attiva: attiva ?? this.attiva,
    entita: entita ?? this.entita,
    condizione: condizione ?? this.condizione,
    valore: valore ?? this.valore,
    per: per ?? this.per,
    titolo: titolo ?? this.titolo,
    testo: testo ?? this.testo,
    conValore: conValore ?? this.conValore,
    urgenza: urgenza ?? this.urgenza,
    chi: chi ?? this.chi,
    nonRipetere: nonRipetere ?? this.nonRipetere,
    modificabile: modificabile,
  );

  Map<String, Object> inJson() => {
    'id': ?id,
    'attiva': attiva,
    'entita': entita,
    'condizione': condizione,
    'valore': valore,
    'per': per,
    'titolo': titolo,
    'testo': testo,
    'conValore': conValore,
    'urgenza': urgenza,
    'chi': chi,
    'nonRipetere': nonRipetere,
  };

  static NotificaPersonalizzata? leggi(Object? grezzo) {
    if (grezzo is! Map) return null;
    final entita = grezzo['entita'];
    final titolo = grezzo['titolo'];
    if (entita is! String || titolo is! String) return null;
    final chi = grezzo['chi'];
    return NotificaPersonalizzata(
      id: grezzo['id'] as String?,
      attiva: grezzo['attiva'] != false,
      entita: entita,
      condizione: switch (grezzo['condizione']) {
        'sotto' => 'sotto',
        'uguale' => 'uguale',
        'diverso' => 'diverso',
        _ => 'sopra',
      },
      valore: grezzo['valore']?.toString() ?? '',
      per: (grezzo['per'] as num?)?.round() ?? 0,
      titolo: titolo,
      testo: grezzo['testo']?.toString() ?? '',
      conValore: grezzo['conValore'] != false,
      urgenza: switch (grezzo['urgenza']) {
        'bassa' => 'bassa',
        'urgente' => 'urgente',
        _ => 'normale',
      },
      chi: [
        if (chi is List)
          for (final uno in chi)
            if (uno is String) uno,
      ],
      nonRipetere: (grezzo['nonRipetere'] as num?)?.round() ?? 60,
      modificabile: grezzo['modificabile'] != false,
    );
  }
}

/// Una persona di casa, per gli arrivi e le uscite: `person.*`.
class PersonaDiCasa {
  const PersonaDiCasa(this.id, this.nome);
  final String id;
  final String nome;
}

/// Un utente di Home Assistant, per «chi la riceve».
class UtenteDiCasa {
  const UtenteDiCasa(this.id, this.nome);
  final String id;
  final String nome;
}

/// Quello che il ponte dice delle notifiche di questo telefono.
class StatoDelleNotifiche {
  const StatoDelleNotifiche({
    this.impostazioni = const ImpostazioniDelleNotifiche(),
    this.registrato = false,
    this.intestato = true,
    this.centralino = true,
    this.persone = const [],
    this.utenti = const [],
    this.personalizzate = const [],
    this.io = '',
    this.amministra = false,
    this.premium,
  });

  final ImpostazioniDelleNotifiche impostazioni;

  /// Se la casa e' Premium, come la vede il ponte (`licenze.premium`, o
  /// licenze spente). `null` da un ponte di prima, che non lo dice: allora
  /// decide la licenza che l'app conosce.
  final bool? premium;

  /// Se questo telefono ha gia' detto alla casa dove mandarle.
  final bool registrato;

  /// Se il telefono e' intestato a un utente: senza, il ponte non manda.
  final bool intestato;

  /// Se la casa ha il centralino, che e' la strada delle notifiche.
  final bool centralino;
  final List<PersonaDiCasa> persone;
  final List<UtenteDiCasa> utenti;
  final List<NotificaPersonalizzata> personalizzate;

  /// L'utente di questo telefono.
  final String io;
  final bool amministra;

  StatoDelleNotifiche con({
    ImpostazioniDelleNotifiche? impostazioni,
    bool? registrato,
    List<NotificaPersonalizzata>? personalizzate,
  }) => StatoDelleNotifiche(
    impostazioni: impostazioni ?? this.impostazioni,
    registrato: registrato ?? this.registrato,
    intestato: intestato,
    centralino: centralino,
    persone: persone,
    utenti: utenti,
    personalizzate: personalizzate ?? this.personalizzate,
    io: io,
    amministra: amministra,
    premium: premium,
  );

  Map<String, Object> inJson() => {
    'impostazioni': impostazioni.inJson(),
    'registrato': registrato,
    'intestato': intestato,
    'centralino': centralino,
    'persone': [
      for (final una in persone) {'id': una.id, 'nome': una.nome},
    ],
    'utenti': [
      for (final uno in utenti) {'id': uno.id, 'nome': uno.nome},
    ],
    'personalizzate': [
      for (final una in personalizzate)
        {...una.inJson(), 'modificabile': una.modificabile},
    ],
    'io': io,
    'amministra': amministra,
    'premium': ?premium,
  };

  static StatoDelleNotifiche leggi(Object? grezzo) {
    if (grezzo is! Map) return const StatoDelleNotifiche();
    List<T> elenco<T>(Object? cosa, T? Function(Map) fai) => [
      if (cosa is List)
        for (final uno in cosa)
          if (uno is Map) ?fai(uno),
    ];
    return StatoDelleNotifiche(
      impostazioni: ImpostazioniDelleNotifiche.leggi(grezzo['impostazioni']),
      registrato: grezzo['registrato'] == true,
      intestato: grezzo['intestato'] != false,
      centralino: grezzo['centralino'] != false,
      persone: elenco(
        grezzo['persone'],
        (una) => una['id'] is String
            ? PersonaDiCasa(una['id'] as String, '${una['nome'] ?? una['id']}')
            : null,
      ),
      utenti: elenco(
        grezzo['utenti'],
        (uno) => uno['id'] is String
            ? UtenteDiCasa(uno['id'] as String, '${uno['nome'] ?? ''}')
            : null,
      ),
      personalizzate: elenco(
        grezzo['personalizzate'],
        NotificaPersonalizzata.leggi,
      ),
      io: grezzo['io']?.toString() ?? '',
      amministra: grezzo['amministra'] == true,
      premium: grezzo['premium'] is bool ? grezzo['premium'] as bool : null,
    );
  }
}

/// Un tasto sotto una notifica.
class TastoDellaNotifica {
  const TastoDellaNotifica(
    this.id,
    this.etichetta, {
    this.apre = false,
    this.chiude = false,
  });
  final String id;
  final String etichetta;

  /// `true` per «Guarda»: apre l'app e basta, non chiede niente alla casa.
  final bool apre;

  /// `true` per «OK»: toglie la notifica e basta. Non apre l'app e non
  /// chiede niente alla casa.
  final bool chiude;
}

/// Il tasto che apre «La tua giornata». Un ponte di prima lo chiamava
/// `energia` («Apri Energia»): vale lo stesso.
const tastoDellaGiornata = 'giornata';

/// I tasti del riepilogo della sera, come li vuole il disegno: «Apri la
/// giornata» e «OK». Il ponte manda `giornata` e `ok`; uno di prima solo
/// `energia`. Senza nessuno dei due (il riepilogo di Base, «Batterie da
/// cambiare») restano quelli che sono — cioe' nessuno.
List<TastoDellaNotifica> tastiDelRiepilogo(List<TastoDellaNotifica> tasti) {
  final ids = {for (final uno in tasti) uno.id};
  if (!ids.contains(tastoDellaGiornata) && !ids.contains('energia')) {
    return tasti;
  }
  return [
    TastoDellaNotifica(
      tastoDellaGiornata,
      inLingua(it: 'Apri la giornata', en: 'Open your day'),
      apre: true,
    ),
    const TastoDellaNotifica('ok', 'OK', chiude: true),
  ];
}

/// Una notifica arrivata, aperta.
class NotificaArrivata {
  const NotificaArrivata({
    required this.id,
    required this.tipo,
    required this.categoria,
    required this.urgenza,
    required this.titolo,
    required this.testo,
    required this.quando,
    required this.scade,
    this.entita,
    this.camera,
    this.chiamata = false,
    this.tasti = const [],
    this.scheda,
    this.foto,
    this.film,
    this.fonte,
    this.apri,
  });

  final String id;
  final String tipo;
  final String categoria;
  final String urgenza;
  final String titolo;
  final String testo;
  final DateTime quando;
  final DateTime scade;
  final String? entita;

  /// La telecamera da guardare, se a questo utente si mostra: la foto si
  /// chiede alla casa sul filo, e non passa mai da Google o da Apple.
  final String? camera;

  /// Il campanello: a tutto schermo, come una chiamata.
  final bool chiamata;
  final List<TastoDellaNotifica> tasti;

  /// La scheda da disegnare sul telefono, per le elaborate: i numeri, non il
  /// disegno (`scheda.dart`). `null` per le semplici.
  final Map<String, dynamic>? scheda;

  /// L'istantanea della telecamera, per le elaborate: sta sul centralino,
  /// cifrata con la chiave di questo telefono, per dieci minuti
  /// (`foto_di_passaggio.dart`). L'identificativo e basta.
  final String? foto;

  /// Il mini video del movimento (`ponte/src/i-filmati.js`): il numero e la
  /// chiave per aprirlo. Il video sta nella casa, chiuso: lo apre solo chi
  /// ha questa notifica, e la casa lo da' solo a un utente che vede quella
  /// telecamera. `null` se l'opzione e' spenta.
  final ({String id, String chiave})? film;

  /// Da dove viene, sotto il testo: «Automazione di Home Assistant ·
  /// Lavatrice finita». Solo le notifiche di Home Assistant ce l'hanno.
  final String? fonte;

  /// Dove porta il tocco, come lo dice la casa (`apri` in
  /// `ponte/src/notifiche.js`): la sezione — `sicurezza`, `varchi`,
  /// `telecamera`… — e la cosa di cui parla. `null` da un ponte di prima:
  /// allora la si ricava dal [tipo] (`dove_apre.dart`).
  final ({String sezione, String? entita})? apri;

  /// Una notifica di un'automazione di Home Assistant, anche in GdAHome.
  bool get daHomeAssistant => tipo == 'ha_notify';

  bool get elaborata => scheda != null || foto != null;

  /// Se toccandola si apre «La tua giornata»: il riepilogo della sera che ne
  /// porta il tasto, anche quello di prova (che arriva come `prova`). Il
  /// riepilogo semplice di Base no: senza il tasto si legge e basta.
  bool get apreLaGiornata => tasti.any((uno) => uno.id == tastoDellaGiornata);

  bool get urgente => urgenza == 'urgente';

  /// Se e' ancora buona: una notifica scaduta non si mostra, e i suoi tasti
  /// non fanno piu' niente.
  bool valeAncora(DateTime adesso) => adesso.isBefore(scade);

  static NotificaArrivata? leggi(Map<String, dynamic> grezzo) {
    final id = grezzo['id'];
    final titolo = grezzo['titolo'];
    if (grezzo['v'] != 1 || id is! String || titolo is! String) return null;
    DateTime ora(Object? ms) =>
        DateTime.fromMillisecondsSinceEpoch((ms as num?)?.toInt() ?? 0);
    final azioni = grezzo['azioni'];
    final scheda = grezzo['scheda'];
    final tipo = grezzo['tipo']?.toString() ?? '';
    final letti = [
      if (azioni is List)
        for (final uno in azioni)
          if (uno is Map && uno['id'] is String)
            TastoDellaNotifica(
              uno['id'] as String,
              '${uno['etichetta'] ?? uno['id']}',
              apre: uno['apre'] == true,
              chiude: uno['id'] == 'ok',
            ),
    ];
    final foto = grezzo['foto'];
    final idDellaFoto = foto is Map ? foto['id'] : null;
    return NotificaArrivata(
      id: id,
      tipo: tipo,
      categoria: grezzo['cat']?.toString() ?? '',
      urgenza: switch (grezzo['urg']) {
        'urgente' => 'urgente',
        'bassa' => 'bassa',
        _ => 'normale',
      },
      titolo: titolo,
      testo: grezzo['testo']?.toString() ?? '',
      quando: ora(grezzo['quando']),
      scade: ora(grezzo['scade']),
      entita: grezzo['entita'] as String?,
      camera: grezzo['camera'] as String?,
      chiamata: grezzo['chiamata'] == true,
      /* Anche la prova del riepilogo («Prova: mandamela adesso»), che
       * arriva come `prova` ma porta «Apri la giornata». */
      tasti:
          tipo == 'riepilogo' ||
              letti.any((uno) => uno.id == tastoDellaGiornata)
          ? tastiDelRiepilogo(letti)
          : letti,
      scheda: scheda is Map<String, dynamic> && scheda['v'] == 1
          ? scheda
          : null,
      foto:
          idDellaFoto is String &&
              RegExp(r'^[0-9a-f]{32}$').hasMatch(idDellaFoto)
          ? idDellaFoto
          : null,
      film: switch (grezzo['film']) {
        {'id': final String id, 'chiave': final String chiave}
            when _idDelFilm.hasMatch(id) && _chiaveDelFilm.hasMatch(chiave) =>
          (id: id, chiave: chiave),
        _ => null,
      },
      fonte: grezzo['fonte'] is String && (grezzo['fonte'] as String).isNotEmpty
          ? grezzo['fonte'] as String
          : null,
      apri: switch (grezzo['apri']) {
        {'sezione': final String sezione} when _parola.hasMatch(sezione) => (
          sezione: sezione,
          entita: switch (grezzo['apri']['entita']) {
            final String entita when _entita.hasMatch(entita) => entita,
            _ => null,
          },
        ),
        _ => null,
      },
    );
  }
}

final RegExp _parola = RegExp(r'^[a-z]{2,20}$');
final RegExp _idDelFilm = RegExp(r'^\d{10,16}-[a-z0-9]{4,24}$');
final RegExp _chiaveDelFilm = RegExp(r'^[A-Za-z0-9_-]{43}$');
final RegExp _entita = RegExp(r'^[a-z_]+\.[a-z0-9_]+$');

/// Un telefono di GdAHome della casa, per «Chi la riceve»: col nome che chi
/// lo usa ha scritto nell'app, mai quello di una persona di Home Assistant.
class TelefonoDellaCasa {
  const TelefonoDellaCasa({
    required this.id,
    required this.nome,
    this.modello = '',
    this.io = false,
  });

  final String id;
  final String nome;
  final String modello;

  /// Se e' questo telefono.
  final bool io;
}

/// Un'automazione di Home Assistant che manda notifiche ai telefoni (con
/// l'app di Home Assistant), e se riceverla anche qui. I nomi dei campi sono
/// quelli del ponte (`ponte/src/notifiche-di-home-assistant.js`).
class AutomazioneCheAvvisa {
  const AutomazioneCheAvvisa({
    required this.chiave,
    required this.alias,
    this.quando,
    this.ultimaVolta,
    this.bersaglio = 'questo',
    this.telefoni = const [],
    this.anteprimaTitolo,
    this.anteprimaTesto,
    this.ultimoTitolo,
    this.ultimoTesto,
    this.ultimoIl,
    this.conFoto = false,
    this.conTasti = false,
    this.urgente = false,
    this.testoCheCambia = false,
    this.acceso = false,
    this.a = 'questo',
    this.silenzio = true,
    this.nuova = false,
  });

  /// L'`id` dell'automazione in Home Assistant (o la sua entita').
  final String chiave;
  final String alias;

  /// «Quando Lavatrice · potenza resta sotto 5 W per 3 minuti».
  final String? quando;

  /// L'ultima volta che e' scattata.
  final DateTime? ultimaVolta;

  /// A chi la manda Home Assistant: `questo` (al telefono di chi guarda),
  /// `tutti`, `altro` (al telefono di un altro), `nessuno` (a un telefono
  /// senza GdAHome).
  final String bersaglio;

  /// Con `altro`: i telefoni di GdAHome a cui va.
  final List<String> telefoni;

  /// Com'e' scritta, coi template diventati «…». `null` se non si vede.
  final String? anteprimaTitolo;
  final String? anteprimaTesto;

  /// L'ultima arrivata davvero, col testo scritto da Home Assistant.
  final String? ultimoTitolo;
  final String? ultimoTesto;
  final DateTime? ultimoIl;

  final bool conFoto;
  final bool conTasti;
  final bool urgente;
  final bool testoCheCambia;

  /// Se riceverla anche in GdAHome (di serie no).
  final bool acceso;

  /// Dove: `questo`, `tutti`, o l'id di un telefono della casa.
  final String a;

  /// Se rispetta le ore di silenzio.
  final bool silenzio;

  /// Trovata da poco («Proponimi le nuove»).
  final bool nuova;

  /// Se Home Assistant la manda a questo telefono (o a tutti).
  bool get perMe => bersaglio == 'questo' || bersaglio == 'tutti';

  /// Il testo da mostrare: l'ultimo vero, o com'e' scritta.
  String get testo => ultimoTesto ?? anteprimaTesto ?? '';

  /// Il titolo da mostrare: quello di Home Assistant, o il nome.
  String get titolo => (ultimoTitolo?.isNotEmpty ?? false)
      ? ultimoTitolo!
      : (anteprimaTitolo?.isNotEmpty ?? false)
      ? anteprimaTitolo!
      : alias;

  AutomazioneCheAvvisa con({bool? acceso, String? a, bool? silenzio}) =>
      AutomazioneCheAvvisa(
        chiave: chiave,
        alias: alias,
        quando: quando,
        ultimaVolta: ultimaVolta,
        bersaglio: bersaglio,
        telefoni: telefoni,
        anteprimaTitolo: anteprimaTitolo,
        anteprimaTesto: anteprimaTesto,
        ultimoTitolo: ultimoTitolo,
        ultimoTesto: ultimoTesto,
        ultimoIl: ultimoIl,
        conFoto: conFoto,
        conTasti: conTasti,
        urgente: urgente,
        testoCheCambia: testoCheCambia,
        acceso: acceso ?? this.acceso,
        a: a ?? this.a,
        silenzio: silenzio ?? this.silenzio,
        nuova: false,
      );

  static AutomazioneCheAvvisa? leggi(Object? grezzo) {
    if (grezzo is! Map) return null;
    final chiave = grezzo['chiave'];
    final alias = grezzo['alias'];
    if (chiave is! String || alias is! String) return null;
    DateTime? ora(Object? ms) =>
        ms is num ? DateTime.fromMillisecondsSinceEpoch(ms.toInt()) : null;
    String? testo(Object? cosa) => cosa is String ? cosa : null;
    final quando = grezzo['quando'];
    final anteprima = grezzo['anteprima'];
    final ultimo = grezzo['ultimo'];
    final telefoni = grezzo['telefoni'];
    return AutomazioneCheAvvisa(
      chiave: chiave,
      alias: alias,
      quando: quando is Map
          ? testo(quando[inLingua(it: 'it', en: 'en')] ?? quando['it'])
          : null,
      ultimaVolta: ora(grezzo['ultimaVolta']),
      bersaglio: switch (grezzo['bersaglio']) {
        'tutti' => 'tutti',
        'altro' => 'altro',
        'nessuno' => 'nessuno',
        _ => 'questo',
      },
      telefoni: [
        if (telefoni is List)
          for (final uno in telefoni)
            if (uno is String) uno,
      ],
      anteprimaTitolo: anteprima is Map ? testo(anteprima['titolo']) : null,
      anteprimaTesto: anteprima is Map ? testo(anteprima['testo']) : null,
      ultimoTitolo: ultimo is Map ? testo(ultimo['titolo']) : null,
      ultimoTesto: ultimo is Map ? testo(ultimo['testo']) : null,
      ultimoIl: ultimo is Map ? ora(ultimo['il']) : null,
      conFoto: grezzo['conFoto'] == true,
      conTasti: grezzo['conTasti'] == true,
      urgente: grezzo['urgente'] == true,
      testoCheCambia: grezzo['testoCheCambia'] == true,
      acceso: grezzo['acceso'] == true,
      a: grezzo['a'] is String ? grezzo['a'] as String : 'questo',
      silenzio: grezzo['silenzio'] != false,
      nuova: grezzo['nuova'] == true,
    );
  }
}

/// Quello che il ponte dice delle notifiche di Home Assistant, per questo
/// telefono: `ponte/notifiche/ha/elenco`.
class NotificheDaHomeAssistant {
  const NotificheDaHomeAssistant({
    this.premium,
    this.proponi = true,
    this.telefoni = const [],
    this.automazioni = const [],
  });

  /// `null` da un ponte che non lo dice.
  final bool? premium;

  /// «Proponimi le nuove».
  final bool proponi;
  final List<TelefonoDellaCasa> telefoni;
  final List<AutomazioneCheAvvisa> automazioni;

  TelefonoDellaCasa? telefono(String id) {
    for (final uno in telefoni) {
      if (uno.id == id) return uno;
    }
    return null;
  }

  /// Questo telefono, se il ponte lo conosce.
  TelefonoDellaCasa? get questo {
    for (final uno in telefoni) {
      if (uno.io) return uno;
    }
    return null;
  }

  NotificheDaHomeAssistant con({
    bool? proponi,
    List<AutomazioneCheAvvisa>? automazioni,
  }) => NotificheDaHomeAssistant(
    premium: premium,
    proponi: proponi ?? this.proponi,
    telefoni: telefoni,
    automazioni: automazioni ?? this.automazioni,
  );

  static NotificheDaHomeAssistant leggi(Object? grezzo) {
    if (grezzo is! Map) return const NotificheDaHomeAssistant();
    final telefoni = grezzo['telefoni'];
    final automazioni = grezzo['automazioni'];
    return NotificheDaHomeAssistant(
      premium: grezzo['premium'] is bool ? grezzo['premium'] as bool : null,
      proponi: grezzo['proponi'] != false,
      telefoni: [
        if (telefoni is List)
          for (final uno in telefoni)
            if (uno is Map && uno['id'] is String)
              TelefonoDellaCasa(
                id: uno['id'] as String,
                nome: '${uno['nome'] ?? ''}',
                modello: '${uno['modello'] ?? ''}',
                io: uno['io'] == true,
              ),
      ],
      automazioni: [
        if (automazioni is List)
          for (final una in automazioni) ?AutomazioneCheAvvisa.leggi(una),
      ],
    );
  }
}
