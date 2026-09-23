/// La rete Zigbee di questa casa, vista dall'app (#54).
///
/// «Vorrei poter abbinare un dispositivo zigbee direttamente dall'app.»
///
/// Qui non c'e' nessuna schermata: c'e' il giro sul filo, e basta. Le quattro
/// domande sono quelle che il ponte sa rispondere — che rete c'e', apri,
/// richiudi, chiamalo cosi' — e stanno insieme in un posto solo perche' le
/// schermate sono quattro e nessuna deve reinventarsi il nome di un comando.
///
/// ─── Chi ascolta chi entra ────────────────────────────────────────────────
///
/// Nessuno, da qui. Il pezzo che sente «e' entrato uno nuovo» sta **nel
/// ponte**, e c'e' una ragione precisa: fra l'ordine di aprire e la rete
/// aperta passano dei millesimi, e un dispositivo gia' in attesa entra subito.
/// Se ad ascoltare fosse l'app, quello si perderebbe ogni volta che il
/// telefono e' un attimo piu' lento — e chi guarda vedrebbe il conto alla
/// rovescia scorrere su un dispositivo che e' gia' dentro.
///
/// Il ponte quindi tiene lui l'elenco di chi e' entrato da quando la rete e'
/// stata aperta, e lo mette dentro `stato()`. All'app resta di richiederlo, e
/// per questo c'e' [mentreAspetti]: una domanda al secondo mentre si guarda
/// quella schermata, e nient'altro. Un filo aperto in piu' per una cosa che
/// dura quattro minuti non vale il filo.
///
/// ─── E se il ponte e' vecchio ─────────────────────────────────────────────
///
/// Risponde «non conosco questo comando», e qui diventa «nessuna rete». Non e'
/// un guasto da mostrare: e' una casa dove questa cosa non c'e' ancora, e la
/// voce nel menu semplicemente non compare. Una porta che non si apre e'
/// peggio di una porta che non c'e'.
library;

import 'dart:async';

import '../parole.dart';
import 'segnalazioni.dart' show spiegaLErrore;
import '../ponte/errori.dart';
import '../ponte/filo.dart';

/// Quale rete Zigbee governa questa casa.
enum LaRete {
  /// Nessuna delle due — o un ponte che non sa rispondere.
  nessuna(''),

  /// L'integrazione di Home Assistant.
  zha('zha'),

  /// Il programma a parte, che parla per posta (MQTT).
  ///
  /// La parola e' `zigbee2mqtt` e non `z2m`, perche' e' quella che **manda il
  /// ponte**: `Z2M` in `ponte/src/zigbee.js`. Qui c'era scritta l'abbreviazione,
  /// e un confronto fra due parole diverse non torna mai: in una casa con
  /// Zigbee2MQTT `stato()` rispondeva `zigbee2mqtt`, questo elenco non lo
  /// riconosceva, `LaRete.nessuna` diceva che una rete non c'e' e la voce
  /// «Zigbee» nel menu non compariva. Con ZHA invece le due parole erano la
  /// stessa, e li' funzionava — che e' il motivo per cui il guasto e' arrivato
  /// fino a una casa vera senza farsi vedere prima.
  ///
  /// Una prova tiene ferme tutt'e due (`ponte/test/zigbee.test.js`).
  z2m('zigbee2mqtt');

  const LaRete(this.comeLaChiamaIlPonte);

  /// Il nome con cui viaggia sul filo.
  final String comeLaChiamaIlPonte;

  /// Come si chiama per chi legge. Non si traduce: sono due nomi propri.
  String get nome => switch (this) {
    LaRete.zha => 'ZHA',
    LaRete.z2m => 'Zigbee2MQTT',
    LaRete.nessuna => '',
  };

  /// Se c'e' una rete che si puo' aprire.
  bool get siApre => this != LaRete.nessuna;

  static LaRete daQuelloCheDice(Object? detto) {
    final quale = detto is String ? detto.trim() : '';
    for (final rete in LaRete.values) {
      if (rete != LaRete.nessuna && rete.comeLaChiamaIlPonte == quale) {
        return rete;
      }
    }
    return LaRete.nessuna;
  }
}

