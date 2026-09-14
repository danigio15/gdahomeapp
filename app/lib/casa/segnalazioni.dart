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

import '../ponte/errori.dart';
import '../ponte/filo.dart';

/// Di che cosa si tratta. La chat non sta qui: e' un filo suo.
enum TipoDiSegnalazione {
  problema('Problema', 'Qualcosa non funziona come dovrebbe.'),
  idea('Idea', 'Una cosa che vorresti, e che non c\'è.'),
  domanda('Domanda', 'Non sai come si fa una cosa.');

  const TipoDiSegnalazione(this.nome, this.spiegazione);
  final String nome;
  final String spiegazione;

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
  aperte('aperte', 'Da lavorare'),
  inCarico('in-carico', 'In lavorazione'),
  chiuse('chiuse', 'Chiuse');

  const Gruppo(this.chiave, this.nome);

  final String chiave;

  /// Come si chiama sul tasto del filtro: le parole della dashboard.
  final String nome;

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
  ComandoRifiutato(codice: 'senza_centralino') =>
    'Questa casa non passa da nessun centralino: le segnalazioni non si '
        'possono spedire. Accendi «da fuori casa» nelle opzioni di gdahome.',
  ComandoRifiutato(codice: 'non_configurate') =>
    'Il centralino non ha ancora le segnalazioni accese. Riprova più '
        'tardi.',
  ComandoRifiutato(codice: 'troppe') =>
    'Troppe segnalazioni in poco tempo: riprova fra un po\'.',
  ComandoRifiutato(codice: 'non_ti_riconosco') =>
    'Il centralino non riconosce questa casa: gdahome in casa deve prima '
        'collegarsi da fuori una volta.',
  ComandoRifiutato(codice: 'unknown_command') =>
    'gdahome in casa è più vecchio dell\'app e questa cosa non la sa '
        'ancora fare: aggiorna l\'add-on in Home Assistant.',
  ComandoRifiutato(codice: 'troppo_grande') =>
    'L\'allegato è troppo grande: al massimo 10 MB. Un video va tenuto '
        'corto.',
  ComandoRifiutato(codice: 'tipo_non_ammesso') =>
    'Si possono allegare solo foto e video.',
  ComandoRifiutato(codice: 'unreachable') =>
    'Non si riesce a parlare col centralino dell\'assistenza: riprova fra '
        'un momento.',
  ComandoRifiutato(codice: 'disabled') ||
  ComandoRifiutato(
    codice: 'not_configured',
  ) => 'La chat di assistenza non è disponibile su questa casa.',
  ComandoRifiutato(codice: 'github', :final spiegazione) =>
    'GitHub non ha accettato: $spiegazione. Se era un allegato, il gettone '
        'delle segnalazioni deve poter scrivere i file (Contents: Read and '
        'write).',
  final ErroreDelPonte e => e.spiegazione,
  _ => 'Non ha funzionato: $errore',
};

DateTime? _quando(Object? valore) {
  if (valore is! String || valore.isEmpty) return null;
  return DateTime.tryParse(valore)?.toLocal();
}
