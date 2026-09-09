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
/// ─── Perche' sta fermo, e perche' non sfoca ─────────────────────────────
///
/// Sulla plancia gli aloni si muovono, in venticinque secondi, cosi' piano che
/// non si vede. Nel browser costa niente: la sfocatura la calcola una volta e
/// poi sposta l'immagine. Qui no. Una sfocatura larga un quarto dello schermo
/// su due cerchi grandi quanto lo schermo, ricalcolata a ogni fotogramma per
/// sempre, e' la cosa che faceva scaldare il telefono — per un movimento che
/// per definizione nessuno vedeva. Il fondo si dipinge una volta e resta li'.
///
/// E non si sfoca nemmeno quella volta. Il motore di disegno di Flutter sul
/// telefono non tiene da parte quello che ha gia' disegnato: a ogni
/// fotogramma dell'app — una lista che scorre, la barra che si apre, un
/// cursore che lampeggia — ridisegna anche il fondo, e con la sfocatura vera
/// erano due passate su tutto lo schermo ogni volta. Un alone sfocato e' pero'
/// una cosa semplice: un cerchio che sbiadisce dal centro al bordo con un
/// certo profilo. Quel profilo si scrive in un gradiente radiale, che costa
/// quanto dipingere un colore, e a occhio e' lo stesso alone.
library;

import 'dart:ui' as ui;

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

    /* Quanto sfumare: proporzionale alla larghezza, se no su un telefono
     * stretto gli aloni si vedono come due palle. */
    final sfumatura = misura.width * 0.28;

    /* Il verde in alto a sinistra, il celeste in basso a destra: sono gli
     * stessi due della plancia, nelle stesse posizioni. */
    final grande = misura.width * 0.62;
    _alone(
      tela,
      centro: Offset(misura.width * -0.05, misura.height * -0.04),
      raggio: grande * 1.05,
      sfumatura: sfumatura,
      colore: (scuro ? Colori.aloneScuro1 : Colori.alone1).withValues(
        alpha: scuro ? 0.55 : 0.5,
      ),
    );
    _alone(
      tela,
      centro: Offset(misura.width * 1.02, misura.height * 1.02),
      raggio: grande * 0.98,
      sfumatura: sfumatura,
      colore: (scuro ? Colori.aloneScuro2 : Colori.alone2).withValues(
        alpha: scuro ? 0.6 : 0.55,
      ),
    );
  }

  /* Il profilo di un disco passato in una sfocatura gaussiana: pieno fino a
   * due sfumature dentro il bordo, meta' sul bordo, quasi niente due
   * sfumature fuori. Sette fermate bastano a non vedere la differenza. */
  static const _pesi = <double>[1, 0.98, 0.84, 0.5, 0.16, 0.02, 0];

  void _alone(
    Canvas tela, {
    required Offset centro,
    required double raggio,
    required double sfumatura,
    required Color colore,
  }) {
    final fino = raggio + 2.5 * sfumatura;
    final fermate = <double>[
      0,
      for (final passo in const [-2.0, -1.0, 0.0, 1.0, 2.0])
        ((raggio + passo * sfumatura) / fino).clamp(0.0, 1.0),
      1,
    ];
    final colori = [
      for (final peso in _pesi) colore.withValues(alpha: colore.a * peso),
    ];
    tela.drawCircle(
      centro,
      fino,
      Paint()..shader = ui.Gradient.radial(centro, fino, colori, fermate),
    );
  }

  @override
  bool shouldRepaint(_Aloni vecchio) => vecchio.scuro != scuro;
}
