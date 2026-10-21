/// Una foto della telecamera, aperta alla misura in cui si vede.
///
/// Le telecamere 4K mandano foto di 3840 per 2160: aperte intere sono una
/// trentina di mega di memoria l'una, per disegnarle in un riquadro largo
/// come il telefono. Il campanello ne riceve una ogni pochi secondi. Lo ha
/// segnalato Google Play («migliora le prestazioni con il downsampling della
/// bitmap»), e sui telefoni con poca memoria si sentiva.
///
/// Qui la foto si apre gia' rimpicciolita ai pixel veri del posto che occupa
/// (punti per densita' dello schermo), mai ingrandita oltre la sua misura.
library;

import 'dart:typed_data';

import 'package:flutter/material.dart';

class FotoAMisura extends StatelessWidget {
  const FotoAMisura(
    this.byte, {
    super.key,
    this.width,
    this.fit = BoxFit.cover,
    this.gaplessPlayback = true,
  });

  final Uint8List byte;
  final double? width;
  final BoxFit fit;
  final bool gaplessPlayback;

  /// La foto piu' larga che si aspetta da una telecamera: sedici noni. Con
  /// `cover` in un riquadro piu' alto di cosi' e' l'altezza a comandare, e
  /// la foto deve essere larga abbastanza da riempirlo senza sgranarsi.
  static const double _laPiuLarga = 16 / 9;

  /// Quanti pixel di larghezza servono per riempire [spazio].
  static int? pixelPer(BoxConstraints spazio, double densita) {
    var punti = spazio.hasBoundedWidth ? spazio.maxWidth : 0.0;
    if (spazio.hasBoundedHeight) {
      final perLAltezza = spazio.maxHeight * _laPiuLarga;
      if (perLAltezza > punti) punti = perLAltezza;
    }
    if (punti <= 0) return null;
    return (punti * densita).ceil();
  }

  @override
  Widget build(BuildContext context) {
    final densita = MediaQuery.devicePixelRatioOf(context);
    return LayoutBuilder(
      builder: (contesto, spazio) => Image.memory(
        byte,
        width: width,
        fit: fit,
        gaplessPlayback: gaplessPlayback,
        /* Senza misura (uno spazio senza limiti) si apre intera, come prima:
         * meglio grande che sgranata. */
        cacheWidth: pixelPer(spazio, densita),
      ),
    );
  }
}
