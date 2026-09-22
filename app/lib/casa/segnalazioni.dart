/// Le segnalazioni e la chat di assistenza, dalla parte dell'app.
///
/// Stanno nell'app e non nella plancia: si aprono da qui, con dentro —
/// raccolte da sole — le cose che servono a chi legge (la versione dell'app e
/// del ponte, il telefono, da dove si stava passando), e le risposte tornano
/// qui. Passano dal ponte, che le porta al centralino, che le porta a chi
/// mantiene il progetto: il telefono non parla con nessuno di fuori e non
/// tiene nessun segreto.
///
/// Niente Flutter qui dentro: si prova contro un ponte finto.
library;

import 'dart:convert';
import 'dart:typed_data';

import '../parole.dart';
import '../ponte/errori.dart';
import '../ponte/filo.dart';

/// Di che cosa si tratta. La chat non sta qui: e' un filo suo.
enum TipoDiSegnalazione {
  problema,
  idea,
  domanda;

  /// Come si chiama, nella lingua di chi scrive.
  String get nome => switch (this) {
    TipoDiSegnalazione.problema => inLingua(it: 'Problema', en: 'Problem'),
    TipoDiSegnalazione.idea => inLingua(it: 'Idea', en: 'Idea'),
    TipoDiSegnalazione.domanda => inLingua(it: 'Domanda', en: 'Question'),
  };

  /// La riga sotto il nome, che dice quando si sceglie questo.
  String get spiegazione => switch (this) {
    TipoDiSegnalazione.problema => inLingua(
      it: 'Qualcosa non funziona come dovrebbe.',
      en: 'Something doesn\'t work the way it should.',
    ),
    TipoDiSegnalazione.idea => inLingua(
      it: 'Una cosa che vorresti, e che non c\'è.',
      en: 'Something you\'d like, and that isn\'t there.',
    ),
    TipoDiSegnalazione.domanda => inLingua(
      it: 'Non sai come si fa una cosa.',
      en: 'You don\'t know how to do something.',
    ),
  };

  static TipoDiSegnalazione leggi(Object? chiave) => switch (chiave) {
    'idea' => TipoDiSegnalazione.idea,
    'domanda' => TipoDiSegnalazione.domanda,
    _ => TipoDiSegnalazione.problema,
  };
}

/// Una foto o un video da mandare insieme alle parole.
///
/// Va nella repository delle segnalazioni, sotto la issue, con un commento
/// che lo indica. Passa per intero dal filo, dal ponte e dal centralino:
/// per questo c'e' un tetto, e per questo una foto si chiede gia' ridotta.
class Allegato {
  const Allegato({required this.nome, required this.tipo, required this.byte});

  final String nome;

  /// `image/jpeg`, `video/mp4`…
  final String tipo;
  final Uint8List byte;

  /// Lo stesso tetto del ponte e del centralino.
  static const int massimo = 10 * 1024 * 1024;

  bool get foto => tipo.startsWith('image/');
  String get peso => pesoLeggibile(byte.length);

  Map<String, Object> get _corpo => {
    'nome': nome,
    'tipo': tipo,
    'byte': base64.encode(byte),
  };
}

/// Quanto pesa, detto a una persona.
String pesoLeggibile(int byte) {
  if (byte < 1024) return '$byte B';
  if (byte < 1024 * 1024) return '${(byte / 1024).round()} KB';
  return '${(byte / (1024 * 1024)).toStringAsFixed(1)} MB';
}

/// Un allegato da dieci megabyte, da fuori casa, ci mette il suo tempo.
const Duration attesaPerUnAllegato = Duration(minutes: 3);

/// Una battuta del filo: chi l'ha scritta, cosa, quando.
class Messaggio {
  const Messaggio({required this.dallaCasa, required this.testo, this.il});

  final bool dallaCasa;
  final String testo;
  final DateTime? il;

  static Messaggio leggi(Map<String, dynamic> grezzo) => Messaggio(
    dallaCasa: grezzo['da'] != 'manutentore',
    testo: grezzo['testo']?.toString() ?? '',
    il: _quando(grezzo['il']),
  );
}

