/// La sicurezza e il caldo: le schermate.
///
/// I tasti dell'antifurto, le porte che si aprono col PIN, le allerte, la
/// caldaia e le cose che scaldano. Cinque schermate che nella plancia sono
/// cinque schede, e nell'app non c'erano.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/caldo.dart';
import '../../casa/plancia/scatto.dart';
import '../../casa/plancia/sicurezza.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

/// Quali tasti dell'allarme si vogliono vedere.
class SchermataDeiModi extends StatelessWidget {
  const SchermataDeiModi({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'I tasti dell\'allarme',
    sotto:
        'La centrale dice cosa accetta; tu decidi cosa ti serve. Chi in '
        'vacanza non ci va mai si ritrova due tasti che non premera\' mai, e '
        'in fondo alla fila quello che usa ogni sera. Togliere un tasto non '
        'cambia niente di quello che la centrale sa fare, e lo sblocco resta '
        'sempre.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final nascosti = modiNascosti(
        quaderno.cambiate[chiaveDeiModi] ?? scatto.aperto(chiaveDeiModi),
      );
      return [
        for (final (modo, disegno, nome) in modiDellAntifurto)
          Card(
            margin: const EdgeInsets.symmetric(vertical: 3),
            child: SwitchListTile(
              value: !nascosti.contains(modo),
              onChanged: (acceso) => quaderno.segna(
                chiaveDeiModi,
                conIlModo(nascosti, modo, acceso),
              ),
              secondary: Text(disegno, style: const TextStyle(fontSize: 24)),
              title: Text(nome),
            ),
          ),
        const SizedBox(height: 16),
        Text(
          'Un tasto che la tua centrale non accetta non compare comunque: '
          'questa e\' la scelta di cosa vedere fra quelli che accetta.',
          style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
            color: Theme.of(dentro).colorScheme.onSurfaceVariant,
            height: 1.4,
          ),
        ),
      ];
    },
  );
}

