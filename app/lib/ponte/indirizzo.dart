/// Dove sta il ponte.
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
