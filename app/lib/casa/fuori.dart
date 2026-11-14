/// Quello che si apre fuori dall'app, e a chi si da' una chiave.
///
/// Tre regole piccole, tenute in un posto solo perche' valgono in piu' punti:
/// i link delle note degli aggiornamenti, quelli che escono dal cruscotto e
/// dalla plancia, e l'indirizzo del quadro a cui si consegna il codice.
library;

import 'dart:convert';

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

/// L'origine di un indirizzo come la scrive un browser in
/// `location.origin`: schema, casa e porta — la porta solo se non e' quella
/// di serie (80 per `http`, 443 per `https`).
///
/// `null` per tutto quello che un'origine web non ce l'ha o non la deve
/// avere: uno schema che non e' `http`/`https`, un indirizzo senza casa, e
/// uno con delle **credenziali** (`https://qualcuno@casa/`). Quelle un
/// browser le toglie dall'origine, ma un indirizzo che le porta non e' mai
/// uno che il quadro scrive: e' un modo di far sembrare una cosa un'altra.
String? lOrigineDi(Uri quale) {
  final schema = quale.scheme.toLowerCase();
  if (schema != 'http' && schema != 'https') return null;
  if (quale.host.isEmpty || quale.userInfo.isNotEmpty) return null;
  final casa = quale.host.toLowerCase();
  final scritta = casa.contains(':') ? '[$casa]' : casa;
  /* `Uri.port` da' gia' la porta effettiva: quella scritta, o quella di
   * serie dello schema. */
  final diSerie = schema == 'https' ? 443 : 80;
  final porta = quale.port;
  return porta == diSerie ? '$schema://$scritta' : '$schema://$scritta:$porta';
}

/// Se due indirizzi stanno sulla **stessa origine**: schema, casa e porta
/// effettiva. E' la regola del browser, ed e' quella che decide a quale
/// pagina il riquadro del cruscotto da' fiducia.
///
/// Prima si guardavano solo casa e schema: una pagina sulla stessa casa ma su
/// un'altra porta — un altro servizio, un altro proprietario — era «del
/// quadro», si apriva nel riquadro e riceveva la chiave.
bool eLaStessaOrigine(Uri quale, Uri dove) {
  final una = lOrigineDi(quale);
  return una != null && una == lOrigineDi(dove);
}

/// Il JavaScript che consegna la chiave alla pagina del quadro, o `null` se
/// adesso non si consegna niente.
///
/// [adesso] e' l'indirizzo della pagina che il WebView ha in mano **in
/// questo momento** (`currentUrl()`), letto subito prima di ogni colpo: la
/// consegna si ripete dopo trecento millisecondi e dopo un secondo e mezzo,
/// e in mezzo la pagina puo' essere cambiata. Se non e' sulla stessa origine
/// di [pagina] — o se [pagina] non e' un quadro sicuro — non parte niente.
///
/// E lo script ricontrolla da se', dentro la pagina, perche' fra la lettura
/// dell'indirizzo e l'esecuzione la pagina puo' cambiare ancora:
///
///  - consegna solo se la finestra e' quella principale (`window.top`) — una
///    cornice dentro la pagina non e' la pagina;
///  - consegna solo se `location.origin` e' esattamente quella del quadro;
///  - e il secondo argomento di `postMessage` e' quell'origine, non `"*"`:
///    se nel frattempo il documento fosse cambiato, il browser il messaggio
///    lo butta.
///
/// Chiave e origine passano da `jsonEncode`: finiscono dentro un programma
/// che si esegue.
String? ilCodiceDellaConsegna({
  required String chiave,
  required Uri pagina,
  required String? adesso,
}) {
  if (chiave.isEmpty || !eUnQuadroSicuro(pagina)) return null;
  final origine = lOrigineDi(pagina);
  if (origine == null) return null;
  final dove = adesso == null ? null : Uri.tryParse(adesso);
  if (dove == null || lOrigineDi(dove) != origine) return null;
  final detto = jsonEncode({'gdahome': 'chiave', 'chiave': chiave});
  return '(function(o,d){try{'
      'if(window.top!==window||location.origin!==o)return;'
      'window.postMessage(d,o);'
      '}catch(e){}})(${jsonEncode(origine)},$detto)';
}

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
