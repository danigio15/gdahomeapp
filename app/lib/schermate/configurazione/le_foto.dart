/// Scegliere una foto: fra quelle che ci sono, o caricandone una nuova.
///
/// L'auto ne vuole due — una ferma e una con la spina attaccata — e gli
/// elettrodomestici possono avere il loro ritratto invece di un disegno.
/// Stanno in `/data/www` sul ponte, e la pagina le chiede a
/// `/dashboardmodern_static/www/…`: quello che si scrive nella configurazione
/// e' quell'indirizzo.
///
/// Il pezzo che le tiene era gia' finito nel ponte da settembre e non lo usava
/// nessuno: qui c'e' la maschera.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../../casa/allegati.dart';
import '../../casa/collegamento.dart';
import '../../casa/plancia/foto.dart' as archivio;
import '../../vestito/pezzi.dart';

/// Apre la scelta e restituisce l'indirizzo della foto, o `null`.
///
/// Restituisce la stringa vuota quando si sceglie «nessuna foto»: e' diverso
/// da `null`, che vuol dire «ho lasciato stare».
Future<String?> scegliUnaFoto(
  BuildContext contesto, {
  required Collegamento collegamento,
  required String titolo,
  String adesso = '',
}) => Navigator.of(contesto).push<String>(
  MaterialPageRoute(
    builder: (dentro) =>
        _LeFoto(collegamento: collegamento, titolo: titolo, adesso: adesso),
  ),
);

class _LeFoto extends StatefulWidget {
  const _LeFoto({
    required this.collegamento,
    required this.titolo,
    required this.adesso,
  });

  final Collegamento collegamento;
  final String titolo;
  final String adesso;

  @override
  State<_LeFoto> createState() => _LeFotoState();
}

class _LeFotoState extends State<_LeFoto> {
  archivio.DentroLaCartella? _dentro;
  String? _male;
  bool _sto = false;

  /* In quale delle due cartelle si sta guardando.
   *
   * Si parte da quella di Home Assistant quando c'e': e' li' che chi ha una
   * casa da qualche anno tiene le foto delle auto e i loghi, e la prima volta
   * che si apre questa maschera si sta cercando **una foto che si ha gia'**,
   * non una da caricare. Quale ci sia lo dice il ponte alla prima lettura,
   * quindi il primo giro si fa comunque nella sua. */
  var _radice = archivio.RadiceDelleFoto.ilPonte;
  var _giaScelta = false;

  /* Le cartelle da cui si e' passati, per tornare indietro senza rileggere
   * l'albero intero. */
  final _percorsi = <String>[''];

  @override
  void initState() {
    super.initState();
    unawaited(_leggi());
  }

  Future<void> _leggi() async {
    final filo = widget.collegamento.filo;
    if (filo == null) {
      setState(() => _male = 'La casa non e\' collegata.');
      return;
    }
    setState(() => _male = null);
    try {
      final letto = await archivio.elencaLeFoto(
        filo,
        dove: _percorsi.last,
        radice: _radice,
      );
      if (!mounted) return;
      /* La prima volta, se la cartella di Home Assistant c'e' e la sua e'
       * vuota, si va di la': cercare una foto che si ha gia' e trovarsi
       * davanti «nessuna foto, ancora» e' la risposta sbagliata detta con
       * sicurezza. */
      if (!_giaScelta) {
        _giaScelta = true;
        if (!letto.cE && letto.quali.contains(archivio.RadiceDelleFoto.laCasa)) {
          setState(() => _radice = archivio.RadiceDelleFoto.laCasa);
          await _leggi();
          return;
        }
      }
      setState(() => _dentro = letto);
    } on Object catch (male) {
      if (mounted) setState(() => _male = '$male');
    }
  }

  void _cambiaCartella(archivio.RadiceDelleFoto quale) {
    if (quale == _radice) return;
    setState(() {
      _radice = quale;
      _percorsi
        ..clear()
        ..add('');
      _dentro = null;
    });
    unawaited(_leggi());
  }

  Future<void> _carica(DaDoveLAllegato daDove) async {
    final filo = widget.collegamento.filo;
    if (filo == null) return;
    setState(() => _sto = true);
    try {
      final scelto = await scegliDalTelefono(daDove);
      if (scelto == null) {
        if (mounted) setState(() => _sto = false);
        return;
      }
      final messa = await archivio.caricaUnaFoto(
        filo,
        nome: scelto.nome,
        byte: scelto.byte,
      );
      if (!mounted) return;
      setState(() => _sto = false);
      Navigator.of(context).pop(messa.indirizzo);
    } on Object catch (male) {
      if (!mounted) return;
      setState(() => _sto = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$male'), behavior: SnackBarBehavior.floating),
      );
    }
  }

  void _entra(String dove) {
    setState(() {
      _percorsi.add(dove);
      _dentro = null;
    });
    unawaited(_leggi());
  }