/// Un'entita' del dispositivo, ridotta a quello che serve a decidere.
///
/// Su una rete Zigbee entra un dispositivo, e un dispositivo ne porta cinque o
/// sei. L'app non sceglie quale conta: le passa tutte alla plancia, che le sue
/// sezioni le conosce. Qui servono solo a viaggiare.
class UnEntita {
  const UnEntita({
    required this.entity,
    required this.classe,
    required this.categoria,
  });

  factory UnEntita.daQuelloCheDice(Map<Object?, Object?> detto) => UnEntita(
    entity: _testo(detto['entity']),
    classe: _testo(detto['classe']),
    categoria: _testo(detto['categoria']),
  );

  /// L'identificativo: `light.lampadario_cucina`.
  final String entity;

  /// Cosa misura o cosa comanda: `outlet`, `temperature`, `door`.
  final String classe;

  /// `diagnostic` o `config` per quelle che Home Assistant stesso marca come
  /// roba di servizio. Su una presa smart sono cinque su sei.
  final String categoria;

  /// Come la vuole il foglietto della plancia.
  Map<String, String> get perLaPlancia => {
    'entity': entity,
    'classe': classe,
    'categoria': categoria,
  };
}

/// Un dispositivo appena entrato, come lo presenta il ponte.
///
/// [marca] e [modello] non sono decorazione: sulla schermata del nome servono
/// a far dire «ah, e' quello» a chi ha appena premuto il tasto di una presa e
/// non sa se e' quella che e' entrata.
class DispositivoEntrato {
  const DispositivoEntrato({
    required this.id,
    required this.nome,
    required this.marca,
    required this.modello,
    required this.tramite,
    this.entita = const [],
  });

  factory DispositivoEntrato.daQuelloCheDice(Map<Object?, Object?> detto) {
    final sue = detto['entita'];
    return DispositivoEntrato(
      id: _testo(detto['id']),
      nome: _testo(detto['nome']),
      marca: _testo(detto['marca']),
      modello: _testo(detto['modello']),
      tramite: _testo(detto['tramite']),
      entita: [
        if (sue is List)
          for (final una in sue)
            if (una is Map<Object?, Object?>) UnEntita.daQuelloCheDice(una),
      ],
    );
  }

  /// L'identificativo nel registro di Home Assistant.
  final String id;

  /// Come si chiama adesso: quasi sempre il codice del modello, che e' il
  /// motivo per cui il passo dopo chiede un nome.
  final String nome;

  final String marca;
  final String modello;

  /// Da quale integrazione e' arrivato davvero.
  ///
  /// Un dispositivo entrato mentre la rete Zigbee era aperta puo' comunque
  /// essere un Matter, e dirlo e' meglio che lasciarlo credere.
  final String tramite;

  /// Quello che ha portato dentro: cinque o sei, su una presa smart.
  ///
  /// Non si sceglie qui quale conta: a saperlo e' la plancia, che sa che una
  /// lampadina va nelle Luci e un contatto di porta nei Varchi. Da qui si
  /// passano tutte.
  final List<UnEntita> entita;

  /// Marca e modello in una riga, saltando quello che non si sa.
  String get comeSiRiconosce =>
      [marca, modello].where((pezzo) => pezzo.isNotEmpty).join(' · ');

  /// Come lo vuole il foglietto «Dove lo metto?» della plancia.
  ///
  /// L'entita' in cima e' quella che il foglietto guarda per prima quando non
  /// ne arriva un elenco; l'elenco pero' c'e', ed e' quello che gli fa
  /// scegliere la sezione giusta fra le sei che un dispositivo porta.
  Map<String, Object?> get perLaPlancia => {
    'entity': entita.isEmpty ? '' : entita.first.entity,
    'nome': nome,
    'entita': [for (final una in entita) una.perLaPlancia],
  };
}

