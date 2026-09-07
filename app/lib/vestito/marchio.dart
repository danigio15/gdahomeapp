/// Il marchio, dove compare nell'app.
///
/// **E' un segnaposto.** Il logo vero non c'e' ancora — nessuna proposta ha
/// convinto, e si e' deciso di andare avanti e metterlo dopo. Questo e' il
/// punto, uno solo, in cui si cambia: tutte le schermate disegnano il marchio
/// passando da qui, e quando arrivera' quello vero si sostituisce il
/// disegnatore qui sotto e basta.
///
/// Intanto: una casa di un tratto solo, con la porta aperta. Neutra, e non
/// finge di essere un logo.
library;

import 'package:flutter/material.dart';

class Marchio extends StatelessWidget {
  const Marchio({super.key, this.lato = 64, this.colore, this.fondo});

  final double lato;
  final Color? colore;
  final Color? fondo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Container(
      width: lato,
      height: lato,
      decoration: BoxDecoration(
        color: fondo ?? colori.primaryContainer,
        borderRadius: BorderRadius.circular(lato * 0.28),
      ),
      child: CustomPaint(painter: _Casa(colore ?? colori.onPrimaryContainer)),
    );
  }
}

class _Casa extends CustomPainter {
  const _Casa(this.colore);
  final Color colore;

  @override
  void paint(Canvas tela, Size misura) {
    final s = misura.width / 100;
    final penna = Paint()
      ..color = colore
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7.5 * s
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final via = Path()
      ..moveTo(41 * s, 78 * s)
      ..lineTo(24 * s, 78 * s)
      ..lineTo(24 * s, 46 * s)
      ..lineTo(50 * s, 23 * s)
      ..lineTo(76 * s, 46 * s)
      ..lineTo(76 * s, 78 * s)
      ..lineTo(59 * s, 78 * s);
    tela.drawPath(via, penna);
  }

  @override
  bool shouldRepaint(_Casa vecchia) => vecchia.colore != colore;
}
