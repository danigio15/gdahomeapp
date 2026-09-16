/// Le porte delle prove dal vivo, e perche' non basta chiederne una.
///
/// Un processo vero — il ponte, il centralino — vuole il numero della porta
/// **prima** di partire: glielo si passa, e lui ci si mette sopra. Per sapere
/// quale e' libera si apre una presa sulla porta 0, si guarda che numero e'
/// toccato, e la si chiude.
///
/// Fra quella chiusura e l'ascolto del processo pero' passa l'avvio di Node,
/// qualche decimo di secondo, e in quel buco quella porta se la puo' prendere
/// chiunque altro. Su un computer fermo non succede mai; sulle macchine delle
/// corse, dove di prove ne girano tante insieme, succede — ed e' successo: il
/// processo muore con `EADDRINUSE`, la prova che lo aspettava si prende la
/// colpa di un guasto che non e' suo, e la corsa diventa rossa per niente.
///
/// Qui ci sono le due cose che lo rendono raro e innocuo: le porte si chiedono
/// **tutte insieme**, e chi accende un processo **riconosce** quell'errore e
/// riprova con numeri nuovi invece di insistere su quelli.
library;

import 'dart:io';

/// Quante volte si riprova ad accendere un processo, se la porta era occupata.
///
/// Tre: una porta rubata due volte di fila e' gia' difficile, tre e' un
/// computer che ha altri problemi — e a quel punto e' giusto dirlo invece di
/// girare in tondo.
const int quantiTentativi = 3;

/// Tante porte libere, prese **insieme**.
///
/// Insieme, e non una per volta: chiedendone una, chiudendola e chiedendone
/// un'altra, niente vieta al sistema di dare due volte lo stesso numero. Due
/// processi sulla stessa porta e' lo stesso guaio di prima, con in piu' che
/// non si capisce guardando il registro.
Future<List<int>> porteLibere(int quante) async {
  final prese = <ServerSocket>[];
  try {
    for (var i = 0; i < quante; i += 1) {
      prese.add(await ServerSocket.bind(InternetAddress.loopbackIPv4, 0));
    }
    return [for (final presa in prese) presa.port];
  } finally {
    for (final presa in prese) {
      await presa.close();
    }
  }
}

/// Nel registro c'e' scritto che la porta era occupata?
///
/// Node lo dice in due modi a seconda di dove casca — il codice secco e la
/// frase — e si guardano tutti e due.
bool parlaDiPortaOccupata(Iterable<String> registro) => registro.any(
  (riga) =>
      riga.contains('EADDRINUSE') || riga.contains('address already in use'),
);

/// Il processo e' morto perche' la porta era occupata: si riprova con un'altra.
///
/// Non esce mai da qui: chi accende la prende, cambia porte e riparte, e
/// all'ultimo tentativo la trasforma in un guasto vero con dentro il registro.
class PortaOccupata implements Exception {
  const PortaOccupata(this.registro);

  final String registro;

  @override
  String toString() => 'la porta era occupata:\n$registro';
}