/// Le porte da sorvegliare, e quelle che si aprono da qui.
class SchermataDellePorte extends StatefulWidget {
  const SchermataDellePorte({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDellePorte> createState() => _SchermataDellePorteState();
}

class _SchermataDellePorteState extends State<SchermataDellePorte> {
  List<Map<String, dynamic>>? _porte;
  int _daQualeScatto = -1;

  List<Map<String, dynamic>> _leggi(Scatto scatto) {
    if (_porte == null || _daQualeScatto != scatto.revisione) {
      /* Le righe si tengono grezze: una porta appena aggiunta e' vuota, e
       * normalizzare — che le righe non valide le scarta — la farebbe sparire
       * prima che si possa compilarla. */
      _porte = scatto.oggetti(chiaveDellePorte);
      _daQualeScatto = scatto.revisione;
    }
    return _porte!;
  }

  void _segna(Quaderno quaderno) {
    quaderno.segna(chiaveDellePorte, _porte);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Porte da sorvegliare',
    sotto:
        'Serratura, pulsante, rele\', cancello o script. Finche\' non scegli '
        'l\'entita\' l\'apertura non si vede da nessuna parte.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final porte = _leggi(scatto);
      final conferma = siChiedeConferma(
        quaderno.cambiate[chiaveDellaConferma] ??
            scatto.aperto(chiaveDellaConferma),
      );
      return [
        Scheda(
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: conferma,
            onChanged: (acceso) => quaderno.segna(chiaveDellaConferma, acceso),
            title: const Text('Chiedi conferma prima di aprire'),
            subtitle: const Text(
              'Chi tocca per sbaglio se ne accorge dopo, davanti a un cancello '
              'aperto. Ma chi apre il proprio portone dieci volte al giorno la '
              'conferma la conosce a memoria. Il PIN non e\' una conferma e '
              'non si spegne da qui: quella e\' una chiave.',
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (porte.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.door_front_door_outlined,
              titolo: 'Non c\'e\' ancora nessuna porta',
              sotto: 'Aggiungine una qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, porta) in porte.indexed)
            _UnaPorta(
              porta: porta,
              quale: posto,
              collegamento: widget.collegamento,
              cambiato: () => _segna(quaderno),
              togli: () {
                porte.removeAt(posto);
                _segna(quaderno);
              },
            ),
        const SizedBox(height: 12),
        FilledButton.tonalIcon(
          onPressed: () {
            porte.add({'name': '', 'entity': '', 'icon': iconaDellaPorta});
            _segna(quaderno);
          },
          icon: const Icon(Icons.add_rounded),
          label: const Text('Aggiungi una porta'),
        ),
      ];
    },
  );
}

class _UnaPorta extends StatelessWidget {
  const _UnaPorta({
    required this.porta,
    required this.quale,
    required this.collegamento,
    required this.cambiato,
    required this.togli,
  });

  final Map<String, dynamic> porta;
  final int quale;
  final Collegamento collegamento;
  final VoidCallback cambiato;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final nome = '${porta['name'] ?? ''}'.trim();
    final entita = '${porta['entity'] ?? ''}'.trim();
    final pin = '${porta['pin'] ?? ''}'.trim();
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        initiallyExpanded: entita.isEmpty,
        title: Text(
          nome.isNotEmpty
              ? nome
              : (entita.isNotEmpty ? entita : 'Porta ${quale + 1}'),
        ),
        subtitle: Text(
          entita.isEmpty
              ? 'nessuna entita\': non si vede da nessuna parte'
              : '$entita${pin.isNotEmpty ? ' · 🔒 PIN' : ''}',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          Row(
            children: [
              Expanded(
                flex: 3,
                child: CampoDiTesto(
                  etichetta: 'Nome',
                  valore: nome,
                  suggerimento: 'Portone condominio',
                  cambiato: (scritto) {
                    porta['name'] = scritto;
                    cambiato();
                  },
                ),
              ),
              const SizedBox(width: 10),
              /* Il disegno: nella Config della dashboard e' una casella
               * (`data-door-field="icon"`), e qui era fisso a 🚪 — il cancello
               * e il portone del garage si somigliavano tutti. */
              Expanded(
                child: CampoDiTesto(
                  etichetta: 'Disegno',
                  valore: '${porta['icon'] ?? ''}',
                  suggerimento: iconaDellaPorta,
                  cambiato: (scritto) {
                    porta['icon'] = scritto;
                    cambiato();
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          CampoDiEntita(
            etichetta: 'Entita\' che apre',
            contesto: 'che apre una porta',
            domini: const ['lock', 'button', 'switch', 'cover', 'script'],
            valore: entita,
            collegamento: collegamento,
            cambiato: (scritto) {
              porta['entity'] = scritto;
              cambiato();
            },
          ),
          const SizedBox(height: 14),
          CampoDiTesto(
            etichetta: 'PIN (facoltativo)',
            valore: pin,
            mono: true,
            numerico: true,
            suggerimento: '1234',
            cambiato: (scritto) {
              porta['pin'] = scritto.trim();
              cambiato();
            },
          ),
          const SizedBox(height: 4),
          Text(
            ilPinVaBene(pin)
                ? 'Da 4 a 8 cifre: prima di aprire viene chiesto il codice, '
                      'contro i tocchi accidentali. Vuoto = solo conferma.'
                : 'Un PIN e\' da 4 a 8 cifre: cosi\' com\'e\' non verra\' '
                      'chiesto.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: ilPinVaBene(pin) ? colori.onSurfaceVariant : colori.error,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: togli,
              icon: const Icon(Icons.delete_outline_rounded),
              label: const Text('Togli'),
              style: TextButton.styleFrom(foregroundColor: colori.error),
            ),
          ),
        ],
      ),
    );
  }
}

/// Le allerte: sei categorie, ognuna con la sua entita'.
class SchermataDelleAllerte extends StatelessWidget {
  const SchermataDelleAllerte({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Allerte meteo',
    sotto:
        'Terremoti, allerte meteo, fulmini, pollini, comfort e voli. Basta '
        'l\'entita\' principale: le caselle in piu\' servono a chi ha '
        'l\'informazione spezzata in piu\' sensori.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final segnate = quaderno.cambiate[chiaveDelleAllerte];
      final allerte = leggiLeAllerte(
        segnate ?? scatto.mappa(chiaveDelleAllerte),
      );
      final quante = allerteConfigurate(allerte).length;
      void segna() =>
          quaderno.segna(chiaveDelleAllerte, allerteDaScrivere(allerte));
      return [
        Scheda(
          colore: Theme.of(dentro).colorScheme.surfaceContainerHigh,
          child: Text(
            quante == 0
                ? 'Nessuna allerta configurata'
                : '$quante su ${categorieDelleAllerte.length} configurate',
            style: Theme.of(dentro).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 8),
        for (final (chiave, disegno, nome, caselle) in categorieDelleAllerte)
          Card(
            margin: const EdgeInsets.symmetric(vertical: 4),
            clipBehavior: Clip.antiAlias,
            child: ExpansionTile(
              initiallyExpanded: (allerte[chiave]?['entity'] ?? '').isNotEmpty,
              leading: Text(disegno, style: const TextStyle(fontSize: 24)),
              title: Text(nome),
              subtitle: Text(
                (allerte[chiave]?['entity'] ?? '').isEmpty
                    ? 'non configurata'
                    : allerte[chiave]!['entity']!,
                style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                  color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                ),
              ),
              childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              children: [
                CampoDiTesto(
                  etichetta: 'Come si chiama',
                  valore: allerte[chiave]?['nome'] ?? '',
                  suggerimento: nome,
                  cambiato: (scritto) {
                    allerte[chiave]!['nome'] = scritto;
                    segna();
                  },
                ),
                const SizedBox(height: 14),
                for (final (casella, etichetta) in caselle) ...[
                  CampoDiEntita(
                    etichetta: etichetta,
                    contesto: 'per le allerte $nome',
                    domini: const ['sensor', 'binary_sensor'],
                    valore: allerte[chiave]?[casella] ?? '',
                    collegamento: collegamento,
                    cambiato: (scritto) {
                      allerte[chiave]![casella] = scritto;
                      segna();
                    },
                  ),
                  const SizedBox(height: 14),
                ],
              ],
            ),
          ),
      ];
    },
  );
}

/// La caldaia: mandata, ritorno, pressione, e cosa c'e' all'altro capo.
class SchermataDellaCaldaia extends StatefulWidget {
  const SchermataDellaCaldaia({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDellaCaldaia> createState() => _SchermataDellaCaldaiaState();
}

class _SchermataDellaCaldaiaState extends State<SchermataDellaCaldaia> {
  List<Map<String, String>>? _caldaie;
  int _daQualeScatto = -1;

  List<Map<String, String>> _leggi(Scatto scatto) {
    if (_caldaie == null || _daQualeScatto != scatto.revisione) {
      _caldaie = leggiLeCaldaie(scatto.aperto(chiaveDellaCaldaia));
      _daQualeScatto = scatto.revisione;
    }
    return _caldaie!;
  }

  void _segna(Quaderno quaderno) {
    quaderno.segna(chiaveDellaCaldaia, caldaieDaScrivere(_caldaie!));
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'La caldaia',
    sotto:
        'Mandata e ritorno prima di tutto: la differenza fra i due dice se '
        'l\'impianto sta cedendo calore o sta girando a vuoto, ed e\' la '
        'ragione per cui si apre questa pagina.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final caldaie = _leggi(scatto);
      return [
        if (caldaie.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: StatoVuoto(
              icona: Icons.local_fire_department_outlined,
              titolo: 'Non c\'e\' ancora nessuna caldaia',
              sotto: 'Aggiungine una qui sotto.',
              dentroUnaLista: true,
            ),
          )
        else
          for (final (posto, una) in caldaie.indexed)
            _UnaCaldaia(
              caldaia: una,
              quale: posto,
              collegamento: widget.collegamento,
              cambiato: () => _segna(quaderno),
              togli: () {
                caldaie.removeAt(posto);
                _segna(quaderno);
              },
            ),
        const SizedBox(height: 12),
        FilledButton.tonalIcon(
          onPressed: () {
            caldaie.add({
              ...leggiUnaCaldaia(const {}),
              'id': 'caldaia-${caldaie.length + 1}',
            });
            _segna(quaderno);
          },
          icon: const Icon(Icons.add_rounded),
          label: const Text('Aggiungi una caldaia'),
        ),
      ];
    },
  );
}

class _UnaCaldaia extends StatelessWidget {
  const _UnaCaldaia({
    required this.caldaia,
    required this.quale,
    required this.collegamento,
    required this.cambiato,
    required this.togli,
  });

  final Map<String, String> caldaia;
  final int quale;
  final Collegamento collegamento;
  final VoidCallback cambiato;
  final VoidCallback togli;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final piene = [
      for (final (campo, _, _, _) in caselleDellaCaldaia)
        if ((caldaia[campo] ?? '').isNotEmpty) campo,
    ].length;
    final nome = (caldaia['name'] ?? '').isNotEmpty
        ? caldaia['name']!
        : 'Caldaia ${quale + 1}';
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        initiallyExpanded: piene == 0,
        title: Text(nome),
        subtitle: Text(
          '$piene su ${caselleDellaCaldaia.length} riempite',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          CampoDiTesto(
            etichetta: 'Come si chiama',
            valore: caldaia['name'] ?? '',
            suggerimento: 'Caldaia',
            cambiato: (scritto) {
              caldaia['name'] = scritto;
              cambiato();
            },
          ),
          const SizedBox(height: 14),
          Text(
            'Cosa c\'e\' all\'altro capo del tubo',
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const SizedBox(height: 6),
          /* «Richiesta di visualizzare o radiatore o boiler»: la scena
           * disegnava sempre un radiatore, e chi ha una caldaia che serve solo
           * l'accumulo sanitario ci vedeva un termosifone che non ha. */
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'radiatori', label: Text('Radiatori')),
              ButtonSegment(value: 'boiler', label: Text('Boiler')),
            ],
            selected: {caldaia['uscita'] ?? usciteDellaCaldaia.first},
            showSelectedIcon: false,
            onSelectionChanged: (scelta) {
              caldaia['uscita'] = scelta.first;
              cambiato();
            },
          ),
          const SizedBox(height: 16),
          for (final (campo, etichetta, _, domini) in caselleDellaCaldaia) ...[
            CampoDiEntita(
              etichetta: etichetta,
              contesto: 'della caldaia',
              domini: domini,
              valore: caldaia[campo] ?? '',
              collegamento: collegamento,
              cambiato: (scritto) {
                caldaia[campo] = scritto;
                cambiato();
              },
            ),
            const SizedBox(height: 14),
          ],
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: togli,
              icon: const Icon(Icons.delete_outline_rounded),
              label: const Text('Togli questa caldaia'),
              style: TextButton.styleFrom(foregroundColor: colori.error),
            ),
          ),
        ],
      ),
    );
  }
}

