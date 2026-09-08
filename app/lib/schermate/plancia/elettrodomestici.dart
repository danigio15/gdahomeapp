/// La pagina Elettrodomestici: cosa sta girando, e da quanto.
///
/// Un elettrodomestico non dice quasi mai se sta lavorando: dice quanti watt
/// sta assorbendo, e la differenza fra «in funzione» e «finito» sta tutta in
/// una soglia. Sopra i watt d'avvio sta lavorando; sotto quelli d'attesa e'
/// spento; in mezzo e' acceso ma fermo — la lavatrice che ha finito e tiene
/// la spia accesa.
///
/// Le soglie sono quelle scritte in configurazione, macchina per macchina:
/// una lavastoviglie e un forno non si somigliano.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/stato_della_casa.dart';
import '../../plancia/comandi.dart';
import '../../plancia/configurazione.dart';
import '../../plancia/numeri.dart';
import '../../plancia/tessere.dart';
import '../../vestito/pezzi.dart';
import '../../vestito/tema.dart';
import 'comune.dart';

const _azzurro = Color(0xFF06B6D4);

/// Il disegno di ogni tipo di macchina.
IconData disegnoDellElettrodomestico(String tipo) =>
    switch (tipo.toLowerCase()) {
      'lavatrice' ||
      'washer' ||
      'washing_machine' => Icons.local_laundry_service_rounded,
      'asciugatrice' || 'dryer' => Icons.dry_cleaning_rounded,
      'lavastoviglie' || 'dishwasher' => Icons.countertops_rounded,
      'forno' || 'oven' => Icons.microwave_rounded,
      'frigo' || 'fridge' || 'freezer' => Icons.kitchen_rounded,
      'condizionatore' || 'ac' => Icons.ac_unit_rounded,
      'scaldabagno' || 'boiler' => Icons.shower_rounded,
      _ => Icons.electrical_services_rounded,
    };

class PaginaDegliElettrodomestici extends StatefulWidget {
  const PaginaDegliElettrodomestici({
    super.key,
    required this.collegamento,
    required this.configurazione,
  });

  final Collegamento collegamento;
  final ConfigurazioneDellaPlancia configurazione;

  @override
  State<PaginaDegliElettrodomestici> createState() =>
      _PaginaDegliElettrodomesticiState();
}

class _PaginaDegliElettrodomesticiState
    extends State<PaginaDegliElettrodomestici> {
  /* Da quando una macchina e' scesa sotto la soglia: serve al ritardo di fine,
   * cioe' a non dire «ha finito» a ogni pausa della centrifuga. */
  final _tenute = <String, DateTime>{};

  @override
  Widget build(BuildContext context) {
    final casa = widget.collegamento.stato;
    final macchine = widget.configurazione.elettrodomestici
        .where((e) => e.abilitato)
        .toList();
    if (casa == null || macchine.isEmpty) {
      return const StatoVuoto(
        icona: Icons.local_laundry_service_rounded,
        titolo: 'Nessun elettrodomestico',
        sotto: 'Aggiungi le macchine da seguire dall\'Editor Dashboard.',
      );
    }
    final comandi = Comandi(casa);
    final adesso = DateTime.now();
    final letture = [
      for (final macchina in macchine)
        (
          macchina: macchina,
          lettura: modoDellElettrodomestico(
            macchina,
            (id) => casa[id],
            adesso: adesso,
            tenute: _tenute,
          ),
        ),
    ];
    final inFunzione = letture.where((v) => v.lettura.modo == 'run').length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            RiquadroDiStato(
              etichetta: 'In funzione',
              valore: '$inFunzione/${letture.length}',
              sotto: inFunzione == 0 ? 'tutto fermo' : 'macchine accese',
              colore: _azzurro,
            ),
            const SizedBox(width: 10),
            if (letture
                    .map((v) => v.lettura.watt)
                    .whereType<num>()
                    .fold<num?>(null, (a, b) => (a ?? 0) + b)
                case final somma?)
              RiquadroDiStato(
                etichetta: 'Assorbimento',
                valore: watt(somma),
                sotto: 'tutte insieme',
                colore: Colori.notteChiara,
              ),
          ],
        ),
        const SizedBox(height: 16),
        for (final voce in letture)
          SchedaDellElettrodomestico(
            macchina: voce.macchina,
            modo: voce.lettura.modo,
            assorbimento: voce.lettura.watt,
            oggi: comeNumero(casa[voce.macchina.energiaOggi]?.stato),
            rimanente: _rimanenteDi(casa, voce.macchina),
            stanza:
                widget.configurazione.stanza(voce.macchina.stanzaId)?.nome ??
                '',
            comandi: comandi,
            comandabile:
                voce.macchina.controllo.isNotEmpty &&
                widget.configurazione.siComanda(voce.macchina.controllo),
            acceso: casa[voce.macchina.controllo]?.accesa ?? false,
          ),
      ],
    );
  }

  /// Quanto manca, quando la macchina lo dice. Puo' essere in minuti o in
  /// un'ora di fine: si prende quello che c'e'.
  static String _rimanenteDi(StatoDellaCasa casa, Elettrodomestico macchina) {
    if (macchina.rimanente.isEmpty) return '';
    final letto = casa[macchina.rimanente];
    if (letto == null || letto.muta) return '';
    final minuti = comeNumero(letto.stato);
    if (minuti != null) {
      if (minuti <= 0) return '';
      final ore = minuti ~/ 60;
      final resto = (minuti % 60).round();
      return ore > 0
          ? '$ore h ${resto.toString().padLeft(2, '0')}'
          : '$resto min';
    }
    final quando = DateTime.tryParse(pulito(letto.stato));
    if (quando == null) return '';
    final manca = quando.difference(DateTime.now());
    if (manca.isNegative) return '';
    return manca.inHours > 0
        ? '${manca.inHours} h ${(manca.inMinutes % 60).toString().padLeft(2, '0')}'
        : '${manca.inMinutes} min';
  }
}

