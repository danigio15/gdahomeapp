/// I comandi rapidi in auto: quali, in che ordine, e quale proporre arrivando.
///
/// Si apre dal menu del navigatore (gdanav, dentro l'app). In cima come si
/// vedranno in macchina, dietro il tasto con la casa sulla mappa; sotto
/// quelli scelti, fino a [comandiAlMassimo], da spostare tenendo premuto e da
/// toccare per cambiarli. Poi da dove si prendono:
///
///  - **crearne uno**: un dispositivo di casa, cosa fargli fare (aprire,
///    chiudere, accendere…), il nome da leggere in auto e se chiedere
///    conferma;
///  - le **azioni rapide della plancia**, tutte, lette dalla sua
///    configurazione — con quelle che in auto non possono andare scritte in
///    grigio col perche';
///  - le **cose di casa** che si premono, con una ricerca.
///
/// In fondo, il comando da proporre a 500 metri da casa. Ogni cambiamento si
/// scrive subito: in macchina si trova quello che c'e' adesso, senza un
/// «Salva» da ricordarsi.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../auto/i_comandi.dart';
import '../auto/qui.dart' as auto;
import '../casa/collegamento.dart';
import '../casa/entita.dart';
import '../parole.dart';
import '../vestito/oggetti.dart';

/// Il disegno della plancia per ogni genere di comando.
String disegnoDelComando(GenereDelComando genere) => switch (genere) {
  GenereDelComando.varco => 'varchi',
  GenereDelComando.porta => 'aperture',
  GenereDelComando.luce => 'luci',
  GenereDelComando.presa => 'prese',
  GenereDelComando.scena => 'evidenza',
  GenereDelComando.serratura => 'sicurezza',
  GenereDelComando.azione => 'azioni',
};

/// Cosa fa un comando, in parole: «Apri o chiudi», «Accendi», «Attiva».
String cosaFa(ComandoRapido c) {
  final d = c.ricetta.dominio;
  final voce = c.ricetta.dati['option'];
  return switch (c.ricetta.servizio) {
    'toggle' when d == 'cover' => 'Apri o chiudi',
    'toggle' => 'Accendi o spegni',
    secondoLoStato when d == 'media_player' => 'Play o pausa',
    secondoLoStato => 'Apri o chiudi',
    'open_cover' || 'unlock' => 'Apri',
    'close_cover' || 'lock' => 'Chiudi',
    'turn_on' when d == 'scene' || d == 'script' => 'Attiva',
    'turn_on' => 'Accendi',
    'turn_off' => 'Spegni',
    'press' => 'Premi',
    'select_option' => voce is String ? 'Metti «$voce»' : 'Scegli',
    final altro => altro,
  };
}

/// «300 m», «1 km», «1,5 km».
String laDistanza(int metri) {
  if (metri < 1000) return '$metri m';
  final km = metri / 1000;
  return '${km == km.roundToDouble() ? km.round() : km.toString().replaceAll('.', ',')} km';
}

/// Le azioni rapide della plancia, dalla sua configurazione nel ponte: tutte,
/// non solo le sei della fotografia per l'auto. Senza casa collegata, quelle
/// della fotografia.
Future<AzioniDellaPlancia> leAzioniDallaPlancia(
  Collegamento? collegamento,
) async {
  final filo = collegamento?.filo;
  if (collegamento != null && filo != null && collegamento.dentro) {
    try {
      final profilo = collegamento.planciaScelta;
      final risposta = await filo.risultato({
        'type': 'dashboardmodern/config/get',
        'profile': profilo.isEmpty ? 'primary' : profilo,
      });
      final valori = risposta is Map ? risposta['snapshot'] : null;
      if (valori is Map && valori['values'] is Map) {
        final stato = collegamento.stato;
        return leAzioniDellaConfigurazione(
          Map<String, dynamic>.from(valori['values'] as Map),
          entita: stato == null ? null : (id) => stato[id],
        );
      }
    } catch (_) {
      /* Il ponte non ha risposto: si ripiega sulla fotografia. */
    }
  }
  return AzioniDellaPlancia(await auto.leAzioniRapide());
}

class ComandiInAuto extends StatefulWidget {
  const ComandiInAuto({
    super.key,
    this.collegamento,
    this.leggi = auto.leggiIComandiSeCi,
    this.scrivi = auto.scriviIComandi,
    this.azioni,
    this.entita,
  });

