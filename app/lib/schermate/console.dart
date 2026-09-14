/// La console dell'assistenza: la coda di tutte le case.
///
/// Questa schermata la vede **una casa sola al mondo** — quella che nelle
/// opzioni del ponte ha la chiave della console — e nelle altre la voce del
/// menu non compare nemmeno.
///
/// Due viste e non una: l'elenco delle conversazioni, con quante cose ci sono
/// da leggere, e dentro una di quelle il filo con la casella per rispondere. I
/// fumetti sono gli stessi dell'Assistenza: e' la stessa conversazione, vista
/// dall'altra parte.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/console.dart';
import '../casa/segnalazioni.dart' show Messaggio, spiegaLErrore;
import '../parole.dart';
import '../ponte/filo.dart';
import '../vestito/pezzi.dart';
import 'assistenza.dart' show FiloCadutoQui;
import 'segnalazioni.dart' show Conversazione;

/// Ogni quanto si riguarda la coda mentre si sta guardando.
///
/// Chi risponde tiene questa schermata aperta di fianco: una conversazione
/// nuova deve comparire da se', se no ci si accorge di una domanda il giorno
/// dopo. Dieci secondi e' quello che fa la stessa schermata nella plancia.
const _ogniQuanto = Duration(seconds: 10);

class SchermataDellaConsole extends StatefulWidget {
  const SchermataDellaConsole({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDellaConsole> createState() => _SchermataDellaConsoleState();
}

class _SchermataDellaConsoleState extends State<SchermataDellaConsole> {
  List<Linea> _coda = const [];
  Linea? _aperta;
  List<Messaggio> _filo = const [];
  bool _caricando = false;
  bool _letta = false;
  String? _perche;
  Timer? _giro;

  Filo? get _presa {
    final filo = widget.collegamento.filo;
    return filo != null && filo.dentro ? filo : null;
  }

  @override
  void initState() {
    super.initState();
    _carica();
    _giro = Timer.periodic(_ogniQuanto, (_) => _unGiro());
  }

  @override
  void dispose() {
    _giro?.cancel();
    super.dispose();
  }

  /* Il giro dei dieci secondi.
   *
   * Si salta quando si sta gia' caricando e quando il filo e' giu': una
   * richiesta che non puo' partire non serve a nessuno, e due giri
   * sovrapposti si scriverebbero addosso. Con una conversazione aperta si
   * rilegge quella — e' li' che si sta guardando — e l'elenco viene dietro. */
  Future<void> _unGiro() async {
    if (!mounted || _caricando || _presa == null) return;
    if (_aperta != null) {
      await _rileggiIlFilo();
      return;
    }
    await _carica();
  }

  @override
  void didUpdateWidget(SchermataDellaConsole vecchia) {
    super.didUpdateWidget(vecchia);
    if (!_letta && !_caricando && _presa != null) _carica();
  }

  Future<void> _carica() async {
    final filo = _presa;
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
    try {
      final coda = await LaConsole(filo).coda();
      if (!mounted) return;
      setState(() {
        _coda = coda;
        _letta = true;
        /* La linea aperta si ricarica dall'elenco nuovo: il conto dei non
         * letti e l'ultima riga cambiano mentre si sta leggendo. */
        final aperta = _aperta;
        if (aperta != null) {
          final ancora = coda.where((una) => una.id == aperta.id);
          _aperta = ancora.isEmpty ? null : ancora.first;
        }
      });
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    } finally {
      if (mounted) setState(() => _caricando = false);
    }
  }

  Future<void> _apri(Linea quale) async {
    final filo = _presa;
    if (filo == null) return;
    setState(() {
      _aperta = quale;
      _filo = const [];
      _perche = null;
    });
    await _rileggiIlFilo();
  }

  Future<void> _rileggiIlFilo() async {
    final filo = _presa;
    final aperta = _aperta;
    if (filo == null || aperta == null) return;
    try {
      final righe = await LaConsole(filo).apri(aperta.id);
      if (mounted) setState(() => _filo = righe);
      /* Aperta vuol dire letta: il conto dei non letti lo tiene il centralino,
       * e si aggiorna quando si richiede l'elenco. */
      await _carica();
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    }
  }

  Future<void> _rispondi(String testo) async {
    final filo = _presa;
    final aperta = _aperta;
    if (filo == null) throw const FiloCadutoQui();
    if (aperta == null) return;
    await LaConsole(filo).rispondi(aperta.id, testo);
    await _rileggiIlFilo();
  }

  Future<void> _butta(Linea quale) async {
    final filo = _presa;
    if (filo == null) return;
    final sicuro = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          inLingua(
            it: 'Buttare questa conversazione?',
            en: 'Throw this conversation away?',
          ),
        ),
        content: Text(
          inLingua(
            it:
                'Sparisce dal centralino e con lei quello che vi siete detti '
                '— anche dalla plancia di ${quale.comeSiChiama}. Non si '
                'rimette a posto.',
            en:
                'It disappears from the relay, and with it everything you '
                'said to each other — from ${quale.comeSiChiama}\'s '
                'dashboard as well. There is no putting it back.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(inLingua(it: 'Lascia stare', en: 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(inLingua(it: 'Butta via', en: 'Throw away')),
          ),
        ],
      ),
    );
    if (sicuro != true) return;
    try {
      await LaConsole(filo).butta(quale.id);
      if (mounted && _aperta?.id == quale.id) {
        setState(() {
          _aperta = null;
          _filo = const [];
        });
      }
      await _carica();
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_letta && _caricando) {
      return const Center(child: CircularProgressIndicator());
    }
    final aperta = _aperta;
    if (aperta != null) return _ilFilo(context, aperta);
    return _lElenco(context);
  }

  /* ─── L'elenco ─────────────────────────────────────────────────────────── */

  Widget _lElenco(BuildContext context) {
    if (_coda.isEmpty) {
      return RefreshIndicator(
        onRefresh: _carica,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 96),
          children: [
            StatoVuoto(
              dentroUnaLista: true,
              icona: _perche == null
                  ? Icons.mark_email_read_outlined
                  : Icons.cloud_off_rounded,
              titolo: _perche == null
                  ? inLingua(it: 'Nessuno ha scritto', en: 'Nobody has written')
                  : inLingua(
                      it: 'La coda non arriva',
                      en: 'The queue isn\'t arriving',
                    ),
              sotto:
                  _perche ??
                  inLingua(
                    it:
                        'Qui arrivano le richieste di aiuto di tutte le case. '
                        'Quando qualcuno scrive dalla sua Assistenza, la '
                        'conversazione compare in questo elenco.',
                    en:
                        'This is where help requests from every home arrive. '
                        'When someone writes from their Support, the '
                        'conversation shows up in this list.',
                  ),
              azione: FilledButton.tonalIcon(
                onPressed: _carica,
                icon: const Icon(Icons.refresh_rounded),
                label: Text(inLingua(it: 'Riguarda', en: 'Refresh')),
              ),
            ),
          ],
        ),
      );
    }
    final daLeggere = _coda.fold<int>(0, (conto, una) => conto + una.nonLetti);
    return RefreshIndicator(
      onRefresh: _carica,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          if (_perche != null) ...[
            _UnGuaio(_perche!),
            const SizedBox(height: 12),
          ],
          Insegna(
            daLeggere > 0
                ? inLingua(
                    it: 'Conversazioni · $daLeggere da leggere',
                    en: 'Conversations · $daLeggere unread',
                  )
                : inLingua(it: 'Conversazioni', en: 'Conversations'),
            azione: IconButton(
              tooltip: inLingua(it: 'Riguarda', en: 'Refresh'),
              onPressed: _carica,
              icon: const Icon(Icons.refresh_rounded),
            ),
          ),
          for (final una in _coda) ...[
            _UnaLinea(
              linea: una,
              apri: () => _apri(una),
              butta: () => _butta(una),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }

  /* ─── Il filo ──────────────────────────────────────────────────────────── */

  Widget _ilFilo(BuildContext context, Linea aperta) {
    return Conversazione(
      messaggi: _filo,
      perche: _perche,
      /* Senza puntini: il nome di una linea senza nome finisce gia' con i
       * suoi, e «casa_22813813……» non e' un suggerimento, e' un inciampo. */
      suggerimento: inLingua(
        it: 'Rispondi a ${aperta.comeSiChiama}',
        en: 'Reply to ${aperta.comeSiChiama}',
      ),
      /* Da questa parte l'altro non e' chi fa l'app: e' la casa che ha
       * chiesto aiuto. */
      laltro: aperta.comeSiChiama,
      intestazione: Row(
        children: [
          Expanded(
            child: Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => setState(() {
                  _aperta = null;
                  _filo = const [];
                  _perche = null;
                }),
                icon: const Icon(Icons.arrow_back_rounded),
                label: Text(
                  inLingua(
                    it: 'Tutte le conversazioni',
                    en: 'All conversations',
                  ),
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: inLingua(it: 'Butta via', en: 'Throw away'),
            onPressed: () => _butta(aperta),
            icon: const Icon(Icons.delete_outline_rounded),
          ),
        ],
      ),
      vuota: StatoVuoto(
        dentroUnaLista: true,
        icona: Icons.forum_outlined,
        titolo: aperta.comeSiChiama,
        sotto: aperta.note.isEmpty
            ? inLingua(
                it: 'Questa conversazione è vuota.',
                en: 'This conversation is empty.',
              )
            : inLingua(
                it: 'Questa conversazione è vuota. ${aperta.note}',
                en: 'This conversation is empty. ${aperta.note}',
              ),
      ),
      manda: _rispondi,
      rileggi: _rileggiIlFilo,
    );
  }
}

/// Una riga dell'elenco: chi ha scritto, quanto c'e' da leggere, l'ultima cosa
/// detta, e le note che sono arrivate con lei.
class _UnaLinea extends StatelessWidget {
  const _UnaLinea({
    required this.linea,
    required this.apri,
    required this.butta,
  });

  final Linea linea;
  final VoidCallback apri;
  final VoidCallback butta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scheda(
      quandoPremuta: apri,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        linea.comeSiChiama,
                        style: testi.titleMedium,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (linea.nonLetti > 0) _Pallino(linea.nonLetti),
                  ],
                ),
                if (linea.ultimo.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    linea.ultimo,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: testi.bodyMedium?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ],
                if (linea.note.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    linea.note,
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
          IconButton(
            tooltip: inLingua(it: 'Butta via', en: 'Throw away'),
            onPressed: butta,
            icon: const Icon(Icons.delete_outline_rounded),
          ),
        ],
      ),
    );
  }
}

/// Quante cose ci sono da leggere su questa linea.
class _Pallino extends StatelessWidget {
  const _Pallino(this.quante);
  final int quante;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(left: 8),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: colori.primary,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$quante',
        style: Theme.of(context).textTheme.labelSmall
            ?.copyWith(color: colori.onPrimary),
      ),
    );
  }
}

/// Il guasto si dice **accanto** alle conversazioni, non al posto loro: quelle
/// che c'erano si vedono ancora.
class _UnGuaio extends StatelessWidget {
  const _UnGuaio(this.perche);
  final String perche;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Scheda(
      child: Row(
        children: [
          Icon(Icons.cloud_off_rounded, color: colori.onSurfaceVariant),
          const SizedBox(width: 12),
          Expanded(child: Text(perche)),
        ],
      ),
    );
  }
}
