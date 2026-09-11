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

import '../casa/allegati.dart';
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
    this.scegli = scegliDalTelefono,
  });

  final Collegamento collegamento;

  /// Come si sceglie una foto o un video da allegare. Nelle prove e' una
  /// funzione finta: il selettore del sistema li' non c'e'.
  final ScegliUnAllegato scegli;

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

  /// Quale gruppo si sta guardando. `null` e' «Tutte», ed e' come si parte:
  /// chi apre la scheda vuole vedere le sue, tutte, e poi restringere.
  Gruppo? _filtro;
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
          scegli: widget.scegli,
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
          scegli: widget.scegli,
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
          scegli: widget.scegli,
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

  /* Quelle del gruppo scelto. `null` vuol dire «Tutte»: si torna la coda
   * intera, come fa `perStato` nella dashboard con un filtro che non
   * riconosce. */
  List<Segnalazione> _leMie(List<Segnalazione> tutte) {
    final quale = _filtro;
    if (quale == null) return tutte;
    return tutte.where((una) => una.gruppo == quale).toList();
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
          /* I filtri, gli stessi della dashboard: «Da lavorare», «In
           * lavorazione», «Chiuse», «Tutte», e sotto ognuno il conto.
           *
           * Ci sono **sempre**, appena c'e' una segnalazione: comparivano
           * solo con piu' di uno stato, e chi ne aveva una sola apriva la
           * scheda, non trovava il filtro e lo segnalava come mancante — un
           * comando che va e viene non e' un comando, e' una sorpresa. Quello
           * che li rende utili anche con una segnalazione sola e' il conto:
           * dice cosa c'e' prima di premere, e una riga di zeri accanto a un
           * uno si legge in un colpo. */
          _FilaDeiFiltri(
            segnalazioni: elenco.segnalazioni,
            scelto: _filtro,
            quandoScelto: (quale) => setState(() => _filtro = quale),
          ),
          const SizedBox(height: 12),
          if (_leMie(elenco.segnalazioni).isEmpty)
            const StatoVuoto(
              dentroUnaLista: true,
              icona: Icons.filter_list_off_rounded,
              titolo: 'Nessuna segnalazione in questo stato',
              sotto: 'Prova «Tutte»: le altre sono negli altri gruppi.',
            )
          else
            for (final una in _leMie(elenco.segnalazioni)) ...[
              _RigaDellaSegnalazione(una, quandoPremuta: () => _apri(una)),
              const SizedBox(height: 10),
            ],
        ],
      ],
    );
  }
}

/// La fila dei filtri dell'elenco: gli stessi tasti della dashboard, con gli
/// stessi nomi e lo stesso conto sotto ognuno.
///
/// Nella dashboard e' `filaMarkup(statiColConto, …)`: pastiglie tonde, quella
/// scelta piena col colore dell'accento, e dentro il numero di quante ce ne
/// sono in quel gruppo. Qui la forma e' quella dell'app — il colore lo da' il
/// tema, non un `--accent` — ma le parole, l'ordine e il conto sono i suoi.
class _FilaDeiFiltri extends StatelessWidget {
  const _FilaDeiFiltri({
    required this.segnalazioni,
    required this.scelto,
    required this.quandoScelto,
  });

  final List<Segnalazione> segnalazioni;

  /// `null` e' «Tutte».
  final Gruppo? scelto;
  final ValueChanged<Gruppo?> quandoScelto;

  @override
  Widget build(BuildContext context) {
    int quante(Gruppo? quale) => quale == null
        ? segnalazioni.length
        : segnalazioni.where((una) => una.gruppo == quale).length;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final quale in <Gruppo?>[...Gruppo.values, null])
          _Pastiglia(
            nome: quale?.nome ?? 'Tutte',
            quante: quante(quale),
            attiva: scelto == quale,
            quandoPremuta: () => quandoScelto(quale),
          ),
      ],
    );
  }
}

class _Pastiglia extends StatelessWidget {
  const _Pastiglia({
    required this.nome,
    required this.quante,
    required this.attiva,
    required this.quandoPremuta,
  });

