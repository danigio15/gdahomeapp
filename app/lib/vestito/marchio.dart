/// Il marchio, dove compare nell'app.
///
/// E' un'immagine sola, quella dell'icona dell'app: il quadrato con la G e la
/// A intrecciate dentro il profilo di una casa. Sta in un posto solo — questo
/// — e tutte le schermate lo disegnano passando di qui, cosi' il giorno che
/// cambia si cambia una riga.
///
/// Lo stesso file fa da icona su Android, su iOS e sul web: il marchio nel
/// menu e l'icona nella schermata del telefono devono essere la stessa cosa,
/// se no non si riconosce nessuna delle due.
library;

import 'package:flutter/material.dart';

class Marchio extends StatelessWidget {
  const Marchio({super.key, this.lato = 64, this.arrotondato = true});

  final double lato;

  /// Il logo ha gia' i suoi angoli tondi disegnati dentro. Su un fondo chiaro
  /// si ritaglia lo stesso, cosi' il nero non fa un quadrato duro: il taglio
  /// segue lo stesso raggio del disegno.
  final bool arrotondato;

  @override
  Widget build(BuildContext context) {
    /* Quanti pixel veri servono: il lato per la densita' dello schermo.
     *
     * Senza questo l'immagine si decodifica alla sua misura piena a ogni
     * apertura del menu, e su un marchio di trentaquattro punti vuol dire
     * scalare un quadrato di quattrocento pixel per disegnarne trentaquattro.
     * Si vedeva: il menu ci metteva secondi ad aprirsi. */
    final densita = MediaQuery.devicePixelRatioOf(context);
    final quanti = (lato * densita).round();
    final immagine = Image.asset(
      'assets/marchio/gda.png',
      width: lato,
      height: lato,
      cacheWidth: quanti,
      cacheHeight: quanti,
      fit: BoxFit.cover,
      filterQuality: FilterQuality.medium,
    );
    if (!arrotondato) return immagine;
    return ClipRRect(
      borderRadius: BorderRadius.circular(lato * 0.22),
      child: immagine,
    );
  }
}
