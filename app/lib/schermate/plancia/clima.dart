/// La pagina Clima: le unita', divise in Freddo e Caldo, ognuna con il suo
/// obiettivo, il cursore, la modalita' e il tasto di accensione.
///
/// E' la sezione Clima di DashboardModern. La pagina mostra solo le famiglie
/// che la casa ha davvero: con soli condizionatori la linguetta «Caldo» non
/// compare, e quando ne resta una sola sparisce anche l'interruttore fra le
/// due. Una pompa di calore sta in tutte e due. Il tasto di accensione accende
/// davvero, e un condizionatore acceso dalla scheda Freddo parte a
/// raffrescare, non a scaldare.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../plancia/comandi.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/numeri.dart';
import '../../plancia/tessere.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

const _freddo = Color(0xFF0EA5E9);
const _caldo = Color(0xFFF97316);

/// Le famiglie a cui un'unita' appartiene: `freddo`, `caldo`, o tutte e due.
List<String> famiglieDellUnita(String tipo) => switch (tipo) {
  'termo' => const ['caldo'],
  'pompa' => const ['freddo', 'caldo'],
  _ => const ['freddo'],
};

/// Il nome di una modalita', come si legge.
String nomeDelModo(String modo) => switch (modo) {
  'off' => 'Spento',
  'cool' => 'Freddo',
  'heat' => 'Caldo',
  'heat_cool' => 'Caldo/Freddo',
  'auto' => 'Auto',
  'dry' => 'Deumidifica',
  'fan_only' => 'Ventola',
  _ => modo,
};

String nomeDellaVentola(String modo) => switch (modo.toLowerCase()) {
  'auto' => 'Auto',
  'low' => 'Bassa',
  'medium' => 'Media',
  'high' => 'Alta',
  'quiet' || 'silent' => 'Silenziosa',
  'turbo' => 'Turbo',
  _ => modo,
};

/// Cosa sta facendo l'unita', in una parola: da `hvac_action` quando c'e',
/// altrimenti dalla modalita'.
(String, Color) _cosaFa(RigaDelClima riga, ColorScheme colori) {
  if (!riga.accesa) return ('Spento', colori.onSurfaceVariant);
  return switch (riga.azione.isNotEmpty ? riga.azione : riga.modo) {
    'cooling' || 'cool' => ('Raffresca', _freddo),
    'heating' || 'heat' => ('Riscalda', _caldo),
    'drying' || 'dry' => ('Deumidifica', _freddo),
    'fan' || 'fan_only' => ('Ventila', colori.onSurfaceVariant),
    'idle' => ('In attesa', colori.onSurfaceVariant),
    'heat_cool' || 'auto' => ('Auto', Colori.bene),
    'preheating' => ('Preriscalda', _caldo),
    'defrosting' => ('Sbrina', _freddo),
    _ => ('Accesa', Colori.bene),
  };
}

