/// Le voci della configurazione che non sono ne' un elenco ne' una fila di
/// caselle: i generali, le sezioni accese, l'ordine della barra, le
/// sostituzioni, e la manutenzione.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/impostazioni.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/// Le otto sezioni della plancia, con le stesse parole della Config
/// (`cdVisibSez()` nel runtime della dashboard).
const sezioniDellaPlancia = <(String, String, String)>[
  ('home', 'Home', 'Meteo, avvisi, azioni rapide'),
  ('energy', 'Energia', 'Fotovoltaico e consumi'),
  ('ev', 'Auto elettrica', 'EV + wallbox (EVCC)'),
  ('boiler', 'Solare termico', 'Boiler solare'),
  ('clima', 'Clima', 'Condizionatori e riscaldamento'),
  ('temp', 'Temperatura', 'Temperature e umidita\''),
  ('security', 'Sicurezza', 'Telecamere e allarme'),
  ('server', 'MiniPC', 'Monitoraggio server'),
];

/* ─── Generali ───────────────────────────────────────────────────────────── */

/// Il nome della dashboard, il sottotitolo, e chi puo' cambiare la
/// configurazione.
class SchermataDeiGenerali extends StatelessWidget {
  const SchermataDeiGenerali({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Generali',
    sotto: 'Come si chiama la tua dashboard, e chi la puo\' cambiare.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final marchio = Map<String, dynamic>.from(scatto.mappa('cd_branding'));
      final segnatoMarchio = quaderno.cambiate['cd_branding'];
      if (segnatoMarchio is Map) {
        marchio.addAll(Map<String, dynamic>.from(segnatoMarchio));
      }
      final collegamentoScritto = Map<String, dynamic>.from(
        scatto.mappa('cd_connection'),
      );
      final segnatoCollegamento = quaderno.cambiate['cd_connection'];
      if (segnatoCollegamento is Map) {
        collegamentoScritto.addAll(
          Map<String, dynamic>.from(segnatoCollegamento),
        );
      }
      final padroni = collegamentoScritto['admin_users'];
      final padrone = padroni is List && padroni.isNotEmpty
          ? '${padroni.first}'
          : '';
      return [
        CampoDiTesto(
          etichetta: 'Nome della dashboard',
          valore: '${marchio['title'] ?? ''}',
          suggerimento: 'SMART HOME',
          cambiato: (scritto) =>
              quaderno.segna('cd_branding', {...marchio, 'title': scritto}),
        ),
        const SizedBox(height: 14),
        CampoDiTesto(
          etichetta: 'Sottotitolo',
          valore: '${marchio['subtitle'] ?? ''}',
          cambiato: (scritto) =>
              quaderno.segna('cd_branding', {...marchio, 'subtitle': scritto}),
        ),
        const SizedBox(height: 26),
        const Insegna('Chi comanda la configurazione'),
        CampoDiTesto(
          etichetta: 'Utente amministratore',
          valore: padrone,
          suggerimento: 'vuoto = la Config la vedono tutti',
          cambiato: (scritto) => quaderno.segna('cd_connection', {
            ...collegamentoScritto,
            'admin_users': scritto.trim().isEmpty ? [] : [scritto.trim()],
          }),
        ),
        const SizedBox(height: 10),
        Scheda(
          colore: Theme.of(dentro).colorScheme.surfaceContainerHigh,
          child: Text(
            'E\' il nome utente di Home Assistant di chi puo\' cambiare la '
            'configurazione. Lasciandolo vuoto la puo\' cambiare chiunque '
            'apra la casa: e\' come sta adesso, e per una famiglia sola va '
            'benissimo.',
            style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
              color: Theme.of(dentro).colorScheme.onSurfaceVariant,
              height: 1.45,
            ),
          ),
        ),
      ];
    },
  );
}

/* ─── Le sezioni accese ──────────────────────────────────────────────────── */

