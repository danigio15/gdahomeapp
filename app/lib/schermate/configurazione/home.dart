/// La Home: cosa mette in mostra la prima pagina, e in che ordine.
///
/// Le tessere che si vedono e quelle no, l'ordine dei quattro blocchi, e le
/// liste che le tessere leggono — i lettori, la raccolta, i calendari, le
/// liste della spesa, le persone, le entita' messe li' a mano.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/apparecchio.dart';
import '../../casa/plancia/home.dart';
import '../../casa/plancia/scelte.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/// L'ordine dei quattro blocchi della Home.
class SchermataDeiBlocchi extends StatelessWidget {
  const SchermataDeiBlocchi({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'L\'ordine della Home',
    sotto:
        'In che ordine stanno i quattro blocchi della prima pagina. Chi ha le '
        'azioni rapide che usa ogni giorno le vuole in cima, non sotto una '
        'fila di tessere.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final fila = ordineDeiBlocchi(
        quaderno.cambiate[chiaveDeiBlocchi] ?? scatto.aperto(chiaveDeiBlocchi),
      );
      final nomi = {
        for (final (chiave, nome) in blocchiDellaHome) chiave: nome,
      };
      /* Il flusso dell'energia in Home (#415): un si'/no, e senza niente
       * scritto si vede. Non e' un blocco della fila — non si sposta — ed e'
       * qui perche' nella Config sta sotto la fila dei blocchi. */
      final flusso = flussoInHome(
        quaderno.cambiate.containsKey(chiaveDelFlussoInHome)
            ? quaderno.cambiate[chiaveDelFlussoInHome]
            : scatto.aperto(chiaveDelFlussoInHome),
      );
      return [
        Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: SwitchListTile(
            value: flusso,
            onChanged: (acceso) =>
                quaderno.segna(chiaveDelFlussoInHome, acceso),
            title: const Text('Mostra il flusso dell\'energia'),
            subtitle: const Text(
              'Il disegno del flusso dal fotovoltaico alla casa, dalla casa '
              'alla batteria e all\'auto, accanto alle tessere della Home.',
            ),
          ),
        ),
        for (final (posto, quale) in fila.indexed)
          Card(
            margin: const EdgeInsets.symmetric(vertical: 4),
            child: ListTile(
              leading: CircleAvatar(radius: 15, child: Text('${posto + 1}')),
              title: Text(nomi[quale] ?? quale),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    onPressed: posto == 0
                        ? null
                        : () => quaderno.segna(
                            chiaveDeiBlocchi,
                            [...fila]..insert(posto - 1, fila[posto]),
                          ),
                    icon: const Icon(Icons.keyboard_arrow_up_rounded),
                    tooltip: 'Su',
                  ),
                  IconButton(
                    onPressed: posto == fila.length - 1
                        ? null
                        : () {
                            final dopo = [...fila]..removeAt(posto);
                            dopo.insert(posto + 1, quale);
                            quaderno.segna(chiaveDeiBlocchi, dopo);
                          },
                    icon: const Icon(Icons.keyboard_arrow_down_rounded),
                    tooltip: 'Giu\'',
                  ),
                ],
              ),
            ),
          ),
      ];
    },
  );
}

/// Le tessere della Home: quali si vedono, e quanto si stringono.
class SchermataDelleTessere extends StatelessWidget {
  const SchermataDelleTessere({super.key, required this.collegamento});

  final Collegamento collegamento;

