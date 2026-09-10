/// Le cose di casa, per bene.
///
/// Luci, prese, finestre, clima, telecamere, elettrodomestici, robot, stanze:
/// nella plancia non sono elenchi di due campi, sono **apparecchi**. Ognuno ha
/// un nome, un disegno o una foto, una stanza, un'entita' principale e —
/// questo era il buco — **fino a otto entita'**: la presa che lo accende, il
/// sensore della potenza, i contatori di oggi, del mese, di sempre.
///
/// Poi ogni sezione ha le sue: la telecamera vuole lo stream, l'RTSP e il
/// «vivo»; la finestra i due contatti; il clima il tipo e la valvola. Sono i
/// campi che `normalizeDevice` dichiara, e — questa e' la parte che fa male —
/// **un campo che il modello non dichiara sparisce alla prima
/// normalizzazione**. Per questo il modello sta in `casa/plancia/apparecchio.dart`
/// e non qui: si legge accanto all'originale e si verifica.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/apparecchio.dart';
import '../../casa/plancia/carichi.dart' show campiScelti;
import '../../casa/plancia/legame.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'integrazioni.dart';
import 'le_foto.dart';
import 'pezzi.dart';

/// Un campo in piu' di una sezione, oltre a quelli che hanno tutti.
class CampoDellApparecchio {
  const CampoDellApparecchio(
    this.chiave,
    this.etichetta, {
    this.spiega,
    this.entita = false,
    this.domini = const [],
    this.bandiera = false,
    this.numero = false,
    this.scelte = const [],
    this.tante = false,
    this.mesi = false,
    this.massimo = 0,
  });

  final String chiave;
  final String etichetta;
  final String? spiega;
  final bool entita;
  final List<String> domini;
  final bool bandiera;

  /// Un numero. Con le [scelte] vuol dire che quello che si sceglie si
  /// scrive come numero e non come parola: i minuti dello spegnimento del
  /// clima sono `60`, non `"60"`, e zero toglie la casella.
  final bool numero;

  /// Quando i valori buoni sono pochi e li decide la plancia: il tipo di una
  /// copertura e' uno di tre — `tapparella`, `tenda`, `tenda_sole` — e battuto
  /// a mano un quarto viene scartato senza dire niente
  /// (`declaredCoverKind` tiene solo quelli di `COVER_KINDS`).
  ///
  /// La prima voce con la chiave vuota vale «lascia decidere a Home Assistant»,
  /// che e' cosa fa la plancia quando il tipo non e' dichiarato.
  final List<(String, String)> scelte;

  /// Piu' entita' nello stesso campo: i comandi a parte di un robot.
  final bool tante;

  /// I mesi dell'anno in cui mostrarla (1.4.17): dodici bottoni, e si scrive
  /// l'elenco dei numeri scelti — tutti e dodici vale nessuno.
  final bool mesi;

  /// Per [tante]: quante al massimo. Zero vuol dire senza tetto.
  final int massimo;
}

/// Le altre entita' di un apparecchio, con nomi che si capiscono.
///
/// Sono i sette campi da cui `deviceEntities` raccoglie: la plancia le usa per
/// sapere se una cosa sta lavorando, quanto consuma, quanto ha consumato.
const _altreEntita = <(String, String, List<String>)>[
  (
    'control_entity',
    'Cosa lo accende e lo spegne',
    ['switch', 'input_boolean'],
  ),
  ('power_entity', 'Potenza adesso (W)', ['sensor']),
  ('energy_entity', 'Energia (kWh)', ['sensor']),
  ('daily_energy_entity', 'Consumata oggi (kWh)', ['sensor']),
  ('monthly_energy_entity', 'Consumata questo mese (kWh)', ['sensor']),
  ('total_energy_entity', 'Consumata da sempre (kWh)', ['sensor']),
  ('history_entity', 'Da cui nasce lo storico', ['sensor']),
];

class SchermataDegliApparecchi extends StatefulWidget {
  const SchermataDegliApparecchi({
    super.key,
    required this.titolo,
    required this.sotto,
    required this.sezione,
    required this.unaCosa,
    required this.collegamento,
    this.domini = const [],
    this.campi = const [],
    this.laFoto = false,
    this.leStanze = true,
    this.leAltreEntita = true,
    this.stanzeAParte = '',
    this.ordineAParte = '',
    this.dallIntegrazione = true,
    this.inFondo,
  });

  final String titolo;
  final String sotto;
  final Sezione sezione;

  /// «una luce», «una telecamera»: come si chiama una di queste cose.
  final String unaCosa;

  final Collegamento collegamento;

  /// I domini dell'entita' principale.
  final List<String> domini;

