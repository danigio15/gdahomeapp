/// Dove sta il ponte, e da quale delle sue strade ci si arriva.
///
/// L'utente lo batte a mano al primo avvio, e lo batte come gli viene:
/// `192.168.1.50`, `192.168.1.50:8098`, `casa.esempio.it`,
/// `https://casa.esempio.it/`. Tutte e quattro sono la stessa cosa e devono
/// funzionare tutte e quattro — chiedere a qualcuno di scrivere uno schema e
/// una porta e' un modo per farlo sbagliare.
library;

class IndirizzoDelPonte {
  const IndirizzoDelPonte({
    required this.casa,
    this.porta = portaDiDifetto,
    this.sicuro = false,
  });

  /// La porta su cui ascolta l'add-on, se non se ne dice un'altra.
  static const int portaDiDifetto = 8098;

  final String casa;
  final int porta;

  /// `true` quando davanti al ponte c'e' qualcosa che parla in cifrato — un
  /// proxy inverso, o l'accesso remoto di Home Assistant.
  final bool sicuro;

  Uri get filo => _via(sicuro ? 'wss' : 'ws', '/casa');
  Uri get abbinamento => _via(sicuro ? 'https' : 'http', '/abbinamento');
  Uri get salute => _via(sicuro ? 'https' : 'http', '/salute');

  Uri _via(String schema, String percorso) =>
      Uri(scheme: schema, host: casa, port: porta, path: percorso);

  /// Legge quello che ha scritto l'utente.
  ///
  /// Torna `null` quando non ci si cava un indirizzo, invece di sollevare: chi
  /// chiama sta guardando una casella di testo mentre qualcuno ci scrive
  /// dentro, e una casella a meta' non e' un errore.
  static IndirizzoDelPonte? leggi(String scritto) {
    var testo = scritto.trim();
    if (testo.isEmpty) return null;

    var sicuro = false;
    var porta = -1;

    final schema = RegExp(
      r'^([a-z]+)://',
      caseSensitive: false,
    ).firstMatch(testo);
    if (schema != null) {
      final nome = schema.group(1)!.toLowerCase();
      if (nome == 'https' || nome == 'wss') {
        sicuro = true;
        /* Chi mette `https` sta passando da un proxy, e quello sta sulla 443:
         * la porta dell'add-on non c'entra piu' niente. */
        porta = 443;
      } else if (nome != 'http' && nome != 'ws') {
        return null;
      }
      testo = testo.substring(schema.end);
    }

    /* Via quello che viene dopo il nome della casa: percorso, domanda, ancora. */
    testo = testo.split(RegExp(r'[/?#]')).first.trim();
    if (testo.isEmpty) return null;

    final duePunti = testo.lastIndexOf(':');
    if (duePunti > 0 && !testo.contains(']')) {
      final coda = testo.substring(duePunti + 1);
      final numero = int.tryParse(coda);
      if (numero == null || numero < 1 || numero > 65535) return null;
      porta = numero;
      testo = testo.substring(0, duePunti);
    }

    if (testo.isEmpty) return null;
    if (!RegExp(r'^[A-Za-z0-9._-]+$').hasMatch(testo)) return null;

    return IndirizzoDelPonte(
      casa: testo.toLowerCase(),
      porta: porta > 0 ? porta : portaDiDifetto,
      sicuro: sicuro,
    );
  }

  /// `true` quando questo e' l'accesso remoto di Home Assistant.
  ///
  /// Merita un nome perche' merita un messaggio suo. Quel tunnel arriva a Home
  /// Assistant e si ferma li': **le porte degli add-on non le fa passare**, e
  /// non c'e' nessuna impostazione che glielo faccia fare. Chi ci prova — ed e'
  /// la prima cosa che viene in mente a chi ce l'ha — merita di sentirsi dire
  /// perche' non funziona, invece di un «non trovo il ponte» che lo manda a
  /// controllare la rete per un'ora.
  bool get eLAccessoRemotoDiHomeAssistant => casa.endsWith('.ui.nabu.casa');

  /// Come si fa rivedere all'utente: senza la porta quando e' quella solita.
  @override
  String toString() {
    final schema = sicuro ? 'https' : 'http';
    final solita = sicuro ? 443 : portaDiDifetto;
    return porta == solita ? '$schema://$casa' : '$schema://$casa:$porta';
  }

  /* `other` e non `altro`: e' il nome che ha nel metodo di Dart che si sta
   * riscrivendo, e i nomi dei parametri riscritti si tengono. */
  @override
  bool operator ==(Object other) =>
      other is IndirizzoDelPonte &&
      other.casa == casa &&
      other.porta == porta &&
      other.sicuro == sicuro;

  @override
  int get hashCode => Object.hash(casa, porta, sicuro);
}


/* ─── Il centralino ───────────────────────────────────────────────────────── */

/// Dove si chiama per entrare da fuori.
///
/// Il centralino non e' una casa: e' il posto dove la casa **chiama** e resta
/// in attesa, e dove i telefoni la vengono a trovare. Chi ha installato
/// l'add-on non ha aperto nessuna porta sul router e non ha nessun indirizzo
/// pubblico — e' tutto il punto — quindi il suo indirizzo non lo batte
/// nessuno: arriva dalla casa stessa quando il telefono si abbina.
class IndirizzoDelCentralino {
  const IndirizzoDelCentralino({required this.casa, this.porta, this.sicuro = true});

