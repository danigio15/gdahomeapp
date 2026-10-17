/// La scheda delle notifiche elaborate, disegnata sul telefono.
///
/// La casa manda i numeri — il ciclo della lavatrice, la giornata del sole,
/// l'UPS, l'antifurto — e il disegno lo fa l'app, qui: niente immagini da
/// scaricare, niente server che le prepari. Il risultato e' un PNG che Android
/// mette sotto la notifica (lo stile «grande foto») e che, ad app aperta,
/// l'iPhone allega. Ad app chiusa sull'iPhone lo stesso disegno lo fa
/// l'estensione (`ios/NotificheService/LaScheda.swift`), con le stesse
/// misure e gli stessi colori.
///
/// Le misure sono quelle di Android: due a uno, piu' larga che alta, che e' la
/// forma che la tendina mostra senza tagliare. Si disegna su 360×180 punti, e
/// si stampa tre volte piu' fitto.
///
/// Solo `dart:ui`, senza widget: gira anche nel servizio che Android sveglia
/// ad app chiusa, dove non c'e' nessuno schermo. Se qualcosa non va — un
/// numero che manca, un disegno che non si carica — torna `null`, e la
/// notifica arriva semplice: mai una notifica persa per un disegno.
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:flutter/painting.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_svg/flutter_svg.dart';

import '../parole.dart';

const double larghezzaDellaScheda = 360;
const double altezzaDellaScheda = 180;
const double _fitto = 3;

/// Quello che la notifica si porta: la scheda grande e l'icona piccola.
class DisegnoDellaNotifica {
  const DisegnoDellaNotifica({this.grande, this.icona});

  /// La scheda, o la foto: PNG o JPEG.
  final Uint8List? grande;

  /// L'icona a destra, quadrata: PNG.
  final Uint8List? icona;

  bool get vuoto => grande == null && icona == null;
}

/// Il disegno di una notifica elaborata: dalla scheda, e dalla foto se c'e'.
/// Non solleva mai.
Future<DisegnoDellaNotifica> disegnaLaNotifica({
  Map<String, dynamic>? scheda,
  Uint8List? foto,
  Duration attesa = const Duration(seconds: 4),
}) async {
  try {
    return await _disegna(scheda, foto).timeout(attesa);
  } catch (_) {
    return const DisegnoDellaNotifica();
  }
}

Future<DisegnoDellaNotifica> _disegna(
  Map<String, dynamic>? scheda,
  Uint8List? foto,
) async {
  final tipo = scheda?['t'];
  if (foto != null) {
    final grande = await _laFoto(foto, scheda);
    final icona = await _laFotoPiccola(foto);
    return DisegnoDellaNotifica(grande: grande ?? foto, icona: icona);
  }
  if (scheda == null) return const DisegnoDellaNotifica();
  final disegno = switch (tipo) {
    'ciclo' => 'elettrodomestici',
    'giornata' => scheda['pk'] == null ? 'energia' : 'solare',
    'ups' => 'ups',
    'antifurto' => 'sicurezza',
    'movimento' => 'telecamere',
    _ => null,
  };
  if (disegno == null) return const DisegnoDellaNotifica();
  final svg = await _ilDisegno(disegno);
  final grande = await _stampa(larghezzaDellaScheda, altezzaDellaScheda, (
    tela,
  ) {
    switch (tipo) {
      case 'ciclo':
        _ilCiclo(tela, scheda, svg);
      case 'giornata':
        _laGiornata(tela, scheda, svg);
      case 'ups':
        _lUps(tela, scheda, svg);
      case 'antifurto':
        _lAntifurto(tela, scheda, svg);
      case 'movimento':
        _ilMovimentoSenzaFoto(tela, scheda, svg);
    }
  });
  final icona = await _stampa(48, 48, (tela) {
    _fondo(
      tela,
      const Rect.fromLTWH(0, 0, 48, 48),
      tipo == 'antifurto' ? _rosso : _blu,
      raggio: 12,
    );
    if (svg != null) _metti(tela, svg, const Rect.fromLTWH(8, 8, 32, 32));
  });
  return DisegnoDellaNotifica(grande: grande, icona: icona);
}

/* ─── i colori ─────────────────────────────────────────────────────────── */

const _blu = [Color(0xFF1E3A5F), Color(0xFF0F172A)];
const _sole = [Color(0xFF7C4A03), Color(0xFF2A1A05), Color(0xFF0F172A)];
const _rosso = [Color(0xFF7F1D1D), Color(0xFF2A0A0A)];
const _chiaro = Color(0xFFE2E8F0);
const _spento = Color(0xFF94A3B8);
const _giallo = Color(0xFFFBBF24);
const _gialloChiaro = Color(0xFFFDE68A);
const _arancio = Color(0xFFF59E0B);
const _grigio = Color(0xFF64748B);
const _verde = Color(0xFF22C55E);
const _verdeChiaro = Color(0xFF86EFAC);
const _azzurro = Color(0xFF38BDF8);
const _rossoVivo = Color(0xFFEF4444);
const _vetro = Color(0x14FFFFFF);
const _bianco = Color(0xFFFFFFFF);

