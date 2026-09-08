/// Come la configurazione della plancia arriva dalla casa.
///
/// E' un comando di Home Assistant come gli altri — `dashboardmodern/config/get`
/// — e passa dal ponte senza che il ponte lo sappia: il ponte non guarda dentro
/// ai messaggi. Nessuna credenziale, nessun indirizzo: la stessa strada dei
/// comandi alle luci.
///
/// Due esiti che non sono errori: una casa senza DashboardModern risponde
/// «comando sconosciuto», e allora la plancia non c'e' — e' una cosa da dire,
/// non un guasto. Una casa con DashboardModern e nessuna configurazione
/// risponde con un profilo vuoto, e la Home lo dice a modo suo.
library;

import '../ponte/errori.dart';
import '../ponte/filo.dart';
import 'configurazione.dart';

/// Il comando, come lo registra l'integrazione.
const comandoDellaConfigurazione = 'dashboardmodern/config/get';

/// La configurazione della plancia, o `null` se DashboardModern non e'
/// installata in questa casa.
Future<ConfigurazioneDellaPlancia?> chiediLaConfigurazione(
  Filo filo, {
  String profilo = 'primary',
}) async {
  try {
    final risposta = await filo.risultato({
      'type': comandoDellaConfigurazione,
      'profile': profilo,
    });
    return ConfigurazioneDellaPlancia.dallaRisposta(risposta);
  } on ComandoRifiutato catch (errore) {
    if (errore.codice == 'unknown_command') return null;
    rethrow;
  }
}