  final String casa;

  /// `null` vuol dire quella solita dello schema.
  final int? porta;
  final bool sicuro;

  /// Il filo verso una casa. L'identificativo non e' un segreto: serve a
  /// instradare, e il segno viene dopo, dentro il cifrato, verso la casa.
  Uri filo(String idDellaCasa) => _via(sicuro ? 'wss' : 'ws', '/telefono/$idDellaCasa');

  /// Il filo di chi si sta abbinando. Si instrada sull'**impronta** del
  /// codice: il codice al centralino non passa mai.
  Uri abbinamento(String impronta) =>
      _via(sicuro ? 'wss' : 'ws', '/abbinamento/$impronta');

  Uri get salute => _via(sicuro ? 'https' : 'http', '/salute');

  Uri _via(String schema, String percorso) => porta == null
      ? Uri(scheme: schema, host: casa, path: percorso)
      : Uri(scheme: schema, host: casa, port: porta, path: percorso);

  /// Legge quello che ha detto la casa.
  ///
  /// Torna `null` quando non e' un indirizzo: una casa che dice una
  /// sciocchezza non deve rompere l'app di chi ci si sta abbinando.
  ///
  /// Senza schema si prende `wss`, non `ws`: un centralino sta su internet, e
  /// il difetto di una cosa che sta su internet e' il cifrato.
  static IndirizzoDelCentralino? leggi(String? scritto) {
    var testo = (scritto ?? '').trim();
    if (testo.isEmpty) return null;

    var sicuro = true;
    final schema = RegExp(r'^([a-z]+)://', caseSensitive: false).firstMatch(testo);
    if (schema != null) {
      final nome = schema.group(1)!.toLowerCase();
      if (nome == 'ws' || nome == 'http') {
        sicuro = false;
      } else if (nome != 'wss' && nome != 'https') {
        return null;
      }
      testo = testo.substring(schema.end);
    }

    testo = testo.split(RegExp(r'[/?#]')).first.trim();
    if (testo.isEmpty) return null;

    int? porta;
    final duePunti = testo.lastIndexOf(':');
    if (duePunti > 0) {
      final numero = int.tryParse(testo.substring(duePunti + 1));
      if (numero == null || numero < 1 || numero > 65535) return null;
      porta = numero;
      testo = testo.substring(0, duePunti);
    }

    if (testo.isEmpty || !RegExp(r'^[A-Za-z0-9._-]+$').hasMatch(testo)) return null;
    return IndirizzoDelCentralino(
      casa: testo.toLowerCase(),
      porta: porta,
      sicuro: sicuro,
    );
  }

  @override
  String toString() {
    final schema = sicuro ? 'wss' : 'ws';
    return porta == null ? '$schema://$casa' : '$schema://$casa:$porta';
  }

  @override
  bool operator ==(Object other) =>
      other is IndirizzoDelCentralino &&
      other.casa == casa &&
      other.porta == porta &&
      other.sicuro == sicuro;

  @override
  int get hashCode => Object.hash(casa, porta, sicuro);
}

/* ─── Da dove si entra ────────────────────────────────────────────────────── */

/// Le tre strade per la stessa casa.
enum DaDove {
  /// Dall'indirizzo di rete locale: si e' in casa, e si va dritti.
  daDentro,

  /// Da un indirizzo pubblico che qualcuno ha messo a mano: un proxy inverso,
  /// o una VPN. Non serve a nessuno averlo, ma chi ce l'ha lo usa.
  daFuori,

  /// Dal centralino: la casa ha chiamato fuori e ci si incontra li'. E' la
  /// strada di chi non ha configurato niente, cioe' di quasi tutti.
  dalCentralino,
}

/// Un posto dove bussare, adesso.
class Approdo {
  const Approdo({required this.da, required this.filo, required this.salute});

  /// L'approdo di un indirizzo diretto: la porta dell'add-on.
  Approdo.diretto(this.da, IndirizzoDelPonte dove)
    : filo = dove.filo,
      salute = dove.salute;

  /// L'approdo che passa dal centralino.
  Approdo.dalCentralino(IndirizzoDelCentralino dove, String idDellaCasa)
    : da = DaDove.dalCentralino,
      filo = dove.filo(idDellaCasa),
      salute = dove.salute;

  final DaDove da;

  /// Dove aprire il filo.
  final Uri filo;

  /// Dove chiedere «ci sei?» prima di aprirlo. Per un indirizzo diretto e' il
  /// ponte stesso; per il centralino e' il centralino, che risponde anche
  /// quando la casa non e' collegata — e li' lo scopre il filo.
  final Uri salute;

  /// Come si dice a schermo.
  String get comeSiChiama => switch (da) {
    DaDove.daDentro => 'in casa',
    DaDove.daFuori => 'da fuori',
    DaDove.dalCentralino => 'da fuori',
  };

  @override
  String toString() => '$filo ($comeSiChiama)';

  @override
  bool operator ==(Object other) =>
      other is Approdo && other.da == da && other.filo == filo;

  @override
  int get hashCode => Object.hash(da, filo);
}
