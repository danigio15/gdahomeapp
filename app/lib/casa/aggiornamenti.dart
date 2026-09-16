/// Cosa c'e' da aggiornare in casa, e i due tasti per farlo.
///
/// «Quando ci saranno gli aggiornamenti, e quindi compaiono in Home Assistant,
/// chi utilizzerà app non vedrà mai aggiornamenti se non accede su HA.»
///
/// E' il prezzo di un'app che prende il posto di Home Assistant: chi la usa
/// tutti i giorni in Home Assistant non ci entra piu', e li' resta il pallino
/// rosso che nessuno guarda. Sei mesi cosi' non sono una casa aggiornata male:
/// sono una casa con sei mesi di correzioni di sicurezza in meno.
///
/// L'elenco lo fa il **ponte** e non questa schermata, e non e' un giro
/// inutile: le entita' `update.` sono cinque o sei, e stanno dentro un
/// `get_states` da un megabyte e mezzo. Il telefono quel megabyte se lo tira
/// giu' solo quando gli serve la casa intera — l'elenco dei dispositivi, la
/// configurazione — e per contare tre aggiornamenti non gli serve. Il ponte la
/// domanda la fa sulla rete di casa, dove non costa niente, e sul filo passano
/// tre righe.
///
/// Le regole di cosa entra nell'elenco, in che ordine e con che nome sono
/// quelle della plancia (`aggiornamenti-da-fare.js`, la tessera ambra della
/// Home): chi guarda la dashboard e chi guarda l'app devono vedere la stessa
/// cosa.
library;

import '../ponte/filo.dart';

/// Un aggiornamento che aspetta di essere fatto.
class UnAggiornamento {
  const UnAggiornamento({
    required this.entita,
    required this.nome,
    this.da = '',
    this.a = '',
    this.nostra = false,
    this.installabile = false,
    this.inCorso = false,
    this.quanto = -1,
    this.stacca = false,
    this.note = '',
    this.dettagli = '',
  });

  /// L'entita' `update.` che lo dichiara.
  final String entita;

  /// Come si chiama: il `title` dell'entita' quando c'e' — «Home Assistant
  /// Core», «gdahome» — che e' il nome con cui lo si conosce.
  final String nome;

  /// La versione installata e quella che aspetta. Una delle due puo' mancare.
  final String da;
  final String a;

  /// Se e' quello della plancia. Va per primo nell'elenco.
  final bool nostra;

  /// Se si puo' far partire di qui. Un firmware che si cambia col cacciavite
  /// no: e mostrargli un tasto sarebbe una promessa che non si mantiene.
  final bool installabile;

  /// Se sta gia' andando.
  final bool inCorso;

  /// A che punto e', da 0 a 100. `-1` quando Home Assistant non lo dice: li'
  /// va una striscia che si muove e non promette niente.
  final int quanto;

  /// Se installarlo porta giu' la strada fra il telefono e casa: gdahome —
  /// che e' il ponte stesso — oppure Home Assistant, il Supervisor, il
  /// sistema operativo. Si dice **prima**: detto prima e' un'attesa, non detto
  /// e' un guasto.
  final bool stacca;

  /// Dove stanno le note di questa versione, per esteso.
  final String note;

  /// Le note brevi, quelle che Home Assistant si porta dentro l'entita'. Su un
  /// telefono sono la differenza fra premere «Installa» sapendo cosa cambia e
  /// premerlo al buio.
  final String dettagli;

  /// Da che versione a che versione, come si scrive in una riga. Quando manca
  /// un pezzo si dice quello che c'e'.
  String get versioni {
    if (da.isNotEmpty && a.isNotEmpty) return '$da → $a';
    return a.isNotEmpty ? a : da;
  }

  static UnAggiornamento? leggi(Map<String, dynamic> grezzo) {
    final entita = grezzo['entita']?.toString().trim() ?? '';
    if (entita.isEmpty) return null;
    return UnAggiornamento(
      entita: entita,
      nome: grezzo['nome']?.toString().trim().isNotEmpty == true
          ? grezzo['nome'].toString().trim()
          : entita,
      da: grezzo['da']?.toString().trim() ?? '',
      a: grezzo['a']?.toString().trim() ?? '',
      nostra: grezzo['nostra'] == true,
      installabile: grezzo['installabile'] == true,
      inCorso: grezzo['inCorso'] == true,
      quanto: int.tryParse('${grezzo['quanto'] ?? -1}') ?? -1,
      stacca: grezzo['stacca'] == true,
      note: grezzo['note']?.toString().trim() ?? '',
      dettagli: grezzo['dettagli']?.toString().trim() ?? '',
    );
  }
}

/// Cosa risponde il ponte quando si fa partire qualcosa.
class Avviato {
  const Avviato({this.gia = false, this.stacca = false});

  /// Stava gia' andando: si e' premuto due volte, o qualcun altro l'ha fatto
  /// partire prima. Non e' un errore e non si ricomincia niente.
  final bool gia;

  /// Il filo con la casa sta per cadere, ed e' quello che deve succedere.
  final bool stacca;
}

/// I tre sportelli degli aggiornamenti, passando dal ponte.
class GliAggiornamenti {
  const GliAggiornamenti(this._filo);

  final Filo _filo;

  /// Cosa aspetta di essere aggiornato, il piu' importante per primo.
  ///
  /// `forza` salta la memoria corta del ponte: si usa subito dopo aver fatto
  /// partire qualcosa, che se no per dieci secondi si continua a leggere la
  /// fotografia di prima.
  Future<List<UnAggiornamento>> elenco({bool forza = false}) async {
    final detto = await _filo.risultato({
      'type': 'ponte/aggiornamenti/elenco',
      if (forza) 'forza': true,
    });
    final righe = detto is Map ? detto['aggiornamenti'] : null;
    if (righe is! List) return const [];
    return righe
        .whereType<Map>()
        .map((una) => UnAggiornamento.leggi(Map<String, dynamic>.from(una)))
        .nonNulls
        .toList();
  }

  /// Fa partire un'installazione. Torna quando e' **partita**, non quando e'
  /// finita: un add-on ci mette minuti, e a dire a che punto sta ci pensa
  /// l'elenco al giro dopo.
  Future<Avviato> installa(String entita) async {
    final detto = await _filo.risultato({
      'type': 'ponte/aggiornamenti/installa',
      'entity_id': entita,
    });
    return Avviato(
      gia: detto is Map && detto['gia'] == true,
      stacca: detto is Map && detto['stacca'] == true,
    );
  }

  /// Riavvia Home Assistant. Il filo cade subito dopo, ed e' il segno che sta
  /// funzionando.
  Future<void> riavvia() =>
      _filo.risultato({'type': 'ponte/aggiornamenti/riavvia'});
}
