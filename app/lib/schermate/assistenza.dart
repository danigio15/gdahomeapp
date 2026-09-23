/// La chat di assistenza: si scrive a chi fa l'app, e la risposta torna qui.
///
/// E' un filo solo per casa, che nasce alla prima parola: non c'e' niente da
/// aprire e niente da scegliere. Sotto c'e' la chat della plancia, la stessa
/// che si apre dalla sua Configurazione: la fa il ponte, e non passa da
/// GitHub.
///
/// Da qui passano parole, e nient'altro: una foto si allega a una
/// segnalazione, dove resta scritta accanto al difetto che mostra.
///
/// ─── E chi risponde ──────────────────────────────────────────────────────
///
/// «Assistenza su app non mi fa vedere le chat che arrivano da utenti.»
///
/// Non le faceva vedere, ed era voluto a meta': le conversazioni delle altre
/// case stanno nella Console, che e' una voce a parte del menu e compare in
/// **una casa sola al mondo** — quella che nelle opzioni del ponte ha la
/// chiave della console. Voluto, perche' sono due cose diverse: qui si
/// chiede, li' si risponde.
///
/// Sbagliato, pero', il posto da cui ci si arriva. Chi risponde apre
/// «Assistenza», perche' e' li' che la parola lo porta, e trova la sua di
/// chat: una schermata che dice «Ciao» a chi le chat le deve leggere. Da qui
/// in poi, in quella casa sola, in cima c'e' anche la porta per la coda —
/// come «Come va l'app» le sta accanto da sempre.
///
/// Nelle altre case quel tasto non c'e': una porta che non si apre e' peggio
/// di una porta che non c'e'.
library;

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/console.dart';
import '../casa/impostazioni.dart';
import '../casa/segnalazioni.dart';
import '../parole.dart';
import '../ponte/filo.dart';
import '../vestito/pezzi.dart';
import 'console.dart';
import 'diagnostica.dart';
import 'menu.dart' show Sezione;
import 'segnalazioni.dart';

class SchermataDellAssistenza extends StatefulWidget {
  const SchermataDellAssistenza({
    super.key,
    required this.collegamento,
    required this.diagnostica,
    this.impostazioni,
  });

  final Collegamento collegamento;
  final Map<String, String> Function() diagnostica;

  /// Con le impostazioni c'e' anche la porta di «Come va l'app».
  final Impostazioni? impostazioni;

  @override
  State<SchermataDellAssistenza> createState() =>
      _SchermataDellAssistenzaState();
}

class _SchermataDellAssistenzaState extends State<SchermataDellAssistenza> {
  Segnalazione? _chat;
  bool _letta = false;
  bool _caricando = false;
  String? _perche;

  /* Se da questa casa si risponde anche alle altre.
   *
   * Lo dice il ponte, e la domanda non esce di casa: `chat/stato` legge le
   * opzioni dell'add-on e basta. Falso finche' non risponde, cosi' in una
   * casa qualunque quel tasto non compare e sparisce. */
  bool _console = false;

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
  void didUpdateWidget(SchermataDellAssistenza vecchia) {
    super.didUpdateWidget(vecchia);
    if (!_letta && !_caricando && _filo != null) _carica();
  }

  Future<void> _carica() async {
    final filo = _filo;
    if (filo == null) {
      setState(
        () => _perche = inLingua(
          it: 'La casa non è collegata.',
          en: 'Your home isn\'t connected.',
        ),
      );
      return;
    }
    setState(() {
      _caricando = true;
      _perche = null;
    });
    _seSiRisponde();
    try {
      final letta = await Segnalazioni(filo).chat();
      if (mounted) {
        setState(() {
          _chat = letta.filo;
          _letta = true;
          /* Il centralino dell'assistenza non ha risposto: le parole che
           * c'erano si vedono ancora, e questo si dice accanto. */
          _perche = letta.guaio.isEmpty ? null : letta.guaio;
        });
      }
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    } finally {
      if (mounted) setState(() => _caricando = false);
    }
  }

  /* Se questa e' la casa di chi risponde.
   *
   * Sta per conto suo e non dentro `_carica` perche' sono due domande
   * diverse: un centralino giu' non deve togliere il tasto della coda, e una
   * console che non c'e' non deve svuotare la conversazione. */
  Future<void> _seSiRisponde() async {
    final filo = _filo;
    if (filo == null) return;
    final risponde = await LaConsole(filo).cE();
    if (mounted && risponde != _console) setState(() => _console = risponde);
  }

