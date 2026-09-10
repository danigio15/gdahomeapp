/// Le schede che correggono un rilevamento: i varchi, la presenza, le
/// macchine e la rete, le batterie.
///
/// Non c'e' niente da configurare per cominciare: un contatto lo dichiara
/// Home Assistant col suo `device_class`, e chi ne ha uno se lo ritrova. Qui
/// si dice quale **non** conta, quale aggiungere a mano, come si chiama. E'
/// la stessa scheda per tutte e quattro, perche' e' lo stesso problema — e
/// chi ne ha imparata una sa gia' usare le altre.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../../casa/catalogo/catalogo.dart';
import '../../casa/collegamento.dart';
import '../../casa/entita.dart';
import '../../casa/plancia/correzioni.dart';
import '../../casa/plancia/home.dart'
    show
        chiaveDeiGruppiDiLuci,
        chiaveDeiGruppiDiLuciTolti,
        chiaveDeiNomiDegliAvvisi;
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/* ─── Varchi e presenza ──────────────────────────────────────────────────── */

/// La scheda dei varchi (#367, #377) e quella della presenza (#432): una
/// schermata sola, che cambia parole e regola di rilevamento.
class SchermataDelleCorrezioni extends StatelessWidget {
  const SchermataDelleCorrezioni({
    super.key,
    required this.titolo,
    required this.sotto,
    required this.chiave,
    required this.collegamento,
    required this.tessera,
    required this.rilevata,
    required this.disegno,
    required this.unaCosa,
    required this.aggiungi,
    required this.esempio,
    required this.elenco,
    required this.vuoto,
    required this.acceso,
    required this.spento,
  });

  final String titolo;
  final String sotto;
  final String chiave;
  final Collegamento collegamento;

  /// La tessera della Home di cui parlano queste entita' (`varchi`,
  /// `presenza`): l'interruttore «nel widget» di ogni riga scrive quella.
  final String tessera;

  /// Se un'entita' di casa conta da sola, per quello che ne dice Home
  /// Assistant.
  final bool Function(Entita) rilevata;

  /// Il disegno, dalla classe.
  final String Function(String classe) disegno;

  final String unaCosa;

  /// Le parole della Config: la casella di aggiunta, l'esempio in grigio, il
  /// titolo dell'elenco, il vuoto, e come si dice acceso e spento.
  final String aggiungi;
  final String esempio;
  final String elenco;
  final String vuoto;
  final String acceso;
  final String spento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: titolo,
    sotto: sotto,
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final scelte = Correzioni.da(
        quaderno.cambiate[chiave] ?? scatto.aperto(chiave),
      );
      void segna() => quaderno.segna(chiave, scelte.daScrivere);
      final casa = collegamento.stato?.tutte() ?? const <Entita>[];
      final righe = entitaCheContano(casa, scelte, rilevata: rilevata);
      return [
        _Aggiungi(
          etichetta: aggiungi,
          esempio: esempio,
          domini: const ['binary_sensor'],
          collegamento: collegamento,
          aggiungi: (id, _) {
            scelte.aggiungi(id);
            segna();
          },
        ),
        const SizedBox(height: 20),
        Insegna(elenco),
        if (righe.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: StatoVuoto(
              icona: Icons.sensors_off_rounded,
              titolo: vuoto,
              sotto: 'Quello che Home Assistant dichiara compare da solo.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final una in righe)
            _Riga(
              glifo: disegno('${una.attributi['device_class'] ?? ''}'),
              entita: una,
              nome: scelte.nomi[una.id] ?? '',
              aMano: scelte.aggiunte.contains(una.id),
              tessera: TesseraDelCampo(
                tessera,
                scatto: scatto,
                quaderno: quaderno,
              ),
              stato: una.muta ? '' : (una.accesa ? acceso : spento),
              chiama: (nome) {
                scelte.chiama(una.id, nome);
                segna();
              },
              togli: () {
                scelte.togli(una.id);
                segna();
              },
            ),
        if (scelte.escluse.isNotEmpty) ...[
          const SizedBox(height: 20),
          const Insegna('Tolti dai conti'),
          _Tolte(
            quali: scelte.escluse,
            rimetti: (id) {
              scelte.rimetti(id);
              segna();
            },
          ),
        ],
      ];
    },
  );
}

/* ─── Le macchine e la rete (#382) ───────────────────────────────────────── */