/// Quello che il ponte dice della rete, adesso.
class StatoDellaRete {
  const StatoDellaRete({
    required this.rete,
    required this.aperta,
    required this.restano,
    required this.entrati,
  });

  factory StatoDellaRete.daQuelloCheDice(Map<Object?, Object?> detto) {
    final elenco = detto['entrati'];
    return StatoDellaRete(
      rete: LaRete.daQuelloCheDice(detto['quale']),
      aperta: detto['aperta'] == true,
      restano: _secondi(detto['restano']),
      entrati: [
        if (elenco is List)
          for (final uno in elenco)
            if (uno is Map<Object?, Object?>)
              DispositivoEntrato.daQuelloCheDice(uno),
      ],
    );
  }

  /// Quando non si sa niente: nessuna rete, niente aperto, nessuno entrato.
  static const nessuna = StatoDellaRete(
    rete: LaRete.nessuna,
    aperta: false,
    restano: 0,
    entrati: [],
  );

  final LaRete rete;

  /// Se in questo momento la rete accoglie dispositivi nuovi.
  final bool aperta;

  /// Quanti secondi manca alla chiusura. Zero a rete chiusa.
  final int restano;

  /// Chi e' entrato da quando la rete e' stata aperta, nell'ordine in cui e'
  /// arrivato. Si svuota a ogni nuova apertura: quello che e' entrato ieri non
  /// e' quello che sta entrando adesso.
  final List<DispositivoEntrato> entrati;
}

/// Un apparecchio che nella rete c'e' gia'.
///
/// E' la stessa cosa di [DispositivoEntrato] vista un momento dopo: quello e'
/// «chi e' appena arrivato», questo e' «chi c'e'». Non sono la stessa classe
/// perche' non dicono le stesse cose — di chi e' arrivato interessano le
/// entita' da mettere nella plancia, di chi c'e' gia' interessano il mestiere
/// che fa nella rete e come sta messo.
class NellaRete {
  const NellaRete({
    required this.targa,
    required this.nome,
    required this.marca,
    required this.modello,
    required this.tipo,
    required this.potenza,
    required this.dispositivo,
  });

  factory NellaRete.daQuelloCheDice(Map<Object?, Object?> detto) => NellaRete(
    targa: _testo(detto['id']),
    nome: _testo(detto['nome']),
    marca: _testo(detto['marca']),
    modello: _testo(detto['modello']),
    tipo: _testo(detto['tipo']),
    potenza: _testo(detto['potenza']),
    dispositivo: _testo(detto['dispositivo']),
  );

  /// La targa: l'indirizzo IEEE. E' l'unica cosa che le due reti — ZHA e
  /// Zigbee2MQTT — chiamano allo stesso modo, ed e' quello che si passa al
  /// ponte per toglierlo.
  final String targa;

  final String nome;
  final String marca;
  final String modello;

  /// `coordinatore`, `router` o `terminale`: che mestiere fa nella rete.
  final String tipo;

  /// `rete` o `batteria`. Vuoto vuol dire che la rete non lo dice — e resta
  /// vuoto, perche' «non si sa» e' diverso da «a corrente».
  final String potenza;

  /// Il dispositivo di Home Assistant, quando si sa: e' il filo che lega
  /// questa riga a quello che la plancia gia' conosce.
  final String dispositivo;

  /// Se tiene su la rete per gli altri. Sono quelli che vanno a corrente, e
  /// toglierne uno stacca tutto quello che ci passava.
  bool get reggeGliAltri => tipo == 'coordinatore' || tipo == 'router';

  /// Se e' l'antenna. Quella non si toglie: si toglierebbe la rete.
  bool get eLAntenna => tipo == 'coordinatore';

  bool get vaABatteria => potenza == 'batteria';

  /// Come si presenta in una riga, sotto il nome: quello che fa capire «ah,
  /// e' quello» a chi sta guardando l'elenco.
  String get comeSiDice {
    final pezzi = [marca, modello].where((uno) => uno.isNotEmpty).toList();
    return pezzi.isEmpty ? targa : pezzi.join(' ');
  }
}

