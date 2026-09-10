/// Il cercatore di entita': lo stesso della plancia.
///
/// Stessa maschera e stesso comportamento di quella che si apre nella Config
/// della dashboard toccando la lente: il titolo, il campo di ricerca, la riga
/// che dice quante entita' ci sono e quante sono suggerite **per questo
/// campo**, le pastiglie dei domini col loro conto, le righe con nome,
/// identificativo e stato, e «Annulla» in fondo.
///
/// Chi indovina e' `casa/cerca/indice.dart`, che e' il porto in Dart
/// dell'indice della dashboard: le stesse regole, le stesse parole, gli stessi
/// punteggi. Cosi' la stessa casella propone le stesse cose sul telefono e nel
/// browser — se indovinasse in due modi diversi, una delle due sembrerebbe
/// sbagliata.
///
/// La lista si costruisce **a pezzi**: sessanta righe per volta, e le altre
/// arrivano scorrendo. Su una casa da tremila entita' costruirle tutte a ogni
/// lettera battuta e' la lista che resta indietro rispetto alla tastiera.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../../casa/cerca/indice.dart';
import '../../casa/collegamento.dart';
import '../../vestito/pezzi.dart';

/// Quante righe per pagina.
const _unaPagina = 60;

/// Quanto manca al fondo perche' si carichi la pagina dopo.
const _quandoManca = 240.0;

/// Quanto si aspetta prima di ricercare, dopo una lettera.
///
/// Non zero: chi scrive «temperatura» batte undici lettere in un secondo, e
/// undici giri su tremila entita' si vedono. Non troppo: sopra il decimo di
/// secondo la lista sembra pigra.
const _respiro = Duration(milliseconds: 90);

/// Apre il cercatore e restituisce l'identificativo scelto, o `null`.
Future<String?> cercaUnEntita(
  BuildContext contesto, {
  required Collegamento collegamento,
  String chiave = '',
  String etichetta = '',
  List<String> domini = const [],
  String adesso = '',
}) => showModalBottomSheet<String>(
  context: contesto,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (dentro) => _Cercatore(
    collegamento: collegamento,
    vuole: cosaVuole(
      chiave: chiave,
      etichetta: etichetta,
      domini: domini,
      adesso: adesso,
    ),
  ),
);

class _Cercatore extends StatefulWidget {
  const _Cercatore({required this.collegamento, required this.vuole});

  final Collegamento collegamento;
  final CosaVuole vuole;

  @override
  State<_Cercatore> createState() => _CercatoreState();
}

class _CercatoreState extends State<_Cercatore> {
  final _scorrimento = ScrollController();
  Timer? _aspetta;

  /* Le entita' della casa, preparate per essere cercate.
   *
   * Non sono `late final`: la prima volta che si apre una casella la casa
   * puo' non essere ancora arrivata — le entita' si leggono solo quando
   * qualcuno le chiede, e chiederle in una casa vera vuol dire un megabyte e
   * mezzo. Prima diceva «Nessuna entita'», che e' la risposta sbagliata alla
   * domanda giusta: non e' che non ce ne siano, e' che non sono ancora qui. */
  List<Cercabile> _tutte = const [];
  Map<String, int> _perDominio = const {};
  int _quanteSuggerite = 0;
  bool _stoLeggendo = false;
  StreamSubscription<void>? _ascolto;

  void _prendiLeEntita() {
    final casa = widget.collegamento.stato;
    final stanze = widget.collegamento.registroDelleStanze;
    _tutte = [
      for (final una in casa?.tutte() ?? const [])
        ?Cercabile.da(una, stanza: stanze.stanzaDi(una.id)),
    ];
    final conti = <String, int>{};
    for (final una in _tutte) {
      conti[una.dominio] = (conti[una.dominio] ?? 0) + 1;
    }
    _perDominio = conti;
    _quanteSuggerite = _tutte
        .where((una) => quantoCentra(una, widget.vuole).forte)
        .length;
    _soloLeSuggerite = _quanteSuggerite > 0;
  }

