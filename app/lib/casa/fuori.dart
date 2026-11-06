/// Quello che si apre fuori dall'app, e a chi si da' una chiave.
///
/// Tre regole piccole, tenute in un posto solo perche' valgono in piu' punti:
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

/// Un pagamento che non passa dal negozio: PayPal, dove porta «Sostieni il
/// progetto» della plancia.
///
/// Su iPhone l'app non porta fuori a pagare (App Store, regola 3.1.1). Nella
/// plancia dell'app quel tasto e' gia' nascosto (`premesse.dart`); questa e'
/// la rete sotto, se un tasto sfugge. Chi lo chiede guarda la piattaforma:
/// qui dentro niente Flutter, come nel resto di questo file.
bool eUnPagamentoFuori(Uri quale) {
  final host = quale.host.toLowerCase();
  bool di(String dominio) => host == dominio || host.endsWith('.$dominio');
  return di('paypal.com') || di('paypal.me');
}

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

/// Un indirizzo del telefono stesso: `localhost`, `127.0.0.1` (o un altro
/// `127.x`), `::1`.
///
/// Fuori dall'app non si apre mai. Il browser del telefono non e' l'app: li'
/// dietro non c'e' la plancia, e ci si trova davanti «Safari non può aprire
/// la pagina». Se il riquadro chiede di andarci e non e' la pagina che sta
/// servendo, e' la plancia con un indirizzo vecchio — una porta che il
/// sistema aveva chiuso — e la cosa giusta e' riaprire la pagina vera,
/// dentro l'app.
bool eDelTelefono(Uri quale) {
  final casa = quale.host.toLowerCase();
  return _eQui(casa) || casa == '[::1]' || casa.startsWith('127.');
}

/// Una cornice che la plancia puo' tenere dentro di se': solo la mappa di
/// Windy (`embed.windy.com`), in `https`, senza porte ne' credenziali.
///
/// Il radar della plancia puo' mostrare Windy in un riquadro, e il WebView
/// chiede anche per i riquadri se si puo' andare: su iPhone un riquadro che
/// non e' della casa veniva aperto nel browser del telefono, e chi apriva il
/// meteo si trovava fuori dall'app. Vale solo per i riquadri — la pagina
/// intera resta quella della casa — e solo per questa origine: l'indirizzo
/// esatto lo costruisce e lo controlla la plancia (`core/radar-mappa.js`).
bool eUnaCorniceAmmessa(Uri quale) =>
    quale.scheme == 'https' &&
    quale.host == 'embed.windy.com' &&
    !quale.hasPort &&
    quale.userInfo.isEmpty;

/// Dove va il riquadro della plancia quando chiede di andare a un indirizzo.
enum StradaDelRiquadro {
  /// Ci va: e' la pagina servita, o una cornice ammessa.
  vai,

  /// Non ci va, e si riapre la pagina vera: un indirizzo del telefono che
  /// non e' quello servito, cioe' la plancia con una porta vecchia.
  riapri,

  /// Non ci va, e basta: un riquadro interno verso il telefono stesso.
  resta,

  /// Si apre nel browser del telefono: un collegamento che porta fuori.
  fuori,
}

/// La decisione del riquadro, senza WebView: `riquadro/sul_telefono.dart`
/// la segue e basta.
StradaDelRiquadro laStradaDelRiquadro(
  String indirizzo, {
  required bool paginaIntera,
  required bool Function(String indirizzo) siPuoAndare,
}) {
  if (siPuoAndare(indirizzo)) return StradaDelRiquadro.vai;
  final quale = Uri.tryParse(indirizzo);
  if (!paginaIntera && quale != null && eUnaCorniceAmmessa(quale)) {
    return StradaDelRiquadro.vai;
  }
  if (quale != null && eDelTelefono(quale)) {
    return paginaIntera ? StradaDelRiquadro.riapri : StradaDelRiquadro.resta;
  }
  return StradaDelRiquadro.fuori;
}
