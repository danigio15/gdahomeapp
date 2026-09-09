/// I pezzi che tornano in tutte le schermate della configurazione.
///
/// Un guscio che legge la configurazione, tiene il salvataggio e dice cosa e'
/// andato storto; i campi — testo, numero, ora, interruttore, entita' — e il
/// cercatore di entita'.
///
/// Stanno qui e non copiati in venti schermate perche' venti schermate che
/// salvano in venti modi diversi sono venti modi diversi di perdere la
/// configurazione di qualcuno.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../casa/collegamento.dart';
import '../../casa/entita.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';

/// Il guscio di una schermata della configurazione.
///
/// Legge lo scatto, lo passa a chi disegna, e tiene la barra del salvataggio
/// in fondo. Chi ci sta dentro non parla mai col filo: chiede a [Quaderno] di
/// segnare una chiave, e il salvataggio lo fa questo.
class PaginaDiConfigurazione extends StatefulWidget {
  const PaginaDiConfigurazione({
    super.key,
    required this.titolo,
    required this.collegamento,
    required this.disegna,
    this.sotto,
  });

  final String titolo;

  /// Una riga sotto il titolo, dentro la pagina: cosa si sta configurando, e
  /// dove si vede l'effetto.
  final String? sotto;

  final Collegamento collegamento;

  /// Cosa mostrare, dato quello che c'e' adesso e il quaderno su cui segnare.
  final List<Widget> Function(
    BuildContext contesto,
    Scatto scatto,
    Quaderno quaderno,
  )
  disegna;

  @override
  State<PaginaDiConfigurazione> createState() => _PaginaDiConfigurazioneState();
}

/// Dove si segna quello che si e' cambiato, prima di salvarlo.
///
/// Le modifiche non partono a ogni tasto premuto: si accumulano qui e vanno
/// via tutte insieme quando si preme «Salva». Salvare a ogni lettera vuol
/// dire una scrittura sul ponte per lettera, e la prima volta che il filo va
/// giu' a meta' parola resta scritta meta' parola.
class Quaderno {
  Quaderno(this._segnato);

  final void Function(String chiave, Object? valore) _segnato;

  final _cambiate = <String, Object?>{};

  /// Le chiavi cambiate e non ancora salvate.
  Map<String, Object?> get cambiate => Map.unmodifiable(_cambiate);

  bool get cEqualcosa => _cambiate.isNotEmpty;

  /// Segna una chiave. `null` la cancella.
  void segna(String chiave, Object? valore) {
    _cambiate[chiave] = valore;
    _segnato(chiave, valore);
  }

  void dimenticaTutto() => _cambiate.clear();
}

class _PaginaDiConfigurazioneState extends State<PaginaDiConfigurazione> {
  LaConfigurazione? _cassetta;
  Scatto? _scatto;
  String? _male;
  bool _sto = false;
  bool _salva = false;
  late final Quaderno _quaderno = Quaderno((_, _) => setState(() {}));

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
    setState(() {
      _sto = true;
      _male = null;
    });
    final cassetta = _cassetta ??= LaConfigurazione(filo);
    try {
      final letto = await cassetta.leggi();
      if (!mounted) return;
      setState(() {
        _scatto = letto;
        _sto = false;
      });
    } on Object catch (male) {
      if (!mounted) return;
      setState(() {
        _male = '$male';
        _sto = false;
      });
    }
  }

  Future<void> _scrivi() async {
    final cassetta = _cassetta;
    if (cassetta == null || !_quaderno.cEqualcosa) return;
    setState(() => _salva = true);
    try {
      final dopo = await cassetta.cambia(_quaderno.cambiate);
      _quaderno.dimenticaTutto();
      if (!mounted) return;
      setState(() {
        _scatto = dopo;
        _salva = false;
      });
      /* La plancia sta in un riquadro che non sa che la configurazione e'
       * cambiata: glielo si dice, e si ridisegna con le cose nuove. */
      widget.collegamento.laPlanciaECambiata();
      _dillo('Salvato. La plancia si aggiorna da sola.');
    } on Object catch (male) {
      if (!mounted) return;
      setState(() => _salva = false);
      _dillo('$male', male: true);
    }
  }

  void _dillo(String cosa, {bool male = false}) {
    if (!mounted) return;
    final colori = Theme.of(context).colorScheme;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(cosa),
        backgroundColor: male ? colori.errorContainer : null,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final scatto = _scatto;
    return Scaffold(
      appBar: AppBar(title: Text(widget.titolo)),
      body: SafeArea(
        top: false,
        child: switch ((scatto, _male, _sto)) {
          (_, final String male, _) => StatoVuoto(
            icona: Icons.cloud_off_rounded,
            titolo: 'Non riesco a leggere la configurazione',
            sotto: male,
            azione: FilledButton(
              onPressed: _leggi,
              child: const Text('Riprova'),
            ),
          ),
          (null, _, _) => const Center(child: CircularProgressIndicator()),
          (final Scatto letto, _, _) => Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                  children: [
                    if (widget.sotto != null) ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(4, 0, 4, 16),
                        child: Text(
                          widget.sotto!,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: colori.onSurfaceVariant,
                                height: 1.45,
                              ),
                        ),
                      ),
                    ],
                    ...widget.disegna(context, letto, _quaderno),
                  ],
                ),
              ),
              _BarraDelSalvataggio(
                cEqualcosa: _quaderno.cEqualcosa,
                sta: _salva,
                salva: _scrivi,
                lascia: () {
                  _quaderno.dimenticaTutto();
                  unawaited(_leggi());
                },
              ),
            ],
          ),
        },
      ),
    );
  }
}

