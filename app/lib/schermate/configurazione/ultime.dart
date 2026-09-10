/// Le ultime chiavi: il tasto rapido del clima, i programmi della lavatrice,
/// i gruppi delle luci, i sensori girati, e i disegni degli avvisi.
///
/// Sono le cose piccole, quelle che una alla volta sembrano non valere una
/// schermata — e che tutte insieme sono la differenza fra una plancia
/// configurata e una quasi configurata.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/entita.dart';
import '../../casa/plancia/home.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/// Il tasto rapido del clima: cosa fa quando lo si preme.
class SchermataDelClimaRapido extends StatelessWidget {
  const SchermataDelClimaRapido({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Il tasto rapido del clima',
    sotto:
        'Cosa fa il tasto che accende il clima. Una casella lasciata vuota '
        'vuol dire «non toccare»: chi ha un condizionatore senza ventola non '
        'deve ricevere un comando che non sa eseguire, e chi la temperatura la '
        'tiene dal termostato non vuole che il tasto gliela riscriva.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final adesso = leggiIlClimaRapido(
        quaderno.cambiate[chiaveDelClimaRapido] ??
            scatto.mappa(chiaveDelClimaRapido),
      );
      void segna(({String modo, double? gradi, String ventola}) quale) =>
          quaderno.segna(chiaveDelClimaRapido, climaRapidoDaScrivere(quale));
      return [
        Text('Cosa accende', style: Theme.of(dentro).textTheme.labelLarge),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final (modo, nome) in modiDelClima)
              ChoiceChip(
                label: Text(nome),
                selected: adesso.modo == modo,
                onSelected: (_) => segna((
                  modo: modo,
                  gradi: adesso.gradi,
                  ventola: adesso.ventola,
                )),
              ),
          ],
        ),
        const SizedBox(height: 22),
        Text('A quanti gradi', style: Theme.of(dentro).textTheme.labelLarge),
        const SizedBox(height: 4),
        Text(
          adesso.gradi == null
              ? 'La temperatura non si tocca: resta quella che c\'e\'.'
              : '${adesso.gradi} gradi',
          style: Theme.of(dentro).textTheme.bodyMedium,
        ),
        Row(
          children: [
            Expanded(
              child: Slider(
                value: adesso.gradi ?? 22,
                min: gradiMinimi,
                max: gradiMassimi,
                divisions: ((gradiMassimi - gradiMinimi) * 2).round(),
                label: '${adesso.gradi ?? 22}',
                onChanged: (quanti) => segna((
                  modo: adesso.modo,
                  gradi: quanti,
                  ventola: adesso.ventola,
                )),
              ),
            ),
            TextButton(
              onPressed: adesso.gradi == null
                  ? null
                  : () => segna((
                      modo: adesso.modo,
                      gradi: null,
                      ventola: adesso.ventola,
                    )),
              child: const Text('Non toccarla'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        CampoDiTesto(
          etichetta: 'Con che ventola',
          valore: adesso.ventola,
          suggerimento: 'auto, low, medium, high — vuoto per non toccarla',
          cambiato: (scritto) =>
              segna((modo: adesso.modo, gradi: adesso.gradi, ventola: scritto)),
        ),
        const SizedBox(height: 18),
        Text(
          'Ogni unita\' puo\' avere i suoi passi: «come e\' impostato ora viene '
          'attribuito quel valore a tutto», e invece la cameretta puo\' volere '
          '24 gradi e il salone 26. Quello che scrivi qui e\' il ripiego di chi '
          'non specifica.',
          style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
            color: Theme.of(dentro).colorScheme.onSurfaceVariant,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 10),
        _PerUnita(scatto: scatto, quaderno: quaderno),
      ];
    },
  );
}

/// I passi di una singola unita', quando non vanno bene quelli di casa.
class _PerUnita extends StatelessWidget {
  const _PerUnita({required this.scatto, required this.quaderno});

  final dynamic scatto;
  final Quaderno quaderno;

  @override
  Widget build(BuildContext context) {
    final segnate = quaderno.cambiate[chiaveDelClimaRapidoPerUnita];
    final per = segnate is Map
        ? Map<String, dynamic>.from(segnate)
        : scatto.mappa(chiaveDelClimaRapidoPerUnita) as Map<String, dynamic>;
    if (per.isEmpty) {
      return Text(
        'Nessuna unita\' ha i suoi: tutte usano quello scritto qui sopra.',
        style: Theme.of(context).textTheme.bodySmall
            ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final voce in per.entries)
          Card(
            margin: const EdgeInsets.symmetric(vertical: 3),
            child: ListTile(
              dense: true,
              title: Text(
                voce.key,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
              ),
              subtitle: Text(leggiIlClimaRapido(voce.value).modo),
              trailing: TextButton(
                onPressed: () {
                  final dopo = Map<String, dynamic>.from(per)..remove(voce.key);
                  quaderno.segna(chiaveDelClimaRapidoPerUnita, dopo);
                },
                child: const Text('Usa quello di casa'),
              ),
            ),
          ),
      ],
    );
  }
}

/// Un elenco di voci `nome + entita' + disegno`, con la sua chiave.
///
/// I programmi della lavatrice, le cose che scaldano, i gruppi di luci: tre
/// elenchi con la stessa forma. Ne serviva uno solo.
class SchermataDiRighe extends StatefulWidget {
  const SchermataDiRighe({
    super.key,
    required this.titolo,
    required this.sotto,
    required this.chiave,
    required this.unaCosa,
    required this.disegnoDiSerie,
    required this.collegamento,
    this.domini = const [],
    this.sottoTutto,
    this.controlla,
  });