/// Cosa c'e' nel locale caldaia: solare, scaldabagno, caldaia.
///
/// Tre si'/no, non un elenco di impianti — vedi `chiaveDegliImpiantiTermici`
/// in `casa/plancia/caldo.dart` per il perche' la differenza conta. La pagina
/// Gestione termica della plancia mostra solo quelli spuntati, e con due o tre
/// compaiono in alto le linguette per passare dall'uno all'altro.
///
/// Le entita' di ognuno non stanno qui: il solare le tiene nelle sue tredici
/// caselle (voce «Solare termico»), la caldaia nelle sue dieci (voce «La
/// caldaia»), gli scaldabagni nel loro elenco. Qui si dice soltanto quali
/// macchine esistono.
class SchermataDegliImpiantiTermici extends StatelessWidget {
  const SchermataDegliImpiantiTermici({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Cosa c\'e\' nel locale caldaia',
    sotto:
        'Spunta quello che hai davvero: la pagina mostra solo quello, e con '
        'due o tre compaiono in alto le linguette per passare dall\'uno '
        'all\'altro. Le entita\' di ognuno si mettono nella sua voce.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final scelta = laScelaTermica(
        quaderno.cambiate[chiaveDegliImpiantiTermici] ??
            scatto.aperto(chiaveDegliImpiantiTermici),
      );
      return [
        for (final (tipo, nome, spiega) in iTipiTermici)
          Card(
            margin: const EdgeInsets.symmetric(vertical: 3),
            child: SwitchListTile(
              value: scelta[tipo] ?? false,
              onChanged: (acceso) => quaderno.segna(
                chiaveDegliImpiantiTermici,
                {...scelta, tipo: acceso},
              ),
              title: Text(nome),
              subtitle: Text(spiega),
              isThreeLine: spiega.length > 60,
            ),
          ),
      ];
    },
  );
}
