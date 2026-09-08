/// Il fondo dell'app: non un grigio, un cielo.
///
/// Un colore piatto dietro le schede e' la cosa che fa sembrare vecchia
/// un'applicazione, e non perche' sia brutto: perche' non e' una scelta, e si
/// vede. Qui sotto c'e' lo stesso fondo della plancia — un grigio appena
/// azzurrino — con due aloni molto sfocati che ci galleggiano sopra, uno verde
/// e uno celeste.
///
/// Sta sotto tutto, una volta sola, dietro ogni schermata: le pagine hanno il
/// fondo trasparente e ci galleggiano sopra.
///
/// ─── Perche' sta fermo ───────────────────────────────────────────────────
///
/// Sulla plancia gli aloni si muovono, in venticinque secondi, cosi' piano che
/// non si vede. Nel browser costa niente: la sfocatura la calcola una volta e
/// poi sposta l'immagine. Qui no. Una sfocatura larga un quarto dello schermo
/// su due cerchi grandi quanto lo schermo, ricalcolata a ogni fotogramma per
/// sempre, e' la cosa che faceva scaldare il telefono — per un movimento che
/// per definizione nessuno vedeva. Il fondo si dipinge una volta e resta li'.
library;

import 'package:flutter/material.dart';

import 'tema.dart';

class SfondoVivo extends StatelessWidget {
  const SfondoVivo({super.key, this.child});

  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final scuro = Theme.of(context).brightness == Brightness.dark;
    return Stack(
      children: [
        /* Il confine di ridisegno e' quello che lo rende gratis: quello che
         * c'e' dentro non cambia mai, quindi si rasterizza una volta e da li'
         * in poi e' un'immagine. */
        Positioned.fill(
          child: RepaintBoundary(
            child: CustomPaint(painter: _Aloni(scuro: scuro)),
          ),
        ),
        if (child case final figlio?) figlio,
      ],
    );
  }
}

class _Aloni extends CustomPainter {
  const _Aloni({required this.scuro});

  final bool scuro;

  @override
  void paint(Canvas tela, Size misura) {
    final fondo = scuro ? Colori.fondoScuro : Colori.fondo;
    tela.drawRect(Offset.zero & misura, Paint()..color = fondo);

    /* Quanto sfocare: proporzionale alla larghezza, se no su un telefono
     * stretto gli aloni si vedono come due palle. */
    final sfumatura = misura.width * 0.28;
    final penna = Paint()
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, sfumatura);

    /* Il verde in alto a sinistra, il celeste in basso a destra: sono gli
     * stessi due della plancia, nelle stesse posizioni. */
    final grande = misura.width * 0.62;
    tela.drawCircle(
      Offset(misura.width * -0.05, misura.height * -0.04),
      grande * 1.05,
      penna
        ..color = (scuro ? Colori.aloneScuro1 : Colori.alone1).withValues(
          alpha: scuro ? 0.55 : 0.5,
        ),
    );
    tela.drawCircle(
      Offset(misura.width * 1.02, misura.height * 1.02),
      grande * 0.98,
      penna
        ..color = (scuro ? Colori.aloneScuro2 : Colori.alone2).withValues(
          alpha: scuro ? 0.6 : 0.55,
        ),
    );
  }

  @override
  bool shouldRepaint(_Aloni vecchio) => vecchio.scuro != scuro;
}