/* ─── i numeri come si dicono ──────────────────────────────────────────── */

double? _numero(Object? cosa) => cosa is num ? cosa.toDouble() : null;

String _decimali(double valore, int quanti) {
  final testo = valore.toStringAsFixed(quanti);
  return inLingua(it: testo.replaceAll('.', ','), en: testo);
}

String _euro(double valore) =>
    inLingua(it: '${_decimali(valore, 2)} €', en: '€${_decimali(valore, 2)}');

String _kwh(double valore) => '${_decimali(valore, valore >= 10 ? 1 : 2)} kWh';

String _percento(double quota) => '${(quota * 100).round()}%';

String _durata(int minuti) {
  if (minuti < 60) return '$minuti min';
  final resto = minuti % 60;
  return resto == 0 ? '${minuti ~/ 60} h' : '${minuti ~/ 60} h $resto min';
}

List<double> _serie(Object? cosa) => [
  if (cosa is List)
    for (final uno in cosa) _numero(uno) ?? 0,
];

/* ─── gli attrezzi ─────────────────────────────────────────────────────── */

Future<PictureInfo?> _ilDisegno(String nome) async {
  try {
    return await vg.loadPicture(
      SvgAssetLoader('assets/oggetti/$nome.svg', assetBundle: rootBundle),
      null,
    );
  } catch (_) {
    return null;
  }
}

void _metti(Canvas tela, PictureInfo svg, Rect dove) {
  final lato = math.max(svg.size.width, svg.size.height);
  if (lato <= 0) return;
  tela.save();
  tela.translate(dove.left, dove.top);
  tela.scale(dove.width / lato, dove.height / lato);
  tela.drawPicture(svg.picture);
  tela.restore();
}

Future<Uint8List?> _stampa(
  double larga,
  double alta,
  void Function(Canvas tela) disegna,
) async {
  final registro = ui.PictureRecorder();
  final tela = Canvas(registro);
  tela.scale(_fitto);
  disegna(tela);
  final quadro = registro.endRecording();
  final immagine = await quadro.toImage(
    (larga * _fitto).round(),
    (alta * _fitto).round(),
  );
  try {
    final byte = await immagine.toByteData(format: ui.ImageByteFormat.png);
    return byte?.buffer.asUint8List();
  } finally {
    immagine.dispose();
    quadro.dispose();
  }
}

void _fondo(Canvas tela, Rect dove, List<Color> colori, {double raggio = 18}) {
  tela.drawRRect(
    RRect.fromRectAndRadius(dove, Radius.circular(raggio)),
    Paint()
      ..shader = ui.Gradient.radial(
        dove.topLeft,
        dove.longestSide * 1.1,
        colori,
        colori.length == 3 ? const [0, 0.45, 0.9] : const [0, 0.7],
      ),
  );
}

/// I testi che, anche rimpiccioliti, non ci stavano: per le prove, che
/// controllano che nessuna scheda tagli niente (`elaborate_test.dart`).
@visibleForTesting
final List<String> testiTagliati = [];

/// Un testo misurato per stare in [larghezza]: se non ci sta, si
/// rimpicciolisce mezzo punto alla volta fino ai sette decimi; solo se
/// nemmeno cosi' ci sta, si taglia coi puntini — e si annota.
TextPainter _misurato(
  String testo,
  TextStyle stile,
  double larghezza, {
  int righe = 1,
  TextAlign allinea = TextAlign.left,
}) {
  final corpo = stile.fontSize ?? 12;
  var adesso = corpo;
  while (true) {
    final scritto = TextPainter(
      text: TextSpan(
        text: testo,
        style: stile.copyWith(fontSize: adesso),
      ),
      textAlign: allinea,
      textDirection: TextDirection.ltr,
      maxLines: righe,
      ellipsis: '…',
    )..layout(maxWidth: math.max(larghezza, 1));
    if (!scritto.didExceedMaxLines) return scritto;
    if (adesso - 0.5 < corpo * 0.7) {
      testiTagliati.add(testo);
      return scritto;
    }
    scritto.dispose();
    adesso -= 0.5;
  }
}

/// Scrive un testo. Torna la sua misura, per mettere il resto accanto.
Size _scrivi(
  Canvas tela,
  String testo,
  Offset dove, {
  double corpo = 12,
  FontWeight peso = FontWeight.w600,
  Color colore = _chiaro,
  bool titolo = false,
  double larghezza = 320,
  TextAlign allinea = TextAlign.left,
  double spaziatura = 0,
  int righe = 1,
}) {
  final scritto = _misurato(
    testo,
    TextStyle(
      fontFamily: titolo ? 'Oswald' : 'Inter',
      fontSize: corpo,
      fontWeight: peso,
      color: colore,
      letterSpacing: spaziatura,
      height: 1.15,
    ),
    larghezza,
    righe: righe,
    allinea: allinea,
  );
  final x = switch (allinea) {
    TextAlign.right => dove.dx - scritto.width,
    TextAlign.center => dove.dx - scritto.width / 2,
    _ => dove.dx,
  };
  scritto.paint(tela, Offset(x, dove.dy));
  final misura = scritto.size;
  scritto.dispose();
  return misura;
}

