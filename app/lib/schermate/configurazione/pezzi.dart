/// I pezzi che tornano in tutte le schermate della configurazione.
///
/// Un guscio che legge la configurazione, tiene il salvataggio e dice cosa e'
/// andato storto; i campi — testo, numero, ora, interruttore, entita' — e il
/// cercatore di entita'.
///
/// Stanno qui e non copiati in venti schermate perche' venti schermate che
/// salvano in venti modi diversi sono venti modi diversi di perdere la
/// configurazione di qualcuno.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/scatto.dart';
import '../../vestito/pezzi.dart';
import 'cercatore.dart';

/// Il guscio di una schermata della configurazione.
///
/// Legge lo scatto, lo passa a chi disegna, e tiene la barra del salvataggio
/// in fondo. Chi ci sta dentro non parla mai col filo: chiede a [Quaderno] di
/// segnare una chiave, e il salvataggio lo fa questo.
class PaginaDiConfigurazione extends StatefulWidget {
  const PaginaDiConfigurazione({
    super.key,
    required this.titolo,
    required this.collegamento,
    required this.disegna,
    this.sotto,
  });

  final String titolo;

  /// Una riga sotto il titolo, dentro la pagina: cosa si sta configurando, e
  /// dove si vede l'effetto.
  final String? sotto;

  final Collegamento collegamento;

  /// Cosa mostrare, dato quello che c'e' adesso e il quaderno su cui segnare.
  final List<Widget> Function(
    BuildContext contesto,
    Scatto scatto,
    Quaderno quaderno,
  )
  disegna;

  @override
  State<PaginaDiConfigurazione> createState() => _PaginaDiConfigurazioneState();
}

/// Dove si segna quello che si e' cambiato, prima di salvarlo.
///
/// Le modifiche non partono a ogni tasto premuto: si accumulano qui e vanno
/// via tutte insieme quando si preme «Salva». Salvare a ogni lettera vuol
/// dire una scrittura sul ponte per lettera, e la prima volta che il filo va
/// giu' a meta' parola resta scritta meta' parola.
class Quaderno {
  Quaderno(this._segnato);

  final void Function(String chiave, Object? valore) _segnato;

  final _cambiate = <String, Object?>{};

  /// Le chiavi cambiate e non ancora salvate.
  Map<String, Object?> get cambiate => Map.unmodifiable(_cambiate);

  bool get cEqualcosa => _cambiate.isNotEmpty;

  /// Segna una chiave. `null` la cancella.
  void segna(String chiave, Object? valore) {
    _cambiate[chiave] = valore;
    _segnato(chiave, valore);
  }

  void dimenticaTutto() => _cambiate.clear();
}

class _PaginaDiConfigurazioneState extends State<PaginaDiConfigurazione> {
  LaConfigurazione? _cassetta;
  Scatto? _scatto;
  String? _male;
  bool _sto = false;
  bool _salva = false;
  late final Quaderno _quaderno = Quaderno((_, _) => setState(() {}));

  @override
  void initState() {
    super.initState();
    unawaited(_leggi());
    /* Le entita' della casa si chiedono adesso, non quando si tocca la lente.
     *
     * In una casa vera sono un megabyte e mezzo e si leggono solo quando
     * qualcuno le vuole: finora le voleva solo l'elenco dei dispositivi, e
     * chi apriva una casella della configurazione senza esserci mai passato
     * trovava «0 entita'» — che e' la risposta sbagliata alla domanda giusta.
     * Chiedendole all'apertura della schermata, quando il dito arriva sulla
     * lente sono gia' qui. Chiamarla due volte non costa niente. */
    unawaited(widget.collegamento.serveLaCasa());
  }

  Future<void> _leggi() async {
    final filo = widget.collegamento.filo;
    if (filo == null) {
      setState(() => _male = 'La casa non e\' collegata.');
      return;
    }
    setState(() {
      _sto = true;
      _male = null;
    });
    final cassetta = _cassetta ??= LaConfigurazione(filo);
    try {
      final letto = await cassetta.leggi();
      if (!mounted) return;
      setState(() {
        _scatto = letto;
        _sto = false;
      });
    } on Object catch (male) {
      if (!mounted) return;
      setState(() {
        _male = '$male';
        _sto = false;
      });
    }
  }

