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

/// Gli eventi di ogni categoria, nell'ordine della pagina. Sono gli stessi di
/// `CATEGORIE` in `ponte/src/sentinella.js`.
const Map<String, List<String>> categorieDelleNotifiche = {
  'urgenti': ['antifurto', 'allarmi', 'campanello'],
  'sicurezza': ['inserimenti', 'uscito', 'aperture', 'movimento'],
  'casa': ['elettrodomestici', 'frigo', 'pioggia'],
  'persone': ['arrivi'],
  'assistente': ['suggerimenti'],
  'manutenzione': ['riepilogo'],
  'viaggi': ['viaggi'],
};

final RegExp _orario = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$');

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

  bool evento(String quale) => eventi[quale] ?? true;

  ImpostazioniDelleNotifiche con({
    bool? acceso,
    Map<String, bool>? eventi,
    List<String>? persone,
    String? assistente,
    String? riepilogo,
    OreDiSilenzio? silenzio,
    bool? soloFuori,
    String? lingua,
  }) => ImpostazioniDelleNotifiche(
    acceso: acceso ?? this.acceso,
    eventi: eventi ?? this.eventi,
    persone: persone ?? this.persone,
    assistente: assistente ?? this.assistente,
    riepilogo: riepilogo ?? this.riepilogo,
    silenzio: silenzio ?? this.silenzio,
    soloFuori: soloFuori ?? this.soloFuori,
    lingua: lingua ?? this.lingua,
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
  });

  final ImpostazioniDelleNotifiche impostazioni;

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
    );
  }
}

/// Un tasto sotto una notifica.
class TastoDellaNotifica {
  const TastoDellaNotifica(this.id, this.etichetta, {this.apre = false});
  final String id;
  final String etichetta;

  /// `true` per «Guarda»: apre l'app e basta, non chiede niente alla casa.
  final bool apre;
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
    final tasti = grezzo['azioni'];
    return NotificaArrivata(
      id: id,
      tipo: grezzo['tipo']?.toString() ?? '',
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
      tasti: [
        if (tasti is List)
          for (final uno in tasti)
            if (uno is Map && uno['id'] is String)
              TastoDellaNotifica(
                uno['id'] as String,
                '${uno['etichetta'] ?? uno['id']}',
                apre: uno['apre'] == true,
              ),
      ],
    );
  }
}
