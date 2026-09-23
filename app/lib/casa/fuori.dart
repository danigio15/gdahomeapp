/// Quello che si apre fuori dall'app, e a chi si da' una chiave.
///
/// Due regole piccole, tenute in un posto solo perche' valgono in piu' punti:
/// i link delle note degli aggiornamenti, quelli che escono dal cruscotto e
/// dalla plancia, e l'indirizzo del quadro a cui si consegna il codice.
library;

/// Un indirizzo che si puo' aprire nel browser: `http` o `https`, con una
/// casa.
///
/// Gli altri schemi non sono posti dove andare. Un `intent:` o un `file:`
/// chiedono al telefono di fare qualcosa, non di mostrare una pagina, e un
/// link dentro una nota o dentro una pagina che arriva da fuori non deve
/// poterlo chiedere a nome dell'app.
bool siApreFuori(Uri quale) =>
    (quale.scheme == 'http' || quale.scheme == 'https') &&
    quale.host.isNotEmpty;

/// Un quadro a cui si puo' dare il codice: solo in `https`.
///
/// Il codice del cruscotto apre la gestione degli impianti, e in `http`
/// viaggerebbe in chiaro — lui, e la pagina a cui lo si consegna, che
/// chiunque stia in mezzo potrebbe cambiare. L'eccezione e' il telefono
/// stesso (`localhost`, `127.0.0.1`), che serve a provare un quadro acceso sul
/// proprio computer e non passa da nessuna rete.
bool eUnQuadroSicuro(Uri quale) {
  if (quale.host.isEmpty) return false;
  if (quale.scheme == 'https') return true;
  return quale.scheme == 'http' && _eQui(quale.host);
}

bool _eQui(String casa) =>
    casa == 'localhost' || casa == '127.0.0.1' || casa == '::1';