/// Una pillola: un quadratino colorato e una scritta, su vetro.
double _pillola(
  Canvas tela,
  Offset dove,
  Color colore,
  String testo, {
  double finoA = 346,
}) {
  final scritto = _misurato(
    testo,
    const TextStyle(
      fontFamily: 'Inter',
      fontSize: 9.5,
      fontWeight: FontWeight.w800,
      color: _chiaro,
    ),
    finoA - dove.dx - 26,
  );
  final larga = scritto.width + 26;
  tela.drawRRect(
    RRect.fromRectAndRadius(
      Rect.fromLTWH(dove.dx, dove.dy, larga, 19),
      const Radius.circular(10),
    ),
    Paint()..color = _vetro,
  );
  tela.drawRRect(
    RRect.fromRectAndRadius(
      Rect.fromLTWH(dove.dx + 8, dove.dy + 6, 7, 7),
      const Radius.circular(2),
    ),
    Paint()..color = colore,
  );
  scritto.paint(tela, Offset(dove.dx + 19, dove.dy + 4));
  scritto.dispose();
  return larga;
}

/// La testa di ogni scheda: il disegno, il titolo in maiuscolo, la riga
/// sotto.
void _testa(
  Canvas tela,
  PictureInfo? svg,
  String titolo,
  String sotto, {
  double finoA = 230,
}) {
  if (svg != null) _metti(tela, svg, const Rect.fromLTWH(14, 12, 30, 30));
  _scrivi(
    tela,
    titolo.toUpperCase(),
    const Offset(52, 10),
    corpo: 17,
    peso: FontWeight.w700,
    colore: _bianco,
    titolo: true,
    larghezza: finoA - 52,
    spaziatura: 0.4,
  );
  _scrivi(
    tela,
    sotto,
    const Offset(52, 31),
    corpo: 9.5,
    colore: _spento,
    larghezza: finoA - 52,
  );
}

/// Una curva piena, sotto una serie di numeri.
Path _area(List<double> valori, Rect dove, double massimo) {
  final strada = Path()..moveTo(dove.left, dove.bottom);
  for (var i = 0; i < valori.length; i += 1) {
    final x =
        dove.left +
        (valori.length == 1 ? 0 : i * dove.width / (valori.length - 1));
    final y =
        dove.bottom - (valori[i].clamp(0, massimo) / massimo) * dove.height;
    strada.lineTo(x, y);
  }
  strada
    ..lineTo(dove.right, dove.bottom)
    ..close();
  return strada;
}

Path _linea(List<double> valori, Rect dove, double massimo) {
  final strada = Path();
  for (var i = 0; i < valori.length; i += 1) {
    final x =
        dove.left +
        (valori.length == 1 ? 0 : i * dove.width / (valori.length - 1));
    final y =
        dove.bottom - (valori[i].clamp(0, massimo) / massimo) * dove.height;
    if (i == 0) {
      strada.moveTo(x, y);
    } else {
      strada.lineTo(x, y);
    }
  }
  return strada;
}

void _ciambella(Canvas tela, Offset centro, double raggio, double quota) {
  tela.drawCircle(
    centro,
    raggio,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7
      ..color = const Color(0x1FFFFFFF),
  );
  tela.drawArc(
    Rect.fromCircle(center: centro, radius: raggio),
    -math.pi / 2,
    2 * math.pi * quota.clamp(0, 1),
    false,
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7
      ..strokeCap = StrokeCap.round
      ..color = _giallo,
  );
  _scrivi(
    tela,
    _percento(quota),
    Offset(centro.dx, centro.dy - 9),
    corpo: 14,
    peso: FontWeight.w700,
    colore: _gialloChiaro,
    titolo: true,
    allinea: TextAlign.center,
    larghezza: raggio * 2,
  );
}

/* ─── il ciclo di un elettrodomestico ──────────────────────────────────── */

