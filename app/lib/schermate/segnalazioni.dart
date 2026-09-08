/// Le segnalazioni: quando qualcosa non va, o si ha un'idea, si scrive qui.
///
/// Stanno nell'app e non nella plancia, e arrivano a chi fa l'app con dentro
/// gia' quello che servirebbe chiedere: la versione dell'app e del ponte, il
/// telefono, da dove si stava passando. Le risposte tornano qui, sotto la
/// segnalazione, come in una conversazione.
///
/// Tre schermate: l'elenco, una nuova, e il filo di una.
library;

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/segnalazioni.dart';
import '../ponte/filo.dart';
import '../vestito/pezzi.dart';
import '../vestito/tema.dart';

class SchermataDelleSegnalazioni extends StatefulWidget {
  const SchermataDelleSegnalazioni({
    super.key,
    required this.collegamento,
    required this.diagnostica,
  });

  final Collegamento collegamento;

  /// Quello che si allega da soli: chiesto al momento di mandare, cosi' dice
  /// le cose di quel momento.
  final Map<String, String> Function() diagnostica;

  @override
  State<SchermataDelleSegnalazioni> createState() =>
      _SchermataDelleSegnalazioniState();
}

class _SchermataDelleSegnalazioniState
    extends State<SchermataDelleSegnalazioni> {
  ElencoDelleSegnalazioni? _elenco;
  String? _perche;
  bool _caricando = false;

  Filo? get _filo {
    final filo = widget.collegamento.filo;
    return filo != null && filo.dentro ? filo : null;
  }

  @override
  void initState() {
    super.initState();
    _carica();
  }

  @override
  void didUpdateWidget(SchermataDelleSegnalazioni vecchia) {
    super.didUpdateWidget(vecchia);
    /* Il filo puo' non esserci alla prima apertura ed esserci dopo: appena
     * c'e', si legge. */
    if (_elenco == null && !_caricando && _filo != null) _carica();
  }

  Future<void> _carica({bool aggiorna = false}) async {
    final filo = _filo;
    if (filo == null) {
      setState(() => _perche = 'La casa non e\' collegata.');
      return;
    }
    setState(() {
      _caricando = true;
      _perche = null;
    });
    try {
      final elenco = await Segnalazioni(filo).elenco(aggiorna: aggiorna);
      if (mounted) setState(() => _elenco = elenco);
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    } finally {
      if (mounted) setState(() => _caricando = false);
    }
  }

  Future<void> _nuova() async {
    final filo = _filo;
    if (filo == null) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => NuovaSegnalazione(
          segnalazioni: Segnalazioni(filo),
          diagnostica: widget.diagnostica(),
          quandoMandata: _mandata,
        ),
      ),
    );
    if (mounted) await _carica();
  }

  /// Mandata: al posto del modulo compare il suo filo, con le parole appena
  /// scritte dentro un fumetto. Quando si torna, l'elenco si rilegge.
  Future<void> _mandata(Segnalazione aperta) async {
    final filo = _filo;
    if (filo == null || !mounted) return;
    await Navigator.of(context).pushReplacement<void, void>(
      MaterialPageRoute(
        builder: (_) => FiloDellaSegnalazione(
          segnalazioni: Segnalazioni(filo),
          iniziale: aperta,
        ),
      ),
    );
    if (mounted) await _carica();
  }

  Future<void> _apri(Segnalazione quale) async {
    final filo = _filo;
    if (filo == null) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => FiloDellaSegnalazione(
          segnalazioni: Segnalazioni(filo),
          iniziale: quale,
        ),
      ),
    );
    if (mounted) await _carica();
  }

  @override
  Widget build(BuildContext context) {
    final elenco = _elenco;
    final spedibili = elenco?.spedibili ?? false;
    return Scaffold(
      floatingActionButton: elenco == null || !spedibili
          ? null
          : FloatingActionButton.extended(
              onPressed: _nuova,
              icon: const Icon(Icons.edit_note_rounded),
              label: const Text('Nuova segnalazione'),
            ),
      body: RefreshIndicator(
        onRefresh: () => _carica(aggiorna: true),
        child: _corpo(context, elenco),
      ),
    );
  }

  Widget _corpo(BuildContext context, ElencoDelleSegnalazioni? elenco) {
    if (elenco == null) {
      if (_caricando) {
        return const Center(child: CircularProgressIndicator());
      }
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 96),
        children: [
          StatoVuoto(
            dentroUnaLista: true,
            icona: Icons.cloud_off_rounded,
            titolo: 'Le segnalazioni non arrivano',
            sotto: _perche ?? 'Non si sa perche\'.',
            azione: FilledButton.tonalIcon(
              onPressed: _carica,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Riprova'),
            ),
          ),
        ],
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
      children: [
        if (!elenco.spedibili)
          Scheda(
            child: Row(
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Questa casa non passa da nessun centralino, e le '
                    'segnalazioni non hanno una strada per uscire. Si accende '
                    '«da fuori casa» nelle opzioni del ponte.',
                  ),
                ),
              ],
            ),
          ),
        if (!elenco.spedibili) const SizedBox(height: 12),
        if (elenco.segnalazioni.isEmpty)
          const StatoVuoto(
            dentroUnaLista: true,
            icona: Icons.forum_outlined,
            titolo: 'Nessuna segnalazione',
            sotto:
                'Se qualcosa non va, o hai un\'idea, scrivila qui: arriva a '
                'chi fa l\'app con dentro gia\' le informazioni che servono, e '
                'la risposta torna qui sotto.',
          )
        else ...[
          const Insegna('Le tue segnalazioni'),
          for (final una in elenco.segnalazioni) ...[
            _RigaDellaSegnalazione(una, quandoPremuta: () => _apri(una)),
            const SizedBox(height: 10),
          ],
        ],
      ],
    );
  }
}

