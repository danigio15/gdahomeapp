/// L'elenco: la forma che hanno quasi tutte le voci della configurazione.
///
/// Le luci, le prese, le stanze, le tapparelle, le telecamere, le unita'
/// clima, gli elettrodomestici, le azioni rapide: sono tutte **un elenco di
/// cose, ognuna con qualche campo**. Cambia cosa si chiede — un nome e
/// un'entita' per una luce, un nome e due sensori per una stanza — e non come
/// si aggiunge, si cambia, si sposta o si toglie.
///
/// Quindi una schermata sola, che si descrive: quali campi, come si chiama la
/// cosa al singolare, dove sta nella configurazione. Sette schermate scritte
/// una volta invece di sette volte, e chi ne impara una le sa tutte.
///
/// Una regola che vale dappertutto: **quello che non si conosce si tiene**.
/// Una telecamera ha campi che questa schermata non mostra — la stanza del
/// registro, una bandiera di quelle vecchie — e riscriverla da zero li
/// butterebbe via. Si scrive dentro l'oggetto che c'era, non al suo posto.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/// Cosa vuole un campo.
enum Tipo {
  testo,
  entita,
  numero,

  /// Un interruttore: `true` scritto, `false` cancellato. E' come la plancia
  /// tiene le sue bandiere — `if(t.invertita) delete t.invertita` — e
  /// scriverci `false` dentro farebbe una configurazione diversa da quella
  /// che scriverebbe lei.
  bandiera,
}

/// Un campo di una cosa dell'elenco.
class Campo {
  const Campo(
    this.chiave,
    this.etichetta, {
    this.tipo = Tipo.testo,
    this.domini = const [],
    this.serve = false,
    this.spiega,
  });

  /// Come si chiama dentro l'oggetto: `name`, `entity`, `temp`.
  final String chiave;
  final String etichetta;
  final Tipo tipo;

  /// Per le entita': da quali domini partire nel cercatore.
  final List<String> domini;

  /// Senza questo non si salva.
  final bool serve;

  /// Una riga sotto, quando il nome del campo non basta.
  final String? spiega;
}

/// Da dove si leggono e dove si scrivono le cose dell'elenco.
///
/// Quasi tutte le chiavi tengono un elenco di oggetti; le luci e le prese
/// tengono invece una mappa `{'light.cucina': 'Cucina'}`. Sono due forme, non
/// due schermate: qui si dice come si legge e come si riscrive, e il resto e'
/// uguale.
class Forma {
  const Forma.elenco(this.chiave)
    : _mappaDi = null,
      campoDellaChiave = null,
      campoDelValore = null,
      _dentro = null;

  /// Un elenco che sta **dentro** un oggetto: le zone dell'irrigazione stanno
  /// in `cd_irrigazione.zones`, insieme all'ora e alla soglia di pioggia. Si
  /// riscrive l'oggetto intero cambiando solo quel campo, cosi' l'ora e la
  /// soglia non se ne vanno con le zone.
  const Forma.elencoDentro(this.chiave, String campo)
    : _mappaDi = null,
      campoDellaChiave = null,
      campoDelValore = null,
      _dentro = campo;

  /// Una mappa: la chiave dell'oggetto va in [campoDellaChiave], il valore in
  /// [campoDelValore].
  const Forma.mappa(
    this.chiave, {
    required this.campoDellaChiave,
    required this.campoDelValore,
  }) : _mappaDi = true,
       _dentro = null;

  /// La chiave della configurazione: `cd_stanze`, `cd_luci`.
  final String chiave;

  final bool? _mappaDi;

  /// Per una mappa: dove finisce la chiave, e dove il valore.
  final String? campoDellaChiave;
  final String? campoDelValore;
  final String? _dentro;

  bool get eUnaMappa => _mappaDi == true;

  List<Map<String, dynamic>> leggi(Scatto scatto) {
    if (eUnaMappa) {
      return [
        for (final voce in scatto.mappa(chiave).entries)
          {campoDellaChiave!: voce.key, campoDelValore!: '${voce.value}'},
      ];
    }
    final dentro = _dentro;
    if (dentro == null) return scatto.oggetti(chiave);
    final elenco = scatto.mappa(chiave)[dentro];
    if (elenco is! List) return const [];
    return [
      for (final una in elenco)
        if (una is Map) Map<String, dynamic>.from(una),
    ];
  }

  /// Come si riscrive la chiave.
  ///
  /// Vuole anche lo scatto perche' un elenco dentro un oggetto non e' tutto
  /// l'oggetto: le zone dell'irrigazione stanno accanto all'ora e alla soglia
  /// di pioggia, e riscrivere la chiave con le sole zone le butterebbe via.
  Object scrivi(Scatto scatto, List<Map<String, dynamic>> cose) {
    if (eUnaMappa) {
      return {
        for (final una in cose)
          if ('${una[campoDellaChiave] ?? ''}'.isNotEmpty)
            '${una[campoDellaChiave]}': '${una[campoDelValore] ?? ''}',
      };
    }
    final dentro = _dentro;
    if (dentro == null) return cose;
    return {...scatto.mappa(chiave), dentro: cose};
  }
}