  /// Le tessere che la plancia sa fare. Non e' un elenco chiuso — una versione
  /// nuova ne aggiunge — ma sono quelle che oggi si possono spegnere.
  static const _tessere = <(String, String, String)>[
    ('meteo', '🌤️', 'Meteo'),
    ('evidenza', '⭐', 'In evidenza'),
    ('energia', '⚡', 'Energia'),
    ('clima', '❄️', 'Clima'),
    ('temperatura', '🌡️', 'Temperature'),
    ('luci', '💡', 'Luci'),
    ('aperture', '🪟', 'Aperture'),
    ('sicurezza', '🛡️', 'Sicurezza'),
    ('porte', '🚪', 'Porte'),
    ('batterie', '🔋', 'Batterie'),
    ('aria', '🌬️', 'Qualita\' dell\'aria'),
    ('fumo', '🔥', 'Fumo'),
    ('allagamenti', '💧', 'Allagamenti'),
    ('acqua', '🚿', 'Acqua calda'),
    ('agenda', '📅', 'Agenda'),
    ('rifiuti', '♻️', 'Raccolta'),
    ('media', '🔊', 'Lettori'),
    ('ev', '🚗', 'Auto elettrica'),
    ('robot', '🤖', 'Robot'),
    ('ups', '🔌', 'UPS'),
    ('varchi', '🚪', 'Varchi'),
    ('presenza', '🏃', 'Presenza'),
    ('macchine', '🖥️', 'Server e rete'),
    ('vmc', '🔄', 'Ventilazione'),
    ('custom', '📌', 'Gli avvisi tuoi'),
  ];

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Le tessere della Home',
    sotto:
        'Ogni tessera legge la configurazione della sua sezione: senza una '
        'parola in contrario, quello che c\'e\' nella sezione finisce nella '
        'tessera. Qui si dice la parola in contrario.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final tessere = LeTessere.da(
        quaderno.cambiate[chiaveDelleTessereDellaHome] ??
            scatto.mappa(chiaveDelleTessereDellaHome),
      );
      void segna() =>
          quaderno.segna(chiaveDelleTessereDellaHome, tessere.daScrivere);
      return [
        Scheda(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Quando una tessera si stringe',
                style: Theme.of(dentro).textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                'Da sola quando ci sono tante cose da dire, e cosi\' ci stanno '
                'tutte; mai, e ognuna resta grande; sempre, e la Home e\' una '
                'griglia fitta.',
                style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                  color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 10),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'mai', label: Text('Mai')),
                  ButtonSegment(value: 'auto', label: Text('Da sola')),
                  ButtonSegment(value: 'sempre', label: Text('Sempre')),
                ],
                selected: {tessere.compatto},
                showSelectedIcon: false,
                onSelectionChanged: (scelta) {
                  tessere.compatto = scelta.first;
                  segna();
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        for (final (chiave, disegno, nome) in _tessere)
          Card(
            margin: const EdgeInsets.symmetric(vertical: 3),
            child: Column(
              children: [
                SwitchListTile(
                  value: tessere.siVede(chiave),
                  onChanged: (acceso) {
                    tessere.mostra(chiave, acceso);
                    segna();
                  },
                  secondary: Text(
                    disegno,
                    style: const TextStyle(fontSize: 22),
                  ),
                  title: Text(nome),
                  dense: true,
                ),
                /* «Cosa mostra» una tessera che riassume piu' cose.
                 *
                 * Vale per due sole: la Temperatura, che senza questa dice la
                 * media di tutte le stanze, e il Clima, che dice quella di
                 * tutte le unita'. Le altre non hanno niente da scegliere e
                 * nella dashboard non hanno la tendina. */
                if (tessere.siVede(chiave))
                  _CosaMostra(
                    tessera: chiave,
                    tessere: tessere,
                    scatto: scatto,
                    segna: segna,
                  ),
              ],
            ),
          ),
        const SizedBox(height: 16),
        Text(
          'Una tessera senza niente dentro non compare comunque: spegnerla '
          'serve a chi quella cosa ce l\'ha e non la vuole in prima pagina.',
          style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
            color: Theme.of(dentro).colorScheme.onSurfaceVariant,
            height: 1.4,
          ),
        ),
      ];
    },
  );
}