class _RigaDellaSegnalazione extends StatelessWidget {
  const _RigaDellaSegnalazione(
    this.segnalazione, {
    required this.quandoPremuta,
  });
  final Segnalazione segnalazione;
  final VoidCallback quandoPremuta;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final colori = Theme.of(context).colorScheme;
    final quando = segnalazione.apertaIl;
    return Scheda(
      quandoPremuta: quandoPremuta,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Bollino(
                      segnalazione.tipo.nome,
                      colore: _coloreDelTipo(segnalazione.tipo),
                    ),
                    const SizedBox(width: 8),
                    Bollino(
                      segnalazione.aperta ? 'aperta' : 'chiusa',
                      colore: segnalazione.aperta
                          ? Colori.bene
                          : colori.onSurfaceVariant,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  segnalazione.titolo,
                  style: testi.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    '${segnalazione.quantiMessaggi} '
                        '${segnalazione.quantiMessaggi == 1 ? 'messaggio' : 'messaggi'}',
                    if (quando != null) _giorno(quando),
                  ].join(' · '),
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: colori.onSurfaceVariant),
        ],
      ),
    );
  }
}

Color _coloreDelTipo(TipoDiSegnalazione tipo) => switch (tipo) {
  TipoDiSegnalazione.problema => Colori.male,
  TipoDiSegnalazione.idea => Colori.ambraScura,
  TipoDiSegnalazione.domanda => Colori.notte,
};

String _giorno(DateTime quando) {
  final adesso = DateTime.now();
  final stesso =
      quando.year == adesso.year &&
      quando.month == adesso.month &&
      quando.day == adesso.day;
  final ore = quando.hour.toString().padLeft(2, '0');
  final minuti = quando.minute.toString().padLeft(2, '0');
  if (stesso) return 'oggi alle $ore:$minuti';
  return '${quando.day}/${quando.month}/${quando.year} $ore:$minuti';
}

/// Una segnalazione nuova: di che si tratta, un titolo, il testo. Quello che
/// si allega da soli si vede prima di mandare, per esteso: niente parte a
/// sorpresa.
class NuovaSegnalazione extends StatefulWidget {
  const NuovaSegnalazione({
    super.key,
    required this.segnalazioni,
    required this.diagnostica,
    required this.quandoMandata,
  });

  final Segnalazioni segnalazioni;
  final Map<String, String> diagnostica;

  /// Cosa succede dopo: lo decide chi ha aperto questa pagina, che sa dove
  /// si torna.
  final Future<void> Function(Segnalazione aperta) quandoMandata;

