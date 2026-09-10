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
///
/// E il nome di ogni casella si puo' riscrivere, come nella plancia: li' e'
/// un campo di testo sopra ogni riga, e finisce in `cd_slot_labels`. Chi ha
/// chiamato «Potenza tetto sud» quella che di serie e' «Potenza fotovoltaico
/// (W)» deve ritrovarla con il suo nome anche qui, o le due configurazioni
/// parlano di due case diverse.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/caselle.dart';
import '../../casa/plancia/home.dart';
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
    this.tessera = '',
  });

  final String titolo;
  final String sotto;

  /// Quale sezione di `CD_SLOTS`: `home`, `energy`, `ev`, `boiler`,
  /// `security`, `server`.
  final String sezione;

  /// La tessera della Home di cui parlano queste caselle (`sicurezza`,
  /// `minipc`), o «» se non ne hanno una: la Home e l'Energia.
  final String tessera;

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
        /* I nomi riscritti: quelli salvati, piu' quelli appena cambiati e
         * non ancora mandati. Stessa ragione delle sostituzioni qui sopra. */
        final etichette = Map<String, dynamic>.from(
          scatto.mappa(chiaveDelleEtichette),
        );
        final segnate2 = quaderno.cambiate[chiaveDelleEtichette];
        if (segnate2 is Map) {
          etichette.addAll(Map<String, dynamic>.from(segnate2));
        }
        String comeSiChiama(Casella una) {
          final suo = '${etichette[una.chiave] ?? ''}'.trim();
          return suo.isEmpty ? una.etichetta : suo;
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
              etichetta: comeSiChiama(una),
              /* La chiave della casella conta quanto l'etichetta: in
               * `dm.energy_potenza_batteria` ci sono tre parole che dicono
               * cosa la casella vuole, ed e' da li' che la dashboard tira
               * fuori i suoi suggerimenti. */
              chiave: una.chiave,
              valore: '${scritte[una.chiave] ?? ''}',
              collegamento: widget.collegamento,
              tessera: widget.tessera.isEmpty
                  ? null
                  : TesseraDelCampo(
                      widget.tessera,
                      scatto: scatto,
                      quaderno: quaderno,
                    ),
              cambiato: (scritto) {
                final dopo = Map<String, dynamic>.from(scritte);
                if (scritto.trim().isEmpty) {
                  dopo.remove(una.chiave);
                } else {
                  dopo[una.chiave] = scritto.trim();
                }
                quaderno.segna(chiaveDelleSostituzioni, dopo);
              },
              rinomina: (nome) {
                final dopo = Map<String, dynamic>.from(etichette);
                /* Il nome di serie non si scrive: se uno lo rimette uguale,
                 * quella voce non deve restare li' a invecchiare mentre la
                 * plancia cambia le sue etichette. */
                if (nome.isEmpty || nome == una.etichetta) {
                  dopo.remove(una.chiave);
                } else {
                  dopo[una.chiave] = nome;
                }
                quaderno.segna(chiaveDelleEtichette, dopo);
              },
            ),
            const SizedBox(height: 14),
          ],
        ];
      },
    );
  }
}
