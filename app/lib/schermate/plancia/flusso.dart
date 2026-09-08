/// Il flusso dell'energia: chi produce, chi consuma, dove finisce la
/// differenza.
///
/// E' il disegno della plancia, con le stesse posizioni e gli stessi colori:
/// il sole in cima, la rete e la batteria ai fianchi, la casa nel mezzo, e
/// sotto le cose che consumano. Le linee sono tratteggiate e grigie quando non
/// passa niente, e si accendono del colore di chi manda quando qualcosa passa
/// davvero — cosi' si legge in un secondo da dove sta arrivando la corrente,
/// che e' l'unica domanda per cui si guarda un impianto.
///
/// Il tratteggio scorre. Non e' un vezzo: una freccia direbbe la stessa cosa
/// una volta sola, mentre il movimento dice **adesso**, e distingue un impianto
/// che sta lavorando da uno fermo senza doverci leggere sopra un numero.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../plancia/energia.dart';
import '../../plancia/numeri.dart';
import '../../vestito/oggetti.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

/// Dove sta ogni cerchio, in frazioni del riquadro. Sono le stesse della
/// plancia sul telefono.
const _posti = <String, (double, double)>{
  'solare': (0.50, 0.15),
  'rete': (0.20, 0.28),
  'batteria': (0.73, 0.28),
  'casa': (0.50, 0.46),
};

/// I posti dei carichi, nell'ordine in cui si riempiono.
const _postiDeiCarichi = <(double, double)>[
  (0.20, 0.68),
  (0.50, 0.68),
  (0.80, 0.68),
  (0.35, 0.84),
  (0.65, 0.84),
];

/// Quanto sono grandi i cerchi.
const _latoGrande = 96.0;
const _latoDellaCasa = 122.0;
const _latoDelCarico = 84.0;

/// Quanto e' alto il riquadro del disegno.
const double altezzaDelFlusso = 720;

class FlussoDisegnato extends StatefulWidget {
  const FlussoDisegnato(this.flusso, {super.key});

  final FlussoDellEnergia flusso;

  @override
  State<FlussoDisegnato> createState() => _FlussoDisegnatoState();
}

class _FlussoDisegnatoState extends State<FlussoDisegnato>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scorre = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    _guardaSeDeveMuoversi();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _guardaSeDeveMuoversi();
  }

  /* Chi ha chiesto meno movimento non lo vuole nemmeno qui. E le prove non
   * finiscono mai di assestarsi finche' qualcosa gira. */
  void _guardaSeDeveMuoversi() {
    if (MediaQuery.disableAnimationsOf(context)) {
      _scorre.stop();
    } else if (!_scorre.isAnimating) {
      _scorre.repeat();
    }
  }

  @override
  void dispose() {
    _scorre.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final flusso = widget.flusso;
    final colori = Theme.of(context).colorScheme;
    return Container(
      height: altezzaDelFlusso,
      decoration: BoxDecoration(
        color: colori.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: colori.outlineVariant),
        boxShadow: Scheda.ombra(context),
      ),
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(
        builder: (context, spazio) {
          final larghezza = spazio.maxWidth;
          final altezza = spazio.maxHeight;
          Offset dove(String chiave) {
            final posto = _posti[chiave]!;
            return Offset(posto.$1 * larghezza, posto.$2 * altezza);
          }

          final centri = <String, Offset>{
            for (final chiave in _posti.keys) chiave: dove(chiave),
            for (final (posto, carico) in flusso.carichi.indexed)
              carico.chiave: Offset(
                _postiDeiCarichi[posto].$1 * larghezza,
                _postiDeiCarichi[posto].$2 * altezza,
              ),
          };

          return Stack(
            children: [
              Positioned.fill(
                child: AnimatedBuilder(
                  animation: _scorre,
                  builder: (context, _) => CustomPaint(
                    painter: _LeLinee(
                      flusso: flusso,
                      centri: centri,
                      quanto: _scorre.value,
                      spenta: colori.outlineVariant,
                    ),
                  ),
                ),
              ),
              for (final nodo in [
                flusso.solare,
                flusso.rete,
                flusso.batteria,
                flusso.casa,
                ...flusso.carichi,
              ])
                _mettiIlCerchio(nodo, centri[nodo.chiave]!, flusso),
            ],
          );
        },
      ),
    );
  }

  Widget _mettiIlCerchio(
    NodoDelFlusso nodo,
    Offset centro,
    FlussoDellEnergia flusso,
  ) {
    final lato = nodo.chiave == 'casa'
        ? _latoDellaCasa
        : _posti.containsKey(nodo.chiave)
        ? _latoGrande
        : _latoDelCarico;
    return Positioned(
      left: centro.dx - lato / 2,
      top: centro.dy - lato / 2,
      child: _Cerchio(nodo: nodo, lato: lato),
    );
  }
}

/// Un cerchio del flusso.
class _Cerchio extends StatelessWidget {
  const _Cerchio({required this.nodo, required this.lato});

  final NodoDelFlusso nodo;
  final double lato;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final tinta = coloreDaTesto(nodo.colore);
    final grande = lato >= _latoGrande;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      width: lato,
      height: lato,
      decoration: BoxDecoration(
        color: colori.surfaceContainerLowest,
        shape: BoxShape.circle,
        border: Border.all(color: tinta, width: grande ? 4 : 3),
        boxShadow: [
          BoxShadow(
            color: tinta.withValues(alpha: nodo.acceso ? 0.35 : 0.10),
            blurRadius: nodo.acceso ? 26 : 12,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            nodo.nome.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 8.5,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.2,
              height: 1.1,
              color: colori.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 1),
          Oggetto(nodo.disegno, lato: grande ? 19 : 17),
          const SizedBox(height: 1),
          _IlNumero(nodo: nodo),
          if (nodo.sotto.isNotEmpty)
            Text(
              nodo.sotto,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                height: 1.2,
                color: colori.onSurfaceVariant,
              ),
            ),
        ],
      ),
    );
  }
}