  /// La casa: le sue entita' sono i comandi che si possono aggiungere.
  final Collegamento? collegamento;

  /// Sostituibili nelle prove, dove un disco e un ponte non ci sono.
  final Future<IComandiScelti?> Function() leggi;
  final Future<bool> Function(IComandiScelti) scrivi;
  final Future<AzioniDellaPlancia> Function()? azioni;

  /// Le entita' di casa, se non vengono dal [collegamento] (nelle prove).
  final List<Entita>? entita;

  @override
  State<ComandiInAuto> createState() => _ComandiInAutoState();
}

class _ComandiInAutoState extends State<ComandiInAuto> {
  IComandiScelti? _scelti;
  AzioniDellaPlancia _azioni = const AzioniDellaPlancia([]);
  String _cerca = '';

  @override
  void initState() {
    super.initState();
    unawaited(_carica());
  }

  List<Entita> get _tutte =>
      widget.entita ?? widget.collegamento?.stato?.tutte() ?? const [];

  List<ComandoRapido> get _dellaCasa => iComandiDellaCasa(_tutte);

  Future<void> _carica() async {
    await widget.collegamento?.serveLaCasa();
    final azioni =
        await (widget.azioni?.call() ??
            leAzioniDallaPlancia(widget.collegamento));
    var scelti = await widget.leggi();
    /* La prima volta non si parte da una pagina vuota: le azioni rapide
     * della plancia, e il cancello e il garage. Si scrive subito, cosi' in
     * macchina ci sono gia'. */
    if (scelti == null) {
      scelti = iPrimiComandi(azioni: azioni.comandi, dellaCasa: _dellaCasa);
      await widget.scrivi(scelti);
    }
    if (!mounted) return;
    setState(() {
      _azioni = azioni;
      _scelti = scelti;
    });
  }

  void _cambia(IComandiScelti nuovi) {
    setState(() => _scelti = nuovi);
    unawaited(widget.scrivi(nuovi));
  }

  void _togli(ComandoRapido c) {
    final s = _scelti!;
    final comandi = [...s.comandi]..removeWhere((x) => x.id == c.id);
    _cambia(
      IComandiScelti(
        comandi: comandi,
        allArrivo: s.allArrivo == c.id ? null : s.allArrivo,
        metri: s.metri,
      ),
    );
  }

