/// La Home della plancia, disegnata qui.
///
/// E' la Home di DashboardModern rifatta in Flutter: la stessa struttura —
/// un'intestazione con il meteo e l'ora, le persone, le tessere una per
/// sezione, le azioni rapide — nello stesso ordine in cui l'utente le ha
/// messe dall'editor, con gli stessi numeri e le stesse parole. La
/// configurazione e' quella scritta in Home Assistant, e non si configura
/// niente da qui: quello che si disegna nell'editor della plancia compare
/// qui com'e'.
///
/// Quello che sta in questo file e' solo il disegno. Cosa dice ogni tessera lo
/// decide `plancia/tessere.dart`, e si prova senza schermo.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/entita.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/numeri.dart';
import '../../plancia/persone.dart';
import '../../plancia/tessere.dart';
import '../../vestito/oggetti.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

class Plancia extends StatefulWidget {
  const Plancia({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  State<Plancia> createState() => _PlanciaState();
}

class _PlanciaState extends State<Plancia> {
  /// Il ritardo di fine ciclo degli elettrodomestici vive fra un disegno e
  /// l'altro: e' il motivo per cui la lavatrice non sparisce in una pausa.
  final _tenute = <String, DateTime>{};

  /// L'orologio in cima, e i «9 min fa» delle persone: si rifanno da soli.
  Timer? _orologio;

  @override
  void initState() {
    super.initState();
    _orologio = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _orologio?.cancel();
    super.dispose();
  }

  Entita? _leggi(String id) => widget.collegamento.stato?[id];

  /* Le tessere rilevate — batterie, aria, fumo, allagamenti — non partono da
   * un elenco scritto: guardano tutta la casa. Si passa la funzione invece
   * della lista perche' cosi' la casa si legge solo se qualcuna la chiede. */
  List<Entita> _tuttaLaCasa() => widget.collegamento.stato?.tutte() ?? const [];

  @override
  Widget build(BuildContext context) {
    final config = widget.configurazione;
    final libro = widget.collegamento.libro;
    final adesso = DateTime.now();
    final tessere = tessereDellaHome(
      config,
      _leggi,
      adesso: adesso,
      tenute: _tenute,
      elenco: _tuttaLaCasa,
      impegni: libro?.impegni ?? const [],
      cose: libro?.cose ?? const [],
      agendaInArrivo: libro?.inArrivo ?? false,
    );
    final persone = personeDellaHome(config, _leggi, adesso: adesso);
    final azioni = config.azioniRapide;

    final blocchi = <Widget>[];
    for (final blocco in config.ordineDeiBlocchi) {
      switch (blocco) {
        case 'persone':
          if (persone.isEmpty) continue;
          blocchi.addAll([
            const Insegna('Persone'),
            _DueColonne([
              for (final persona in persone) _CartaDellaPersona(persona),
            ]),
            const SizedBox(height: 24),
          ]);
        case 'widget':
          blocchi.addAll([
            const Insegna('Widget'),
            _RigaDeiWidget(tessere),
            const SizedBox(height: 10),
            _DueColonne(spazio: 8, [
              for (final tessera in tessere)
                TesseraDellaHome(
                  tessera,
                  quandoPremuta: () => _apri(tessera.chiave),
                ),
            ]),
            const SizedBox(height: 24),
          ]);
        case 'azioni':
          if (azioni.isEmpty) continue;
          blocchi.addAll([
            const Insegna('Azioni rapide'),
            _DueColonne([
              for (final azione in azioni)
                _AzioneRapida(azione, quandoPremuta: () => _esegui(azione)),
            ]),
            const SizedBox(height: 24),
          ]);
      }
    }

    return RefreshIndicator(
      onRefresh: widget.collegamento.rileggiLaPlancia,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _Testata(configurazione: config, leggi: _leggi, adesso: adesso),
          const SizedBox(height: 22),
          ...blocchi,
        ],
      ),
    );
  }

  /* ─── I gesti ──────────────────────────────────────────────────────────── */

