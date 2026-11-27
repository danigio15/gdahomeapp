/// GdAHome Muro: l'app GdAHome che gira sul pannello a muro.
///
/// E' la stessa app di casa, ma per un Sonoff NSPanel con GdAHome OS: si avvia
/// da sola sulla plancia a muro, perche' l'add-on l'ha gia' fatta entrare nella
/// casa installandola (il foglietto, `avvio_muro.dart`). Niente QR da
/// inquadrare, niente menu da girare: il pannello mostra la sua stanza, e la
/// plancia a muro gestisce luminosita', riposo e prossimita' come gia' fa.
///
/// Non c'e' un secondo codice da mantenere: il collegamento cifrato, la plancia
/// e lo schermo a muro sono quelli dell'app, provati. Qui cambia solo come si
/// parte — dal foglietto invece che dal QR — e l'identita' dell'app
/// (`com.gdahome.muro`), cosi' un pannello e il telefono di casa non si pestano
/// i piedi. E quello che un pannello non e': un telefono (`sul_muro.dart`).
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'casa/impostazioni.dart';
import 'main.dart';
import 'muro/avvio_muro.dart';
import 'muro/sul_muro.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  sulMuro = true;
  /* La lingua NON la decide il pannello: un NSPanel esce di fabbrica con
   * Android in inglese, e la plancia di una casa italiana parlava inglese.
   * Resta quella di serie dell'app (`laLingua`), che e' quella della casa. */
  /* Prima di disegnare: se c'e' il foglietto dell'add-on, si entra nella casa.
   * Poi l'app parte come sempre, e trova la casa gia' pronta. */
  await provvediDalFoglietto();
  /* Le impostazioni prima del primo disegno, come `main.dart`, e col modo
   * leggero del pannello: la plancia si apre gia' leggera, non dalla
   * seconda pagina in poi. */
  final impostazioni = Impostazioni(
    sulTelefono: true,
    android: defaultTargetPlatform == TargetPlatform.android,
    pannelloAMuro: true,
  );
  await impostazioni.carica();
  runApp(AppDiCasa(impostazioni: impostazioni));
}