/// La barra in fondo: si vede solo quando c'e' qualcosa da salvare.
///
/// Sempre visibile sarebbe un bottone che quasi sempre non fa niente, e un
/// bottone che quasi sempre non fa niente insegna a non premerlo.
class _BarraDelSalvataggio extends StatelessWidget {
  const _BarraDelSalvataggio({
    required this.cEqualcosa,
    required this.sta,
    required this.salva,
    required this.lascia,
  });

  final bool cEqualcosa;
  final bool sta;
  final VoidCallback salva;
  final VoidCallback lascia;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return AnimatedSize(
      duration: const Duration(milliseconds: 180),
      alignment: Alignment.topCenter,
      child: !cEqualcosa
          ? const SizedBox(width: double.infinity)
          : Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              decoration: BoxDecoration(
                color: colori.surfaceContainerHigh,
                border: Border(top: BorderSide(color: colori.outlineVariant)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Non ancora salvato',
                      style: Theme.of(context).textTheme.bodySmall
                          ?.copyWith(color: colori.onSurfaceVariant),
                    ),
                  ),
                  TextButton(
                    onPressed: sta ? null : lascia,
                    child: const Text('Lascia stare'),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: sta ? null : salva,
                    child: sta
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Salva'),
                  ),
                ],
              ),
            ),
    );
  }
}

/// Un campo di testo con la sua etichetta.
class CampoDiTesto extends StatefulWidget {
  const CampoDiTesto({
    super.key,
    required this.etichetta,
    required this.valore,
    required this.cambiato,
    this.suggerimento,
    this.numerico = false,
    this.mono = false,
  });

  final String etichetta;
  final String valore;
  final String? suggerimento;
  final bool numerico;
  final bool mono;
  final ValueChanged<String> cambiato;

  @override
  State<CampoDiTesto> createState() => _CampoDiTestoState();
}

class _CampoDiTestoState extends State<CampoDiTesto> {
  late final _scritto = TextEditingController(text: widget.valore);

  @override
  void didUpdateWidget(CampoDiTesto vecchio) {
    super.didUpdateWidget(vecchio);
    /* Il testo si rimette solo quando cambia da fuori — dopo un salvataggio,
     * o quando si rilegge: rimetterlo a ogni ridisegno sposterebbe il cursore
     * in fondo mentre si scrive. */
    if (widget.valore != vecchio.valore && widget.valore != _scritto.text) {
      _scritto.text = widget.valore;
    }
  }

  @override
  void dispose() {
    _scritto.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextField(
    controller: _scritto,
    onChanged: widget.cambiato,
    keyboardType: widget.numerico
        ? const TextInputType.numberWithOptions(decimal: true)
        : null,
    inputFormatters: widget.numerico
        ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))]
        : null,
    style: widget.mono
        ? const TextStyle(fontFamily: 'monospace', fontSize: 14)
        : null,
    decoration: InputDecoration(
      labelText: widget.etichetta,
      hintText: widget.suggerimento,
      border: const OutlineInputBorder(),
      isDense: true,
    ),
  );
}

