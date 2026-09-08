/// La pagina Luci: ogni luce e' una scheda con il suo interruttore e il
/// cursore della luminosita', raggruppate per stanza.
///
/// E' la sezione Luci di DashboardModern: in cima quante sono accese e i due
/// bottoni per tutte, poi le stanze nell'ordine della sezione Stanze, ognuna
/// col suo comando. La scheda di una luce e' una sola, e la usa anche la
/// pagina Stanze: la stessa luce non puo' avere due facce.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../plancia/comandi.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/luci.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

/// Il colore con cui si tinge una luce accesa: ambra, o quello che emette.
Color coloreDellaLuce(VistaDellaLuce luce) {
  if (!luce.accesa) return Colori.ambra;
  if (luce.rgb case final rgb? when luce.colorata) {
    return Color.fromARGB(255, rgb[0], rgb[1], rgb[2]);
  }
  if (luce.bianca && luce.kelvin != null) {
    /* Dal caldo al freddo: arancio a 2000 K, bianco azzurrino a 6500 K. */
    final quota =
        ((luce.kelvin! - luce.kelvinMinimo) /
                (luce.kelvinMassimo - luce.kelvinMinimo))
            .clamp(0.0, 1.0);
    return Color.lerp(const Color(0xFFF59E0B), const Color(0xFF93C5FD), quota)!;
  }
  return Colori.ambra;
}