/// Quali pagine della plancia si vedono.
class SchermataDelleSezioni extends StatelessWidget {
  const SchermataDelleSezioni({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Le sezioni',
    sotto:
        'Le pagine spente spariscono dalla barra della plancia. Quello che '
        'c\'e\' dentro non si perde: si rivede riaccendendole.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final acceso = Map<String, dynamic>.from(scatto.mappa('cd_sections'));
      final segnato = quaderno.cambiate['cd_sections'];
      if (segnato is Map) acceso.addAll(Map<String, dynamic>.from(segnato));
      return [
        Scheda(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final (chiave, nome, spiega) in sezioniDellaPlancia)
                SwitchListTile(
                  title: Text(nome),
                  subtitle: Text(spiega),
                  /* Di serie sono accese: nella plancia una sezione e' spenta
                   * solo se c'e' scritto `false`, e una chiave che manca vuol
                   * dire accesa. */
                  value: acceso[chiave] != false,
                  onChanged: (adesso) => quaderno.segna('cd_sections', {
                    ...acceso,
                    chiave: adesso,
                  }),
                ),
            ],
          ),
        ),
      ];
    },
  );
}

/* ─── L'ordine della barra ───────────────────────────────────────────────── */

/// In che fila stanno le pagine, in fondo alla plancia.
class SchermataDellOrdine extends StatefulWidget {
  const SchermataDellOrdine({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDellOrdine> createState() => _SchermataDellOrdineState();
}

class _SchermataDellOrdineState extends State<SchermataDellOrdine> {
  List<String>? _ordine;
  int _daQualeScatto = -1;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'L\'ordine della barra',
    sotto:
        'La fila in fondo alla plancia. La prima e\' quella che si apre '
        'entrando.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      if (_ordine == null || _daQualeScatto != scatto.revisione) {
        final scritto = scatto.parole('cd_navbar_order');
        /* Chi non ha mai riordinato non ha la chiave: si parte dall'ordine di
         * serie, che e' quello in cui la plancia le mette. E se la chiave c'e'
         * ma e' vecchia — una sezione aggiunta dopo — le mancanti si mettono
         * in fondo invece di sparire. */
        final tutte = [
          for (final (chiave, _, _) in sezioniDellaPlancia) chiave,
        ];
        _ordine = [
          ...scritto.where(tutte.contains),
          ...tutte.where((una) => !scritto.contains(una)),
        ];
        _daQualeScatto = scatto.revisione;
      }
      final ordine = _ordine!;
      final nomi = {
        for (final (chiave, nome, _) in sezioniDellaPlancia) chiave: nome,
      };
      return [
        Scheda(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: ReorderableListView(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            buildDefaultDragHandles: false,
            onReorderItem: (da, a) {
              setState(() {
                final presa = ordine.removeAt(da);
                ordine.insert(a, presa);
              });
              quaderno.segna('cd_navbar_order', ordine);
            },
            children: [
              for (final (quale, chiave) in ordine.indexed)
                ListTile(
                  key: ValueKey(chiave),
                  dense: true,
                  leading: Text(
                    '${quale + 1}',
                    style: Theme.of(dentro).textTheme.titleSmall,
                  ),
                  title: Text(nomi[chiave] ?? chiave),
                  trailing: ReorderableDragStartListener(
                    index: quale,
                    child: const Icon(Icons.drag_handle_rounded),
                  ),
                ),
            ],
          ),
        ),
      ];
    },
  );
}

/* ─── Le sostituzioni ────────────────────────────────────────────────────── */