  final String nome;
  final int quante;
  final bool attiva;
  final VoidCallback quandoPremuta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final sopra = attiva ? colori.onPrimary : colori.onSurfaceVariant;
    return Material(
      color: attiva ? colori.primary : colori.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(50),
      child: InkWell(
        borderRadius: BorderRadius.circular(50),
        onTap: quandoPremuta,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                nome,
                style: testi.labelLarge?.copyWith(
                  color: sopra,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 7),
              /* Il conto: dice cosa c'e' prima di premere. Sta dentro la
               * pastiglia, come nella dashboard, e non di fianco: di fianco
               * sarebbe un secondo numero da leggere invece dello stesso
               * tasto. */
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                decoration: BoxDecoration(
                  color: attiva
                      ? colori.onPrimary.withValues(alpha: 0.25)
                      : colori.surface,
                  borderRadius: BorderRadius.circular(50),
                ),
                child: Text(
                  '$quante',
                  style: testi.labelSmall?.copyWith(
                    color: sopra,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
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
                    /* Tre stati e non due: una segnalazione che qualcuno ha
                     * gia' preso in mano non e' «aperta» come una che aspetta
                     * ancora, e chi l'ha scritta la differenza la vuole
                     * sapere. Sono i tre gruppi dei filtri, con le parole
                     * della riga invece di quelle del tasto. */
                    Bollino(
                      switch (segnalazione.gruppo) {
                        Gruppo.aperte => 'aperta',
                        Gruppo.inCarico => 'in lavorazione',
                        Gruppo.chiuse => 'chiusa',
                      },
                      colore: switch (segnalazione.gruppo) {
                        Gruppo.aperte => Colori.bene,
                        Gruppo.inCarico => Colori.ambraScura,
                        Gruppo.chiuse => colori.onSurfaceVariant,
                      },
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
    this.scegli = scegliDalTelefono,
  });

  final Segnalazioni segnalazioni;
  final Map<String, String> diagnostica;

  /// Cosa succede dopo: lo decide chi ha aperto questa pagina, che sa dove
  /// si torna.
  final Future<void> Function(Segnalazione aperta) quandoMandata;

  /// Come si sceglie una foto o un video. Nelle prove e' una funzione finta.
  final ScegliUnAllegato scegli;

  @override
  State<NuovaSegnalazione> createState() => _NuovaSegnalazioneState();
}

class _NuovaSegnalazioneState extends State<NuovaSegnalazione> {
  TipoDiSegnalazione _tipo = TipoDiSegnalazione.problema;
  final _titolo = TextEditingController();
  final _corpo = TextEditingController();
  final _allegati = <Allegato>[];
  bool _mandando = false;
  bool _scegliendo = false;
  String? _perche;

  /* Cosa si sta facendo, mentre si manda: «Mando la foto 1 di 2…». */
  String? _passo;

  /* Aperta, ma con allegati rimasti indietro: si riprovano solo quelli, e
   * la segnalazione non si apre due volte. */
  Segnalazione? _aperta;

  @override
  void dispose() {
    _titolo.dispose();
    _corpo.dispose();
    super.dispose();
  }

  Future<void> _scegli(DaDoveLAllegato daDove) async {
    if (_scegliendo) return;
    setState(() {
      _scegliendo = true;
      _perche = null;
    });
    try {
      final scelto = await widget.scegli(daDove);
      if (scelto != null && mounted) setState(() => _allegati.add(scelto));
    } on AllegatoNonBuono catch (errore) {
      if (mounted) setState(() => _perche = errore.spiegazione);
    } catch (errore) {
      if (mounted) {
        setState(
          () => _perche = 'Non sono riuscito a prendere il file: $errore',
        );
      }
    } finally {
      if (mounted) setState(() => _scegliendo = false);
    }
  }

  Future<void> _manda() async {
    var aperta = _aperta;
    if (aperta == null) {
      final titolo = _titolo.text.trim();
      final corpo = _corpo.text.trim();
      if (titolo.isEmpty || corpo.isEmpty) {
        setState(() => _perche = 'Servono un titolo e due righe di testo.');
        return;
      }
      setState(() {
        _mandando = true;
        _perche = null;
        _passo = 'Mando la segnalazione…';
      });
      try {
        aperta = await widget.segnalazioni.crea(
          tipo: _tipo,
          titolo: titolo,
          corpo: corpo,
          diagnostica: widget.diagnostica,
        );
      } catch (errore) {
        if (mounted) {
          setState(() {
            _perche = spiegaLErrore(errore);
            _mandando = false;
            _passo = null;
          });
        }
        return;
      }
      if (!mounted) return;
      _aperta = aperta;
    } else {
      setState(() {
        _mandando = true;
        _perche = null;
      });
    }

    /* Gli allegati, uno alla volta: ognuno e' un viaggio intero fino a
     * GitHub. Quello che non parte resta in lista, e si riprova da qui. */
    final quanti = _allegati.length;
    var fatti = 0;
    while (_allegati.isNotEmpty) {
      final uno = _allegati.first;
      setState(
        () => _passo =
            'Mando ${uno.foto ? 'la foto' : 'il video'} ${fatti + 1} di $quanti…',
      );
      try {
        aperta = await widget.segnalazioni.allega(aperta!.numero, uno);
        fatti += 1;
        if (!mounted) return;
        setState(() => _allegati.removeAt(0));
      } catch (errore) {
        if (!mounted) return;
        final numero = aperta!.numero;
        setState(() {
          _mandando = false;
          _passo = null;
          _perche =
              'La segnalazione #$numero e\' partita, ma «${uno.nome}» no: '
              '${spiegaLErrore(errore)} Premi «Manda» per riprovare gli '
              'allegati, o vai avanti senza.';
        });
        return;
      }
    }
    if (!mounted) return;
    await widget.quandoMandata(aperta!);
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final aperta = _aperta;
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
            onSelectionChanged: aperta != null
                ? null
                : (scelti) => setState(() => _tipo = scelti.first),
          ),
          const SizedBox(height: 6),
          Text(
            _tipo.spiegazione,
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _titolo,
            enabled: aperta == null,
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
            enabled: aperta == null,
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
          GliAllegati(
            allegati: _allegati,
            scegliendo: _scegliendo,
            scegli: _mandando ? null : _scegli,
            togli: _mandando
                ? null
                : (quale) => setState(() => _allegati.remove(quale)),
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
            label: Text(
              _mandando
                  ? (_passo ?? 'Sto mandando…')
                  : aperta != null
                  ? 'Riprova gli allegati'
                  : 'Manda',
            ),
          ),
          if (aperta != null && !_mandando)
            TextButton(
              onPressed: () => widget.quandoMandata(aperta),
              child: const Text('Vai alla segnalazione senza gli allegati'),
            ),
        ],
      ),
    );
  }
}