  /// La finestra di una tessera: le sue righe, con gli interruttori.
  Future<void> _apri(String chiave) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _FinestraDellaTessera(
      chiave: chiave,
      collegamento: widget.collegamento,
      configurazione: widget.configurazione,
      tenute: _tenute,
    ),
  );

  Future<void> _esegui(AzioneRapida azione) async {
    if (azione.tipo == 'builtin') {
      final chiave = switch (azione.incorporata) {
        'luci' => 'luci',
        'clima' => 'clima',
        'antifurto' => 'sicurezza',
        'lavatrice' => 'elettrodomestici',
        _ => '',
      };
      if (chiave.isNotEmpty) await _apri(chiave);
      return;
    }
    if (azione.tipo == 'luci_group') {
      await _apri('luci');
      return;
    }
    final entita = azione.entita;
    if (!entita.contains('.')) return;
    if (azione.conferma.isNotEmpty) {
      final sicuro = await showDialog<bool>(
        context: context,
        builder: (contesto) => AlertDialog(
          title: Text(azione.nome),
          content: Text(azione.conferma),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(contesto).pop(false),
              child: const Text('Annulla'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(contesto).pop(true),
              style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
              child: const Text('Conferma'),
            ),
          ],
        ),
      );
      if (sicuro != true || !mounted) return;
    }
    final servizio = azione.tipo == 'script' || azione.tipo == 'scene'
        ? 'turn_on'
        : 'toggle';
    if (!mounted) return;
    await esegui(
      context,
      () => widget.collegamento.stato!.comanda(servizio, entita),
    );
  }
}

/// Due per riga, alte uguali. Quando ne resta una sola, sta da sola.
class _DueColonne extends StatelessWidget {
  const _DueColonne(this.pezzi, {this.spazio = 12});
  final List<Widget> pezzi;

  /// Quanto stanno distanti. Le pillole dei widget si stringono a otto: sono
  /// tante, e la compatta serve proprio a farne stare il piu' possibile sopra
  /// la piega.
  final double spazio;

  @override
  Widget build(BuildContext context) {
    final righe = <Widget>[];
    for (var i = 0; i < pezzi.length; i += 2) {
      righe.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: pezzi[i]),
              SizedBox(width: spazio),
              if (i + 1 < pezzi.length)
                Expanded(child: pezzi[i + 1])
              else
                const Spacer(),
            ],
          ),
        ),
      );
      if (i + 2 < pezzi.length) righe.add(SizedBox(height: spazio));
    }
    return Column(children: righe);
  }
}

/* ─── L'intestazione: il meteo e l'ora ─────────────────────────────────── */

class _Testata extends StatelessWidget {
  const _Testata({
    required this.configurazione,
    required this.leggi,
    required this.adesso,
  });

  final ConfigurazioneDellaPlancia configurazione;
  final Leggi leggi;
  final DateTime adesso;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final meteoEntita = configurazione.entita('dm.home_meteo');
    final meteo = meteoEntita == null ? null : leggi(meteoEntita);

    return Scheda(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Row(
        children: [
          if (meteo != null) ...[
            Cerchietto(
              icona: _iconaDelMeteo(meteo.stato),
              lato: 46,
              fondo: colori.secondaryContainer,
              colore: colori.onSecondaryContainer,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${numero(comeNumero(meteo.attributi['temperature']), cifre: 1)}°',
                    style: testi.headlineSmall,
                  ),
                  const SizedBox(height: 3),
                  _RigaDelMeteo(meteo: meteo),
                ],
              ),
            ),
          ] else
            const Spacer(),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _ora(adesso),
                style: testi.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                _data(adesso),
                style: testi.bodySmall?.copyWith(
                  color: colori.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// La condizione, l'umidita' e il vento su una riga sola, con i disegni al
/// posto delle parole: «poco nuvoloso · 💧 42% · 🌬 11,5 km/h».
class _RigaDelMeteo extends StatelessWidget {
  const _RigaDelMeteo({required this.meteo});
  final Entita meteo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final stile = Theme.of(context).textTheme.bodySmall
        ?.copyWith(color: colori.onSurfaceVariant);
    final umidita = comeNumero(meteo.attributi['humidity']);
    final vento = comeNumero(meteo.attributi['wind_speed']);
    final unitaDelVento = pulito(meteo.attributi['wind_speed_unit']).isEmpty
        ? 'km/h'
        : pulito(meteo.attributi['wind_speed_unit']);
    Widget dato(IconData icona, String testo) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icona, size: 13, color: colori.onSurfaceVariant),
        const SizedBox(width: 2),
        Text(testo, style: stile),
      ],
    );
    return Wrap(
      spacing: 8,
      runSpacing: 2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(_nomeDelMeteo(meteo.stato), style: stile),
        if (umidita != null)
          dato(Icons.water_drop_outlined, '${numero(umidita, cifre: 0)}%'),
        if (vento != null)
          dato(Icons.air_rounded, '${numero(vento, cifre: 1)} $unitaDelVento'),
      ],
    );
  }
}