/// L'elenco di chi c'e' nella rete, e perche' se non c'e'.
class ChiCEInRete {
  const ChiCEInRete({
    required this.rete,
    required this.righe,
    required this.perche,
  });

  factory ChiCEInRete.daQuelloCheDice(Map<Object?, Object?> detto) {
    final elenco = detto['righe'];
    return ChiCEInRete(
      rete: LaRete.daQuelloCheDice(detto['quale']),
      righe: [
        if (elenco is List)
          for (final uno in elenco)
            if (uno is Map<Object?, Object?>) NellaRete.daQuelloCheDice(uno),
      ],
      perche: _testo(detto['perche']),
    );
  }

  static const vuoto = ChiCEInRete(rete: LaRete.nessuna, righe: [], perche: '');

  final LaRete rete;
  final List<NellaRete> righe;

  /// Perche' l'elenco e' vuoto, quando lo e'. Vuoto a elenco pieno.
  final String perche;
}

/// Un apparecchio dentro la mappa: come lo racconta l'elenco dei rami.
///
/// [qualita] e' quanto e' buono il filo verso chi lo regge, da zero a
/// duecentocinquantacinque. Nullo vuol dire che la rete non l'ha detto — ed e'
/// diverso da zero, che vorrebbe dire «non si sentono».
class NelRamo {
  const NelRamo({
    required this.targa,
    required this.nome,
    required this.tipo,
    required this.potenza,
    required this.qualita,
  });

  factory NelRamo.daQuelloCheDice(Map<Object?, Object?> detto) => NelRamo(
    targa: _testo(detto['id']),
    nome: _testo(detto['nome']),
    tipo: _testo(detto['tipo']),
    potenza: _testo(detto['potenza']),
    qualita: detto['qualita'] is num
        ? (detto['qualita']! as num).toInt()
        : null,
  );

  final String targa;
  final String nome;
  final String tipo;
  final String potenza;
  final int? qualita;

  bool get vaABatteria => potenza == 'batteria';
  bool get eLAntenna => tipo == 'coordinatore';
}

/// Un ramo della rete: l'antenna o un ripetitore, e cosa gli sta appeso.
class UnRamo {
  const UnRamo({required this.capo, required this.appesi});

  factory UnRamo.daQuelloCheDice(Map<Object?, Object?> detto) {
    final elenco = detto['appesi'];
    return UnRamo(
      capo: NelRamo.daQuelloCheDice(detto),
      appesi: [
        if (elenco is List)
          for (final uno in elenco)
            if (uno is Map<Object?, Object?>) NelRamo.daQuelloCheDice(uno),
      ],
    );
  }

  final NelRamo capo;
  final List<NelRamo> appesi;
}

/// La mappa: la figura, e con chi parla ognuno.
///
/// La figura la disegna il ponte e arriva gia' fatta — un SVG — perche' sia
/// una sola: disegnarla qui in Dart e nella plancia in JavaScript vorrebbe
/// dire due mappe che il giorno che una cambia dicono cose diverse.
///
/// ─── E perche' arrivano anche i rami, se c'e' gia' il disegno ────────────
///
/// Perche' una casa con ottanta apparecchi, disegnata, e' larga due metri di
/// schermo: dal campo, «non si vede nulla». I rami sono le stesse cose scritte
/// in righe — chi regge chi, e quanto bene — e un elenco il telefono lo sa
/// scorrere. Li conta lo stesso modulo del disegno, quindi le due cose non
/// possono dirsi diverse.
class LaMappaDellaRete {
  const LaMappaDellaRete({
    required this.figura,
    required this.quanti,
    required this.rami,
    required this.soli,
    required this.perche,
  });

