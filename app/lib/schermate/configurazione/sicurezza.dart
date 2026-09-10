/// La sicurezza e il caldo: le schermate.
///
/// I tasti dell'antifurto, le porte che si aprono col PIN, le allerte, la
/// caldaia e le cose che scaldano. Cinque schermate che nella plancia sono
/// cinque schede, e nell'app non c'erano.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/caldo.dart';
import '../../casa/plancia/scatto.dart';
import '../../casa/plancia/sicurezza.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/// Quali tasti dell'allarme si vogliono vedere.
class SchermataDeiModi extends StatelessWidget {
  const SchermataDeiModi({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'I tasti dell\'allarme',
    sotto:
        'La centrale dice cosa accetta; tu decidi cosa ti serve. Chi in '
        'vacanza non ci va mai si ritrova due tasti che non premera\' mai, e '
        'in fondo alla fila quello che usa ogni sera. Togliere un tasto non '
        'cambia niente di quello che la centrale sa fare, e lo sblocco resta '
        'sempre.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final nascosti = modiNascosti(
        quaderno.cambiate[chiaveDeiModi] ?? scatto.aperto(chiaveDeiModi),
      );
      return [
        for (final (modo, disegno, nome) in modiDellAntifurto)
          Card(
            margin: const EdgeInsets.symmetric(vertical: 3),
            child: SwitchListTile(
              value: !nascosti.contains(modo),
              onChanged: (acceso) => quaderno.segna(
                chiaveDeiModi,
                conIlModo(nascosti, modo, acceso),
              ),
              secondary: Text(disegno, style: const TextStyle(fontSize: 24)),
              title: Text(nome),
            ),
          ),
        const SizedBox(height: 16),
        Text(
          'Un tasto che la tua centrale non accetta non compare comunque: '
          'questa e\' la scelta di cosa vedere fra quelli che accetta.',
          style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
            color: Theme.of(dentro).colorScheme.onSurfaceVariant,
            height: 1.4,
          ),
        ),
      ];
    },
  );
}

