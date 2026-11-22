/// La scena del benvenuto: una villa che si accende, e intorno quello che
/// l'app fa davvero.
///
/// «Deve essere effetto wow già quello»: la prima schermata dopo il download
/// e' la faccia di GdAHome. Una villa moderna su due piani vista dall'alto di
/// sbieco (pannelli solari, vetrate calde, balcone, piscina, l'auto in carica)
/// su una piattaforma di luce; attorno, schede di vetro con quello che si vede
/// poi nell'app — il sole, le luci, il clima, l'allarme, l'auto — legate alla
/// loro parte della casa da un raggio.
///
/// Si accende una volta (la piattaforma, la casa che sale, le finestre una
/// dopo l'altra, le schede) e poi respira piano: impulsi sui raggi, le schede
/// che galleggiano, i pannelli che brillano. Con «riduci animazioni» e' ferma,
/// gia' accesa. Tutto disegnato (`CustomPainter`): niente immagini da
/// scaricare, nitida a ogni misura.
library;

import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../parole.dart';

/// La misura su cui e' disegnata la scena: si scala per stare nello spazio.
const _largaScena = 390.0;
const _altaScena = 380.0;

class ScenaVilla extends StatefulWidget {
  const ScenaVilla({super.key});

  @override
  State<ScenaVilla> createState() => _ScenaVillaState();
}

