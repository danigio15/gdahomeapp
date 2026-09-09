/// Il resto: la raccolta, le pagine tue, le cose che scaldano, e gli
/// interruttori di casa.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/caldo.dart';
import '../../casa/plancia/home.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/// Quando passa il camion, e cosa si mette fuori.
class SchermataDellaRaccolta extends StatefulWidget {
  const SchermataDellaRaccolta({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDellaRaccolta> createState() => _SchermataDellaRaccoltaState();
}

class _SchermataDellaRaccoltaState extends State<SchermataDellaRaccolta> {
  List<Map<String, dynamic>>? _righe;
  String _calendario = '';
  int _daQualeScatto = -1;

  void _leggi(Scatto scatto) {
    if (_righe != null && _daQualeScatto == scatto.revisione) return;
    final letta = leggiLaRaccolta(scatto.mappa(chiaveDeiRifiuti));
    _righe = letta.righe;
    _calendario = letta.calendario;
    _daQualeScatto = scatto.revisione;
  }

  void _segna(Quaderno quaderno) {
    quaderno.segna(chiaveDeiRifiuti, {
      if (_calendario.trim().isNotEmpty) 'calendario': _calendario.trim(),
      'righe': _righe,
    });
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'La raccolta',
    sotto:
        'Quando passa il camion e cosa si mette fuori. I colori sono quelli '
        'dei bidoni, quelli che uno ha gia\' in testa: scegliendo il materiale '
        'arrivano da soli.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      _leggi(scatto);
      final righe = _righe!;
      return [
        Scheda(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Da un calendario solo',
                style: Theme.of(dentro).textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                'Chi ha il calendario del comune non deve scrivere niente '
                'altro: la plancia legge da li\' e riconosce il materiale dal '
                'nome dell\'evento.',
                style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                  color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 12),
              CampoDiEntita(
                etichetta: 'Il calendario della raccolta',
                contesto: 'della raccolta dei rifiuti',
                domini: const ['calendar'],
                valore: _calendario,
                collegamento: widget.collegamento,
                cambiato: (scritto) {
                  _calendario = scritto;
                  _segna(quaderno);
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Oppure un sensore per materiale',
          style: Theme.of(dentro).textTheme.titleSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        for (final (posto, riga) in righe.indexed)
          _UnaRiga(
            riga: riga,
            quale: posto,
            collegamento: widget.collegamento,
            cambiato: () => _segna(quaderno),
            togli: () {
              righe.removeAt(posto);
              _segna(quaderno);
            },
          ),
        const SizedBox(height: 12),
        if (righe.length < massimoDeiRifiuti)
          FilledButton.tonalIcon(
            onPressed: () {
              righe.add({'materiale': 'altro', 'nome': '', 'entity': ''});
              _segna(quaderno);
            },
            icon: const Icon(Icons.add_rounded),
            label: const Text('Aggiungi un materiale'),
          )
        else
          Text(
            'Dodici materiali sono gia\' piu\' di quanti ne separi qualunque '
            'comune.',
            style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
              color: Theme.of(dentro).colorScheme.onSurfaceVariant,
            ),
          ),
      ];
    },
  );
}

class _UnaRiga extends StatelessWidget {
  const _UnaRiga({
    required this.riga,
    required this.quale,
    required this.collegamento,
    required this.cambiato,
    required this.togli,
  });

  final Map<String, dynamic> riga;
  final int quale;
  final Collegamento collegamento;
  final VoidCallback cambiato;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final scelto = '${riga['materiale'] ?? 'altro'}';
    final suo = materialiDeiRifiuti.firstWhere(
      (uno) => uno.$1 == scelto,
      orElse: () => materialiDeiRifiuti.last,
    );
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        leading: Text(suo.$2, style: const TextStyle(fontSize: 24)),
        title: Text(
          '${riga['nome'] ?? ''}'.isNotEmpty ? '${riga['nome']}' : suo.$1,
        ),
        subtitle: Text(
          '${riga['entity'] ?? ''}'.isEmpty
              ? 'nessuna entita\''
              : '${riga['entity']}',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final (chiave, disegno, _) in materialiDeiRifiuti)
                ChoiceChip(
                  avatar: Text(disegno),
                  label: Text(chiave),
                  selected: scelto == chiave,
                  onSelected: (_) {
                    riga['materiale'] = chiave;
                    cambiato();
                  },
                ),
            ],
          ),
          const SizedBox(height: 14),
          CampoDiTesto(
            etichetta: 'Come si chiama',
            valore: '${riga['nome'] ?? ''}',
            suggerimento: suo.$1,
            cambiato: (scritto) {
              riga['nome'] = scritto;
              cambiato();
            },
          ),
          const SizedBox(height: 14),
          CampoDiEntita(
            etichetta: 'Quando passa',
            contesto: 'della raccolta ${suo.$1}',
            domini: const ['sensor', 'calendar', 'binary_sensor'],
            valore: '${riga['entity'] ?? ''}',
            collegamento: collegamento,
            cambiato: (scritto) {
              riga['entity'] = scritto;
              cambiato();
            },
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

/// Le pagine intere fatte da chi usa la plancia.
class SchermataDelleSezioniMie extends StatefulWidget {
  const SchermataDelleSezioniMie({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDelleSezioniMie> createState() =>
      _SchermataDelleSezioniMieState();
}

class _SchermataDelleSezioniMieState extends State<SchermataDelleSezioniMie> {
  List<Map<String, dynamic>>? _sezioni;
  int _daQualeScatto = -1;

  void _segna(Quaderno quaderno) {
    quaderno.segna(chiaveDelleSezioniMie, _sezioni);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Le sezioni mie',
    sotto:
        'Pagine intere fatte da te, accanto a quelle della plancia. Ognuna ha '
        'un titolo, un disegno, e dentro le entita\' che ci metti.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      if (_sezioni == null || _daQualeScatto != scatto.revisione) {
        _sezioni = scatto.oggetti(chiaveDelleSezioniMie);
        _daQualeScatto = scatto.revisione;
      }
      final sezioni = _sezioni!;
      return [
        if (sezioni.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.dashboard_customize_outlined,
              titolo: 'Non c\'e\' ancora nessuna pagina tua',
              sotto: 'Aggiungine una qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, una) in sezioni.indexed)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 4),
              clipBehavior: Clip.antiAlias,
              child: ExpansionTile(
                leading: Text(
                  '${una['icona'] ?? '⭐'}',
                  style: const TextStyle(fontSize: 24),
                ),
                title: Text(
                  '${una['titolo'] ?? ''}'.isNotEmpty
                      ? '${una['titolo']}'
                      : 'Pagina ${posto + 1}',
                ),
                subtitle: Text(
                  una['mostra'] == false
                      ? 'non si vede nella barra'
                      : '${(una['voci'] as List? ?? const []).length} entita\'',
                  style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                    color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                  ),
                ),
                childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                children: [
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: CampoDiTesto(
                          etichetta: 'Titolo',
                          valore: '${una['titolo'] ?? ''}',
                          cambiato: (scritto) {
                            una['titolo'] = scritto;
                            _segna(quaderno);
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: CampoDiTesto(
                          etichetta: 'Disegno',
                          valore: '${una['icona'] ?? ''}',
                          suggerimento: '⭐',
                          cambiato: (scritto) {
                            una['icona'] = scritto;
                            _segna(quaderno);
                          },
                        ),
                      ),
                    ],
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    /* Una pagina appena creata deve comparire, o non si capisce
                     * che e' stata creata. */
                    value: una['mostra'] != false,
                    onChanged: (acceso) {
                      una['mostra'] = acceso;
                      _segna(quaderno);
                    },
                    title: const Text('Si vede nella barra'),
                    dense: true,
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: () {
                        sezioni.removeAt(posto);
                        _segna(quaderno);
                      },
                      icon: const Icon(Icons.delete_outline_rounded),
                      label: const Text('Togli questa pagina'),
                      style: TextButton.styleFrom(
                        foregroundColor: Theme.of(dentro).colorScheme.error,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Le entita\' di questa pagina si mettono dalla voce «Le '
                    'entita\' mie», scegliendo questa pagina.',
                    style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                      color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
        const SizedBox(height: 12),
        FilledButton.tonalIcon(
          onPressed: () {
            sezioni.add({
              'id': 'sezione-${sezioni.length + 1}',
              'titolo': '',
              'icona': '⭐',
              'mostra': true,
              'voci': <dynamic>[],
            });
            _segna(quaderno);
          },
          icon: const Icon(Icons.add_rounded),
          label: const Text('Aggiungi una pagina'),
        ),
      ];
    },
  );
}

/// Le cose che scaldano, oltre ai termosifoni.
class SchermataDelCaldo extends StatefulWidget {
  const SchermataDelCaldo({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDelCaldo> createState() => _SchermataDelCaldoState();
}

class _SchermataDelCaldoState extends State<SchermataDelCaldo> {
  List<Map<String, String>>? _voci;
  int _daQualeScatto = -1;

  void _segna(Quaderno quaderno) {
    quaderno.segna(chiaveDelTermicoCaldo, _voci);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Le cose che scaldano',
    sotto:
        'Il termocamino, l\'aspiratore della canna fumaria, la caldaia come '
        'interruttore: quello che scalda oltre ai termosifoni, e che la '
        'plancia mette nella pagina del caldo.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      if (_voci == null || _daQualeScatto != scatto.revisione) {
        _voci = [
          for (final una in scatto.oggetti(chiaveDelTermicoCaldo))
            {
              'name': '${una['name'] ?? ''}',
              'entity': '${una['entity'] ?? ''}',
              'icon': '${una['icon'] ?? '🔥'}',
            },
        ];
        _daQualeScatto = scatto.revisione;
      }
      final voci = _voci!;
      return [
        for (final (posto, una) in voci.indexed)
          Card(
            margin: const EdgeInsets.symmetric(vertical: 4),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: CampoDiTesto(
                          etichetta: 'Come si chiama',
                          valore: una['name'] ?? '',
                          suggerimento: 'Termocamino',
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
                          suggerimento: '🔥',
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
                    contesto: 'che scalda',
                    domini: const ['switch', 'binary_sensor', 'climate', 'fan'],
                    valore: una['entity'] ?? '',
                    collegamento: widget.collegamento,
                    cambiato: (scritto) {
                      una['entity'] = scritto;
                      _segna(quaderno);
                    },
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      onPressed: () {
                        voci.removeAt(posto);
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
            voci.add({'name': '', 'entity': '', 'icon': '🔥'});
            _segna(quaderno);
          },
          icon: const Icon(Icons.add_rounded),
          label: const Text('Aggiungi una cosa che scalda'),
        ),
      ];
    },
  );
}

/// Gli interruttori di casa: le scelte che valgono per tutta la plancia.
///
/// Sono singole risposte a domande singole — la barra ferma o a scomparsa, le
/// pagine accese a mano invece che da sole, chi guarda e basta — e stanno
/// insieme perche' una schermata per interruttore sarebbe otto schermate con
/// dentro una riga.
class SchermataDegliInterruttori extends StatelessWidget {
  const SchermataDegliInterruttori({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Come si comporta la plancia',
    sotto:
        'Le scelte che valgono per tutta la casa, non per una cosa sola. '
        'Valgono ovunque la plancia si apra: chi la mette cosi\' sul telefono '
        'se la ritrova cosi\' anche sul computer.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      bool acceso(String chiave, {bool diSerie = false}) {
        final segnato = quaderno.cambiate[chiave];
        final valore = segnato ?? scatto.aperto(chiave);
        if (valore == null) return diSerie;
        return valore == true || valore == '1' || valore == 'true';
      }

      Widget interruttore(
        String chiave,
        String titolo,
        String spiega, {
        bool diSerie = false,
      }) => Card(
        margin: const EdgeInsets.symmetric(vertical: 4),
        child: SwitchListTile(
          value: acceso(chiave, diSerie: diSerie),
          onChanged: (quanto) => quaderno.segna(chiave, quanto),
          title: Text(titolo),
          subtitle: Text(spiega),
        ),
      );

      final barra =
          '${quaderno.cambiate[chiaveDellaBarra] ?? scatto.aperto(chiaveDellaBarra) ?? 'auto'}';
      return [
        Scheda(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'La barra in fondo',
                style: Theme.of(dentro).textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                'Sempre visibile, o a scomparsa con la maniglia. Non e\' una '
                'scelta del telefono che l\'ha fatta: e\' della plancia, e vale '
                'dappertutto.',
                style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                  color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 10),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'auto', label: Text('A scomparsa')),
                  ButtonSegment(value: 'fixed', label: Text('Sempre')),
                ],
                selected: {barra == 'fixed' ? 'fixed' : 'auto'},
                showSelectedIcon: false,
                onSelectionChanged: (scelta) =>
                    quaderno.segna(chiaveDellaBarra, scelta.first),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        interruttore(
          chiaveDelSoloLettura,
          'Si guarda e basta',
          'La plancia si vede, ma non si comanda: niente si accende e niente '
              'si spegne. Serve al tablet appeso in corridoio.',
        ),
        interruttore(
          chiaveDelleSezioniAMano,
          'Le pagine le accendo io',
          'Di serie una pagina compare da sola quando c\'e\' qualcosa dentro. '
              'Cosi\' invece compaiono solo quelle che hai acceso nella voce '
              '«Le sezioni».',
        ),
        interruttore(
          chiaveDelMeteoProprio,
          'Il meteo dai miei sensori',
          'La temperatura e l\'umidita\' della stazione di casa invece di '
              'quelle del servizio meteo: fuori dalla finestra, non fuori dal '
              'paese.',
        ),
        interruttore(
          chiaveDellaFotoPrimaDelDisegno,
          'La foto prima del disegno',
          'Quando una cosa ha sia una foto sia un disegno, si vede la foto.',
        ),
        interruttore(
          chiaveDelClimaAlContrario,
          'La scheda del clima al contrario',
          'Mette in primo piano la temperatura che c\'e\' invece di quella '
              'impostata.',
        ),
        const SizedBox(height: 16),
        Text(
          'Il fumo',
          style: Theme.of(dentro).textTheme.titleSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 6),
        Text(
          'Un rilevatore che ha suonato resta segnato finche\' non lo si '
          'legge: se sparisse da solo, chi non era in casa non saprebbe mai '
          'che e\' successo.',
          style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
            color: Theme.of(dentro).colorScheme.onSurfaceVariant,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 10),
        if (scatto.mappa(chiaveDelFumo).isEmpty)
          Text(
            'Non c\'e\' niente da leggere: nessun rilevatore ha suonato.',
            style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
              color: Theme.of(dentro).colorScheme.onSurfaceVariant,
            ),
          )
        else
          FilledButton.tonalIcon(
            onPressed: () => quaderno.segna(chiaveDelFumo, <String, dynamic>{}),
            icon: const Icon(Icons.done_all_rounded),
            label: Text('Ho letto (${scatto.mappa(chiaveDelFumo).length})'),
          ),
      ];
    },
  );
}

/// I piani della casa, coi loro disegni.
///
/// Un piano non e' una stanza: e' come si raggruppano le stanze quando ce ne
/// sono quindici e la pagina diventa una lista lunga.
class SchermataDeiPiani extends StatefulWidget {
  const SchermataDeiPiani({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDeiPiani> createState() => _SchermataDeiPianiState();
}

class _SchermataDeiPianiState extends State<SchermataDeiPiani> {
  List<String>? _piani;
  Map<String, dynamic> _disegni = {};
  int _daQualeScatto = -1;

  void _segna(Quaderno quaderno) {
    quaderno.segna(chiaveDeiPiani, [
      for (final uno in _piani!)
        if (uno.trim().isNotEmpty) uno.trim(),
    ]);
    quaderno.segna(chiaveDeiDisegniDeiPiani, {
      for (final voce in _disegni.entries)
        if ('${voce.value}'.trim().isNotEmpty) voce.key: voce.value,
    });
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'I piani',
    sotto:
        'Come si raggruppano le stanze quando ce ne sono tante. Ogni stanza '
        'dice a che piano sta nella sua scheda; qui si dice quali piani '
        'esistono e in che ordine stanno.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      if (_piani == null || _daQualeScatto != scatto.revisione) {
        _piani = scatto.parole(chiaveDeiPiani);
        _disegni = scatto.mappa(chiaveDeiDisegniDeiPiani);
        _daQualeScatto = scatto.revisione;
      }
      final piani = _piani!;
      return [
        if (piani.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.stairs_outlined,
              titolo: 'Non c\'e\' ancora nessun piano',
              sotto: 'Chi ha la casa su un piano solo puo\' lasciare vuoto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, quale) in piani.indexed)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 4),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 4, 4),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: CampoDiTesto(
                        etichetta: 'Come si chiama',
                        valore: quale,
                        suggerimento: 'Piano terra',
                        cambiato: (scritto) {
                          final disegno = _disegni.remove(quale);
                          piani[posto] = scritto;
                          if (disegno != null) _disegni[scritto] = disegno;
                          _segna(quaderno);
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: CampoDiTesto(
                        etichetta: 'Disegno',
                        valore: '${_disegni[quale] ?? ''}',
                        suggerimento: '🏠',
                        cambiato: (scritto) {
                          _disegni[quale] = scritto;
                          _segna(quaderno);
                        },
                      ),
                    ),
                    IconButton(
                      onPressed: posto == 0
                          ? null
                          : () {
                              piani.insert(posto - 1, piani.removeAt(posto));
                              _segna(quaderno);
                            },
                      icon: const Icon(Icons.keyboard_arrow_up_rounded),
                      tooltip: 'Su',
                    ),
                    IconButton(
                      onPressed: () {
                        _disegni.remove(quale);
                        piani.removeAt(posto);
                        _segna(quaderno);
                      },
                      icon: const Icon(Icons.delete_outline_rounded),
                      tooltip: 'Togli',
                    ),
                  ],
                ),
              ),
            ),
        const SizedBox(height: 12),
        FilledButton.tonalIcon(
          onPressed: () {
            piani.add('');
            _segna(quaderno);
          },
          icon: const Icon(Icons.add_rounded),
          label: const Text('Aggiungi un piano'),
        ),
      ];
    },
  );
}
