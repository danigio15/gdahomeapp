/// La chat di assistenza: si scrive a chi fa l'app, e la risposta torna qui.
///
/// E' un filo solo per casa, che nasce alla prima parola: non c'e' niente da
/// aprire e niente da scegliere. Sotto c'e' la chat della plancia, la stessa
/// che si apre dalla sua Configurazione: la fa il ponte, e non passa da
/// GitHub.
///
/// Da qui passano parole, e nient'altro: una foto si allega a una
/// segnalazione, dove resta scritta accanto al difetto che mostra.
library;

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/impostazioni.dart';
import '../casa/segnalazioni.dart';
import '../ponte/filo.dart';
import '../vestito/pezzi.dart';
import 'diagnostica.dart';
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
      setState(() => _perche = 'La casa non e\' collegata.');
      return;
    }
    setState(() {
      _caricando = true;
      _perche = null;
    });
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

  @override
  Widget build(BuildContext context) {
    if (!_letta && _caricando) {
      return const Center(child: CircularProgressIndicator());
    }
    final impostazioni = widget.impostazioni;
    return Conversazione(
      messaggi: _chat?.messaggi ?? const [],
      perche: _perche,
      suggerimento: 'Scrivi a chi fa l\'app…',
      intestazione: impostazioni == null
          ? null
          : Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: () => Navigator.of(context).push<void>(
                  MaterialPageRoute(
                    builder: (_) => SchermataDellaDiagnostica(
                      collegamento: widget.collegamento,
                      impostazioni: impostazioni,
                    ),
                  ),
                ),
                icon: const Icon(Icons.monitor_heart_outlined),
                label: const Text('Come va l\'app'),
              ),
            ),
      vuota: const StatoVuoto(
        dentroUnaLista: true,
        icona: Icons.support_agent_rounded,
        titolo: 'Ciao',
        sotto:
            'Qui si parla con chi fa l\'app. Scrivi quello che vuoi: la '
            'risposta arriva qui sotto, e con le parole partono anche le '
            'versioni della plancia, dell\'add-on e dell\'app, cosi\' non te '
            'le chiediamo. Per una foto apri una segnalazione: li\' resta '
            'scritta accanto a quello che mostra.',
      ),
      manda: _scrivi,
      rileggi: _carica,
    );
  }
}

/// Il filo non c'e' nel momento in cui si manda: e' un caso del telefono, non
/// del ponte, e si dice con parole sue.
class FiloCadutoQui implements Exception {
  const FiloCadutoQui();
  @override
  String toString() => 'La casa non e\' collegata: riprova fra un momento.';
}