  factory LaMappaDellaRete.daQuelloCheDice(Map<Object?, Object?> detto) {
    final righe = detto['righe'];
    final rami = detto['rami'];
    final soli = detto['soli'];
    return LaMappaDellaRete(
      figura: _testo(detto['svg']),
      quanti: righe is List ? righe.length : 0,
      rami: [
        if (rami is List)
          for (final uno in rami)
            if (uno is Map<Object?, Object?>) UnRamo.daQuelloCheDice(uno),
      ],
      soli: [
        if (soli is List)
          for (final uno in soli)
            if (uno is Map<Object?, Object?>) NelRamo.daQuelloCheDice(uno),
      ],
      perche: _testo(detto['perche']),
    );
  }

  static const vuota = LaMappaDellaRete(
    figura: '',
    quanti: 0,
    rami: [],
    soli: [],
    perche: '',
  );

  /// Il disegno, pronto da mostrare. Vuoto quando non c'e' una mappa.
  final String figura;

  /// Quanti apparecchi ci sono dentro.
  final int quanti;

  /// La rete a righe: l'antenna per prima, poi i rami piu' carichi.
  final List<UnRamo> rami;

  /// Chi non parla con nessuno: nel disegno sta in fondo, qui in fondo uguale.
  final List<NelRamo> soli;

  /// Perche' non c'e', quando non c'e'.
  final String perche;

  bool get cE => figura.isNotEmpty;
}

/// Quanto spesso si richiede lo stato mentre si aspetta.
///
/// Un secondo. E' la stessa frequenza con cui si muove il conto alla rovescia
/// a schermo — che conta da solo, senza chiedere niente — e chiedere piu'
/// spesso non farebbe entrare prima nessuno.
const ognUnSecondo = Duration(seconds: 1);

/// Il giro al ponte per la rete Zigbee.
class Zigbee {
  const Zigbee(this._filo);

  final Filo _filo;

  /// Che rete c'e', e cosa sta succedendo adesso.
  ///
  /// Non solleva mai: una casa che non risponde e una casa senza Zigbee si
  /// disegnano allo stesso modo — la voce non c'e' — e distinguerle
  /// costerebbe a chi guarda un messaggio d'errore su una cosa che non ha
  /// chiesto.
  Future<StatoDellaRete> stato() async {
    try {
      final detto = await _filo.risultato({'type': 'ponte/zigbee/stato'});
      if (detto is! Map<Object?, Object?>) return StatoDellaRete.nessuna;
      return StatoDellaRete.daQuelloCheDice(detto);
    } catch (_) {
      return StatoDellaRete.nessuna;
    }
  }

  /// Apre la rete. Per quanto lo decide il ponte se non si dice [secondi].
  ///
  /// Questa invece **solleva**, ed e' voluto: chi ha appena premuto «Apri la
  /// rete» ha chiesto qualcosa, e se non e' successo deve saperlo. E' la
  /// differenza fra una domanda che l'app fa per conto suo e un tasto che ha
  /// premuto una persona.
  ///
  /// Lo stato si compone dalla risposta invece di richiederlo: quello che
  /// manca lo si sa gia' — appena aperta non e' entrato nessuno, l'elenco lo
  /// svuota il ponte stesso — e un secondo giro sul filo vorrebbe dire il
  /// conto alla rovescia che comincia in ritardo su quello vero.
  Future<StatoDellaRete> apri({int? secondi}) async {
    final detto = await _filo.risultato({
      'type': 'ponte/zigbee/apri',
      if (secondi != null) 'secondi': secondi,
    });
    final fatto = _andataBene(detto);
    final restano = _secondi(fatto['restano']);
    return StatoDellaRete(
      rete: LaRete.daQuelloCheDice(fatto['quale']),
      aperta: restano > 0,
      restano: restano,
      entrati: const [],
    );
  }

  /// La richiude subito, senza aspettare che scada.
  Future<StatoDellaRete> chiudi() async {
    _andataBene(await _filo.risultato({'type': 'ponte/zigbee/chiudi'}));
    /* Qui il giro in piu' si paga volentieri: la risposta non dice che rete
     * fosse, e chi ha richiuso resta su quella schermata. */
    return stato();
  }

