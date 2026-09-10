/// Le schermate delle scelte arrivate con la 1.4.17: Assist, la riga sotto
/// il meteo, il radar, il verso della batteria, il motore dell'auto, il
/// grafico delle temperature, la tavolozza.
///
/// Sono schermate piccole — un interruttore, una tendina, tre caselle — e
/// stanno insieme per la stessa ragione per cui i loro modelli stanno in
/// `casa/plancia/scelte.dart`: una per file sarebbero sette file di trenta
/// righe.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/entita.dart';
import '../../casa/impostazioni.dart';
import '../../casa/plancia/apparecchio.dart';
import '../../casa/plancia/scelte.dart';
import '../../vestito/pezzi.dart';
import 'pezzi.dart';

Text _nota(BuildContext dentro, String testo) => Text(
  testo,
  style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
    color: Theme.of(dentro).colorScheme.onSurfaceVariant,
    height: 1.4,
  ),
);

/* ─── Assist (#360) ──────────────────────────────────────────────────────── */

/// Chiedere le cose a casa scrivendo o parlando.
class SchermataDiAssist extends StatefulWidget {
  const SchermataDiAssist({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDiAssist> createState() => _SchermataDiAssistState();
}

class _SchermataDiAssistState extends State<SchermataDiAssist> {
  /// Gli assistenti che Home Assistant conosce: `conversation/agent/info`.
  List<(String, String)> _agenti = const [];
  bool _chiesti = false;

  Future<void> _chiediGliAgenti() async {
    if (_chiesti) return;
    _chiesti = true;
    final filo = widget.collegamento.filo;
    if (filo == null) return;
    try {
      final detto = await filo.chiedi({'type': tipoDegliAgenti});
      final risultato = detto['result'];
      final elenco = risultato is Map ? risultato['agents'] : null;
      if (elenco is! List || !mounted) return;
      setState(() {
        _agenti = [
          for (final uno in elenco)
            if (uno is Map && '${uno['id'] ?? ''}'.isNotEmpty)
              ('${uno['id']}', '${uno['name'] ?? uno['id']}'),
        ];
      });
    } on Object {
      /* Senza l'elenco l'entita' si scrive a mano: e' comunque una strada. */
    }
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Assist',
    sotto:
        'Un tasto che apre l\'assistente di Home Assistant: si scrive la '
        'domanda, oppure si tocca il microfono e si parla. Le frasi le '
        'capisce Home Assistant — la plancia gliele passa e basta.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      unawaited(_chiediGliAgenti());
      final config = Assist.da(
        quaderno.cambiate[chiaveDiAssist] ?? scatto.aperto(chiaveDiAssist),
      );
      void segna(Assist dopo) =>
          quaderno.segna(chiaveDiAssist, dopo.daScrivere);
      final sezioni = Map<String, dynamic>.from(scatto.mappa('cd_sections'));
      final segnate = quaderno.cambiate['cd_sections'];
      if (segnate is Map) sezioni.addAll(Map<String, dynamic>.from(segnate));
      return [
        Card(
          margin: EdgeInsets.zero,
          child: SwitchListTile(
            value: assistAcceso(sezioni, config.daScrivere),
            onChanged: (acceso) => quaderno.segna('cd_sections', {
              ...sezioni,
              sezioneDiAssist: acceso,
            }),
            title: const Text('Assist e\' acceso'),
            subtitle: const Text(
              'Il tasto in basso a destra della plancia. Si accende e si '
              'spegne come ogni altra sezione.',
            ),
          ),
        ),
        const SizedBox(height: 10),
        Card(
          margin: EdgeInsets.zero,
          child: SwitchListTile(
            value: config.voce,
            onChanged: (acceso) => segna(config.con(voce: acceso)),
            title: const Text('Leggi la risposta ad alta voce'),
            subtitle: const Text(
              'Spenta di serie: chi apre Assist di notte non deve sentirsi '
              'rispondere dal tablet.',
            ),
          ),
        ),
        const SizedBox(height: 18),
        if (_agenti.isNotEmpty) ...[
          DropdownButtonFormField<String>(
            initialValue: _agenti.any((uno) => uno.$1 == config.agente)
                ? config.agente
                : '',
            decoration: const InputDecoration(
              labelText: 'Assistente',
              border: OutlineInputBorder(),
              isDense: true,
            ),
            items: [
              const DropdownMenuItem(value: '', child: Text('Quello di serie')),
              for (final (id, nome) in _agenti)
                DropdownMenuItem(value: id, child: Text(nome)),
            ],
            onChanged: (scelto) => segna(config.con(agente: scelto ?? '')),
          ),
          const SizedBox(height: 10),
        ],
        CampoDiEntita(
          etichetta: 'Assistente (vuoto = quello di serie)',
          esempio: 'conversation.home_assistant',
          domini: const ['conversation'],
          valore: config.agente,
          collegamento: widget.collegamento,
          cambiato: (scritto) => segna(config.con(agente: scritto.trim())),
        ),
        const SizedBox(height: 8),
        _nota(
          dentro,
          'Quasi nessuno ne ha due: lasciandolo vuoto risponde l\'assistente '
          'di serie di Home Assistant.',
        ),
      ];
    },
  );
}

/* ─── La riga sotto il meteo (#356, #357) ────────────────────────────────── */

/// Le pastiglie di cosa e' acceso in casa, e la cassetta della posta.
class SchermataDellaBarraDiCasa extends StatelessWidget {
  const SchermataDellaBarraDiCasa({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'La riga sotto il meteo',
    sotto:
        'Una fascia sotto il meteo con le pastiglie di cosa e\' acceso: le '
        'luci accese, le finestre aperte, il ritiro di stasera. Esce solo '
        'quello che ha qualcosa da dire.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final barra = BarraDiCasa.da(
        quaderno.cambiate[chiaveDellaBarraDiCasa] ??
            scatto.aperto(chiaveDellaBarraDiCasa),
      );
      void segna(BarraDiCasa dopo) =>
          quaderno.segna(chiaveDellaBarraDiCasa, dopo.daScrivere);
      return [
        Scheda(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final (chiave, disegno, parola) in vociDellaBarra)
                SwitchListTile(
                  value: barra.voci[chiave] ?? true,
                  onChanged: (acceso) => segna(
                    BarraDiCasa(
                      voci: {...barra.voci, chiave: acceso},
                      posta: barra.posta,
                    ),
                  ),
                  title: Text('$disegno $parola'),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        CampoDiEntita(
          etichetta: 'Sensore della cassetta della posta',
          esempio: 'binary_sensor.cassetta_posta',
          domini: const ['binary_sensor'],
          valore: barra.posta,
          collegamento: collegamento,
          cambiato: (scritto) =>
              segna(BarraDiCasa(voci: barra.voci, posta: scritto.trim())),
        ),
        const SizedBox(height: 8),
        _nota(
          dentro,
          'Il contatto della cassetta: quando si apre, la pastiglia dice che '
          'e\' arrivata la posta finche\' qualcuno la tocca per dire che '
          'l\'ha ritirata. Il verso girato vale anche qui, come per le '
          'altre aperture.',
        ),
      ];
    },
  );
}

/* ─── Il radar meteo (#266) ──────────────────────────────────────────────── */

/// La pioggia sulla mappa, dentro le previsioni.
class SchermataDelRadar extends StatelessWidget {
  const SchermataDelRadar({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Il radar meteo',
    sotto:
        'Dove piove adesso, sopra i sette giorni delle previsioni. Il posto '
        'si sceglie, e i quadratini arrivano da un\'entita\' di casa o da un '
        'servizio di mappe.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final config = Map<String, dynamic>.from(scatto.mappa(chiaveDelRadar));
      final segnata = quaderno.cambiate[chiaveDelRadar];
      if (segnata is Map) config.addAll(Map<String, dynamic>.from(segnata));
      String letto(String campo) => '${config[campo] ?? ''}'.trim();
      /* Si scrive tutto come testo, com'e' scritto dalla plancia: `raccogli`
       * prende `clean(campo.value)` da ogni casella, numeri compresi. */
      void segna(String campo, String valore) =>
          quaderno.segna(chiaveDelRadar, {...config, campo: valore.trim()});
      final zone = [
        for (final una in collegamento.stato?.tutte() ?? const <Entita>[])
          if (una.id.startsWith('zone.')) una,
      ];
      final servizio = letto('servizio');
      final fondo = letto('fondo');
      return [
        CampoDiEntita(
          etichetta: 'Radar meteo',
          esempio: 'camera.radar',
          domini: const ['camera', 'image'],
          valore: letto('entity'),
          collegamento: collegamento,
          cambiato: (scritto) => segna('entity', scritto),
        ),
        const SizedBox(height: 8),
        _nota(
          dentro,
          'Un\'entita\' camera o image del tuo Home Assistant: il fotogramma '
          'passa dal tuo server e da casa non esce niente. Chi ha portato '
          'dentro il radar con la sua integrazione ha gia\' l\'entita\' qui '
          'sotto.',
        ),
        const SizedBox(height: 20),
        const Insegna('oppure, da un servizio di mappe'),
        DropdownButtonFormField<String>(
          initialValue: servizio.isEmpty
              ? servizioDiSerieDelRadar
              : (servizio == 'modello' ||
                    servizio.toLowerCase() == nessunRadar ||
                    serviziDelRadar.any((uno) => uno.$1 == servizio))
              ? servizio.toLowerCase()
              : servizioDiSerieDelRadar,
          decoration: const InputDecoration(
            labelText: 'Servizio radar',
            border: OutlineInputBorder(),
            isDense: true,
          ),
          items: [
            for (final (chiave, nome) in serviziDelRadar)
              DropdownMenuItem(value: chiave, child: Text(nome)),
            const DropdownMenuItem(
              value: 'modello',
              child: Text('Un indirizzo mio'),
            ),
            const DropdownMenuItem(value: nessunRadar, child: Text('Nessuno')),
          ],
          onChanged: (scelto) => segna('servizio', scelto ?? ''),
        ),
        if (servizio == 'modello') ...[
          const SizedBox(height: 10),
          CampoDiTesto(
            etichetta: 'L\'indirizzo dei quadratini della pioggia',
            valore: letto('modello'),
            suggerimento: 'https://…/{z}/{x}/{y}.png',
            mono: true,
            cambiato: (scritto) => segna('modello', scritto),
          ),
        ],
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: fondo.isEmpty
              ? fondoDiSerieDellaMappa
              : (fondo == 'modello' ||
                    fondo.toLowerCase() == nessunRadar ||
                    fondiDellaMappa.any((uno) => uno.$1 == fondo))
              ? fondo.toLowerCase()
              : fondoDiSerieDellaMappa,
          decoration: const InputDecoration(
            labelText: 'Mappa di fondo',
            border: OutlineInputBorder(),
            isDense: true,
          ),
          items: [
            for (final (chiave, nome) in fondiDellaMappa)
              DropdownMenuItem(value: chiave, child: Text(nome)),
            const DropdownMenuItem(
              value: 'modello',
              child: Text('Un indirizzo mio'),
            ),
            const DropdownMenuItem(value: nessunRadar, child: Text('Nessuna')),
          ],
          onChanged: (scelto) => segna('fondo', scelto ?? ''),
        ),
        if (fondo == 'modello') ...[
          const SizedBox(height: 10),
          CampoDiTesto(
            etichetta: 'L\'indirizzo della mappa di fondo',
            valore: letto('fondoModello'),
            suggerimento: 'https://…/{z}/{x}/{y}.png',
            mono: true,
            cambiato: (scritto) => segna('fondoModello', scritto),
          ),
        ],
        const SizedBox(height: 8),
        _nota(
          dentro,
          'Il browser chiede al servizio i quadratini della zona che guardi: '
          'quel servizio sa quindi che zona e\'. Scegli «Nessuno» e la '
          'plancia non bussa a nessuno.',
        ),
        const SizedBox(height: 20),
        const Insegna('Dove'),
        DropdownButtonFormField<String>(
          initialValue: zone.any((una) => una.id == letto('zona'))
              ? letto('zona')
              : '',
          decoration: const InputDecoration(
            labelText: 'Dove',
            border: OutlineInputBorder(),
            isDense: true,
          ),
          items: [
            const DropdownMenuItem(value: '', child: Text('Casa')),
            for (final una in zone)
              DropdownMenuItem(value: una.id, child: Text(una.nome)),
          ],
          onChanged: (scelto) => segna('zona', scelto ?? ''),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: CampoDiTesto(
                etichetta: 'Raggio (km)',
                valore: letto('raggio'),
                suggerimento: '$raggioDiSerieDelRadar',
                numerico: true,
                cambiato: (scritto) => segna('raggio', scritto),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: CampoDiTesto(
                etichetta: 'Zoom massimo della pioggia',
                valore: letto('zoomPioggia'),
                suggerimento: '7',
                numerico: true,
                cambiato: (scritto) => segna('zoomPioggia', scritto),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: CampoDiTesto(
                etichetta: 'Latitudine',
                valore: letto('lat'),
                suggerimento: '41.9028',
                numerico: true,
                cambiato: (scritto) => segna('lat', scritto),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: CampoDiTesto(
                etichetta: 'Longitudine',
                valore: letto('lon'),
                suggerimento: '12.4964',
                numerico: true,
                cambiato: (scritto) => segna('lon', scritto),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _nota(
          dentro,
          'Le coordinate scritte a mano vincono su tutto; se le lasci vuote '
          'vale la zona qui sopra, e se non scegli niente vale casa. Per un '
          'posto che non e\' casa tua, creagli una zona in Home Assistant: '
          'comparira\' nella tendina col suo nome.',
        ),
      ];
    },
  );
}

/* ─── Il verso della batteria (#434) ─────────────────────────────────────── */

/// Se il sensore della batteria scrive positivo quando si carica.
class SchermataDelVersoDellaBatteria extends StatelessWidget {
  const SchermataDelVersoDellaBatteria({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Il verso della batteria',
    sotto:
        '«Sembra scaricarsi perche\' il flusso tratteggiato va dalla batteria '
        'verso casa, ma non e\' esatto.» Meta\' dei sensori scrive positivo '
        'quando la batteria si carica, e da un valore solo non si indovina.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final adesso = Map<String, dynamic>.from(
        scatto.mappa(chiaveDelVersoDellaBatteria),
      );
      final segnata = quaderno.cambiate[chiaveDelVersoDellaBatteria];
      final girata = batteriaGirata(
        segnata ?? scatto.aperto(chiaveDelVersoDellaBatteria),
      );
      return [
        Card(
          margin: EdgeInsets.zero,
          child: SwitchListTile(
            value: girata,
            onChanged: (acceso) => quaderno.segna(chiaveDelVersoDellaBatteria, {
              ...adesso,
              'girata': acceso,
            }),
            title: const Text(
              'La mia batteria scrive positivo quando si carica',
            ),
            subtitle: Text(
              girata
                  ? 'Positivo = in carica. Le frecce del flusso vanno verso '
                        'la batteria quando il numero e\' positivo.'
                  : 'Positivo = in scarica, che e\' la convenzione che la '
                        'plancia ha sempre usato.',
            ),
          ),
        ),
        const SizedBox(height: 10),
        _nota(
          dentro,
          'E\' una cosa dell\'impianto, non del telefono: la batteria e\' una '
          'sola per tutta la casa, e chi ha girato il verso dal computer non '
          'deve vedere le frecce al contrario sul telefono.',
        ),
      ];
    },
  );
}

/* ─── Il motore dell'auto (#326) ─────────────────────────────────────────── */

/// Elettrica, termica o ibrida, per chi compila le caselle senza un profilo.
class SchermataDelMotore extends StatelessWidget {
  const SchermataDelMotore({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Il motore dell\'auto',
    sotto:
        '«Rientrando nella configurazione il motore risulta Elettrica.» Il '
        'tipo di motore viveva solo dentro il profilo di una vettura, e un '
        'profilo non e\' obbligatorio: chi ha una macchina sola compila le '
        'caselle e non preme mai «Salva auto». Qui c\'e\' la casa che gli '
        'mancava.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      /* La chiave e' una parola dentro JSON — `"termica"` con le virgolette,
       * scritta da `writeJsonIfChanged` — quindi qui si scrive con
       * `jsonEncode`, e si legge aprendola. */
      final segnata = quaderno.cambiate[chiaveDelMotoreDiCasa];
      final adesso = tipoMotore(
        segnata is String
            ? _apri(segnata)
            : scatto.aperto(chiaveDelMotoreDiCasa),
      );
      final auto = scatto.oggetti('cd_ev_cars');
      return [
        DropdownButtonFormField<String>(
          initialValue: adesso,
          decoration: const InputDecoration(
            labelText: 'Motore',
            border: OutlineInputBorder(),
            isDense: true,
          ),
          items: [
            for (final (chiave, parola) in tipiDiMotore)
              DropdownMenuItem(value: chiave, child: Text(parola)),
          ],
          onChanged: (scelto) => quaderno.segna(
            chiaveDelMotoreDiCasa,
            jsonEncode(tipoMotore(scelto)),
          ),
        ),
        const SizedBox(height: 10),
        _nota(
          dentro,
          auto.isEmpty
              ? 'Non c\'e\' nessun profilo auto: vale questo.'
              : 'Ci sono ${auto.length} profili auto: con un profilo attivo '
                    'comanda il motore della vettura, scritto nel suo '
                    'profilo (la voce «Auto elettrica»). Questo vale quando '
                    'nessun profilo e\' attivo.',
        ),
      ];
    },
  );

  static Object? _apri(String testo) {
    try {
      return jsonDecode(testo);
    } on FormatException {
      return testo;
    }
  }
}

/* ─── Il grafico delle temperature (#433) ────────────────────────────────── */

/// Quali stanze restano fuori dal grafico delle Temperature.
class SchermataDelGrafico extends StatelessWidget {
  const SchermataDelGrafico({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Il grafico delle temperature',
    sotto:
        '«Poter togliere dal grafico alcune stanze, in modo che diventi piu\' '
        'leggibile la variazione. Nel mio caso il vano tecnico.» Una stanza '
        'fuori scala schiaccia tutte le altre. Nella plancia si toccano le '
        'voci della legenda; qui sono interruttori.',
    collegamento: collegamento,
    disegna: (dentro, scatto, quaderno) {
      final adesso = Map<String, dynamic>.from(
        scatto.mappa(chiaveDelGraficoDelleStanze),
      );
      final segnata = quaderno.cambiate[chiaveDelGraficoDelleStanze];
      final spente = serieSpente(
        segnata ?? scatto.aperto(chiaveDelGraficoDelleStanze),
      );
      /* Le serie del grafico «tutte le stanze»: una per stanza che ha una
       * sonda di temperatura, con l'identificativo della stanza. */
      final stanze = [
        for (final una in leggiGliApparecchi(
          scatto.aperto(Sezione.stanze.chiave),
          sezione: Sezione.stanze,
        ))
          if ('${una.dentro['temp'] ?? ''}'.trim().isNotEmpty) una,
      ];
      final accese = [
        for (final una in stanze)
          if (!spente.contains(una.id)) una,
      ];
      return [
        if (stanze.isEmpty)
          const StatoVuoto(
            icona: Icons.show_chart_rounded,
            titolo: 'Nessuna stanza con la temperatura',
            sotto: 'Il grafico disegna le stanze che hanno una sonda.',
            dentroUnaLista: true,
          )
        else
          Scheda(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final una in stanze)
                  SwitchListTile(
                    value: !spente.contains(una.id),
                    /* L'ultima accesa non si spegne: un grafico vuoto non
                     * racconta niente, ed e' la stessa regola della plancia
                     * (`laSiPuoSpegnere`). */
                    onChanged: accese.length == 1 && accese.first.id == una.id
                        ? null
                        : (acceso) {
                            final dopo = {...spente};
                            if (acceso) {
                              dopo.remove(una.id);
                            } else {
                              dopo.add(una.id);
                            }
                            quaderno.segna(chiaveDelGraficoDelleStanze, {
                              ...adesso,
                              'spente': dopo.toList()..sort(),
                            });
                          },
                    title: Text(una.nome.isNotEmpty ? una.nome : una.id),
                    subtitle: Text('${una.dentro['temp']}'),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 10),
        _nota(
          dentro,
          'Se sono spente tutte — una configurazione vecchia, una stanza '
          'rinominata — la plancia le rimostra tutte.',
        ),
      ];
    },
  );
}

/* ─── La tavolozza (di questo dispositivo) ───────────────────────────────── */

/// I colori della plancia oltre a chiaro e scuro.
class SchermataDellaTavolozza extends StatelessWidget {
  const SchermataDellaTavolozza({super.key, required this.impostazioni});

  final Impostazioni impostazioni;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('La tavolozza')),
      body: SafeArea(
        top: false,
        child: StreamBuilder<void>(
          stream: impostazioni.cambiamenti,
          builder: (qui, _) => ListView(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 16),
                child: Text(
                  'Una tavolozza non sostituisce chiaro e scuro: li '
                  'accompagna. Sceglierne una porta anche la sua famiglia — '
                  'notte, grafite e bosco sono scure; sabbia, menta e ardesia '
                  'chiare. Vale su questo dispositivo, come il tema.',
                  style: Theme.of(qui).textTheme.bodyMedium
                      ?.copyWith(color: colori.onSurfaceVariant, height: 1.45),
                ),
              ),
              Scheda(
                padding: EdgeInsets.zero,
                child: RadioGroup<String>(
                  groupValue: impostazioni.tavolozzaDellaPlancia,
                  onChanged: (scelta) {
                    if (scelta == null) return;
                    unawaited(
                      impostazioni.metti(tavolozzaDellaPlancia: scelta),
                    );
                  },
                  child: Column(
                    children: [
                      const RadioListTile<String>(
                        value: '',
                        title: Text('Nessuna'),
                        subtitle: Text('Chiaro o scuro, come nel tema'),
                      ),
                      for (final (chiave, famiglia, glifo, nome)
                          in tavolozzeDellaPlancia)
                        RadioListTile<String>(
                          value: chiave,
                          title: Text('$glifo $nome'),
                          subtitle: Text(
                            famiglia == 'scuro' ? 'Scura' : 'Chiara',
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
