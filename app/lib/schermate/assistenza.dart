/// La chat di assistenza: si scrive a chi fa l'app, e la risposta torna qui.
///
/// E' un filo solo per casa, che nasce alla prima parola: non c'e' niente da
/// aprire e niente da scegliere. Passa dal ponte e dal centralino come le
/// segnalazioni, con dentro le stesse informazioni raccolte da sole.
library;

import 'package:flutter/material.dart';

import '../casa/allegati.dart';
import '../casa/collegamento.dart';
import '../casa/segnalazioni.dart';
import '../ponte/filo.dart';
import '../vestito/pezzi.dart';
import 'segnalazioni.dart';

class SchermataDellAssistenza extends StatefulWidget {
  const SchermataDellAssistenza({
    super.key,
    required this.collegamento,
    required this.diagnostica,
    this.scegli = scegliDalTelefono,
  });

  final Collegamento collegamento;
  final Map<String, String> Function() diagnostica;

  /// Come si sceglie una foto o un video da allegare.
  final ScegliUnAllegato scegli;

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
      final chat = await Segnalazioni(filo).chat();
      if (mounted) {
        setState(() {
          _chat = chat;
          _letta = true;
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

  Future<void> _allega(Allegato allegato) async {
    final filo = _filo;
    if (filo == null) throw const FiloCadutoQui();
    final chat = await Segnalazioni(filo).allegaAllaChat(allegato);
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
    return Conversazione(
      messaggi: _chat?.messaggi ?? const [],
      perche: _perche,
      suggerimento: 'Scrivi a chi fa l\'app…',
      vuota: const StatoVuoto(
        dentroUnaLista: true,
        icona: Icons.support_agent_rounded,
        titolo: 'Ciao',
        sotto:
            'Qui si parla con chi fa l\'app. Scrivi quello che vuoi: la '
            'risposta arriva qui sotto, e con le parole partono anche la '
            'versione dell\'app e del ponte, cosi\' non te le chiediamo.',
      ),
      manda: _scrivi,
      allega: _allega,
      scegli: widget.scegli,
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