  Future<void> _scrivi() async {
    final cassetta = _cassetta;
    if (cassetta == null || !_quaderno.cEqualcosa) return;
    setState(() => _salva = true);
    try {
      final dopo = await cassetta.cambia(_quaderno.cambiate);
      _quaderno.dimenticaTutto();
      if (!mounted) return;
      setState(() {
        _scatto = dopo;
        _salva = false;
      });
      /* La plancia sta in un riquadro che non sa che la configurazione e'
       * cambiata: glielo si dice, e si ridisegna con le cose nuove. */
      widget.collegamento.laPlanciaECambiata();
      _dillo('Salvato. La plancia si aggiorna da sola.');
    } on Object catch (male) {
      if (!mounted) return;
      setState(() => _salva = false);
      _dillo('$male', male: true);
    }
  }

  void _dillo(String cosa, {bool male = false}) {
    if (!mounted) return;
    final colori = Theme.of(context).colorScheme;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(cosa),
        backgroundColor: male ? colori.errorContainer : null,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final scatto = _scatto;
    return Scaffold(
      appBar: AppBar(title: Text(widget.titolo)),
      body: SafeArea(
        top: false,
        child: switch ((scatto, _male, _sto)) {
          (_, final String male, _) => StatoVuoto(
            icona: Icons.cloud_off_rounded,
            titolo: 'Non riesco a leggere la configurazione',
            sotto: male,
            azione: FilledButton(
              onPressed: _leggi,
              child: const Text('Riprova'),
            ),
          ),
          (null, _, _) => const Center(child: CircularProgressIndicator()),
          (final Scatto letto, _, _) => Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                  children: [
                    if (widget.sotto != null) ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(4, 0, 4, 16),
                        child: Text(
                          widget.sotto!,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: colori.onSurfaceVariant,
                                height: 1.45,
                              ),
                        ),
                      ),
                    ],
                    ...widget.disegna(context, letto, _quaderno),
                  ],
                ),
              ),
              BarraDelSalvataggio(
                cEqualcosa: _quaderno.cEqualcosa,
                sta: _salva,
                salva: _scrivi,
                lascia: () {
                  _quaderno.dimenticaTutto();
                  unawaited(_leggi());
                },
              ),
            ],
          ),
        },
      ),
    );
  }
}

/// La barra in fondo: si vede solo quando c'e' qualcosa da salvare.
///
/// Sempre visibile sarebbe un bottone che quasi sempre non fa niente, e un
/// bottone che quasi sempre non fa niente insegna a non premerlo.
///
/// L'avviso sta **sopra** i due bottoni e non accanto. Accanto ci stava su uno
/// schermo largo e non su un telefono: «Lascia stare» e «Salva» insieme
/// prendono trecentoventi punti su quattrocentosei, all'avviso ne restavano
/// tredici — una lettera per riga, la barra alta mezzo schermo — e «Salva»
/// finiva **fuori dal bordo destro**, cioe' non si poteva piu' salvare
/// niente da nessuna schermata della configurazione. Cosi' invece non c'e'
/// larghezza a cui possa rompersi.
class BarraDelSalvataggio extends StatelessWidget {
  const BarraDelSalvataggio({
    super.key,
    required this.cEqualcosa,
    required this.sta,
    required this.salva,
    required this.lascia,
  });

