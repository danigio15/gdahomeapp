/// Scegliere un dispositivo da un'integrazione, invece di batterlo a mano.
///
/// Tre passi, gli stessi della Config della dashboard:
///
///  1. **l'integrazione** — hOn, Home Connect, Miele, LG ThinQ — con quanti
///     dispositivi ha;
///  2. **il dispositivo** — «Lavatrice», «Leapmotor B10» — con marca, modello
///     e stanza, perche' chi ne ha tre uguali di nome deve poterle distinguere;
///  3. **le sue entita'**, gia' li', da spuntare.
///
/// E' il pezzo che toglie di mezzo il lavoro vero: configurare un'auto
/// elettrica a mano vuol dire battere diciassette identificativi, e nessuno lo
/// fa. Da qui si sceglie una volta e le entita' si mappano da sole.
///
/// Il catalogo lo costruisce il ponte (`ponte/src/catalogo.js`) dai registri di
/// Home Assistant: qui c'e' solo il menu.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../../casa/catalogo/catalogo.dart';
import '../../casa/collegamento.dart';
import '../../vestito/pezzi.dart';

/// Come si prende quello che si e' trovato.
enum ComeSiPrende {
  /// Il dispositivo intero, ed e' il modo giusto per un apparecchio.
  ///
  /// Nella Config della dashboard non si spunta niente: si sceglie la
  /// lavatrice e nasce **gia' compilata**, perche' a dire quale entita' fa la
  /// potenza e quale il tempo rimanente ci pensa il motore. Spuntarle a mano
  /// vorrebbe dire rifare a mano il lavoro che il motore fa da solo — e
  /// sbagliarlo, perche' chi spunta non sa quale delle due energie sia il
  /// contatore.
  tuttoIlDispositivo,

  /// Spuntando quelle che si vogliono: per le sezioni in cui le entita' non
  /// hanno caselle fisse.
  spuntandole,

  /// Una sola: per una casella che ne vuole una e basta.
  unaSola,
}

/// Cosa si e' scelto: da dove viene, il dispositivo, e le sue entita'.
class SceltoDalCatalogo {
  const SceltoDalCatalogo({
    required this.dispositivo,
    required this.entita,
    this.integrazione,
    this.tutte = const [],
  });

  final Dispositivo dispositivo;

  /// Quelle che servono a chi ha aperto il menu.
  final List<EntitaDelDispositivo> entita;

  /// Da dove arriva il dispositivo. Serve a scrivere «hOn» invece di «hon»
  /// nella riga che dice da dove viene un apparecchio.
  final Integrazione? integrazione;

  /// **Tutte** quelle del dispositivo, comprese quelle di servizio.
  ///
  /// Il motore che indovina le vuole tutte: scarta lui quelle che parlano
  /// della radio invece che dell'apparecchio, e lo fa con le sue regole. Un
  /// elenco gia' setacciato da qui gli toglierebbe indizi.
  final List<EntitaDelDispositivo> tutte;
}

/// Apre il menu e restituisce cosa si e' scelto, o `null`.
Future<SceltoDalCatalogo?> scegliDaUnIntegrazione(
  BuildContext contesto, {
  required Collegamento collegamento,
  ComeSiPrende come = ComeSiPrende.tuttoIlDispositivo,
}) => Navigator.of(contesto).push<SceltoDalCatalogo>(
  MaterialPageRoute(
    builder: (dentro) =>
        _LeIntegrazioni(collegamento: collegamento, come: come),
  ),
);

/* ─── Passo 1: l'integrazione ────────────────────────────────────────────── */

class _LeIntegrazioni extends StatefulWidget {
  const _LeIntegrazioni({required this.collegamento, required this.come});

  final Collegamento collegamento;
  final ComeSiPrende come;

  @override
  State<_LeIntegrazioni> createState() => _LeIntegrazioniState();
}

