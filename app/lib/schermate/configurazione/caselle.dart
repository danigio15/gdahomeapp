/// Le caselle di una pagina della plancia: Home, Energia, Auto, Solare,
/// Sicurezza, MiniPC.
///
/// Ognuna e' una fila di domande — «Potenza fotovoltaico (W)», «Batteria auto
/// (%)» — e a ognuna si risponde con un'entita' di Home Assistant. Le domande
/// sono quelle della plancia, prese da `CD_SLOTS` (vedi
/// `casa/plancia/caselle.dart`), e le risposte finiscono dove le mette la
/// plancia: dentro `cd_entity_overrides`, sotto la chiave della casella.
///
/// Trentasei caselle di fila — l'Energia le ha — su un telefono sono un muro.
/// Quindi in cima c'e' quante ne sono gia' riempite, e un filtro che lascia
/// vedere solo quelle vuote: chi torna a finire il lavoro non riscorre da
/// capo tutte quelle che aveva gia' fatto.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/caselle.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/// Dove finiscono le risposte: la stessa chiave che usa la plancia.
const chiaveDelleSostituzioni = 'cd_entity_overrides';

class SchermataDelleCaselle extends StatefulWidget {
  const SchermataDelleCaselle({
    super.key,
    required this.titolo,
    required this.sotto,
    required this.sezione,
    required this.collegamento,
  });

  final String titolo;
  final String sotto;

  /// Quale sezione di `CD_SLOTS`: `home`, `energy`, `ev`, `boiler`,
  /// `security`, `server`.
  final String sezione;

  final Collegamento collegamento;

  @override
  State<SchermataDelleCaselle> createState() => _SchermataDelleCaselleState();
}

class _SchermataDelleCaselleState extends State<SchermataDelleCaselle> {
  bool _soloVuote = false;
  Map<String, SezioneDiCaselle> _tutte = caselleLette;

  @override
  void initState() {
    super.initState();
    if (_tutte.isEmpty) {
      leggiLeCaselle().then((lette) {
        if (mounted) setState(() => _tutte = lette);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final sezione = _tutte[widget.sezione];
    return PaginaDiConfigurazione(
      titolo: widget.titolo,
      sotto: widget.sotto,
      collegamento: widget.collegamento,
      disegna: (dentro, scatto, quaderno) {
        if (sezione == null) {
          return const [
            StatoVuoto(
              icona: Icons.hourglass_empty_rounded,
              titolo: 'Sto leggendo le caselle',
              sotto: 'Un attimo.',
              dentroUnaLista: true,
            ),
          ];
        }
        /* Le sostituzioni gia' scritte, piu' quelle segnate e non ancora
         * salvate: senza le seconde, un campo appena riempito tornerebbe
         * vuoto al primo ridisegno. */
        final scritte = Map<String, dynamic>.from(
          scatto.mappa(chiaveDelleSostituzioni),
        );
        final segnate = quaderno.cambiate[chiaveDelleSostituzioni];
        if (segnate is Map) {
          scritte.addAll(Map<String, dynamic>.from(segnate));
        }
        final piene = sezione.caselle
            .where((una) => '${scritte[una.chiave] ?? ''}'.isNotEmpty)
            .length;
        final daMostrare = _soloVuote
            ? sezione.caselle
                  .where((una) => '${scritte[una.chiave] ?? ''}'.isEmpty)
                  .toList()
            : sezione.caselle;
        return [
          Scheda(
            colore: colori.surfaceContainerHigh,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '$piene su ${sezione.caselle.length} riempite',
                    style: Theme.of(dentro).textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                FilterChip(
                  label: const Text('Solo le vuote'),
                  selected: _soloVuote,
                  onSelected: (acceso) => setState(() => _soloVuote = acceso),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (daMostrare.isEmpty)
            const StatoVuoto(
              icona: Icons.check_circle_outline_rounded,
              titolo: 'Sono tutte riempite',
              sotto: 'Togli il filtro per rivederle.',
              dentroUnaLista: true,
            ),
          for (final una in daMostrare) ...[
            CampoDiEntita(
              etichetta: una.etichetta,
              /* La chiave della casella conta quanto l'etichetta: in
               * `dm.energy_potenza_batteria` ci sono tre parole che dicono
               * cosa la casella vuole, ed e' da li' che la dashboard tira
               * fuori i suoi suggerimenti. */
              chiave: una.chiave,
              valore: '${scritte[una.chiave] ?? ''}',
              collegamento: widget.collegamento,
              cambiato: (scritto) {
                final dopo = Map<String, dynamic>.from(scritte);
                if (scritto.trim().isEmpty) {
                  dopo.remove(una.chiave);
                } else {
                  dopo[una.chiave] = scritto.trim();
                }
                quaderno.segna(chiaveDelleSostituzioni, dopo);
              },
            ),
            const SizedBox(height: 14),
          ],
        ];
      },
    );
  }
}
