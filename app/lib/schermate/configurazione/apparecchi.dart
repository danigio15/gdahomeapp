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
  });

  final String chiave;
  final String etichetta;
  final String? spiega;
  final bool entita;
  final List<String> domini;
  final bool bandiera;
  final bool numero;
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

  /// Quello che sta sotto l'elenco: le soglie, le impostazioni di casa.
  final List<Widget> Function(Scatto scatto, Quaderno quaderno)? inFondo;

  @override
  State<SchermataDegliApparecchi> createState() =>
      _SchermataDegliApparecchiState();
}

class _SchermataDegliApparecchiState extends State<SchermataDegliApparecchi> {
  List<Apparecchio>? _elenco;
  int _daQualeScatto = -1;

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
      _daQualeScatto = scatto.revisione;
    }
    return _elenco!;
  }

  void _segna(Quaderno quaderno) {
    for (final (posto, uno) in _elenco!.indexed) {
      uno.metti('order', posto);
    }
    quaderno.segna(
      widget.sezione.chiave,
      scriviGliApparecchi(_elenco!, widget.sezione),
    );
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: widget.titolo,
    sotto: widget.sotto,
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final elenco = _leggi(scatto);
      final stanze = _stanzeDi(scatto);
      return [
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
        Row(
          children: [
            Expanded(
              child: FilledButton.tonalIcon(
                onPressed: () => _apri(-1, stanze, quaderno),
                icon: const Icon(Icons.add_rounded),
                label: Text('Aggiungi ${widget.unaCosa}'),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filledTonal(
              onPressed: () => _dalCatalogo(stanze, quaderno),
              icon: const Icon(Icons.extension_rounded),
              tooltip: 'Prendilo da un\'integrazione',
            ),
          ],
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
          domini: widget.domini,
          campi: widget.campi,
          laFoto: widget.laFoto,
          leStanze: widget.leStanze,
          leAltreEntita: widget.leAltreEntita,
          unaCosa: widget.unaCosa,
        ),
      ),
    );
    if (fatto != true) return;
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
    if (scelto == null) return;
    final nato = Apparecchio.nuovo(widget.sezione, quale: _elenco!.length);
    riempiDalCatalogo(nato, scelto, domini: widget.domini);
    /* La stanza il catalogo la sa gia': viene dai registri di Home Assistant,
     * ed e' quella vera. Riscriverla a mano e' il modo di sbagliarla. */
    final dove = scelto.dispositivo.stanza;
    if (dove.isNotEmpty && widget.leStanze) {
      final trovata = stanze.where((una) => una.nome == dove);
      if (trovata.isNotEmpty) {
        nato.mettiLaStanza(trovata.first);
      } else {
        nato.metti('room', dove);
      }
    }
    _elenco!.add(nato);
    _segna(quaderno);
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

/// Riempie un apparecchio con quello che si e' scelto da un'integrazione.
///
/// Non si limita a scrivere il nome e la prima entita': un dispositivo ne
/// porta cinque o sei, e ognuna sa gia' cos'e' — Home Assistant lo dice nella
/// sua «classe» e nella sua unita'. La potenza va nella potenza, il contatore
/// nel contatore, l'interruttore nell'interruttore. E' l'intera ragione per
/// cui il catalogo esiste: chi lo apre non deve poi ribattere sei entita' a
/// mano nelle sei caselle giuste.
void riempiDalCatalogo(
  Apparecchio quale,
  SceltoDalCatalogo scelto, {
  List<String> domini = const [],
}) {
  if (quale.nome.isEmpty) {
    quale.metti('name', scelto.dispositivo.nome);
  }
  for (final una in scelto.entita) {
    final dominio = una.id.split('.').first;
    final classe = una.classe.toLowerCase();
    final unita = una.unita.toLowerCase();
    final campo = switch ((dominio, classe)) {
      (_, 'power') => 'power_entity',
      (_, 'energy') =>
        quale.dentro['total_energy_entity'] == null
            ? 'total_energy_entity'
            : 'daily_energy_entity',
      ('switch' || 'input_boolean', _) => 'control_entity',
      _ when unita == 'w' || unita == 'kw' => 'power_entity',
      _ when unita == 'kwh' || unita == 'wh' => 'total_energy_entity',
      _ => null,
    };
    if (campo == null) continue;
    if ('${quale.dentro[campo] ?? ''}'.isNotEmpty) continue;
    quale.metti(campo, una.id);
  }
  /* L'entita' principale: la prima del dominio che questa sezione vuole, e
   * senza domini la prima e basta. E' quella che la plancia comanda. */
  if (quale.entita.isEmpty) {
    for (final una in scelto.entita) {
      final dominio = una.id.split('.').first;
      if (domini.isNotEmpty && !domini.contains(dominio)) continue;
      quale.metti('entity', una.id);
      break;
    }
  }
  if (quale.entita.isEmpty && scelto.entita.isNotEmpty) {
    quale.metti('entity', scelto.entita.first.id);
  }
}

/// La scheda di un apparecchio nell'elenco.
class _LaScheda extends StatelessWidget {
  const _LaScheda({
    required this.apparecchio,
    required this.primo,
    required this.ultimo,
    required this.apri,
    required this.sposta,
    required this.togli,
    required this.accendi,
  });

  final Apparecchio apparecchio;
  final bool primo;
  final bool ultimo;
  final VoidCallback apri;
  final ValueChanged<int> sposta;
  final VoidCallback togli;
  final ValueChanged<bool> accendi;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final quante = apparecchio.tutteLeEntita.length;
    final sotto = [
      if (apparecchio.stanza.isNotEmpty) apparecchio.stanza,
      if (apparecchio.entita.isNotEmpty)
        apparecchio.entita
      else
        'nessuna entita\'',
      if (quante > 1) '$quante entita\'',
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
          actions: [
            IconButton(
              onPressed: () => _dalCatalogo(quale),
              icon: const Icon(Icons.extension_rounded),
              tooltip: 'Riempi da un\'integrazione',
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
            children: [
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
                  adesso: quale,
                  scegli: (stanza) => _tocca(() => quale.mettiLaStanza(stanza)),
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
    if (scelto == null) return;
    _tocca(() => riempiDalCatalogo(quale, scelto, domini: widget.domini));
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
    required this.adesso,
    required this.scegli,
  });

  final List<Apparecchio> stanze;
  final Apparecchio adesso;
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
    final quale = stanze.where((una) => una.id == adesso.idDellaStanza);
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
