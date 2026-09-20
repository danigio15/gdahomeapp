/// La schermata del cruscotto di chi installa.
///
/// Il cruscotto **si apre qui dentro**, in un riquadro, ed e' quello vero: la
/// pagina che sta sul quadro. Non una copia rifatta in Flutter — quella
/// sarebbe un terzo posto dove vivono le stesse regole (cos'e' un impianto
/// muto, quando un collaudo e' chiuso), e tre posti che dicono la stessa cosa
/// prima o poi ne dicono tre diverse.
///
/// ─── Cosa cambia per la chiave ────────────────────────────────────────────
///
/// Una stesura di questa schermata mandava al browser, e si giustificava cosi':
/// la chiave della flotta sta nel browser, e sul telefono non ci finisce. Era
/// vero, e costava un'app che per la cosa piu' sua — gli impianti di chi la
/// usa — rimbalzava fuori.
///
/// Adesso il riquadro e' qui, e va detto per intero: **la chiave finisce nella
/// memoria di questo riquadro**, cioe' sul telefono. E' la stessa memoria dove
/// gia' sta il segno di Home Assistant di questa casa, che apre molto di piu';
/// non e' una categoria nuova di segreto, ed e' il telefono di chi quegli
/// impianti li ha montati.
///
/// Resta il tasto per aprirlo fuori, piccolo e sempre in vista: serve a chi
/// preferisce il browser, e serve il giorno che il riquadro facesse i capricci
/// su un telefono che non abbiamo in mano.
///
/// **E nel browser il codice arriva lo stesso.** Qui c'era scritto che
/// nell'app web non serviva consegnarlo, perche' il browser se lo sarebbe
/// tenuto: il cruscotto invece lo richiedeva a ogni apertura, e il motivo sta
/// in `riquadro/sul_web.dart`. Adesso lo riceve il riquadro, e lo riceve la
/// scheda che apre il tasto in basso.
///
/// ─── La riga che non si puo' sbagliare ────────────────────────────────────
///
/// `_siPuoAndare` lascia passare **solo** le pagine del quadro. Un collegamento
/// che porta altrove non si apre qui dentro: si apre fuori, nel browser. Un
/// riquadro che segue qualunque indirizzo e' un browser senza barra degli
/// indirizzi, cioe' un posto dove non si vede mai dove si e' finiti.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../parole.dart';
import 'riquadro/qui.dart' as riquadro;

class SchermataDelCruscotto extends StatefulWidget {
  const SchermataDelCruscotto({
    super.key,
    required this.dove,
    this.chiave = '',
    this.visibile = true,
  });

  /// Il codice che apre questa pagina, se il ponte l'ha dato.
  ///
  /// Sta nella scheda dell'add-on — e' quello che fa esistere la voce — e il
  /// ponte lo passa **solo a chi amministra** questa casa. Vuoto vuol dire che
  /// la pagina lo chiede, come faceva prima: non e' un guasto, e' il caso di
  /// chi non amministra.
  final String chiave;

  /// L'indirizzo del cruscotto, come l'ha detto il ponte. Vuoto non arriva
  /// mai: senza, questa schermata non si apre nemmeno.
  final String dove;

  /// Se questa e' la sezione che si sta guardando.
  ///
  /// Le sezioni restano tutte in piedi — la home le tiene in un `IndexedStack`
  /// perche' la plancia non si rifaccia a ogni ritorno — quindi **questa
  /// schermata esiste anche quando nessuno la guarda**. Senza questa riga il
  /// riquadro si aprirebbe all'avvio dell'app, ogni volta, e andrebbe a
  /// chiedere il cruscotto a un installatore che magari quella sezione non la
  /// apre da un mese.
  ///
  /// E' anche la riga che tiene in piedi le prove: `flutter_tester` un WebView
  /// non ce l'ha, e costruirne uno la' dentro solleva. Prima di questa riga
  /// sei prove che con questa schermata non c'entravano niente cadevano
  /// tutte — ed era il modo in cui il difetto vero si e' fatto vedere.
  final bool visibile;

  @override
  State<SchermataDelCruscotto> createState() => _StatoDelCruscotto();
}

class _StatoDelCruscotto extends State<SchermataDelCruscotto> {
  WebViewController? _controllore;
  bool _caricata = false;
  String _guaio = '';

  /// L'indirizzo, se e' un indirizzo.
  ///
  /// `Uri.tryParse('')` **non** torna `null`: torna un `Uri` vuoto, senza
  /// schema e senza casa. Fidarsi del solo `tryParse` voleva dire un riquadro
  /// che prova ad aprire il nulla invece della riga che dice cosa manca.
  Uri? get _indirizzo {
    final quale = Uri.tryParse(widget.dove.trim());
    if (quale == null || quale.host.isEmpty) return null;
    if (quale.scheme != 'https' && quale.scheme != 'http') return null;
    return quale;
  }