  bool _siPuoMettere() {
    if (_scelti!.comandi.length < comandiAlMassimo) return true;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          inLingua(
            it: 'Ne stanno $comandiAlMassimo: togline uno prima.',
            en: 'Only $comandiAlMassimo fit: remove one first.',
          ),
        ),
      ),
    );
    return false;
  }

  void _metti(ComandoRapido c) {
    if (!_siPuoMettere()) return;
    final s = _scelti!;
    if (s.comandi.any((x) => x.id == c.id)) return;
    _cambia(s.con(comandi: [...s.comandi, c]));
  }

  void _mettiTutte(List<ComandoRapido> quali) {
    final s = _scelti!;
    final gia = {for (final c in s.comandi) c.id};
    final nuove = [...s.comandi, ...quali.where((c) => !gia.contains(c.id))];
    final entrano = nuove.take(comandiAlMassimo).toList();
    _cambia(s.con(comandi: entrano));
    if (entrano.length < nuove.length) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            inLingua(
              it:
                  'Aggiunte fino a $comandiAlMassimo: '
                  '${nuove.length - entrano.length} restano fuori.',
              en:
                  'Added up to $comandiAlMassimo: '
                  '${nuove.length - entrano.length} left out.',
            ),
          ),
        ),
      );
    }
  }

  void _sostituisci(ComandoRapido vecchio, ComandoRapido nuovo) {
    final s = _scelti!;
    _cambia(
      s.con(
        comandi: [for (final c in s.comandi) c.id == vecchio.id ? nuovo : c],
      ),
    );
  }

  void _sposta(int da, int a) {
    final comandi = [..._scelti!.comandi];
    comandi.insert(a, comandi.removeAt(da));
    _cambia(_scelti!.con(comandi: comandi));
  }

  Future<void> _crea() async {
    if (!_siPuoMettere()) return;
    final entita = _tutte.where(siPuoComandare).toList()
      ..sort((a, b) => a.nome.toLowerCase().compareTo(b.nome.toLowerCase()));
    final nuovo = await showModalBottomSheet<ComandoRapido>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => _NuovoComando(entita: entita),
    );
    if (nuovo != null) _metti(nuovo);
  }

  Future<void> _modifica(ComandoRapido c) async {
    final esito = await showModalBottomSheet<({ComandoRapido? comando})>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => _CambiaComando(comando: c),
    );
    if (esito == null) return;
    final nuovo = esito.comando;
    if (nuovo == null) {
      _togli(c);
    } else {
      _sostituisci(c, nuovo);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scelti = _scelti;
    final colori = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          inLingua(it: 'Comandi rapidi in auto', en: 'Quick commands in car'),
        ),
      ),
      floatingActionButton: scelti == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _crea,
              icon: const Icon(Icons.add_rounded),
              label: Text(inLingua(it: 'Crea un comando', en: 'New command')),
            ),
      body: scelti == null
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                SliverToBoxAdapter(child: _ComeInAuto(scelti: scelti)),
                SliverToBoxAdapter(
                  child: _Testata(
                    inLingua(it: 'I tuoi comandi', en: 'Your commands'),
                    destra: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Text(
                        '${scelti.comandi.length} / $comandiAlMassimo',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: colori.primary,
                        ),
                      ),
                    ),
                  ),
                ),
                if (scelti.comandi.isEmpty)
                  const SliverToBoxAdapter(child: _Vuoto())
                else
                  SliverReorderableList(
                    itemCount: scelti.comandi.length,
                    onReorderItem: _sposta,
                    itemBuilder: (context, i) {
                      final c = scelti.comandi[i];
                      return ReorderableDelayedDragStartListener(
                        key: ValueKey(c.id),
                        index: i,
                        child: _Riga(
                          comando: c,
                          posto: i + 1,
                          maniglia: ReorderableDragStartListener(
                            index: i,
                            child: const Icon(Icons.drag_indicator_rounded),
                          ),
                          tocca: () => _modifica(c),
                          tasto: IconButton(
                            tooltip: inLingua(it: 'Togli', en: 'Remove'),
                            icon: const Icon(Icons.remove_circle_outline),
                            onPressed: () => _togli(c),
                          ),
                        ),
                      );
                    },
                  ),
                if (scelti.comandi.isNotEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 6, 20, 0),
                      child: Text(
                        inLingua(
                          it:
                              'Tocca un comando per cambiare nome o conferma, '
                              'tieni premuto per spostarlo. I primi '
                              '$comandiSempreInVista si vedono su ogni auto.',
                          en:
                              'Tap a command to rename it, long-press to '
                              'move it. The first $comandiSempreInVista '
                              'show on every car.',
                        ),
                        style: TextStyle(
                          fontSize: 12.5,
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                SliverToBoxAdapter(child: _arrivo(scelti)),
                ..._dallaPlancia(scelti),
                ..._dallaCasa(scelti),
                const SliverToBoxAdapter(child: SizedBox(height: 96)),
              ],
            ),
    );
  }

  Widget _arrivo(IComandiScelti scelti) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 0),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.near_me_rounded, size: 18, color: colori.primary),
                  const SizedBox(width: 8),
                  Text(
                    inLingua(it: 'Quasi a casa', en: 'Almost home'),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                inLingua(
                  it:
                      'Arrivando, lo schermo dell\'auto ti propone un '
                      'comando: «Apro il cancello?»',
                  en:
                      'When you arrive, the car screen offers a command: '
                      '"Open the gate?"',
                ),
                style: TextStyle(color: colori.onSurfaceVariant),
              ),
              const SizedBox(height: 8),
              DropdownButton<String?>(
                isExpanded: true,
                value: scelti.allArrivo,
                items: [
                  DropdownMenuItem<String?>(
                    child: Text(
                      inLingua(it: 'Non proporre niente', en: 'Nothing'),
                    ),
                  ),
                  for (final c in scelti.comandi)
                    DropdownMenuItem<String?>(value: c.id, child: Text(c.nome)),
                ],
                onChanged: (id) => _cambia(
                  id == null ? scelti.senzaArrivo() : scelti.con(allArrivo: id),
                ),
              ),
              if (scelti.allArrivo != null) ...[
                const SizedBox(height: 12),
                Text(
                  inLingua(
                    it: 'Quanto prima di arrivare',
                    en: 'How far before arriving',
                  ),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final m in metriFraCuiScegliere)
                      ChoiceChip(
                        label: Text(laDistanza(m)),
                        selected: scelti.metri == m,
                        onSelected: (_) => _cambia(scelti.con(metri: m)),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  inLingua(
                    it:
                        'Si propone una volta per arrivo, dopo essere stati '
                        'più lontani.',
                    en: 'Offered once per arrival, after being further away.',
                  ),
                  style: TextStyle(
                    fontSize: 12.5,
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _dallaPlancia(IComandiScelti scelti) {
    final gia = {for (final c in scelti.comandi) c.id};
    final tutte = _azioni.comandi;
    final mancano = tutte.where((c) => !gia.contains(c.id)).toList();
    final fuori = _azioni.soloNellaPlancia;
    if (tutte.isEmpty && fuori.isEmpty) return const [];
    final colori = Theme.of(context).colorScheme;
    return [
      SliverToBoxAdapter(
        child: _Testata(
          inLingua(
            it: 'Azioni rapide della plancia',
            en: 'Dashboard quick actions',
          ),
          destra: mancano.isEmpty
              ? Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Text(
                    inLingua(it: 'Tutte aggiunte', en: 'All added'),
                    style: TextStyle(color: colori.onSurfaceVariant),
                  ),
                )
              : TextButton.icon(
                  onPressed: () => _mettiTutte(mancano),
                  icon: const Icon(Icons.playlist_add_rounded),
                  label: Text(
                    inLingua(
                      it: 'Aggiungi tutte (${mancano.length})',
                      en: 'Add all (${mancano.length})',
                    ),
                  ),
                ),
        ),
      ),
      SliverList.list(
        children: [
          for (final c in tutte)
            _Riga(
              comando: c,
              tasto: gia.contains(c.id)
                  ? Padding(
                      padding: const EdgeInsets.all(12),
                      child: Icon(
                        Icons.check_circle_rounded,
                        color: colori.primary,
                      ),
                    )
                  : IconButton(
                      tooltip: inLingua(it: 'Aggiungi', en: 'Add'),
                      icon: const Icon(Icons.add_circle_outline),
                      onPressed: () => _metti(c),
                    ),
              tocca: gia.contains(c.id) ? null : () => _metti(c),
            ),
          for (final f in fuori)
            ListTile(
              enabled: false,
              contentPadding: const EdgeInsets.only(left: 36, right: 16),
              leading: const Icon(Icons.block_rounded),
              title: Text(f.nome),
              subtitle: Text(
                inLingua(
                  it: 'Solo nella plancia: ${f.perche.toLowerCase()}',
                  en: 'Dashboard only: ${f.perche.toLowerCase()}',
                ),
              ),
            ),
        ],
      ),
    ];
  }

  List<Widget> _dallaCasa(IComandiScelti scelti) {
    final tutte = _dellaCasa;
    if (tutte.isEmpty) return const [];
    final gia = {for (final c in scelti.comandi) c.id};
    final fatti = {for (final c in scelti.comandi) c.impronta};
    final cerca = _cerca.trim().toLowerCase();
    final casa = tutte
        .where(
          (c) =>
              !gia.contains(c.id) &&
              !fatti.contains(c.impronta) &&
              (cerca.isEmpty ||
                  c.nome.toLowerCase().contains(cerca) ||
                  c.provenienza.toLowerCase().contains(cerca)),
        )
        .toList();
    return [
      SliverToBoxAdapter(
        child: _Testata(inLingua(it: 'Dalla casa', en: 'From your home')),
      ),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
          child: TextField(
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search_rounded),
              hintText: inLingua(
                it: 'Cerca: cancello, luci, scena…',
                en: 'Search: gate, lights, scene…',
              ),
            ),
            onChanged: (t) => setState(() => _cerca = t),
          ),
        ),
      ),
      SliverList.list(
        children: [
          for (final c in casa.take(60))
            _Riga(
              comando: c,
              tasto: IconButton(
                tooltip: inLingua(it: 'Aggiungi', en: 'Add'),
                icon: const Icon(Icons.add_circle_outline),
                onPressed: () => _metti(c),
              ),
              tocca: () => _metti(c),
            ),
        ],
      ),
    ];
  }
}