  Future<void> _scrivi(String testo) async {
    final filo = _filo;
    if (filo == null) throw const FiloCadutoQui();
    final chat = await Segnalazioni(filo)
        .chatta(testo, diagnostica: widget.diagnostica());
    if (mounted) {
      setState(() {
        _chat = chat;
        _letta = true;
      });
    }
  }

  /* I tasti in cima: «Come va l'app», e in una casa sola anche la coda.
   *
   * Uno accanto all'altro dentro un `Wrap`, e non in una `Row`: sul telefono
   * stretto due tasti affiancati sfondano, e questo va a capo da solo invece
   * di tagliare la seconda parola.
   *
   * Niente tasti, niente riquadro: `null` e non una riga vuota, se no
   * l'intestazione lascerebbe uno spazio bianco sopra «Ciao». */
  Widget? _intestazione(BuildContext context, Impostazioni? impostazioni) {
    final tasti = <Widget>[
      if (impostazioni != null)
        OutlinedButton.icon(
          onPressed: () => Navigator.of(context).push<void>(
            MaterialPageRoute(
              builder: (_) => SchermataDellaDiagnostica(
                collegamento: widget.collegamento,
                impostazioni: impostazioni,
              ),
            ),
          ),
          icon: const Icon(Icons.monitor_heart_outlined),
          label: Text(Sezione.comeVaLApp.titolo),
        ),
      if (_console)
        FilledButton.tonalIcon(
          onPressed: () => Navigator.of(context).push<void>(
            MaterialPageRoute(
              builder: (_) => _LaCodaDaSola(collegamento: widget.collegamento),
            ),
          ),
          icon: const Icon(Icons.forum_outlined),
          /* Non «Console»: quella parola dice dove si va, non cosa si trova.
           * Chi la apre cerca le parole delle altre case, ed e' quello che il
           * tasto deve nominare. */
          label: Text(
            inLingua(it: 'Le chat delle case', en: 'Messages from homes'),
          ),
        ),
    ];
    if (tasti.isEmpty) return null;
    return Align(
      alignment: Alignment.centerLeft,
      child: Wrap(spacing: 8, runSpacing: 8, children: tasti),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_letta && _caricando) {
      return const Center(child: CircularProgressIndicator());
    }
    final impostazioni = widget.impostazioni;
    return Conversazione(
      messaggi: _chat?.messaggi ?? const [],
      perche: _perche,
      suggerimento: inLingua(
        it: 'Scrivi a chi fa l\'app…',
        en: 'Write to whoever makes the app…',
      ),
      intestazione: _intestazione(context, impostazioni),
      vuota: StatoVuoto(
        dentroUnaLista: true,
        icona: Icons.support_agent_rounded,
        titolo: inLingua(it: 'Ciao', en: 'Hello'),
        sotto: inLingua(
          it:
              'Qui si parla con chi fa l\'app. Scrivi quello che vuoi: la '
              'risposta arriva qui sotto, e con le parole partono anche le '
              'versioni della plancia, dell\'add-on e dell\'app, così non te '
              'le chiediamo. Per una foto apri una segnalazione: lì resta '
              'scritta accanto a quello che mostra.',
          en:
              'This is where you talk to whoever makes the app. Write '
              'whatever you like: the answer comes back below, and along with '
              'your words go the dashboard, add-on and app versions, so we '
              'don\'t have to ask. For a photo open a report: there it stays '
              'written next to what it shows.',
        ),
      ),
      manda: _scrivi,
      rileggi: _carica,
    );
  }
}

/// La coda aperta come pagina a se'.
///
/// Dentro il menu la Console una testata ce l'ha gia' — e' la barra dell'app —
/// e la schermata non se la fabbrica. Arrivandoci da qui invece e' una pagina
/// spinta sopra le altre, e senza una testata non ci sarebbe la freccia per
/// tornare indietro: e' lo stesso tetto che si mette «Come va l'app».
class _LaCodaDaSola extends StatelessWidget {
  const _LaCodaDaSola({required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(Sezione.console.titolo)),
    body: SchermataDellaConsole(collegamento: collegamento),
  );
}

/// Il filo non c'e' nel momento in cui si manda: e' un caso del telefono, non
/// del ponte, e si dice con parole sue.
class FiloCadutoQui implements Exception {
  const FiloCadutoQui();
  @override
  String toString() => inLingua(
    it: 'La casa non è collegata: riprova fra un momento.',
    en: 'Your home isn\'t connected: try again in a moment.',
  );
}