  final String titolo;
  final String sotto;
  final String chiave;
  final String unaCosa;
  final String disegnoDiSerie;
  final Collegamento collegamento;
  final List<String> domini;
  final List<Widget> Function(dynamic scatto, Quaderno quaderno)? sottoTutto;

  /// Cosa dire sotto l'entita' scelta: `(va bene, parola)`. Le voci del
  /// Report vogliono un contatore cumulativo, e l'editor della plancia lo
  /// dice riga per riga invece di lasciar scoprire lo storico vuoto.
  final (bool, String) Function(String entita, Entita? stato)? controlla;

  @override
  State<SchermataDiRighe> createState() => _SchermataDiRigheState();
}

class _SchermataDiRigheState extends State<SchermataDiRighe> {
  List<Map<String, String>>? _righe;
  int _daQualeScatto = -1;

  void _segna(Quaderno quaderno) {
    quaderno.segna(widget.chiave, [
      for (final una in _righe!)
        {
          for (final voce in una.entries)
            if (voce.value.trim().isNotEmpty) voce.key: voce.value.trim(),
        },
    ]);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: widget.titolo,
    sotto: widget.sotto,
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      if (_righe == null || _daQualeScatto != scatto.revisione) {
        _righe = [
          for (final una in scatto.oggetti(widget.chiave))
            {
              'name': '${una['name'] ?? ''}',
              'entity': '${una['entity'] ?? ''}',
              'icon': '${una['icon'] ?? widget.disegnoDiSerie}',
            },
        ];
        _daQualeScatto = scatto.revisione;
      }
      final righe = _righe!;
      return [
        if (righe.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.playlist_add_rounded,
              titolo: 'Non ce n\'e\' ancora',
              sotto: 'Aggiungi ${widget.unaCosa} qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, una) in righe.indexed)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 4),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: CampoDiTesto(
                            etichetta: 'Come si chiama',
                            valore: una['name'] ?? '',
                            cambiato: (scritto) {
                              una['name'] = scritto;
                              _segna(quaderno);
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: CampoDiTesto(
                            etichetta: 'Disegno',
                            valore: una['icon'] ?? '',
                            suggerimento: widget.disegnoDiSerie,
                            cambiato: (scritto) {
                              una['icon'] = scritto;
                              _segna(quaderno);
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    CampoDiEntita(
                      etichetta: 'Quale entita\'',
                      contesto: widget.unaCosa,
                      domini: widget.domini,
                      valore: una['entity'] ?? '',
                      collegamento: widget.collegamento,
                      cambiato: (scritto) {
                        una['entity'] = scritto;
                        _segna(quaderno);
                      },
                    ),
                    if (widget.controlla != null &&
                        (una['entity'] ?? '').trim().isNotEmpty)
                      Builder(
                        builder: (dentro) {
                          final id = una['entity']!.trim();
                          final (bene, parola) = widget.controlla!(
                            id,
                            widget.collegamento.stato?[id],
                          );
                          return Padding(
                            padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
                            child: Text(
                              parola,
                              style: Theme.of(dentro).textTheme.bodySmall
                                  ?.copyWith(
                                    color: bene
                                        ? Theme.of(dentro)
                                              .colorScheme
                                              .onSurfaceVariant
                                        : Theme.of(dentro).colorScheme.error,
                                  ),
                            ),
                          );
                        },
                      ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        onPressed: () {
                          righe.removeAt(posto);
                          _segna(quaderno);
                        },
                        icon: const Icon(Icons.delete_outline_rounded),
                        label: const Text('Togli'),
                        style: TextButton.styleFrom(
                          foregroundColor: Theme.of(dentro).colorScheme.error,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        const SizedBox(height: 12),
        FilledButton.tonalIcon(
          onPressed: () {
            righe.add({
              'name': '',
              'entity': '',
              'icon': widget.disegnoDiSerie,
            });
            _segna(quaderno);
          },
          icon: const Icon(Icons.add_rounded),
          label: Text('Aggiungi ${widget.unaCosa}'),
        ),
        if (widget.sottoTutto != null) ...[
          const SizedBox(height: 24),
          ...widget.sottoTutto!(scatto, quaderno),
        ],
      ];
    },
  );
}

/// Le aperture il cui sensore dice il contrario.
class SchermataDeiVersi extends StatelessWidget {
  const SchermataDeiVersi({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'I sensori girati',
    sotto:
        'Capita, e non e\' colpa di nessuno: un contatto magnetico montato al '
        'contrario dice «chiuso» quando la finestra e\' aperta. Qui si '
        'raddrizza, senza toccare niente in Home Assistant.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final segnati = quaderno.cambiate[chiaveDeiVersi];
      final quali = segnati is List
          ? [
              for (final uno in segnati)
                if ('$uno'.trim().isNotEmpty) '$uno'.trim(),
            ]
          : scatto.parole(chiaveDeiVersi);
      return [
        if (quali.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.swap_vert_rounded,
              titolo: 'Nessun sensore girato',
              sotto: 'Tutti dicono quello che vedono.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, quale) in quali.indexed)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 3),
              child: ListTile(
                title: Text(
                  quale,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                ),
                trailing: TextButton(
                  onPressed: () => quaderno.segna(
                    chiaveDeiVersi,
                    [...quali]..removeAt(posto),
                  ),
                  child: const Text('Raddrizzato'),
                ),
              ),
            ),
        const SizedBox(height: 16),
        CampoDiEntita(
          etichetta: 'Girane un altro',
          contesto: 'di un\'apertura',
          domini: const ['binary_sensor', 'cover'],
          valore: '',
          collegamento: collegamento,
          cambiato: (scritto) {
            if (scritto.trim().isEmpty || quali.contains(scritto.trim())) {
              return;
            }
            quaderno.segna(chiaveDeiVersi, [...quali, scritto.trim()]);
          },
        ),
      ];
    },
  );
}
