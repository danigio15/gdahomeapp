/// Dove sta il ponte, e da quale delle sue strade ci si arriva.
///
/// L'utente lo batte a mano al primo avvio, e lo batte come gli viene:
/// `192.168.1.50`, `192.168.1.50:8098`, `casa.esempio.it`,
/// `https://casa.esempio.it/`. Tutte e quattro sono la stessa cosa e devono
/// funzionare tutte e quattro — chiedere a qualcuno di scrivere uno schema e
/// una porta e' un modo per farlo sbagliare.
library;

import '../parole.dart';

/// Se [casa] e' un nome o un numero che vive solo dentro una rete di casa.
///
/// Serve a una regola sola: **in chiaro** (`http`, `ws`) si parla solo con
/// quello che sta in casa. Fuori, fra il telefono e la casa ci sono reti che
/// non sono nostre, e chi ci sta sopra puo' rispondere al posto di chi si
/// cercava. La stretta di mano cifrata regge anche li' — e' fatta apposta —
/// ma un indirizzo pubblico in chiaro per l'abbinamento o per il centralino
/// e' quasi sempre uno sbaglio di chi l'ha scritto, e vale la pena non
/// seguirlo.
///
/// In casa sono: le reti private (10/8, 172.16/12, 192.168/16), il giro
/// corto del telefono stesso (127/8, `localhost`), gli indirizzi che una
/// macchina si da' da sola quando non trova nessuno (169.254/16), i nomi
/// `.local` e `.home.arpa`, e i nomi di una parola sola (`homeassistant`), che
/// fuori da una rete di casa non vogliono dire niente.
bool eInCasa(String casa) {
  final nome = casa.toLowerCase();
  if (nome == 'localhost' ||
      nome.endsWith('.local') ||
      nome.endsWith('.home.arpa')) {
    return true;
  }
  final numeri = RegExp(r'^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$')
      .firstMatch(nome);
  if (numeri != null) {
    final quattro = [for (var i = 1; i <= 4; i += 1) int.parse(numeri[i]!)];
    if (quattro.any((uno) => uno > 255)) return false;
    final a = quattro[0];
    final b = quattro[1];
    return a == 10 ||
        a == 127 ||
        (a == 172 && b >= 16 && b <= 31) ||
        (a == 192 && b == 168) ||
        (a == 169 && b == 254);
  }
  /* Una parola sola, senza punti: non e' un indirizzo che si raggiunga da
   * internet. Tutto numeri pero' no: `3232235777` e' un numero scritto in un
   * altro modo, e da fuori si raggiunge benissimo. */
  return !nome.contains('.') && !RegExp(r'^\d+$').hasMatch(nome);
}

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

  /// Il filo. Ci passa anche l'abbinamento: la stessa stretta di mano
  /// cifrata di sempre, legata al codice. Il vecchio `POST /abbinamento` in
  /// chiaro l'app non lo usa piu'.
  Uri get filo => _via(sicuro ? 'wss' : 'ws', '/casa');
  Uri get salute => _via(sicuro ? 'https' : 'http', '/salute');

  /// Se ci si puo' abbinare da qui: in cifrato sempre, in chiaro solo
  /// dentro casa. Vedi [eInCasa].
  bool get siPuoAbbinare => sicuro || eInCasa(casa);

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
  const IndirizzoDelCentralino({
    required this.casa,
    this.porta,
    this.sicuro = true,
  });

  final String casa;

  /// `null` vuol dire quella solita dello schema.
  final int? porta;
  final bool sicuro;

  /// Il filo verso una casa. L'identificativo non e' un segreto: serve a
  /// instradare, e il segno viene dopo, dentro il cifrato, verso la casa.
  Uri filo(String idDellaCasa) =>
      _via(sicuro ? 'wss' : 'ws', '/telefono/$idDellaCasa');

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
    final schema = RegExp(
      r'^([a-z]+)://',
      caseSensitive: false,
    ).firstMatch(testo);
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

    if (testo.isEmpty || !RegExp(r'^[A-Za-z0-9._-]+$').hasMatch(testo)) {
      return null;
    }
    /* Un centralino in chiaro va bene solo in casa — quello delle prove, o
     * uno sulla stessa rete. Uno su internet senza cifrato non lo si segue:
     * e' quasi sempre uno sbaglio, e da li' passano tutti i fili. */
    if (!sicuro && !eInCasa(testo)) return null;
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
  dalCentralino;

  /// Come si dice a schermo, in «Come va l'app».
  String get nome => switch (this) {
    DaDove.daDentro => inLingua(
      it: 'da dentro casa',
      en: 'from inside the home',
    ),
    DaDove.daFuori => inLingua(
      it: 'da fuori, su un indirizzo tuo',
      en: 'from away, on your own address',
    ),
    DaDove.dalCentralino => inLingua(
      it: 'dal centralino',
      en: 'through the relay',
    ),
  };
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

  /// Se questo approdo viaggia cifrato, tutto quanto.
  ///
  /// Serve a una cosa sola, e la fa da sola: un browser che ha caricato la
  /// pagina su `https` **rifiuta** di bussare in chiaro, e bussarci lo stesso
  /// non e' un tentativo che va male — e' la pagina che viene marcata «non
  /// sicura» finche' resta aperta.
  bool get sicuro => filo.isScheme('wss') && salute.isScheme('https');

  /// Come si dice a schermo.
  String get comeSiChiama => switch (da) {
    DaDove.daDentro => inLingua(it: 'in casa', en: 'at home'),
    DaDove.daFuori => inLingua(it: 'da fuori', en: 'away'),
    DaDove.dalCentralino => inLingua(it: 'da fuori', en: 'away'),
  };

  @override
  String toString() => '$filo ($comeSiChiama)';

  @override
  bool operator ==(Object other) =>
      other is Approdo && other.da == da && other.filo == filo;

  @override
  int get hashCode => Object.hash(da, filo);
}