String _due(int n) => n.toString().padLeft(2, '0');
String _ora(DateTime t) => '${_due(t.hour)}:${_due(t.minute)}';

const _giorni = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const _mesi = [
  'gen',
  'feb',
  'mar',
  'apr',
  'mag',
  'giu',
  'lug',
  'ago',
  'set',
  'ott',
  'nov',
  'dic',
];
String _data(DateTime t) =>
    '${_giorni[t.weekday - 1]} ${t.day} ${_mesi[t.month - 1]}';

IconData _iconaDelMeteo(String condizione) => switch (condizione) {
  'sunny' => Icons.wb_sunny_rounded,
  'clear-night' => Icons.nights_stay_rounded,
  'partlycloudy' => Icons.wb_cloudy_rounded,
  'cloudy' => Icons.cloud_rounded,
  'rainy' => Icons.water_drop_rounded,
  'pouring' => Icons.grain_rounded,
  'snowy' || 'snowy-rainy' => Icons.ac_unit_rounded,
  'fog' => Icons.foggy,
  'windy' || 'windy-variant' => Icons.air_rounded,
  'lightning' || 'lightning-rainy' => Icons.thunderstorm_rounded,
  'hail' => Icons.grain_rounded,
  _ => Icons.cloud_queue_rounded,
};

String _nomeDelMeteo(String condizione) => switch (condizione) {
  'sunny' => 'sereno',
  'clear-night' => 'notte serena',
  'partlycloudy' => 'poco nuvoloso',
  'cloudy' => 'nuvoloso',
  'rainy' => 'pioggia',
  'pouring' => 'rovesci',
  'snowy' => 'neve',
  'snowy-rainy' => 'neve e pioggia',
  'fog' => 'nebbia',
  'windy' || 'windy-variant' => 'vento',
  'lightning' || 'lightning-rainy' => 'temporale',
  'hail' => 'grandine',
  'exceptional' => 'eccezionale',
  _ => condizione.replaceAll('-', ' '),
};

/* ─── Le tessere ───────────────────────────────────────────────────────── */

/// La riga sotto «Widget»: quante sezioni, e quali chiedono attenzione.
class _RigaDeiWidget extends StatelessWidget {
  const _RigaDeiWidget(this.tessere);
  final List<Tessera> tessere;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final attenzione = tessere.any((t) => t.allarme);
    return Padding(
      padding: const EdgeInsets.only(left: 4, right: 4, bottom: 4),
      child: Text(
        intestazioneDeiWidget(tessere),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: attenzione ? Colori.ambraScura : colori.onSurfaceVariant,
          fontWeight: attenzione ? FontWeight.w600 : FontWeight.w400,
        ),
      ),
    );
  }
}

/// Una tessera della Home: la pillola.
///
/// Sulla plancia, su uno schermo largo, la tessera e' un riquadro alto con
/// dentro quattro cose. Su un telefono no: sotto i cinquecentoventi punti la
/// plancia stringe da sola, e la tessera diventa una **pillola coricata** —
/// quarantotto punti d'altezza, due per riga, e dentro solo tre cose: il
/// disegno, il nome, il numero a destra. Didascalie e misure spariscono; il
/// resto vive nella finestra che si apre premendola.
///
/// Non e' una scorciatoia per far stare tutto: e' la stessa scelta, presa per
/// lo stesso motivo. Un telefono in mano si guarda per un secondo, e in un
/// secondo si legge un nome e un numero. Un'app che invece impagina come uno
/// schermo largo si riconosce subito, e si riconosce male.
///
/// Sul fianco sinistro c'e' la tacca col colore della sezione, fusa nel bordo.
/// Quando la tessera chiede attenzione la pillola prende un velo del colore
/// d'avviso, la tacca ingrossa e il numero va in tinta: si legge, non lampeggia.
class TesseraDellaHome extends StatelessWidget {
  const TesseraDellaHome(this.tessera, {super.key, this.quandoPremuta});