void _ilCiclo(Canvas tela, Map<String, dynamic> s, PictureInfo? svg) {
  _fondo(tela, const Rect.fromLTWH(0, 0, 360, 180), _blu);
  final minuti = _numero(s['min'])?.round();
  final orari = [
    if (s['da'] is String && s['a'] is String) '${s['da']} → ${s['a']}',
    if (minuti != null) _durata(minuti),
  ].join(' · ');
  _testa(tela, svg, '${s['n'] ?? ''}', orari, finoA: 250);
  final euro = _numero(s['eur']);
  final kwh = _numero(s['kwh']);
  if (euro != null) {
    _scrivi(
      tela,
      euro == 0 ? inLingua(it: 'GRATIS', en: 'FREE') : _euro(euro),
      const Offset(346, 6),
      corpo: 26,
      peso: FontWeight.w700,
      colore: _gialloChiaro,
      titolo: true,
      allinea: TextAlign.right,
      larghezza: 110,
    );
  }
  if (kwh != null) {
    _scrivi(
      tela,
      _kwh(kwh),
      const Offset(346, 38),
      corpo: 9.5,
      peso: FontWeight.w700,
      colore: _spento,
      allinea: TextAlign.right,
      larghezza: 110,
    );
  }
  // La curva: in grigio quello che ha preso, in giallo quello che era sole.
  // A destra la ciambella; sotto, a tutta larghezza, le pillole: cosi' i
  // numeri lunghi — «12,34 kWh», «10,25 €» — ci stanno interi.
  final watt = _serie(s['w']);
  final sole = _serie(s['s']);
  const grafico = Rect.fromLTWH(14, 56, 236, 70);
  if (watt.length > 1) {
    final massimo = math.max(watt.reduce(math.max), 1.0) * 1.08;
    final dalSole = [
      for (var i = 0; i < watt.length; i += 1)
        i < sole.length ? math.min(watt[i], sole[i]) : 0.0,
    ];
    tela.drawLine(
      grafico.bottomLeft,
      grafico.bottomRight,
      Paint()..color = const Color(0x22FFFFFF),
    );
    tela.drawPath(
      _area(watt, grafico, massimo),
      Paint()..color = _grigio.withValues(alpha: 0.6),
    );
    tela.drawPath(
      _area(dalSole, grafico, massimo),
      Paint()
        ..shader = ui.Gradient.linear(grafico.topCenter, grafico.bottomCenter, [
          _giallo,
          _arancio.withValues(alpha: 0.6),
        ]),
    );
    tela.drawPath(
      _linea(watt, grafico, massimo),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.3
        ..color = _chiaro.withValues(alpha: 0.8),
    );
  }
  const sottoIlGrafico = 129.0;
  if (s['da'] is String) {
    _scrivi(
      tela,
      '${s['da']}',
      Offset(grafico.left, sottoIlGrafico),
      corpo: 8,
      colore: _spento,
      larghezza: 50,
    );
  }
  if (s['a'] is String) {
    _scrivi(
      tela,
      '${s['a']}',
      Offset(grafico.right, sottoIlGrafico),
      corpo: 8,
      colore: _spento,
      allinea: TextAlign.right,
      larghezza: 50,
    );
  }
  final quota = _numero(s['sole']);
  final batteria = _numero(s['batt']) ?? 0;
  final senza = _numero(s['senza']);
  if (senza != null && quota != null && quota > 0) {
    _scrivi(
      tela,
      inLingua(
        it: 'senza sole ${_euro(senza)}',
        en: 'without sun ${_euro(senza)}',
      ),
      Offset(grafico.center.dx, sottoIlGrafico),
      corpo: 8,
      peso: FontWeight.w700,
      colore: _gialloChiaro,
      allinea: TextAlign.center,
      larghezza: 120,
    );
  }
  if (quota != null) _ciambella(tela, const Offset(300, 92), 24, quota);
  // Le pillole, in fila sotto: quanto era sole, batteria, rete.
  final reteKwh = _numero(s['rkwh']);
  final reteEuro = _numero(s['reur']);
  final kwhDalSole = kwh != null && quota != null ? kwh * quota : null;
  final pillole = [
    if (kwhDalSole != null && kwhDalSole > 0)
      (
        _giallo,
        inLingua(
          it: 'Sole ${_kwh(kwhDalSole)} · gratis',
          en: 'Sun ${_kwh(kwhDalSole)} · free',
        ),
      ),
    if (batteria > 0)
      (
        _verde,
        inLingua(
          it: 'Batteria ${_percento(batteria)}',
          en: 'Battery ${_percento(batteria)}',
        ),
      ),
    if (reteKwh != null && reteKwh > 0)
      (
        _grigio,
        inLingua(
          it:
              'Rete ${_kwh(reteKwh)}'
              '${reteEuro == null ? '' : ' · ${_euro(reteEuro)}'}',
          en:
              'Grid ${_kwh(reteKwh)}'
              '${reteEuro == null ? '' : ' · ${_euro(reteEuro)}'}',
        ),
      ),
  ];
  var x = 14.0;
  for (final (i, (colore, testo)) in pillole.indexed) {
    // Lo spazio che resta si divide fra le pillole che mancano: nessuna
    // si prende tutto e lascia le altre senza posto.
    final restano = pillole.length - i;
    final finoA = x + (346 - x - 8 * (restano - 1)) / restano;
    x +=
        _pillola(
          tela,
          Offset(x, 148),
          colore,
          testo,
          finoA: restano == 1 ? 346 : math.max(finoA, x + 60),
        ) +
        8;
  }
}

/* ─── la giornata (il riepilogo della sera) ────────────────────────────── */

