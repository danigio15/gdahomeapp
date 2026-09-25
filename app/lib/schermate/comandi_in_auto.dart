/// I comandi rapidi in auto: quali, in che ordine, e quale proporre arrivando.
///
/// Si apre dal menu del navigatore (gdanav, dentro l'app). Sopra quelli scelti,
/// fino a sei, da spostare tenendo premuto; sotto quelli che si possono
/// aggiungere — le azioni rapide della plancia e le cose di casa che si
/// premono — con una ricerca, perche' in una casa vera sono decine. In fondo,
/// il comando da proporre a 500 metri da casa.
///
/// Ogni cambiamento si scrive subito: in macchina si trova quello che c'e'
/// adesso, senza un «Salva» da ricordarsi.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../auto/i_comandi.dart';
import '../auto/qui.dart' as auto;
import '../casa/collegamento.dart';
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

class ComandiInAuto extends StatefulWidget {
  const ComandiInAuto({
    super.key,
    this.collegamento,
    this.leggi = auto.leggiIComandiSeCi,
    this.scrivi = auto.scriviIComandi,
    this.azioni = auto.leAzioniRapide,
  });

  /// La casa: le sue entita' sono i comandi che si possono aggiungere.
  final Collegamento? collegamento;

  /// Sostituibili nelle prove, dove un disco non c'e'.
  final Future<IComandiScelti?> Function() leggi;
  final Future<bool> Function(IComandiScelti) scrivi;
  final Future<List<ComandoRapido>> Function() azioni;

  @override
  State<ComandiInAuto> createState() => _ComandiInAutoState();
}

class _ComandiInAutoState extends State<ComandiInAuto> {
  IComandiScelti? _scelti;
  List<ComandoRapido> _azioni = const [];
  String _cerca = '';

  @override
  void initState() {
    super.initState();
    unawaited(_carica());
  }

  List<ComandoRapido> get _dellaCasa =>
      iComandiDellaCasa(widget.collegamento?.stato?.tutte() ?? const []);

  Future<void> _carica() async {
    await widget.collegamento?.serveLaCasa();
    final azioni = await widget.azioni();
    var scelti = await widget.leggi();
    /* La prima volta non si parte da una pagina vuota: le azioni rapide
     * della plancia, e il cancello e il garage. Si scrive subito, cosi' in
     * macchina ci sono gia'. */
    if (scelti == null) {
      scelti = iPrimiComandi(azioni: azioni, dellaCasa: _dellaCasa);
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
      ),
    );
  }

  void _metti(ComandoRapido c) {
    final s = _scelti!;
    if (s.comandi.length >= comandiAlMassimo) {
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
      return;
    }
    _cambia(s.con(comandi: [...s.comandi, c]));
  }

  void _sposta(int da, int a) {
    final comandi = [..._scelti!.comandi];
    comandi.insert(a, comandi.removeAt(da));
    _cambia(_scelti!.con(comandi: comandi));
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final scelti = _scelti;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          inLingua(it: 'Comandi rapidi in auto', en: 'Quick commands in car'),
        ),
      ),
      body: scelti == null
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          inLingua(
                            it:
                                'Quelli dietro il tasto con la casa, sulla '
                                'mappa del navigatore in auto. Fino a '
                                '$comandiAlMassimo, in quest\'ordine: tieni '
                                'premuto e sposta.',
                            en:
                                'The ones behind the home button on the car '
                                'map. Up to $comandiAlMassimo, in this '
                                'order: long-press to move.',
                          ),
                          style: TextStyle(
                            color: colori.onSurfaceVariant,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          inLingua(
                            it:
                                '${scelti.comandi.length} di '
                                '$comandiAlMassimo scelti',
                            en:
                                '${scelti.comandi.length} of '
                                '$comandiAlMassimo chosen',
                          ),
                          style: TextStyle(
                            color: colori.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (scelti.comandi.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        inLingua(
                          it: 'Nessuno: aggiungili da qui sotto.',
                          en: 'None yet: add them from below.',
                        ),
                      ),
                    ),
                  )
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
                          scelto: true,
                          maniglia: ReorderableDragStartListener(
                            index: i,
                            child: const Icon(Icons.drag_indicator_rounded),
                          ),
                          cambia: (_) => _togli(c),
                        ),
                      );
                    },
                  ),
                SliverToBoxAdapter(child: _arrivo(scelti)),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
                    child: TextField(
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.search_rounded),
                        hintText: inLingua(
                          it: 'Cerca fra le azioni e le cose di casa',
                          en: 'Search actions and home devices',
                        ),
                      ),
                      onChanged: (t) => setState(() => _cerca = t),
                    ),
                  ),
                ),
                SliverList.list(children: _altri(scelti)),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
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
              Text(
                inLingua(it: 'Quasi a casa', en: 'Almost home'),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                inLingua(
                  it:
                      'A 500 m da Casa, lo schermo dell\'auto propone un '
                      'comando: «Apro il cancello?»',
                  en:
                      '500 m from Home, the car screen offers a command: '
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
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _altri(IComandiScelti scelti) {
    final gia = {for (final c in scelti.comandi) c.id};
    final cerca = _cerca.trim().toLowerCase();
    bool tiene(ComandoRapido c) =>
        !gia.contains(c.id) &&
        (cerca.isEmpty ||
            c.nome.toLowerCase().contains(cerca) ||
            c.provenienza.toLowerCase().contains(cerca));
    final azioni = _azioni.where(tiene).toList();
    final casa = _dellaCasa.where(tiene).toList();
    return [
      if (azioni.isNotEmpty) ...[
        _Titolo(
          inLingua(
            it: 'Azioni rapide della plancia',
            en: 'Dashboard quick actions',
          ),
        ),
        for (final c in azioni)
          _Riga(comando: c, scelto: false, cambia: (_) => _metti(c)),
      ],
      if (casa.isNotEmpty) ...[
        _Titolo(inLingua(it: 'Le cose di casa', en: 'Home devices')),
        for (final c in casa.take(60))
          _Riga(comando: c, scelto: false, cambia: (_) => _metti(c)),
      ],
    ];
  }
}

class _Titolo extends StatelessWidget {
  const _Titolo(this.testo);
  final String testo;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
    child: Text(
      testo.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: 1,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    ),
  );
}

class _Riga extends StatelessWidget {
  const _Riga({
    required this.comando,
    required this.scelto,
    required this.cambia,
    this.maniglia,
  });

  final ComandoRapido comando;
  final bool scelto;
  final ValueChanged<bool> cambia;
  final Widget? maniglia;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return ListTile(
      contentPadding: const EdgeInsets.only(left: 8, right: 8),
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
          comando.provenienza,
          if (comando.conferma)
            inLingua(it: 'chiede conferma', en: 'asks to confirm'),
        ].where((t) => t.isNotEmpty).join(' · '),
      ),
      trailing: Switch(value: scelto, onChanged: cambia),
      onTap: () => cambia(!scelto),
    );
  }
}