/// Una lista di entita' con nome e disegno: e' la forma che hanno quasi tutte
/// le liste della Home.
///
/// I lettori, i calendari, le liste della spesa, le entita' in evidenza, le
/// entita' messe a mano in una sezione: cambia cosa si chiede, non come si
/// aggiunge. Una schermata sola per sei, come per le famiglie.
class SchermataDiVoci extends StatefulWidget {
  const SchermataDiVoci({
    super.key,
    required this.titolo,
    required this.sotto,
    required this.chiave,
    required this.unaCosa,
    required this.prefisso,
    required this.collegamento,
    this.domini = const [],
    this.laSezione = false,
    this.ilColore = false,
    this.quante = 0,
    this.inItaliano = true,
    this.laStanza = false,
  });

  final String titolo;
  final String sotto;
  final String chiave;
  final String unaCosa;

  /// Come nascono gli identificativi: `lettore`, `cal`, `todo`, `mia`.
  final String prefisso;

  final Collegamento collegamento;
  final List<String> domini;

  /// `true` per le entita' mie, che dicono anche in che pagina stanno.
  final bool laSezione;

  /// `true` per i calendari, che hanno un colore per distinguerli quando ce
  /// n'e' piu' d'uno.
  final bool ilColore;

  /// Il tetto, se ce n'e' uno. Zero vuol dire nessuno.
  final int quante;

  /// Come si chiamano il nome e il disegno **dentro la configurazione**.
  ///
  /// Una schermata sola serve sei liste, e le sei non le chiamano allo stesso
  /// modo. I lettori, le entita' mie e le sezioni mie leggono `nome || name` e
  /// `icona || icon`: li' va bene tutto. I calendari e le liste di cose da
  /// fare leggono **solo** `name`; le entita' in evidenza leggono `name` e
  /// `icon`. Scrivendo sempre in italiano, il nome dato a un calendario o a
  /// una lista non lo vedeva nessuno — si salvava e la plancia continuava a
  /// mostrare il nome che l'entita' ha in Home Assistant.
  final bool inItaliano;

  /// `true` per i lettori: la stanza in cui sta la cassa. Nella Config della
  /// dashboard e' una tendina accanto all'entita' (`data-mp-campo="room_id"`).
  final bool laStanza;

  String get campoDelNome => inItaliano ? 'nome' : 'name';
  String get campoDelDisegno => inItaliano ? 'icona' : 'icon';

  @override
  State<SchermataDiVoci> createState() => _SchermataDiVociState();
}

class _SchermataDiVociState extends State<SchermataDiVoci> {
  List<Map<String, String>>? _voci;
  int _daQualeScatto = -1;

  List<Map<String, String>> _leggi(Scatto scatto) {
    if (_voci == null || _daQualeScatto != scatto.revisione) {
      _voci = leggiLeVoci(
        scatto.aperto(widget.chiave),
        widget.prefisso,
        campoDelNome: widget.campoDelNome,
        campoDelDisegno: widget.campoDelDisegno,
      );
      _daQualeScatto = scatto.revisione;
    }
    return _voci!;
  }

  void _segna(Quaderno quaderno) {
    quaderno.segna(widget.chiave, vociDaScrivere(_voci!));
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: widget.titolo,
    sotto: widget.sotto,
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final voci = _leggi(scatto);
      final cePosto = widget.quante == 0 || voci.length < widget.quante;
      return [
        if (voci.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.playlist_add_rounded,
              titolo: 'Non ce n\'e\' ancora',
              sotto: 'Aggiungi ${widget.unaCosa} qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, una) in voci.indexed)
            _UnaVoce(
              voce: una,
              quale: posto,
              unaCosa: widget.unaCosa,
              domini: widget.domini,
              laSezione: widget.laSezione,
              ilColore: widget.ilColore,
              laStanza: widget.laStanza,
              campoDelNome: widget.campoDelNome,
              campoDelDisegno: widget.campoDelDisegno,
              collegamento: widget.collegamento,
              cambiato: () => _segna(quaderno),
              sposta: (di) {
                final dove = posto + di;
                if (dove < 0 || dove >= voci.length) return;
                voci.insert(dove, voci.removeAt(posto));
                _segna(quaderno);
              },
              primo: posto == 0,
              ultimo: posto == voci.length - 1,
              togli: () {
                voci.removeAt(posto);
                _segna(quaderno);
              },
            ),
        const SizedBox(height: 12),
        if (cePosto)
          FilledButton.tonalIcon(
            onPressed: () {
              voci.add({
                'id': '${widget.prefisso}-${voci.length + 1}',
                'entity': '',
                widget.campoDelNome: '',
                widget.campoDelDisegno: '',
                if (widget.laSezione) 'sezione': '',
                if (widget.ilColore) 'colore': '',
                if (widget.laStanza) 'room_id': '',
              });
              _segna(quaderno);
            },
            icon: const Icon(Icons.add_rounded),
            label: Text('Aggiungi ${widget.unaCosa}'),
          )
        else
          Text(
            '${widget.quante} e\' il massimo.',
            style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
              color: Theme.of(dentro).colorScheme.onSurfaceVariant,
            ),
          ),
      ];
    },
  );
}

