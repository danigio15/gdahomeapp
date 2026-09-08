/// La pagina Energia: cosa entra, cosa esce, e dove va a finire.
///
/// In cima i quattro numeri che rispondono a tutto — sole, rete, casa,
/// batteria — ognuno col verso scritto a parole, perche' su questa pagina il
/// segno e' tutto: **positivo si preleva, negativo si immette**, e leggerlo al
/// contrario vuol dire raccontare che si sta guadagnando mentre si sta
/// pagando.
///
/// Sotto, quanta parte del consumo di casa se la sta facendo il sole: e' la
/// sola domanda per cui si guarda un impianto in un giorno normale. Poi i
/// carichi, dal piu' affamato in giu': quello in cima e' quello da spegnere.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/energia.dart';
import '../../plancia/numeri.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

const _arancio = Color(0xFFF97316);
const _sole = Color(0xFFF59E0B);
const _rete = Color(0xFF3B82F6);
const _batteria = Color(0xFF10B981);

class PaginaDellEnergia extends StatelessWidget {
  const PaginaDellEnergia({
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
    final letture = lettureDegliImpianti(configurazione, (id) => casa[id]);
    final carichi = lettureDeiCarichi(configurazione, (id) => casa[id])
      ..sort((una, altra) => (altra.watt ?? -1).compareTo(una.watt ?? -1));
    if (letture.every((l) => !l.ceQualcosa) && carichi.isEmpty) {
      return const StatoVuoto(
        icona: Icons.bolt_rounded,
        titolo: 'Nessun impianto',
        sotto: 'Associa i contatori e il fotovoltaico dall\'Editor Dashboard.',
      );
    }
    final insieme = letture.length > 1
        ? sommaDegliImpianti(letture)
        : letture.first;
    final prezzi = PrezziDellEnergia.dalla(configurazione);
    final spesa = prezzi.spesaDi(insieme.oggi);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            RiquadroDiStato(
              etichetta: 'Casa adesso',
              valore: watt(insieme.casa),
              sotto: insieme.solare == null
                  ? null
                  : 'sole ${watt(insieme.solare)}',
              colore: _arancio,
            ),
            const SizedBox(width: 10),
            if (insieme.oggi != null)
              RiquadroDiStato(
                etichetta: 'Oggi',
                valore: '${numero(insieme.oggi)} kWh',
                sotto: spesa == null ? null : '${numero(spesa, cifre: 2)} €',
                colore: Colori.notteChiara,
              ),
          ],
        ),
        const SizedBox(height: 16),
        _IlFlusso(lettura: insieme),
        if (insieme.quotaDelSole case final quota?) ...[
          const SizedBox(height: 16),
          _QuotaDelSole(quota: quota, lettura: insieme),
        ],
        if (letture.length > 1) ...[
          const SizedBox(height: 20),
          const Insegna('Gli impianti'),
          for (final lettura in letture) _RigaDellImpianto(lettura: lettura),
        ],
        if (carichi.isNotEmpty) ...[
          const SizedBox(height: 20),
          InsegnaConConto(testo: 'Carichi', conto: '${carichi.length}'),
          for (final voce in carichi)
            _RigaDelCarico(
              voce: voce,
              /* La barra si misura sul piu' affamato, non sul consumo di
               * casa: se no con la pompa di calore accesa tutti gli altri
               * sarebbero trattini indistinguibili. */
              massimo: carichi
                  .map((c) => c.watt ?? 0)
                  .fold<num>(1, (a, b) => a > b ? a : b),
              stanza: configurazione.stanza(voce.carico.stanzaId)?.nome ?? '',
            ),
        ],
      ],
    );
  }
}

/// I quattro nodi, col verso scritto a parole.
class _IlFlusso extends StatelessWidget {
  const _IlFlusso({required this.lettura});

  final LetturaDellImpianto lettura;

  @override
  Widget build(BuildContext context) {
    final nodi = <Widget>[
      if (lettura.solare != null)
        _Nodo(
          nome: 'Solare',
          icona: Icons.wb_sunny_rounded,
          colore: _sole,
          valore: watt(lettura.solare),
          sotto: lettura.solareOggi == null
              ? 'produzione'
              : 'oggi ${numero(lettura.solareOggi)} kWh',
          acceso: (lettura.solare ?? 0) > 0,
        ),
      if (lettura.rete != null)
        _Nodo(
          nome: 'Rete',
          icona: lettura.siImmette
              ? Icons.upload_rounded
              : Icons.download_rounded,
          colore: _rete,
          /* Il segno lo dice la parola: il numero si scrive senza, perche'
           * «−1,2 kW immessi» si legge due volte per capirlo una. */
          valore: watt(lettura.rete?.abs()),
          sotto: lettura.siImmette
              ? 'in immissione'
              : lettura.siPreleva
              ? 'in prelievo'
              : 'in pareggio',
          acceso: (lettura.rete ?? 0) != 0,
        ),
      if (lettura.casa != null)
        _Nodo(
          nome: 'Casa',
          icona: Icons.home_rounded,
          colore: _arancio,
          valore: watt(lettura.casa),
          sotto: lettura.oggi == null
              ? 'consumo'
              : 'oggi ${numero(lettura.oggi)} kWh',
          acceso: (lettura.casa ?? 0) > 0,
        ),
      if (lettura.batteria != null || lettura.carica != null)
        _Nodo(
          nome: 'Batteria',
          icona: Icons.battery_charging_full_rounded,
          colore: _batteria,
          valore: lettura.carica != null
              ? '${numero(lettura.carica, cifre: 0)}%'
              : watt(lettura.batteria!.abs()),
          sotto: lettura.siCarica
              ? 'in carica ${watt(lettura.batteria)}'
              : lettura.siScarica
              ? 'sta dando ${watt(lettura.batteria!.abs())}'
              : 'a riposo',
          acceso: (lettura.batteria ?? 0) != 0,
        ),
    ];
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final nodo in nodi)
          LayoutBuilder(
            builder: (context, _) => SizedBox(
              width: (MediaQuery.sizeOf(context).width - 32 - 10) / 2,
              child: nodo,
            ),
          ),
      ],
    );
  }
}