/// Le foto e i video scelti, e i bottoni per sceglierne altri.
///
/// Sta a parte perche' lo stesso pezzo serve al modulo nuovo e, un giorno,
/// a chiunque voglia allegare qualcosa prima di mandare.
class GliAllegati extends StatelessWidget {
  const GliAllegati({
    super.key,
    required this.allegati,
    required this.scegliendo,
    required this.scegli,
    required this.togli,
  });

  final List<Allegato> allegati;
  final bool scegliendo;
  final Future<void> Function(DaDoveLAllegato daDove)? scegli;
  final void Function(Allegato quale)? togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Foto e video',
          style: testi.titleSmall?.copyWith(color: colori.onSurfaceVariant),
        ),
        const SizedBox(height: 4),
        Text(
          'Una foto di quello che vedi vale piu\' di una descrizione. Le '
          'foto partono ridotte; un video va tenuto corto.',
          style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
        ),
        if (allegati.isNotEmpty) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              for (final uno in allegati)
                InputChip(
                  avatar: Icon(
                    uno.foto ? Icons.photo_rounded : Icons.videocam_rounded,
                    size: 18,
                  ),
                  label: Text('${uno.nome} · ${uno.peso}'),
                  onDeleted: togli == null ? null : () => togli!(uno),
                  deleteButtonTooltipMessage: 'Togli',
                ),
            ],
          ),
        ],
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            OutlinedButton.icon(
              onPressed: scegli == null || scegliendo
                  ? null
                  : () => scegli!(DaDoveLAllegato.galleria),
              icon: const Icon(Icons.photo_library_rounded),
              label: const Text('Foto'),
            ),
            OutlinedButton.icon(
              onPressed: scegli == null || scegliendo
                  ? null
                  : () => scegli!(DaDoveLAllegato.fotocamera),
              icon: const Icon(Icons.photo_camera_rounded),
              label: const Text('Scatta'),
            ),
            OutlinedButton.icon(
              onPressed: scegli == null || scegliendo
                  ? null
                  : () => scegli!(DaDoveLAllegato.video),
              icon: const Icon(Icons.videocam_rounded),
              label: const Text('Video'),
            ),
            if (scegliendo)
              const Padding(
                padding: EdgeInsets.all(10),
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
          ],
        ),
      ],
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
    this.scegli = scegliDalTelefono,
  });

  final Segnalazioni segnalazioni;
  final Segnalazione iniziale;
  final ScegliUnAllegato scegli;

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
        allega: (allegato) async {
          final aggiornato = await widget.segnalazioni.allega(
            _filo.numero,
            allegato,
          );
          if (mounted) setState(() => _filo = aggiornato);
        },
        scegli: widget.scegli,
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
    this.allega,
    this.scegli = scegliDalTelefono,
  });

  final List<Messaggio> messaggi;
  final Future<void> Function(String testo) manda;
  final Future<void> Function() rileggi;

  /// Come si allega una foto o un video, se da qui si puo'.
  final Future<void> Function(Allegato allegato)? allega;
  final ScegliUnAllegato scegli;
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

  /* Da dove: una tendina con le tre strade, e poi si sceglie e si manda. */
  Future<void> _allega() async {
    final allega = widget.allega;
    if (allega == null || _mandando) return;
    final daDove = await showModalBottomSheet<DaDoveLAllegato>(
      context: context,
      builder: (contesto) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final una in DaDoveLAllegato.values)
              ListTile(
                leading: Icon(switch (una) {
                  DaDoveLAllegato.galleria => Icons.photo_library_rounded,
                  DaDoveLAllegato.fotocamera => Icons.photo_camera_rounded,
                  DaDoveLAllegato.video => Icons.videocam_rounded,
                }),
                title: Text(una.nome),
                onTap: () => Navigator.of(contesto).pop(una),
              ),
          ],
        ),
      ),
    );
    if (daDove == null || !mounted) return;
    setState(() {
      _mandando = true;
      _perche = null;
    });
    try {
      final scelto = await widget.scegli(daDove);
      if (scelto != null) await allega(scelto);
    } on AllegatoNonBuono catch (errore) {
      if (mounted) setState(() => _perche = errore.spiegazione);
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
                if (widget.allega != null)
                  IconButton(
                    tooltip: 'Allega',
                    onPressed: _mandando ? null : _allega,
                    icon: const Icon(Icons.attach_file_rounded),
                  ),
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