/// In quale dei tre gruppi cade una segnalazione.
///
/// E' la **stessa regola della dashboard** — `bucketDelloStato` in
/// `segnalazioni-section.js` — e i nomi sono i suoi: chi guarda la stessa
/// segnalazione nei due posti deve trovarla nello stesso gruppo, se no i due
/// filtri direbbero due cose diverse della stessa coda.
///
/// Tre e non due: senza il mezzo, una segnalazione che qualcuno ha gia' preso
/// in mano resta scritta «da lavorare», e chi l'ha aperta non sa se e' stata
/// vista. Chi decide quale sia lo stato e' il centralino
/// (`statoDellaIssue`): chiusa vince su tutto, poi «presa in carico» —
/// assegnata a qualcuno, o con la sua etichetta — poi aperta.
enum Gruppo {
  aperte('aperte'),
  inCarico('in-carico'),
  chiuse('chiuse');

  const Gruppo(this.chiave);

  final String chiave;

  /// Come si chiama sul tasto del filtro: le parole della dashboard.
  String get nome => switch (this) {
    Gruppo.aperte => inLingua(it: 'Da lavorare', en: 'To do'),
    Gruppo.inCarico => inLingua(it: 'In lavorazione', en: 'In progress'),
    Gruppo.chiuse => inLingua(it: 'Chiuse', en: 'Closed'),
  };

  static Gruppo diUnoStato(Object? stato) {
    final detto = stato?.toString().trim().toLowerCase() ?? '';
    if (detto == 'chiusa' || detto == 'chiuso' || detto == 'risolto') {
      return Gruppo.chiuse;
    }
    if (detto == 'in-carico') return Gruppo.inCarico;
    return Gruppo.aperte;
  }
}

/// Una segnalazione, o la chat: il filo intero quando lo si e' letto, solo la
/// riga dell'elenco altrimenti.
class Segnalazione {
  const Segnalazione({
    required this.numero,
    required this.tipo,
    required this.titolo,
    required this.gruppo,
    this.apertaIl,
    this.url = '',
    this.messaggi = const [],
    this.quantiMessaggi = 0,
    this.chat = false,
  });

  final int numero;
  final TipoDiSegnalazione tipo;
  final String titolo;
  final Gruppo gruppo;

  /// Tutto quello che non e' chiuso e' aperto: e' il conto che serve a chi
  /// guarda una riga, mentre i filtri guardano il gruppo.
  bool get aperta => gruppo != Gruppo.chiuse;
  final DateTime? apertaIl;
  final String url;
  final List<Messaggio> messaggi;

  /// Quanti messaggi ha, anche quando il filo non e' stato letto.
  final int quantiMessaggi;
  final bool chat;

  static Segnalazione leggi(Map<String, dynamic> grezzo) {
    final messaggi = grezzo['messaggi'];
    final elenco = [
      if (messaggi is List)
        for (final uno in messaggi)
          if (uno is Map) Messaggio.leggi(Map<String, dynamic>.from(uno)),
    ];
    return Segnalazione(
      numero: (grezzo['numero'] as num?)?.toInt() ?? 0,
      tipo: TipoDiSegnalazione.leggi(grezzo['tipo']),
      titolo: grezzo['titolo']?.toString() ?? '',
      gruppo: Gruppo.diUnoStato(grezzo['stato']),
      apertaIl: _quando(grezzo['aperta_il']),
      url: grezzo['url']?.toString() ?? '',
      messaggi: elenco,
      quantiMessaggi: messaggi is num ? messaggi.toInt() : elenco.length,
      chat: grezzo['tipo'] == 'chat',
    );
  }
}

/// L'elenco, e se questa casa puo' spedire.
class ElencoDelleSegnalazioni {
  const ElencoDelleSegnalazioni({
    required this.spedibili,
    required this.segnalazioni,
  });

  /// `false` quando la casa non passa da nessun centralino: si legge quello
  /// che c'e', ma non si scrive niente di nuovo.
  final bool spedibili;
  final List<Segnalazione> segnalazioni;
}

class Segnalazioni {
  const Segnalazioni(this._filo);

  final Filo _filo;