class _LeIntegrazioniState extends State<_LeIntegrazioni> {
  IlCatalogo? _catalogo;
  String? _male;

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
    setState(() => _male = null);
    try {
      final letto = await chiediIlCatalogo(filo);
      if (mounted) setState(() => _catalogo = letto);
    } on Object catch (male) {
      if (mounted) setState(() => _male = '$male');
    }
  }

  @override
  Widget build(BuildContext context) {
    final catalogo = _catalogo;
    return Scaffold(
      appBar: AppBar(title: const Text('Da un\'integrazione')),
      body: SafeArea(
        top: false,
        child: switch ((catalogo, _male)) {
          (_, final String male) => StatoVuoto(
            icona: Icons.cloud_off_rounded,
            titolo: 'Non riesco a leggere il catalogo',
            sotto: male,
            azione: FilledButton(
              onPressed: _leggi,
              child: const Text('Riprova'),
            ),
          ),
          (null, _) => const _StoLeggendo(
            cosa: 'Sto guardando cosa hai collegato…',
            spiega:
                'Il ponte legge i registri di Home Assistant e mette insieme '
                'integrazioni e dispositivi.',
          ),
          (final IlCatalogo letto, _) =>
            letto.integrazioni.isEmpty
                ? const StatoVuoto(
                    icona: Icons.extension_off_rounded,
                    titolo: 'Nessuna integrazione con dispositivi',
                    sotto:
                        'Qui compaiono le integrazioni che portano dispositivi: '
                        'gli elettrodomestici, l\'auto, il robot.',
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(4, 0, 4, 14),
                        child: Text(
                          'Scegli da dove arriva. Poi il dispositivo, e le sue '
                          'entita\' saranno gia\' li\': non c\'e\' niente da '
                          'battere a mano.',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                                height: 1.45,
                              ),
                        ),
                      ),
                      Scheda(
                        padding: EdgeInsets.zero,
                        child: Column(
                          children: [
                            for (final una in letto.integrazioni)
                              ListTile(
                                title: Text(una.nome),
                                subtitle: Text(
                                  '${una.quantiDispositivi} '
                                  '${una.quantiDispositivi == 1 ? 'dispositivo' : 'dispositivi'}'
                                  '${una.diQualcunAltro ? ' · non di serie' : ''}',
                                ),
                                trailing: const Icon(
                                  Icons.chevron_right_rounded,
                                ),
                                onTap: () => _apri(letto, una),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
        },
      ),
    );
  }

  Future<void> _apri(IlCatalogo letto, Integrazione quale) async {
    final scelto = await Navigator.of(context).push<SceltoDalCatalogo>(
      MaterialPageRoute(
        builder: (dentro) => _IDispositivi(
          collegamento: widget.collegamento,
          integrazione: quale,
          dispositivi: letto.dellIntegrazione(quale.dominio),
          come: widget.come,
        ),
      ),
    );
    if (scelto != null && mounted) Navigator.of(context).pop(scelto);
  }
}

/* ─── Passo 2: il dispositivo ────────────────────────────────────────────── */

class _IDispositivi extends StatelessWidget {
  const _IDispositivi({
    required this.collegamento,
    required this.integrazione,
    required this.dispositivi,
    required this.come,
  });

  final Collegamento collegamento;
  final Integrazione integrazione;
  final List<Dispositivo> dispositivi;
  final ComeSiPrende come;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(integrazione.nome)),
    body: SafeArea(
      top: false,
      child: dispositivi.isEmpty
          ? const StatoVuoto(
              icona: Icons.devices_other_rounded,
              titolo: 'Nessun dispositivo',
              sotto: 'Questa integrazione non ne porta nessuno.',
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              children: [
                Scheda(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (final uno in dispositivi)
                        ListTile(
                          title: Text(uno.nome),
                          subtitle: Text(
                            [
                              if (uno.sotto.isNotEmpty) uno.sotto,
                              '${uno.quanteEntita} entita\'',
                              if (uno.spento) 'spento in Home Assistant',
                            ].join(' · '),
                          ),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () async {
                            final scelto = await Navigator.of(context)
                                .push<SceltoDalCatalogo>(
                                  MaterialPageRoute(
                                    builder: (dentro) => _LeEntita(
                                      collegamento: collegamento,
                                      integrazione: integrazione,
                                      dispositivo: uno,
                                      come: come,
                                    ),
                                  ),
                                );
                            if (scelto != null && context.mounted) {
                              Navigator.of(context).pop(scelto);
                            }
                          },
                        ),
                    ],
                  ),
                ),
              ],
            ),
    ),
  );
}

/* ─── Passo 3: le sue entita' ────────────────────────────────────────────── */

class _LeEntita extends StatefulWidget {
  const _LeEntita({
    required this.collegamento,
    required this.integrazione,
    required this.dispositivo,
    required this.come,
  });

  final Collegamento collegamento;
  final Integrazione integrazione;
  final Dispositivo dispositivo;
  final ComeSiPrende come;

  @override
  State<_LeEntita> createState() => _LeEntitaState();
}

class _LeEntitaState extends State<_LeEntita> {
  List<EntitaDelDispositivo>? _entita;
  String? _male;
  final _scelte = <String>{};

