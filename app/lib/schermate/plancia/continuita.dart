/// La pagina Continuita': i gruppi di continuita', e la pagina del MiniPC.
///
/// Un UPS si guarda due volte in tutta la sua vita, e una delle due e' al
/// buio. Percio' la prima cosa e la piu' grande e' **se la rete c'e'**: a rete
/// presente la carica e' una conferma tranquilla, quando la rete cade quelle
/// stesse cifre diventano un conto alla rovescia, e allora quello che si vuole
/// sapere e' quanto tempo resta.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/numeri.dart';
import '../../plancia/tessere.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

const _azzurro = Color(0xFF0EA5E9);
const _ardesia = Color(0xFF334155);

class PaginaDellaContinuita extends StatelessWidget {
  const PaginaDellaContinuita({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  Widget build(BuildContext context) {
    final casa = collegamento.stato;
    final gruppi = configurazione.ups;
    if (casa == null || gruppi.isEmpty) {
      return const StatoVuoto(
        icona: Icons.battery_charging_full_rounded,
        titolo: 'Nessun gruppo di continuita\'',
        sotto: 'Associa il tuo UPS dall\'Editor Dashboard.',
      );
    }
    final letture = [
      for (final ups in gruppi) letturaDellUps(ups, (id) => casa[id]),
    ];
    final senzaRete = letture.where((l) => l.rete == false).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            RiquadroDiStato(
              etichetta: 'Rete',
              valore: senzaRete.isEmpty ? 'C\'e\'' : 'Manca',
              sotto: senzaRete.isEmpty
                  ? 'tutto alimentato'
                  : '${senzaRete.length} a batteria',
              colore: senzaRete.isEmpty ? Colori.bene : Colori.male,
            ),
          ],
        ),
        const SizedBox(height: 16),
        for (final lettura in letture) SchedaDellUps(lettura: lettura),
      ],
    );
  }
}

class SchedaDellUps extends StatelessWidget {
  const SchedaDellUps({super.key, required this.lettura});