/// I container del server e i ripetitori del router: si adottano per
/// integrazione, non uno alla volta.
class SchermataDelleMacchine extends StatefulWidget {
  const SchermataDelleMacchine({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDelleMacchine> createState() => _SchermataDelleMacchineState();
}

class _SchermataDelleMacchineState extends State<SchermataDelleMacchine> {
  /// Di che integrazione e' ogni candidata: `{binary_sensor.x: proxmoxve}`.
  Map<String, String> _piattaforme = const {};

  /// Come si chiama un'integrazione: `{proxmoxve: 'Proxmox VE'}`.
  Map<String, String> _nomi = const {};
  bool _chiesto = false;

  /* Le candidate della casa: i `binary_sensor` con una delle due classi. La
   * classe da sola non basta — la mette anche la lavatrice — e per questo si
   * chiede al ponte di chi sono. */
  List<Entita> _candidate() => [
    for (final una in widget.collegamento.stato?.tutte() ?? const <Entita>[])
      if (famigliaCandidata(una).isNotEmpty) una,
  ];

  Future<void> _chiediDiChiSono() async {
    if (_chiesto) return;
    _chiesto = true;
    final filo = widget.collegamento.filo;
    if (filo == null) return;
    final candidate = _candidate();
    if (candidate.isEmpty) return;
    try {
      final letto = await chiediIlCatalogo(
        filo,
        entita: [for (final una in candidate) una.id],
      );
      if (!mounted) return;
      setState(() {
        _piattaforme = {
          for (final righe in letto.entita.values)
            for (final una in righe)
              if (una.piattaforma.isNotEmpty) una.id: una.piattaforma,
        };
        _nomi = {for (final una in letto.integrazioni) una.dominio: una.nome};
      });
    } on Object {
      /* Senza risposta le integrazioni non si vedono: si vedono le entita'
       * una per una, che e' comunque una strada. */
    }
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Le macchine e la rete',
    sotto:
        'I container di Proxmox e i ripetitori del router. Si spuntano le '
        'integrazioni — «Proxmox VE», «FritzBox» — invece di escludere trenta '
        'entita\' una alla volta: un container nuovo entra da solo, una '
        'lavatrice nuova resta fuori da sola.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      unawaited(_chiediDiChiSono());
      final scelte = Macchine.da(
        quaderno.cambiate[chiaveDelleMacchine] ??
            scatto.aperto(chiaveDelleMacchine),
      );
      void segna() => quaderno.segna(chiaveDelleMacchine, scelte.daScrivere);
      final candidate = _candidate();
      /* Le integrazioni fra cui scegliere: quelle che hanno almeno una
       * candidata, con quante macchine e quante voci di rete portano. */
      final perIntegrazione = <String, (int, int)>{};
      for (final una in candidate) {
        final dominio = _piattaforme[una.id] ?? '';
        if (dominio.isEmpty) continue;
        final (macchine, rete) = perIntegrazione[dominio] ?? (0, 0);
        perIntegrazione[dominio] = famigliaCandidata(una) == 'rete'
            ? (macchine, rete + 1)
            : (macchine + 1, rete);
      }
      for (final dominio in scelte.integrazioni) {
        perIntegrazione.putIfAbsent(dominio, () => (0, 0));
      }
      final domini = perIntegrazione.keys.toList()..sort();
      /* Cosa si vede: le candidate delle integrazioni scelte, piu' le
       * aggiunte a mano, meno le escluse. */
      final righe = <(Entita, String, bool)>[];
      final viste = <String>{};
      for (final una in candidate) {
        if (scelte.escluse.contains(una.id)) continue;
        final adottata = scelte.integrazioni.contains(
          _piattaforme[una.id] ?? '',
        );
        final aMano = scelte.aggiunte.containsKey(una.id);
        if (!adottata && !aMano) continue;
        viste.add(una.id);
        righe.add((
          una,
          scelte.aggiunte[una.id] ?? famigliaCandidata(una),
          aMano,
        ));
      }
      for (final voce in scelte.aggiunte.entries) {
        if (viste.contains(voce.key) || scelte.escluse.contains(voce.key)) {
          continue;
        }
        righe.add((
          widget.collegamento.stato?[voce.key] ??
              Entita(id: voce.key, stato: 'unavailable', attributi: const {}),
          voce.value,
          true,
        ));
      }
      return [
        const Insegna('Da quali integrazioni'),
        if (domini.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
            child: Text(
              candidate.isEmpty
                  ? 'In casa non c\'e\' nessun sensore di stato di una macchina '
                        'o di una connessione: quando ce ne sara\' uno comparira\' qui.'
                  : 'Sto chiedendo al ponte di chi sono i sensori…',
              style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                height: 1.4,
              ),
            ),
          )
        else
          Scheda(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final dominio in domini)
                  CheckboxListTile(
                    value: scelte.integrazioni.contains(dominio),
                    onChanged: (scelta) {
                      scelte.scegliIntegrazione(dominio, scelta == true);
                      segna();
                    },
                    title: Text(_nomi[dominio] ?? dominio),
                    subtitle: Text(
                      '$dominio · 📦 ${perIntegrazione[dominio]!.$1} · '
                      '📶 ${perIntegrazione[dominio]!.$2}',
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 20),
        _Aggiungi(
          etichetta: 'Aggiungi quello che non viene trovato',
          esempio: 'binary_sensor.pve_lxc_101_status',
          domini: const ['binary_sensor'],
          collegamento: widget.collegamento,
          famiglie: famiglieDelleMacchine,
          aggiungi: (id, famiglia) {
            scelte.aggiungi(id, famiglia);
            segna();
          },
        ),
        for (final (famiglia, _, glifo, parola) in famiglieDelleMacchine) ...[
          const SizedBox(height: 20),
          Insegna('$glifo $parola'),
          if (!righe.any((riga) => riga.$2 == famiglia))
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
              child: Text(
                'Niente trovato',
                style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                  color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                ),
              ),
            )
          else
            for (final (una, quale, aMano) in righe)
              if (quale == famiglia)
                _Riga(
                  glifo: glifo,
                  entita: una,
                  nome: scelte.nomi[una.id] ?? '',
                  aMano: aMano,
                  /* La scheda delle macchine si marchia «macchine»
                   * (`macchine-editor-section.js`): la tessera in Home e'
                   * quella, non il MiniPC in cui la scheda sta. */
                  tessera: TesseraDelCampo(
                    'macchine',
                    scatto: scatto,
                    quaderno: quaderno,
                  ),
                  stato: una.muta ? '' : (una.accesa ? 'acceso' : 'spento'),
                  chiama: (nome) {
                    scelte.chiama(una.id, nome);
                    segna();
                  },
                  togli: () {
                    scelte.togli(una.id);
                    segna();
                  },
                ),
        ],
        if (scelte.escluse.isNotEmpty) ...[
          const SizedBox(height: 20),
          Insegna('Tolte a mano · ${scelte.escluse.length}'),
          _Tolte(
            quali: scelte.escluse,
            rimetti: (id) {
              scelte.rimetti(id);
              segna();
            },
          ),
        ],
      ];
    },
  );
}