  bool _esci() {
    if (_percorsi.length <= 1) return false;
    setState(() {
      _percorsi.removeLast();
      _dentro = null;
    });
    unawaited(_leggi());
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final dentro = _dentro;
    return PopScope(
      canPop: _percorsi.length <= 1,
      onPopInvokedWithResult: (uscito, _) {
        if (!uscito) _esci();
      },
      child: Scaffold(
        appBar: AppBar(title: Text(widget.titolo)),
        body: SafeArea(
          top: false,
          child: Column(
            children: [
              if ((dentro?.quali.length ?? 1) > 1)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                  child: Row(
                    children: [
                      for (final una in archivio.RadiceDelleFoto.values)
                        if (dentro!.quali.contains(una))
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text(una.comeSiChiama),
                              selected: _radice == una,
                              onSelected: (_) => _cambiaCartella(una),
                            ),
                          ),
                    ],
                  ),
                ),
              Expanded(
                child: switch ((dentro, _male)) {
                  (_, final String male) => StatoVuoto(
                    icona: Icons.cloud_off_rounded,
                    titolo: 'Non riesco a leggere le foto',
                    sotto: male,
                    azione: FilledButton(
                      onPressed: _leggi,
                      child: const Text('Riprova'),
                    ),
                  ),
                  (null, _) => const Center(child: CircularProgressIndicator()),
                  (final archivio.DentroLaCartella letto, _) => ListView(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                    children: [
                      if (_percorsi.last.isNotEmpty)
                        ListTile(
                          leading: const Icon(Icons.arrow_upward_rounded),
                          title: Text(_percorsi.last),
                          subtitle: const Text('Torna indietro'),
                          onTap: _esci,
                        ),
                      if (widget.adesso.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Scheda(
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Adesso c\'e\' questa',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall
                                            ?.copyWith(
                                              fontWeight: FontWeight.w700,
                                            ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        widget.adesso,
                                        style: TextStyle(
                                          fontFamily: 'monospace',
                                          fontSize: 11,
                                          color: colori.onSurfaceVariant,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                TextButton(
                                  onPressed: () =>
                                      Navigator.of(context).pop(''),
                                  child: const Text('Togli'),
                                ),
                              ],
                            ),
                          ),
                        ),
                      if (!letto.cE)
                        StatoVuoto(
                          icona: Icons.photo_library_outlined,
                          titolo: 'Nessuna foto, ancora',
                          sotto: _radice.ciSiScrive
                              ? 'Carica la prima col bottone qui sotto: '
                                    'finisce sul ponte, in casa tua.'
                              : 'In Home Assistant, dentro «config/www», non '
                                    'c\'e\' nessuna immagine. Se l\'add-on e\' '
                                    'appena stato aggiornato, riavvialo: prima '
                                    'quella cartella non la vedeva.',
                          dentroUnaLista: true,
                        )
                      else ...[
                        for (final una in letto.cartelle)
                          ListTile(
                            leading: const Icon(Icons.folder_rounded),
                            title: Text(una.nome),
                            trailing: const Icon(Icons.chevron_right_rounded),
                            onTap: () => _entra(una.percorso),
                          ),
                        if (letto.foto.isNotEmpty)
                          GridView.count(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisCount: 3,
                            mainAxisSpacing: 8,
                            crossAxisSpacing: 8,
                            childAspectRatio: 1,
                            children: [
                              for (final una in letto.foto)
                                _UnaFoto(
                                  foto: una,
                                  scelta: una.indirizzo == widget.adesso,
                                  premuta: () =>
                                      Navigator.of(context).pop(una.indirizzo),
                                ),
                            ],
                          ),
                        if (letto.troncata)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Text(
                              'Ce ne sono altre: il ponte ne manda un tanto '
                              'per volta.',
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(color: colori.onSurfaceVariant),
                            ),
                          ),
                      ],
                    ],
                  ),
                },
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (!_radice.ciSiScrive)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          'Queste sono le immagini che hai gia\' in Home '
                          'Assistant: si scelgono e basta. Per caricarne una '
                          'nuova, passa a «Caricate qui».',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: colori.onSurfaceVariant),
                        ),
                      ),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _sto || !_radice.ciSiScrive
                                ? null
                                : () => _carica(DaDoveLAllegato.galleria),
                            icon: const Icon(Icons.photo_rounded),
                            label: const Text('Dalla galleria'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _sto || !_radice.ciSiScrive
                                ? null
                                : () => _carica(DaDoveLAllegato.fotocamera),
                            icon: const Icon(Icons.photo_camera_rounded),
                            label: const Text('Scattala'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Una foto nella griglia.
///
/// Non si scarica per mostrarla: la si chiede al servitore, che e' lo stesso
/// posto da cui la prende la plancia. Se non arriva resta il suo nome, che e'
/// meglio di un riquadro rotto.
class _UnaFoto extends StatelessWidget {
  const _UnaFoto({
    required this.foto,
    required this.scelta,
    required this.premuta,
  });

  final archivio.Foto foto;
  final bool scelta;
  final VoidCallback premuta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Material(
      color: colori.surfaceContainerHigh,
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: premuta,
        child: Container(
          decoration: BoxDecoration(
            border: scelta ? Border.all(color: colori.primary, width: 2) : null,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(6),
              child: Text(
                foto.nome,
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