  /* Le entita' di servizio — `config`, `diagnostic` — di serie non si vedono.
   * Una lavatrice moderna ne ha venti fra aggiornamenti firmware e stati
   * interni, e in mezzo a quelle il «tempo rimanente» non si trova piu'. */
  bool _ancheQuelleDiServizio = false;

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
    setState(() => _male = null);
    try {
      final letto = await chiediIlCatalogo(
        filo,
        dispositivi: [widget.dispositivo.id],
      );
      if (mounted) {
        setState(
          () => _entita = letto.entita[widget.dispositivo.id] ?? const [],
        );
      }
    } on Object catch (male) {
      if (mounted) setState(() => _male = '$male');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tutte = _entita;
    final daMostrare = tutte == null
        ? const <EntitaDelDispositivo>[]
        : [
            for (final una in tutte)
              if (_ancheQuelleDiServizio || una.categoria.isEmpty) una,
          ];
    final diServizio = (tutte?.length ?? 0) - daMostrare.length;
    return Scaffold(
      appBar: AppBar(title: Text(widget.dispositivo.nome)),
      body: SafeArea(
        top: false,
        child: switch ((tutte, _male)) {
          (_, final String male) => StatoVuoto(
            icona: Icons.cloud_off_rounded,
            titolo: 'Non riesco a leggere le entita\'',
            sotto: male,
            azione: FilledButton(
              onPressed: _leggi,
              child: const Text('Riprova'),
            ),
          ),
          (null, _) => const _StoLeggendo(
            cosa: 'Sto leggendo le sue entita\'…',
            spiega: '',
          ),
          _ => Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
                      child: Text(
                        switch (widget.come) {
                          ComeSiPrende.unaSola => 'Tocca quella che serve.',
                          ComeSiPrende.spuntandole =>
                            'Spunta quelle che vuoi nella plancia.',
                          /* Non c'e' niente da spuntare: si prende il
                           * dispositivo intero, e a mettere ogni entita' nella
                           * sua casella ci pensa il motore. Queste righe sono
                           * li' per far vedere **cosa** si sta prendendo. */
                          ComeSiPrende.tuttoIlDispositivo =>
                            'Le prendo tutte, e le metto io nelle caselle '
                                'giuste: la potenza nella potenza, il tempo '
                                'rimanente nel tempo rimanente. Quello che hai '
                                'gia\' scritto a mano non lo tocco.',
                        },
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    if (diServizio > 0)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          children: [
                            FilterChip(
                              label: Text('Anche le $diServizio di servizio'),
                              selected: _ancheQuelleDiServizio,
                              onSelected: (acceso) => setState(
                                () => _ancheQuelleDiServizio = acceso,
                              ),
                            ),
                          ],
                        ),
                      ),
                    Scheda(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: [
                          for (final una in daMostrare)
                            switch (widget.come) {
                              ComeSiPrende.unaSola => ListTile(
                                dense: true,
                                title: Text(una.nome),
                                subtitle: _sotto(context, una),
                                onTap: () =>
                                    Navigator.of(context)
                                        .pop(_scelto(entita: [una])),
                              ),
                              ComeSiPrende.spuntandole => CheckboxListTile(
                                dense: true,
                                value: _scelte.contains(una.id),
                                title: Text(una.nome),
                                subtitle: _sotto(context, una),
                                onChanged: (spuntata) => setState(() {
                                  if (spuntata == true) {
                                    _scelte.add(una.id);
                                  } else {
                                    _scelte.remove(una.id);
                                  }
                                }),
                              ),
                              ComeSiPrende.tuttoIlDispositivo => ListTile(
                                dense: true,
                                title: Text(una.nome),
                                subtitle: _sotto(context, una),
                              ),
                            },
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (widget.come == ComeSiPrende.spuntandole)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _scelte.isEmpty
                          ? null
                          : () => Navigator.of(context).pop(
                              _scelto(
                                entita: [
                                  for (final una in tutte!)
                                    if (_scelte.contains(una.id)) una,
                                ],
                              ),
                            ),
                      child: Text(
                        _scelte.isEmpty
                            ? 'Spuntane almeno una'
                            : 'Prendi ${_scelte.length}',
                      ),
                    ),
                  ),
                ),
              if (widget.come == ComeSiPrende.tuttoIlDispositivo)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () =>
                          Navigator.of(context)
                              .pop(_scelto(entita: tutte ?? const [])),
                      icon: const Icon(Icons.auto_awesome_rounded),
                      label: Text(
                        'Collega ${widget.dispositivo.nome} '
                        '(${tutte?.length ?? 0} entita\')',
                      ),
                    ),
                  ),
                ),
            ],
          ),
        },
      ),
    );
  }

  /// Il risultato, sempre con dentro **tutte** le entita' del dispositivo.
  ///
  /// Chi ha aperto il menu ne vuole alcune; il motore che indovina le vuole
  /// tutte, comprese quelle di servizio: e' lui che decide cosa scartare, con
  /// le sue regole. Passargliene un elenco gia' setacciato qui vorrebbe dire
  /// togliergli indizi senza dirglielo.
  SceltoDalCatalogo _scelto({required List<EntitaDelDispositivo> entita}) =>
      SceltoDalCatalogo(
        dispositivo: widget.dispositivo,
        integrazione: widget.integrazione,
        entita: entita,
        tutte: _entita ?? const [],
      );

  Widget _sotto(BuildContext contesto, EntitaDelDispositivo una) => Text(
    [
      una.id,
      if (una.unita.isNotEmpty) una.unita,
      if (una.spenta) 'spenta',
    ].join(' · '),
    style: TextStyle(
      fontFamily: 'monospace',
      fontSize: 11,
      color: Theme.of(contesto).colorScheme.onSurfaceVariant,
    ),
  );
}

class _StoLeggendo extends StatelessWidget {
  const _StoLeggendo({required this.cosa, required this.spiega});
  final String cosa;
  final String spiega;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      const CircularProgressIndicator(),
      const SizedBox(height: 18),
      Text(cosa, style: Theme.of(context).textTheme.titleSmall),
      if (spiega.isNotEmpty) ...[
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            spiega,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              height: 1.4,
            ),
          ),
        ),
      ],
    ],
  );
}