  /// I campi propri della sezione.
  final List<CampoDellApparecchio> campi;

  /// `true` per chi si porta una foto invece di un emoji.
  final bool laFoto;

  /// `false` per le stanze stesse: una stanza non sta in una stanza.
  final bool leStanze;

  /// `false` dove le sette entita' in piu' non vogliono dire niente — una
  /// luce non ha un contatore mensile.
  final bool leAltreEntita;

  /// Dove sta scritta la stanza, quando **non sta nella riga**.
  ///
  /// Le luci e le prese la plancia le tiene come mappa `entita' -> nome`: in
  /// una riga cosi' non c'e' posto per la stanza, e infatti la stanza sta in
  /// una casella sua accanto (`cd_luci_rooms`). Scriverla nella riga vorrebbe
  /// dire scriverla dove nessuno la legge.
  final String stanzeAParte;

  /// Dove sta scritto l'ordine, quando non sta nella riga: stessa ragione.
  final String ordineAParte;

  /// `false` dove un dispositivo di Home Assistant non c'entra niente.
  ///
  /// Una stanza non arriva da un'integrazione: e' una cosa che si inventa chi
  /// configura, e offrire di prenderla da hOn e' offrire una strada che non
  /// porta da nessuna parte.
  final bool dallIntegrazione;

  /// Quello che sta sotto l'elenco: le soglie, le impostazioni di casa.
  final List<Widget> Function(Scatto scatto, Quaderno quaderno)? inFondo;

  @override
  State<SchermataDegliApparecchi> createState() =>
      _SchermataDegliApparecchiState();
}

class _SchermataDegliApparecchiState extends State<SchermataDegliApparecchi> {
  List<Apparecchio>? _elenco;
  int _daQualeScatto = -1;

  /* Le caselle accanto: la stanza e l'ordine di una luce non stanno nella sua
   * riga — la riga e' `entita' -> nome` e non ha posto per altro. */
  Map<String, dynamic> _stanzeAParte = {};
  Map<String, dynamic> _ordineAParte = {};

  List<Apparecchio> _stanzeDi(Scatto scatto) => widget.sezione == Sezione.stanze
      ? const []
      : leggiGliApparecchi(
          scatto.aperto(Sezione.stanze.chiave),
          sezione: Sezione.stanze,
        );

  List<Apparecchio> _leggi(Scatto scatto) {
    if (_elenco == null || _daQualeScatto != scatto.revisione) {
      _elenco = leggiGliApparecchi(
        scatto.aperto(widget.sezione.chiave),
        sezione: widget.sezione,
        stanze: _stanzeDi(scatto),
      );
      if (widget.stanzeAParte.isNotEmpty) {
        _stanzeAParte = scatto.mappa(widget.stanzeAParte);
      }
      if (widget.ordineAParte.isNotEmpty) {
        _ordineAParte = scatto.mappa(widget.ordineAParte);
      }
      _daQualeScatto = scatto.revisione;
    }
    return _elenco!;
  }

  void _segna(Quaderno quaderno) {
    for (final (posto, uno) in _elenco!.indexed) {
      uno.metti('order', posto);
    }
    if (widget.sezione == Sezione.elettrodomestici) {
      /* L'elenco `entities` non lo scrive nessuno a mano: lo riempiva la
       * passata che indovina dai nomi, e quando sbagliava ci lasciava dentro i
       * sensori del frigorifero accanto. Da qui in poi le caselle sono scelte,
       * quindi quello che resta nell'elenco resta per sempre: se non si toglie
       * adesso non si toglie piu' (#417). */
      final tutti = [for (final uno in _elenco!) uno.dentro];
      for (final uno in _elenco!) {
        uno.dentro['entities'] = entitaSetacciate(uno.dentro, tutti);
      }
    }
    quaderno.segna(
      widget.sezione.chiave,
      scriviGliApparecchi(_elenco!, widget.sezione),
    );
    if (widget.stanzeAParte.isNotEmpty) {
      quaderno.segna(widget.stanzeAParte, _stanzeAParte);
    }
    if (widget.ordineAParte.isNotEmpty) {
      /* L'ordine si riscrive tutto: e' `entita' -> posto`, e un posto rimasto
       * indietro sposta una luce che nessuno ha toccato. */
      _ordineAParte = {
        for (final (posto, uno) in _elenco!.indexed)
          if (uno.entita.isNotEmpty) uno.entita: posto,
      };
      quaderno.segna(widget.ordineAParte, _ordineAParte);
    }
    setState(() {});
  }

