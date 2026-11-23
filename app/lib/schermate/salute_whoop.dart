/// Il WHOOP nella pagina «Salute»: le schede, il dettaglio del recupero, e
/// la riga per collegare l'account.
///
/// Le schede ci sono quando qualcosa viene dal WHOOP — l'account collegato,
/// o l'app WHOOP che scrive in Salute e in Health Connect — e non ci sono
/// per chi il WHOOP non ce l'ha. Il marchio e' di testo, «WHOOP», non il
/// logo: e' un nome che dice da dove viene il numero, non una pubblicita'.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../parole.dart';
import '../salute/il_corpo.dart';
import '../salute/whoop/collegamento_whoop.dart';
import '../salute/whoop/whoop.dart';
import '../vestito/pezzi.dart';

/// I colori delle zone del recupero: verde, giallo, rosso. Gli stessi in
/// chiaro e in scuro, abbastanza pieni da leggersi su tutti e due.
Color coloreDellaZona(ZonaDelRecupero zona) => switch (zona) {
  ZonaDelRecupero.verde => const Color(0xFF16A34A),
  ZonaDelRecupero.gialla => const Color(0xFFEAB308),
  ZonaDelRecupero.rossa => const Color(0xFFDC2626),
};

/// Lo sforzo: un azzurro, come il WHOOP lo distingue dal recupero.
const coloreDelloSforzo = Color(0xFF0EA5E9);

/// Il sonno: lo stesso indaco della misura «Sonno».
const coloreDelSonno = Color(0xFF6366F1);

/// «da WHOOP» in piccolo: il nome in lettere, su un rettangolino pieno.
class MarchioWhoop extends StatelessWidget {
  const MarchioWhoop({super.key, this.grande = false});

  final bool grande;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: grande ? 8 : 5,
        vertical: grande ? 5 : 2,
      ),
      decoration: BoxDecoration(
        color: colori.onSurface,
        borderRadius: BorderRadius.circular(grande ? 8 : 5),
      ),
      child: Text(
        Fonte.whoop.marchio,
        style: TextStyle(
          color: colori.surface,
          fontSize: grande ? 12 : 9,
          fontWeight: FontWeight.w900,
          letterSpacing: grande ? 1.6 : 1.2,
          height: 1.1,
        ),
      ),
    );
  }
}

/// Un anello: la pista tenue e l'arco pieno, da mezzogiorno in senso
/// orario. Fermo: niente animazioni, i telefoni economici ringraziano.
class Anello extends StatelessWidget {
  const Anello({
    super.key,
    required this.frazione,
    required this.colore,
    required this.lato,
    this.spessore = 9,
    this.child,
  });

  final double frazione;
  final Color colore;
  final double lato;
  final double spessore;
  final Widget? child;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: lato,
    child: CustomPaint(
      painter: _Arco(frazione.clamp(0, 1).toDouble(), colore, spessore),
      child: Center(child: child),
    ),
  );
}

class _Arco extends CustomPainter {
  const _Arco(this.frazione, this.colore, this.spessore);
  final double frazione;
  final Color colore;
  final double spessore;

  @override
  void paint(Canvas canvas, Size size) {
    final centro = size.center(Offset.zero);
    final raggio = (size.shortestSide - spessore) / 2;
    final pista = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = spessore
      ..color = colore.withValues(alpha: .16);
    canvas.drawCircle(centro, raggio, pista);
    if (frazione <= 0) return;
    final arco = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = spessore
      ..strokeCap = StrokeCap.round
      ..color = colore;
    canvas.drawArc(
      Rect.fromCircle(center: centro, radius: raggio),
      -math.pi / 2,
      2 * math.pi * frazione,
      false,
      arco,
    );
  }

  @override
  bool shouldRepaint(_Arco prima) =>
      prima.frazione != frazione ||
      prima.colore != colore ||
      prima.spessore != spessore;
}