/* ─── Le batterie (#398) ─────────────────────────────────────────────────── */

/// Le pile di casa: sotto quanto avvisare, quali contare, come si chiamano.
///
/// La soglia ha una chiave sua (`cd_batterie`); quali si aggiungono, quali
/// si tolgono e come si chiamano stanno nelle chiavi che la plancia usa per
/// ogni gruppo sorvegliato — `cd_gruppi_extra`, `cd_gruppi_removed`,
/// `cd_avvisi_names_extra` — sotto il gruppo `batt`. Scriverne di nuove
/// vorrebbe dire due elenchi per la stessa casa.
class SchermataDelleBatterie extends StatelessWidget {
  const SchermataDelleBatterie({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Le batterie',
    sotto:
        'Le batterie la plancia le trova da sola — un sensore in percentuale '
        'marcato «battery» — e avvisa quando una scende sotto la soglia. Qui '
        'si sceglie la soglia, si aggiunge quella che non trova, si toglie '
        'quella che non conta, e si da\' un nome a «Sensor 4B».',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      Map<String, dynamic> mappa(String chiave) {
        final segnata = quaderno.cambiate[chiave];
        return Map<String, dynamic>.from(
          segnata is Map ? segnata : scatto.mappa(chiave),
        );
      }

      List<String> gruppo(String chiave) => [
        for (final una
            in (mappa(chiave)[gruppoDelleBatterie] as List? ?? const []))
          if ('$una'.trim().isNotEmpty) '$una'.trim(),
      ];

      void scriviGruppo(String chiave, List<String> valori) => quaderno.segna(
        chiave,
        {...mappa(chiave), gruppoDelleBatterie: valori.toSet().toList()},
      );

      final soglia = sogliaDelleBatterie(
        quaderno.cambiate[chiaveDelleBatterie] ??
            scatto.aperto(chiaveDelleBatterie),
      );
      final aggiunte = gruppo(chiaveDeiGruppiDiLuci);
      final tolte = gruppo(chiaveDeiGruppiDiLuciTolti);
      final nomi = mappa(chiaveDeiNomiDegliAvvisi);
      final casa = collegamento.stato?.tutte() ?? const <Entita>[];
      /* L'elenco: prima le aggiunte a mano, poi quelle che la casa dichiara,
       * senza doppioni e meno le tolte — nell'ordine in cui le legge la
       * plancia (`batterieDiCasa`), e poi per livello, le mute in fondo. */
      final viste = <String>{};
      final righe = <(Entita, bool)>[];
      for (final id in aggiunte) {
        if (tolte.contains(id) || !viste.add(id)) continue;
        righe.add((
          collegamento.stato?[id] ??
              Entita(id: id, stato: 'unavailable', attributi: const {}),
          true,
        ));
      }
      for (final una in casa) {
        if (!eUnaBatteria(una) ||
            tolte.contains(una.id) ||
            !viste.add(una.id)) {
          continue;
        }
        righe.add((una, false));
      }
      righe.sort((a, b) {
        final la = livelloDellaBatteria(a.$1);
        final lb = livelloDellaBatteria(b.$1);
        if (la == null && lb == null) return a.$1.nome.compareTo(b.$1.nome);
        if (la == null) return 1;
        if (lb == null) return -1;
        return la.compareTo(lb);
      });
      return [
        Scheda(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CampoDiTesto(
                etichetta: 'Da cambiare sotto il (%)',
                valore: '$soglia',
                numerico: true,
                cambiato: (scritto) => quaderno.segna(chiaveDelleBatterie, {
                  ...mappa(chiaveDelleBatterie),
                  'soglia': sogliaDelleBatterie({'soglia': scritto}),
                }),
              ),
              const SizedBox(height: 6),
              Text(
                'Da 1 a $sogliaMassimaDelleBatterie. Venti e\' il valore di '
                'serie: sotto il venti per cento una pila la si compra.',
                style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                  color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _Aggiungi(
          etichetta: 'Aggiungi una batteria che non viene trovata',
          esempio: 'sensor.serratura_batteria',
          domini: const ['sensor'],
          collegamento: collegamento,
          aggiungi: (id, _) {
            scriviGruppo(chiaveDeiGruppiDiLuci, [...aggiunte, id]);
            scriviGruppo(chiaveDeiGruppiDiLuciTolti, [...tolte]..remove(id));
          },
        ),
        const SizedBox(height: 20),
        const Insegna('Le batterie di casa'),
        if (righe.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: StatoVuoto(
              icona: Icons.battery_unknown_rounded,
              titolo: 'Nessuna batteria trovata',
              sotto:
                  'Quelle in percentuale marcate «battery» compaiono da sole.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (una, aMano) in righe)
            _Riga(
              glifo: '🔋',
              entita: una,
              nome: '${nomi[una.id] ?? ''}',
              aMano: aMano,
              tessera: TesseraDelCampo(
                'batterie',
                scatto: scatto,
                quaderno: quaderno,
              ),
              stato: livelloDellaBatteria(una) == null
                  ? ''
                  : '${livelloDellaBatteria(una)!.round()}%',
              scarica: (livelloDellaBatteria(una) ?? 100) <= soglia,
              chiama: (nome) {
                final dopo = Map<String, dynamic>.from(nomi);
                if (nome.trim().isEmpty) {
                  dopo.remove(una.id);
                } else {
                  dopo[una.id] = nome.trim();
                }
                quaderno.segna(chiaveDeiNomiDegliAvvisi, dopo);
              },
              togli: () {
                scriviGruppo(chiaveDeiGruppiDiLuciTolti, [...tolte, una.id]);
                scriviGruppo(
                  chiaveDeiGruppiDiLuci,
                  [...aggiunte]..remove(una.id),
                );
              },
            ),
        if (tolte.isNotEmpty) ...[
          const SizedBox(height: 20),
          const Insegna('Tolte dai conti'),
          _Tolte(
            quali: tolte,
            rimetti: (id) => scriviGruppo(
              chiaveDeiGruppiDiLuciTolti,
              [...tolte]..remove(id),
            ),
          ),
        ],
      ];
    },
  );
}

/* ─── I pezzi in comune ──────────────────────────────────────────────────── */

/// La casella «aggiungi quello che non viene trovato», col cercatore.
class _Aggiungi extends StatefulWidget {
  const _Aggiungi({
    required this.etichetta,
    required this.esempio,
    required this.domini,
    required this.collegamento,
    required this.aggiungi,
    this.famiglie = const [],
  });

  final String etichetta;
  final String esempio;
  final List<String> domini;
  final Collegamento collegamento;
  final void Function(String id, String famiglia) aggiungi;

  /// Per le macchine: di che famiglia e' quello che si aggiunge.
  final List<(String, String, String, String)> famiglie;

  @override
  State<_Aggiungi> createState() => _AggiungiState();
}

class _AggiungiState extends State<_Aggiungi> {
  String _scritto = '';
  String _famiglia = 'macchine';
  int _giro = 0;

  @override
  Widget build(BuildContext context) => Scheda(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          widget.etichetta,
          style: Theme.of(context).textTheme.titleSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        CampoDiEntita(
          key: ValueKey('aggiungi-$_giro'),
          etichetta: 'Entita\'',
          contesto: widget.etichetta,
          esempio: widget.esempio,
          domini: widget.domini,
          valore: _scritto,
          collegamento: widget.collegamento,
          cambiato: (scritto) => setState(() => _scritto = scritto.trim()),
        ),
        if (widget.famiglie.isNotEmpty) ...[
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _famiglia,
            decoration: const InputDecoration(
              labelText: 'Di che cosa si tratta',
              border: OutlineInputBorder(),
              isDense: true,
            ),
            items: [
              for (final (chiave, _, glifo, parola) in widget.famiglie)
                DropdownMenuItem(value: chiave, child: Text('$glifo $parola')),
            ],
            onChanged: (scelto) =>
                setState(() => _famiglia = scelto ?? 'macchine'),
          ),
        ],
        const SizedBox(height: 10),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.tonalIcon(
            onPressed: _scritto.contains('.')
                ? () {
                    widget.aggiungi(_scritto, _famiglia);
                    setState(() {
                      _scritto = '';
                      _giro += 1;
                    });
                  }
                : null,
            icon: const Icon(Icons.add_rounded, size: 18),
            label: const Text('Aggiungi'),
          ),
        ),
      ],
    ),
  );
}

