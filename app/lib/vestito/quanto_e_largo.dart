/// Quanto e' largo lo schermo, e cosa cambia.
///
/// Non si chiede «che dispositivo e'»: si guarda **quanto posto c'e'**. Un
/// telefono girato di lato ha lo spazio di un tablet e va trattato come tale;
/// una finestra stretta su un computer ha lo spazio di un telefono e va
/// trattata come tale. Chiedere il dispositivo vuol dire sbagliare in tutti e
/// due i casi, e vuol dire anche sbagliare quando qualcuno rimpicciolisce la
/// finestra — che su un computer si fa di continuo.
///
/// Le soglie sono quelle di Material, arrotondate a dove le cose cambiano
/// davvero per questa app: dove la barra puo' restare aperta senza mangiarsi
/// la pagina, e dove il contenuto comincia a essere troppo largo per leggerlo.
library;

import 'package:flutter/widgets.dart';

enum QuantoELargo {
  /// Sotto i 600: un telefono, o una finestra stretta. La barra si nasconde.
  telefono,

  /// Fino ai 900: un tablet in piedi. La barra si nasconde ancora — 192 punti
  /// su 700 sono un quarto della pagina, e in piedi la pagina serve tutta.
  tablet,

  /// Oltre i 900: un tablet di lato, un computer. La barra resta.
  computer;

  static QuantoELargo di(BuildContext contesto) =>
      dallaLarghezza(MediaQuery.sizeOf(contesto).width);

  static QuantoELargo dallaLarghezza(double quanto) => switch (quanto) {
    < 600 => QuantoELargo.telefono,
    < 900 => QuantoELargo.tablet,
    _ => QuantoELargo.computer,
  };

  /// Se la barra delle sezioni resta aperta invece di nascondersi.
  ///
  /// **No, da nessuna parte**, e prima era `true` su uno schermo da computer.
  ///
  /// Il ragionamento di prima era questo: nascondersi e' giusto dove lo schermo
  /// e' l'unica cosa che non si puo' comprare, e dove avanza una barra che si
  /// nasconde e' un gesto in piu' per ogni cambio di pagina. Sta in piedi da
  /// solo, e in pratica non regge: nel browser gdahome diventava un'app con
  /// due facce — sul telefono il menu si chiama col ☰ e copre la pagina, su un
  /// computer stava sempre li' a sinistra e il ☰ non c'era. Chi la usa in tutti
  /// e due i posti deve imparare due abitudini per la stessa cosa, e la barra
  /// ferma si prende duecento punti di larghezza proprio dove c'e' la plancia,
  /// che e' la cosa che si guarda.
  ///
  /// Una sola apertura, la stessa in tutti i posti: il ☰ in alto. Quella che
  /// si conosce, perche' e' quella del telefono.
  bool get laBarraResta => false;

  /// Quanto puo' essere larga una pagina dell'app prima di diventare
  /// illeggibile.
  ///
  /// Una riga di testo lunga duemila punti non si legge: l'occhio perde il
  /// capo della riga dopo. Le pagine dell'app — la configurazione, i
  /// dispositivi, le segnalazioni — si fermano qui e restano in mezzo. La
  /// **plancia** no: quella ha un disegno suo che si adatta, e le si da' tutto
  /// quello che c'e'.
  double get quantoLarga => switch (this) {
    QuantoELargo.telefono => double.infinity,
    QuantoELargo.tablet => double.infinity,
    QuantoELargo.computer => 1100,
  };
}

/// Mette una pagina in mezzo, e non piu' larga di quanto si legga.
///
/// Su un telefono non fa niente: e' gia' cosi'.
class QuantoCiSta extends StatelessWidget {
  const QuantoCiSta({super.key, required this.child, this.quanto});

  final Widget child;

  /// Un limite diverso da quello di serie, per chi ne vuole uno suo.
  final double? quanto;

  @override
  Widget build(BuildContext context) {
    final largo = quanto ?? QuantoELargo.di(context).quantoLarga;
    if (!largo.isFinite) return child;
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: largo),
        child: child,
      ),
    );
  }
}