  /// Chi c'e' nella rete, tutto.
  ///
  /// Non solleva: una schermata che si apre su una casa senza Zigbee deve
  /// dire «qui non c'e' niente», non rompersi. Il perche' arriva dal ponte e
  /// si mostra accanto all'elenco vuoto.
  Future<ChiCEInRete> elenco() async {
    try {
      final detto = await _filo.risultato({'type': 'ponte/zigbee/elenco'});
      if (detto is! Map<Object?, Object?>) return ChiCEInRete.vuoto;
      return ChiCEInRete.daQuelloCheDice(detto);
    } catch (_) {
      return ChiCEInRete.vuoto;
    }
  }

  /// Toglie un apparecchio dalla rete.
  ///
  /// Solleva quando non e' andata, come `apri`: l'ha premuto una persona, e
  /// se non e' successo deve saperlo. Il ponte non si fida della risposta
  /// della rete — riguarda l'elenco — quindi quello che torna qui e' l'elenco
  /// **dopo**, gia' senza quello tolto: la schermata si ridisegna senza un
  /// secondo giro.
  Future<ChiCEInRete> elimina(String targa) async {
    final detto = await _filo.risultato({
      'type': 'ponte/zigbee/elimina',
      'targa': targa,
    });
    final fatto = _andataBene(detto);
    return ChiCEInRete.daQuelloCheDice(fatto);
  }

  /// La mappa di chi parla con chi.
  ///
  /// `rifai` fa partire il giro vero, che **dura**: il coordinatore chiede a
  /// ogni ripetitore, uno alla volta, e su una rete di venti cose ci mette
  /// fino a un minuto — durante il quale la rete e' occupata. Senza, si
  /// mostra quello che si sa gia'.
  ///
  /// Non solleva: se la mappa non c'e' si dice perche', che e' piu' utile di
  /// un errore rosso su una cosa che si era solo chiesta di guardare.
  Future<LaMappaDellaRete> mappa({
    bool rifai = false,
    bool scuro = false,
  }) async {
    try {
      final detto = await _filo.risultato({
        'type': 'ponte/zigbee/mappa',
        'rifai': rifai,
        'scuro': scuro,
      });
      if (detto is! Map<Object?, Object?>) return LaMappaDellaRete.vuota;
      return LaMappaDellaRete.daQuelloCheDice(detto);
    } catch (errore) {
      return LaMappaDellaRete(
        figura: '',
        quanti: 0,
        rami: const [],
        soli: const [],
        perche: spiegaLErrore(errore),
      );
    }
  }

  /// Un dispositivo che c'e' gia', presentato come quelli appena entrati.
  ///
  /// Serve a metterlo nella plancia partendo dall'elenco: il foglietto «Dove
  /// lo metto?» decide la sezione dalle ENTITA', e l'elenco quelle non le
  /// porta — sarebbero sei righe per riga per una cosa che si guarda solo
  /// quando si apre una scheda.
  ///
  /// Solleva: l'ha chiesto una persona premendo un tasto.
  Future<DispositivoEntrato> dimmi(String dispositivo) async {
    final detto = await _filo.risultato({
      'type': 'ponte/zigbee/dimmi',
      'dispositivo': dispositivo,
    });
    final dentro = detto is Map<Object?, Object?> ? detto['dispositivo'] : null;
    if (dentro is! Map<Object?, Object?>) {
      throw ComandoRifiutato(
        inLingua(
          it: 'quel dispositivo non si legge',
          en: 'that device cannot be read',
        ),
      );
    }
    return DispositivoEntrato.daQuelloCheDice(dentro);
  }