/// Hai cambiato una presa: qui si sostituisce ovunque compaia.
class SchermataDelleSostituzioni extends StatelessWidget {
  const SchermataDelleSostituzioni({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Sostituzioni',
    sotto:
        'Sostituisci un\'entita\' con un\'altra, ovunque la plancia la usi: '
        'tessere, storico, comandi. Serve quando cambi una presa smart o un '
        'sensore e non vuoi rifare la configurazione.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final tutte = Map<String, dynamic>.from(
        scatto.mappa('cd_entity_overrides'),
      );
      final segnate = quaderno.cambiate['cd_entity_overrides'];
      if (segnate is Map) tutte.addAll(Map<String, dynamic>.from(segnate));
      /* Le chiavi che cominciano per `dm.` non sono sostituzioni: sono le
       * caselle delle pagine, e si cambiano di la'. Mostrarle qui vorrebbe
       * dire cento righe in cui la sostituzione vera non si trova piu'. */
      final mie = {
        for (final voce in tutte.entries)
          if (!voce.key.startsWith('dm.')) voce.key: '${voce.value}',
      };
      return [
        if (mie.isEmpty)
          const StatoVuoto(
            icona: Icons.swap_horiz_rounded,
            titolo: 'Nessuna sostituzione',
            sotto: 'Quando ne aggiungi una la trovi qui.',
            dentroUnaLista: true,
          )
        else
          Scheda(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final voce in mie.entries)
                  ListTile(
                    dense: true,
                    title: Text(
                      voce.key,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12.5,
                      ),
                    ),
                    subtitle: Text(
                      '→ ${voce.value}',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12.5,
                      ),
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline_rounded),
                      color: Theme.of(dentro).colorScheme.error,
                      onPressed: () {
                        final dopo = Map<String, dynamic>.from(tutte)
                          ..remove(voce.key);
                        quaderno.segna('cd_entity_overrides', dopo);
                      },
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 16),
        _NuovaSostituzione(
          collegamento: collegamento,
          aggiungi: (vecchia, nuova) =>
              quaderno.segna('cd_entity_overrides', {...tutte, vecchia: nuova}),
        ),
      ];
    },
  );
}

class _NuovaSostituzione extends StatefulWidget {
  const _NuovaSostituzione({
    required this.collegamento,
    required this.aggiungi,
  });

  final Collegamento collegamento;
  final void Function(String vecchia, String nuova) aggiungi;

  @override
  State<_NuovaSostituzione> createState() => _NuovaSostituzioneState();
}

class _NuovaSostituzioneState extends State<_NuovaSostituzione> {
  String _vecchia = '';
  String _nuova = '';

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Insegna('Aggiungine una'),
      CampoDiEntita(
        etichetta: 'Quella di adesso, nella plancia',
        valore: _vecchia,
        collegamento: widget.collegamento,
        cambiato: (scritto) => setState(() => _vecchia = scritto),
      ),
      const SizedBox(height: 12),
      CampoDiEntita(
        etichetta: 'Quella che la sostituisce',
        valore: _nuova,
        collegamento: widget.collegamento,
        cambiato: (scritto) => setState(() => _nuova = scritto),
      ),
      const SizedBox(height: 14),
      FilledButton.tonalIcon(
        onPressed: _vecchia.contains('.') && _nuova.contains('.')
            ? () {
                widget.aggiungi(_vecchia.trim(), _nuova.trim());
                setState(() {
                  _vecchia = '';
                  _nuova = '';
                });
              }
            : null,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Aggiungi sostituzione'),
      ),
    ],
  );
}

/* ─── Runtime ────────────────────────────────────────────────────────────── */