class _UnaVoce extends StatelessWidget {
  const _UnaVoce({
    required this.voce,
    required this.quale,
    required this.unaCosa,
    required this.domini,
    required this.laSezione,
    required this.ilColore,
    required this.laStanza,
    required this.campoDelNome,
    required this.campoDelDisegno,
    required this.collegamento,
    required this.cambiato,
    required this.sposta,
    required this.primo,
    required this.ultimo,
    required this.togli,
  });

  final Map<String, String> voce;
  final int quale;
  final String unaCosa;
  final List<String> domini;
  final bool laSezione;
  final bool ilColore;
  final bool laStanza;

  /// Come si chiamano quelle due caselle dentro la configurazione: vedi
  /// `SchermataDiVoci.inItaliano`.
  final String campoDelNome;
  final String campoDelDisegno;

  final Collegamento collegamento;
  final VoidCallback cambiato;
  final ValueChanged<int> sposta;
  final bool primo;
  final bool ultimo;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final entita = voce['entity'] ?? '';
    final nome = voce[campoDelNome] ?? '';
    final disegno = voce[campoDelDisegno] ?? '';
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        initiallyExpanded: entita.isEmpty,
        leading: disegno.isNotEmpty
            ? Text(disegno, style: const TextStyle(fontSize: 22))
            : null,
        title: Text(
          nome.isNotEmpty
              ? nome
              : (entita.isNotEmpty ? entita : 'Voce ${quale + 1}'),
        ),
        subtitle: Text(
          entita.isEmpty ? 'nessuna entita\'' : entita,
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          CampoDiEntita(
            etichetta: 'Quale entita\'',
            contesto: unaCosa,
            domini: domini,
            valore: entita,
            collegamento: collegamento,
            cambiato: (scritto) {
              voce['entity'] = scritto;
              cambiato();
            },
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                flex: 3,
                child: CampoDiTesto(
                  etichetta: 'Come si chiama',
                  valore: nome,
                  suggerimento: 'Lascia vuoto per il nome che ha in casa',
                  cambiato: (scritto) {
                    voce[campoDelNome] = scritto;
                    cambiato();
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: CampoDiTesto(
                  etichetta: 'Disegno',
                  valore: disegno,
                  suggerimento: '⭐',
                  cambiato: (scritto) {
                    voce[campoDelDisegno] = scritto;
                    cambiato();
                  },
                ),
              ),
            ],
          ),
          /* La stanza di una cassa: nella Config della dashboard e' una
           * tendina accanto all'entita', e serve alla pagina Media per
           * raggruppare gli altoparlanti per stanza. */
          if (laStanza) ...[
            const SizedBox(height: 14),
            CampoDiTesto(
              etichetta: 'In che stanza',
              valore: voce['room_id'] ?? '',
              suggerimento: 'Il nome della stanza, come l\'hai chiamata',
              cambiato: (scritto) {
                voce['room_id'] = scritto;
                cambiato();
              },
            ),
          ],
          if (laSezione) ...[
            const SizedBox(height: 14),
            CampoDiTesto(
              etichetta: 'In che pagina',
              valore: voce['sezione'] ?? '',
              suggerimento: 'home, energia, clima…',
              cambiato: (scritto) {
                voce['sezione'] = scritto;
                cambiato();
              },
            ),
          ],
          if (ilColore) ...[
            const SizedBox(height: 14),
            CampoDiTesto(
              etichetta: 'Colore',
              valore: voce['colore'] ?? '',
              mono: true,
              suggerimento: '#3b82f6',
              cambiato: (scritto) {
                voce['colore'] = scritto;
                cambiato();
              },
            ),
          ],
          const SizedBox(height: 8),
          Row(
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
              const Spacer(),
              TextButton.icon(
                onPressed: togli,
                icon: const Icon(Icons.delete_outline_rounded),
                label: const Text('Togli'),
                style: TextButton.styleFrom(foregroundColor: colori.error),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Le scelte della tendina «Cosa mostra», per le due tessere che riassumono.
///
/// La Temperatura senza scelta dice la media di tutte le stanze, il Clima
/// quella di tutte le unita'. Le voci si prendono da dove stanno gia': le
/// stanze che hanno un sensore di temperatura, e le unita' di clima
/// configurate. `null` per tutte le altre tessere, che nella dashboard non
/// hanno la tendina perche' non hanno niente da scegliere.
List<(String, String)>? _cosaMostra(String tessera, Scatto scatto) {
  String nomeDi(Map<String, dynamic> uno, String ripiego) {
    final nome = '${uno['name'] ?? ''}'.trim();
    return nome.isNotEmpty ? nome : ripiego;
  }

  if (tessera == 'temperatura') {
    final stanze = scatto.oggetti(Sezione.stanze.chiave);
    return [
      ('', 'Media di tutte le stanze'),
      for (final una in stanze)
        if ('${una['temp'] ?? ''}'.trim().isNotEmpty)
          ('${una['temp']}'.trim(), nomeDi(una, '${una['temp']}')),
    ];
  }
  if (tessera == 'clima') {
    final unita = scatto.oggetti(Sezione.clima.chiave);
    return [
      ('', 'Media di tutte le unita\''),
      for (final una in unita)
        if ('${una['entity'] ?? ''}'.trim().isNotEmpty)
          ('${una['entity']}'.trim(), nomeDi(una, '${una['entity']}')),
    ];
  }
  return null;
}

/// La tendina «Cosa mostra» di una tessera, quando quella tessera ce l'ha.
class _CosaMostra extends StatelessWidget {
  const _CosaMostra({
    required this.tessera,
    required this.tessere,
    required this.scatto,
    required this.segna,
  });

  final String tessera;
  final LeTessere tessere;
  final Scatto scatto;
  final VoidCallback segna;

  @override
  Widget build(BuildContext context) {
    final quali = _cosaMostra(tessera, scatto);
    /* Una tessera senza scelte non ha la tendina, e nemmeno una che ne ha una
     * sola: «media di tutte» da sola non e' una scelta. */
    if (quali == null || quali.length < 2) return const SizedBox.shrink();
    final adesso = tessere.sorgenti[tessera] ?? '';
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: DropdownButtonFormField<String>(
        initialValue: quali.any((una) => una.$1 == adesso) ? adesso : '',
        decoration: const InputDecoration(
          labelText: 'Cosa mostra',
          border: OutlineInputBorder(),
          isDense: true,
        ),
        items: [
          for (final (valore, comeSiChiama) in quali)
            DropdownMenuItem(value: valore, child: Text(comeSiChiama)),
        ],
        onChanged: (scelto) {
          if ((scelto ?? '').isEmpty) {
            tessere.sorgenti.remove(tessera);
          } else {
            tessere.sorgenti[tessera] = scelto!;
          }
          segna();
        },
      ),
    );
  }
}