/// Il numero dentro un cerchio: uno, o due dove uno solo nasconderebbe meta'
/// della storia.
class _IlNumero extends StatelessWidget {
  const _IlNumero({required this.nodo});

  final NodoDelFlusso nodo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    if (nodo.valore == null && nodo.secondo == null) {
      return Text(
        '—',
        style: carattereDelNumero(corpo: 14, colore: colori.onSurfaceVariant),
      );
    }
    if (nodo.secondo != null) {
      final tinta = coloreDaTesto(nodo.colore);
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Riga(
            segno: '↓',
            quanto: nodo.valore,
            unita: nodo.unita,
            tinta: tinta,
          ),
          _Riga(
            segno: '↑',
            quanto: nodo.secondo,
            unita: nodo.unitaDelSecondo,
            tinta: tinta,
          ),
        ],
      );
    }
    return Text(
      '${numero(nodo.valore, cifre: nodo.unita == 'W' ? 0 : 1)} ${nodo.unita}',
      maxLines: 1,
      style: carattereDelNumero(
        corpo: 15,
        peso: FontWeight.w700,
        colore: colori.onSurface,
      ),
    );
  }
}

class _Riga extends StatelessWidget {
  const _Riga({
    required this.segno,
    required this.quanto,
    required this.unita,
    required this.tinta,
  });

  final String segno;
  final num? quanto;
  final String unita;
  final Color tinta;

  @override
  Widget build(BuildContext context) {
    return Text(
      '$segno ${numero(quanto, cifre: 1)}',
      maxLines: 1,
      style: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w800,
        height: 1.25,
        color: tinta,
      ),
    );
  }
}

/// Le linee fra un cerchio e l'altro.
class _LeLinee extends CustomPainter {
  _LeLinee({
    required this.flusso,
    required this.centri,
    required this.quanto,
    required this.spenta,
  });

  final FlussoDellEnergia flusso;
  final Map<String, Offset> centri;
  final double quanto;
  final Color spenta;

  @override
  void paint(Canvas tela, Size misura) {
    final casa = centri['casa']!;
    final sole = centri['solare']!;
    final rete = centri['rete']!;
    final batteria = centri['batteria']!;

    /* Chi manda a chi. Il segno della rete e della batteria dice il verso:
     * rete positiva vuol dire che si sta prelevando, batteria positiva che si
     * sta caricando. */
    final valoreDellaRete = flusso.rete.valore ?? 0;
    final valoreDellaBatteria = flusso.batteria.valore ?? 0;
    final adesso = flusso.periodo == PeriodoDellEnergia.adesso;
    final sole0 = (flusso.solare.valore ?? 0) > 0;

    void linea(
      Offset da,
      Offset a,
      Offset? piega,
      String colore, {
      required bool accesa,
    }) => _tratteggia(tela, da, a, piega, coloreDaTesto(colore), accesa);

    linea(sole, casa, null, flusso.solare.colore, accesa: sole0);
    linea(
      rete,
      casa,
      Offset(casa.dx, rete.dy),
      flusso.rete.colore,
      accesa: adesso ? valoreDellaRete > 0 : flusso.rete.acceso,
    );
    linea(
      batteria,
      casa,
      Offset(casa.dx, batteria.dy),
      flusso.batteria.colore,
      accesa: adesso ? valoreDellaBatteria < 0 : flusso.batteria.acceso,
    );
    linea(
      sole,
      rete,
      Offset(rete.dx, sole.dy),
      flusso.solare.colore,
      accesa: adesso && valoreDellaRete < 0,
    );
    linea(
      sole,
      batteria,
      Offset(batteria.dx, sole.dy),
      flusso.solare.colore,
      accesa: adesso && valoreDellaBatteria > 0,
    );
    for (final carico in flusso.carichi) {
      final dove = centri[carico.chiave];
      if (dove == null) continue;
      linea(
        casa,
        dove,
        Offset(dove.dx, casa.dy),
        carico.colore,
        accesa: carico.acceso,
      );
    }
  }

  void _tratteggia(
    Canvas tela,
    Offset da,
    Offset a,
    Offset? piega,
    Color tinta,
    bool accesa,
  ) {
    final strada = Path()..moveTo(da.dx, da.dy);
    if (piega == null) {
      strada.lineTo(a.dx, a.dy);
    } else {
      strada.quadraticBezierTo(piega.dx, piega.dy, a.dx, a.dy);
    }
    final penna = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = accesa ? 6 : 4
      ..color = accesa ? tinta : spenta;

    /* Il tratteggio si disegna a mano, un pezzo alla volta: Flutter la linea
     * tratteggiata non ce l'ha, e girare la fase e' proprio quello che fa
     * scorrere. */
    const passo = 20.0;
    final scarto = (quanto * passo) % passo;
    for (final pezzo in strada.computeMetrics()) {
      for (var da0 = -passo + scarto; da0 < pezzo.length; da0 += passo) {
        final inizio = math.max(0.0, da0);
        final fine = math.min(pezzo.length, da0 + passo / 2);
        if (fine <= inizio) continue;
        tela.drawPath(pezzo.extractPath(inizio, fine), penna);
      }
    }
  }

  @override
  bool shouldRepaint(_LeLinee vecchio) =>
      vecchio.quanto != quanto || vecchio.flusso != flusso;
}