/// La diagnosi: cosa c'e' scritto nella configurazione, chiave per chiave.
///
/// Non si cambia niente da qui. Serve a una cosa sola, ed e' quella che serve
/// davvero quando qualcosa non torna: **far vedere cosa c'e' scritto**.
class SchermataDelRuntime extends StatelessWidget {
  const SchermataDelRuntime({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Runtime',
    sotto:
        'Cosa c\'e\' scritto nella configurazione, com\'e\' scritto. Da qui '
        'non si cambia niente: e\' la pagina da fotografare quando qualcosa '
        'non torna.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final colori = Theme.of(dentro).colorScheme;
      final chiavi = scatto.valori.keys.toList()..sort();
      return [
        Scheda(
          colore: colori.surfaceContainerHigh,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Riga('Revisione', '${scatto.revisione}'),
              _Riga('Chiavi in tutto', '${scatto.valori.length}'),
              _Riga('Chiavi con dentro qualcosa', '${scatto.quanteChiavi}'),
              _Riga(
                'Quanto pesa',
                '${(scatto.valori.values.fold<int>(0, (t, v) => t + v.length) / 1024).toStringAsFixed(1)} kB',
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Insegna('Le chiavi'),
        Scheda(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final chiave in chiavi)
                ListTile(
                  dense: true,
                  title: Text(
                    chiave,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12.5,
                    ),
                  ),
                  subtitle: Text(
                    scatto.valori[chiave]!.length > 120
                        ? '${scatto.valori[chiave]!.substring(0, 120)}…'
                        : scatto.valori[chiave]!,
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                  trailing: Text(
                    '${scatto.valori[chiave]!.length}',
                    style: Theme.of(dentro).textTheme.labelSmall,
                  ),
                ),
            ],
          ),
        ),
      ];
    },
  );
}