  final bool cEqualcosa;
  final bool sta;
  final VoidCallback salva;
  final VoidCallback lascia;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return AnimatedSize(
      duration: const Duration(milliseconds: 180),
      alignment: Alignment.topCenter,
      child: !cEqualcosa
          ? const SizedBox(width: double.infinity)
          : Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              decoration: BoxDecoration(
                color: colori.surfaceContainerHigh,
                border: Border(top: BorderSide(color: colori.outlineVariant)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Non ancora salvato',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall
                        ?.copyWith(color: colori.onSurfaceVariant),
                  ),
                  const SizedBox(height: 6),
                  /* Un `Wrap` e non una `Row`: sotto ai trecentoquaranta punti
                   * i due bottoni non ci stanno affiancati nemmeno da soli, e
                   * una riga che non ci sta spinge fuori dal bordo quello a
                   * destra — che qui e' proprio «Salva». Cosi' invece, quando
                   * non ci stanno, vanno a capo. */
                  Wrap(
                    alignment: WrapAlignment.end,
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      TextButton(
                        onPressed: sta ? null : lascia,
                        child: const Text('Lascia stare'),
                      ),
                      FilledButton(
                        onPressed: sta ? null : salva,
                        child: sta
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text('Salva'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }
}

/// Un campo di testo con la sua etichetta.
class CampoDiTesto extends StatefulWidget {
  const CampoDiTesto({
    super.key,
    required this.etichetta,
    required this.valore,
    required this.cambiato,
    this.suggerimento,
    this.numerico = false,
    this.mono = false,
  });

  final String etichetta;
  final String valore;
  final String? suggerimento;
  final bool numerico;
  final bool mono;
  final ValueChanged<String> cambiato;

  @override
  State<CampoDiTesto> createState() => _CampoDiTestoState();
}

class _CampoDiTestoState extends State<CampoDiTesto> {
  late final _scritto = TextEditingController(text: widget.valore);

  @override
  void didUpdateWidget(CampoDiTesto vecchio) {
    super.didUpdateWidget(vecchio);
    /* Il testo si rimette solo quando cambia da fuori — dopo un salvataggio,
     * o quando si rilegge: rimetterlo a ogni ridisegno sposterebbe il cursore
     * in fondo mentre si scrive. */
    if (widget.valore != vecchio.valore && widget.valore != _scritto.text) {
      _scritto.text = widget.valore;
    }
  }

  @override
  void dispose() {
    _scritto.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextField(
    controller: _scritto,
    onChanged: widget.cambiato,
    keyboardType: widget.numerico
        ? const TextInputType.numberWithOptions(decimal: true)
        : null,
    inputFormatters: widget.numerico
        ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))]
        : null,
    style: widget.mono
        ? const TextStyle(fontFamily: 'monospace', fontSize: 14)
        : null,
    decoration: InputDecoration(
      labelText: widget.etichetta,
      hintText: widget.suggerimento,
      border: const OutlineInputBorder(),
      isDense: true,
    ),
  );
}

/// Un campo che vuole un'entita' di Home Assistant, col cercatore accanto.
class CampoDiEntita extends StatelessWidget {
  const CampoDiEntita({
    super.key,
    required this.etichetta,
    required this.valore,
    required this.cambiato,
    required this.collegamento,
    this.domini = const [],
    this.chiave = '',
    this.contesto = '',
    this.rinomina,
  });

  final String etichetta;
  final String valore;
  final ValueChanged<String> cambiato;
  final Collegamento collegamento;

  /// Se non e' vuoto, il cercatore ne tiene conto: `light`, `switch`. Non e'
  /// un filtro che si subisce — le altre si cercano lo stesso, che un filtro
  /// che non si puo' togliere e' una casa in cui manca meta' della roba.
  final List<String> domini;

  /// Il riferimento della casella, quando ce l'ha: `dm.energy_potenza_batteria`.
  /// Insieme all'etichetta e' quello che fa capire al cercatore cosa vuole
  /// questa casella, ed e' come lo capisce la dashboard.
  final String chiave;

  /// Di che cosa e' questa casella: «una luce», «una finestra».
  ///
  /// Non si vede, e serve al cercatore. Dentro un elenco l'etichetta di una
  /// casella e' spesso «Entita'» e basta — che e' giusto, perche' sopra c'e'
  /// gia' scritto «Aggiungi una luce» — ma da sola non dice niente su cosa
  /// vada messo dentro, e il cercatore resterebbe cieco proprio dove servirebbe
  /// di piu'.
  final String contesto;

  /// Se c'e', accanto al cercatore compare la matita e l'etichetta si puo'
  /// riscrivere.
  ///
  /// Nella Config della plancia il nome di ogni casella **e'** un campo di
  /// testo: chi ha il fotovoltaico su due tetti scrive «Potenza tetto sud» al
  /// posto di «Potenza fotovoltaico (W)», e la plancia da quel momento la
  /// chiama cosi'. Senza questo, la stessa casella nell'app avrebbe un nome
  /// diverso da quello che la persona ha scelto nel browser.
  final ValueChanged<String>? rinomina;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: CampoDiTesto(
          etichetta: etichetta,
          valore: valore,
          mono: true,
          suggerimento: domini.isEmpty
              ? 'dominio.nome'
              : '${domini.first}.nome',
          cambiato: cambiato,
        ),
      ),
      const SizedBox(width: 8),
      Padding(
        padding: const EdgeInsets.only(top: 2),
        child: IconButton.filledTonal(
          onPressed: () async {
            final scelta = await cercaUnEntita(
              context,
              collegamento: collegamento,
              chiave: chiave,
              etichetta: contesto.isEmpty ? etichetta : '$etichetta $contesto',
              domini: domini,
              adesso: valore,
            );
            if (scelta != null) cambiato(scelta);
          },
          icon: const Icon(Icons.search_rounded),
          tooltip: 'Cerca fra le entita\' di casa',
        ),
      ),
      if (rinomina != null) ...[
        const SizedBox(width: 4),
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: IconButton(
            onPressed: () => _riscrivi(context),
            icon: const Icon(Icons.drive_file_rename_outline_rounded),
            tooltip: 'Cambia il nome di questa casella',
          ),
        ),
      ],
    ],
  );

  /* Il nome della casella, riscritto.
   *
   * Vuoto vuol dire «rimettilo com'era»: nella plancia una riscrittura
   * cancellata toglie la voce da `cd_slot_labels` e l'etichetta torna quella
   * di serie, e chi svuota il campo si aspetta quello e non un nome vuoto. */
  Future<void> _riscrivi(BuildContext context) async {
    final nuovo = await showDialog<String>(
      context: context,
      builder: (dentro) => _ChiediIlNome(adesso: etichetta),
    );
    if (nuovo != null) rinomina!(nuovo.trim());
  }
}

