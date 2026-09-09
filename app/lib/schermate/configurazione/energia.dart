/// L'Energia: la pagina piu' grossa della Config, e la sola che ha **piu' di
/// un impianto**.
///
/// Non e' una fila di caselle come le altre. E' un modello — `cd_energy_model`
/// — diviso in cinque gruppi: il solare, la casa, la rete, la batteria, e il
/// raffreddamento dell'inverter. Piu' i costi, e piu' gli impianti.
///
/// «Io ho una casa che e' l'unione di due appartamenti, quindi ho 2 misuratori
/// di consumo nei due appartamenti»: gli impianti sono per quello, e per la
/// frase con cui sono stati chiesti qui — «non si possono inserire piu'
/// impianti elettrici». Ognuno ha il suo misuratore, il suo fotovoltaico, la
/// sua batteria e i suoi carichi.
///
/// Ogni casella si scrive in due posti insieme: dentro il modello, e fra le
/// sostituzioni sotto la sua chiave `dm.*`. Il secondo si ricava dal primo
/// (`proiezioneDellEnergia`), come fa la plancia: due verita' che possono
/// discordare sono peggio di una scritta due volte.
library;

import 'package:flutter/material.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/energia.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'caselle.dart' show chiaveDelleSostituzioni;
import 'carichi.dart';
import 'pezzi.dart';

/// Dove sta il modello dell'energia.
const chiaveDelModello = 'cd_energy_model';

/// Quanto costa un kWh preso dalla rete, e quanto rende uno immesso.
const chiaveDelCosto = 'cd_costo_kwh';
const chiaveDellImmissione = 'cd_prezzo_immissione';