void _laGiornata(Canvas tela, Map<String, dynamic> s, PictureInfo? svg) {
  final conSole = _numero(s['pk']) != null;
  _fondo(tela, const Rect.fromLTWH(0, 0, 360, 180), conSole ? _sole : _blu);
  final data = DateTime.tryParse('${s['d'] ?? ''}');
  _testa(
    tela,
    svg,
    inLingua(it: 'La tua giornata', en: 'Your day'),
    data == null ? '' : _giorno(data),
    finoA: 220,
  );
  final record = s['rec'];
  if (record is String && record.isNotEmpty) {
    final scritto = TextPainter(
      text: const TextSpan(
        text: 'RECORD',
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 9,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.8,
          color: Color(0xFF422006),
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final pillola = Rect.fromLTWH(
      346 - scritto.width - 18,
      12,
      scritto.width + 18,
      17,
    );
    tela.drawRRect(
      RRect.fromRectAndRadius(pillola, const Radius.circular(9)),
      Paint()
        ..shader = ui.Gradient.linear(pillola.topLeft, pillola.bottomRight, [
          _gialloChiaro,
          _arancio,
        ]),
    );
    scritto.paint(tela, Offset(pillola.left + 9, pillola.top + 3.5));
    scritto.dispose();
    _scrivi(
      tela,
      inLingua(
        it: 'il giorno più solare di $record',
        en: 'sunniest day of $record',
      ),
      const Offset(346, 32),
      corpo: 8,
      peso: FontWeight.w700,
      colore: _gialloChiaro,
      allinea: TextAlign.right,
      larghezza: 140,
    );
  }
  // A sinistra tre numeri.
  final tessere = conSole
      ? [
          (
            inLingua(it: 'DAL SOLE', en: 'FROM SUN'),
            _kwh(_numero(s['pk'])!),
            _gialloChiaro,
          ),
          if (_numero(s['casa']) case final casa?)
            (inLingua(it: 'IN CASA', en: 'AT HOME'), _percento(casa), _bianco),
          if (_numero(s['ris']) case final risparmio?)
            (
              inLingua(it: 'RISPARMIATI', en: 'SAVED'),
              _euro(risparmio),
              _verdeChiaro,
            ),
        ]
      : [
          if (_numero(s['rk']) case final rete?)
            (inLingua(it: 'CONSUMO', en: 'USED'), _kwh(rete), _bianco),
          if (_numero(s['re']) case final euro?)
            (inLingua(it: 'COSTO', en: 'COST'), _euro(euro), _gialloChiaro),
        ];
  for (final (i, (etichetta, valore, colore)) in tessere.indexed) {
    final riquadro = Rect.fromLTWH(14, 50 + i * 41.0, 96, 36);
    tela.drawRRect(
      RRect.fromRectAndRadius(riquadro, const Radius.circular(10)),
      Paint()..color = const Color(0x10FFFFFF),
    );
    _scrivi(
      tela,
      etichetta,
      riquadro.topLeft + const Offset(8, 5),
      corpo: 7,
      peso: FontWeight.w800,
      colore: _spento,
      larghezza: 84,
      spaziatura: 0.5,
    );
    _scrivi(
      tela,
      valore,
      riquadro.topLeft + const Offset(8, 15),
      corpo: 15,
      peso: FontWeight.w700,
      colore: colore,
      titolo: true,
      larghezza: 84,
    );
  }
  // A destra il grafico: la produzione, il sole usato, il consumo.
  final prodotta = [for (final uno in _serie(s['p'])) uno / 10];
  final consumata = [for (final uno in _serie(s['c'])) uno / 10];
  const grafico = Rect.fromLTWH(122, 54, 224, 82);
  final tutti = [...prodotta, ...consumata];
  if (tutti.isNotEmpty) {
    final massimo = math.max(tutti.reduce(math.max), 0.5) * 1.1;
    tela.drawLine(
      grafico.bottomLeft,
      grafico.bottomRight,
      Paint()..color = const Color(0x22FFFFFF),
    );
    if (prodotta.length > 1) {
      tela.drawPath(
        _area(prodotta, grafico, massimo),
        Paint()
          ..shader = ui.Gradient.linear(
            grafico.topCenter,
            grafico.bottomCenter,
            [_gialloChiaro, _arancio.withValues(alpha: 0.25)],
          ),
      );
      final usata = [
        for (var i = 0; i < prodotta.length; i += 1)
          i < consumata.length ? math.min(prodotta[i], consumata[i]) : 0.0,
      ];
      tela.drawPath(_area(usata, grafico, massimo), Paint()..color = _arancio);
    }
    if (consumata.length > 1) {
      tela.drawPath(
        _linea(consumata, grafico, massimo),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.8
          ..strokeJoin = StrokeJoin.round
          ..color = _azzurro,
      );
    }
    final picco = _numero(s['pkw']);
    if (picco != null && prodotta.length > 1) {
      final dove = prodotta.indexOf(prodotta.reduce(math.max));
      final x = grafico.left + dove * grafico.width / (prodotta.length - 1);
      final y = grafico.bottom - (prodotta[dove] / massimo) * grafico.height;
      tela.drawCircle(Offset(x, y), 3, Paint()..color = _bianco);
      tela.drawCircle(
        Offset(x, y),
        3,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..color = _arancio,
      );
      _scrivi(
        tela,
        '${_decimali(picco, 1)} kW${s['pora'] is String ? ' · ${s['pora']}' : ''}',
        Offset(x + 5, math.max(y - 12, grafico.top - 4)),
        corpo: 7.5,
        peso: FontWeight.w800,
        colore: _gialloChiaro,
        larghezza: 90,
      );
    }
    for (final ora in const [0, 6, 12, 18, 24]) {
      _scrivi(
        tela,
        '$ora',
        Offset(grafico.left + ora * grafico.width / 24, 138),
        corpo: 7,
        colore: _spento,
        allinea: TextAlign.center,
        larghezza: 20,
      );
    }
  }
  // Sotto: domani, ora per ora, e il consiglio.
  final meteo = s['met'];
  var x = 126.0;
  if (meteo is List) {
    for (final uno in meteo.take(6)) {
      if (uno is! List || uno.length < 2) continue;
      _ilTempo(tela, Offset(x + 6, 158), '${uno[1]}');
      _scrivi(
        tela,
        '${uno[0]}',
        Offset(x + 6, 166),
        corpo: 6.5,
        colore: _spento,
        allinea: TextAlign.center,
        larghezza: 20,
      );
      x += 20;
    }
  }
  final consiglio = s['cons'];
  if (consiglio is String && consiglio.isNotEmpty) {
    _scrivi(
      tela,
      '${inLingua(it: 'Domani', en: 'Tomorrow')}: $consiglio',
      Offset(x + 6, 154),
      corpo: 8,
      peso: FontWeight.w700,
      colore: _gialloChiaro,
      larghezza: 346 - x - 6,
      righe: 2,
    );
  }
  final batteria = _numero(s['batt']);
  if (batteria != null && consiglio == null) {
    _scrivi(
      tela,
      inLingua(
        it: 'Batteria di casa ${_percento(batteria)} per la notte',
        en: 'Home battery ${_percento(batteria)} for the night',
      ),
      Offset(x + 6, 158),
      corpo: 8,
      peso: FontWeight.w700,
      colore: _verdeChiaro,
      larghezza: 346 - x - 6,
    );
  }
}

String _giorno(DateTime data) {
  const giorniIt = [
    'lunedì',
    'martedì',
    'mercoledì',
    'giovedì',
    'venerdì',
    'sabato',
    'domenica',
  ];
  const mesiIt = [
    'gennaio',
    'febbraio',
    'marzo',
    'aprile',
    'maggio',
    'giugno',
    'luglio',
    'agosto',
    'settembre',
    'ottobre',
    'novembre',
    'dicembre',
  ];
  const giorniEn = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  const mesiEn = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return inLingua(
    it: '${giorniIt[data.weekday - 1]} ${data.day} ${mesiIt[data.month - 1]}',
    en: '${giorniEn[data.weekday - 1]} ${mesiEn[data.month - 1]} ${data.day}',
  );
}

/// Un tempo di domani, in piccolo: sole, poco nuvoloso, nuvole, pioggia.
void _ilTempo(Canvas tela, Offset centro, String com) {
  final sole = Paint()..color = _giallo;
  final nuvola = Paint()..color = const Color(0xFFCBD5E1);
  void laNuvola(Offset dove) {
    tela
      ..drawCircle(dove + const Offset(-2.5, 0.5), 2.6, nuvola)
      ..drawCircle(dove + const Offset(1.2, -0.8), 3.2, nuvola)
      ..drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(dove.dx - 5, dove.dy, 10, 3.2),
          const Radius.circular(1.6),
        ),
        nuvola,
      );
  }

  switch (com) {
    case 'sole':
      tela.drawCircle(centro, 3.6, sole);
    case 'poco':
      tela.drawCircle(centro + const Offset(-1.5, -1.5), 3, sole);
      laNuvola(centro + const Offset(1.5, 1));
    case 'pioggia':
      laNuvola(centro);
      final goccia = Paint()
        ..color = _azzurro
        ..strokeWidth = 1
        ..strokeCap = StrokeCap.round;
      for (final dx in const [-3.0, 0.0, 3.0]) {
        tela.drawLine(
          centro + Offset(dx, 4.2),
          centro + Offset(dx - 0.8, 6),
          goccia,
        );
      }
    default:
      laNuvola(centro);
  }
}