/// Una schermata a elenco.
class SchermataDiElenco extends StatelessWidget {
  const SchermataDiElenco({
    super.key,
    required this.titolo,
    required this.sotto,
    required this.collegamento,
    required this.forma,
    required this.campi,
    required this.unaCosa,
    this.disegno,
    this.riordinabile = true,
  });

  final String titolo;
  final String sotto;
  final Collegamento collegamento;
  final Forma forma;
  final List<Campo> campi;

  /// Come si chiama una di queste cose, al singolare: «una luce», «una
  /// stanza». Finisce nel bottone e nei messaggi.
  final String unaCosa;

  final String? disegno;

  /// Le mappe non hanno un ordine loro: riordinarle non vorrebbe dire niente.
  final bool riordinabile;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: titolo,
    sotto: sotto,
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) => [
      _Elenco(
        collegamento: collegamento,
        forma: forma,
        campi: campi,
        unaCosa: unaCosa,
        riordinabile: riordinabile && !forma.eUnaMappa,
        scatto: scatto,
        quaderno: quaderno,
      ),
    ],
  );
}

class _Elenco extends StatefulWidget {
  const _Elenco({
    required this.collegamento,
    required this.forma,
    required this.campi,
    required this.unaCosa,
    required this.riordinabile,
    required this.scatto,
    required this.quaderno,
  });

  final Collegamento collegamento;
  final Forma forma;
  final List<Campo> campi;
  final String unaCosa;
  final bool riordinabile;
  final Scatto scatto;
  final Quaderno quaderno;

  @override
  State<_Elenco> createState() => _ElencoState();
}

class _ElencoState extends State<_Elenco> {
  List<Map<String, dynamic>>? _cose;
  int _daQualeScatto = -1;

  List<Map<String, dynamic>> get cose {
    /* Si riparte dallo scatto solo quando lo scatto e' un altro: dopo un
     * salvataggio, o dopo una rilettura. Rileggerlo a ogni ridisegno
     * butterebbe via quello che si sta scrivendo. */
    if (_cose == null || _daQualeScatto != widget.scatto.revisione) {
      _cose = widget.forma.leggi(widget.scatto);
      _daQualeScatto = widget.scatto.revisione;
    }
    return _cose!;
  }

  void _segna() {
    widget.quaderno.segna(
      widget.forma.chiave,
      widget.forma.scrivi(widget.scatto, cose),
    );
    setState(() {});
  }

  Future<void> _apri(int quale) async {
    final partenza = quale < 0
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(cose[quale]);
    final scritta = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (dentro) => _Modulo(
        collegamento: widget.collegamento,
        campi: widget.campi,
        cosa: partenza,
        unaCosa: widget.unaCosa,
        nuova: quale < 0,
      ),
    );
    if (scritta == null) return;
    if (quale < 0) {
      cose.add(scritta);
    } else {
      cose[quale] = scritta;
    }
    _segna();
  }

  void _togli(int quale) {
    cose.removeAt(quale);
    _segna();
  }

  void _sposta(int quale, int diQuanto) {
    final dove = quale + diQuanto;
    if (dove < 0 || dove >= cose.length) return;
    final presa = cose.removeAt(quale);
    cose.insert(dove, presa);
    _segna();
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final primo = widget.campi.first;
    final secondo = widget.campi.length > 1 ? widget.campi[1] : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (cose.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 28),
            child: StatoVuoto(
              icona: Icons.playlist_add_rounded,
              titolo: 'Non c\'e\' ancora niente',
              sotto: 'Aggiungi ${widget.unaCosa} con il bottone qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          Scheda(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final (quale, una) in cose.indexed) ...[
                  if (quale > 0)
                    Divider(
                      height: 1,
                      indent: 16,
                      color: colori.outlineVariant,
                    ),
                  _Riga(
                    titolo: '${una[primo.chiave] ?? ''}'.isEmpty
                        ? '(senza nome)'
                        : '${una[primo.chiave]}',
                    sotto: secondo == null
                        ? ''
                        : '${una[secondo.chiave] ?? ''}',
                    quale: quale,
                    quante: cose.length,
                    riordinabile: widget.riordinabile,
                    apri: () => _apri(quale),
                    togli: () => _togli(quale),
                    sposta: (diQuanto) => _sposta(quale, diQuanto),
                  ),
                ],
              ],
            ),
          ),
        const SizedBox(height: 14),
        FilledButton.tonalIcon(
          onPressed: () => _apri(-1),
          icon: const Icon(Icons.add_rounded),
          label: Text('Aggiungi ${widget.unaCosa}'),
        ),
      ],
    );
  }
}

class _Riga extends StatelessWidget {
  const _Riga({
    required this.titolo,
    required this.sotto,
    required this.quale,
    required this.quante,
    required this.riordinabile,
    required this.apri,
    required this.togli,
    required this.sposta,
  });