  final LetturaDellUps lettura;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final aBatteria = lettura.rete == false;
    final tono = lettura.allarme ? Colori.male : Colori.bene;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Scheda(
        colore: lettura.allarme ? Colori.male.withValues(alpha: 0.07) : null,
        bordo: lettura.allarme ? Colori.male.withValues(alpha: 0.4) : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Cerchietto(
                  colore: tono,
                  icona: aBatteria
                      ? Icons.battery_alert_rounded
                      : Icons.power_rounded,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        lettura.nome.isEmpty ? 'Continuita\'' : lettura.nome,
                        style: testi.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        /* La domanda vera e' questa, e sta in grande dove si
                         * legge per prima. */
                        lettura.rete == null
                            ? 'Rete sconosciuta'
                            : aBatteria
                            ? 'Rete assente — va a batteria'
                            : 'Rete presente',
                        style: testi.bodyMedium?.copyWith(
                          color: aBatteria ? Colori.male : Colori.bene,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                if (aBatteria && lettura.autonomia != null)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        numero(lettura.autonomia, cifre: 0),
                        style: testi.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: Colori.male,
                        ),
                      ),
                      Text(
                        'minuti',
                        style: testi.bodySmall?.copyWith(
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
            if (lettura.batteria != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Text(
                    'BATTERIA',
                    style: testi.labelSmall?.copyWith(
                      letterSpacing: 1,
                      fontWeight: FontWeight.w700,
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${numero(lettura.batteria, cifre: 0)}%',
                    style: testi.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: lettura.scarica ? Colori.male : Colori.bene,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(5),
                child: LinearProgressIndicator(
                  value: (lettura.batteria! / 100).clamp(0, 1).toDouble(),
                  minHeight: 8,
                  backgroundColor: colori.surfaceContainerHighest,
                  valueColor: AlwaysStoppedAnimation(
                    lettura.scarica ? Colori.male : Colori.bene,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (lettura.carico != null)
                  Pillolina(
                    testo: 'Carico ${numero(lettura.carico, cifre: 0)}%',
                    colore: _azzurro,
                    icona: Icons.speed_rounded,
                  ),
                if (!aBatteria && lettura.autonomia != null)
                  Pillolina(
                    testo:
                        'Autonomia ${numero(lettura.autonomia, cifre: 0)} min',
                    colore: _azzurro,
                    icona: Icons.hourglass_bottom_rounded,
                  ),
                if (lettura.tensione != null)
                  Pillolina(
                    testo: '${numero(lettura.tensione, cifre: 0)} V',
                    colore: colori.onSurfaceVariant,
                    icona: Icons.electric_bolt_rounded,
                  ),
                if (lettura.potenza != null)
                  Pillolina(
                    testo: watt(lettura.potenza),
                    colore: colori.onSurfaceVariant,
                    icona: Icons.bolt_rounded,
                  ),
                if (lettura.temperatura != null)
                  Pillolina(
                    testo: '${numero(lettura.temperatura)}°',
                    colore: colori.onSurfaceVariant,
                    icona: Icons.thermostat_rounded,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/* ─── Il MiniPC ──────────────────────────────────────────────────────────── */

/// La pagina del server di casa: le sue misure, una per riga.
///
/// E' la stessa lettura della tessera, disegnata larga: quello che li' sta in
/// una didascalia qui e' un elenco, e le tre quote che contano — carico,
/// memoria, disco — hanno la loro barra.
class PaginaDelMinipc extends StatelessWidget {
  const PaginaDelMinipc({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  Widget build(BuildContext context) {
    final casa = collegamento.stato;
    if (casa == null) return const SizedBox.shrink();
    final (:righe, :carico, :quote) = lettureDelMinipc(
      configurazione,
      (id) => casa[id],
    );
    if (righe.isEmpty) {
      return const StatoVuoto(
        icona: Icons.dns_rounded,
        titolo: 'Nessun server',
        sotto: 'Associa le misure del tuo MiniPC dall\'Editor Dashboard.',
      );
    }
    final barre = [
      for (final chiave in const ['cpu', 'ram', 'disco'])
        if (quote[chiave] case final riga?) riga,
    ];
    final altre = righe.where((r) => !barre.contains(r)).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        if (carico != null)
          Row(
            children: [
              RiquadroDiStato(
                etichetta: 'Carico',
                valore: '${numero(carico, cifre: 0)}%',
                sotto: carico > 80 ? 'sotto sforzo' : 'tranquillo',
                colore: carico > 80 ? Colori.male : _ardesia,
              ),
            ],
          ),
        const SizedBox(height: 16),
        for (final riga in barre) _Barra(riga: riga),
        if (altre.isNotEmpty) ...[
          const SizedBox(height: 12),
          const Insegna('Le altre misure'),
          for (final riga in altre) _Misura(riga: riga),
        ],
      ],
    );
  }
}

class _Barra extends StatelessWidget {
  const _Barra({required this.riga});

  final Riga riga;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final quanto = ((riga.grezzo ?? 0) / 100).clamp(0, 1).toDouble();
    final caldo = (riga.grezzo ?? 0) > 80;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Scheda(
        child: Column(
          children: [
            Row(
              children: [
                Text(
                  riga.nome,
                  style: testi.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                Text(
                  riga.valore,
                  style: testi.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: caldo ? Colori.male : _ardesia,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(5),
              child: LinearProgressIndicator(
                value: quanto,
                minHeight: 8,
                backgroundColor: colori.surfaceContainerHighest,
                valueColor: AlwaysStoppedAnimation(
                  caldo ? Colori.male : _ardesia,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Misura extends StatelessWidget {
  const _Misura({required this.riga});

  final Riga riga;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Scheda(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                riga.nome,
                style: testi.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
            Text(
              riga.valore,
              style: testi.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: riga.acceso == false
                    ? colori.onSurfaceVariant
                    : riga.acceso == true
                    ? Colori.bene
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