  /// Quanto e' alta la pillola.
  static const double altezza = 48;

  final Tessera tessera;
  final VoidCallback? quandoPremuta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final accento = coloreDaTesto(tessera.colore);
    final avviso = tessera.allarme;
    final (numeroGrande, unita) = tessera.valoreDiviso;
    /* Il grado e la percentuale sono parte del numero, non un'etichetta: gli
     * stanno attaccati e vanno in apice, come sui quadranti veri. */
    final simbolo = unita == '°' || unita == '%';

    return Material(
      color: avviso
          ? Color.alphaBlend(
              accento.withValues(alpha: 0.10),
              colori.surfaceContainerLowest,
            )
          : colori.surfaceContainerLowest,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: avviso
              ? accento.withValues(alpha: 0.30)
              : colori.onSurface.withValues(alpha: 0.08),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: quandoPremuta,
        child: SizedBox(
          height: altezza,
          child: Stack(
            children: [
              /* La tacca: una semipillola fusa nel bordo sinistro, col colore
               * della sezione. Quando c'e' un avviso ingrossa. */
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                child: Center(
                  child: Container(
                    width: avviso ? 5 : 4,
                    height: avviso ? 27 : 21,
                    decoration: BoxDecoration(
                      color: accento,
                      borderRadius: const BorderRadius.horizontal(
                        right: Radius.circular(4),
                      ),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(left: 13, right: 12),
                child: Row(
                  children: [
                    _Pastiglia(tessera: tessera),
                    const SizedBox(width: 9),
                    Expanded(child: _Etichetta(tessera.etichetta)),
                    const SizedBox(width: 6),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 110),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: simbolo
                            ? CrossAxisAlignment.start
                            : CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Flexible(
                            child: Text(
                              numeroGrande,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              softWrap: false,
                              style: TextStyle(
                                fontSize: 15.5,
                                height: 1.15,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.155,
                                fontFeatures: const [
                                  FontFeature.tabularFigures(),
                                ],
                                color: avviso
                                    ? Color.lerp(
                                        const Color(0xFF0F172A),
                                        accento,
                                        0.68,
                                      )
                                    : colori.onSurface,
                              ),
                            ),
                          ),
                          if (unita.isNotEmpty)
                            Padding(
                              padding: EdgeInsets.only(
                                left: simbolo ? 1 : 4,
                                top: simbolo ? 1 : 0,
                              ),
                              child: Text(
                                unita,
                                style: TextStyle(
                                  fontSize: simbolo ? 9.5 : 8,
                                  height: simbolo ? 1.5 : null,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: simbolo ? 0 : 0.64,
                                  color: colori.onSurfaceVariant,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Il nome della sezione, in maiuscoletto minuto e in inchiostro pieno.
///
/// Non smorzato: a otto punti e mezzo il grigio non si leggerebbe. Se non
/// entra va su due righe — «ELETTRODOMESTICI» tagliato coi puntini non e' un
/// nome.
class _Etichetta extends StatelessWidget {
  const _Etichetta(this.testo);
  final String testo;

  @override
  Widget build(BuildContext context) {
    return Text(
      testo.toUpperCase(),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurface,
        fontWeight: FontWeight.w900,
        fontSize: 8.8,
        letterSpacing: 0.8,
        height: 1.2,
      ),
    );
  }
}

/// La pastiglia col disegno: un cuscinetto neutro, sempre.
///
/// Nella pillola il colore ce lo mette la tacca, non la pastiglia: due cose
/// colorate a nove punti di distanza fanno confusione, non gerarchia.
class _Pastiglia extends StatelessWidget {
  const _Pastiglia({required this.tessera, this.lato = 30});

  final Tessera tessera;
  final double lato;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Container(
      width: lato,
      height: lato,
      decoration: BoxDecoration(
        color: colori.surfaceContainerLow,
        borderRadius: BorderRadius.circular(lato / 3),
        border: Border.all(color: colori.onSurface.withValues(alpha: 0.09)),
      ),
      alignment: Alignment.center,
      child: Oggetto(disegnoDellaTessera(tessera.chiave), lato: lato * 0.63),
    );
  }
}

/// La misura del mestiere: i segmenti di «quanti su quanti», una barra, o
/// la batteria che si riempie. Dove una quota non c'e', non c'e' niente.
class _MisuraDellaTessera extends StatelessWidget {
  const _MisuraDellaTessera({required this.tessera, required this.accento});
  final Tessera tessera;
  final Color accento;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final quota = (tessera.anello ?? 0).clamp(0, 100) / 100;
    switch (tessera.misura) {
      case Misura.nessuna:
        return const SizedBox.shrink();
      case Misura.punti:
        return Row(
          children: [
            for (var i = 0; i < tessera.segmenti; i += 1) ...[
              if (i > 0) const SizedBox(width: 3),
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: i < tessera.segmentiAccesi
                        ? accento
                        : colori.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ],
          ],
        );
      case Misura.barra:
        return ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: LinearProgressIndicator(
            value: quota,
            minHeight: 4,
            color: accento,
            backgroundColor: colori.surfaceContainerHigh,
          ),
        );
      case Misura.batteria:
        return Row(
          children: [
            Container(
              width: 34,
              height: 14,
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                border: Border.all(color: colori.outline, width: 1.2),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: quota,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: accento,
                      borderRadius: BorderRadius.circular(2),
                    ),
                    child: const SizedBox.expand(),
                  ),
                ),
              ),
            ),
            Container(
              width: 2.5,
              height: 6,
              margin: const EdgeInsets.only(left: 1),
              decoration: BoxDecoration(
                color: colori.outline,
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          ],
        );
    }
  }
}

/* ─── La finestra di una tessera ──────────────────────────────────────── */

/// Le righe di una tessera, con l'interruttore dove si comanda.
///
/// Si ridisegna sui cambiamenti della casa: la tessera si ricalcola ogni
/// volta, cosi' un interruttore premuto qui si vede muovere qui.
class _FinestraDellaTessera extends StatelessWidget {
  const _FinestraDellaTessera({
    required this.chiave,
    required this.collegamento,
    required this.configurazione,
    required this.tenute,
  });

  final String chiave;
  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;
  final Map<String, DateTime> tenute;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return StreamBuilder<void>(
      stream: collegamento.cambiamenti,
      builder: (context, _) {
        final tessere = tessereDellaHome(
          configurazione,
          (id) => collegamento.stato?[id],
          tenute: tenute,
          elenco: () => collegamento.stato?.tutte() ?? const [],
          impegni: collegamento.libro?.impegni ?? const [],
          cose: collegamento.libro?.cose ?? const [],
        );
        final tessera = tessere.where((t) => t.chiave == chiave).firstOrNull;
        if (tessera == null) {
          return const SizedBox.shrink();
        }
        final accento = coloreDaTesto(tessera.colore);
        final (tono, parola) = tessera.allarme
            ? (Colori.male, 'Da guardare')
            : tessera.accesa
            ? (Colori.ambraScura, 'In corso')
            : (Colori.bene, 'Tutto regolare');
        return Container(
          decoration: BoxDecoration(
            color: colori.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.55,
            minChildSize: 0.3,
            maxChildSize: 0.92,
            builder: (context, scorrimento) => ListView(
              controller: scorrimento,
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colori.outlineVariant,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _Pastiglia(tessera: tessera, lato: 44),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(tessera.etichetta, style: testi.titleLarge),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Pallino(tono, lato: 7),
                              const SizedBox(width: 6),
                              Text(
                                parola,
                                style: testi.bodySmall?.copyWith(
                                  color: tono,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Text(
                      tessera.valore,
                      style: testi.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                if (tessera.didascalia.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    tessera.didascalia,
                    style: testi.bodyMedium?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ],
                /* La misura sta qui, e non sulla pillola: nella pillola non
                 * ci sta, e messa a forza toglierebbe posto al numero, che e'
                 * la ragione per cui la si guarda. Qui invece c'e' spazio, e
                 * chi ha aperto la finestra vuole proprio il dettaglio. */
                if (tessera.misura != Misura.nessuna) ...[
                  const SizedBox(height: 14),
                  _MisuraDellaTessera(tessera: tessera, accento: accento),
                ],
                const SizedBox(height: 16),
                if (tessera.righe.isEmpty)
                  Text(
                    'Niente da elencare.',
                    style: testi.bodyMedium?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  )
                else
                  Scheda(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Column(
                      children: [
                        for (final riga in tessera.righe)
                          _RigaDellaFinestra(
                            riga: riga,
                            accento: accento,
                            quandoInvertita:
                                riga.comando && riga.entita.isNotEmpty
                                ? () => esegui(
                                    context,
                                    () => collegamento.stato!.comanda(
                                      'toggle',
                                      riga.entita,
                                    ),
                                  )
                                : null,
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _RigaDellaFinestra extends StatelessWidget {
  const _RigaDellaFinestra({
    required this.riga,
    required this.accento,
    this.quandoInvertita,
  });

  final Riga riga;
  final Color accento;
  final VoidCallback? quandoInvertita;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final acceso = riga.acceso == true;
    return ListTile(
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14),
      leading: Container(
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: acceso
              ? accento.withValues(alpha: 0.16)
              : colori.surfaceContainer,
          borderRadius: BorderRadius.circular(11),
        ),
        child:
            riga.simbolo.isNotEmpty && !riga.simbolo.contains(RegExp('[a-z]'))
            ? Text(riga.simbolo, style: const TextStyle(fontSize: 16))
            : Icon(
                acceso ? Icons.circle : Icons.circle_outlined,
                size: 12,
                color: acceso ? accento : colori.onSurfaceVariant,
              ),
      ),
      title: Text(riga.nome, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: riga.stanza.isEmpty
          ? null
          : Text(
              riga.stanza,
              style: testi.labelSmall?.copyWith(color: colori.onSurfaceVariant),
            ),
      trailing: quandoInvertita != null
          ? Switch(value: acceso, onChanged: (_) => quandoInvertita!())
          : Text(
              riga.valore,
              style: testi.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: acceso ? colori.onSurface : colori.onSurfaceVariant,
              ),
            ),
    );
  }
}

/* ─── Le persone ───────────────────────────────────────────────────────── */

class _CartaDellaPersona extends StatelessWidget {
  const _CartaDellaPersona(this.persona);
  final VistaDellaPersona persona;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final colore = coloreDaTesto(persona.colore);
    final (coloreDellaZona, iconaDellaZona) = switch (persona.presenza) {
      Presenza.casa => (Colori.bene, Icons.home_rounded),
      Presenza.fuori => (
        colori.onSurfaceVariant,
        Icons.directions_walk_rounded,
      ),
      Presenza.zona => (const Color(0xFF0284C7), Icons.place_rounded),
    };
    return Scheda(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 68,
                height: 68,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colore.withValues(alpha: 0.14),
                  border: Border.all(color: colore, width: 2.5),
                ),
                child: Text(
                  persona.emoji.isNotEmpty ? persona.emoji : persona.iniziali,
                  style: persona.emoji.isNotEmpty
                      ? const TextStyle(fontSize: 28)
                      : testi.titleLarge?.copyWith(
                          color: colore,
                          fontWeight: FontWeight.w700,
                        ),
                ),
              ),
              Positioned(
                right: -2,
                bottom: 2,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: persona.nota ? coloreDellaZona : colori.outline,
                    border: Border.all(
                      color: colori.surfaceContainerLowest,
                      width: 2.5,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            persona.nome,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: testi.titleMedium,
          ),
          const SizedBox(height: 6),
          if (persona.nota)
            Pillolina(
              testo: persona.etichettaDellaZona,
              icona: iconaDellaZona,
              colore: coloreDellaZona,
              piena: true,
            )
          else
            Pillolina(
              testo: 'non si sa',
              icona: Icons.help_outline_rounded,
              colore: colori.onSurfaceVariant,
            ),
          if (persona.distanza != null || persona.viaggio != null) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              alignment: WrapAlignment.center,
              children: [
                if (persona.distanza != null)
                  Pillolina(
                    testo:
                        '${numero(persona.distanza, cifre: persona.unitaDellaDistanza == 'm' ? 0 : 1)} ${persona.unitaDellaDistanza}',
                    icona: Icons.explore_outlined,
                    colore: colori.onSurfaceVariant,
                  ),
                if (persona.viaggio != null)
                  Pillolina(
                    testo: '${persona.viaggio} min',
                    icona: Icons.timer_outlined,
                    colore: colori.onSurfaceVariant,
                  ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          if (persona.batteria != null || persona.daQuanto != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
              decoration: BoxDecoration(
                color: colori.surfaceContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                children: [
                  if (persona.batteria != null)
                    _Dettaglio(
                      icona: _iconaDellaBatteria(
                        persona.batteria!,
                        persona.inCarica,
                      ),
                      testo: '${persona.batteria!.round()}%',
                      colore: persona.batteriaBassa ? Colori.male : null,
                    ),
                  if (persona.inCarica)
                    Icon(
                      Icons.bolt_rounded,
                      size: 15,
                      color: Colori.ambraScura,
                    ),
                  if (persona.daQuanto != null)
                    _Dettaglio(
                      icona: Icons.schedule_rounded,
                      testo: persona.daQuanto!.testo,
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

IconData _iconaDellaBatteria(num livello, bool inCarica) {
  if (inCarica) return Icons.battery_charging_full_rounded;
  if (livello <= 10) return Icons.battery_0_bar_rounded;
  if (livello <= 30) return Icons.battery_2_bar_rounded;
  if (livello <= 60) return Icons.battery_4_bar_rounded;
  if (livello <= 85) return Icons.battery_5_bar_rounded;
  return Icons.battery_full_rounded;
}

class _Dettaglio extends StatelessWidget {
  const _Dettaglio({required this.icona, required this.testo, this.colore});
  final IconData icona;
  final String testo;
  final Color? colore;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final tinta = colore ?? colori.onSurfaceVariant;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icona, size: 15, color: tinta),
        const SizedBox(width: 3),
        Text(
          testo,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: colore ?? colori.onSurface,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

/* ─── Le azioni rapide ─────────────────────────────────────────────────── */

class _AzioneRapida extends StatelessWidget {
  const _AzioneRapida(this.azione, {required this.quandoPremuta});
  final AzioneRapida azione;
  final VoidCallback quandoPremuta;

  static const _incorporate = {
    'luci': (Icons.lightbulb_rounded, '#f59e0b', 'Luci'),
    'clima': (Icons.ac_unit_rounded, '#0ea5e9', 'Clima'),
    'antifurto': (Icons.shield_rounded, '#7c3aed', 'Antifurto'),
    'lavatrice': (Icons.local_laundry_service_rounded, '#0ea5e9', 'Lavatrice'),
  };

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final incorporata = azione.tipo == 'builtin'
        ? _incorporate[azione.incorporata]
        : null;
    final colore = coloreDaTesto(
      azione.colore.isNotEmpty ? azione.colore : (incorporata?.$2 ?? '#0ea5e9'),
    );
    final nome = azione.nome.isNotEmpty
        ? azione.nome
        : (incorporata?.$3 ?? '?');
    final Widget disegno;
    if (azione.icona.isNotEmpty) {
      disegno = Text(azione.icona, style: const TextStyle(fontSize: 26));
    } else if (incorporata != null) {
      disegno = Icon(incorporata.$1, size: 28, color: colore);
    } else {
      disegno = Icon(Icons.bolt_rounded, size: 28, color: colore);
    }
    return Scheda(
      padding: const EdgeInsets.fromLTRB(12, 18, 12, 14),
      quandoPremuta: quandoPremuta,
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colore.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(18),
            ),
            child: disegno,
          ),
          const SizedBox(height: 10),
          Text(
            nome.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: testi.labelMedium?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }
}
