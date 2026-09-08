/// La pagina Prese: gli interruttori di casa, raccolti per stanza.
///
/// Una presa e' la cosa piu' semplice che ci sia — accesa o spenta — e la
/// pagina non prova a farla sembrare altro: un elenco, un interruttore per
/// riga, e in cima quante ne sono accese. Chi ha un misuratore attaccato alla
/// presa lo vede accanto, perche' «quanto sta consumando» e' l'unica altra
/// domanda che si fa a una presa.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/entita.dart';
import '../../casa/stato_della_casa.dart';
import '../../plancia/comandi.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/numeri.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

const _grigio = Color(0xFF475569);

class PaginaDellePrese extends StatelessWidget {
  const PaginaDellePrese({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  Widget build(BuildContext context) {
    final casa = collegamento.stato;
    final prese = configurazione.prese;
    if (casa == null || prese.isEmpty) {
      return const StatoVuoto(
        icona: Icons.power_rounded,
        titolo: 'Nessuna presa',
        sotto: 'Aggiungi le prese da comandare dall\'Editor Dashboard.',
      );
    }
    final comandi = Comandi(casa);
    final accese = prese.where((p) => casa[p.entita]?.accesa ?? false).toList();

    /* Per stanza, come tutto il resto della plancia: chi cerca la presa del
     * ferro da stiro la cerca in stireria, non in un elenco alfabetico. */
    final perStanza = <String, List<Presa>>{};
    for (final presa in prese) {
      perStanza.putIfAbsent(presa.stanzaId, () => []).add(presa);
    }
    final stanze = configurazione.stanze;
    final ordinate = [
      for (final stanza in stanze)
        if (perStanza[stanza.id] case final elenco?) (stanza.nome, elenco),
      if (perStanza.entries
              .where((v) => stanze.every((s) => s.id != v.key))
              .expand((v) => v.value)
              .toList()
          case final sciolte)
        if (sciolte.isNotEmpty) ('Altre prese', sciolte),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            RiquadroDiStato(
              etichetta: 'Stato',
              valore: '${accese.length}/${prese.length}',
              sotto: accese.length == 1 ? 'accesa' : 'accese',
              colore: _grigio,
            ),
          ],
        ),
        const SizedBox(height: 12),
        DueBottoni(
          sinistra: 'Accendi tutte',
          destra: 'Spegni tutte',
          iconaSinistra: Icons.power_rounded,
          iconaDestra: Icons.power_off_rounded,
          quandoSinistra: () => esegui(context, () async {
            for (final presa in prese) {
              await comandi.accendi(presa.entita);
            }
          }),
          quandoDestra: () => esegui(context, () async {
            for (final presa in prese) {
              await comandi.spegni(presa.entita);
            }
          }),
        ),
        for (final (nome, elenco) in ordinate) ...[
          const SizedBox(height: 18),
          InsegnaConConto(
            testo: nome,
            conto:
                '${elenco.where((p) => casa[p.entita]?.accesa ?? false).length}'
                '/${elenco.length}',
          ),
          for (final presa
              in elenco..sort((a, b) => a.ordine.compareTo(b.ordine)))
            SchedaDellaPresa(
              presa: presa,
              stato: casa[presa.entita],
              consumo: _consumoDi(casa, presa),
              comandi: comandi,
              comandabile: configurazione.siComanda(presa.entita),
            ),
        ],
      ],
    );
  }

  /// I watt che questa presa dichiara, quando li dichiara.
  ///
  /// Home Assistant li mette in un attributo su alcune integrazioni e in un
  /// sensore gemello su altre: si guardano tutt'e due, perche' la stessa presa
  /// di due marche diverse li scrive in due posti diversi.
  static num? _consumoDi(StatoDellaCasa casa, Presa presa) {
    final letto = casa[presa.entita];
    final dallAttributo = comeNumero(
      letto?.attributi['current_power_w'] ?? letto?.attributi['power'],
    );
    if (dallAttributo != null) return dallAttributo;
    final gemello = casa['sensor.${presa.entita.split('.').last}_power'];
    return comeNumero(gemello?.stato);
  }
}

class SchedaDellaPresa extends StatelessWidget {
  const SchedaDellaPresa({
    super.key,
    required this.presa,
    required this.stato,
    required this.comandi,
    this.consumo,
    this.comandabile = true,
  });

  final Presa presa;
  final Entita? stato;
  final Comandi comandi;
  final num? consumo;
  final bool comandabile;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final accesa = stato?.accesa ?? false;
    final muta = stato == null || stato!.muta;

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Scheda(
        colore: accesa ? Colori.ambra.withValues(alpha: 0.08) : null,
        bordo: accesa ? Colori.ambra.withValues(alpha: 0.35) : null,
        child: Row(
          children: [
            disegnoDellaStanza(
              presa.icona,
              lato: 22,
              colore: accesa ? Colori.ambraScura : colori.onSurfaceVariant,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    presa.etichetta,
                    style: testi.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    muta
                        ? 'Non raggiungibile'
                        : consumo != null && accesa
                        ? '${accesa ? 'Accesa' : 'Spenta'} · ${watt(consumo)}'
                        : accesa
                        ? 'Accesa'
                        : 'Spenta',
                    style: testi.bodySmall?.copyWith(
                      color: accesa
                          ? Colori.ambraScura
                          : colori.onSurfaceVariant,
                      fontWeight: accesa ? FontWeight.w600 : FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Switch(
              value: accesa,
              onChanged: comandabile && !muta
                  ? (acceso) => esegui(
                      context,
                      () => acceso
                          ? comandi.accendi(presa.entita)
                          : comandi.spegni(presa.entita),
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