/// Un campo che vuole un'entita' di Home Assistant, col cercatore accanto.
class CampoDiEntita extends StatelessWidget {
  const CampoDiEntita({
    super.key,
    required this.etichetta,
    required this.valore,
    required this.cambiato,
    required this.collegamento,
    this.domini = const [],
  });

  final String etichetta;
  final String valore;
  final ValueChanged<String> cambiato;
  final Collegamento collegamento;

  /// Se non e' vuoto, il cercatore parte da questi domini: `light`, `switch`.
  /// Si possono cercare anche gli altri — un filtro che non si puo' togliere
  /// e' una casa in cui manca meta' della roba.
  final List<String> domini;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: CampoDiTesto(
          etichetta: etichetta,
          valore: valore,
          mono: true,
          suggerimento: domini.isEmpty
              ? 'dominio.nome'
              : '${domini.first}.nome',
          cambiato: cambiato,
        ),
      ),
      const SizedBox(width: 8),
      Padding(
        padding: const EdgeInsets.only(top: 2),
        child: IconButton.filledTonal(
          onPressed: () async {
            final scelta = await cercaUnEntita(
              context,
              collegamento: collegamento,
              domini: domini,
            );
            if (scelta != null) cambiato(scelta);
          },
          icon: const Icon(Icons.search_rounded),
          tooltip: 'Cerca fra le entita\' di casa',
        ),
      ),
    ],
  );
}

/// Il cercatore: si apre dal basso, si scrive, si sceglie.
///
/// Cerca sul nome **e** sull'identificativo, perche' chi configura sa spesso
/// solo uno dei due: chi ha appena collegato una presa ricorda «cucina», chi
/// legge la Config della dashboard ricorda `switch.presa_03`.
Future<String?> cercaUnEntita(
  BuildContext contesto, {
  required Collegamento collegamento,
  List<String> domini = const [],
}) => showModalBottomSheet<String>(
  context: contesto,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (dentro) => _Cercatore(collegamento: collegamento, domini: domini),
);

class _Cercatore extends StatefulWidget {
  const _Cercatore({required this.collegamento, required this.domini});
  final Collegamento collegamento;
  final List<String> domini;

  @override
  State<_Cercatore> createState() => _CercatoreState();
}

class _CercatoreState extends State<_Cercatore> {
  String _cercato = '';
  late bool _soloIMiei = widget.domini.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final casa = widget.collegamento.stato;
    final tutte = casa?.tutte() ?? const <Entita>[];
    final cercato = _cercato.trim().toLowerCase();
    final trovate = [
      for (final una in tutte)
        if ((!_soloIMiei || widget.domini.contains(una.dominio)) &&
            (cercato.isEmpty ||
                una.id.toLowerCase().contains(cercato) ||
                una.nome.toLowerCase().contains(cercato)))
          una,
    ];
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.78,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                autofocus: true,
                onChanged: (scritto) => setState(() => _cercato = scritto),
                decoration: InputDecoration(
                  hintText: 'Cerca fra ${tutte.length} entita\'',
                  prefixIcon: const Icon(Icons.search_rounded),
                  border: const OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),
            if (widget.domini.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Row(
                  children: [
                    FilterChip(
                      label: Text('Solo ${widget.domini.join(', ')}'),
                      selected: _soloIMiei,
                      onSelected: (acceso) =>
                          setState(() => _soloIMiei = acceso),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: trovate.isEmpty
                  ? const StatoVuoto(
                      icona: Icons.search_off_rounded,
                      titolo: 'Nessuna entita\'',
                      sotto: 'Prova con meno lettere, o togli il filtro.',
                    )
                  : ListView.builder(
                      itemCount: trovate.length,
                      itemBuilder: (dentro, quale) {
                        final una = trovate[quale];
                        return ListTile(
                          dense: true,
                          title: Text(una.nome),
                          subtitle: Text(
                            una.id,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                            ),
                          ),
                          trailing: Text(
                            una.stato,
                            style: Theme.of(dentro).textTheme.labelSmall,
                          ),
                          onTap: () => Navigator.of(dentro).pop(una.id),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
