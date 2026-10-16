/// Una notifica personalizzata: entità → condizione → messaggio.
///
/// «Dimmi se il freezer resta sopra i −12 per dieci minuti.» Si sceglie
/// l'entità, si dice quando, e si scrive cosa arriva. Sotto la condizione c'è
/// il valore di adesso e com'è andata nelle ultime ventiquattro ore, con la
/// soglia disegnata sopra: si vede subito se la regola scatterebbe ogni
/// cinque minuti o mai.
///
/// La regola la tiene la casa (`ponte/src/notifiche.js`), ed è la casa a
/// guardarla: il telefono può essere spento. Chi non amministra la casa la
/// scrive solo per sé.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/entita.dart';
import '../notifiche/modello.dart';
import '../notifiche/notifiche.dart';
import '../parole.dart';
import '../vestito/pezzi.dart';
import '../vestito/tema.dart';
import 'notifiche.dart' show durataDetta, iconaDellEntita;

/// Un punto della storia di un'entità: quando, e quanto.
typedef PuntoDellaStoria = ({DateTime quando, double valore});

class SchermataDellaNotificaPersonalizzata extends StatefulWidget {
  const SchermataDellaNotificaPersonalizzata({
    super.key,
    required this.collegamento,
    required this.stato,
    this.regola,
    this.storiaIniziale,
  });

  final Collegamento collegamento;
  final StatoDelleNotifiche stato;

  /// Quella da cambiare; `null` per una nuova.
  final NotificaPersonalizzata? regola;

  /// La storia da disegnare senza chiederla: per le prove e i disegni.
  final List<PuntoDellaStoria>? storiaIniziale;

  @override
  State<SchermataDellaNotificaPersonalizzata> createState() =>
      _StatoDellEditor();
}

const _durate = [0, 1, 5, 10, 15, 30, 60];
const _ripetizioni = [15, 30, 60, 180, 720, 1440];

class _StatoDellEditor extends State<SchermataDellaNotificaPersonalizzata> {
  late NotificaPersonalizzata _regola;
  late final TextEditingController _titolo;
  late final TextEditingController _testo;
  List<PuntoDellaStoria>? _storia;
  bool _salvando = false;
  bool _provando = false;

  bool get _nuova => widget.regola?.id == null;

  @override
  void initState() {
    super.initState();
    final io = widget.stato.io;
    _regola =
        widget.regola ??
        NotificaPersonalizzata(
          entita: '',
          titolo: '',
          chi: [if (io.isNotEmpty) io],
        );
    _titolo = TextEditingController(text: _regola.titolo)
      ..addListener(() => setState(() {}));
    _testo = TextEditingController(text: _regola.testo)
      ..addListener(() => setState(() {}));
    _storia = widget.storiaIniziale;
    if (widget.collegamento.stato?.tutte().isEmpty ?? true) {
      unawaited(_chiediLeEntita());
    }
    if (_storia == null && _regola.entita.isNotEmpty) unawaited(_laStoria());
  }

  @override
  void dispose() {
    _titolo.dispose();
    _testo.dispose();
    super.dispose();
  }

  /* Le entita' chieste alla casa, quando la casa aperta non le ha ancora
   * lette per conto suo: l'editor si puo' aprire prima della plancia. */
  Map<String, Entita>? _chieste;

  Entita? get _entita =>
      widget.collegamento.stato?[_regola.entita] ?? _chieste?[_regola.entita];

  List<Entita> get _tutte {
    final dalla = widget.collegamento.stato?.tutte() ?? const <Entita>[];
    return dalla.isNotEmpty ? dalla : (_chieste?.values.toList() ?? const []);
  }

  Future<void> _chiediLeEntita() async {
    final filo = widget.collegamento.filo;
    if (filo == null || _chieste != null) return;
    try {
      final tutte = await filo.risultato({'type': 'get_states'});
      final lette = <String, Entita>{
        if (tutte is List)
          for (final una in tutte)
            if (Entita.leggi(una) case final Entita entita) entita.id: entita,
      };
      if (mounted) setState(() => _chieste = lette);
    } catch (_) {
      /* Senza, si sceglie dall'elenco che la casa ha gia'. */
    }
  }