  Future<ElencoDelleSegnalazioni> elenco({bool aggiorna = false}) async {
    final letto = await _filo.risultato({
      'type': 'ponte/segnalazioni/elenco',
      'aggiorna': aggiorna,
    });
    final mappa = letto is Map ? Map<String, dynamic>.from(letto) : const {};
    final grezze = mappa['segnalazioni'];
    return ElencoDelleSegnalazioni(
      spedibili: mappa['spedibili'] != false,
      segnalazioni: [
        if (grezze is List)
          for (final una in grezze)
            if (una is Map) Segnalazione.leggi(Map<String, dynamic>.from(una)),
      ],
    );
  }

  Future<Segnalazione> crea({
    required TipoDiSegnalazione tipo,
    required String titolo,
    required String corpo,
    Map<String, String> diagnostica = const {},
  }) async => _una(
    await _filo.risultato({
      'type': 'ponte/segnalazioni/crea',
      'tipo': tipo.name,
      'titolo': titolo,
      'corpo': corpo,
      'diagnostica': diagnostica,
    }),
  );

  Future<Segnalazione> leggi(int numero) async => _una(
    await _filo.risultato({
      'type': 'ponte/segnalazioni/leggi',
      'numero': numero,
    }),
  );

  Future<Segnalazione> rispondi(int numero, String testo) async => _una(
    await _filo.risultato({
      'type': 'ponte/segnalazioni/rispondi',
      'numero': numero,
      'testo': testo,
    }),
  );

  /// La chat, e il guasto se c'e': il filo e' `null` finche' nessuno ha
  /// scritto, e `guaio` non e' vuoto quando il centralino dell'assistenza non
  /// ha risposto. Sono due cose insieme perche' capitano insieme: le parole
  /// vecchie si vedono, e accanto si dice che le nuove non sono arrivate.
  Future<LaChat> chat() async {
    final letto = await _filo.risultato({'type': 'ponte/chat/leggi'});
    final chat = letto is Map ? letto['chat'] : null;
    final guaio = letto is Map ? letto['guaio'] : null;
    return LaChat(
      filo: chat is Map
          ? Segnalazione.leggi(Map<String, dynamic>.from(chat))
          : null,
      guaio: guaio is String ? guaio : '',
    );
  }

  Future<Segnalazione> chatta(
    String testo, {
    Map<String, String> diagnostica = const {},
  }) async => _una(
    await _filo.risultato({
      'type': 'ponte/chat/scrivi',
      'testo': testo,
      'diagnostica': diagnostica,
    }),
  );

  /// Allega una foto o un video a una segnalazione. Torna il filo aggiornato,
  /// con dentro il messaggio che indica l'allegato.
  Future<Segnalazione> allega(int numero, Allegato allegato) async => _una(
    await _filo.risultato({
      'type': 'ponte/segnalazioni/allega',
      'numero': numero,
      ...allegato._corpo,
    }, entro: attesaPerUnAllegato),
  );

  static Segnalazione _una(Object? letto) {
    if (letto is! Map) {
      throw const ComandoRifiutato('la casa ha risposto una cosa strana');
    }
    return Segnalazione.leggi(Map<String, dynamic>.from(letto));
  }
}

/// Quello che si sa della chat in un momento: la conversazione, e il guasto.
///
/// Il guasto non prende il posto delle parole — la copia in casa esiste per
/// questo — e non si alza come errore: si dice accanto, e chi guarda vede
/// tutte e due le cose.
class LaChat {
  const LaChat({this.filo, this.guaio = ''});

  final Segnalazione? filo;
  final String guaio;
}