class PaginaDelClima extends StatefulWidget {
  const PaginaDelClima({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  State<PaginaDelClima> createState() => _PaginaDelClimaState();
}

class _PaginaDelClimaState extends State<PaginaDelClima> {
  String? _famiglia;

  @override
  Widget build(BuildContext context) {
    final casa = widget.collegamento.stato;
    final config = widget.configurazione;
    final unita = config.unitaClima;
    if (casa == null || unita.isEmpty) {
      return const StatoVuoto(
        icona: Icons.ac_unit_rounded,
        titolo: 'Nessuna unita\'',
        sotto: 'Aggiungile dall\'Editor Dashboard, scheda Clima.',
      );
    }
    final comandi = Comandi(casa);
    final righe = <(UnitaClima, RigaDelClima)>[
      for (final una in unita)
        if (rigaDelClima(una, (id) => casa[id]) case final riga?) (una, riga),
    ];
    final famiglie = [
      for (final f in const ['freddo', 'caldo'])
        if (righe.any((r) => famiglieDellUnita(r.$1.tipo).contains(f))) f,
    ];
    final scelta = famiglie.contains(_famiglia)
        ? _famiglia!
        : (famiglie.isEmpty ? 'freddo' : famiglie.first);
    final diQuesta = righe
        .where((r) => famiglieDellUnita(r.$1.tipo).contains(scelta))
        .toList();
    final accese = righe.where((r) => r.$2.accesa).length;
    final ambienti = righe.map((r) => r.$2.ambiente).whereType<num>().toList();
    final media = ambienti.isEmpty
        ? null
        : ambienti.reduce((a, b) => a + b) / ambienti.length;

    /* I piani, nell'ordine delle stanze: le unita' senza piano vanno in fondo,
     * senza intestazione se nessuna ce l'ha. */
    final perPiano = <String, List<(UnitaClima, RigaDelClima)>>{};
    for (final r in diQuesta) {
      perPiano
          .putIfAbsent(config.stanza(r.$1.stanzaId)?.piano ?? '', () => [])
          .add(r);
    }
    final piani = perPiano.keys.toList()
      ..sort((a, b) {
        if (a.isEmpty) return 1;
        if (b.isEmpty) return -1;
        return config.stanze
            .indexWhere((s) => s.piano == a)
            .compareTo(config.stanze.indexWhere((s) => s.piano == b));
      });

    Future<void> tutteA(bool acceso) => esegui(context, () async {
      for (final r in diQuesta) {
        if (acceso) {
          await comandi.modoDelClima(
            r.$2.entita,
            _modoDiAccensione(r.$2, scelta),
          );
        } else {
          await comandi.modoDelClima(r.$2.entita, 'off');
        }
      }
    });

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            RiquadroDiStato(
              etichetta: 'Accesi',
              valore: '$accese / ${righe.length}',
            ),
            const SizedBox(width: 10),
            if (media != null)
              RiquadroDiStato(
                etichetta: 'Ambiente medio',
                valore: '${numero(media, cifre: 1)}°',
              ),
          ],
        ),
        const SizedBox(height: 10),
        DueBottoni(
          sinistra: 'Accendi tutto',
          destra: 'Spegni tutto',
          iconaSinistra: Icons.power_settings_new_rounded,
          iconaDestra: Icons.power_settings_new_rounded,
          quandoSinistra: () => tutteA(true),
          quandoDestra: () => tutteA(false),
        ),
        if (famiglie.length > 1) ...[
          const SizedBox(height: 14),
          _Linguette(
            scelta: scelta,
            freddo: righe
                .where((r) => famiglieDellUnita(r.$1.tipo).contains('freddo'))
                .length,
            caldo: righe
                .where((r) => famiglieDellUnita(r.$1.tipo).contains('caldo'))
                .length,
            quandoScelta: (f) => setState(() => _famiglia = f),
          ),
        ],
        const SizedBox(height: 20),
        for (final piano in piani) ...[
          if (piano.isNotEmpty)
            InsegnaConConto(
              testo: piano,
              icona: Icon(
                Icons.layers_rounded,
                size: 16,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          for (final r in perPiano[piano]!) ...[
            SchedaDelClima(
              riga: r.$2,
              stanza: config.stanza(r.$1.stanzaId)?.nome ?? '',
              famiglia: scelta,
              comandi: comandi,
              comandabile: config.siComanda(r.$2.entita),
            ),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

/// Con che modalita' si accende un'unita' da questa famiglia: freddo per
/// raffrescare, caldo per scaldare, e comunque una che l'unita' dichiara.
String _modoDiAccensione(RigaDelClima riga, String famiglia) {
  final preferite = famiglia == 'caldo'
      ? ['heat', 'heat_cool', 'auto']
      : ['cool', 'heat_cool', 'auto'];
  for (final modo in preferite) {
    if (riga.modi.contains(modo)) return modo;
  }
  return riga.modi.where((m) => m != 'off').firstOrNull ??
      (famiglia == 'caldo' ? 'heat' : 'cool');
}

class _Linguette extends StatelessWidget {
  const _Linguette({
    required this.scelta,
    required this.freddo,
    required this.caldo,
    required this.quandoScelta,
  });
  final String scelta;
  final int freddo;
  final int caldo;
  final void Function(String) quandoScelta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    Widget linguetta(
      String famiglia,
      String testo,
      IconData icona,
      int quante,
      Color tinta,
    ) {
      final attiva = scelta == famiglia;
      return Expanded(
        child: Material(
          color: attiva ? tinta : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => quandoScelta(famiglia),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    icona,
                    size: 18,
                    color: attiva ? Colors.white : colori.onSurfaceVariant,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    testo.toUpperCase(),
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: attiva ? Colors.white : colori.onSurface,
                      letterSpacing: 1,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Bollino(
                    '$quante',
                    fondo: attiva ? Colors.white.withValues(alpha: 0.25) : null,
                    colore: attiva ? Colors.white : null,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scheda(
      padding: const EdgeInsets.all(4),
      child: Row(
        children: [
          linguetta('freddo', 'Freddo', Icons.ac_unit_rounded, freddo, _freddo),
          linguetta(
            'caldo',
            'Caldo',
            Icons.local_fire_department_rounded,
            caldo,
            _caldo,
          ),
        ],
      ),
    );
  }
}

/// La scheda di un'unita': cosa sta facendo, l'obiettivo in grande, il
/// cursore con la tacca dell'ambiente, la modalita', meno, piu', accensione.
class SchedaDelClima extends StatefulWidget {
  const SchedaDelClima({
    super.key,
    required this.riga,
    required this.stanza,
    required this.famiglia,
    required this.comandi,
    this.comandabile = true,
  });

  final RigaDelClima riga;
  final String stanza;
  final String famiglia;
  final Comandi comandi;
  final bool comandabile;

  @override
  State<SchedaDelClima> createState() => _SchedaDelClimaState();
}

class _SchedaDelClimaState extends State<SchedaDelClima> {
  double? _trascinato;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final riga = widget.riga;
    final tinta = widget.famiglia == 'caldo' ? _caldo : _freddo;
    final accesa = riga.accesa;
    final (cosaFa, coloreDiCosaFa) = _cosaFa(riga, colori);
    final minima = riga.minima.toDouble();
    final massima = riga.massima.toDouble();
    final obiettivo = (_trascinato ?? (riga.obiettivo ?? minima).toDouble())
        .clamp(minima, massima);
    final passo = riga.passo.toDouble();
    final divisioni = passo > 0 && massima > minima
        ? ((massima - minima) / passo).round()
        : null;
    final puo = widget.comandabile && riga.modo != 'unavailable';

    Future<void> imposta(num gradi) => esegui(
      context,
      () => widget.comandi.obiettivo(
        riga.entita,
        _sulPasso(gradi, minima, passo).clamp(minima, massima),
      ),
    );

    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      colore: accesa
          ? Color.alphaBlend(
              tinta.withValues(alpha: 0.07),
              colori.surfaceContainerLowest,
            )
          : null,
      bordo: accesa ? tinta.withValues(alpha: 0.35) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Cerchietto(
                icona: switch (riga.tipo) {
                  'termo' => Icons.local_fire_department_rounded,
                  'pompa' => Icons.heat_pump_rounded,
                  _ => Icons.ac_unit_rounded,
                },
                lato: 42,
                fondo: accesa
                    ? tinta.withValues(alpha: 0.16)
                    : colori.surfaceContainer,
                colore: accesa ? tinta : colori.onSurfaceVariant,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      riga.nome,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: testi.titleMedium,
                    ),
                    if (widget.stanza.isNotEmpty)
                      Text(
                        widget.stanza,
                        style: testi.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
              Pillolina(
                testo: cosaFa,
                colore: coloreDiCosaFa,
                maiuscolo: true,
                icona: accesa ? Icons.circle : null,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '${numero(obiettivo, cifre: obiettivo % 1 == 0 ? 0 : 1)}°',
                style: testi.displaySmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: accesa ? tinta : colori.onSurfaceVariant,
                  letterSpacing: -1.5,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'TARGET',
                style: testi.labelSmall?.copyWith(
                  color: colori.onSurfaceVariant,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
          Stack(
            alignment: Alignment.center,
            children: [
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 6,
                  tickMarkShape: SliderTickMarkShape.noTickMark,
                  activeTrackColor: accesa ? tinta : colori.outline,
                  thumbColor: accesa ? tinta : colori.outline,
                  inactiveTrackColor: colori.surfaceContainerHigh,
                  overlayColor: tinta.withValues(alpha: 0.15),
                ),
                child: Slider(
                  value: obiettivo,
                  min: minima,
                  max: massima,
                  divisions: divisioni,
                  onChanged: puo
                      ? (v) => setState(() => _trascinato = v)
                      : null,
                  onChangeEnd: (v) {
                    setState(() => _trascinato = null);
                    imposta(v);
                  },
                ),
              ),
              /* La tacca dell'ambiente: dove sta l'aria adesso, sulla stessa
               * scala dell'obiettivo. */
              if (riga.ambiente != null && massima > minima)
                Positioned.fill(
                  child: IgnorePointer(
                    child: LayoutBuilder(
                      builder: (context, misure) {
                        final quota =
                            ((riga.ambiente! - minima) / (massima - minima))
                                .clamp(0.0, 1.0);
                        const bordo = 24.0;
                        return Align(
                          alignment: Alignment(
                            -1 +
                                2 *
                                    (bordo +
                                        quota * (misure.maxWidth - 2 * bordo)) /
                                    misure.maxWidth,
                            0,
                          ),
                          child: Container(
                            width: 3,
                            height: 22,
                            decoration: BoxDecoration(
                              color: colori.onSurface,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              children: [
                Text(
                  '${numero(minima, cifre: 0)}°',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
                const Spacer(),
                if (riga.ambiente != null)
                  RichText(
                    text: TextSpan(
                      style: testi.bodyMedium?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                      children: [
                        const TextSpan(text: 'Ambiente '),
                        TextSpan(
                          text: '${numero(riga.ambiente, cifre: 1)}°',
                          style: TextStyle(
                            color: colori.onSurface,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (riga.umidita != null)
                          TextSpan(
                            text: '  ·  ${numero(riga.umidita, cifre: 0)}%',
                          ),
                      ],
                    ),
                  ),
                const Spacer(),
                Text(
                  '${numero(massima, cifre: 0)}°',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: puo ? () => _apriLeModalita(context) : null,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 44),
                    foregroundColor: accesa ? tinta : colori.onSurfaceVariant,
                    side: BorderSide(
                      color: accesa
                          ? tinta.withValues(alpha: 0.5)
                          : colori.outlineVariant,
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  icon: const Icon(Icons.tune_rounded, size: 18),
                  label: Text(
                    accesa
                        ? [
                            nomeDelModo(riga.modo),
                            if (riga.ventola.isNotEmpty)
                              nomeDellaVentola(riga.ventola),
                          ].join(' · ').toUpperCase()
                        : 'MODALITÀ',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(letterSpacing: 0.8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _Tondo(
                icona: Icons.remove_rounded,
                quando: puo && accesa ? () => imposta(obiettivo - passo) : null,
              ),
              const SizedBox(width: 6),
              _Tondo(
                icona: Icons.add_rounded,
                quando: puo && accesa ? () => imposta(obiettivo + passo) : null,
              ),
              const SizedBox(width: 6),
              _Tondo(
                icona: Icons.power_settings_new_rounded,
                pieno: accesa ? tinta : null,
                quando: puo
                    ? () => esegui(
                        context,
                        () => widget.comandi.modoDelClima(
                          riga.entita,
                          accesa
                              ? 'off'
                              : _modoDiAccensione(riga, widget.famiglia),
                        ),
                      )
                    : null,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _apriLeModalita(BuildContext context) =>
      showModalBottomSheet<void>(
        context: context,
        useSafeArea: true,
        builder: (contesto) {
          final riga = widget.riga;
          final testi = Theme.of(contesto).textTheme;
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(riga.nome, style: testi.titleLarge),
                const SizedBox(height: 14),
                if (riga.modi.isNotEmpty) ...[
                  const Insegna('Modalità'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final modo in riga.modi)
                        ChoiceChip(
                          label: Text(nomeDelModo(modo)),
                          selected: modo == riga.modo,
                          onSelected: (_) {
                            Navigator.of(contesto).pop();
                            esegui(
                              context,
                              () => widget.comandi.modoDelClima(
                                riga.entita,
                                modo,
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                ],
                if (riga.ventole.isNotEmpty) ...[
                  const Insegna('Ventola'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final modo in riga.ventole)
                        ChoiceChip(
                          label: Text(nomeDellaVentola(modo)),
                          selected: modo == riga.ventola,
                          onSelected: (_) {
                            Navigator.of(contesto).pop();
                            esegui(
                              context,
                              () => widget.comandi.ventola(riga.entita, modo),
                            );
                          },
                        ),
                    ],
                  ),
                ],
              ],
            ),
          );
        },
      );
}

/// Il grado sul passo dell'unita', partendo dal minimo: su una scala 40-70 col
/// mezzo grado i valori buoni sono 40, 40,5, 41 — non 0, 0,5, 1.
num _sulPasso(num gradi, num minimo, num passo) {
  if (passo <= 0) return gradi;
  final passi = ((gradi - minimo) / passo).round();
  final valore = minimo + passi * passo;
  return (valore * 100).round() / 100;
}

class _Tondo extends StatelessWidget {
  const _Tondo({required this.icona, this.quando, this.pieno});
  final IconData icona;
  final VoidCallback? quando;
  final Color? pieno;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Material(
      color: pieno ?? colori.surfaceContainer,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: quando,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(
            icona,
            size: 22,
            color: pieno != null
                ? Colors.white
                : (quando == null ? colori.outline : colori.onSurface),
          ),
        ),
      ),
    );
  }
}