class SchermataDellEnergia extends StatefulWidget {
  const SchermataDellEnergia({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<SchermataDellEnergia> createState() => _SchermataDellEnergiaState();
}

class _SchermataDellEnergiaState extends State<SchermataDellEnergia> {
  ModelloDellEnergia? _modello;
  int _daQualeScatto = -1;
  int _scelto = 0;
  bool _soloVuote = false;

  ModelloDellEnergia _leggi(Scatto scatto) {
    if (_modello == null || _daQualeScatto != scatto.revisione) {
      _modello = ModelloDellEnergia.da(scatto.mappa(chiaveDelModello));
      _daQualeScatto = scatto.revisione;
      if (_scelto >= _modello!.impianti.length) _scelto = 0;
    }
    return _modello!;
  }

  /// Scrive il modello e, da lui, le caselle storiche.
  ///
  /// Le due scritture stanno insieme di proposito: separarle vorrebbe dire
  /// poterne fare una sola, e una configurazione dell'energia scritta in un
  /// posto solo si vede a meta'.
  void _segna(Scatto scatto, Quaderno quaderno) {
    final modello = _modello!;
    modello.mettiGliImpianti(modello.impianti);
    quaderno.segna(chiaveDelModello, modello.dentro);
    final scritte = Map<String, dynamic>.from(
      scatto.mappa(chiaveDelleSostituzioni),
    );
    final segnate = quaderno.cambiate[chiaveDelleSostituzioni];
    if (segnate is Map) scritte.addAll(Map<String, dynamic>.from(segnate));
    final impianti = modello.impianti;
    quaderno.segna(
      chiaveDelleSostituzioni,
      proiezioneDellEnergia(
        modello.modelloDellImpianto(
          _scelto < impianti.length ? impianti[_scelto] : null,
        ),
        scritte,
      ),
    );
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => PaginaDiConfigurazione(
    titolo: 'Energia',
    sotto:
        'Fotovoltaico, batteria, rete e consumi. Riempi quello che hai e '
        'lascia vuoto il resto: la plancia mostra solo quello che trova.',
    collegamento: widget.collegamento,
    disegna: (dentro, scatto, quaderno) {
      final modello = _leggi(scatto);
      final impianti = modello.impianti;
      final quale = _scelto < impianti.length ? _scelto : 0;
      final impianto = impianti[quale];
      final (piene, tutte) = modello.quante(impianto);
      return [
        _GliImpianti(
          impianti: impianti,
          scelto: quale,
          scegli: (dove) => setState(() => _scelto = dove),
          aggiungi: () {
            final elenco = modello.impianti;
            elenco.add(Impianto.nuovo(elenco, metadata: elenco.first.metadata));
            modello.mettiGliImpianti(elenco);
            _scelto = modello.impianti.length - 1;
            _segna(scatto, quaderno);
          },
        ),
        if (impianti.length > 1) ...[
          const SizedBox(height: 12),
          _LImpianto(
            impianto: impianto,
            quale: quale,
            scatto: scatto,
            rinomina: (nome) {
              /* Rinominare non tocca l'id: e' l'intera ragione per cui l'id
               * non si ricava dal nome. Quello che a quell'impianto e' appeso
               * — carichi, tariffa, storico — resta appeso. */
              impianto.nome = nome;
              _segna(scatto, quaderno);
            },
            comeInHome: (come) => quaderno.segna(chiaveDelleTessere, come),
            elimina: quale == 0
                ? null
                : () => _elimina(modello, impianto, scatto, quaderno),
          ),
        ],
        const SizedBox(height: 16),
        Scheda(
          colore: Theme.of(dentro).colorScheme.surfaceContainerHigh,
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '$piene su $tutte riempite',
                  style: Theme.of(dentro).textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              FilterChip(
                label: const Text('Solo le vuote'),
                selected: _soloVuote,
                onSelected: (acceso) => setState(() => _soloVuote = acceso),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        for (final gruppo in gruppiDellEnergia)
          _IlGruppo(
            gruppo: gruppo,
            modello: modello,
            impianto: impianto,
            soloVuote: _soloVuote,
            collegamento: widget.collegamento,
            cambiato: (percorso, scritto) {
              modello.mettiLaCasella(percorso, scritto, impianto: impianto);
              _segna(scatto, quaderno);
            },
          ),
        const SizedBox(height: 8),
        _IlPrezzo(
          modello: modello,
          scatto: scatto,
          quaderno: quaderno,
          collegamento: widget.collegamento,
          cambiato: () => _segna(scatto, quaderno),
        ),
        const SizedBox(height: 16),
        Scheda(
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Text('🔌', style: TextStyle(fontSize: 26)),
            title: const Text('I carichi'),
            subtitle: Text(
              impianti.length > 1
                  ? 'I cerchi sotto la Home di ${impianto.comeSiChiama(quale)}, con dentro i loro elettrodomestici'
                  : 'I cerchi sotto la Home, con dentro i loro elettrodomestici',
            ),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => Navigator.of(dentro).push(
              MaterialPageRoute(
                builder: (_) => SchermataDeiCarichi(
                  collegamento: widget.collegamento,
                  impianto: impianto,
                  quale: quale,
                  quantiImpianti: impianti.length,
                ),
              ),
            ),
          ),
        ),
      ];
    },
  );

  Future<void> _elimina(
    ModelloDellEnergia modello,
    Impianto impianto,
    Scatto scatto,
    Quaderno quaderno,
  ) async {
    final sicuro = await showDialog<bool>(
      context: context,
      builder: (dentro) => AlertDialog(
        title: Text('Elimino ${impianto.comeSiChiama(_scelto)}?'),
        content: const Text(
          'Se ne vanno anche i suoi carichi. Le entita\' di casa non si '
          'toccano: sparisce solo come sono messe insieme qui.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dentro).pop(false),
            child: const Text('Lascia stare'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dentro).pop(true),
            child: const Text('Elimina'),
          ),
        ],
      ),
    );
    if (sicuro != true) return;
    final id = impianto.id;
    modello.mettiGliImpianti(
      modello.impianti.where((uno) => uno.id != id).toList(),
    );
    _scelto = 0;
    /* Un impianto se ne va con tutto quello che era suo: i carichi non stanno
     * dentro all'impianto — stanno nella loro sezione, col nome dell'impianto
     * scritto sopra — e restavano li' orfani, pronti a riapparire il giorno in
     * cui un impianto nuovo avesse ripreso quell'id. Per questo gli id non si
     * riusano, e per questo qui si cancella davvero. */
    final carichi = scatto.oggetti(chiaveDeiCarichi);
    final restano = senzaICarichiDellImpianto(carichi, id);
    if (restano.length != carichi.length) {
      quaderno.segna(chiaveDeiCarichi, restano);
    }
    if (mounted) _segna(scatto, quaderno);
  }
}

/// La riga delle pastiglie: quale impianto si sta configurando.
///
/// Con un impianto solo la riga non mostra le pastiglie: una linguetta che non
/// offre scelta e' un ingombro e basta. Il «+» invece c'e' sempre — e' da li'
/// che il secondo impianto nasce.
class _GliImpianti extends StatelessWidget {
  const _GliImpianti({
    required this.impianti,
    required this.scelto,
    required this.scegli,
    required this.aggiungi,
  });

  final List<Impianto> impianti;
  final int scelto;
  final ValueChanged<int> scegli;
  final VoidCallback aggiungi;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: [
        if (impianti.length > 1)
          for (final (quale, uno) in impianti.indexed)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                avatar: const Text('🏠'),
                label: Text(uno.comeSiChiama(quale)),
                selected: quale == scelto,
                onSelected: (_) => scegli(quale),
              ),
            ),
        ActionChip(
          avatar: const Icon(Icons.add_rounded, size: 18),
          label: Text(
            impianti.length > 1 ? 'Aggiungi' : 'Aggiungi un altro impianto',
          ),
          onPressed: aggiungi,
        ),
      ],
    ),
  );
}