class _Riga extends StatelessWidget {
  const _Riga(this.cosa, this.quanto);
  final String cosa;
  final String quanto;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Expanded(
          child: Text(
            cosa,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        Text(
          quanto,
          style: Theme.of(context).textTheme.bodyMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
}

/* ─── Riporta tutto com'era ──────────────────────────────────────────────── */

/// Le revisioni tenute da parte dal ponte, e il bottone per rimetterne una.
class SchermataDelRipristino extends StatefulWidget {
  const SchermataDelRipristino({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDelRipristino> createState() => _SchermataDelRipristinoState();
}

class _SchermataDelRipristinoState extends State<SchermataDelRipristino> {
  LaConfigurazione? _cassetta;
  List<RevisioneTenuta>? _tenute;
  String? _male;
  bool _sto = false;

  @override
  void initState() {
    super.initState();
    unawaited(_leggi());
  }

  Future<void> _leggi() async {
    final filo = widget.collegamento.filo;
    if (filo == null) {
      setState(() => _male = 'La casa non e\' collegata.');
      return;
    }
    final cassetta = _cassetta ??= LaConfigurazione(filo);
    try {
      await cassetta.leggi();
      if (!mounted) return;
      setState(() {
        _tenute = cassetta.tenute;
        _male = null;
      });
    } on Object catch (male) {
      if (mounted) setState(() => _male = '$male');
    }
  }

  Future<void> _rimetti(RevisioneTenuta quale) async {
    final sicuro = await showDialog<bool>(
      context: context,
      builder: (dentro) => AlertDialog(
        title: const Text('Rimettere questa?'),
        content: Text(
          'La configurazione di adesso viene sostituita da quella della '
          'revisione ${quale.revisione}. Quella di adesso resta comunque fra '
          'le revisioni tenute, quindi si puo\' tornare indietro.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dentro).pop(false),
            child: const Text('Lascia stare'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dentro).pop(true),
            child: const Text('Rimettila'),
          ),
        ],
      ),
    );
    if (sicuro != true || !mounted) return;
    setState(() => _sto = true);
    try {
      await _cassetta!.rimetti(quale.revisione);
      widget.collegamento.laPlanciaECambiata();
      if (!mounted) return;
      setState(() {
        _sto = false;
        _tenute = _cassetta!.tenute;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Rimessa. La plancia si aggiorna da sola.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on Object catch (male) {
      if (!mounted) return;
      setState(() {
        _sto = false;
        _male = '$male';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final tenute = _tenute;
    return Scaffold(
      appBar: AppBar(title: const Text('Riporta tutto com\'era')),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 16),
              child: Text(
                'Il ponte tiene da parte le ultime cinque configurazioni che '
                'avevano dentro qualcosa. Se qualcosa e\' andato storto — un '
                'telefono che ha scritto una plancia vuota, una modifica di '
                'cui ti sei pentito — da qui si rimette una di quelle.',
                style: Theme.of(context).textTheme.bodyMedium
                    ?.copyWith(color: colori.onSurfaceVariant, height: 1.45),
              ),
            ),
            if (_male != null)
              StatoVuoto(
                icona: Icons.cloud_off_rounded,
                titolo: 'Non riesco a leggere',
                sotto: _male!,
                dentroUnaLista: true,
                azione: FilledButton(
                  onPressed: _leggi,
                  child: const Text('Riprova'),
                ),
              )
            else if (tenute == null)
              const Center(child: CircularProgressIndicator())
            else if (tenute.isEmpty)
              const StatoVuoto(
                icona: Icons.history_rounded,
                titolo: 'Non c\'e\' niente da rimettere',
                sotto:
                    'Il ponte tiene una revisione solo quando la '
                    'configurazione cambia davvero.',
                dentroUnaLista: true,
              )
            else
              Scheda(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final una in tenute)
                      ListTile(
                        title: Text('Revisione ${una.revisione}'),
                        subtitle: Text(
                          '${una.chiavi} chiavi · ${_quando(una.quando)}',
                        ),
                        trailing: TextButton(
                          onPressed: _sto ? null : () => _rimetti(una),
                          child: const Text('Rimettila'),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

String _quando(DateTime quando) {
  final due = quando.toLocal();
  String zero(int quanto) => quanto.toString().padLeft(2, '0');
  return '${zero(due.day)}/${zero(due.month)} alle ${zero(due.hour)}:${zero(due.minute)}';
}

/* ─── Piscina ────────────────────────────────────────────────────────────── */

/// La piscina: i sensori, la pompa, e la filtrazione automatica.
///
/// Non e' un elenco: e' **un oggetto solo** con dentro una decina di campi
/// (`cd_piscina`), e va riscritto tutto insieme lasciando stare quello che la
/// schermata non conosce — la plancia ci tiene anche l'ultima accensione.
class SchermataDellaPiscina extends StatelessWidget {
  const SchermataDellaPiscina({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Piscina',
    sotto:
        'Sensori, pompa e filtrazione. In automatico le ore di filtrazione '
        'sono la temperatura dell\'acqua diviso due, fra un minimo di 2 e un '
        'massimo di 12.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final piscina = Map<String, dynamic>.from(scatto.mappa('cd_piscina'));
      final segnata = quaderno.cambiate['cd_piscina'];
      if (segnata is Map) piscina.addAll(Map<String, dynamic>.from(segnata));
      void cambia(String campo, Object? valore) => quaderno.segna(
        'cd_piscina',
        {...piscina, if (valore != null) campo: valore}
          ..removeWhere((_, quanto) => quanto is String && quanto.isEmpty),
      );
      return [
        const Insegna('I sensori'),
        for (final (campo, nome) in const [
          ('tempEnt', 'Temperatura dell\'acqua'),
          ('phEnt', 'pH (se ce l\'hai)'),
          ('clEnt', 'Cloro (se ce l\'hai)'),
        ]) ...[
          CampoDiEntita(
            etichetta: nome,
            valore: '${piscina[campo] ?? ''}',
            domini: const ['sensor'],
            collegamento: collegamento,
            cambiato: (scritto) => cambia(campo, scritto),
          ),
          const SizedBox(height: 14),
        ],
        const SizedBox(height: 12),
        const Insegna('Cosa si comanda'),
        CampoDiEntita(
          etichetta: 'Pompa di filtrazione',
          valore: '${piscina['pumpEnt'] ?? ''}',
          domini: const ['switch'],
          collegamento: collegamento,
          cambiato: (scritto) => cambia('pumpEnt', scritto),
        ),
        const SizedBox(height: 14),
        CampoDiEntita(
          etichetta: 'Riscaldamento (se ce l\'hai)',
          valore: '${piscina['heatEnt'] ?? ''}',
          domini: const ['switch'],
          collegamento: collegamento,
          cambiato: (scritto) => cambia('heatEnt', scritto),
        ),
        const SizedBox(height: 26),
        const Insegna('La filtrazione'),
        Scheda(
          padding: EdgeInsets.zero,
          child: SwitchListTile(
            title: const Text('Ore automatiche'),
            subtitle: const Text('Temperatura diviso due, fra 2 e 12 ore'),
            value: piscina['autoHours'] != false,
            onChanged: (acceso) => cambia('autoHours', acceso),
          ),
        ),
        const SizedBox(height: 14),
        CampoDiTesto(
          etichetta: 'A che ora comincia',
          valore: '${piscina['filterStart'] ?? '09:00'}',
          suggerimento: '09:00',
          cambiato: (scritto) => cambia('filterStart', scritto),
        ),
        const SizedBox(height: 14),
        if (piscina['autoHours'] == false)
          CampoDiTesto(
            etichetta: 'Per quante ore',
            valore: '${piscina['filterHours'] ?? 8}',
            numerico: true,
            cambiato: (scritto) =>
                cambia('filterHours', int.tryParse(scritto) ?? 8),
          ),
        const SizedBox(height: 26),
        const Insegna('Il pH che va bene'),
        Row(
          children: [
            Expanded(
              child: CampoDiTesto(
                etichetta: 'Minimo',
                valore: '${piscina['phMin'] ?? 7.0}',
                numerico: true,
                cambiato: (scritto) => cambia(
                  'phMin',
                  double.tryParse(scritto.replaceAll(',', '.')) ?? 7.0,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: CampoDiTesto(
                etichetta: 'Massimo',
                valore: '${piscina['phMax'] ?? 7.6}',
                numerico: true,
                cambiato: (scritto) => cambia(
                  'phMax',
                  double.tryParse(scritto.replaceAll(',', '.')) ?? 7.6,
                ),
              ),
            ),
          ],
        ),
      ];
    },
  );
}

/* ─── Irrigazione ────────────────────────────────────────────────────────── */

/// Quando innaffia, e quando salta il turno perche' ha piovuto.
///
/// Le zone sono un elenco a parte (la voce «Le zone»), perche' un elenco che
/// cresce dentro un modulo di quattro campi si mangia il modulo.
class SchermataDellIrrigazione extends StatelessWidget {
  const SchermataDellIrrigazione({
    super.key,
    required this.collegamento,
    required this.apriLeZone,
  });

  final Collegamento collegamento;
  final VoidCallback apriLeZone;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Irrigazione',
    sotto: 'A che ora parte, e quando salta il turno perche\' ha piovuto.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final irrigazione = Map<String, dynamic>.from(
        scatto.mappa('cd_irrigazione'),
      );
      final segnata = quaderno.cambiate['cd_irrigazione'];
      if (segnata is Map) {
        irrigazione.addAll(Map<String, dynamic>.from(segnata));
      }
      void cambia(String campo, Object? valore) =>
          quaderno.segna('cd_irrigazione', {...irrigazione, campo: valore});
      final zone = irrigazione['zones'];
      final quante = zone is List ? zone.length : 0;
      return [
        Scheda(
          quandoPremuta: apriLeZone,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Le zone',
                      style: Theme.of(dentro).textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      quante == 0
                          ? 'Nessuna zona: aggiungile qui'
                          : '$quante ${quante == 1 ? 'zona' : 'zone'}',
                      style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                        color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const Insegna('Quando'),
        CampoDiTesto(
          etichetta: 'A che ora parte',
          valore: '${irrigazione['time'] ?? '06:30'}',
          suggerimento: '06:30',
          cambiato: (scritto) => cambia('time', scritto),
        ),
        const SizedBox(height: 24),
        const Insegna('Quando invece non parte'),
        CampoDiEntita(
          etichetta: 'Sensore di pioggia o probabilita\'',
          valore: '${irrigazione['rainEnt'] ?? ''}',
          domini: const ['sensor'],
          collegamento: collegamento,
          cambiato: (scritto) => cambia('rainEnt', scritto),
        ),
        const SizedBox(height: 14),
        CampoDiTesto(
          etichetta: 'Sopra quale valore salta il turno',
          valore: '${irrigazione['rainThr'] ?? 60}',
          numerico: true,
          suggerimento: '60',
          cambiato: (scritto) => cambia('rainThr', int.tryParse(scritto) ?? 60),
        ),
      ];
    },
  );
}

/* ─── Il telefono, non la casa ───────────────────────────────────────────── */

/// Il tema e la barra della plancia: due scelte di **questo dispositivo**.
///
/// Nella dashboard stavano nella sua pagina Config, e non viaggiavano col
/// resto della configurazione: la dashboard le tiene apposta fuori dalle
/// chiavi che si sincronizzano, perche' il tablet in cucina puo' stare sullo
/// scuro mentre il telefono segue il sistema. Quando la Config e' uscita dalla
/// plancia sono uscite con lei, e siccome sono del dispositivo le tiene l'app:
/// il servitore le scrive nella pagina prima che parta.
class SchermataDelDispositivo extends StatelessWidget {
  const SchermataDelDispositivo({
    super.key,
    required this.titolo,
    required this.sotto,
    required this.impostazioni,
    required this.ilTema,
  });

  final String titolo;
  final String sotto;
  final Impostazioni impostazioni;

  /// `true` per il tema, `false` per la barra: due voci, una schermata.
  final bool ilTema;

  static const _temi = <(String, String, String)>[
    ('auto', 'Come il telefono', 'Segue il tema del sistema'),
    ('chiaro', 'Chiaro', 'Sempre chiara'),
    ('scuro', 'Scuro', 'Sempre scura'),
  ];

  static const _barre = <(String, String, String)>[
    (
      'scomparsa',
      'A scomparsa',
      'Si chiama con la maniglia, e lascia tutto lo schermo alla casa',
    ),
    ('fissa', 'Sempre visibile', 'Sta li\', in fondo, e non si nasconde'),
  ];

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final scelte = ilTema ? _temi : _barre;
    return Scaffold(
      appBar: AppBar(title: Text(titolo)),
      body: SafeArea(
        top: false,
        child: StreamBuilder<void>(
          stream: impostazioni.cambiamenti,
          builder: (qui, _) {
            final adesso = ilTema
                ? impostazioni.temaDellaPlancia
                : impostazioni.barraDellaPlancia;
            return ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 16),
                  child: Text(
                    sotto,
                    style: Theme.of(qui).textTheme.bodyMedium?.copyWith(
                      color: colori.onSurfaceVariant,
                      height: 1.45,
                    ),
                  ),
                ),
                Scheda(
                  padding: EdgeInsets.zero,
                  child: RadioGroup<String>(
                    groupValue: adesso,
                    onChanged: (scelto) {
                      if (scelto == null) return;
                      unawaited(
                        impostazioni.metti(
                          temaDellaPlancia: ilTema ? scelto : null,
                          barraDellaPlancia: ilTema ? null : scelto,
                        ),
                      );
                    },
                    child: Column(
                      children: [
                        for (final (quale, nome, spiega) in scelte)
                          RadioListTile<String>(
                            value: quale,
                            title: Text(nome),
                            subtitle: Text(spiega),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Scheda(
                  colore: colori.surfaceContainerHigh,
                  child: Text(
                    'Vale su questo telefono e basta: gli altri dispositivi '
                    'di casa tengono la loro scelta. La plancia si ricarica '
                    'da sola per applicarla.',
                    style: Theme.of(qui).textTheme.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