  /// La tessera della Home che legge questa sezione: e' `TESSERE_PER_SCHEDA`
  /// e `TESSERE_PER_BLOCCO` in `fuori-dai-widget.js`, per linguetta.
  String get _laTessera => switch (widget.sezione) {
    Sezione.luci => 'luci',
    Sezione.prese => 'prese',
    Sezione.finestre => 'tapparelle',
    Sezione.elettrodomestici => 'elettrodomestici',
    Sezione.robot => 'robot',
    Sezione.telecamere => 'telecamere',
    Sezione.clima => 'clima',
    Sezione.stanze => 'temperatura',
    Sezione.auto => 'ev',
    Sezione.carichi => '',
  };

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: widget.titolo,
    sotto: widget.sotto,
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final elenco = _leggi(scatto);
      final stanze = _stanzeDi(scatto);
      return [
        /* Il tasto sta **in cima**, come nella Config della dashboard, e non
         * e' una questione di gusto.
         *
         * Prima era un'iconcina in fondo, di fianco ad «Aggiungi»: chi apriva
         * la scheda vedeva il campo del nome e cominciava a battere entita' a
         * mano — cioe' faceva il lavoro lungo senza sapere che ce n'era uno
         * corto. La strada buona va vista per prima, o e' come se non ci
         * fosse. */
        if (widget.dallIntegrazione) ...[
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => _dalCatalogo(stanze, quaderno),
              icon: const Icon(Icons.extension_rounded),
              label: const Text('Aggiungi da un\'integrazione'),
            ),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
            child: Text(
              'hOn, Home Connect, Miele, LG ThinQ… Scegli il dispositivo e le '
              'sue entita\' finiscono da sole nelle caselle giuste.',
              style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                height: 1.4,
              ),
            ),
          ),
        ],
        if (elenco.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 28),
            child: StatoVuoto(
              icona: Icons.playlist_add_rounded,
              titolo: 'Non ce n\'e\' ancora',
              sotto: 'Aggiungi ${widget.unaCosa} qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, uno) in elenco.indexed)
            _LaScheda(
              apparecchio: uno,
              primo: posto == 0,
              ultimo: posto == elenco.length - 1,
              tessera: _laTessera,
              scatto: scatto,
              quaderno: quaderno,
              apri: () => _apri(posto, stanze, quaderno),
              sposta: (di) {
                final dove = posto + di;
                if (dove < 0 || dove >= elenco.length) return;
                elenco.insert(dove, elenco.removeAt(posto));
                _segna(quaderno);
              },
              togli: () => _togli(posto, uno, quaderno),
              accendi: (acceso) {
                uno.metti('enabled', acceso);
                _segna(quaderno);
              },
            ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.tonalIcon(
            onPressed: () => _apri(-1, stanze, quaderno),
            icon: const Icon(Icons.add_rounded),
            label: Text('Aggiungi ${widget.unaCosa}'),
          ),
        ),
        if (widget.inFondo != null) ...[
          const SizedBox(height: 24),
          ...widget.inFondo!(scatto, quaderno),
        ],
      ];
    },
  );

  Future<void> _apri(
    int posto,
    List<Apparecchio> stanze,
    Quaderno quaderno,
  ) async {
    final nuovo = posto < 0;
    final quale = nuovo
        ? Apparecchio.nuovo(widget.sezione, quale: _elenco!.length)
        : Apparecchio(Map<String, dynamic>.from(_elenco![posto].dentro));
    final fatto = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (dentro) => _UnApparecchio(
          collegamento: widget.collegamento,
          sezione: widget.sezione,
          apparecchio: quale,
          stanze: stanze,
          stanzaAParte: widget.stanzeAParte.isEmpty
              ? null
              : (
                  quale: '${_stanzeAParte[quale.entita] ?? ''}',
                  metti: (String dove) => setState(() {
                    if (dove.isEmpty) {
                      _stanzeAParte.remove(quale.entita);
                    } else {
                      _stanzeAParte[quale.entita] = dove;
                    }
                  }),
                ),
          domini: widget.domini,
          campi: widget.campi,
          laFoto: widget.laFoto,
          leStanze: widget.leStanze,
          leAltreEntita: widget.leAltreEntita,
          unaCosa: widget.unaCosa,
          dallIntegrazione: widget.dallIntegrazione,
        ),
      ),
    );
    if (fatto != true) return;
    if (widget.sezione == Sezione.elettrodomestici) {
      /* Da adesso le caselle sono sue (#417): quello che ha lasciato vuoto e'
       * una risposta, non una domanda, e la passata della plancia che
       * indovina dai nomi non ci torna sopra. E' lo stesso segno che mette il
       * collegamento a un dispositivo. */
      quale.metti('metadata', {
        ...(quale.dentro['metadata'] is Map
            ? Map<String, dynamic>.from(quale.dentro['metadata'] as Map)
            : const <String, dynamic>{}),
        campiScelti: true,
      });
    }
    if (nuovo) {
      _elenco!.add(quale);
    } else {
      _elenco![posto] = quale;
    }
    _segna(quaderno);
  }

  Future<void> _dalCatalogo(List<Apparecchio> stanze, Quaderno quaderno) async {
    final scelto = await scegliDaUnIntegrazione(
      context,
      collegamento: widget.collegamento,
    );
    if (scelto == null || !mounted) return;
    final nato = Apparecchio.nuovo(widget.sezione, quale: _elenco!.length);
    final andata = collegaAlDispositivo(
      nato,
      dispositivo: scelto.dispositivo,
      entita: scelto.tutte.isNotEmpty ? scelto.tutte : scelto.entita,
      integrazione: scelto.integrazione,
      stanze: widget.leStanze ? stanze : const [],
      /* I sensori che stanno **fuori** dal dispositivo ma parlano di lui: la
       * presa Zigbee sotto la lavatrice, il sensore dell'energia di oggi che
       * uno si e' costruito da se'. Riempiono solo dove il dispositivo non
       * arriva. */
      fuori: parentiFuoriDalDispositivo(
        nomeDelDispositivo: scelto.dispositivo.nome,
        casa: widget.collegamento.stato?.tutte() ?? const [],
        escludi: [for (final una in scelto.tutte) una.id],
      ),
    );
    mettiLEntitaPrincipale(
      nato,
      scelto.tutte.isNotEmpty ? scelto.tutte : scelto.entita,
      domini: widget.domini,
    );
    _elenco!.add(nato);
    _segna(quaderno);
    _diComEAndata(nato, andata);
  }

  /// Cosa e' successo, detto a schermo.
  ///
  /// Senza, collegare un dispositivo sembra non aver fatto niente: la scheda
  /// nuova compare, e quali caselle si siano riempite lo scopre solo chi la
  /// apre. Con venti entita' e tredici caselle, «riempite otto» e' la
  /// differenza fra fidarsi e ricontrollare tutto a mano.
  void _diComEAndata(Apparecchio quale, ComEAndata andata) {
    if (!mounted) return;
    final quante = andata.riempite.length;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          quante == 0
              ? '${quale.nome}: collegato. Nessuna casella da riempire.'
              : '${quale.nome}: collegato, $quante '
                    '${quante == 1 ? 'casella riempita' : 'caselle riempite'}'
                    '${andata.tenute.isEmpty ? '' : ', ${andata.tenute.length} lasciate come stavano'}.',
        ),
      ),
    );
  }

  Future<void> _togli(int posto, Apparecchio quale, Quaderno quaderno) async {
    final come = quale.nome.isNotEmpty ? quale.nome : widget.unaCosa;
    final sicuro = await showDialog<bool>(
      context: context,
      builder: (dentro) => AlertDialog(
        title: Text('Tolgo $come?'),
        content: const Text(
          'Sparisce dalla plancia. L\'entita\' di casa non si tocca: resta '
          'dov\'e\', in Home Assistant.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dentro).pop(false),
            child: const Text('Lascia stare'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dentro).pop(true),
            child: const Text('Togli'),
          ),
        ],
      ),
    );
    if (sicuro != true) return;
    _elenco!.removeAt(posto);
    _segna(quaderno);
  }
}