/// Il nome dell'impianto scelto, come si vede in Home, e il cestino.
class _LImpianto extends StatelessWidget {
  const _LImpianto({
    required this.impianto,
    required this.quale,
    required this.scatto,
    required this.rinomina,
    required this.comeInHome,
    required this.elimina,
  });

  final Impianto impianto;
  final int quale;
  final Scatto scatto;
  final ValueChanged<String> rinomina;
  final ValueChanged<String> comeInHome;
  final VoidCallback? elimina;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final come = comeSiVedeLEnergia(scatto.aperto(chiaveDelleTessere));
    return Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Ogni impianto ha il suo misuratore, il suo fotovoltaico, la sua '
            'batteria e i suoi carichi. Le caselle qui sotto sono quelle '
            'dell\'impianto scelto.',
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: colori.onSurfaceVariant, height: 1.4),
          ),
          const SizedBox(height: 12),
          CampoDiTesto(
            etichetta: 'Nome impianto',
            valore: impianto.nome,
            suggerimento: impianto.comeSiChiama(quale),
            cambiato: rinomina,
          ),
          const SizedBox(height: 14),
          Text('In Home', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          /* «Il widget in Home page e' solo quello del primo impianto.
           * Suggerisco di scegliere se avere un widget solo con la somma
           * oppure un widget per ogni impianto.» Di serie la somma: e' quello
           * che una Home dice, e chi vuole il dettaglio ce l'ha in un tocco. */
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                value: tesseraSomma,
                label: Text('Una sola'),
                tooltip: 'la somma di tutti gli impianti',
              ),
              ButtonSegment(
                value: tesseraPerImpianto,
                label: Text('Una per impianto'),
                tooltip: 'ognuna col nome del suo',
              ),
            ],
            selected: {come},
            showSelectedIcon: false,
            onSelectionChanged: (scelta) => comeInHome(scelta.first),
          ),
          if (elimina == null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                'Questo e\' l\'impianto principale e non si puo\' eliminare: '
                'e\' quello che la plancia ha sempre letto.',
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: colori.onSurfaceVariant),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: elimina,
                  icon: const Icon(Icons.delete_outline_rounded),
                  label: const Text('Elimina questo impianto'),
                  style: TextButton.styleFrom(foregroundColor: colori.error),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Un gruppo del modello, aperto o chiuso.