/* ─── l'UPS: manca la corrente ─────────────────────────────────────────── */

void _lUps(Canvas tela, Map<String, dynamic> s, PictureInfo? svg) {
  _fondo(tela, const Rect.fromLTWH(0, 0, 360, 180), _blu);
  final dalle = s['dalle'];
  _testa(
    tela,
    svg,
    '${s['n'] ?? inLingua(it: 'UPS di casa', en: 'Home UPS')}',
    dalle is String
        ? inLingua(it: 'a batteria dalle $dalle', en: 'on battery since $dalle')
        : inLingua(it: 'a batteria', en: 'on battery'),
    finoA: 240,
  );
  final minuti = _numero(s['min']);
  if (minuti != null) {
    _scrivi(
      tela,
      '~${minuti.round()} MIN',
      const Offset(346, 6),
      corpo: 26,
      peso: FontWeight.w700,
      colore: _gialloChiaro,
      titolo: true,
      allinea: TextAlign.right,
      larghezza: 120,
    );
    _scrivi(
      tela,
      inLingua(it: 'autonomia', en: 'runtime'),
      const Offset(346, 38),
      corpo: 9,
      peso: FontWeight.w700,
      colore: _spento,
      allinea: TextAlign.right,
      larghezza: 120,
    );
  }
  final carica = (_numero(s['car']) ?? 0).clamp(0.0, 1.0);
  const barra = Rect.fromLTWH(14, 66, 332, 14);
  tela.drawRRect(
    RRect.fromRectAndRadius(barra, const Radius.circular(7)),
    Paint()..color = _vetro,
  );
  final colore = carica >= 0.5
      ? _verde
      : carica >= 0.2
      ? _arancio
      : _rossoVivo;
  if (carica > 0) {
    final piena = Rect.fromLTWH(
      barra.left,
      barra.top,
      barra.width * carica,
      barra.height,
    );
    tela.drawRRect(
      RRect.fromRectAndRadius(piena, const Radius.circular(7)),
      Paint()
        ..shader = ui.Gradient.linear(piena.centerLeft, piena.centerRight, [
          colore,
          carica >= 0.5 ? _verdeChiaro : colore,
        ]),
    );
  }
  var x = 14.0;
  x +=
      _pillola(
        tela,
        Offset(x, 92),
        colore,
        inLingua(
          it: 'Carica ${_percento(carica)}',
          en: 'Charge ${_percento(carica)}',
        ),
      ) +
      8;
  if (_numero(s['w']) case final watt?) {
    _pillola(
      tela,
      Offset(x, 92),
      _arancio,
      inLingua(it: 'Carico ${watt.round()} W', en: 'Load ${watt.round()} W'),
    );
  }
  final accesi = s['acc'];
  if (accesi is List && accesi.isNotEmpty) {
    final riquadro = const Rect.fromLTWH(14, 124, 332, 40);
    tela.drawRRect(
      RRect.fromRectAndRadius(riquadro, const Radius.circular(10)),
      Paint()..color = const Color(0x0DFFFFFF),
    );
    _scrivi(
      tela,
      inLingua(
        it: 'Restano accesi: ${accesi.join(', ')}',
        en: 'Still on: ${accesi.join(', ')}',
      ),
      riquadro.topLeft + const Offset(10, 8),
      corpo: 10,
      peso: FontWeight.w700,
      colore: const Color(0xFFCBD5E1),
      larghezza: riquadro.width - 20,
      righe: 2,
    );
  }
}