/// La scheda di un apparecchio nell'elenco.
class _LaScheda extends StatelessWidget {
  const _LaScheda({
    required this.apparecchio,
    required this.primo,
    required this.ultimo,
    required this.tessera,
    required this.scatto,
    required this.quaderno,
    required this.apri,
    required this.sposta,
    required this.togli,
    required this.accendi,
  });

  final Apparecchio apparecchio;
  final bool primo;
  final bool ultimo;

  /// La tessera della Home di cui parla questa riga (`luci`, `tapparelle`…),
  /// o «» se la sezione non ne ha una. Con la tessera la riga porta anche la
  /// scelta «nel widget / fuori» della plancia, in `cd_widgets.excluded`.
  final String tessera;
  final Scatto scatto;
  final Quaderno quaderno;
  final VoidCallback apri;
  final ValueChanged<int> sposta;
  final VoidCallback togli;
  final ValueChanged<bool> accendi;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final quante = apparecchio.tutteLeEntita.length;
    /* L'interruttore della tessera (`widget-entity-choice-section.js`)
     * parla dell'entita' scritta in chiaro sulla riga: la principale. */
    final leSue = apparecchio.entita.isNotEmpty
        ? [apparecchio.entita]
        : apparecchio.tutteLeEntita;
    final conLaTessera = tessera.isNotEmpty && leSue.isNotEmpty;
    final dentro =
        !conLaTessera || dentroLaTessera(scatto, quaderno, tessera, leSue);
    final sotto = [
      if (apparecchio.stanza.isNotEmpty) apparecchio.stanza,
      if (apparecchio.entita.isNotEmpty)
        apparecchio.entita
      else
        'nessuna entita\'',
      if (quante > 1) '$quante entita\'',
      if (!dentro) '🧩 fuori dalla tessera',
    ].join(' · ');
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        onTap: apri,
        leading: apparecchio.emoji.isNotEmpty
            ? Text(apparecchio.emoji, style: const TextStyle(fontSize: 26))
            : Icon(Icons.devices_other_rounded, color: colori.onSurfaceVariant),
        title: Text(
          apparecchio.nome.isNotEmpty ? apparecchio.nome : 'Senza nome',
          style: TextStyle(
            fontWeight: FontWeight.w600,
            decoration: apparecchio.acceso ? null : TextDecoration.lineThrough,
            color: apparecchio.acceso ? null : colori.onSurfaceVariant,
          ),
        ),
        subtitle: Text(
          sotto,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              onPressed: primo ? null : () => sposta(-1),
              icon: const Icon(Icons.keyboard_arrow_up_rounded),
              tooltip: 'Su',
            ),
            IconButton(
              onPressed: ultimo ? null : () => sposta(1),
              icon: const Icon(Icons.keyboard_arrow_down_rounded),
              tooltip: 'Giu\'',
            ),
            PopupMenuButton<String>(
              onSelected: (cosa) => switch (cosa) {
                'apri' => apri(),
                'spegni' => accendi(!apparecchio.acceso),
                'tessera' => giraLaTessera(scatto, quaderno, tessera, leSue),
                'togli' => togli(),
                _ => null,
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'apri', child: Text('Apri')),
                PopupMenuItem(
                  value: 'spegni',
                  child: Text(
                    apparecchio.acceso
                        ? 'Nascondi nella plancia'
                        : 'Rimostra nella plancia',
                  ),
                ),
                /* «Nel widget / Fuori»: la tessera della Home mostra questa
                 * entita', o non la mostra. La sezione resta com'e'. */
                if (conLaTessera)
                  PopupMenuItem(
                    value: 'tessera',
                    child: Text(
                      dentro
                          ? '🧩 Fuori dalla tessera della Home'
                          : '🧩 Nella tessera della Home',
                    ),
                  ),
                const PopupMenuItem(value: 'togli', child: Text('Togli')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Un apparecchio aperto.
class _UnApparecchio extends StatefulWidget {
  const _UnApparecchio({
    required this.collegamento,
    required this.sezione,
    required this.apparecchio,
    required this.stanze,
    required this.domini,
    required this.campi,
    required this.laFoto,
    required this.leStanze,
    required this.leAltreEntita,
    required this.unaCosa,
    required this.dallIntegrazione,
    this.stanzaAParte,
  });

  final Collegamento collegamento;
  final Sezione sezione;
  final Apparecchio apparecchio;
  final List<Apparecchio> stanze;
  final List<String> domini;
  final List<CampoDellApparecchio> campi;
  final bool laFoto;
  final bool leStanze;
  final bool leAltreEntita;
  final String unaCosa;
  final bool dallIntegrazione;

  /// Quando la stanza non sta nella riga: cosa c'e' scritto adesso, e dove
  /// scriverla.
  final ({String quale, void Function(String dove) metti})? stanzaAParte;

  @override
  State<_UnApparecchio> createState() => _UnApparecchioState();
}

class _UnApparecchioState extends State<_UnApparecchio> {
  bool _cambiato = false;

  void _tocca(VoidCallback cosa) => setState(() {
    cosa();
    _cambiato = true;
  });

  @override
  Widget build(BuildContext context) {
    final quale = widget.apparecchio;
    final colori = Theme.of(context).colorScheme;
    final quante = quale.tutteLeEntita.length;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (uscito, _) {
        if (!uscito) Navigator.of(context).pop(_cambiato);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(quale.nome.isNotEmpty ? quale.nome : widget.unaCosa),
        ),
        body: SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
            children: [
              if (widget.dallIntegrazione) ...[
                _LIntegrazione(
                  apparecchio: quale,
                  collega: () => _dalCatalogo(quale),
                  scollega: () => _tocca(() => scollega(quale)),
                ),
                const SizedBox(height: 14),
              ],
              CampoDiTesto(
                etichetta: 'Come si chiama',
                valore: quale.nome,
                cambiato: (scritto) =>
                    _tocca(() => quale.metti('name', scritto)),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: CampoDiTesto(
                      etichetta: 'Disegno',
                      valore: quale.emoji,
                      suggerimento: 'Un emoji',
                      cambiato: (scritto) =>
                          _tocca(() => quale.metti('emoji_icon', scritto)),
                    ),
                  ),
                  if (widget.laFoto) ...[
                    const SizedBox(width: 8),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: IconButton.filledTonal(
                        onPressed: () async {
                          final scelta = await scegliUnaFoto(
                            context,
                            collegamento: widget.collegamento,
                            titolo: 'La foto di ${quale.nome}',
                            adesso: quale.immagine,
                          );
                          if (scelta == null) return;
                          _tocca(() => quale.metti('image', scelta));
                        },
                        icon: const Icon(Icons.photo_camera_rounded),
                        tooltip: 'Una foto invece dell\'emoji',
                      ),
                    ),
                  ],
                ],
              ),
              if (widget.laFoto && quale.immagine.isNotEmpty) ...[
                const SizedBox(height: 8),
                _LaFoto(
                  dove: quale.immagine,
                  togli: () => _tocca(() => quale.metti('image', '')),
                ),
              ],
              if (widget.leStanze) ...[
                const SizedBox(height: 14),
                _LaStanza(
                  stanze: widget.stanze,
                  scelta: widget.stanzaAParte != null
                      ? widget.stanzaAParte!.quale
                      : quale.idDellaStanza,
                  scegli: (stanza) => _tocca(() {
                    if (widget.stanzaAParte != null) {
                      widget.stanzaAParte!.metti(stanza?.id ?? '');
                    } else {
                      quale.mettiLaStanza(stanza);
                    }
                  }),
                ),
              ],
              const SizedBox(height: 18),
              CampoDiEntita(
                etichetta: 'Entita\' principale',
                contesto: widget.unaCosa,
                domini: widget.domini,
                valore: quale.entita,
                collegamento: widget.collegamento,
                cambiato: (scritto) =>
                    _tocca(() => quale.metti('entity', scritto)),
              ),
              for (final campo in widget.campi) ...[
                const SizedBox(height: 14),
                _IlCampo(
                  campo: campo,
                  apparecchio: quale,
                  collegamento: widget.collegamento,
                  cambiato: () => _tocca(() {}),
                ),
              ],
              if (widget.leAltreEntita) ...[
                const SizedBox(height: 18),
                Card(
                  margin: EdgeInsets.zero,
                  clipBehavior: Clip.antiAlias,
                  child: ExpansionTile(
                    initiallyExpanded: quante > 1,
                    title: const Text('Le altre entita\''),
                    subtitle: Text(
                      'Quanto consuma, quanto ha consumato, cosa lo accende',
                      style: Theme.of(context).textTheme.bodySmall
                          ?.copyWith(color: colori.onSurfaceVariant),
                    ),
                    childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    children: [
                      for (final (chiave, etichetta, domini)
                          in _altreEntita) ...[
                        CampoDiEntita(
                          etichetta: etichetta,
                          chiave: chiave,
                          contesto: 'di ${quale.nome}',
                          domini: domini,
                          valore: '${quale.dentro[chiave] ?? ''}',
                          collegamento: widget.collegamento,
                          cambiato: (scritto) =>
                              _tocca(() => quale.metti(chiave, scritto)),
                        ),
                        const SizedBox(height: 14),
                      ],
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: quale.acceso,
                onChanged: (acceso) =>
                    _tocca(() => quale.metti('enabled', acceso)),
                title: const Text('Si vede nella plancia'),
                subtitle: const Text(
                  'Spento resta configurato, ma la plancia non lo mostra.',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _dalCatalogo(Apparecchio quale) async {
    final scelto = await scegliDaUnIntegrazione(
      context,
      collegamento: widget.collegamento,
    );
    if (scelto == null || !mounted) return;
    final andata = collegaAlDispositivo(
      quale,
      dispositivo: scelto.dispositivo,
      entita: scelto.tutte.isNotEmpty ? scelto.tutte : scelto.entita,
      integrazione: scelto.integrazione,
      stanze: widget.leStanze ? widget.stanze : const [],
      fuori: parentiFuoriDalDispositivo(
        nomeDelDispositivo: scelto.dispositivo.nome,
        casa: widget.collegamento.stato?.tutte() ?? const [],
        escludi: [for (final una in scelto.tutte) una.id],
      ),
    );
    mettiLEntitaPrincipale(
      quale,
      scelto.tutte.isNotEmpty ? scelto.tutte : scelto.entita,
      domini: widget.domini,
    );
    _tocca(() {});
    if (!mounted) return;
    final quante = andata.riempite.length;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          quante == 0
              ? 'Collegato. Le caselle c\'erano gia\' tutte.'
              : 'Collegato: $quante '
                    '${quante == 1 ? 'casella riempita' : 'caselle riempite'}'
                    '${andata.tenute.isEmpty ? '' : ', ${andata.tenute.length} lasciate come stavano'}.',
        ),
      ),
    );
  }
}

/// Da quale dispositivo viene questo apparecchio, e cosa si puo' farci.
///
/// E' il blocco «Integrazione» della Config della dashboard, e sta in cima
/// alla maschera perche' e' la prima domanda: **questo lo devo compilare a
/// mano, o arriva da solo?** Chi lo legge dopo aver battuto sei entita' ha
/// gia' perso il tempo che questo blocco fa risparmiare.
class _LIntegrazione extends StatelessWidget {
  const _LIntegrazione({
    required this.apparecchio,
    required this.collega,
    required this.scollega,
  });

  final Apparecchio apparecchio;
  final VoidCallback collega;
  final VoidCallback scollega;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final collegato = eCollegato(apparecchio);
    return Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.extension_rounded,
                size: 18,
                color: collegato ? colori.primary : colori.onSurfaceVariant,
              ),
              const SizedBox(width: 8),
              Text(
                'Integrazione',
                style: testi.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            collegato
                ? etichettaDelLegame(apparecchio)
                : 'Non e\' collegato a nessun dispositivo. Collegandolo, le '
                      'sue entita\' finiscono da sole nelle caselle giuste — '
                      'e quello che hai gia\' scritto a mano resta com\'e\'.',
            style: testi.bodySmall?.copyWith(
              color: colori.onSurfaceVariant,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.tonalIcon(
                onPressed: collega,
                icon: const Icon(Icons.extension_rounded, size: 18),
                label: Text(collegato ? 'Cambia dispositivo' : 'Collega'),
              ),
              if (collegato)
                TextButton.icon(
                  onPressed: scollega,
                  icon: const Icon(Icons.link_off_rounded, size: 18),
                  label: const Text('Scollega'),
                ),
            ],
          ),
          if (collegato)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Scollegando, le caselle restano scritte: si smette di '
                'seguire il dispositivo, non si butta via la configurazione.',
                style: testi.labelSmall?.copyWith(
                  color: colori.onSurfaceVariant,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Un campo proprio della sezione: il tipo del clima, l'RTSP della telecamera.
class _IlCampo extends StatelessWidget {
  const _IlCampo({
    required this.campo,
    required this.apparecchio,
    required this.collegamento,
    required this.cambiato,
  });

  final CampoDellApparecchio campo;
  final Apparecchio apparecchio;
  final Collegamento collegamento;
  final VoidCallback cambiato;

  @override
  Widget build(BuildContext context) {
    final adesso = apparecchio.dentro[campo.chiave];
    if (campo.bandiera) {
      return SwitchListTile(
        contentPadding: EdgeInsets.zero,
        value: adesso == true,
        onChanged: (acceso) {
          apparecchio.metti(campo.chiave, acceso ? true : null);
          cambiato();
        },
        title: Text(campo.etichetta),
        subtitle: campo.spiega == null ? null : Text(campo.spiega!),
        dense: true,
      );
    }
    if (campo.tante) {
      return TanteEntita(
        etichetta: campo.etichetta,
        spiega: campo.spiega,
        domini: campo.domini,
        massimo: campo.massimo,
        quali: [for (final una in (adesso as List? ?? [])) '$una'],
        collegamento: collegamento,
        cambiate: (dopo) {
          apparecchio.metti(campo.chiave, dopo.isEmpty ? null : dopo);
          cambiato();
        },
      );
    }
    if (campo.mesi) {
      return _IMesi(
        campo: campo,
        scelti: {
          for (final uno in (adesso as List? ?? const []))
            if (uno is num)
              uno.toInt()
            else if (int.tryParse('$uno') != null)
              int.parse('$uno'),
        },
        scegli: (elenco) {
          apparecchio.metti(
            campo.chiave,
            elenco.length == 12 || elenco.isEmpty ? null : elenco,
          );
          cambiato();
        },
      );
    }
    if (campo.scelte.isNotEmpty) {
      final quale = '${adesso ?? ''}';
      return DropdownButtonFormField<String>(
        initialValue: campo.scelte.any((una) => una.$1 == quale)
            ? quale
            : campo.scelte.first.$1,
        decoration: InputDecoration(
          labelText: campo.etichetta,
          helperText: campo.spiega,
          helperMaxLines: 3,
          border: const OutlineInputBorder(),
          isDense: true,
        ),
        items: [
          for (final (valore, nome) in campo.scelte)
            DropdownMenuItem(value: valore, child: Text(nome)),
        ],
        onChanged: (scelto) {
          final vuoto =
              (scelto ?? '').isEmpty || (campo.numero && scelto == '0');
          apparecchio.metti(
            campo.chiave,
            vuoto
                ? null
                : campo.numero
                ? (num.tryParse(scelto!) ?? scelto)
                : scelto,
          );
          cambiato();
        },
      );
    }
    if (campo.entita) {
      return CampoDiEntita(
        etichetta: campo.etichetta,
        chiave: campo.chiave,
        contesto: 'di ${apparecchio.nome}',
        domini: campo.domini,
        valore: '${adesso ?? ''}',
        collegamento: collegamento,
        cambiato: (scritto) {
          apparecchio.metti(campo.chiave, scritto);
          cambiato();
        },
      );
    }
    return CampoDiTesto(
      etichetta: campo.etichetta,
      valore: '${adesso ?? ''}',
      suggerimento: campo.spiega,
      numerico: campo.numero,
      cambiato: (scritto) {
        apparecchio.metti(campo.chiave, scritto);
        cambiato();
      },
    );
  }
}

/// In che stanza sta.
///
/// Si sceglie da quelle che ci sono e non si batte a mano: la plancia tiene
/// **due** campi — l'identificativo e il nome — e li vuole d'accordo. Battuto
/// a mano un nome che non e' di nessuna stanza, e la cosa finisce in una
/// stanza che non esiste.
class _LaStanza extends StatelessWidget {
  const _LaStanza({
    required this.stanze,
    required this.scelta,
    required this.scegli,
  });

  final List<Apparecchio> stanze;

  /// L'identificativo della stanza scelta adesso.
  final String scelta;

  final ValueChanged<Apparecchio?> scegli;

  @override
  Widget build(BuildContext context) {
    if (stanze.isEmpty) {
      return Text(
        'Non c\'e\' ancora nessuna stanza: aggiungile dalla voce «Le stanze» '
        'e poi torna qui.',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
          height: 1.4,
        ),
      );
    }
    final quale = stanze.where((una) => una.id == scelta);
    return DropdownButtonFormField<String>(
      initialValue: quale.isEmpty ? '' : quale.first.id,
      decoration: const InputDecoration(
        labelText: 'In che stanza',
        border: OutlineInputBorder(),
        isDense: true,
      ),
      items: [
        const DropdownMenuItem(value: '', child: Text('In nessuna')),
        for (final una in stanze)
          DropdownMenuItem(
            value: una.id,
            child: Text(una.nome.isNotEmpty ? una.nome : una.id),
          ),
      ],
      onChanged: (scelto) => scegli(
        scelto == null || scelto.isEmpty
            ? null
            : stanze.firstWhere((una) => una.id == scelto),
      ),
    );
  }
}

/// L'anteprima della foto scelta.
class _LaFoto extends StatelessWidget {
  const _LaFoto({required this.dove, required this.togli});

  final String dove;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(
          dove,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
        ),
      ),
      TextButton(onPressed: togli, child: const Text('Togli la foto')),
    ],
  );
}

/// I mesi in cui mostrare un'unita' del clima (1.4.17): dodici bottoni.
/// Nessuno scelto vuol dire tutti, che e' come la plancia legge un elenco
/// vuoto; e tutti scelti si scrive come nessuno.
class _IMesi extends StatelessWidget {
  const _IMesi({
    required this.campo,
    required this.scelti,
    required this.scegli,
  });

  final CampoDellApparecchio campo;
  final Set<int> scelti;
  final ValueChanged<List<int>> scegli;

  static const _nomi = [
    'Gen',
    'Feb',
    'Mar',
    'Apr',
    'Mag',
    'Giu',
    'Lug',
    'Ago',
    'Set',
    'Ott',
    'Nov',
    'Dic',
  ];

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          campo.etichetta,
          style: Theme.of(context).textTheme.labelLarge
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        if (campo.spiega != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              campo.spiega!,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: colori.onSurfaceVariant),
            ),
          ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (var mese = 1; mese <= 12; mese += 1)
              /* Come nella plancia: nessun mese acceso vuol dire tutto
               * l'anno, e le pastiglie stanno spente. Accenderle tutte e
               * dodici torna a dire la stessa cosa, e si scrive niente. */
              FilterChip(
                label: Text(_nomi[mese - 1]),
                selected: scelti.contains(mese),
                onSelected: (acceso) {
                  final dopo = {...scelti};
                  if (acceso) {
                    dopo.add(mese);
                  } else {
                    dopo.remove(mese);
                  }
                  scegli(dopo.toList()..sort());
                },
              ),
          ],
        ),
      ],
    );
  }
}
