/// Il biglietto con cui il telefono apre il cruscotto nel suo browser.
///
/// Dal telefono «Apri nel browser» apre un browser che non e' il nostro: a
/// quella scheda l'app non puo' consegnare la chiave — una scheda aperta con
/// `launchUrl` non si vede piu' — e la chiave nell'indirizzo non ci va, che
/// finisce nella cronologia. Ci va un biglietto: si chiede al quadro con la
/// chiave, vale un minuto e una volta sola, e il cruscotto lo cambia con la
/// chiave appena si apre (`quadro/src/biglietti.js`). Se il quadro non
/// risponde si apre la pagina com'e', e la chiave la chiede lei, come prima:
/// un tasto che non apre niente perche' manca la rete e' peggio di una
/// domanda in piu'.
///
/// Senza Flutter, e con il cliente da fuori: cosi' si prova con un quadro
/// finto.
library;

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// L'indirizzo da aprire: [pagina] col biglietto, o [pagina] e basta.
Future<Uri> conIlBiglietto(
  Uri pagina,
  String chiave, {
  http.Client? cliente,
  Duration entro = const Duration(seconds: 6),
}) async {
  if (chiave.isEmpty) return pagina;
  /* La via sta accanto alla pagina: `…/console/` porta a
   * `…/console/biglietto`. Senza la barra in fondo `resolve` salirebbe di
   * un gradino, e la via non c'e'. */
  final base = pagina.path.endsWith('/')
      ? pagina
      : pagina.replace(path: '${pagina.path}/');
  final mio = cliente ?? http.Client();
  try {
    final risposta = await mio
        .post(
          base.resolve('biglietto'),
          headers: {'authorization': 'Bearer $chiave'},
        )
        .timeout(entro);
    if (risposta.statusCode != 200) return pagina;
    final corpo = jsonDecode(risposta.body);
    final biglietto = corpo is Map ? corpo['biglietto'] : null;
    if (biglietto is! String || biglietto.isEmpty) return pagina;
    return pagina.replace(
      queryParameters: {...pagina.queryParameters, 'biglietto': biglietto},
    );
  } catch (_) {
    /* Rete assente, quadro giu', risposta strana: la pagina com'e'. */
    return pagina;
  } finally {
    if (cliente == null) mio.close();
  }
}