class _ScenaVillaState extends State<ScenaVilla> with TickerProviderStateMixin {
  late final AnimationController _ingresso = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  );
  late final AnimationController _respiro = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 5),
  );
  var _avviata = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final ferma = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (ferma) {
      _ingresso.value = 1;
      _respiro.stop();
      _respiro.value = 0.3;
    } else if (!_avviata) {
      _avviata = true;
      _ingresso.forward();
      /* Respira tre quarti di minuto, poi resta ferma e accesa: chi lascia
       * l'app aperta sul benvenuto non consuma la batteria per niente. */
      _respiro.repeat(count: 9);
    }
  }

  @override
  void dispose() {
    _ingresso.dispose();
    _respiro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, spazio) {
        final k = math.min(
          spazio.maxWidth / _largaScena,
          spazio.maxHeight / _altaScena,
        );
        return Center(
          child: SizedBox(
            width: _largaScena * k,
            height: _altaScena * k,
            child: FittedBox(
              child: SizedBox(
                width: _largaScena,
                height: _altaScena,
                child: AnimatedBuilder(
                  animation: Listenable.merge([_ingresso, _respiro]),
                  builder: (context, _) {
                    final t = _ingresso.value;
                    final r = _respiro.value;
                    return Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Positioned.fill(
                          child: CustomPaint(
                            painter: _PittoreVilla(ingresso: t, respiro: r),
                          ),
                        ),
                        for (final (i, s) in _schede.indexed)
                          _SchedaSospesa(
                            dato: s,
                            comparsa: _tratto(t, 0.55 + i * 0.07, 0.25),
                            galleggio: math.sin((r + i * 0.21) * math.pi * 2),
                          ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Quanto e' avanti un pezzo che comincia a [da] e dura [lungo], su 0..1.
double _tratto(double t, double da, double lungo) =>
    Curves.easeOutCubic.transform(((t - da) / lungo).clamp(0.0, 1.0));

/// Una scheda di vetro: dove sta, l'icona, il colore, le due righe, e il
/// punto della casa a cui la lega il raggio.
typedef _Dato = ({
  Offset dove,
  IconData icona,
  Color colore,
  String titolo,
  String riga,
  List<double> ancora,
  Offset attacco,
});

List<_Dato> get _schede => [
  (
    dove: const Offset(18, 18),
    icona: Icons.wb_sunny_rounded,
    colore: const Color(0xFFFACC15),
    titolo: '3,2 kW',
    riga: inLingua(it: 'dal sole, adesso', en: 'from the sun, now'),
    ancora: const [46, 20, 49],
    attacco: const Offset(92, 40),
  ),
  (
    dove: const Offset(232, 18),
    icona: Icons.lightbulb_rounded,
    colore: const Color(0xFFFDE047),
    titolo: inLingua(it: '5 luci accese', en: '5 lights on'),
    riga: inLingua(it: 'Soggiorno · Cucina', en: 'Living · Kitchen'),
    ancora: const [60, 40, 40],
    attacco: const Offset(300, 40),
  ),
  (
    dove: const Offset(266, 176),
    icona: Icons.shield_rounded,
    colore: const Color(0xFF34D399),
    titolo: inLingua(it: 'Inserito', en: 'Armed'),
    riga: inLingua(it: 'Allarme', en: 'Alarm'),
    ancora: const [84, 20, 36],
    attacco: const Offset(330, 190),
  ),
  (
    dove: const Offset(10, 246),
    icona: Icons.thermostat_rounded,
    colore: const Color(0xFFF472B6),
    titolo: '21,5°',
    riga: inLingua(it: 'Soggiorno', en: 'Living room'),
    ancora: const [20, 55, 14],
    attacco: const Offset(60, 252),
  ),
  (
    dove: const Offset(136, 330),
    icona: Icons.directions_car_rounded,
    colore: const Color(0xFF60A5FA),
    titolo: inLingua(it: 'A casa fra 12 min', en: 'Home in 12 min'),
    riga: inLingua(
      it: 'Batteria 78% · in carica',
      en: 'Battery 78% · charging',
    ),
    ancora: const [40, 72, 8],
    attacco: const Offset(150, 342),
  ),
];

class _SchedaSospesa extends StatelessWidget {
  const _SchedaSospesa({
    required this.dato,
    required this.comparsa,
    required this.galleggio,
  });

  final _Dato dato;
  final double comparsa;
  final double galleggio;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: dato.dove.dx,
      top: dato.dove.dy + (1 - comparsa) * 14 + galleggio * 2.5,
      child: Opacity(
        opacity: comparsa,
        child: Container(
          padding: const EdgeInsets.fromLTRB(9, 7, 12, 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withValues(alpha: 0.15),
                Colors.white.withValues(alpha: 0.05),
              ],
            ),
            border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 22,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: dato.colore.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(dato.icona, size: 16, color: dato.colore),
              ),
              const SizedBox(width: 8),
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    dato.titolo,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.2,
                      height: 1.15,
                    ),
                  ),
                  Text(
                    dato.riga,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.62),
                      fontSize: 10.5,
                      height: 1.2,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/* ─── Il disegno ─────────────────────────────────────────────────────────── */

class _PittoreVilla extends CustomPainter {
  _PittoreVilla({required this.ingresso, required this.respiro});

  final double ingresso;
  final double respiro;

  static const _s = 1.55;
  static const _cx = 180.0;
  static final _c30 = math.cos(math.pi / 6);

  /// Le stelle, sempre le stesse.
  static final List<(Offset, double, double)> _stelle = () {
    final r = math.Random(9);
    return [
      for (var i = 0; i < 90; i++)
        (
          Offset(r.nextDouble() * _largaScena, r.nextDouble() * _altaScena),
          r.nextDouble() * 1.1,
          0.12 + r.nextDouble() * 0.6,
        ),
    ];
  }();

  late double _cy;

  Offset _iso(double x, double y, double z) =>
      Offset(_cx + (x - y) * _c30 * _s, _cy + (x + y) * 0.5 * _s - z * _s);

  Path _path(List<List<double>> pts) {
    final p = Path();
    for (final (i, q) in pts.indexed) {
      final o = _iso(q[0], q[1], q[2]);
      i == 0 ? p.moveTo(o.dx, o.dy) : p.lineTo(o.dx, o.dy);
    }
    return p..close();
  }

  void _alone(Canvas c, Offset o, double r, Color col, double a) {
    if (a <= 0) return;
    c.drawCircle(
      o,
      r,
      Paint()
        ..blendMode = BlendMode.plus
        ..shader = ui.Gradient.radial(
          o,
          r,
          [
            col.withValues(alpha: a),
            col.withValues(alpha: a * 0.35),
            col.withValues(alpha: 0),
          ],
          const [0, 0.4, 1],
        ),
    );
  }

  void _poly(
    Canvas c,
    List<List<double>> pts,
    Paint riempi, {
    Color? bordo,
    double spessore = 1,
  }) {
    final p = _path(pts);
    c.drawPath(p, riempi);
    if (bordo != null) {
      c.drawPath(
        p,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = spessore
          ..blendMode = BlendMode.plus
          ..color = bordo,
      );
    }
  }

  Paint _grad(List<double> a, List<double> b, Color c1, Color c2) => Paint()
    ..shader = ui.Gradient.linear(
      _iso(a[0], a[1], a[2]),
      _iso(b[0], b[1], b[2]),
      [c1, c2],
    );

  void _scatola(
    Canvas c,
    double x0,
    double x1,
    double y0,
    double y1,
    double z0,
    double z1,
    Paint sopra,
    Paint sinistra,
    Paint destra, {
    Color bordo = const Color(0x73AABEFF),
  }) {
    _poly(
      c,
      [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      sinistra,
      bordo: bordo,
    );
    _poly(
      c,
      [
        [x1, y1, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x1, y1, z1],
      ],
      destra,
      bordo: bordo,
    );
    _poly(
      c,
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      sopra,
      bordo: bordo,
    );
  }

  /// Una vetrata calda; [accesa] la fa salire da spenta a piena.
  void _vetro(Canvas c, List<List<double>> pts, double forza, double accesa) {
    if (accesa <= 0) {
      _poly(c, pts, Paint()..color = const Color(0xFF1B2560));
      return;
    }
    final o = pts.map((q) => _iso(q[0], q[1], q[2])).toList();
    final m = Offset(
      o.map((e) => e.dx).reduce((a, b) => a + b) / o.length,
      o.map((e) => e.dy).reduce((a, b) => a + b) / o.length,
    );
    _alone(c, m, 46, const Color(0xFFFFB050), forza * 0.7 * accesa);
    _poly(
      c,
      pts,
      Paint()
        ..shader = ui.Gradient.linear(
          m - const Offset(0, 18),
          m + const Offset(0, 18),
          [
            Color.lerp(
              const Color(0xFF1B2560),
              const Color(0xFFFFE8B0),
              accesa,
            )!,
            Color.lerp(
              const Color(0xFF1B2560),
              const Color(0xFFFFAB45),
              accesa,
            )!,
          ],
        ),
      bordo: const Color(0xCCFFF0D2),
      spessore: 0.8,
    );
  }

  void _albero(Canvas c, double x, double y, double h) {
    final a = _iso(x, y, 0);
    _alone(c, a, 18, const Color(0xFF34D399), 0.25);
    c.drawRect(
      Rect.fromLTWH(a.dx - 1.5, a.dy - 6, 3, 6),
      Paint()..color = const Color(0xFF3B2A1A),
    );
    for (var k = 0; k < 3; k++) {
      final w = 12.0 - k * 3, yy = a.dy - 6 - k * h / 3.2;
      c.drawPath(
        Path()
          ..moveTo(a.dx - w, yy)
          ..lineTo(a.dx, yy - h / 2.2)
          ..lineTo(a.dx + w, yy)
          ..close(),
        Paint()
          ..shader = ui.Gradient.linear(
            Offset(a.dx - w, 0),
            Offset(a.dx + w, 0),
            const [Color(0xFF0F5132), Color(0xFF1F9D63)],
          ),
      );
    }
  }

  @override
  void paint(Canvas c, Size size) {
    final piattaforma = _tratto(ingresso, 0, 0.3);
    final sale = _tratto(ingresso, 0.12, 0.38);
    final luci = ((ingresso - 0.35) / 0.3).clamp(0.0, 1.0);
    final batte = 0.5 + 0.5 * math.sin(respiro * math.pi * 2);

    // le stelle e il cielo dietro
    for (final (o, r, a) in _stelle) {
      c.drawCircle(o, r, Paint()..color = Colors.white.withValues(alpha: a));
    }
    _alone(
      c,
      const Offset(195, 170),
      210,
      const Color(0xFF8CA0FF),
      0.10 + 0.04 * batte,
    );

    // piattaforma (ferma), casa (sale)
    _cy = 158;
    c.saveLayer(
      Offset.zero & size,
      Paint()..color = Colors.white.withValues(alpha: piattaforma),
    );
    _poly(
      c,
      [
        [-26, -26, 0],
        [118, -26, 0],
        [118, 96, 0],
        [-26, 96, 0],
      ],
      Paint()..color = const Color(0x5928378C),
      bordo: const Color(0x9996AFFF),
      spessore: 1.2,
    );
    final griglia = Paint()
      ..color = const Color(0x2282A0FF)
      ..strokeWidth = 0.6
      ..blendMode = BlendMode.plus;
    for (double k = -26; k <= 118; k += 12) {
      c.drawLine(_iso(k, -26, 0), _iso(k, 96, 0), griglia);
    }
    for (double k = -26; k <= 96; k += 12) {
      c.drawLine(_iso(-26, k, 0), _iso(118, k, 0), griglia);
    }
    final centro = _iso(46, 35, 0);
    c.save();
    c.translate(centro.dx, centro.dy);
    c.scale(1, 0.5);
    _alone(c, Offset.zero, 170, const Color(0xFF6366F1), 0.45);
    c.restore();
    // piscina
    _poly(
      c,
      [
        [86, 8, 0],
        [110, 8, 0],
        [110, 52, 0],
        [86, 52, 0],
      ],
      Paint()..color = const Color(0x8C22D3EE),
      bordo: const Color(0xE6A5F3FC),
    );
    _alone(
      c,
      _iso(98, 30, 0),
      42,
      const Color(0xFF22D3EE),
      0.35 + 0.15 * batte,
    );
    _albero(c, -14, -12, 30);
    _albero(c, 104, -14, 26);
    c.restore();

    // la casa sale dalla piattaforma
    c.saveLayer(
      Offset.zero & size,
      Paint()..color = Colors.white.withValues(alpha: sale),
    );
    c.translate(0, (1 - sale) * 26);
    _scatola(
      c,
      0,
      80,
      0,
      55,
      0,
      26,
      _grad(
        [0, 0, 26],
        [80, 55, 26],
        const Color(0xFF5D6FD8),
        const Color(0xFF7F8FF0),
      ),
      _grad(
        [0, 55, 0],
        [80, 55, 0],
        const Color(0xFF26357F),
        const Color(0xFF33459C),
      ),
      _grad(
        [80, 55, 0],
        [80, 0, 0],
        const Color(0xFF1B2766),
        const Color(0xFF141D52),
      ),
    );
    double accesa(int n) => ((luci * 6) - n).clamp(0.0, 1.0);
    _vetro(
      c,
      [
        [6, 55, 3],
        [44, 55, 3],
        [44, 55, 22],
        [6, 55, 22],
      ],
      0.8,
      accesa(0),
    );
    _vetro(
      c,
      [
        [50, 55, 3],
        [74, 55, 3],
        [74, 55, 22],
        [50, 55, 22],
      ],
      0.7,
      accesa(2),
    );
    _vetro(
      c,
      [
        [80, 48, 3],
        [80, 30, 3],
        [80, 30, 22],
        [80, 48, 22],
      ],
      0.6,
      accesa(1),
    );
    _vetro(
      c,
      [
        [80, 24, 3],
        [80, 6, 3],
        [80, 6, 22],
        [80, 24, 22],
      ],
      0.5,
      accesa(3),
    );
    // garage
    _scatola(
      c,
      -2,
      26,
      58,
      84,
      0,
      20,
      _grad(
        [-2, 58, 20],
        [26, 84, 20],
        const Color(0xFF4C5CC6),
        const Color(0xFF6A7BE4),
      ),
      _grad(
        [-2, 84, 0],
        [26, 84, 0],
        const Color(0xFF202D74),
        const Color(0xFF2B3B90),
      ),
      _grad(
        [26, 84, 0],
        [26, 58, 0],
        const Color(0xFF182260),
        const Color(0xFF121A4C),
      ),
    );
    _poly(
      c,
      [
        [4, 84, 2],
        [22, 84, 2],
        [22, 84, 16],
        [4, 84, 16],
      ],
      Paint()..color = const Color(0x2EA0B4FF),
      bordo: const Color(0x80BECDFF),
      spessore: 0.8,
    );
    // piano di sopra a sbalzo
    _scatola(
      c,
      18,
      84,
      -2,
      40,
      26,
      48,
      _grad(
        [18, -2, 48],
        [84, 40, 48],
        const Color(0xFF6576DE),
        const Color(0xFF8A99F2),
      ),
      _grad(
        [18, 40, 26],
        [84, 40, 26],
        const Color(0xFF2A3A8A),
        const Color(0xFF3A4DAD),
      ),
      _grad(
        [84, 40, 26],
        [84, -2, 26],
        const Color(0xFF1D296C),
        const Color(0xFF16205A),
      ),
    );
    _vetro(
      c,
      [
        [24, 40, 29],
        [78, 40, 29],
        [78, 40, 44],
        [24, 40, 44],
      ],
      0.85,
      accesa(4),
    );
    _vetro(
      c,
      [
        [84, 34, 29],
        [84, 4, 29],
        [84, 4, 44],
        [84, 34, 44],
      ],
      0.6,
      accesa(5),
    );
    // balcone di vetro
    _poly(
      c,
      [
        [18, 55, 26],
        [84, 55, 26],
        [84, 55, 32],
        [18, 55, 32],
      ],
      Paint()..color = const Color(0x1FB4C8FF),
      bordo: const Color(0xB3D2E1FF),
      spessore: 0.8,
    );
    _poly(
      c,
      [
        [84, 55, 26],
        [84, 40, 26],
        [84, 40, 32],
        [84, 55, 32],
      ],
      Paint()..color = const Color(0x1AB4C8FF),
      bordo: const Color(0x99D2E1FF),
      spessore: 0.8,
    );
    // pannelli solari che brillano
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 2; j++) {
        final x0 = 24 + i * 14.5, y0 = 3 + j * 17.0;
        final lampo =
            (0.5 +
                0.5 *
                    math.sin(
                      (respiro * 2 - i * 0.12 - j * 0.08) * math.pi * 2,
                    )) *
            luci;
        _poly(
          c,
          [
            [x0, y0, 48.6],
            [x0 + 12.5, y0, 48.6],
            [x0 + 12.5, y0 + 15, 48.6],
            [x0, y0 + 15, 48.6],
          ],
          _grad(
            [x0, y0, 48.6],
            [x0 + 12.5, y0 + 15, 48.6],
            const Color(0xFF0B2A6B),
            Color.lerp(
              const Color(0xFF1D4FC0),
              const Color(0xFF5B8DF5),
              lampo * 0.6,
            )!,
          ),
          bordo: const Color(0xB396C8FF),
          spessore: 0.6,
        );
      }
    }
    _alone(c, _iso(54, 20, 49), 60, const Color(0xFFFDE047), 0.18 * luci);
    // l'auto, col cavo che carica
    const ax = 32.0, ay = 66.0;
    _scatola(
      c,
      ax,
      ax + 20,
      ay,
      ay + 11,
      1.5,
      7,
      Paint()..color = const Color(0xFFE2E8F0),
      Paint()..color = const Color(0xFF94A3B8),
      Paint()..color = const Color(0xFF64748B),
      bordo: const Color(0x59FFFFFF),
    );
    _scatola(
      c,
      ax + 5,
      ax + 15,
      ay + 1,
      ay + 10,
      7,
      11,
      Paint()..color = const Color(0xBF93C5FD),
      Paint()..color = const Color(0xB360A5FA),
      Paint()..color = const Color(0xB33B82F6),
      bordo: const Color(0x59FFFFFF),
    );
    final da = _iso(ax, ay + 3, 4), a = _iso(26, 70, 10);
    final cavo = Path()
      ..moveTo(da.dx, da.dy)
      ..quadraticBezierTo(
        (da.dx + a.dx) / 2,
        (da.dy + a.dy) / 2 + 10,
        a.dx,
        a.dy,
      );
    c.drawPath(
      cavo,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..blendMode = BlendMode.plus
        ..color = const Color(0xF234D399),
    );
    for (final m in cavo.computeMetrics()) {
      final p = m.getTangentForOffset(m.length * ((respiro * 2) % 1))?.position;
      if (p != null) _alone(c, p, 8, const Color(0xFF34D399), 0.9 * luci);
    }
    _alone(c, _iso(ax + 20, ay + 5, 4), 14, Colors.white, 0.5);
    _albero(c, -16, 40, 28);
    _albero(c, 112, 74, 32);
    _albero(c, 70, 92, 24);
    // il segnale dal tetto
    final segnale = _iso(30, 8, 58);
    for (var i = 1; i <= 3; i++) {
      final fase = ((respiro * 3) - i * 0.25) % 1;
      c.drawArc(
        Rect.fromCircle(center: segnale, radius: 4 + i * 7.0),
        -math.pi * 0.78,
        math.pi * 0.56,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round
          ..blendMode = BlendMode.plus
          ..color = const Color(0xFFFDE08A)
              .withValues(alpha: (0.35 + 0.6 * fase) * luci),
      );
    }
    c.restore();

    // i raggi verso le schede, con un impulso che corre verso la casa
    for (final (i, s) in _schede.indexed) {
      final vista = _tratto(ingresso, 0.55 + i * 0.07, 0.25);
      if (vista <= 0) continue;
      final p = _iso(s.ancora[0], s.ancora[1], s.ancora[2]);
      final q = s.attacco;
      c.drawLine(
        p,
        q,
        Paint()
          ..strokeWidth = 1.3
          ..blendMode = BlendMode.plus
          ..shader = ui.Gradient.linear(p, q, [
            s.colore.withValues(alpha: 0.95 * vista),
            s.colore.withValues(alpha: 0.12 * vista),
          ]),
      );
      _alone(c, p, 8, s.colore, 0.95 * vista);
      final f = 1 - ((respiro * 1.6 + i * 0.23) % 1);
      _alone(c, Offset.lerp(p, q, f)!, 7, s.colore, 0.9 * vista);
    }
  }

  @override
  bool shouldRepaint(_PittoreVilla vecchio) =>
      vecchio.ingresso != ingresso || vecchio.respiro != respiro;
}