class _IlGruppo extends StatelessWidget {
  const _IlGruppo({
    required this.gruppo,
    required this.modello,
    required this.impianto,
    required this.soloVuote,
    required this.collegamento,
    required this.cambiato,
  });

  final GruppoDellEnergia gruppo;
  final ModelloDellEnergia modello;
  final Impianto impianto;
  final bool soloVuote;
  final Collegamento collegamento;
  final void Function(String percorso, String scritto) cambiato;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final caselle = [
      for (final (campo, etichetta) in gruppo.caselle)
        (gruppo.percorsoDi(campo), etichetta),
    ];
    final piene = caselle
        .where((una) => modello.casella(una.$1, impianto: impianto).isNotEmpty)
        .length;
    final daMostrare = soloVuote
        ? [
            for (final una in caselle)
              if (modello.casella(una.$1, impianto: impianto).isEmpty) una,
          ]
        : caselle;
    if (daMostrare.isEmpty) return const SizedBox.shrink();
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        initiallyExpanded: piene > 0 || soloVuote,
        title: Text(gruppo.nome),
        subtitle: Text(
          '${gruppo.sotto} · $piene su ${caselle.length}',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          for (final (percorso, etichetta) in daMostrare) ...[
            CampoDiEntita(
              etichetta: etichetta,
              /* La chiave della casella conta quanto l'etichetta: in
               * `dm.energy_potenza_batteria` ci sono tre parole che dicono
               * cosa vuole, ed e' da li' che nascono i suggerimenti. */
              chiave: caselleDellEnergia[percorso] ?? '',
              contesto: gruppo.nome.toLowerCase(),
              valore: modello.casella(percorso, impianto: impianto),
              collegamento: collegamento,
              cambiato: (scritto) => cambiato(percorso, scritto),
            ),
            const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }
}

/// Quanto costa l'energia.
class _IlPrezzo extends StatelessWidget {
  const _IlPrezzo({
    required this.modello,
    required this.scatto,
    required this.quaderno,
    required this.collegamento,
    required this.cambiato,
  });

  final ModelloDellEnergia modello;
  final Scatto scatto;
  final Quaderno quaderno;
  final Collegamento collegamento;
  final VoidCallback cambiato;

  String _adesso(String chiave) {
    final segnato = quaderno.cambiate[chiave];
    if (segnato != null) return '$segnato';
    return '${scatto.aperto(chiave) ?? ''}';
  }

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.symmetric(vertical: 4),
    clipBehavior: Clip.antiAlias,
    child: ExpansionTile(
      title: const Text('Quanto costa'),
      subtitle: Text(
        'Il prezzo al kWh, per i conti in euro',
        style: Theme.of(context).textTheme.bodySmall
            ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
      ),
      childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      children: [
        CampoDiTesto(
          etichetta: 'Costo di un kWh preso dalla rete (€)',
          valore: _adesso(chiaveDelCosto),
          numerico: true,
          suggerimento: '0,25',
          cambiato: (scritto) => quaderno.segna(chiaveDelCosto, scritto.trim()),
        ),
        const SizedBox(height: 14),
        CampoDiTesto(
          etichetta: 'Quanto rende un kWh immesso (€)',
          valore: _adesso(chiaveDellImmissione),
          numerico: true,
          suggerimento: '0,10',
          cambiato: (scritto) =>
              quaderno.segna(chiaveDellImmissione, scritto.trim()),
        ),
        const SizedBox(height: 18),
        Text(
          'Chi ha una tariffa che cambia di ora in ora puo\' mettere '
          'un\'entita\' al posto del numero fisso: la plancia legge il prezzo '
          'da li\'.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 10),
        CampoDiEntita(
          etichetta: 'Entita\' col prezzo di acquisto',
          chiave: 'prezzo_acquisto_kwh',
          contesto: 'col prezzo dell\'energia',
          domini: const ['sensor', 'input_number'],
          valore: modello.entitaDelPrezzo,
          collegamento: collegamento,
          cambiato: (scritto) {
            modello.entitaDelPrezzo = scritto;
            cambiato();
          },
        ),
      ],
    ),
  );
}