class PaginaDelleLuci extends StatelessWidget {
  const PaginaDelleLuci({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  Widget build(BuildContext context) {
    final casa = collegamento.stato;
    final gruppi = configurazione.gruppiDiLuci();
    if (casa == null || gruppi.isEmpty) {
      return const StatoVuoto(
        icona: Icons.lightbulb_outline_rounded,
        titolo: 'Nessuna luce',
        sotto: 'Aggiungile dall\'Editor Dashboard, scheda Luci.',
      );
    }
    final comandi = Comandi(casa);
    final tutte = <VistaDellaLuce>[];
    final perGruppo = <GruppoDiLuci, List<VistaDellaLuce>>{};
    for (final gruppo in gruppi) {
      final viste = [
        for (final id in gruppo.entita)
          vistaDellaLuce(
            id,
            casa[id],
            nome: gruppo.nome(id),
            stanza: gruppo.stanza,
            comandabile: configurazione.siComanda(id),
          ),
      ];
      perGruppo[gruppo] = viste;
      tutte.addAll(viste);
    }
    final accese = tutte.where((l) => l.accesa).toList();
    Future<void> tutteA(bool acceso, Iterable<VistaDellaLuce> quali) =>
        esegui(context, () async {
          for (final luce in quali) {
            if (!luce.comandabile || !luce.disponibile) continue;
            await (acceso
                ? comandi.accendi(luce.entita)
                : comandi.spegni(luce.entita));
          }
        });

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            RiquadroDiStato(
              etichetta: 'Stato',
              valore: '${accese.length}/${tutte.length} accese',
            ),
          ],
        ),
        const SizedBox(height: 10),
        DueBottoni(
          sinistra: 'Accendi tutte',
          destra: 'Spegni tutte',
          iconaSinistra: Icons.lightbulb_rounded,
          iconaDestra: Icons.lightbulb_outline_rounded,
          quandoSinistra: () => tutteA(true, tutte),
          quandoDestra: () => tutteA(false, tutte),
        ),
        const SizedBox(height: 22),
        for (final voce in perGruppo.entries) ...[
          InsegnaConConto(
            testo: voce.key.stanza,
            conto:
                '${voce.value.where((l) => l.accesa).length}/${voce.value.length}',
            azione: TextButton(
              onPressed: () =>
                  tutteA(!voce.value.any((l) => l.accesa), voce.value),
              child: Text(
                voce.value.any((l) => l.accesa) ? 'Spegni' : 'Accendi',
              ),
            ),
          ),
          for (final luce in voce.value) ...[
            SchedaDellaLuce(luce: luce, comandi: comandi),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

/// La scheda di una luce: il disegno, il nome, com'e' messa, l'interruttore,
/// e sotto il cursore della luminosita' — solo se la luce lo sa fare.
class SchedaDellaLuce extends StatefulWidget {
  const SchedaDellaLuce({super.key, required this.luce, required this.comandi});

  final VistaDellaLuce luce;
  final Comandi comandi;

  @override
  State<SchedaDellaLuce> createState() => _SchedaDellaLuceState();
}

class _SchedaDellaLuceState extends State<SchedaDellaLuce> {
  /// Quello che il dito sta scegliendo: il cursore segue il dito, non la casa,
  /// finche' il dito non lo lascia.
  double? _trascinata;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final luce = widget.luce;
    final tinta = coloreDellaLuce(luce);
    final accesa = luce.accesa && luce.disponibile;
    final luminosita = _trascinata ?? (luce.luminosita ?? 0).toDouble();
    final puo = luce.comandabile && luce.disponibile;

    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      colore: accesa
          ? Color.alphaBlend(
              tinta.withValues(alpha: 0.10),
              colori.surfaceContainerLowest,
            )
          : null,
      bordo: accesa ? tinta.withValues(alpha: 0.45) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: accesa
                      ? tinta.withValues(alpha: 0.28)
                      : colori.surfaceContainer,
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(
                  luce.dominio == 'light'
                      ? Icons.lightbulb_outline_rounded
                      : Icons.power_rounded,
                  size: 24,
                  color: accesa
                      ? Color.alphaBlend(
                          tinta.withValues(alpha: 0.7),
                          colori.onSurface,
                        )
                      : colori.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      luce.nome,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: testi.titleMedium,
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            luce.stato,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: testi.labelSmall?.copyWith(
                              color: accesa
                                  ? Colori.ambraScura
                                  : colori.onSurfaceVariant,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Bollino(luce.tipo),
                      ],
                    ),
                  ],
                ),
              ),
              Switch(
                value: accesa,
                onChanged: puo
                    ? (_) => esegui(
                        context,
                        () => widget.comandi.inverti(luce.entita),
                      )
                    : null,
              ),
            ],
          ),
          if (luce.regolabile) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Text(
                  'LUMINOSITÀ',
                  style: testi.labelSmall?.copyWith(
                    color: colori.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
                const Spacer(),
                Text(
                  accesa ? '${luminosita.round()}%' : '—',
                  style: testi.labelLarge?.copyWith(
                    color: accesa ? Colori.ambraScura : colori.onSurfaceVariant,
                  ),
                ),
                if (luce.colorata || luce.bianca) ...[
                  const SizedBox(width: 4),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.tune_rounded, size: 20),
                    tooltip: 'Colore',
                    onPressed: puo ? () => _apriIlColore(context) : null,
                  ),
                ],
              ],
            ),
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                trackHeight: 6,
                activeTrackColor: tinta,
                thumbColor: tinta,
                inactiveTrackColor: colori.surfaceContainerHigh,
                overlayColor: tinta.withValues(alpha: 0.15),
              ),
              child: Slider(
                value: accesa ? luminosita.clamp(0, 100) : 0,
                max: 100,
                onChanged: puo ? (v) => setState(() => _trascinata = v) : null,
                onChangeEnd: (v) {
                  setState(() => _trascinata = null);
                  esegui(
                    context,
                    () => widget.comandi.luminosita(luce.entita, v.round()),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _apriIlColore(BuildContext context) =>
      showModalBottomSheet<void>(
        context: context,
        useSafeArea: true,
        builder: (_) =>
            _ColoreDellaLuce(luce: widget.luce, comandi: widget.comandi),
      );
}

/// I colori pronti, come sulla plancia web: dodici, piu' il bianco regolabile.
const _coloriPronti = [
  0xFFF97316,
  0xFFF59E0B,
  0xFFEAB308,
  0xFF84CC16,
  0xFF22C55E,
  0xFF14B8A6,
  0xFF0EA5E9,
  0xFF3B82F6,
  0xFF8B5CF6,
  0xFFD946EF,
  0xFFEC4899,
  0xFFEF4444,
];

class _ColoreDellaLuce extends StatefulWidget {
  const _ColoreDellaLuce({required this.luce, required this.comandi});
  final VistaDellaLuce luce;
  final Comandi comandi;

  @override
  State<_ColoreDellaLuce> createState() => _ColoreDellaLuceState();
}

class _ColoreDellaLuceState extends State<_ColoreDellaLuce> {
  double? _kelvin;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final luce = widget.luce;
    final kelvin =
        _kelvin ??
        (luce.kelvin ?? ((luce.kelvinMinimo + luce.kelvinMassimo) / 2))
            .toDouble();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(luce.nome, style: testi.titleLarge),
          const SizedBox(height: 16),
          if (luce.colorata) ...[
            Insegna('Colore'),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final colore in _coloriPronti)
                  InkWell(
                    borderRadius: BorderRadius.circular(999),
                    onTap: () {
                      final c = Color(colore);
                      esegui(
                        context,
                        () => widget.comandi.colore(luce.entita, [
                          (c.r * 255).round(),
                          (c.g * 255).round(),
                          (c.b * 255).round(),
                        ]),
                      );
                    },
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Color(colore),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: colori.surfaceContainerLowest,
                          width: 3,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Color(colore).withValues(alpha: 0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 18),
          ],
          if (luce.bianca) ...[
            Insegna(
              'Bianco',
              azione: Text('${kelvin.round()} K', style: testi.labelLarge),
            ),
            Slider(
              value: kelvin.clamp(
                luce.kelvinMinimo.toDouble(),
                luce.kelvinMassimo.toDouble(),
              ),
              min: luce.kelvinMinimo.toDouble(),
              max: luce.kelvinMassimo.toDouble(),
              onChanged: (v) => setState(() => _kelvin = v),
              onChangeEnd: (v) => esegui(
                context,
                () => widget.comandi.bianco(luce.entita, v.round()),
              ),
            ),
            Row(
              children: [
                Text(
                  'caldo',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
                const Spacer(),
                Text(
                  'freddo',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
          ],
          if (luce.effetti.isNotEmpty) ...[
            Insegna('Effetto'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final effetto in luce.effetti)
                  ChoiceChip(
                    label: Text(effetto),
                    selected: effetto == luce.effetto,
                    onSelected: (_) => esegui(
                      context,
                      () => widget.comandi.effetto(luce.entita, effetto),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