class SchedaDellElettrodomestico extends StatelessWidget {
  const SchedaDellElettrodomestico({
    super.key,
    required this.macchina,
    required this.modo,
    required this.comandi,
    this.assorbimento,
    this.oggi,
    this.rimanente = '',
    this.stanza = '',
    this.comandabile = false,
    this.acceso = false,
  });

  final Elettrodomestico macchina;

  /// `run`, `standby`, `off` o `unavailable`: le stesse parole della tessera.
  final String modo;
  final Comandi comandi;
  final num? assorbimento;
  final num? oggi;
  final String rimanente;
  final String stanza;
  final bool comandabile;
  final bool acceso;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final lavora = modo == 'run';
    final inAttesa = modo == 'standby';
    final muta = modo == 'unavailable';
    final tono = lavora
        ? _azzurro
        : inAttesa
        ? Colori.ambraScura
        : colori.onSurfaceVariant;
    final parola = switch (modo) {
      'run' => 'In funzione',
      'standby' => 'Accesa, ferma',
      'off' => 'Spenta',
      _ => 'Non raggiungibile',
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Scheda(
        colore: lavora ? _azzurro.withValues(alpha: 0.07) : null,
        bordo: lavora ? _azzurro.withValues(alpha: 0.35) : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Cerchietto(
                  colore: tono,
                  icona: disegnoDellElettrodomestico(macchina.tipo),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        macchina.nome.isEmpty ? macchina.id : macchina.nome,
                        style: testi.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        stanza.isEmpty ? parola : '$stanza · $parola',
                        style: testi.bodySmall?.copyWith(
                          color: lavora ? _azzurro : colori.onSurfaceVariant,
                          fontWeight: lavora
                              ? FontWeight.w600
                              : FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                if (comandabile && !muta)
                  Switch(
                    value: acceso,
                    onChanged: (vuole) => esegui(
                      context,
                      () => vuole
                          ? comandi.accendi(macchina.controllo)
                          : comandi.spegni(macchina.controllo),
                    ),
                  ),
              ],
            ),
            if (assorbimento != null ||
                oggi != null ||
                rimanente.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (rimanente.isNotEmpty)
                    Pillolina(
                      testo: 'Mancano $rimanente',
                      colore: _azzurro,
                      icona: Icons.timer_outlined,
                      piena: true,
                    ),
                  if (assorbimento != null)
                    Pillolina(
                      testo: watt(assorbimento),
                      colore: lavora ? _azzurro : colori.onSurfaceVariant,
                      icona: Icons.bolt_rounded,
                    ),
                  if (oggi != null)
                    Pillolina(
                      testo: 'Oggi ${numero(oggi)} kWh',
                      colore: colori.onSurfaceVariant,
                      icona: Icons.today_rounded,
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