/* ─── l'antifurto scattato ─────────────────────────────────────────────── */

void _lAntifurto(Canvas tela, Map<String, dynamic> s, PictureInfo? svg) {
  _fondo(tela, const Rect.fromLTWH(0, 0, 360, 180), _rosso);
  tela.drawRRect(
    RRect.fromRectAndRadius(
      const Rect.fromLTWH(0.5, 0.5, 359, 179),
      const Radius.circular(18),
    ),
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = const Color(0x66EF4444),
  );
  final modo = s['modo'];
  final dalle = s['dalle'];
  _testa(
    tela,
    svg,
    inLingua(it: 'Antifurto scattato', en: 'Alarm triggered'),
    [
      if (modo is String && modo.isNotEmpty) modo,
      if (dalle is String)
        inLingua(it: 'inserito dalle $dalle', en: 'armed since $dalle'),
    ].join(' · '),
    finoA: 260,
  );
  if (s['sir'] == true) {
    const pillola = Rect.fromLTWH(282, 12, 64, 20);
    tela.drawRRect(
      RRect.fromRectAndRadius(pillola, const Radius.circular(10)),
      Paint()..color = const Color(0xFFDC2626),
    );
    tela.drawCircle(
      pillola.centerLeft + const Offset(10, 0),
      3,
      Paint()..color = _bianco,
    );
    _scrivi(
      tela,
      inLingua(it: 'SIRENA', en: 'SIREN'),
      pillola.topLeft + const Offset(17, 4.5),
      corpo: 9,
      peso: FontWeight.w900,
      colore: _bianco,
      spaziatura: 0.6,
      larghezza: 50,
    );
  }
  _scrivi(
    tela,
    inLingua(it: 'CHE COSA', en: 'WHAT'),
    const Offset(14, 52),
    corpo: 8,
    peso: FontWeight.w800,
    colore: const Color(0xFFFCA5A5),
    spaziatura: 0.8,
  );
  final zona = s['zona'];
  final ora = s['ora'];
  _scrivi(
    tela,
    [
      if (zona is String && zona.isNotEmpty) zona,
      if (ora is String) ora,
    ].join(' · '),
    const Offset(14, 64),
    corpo: 22,
    peso: FontWeight.w700,
    colore: _bianco,
    titolo: true,
    larghezza: 332,
  );
  final eventi = s['ev'];
  if (eventi is List) {
    var y = 104.0;
    for (final uno in eventi.take(3)) {
      if (uno is! List || uno.length < 2) continue;
      final colore = switch (uno.length > 2 ? uno[2] : '') {
        'r' => _rossoVivo,
        'a' => _arancio,
        'v' => _verde,
        _ => _spento,
      };
      _scrivi(
        tela,
        '${uno[0]}',
        Offset(14, y),
        corpo: 10,
        peso: FontWeight.w800,
        colore: _bianco,
        larghezza: 40,
      );
      tela.drawCircle(Offset(60, y + 6.5), 3.5, Paint()..color = colore);
      _scrivi(
        tela,
        '${uno[1]}',
        Offset(70, y),
        corpo: 10,
        peso: FontWeight.w700,
        colore: const Color(0xFFFECACA),
        larghezza: 276,
      );
      y += 20;
    }
  }
}