  /// Gli da' il nome che gli ha dato chi lo guarda (il passo 3).
  ///
  /// Il nome va nel registro di Home Assistant, dove lo vedono tutti — la
  /// plancia, le automazioni, l'app — e non in un cassetto dell'app: un
  /// dispositivo che si chiama «Presa lavatrice» qui e «TS0121» in casa
  /// sarebbe lo stesso dispositivo con due nomi, che e' il modo in cui uno
  /// smette di fidarsi di quello che legge.
  Future<DispositivoEntrato> rinomina(String dispositivo, String nome) async {
    final detto = await _filo.risultato({
      'type': 'ponte/zigbee/rinomina',
      'dispositivo': dispositivo,
      'nome': nome,
    });
    final suo = _andataBene(detto)['dispositivo'];
    if (suo is Map<Object?, Object?>) {
      return DispositivoEntrato.daQuelloCheDice(suo);
    }
    /* Fatta, ma senza rimandare la scheda: il nome nuovo lo sappiamo lo
     * stesso, ed e' quello che la schermata dopo scrive. */
    return DispositivoEntrato(
      id: dispositivo,
      nome: nome,
      marca: '',
      modello: '',
      tramite: '',
    );
  }

  /// La risposta, quando dice che e' andata. Altrimenti l'errore che porta.
  ///
  /// Il ponte a un ordine che non puo' eseguire non risponde «no»: risponde
  /// «si'» con dentro `fatto: false` e il motivo. Senza questo controllo un
  /// tasto premuto su una casa senza Zigbee non farebbe niente e non lo
  /// direbbe — che e' il modo peggiore di rifiutare.
  Map<Object?, Object?> _andataBene(Object? detto) {
    if (detto is Map<Object?, Object?>) {
      if (detto['fatto'] == true) return detto;
      final perche = _testo(detto['perche']);
      if (perche.isNotEmpty) throw ComandoRifiutato(perche);
    }
    throw ComandoRifiutato(
      inLingua(
        it: 'la rete Zigbee non ha risposto',
        en: 'the Zigbee network did not answer',
      ),
    );
  }

  /// Lo stato, richiesto finche' chi ascolta non smette.
  ///
  /// Il primo arriva subito e non dopo un secondo: chi apre la schermata deve
  /// vedere qualcosa mentre la apre, non un buco che si riempie dopo.
  ///
  /// Il battito e' un timer, e si spegne **nell'istante** in cui chi ascolta
  /// smette. Scritto come generatore — `yield`, e poi un'attesa — sarebbe
  /// stato piu' corto e sbagliato: un'attesa gia' partita non si annulla, e
  /// quel timer resta appeso fino a che non scade anche se la schermata e'
  /// gia' chiusa. Nelle prove dei widget e' un errore secco; nell'app e' un
  /// giro sul filo per una schermata che nessuno guarda piu'.
  ///
  /// Una richiesta che va storta non chiude il flusso e non si vede: il filo
  /// che cade e torna e' la normalita' di un telefono, e una schermata che si
  /// arrende al primo singhiozzo sarebbe una schermata che si arrende sempre.
  /// A dire che e' finita e' solo chi ascolta, smettendo.
  Stream<StatoDellaRete> mentreAspetti({Duration ogni = ognUnSecondo}) {
    late StreamController<StatoDellaRete> fila;
    Timer? battito;
    /* Una domanda per volta: su una rete lenta il giro puo' durare piu' di un
     * secondo, e senza questa riga si accavallerebbero — la casa riceverebbe
     * domande che nessuno aspetta piu'. */
    var inCorso = false;

    Future<void> unGiro() async {
      if (inCorso || fila.isClosed) return;
      inCorso = true;
      try {
        final adesso = await stato();
        if (!fila.isClosed) fila.add(adesso);
      } finally {
        inCorso = false;
      }
    }

    fila = StreamController<StatoDellaRete>(
      onListen: () {
        unawaited(unGiro());
        battito = Timer.periodic(ogni, (_) => unawaited(unGiro()));
      },
      onCancel: () {
        battito?.cancel();
        battito = null;
      },
    );
    return fila.stream;
  }
}

String _testo(Object? valore) => valore is String ? valore.trim() : '';

int _secondi(Object? valore) {
  if (valore is int) return valore < 0 ? 0 : valore;
  if (valore is num) {
    final quanti = valore.round();
    return quanti < 0 ? 0 : quanti;
  }
  return 0;
}