  String _scritto = '';
  String? _soloIlDominio;
  bool _soloLeSuggerite = false;
  List<Trovata> _trovate = const [];
  int _quante = _unaPagina;

  @override
  void initState() {
    super.initState();
    /* Si parte dalle suggerite quando ce ne sono: e' quello che fa la
     * dashboard, ed e' il motivo per cui il cercatore esiste — aprire una
     * casella e trovarci gia' dentro le tre entita' giuste, invece di
     * tremila in ordine alfabetico. */
    _prendiLeEntita();
    _ricerca();
    _scorrimento.addListener(_forseUnAltraPagina);
    /* Se la casa non e' ancora arrivata la si chiede adesso, e quando arriva
     * la lista si riempie da sola: chi ha aperto la casella non deve
     * chiuderla e riaprirla per vedere qualcosa. */
    if (_tutte.isEmpty) {
      _stoLeggendo = true;
      unawaited(widget.collegamento.serveLaCasa());
    }
    _ascolto = widget.collegamento.entitaCambiate.listen((_) {
      if (!mounted) return;
      final quante = _tutte.length;
      _prendiLeEntita();
      /* Solo quando **quali** entita' ci sono e' cambiato: un valore che
       * cambia dieci volte al secondo non deve rifare la ricerca sotto le
       * dita di chi sta scrivendo. */
      if (_tutte.length == quante && !_stoLeggendo) return;
      setState(() {
        _stoLeggendo = false;
        _ricerca();
      });
    });
  }

  @override
  void dispose() {
    _aspetta?.cancel();
    _ascolto?.cancel();
    _scorrimento.dispose();
    super.dispose();
  }

  void _forseUnAltraPagina() {
    if (!_scorrimento.hasClients) return;
    final manca =
        _scorrimento.position.maxScrollExtent - _scorrimento.position.pixels;
    if (manca > _quandoManca) return;
    if (_quante >= _trovate.length) return;
    setState(() => _quante += _unaPagina);
  }

  void _ricerca() {
    _trovate = cerca(
      _tutte,
      scritto: _scritto,
      vuole: widget.vuole,
      soloIlDominio: _soloIlDominio,
      soloLeSuggerite: _soloLeSuggerite,
    );
    _quante = _unaPagina;
    if (_scorrimento.hasClients) _scorrimento.jumpTo(0);
  }

  void _scrittoQualcosa(String cosa) {
    _scritto = cosa;
    _aspetta?.cancel();
    _aspetta = Timer(_respiro, () {
      if (!mounted) return;
      setState(_ricerca);
    });
  }