  @override
  State<NuovaSegnalazione> createState() => _NuovaSegnalazioneState();
}

class _NuovaSegnalazioneState extends State<NuovaSegnalazione> {
  TipoDiSegnalazione _tipo = TipoDiSegnalazione.problema;
  final _titolo = TextEditingController();
  final _corpo = TextEditingController();
  bool _mandando = false;
  String? _perche;

  @override
  void dispose() {
    _titolo.dispose();
    _corpo.dispose();
    super.dispose();
  }

  Future<void> _manda() async {
    final titolo = _titolo.text.trim();
    final corpo = _corpo.text.trim();
    if (titolo.isEmpty || corpo.isEmpty) {
      setState(() => _perche = 'Servono un titolo e due righe di testo.');
      return;
    }
    setState(() {
      _mandando = true;
      _perche = null;
    });
    try {
      final aperta = await widget.segnalazioni.crea(
        tipo: _tipo,
        titolo: titolo,
        corpo: corpo,
        diagnostica: widget.diagnostica,
      );
      if (!mounted) return;
      await widget.quandoMandata(aperta);
    } catch (errore) {
      if (mounted) {
        setState(() {
          _perche = spiegaLErrore(errore);
          _mandando = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Nuova segnalazione')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          SegmentedButton<TipoDiSegnalazione>(
            segments: [
              for (final tipo in TipoDiSegnalazione.values)
                ButtonSegment(value: tipo, label: Text(tipo.nome)),
            ],
            selected: {_tipo},
            onSelectionChanged: (scelti) =>
                setState(() => _tipo = scelti.first),
          ),
          const SizedBox(height: 6),
          Text(
            _tipo.spiegazione,
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _titolo,
            maxLength: 120,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'In due parole',
              hintText: 'La luce del salotto non risponde',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _corpo,
            minLines: 5,
            maxLines: 12,
            maxLength: 4000,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Racconta',
              hintText:
                  'Cosa stavi facendo, cosa ti aspettavi, cosa e\' successo.',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 18),
          _CosaSiAllega(widget.diagnostica),
          if (_perche != null) ...[
            const SizedBox(height: 14),
            Text(_perche!, style: TextStyle(color: colori.error)),
          ],
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: _mandando ? null : _manda,
            icon: _mandando
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send_rounded),
            label: Text(_mandando ? 'Sto mandando…' : 'Manda'),
          ),
        ],
      ),
    );
  }
}

