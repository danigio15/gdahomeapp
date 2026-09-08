/// Il fondo dell'app: non un grigio, un cielo.
///
/// Un colore piatto dietro le schede e' la cosa che fa sembrare vecchia
/// un'applicazione, e non perche' sia brutto: perche' non e' una scelta, e si
/// vede. Qui sotto c'e' lo stesso fondo della plancia — un grigio appena
/// azzurrino — con due aloni molto sfocati che ci galleggiano sopra, uno verde
/// e uno celeste, e si spostano cosi' piano che non si vedono muovere: si vede
/// solo che la schermata non e' ferma.
///
/// Sta sotto tutto, una volta sola, dietro ogni schermata: le pagine hanno il
/// fondo trasparente e ci galleggiano sopra. Cosi' passando da una all'altra
/// gli aloni non ripartono da capo — sarebbe un lampo a ogni cambio pagina.
library;

import 'dart:math' as matematica;

import 'package:flutter/material.dart';

import 'tema.dart';

/// Quanto ci mette un alone a fare tutto il suo giro. Venticinque secondi:
/// abbastanza perche' nessuno lo veda muoversi, abbastanza perche' due
/// schermate della stessa app non siano mai identiche.
const _giro = Duration(seconds: 25);

class SfondoVivo extends StatefulWidget {
  const SfondoVivo({super.key, this.child});

  final Widget? child;

  @override
  State<SfondoVivo> createState() => _SfondoVivoState();
}

class _SfondoVivoState extends State<SfondoVivo>
    with SingleTickerProviderStateMixin {
  late final AnimationController _tempo = AnimationController(
    vsync: this,
    duration: _giro,
  );

  @override
  void dispose() {
    _tempo.dispose();
    super.dispose();
  }

  /// Chi ha chiesto meno movimento al telefono lo ha chiesto a tutti, e a
  /// maggior ragione a un fondo: e' l'unica cosa qui dentro che si muove senza
  /// che nessuno gliel'abbia detto. Ferma resta bella lo stesso — gli aloni ci
  /// sono, semplicemente non vanno da nessuna parte.
  void _guardaSeDeveMuoversi(BuildContext context) {
    final fermo = MediaQuery.disableAnimationsOf(context);
    if (fermo && _tempo.isAnimating) {
      _tempo.stop();
      _tempo.value = 0.35;
    } else if (!fermo && !_tempo.isAnimating) {
      _tempo.repeat(reverse: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    _guardaSeDeveMuoversi(context);
    final scuro = Theme.of(context).brightness == Brightness.dark;
    return Stack(
      children: [
        Positioned.fill(
          child: RepaintBoundary(
            child: AnimatedBuilder(
              animation: _tempo,
              builder: (context, _) => CustomPaint(
                painter: _Aloni(
                  quanto: Curves.easeInOut.transform(_tempo.value),
                  scuro: scuro,
                ),
              ),
            ),
          ),
        ),
        if (widget.child case final figlio?) figlio,
      ],
    );
  }
}

class _Aloni extends CustomPainter {
  const _Aloni({required this.quanto, required this.scuro});

  /// Da 0 a 1 e ritorno: dove sono arrivati gli aloni nel loro giro.
  final double quanto;
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
    final andata = matematica.sin(quanto * matematica.pi);
    final grande = misura.width * 0.62;

    tela.drawCircle(
      Offset(
        misura.width * -0.08 + misura.width * 0.10 * quanto,
        misura.height * -0.06 + misura.height * 0.05 * andata,
      ),
      grande * (1 + 0.14 * quanto),
      penna
        ..color = (scuro ? Colori.aloneScuro1 : Colori.alone1).withValues(
          alpha: scuro ? 0.55 : 0.5,
        ),
    );
    tela.drawCircle(
      Offset(
        misura.width * 1.05 - misura.width * 0.08 * quanto,
        misura.height * 1.04 - misura.height * 0.06 * andata,
      ),
      grande * (1.02 - 0.10 * quanto),
      penna
        ..color = (scuro ? Colori.aloneScuro2 : Colori.alone2).withValues(
          alpha: scuro ? 0.6 : 0.55,
        ),
    );
  }

  @override
  bool shouldRepaint(_Aloni vecchio) =>
      vecchio.quanto != quanto || vecchio.scuro != scuro;
}