/* ─── il movimento ─────────────────────────────────────────────────────── */

void _ilMovimentoSenzaFoto(
  Canvas tela,
  Map<String, dynamic> s,
  PictureInfo? svg,
) {
  _fondo(tela, const Rect.fromLTWH(0, 0, 360, 180), _blu);
  if (svg != null) _metti(tela, svg, const Rect.fromLTWH(150, 34, 60, 60));
  _scrivi(
    tela,
    [
      if (s['cam'] is String) '${s['cam']}',
      if (s['ora'] is String) '${s['ora']}',
    ].join(' · '),
    const Offset(180, 112),
    corpo: 18,
    peso: FontWeight.w700,
    colore: _bianco,
    titolo: true,
    allinea: TextAlign.center,
    larghezza: 330,
  );
}

Future<ui.Image?> _leggiLaFoto(Uint8List byte) async {
  final codec = await ui.instantiateImageCodec(byte, targetWidth: 1080);
  try {
    final fotogramma = await codec.getNextFrame();
    return fotogramma.image;
  } finally {
    codec.dispose();
  }
}

/// La foto della telecamera, tagliata a due a uno, con dove e quando.
Future<Uint8List?> _laFoto(Uint8List byte, Map<String, dynamic>? scheda) async {
  final immagine = await _leggiLaFoto(byte);
  if (immagine == null) return null;
  try {
    final scritta = [
      if (scheda?['cam'] is String) '${scheda!['cam']}',
      if (scheda?['ora'] is String) '${scheda!['ora']}',
    ].join(' · ');
    return await _stampa(larghezzaDellaScheda, altezzaDellaScheda, (tela) {
      const tutto = Rect.fromLTWH(0, 0, 360, 180);
      tela.save();
      tela.clipRRect(RRect.fromRectAndRadius(tutto, const Radius.circular(18)));
      paintImage(
        canvas: tela,
        rect: tutto,
        image: immagine,
        fit: BoxFit.cover,
        filterQuality: FilterQuality.medium,
      );
      tela.restore();
      if (scritta.isEmpty) return;
      final scritto = _misurato(
        scritta,
        const TextStyle(
          fontFamily: 'Inter',
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
          color: _bianco,
        ),
        300,
      );
      final pillola = Rect.fromLTWH(10, 180 - 10 - 20, scritto.width + 26, 20);
      tela.drawRRect(
        RRect.fromRectAndRadius(pillola, const Radius.circular(7)),
        Paint()..color = const Color(0x99000000),
      );
      tela.drawCircle(
        pillola.centerLeft + const Offset(10, 0),
        3,
        Paint()..color = _bianco,
      );
      scritto.paint(tela, pillola.topLeft + const Offset(18, 4));
      scritto.dispose();
    });
  } finally {
    immagine.dispose();
  }
}

Future<Uint8List?> _laFotoPiccola(Uint8List byte) async {
  final immagine = await _leggiLaFoto(byte);
  if (immagine == null) return null;
  try {
    return await _stampa(48, 48, (tela) {
      const tutto = Rect.fromLTWH(0, 0, 48, 48);
      tela.clipRRect(RRect.fromRectAndRadius(tutto, const Radius.circular(10)));
      paintImage(
        canvas: tela,
        rect: tutto,
        image: immagine,
        fit: BoxFit.cover,
        filterQuality: FilterQuality.medium,
      );
    });
  } finally {
    immagine.dispose();
  }
}

/// Rende pubblico [_durata] per le prove.
@visibleForTesting
String durataDellaScheda(int minuti) => _durata(minuti);

/// Rende pubblico [_euro] per le prove.
@visibleForTesting
String euroDellaScheda(double valore) => _euro(valore);