/// Le porte da sorvegliare, e quelle che si aprono da qui.
class SchermataDellePorte extends StatefulWidget {
  const SchermataDellePorte({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDellePorte> createState() => _SchermataDellePorteState();
}

class _SchermataDellePorteState extends State<SchermataDellePorte> {
  List<Map<String, dynamic>>? _porte;
  int _daQualeScatto = -1;

  List<Map<String, dynamic>> _leggi(Scatto scatto) {
    if (_porte == null || _daQualeScatto != scatto.revisione) {
      /* Le righe si tengono grezze: una porta appena aggiunta e' vuota, e
       * normalizzare — che le righe non valide le scarta — la farebbe sparire
       * prima che si possa compilarla. */
      _porte = scatto.oggetti(chiaveDellePorte);
      _daQualeScatto = scatto.revisione;
    }
    return _porte!;
  }

  void _segna(Quaderno quaderno) {
    quaderno.segna(chiaveDellePorte, _porte);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Porte da sorvegliare',
    sotto:
        'Serratura, pulsante, rele\', cancello o script. Finche\' non scegli '
        'l\'entita\' l\'apertura non si vede da nessuna parte.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final porte = _leggi(scatto);
      final conferma = siChiedeConferma(
        quaderno.cambiate[chiaveDellaConferma] ??
            scatto.aperto(chiaveDellaConferma),
      );
      return [
        Scheda(
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: conferma,
            onChanged: (acceso) => quaderno.segna(chiaveDellaConferma, acceso),
            title: const Text('Chiedi conferma prima di aprire'),
            subtitle: const Text(
              'Chi tocca per sbaglio se ne accorge dopo, davanti a un cancello '
              'aperto. Ma chi apre il proprio portone dieci volte al giorno la '
              'conferma la conosce a memoria. Il PIN non e\' una conferma e '
              'non si spegne da qui: quella e\' una chiave.',
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (porte.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.door_front_door_outlined,
              titolo: 'Non c\'e\' ancora nessuna porta',
              sotto: 'Aggiungine una qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, porta) in porte.indexed)
            _UnaPorta(
              porta: porta,
              quale: posto,
              collegamento: widget.collegamento,
              tessera: TesseraDelCampo(
                'porte',
                scatto: scatto,
                quaderno: quaderno,
              ),
              cambiato: () => _segna(quaderno),
              togli: () {
                porte.removeAt(posto);
                _segna(quaderno);
              },
            ),
        const SizedBox(height: 12),
        FilledButton.tonalIcon(
          onPressed: () {
            porte.add({'name': '', 'entity': '', 'icon': iconaDellaPorta});
            _segna(quaderno);
          },
          icon: const Icon(Icons.add_rounded),
          label: const Text('Aggiungi una porta'),
        ),
      ];
    },
  );
}

class _UnaPorta extends StatelessWidget {
  const _UnaPorta({
    required this.porta,
    required this.quale,
    required this.collegamento,
    required this.tessera,
    required this.cambiato,
    required this.togli,
  });

  final Map<String, dynamic> porta;
  final int quale;
  final Collegamento collegamento;

  /// Le porte hanno tessera loro (#457): l'interruttore «nel widget» scrive
  /// `porte|…`, e legge anche le voci scritte ai tempi della Sicurezza.
  final TesseraDelCampo tessera;
  final VoidCallback cambiato;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final nome = '${porta['name'] ?? ''}'.trim();
    final entita = '${porta['entity'] ?? ''}'.trim();
    final pin = '${porta['pin'] ?? ''}'.trim();
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        initiallyExpanded: entita.isEmpty,
        title: Text(
          nome.isNotEmpty
              ? nome
              : (entita.isNotEmpty ? entita : 'Porta ${quale + 1}'),
        ),
        subtitle: Text(
          entita.isEmpty
              ? 'nessuna entita\': non si vede da nessuna parte'
              : '$entita${pin.isNotEmpty ? ' · 🔒 PIN' : ''}',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          Row(
            children: [
              Expanded(
                flex: 3,
                child: CampoDiTesto(
                  etichetta: 'Nome',
                  valore: nome,
                  suggerimento: 'Portone condominio',
                  cambiato: (scritto) {
                    porta['name'] = scritto;
                    cambiato();
                  },
                ),
              ),
              const SizedBox(width: 10),
              /* Il disegno: nella Config della dashboard e' una casella
               * (`data-door-field="icon"`), e qui era fisso a 🚪 — il cancello
               * e il portone del garage si somigliavano tutti. */
              Expanded(
                child: CampoDiTesto(
                  etichetta: 'Disegno',
                  valore: '${porta['icon'] ?? ''}',
                  suggerimento: iconaDellaPorta,
                  cambiato: (scritto) {
                    porta['icon'] = scritto;
                    cambiato();
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          CampoDiEntita(
            tessera: tessera,
            etichetta: 'Entita\' che apre',
            contesto: 'che apre una porta',
            domini: const ['lock', 'button', 'switch', 'cover', 'script'],
            valore: entita,
            collegamento: collegamento,
            cambiato: (scritto) {
              porta['entity'] = scritto;
              cambiato();
            },
          ),
          /* Cosa fa il tocco (1.4.17): solo per una serratura che sa anche
           * aprire — `supported_features & 1` — perche' per le altre non c'e'
           * niente da scegliere. `""` vuol dire «apri, come prima». */
          if (serraturaSaAprire(collegamento.stato?[entita])) ...[
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: gestoDellaPorta(porta['gesto']),
              decoration: const InputDecoration(
                labelText: 'Cosa fa il tocco',
                helperText:
                    'Questa serratura sa fare tutte e due le cose. '
                    'Lasciandola com\'e\' il tocco apre, come ha sempre fatto.',
                helperMaxLines: 3,
                border: OutlineInputBorder(),
                isDense: true,
              ),
              items: const [
                DropdownMenuItem(value: '', child: Text('Apri (come prima)')),
                DropdownMenuItem(value: 'sblocca', child: Text('Solo sblocca')),
                DropdownMenuItem(
                  value: 'entrambi',
                  child: Text('Tutti e due i tasti'),
                ),
              ],
              onChanged: (scelto) {
                if ((scelto ?? '').isEmpty) {
                  porta.remove('gesto');
                } else {
                  porta['gesto'] = scelto;
                }
                cambiato();
              },
            ),
          ],
          const SizedBox(height: 14),
          CampoDiTesto(
            etichetta: 'PIN (facoltativo)',
            valore: pin,
            mono: true,
            numerico: true,
            suggerimento: '1234',
            cambiato: (scritto) {
              porta['pin'] = scritto.trim();
              cambiato();
            },
          ),
          const SizedBox(height: 4),
          Text(
            ilPinVaBene(pin)
                ? 'Da 4 a 8 cifre: prima di aprire viene chiesto il codice, '
                      'contro i tocchi accidentali. Vuoto = solo conferma.'
                : 'Un PIN e\' da 4 a 8 cifre: cosi\' com\'e\' non verra\' '
                      'chiesto.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: ilPinVaBene(pin) ? colori.onSurfaceVariant : colori.error,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: togli,
              icon: const Icon(Icons.delete_outline_rounded),
              label: const Text('Togli'),
              style: TextButton.styleFrom(foregroundColor: colori.error),
            ),
          ),
        ],
      ),
    );
  }
}

/// Le allerte: sei categorie, ognuna con la sua entita'.
class SchermataDelleAllerte extends StatelessWidget {
  const SchermataDelleAllerte({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Allerte meteo',
    sotto:
        'Terremoti, allerte meteo, fulmini, pollini, comfort, voli, scioperi '
        'e treni, e la qualita\' dell\'aria. Basta l\'entita\' principale: '
        'le caselle in piu\' servono a chi ha l\'informazione spezzata in '
        'piu\' sensori.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final segnate = quaderno.cambiate[chiaveDelleAllerte];
      final grezze = segnate ?? scatto.mappa(chiaveDelleAllerte);
      final allerte = leggiLeAllerte(grezze);
      final quante = allerteConfigurate(allerte).length;
      /* Si riscrive tenendo quello che non e' una categoria — l'aria — che
       * la Config della plancia invece perde a ogni salvataggio. */
      void segna() => quaderno.segna(
        chiaveDelleAllerte,
        allerteDaScrivere(allerte, prima: grezze),
      );
      final aria = leggiLAria(grezze is Map ? grezze['aria'] : null);
      void segnaLAria(Map<String, dynamic> dopo) => quaderno.segna(
        chiaveDelleAllerte,
        {...allerteDaScrivere(allerte, prima: grezze), 'aria': dopo},
      );
      return [
        Scheda(
          colore: Theme.of(dentro).colorScheme.surfaceContainerHigh,
          child: Text(
            quante == 0
                ? 'Nessuna allerta configurata'
                : '$quante su ${categorieDelleAllerte.length} configurate',
            style: Theme.of(dentro).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 8),
        for (final (chiave, disegno, nome, caselle) in categorieDelleAllerte)
          Card(
            margin: const EdgeInsets.symmetric(vertical: 4),
            clipBehavior: Clip.antiAlias,
            child: ExpansionTile(
              initiallyExpanded: (allerte[chiave]?['entity'] ?? '').isNotEmpty,
              leading: Text(disegno, style: const TextStyle(fontSize: 24)),
              title: Text(nome),
              subtitle: Text(
                (allerte[chiave]?['entity'] ?? '').isEmpty
                    ? 'non configurata'
                    : allerte[chiave]!['entity']!,
                style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                  color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                ),
              ),
              childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              children: [
                CampoDiTesto(
                  etichetta: 'Come si chiama',
                  valore: allerte[chiave]?['nome'] ?? '',
                  suggerimento: nome,
                  cambiato: (scritto) {
                    allerte[chiave]!['nome'] = scritto;
                    segna();
                  },
                ),
                const SizedBox(height: 14),
                for (final (casella, etichetta) in caselle) ...[
                  CampoDiEntita(
                    etichetta: etichetta,
                    esempio: esempiDelleAllerte['$chiave.$casella'],
                    contesto: 'per le allerte $nome',
                    domini: const ['sensor', 'binary_sensor'],
                    valore: allerte[chiave]?[casella] ?? '',
                    collegamento: collegamento,
                    tessera: TesseraDelCampo(
                      'allerte',
                      scatto: scatto,
                      quaderno: quaderno,
                    ),
                    cambiato: (scritto) {
                      allerte[chiave]![casella] = scritto;
                      segna();
                    },
                  ),
                  const SizedBox(height: 14),
                ],
              ],
            ),
          ),
        const SizedBox(height: 16),
        _LAria(
          aria: aria,
          collegamento: collegamento,
          segna: segnaLAria,
          /* La scheda dell'aria si marchia «aria» (`allerte-editor-section.js`):
           * la tessera in Home e' la sua, non quella delle allerte. */
          tessera: TesseraDelCampo('aria', scatto: scatto, quaderno: quaderno),
        ),
      ];
    },
  );
}

/// La qualita' dell'aria (1.4.17): la misura in copertina, i sensori da non
/// contare, quelli aggiunti a mano con la loro classe, i confini di ogni
/// misura. Sta dentro `cd_allerte.aria`.
class _LAria extends StatefulWidget {
  const _LAria({
    required this.aria,
    required this.collegamento,
    required this.segna,
    required this.tessera,
  });

  final Map<String, dynamic> aria;
  final Collegamento collegamento;
  final ValueChanged<Map<String, dynamic>> segna;
  final TesseraDelCampo tessera;

  @override
  State<_LAria> createState() => _LAriaState();
}

class _LAriaState extends State<_LAria> {
  String _daEscludere = '';
  String _daAggiungere = '';
  String _classe = misureDellAria.first.$1;
  int _giro = 0;

  Map<String, dynamic> get _a => widget.aria;
  List<String> get _escluse => (_a['escluse'] as List).cast<String>();
  Map<String, String> get _aggiunte =>
      (_a['aggiunte'] as Map).cast<String, String>();
  Map<String, List<num>> get _soglie =>
      (_a['soglie'] as Map).cast<String, List<num>>();

  void _scrivi({
    String? principale,
    List<String>? escluse,
    Map<String, String>? aggiunte,
    Map<String, List<num>>? soglie,
  }) {
    widget.segna({
      'principale': principale ?? _a['principale'],
      'escluse': escluse ?? _escluse,
      'aggiunte': aggiunte ?? _aggiunte,
      'soglie': soglie ?? _soglie,
    });
    setState(() => _giro += 1);
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final nomi = {for (final (classe, nome, _) in misureDellAria) classe: nome};
    final principale = '${_a['principale'] ?? ''}';
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        leading: const Text('🍃', style: TextStyle(fontSize: 24)),
        title: const Text('Qualita\' dell\'aria'),
        subtitle: Text(
          principale.isEmpty
              ? 'la misura in copertina la sceglie la plancia'
              : 'in copertina: $principale',
          style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          Text(
            'I sensori dell\'aria la plancia li trova da sola, dalla loro '
            'classe. Qui si sceglie quale sta in copertina, si toglie quello '
            'che non conta, si aggiunge quello che nessuno ha etichettato, e '
            'si spostano i confini fra buona, discreta e scarsa.',
            style: testi.bodySmall?.copyWith(
              color: colori.onSurfaceVariant,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 14),
          CampoDiEntita(
            key: ValueKey('principale-$_giro'),
            etichetta: 'La misura in copertina',
            esempio: 'sensor.qualita_aria',
            contesto: 'della qualita\' dell\'aria',
            domini: const ['sensor'],
            valore: principale,
            collegamento: widget.collegamento,
            cambiato: (scritto) => _scrivi(principale: scritto.trim()),
          ),
          const SizedBox(height: 14),
          Text(
            'Non contare questo sensore',
            style: testi.labelLarge?.copyWith(color: colori.onSurfaceVariant),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: CampoDiEntita(
                  key: ValueKey('escludi-$_giro'),
                  etichetta: 'Entita\'',
                  esempio: 'sensor.outdoor_co',
                  contesto: 'da non contare fra i sensori dell\'aria',
                  domini: const ['sensor'],
                  valore: _daEscludere,
                  collegamento: widget.collegamento,
                  cambiato: (scritto) =>
                      setState(() => _daEscludere = scritto.trim()),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.tonal(
                onPressed: _daEscludere.contains('.')
                    ? () {
                        _scrivi(escluse: [..._escluse, _daEscludere]);
                        _daEscludere = '';
                      }
                    : null,
                child: const Text('Togli'),
              ),
            ],
          ),
          if (_escluse.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final id in _escluse)
                  InputChip(
                    label: Text(id, style: const TextStyle(fontSize: 12)),
                    deleteButtonTooltipMessage: 'Rimetti',
                    onDeleted: () =>
                        _scrivi(escluse: [..._escluse]..remove(id)),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          Text(
            'Aggiungi un sensore che non viene trovato',
            style: testi.labelLarge?.copyWith(color: colori.onSurfaceVariant),
          ),
          const SizedBox(height: 6),
          CampoDiEntita(
            key: ValueKey('aggiungi-$_giro'),
            etichetta: 'Entita\'',
            esempio: 'sensor.mio_pm25',
            contesto: 'da aggiungere ai sensori dell\'aria',
            domini: const ['sensor'],
            valore: _daAggiungere,
            collegamento: widget.collegamento,
            cambiato: (scritto) =>
                setState(() => _daAggiungere = scritto.trim()),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: _classe,
                  decoration: const InputDecoration(
                    labelText: 'Che misura e\'',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: [
                    for (final (classe, nome, _) in misureDellAria)
                      DropdownMenuItem(value: classe, child: Text(nome)),
                  ],
                  onChanged: (scelto) =>
                      setState(() => _classe = scelto ?? _classe),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.tonal(
                onPressed: _daAggiungere.contains('.')
                    ? () {
                        _scrivi(
                          aggiunte: {..._aggiunte, _daAggiungere: _classe},
                        );
                        _daAggiungere = '';
                      }
                    : null,
                child: const Text('Aggiungi'),
              ),
            ],
          ),
          if (_aggiunte.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final voce in _aggiunte.entries)
                  InputChip(
                    label: Text(
                      '${voce.key} · ${nomi[voce.value] ?? voce.value}',
                      style: const TextStyle(fontSize: 12),
                    ),
                    deleteButtonTooltipMessage: 'Elimina',
                    onDeleted: () =>
                        _scrivi(aggiunte: {..._aggiunte}..remove(voce.key)),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Text(
                  'I confini di ogni misura',
                  style: testi.labelLarge?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ),
              TextButton(
                onPressed: _soglie.isEmpty ? null : () => _scrivi(soglie: {}),
                child: const Text('Rimetti le norme'),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Fino a: buona, discreta, scarsa. In grigio le norme; tre numeri '
            'crescenti, o non si salvano.',
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
          const SizedBox(height: 8),
          for (final (classe, nome, norme) in misureDellAria) ...[
            _ISoglie(
              key: ValueKey('soglie-$classe-$_giro'),
              nome: nome,
              norme: norme,
              scritte: _soglie[classe],
              cambiate: (tre) {
                final dopo = {..._soglie};
                if (tre == null) {
                  dopo.remove(classe);
                } else {
                  dopo[classe] = tre;
                }
                _scrivi(soglie: dopo);
              },
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

/// I tre confini di una misura: si scrivono solo se sono tre numeri
/// crescenti — e' la regola di `normalizzaAria` — e vuoti valgono le norme.
class _ISoglie extends StatefulWidget {
  const _ISoglie({
    super.key,
    required this.nome,
    required this.norme,
    required this.scritte,
    required this.cambiate,
  });

  final String nome;
  final List<num> norme;
  final List<num>? scritte;
  final ValueChanged<List<num>?> cambiate;

  @override
  State<_ISoglie> createState() => _ISoglieState();
}

class _ISoglieState extends State<_ISoglie> {
  late final List<String> _testi = [
    for (var i = 0; i < 3; i += 1)
      widget.scritte == null ? '' : '${widget.scritte![i]}',
  ];
  bool _rotte = false;

  void _cambia(int quale, String scritto) {
    _testi[quale] = scritto.trim();
    if (_testi.every((uno) => uno.isEmpty)) {
      setState(() => _rotte = false);
      widget.cambiate(null);
      return;
    }
    final numeri = [
      for (final uno in _testi) num.tryParse(uno.replaceAll(',', '.')),
    ];
    final buone =
        numeri.every((n) => n != null && n.isFinite && n >= 0) &&
        numeri[0]! < numeri[1]! &&
        numeri[1]! < numeri[2]!;
    setState(() => _rotte = !buone);
    if (buone) widget.cambiate(numeri.cast<num>());
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          flex: 3,
          child: Text(
            widget.nome,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: _rotte ? colori.error : null,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        for (var i = 0; i < 3; i += 1) ...[
          const SizedBox(width: 6),
          Expanded(
            flex: 2,
            child: CampoDiTesto(
              etichetta: const ['buona', 'discreta', 'scarsa'][i],
              valore: _testi[i],
              suggerimento: '${widget.norme[i]}',
              numerico: true,
              cambiato: (scritto) => _cambia(i, scritto),
            ),
          ),
        ],
      ],
    );
  }
}

/// La caldaia: mandata, ritorno, pressione, e cosa c'e' all'altro capo.
class SchermataDellaCaldaia extends StatefulWidget {
  const SchermataDellaCaldaia({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDellaCaldaia> createState() => _SchermataDellaCaldaiaState();
}

class _SchermataDellaCaldaiaState extends State<SchermataDellaCaldaia> {
  List<Map<String, String>>? _caldaie;
  int _daQualeScatto = -1;

  List<Map<String, String>> _leggi(Scatto scatto) {
    if (_caldaie == null || _daQualeScatto != scatto.revisione) {
      _caldaie = leggiLeCaldaie(scatto.aperto(chiaveDellaCaldaia));
      _daQualeScatto = scatto.revisione;
    }
    return _caldaie!;
  }

  void _segna(Quaderno quaderno) {
    quaderno.segna(chiaveDellaCaldaia, caldaieDaScrivere(_caldaie!));
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'La caldaia',
    sotto:
        'Mandata e ritorno prima di tutto: la differenza fra i due dice se '
        'l\'impianto sta cedendo calore o sta girando a vuoto, ed e\' la '
        'ragione per cui si apre questa pagina.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final caldaie = _leggi(scatto);
      return [
        if (caldaie.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.local_fire_department_outlined,
              titolo: 'Non c\'e\' ancora nessuna caldaia',
              sotto: 'Aggiungine una qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, una) in caldaie.indexed)
            _UnaCaldaia(
              caldaia: una,
              quale: posto,
              collegamento: widget.collegamento,
              tessera: TesseraDelCampo(
                'caldaia',
                scatto: scatto,
                quaderno: quaderno,
              ),
              cambiato: () => _segna(quaderno),
              togli: () {
                caldaie.removeAt(posto);
                _segna(quaderno);
              },
            ),
        const SizedBox(height: 12),
        FilledButton.tonalIcon(
          onPressed: () {
            caldaie.add({
              ...leggiUnaCaldaia(const {}),
              'id': 'caldaia-${caldaie.length + 1}',
            });
            _segna(quaderno);
          },
          icon: const Icon(Icons.add_rounded),
          label: const Text('Aggiungi una caldaia'),
        ),
      ];
    },
  );
}

class _UnaCaldaia extends StatelessWidget {
  const _UnaCaldaia({
    required this.caldaia,
    required this.quale,
    required this.collegamento,
    required this.tessera,
    required this.cambiato,
    required this.togli,
  });

  final Map<String, String> caldaia;
  final int quale;
  final Collegamento collegamento;

  /// Il pannello della caldaia si marchia «caldaia»
  /// (`impianti-termici-editor-section.js`): l'interruttore «nel widget»
  /// accanto a ogni casella parla di quella tessera.
  final TesseraDelCampo tessera;
  final VoidCallback cambiato;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final piene = [
      for (final (campo, _, _, _) in caselleDellaCaldaia)
        if ((caldaia[campo] ?? '').isNotEmpty) campo,
    ].length;
    final nome = (caldaia['name'] ?? '').isNotEmpty
        ? caldaia['name']!
        : 'Caldaia ${quale + 1}';
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        initiallyExpanded: piene == 0,
        title: Text(nome),
        subtitle: Text(
          '$piene su ${caselleDellaCaldaia.length} riempite',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          CampoDiTesto(
            etichetta: 'Come si chiama',
            valore: caldaia['name'] ?? '',
            suggerimento: 'Caldaia',
            cambiato: (scritto) {
              caldaia['name'] = scritto;
              cambiato();
            },
          ),
          const SizedBox(height: 14),
          Text(
            'Cosa c\'e\' all\'altro capo del tubo',
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const SizedBox(height: 6),
          /* «Richiesta di visualizzare o radiatore o boiler»: la scena
           * disegnava sempre un radiatore, e chi ha una caldaia che serve solo
           * l'accumulo sanitario ci vedeva un termosifone che non ha. */
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'radiatori', label: Text('Radiatori')),
              ButtonSegment(value: 'boiler', label: Text('Boiler')),
            ],
            selected: {caldaia['uscita'] ?? usciteDellaCaldaia.first},
            showSelectedIcon: false,
            onSelectionChanged: (scelta) {
              caldaia['uscita'] = scelta.first;
              cambiato();
            },
          ),
          const SizedBox(height: 16),
          for (final (campo, etichetta, _, domini) in caselleDellaCaldaia) ...[
            /* Il titolo del gruppo del pellet (#346): otto caselle in piu' su
             * una scheda che ne aveva dieci, e di una macchina sola. Chi ha
             * una caldaia a gas deve capire a colpo d'occhio che da questa
             * riga in giu' non c'e' niente di suo. */
            if (campo == caselleDelPellet.first) ...[
              const SizedBox(height: 4),
              Text(
                '🪵 Combustibile solido: pellet o legna',
                style: Theme.of(context).textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                'Le caselle di una caldaia a pellet o a legna: la combustione, '
                'il serbatoio e l\'obiettivo della centralina. Lasciale vuote '
                'se la tua caldaia va a gas: quello che non mappi non compare '
                'in pagina.',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: colori.onSurfaceVariant),
              ),
              const SizedBox(height: 14),
            ],
            CampoDiEntita(
              etichetta: etichetta,
              contesto: 'della caldaia',
              domini: domini,
              valore: caldaia[campo] ?? '',
              esempio: esempiDelPellet[campo],
              collegamento: collegamento,
              tessera: tessera,
              cambiato: (scritto) {
                caldaia[campo] = scritto;
                cambiato();
              },
            ),
            if (aiutiDelPellet[campo] case final aiuto?)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
                child: Text(
                  aiuto,
                  style: Theme.of(context).textTheme.bodySmall
                      ?.copyWith(color: colori.onSurfaceVariant),
                ),
              ),
            const SizedBox(height: 14),
          ],
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: togli,
              icon: const Icon(Icons.delete_outline_rounded),
              label: const Text('Togli questa caldaia'),
              style: TextButton.styleFrom(foregroundColor: colori.error),
            ),
          ),
        ],
      ),
    );
  }
}

/// Cosa c'e' nel locale caldaia: solare, scaldabagno, caldaia.
///
/// Tre si'/no, non un elenco di impianti — vedi `chiaveDegliImpiantiTermici`
/// in `casa/plancia/caldo.dart` per il perche' la differenza conta. La pagina
/// Gestione termica della plancia mostra solo quelli spuntati, e con due o tre
/// compaiono in alto le linguette per passare dall'uno all'altro.
///
/// Le entita' di ognuno non stanno qui: il solare le tiene nelle sue tredici
/// caselle (voce «Solare termico»), la caldaia nelle sue diciotto (voce «La
/// caldaia»), gli scaldabagni nel loro elenco. Qui si dice soltanto quali
/// macchine esistono.
class SchermataDegliImpiantiTermici extends StatelessWidget {
  const SchermataDegliImpiantiTermici({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Cosa c\'e\' nel locale caldaia',
    sotto:
        'Spunta quello che hai davvero: la pagina mostra solo quello, e con '
        'due o tre compaiono in alto le linguette per passare dall\'uno '
        'all\'altro. Le entita\' di ognuno si mettono nella sua voce.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final scelta = laScelaTermica(
        quaderno.cambiate[chiaveDegliImpiantiTermici] ??
            scatto.aperto(chiaveDegliImpiantiTermici),
      );
      return [
        for (final (tipo, nome, spiega) in iTipiTermici)
          Card(
            margin: const EdgeInsets.symmetric(vertical: 3),
            child: SwitchListTile(
              value: scelta[tipo] ?? false,
              onChanged: (acceso) => quaderno.segna(
                chiaveDegliImpiantiTermici,
                {...scelta, tipo: acceso},
              ),
              title: Text(nome),
              subtitle: Text(spiega),
              isThreeLine: spiega.length > 60,
            ),
          ),
      ];
    },
  );
}
