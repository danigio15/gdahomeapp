/// L'attesa della plancia, una sola dall'inizio alla fine.
///
/// All'avvio si vedevano tre attese una dopo l'altra: una rotella sola, poi
/// «Casa · da fuori · Apro la plancia…», poi il velo della plancia dentro il
/// WebView, col suo marchio e «Caricamento…». Tre disegni diversi per la
/// stessa cosa — la plancia che arriva — e ogni cambio sembrava un intoppo.
///
/// Adesso l'app disegna la stessa attesa dall'inizio alla fine: il marchio
/// di gdahome al centro, la rotella della plancia che gira allo stesso passo,
/// la stessa riga sotto, sullo stesso fondo. Niente scritte d'altri: il nome
/// «DASHBOARDMODERN» del velo di serie della plancia non e' il nome dell'app.
///
/// Le misure sono quelle di `#cd-boot-overlay` in `dashboard.html`: chi
/// cambia una delle due deve cambiare l'altra (lo tiene d'occhio
/// `test/caricamento_test.dart`).
///
/// Le schermate che dicono qualcosa di vero — la casa non si trova, la
/// plancia non c'e', la licenza — restano le loro: questa e' solo l'attesa.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../parole.dart';
import '../vestito/marchio.dart';

/// A che punto e' l'attesa. Non si scrive — l'attesa e' una sola — ma lo
/// sanno le prove, e chi legge lo schermo lo sente.
enum FaseDelCaricamento {
  /// L'app che si apre: le case non sono ancora lette.
  app,

  /// Si cerca dove sta la plancia della casa.
  cerco,

  /// Si accende il servitore che la porta sul telefono.
  accendo,

  /// La pagina c'e' e si sta aprendo, sotto.
  apro,
}

/// I colori del velo della plancia: `#e8edf3` e `#0b1220` per il fondo,
/// `#0f172a` e `#e2e8f0` per la scritta, `#64748b` per la riga sotto, e
/// l'azzurro `#0ea5e9` della rotella con la sua traccia al 22%.
const fondoDelCaricamentoChiaro = Color(0xFFE8EDF3);
const fondoDelCaricamentoScuro = Color(0xFF0B1220);
const _rigaSotto = Color(0xFF64748B);
const _azzurro = Color(0xFF0EA5E9);
const _traccia = Color(0x380EA5E9);

/// Il fondo del caricamento per quella luminosita'.
Color fondoDelCaricamento(Brightness luce) => luce == Brightness.dark
    ? fondoDelCaricamentoScuro
    : fondoDelCaricamentoChiaro;

class CaricamentoDellaPlancia extends StatelessWidget {
  const CaricamentoDellaPlancia({
    super.key,
    this.fase = FaseDelCaricamento.app,
    this.inFondo = 0,
    this.carattere,
  });

  final FaseDelCaricamento fase;

  /// Quanto resta sotto la pagina, tolto al riquadro (i tasti di Android): il
  /// velo della plancia sta al centro della pagina, non dello schermo, e
  /// questo deve stare nello stesso punto.
  final double inFondo;

  /// Il carattere della scritta. Di serie quello del sistema, come il
  /// `system-ui` della plancia; le prove che disegnano ne passano uno vero.
  final String? carattere;

  String get _perche => switch (fase) {
    FaseDelCaricamento.app => inLingua(
      it: 'Apro l\'app…',
      en: 'Opening the app…',
    ),
    FaseDelCaricamento.cerco => inLingua(
      it: 'Cerco la plancia…',
      en: 'Looking for the dashboard…',
    ),
    FaseDelCaricamento.accendo => inLingua(
      it: 'Accendo la plancia…',
      en: 'Starting the dashboard…',
    ),
    FaseDelCaricamento.apro => inLingua(
      it: 'Apro la plancia…',
      en: 'Opening the dashboard…',
    ),
  };

  @override
  Widget build(BuildContext context) {
    final scuro = Theme.of(context).brightness == Brightness.dark;
    /* `inherit: false`: il tema dell'app ha i suoi caratteri, la plancia
     * scrive col carattere del sistema. Senza, la stessa parola cambiava
     * forma nel passaggio. */
    TextStyle stile(
      double misura,
      FontWeight peso,
      Color colore, {
      double spazio = 0,
    }) => TextStyle(
      inherit: false,
      fontFamily: carattere,
      fontSize: misura,
      fontWeight: peso,
      letterSpacing: spazio,
      color: colore,
      height: 1.2,
    );
    return Semantics(
      label: _perche,
      liveRegion: true,
      child: ExcludeSemantics(
        child: ColoredBox(
          color: fondoDelCaricamento(
            scuro ? Brightness.dark : Brightness.light,
          ),
          child: Padding(
            padding: EdgeInsets.only(bottom: inFondo),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  /* Il marchio dell'app, gdahome: e' l'app che si apre, e il
                   * logo e' il suo. Il velo della plancia, dopo, porta quello
                   * di chi ha montato l'impianto. */
                  const Marchio(lato: 76),
                  const SizedBox(height: 18),
                  const RotellaDellaPlancia(),
                  const SizedBox(height: 14),
                  Text(
                    inLingua(it: 'Caricamento…', en: 'Loading…'),
                    style: stile(11.5, FontWeight.w700, _rigaSotto),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// La rotella della plancia: un anello azzurro chiaro con un quarto pieno,
/// che fa un giro in otto decimi di secondo, sempre alla stessa velocita'.
/// Non e' la rotella di Material — quella si allunga e si accorcia — perche'
/// nel passaggio alla pagina si sarebbe vista cambiare.
///
/// Larga 46 e non 38: in CSS la rotella e' 38 di contenuto piu' 4 di bordo
/// per parte, e quello che si vede e' l'anello intero.
class RotellaDellaPlancia extends StatefulWidget {
  const RotellaDellaPlancia({super.key, this.misura = 46});

  final double misura;

  @override
  State<RotellaDellaPlancia> createState() => _RotellaDellaPlanciaState();
}

class _RotellaDellaPlanciaState extends State<RotellaDellaPlancia>
    with SingleTickerProviderStateMixin {
  late final AnimationController _giro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 800),
  )..repeat();

  @override
  void dispose() {
    _giro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: widget.misura,
    child: RotationTransition(
      turns: _giro,
      child: const CustomPaint(painter: _Anello()),
    ),
  );
}

class _Anello extends CustomPainter {
  const _Anello();

  @override
  void paint(Canvas canvas, Size size) {
    const spessore = 4.0;
    final raggio = (size.shortestSide - spessore) / 2;
    final centro = size.center(Offset.zero);
    final pennello = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = spessore;
    canvas.drawCircle(centro, raggio, pennello..color = _traccia);
    /* Il bordo di sopra di un cerchio in CSS: un quarto, da -135° a -45°. */
    canvas.drawArc(
      Rect.fromCircle(center: centro, radius: raggio),
      -math.pi * 3 / 4,
      math.pi / 2,
      false,
      pennello..color = _azzurro,
    );
  }

  @override
  bool shouldRepaint(_Anello oldDelegate) => false;
}
