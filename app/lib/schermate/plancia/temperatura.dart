/// La pagina Temperatura: una scheda per stanza con la temperatura,
/// l'umidita' e un giudizio di comfort — freddo, comfort, caldo — con la
/// barra colorata che dice dove sta il valore.
///
/// Le pillole in alto filtrano per stanza. Le soglie sono quelle della
/// plancia web: sotto i 18 fa freddo, sopra i 26 fa caldo.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/numeri.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

const _freddo = Color(0xFF0EA5E9);
const _caldo = Color(0xFFEF4444);

/// «Freddo», «Comfort», «Caldo» — o niente, se la sonda tace.
(String, Color)? giudizioDiComfort(num? gradi) {
  if (gradi == null) return null;
  if (gradi < 18) return ('Freddo', _freddo);
  if (gradi > 26) return ('Caldo', _caldo);
  return ('Comfort', Colori.bene);
}

class PaginaDellaTemperatura extends StatefulWidget {
  const PaginaDellaTemperatura({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  State<PaginaDellaTemperatura> createState() => _PaginaDellaTemperaturaState();
}

class _PaginaDellaTemperaturaState extends State<PaginaDellaTemperatura> {
  String _scelta = '';

  @override
  Widget build(BuildContext context) {
    final casa = widget.collegamento.stato;
    final stanze = widget.configurazione.stanze
        .where((s) => s.temperatura.isNotEmpty)
        .toList();
    if (casa == null || stanze.isEmpty) {
      return const StatoVuoto(
        icona: Icons.thermostat_rounded,
        titolo: 'Nessuna sonda',
        sotto: 'Associa temperatura e umidita\' alle stanze dall\'Editor Dashboard.',
      );
    }
    final mostrate = _scelta.isEmpty
        ? stanze
        : stanze.where((s) => s.id == _scelta).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _PillolaDellaStanza(
                testo: 'Tutte',
                icona: const Icon(Icons.home_rounded, size: 18),
                conto: '${stanze.length}',
                scelta: _scelta.isEmpty,
                quando: () => setState(() => _scelta = ''),
              ),
              for (final stanza in stanze)
                _PillolaDellaStanza(
                  testo: stanza.nome,
                  icona: disegnoDellaStanza(stanza.icona, lato: 18),
                  scelta: _scelta == stanza.id,
                  quando: () => setState(() => _scelta = stanza.id),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        for (final stanza in mostrate) ...[
          _SchedaDellaStanza(
            stanza: stanza,
            temperatura: comeNumero(casa[stanza.temperatura]?.stato),
            umidita: comeNumero(
              casa[stanza.umidita.isNotEmpty
                      ? stanza.umidita
                      : stanza.temperatura.replaceAll(
                          '_temperature',
                          '_humidity',
                        )]
                  ?.stato,
            ),
          ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _PillolaDellaStanza extends StatelessWidget {
  const _PillolaDellaStanza({
    required this.testo,
    required this.icona,
    required this.scelta,
    required this.quando,
    this.conto,
  });
  final String testo;
  final Widget icona;
  final bool scelta;
  final VoidCallback quando;
  final String? conto;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: scelta ? colori.primaryContainer : colori.surfaceContainerLowest,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: scelta
                ? colori.primary.withValues(alpha: 0.4)
                : Colors.transparent,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: quando,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              children: [
                icona,
                const SizedBox(width: 8),
                Text(
                  testo.toUpperCase(),
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: scelta
                        ? colori.onPrimaryContainer
                        : colori.onSurface,
                  ),
                ),
                if (conto != null) ...[
                  const SizedBox(width: 8),
                  Bollino(conto!),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SchedaDellaStanza extends StatelessWidget {
  const _SchedaDellaStanza({
    required this.stanza,
    required this.temperatura,
    required this.umidita,
  });
  final Stanza stanza;
  final num? temperatura;
  final num? umidita;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final giudizio = giudizioDiComfort(temperatura);
    final tinta = giudizio?.$2 ?? colori.outline;
    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
      bordo: giudizio == null ? null : tinta.withValues(alpha: 0.35),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colori.surfaceContainer,
                  borderRadius: BorderRadius.circular(13),
                ),
                child: disegnoDellaStanza(
                  stanza.icona,
                  lato: 22,
                  colore: colori.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(stanza.nome, style: testi.titleMedium)),
              if (giudizio != null)
                Pillolina(
                  testo: giudizio.$1,
                  colore: giudizio.$2,
                  maiuscolo: true,
                ),
            ],
          ),
          const SizedBox(height: 12),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _Misura(
                    etichetta: 'Temperatura',
                    valore: temperatura == null
                        ? '—'
                        : numero(temperatura, cifre: 1),
                    unita: temperatura == null ? '' : '°',
                  ),
                ),
                VerticalDivider(width: 24, color: colori.outlineVariant),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _Misura(
                        etichetta: 'Umidità',
                        icona: Icons.water_drop_outlined,
                        valore: umidita == null
                            ? '—'
                            : numero(umidita, cifre: 0),
                        unita: umidita == null ? '' : '%',
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: LinearProgressIndicator(
                          value: ((umidita ?? 0) / 100).clamp(0.0, 1.0),
                          minHeight: 4,
                          color: _freddo,
                          backgroundColor: colori.surfaceContainerHigh,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          /* La barra dal freddo al caldo, con la tacca dove sta la stanza. */
          SizedBox(
            height: 14,
            child: LayoutBuilder(
              builder: (context, misure) {
                final quota = temperatura == null
                    ? null
                    : ((temperatura! - 10) / 25).clamp(0.0, 1.0);
                return Stack(
                  alignment: Alignment.bottomCenter,
                  children: [
                    Container(
                      height: 4,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        gradient: const LinearGradient(
                          colors: [
                            _freddo,
                            Color(0xFF22C55E),
                            Color(0xFFF59E0B),
                            _caldo,
                          ],
                          stops: [0, 0.35, 0.65, 1],
                        ),
                      ),
                    ),
                    if (quota != null)
                      Positioned(
                        left: (quota * (misure.maxWidth - 4)).clamp(
                          0.0,
                          misure.maxWidth - 4,
                        ),
                        bottom: 0,
                        child: Container(
                          width: 4,
                          height: 12,
                          decoration: BoxDecoration(
                            color: colori.onSurface,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 6),
        ],
      ),
    );
  }
}

class _Misura extends StatelessWidget {
  const _Misura({
    required this.etichetta,
    required this.valore,
    required this.unita,
    this.icona,
  });
  final String etichetta;
  final String valore;
  final String unita;
  final IconData? icona;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (icona != null) ...[
              Icon(icona, size: 12, color: _freddo),
              const SizedBox(width: 3),
            ],
            Text(
              etichetta.toUpperCase(),
              style: testi.labelSmall?.copyWith(
                color: colori.onSurfaceVariant,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              valore,
              style: testi.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.5,
              ),
            ),
            Text(
              unita,
              style: testi.bodyMedium?.copyWith(
                color: colori.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
