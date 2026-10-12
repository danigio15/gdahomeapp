/// Il colore di fondo della plancia, detto dalla pagina all'app.
///
/// «Su iPhone c'e' quella barra bianca»: attorno alla plancia — sotto
/// l'orologio del telefono, sotto la sua barra in fondo — l'app metteva il
/// fondo del **suo** tema, che segue il telefono. Con il telefono in modo
/// chiaro e la plancia scura quelle fasce erano bianche; con il telefono in
/// modo scuro non si vedevano, ed e' per questo che su un iPhone c'erano e
/// sull'altro no. Il tema della plancia lo sceglie la plancia, non il
/// telefono: il colore lo deve dire lei.
///
/// La pagina lo dice sul canale del telefono ([ilFondoDellaPlanciaDice] e
/// [ilFondoInBassoDice] davanti al colore, vedi `premesse.dart`) a ogni
/// cambio; l'app lo tiene qui, e chi disegna attorno alla plancia lo legge.
library;

import 'package:flutter/foundation.dart' show ValueNotifier;
import 'package:flutter/painting.dart' show Color;

/// Quello che la pagina mette davanti al colore sul canale `gdahomeDice`.
/// Non e' il nome di nessuna pagina, e non potra' esserlo: i nomi delle
/// pagine non hanno i due punti.
const String ilFondoDellaPlanciaDice = 'gdahome:fondo:';

/// Quello che la pagina mette davanti al colore della sua ultima riga di
/// punti, quella che tocca la barra dei gesti del telefono.
const String ilFondoInBassoDice = 'gdahome:fondo-basso:';

/// Il fondo della plancia aperta — quello del corpo, che sta anche sotto
/// l'orologio — o `null` finche' non l'ha detto.
final ValueNotifier<Color?> ilFondoDellaPlancia = ValueNotifier<Color?>(null);

/// Il colore in fondo alla plancia: la barra, se e' attaccata in basso, se
/// no il corpo. E' quello della fascia sotto il riquadro, che cosi' continua
/// la barra fino al bordo del vetro. `null` finche' la pagina non l'ha
/// detto.
final ValueNotifier<Color?> ilFondoInBasso = ValueNotifier<Color?>(null);

/// Un colore come lo scrive `getComputedStyle`: `rgb(11, 18, 32)` o
/// `rgba(11, 18, 32, 0.5)`. Un fondo trasparente, anche solo in parte, non e'
/// un fondo: torna `null`, e chi legge tiene il suo.
Color? coloreDalCss(String scritto) {
  final trovato = RegExp(
    r'^\s*rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d*(?:\.\d+)?)\s*)?\)\s*$',
  ).firstMatch(scritto);
  if (trovato == null) return null;
  final alfa = trovato.group(4);
  if (alfa != null && alfa.isNotEmpty && (double.tryParse(alfa) ?? 0) < 1) {
    return null;
  }
  int canale(int quale) =>
      double.parse(trovato.group(quale)!).round().clamp(0, 255);
  return Color.fromARGB(255, canale(1), canale(2), canale(3));
}