  @override
  void didUpdateWidget(SchermataDelCruscotto vecchia) {
    super.didUpdateWidget(vecchia);
    _apriSeTocca();
    /* Il codice arrivato **dopo**. La home lo richiede al ponte finche' non
     * ce l'ha, e puo' arrivare a riquadro gia' aperto: al `load` della
     * pagina era vuoto e non si e' consegnato niente. Senza questa riga la
     * pagina restava a chiederlo a mano con quello giusto gia' in mano. */
    final controllore = _controllore;
    final dove = _indirizzo;
    if (controllore != null &&
        dove != null &&
        widget.chiave.isNotEmpty &&
        widget.chiave != vecchia.chiave) {
      unawaited(
        riquadro.consegnaLaChiave(controllore, widget.chiave, pagina: dove),
      );
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _apriSeTocca();
  }

  /// Apre il riquadro la prima volta che questa sezione si guarda, e mai prima.
  void _apriSeTocca() {
    if (!widget.visibile || _controllore != null) return;
    final dove = _indirizzo;
    if (dove == null) return;
    /* Il fondo pieno, non trasparente: un riquadro trasparente sul telefono
     * lascia vedere quello che gli sta sotto mentre la pagina arriva. */
    final controllore = riquadro.costruisciIlControllore(
      quandoCaricata: () {
        if (mounted) setState(() => _caricata = true);
        /* E appena la pagina c'e', il codice: cosi' non lo si ribatte.
         *
         * `_controllore` e non la variabile qui sotto: questa chiusura la si
         * scrive **dentro** l'espressione che quella variabile la crea, e li'
         * non esiste ancora. Il campo si', ed e' gia' assegnato quando la
         * pagina finisce di caricare. */
        final suo = _controllore;
        if (suo != null) {
          unawaited(
            riquadro.consegnaLaChiave(suo, widget.chiave, pagina: dove),
          );
        }
      },
      quandoFallisce: (perche) {
        if (mounted) setState(() => _guaio = perche);
      },
      siPuoAndare: _siPuoAndare,
      sfondo: Theme.of(context).colorScheme.surface,
    );
    _controllore = controllore;
    riquadro.apriLaPagina(controllore, dove);
  }

  /// Solo il quadro. Tutto il resto esce di qui, e va nel browser.
  bool _siPuoAndare(String indirizzo) {
    final dove = _indirizzo;
    final quale = Uri.tryParse(indirizzo);
    if (dove == null || quale == null) return false;
    if (quale.host == dove.host && quale.scheme == dove.scheme) return true;
    unawaited(_fuori(quale));
    return false;
  }

  /// Fuori: un collegamento che non e' del quadro va nel browser com'e';
  /// il cruscotto stesso — il tasto in basso — ci va **col suo codice**:
  /// nel browser con un messaggio alla scheda nuova, sul telefono con un
  /// biglietto nell'indirizzo (vedi `riquadro/`).
  Future<void> _fuori([Uri? quale]) async {
    if (quale != null) {
      await launchUrl(quale, mode: LaunchMode.externalApplication);
      return;
    }
    final dove = _indirizzo;
    if (dove == null) return;
    await riquadro.apriFuori(dove, widget.chiave);
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    if (_indirizzo == null) {
      return _IlGuaio(
        testo: inLingua(
          it: 'Non so a quale quadro mandarti: manca l\'indirizzo.',
          en: 'I do not know which panel to take you to: the address is missing.',
        ),
        apriFuori: null,
      );
    }
    final controllore = _controllore;
    /* L'indirizzo c'e' ma il riquadro no: vuol dire che questa sezione non si
     * sta guardando ancora, e allora non c'e' niente da disegnare — ne' da
     * aprire. */
    if (controllore == null) return const SizedBox.shrink();
    if (_guaio.isNotEmpty) {
      return _IlGuaio(
        testo: inLingua(
          it:
              'Il cruscotto non si è aperto. Può essere la rete di questo '
              'telefono, o il quadro che non risponde.',
          en:
              'The panel did not open. It may be this phone\'s network, or the '
              'panel not answering.',
        ),
        apriFuori: _fuori,
      );
    }
    return Stack(
      children: [
        Positioned.fill(
          child: riquadro.riquadroDelWebView(controllore, ibrido: false),
        ),
        /* Il velo finche' la pagina non c'e': un riquadro vuoto e un riquadro
         * che sta arrivando si somigliano troppo. */
        if (!_caricata)
          Positioned.fill(
            child: ColoredBox(
              color: tema.colorScheme.surface,
              child: const Center(child: CircularProgressIndicator()),
            ),
          ),
        /* Il tasto per uscirne, sempre in vista. Piccolo, in un angolo: non e'
         * la strada normale, ed e' la strada che salva quando quella normale
         * non funziona. */
        Positioned(
          right: 12,
          bottom: 12,
          child: SafeArea(
            child: Tooltip(
              message: inLingua(
                it: 'Apri il cruscotto nel browser',
                en: 'Open the fleet in the browser',
              ),
              child: FloatingActionButton.small(
                heroTag: null,
                onPressed: () => _fuori(),
                child: const Icon(Icons.open_in_new_rounded),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Quando non c'e' niente da mostrare: si dice cosa, e si offre la via di
/// scampo se ce n'e' una.
class _IlGuaio extends StatelessWidget {
  const _IlGuaio({required this.testo, required this.apriFuori});

  final String testo;
  final Future<void> Function()? apriFuori;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(testo, style: tema.textTheme.bodyMedium),
              if (apriFuori != null) ...[
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: apriFuori,
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: Text(
                    inLingua(
                      it: 'Aprilo nel browser',
                      en: 'Open it in the browser',
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
