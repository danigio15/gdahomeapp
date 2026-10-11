/// Che cosa fare di un errore del WebView.
library;

import 'package:webview_flutter/webview_flutter.dart';

/// Le tre risposte a un errore della pagina.
enum DopoLErrore { niente, ricarica, mostra }

/// `NSURLErrorCancelled`: una navigazione lasciata a meta' perche' ne e'
/// partita un'altra — si ricarica mentre stava caricando, la pagina cambia
/// indirizzo da se'. Non e' la pagina che non arriva: e' quella dopo che
/// arriva al suo posto.
const _annullata = -999;

/// `WebKitErrorFrameLoadInterruptedByPolicyChange`: la stessa cosa, detta da
/// WebKit — un'uscita che l'app ha fermato per aprirla nel browser.
const _interrottaDallaRegola = 102;

/// Se un errore della pagina va mostrato, ricaricato o lasciato correre.
///
/// «La plancia non è arrivata», con sotto niente, su iPhone al ritorno
/// nell'app: iOS, quando un'app sta dietro, si riprende la memoria chiudendo
/// il motore delle pagine, e WebKit lo dice come un errore senza parole.
/// Non e' la casa che non risponde e non c'e' niente da riprovare a mano: la
/// pagina si rifa' e basta, come fa Safari tornando su una scheda.
DopoLErrore cosaFareDellErrore(WebResourceError errore) {
  if (errore.isForMainFrame == false) return DopoLErrore.niente;
  if (errore.errorType == WebResourceErrorType.webContentProcessTerminated) {
    return DopoLErrore.ricarica;
  }
  if (errore.errorCode == _annullata) return DopoLErrore.niente;
  if (errore.errorCode == _interrottaDallaRegola &&
      (errore.description.isEmpty ||
          errore.description.toLowerCase().contains('interrupt'))) {
    return DopoLErrore.niente;
  }
  return DopoLErrore.mostra;
}

/// Quante volte di fila si ricarica da soli prima di dirlo.
///
/// Un motore che muore una volta tornando nell'app e' iOS che fa ordine; uno
/// che muore tre volte in un minuto e' una pagina che non ci sta, e
/// ricaricarla per sempre vorrebbe dire uno schermo che lampeggia.
class LeRicariche {
  LeRicariche({this.quante = 3, this.inQuanto = const Duration(minutes: 1)});

  final int quante;
  final Duration inQuanto;
  final List<DateTime> _quando = [];

  /// Se adesso si puo' ricaricare da soli; se si', la conta.
  bool unAltraVolta([DateTime? adesso]) {
    final ora = adesso ?? DateTime.now();
    _quando.removeWhere((prima) => ora.difference(prima) > inQuanto);
    if (_quando.length >= quante) return false;
    _quando.add(ora);
    return true;
  }
}