String _ora(DateTime t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

/// «stamattina», «ieri», «1 nov»: quando e' del recupero o della notte.
String _quando(DateTime quando, DateTime adesso) =>
    quandoSeNonOggi(quando, adesso) ??
    (quando.hour < 12
        ? inLingua(it: 'stamattina', en: 'this morning')
        : inLingua(
            it: 'oggi alle ${_ora(quando)}',
            en: 'today ${_ora(quando)}',
          ));

/// Il nome di uno sport di WHOOP, per chi legge: i piu' comuni tradotti, gli
/// altri come li scrive WHOOP, con la maiuscola.
String nomeDelloSport(String sport) {
  final chiave = sport.toLowerCase().replaceAll(RegExp(r'[\s_-]+'), '');
  final tradotto = switch (chiave) {
    'running' => inLingua(it: 'Corsa', en: 'Running'),
    'cycling' => inLingua(it: 'Bici', en: 'Cycling'),
    'walking' => inLingua(it: 'Camminata', en: 'Walking'),
    'swimming' => inLingua(it: 'Nuoto', en: 'Swimming'),
    'weightlifting' ||
    'functionalfitness' => inLingua(it: 'Pesi', en: 'Weightlifting'),
    'yoga' => 'Yoga',
    'hiking' || 'hikingrucking' => inLingua(it: 'Escursione', en: 'Hiking'),
    'tennis' => 'Tennis',
    'soccer' => inLingua(it: 'Calcio', en: 'Soccer'),
    'activity' => inLingua(it: 'Attività', en: 'Activity'),
    _ => null,
  };
  if (tradotto != null) return tradotto;
  final pulito = sport.replaceAll('_', ' ').trim();
  return pulito.isEmpty
      ? inLingua(it: 'Attività', en: 'Activity')
      : pulito[0].toUpperCase() + pulito.substring(1);
}

/// Le quattro schede del WHOOP: recupero, sforzo, sonno, HRV e battito a
/// riposo. Quelle senza dati non ci sono; il recupero si tocca e apre il
/// dettaglio.
class SchedeWhoop extends StatelessWidget {
  const SchedeWhoop({
    super.key,
    required this.quadro,
    required this.adesso,
    this.apriIlRecupero,
  });

  final QuadroWhoop quadro;
  final DateTime adesso;
  final VoidCallback? apriIlRecupero;

  @override
  Widget build(BuildContext context) {
    final schede = <Widget>[
      if (quadro.recupero case final r?)
        _SchedaDelRecupero(
          recupero: r,
          adesso: adesso,
          quandoPremuta: apriIlRecupero,
        ),
      if (quadro.sforzo case final s?)
        _SchedaDelloSforzo(sforzo: s, allenamento: quadro.allenamento),
      if (quadro.sonno != null || quadro.sonnoDaSalute != null)
        _SchedaDelSonno(
          sonno: quadro.sonno,
          daSalute: quadro.sonnoDaSalute,
          adesso: adesso,
        ),
      if (quadro.hrv != null || quadro.battitoRiposo != null)
        _SchedaDelCuore(hrv: quadro.hrv, riposo: quadro.battitoRiposo),
    ];
    return LayoutBuilder(
      builder: (context, spazio) {
        const fra = 12.0;
        final larga = (spazio.maxWidth - fra) / 2;
        return Wrap(
          spacing: fra,
          runSpacing: fra,
          children: [
            for (final s in schede)
              SizedBox(width: larga, height: 196, child: s),
          ],
        );
      },
    );
  }
}

/// La cornice comune: il titolo, il marchio, e sotto quello che si vuole.
class _Cornice extends StatelessWidget {
  const _Cornice({
    required this.titolo,
    required this.child,
    this.quandoPremuta,
    this.chiave,
  });

  final String titolo;
  final Widget child;
  final VoidCallback? quandoPremuta;
  final Key? chiave;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    return Scheda(
      key: chiave,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      quandoPremuta: quandoPremuta,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  titolo,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: testi.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const MarchioWhoop(),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _SchedaDelRecupero extends StatelessWidget {
  const _SchedaDelRecupero({
    required this.recupero,
    required this.adesso,
    this.quandoPremuta,
  });

  final RecuperoWhoop recupero;
  final DateTime adesso;
  final VoidCallback? quandoPremuta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final colore = coloreDellaZona(recupero.zona);
    return _Cornice(
      chiave: const Key('whoop-scheda-recupero'),
      titolo: MisuraDelCorpo.recupero.titolo,
      quandoPremuta: quandoPremuta,
      child: Column(
        children: [
          Anello(
            frazione: recupero.percento / 100,
            colore: colore,
            lato: 96,
            spessore: 10,
            child: Text(
              '${numeroScritto(recupero.percento)}%',
              style: testi.headlineSmall?.copyWith(
                fontWeight: FontWeight.w900,
                color: colore,
              ),
            ),
          ),
          const Spacer(),
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: colore,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  recupero.calibrando
                      ? inLingua(it: 'In calibrazione', en: 'Calibrating')
                      : '${recupero.zona.nome} · '
                            '${_quando(recupero.quando, adesso)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: colori.onSurfaceVariant,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SchedaDelloSforzo extends StatelessWidget {
  const _SchedaDelloSforzo({required this.sforzo, this.allenamento});

  final SforzoWhoop sforzo;
  final AllenamentoWhoop? allenamento;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final ultimo = allenamento;
    return _Cornice(
      chiave: const Key('whoop-scheda-sforzo'),
      titolo: MisuraDelCorpo.sforzo.titolo,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Anello(
              frazione: sforzo.sforzo / 21,
              colore: coloreDelloSforzo,
              lato: 96,
              spessore: 10,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    numeroScritto(sforzo.sforzo, cifre: 1),
                    style: testi.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: coloreDelloSforzo,
                    ),
                  ),
                  Text(
                    inLingua(it: 'su 21', en: 'of 21'),
                    style: testi.labelSmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Spacer(),
          Row(
            children: [
              /* L'ultimo allenamento, con lo sforzo che e' costato. */
              if (ultimo != null) ...[
                Icon(
                  Icons.directions_run_rounded,
                  size: 16,
                  color: coloreDelloSforzo,
                ),
                const SizedBox(width: 4),
              ],
              Expanded(
                child: Text(
                  ultimo == null
                      ? (sforzo.fine == null
                            ? inLingua(it: 'Oggi, finora', en: 'Today so far')
                            : inLingua(it: 'Ieri', en: 'Yesterday'))
                      : '${nomeDelloSport(ultimo.sport)} · '
                            '${numeroScritto(ultimo.sforzo, cifre: 1)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Le fasi del sonno in una barra: leggero, profondo, REM, sveglio.
class FasiDelSonno extends StatelessWidget {
  const FasiDelSonno({super.key, required this.sonno, this.alta = 8});

  final SonnoWhoop sonno;
  final double alta;

  static List<(String, Color, double Function(SonnoWhoop))> get fasi => [
    (
      inLingua(it: 'Profondo', en: 'Deep'),
      const Color(0xFF4338CA),
      (s) => s.profondo,
    ),
    ('REM', const Color(0xFF8B5CF6), (s) => s.rem),
    (
      inLingua(it: 'Leggero', en: 'Light'),
      const Color(0xFF93C5FD),
      (s) => s.leggero,
    ),
    (
      inLingua(it: 'Sveglio', en: 'Awake'),
      const Color(0xFFCBD5E1),
      (s) => s.sveglio,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final pezzi = [
      for (final (_, colore, quanto) in fasi)
        if (quanto(sonno) > 0) (colore, quanto(sonno)),
    ];
    return ClipRRect(
      borderRadius: BorderRadius.circular(alta / 2),
      child: SizedBox(
        height: alta,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (colore, minuti) in pezzi)
              Expanded(
                flex: math.max(1, minuti.round()),
                child: ColoredBox(color: colore),
              ),
          ],
        ),
      ),
    );
  }
}

class _SchedaDelSonno extends StatelessWidget {
  const _SchedaDelSonno({this.sonno, this.daSalute, required this.adesso});

  final SonnoWhoop? sonno;
  final Lettura? daSalute;
  final DateTime adesso;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final notte = sonno;
    final prestazione = notte?.prestazione;
    final minuti = notte?.dormiti ?? daSalute?.valore ?? 0;
    final fine = notte?.fine ?? daSalute?.quando ?? adesso;
    final ore = Text(
      oreEMinuti(minuti),
      style: testi.titleMedium?.copyWith(fontWeight: FontWeight.w900),
    );
    return _Cornice(
      chiave: const Key('whoop-scheda-sonno'),
      titolo: MisuraDelCorpo.sonno.titolo,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (prestazione != null)
            Center(
              child: Anello(
                frazione: prestazione / 100,
                colore: coloreDelSonno,
                lato: 72,
                spessore: 8,
                child: Text(
                  '${numeroScritto(prestazione)}%',
                  style: testi.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: coloreDelSonno,
                  ),
                ),
              ),
            )
          else ...[
            /* Dalla Salute: le ore, senza fasi ne' prestazione. */
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: coloreDelSonno.withValues(alpha: .14),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.bedtime_rounded,
                  color: coloreDelSonno,
                  size: 34,
                ),
              ),
            ),
            const SizedBox(height: 10),
            ore,
          ],
          const Spacer(),
          if (prestazione != null) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                ore,
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _quando(fine, adesso),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.end,
                    style: testi.labelSmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
          ],
          if (notte != null) ...[
            FasiDelSonno(sonno: notte),
            const SizedBox(height: 6),
          ],
          Text(
            /* La percentuale nell'anello e' la prestazione: quanto si e'
             * dormito rispetto al bisogno. */
            prestazione != null
                ? inLingua(it: 'Prestazione', en: 'Performance')
                : inLingua(
                    it: '${_quando(fine, adesso)} · senza fasi',
                    en: '${_quando(fine, adesso)} · no stages',
                  ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: testi.bodySmall?.copyWith(
              color: colori.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _SchedaDelCuore extends StatelessWidget {
  const _SchedaDelCuore({this.hrv, this.riposo});

  final Lettura? hrv;
  final Lettura? riposo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    Widget riga(String nome, IconData icona, String valore, String unita) =>
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: const Color(0xFFE11D48).withValues(alpha: .14),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icona, color: const Color(0xFFE11D48), size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    nome,
                    style: testi.labelSmall?.copyWith(
                      color: colori.onSurfaceVariant,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: valore,
                          style: testi.titleLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        TextSpan(
                          text: ' $unita',
                          style: testi.bodySmall?.copyWith(
                            color: colori.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
    return _Cornice(
      chiave: const Key('whoop-scheda-cuore'),
      titolo: inLingua(it: 'Cuore', en: 'Heart'),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          if (hrv case final h?)
            riga(
              'HRV',
              Icons.show_chart_rounded,
              numeroScritto(h.valore),
              'ms',
            ),
          if (riposo case final r?)
            riga(
              inLingua(it: 'A riposo', en: 'Resting'),
              Icons.favorite_border_rounded,
              numeroScritto(r.valore),
              'bpm',
            ),
        ],
      ),
    );
  }
}

/// La riga «WHOOP» nelle impostazioni della Salute: «Collega», oppure
/// «Collegato · Scollega».
class RigaWhoop extends StatelessWidget {
  const RigaWhoop({
    super.key,
    required this.stato,
    required this.collega,
    required this.scollega,
    this.aggiornato,
    this.iPhone = true,
    this.lavorando = false,
  });

  final StatoWhoop stato;
  final VoidCallback collega;
  final VoidCallback scollega;

  /// Quando si sono presi gli ultimi dati.
  final DateTime? aggiornato;
  final bool iPhone;
  final bool lavorando;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final collegato = stato == StatoWhoop.collegato;
    final quando = aggiornato;
    final sotto = switch (stato) {
      StatoWhoop.collegato =>
        quando == null
            ? inLingua(it: 'Collegato', en: 'Connected')
            : inLingua(
                it: 'Collegato · aggiornato alle ${_ora(quando)}',
                en: 'Connected · updated at ${_ora(quando)}',
              ),
      StatoWhoop.scollegato => inLingua(
        it: 'Recupero, sforzo e sonno dal tuo account WHOOP.',
        en: 'Recovery, strain and sleep from your WHOOP account.',
      ),
      StatoWhoop.daRicollegare => inLingua(
        it: 'WHOOP ha chiuso l\'accesso: collegalo di nuovo.',
        en: 'WHOOP closed the access: connect it again.',
      ),
    };
    return Scheda(
      key: const Key('whoop-riga'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const MarchioWhoop(grande: true),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'WHOOP',
                      style: testi.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (collegato) ...[
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Color(0xFF16A34A),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Expanded(
                          child: Text(
                            sotto,
                            key: const Key('whoop-stato'),
                            style: testi.bodySmall?.copyWith(
                              color: stato == StatoWhoop.daRicollegare
                                  ? colori.error
                                  : colori.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (collegato)
                TextButton(
                  key: const Key('whoop-scollega'),
                  /* Il tema allarga i bottoni a tutta riga: qui stanno
                   * di fianco al nome. */
                  style: TextButton.styleFrom(minimumSize: const Size(0, 40)),
                  onPressed: lavorando ? null : scollega,
                  child: Text(inLingua(it: 'Scollega', en: 'Disconnect')),
                )
              else
                FilledButton.tonal(
                  key: const Key('whoop-collega'),
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
                  onPressed: lavorando ? null : collega,
                  child: Text(inLingua(it: 'Collega', en: 'Connect')),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            collegato
                ? inLingua(
                    it:
                        'I token restano su questo telefono, cifrati. Le '
                        'misure vanno alla casa con le altre.',
                    en:
                        'Tokens stay on this phone, encrypted. Readings go '
                        'home with the others.',
                  )
                : iPhone
                ? inLingua(
                    it:
                        'Anche senza collegarlo, quello che l\'app WHOOP '
                        'scrive in Apple Salute arriva già: sonno, battito a '
                        'riposo, HRV, respiro.',
                    en:
                        'Even without connecting, what the WHOOP app writes '
                        'to Apple Health already comes through: sleep, '
                        'resting heart rate, HRV, respiratory rate.',
                  )
                : inLingua(
                    it:
                        'Anche senza collegarlo, quello che l\'app WHOOP '
                        'scrive in Health Connect arriva già: sonno, battito '
                        'a riposo, HRV, respiro.',
                    en:
                        'Even without connecting, what the WHOOP app writes '
                        'to Health Connect already comes through: sleep, '
                        'resting heart rate, HRV, respiratory rate.',
                  ),
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

/// Il dettaglio del recupero: l'anello grande, la zona, da cosa viene, e la
/// settimana.
class SchermataDelRecupero extends StatelessWidget {
  const SchermataDelRecupero({
    super.key,
    required this.dati,
    required this.adesso,
  });

  final DatiWhoop dati;
  final DateTime adesso;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final recupero = dati.recupero;
    return Scaffold(
      appBar: AppBar(title: Text(MisuraDelCorpo.recupero.titolo)),
      body: recupero == null
          ? StatoVuoto(
              icona: Icons.battery_unknown_rounded,
              titolo: inLingua(
                it: 'Nessun recupero ancora',
                en: 'No recovery yet',
              ),
              sotto: nessunValore(MisuraDelCorpo.recupero, iPhone: true),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                Scheda(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 18),
                  child: Column(
                    children: [
                      Anello(
                        frazione: recupero.percento / 100,
                        colore: coloreDellaZona(recupero.zona),
                        lato: 188,
                        spessore: 16,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${numeroScritto(recupero.percento)}%',
                              key: const Key('whoop-recupero-percento'),
                              style: testi.displaySmall?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: coloreDellaZona(recupero.zona),
                              ),
                            ),
                            Text(
                              _quando(recupero.quando, adesso),
                              style: testi.bodySmall?.copyWith(
                                color: colori.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: coloreDellaZona(recupero.zona)
                              .withValues(alpha: .16),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          recupero.zona.nome,
                          style: testi.labelLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: coloreDellaZona(recupero.zona),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        recupero.calibrando
                            ? inLingua(
                                it:
                                    'WHOOP sta ancora imparando il tuo '
                                    'solito: nei primi giorni il recupero è '
                                    'approssimativo.',
                                en:
                                    'WHOOP is still learning your baseline: '
                                    'in the first days recovery is '
                                    'approximate.',
                              )
                            : recupero.zona.perche,
                        textAlign: TextAlign.center,
                        style: testi.bodyMedium,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Insegna(inLingua(it: 'Da cosa viene', en: 'What drives it')),
                Scheda(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      if (recupero.hrv case final v?)
                        _Voce(
                          icona: Icons.show_chart_rounded,
                          colore: const Color(0xFFE11D48),
                          nome: MisuraDelCorpo.hrv.titolo,
                          valore: '${numeroScritto(v)} ms',
                        ),
                      if (recupero.battitoRiposo case final v?)
                        _Voce(
                          icona: Icons.favorite_border_rounded,
                          colore: const Color(0xFFE11D48),
                          nome: MisuraDelCorpo.battitoRiposo.titolo,
                          valore: '${numeroScritto(v)} bpm',
                        ),
                      if (dati.sonno?.respiro case final v?)
                        _Voce(
                          icona: Icons.waves_rounded,
                          colore: const Color(0xFF0D9488),
                          nome: MisuraDelCorpo.respiro.titolo,
                          valore: inLingua(
                            it: '${numeroScritto(v, cifre: 1)} atti/min',
                            en: '${numeroScritto(v, cifre: 1)} breaths/min',
                          ),
                        ),
                      if (recupero.ossigeno case final v?)
                        _Voce(
                          icona: Icons.air_rounded,
                          colore: const Color(0xFF0891B2),
                          nome: MisuraDelCorpo.ossigeno.titolo,
                          valore: '${numeroScritto(v, cifre: 1)}%',
                        ),
                      if (recupero.temperaturaPelle case final v?)
                        _Voce(
                          icona: Icons.thermostat_rounded,
                          colore: const Color(0xFFEA580C),
                          nome: MisuraDelCorpo.temperaturaPelle.titolo,
                          valore: '${numeroScritto(v, cifre: 1)} °C',
                        ),
                      if (dati.sonno?.prestazione case final v?)
                        _Voce(
                          icona: Icons.bedtime_rounded,
                          colore: coloreDelSonno,
                          nome: inLingua(
                            it: 'Prestazione del sonno',
                            en: 'Sleep performance',
                          ),
                          valore: '${numeroScritto(v)}%',
                        ),
                    ],
                  ),
                ),
                if (dati.recuperi.length > 1) ...[
                  const SizedBox(height: 16),
                  Insegna(inLingua(it: 'Gli ultimi giorni', en: 'Recent days')),
                  Scheda(child: _LaSettimana(recuperi: dati.recuperi)),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    const MarchioWhoop(),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        inLingua(
                          it:
                              'Il recupero lo calcola WHOOP dalla notte: HRV, '
                              'battito a riposo, sonno e respiro. Preso alle '
                              '${_ora(dati.preso)}.',
                          en:
                              'WHOOP computes recovery from the night: HRV, '
                              'resting heart rate, sleep and breathing. '
                              'Fetched at ${_ora(dati.preso)}.',
                        ),
                        style: testi.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}

class _Voce extends StatelessWidget {
  const _Voce({
    required this.icona,
    required this.colore,
    required this.nome,
    required this.valore,
  });

  final IconData icona;
  final Color colore;
  final String nome;
  final String valore;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: colore.withValues(alpha: .14),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(icona, color: colore, size: 22),
    ),
    title: Text(nome),
    trailing: Text(
      valore,
      style: Theme.of(context).textTheme.titleMedium
          ?.copyWith(fontWeight: FontWeight.w800),
    ),
  );
}

/// I recuperi dei giorni passati, in barre colorate per zona: il piu'
/// vecchio a sinistra, come si legge un calendario.
class _LaSettimana extends StatelessWidget {
  const _LaSettimana({required this.recuperi});

  final List<RecuperoWhoop> recuperi;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final giorni = recuperi.reversed.toList();
    const nomi = [
      ('lun', 'Mon'),
      ('mar', 'Tue'),
      ('mer', 'Wed'),
      ('gio', 'Thu'),
      ('ven', 'Fri'),
      ('sab', 'Sat'),
      ('dom', 'Sun'),
    ];
    return SizedBox(
      height: 150,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final r in giorni)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 5),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    /* Il numero in nero: il giallo sul bianco non si
                     * legge, la barra il colore lo dice gia'. */
                    Text(
                      numeroScritto(r.percento),
                      style: testi.labelSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: colori.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      height: math.max(4, 96 * r.percento / 100),
                      decoration: BoxDecoration(
                        color: coloreDellaZona(r.zona),
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      () {
                        final (it, en) = nomi[r.quando.weekday - 1];
                        return inLingua(it: it, en: en);
                      }(),
                      style: testi.labelSmall?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