  final String titolo;
  final String sotto;
  final int quale;
  final int quante;
  final bool riordinabile;
  final VoidCallback apri;
  final VoidCallback togli;
  final void Function(int diQuanto) sposta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return InkWell(
      onTap: apri,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 6, 8),
        child: Row(
          children: [
            if (riordinabile)
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _Freccia(
                    verso: Icons.keyboard_arrow_up_rounded,
                    spenta: quale == 0,
                    premuta: () => sposta(-1),
                  ),
                  _Freccia(
                    verso: Icons.keyboard_arrow_down_rounded,
                    spenta: quale == quante - 1,
                    premuta: () => sposta(1),
                  ),
                ],
              ),
            const SizedBox(width: 6),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    titolo,
                    style: Theme.of(context).textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  if (sotto.isNotEmpty)
                    Text(
                      sotto,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11.5,
                      ).copyWith(color: colori.onSurfaceVariant),
                    ),
                ],
              ),
            ),
            IconButton(
              onPressed: togli,
              icon: const Icon(Icons.delete_outline_rounded),
              tooltip: 'Togli',
              color: colori.error,
            ),
          ],
        ),
      ),
    );
  }
}

class _Freccia extends StatelessWidget {
  const _Freccia({
    required this.verso,
    required this.spenta,
    required this.premuta,
  });

  final IconData verso;
  final bool spenta;
  final VoidCallback premuta;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 30,
    height: 24,
    child: IconButton(
      padding: EdgeInsets.zero,
      iconSize: 20,
      onPressed: spenta ? null : premuta,
      icon: Icon(verso),
    ),
  );
}

/// Il modulo di una cosa: si apre dal basso, si compila, si conferma.
class _Modulo extends StatefulWidget {
  const _Modulo({
    required this.collegamento,
    required this.campi,
    required this.cosa,
    required this.unaCosa,
    required this.nuova,
  });

  final Collegamento collegamento;
  final List<Campo> campi;
  final Map<String, dynamic> cosa;
  final String unaCosa;
  final bool nuova;

  @override
  State<_Modulo> createState() => _ModuloState();
}

class _ModuloState extends State<_Modulo> {
  late final Map<String, dynamic> _cosa = Map.of(widget.cosa);
  String? _manca;

  void _conferma() {
    for (final campo in widget.campi) {
      if (!campo.serve) continue;
      if ('${_cosa[campo.chiave] ?? ''}'.trim().isEmpty) {
        setState(() => _manca = 'Manca: ${campo.etichetta}');
        return;
      }
    }
    /* I campi vuoti si tolgono invece di restare come stringa vuota: e' come
     * fa la plancia, e una chiave che c'e' ma non dice niente e' peggio di
     * una che non c'e' — la prima sembra configurata. */
    for (final campo in widget.campi) {
      final valore = _cosa[campo.chiave];
      if (valore is String && valore.trim().isEmpty) _cosa.remove(campo.chiave);
      if (valore is String) _cosa[campo.chiave] = valore.trim();
    }
    Navigator.of(context).pop(_cosa);
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.nuova
                    ? 'Aggiungi ${widget.unaCosa}'
                    : 'Cambia ${widget.unaCosa}',
                style: Theme.of(context).textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 18),
              for (final campo in widget.campi) ...[
                switch (campo.tipo) {
                  Tipo.entita => CampoDiEntita(
                    etichetta: campo.etichetta,
                    /* «una luce», «una finestra»: e' quello che fa capire al
                     * cercatore cosa cercare, quando l'etichetta della casella
                     * dice solo «Entita'». */
                    contesto: widget.unaCosa,
                    valore: '${_cosa[campo.chiave] ?? ''}',
                    domini: campo.domini,
                    collegamento: widget.collegamento,
                    cambiato: (scritto) => _cosa[campo.chiave] = scritto,
                  ),
                  Tipo.bandiera => SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(campo.etichetta),
                    subtitle: campo.spiega == null ? null : Text(campo.spiega!),
                    value: _cosa[campo.chiave] == true,
                    onChanged: (acceso) => setState(() {
                      if (acceso) {
                        _cosa[campo.chiave] = true;
                      } else {
                        _cosa.remove(campo.chiave);
                      }
                    }),
                  ),
                  _ => CampoDiTesto(
                    etichetta: campo.etichetta,
                    valore: '${_cosa[campo.chiave] ?? ''}',
                    numerico: campo.tipo == Tipo.numero,
                    suggerimento: campo.spiega,
                    cambiato: (scritto) => _cosa[campo.chiave] = scritto,
                  ),
                },
                const SizedBox(height: 14),
              ],
              if (_manca != null) ...[
                Text(
                  _manca!,
                  style: TextStyle(color: colori.error, fontSize: 13),
                ),
                const SizedBox(height: 10),
              ],
              FilledButton(
                onPressed: _conferma,
                child: Text(widget.nuova ? 'Aggiungi' : 'Fatto'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