/// Cosa dire a schermo quando una segnalazione non parte: il codice del
/// ponte tradotto in una frase, e la frase del ponte quando il codice non
/// si conosce.
String spiegaLErrore(Object errore) => switch (errore) {
  ComandoRifiutato(codice: 'senza_centralino') => inLingua(
    it:
        'Questa casa non passa da nessun centralino: le segnalazioni non si '
        'possono spedire. Accendi «da fuori casa» nelle opzioni di gdahome.',
    en:
        'This home goes through no relay: reports have no way out. Turn on '
        '“from away” in the gdahome options.',
  ),
  ComandoRifiutato(codice: 'non_configurate') => inLingua(
    it:
        'Il centralino non ha ancora le segnalazioni accese. Riprova più '
        'tardi.',
    en: 'The relay doesn\'t have reports turned on yet. Try again later.',
  ),
  ComandoRifiutato(codice: 'troppe') => inLingua(
    it: 'Troppe segnalazioni in poco tempo: riprova fra un po\'.',
    en: 'Too many reports in a short time: try again in a bit.',
  ),
  ComandoRifiutato(codice: 'non_ti_riconosco') => inLingua(
    it:
        'Il centralino non riconosce questa casa: gdahome in casa deve prima '
        'collegarsi da fuori una volta.',
    en:
        'The relay doesn\'t recognise this home: gdahome at home has to '
        'connect from away once first.',
  ),
  /* Le note di una versione che Home Assistant non ha dato. Ha un caso suo
   * perche' non e' l'add-on a essere vecchio: e' Home Assistant che quel
   * comando non lo conosce, o l'entita' che non sa rispondere. Nel mucchio di
   * `unknown_command` mandava a aggiornare la cosa sbagliata. */
  ComandoRifiutato(codice: 'note_non_date') => inLingua(
    it:
        'Home Assistant non ha dato le note di questa versione: può essere '
        'una versione più vecchia, o un apparecchio che non le sa dire.',
    en:
        'Home Assistant didn\'t provide notes for this version: it may be an '
        'older version, or a device that can\'t tell them.',
  ),
  /* La rete Zigbee che Home Assistant non apre. Ha un caso suo per la stessa
   * ragione delle note di versione: non e' l'add-on a essere vecchio — quel
   * comando il ponte lo conosce, l'ha appena eseguito — e' Home Assistant che
   * non lo accetta. Dal campo, con l'add-on aggiornato e la scheda ZHA piena
   * a tre centimetri dall'avviso: «da un messaggio di aggiornare ma in realta'
   * e' tutto aggiornato». */
  ComandoRifiutato(codice: 'zigbee_non_accettato', :final spiegazione) => inLingua(
    it:
        'Home Assistant non ha accettato il comando per aprire la rete: '
        'controlla che ZHA (o Zigbee2MQTT) sia acceso e che l\'antenna sia '
        'collegata. Non è l\'add-on: questa cosa la sa fare. $spiegazione',
    en:
        'Home Assistant refused the command to open the network: check that '
        'ZHA (or Zigbee2MQTT) is running and the radio is plugged in. It\'s '
        'not the add-on: it does know how to do this. $spiegazione',
  ),
  ComandoRifiutato(codice: 'unknown_command') => inLingua(
    it:
        'gdahome in casa è più vecchio dell\'app e questa cosa non la sa '
        'ancora fare: aggiorna l\'add-on in Home Assistant.',
    en:
        'gdahome at home is older than the app and can\'t do this yet: '
        'update the add-on in Home Assistant.',
  ),
  ComandoRifiutato(codice: 'troppo_grande') => inLingua(
    it:
        'L\'allegato è troppo grande: al massimo 10 MB. Un video va tenuto '
        'corto.',
    en: 'The attachment is too big: 10 MB at most. Keep a video short.',
  ),
  ComandoRifiutato(codice: 'tipo_non_ammesso') => inLingua(
    it: 'Si possono allegare solo foto e video.',
    en: 'Only photos and videos can be attached.',
  ),
  ComandoRifiutato(codice: 'unreachable') => inLingua(
    it:
        'Non si riesce a parlare col centralino dell\'assistenza: riprova '
        'fra un momento.',
    en: 'I can\'t reach the support relay: try again in a moment.',
  ),
  ComandoRifiutato(codice: 'disabled') ||
  ComandoRifiutato(codice: 'not_configured') => inLingua(
    it: 'La chat di assistenza non è disponibile su questa casa.',
    en: 'Support chat isn\'t available on this home.',
  ),
  ComandoRifiutato(codice: 'github', :final spiegazione) => inLingua(
    it:
        'GitHub non ha accettato: $spiegazione. Se era un allegato, il '
        'gettone delle segnalazioni deve poter scrivere i file (Contents: '
        'Read and write).',
    en:
        'GitHub refused: $spiegazione. If it was an attachment, the reports '
        'token needs to be able to write files (Contents: Read and write).',
  ),
  final ErroreDelPonte e => e.spiegazione,
  _ => inLingua(
    it: 'Non ha funzionato: $errore',
    en: 'It didn\'t work: $errore',
  ),
};

DateTime? _quando(Object? valore) {
  if (valore is! String || valore.isEmpty) return null;
  return DateTime.tryParse(valore)?.toLocal();
}