  void _pastiglia({String? dominio, bool? suggerite}) {
    setState(() {
      if (suggerite != null) {
        _soloLeSuggerite = suggerite;
        if (suggerite) _soloIlDominio = null;
      }
      if (dominio != null || suggerite == null) {
        _soloIlDominio = dominio;
        if (dominio != null) _soloLeSuggerite = false;
      }
      _ricerca();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    /* I domini piu' popolosi per primi, che sono quelli che uno filtra: sei
     * pastiglie ci stanno su una riga e mezza, e la settima non la guarda
     * nessuno. */
    final domini = _perDominio.entries.toList()
      ..sort((prima, dopo) {
        final quanto = dopo.value.compareTo(prima.value);
        return quanto != 0 ? quanto : prima.key.compareTo(dopo.key);
      });
    final daMostrare = _trovate.take(_quante).toList();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.82,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Row(
                children: [
                  const Text('🧩', style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 8),
                  Text(
                    'Scegli l\'entita\'',
                    style: Theme.of(context).textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                autofocus: true,
                onChanged: _scrittoQualcosa,
                decoration: const InputDecoration(
                  hintText: 'Cerca… (nome o entita\')',
                  prefixIcon: Icon(Icons.search_rounded),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${_tutte.length} entita\''
                      '${_quanteSuggerite > 0 ? ' · $_quanteSuggerite suggerite per questo campo' : ''}',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: colori.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                children: [
                  _Pastiglia(
                    testo: 'Tutte ${_tutte.length}',
                    accesa: _soloIlDominio == null && !_soloLeSuggerite,
                    premuta: () => _pastiglia(suggerite: false),
                  ),
                  if (_quanteSuggerite > 0)
                    _Pastiglia(
                      testo: '✨ Suggerite $_quanteSuggerite',
                      accesa: _soloLeSuggerite,
                      premuta: () => _pastiglia(suggerite: true),
                    ),
                  for (final quale in domini.take(8))
                    _Pastiglia(
                      testo: '${quale.key} ${quale.value}',
                      accesa: _soloIlDominio == quale.key,
                      premuta: () => _pastiglia(
                        dominio: _soloIlDominio == quale.key ? null : quale.key,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: daMostrare.isEmpty
                  ? (_stoLeggendo && _tutte.isEmpty
                        ? const _StoLeggendo()
                        : StatoVuoto(
                            icona: Icons.search_off_rounded,
                            titolo: 'Nessuna entita\'',
                            sotto: _soloLeSuggerite
                                ? 'Tocca «Tutte» per vedere anche quelle che '
                                      'non sembrano di questo campo.'
                                : 'Prova con meno lettere, o togli il filtro.',
                          ))
                  : ListView.builder(
                      controller: _scorrimento,
                      itemCount: daMostrare.length,
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                      itemBuilder: (dentro, quale) =>
                          _Riga(trovata: daMostrare[quale]),
                    ),
            ),
            /* Qui **non** c'e' il tasto dell'integrazione, e non e' una
             * dimenticanza.
             *
             * Nella Config della dashboard la strada dell'integrazione parte
             * dalla scheda — «Aggiungi da un'integrazione» in cima — e non da
             * dentro il cercatore, perche' un'integrazione non da' *una*
             * entita': da' un dispositivo con dentro venti entita' e le mette
             * tutte nelle loro caselle. Farlo partire da una casella sola vuol
             * dire buttare via diciannove indizi.
             *
             * E costava anche: due tasti in fondo, sopra la tastiera aperta,
             * lasciavano alla lista una riga e mezza. Il cercatore serve a
             * cercare, e cercare vuol dire vedere quello che si trova. */
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.tonal(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Annulla'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pastiglia extends StatelessWidget {
  const _Pastiglia({
    required this.testo,
    required this.accesa,
    required this.premuta,
  });

  final String testo;
  final bool accesa;
  final VoidCallback premuta;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 3),
    child: ChoiceChip(
      label: Text(testo),
      selected: accesa,
      onSelected: (_) => premuta(),
      visualDensity: VisualDensity.compact,
      labelStyle: const TextStyle(fontSize: 12.5),
    ),
  );
}

class _Riga extends StatelessWidget {
  const _Riga({required this.trovata});

  final Trovata trovata;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final una = trovata.una;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: trovata.suggerita
            ? colori.primaryContainer.withValues(alpha: 0.55)
            : colori.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(12),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.of(context).pop(una.id),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        una.nome,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        una.id,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 11.5,
                          color: colori.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                if (trovata.suggerita) ...[
                  const Text('✨', style: TextStyle(fontSize: 13)),
                  const SizedBox(width: 5),
                ],
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 96),
                  child: Text(
                    una.stato,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: colori.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Le entita' stanno arrivando.
///
/// In una casa vera sono un megabyte e mezzo, e si chiedono solo quando
/// servono. «Nessuna entita'» era la risposta sbagliata alla domanda giusta:
/// non e' che non ce ne siano, e' che non sono ancora qui.
class _StoLeggendo extends StatelessWidget {
  const _StoLeggendo();

  @override
  Widget build(BuildContext context) => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      const CircularProgressIndicator(),
      const SizedBox(height: 18),
      Text(
        'Sto leggendo le entita\' di casa…',
        style: Theme.of(context).textTheme.titleSmall,
      ),
      const SizedBox(height: 6),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Text(
          'La prima volta ci mette un attimo: sono tante, e si chiedono solo '
          'quando servono davvero.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            height: 1.4,
          ),
        ),
      ),
    ],
  );
}