  NotificaPersonalizzata get _scritta =>
      _regola.con(titolo: _titolo.text.trim(), testo: _testo.text.trim());

  bool get _completa =>
      _regola.entita.isNotEmpty &&
      _titolo.text.trim().isNotEmpty &&
      (_regola.condizione == 'uguale' ||
          _regola.condizione == 'diverso' ||
          double.tryParse(_regola.valore.replaceAll(',', '.')) != null);

  Future<void> _laStoria() async {
    final filo = widget.collegamento.filo;
    if (filo == null || _regola.entita.isEmpty) return;
    try {
      final detto = await filo.risultato({
        'type': 'history/history_during_period',
        'start_time': DateTime.now()
            .subtract(const Duration(hours: 24))
            .toUtc()
            .toIso8601String(),
        'entity_ids': [_regola.entita],
        'minimal_response': true,
        'no_attributes': true,
      });
      final punti = <PuntoDellaStoria>[];
      final elenco = detto is Map ? detto[_regola.entita] : null;
      if (elenco is List) {
        for (final uno in elenco) {
          if (uno is! Map) continue;
          final valore = double.tryParse('${uno['s']}');
          final quando = (uno['lu'] as num?)?.toDouble();
          if (valore == null || quando == null) continue;
          punti.add((
            quando: DateTime.fromMillisecondsSinceEpoch(
              (quando * 1000).round(),
            ),
            valore: valore,
          ));
        }
      }
      if (mounted) setState(() => _storia = punti);
    } catch (_) {
      if (mounted) setState(() => _storia = const []);
    }
  }