/// Il riquadro che chiede il nome nuovo di una casella.
///
/// E' un widget con stato per una ragione sola, e non e' eleganza: il campo
/// di testo ha un controller, il controller va chiuso, e chiuderlo appena
/// `showDialog` ritorna lo chiude mentre il riquadro sta ancora scivolando
/// via col campo dentro. Qui muore insieme al riquadro, che e' quando serve.
class _ChiediIlNome extends StatefulWidget {
  const _ChiediIlNome({required this.adesso});

  final String adesso;

  @override
  State<_ChiediIlNome> createState() => _ChiediIlNomeState();
}

class _ChiediIlNomeState extends State<_ChiediIlNome> {
  late final _scritto = TextEditingController(text: widget.adesso);

  @override
  void dispose() {
    _scritto.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Come si chiama questa casella'),
    content: TextField(
      controller: _scritto,
      autofocus: true,
      decoration: const InputDecoration(
        border: OutlineInputBorder(),
        helperText: 'Lascia vuoto per rimettere il nome di serie',
      ),
      onSubmitted: (testo) => Navigator.of(context).pop(testo),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.of(context).pop(),
        child: const Text('Lascia stare'),
      ),
      FilledButton(
        onPressed: () => Navigator.of(context).pop(_scritto.text),
        child: const Text('Va bene'),
      ),
    ],
  );
}

/// Piu' entita' in un campo solo: le luci di un'azione «popup luci».
///
/// La plancia le tiene in un elenco (`a.lights`) e le fa scegliere una per
/// volta; qui e' lo stesso, con la pastiglia che si toglie con la crocetta. Un
/// campo di testo con le virgole sarebbe stato meno codice e piu' errori: un
/// identificativo battuto a mano e' un identificativo sbagliato.
class TanteEntita extends StatelessWidget {
  const TanteEntita({
    super.key,
    required this.etichetta,
    required this.quali,
    required this.collegamento,
    required this.cambiate,
    this.spiega,
    this.domini = const [],
  });

  final String etichetta;
  final String? spiega;
  final List<String> domini;
  final List<String> quali;
  final Collegamento collegamento;
  final ValueChanged<List<String>> cambiate;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          etichetta,
          style: Theme.of(context).textTheme.labelLarge
              ?.copyWith(color: colori.onSurfaceVariant),
        ),
        if (spiega != null) ...[
          const SizedBox(height: 2),
          Text(
            spiega!,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: colori.onSurfaceVariant),
          ),
        ],
        const SizedBox(height: 8),
        if (quali.isEmpty)
          Text(
            'Nessuna scelta',
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: colori.onSurfaceVariant),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final una in quali)
                InputChip(
                  label: Text(una, style: const TextStyle(fontSize: 12)),
                  onDeleted: () => cambiate(
                    [...quali]..removeWhere((quale) => quale == una),
                  ),
                ),
            ],
          ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () async {
              final scelta = await cercaUnEntita(
                context,
                collegamento: collegamento,
                etichetta: etichetta,
                domini: domini,
              );
              if (scelta == null || scelta.isEmpty) return;
              if (quali.contains(scelta)) return;
              cambiate([...quali, scelta]);
            },
            icon: const Icon(Icons.add_rounded),
            label: const Text('Aggiungine una'),
          ),
        ),
      ],
    );
  }
}
