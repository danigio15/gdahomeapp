/// Le parole della plancia, e cosa si fa sparire.
///
/// Quattro schermate che cambiano come la plancia si legge invece di cosa
/// mostra: i nomi delle pagine, le parole riscritte, le caselle rinominate, e
/// i pezzi che si sono fatti sparire.
///
/// Sono mappe da chiave a testo: si aggiunge una riga, si scrive cosa deve
/// dire, e la plancia lo dice.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/home.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/// Una mappa da chiave a testo, come schermata.
class SchermataDiParole extends StatefulWidget {
  const SchermataDiParole({
    super.key,
    required this.titolo,
    required this.sotto,
    required this.chiave,
    required this.collegamento,
    required this.cosaEChiave,
    required this.cosaEValore,
    this.esempio = '',
  });

  final String titolo;
  final String sotto;
  final String chiave;
  final Collegamento collegamento;

  /// Cosa si scrive a sinistra: «la parola di prima», «il nome della casella».
  final String cosaEChiave;

  /// Cosa si scrive a destra: «cosa deve dire».
  final String cosaEValore;

  final String esempio;

  @override
  State<SchermataDiParole> createState() => _SchermataDiParoleState();
}

class _SchermataDiParoleState extends State<SchermataDiParole> {
  List<(String, String)>? _righe;
  int _daQualeScatto = -1;

  List<(String, String)> _leggi(Scatto scatto) {
    if (_righe == null || _daQualeScatto != scatto.revisione) {
      final mappa = scatto.mappa(widget.chiave);
      _righe = [
        for (final voce in mappa.entries) (voce.key, '${voce.value ?? ''}'),
      ];
      _daQualeScatto = scatto.revisione;
    }
    return _righe!;
  }

  void _segna(Quaderno quaderno) {
    /* Una riga senza chiave non e' una sostituzione: e' una riga in mezzo. Si
     * tiene sullo schermo finche' si compila, e non si salva. */
    quaderno.segna(widget.chiave, {
      for (final (chiave, valore) in _righe!)
        if (chiave.trim().isNotEmpty) chiave.trim(): valore,
    });
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: widget.titolo,
    sotto: widget.sotto,
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final righe = _leggi(scatto);
      return [
        if (righe.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.edit_note_rounded,
              titolo: 'Non c\'e\' niente di riscritto',
              sotto: 'La plancia dice quello che ha sempre detto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, riga) in righe.indexed)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 4),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                child: Column(
                  children: [
                    CampoDiTesto(
                      etichetta: widget.cosaEChiave,
                      valore: riga.$1,
                      mono: true,
                      suggerimento: widget.esempio,
                      cambiato: (scritto) {
                        righe[posto] = (scritto, riga.$2);
                        _segna(quaderno);
                      },
                    ),
                    const SizedBox(height: 12),
                    CampoDiTesto(
                      etichetta: widget.cosaEValore,
                      valore: riga.$2,
                      cambiato: (scritto) {
                        righe[posto] = (righe[posto].$1, scritto);
                        _segna(quaderno);
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
            righe.add(('', ''));
            _segna(quaderno);
          },
          icon: const Icon(Icons.add_rounded),
          label: const Text('Aggiungi una riga'),
        ),
      ];
    },
  );
}

/// I pezzi della plancia che si sono fatti sparire.
class SchermataDeiNascosti extends StatefulWidget {
  const SchermataDeiNascosti({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDeiNascosti> createState() => _SchermataDeiNascostiState();
}

class _SchermataDeiNascostiState extends State<SchermataDeiNascosti> {
  List<String>? _quali;
  int _daQualeScatto = -1;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Cosa e\' sparito',
    sotto:
        'I pezzi della plancia che si sono fatti sparire: una tessera, una '
        'riga, un bottone. Qui si rimettono. Ogni voce e\' il riferimento del '
        'pezzo, quello che la plancia gli da\'.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      if (_quali == null || _daQualeScatto != scatto.revisione) {
        _quali = scatto.parole(chiaveDeiNascosti);
        _daQualeScatto = scatto.revisione;
      }
      final quali = _quali!;
      void segna() {
        quaderno.segna(chiaveDeiNascosti, quali);
        setState(() {});
      }

      return [
        if (quali.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.visibility_rounded,
              titolo: 'Non e\' sparito niente',
              sotto: 'La plancia mostra tutto quello che sa mostrare.',
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
                  onPressed: () {
                    quali.removeAt(posto);
                    segna();
                  },
                  child: const Text('Rimettilo'),
                ),
              ),
            ),
      ];
    },
  );
}