  Future<void> _scegliLEntita() async {
    final tutte = _tutte;
    final scelta = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _IlCercatore(entita: tutte),
    );
    if (scelta == null) return;
    setState(() {
      _regola = _regola.con(entita: scelta);
      _storia = null;
      final suo = widget.collegamento.stato?[scelta] ?? _chieste?[scelta];
      if (_titolo.text.trim().isEmpty && suo != null) _titolo.text = suo.nome;
    });
    unawaited(_laStoria());
  }

  Future<void> _scriviIlValore() async {
    final campo = TextEditingController(text: _regola.valore);
    final scritto = await showDialog<String>(
      context: context,
      builder: (contesto) => AlertDialog(
        title: Text(inLingua(it: 'Il valore', en: 'The value')),
        content: TextField(
          controller: campo,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(
            signed: true,
            decimal: true,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contesto).pop(),
            child: Text(inLingua(it: 'Annulla', en: 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(contesto).pop(campo.text.trim()),
            child: Text(inLingua(it: 'Fatto', en: 'Done')),
          ),
        ],
      ),
    );
    campo.dispose();
    if (scritto != null) setState(() => _regola = _regola.con(valore: scritto));
  }

  Future<void> _salva() async {
    final filo = widget.collegamento.filo;
    if (filo == null || !_completa) return;
    setState(() => _salvando = true);
    try {
      await Notifiche(filo).salva(_scritta);
      if (mounted) Navigator.of(context).pop(true);
    } catch (errore) {
      if (!mounted) return;
      setState(() => _salvando = false);
      ScaffoldMessenger.maybeOf(context)
          ?.showSnackBar(SnackBar(content: Text('$errore')));
    }
  }

  Future<void> _togli() async {
    final filo = widget.collegamento.filo;
    final id = _regola.id;
    if (filo == null || id == null) return;
    await Notifiche(filo).togliLaPersonalizzata(id);
    if (mounted) Navigator.of(context).pop(true);
  }

  Future<void> _prova() async {
    final filo = widget.collegamento.filo;
    if (filo == null || !_completa) return;
    setState(() => _provando = true);
    try {
      await filo.risultato({
        'type': 'ponte/notifiche/prova',
        'regola': _scritta.inJson(),
      });
    } catch (errore) {
      if (mounted) {
        ScaffoldMessenger.maybeOf(context)
            ?.showSnackBar(SnackBar(content: Text('$errore')));
      }
    } finally {
      if (mounted) setState(() => _provando = false);
    }
  }

  String get _unita => '${_entita?.attributi['unit_of_measurement'] ?? ''}';

  String get _valoreDetto {
    final unita = _unita;
    return unita.isEmpty ? _regola.valore : '${_regola.valore} $unita';
  }

  bool? get _adessoSopra {
    final valore = double.tryParse('${_entita?.stato}');
    final soglia = double.tryParse(_regola.valore.replaceAll(',', '.'));
    if (valore == null || soglia == null) return null;
    return switch (_regola.condizione) {
      'sotto' => valore < soglia,
      'uguale' => valore == soglia,
      'diverso' => valore != soglia,
      _ => valore > soglia,
    };
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.of(context).pop(false),
        ),
        title: Text(
          _nuova
              ? inLingua(it: 'Nuova notifica', en: 'New notification')
              : inLingua(it: 'Modifica notifica', en: 'Edit notification'),
        ),
        actions: [
          TextButton(
            onPressed: _completa && !_salvando ? _salva : null,
            child: Text(inLingua(it: 'Salva', en: 'Save')),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          const _IPassi(),
          const SizedBox(height: 14),
          Scheda(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  inLingua(it: 'Quando', en: 'When'),
                  style: testi.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 10,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _Pastiglia(
                      icona: _regola.entita.isEmpty
                          ? Icons.add_rounded
                          : iconaDellEntita(_regola.entita),
                      testo: _regola.entita.isEmpty
                          ? inLingua(it: 'Scegli l\'entità', en: 'Pick entity')
                          : _regola.entita,
                      mono: _regola.entita.isNotEmpty,
                      giu: true,
                      fondo: colori.primaryContainer,
                      colore: colori.onPrimaryContainer,
                      tocca: _scegliLEntita,
                    ),
                    Text(
                      inLingua(it: 'è', en: 'is'),
                      style: testi.titleMedium,
                    ),
                    PopupMenuButton<String>(
                      initialValue: _regola.condizione,
                      onSelected: (quale) => setState(
                        () => _regola = _regola.con(condizione: quale),
                      ),
                      itemBuilder: (_) => [
                        for (final (quale, it, en) in const [
                          ('sopra', 'sopra', 'above'),
                          ('sotto', 'sotto', 'below'),
                          ('uguale', 'uguale a', 'equal to'),
                          ('diverso', 'diverso da', 'different from'),
                        ])
                          PopupMenuItem(
                            value: quale,
                            child: Text(inLingua(it: it, en: en)),
                          ),
                      ],
                      child: _Pastiglia(
                        testo: switch (_regola.condizione) {
                          'sotto' => inLingua(it: 'sotto', en: 'below'),
                          'uguale' => inLingua(it: 'uguale a', en: 'equal to'),
                          'diverso' => inLingua(
                            it: 'diverso da',
                            en: 'different from',
                          ),
                          _ => inLingua(it: 'sopra', en: 'above'),
                        },
                        giu: true,
                      ),
                    ),
                    _Pastiglia(
                      testo: _regola.valore.isEmpty ? '…' : _valoreDetto,
                      icona: Icons.edit_rounded,
                      iconaDopo: true,
                      tocca: _scriviIlValore,
                    ),
                    Text(
                      inLingua(it: 'per', en: 'for'),
                      style: testi.titleMedium,
                    ),
                    PopupMenuButton<int>(
                      initialValue: _regola.per,
                      onSelected: (quanto) =>
                          setState(() => _regola = _regola.con(per: quanto)),
                      itemBuilder: (_) => [
                        for (final quanto in _durate)
                          PopupMenuItem(
                            value: quanto,
                            child: Text(durataDetta(quanto)),
                          ),
                      ],
                      child: _Pastiglia(
                        testo: durataDetta(_regola.per),
                        giu: true,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Icon(Icons.arrow_forward_rounded, color: colori.onSurface),
                    const SizedBox(width: 8),
                    Flexible(
                      child: _Pastiglia(
                        testo: _titolo.text.trim().isEmpty
                            ? '«…»'
                            : '«${_titolo.text.trim()}»',
                        fondo: colori.surfaceContainer,
                        colore: colori.onSurface,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: inLingua(it: 'Urgenza: ', en: 'Urgency: '),
                      ),
                      TextSpan(
                        text: _nomeDellUrgenza(_regola.urgenza),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      TextSpan(
                        text: inLingua(it: ' · Chi: ', en: ' · Who: '),
                      ),
                      TextSpan(
                        text: _chi(),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                  style: testi.bodyMedium?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
                if (_regola.entita.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  _Adesso(
                    nome: _entita?.nome ?? _regola.entita,
                    valore: _entita == null
                        ? '—'
                        : '${_entita!.stato}${_unita.isEmpty ? '' : ' $_unita'}',
                    sopra: _adessoSopra,
                  ),
                  const SizedBox(height: 12),
                  _LaStoria(
                    punti: _storia,
                    soglia: double.tryParse(
                      _regola.valore.replaceAll(',', '.'),
                    ),
                    sopraSeMaggiore: _regola.condizione != 'sotto',
                    unita: _unita,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),
          Insegna(inLingua(it: 'Messaggio', en: 'Message')),
          Scheda(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _titolo,
                  maxLength: 80,
                  decoration: InputDecoration(
                    labelText: inLingua(it: 'Titolo', en: 'Title'),
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _testo,
                  maxLength: 120,
                  decoration: InputDecoration(
                    labelText: inLingua(it: 'Sotto il titolo', en: 'Subtitle'),
                    hintText: inLingua(
                      it: 'Aggiungi il valore e da quanto',
                      en: 'Add the value and for how long',
                    ),
                    counterText: '',
                  ),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    inLingua(
                      it: 'Con il valore e da quanto',
                      en: 'With the value and for how long',
                    ),
                  ),
                  value: _regola.conValore,
                  onChanged: (si) =>
                      setState(() => _regola = _regola.con(conValore: si)),
                ),
                Text(
                  inLingua(it: 'Come arriverà:', en: 'How it will look:'),
                  style: testi.bodyMedium?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 8),
                _ComeArrivera(
                  titolo: _titolo.text.trim().isEmpty
                      ? '…'
                      : _titolo.text.trim(),
                  testo: [
                    if (_testo.text.trim().isNotEmpty) _testo.text.trim(),
                    if (_regola.conValore)
                      '${_entita?.stato ?? _regola.valore}'
                          '${_unita.isEmpty ? '' : ' $_unita'} '
                          '${inLingua(it: 'da', en: 'for')} '
                          '${durataDetta(math.max(1, _regola.per))} · '
                          '${_entita?.nome ?? _regola.entita}',
                  ].join(' · '),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Colori.ambra),
              const SizedBox(width: 8),
              Text(
                inLingua(it: 'Urgenza', en: 'Urgency'),
                style: testi.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Scheda(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: double.infinity,
                  child: SegmentedButton<String>(
                    showSelectedIcon: false,
                    segments: [
                      for (final quale in const ['bassa', 'normale', 'urgente'])
                        ButtonSegment(
                          value: quale,
                          label: Text(_nomeDellUrgenza(quale)),
                          icon: quale == _regola.urgenza
                              ? const Icon(Icons.notifications_rounded)
                              : null,
                        ),
                    ],
                    selected: {_regola.urgenza},
                    onSelectionChanged: (scelta) => setState(
                      () => _regola = _regola.con(urgenza: scelta.first),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  inLingua(
                    it:
                        'Normale: suona come le altre e rispetta le ore di '
                        'silenzio. Urgente passa anche in silenzioso.',
                    en:
                        'Normal: rings like the others and respects quiet '
                        'hours. Urgent gets through even on silent.',
                  ),
                  style: testi.bodyMedium?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Icon(Icons.group_rounded, color: colori.primary),
              const SizedBox(width: 8),
              Text(
                inLingua(it: 'Chi la riceve', en: 'Who gets it'),
                style: testi.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Scheda(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final utente in widget.stato.utenti)
                      FilterChip(
                        avatar: CircleAvatar(
                          child: Text(
                            utente.nome.isEmpty
                                ? '?'
                                : utente.nome[0].toUpperCase(),
                          ),
                        ),
                        label: Text(utente.nome),
                        selected: _regola.chi.contains(utente.id),
                        onSelected:
                            widget.stato.amministra ||
                                utente.id == widget.stato.io
                            ? (si) => setState(
                                () => _regola = _regola.con(
                                  chi: [
                                    for (final uno in _regola.chi)
                                      if (uno != utente.id) uno,
                                    if (si) utente.id,
                                  ],
                                ),
                              )
                            : null,
                      ),
                  ],
                ),
                const Divider(height: 28),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            inLingua(
                              it: 'Non ripetere per',
                              en: 'Don\'t repeat for',
                            ),
                            style: testi.bodyLarge?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            inLingua(
                              it:
                                  'Se resta così, al massimo una volta ogni '
                                  '${durataDetta(_regola.nonRipetere)}',
                              en:
                                  'If it stays that way, at most once every '
                                  '${durataDetta(_regola.nonRipetere)}',
                            ),
                            style: testi.bodySmall?.copyWith(
                              color: colori.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    PopupMenuButton<int>(
                      initialValue: _regola.nonRipetere,
                      onSelected: (quanto) => setState(
                        () => _regola = _regola.con(nonRipetere: quanto),
                      ),
                      itemBuilder: (_) => [
                        for (final quanto in _ripetizioni)
                          PopupMenuItem(
                            value: quanto,
                            child: Text(durataDetta(quanto)),
                          ),
                      ],
                      child: _Pastiglia(
                        testo: durataDetta(_regola.nonRipetere),
                        fondo: colori.surfaceContainer,
                        colore: colori.onSurface,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (!_nuova && _regola.modificabile) ...[
            const SizedBox(height: 16),
            Center(
              child: TextButton.icon(
                onPressed: _togli,
                icon: const Icon(Icons.delete_outline_rounded),
                label: Text(
                  inLingua(
                    it: 'Togli questa notifica',
                    en: 'Remove this notification',
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                  onPressed: _completa && !_provando ? _prova : null,
                  icon: const Icon(Icons.send_rounded),
                  label: Text(inLingua(it: 'Prova adesso', en: 'Try now')),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                  onPressed: _completa && !_salvando ? _salva : null,
                  icon: const Icon(Icons.check_rounded),
                  label: Text(inLingua(it: 'Salva', en: 'Save')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _chi() {
    final nomi = [
      for (final utente in widget.stato.utenti)
        if (_regola.chi.contains(utente.id)) utente.nome,
    ];
    return nomi.isEmpty
        ? inLingua(it: 'solo tu', en: 'only you')
        : nomi.join(', ');
  }
}

String _nomeDellUrgenza(String quale) => switch (quale) {
  'bassa' => inLingua(it: 'Bassa', en: 'Low'),
  'urgente' => inLingua(it: 'Urgente', en: 'Urgent'),
  _ => inLingua(it: 'Normale', en: 'Normal'),
};

class _IPassi extends StatelessWidget {
  const _IPassi();

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    Widget passo(int numero, String testo) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 11,
          backgroundColor: colori.primary,
          child: Text(
            '$numero',
            style: TextStyle(
              color: colori.onPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          testo,
          style: testi.bodyMedium?.copyWith(color: colori.onSurfaceVariant),
        ),
      ],
    );
    final freccia = Icon(
      Icons.arrow_forward_rounded,
      size: 16,
      color: colori.onSurfaceVariant,
    );
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 6,
      children: [
        passo(1, inLingua(it: 'Entità', en: 'Entity')),
        freccia,
        passo(2, inLingua(it: 'Condizione', en: 'Condition')),
        freccia,
        passo(3, inLingua(it: 'Messaggio', en: 'Message')),
      ],
    );
  }
}

/// Un pezzo della frase, da toccare.
class _Pastiglia extends StatelessWidget {
  const _Pastiglia({
    required this.testo,
    this.icona,
    this.iconaDopo = false,
    this.giu = false,
    this.mono = false,
    this.fondo,
    this.colore,
    this.tocca,
  });

  final String testo;
  final IconData? icona;
  final bool iconaDopo;
  final bool giu;
  final bool mono;
  final Color? fondo;
  final Color? colore;
  final VoidCallback? tocca;

  @override
  Widget build(BuildContext context) {
    final scuro = Theme.of(context).brightness == Brightness.dark;
    final suFondo =
        fondo ?? (scuro ? const Color(0xFF3B2F12) : const Color(0xFFFEF3C7));
    final inChiaro =
        colore ?? (scuro ? const Color(0xFFFCD34D) : const Color(0xFF92400E));
    final scritto = Text(
      testo,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: inChiaro,
        fontWeight: FontWeight.w700,
        fontSize: mono ? 14 : 16,
        fontFamily: mono ? 'monospace' : null,
        fontFamilyFallback: mono ? const ['Menlo', 'Courier'] : null,
      ),
    );
    final dentro = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icona != null && !iconaDopo) ...[
            Icon(icona, size: 18, color: inChiaro),
            const SizedBox(width: 6),
          ],
          Flexible(child: scritto),
          if (icona != null && iconaDopo) ...[
            const SizedBox(width: 6),
            Icon(icona, size: 16, color: inChiaro),
          ],
          if (giu) ...[
            const SizedBox(width: 4),
            Icon(Icons.expand_more_rounded, size: 18, color: inChiaro),
          ],
        ],
      ),
    );
    return Material(
      color: suFondo,
      borderRadius: BorderRadius.circular(14),
      child: tocca == null
          ? dentro
          : InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: tocca,
              child: dentro,
            ),
    );
  }
}

class _Adesso extends StatelessWidget {
  const _Adesso({required this.nome, required this.valore, this.sopra});
  final String nome;
  final String valore;
  final bool? sopra;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colori.surfaceContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(Icons.thermostat_rounded, color: Colori.male),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$nome · ${inLingua(it: 'adesso', en: 'now')}',
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
                Text(
                  valore,
                  style: testi.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          if (sopra != null)
            Bollino(
              sopra!
                  ? inLingua(it: 'scatterebbe', en: 'would trigger')
                  : inLingua(it: 'tutto a posto', en: 'all fine'),
              colore: sopra! ? Colori.male : Colori.bene,
              fondo: (sopra! ? Colori.male : Colori.bene).withValues(
                alpha: 0.12,
              ),
            ),
        ],
      ),
    );
  }
}

/// Le ultime ventiquattro ore, con la soglia sopra.
class _LaStoria extends StatelessWidget {
  const _LaStoria({
    required this.punti,
    required this.soglia,
    required this.sopraSeMaggiore,
    required this.unita,
  });

  final List<PuntoDellaStoria>? punti;
  final double? soglia;
  final bool sopraSeMaggiore;
  final String unita;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final lista = punti;
    if (lista == null) {
      return const SizedBox(
        height: 90,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    if (lista.length < 2) {
      return Text(
        inLingua(
          it: 'Nessuna storia numerica nelle ultime 24 ore.',
          en: 'No numeric history in the last 24 hours.',
        ),
        style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
      );
    }
    final quante = soglia == null
        ? 0
        : lista
              .where(
                (uno) => sopraSeMaggiore
                    ? uno.valore > soglia!
                    : uno.valore < soglia!,
              )
              .length;
    return Column(
      children: [
        SizedBox(
          height: 110,
          width: double.infinity,
          child: CustomPaint(
            painter: _Disegno(
              punti: lista,
              soglia: soglia,
              linea: colori.primary,
              area: colori.primary.withValues(alpha: 0.10),
              rosso: Colori.male,
              etichetta: soglia == null
                  ? ''
                  : '${soglia!.toStringAsFixed(soglia! % 1 == 0 ? 0 : 1)}'
                        '${unita.isEmpty ? '' : ' $unita'}',
            ),
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Text(
              inLingua(it: 'ieri', en: 'yesterday'),
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
            Expanded(
              child: Text(
                quante == 0
                    ? inLingua(
                        it: 'Ultime 24 h: mai oltre la soglia',
                        en: 'Last 24 h: never past the threshold',
                      )
                    : inLingua(
                        it: 'Ultime 24 h: $quante volte oltre la soglia',
                        en: 'Last 24 h: $quante times past the threshold',
                      ),
                textAlign: TextAlign.center,
                style: testi.bodySmall?.copyWith(
                  color: colori.onSurfaceVariant,
                ),
              ),
            ),
            Text(
              inLingua(it: 'ora', en: 'now'),
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
          ],
        ),
      ],
    );
  }
}

class _Disegno extends CustomPainter {
  _Disegno({
    required this.punti,
    required this.soglia,
    required this.linea,
    required this.area,
    required this.rosso,
    required this.etichetta,
  });

  final List<PuntoDellaStoria> punti;
  final double? soglia;
  final Color linea;
  final Color area;
  final Color rosso;
  final String etichetta;

  @override
  void paint(Canvas canvas, Size size) {
    final valori = [for (final uno in punti) uno.valore, ?soglia];
    var minimo = valori.reduce(math.min);
    var massimo = valori.reduce(math.max);
    if (massimo - minimo < 1) {
      minimo -= 1;
      massimo += 1;
    }
    final margine = (massimo - minimo) * 0.15;
    minimo -= margine;
    massimo += margine;
    final inizio = punti.first.quando.millisecondsSinceEpoch.toDouble();
    final fine = math.max(
      inizio + 1,
      punti.last.quando.millisecondsSinceEpoch.toDouble(),
    );
    Offset dove(PuntoDellaStoria uno) => Offset(
      (uno.quando.millisecondsSinceEpoch - inizio) /
          (fine - inizio) *
          size.width,
      size.height - (uno.valore - minimo) / (massimo - minimo) * size.height,
    );
    final tratto = Path()..moveTo(dove(punti.first).dx, dove(punti.first).dy);
    for (final uno in punti.skip(1)) {
      tratto.lineTo(dove(uno).dx, dove(uno).dy);
    }
    final pieno = Path.from(tratto)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(pieno, Paint()..color = area);
    canvas.drawPath(
      tratto,
      Paint()
        ..color = linea
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeJoin = StrokeJoin.round,
    );
    final quale = soglia;
    if (quale != null) {
      final y =
          size.height - (quale - minimo) / (massimo - minimo) * size.height;
      final penna = Paint()
        ..color = rosso
        ..strokeWidth = 1.5;
      for (var x = 0.0; x < size.width; x += 10) {
        canvas.drawLine(
          Offset(x, y),
          Offset(math.min(x + 5, size.width), y),
          penna,
        );
      }
      final scritta = TextPainter(
        text: TextSpan(
          text: etichetta,
          style: TextStyle(
            fontFamily: 'Inter',
            color: rosso,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      scritta.paint(
        canvas,
        Offset(size.width - scritta.width, math.max(0, y - scritta.height - 2)),
      );
    }
  }

  @override
  bool shouldRepaint(_Disegno vecchio) =>
      vecchio.punti != punti || vecchio.soglia != soglia;
}

/// L'anteprima: la notifica come arriverà sul telefono.
class _ComeArrivera extends StatelessWidget {
  const _ComeArrivera({required this.titolo, required this.testo});
  final String titolo;
  final String testo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colori.surfaceContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.asset('assets/marchio/gda.png', width: 40, height: 40),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        titolo,
                        overflow: TextOverflow.ellipsis,
                        style: testi.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      inLingua(it: 'ora', en: 'now'),
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                Text(
                  testo,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: testi.bodyMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Il cercatore delle entità.
class _IlCercatore extends StatefulWidget {
  const _IlCercatore({required this.entita});
  final List<Entita> entita;

  @override
  State<_IlCercatore> createState() => _StatoDelCercatore();
}

class _StatoDelCercatore extends State<_IlCercatore> {
  String _cerca = '';

  @override
  Widget build(BuildContext context) {
    final parola = _cerca.toLowerCase();
    final trovate = [
      for (final una in widget.entita)
        if (parola.isEmpty ||
            una.id.toLowerCase().contains(parola) ||
            una.nome.toLowerCase().contains(parola))
          una,
    ].take(200).toList();
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.75,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              autofocus: true,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search_rounded),
                hintText: inLingua(
                  it: 'Cerca un\'entità',
                  en: 'Search an entity',
                ),
              ),
              onChanged: (testo) => setState(() => _cerca = testo),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: trovate.length,
              itemBuilder: (_, i) {
                final una = trovate[i];
                return ListTile(
                  leading: Icon(iconaDellEntita(una.id)),
                  title: Text(una.nome),
                  subtitle: Text(
                    una.id,
                    style: const TextStyle(fontFamily: 'monospace'),
                  ),
                  trailing: Text(una.stato),
                  onTap: () => Navigator.of(context).pop(una.id),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
