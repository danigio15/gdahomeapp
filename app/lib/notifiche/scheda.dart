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
import '../vestito/elettrodomestici.dart' show tipoDisegnabile;

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
    'ciclo' => disegnoDelCiclo(scheda),
    'giornata' => 'oggetti/${scheda['pk'] == null ? 'energia' : 'solare'}',
    'ups' => 'oggetti/ups',
    'antifurto' => 'oggetti/sicurezza',
    'movimento' => 'oggetti/telecamere',
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

/// Il disegno in testa alla scheda di un elettrodomestico che ha finito:
/// quello del suo tipo, lo stesso che ha sulla plancia
/// (`assets/elettrodomestici/`). Il tipo lo manda la casa (`i`); se non c'e',
/// o e' una parola di un ponte di prima, lo dice il nome (`n`). Prima era
/// sempre il cestello della sezione: la lavastoviglie finita aveva la faccia
/// della lavatrice.
@visibleForTesting
String disegnoDelCiclo(Map<String, dynamic> scheda) {
  final tipo = scheda['i'];
  return 'elettrodomestici/'
      '${tipoDisegnabile(tipo is String ? tipo : null, '${scheda['n'] ?? ''}')}';
}

/// [nome] e' la cartella e il file: `oggetti/ups`, `elettrodomestici/oven`.
Future<PictureInfo?> _ilDisegno(String nome) async {
  try {
    return await vg.loadPicture(
      SvgAssetLoader('assets/$nome.svg', assetBundle: rootBundle),
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

/* ─── la giornata (il riepilogo della sera) ────────────────────────────── *
 *
 * La griglia della scheda approvata (`report.png`): 540×270 nel disegno, qui
 * in punti della scheda (360×180, due terzi). Due colonne, 176 | il resto,
 * con venti di spazio; tre righe: 22 | il resto | 16, con dieci di spazio.
 *
 *  - in alto la data a sinistra e il record a destra, sulla stessa riga;
 *  - a sinistra il numero grande, e in fondo i due numeri divisi da una linea,
 *    che finiscono dove finisce la legenda;
 *  - a destra il grafico ora per ora, e sotto la sua legenda.
 *
 * Il meteo di domani e il consiglio non ci stanno piu': sono nel testo della
 * notifica, e nella pagina «La tua giornata». */

/// Le misure della griglia, in punti della scheda.
abstract final class _Griglia {
  static const k = 2 / 3;
  static const sinistra = 22 * k;
  static const destra = 360 - 20 * k;
  static const colonna = 176 * k;
  static const grafico = sinistra + colonna + 20 * k;
  static const riga1 = 18 * k;
  static const altezza1 = 22 * k;
  static const riga2 = riga1 + altezza1 + 10 * k;
  static const altezza2 = 180 * k;
  static const riga3 = riga2 + altezza2 + 10 * k;
  static const altezza3 = 16 * k;
  static const fondo = riga3 + altezza3;
}

const _usatoInCasa = Color(0xFFD97706);
const _marrone = Color(0xFF422006);
const _lineaSottile = Color(0x1AFFFFFF);
const _testoChiaro = Color(0xFFCBD5E1);

void _laGiornata(Canvas tela, Map<String, dynamic> s, PictureInfo? svg) {
  final dalSole = _numero(s['pk']);
  final conSole = dalSole != null;
  const tutto = Rect.fromLTWH(0, 0, 360, 180);
  final forma = RRect.fromRectAndRadius(
    tutto,
    const Radius.circular(22 * _Griglia.k),
  );
  tela.save();
  tela.clipRRect(forma);
  /* radial-gradient(120% 120% at 0% 0%): un'ellisse larga quanto la scheda
   * e alta quanto lei, schiacciata. */
  tela.save();
  tela.scale(1, 0.5);
  tela.drawRect(
    const Rect.fromLTWH(0, 0, 360, 360),
    Paint()
      ..shader = ui.Gradient.radial(
        Offset.zero,
        360 * 1.2,
        conSole
            ? const [Color(0xFF3A2507), Color(0xFF141B2E), Color(0xFF0B1222)]
            : const [Color(0xFF1E3A5F), Color(0xFF141B2E), Color(0xFF0B1222)],
        const [0, 0.45, 1],
      ),
  );
  tela.restore();
  tela.restore();
  tela.drawRRect(
    forma.deflate(0.35),
    Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.7
      ..color = const Color(0x12FFFFFF),
  );

  /* ── la prima riga: la data, il record ── */
  final record = s['rec'];
  var finoAllaData = _Griglia.destra;
  if (record is String && record.isNotEmpty) {
    finoAllaData = _ilRecord(tela, record) - 8;
  }
  final data = DateTime.tryParse('${s['d'] ?? ''}');
  if (data != null) {
    final scritta = _misurato(
      _giorno(data).toUpperCase(),
      const TextStyle(
        fontFamily: 'Inter',
        fontSize: 10.5 * _Griglia.k,
        fontWeight: FontWeight.w800,
        letterSpacing: 10.5 * _Griglia.k * 0.12,
        color: _spento,
      ),
      finoAllaData - _Griglia.sinistra,
    );
    scritta.paint(
      tela,
      Offset(
        _Griglia.sinistra,
        _Griglia.riga1 + (_Griglia.altezza1 - scritta.height) / 2,
      ),
    );
    scritta.dispose();
  }

  /* ── a sinistra: il numero grande ── */
  final grande = conSole ? dalSole : _numero(s['rk']);
  if (grande != null) {
    final unita = _misurato(
      'kWh',
      const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14 * _Griglia.k,
        fontWeight: FontWeight.w600,
        color: _chiaro,
      ),
      40,
    );
    final numero = _misurato(
      _decimali(grande, grande >= 100 ? 0 : 1),
      const TextStyle(
        fontFamily: 'Oswald',
        fontSize: 60 * _Griglia.k,
        fontWeight: FontWeight.w700,
        color: _gialloChiaro,
        height: 1,
      ),
      _Griglia.colonna - unita.width - 4,
    );
    /* line-height .9: la scatola del numero e' un decimo piu' bassa del
     * corpo, e il numero ci sta centrato. */
    final sopra = _Griglia.riga2 - 60 * _Griglia.k * 0.05;
    numero.paint(tela, Offset(_Griglia.sinistra, sopra));
    final base =
        sopra + numero.computeDistanceToActualBaseline(TextBaseline.alphabetic);
    unita.paint(
      tela,
      Offset(
        _Griglia.sinistra + numero.width + 4,
        base - unita.computeDistanceToActualBaseline(TextBaseline.alphabetic),
      ),
    );
    final sotto = _misurato(
      conSole
          ? inLingua(it: 'prodotti dal sole oggi', en: 'from the sun today')
          : inLingua(it: 'consumati oggi', en: 'used today'),
      const TextStyle(
        fontFamily: 'Inter',
        fontSize: 12.5 * _Griglia.k,
        fontWeight: FontWeight.w600,
        color: _testoChiaro,
      ),
      _Griglia.colonna,
    );
    sotto.paint(
      tela,
      Offset(_Griglia.sinistra, _Griglia.riga2 + 60 * _Griglia.k * 0.9 + 4),
    );
    numero.dispose();
    unita.dispose();
    sotto.dispose();
  }

  /* ── a sinistra, in fondo: i due numeri ── */
  final batteria = _numero(s['batt']);
  final coppia = <(String, String)>[
    if (conSole) ...[
      if (_numero(s['casa']) case final casa?)
        (_percento(casa), inLingua(it: 'usato in casa', en: 'used at home')),
      if (_numero(s['ris']) case final risparmio?)
        (_euro(risparmio), inLingua(it: 'risparmiati', en: 'saved')),
    ] else ...[
      if (_numero(s['re']) case final euro?)
        (_euro(euro), inLingua(it: 'dalla rete', en: 'from the grid')),
      if (batteria != null)
        (
          _percento(batteria),
          inLingua(it: 'batteria stasera', en: 'battery tonight'),
        ),
    ],
  ];
  if (coppia.isNotEmpty) _laCoppia(tela, coppia.take(2).toList());

  /* ── a destra: il grafico, e la sua legenda ── */
  final prodotta = conSole
      ? [for (final uno in _serie(s['p'])) uno / 10]
      : const <double>[];
  final consumata = [for (final uno in _serie(s['c'])) uno / 10];
  _ilGraficoDellaGiornata(
    tela,
    prodotta: prodotta,
    consumata: consumata,
    picco: conSole ? _numero(s['pkw']) : null,
    ora: s['pora'] is String ? s['pora'] as String : null,
  );
  _laLegenda(tela, [
    if (prodotta.length > 1) ...[
      (_arancio.withValues(alpha: 0.55), inLingua(it: 'Sole', en: 'Sun')),
      (_usatoInCasa, inLingua(it: 'Usato in casa', en: 'Used at home')),
    ],
    if (consumata.length > 1)
      (_azzurro, inLingua(it: 'Consumo', en: 'Consumption')),
  ]);
}

/// La pillola del record, a destra nella prima riga. Torna dove comincia.
double _ilRecord(Canvas tela, String record) {
  final anno = record == 'anno' || record == 'year';
  final scritta = _misurato(
    anno
        ? inLingua(it: 'Record dell\'anno', en: 'Record of the year')
        : inLingua(it: 'Record di $record', en: '$record record'),
    const TextStyle(
      fontFamily: 'Inter',
      fontSize: 11 * _Griglia.k,
      fontWeight: FontWeight.w800,
      color: _marrone,
    ),
    /* Al piu' meta' riga: la data ha bisogno del suo posto. */
    (_Griglia.destra - _Griglia.sinistra) / 2 - 24,
  );
  const coppa = 7.0;
  const dentro = 10 * _Griglia.k;
  final larga = dentro + coppa + 3 + scritta.width + dentro;
  final alta = scritta.height + 8 * _Griglia.k;
  final pillola = Rect.fromLTWH(
    _Griglia.destra - larga,
    _Griglia.riga1 + (_Griglia.altezza1 - alta) / 2,
    larga,
    alta,
  );
  tela.drawRRect(
    RRect.fromRectAndRadius(pillola, Radius.circular(alta / 2)),
    Paint()
      ..shader = ui.Gradient.linear(
        pillola.topLeft,
        pillola.bottomRight,
        const [_gialloChiaro, _arancio],
      ),
  );
  _laCoppa(
    tela,
    Rect.fromLTWH(
      pillola.left + dentro,
      pillola.center.dy - coppa / 2,
      coppa,
      coppa,
    ),
  );
  scritta.paint(
    tela,
    Offset(
      pillola.left + dentro + coppa + 3,
      pillola.center.dy - scritta.height / 2,
    ),
  );
  scritta.dispose();
  return pillola.left;
}

/// Una coppa, disegnata: l'emoji del trofeo non c'e' su tutti i telefoni, e
/// dove c'e' ognuno la fa a modo suo.
void _laCoppa(Canvas tela, Rect dove) {
  final colore = Paint()..color = _marrone;
  final w = dove.width;
  final h = dove.height;
  final x = dove.left;
  final y = dove.top;
  final calice = Path()
    ..moveTo(x + w * 0.2, y)
    ..lineTo(x + w * 0.8, y)
    ..lineTo(x + w * 0.76, y + h * 0.42)
    ..quadraticBezierTo(x + w * 0.7, y + h * 0.62, x + w * 0.5, y + h * 0.64)
    ..quadraticBezierTo(x + w * 0.3, y + h * 0.62, x + w * 0.24, y + h * 0.42)
    ..close();
  tela.drawPath(calice, colore);
  final manici = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = w * 0.1
    ..color = _marrone;
  tela.drawArc(
    Rect.fromLTWH(x + w * 0.02, y + h * 0.06, w * 0.36, h * 0.36),
    math.pi / 2,
    math.pi,
    false,
    manici,
  );
  tela.drawArc(
    Rect.fromLTWH(x + w * 0.62, y + h * 0.06, w * 0.36, h * 0.36),
    -math.pi / 2,
    math.pi,
    false,
    manici,
  );
  tela.drawRect(
    Rect.fromLTWH(x + w * 0.44, y + h * 0.62, w * 0.12, h * 0.2),
    colore,
  );
  tela.drawRRect(
    RRect.fromRectAndRadius(
      Rect.fromLTWH(x + w * 0.26, y + h * 0.82, w * 0.48, h * 0.16),
      Radius.circular(w * 0.05),
    ),
    colore,
  );
}

/// I due numeri in fondo a sinistra, divisi da una linea sopra e una in mezzo.
void _laCoppia(Canvas tela, List<(String, String)> coppia) {
  const valore = TextStyle(
    fontFamily: 'Oswald',
    fontSize: 24 * _Griglia.k,
    fontWeight: FontWeight.w700,
    color: _bianco,
    height: 1,
  );
  const etichetta = TextStyle(
    fontFamily: 'Inter',
    fontSize: 10.5 * _Griglia.k,
    fontWeight: FontWeight.w600,
    color: _spento,
  );
  const sopraIlValore = 10 * _Griglia.k;
  const fraIDue = 3 * _Griglia.k;
  const rientro = 12 * _Griglia.k;
  final meta = _Griglia.colonna / 2;
  final scritti = [
    for (final (i, (numero, parola)) in coppia.indexed)
      (
        _misurato(numero, valore, meta - (i == 0 ? 6 : rientro)),
        _misurato(parola, etichetta, meta - (i == 0 ? 6 : rientro)),
      ),
  ];
  final alto = scritti.fold<double>(
    0,
    (prima, uno) => math.max(prima, uno.$1.height + fraIDue + uno.$2.height),
  );
  final linea = _Griglia.fondo - alto - sopraIlValore;
  final pennello = Paint()
    ..color = _lineaSottile
    ..strokeWidth = 0.7;
  tela.drawLine(
    Offset(_Griglia.sinistra, linea),
    Offset(_Griglia.sinistra + _Griglia.colonna, linea),
    pennello,
  );
  for (final (i, (numero, parola)) in scritti.indexed) {
    final x = _Griglia.sinistra + (i == 0 ? 0 : meta + rientro);
    if (i > 0) {
      tela.drawLine(
        Offset(_Griglia.sinistra + meta, linea + sopraIlValore),
        Offset(_Griglia.sinistra + meta, _Griglia.fondo),
        pennello,
      );
    }
    numero.paint(tela, Offset(x, linea + sopraIlValore));
    parola.paint(
      tela,
      Offset(x, linea + sopraIlValore + numero.height + fraIDue),
    );
    numero.dispose();
    parola.dispose();
  }
}

/// Il grafico ora per ora: il sole (area ambra), quanto ne e' rimasto in
/// casa (pieno), il consumo (linea azzurra), il picco.
///
/// Le misure sono quelle del disegno (`viewBox 0 0 300 200`): la base a 178,
/// cinque righe leggere sopra, le ore sotto a 196.
void _ilGraficoDellaGiornata(
  Canvas tela, {
  required List<double> prodotta,
  required List<double> consumata,
  double? picco,
  String? ora,
}) {
  const dove = Rect.fromLTWH(
    _Griglia.grafico,
    _Griglia.riga2,
    _Griglia.destra - _Griglia.grafico,
    _Griglia.altezza2,
  );
  /* La scala verticale del disegno: 200 unita' nell'altezza della riga. */
  final y = dove.height / 200;
  final base = dove.top + 178 * y;
  final piano = Rect.fromLTRB(dove.left, dove.top, dove.right, base);
  final sottile = Paint()
    ..color = const Color(0x0FFFFFFF)
    ..strokeWidth = 0.6;
  for (var riga = 1; riga <= 5; riga += 1) {
    final quota = base - riga * 32.95 * y;
    tela.drawLine(Offset(dove.left, quota), Offset(dove.right, quota), sottile);
  }
  tela.drawLine(
    Offset(dove.left, base),
    Offset(dove.right, base),
    Paint()
      ..color = const Color(0x2EFFFFFF)
      ..strokeWidth = 0.7,
  );
  final tutti = [...prodotta, ...consumata];
  if (tutti.length > 1) {
    final massimo = math.max(tutti.reduce(math.max), 0.1) * 1.1;
    if (prodotta.length > 1) {
      tela.drawPath(
        _area(prodotta, piano, massimo),
        Paint()
          ..shader = ui.Gradient.linear(piano.topCenter, piano.bottomCenter, [
            _usatoInCasa.withValues(alpha: 0.55),
            _usatoInCasa.withValues(alpha: 0.08),
          ]),
      );
      tela.drawPath(
        _linea(prodotta, piano, massimo),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.3
          ..strokeJoin = StrokeJoin.round
          ..color = _arancio,
      );
      final usata = [
        for (var i = 0; i < prodotta.length; i += 1)
          i < consumata.length ? math.min(prodotta[i], consumata[i]) : 0.0,
      ];
      tela.drawPath(
        _area(usata, piano, massimo),
        Paint()..color = _usatoInCasa,
      );
    }
    if (consumata.length > 1) {
      tela.drawPath(
        _linea(consumata, piano, massimo),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.45
          ..strokeJoin = StrokeJoin.round
          ..color = _azzurro,
      );
    }
    if (picco != null && prodotta.length > 1) {
      final alto = prodotta.reduce(math.max);
      final i = prodotta.indexOf(alto);
      final punto = Offset(
        piano.left + i * piano.width / (prodotta.length - 1),
        piano.bottom - (alto / massimo) * piano.height,
      );
      tela.drawCircle(punto, 3, Paint()..color = const Color(0xFF0F172A));
      tela.drawCircle(
        punto,
        3,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..color = _giallo,
      );
      final scritta = _misurato(
        '${_decimali(picco, 1)} kW${ora == null ? '' : ' · $ora'}',
        const TextStyle(
          fontFamily: 'Inter',
          fontSize: 6.8,
          fontWeight: FontWeight.w700,
          color: _gialloChiaro,
        ),
        dove.width / 2,
      );
      /* A destra del punto; se non ci sta, a sinistra. */
      var x = punto.dx + 5.3;
      if (x + scritta.width > dove.right) x = punto.dx - 5.3 - scritta.width;
      final sopra = math.max(
        punto.dy -
            3.6 -
            scritta.computeDistanceToActualBaseline(TextBaseline.alphabetic),
        dove.top - scritta.height / 2,
      );
      scritta.paint(tela, Offset(x, sopra));
      scritta.dispose();
    }
  }
  for (final ora in const [0, 6, 12, 18, 24]) {
    final scritta = _misurato(
      ora.toString().padLeft(2, '0'),
      const TextStyle(
        fontFamily: 'Inter',
        fontSize: 6.5,
        fontWeight: FontWeight.w600,
        color: _spento,
      ),
      20,
    );
    final x = dove.left + ora * dove.width / 24;
    final dx = switch (ora) {
      0 => x,
      24 => x - scritta.width,
      _ => x - scritta.width / 2,
    };
    scritta.paint(
      tela,
      Offset(
        dx,
        dove.top +
            196 * y -
            scritta.computeDistanceToActualBaseline(TextBaseline.alphabetic),
      ),
    );
    scritta.dispose();
  }
}

/// La legenda sotto il grafico, nella terza riga: quadratini e parole. Se non
/// ci sta, le parole si rimpiccioliscono tutte insieme.
void _laLegenda(Canvas tela, List<(Color, String)> voci) {
  if (voci.isEmpty) return;
  const larga = _Griglia.destra - _Griglia.grafico;
  const quadratino = 9 * _Griglia.k;
  const accanto = 5 * _Griglia.k;
  const fra = 14 * _Griglia.k;
  var corpo = 10.5 * _Griglia.k;
  final minimo = corpo * 0.7;
  List<TextPainter> scritte;
  while (true) {
    scritte = [
      for (final (_, parola) in voci)
        TextPainter(
          text: TextSpan(
            text: parola,
            style: TextStyle(
              fontFamily: 'Inter',
              fontSize: corpo,
              fontWeight: FontWeight.w600,
              color: _testoChiaro,
            ),
          ),
          textDirection: TextDirection.ltr,
          maxLines: 1,
        )..layout(),
    ];
    final tutta =
        scritte.fold<double>(0, (p, s) => p + s.width + quadratino + accanto) +
        fra * (voci.length - 1);
    if (tutta <= larga) break;
    if (corpo - 0.5 < minimo) {
      testiTagliati.add(voci.map((v) => v.$2).join(' · '));
      break;
    }
    for (final s in scritte) {
      s.dispose();
    }
    corpo -= 0.5;
  }
  var x = _Griglia.grafico;
  const centro = _Griglia.riga3 + _Griglia.altezza3 / 2;
  for (final (i, (colore, _)) in voci.indexed) {
    tela.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(x, centro - quadratino / 2, quadratino, quadratino),
        const Radius.circular(3 * _Griglia.k),
      ),
      Paint()..color = colore,
    );
    x += quadratino + accanto;
    scritte[i].paint(tela, Offset(x, centro - scritte[i].height / 2));
    x += scritte[i].width + fra;
    scritte[i].dispose();
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
