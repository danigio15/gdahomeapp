/// Le voci della configurazione che non sono ne' un elenco ne' una fila di
/// caselle: i generali, le sezioni accese, l'ordine della barra, le
/// sostituzioni, e la manutenzione.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/impostazioni.dart';
import '../../casa/plancia/orari.dart';
import '../../casa/plancia/scatto.dart';
import '../../casa/plancia/scelte.dart';
import '../../casa/plancia/vasche.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/// Le sezioni della plancia, con le stesse parole della Config.
///
/// Sono `SEZIONI` di `core/lelenco-delle-sezioni.js` (1.4.17): la chiave
/// che sta in `cd_sections`, il nome, e una riga sotto. E' l'elenco che
/// decide quale tasto della barra sparisce quando in `cd_sections` c'e'
/// scritto `false` — e sono ventisei, piu' Assist che ha la sua riga.
const sezioniDellaPlancia = <(String, String, String)>[
  ('home', 'Home', 'Meteo, avvisi, azioni rapide'),
  ('energy', 'Energia', 'Fotovoltaico e consumi'),
  ('ev', 'Auto elettrica', 'EV + wallbox (EVCC)'),
  ('boiler', 'Gestione termica', 'Solare, scaldabagno, caldaia'),
  ('security', 'Sicurezza', 'Telecamere e allarme'),
  ('server', 'Server e rete', 'Il server, i container, la rete'),
  ('temp', 'Temperature', 'Temperature e umidita\''),
  ('clima', 'Clima', 'Condizionatori e riscaldamento'),
  ('tapparelle', 'Finestre', 'Tapparelle, tende e finestre'),
  ('piscina', 'Piscina', 'Sensori, pompa e filtrazione'),
  ('irrigazione', 'Irrigazione', 'Le zone e il loro programma'),
  ('appliances', 'Elettrodomestici', 'Lavatrice, lavastoviglie, forno'),
  ('robot', 'Aspirapolvere', 'Aspirapolvere e lavapavimenti'),
  ('animali', 'Animali', 'Il gatto e il cane di casa'),
  ('luci', 'Luci', 'Le luci, stanza per stanza'),
  ('stanze', 'Stanze', 'Le stanze e quello che ci sta dentro'),
  ('calendario', 'Agenda', 'Calendari e liste di cose da fare'),
  ('ups', 'UPS', 'I gruppi di continuita\''),
  ('allerte', 'Allerte', 'Meteo e protezione civile'),
  ('rifiuti', 'Rifiuti', 'La raccolta differenziata'),
  ('varchi', 'Varchi', 'I contatti di porte e finestre'),
  ('presenza', 'Presenza', 'Movimento e presenza'),
  ('porte', 'Porte e cancelli', 'Le aperture che si comandano'),
  ('media', 'Musica', 'Lettori e casse'),
  ('batterie', 'Batterie', 'Le pile di casa'),
  ('mie', 'Le tue sezioni', 'Le pagine fatte da te'),
  (sezioneDiAssist, 'Assist', 'Chiedere le cose a casa, scrivendo o parlando'),
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
        const Insegna('La lingua della plancia'),
        /* La lingua (#350) **non e' JSON**: la plancia la legge con
         * `getItem` nuda, e si scrive nuda — una stringa in Dart passa cosi'
         * com'e'. «Lingua di Home Assistant» vuol dire nessuna scelta, e
         * nessuna scelta e' la chiave che non c'e'. */
        DropdownButtonFormField<String>(
          initialValue:
              lingueDellaPlancia.any(
                (una) => una.$1 == _laLingua(quaderno, scatto),
              )
              ? _laLingua(quaderno, scatto)
              : 'auto',
          decoration: const InputDecoration(
            labelText: 'Lingua della plancia',
            border: OutlineInputBorder(),
            isDense: true,
          ),
          items: [
            const DropdownMenuItem(
              value: 'auto',
              child: Text('Lingua di Home Assistant'),
            ),
            for (final (codice, nome) in lingueDellaPlancia)
              DropdownMenuItem(value: codice, child: Text(nome)),
          ],
          onChanged: (scelta) => quaderno.segna(
            chiaveDellaLingua,
            scelta == null || scelta == 'auto' ? null : scelta,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Lasciandola sulla lingua di Home Assistant la plancia segue il '
          'profilo di chi guarda. Sceglierne una la fissa per questa '
          'dashboard, anche se Home Assistant parla un\'altra lingua.',
          style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
            color: Theme.of(dentro).colorScheme.onSurfaceVariant,
            height: 1.4,
          ),
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

/// La lingua com'e' adesso: quella segnata sul quaderno, o quella nello
/// scatto, letta nuda (non e' JSON). `auto` quando non c'e'.
String _laLingua(Quaderno quaderno, Scatto scatto) {
  if (quaderno.cambiate.containsKey(chiaveDellaLingua)) {
    final segnata = quaderno.cambiate[chiaveDellaLingua];
    return segnata is String && segnata.isNotEmpty ? segnata : 'auto';
  }
  final scritta = scatto.valori[chiaveDellaLingua]?.trim() ?? '';
  return scritta.isEmpty ? 'auto' : scritta;
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
/// **Le vasche sono piu' d'una**, come nella dashboard: la prima sta in cima
/// all'oggetto salvato — dove il runtime l'ha sempre cercata — e le altre
/// nell'elenco `pools` accanto. Vedi `casa/plancia/vasche.dart`, che e' il
/// porto di `pool-model.js`; qui c'e' solo la fila delle pastiglie che dice
/// quale si sta guardando, la stessa dell'Energia.
///
/// Quello che la schermata non conosce resta dov'e': la plancia in
/// `cd_piscina` ci tiene anche l'ultima accensione, e riscrivere l'oggetto da
/// zero vorrebbe dire azzerare lo storico della filtrazione.
class SchermataDellaPiscina extends StatefulWidget {
  const SchermataDellaPiscina({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDellaPiscina> createState() => _SchermataDellaPiscinaState();
}

class _SchermataDellaPiscinaState extends State<SchermataDellaPiscina> {
  int _scelta = 0;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Piscina',
    sotto:
        'Sensori, pompa e filtrazione. In automatico le ore di filtrazione '
        'sono la temperatura dell\'acqua diviso due, fra un minimo di 2 e un '
        'massimo di 12.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final collegamento = widget.collegamento;
      final tutto = Map<String, dynamic>.from(scatto.mappa('cd_piscina'));
      final segnata = quaderno.cambiate['cd_piscina'];
      if (segnata is Map) tutto.addAll(Map<String, dynamic>.from(segnata));
      final vasche = leVasche(tutto);
      if (_scelta >= vasche.length) _scelta = vasche.length - 1;
      final piscina = vasche[_scelta];
      void scrivi(List<Map<String, dynamic>> adesso) =>
          quaderno.segna('cd_piscina', vascheDaSalvare(adesso, tutto));
      void cambia(String campo, Object? valore) {
        final dopo = [...vasche];
        final questa = Map<String, dynamic>.from(dopo[_scelta]);
        if (valore == null || (valore is String && valore.isEmpty)) {
          questa.remove(campo);
        } else {
          questa[campo] = valore;
        }
        dopo[_scelta] = questa;
        scrivi(dopo);
      }

      return [
        _LeVasche(
          vasche: vasche,
          scelta: _scelta,
          scegli: (quale) => setState(() => _scelta = quale),
          aggiungi: () {
            scrivi([...vasche, <String, dynamic>{}]);
            setState(() => _scelta = vasche.length);
          },
          elimina: vasche.length < 2
              ? null
              : () {
                  final dopo = [...vasche]..removeAt(_scelta);
                  scrivi(dopo);
                  setState(() => _scelta = 0);
                },
        ),
        const SizedBox(height: 18),
        /* Il nome, che serve solo quando le vasche sono piu' d'una: con una
         * sola la pastiglia non c'e' e il nome non lo leggerebbe nessuno. */
        if (vasche.length > 1) ...[
          CampoDiTesto(
            etichetta: 'Come si chiama',
            valore: '${piscina['name'] ?? ''}',
            suggerimento: 'Piscina, Idromassaggio…',
            cambiato: (scritto) => cambia('name', scritto),
          ),
          const SizedBox(height: 24),
        ],
        const Insegna('I sensori'),
        for (final (campo, nome) in const [
          ('tempEnt', 'Temperatura dell\'acqua'),
          ('phEnt', 'pH (se ce l\'hai)'),
          ('clEnt', 'Cloro (se ce l\'hai)'),
        ]) ...[
          CampoDiEntita(
            tessera: TesseraDelCampo(
              'piscina',
              scatto: scatto,
              quaderno: quaderno,
            ),
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
          tessera: TesseraDelCampo(
            'piscina',
            scatto: scatto,
            quaderno: quaderno,
          ),
          etichetta: 'Pompa di filtrazione',
          valore: '${piscina['pumpEnt'] ?? ''}',
          domini: const ['switch'],
          collegamento: collegamento,
          cambiato: (scritto) => cambia('pumpEnt', scritto),
        ),
        const SizedBox(height: 14),
        CampoDiEntita(
          tessera: TesseraDelCampo(
            'piscina',
            scatto: scatto,
            quaderno: quaderno,
          ),
          etichetta: 'Riscaldamento (se ce l\'hai)',
          valore: '${piscina['heatEnt'] ?? ''}',
          domini: const ['switch'],
          collegamento: collegamento,
          cambiato: (scritto) => cambia('heatEnt', scritto),
        ),
        const SizedBox(height: 14),
        CampoDiEntita(
          tessera: TesseraDelCampo(
            'piscina',
            scatto: scatto,
            quaderno: quaderno,
          ),
          etichetta: 'Luce della vasca',
          valore: '${piscina['lightEnt'] ?? ''}',
          domini: const ['light', 'switch'],
          collegamento: collegamento,
          cambiato: (scritto) => cambia('lightEnt', scritto),
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
        const SizedBox(height: 26),
        /* Il cloro ha la sua banda come il pH, e non ha valori di partenza:
         * dipende da come si tratta l'acqua, e un numero inventato qui
         * direbbe «fuori norma» a chi sta benissimo. */
        const Insegna('Il cloro che va bene'),
        Row(
          children: [
            for (final (campo, nome) in const [
              ('clMin', 'Minimo'),
              ('clMax', 'Massimo'),
            ]) ...[
              if (campo == 'clMax') const SizedBox(width: 12),
              Expanded(
                child: CampoDiTesto(
                  etichetta: nome,
                  valore: '${piscina[campo] ?? ''}',
                  numerico: true,
                  cambiato: (scritto) => cambia(
                    campo,
                    double.tryParse(scritto.replaceAll(',', '.')),
                  ),
                ),
              ),
            ],
          ],
        ),
      ];
    },
  );
}

/// La fila delle pastiglie: quale vasca si sta configurando.
///
/// Con una sola non compare nessuna pastiglia — solo «Aggiungi un'altra
/// vasca» — che e' come fa l'Energia: chi ha una piscina e basta non deve
/// nemmeno accorgersi che l'elenco esiste.
class _LeVasche extends StatelessWidget {
  const _LeVasche({
    required this.vasche,
    required this.scelta,
    required this.scegli,
    required this.aggiungi,
    required this.elimina,
  });

  final List<Map<String, dynamic>> vasche;
  final int scelta;
  final ValueChanged<int> scegli;
  final VoidCallback aggiungi;
  final VoidCallback? elimina;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: [
        if (vasche.length > 1)
          for (final (quale, una) in vasche.indexed)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                avatar: const Text('🏊'),
                label: Text(comeSiChiamaLaVasca(una, quale)),
                selected: quale == scelta,
                onSelected: (_) => scegli(quale),
              ),
            ),
        ActionChip(
          avatar: const Icon(Icons.add_rounded, size: 18),
          label: Text(
            vasche.length > 1 ? 'Aggiungi' : 'Aggiungi un\'altra vasca',
          ),
          onPressed: aggiungi,
        ),
        if (elimina != null) ...[
          const SizedBox(width: 8),
          ActionChip(
            avatar: const Icon(Icons.delete_outline_rounded, size: 18),
            label: const Text('Elimina questa'),
            onPressed: elimina,
          ),
        ],
      ],
    ),
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
      /* Svuotare una casella la toglie invece di scriverci dentro un niente:
       * una chiave che c'e' e non dice niente sembra configurata, e nelle
       * soglie del terreno «vuoto» vuol dire «non guardarla». */
      void cambia(String campo, Object? valore) => quaderno.segna(
        'cd_irrigazione',
        valore == null
            ? ({...irrigazione}..remove(campo))
            : {...irrigazione, campo: valore},
      );
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
          valore: '${irrigazione['time'] ?? orarioPredefinito}',
          suggerimento: orarioPredefinito,
          cambiato: (scritto) => cambia('time', scritto),
        ),
        const SizedBox(height: 14),
        /* Piu' momenti nella stessa giornata (#325): «una alle 05:30 del
         * mattino e alle 20:30 dopo una giornata di caldo intenso, se la %
         * del sensore umidita' terreno e' inferiore a una certa %». Il primo
         * orario resta quello qui sopra, che e' del runtime; gli altri stanno
         * in `orari`, e la plancia li mette tutti in fila. */
        _GliAltriOrari(
          orari: leggiGliOrari(irrigazione['orari']),
          cambia: (orari) =>
              cambia('orari', orari.isEmpty ? null : orariDaScrivere(orari)),
        ),
        const SizedBox(height: 24),
        const Insegna('Quando invece non parte'),
        CampoDiEntita(
          tessera: TesseraDelCampo(
            'irrigazione',
            scatto: scatto,
            quaderno: quaderno,
          ),
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
        const SizedBox(height: 14),
        /* Il meteo, oltre al sensore di pioggia: chi non ha un sensore in
         * giardino ha comunque una previsione, e la plancia la guarda. */
        CampoDiEntita(
          tessera: TesseraDelCampo(
            'irrigazione',
            scatto: scatto,
            quaderno: quaderno,
          ),
          etichetta: 'Il meteo (facoltativo)',
          valore: '${irrigazione['weatherEnt'] ?? ''}',
          domini: const ['weather'],
          collegamento: collegamento,
          cambiato: (scritto) => cambia('weatherEnt', scritto),
        ),
        const SizedBox(height: 24),
        /* L'umidita' del terreno.
         *
         * E' la parte che nell'app non c'era per niente, e non e' un dettaglio:
         * col terreno gia' bagnato il programma delle ore fisse **salta**, e
         * sotto la soglia bassa parte da solo una volta al giorno. Chi ha la
         * sonda in giardino e configura dall'app si trovava l'irrigazione che
         * andava lo stesso sul bagnato. */
        const Insegna('L\'umidita\' del terreno'),
        CampoDiEntita(
          tessera: TesseraDelCampo(
            'irrigazione',
            scatto: scatto,
            quaderno: quaderno,
          ),
          etichetta: 'La sonda nel terreno',
          valore: '${irrigazione['soilEnt'] ?? ''}',
          domini: const ['sensor'],
          collegamento: collegamento,
          cambiato: (scritto) => cambia('soilEnt', scritto),
        ),
        const SizedBox(height: 14),
        for (final (campo, nome, aiuto, esempio) in const [
          ('soilMin', 'Umidita\' ideale minima (%)', '', '30'),
          ('soilMax', 'Umidita\' ideale massima (%)', '', '60'),
          (
            'soilSkipAbove',
            'Salta il programma sopra (%)',
            'Col terreno gia\' bagnato non innaffia, e lo scrive sulla tessera',
            '60',
          ),
          (
            'soilStartBelow',
            'Parte da solo sotto (%)',
            'Una volta al giorno, senza aspettare l\'ora',
            '5',
          ),
        ]) ...[
          CampoDiTesto(
            etichetta: nome,
            valore: '${irrigazione[campo] ?? ''}',
            numerico: true,
            suggerimento: aiuto.isEmpty ? esempio : aiuto,
            cambiato: (scritto) => cambia(
              campo,
              scritto.trim().isEmpty
                  ? null
                  : num.tryParse(scritto.replaceAll(',', '.')),
            ),
          ),
          const SizedBox(height: 14),
        ],
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

/// Gli altri orari di irrigazione, uno per riga.
///
/// E' la casella «Altri orari di irrigazione» che `pool-irrigation-scene-
/// section.js` monta sotto l'ora di partenza: ogni riga porta l'ora, i minuti
/// di quella corsa (che valgono per tutte le zone) e la percentuale di
/// terreno sotto la quale ha senso farla. Si scrive appena si tocca, come
/// nella plancia: un elenco che si modifica non aspetta un tasto Salva.
class _GliAltriOrari extends StatelessWidget {
  const _GliAltriOrari({required this.orari, required this.cambia});

  final List<OrarioDellIrrigazione> orari;
  final ValueChanged<List<OrarioDellIrrigazione>> cambia;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final colori = tema.colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Altri orari di irrigazione',
          style: tema.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Il primo orario e\' quello qui sopra. Ogni riga in piu\' e\' una '
          'corsa a se\': i minuti valgono per tutte le zone di quella corsa, e '
          'la % la fa partire solo col terreno piu\' asciutto di cosi\'.',
          style: tema.textTheme.bodySmall?.copyWith(
            color: colori.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 10),
        for (final (quale, orario) in orari.indexed) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 5,
                child: CampoDiTesto(
                  etichetta: 'Ora',
                  valore: orario.ora,
                  suggerimento: '20:30',
                  cambiato: (scritto) => cambia([
                    ...orari.take(quale),
                    orario.con(ora: scritto.trim()),
                    ...orari.skip(quale + 1),
                  ]),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 4,
                child: CampoDiTesto(
                  etichetta: 'Durata',
                  valore: '${orario.minuti ?? ''}',
                  numerico: true,
                  suggerimento: 'min',
                  cambiato: (scritto) {
                    final minuti = int.tryParse(scritto.trim());
                    cambia([
                      ...orari.take(quale),
                      minuti == null
                          ? orario.senza(minuti: true)
                          : orario.con(minuti: minuti),
                      ...orari.skip(quale + 1),
                    ]);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 4,
                child: CampoDiTesto(
                  etichetta: 'Se sotto (%)',
                  valore: '${orario.seSottoA ?? ''}',
                  numerico: true,
                  suggerimento: '%',
                  cambiato: (scritto) {
                    final soglia = int.tryParse(scritto.trim());
                    cambia([
                      ...orari.take(quale),
                      soglia == null
                          ? orario.senza(seSottoA: true)
                          : orario.con(seSottoA: soglia),
                      ...orari.skip(quale + 1),
                    ]);
                  },
                ),
              ),
              IconButton(
                tooltip: 'Togli l\'orario',
                onPressed: () =>
                    cambia([...orari.take(quale), ...orari.skip(quale + 1)]),
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
          if (orario.ora.isNotEmpty && !orario.valido)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 2, 12, 0),
              child: Text(
                'Scrivila come 20:30: cosi\' com\'e\' la plancia la salta.',
                style: tema.textTheme.bodySmall?.copyWith(color: colori.error),
              ),
            ),
          const SizedBox(height: 10),
        ],
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => cambia([...orari, const OrarioDellIrrigazione()]),
            icon: const Icon(Icons.add_rounded),
            label: const Text('Aggiungi un orario'),
          ),
        ),
      ],
    );
  }
}