/// Una riga: il disegno, il nome che si puo' riscrivere, l'entita', come sta,
/// e il cestino.
class _Riga extends StatelessWidget {
  const _Riga({
    required this.glifo,
    required this.entita,
    required this.nome,
    required this.aMano,
    required this.stato,
    required this.chiama,
    required this.togli,
    required this.tessera,
    this.scarica = false,
  });

  final String glifo;
  final Entita entita;
  final String nome;
  final bool aMano;
  final String stato;
  final bool scarica;

  /// Di quale tessera parla la riga: l'interruttore «nel widget» sta qui.
  final TesseraDelCampo tessera;
  final ValueChanged<String> chiama;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(glifo, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CampoDiTesto(
                    etichetta: 'Nome',
                    valore: nome,
                    suggerimento: entita.nome,
                    cambiato: chiama,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${entita.id}${aMano ? ' · aggiunto a mano' : ''}',
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                      fontFamily: 'monospace',
                      fontSize: 11.5,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  InterruttoreDellaTessera(
                    tessera: tessera.nome,
                    entita: [entita.id],
                    scatto: tessera.scatto,
                    quaderno: tessera.quaderno,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            if (stato.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: scarica
                      ? colori.errorContainer
                      : colori.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  stato,
                  style: testi.labelSmall?.copyWith(
                    color: scarica ? colori.onErrorContainer : null,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            IconButton(
              onPressed: togli,
              icon: const Icon(Icons.delete_outline_rounded),
              color: colori.error,
              tooltip: 'Togli dall\'elenco',
            ),
          ],
        ),
      ),
    );
  }
}

/// Le tolte a mano, come pastiglie con la crocetta per rimetterle.
class _Tolte extends StatelessWidget {
  const _Tolte({required this.quali, required this.rimetti});

  final List<String> quali;
  final ValueChanged<String> rimetti;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: [
      for (final una in quali)
        InputChip(
          label: Text(una, style: const TextStyle(fontSize: 12)),
          deleteButtonTooltipMessage: 'Rimetti',
          onDeleted: () => rimetti(una),
        ),
    ],
  );
}