/// Quello che parte insieme alle parole, scritto per intero prima di mandare.
class _CosaSiAllega extends StatelessWidget {
  const _CosaSiAllega(this.diagnostica);
  final Map<String, String> diagnostica;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final voci = diagnostica.entries.where((una) => una.value.isNotEmpty);
    return Scheda(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Parte anche questo, da solo',
            style: testi.labelLarge?.copyWith(color: colori.onSurfaceVariant),
          ),
          const SizedBox(height: 6),
          for (final una in voci)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 1),
              child: Text(
                '${una.key}: ${una.value}',
                style: testi.bodySmall?.copyWith(
                  fontFamily: 'monospace',
                  color: colori.onSurfaceVariant,
                ),
              ),
            ),
          const SizedBox(height: 6),
          Text(
            'Niente credenziali, niente nomi delle entita\', niente indirizzi.',
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

/// Il filo di una segnalazione: le parole, le risposte, e una casella per
/// continuare.
class FiloDellaSegnalazione extends StatefulWidget {
  const FiloDellaSegnalazione({
    super.key,
    required this.segnalazioni,
    required this.iniziale,
  });

  final Segnalazioni segnalazioni;
  final Segnalazione iniziale;

  @override
  State<FiloDellaSegnalazione> createState() => _FiloDellaSegnalazioneState();
}

class _FiloDellaSegnalazioneState extends State<FiloDellaSegnalazione> {
  late Segnalazione _filo = widget.iniziale;
  String? _perche;

  @override
  void initState() {
    super.initState();
    if (_filo.messaggi.isEmpty) _rileggi();
  }

  Future<void> _rileggi() async {
    try {
      final letto = await widget.segnalazioni.leggi(_filo.numero);
      if (mounted) {
        setState(() {
          _filo = letto;
          _perche = null;
        });
      }
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    }
  }

  Future<Segnalazione> _rispondi(String testo) =>
      widget.segnalazioni.rispondi(_filo.numero, testo);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_filo.titolo, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Rileggi',
            onPressed: _rileggi,
          ),
        ],
      ),
      body: Conversazione(
        messaggi: _filo.messaggi,
        perche: _perche,
        intestazione: Row(
          children: [
            Bollino(_filo.tipo.nome, colore: _coloreDelTipo(_filo.tipo)),
            const SizedBox(width: 8),
            Bollino(_filo.aperta ? 'aperta' : 'chiusa'),
            if (_filo.numero > 0) ...[
              const SizedBox(width: 8),
              Text(
                '#${_filo.numero}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
        suggerimento: 'Aggiungi qualcosa…',
        manda: (testo) async {
          final aggiornato = await _rispondi(testo);
          if (mounted) setState(() => _filo = aggiornato);
        },
        rileggi: _rileggi,
      ),
    );
  }
}

/// Una conversazione: i fumetti, e la casella in fondo. La usano il filo di
/// una segnalazione e la chat di assistenza, che sono la stessa cosa vista
/// da due porte.
class Conversazione extends StatefulWidget {
  const Conversazione({
    super.key,
    required this.messaggi,
    required this.manda,
    required this.rileggi,
    this.intestazione,
    this.perche,
    this.vuota,
    this.suggerimento = 'Scrivi…',
  });

  final List<Messaggio> messaggi;
  final Future<void> Function(String testo) manda;
  final Future<void> Function() rileggi;
  final Widget? intestazione;
  final String? perche;

  /// Cosa si vede quando non c'e' ancora niente.
  final Widget? vuota;
  final String suggerimento;

  @override
  State<Conversazione> createState() => _ConversazioneState();
}

class _ConversazioneState extends State<Conversazione> {
  final _testo = TextEditingController();
  bool _mandando = false;
  String? _perche;

  @override
  void dispose() {
    _testo.dispose();
    super.dispose();
  }

  Future<void> _manda() async {
    final testo = _testo.text.trim();
    if (testo.isEmpty) return;
    setState(() {
      _mandando = true;
      _perche = null;
    });
    try {
      await widget.manda(testo);
      _testo.clear();
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    } finally {
      if (mounted) setState(() => _mandando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final perche = _perche ?? widget.perche;
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: widget.rileggi,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              children: [
                if (widget.intestazione != null) ...[
                  widget.intestazione!,
                  const SizedBox(height: 14),
                ],
                if (widget.messaggi.isEmpty && widget.vuota != null)
                  widget.vuota!,
                for (final uno in widget.messaggi) _Fumetto(uno),
                if (perche != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(perche, style: TextStyle(color: colori.error)),
                  ),
              ],
            ),
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 8, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _testo,
                    minLines: 1,
                    maxLines: 5,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      hintText: widget.suggerimento,
                      isDense: true,
                    ),
                    onSubmitted: (_) => _manda(),
                  ),
                ),
                const SizedBox(width: 6),
                IconButton.filled(
                  tooltip: 'Manda',
                  onPressed: _mandando ? null : _manda,
                  icon: _mandando
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Fumetto extends StatelessWidget {
  const _Fumetto(this.messaggio);
  final Messaggio messaggio;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final mio = messaggio.dallaCasa;
    return Align(
      alignment: mio ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
        constraints: const BoxConstraints(maxWidth: 320),
        decoration: BoxDecoration(
          color: mio ? colori.primaryContainer : colori.surfaceContainerHighest,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(mio ? 18 : 4),
            bottomRight: Radius.circular(mio ? 4 : 18),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              messaggio.testo,
              style: testi.bodyMedium?.copyWith(
                color: mio ? colori.onPrimaryContainer : colori.onSurface,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              [
                mio ? 'tu' : 'chi fa l\'app',
                if (messaggio.il != null) _giorno(messaggio.il!),
              ].join(' · '),
              style: testi.labelSmall?.copyWith(
                color: (mio ? colori.onPrimaryContainer : colori.onSurface)
                    .withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