class _Nodo extends StatelessWidget {
  const _Nodo({
    required this.nome,
    required this.icona,
    required this.colore,
    required this.valore,
    required this.sotto,
    required this.acceso,
  });

  final String nome;
  final IconData icona;
  final Color colore;
  final String valore;
  final String sotto;
  final bool acceso;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scheda(
      padding: const EdgeInsets.all(14),
      colore: acceso ? colore.withValues(alpha: 0.08) : null,
      bordo: acceso ? colore.withValues(alpha: 0.3) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                icona,
                size: 18,
                color: acceso ? colore : colori.onSurfaceVariant,
              ),
              const SizedBox(width: 6),
              Text(
                nome.toUpperCase(),
                style: testi.labelSmall?.copyWith(
                  letterSpacing: 1,
                  fontWeight: FontWeight.w700,
                  color: colori.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            valore,
            style: testi.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: acceso ? colore : null,
            ),
          ),
          Text(
            sotto,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

/// Quanta parte del consumo se la sta facendo il sole.
class _QuotaDelSole extends StatelessWidget {
  const _QuotaDelSole({required this.quota, required this.lettura});

  final int quota;
  final LetturaDellImpianto lettura;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'DAL SOLE',
                style: testi.labelSmall?.copyWith(
                  letterSpacing: 1,
                  fontWeight: FontWeight.w700,
                  color: colori.onSurfaceVariant,
                ),
              ),
              const Spacer(),
              Text(
                '$quota%',
                style: testi.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: _sole,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: quota / 100,
              minHeight: 10,
              backgroundColor: colori.surfaceContainerHighest,
              valueColor: const AlwaysStoppedAnimation(_sole),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            quota >= 100
                ? 'La casa sta andando tutta a sole.'
                : quota == 0
                ? 'Adesso la casa va tutta da rete o batteria.'
                : 'Il resto arriva da rete o batteria.',
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _RigaDellImpianto extends StatelessWidget {
  const _RigaDellImpianto({required this.lettura});

  final LetturaDellImpianto lettura;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Scheda(
        child: Row(
          children: [
            Cerchietto(colore: _arancio, icona: Icons.electric_meter_rounded),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lettura.nome,
                    style: testi.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    [
                      if (lettura.solare != null)
                        'sole ${watt(lettura.solare)}',
                      if (lettura.rete != null)
                        '${lettura.siImmette ? 'immette' : 'preleva'} '
                            '${watt(lettura.rete!.abs())}',
                    ].join(' · '),
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              watt(lettura.casa),
              style: testi.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: _arancio,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RigaDelCarico extends StatelessWidget {
  const _RigaDelCarico({
    required this.voce,
    required this.massimo,
    required this.stanza,
  });

  final LetturaDelCarico voce;
  final num massimo;
  final String stanza;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final tono = coloreDaTesto(voce.carico.colore, _arancio);
    final acceso = (voce.watt ?? 0) > 0;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Scheda(
        child: Column(
          children: [
            Row(
              children: [
                disegnoDellaStanza(
                  voce.carico.icona.isEmpty ? '🔌' : voce.carico.icona,
                  lato: 20,
                  colore: acceso ? tono : colori.onSurfaceVariant,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        voce.carico.etichetta,
                        style: testi.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (stanza.isNotEmpty || voce.oggi != null)
                        Text(
                          [
                            if (stanza.isNotEmpty) stanza,
                            if (voce.oggi != null)
                              'oggi ${numero(voce.oggi)} kWh',
                          ].join(' · '),
                          style: testi.bodySmall?.copyWith(
                            color: colori.onSurfaceVariant,
                          ),
                        ),
                    ],
                  ),
                ),
                Text(
                  watt(voce.watt),
                  style: testi.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: acceso ? tono : colori.onSurfaceVariant,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: ((voce.watt ?? 0) / massimo).clamp(0, 1).toDouble(),
                minHeight: 6,
                backgroundColor: colori.surfaceContainerHighest,
                valueColor: AlwaysStoppedAnimation(tono),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