/// In cima: come si vedranno in macchina, dietro il tasto con la casa.
class _ComeInAuto extends StatelessWidget {
  const _ComeInAuto({required this.scelti});

  final IComandiScelti scelti;

  @override
  Widget build(BuildContext context) {
    final inVista = scelti.comandi.take(comandiSempreInVista).toList();
    final altri = scelti.comandi.length - inVista.length;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
        ),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.home_rounded,
                  size: 18,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  inLingua(
                    it: 'In auto: tocca la casa sulla mappa',
                    en: 'In the car: tap the house on the map',
                  ),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (inVista.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 18),
              child: Center(
                child: Text(
                  inLingua(it: 'Ancora nessun tasto', en: 'No buttons yet'),
                  style: const TextStyle(color: Colors.white60),
                ),
              ),
            )
          else
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: EdgeInsets.zero,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.25,
              children: [
                for (final c in inVista)
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Oggetto(disegnoDelComando(c.genere), lato: 26),
                        const SizedBox(height: 6),
                        Text(
                          c.nome,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          if (altri > 0) ...[
            const SizedBox(height: 8),
            Text(
              inLingua(
                it: '+ $altri sugli schermi più grandi',
                en: '+ $altri on larger screens',
              ),
              style: const TextStyle(color: Colors.white60, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _Vuoto extends StatelessWidget {
  const _Vuoto();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 4, 20, 4),
    child: Text(
      inLingua(
        it:
            'Nessun comando. Creane uno col tasto «Crea un comando», o '
            'aggiungi qui sotto le azioni rapide della plancia.',
        en:
            'No commands. Create one with «New command», or add the '
            'dashboard quick actions below.',
      ),
    ),
  );
}

class _Testata extends StatelessWidget {
  const _Testata(this.testo, {this.destra});

  final String testo;
  final Widget? destra;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 18, 8, 4),
    child: SizedBox(
      height: 40,
      child: Row(
        children: [
          Expanded(
            child: Text(
              testo.toUpperCase(),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          ?destra,
        ],
      ),
    ),
  );
}

class _Riga extends StatelessWidget {
  const _Riga({
    required this.comando,
    required this.tasto,
    this.tocca,
    this.maniglia,
    this.posto,
  });

  final ComandoRapido comando;
  final Widget tasto;
  final VoidCallback? tocca;
  final Widget? maniglia;

  /// Il numero del tasto in auto, per quelli scelti.
  final int? posto;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return ListTile(
      contentPadding: const EdgeInsets.only(left: 8, right: 4),
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 28,
            child: IconTheme(
              data: IconThemeData(color: colori.outline),
              child: maniglia ?? const SizedBox.shrink(),
            ),
          ),
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colori.surfaceContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Oggetto(disegnoDelComando(comando.genere), lato: 24),
              ),
              if (posto case final n?)
                Positioned(
                  right: -4,
                  top: -4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 5,
                      vertical: 1,
                    ),
                    decoration: BoxDecoration(
                      color: n <= comandiSempreInVista
                          ? colori.primary
                          : colori.outline,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '$n',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: colori.onPrimary,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      title: Text(
        comando.nome,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        [
          cosaFa(comando),
          /* «Cancello · Cancello» non dice niente due volte. */
          if (comando.provenienza != comando.nome) comando.provenienza,
          if (comando.conferma)
            inLingua(it: 'chiede conferma', en: 'asks to confirm'),
        ].where((t) => t.isNotEmpty).join(' · '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: tasto,
      onTap: tocca,
    );
  }
}

/// Creare un comando: quale dispositivo, cosa fargli fare, come chiamarlo.
class _NuovoComando extends StatefulWidget {
  const _NuovoComando({required this.entita});

  final List<Entita> entita;

  @override
  State<_NuovoComando> createState() => _NuovoComandoState();
}

class _NuovoComandoState extends State<_NuovoComando> {
  Entita? _quale;
  int _cosa = 0;
  bool _conferma = false;
  String _cerca = '';
  final _nome = TextEditingController();

  @override
  void dispose() {
    _nome.dispose();
    super.dispose();
  }

  void _scegli(Entita e) => setState(() {
    _quale = e;
    _cosa = 0;
    _conferma = e.dominio == 'lock';
    _nome.text = e.nome;
  });

  @override
  Widget build(BuildContext context) {
    final alto = MediaQuery.sizeOf(context).height * 0.8;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: alto,
        child: switch (_quale) {
          final e? => _ilComando(e),
          null => _ilDispositivo(),
        },
      ),
    );
  }

  Widget _ilDispositivo() {
    final colori = Theme.of(context).colorScheme;
    final cerca = _cerca.trim().toLowerCase();
    final quali = widget.entita
        .where(
          (e) =>
              cerca.isEmpty ||
              e.nome.toLowerCase().contains(cerca) ||
              e.id.toLowerCase().contains(cerca),
        )
        .take(80)
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 2),
          child: Text(
            inLingua(it: 'Nuovo comando', en: 'New command'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
          child: Text(
            inLingua(
              it: '1 di 2 · Quale dispositivo?',
              en: '1 of 2 · Which device?',
            ),
            style: TextStyle(color: colori.onSurfaceVariant),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search_rounded),
              hintText: inLingua(it: 'Cerca', en: 'Search'),
            ),
            onChanged: (t) => setState(() => _cerca = t),
          ),
        ),
        Expanded(
          child: widget.entita.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      inLingua(
                        it: 'Collega la casa per vedere i dispositivi.',
                        en: 'Connect your home to see the devices.',
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : ListView(
                  children: [
                    for (final e in quali)
                      ListTile(
                        leading: Oggetto(
                          disegnoDelComando(
                            comandoPer(e)?.genere ?? GenereDelComando.azione,
                          ),
                          lato: 24,
                        ),
                        title: Text(e.nome),
                        subtitle: Text(e.id),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => _scegli(e),
                      ),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _ilComando(Entita e) {
    final scelte = cosaSiPuoFare(e);
    final cosa = scelte[_cosa.clamp(0, scelte.length - 1)];
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 0, 20, 20),
      children: [
        Row(
          children: [
            IconButton(
              tooltip: inLingua(it: 'Indietro', en: 'Back'),
              onPressed: () => setState(() => _quale = null),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            Expanded(
              child: Text(
                inLingua(it: '2 di 2 · ${e.nome}', en: '2 of 2 · ${e.nome}'),
                style: Theme.of(context).textTheme.titleMedium,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(left: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              Text(
                inLingua(it: 'Cosa fa', en: 'What it does'),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final (i, s) in scelte.indexed)
                    ChoiceChip(
                      label: Text(s.titolo),
                      selected: i == _cosa,
                      onSelected: (_) => setState(() => _cosa = i),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _nome,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  labelText: inLingua(
                    it: 'Nome sul tasto in auto',
                    en: 'Name on the car button',
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  inLingua(
                    it: 'Chiedi conferma in auto',
                    en: 'Confirm in the car',
                  ),
                ),
                subtitle: Text(
                  inLingua(
                    it: '«Sei sicuro?» prima di farlo',
                    en: '"Are you sure?" first',
                  ),
                ),
                value: _conferma,
                onChanged: (v) => setState(() => _conferma = v),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => Navigator.of(context).pop(
                  comandoFatto(
                    entita: e,
                    nome: _nome.text,
                    servizio: cosa.servizio,
                    dati: cosa.dati,
                    conferma: _conferma,
                  ),
                ),
                icon: const Icon(Icons.add_rounded),
                label: Text(inLingua(it: 'Aggiungi in auto', en: 'Add to car')),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Cambiare un comando scelto: il nome, la conferma, o toglierlo.
class _CambiaComando extends StatefulWidget {
  const _CambiaComando({required this.comando});

  final ComandoRapido comando;

  @override
  State<_CambiaComando> createState() => _CambiaComandoState();
}

class _CambiaComandoState extends State<_CambiaComando> {
  late final _nome = TextEditingController(text: widget.comando.nome);
  late bool _conferma = widget.comando.conferma;

  @override
  void dispose() {
    _nome.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.comando;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(c.nome, style: Theme.of(context).textTheme.titleLarge),
          Text(
            '${cosaFa(c)} · ${c.ricetta.entita}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nome,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: inLingua(
                it: 'Nome sul tasto in auto',
                en: 'Name on the car button',
              ),
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              inLingua(it: 'Chiedi conferma in auto', en: 'Confirm in the car'),
            ),
            value: _conferma,
            onChanged: (v) => setState(() => _conferma = v),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              TextButton.icon(
                onPressed: () => Navigator.of(context).pop((comando: null)),
                icon: const Icon(Icons.delete_outline_rounded),
                label: Text(inLingua(it: 'Togli', en: 'Remove')),
              ),
              const Spacer(),
              FilledButton(
                onPressed: () => Navigator.of(context).pop((
                  comando: c.cambiato(nome: _nome.text, conferma: _conferma),
                )),
                child: Text(inLingua(it: 'Salva', en: 'Save')),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
