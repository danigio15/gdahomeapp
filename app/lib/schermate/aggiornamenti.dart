/// Gli aggiornamenti di casa: cosa aspetta, e i due tasti per farlo.
///
/// «Quando ci saranno gli aggiornamenti, e quindi compaiono in Home Assistant,
/// chi utilizzerà app non vedrà mai aggiornamenti se non accede su HA.»
///
/// Questa sezione esiste per quella frase. In Home Assistant gli
/// aggiornamenti stanno in una pagina che chi usa l'app non apre piu', e
/// restano li' — Home Assistant, gli add-on, gdahome stesso, la plancia, i
/// firmware delle prese — finche' qualcuno non ci entra apposta. Qui stanno
/// nel menu, col loro numero addosso alla voce: non c'e' niente da andare a
/// cercare.
///
/// Due cose si dicono prima di premere, e sono le due che in Home Assistant si
/// imparano sbagliando:
///
///  - **quali portano giu' il filo.** Aggiornare gdahome vuol dire riavviare
///    il ponte, cioe' proprio la strada su cui viaggia quel tocco; aggiornare
///    Home Assistant vuol dire fermare la casa. L'app si sconnette, ed e' il
///    segno che sta funzionando. Detto prima e' un'attesa; non detto e' un
///    guasto, e la volta dopo quel tasto non lo preme piu' nessuno;
///  - **cosa cambia.** Le note brevi della versione viaggiano con la riga e
///    stanno sopra il tasto, che e' il posto dove si leggono: prima di
///    premerlo, non dopo.
///
/// Il riavvio sta in fondo e da solo, con la sua domanda: e' l'unica cosa in
/// tutta l'app che spegne la casa, e un tasto cosi' non si mette accanto agli
/// altri.
library;

import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../casa/aggiornamenti.dart';
import '../casa/collegamento.dart';
import '../casa/segnalazioni.dart' show spiegaLErrore;
import '../parole.dart';
import '../ponte/filo.dart';
import 'il_changelog.dart';
import '../vestito/marchio.dart';
import '../vestito/pezzi.dart';
import '../vestito/quanto_e_largo.dart';
import '../vestito/tema.dart';

/// Ogni quanto si riguarda l'elenco mentre si sta qui.
///
/// Un'installazione che va avanti deve **muoversi**: una barra ferma e' la
/// cosa che fa premere due volte. Il ponte l'elenco se lo tiene per dieci
/// secondi, quindi questo giro non gli costa niente.
const _ogniQuanto = Duration(seconds: 6);

/// Quanto larga si tiene questa sezione.
///
/// La home ferma le pagine dell'app a millecento punti, ed e' la misura
/// giusta per una configurazione a due colonne di caselle. Qui no: una riga e'
/// un nome, due versioni e un tasto — duecento punti di roba — e su un
/// millecento il tasto finisce **un metro** a destra di quello che si e'
/// appena letto. Si guarda a sinistra, si preme a destra, e in mezzo c'e' il
/// vuoto.
///
/// Settecentosessanta e' dove la riga resta una riga: il nome, la versione e
/// il tasto si vedono in un colpo d'occhio, e la colonna sta in mezzo alla
/// pagina come sta il foglio del changelog.
const double _quantoLarga = 760;

/// Quanti segni si chiedono insieme.
///
/// Quattro: abbastanza perche' in una casa con dieci aggiornamenti arrivino
/// tutti in due giri, e pochi da non riempire il filo di immagini mentre la
/// schermata sta ancora leggendo l'elenco.
const int _quantiSegniInsieme = 4;

class SchermataDegliAggiornamenti extends StatefulWidget {
  const SchermataDegliAggiornamenti({
    super.key,
    required this.collegamento,
    this.visibile = true,
    this.quandoContati,
  });

  final Collegamento collegamento;

  /// Se questa sezione e' quella che si guarda: l'elenco si chiede la prima
  /// volta che lo e', e si riguarda solo mentre lo e'.
  final bool visibile;

  /// Quanti ne sono rimasti, detto a chi disegna il numero sulla voce del
  /// menu: qui l'elenco e' appena stato letto, ed e' il piu' fresco che ci sia
  /// in tutta l'app.
  final void Function(int quanti)? quandoContati;

  @override
  State<SchermataDegliAggiornamenti> createState() =>
      _SchermataDegliAggiornamentiState();
}

class _SchermataDegliAggiornamentiState
    extends State<SchermataDegliAggiornamenti> {
  List<UnAggiornamento> _fila = const [];
  bool _caricando = false;
  bool _letta = false;
  String? _perche;
  Timer? _giro;

  /* Quelli che sono appena partiti da qui.
   *
   * Il tasto si spegne subito, senza aspettare l'elenco: fra il tocco e
   * l'entita' che si accorge di essere in corso passa qualche secondo, e in
   * quei secondi il tasto acceso e' un secondo avvio della stessa cosa. Si
   * svuota da se': appena l'elenco dice `inCorso`, o quando quella riga
   * sparisce perche' l'aggiornamento e' stato fatto. */
  final _appenaPartiti = <String>{};

  /* I segni gia' arrivati, per entita'. Una voce che c'e' con dentro `null`
   * vuol dire «chiesto, e non ce n'e' uno»: senza distinguere le due cose si
   * richiederebbe per sempre, sei secondi per volta, il logo di chi non ce
   * l'ha. */
  final _loghi = <String, Uint8List?>{};

  /* Home Assistant e' stato mandato a riavviare da qui. Da li' in poi il filo
   * cade, e la schermata lo racconta invece di mostrare un errore. */
  bool _riavviata = false;

  Filo? get _presa {
    final filo = widget.collegamento.filo;
    return filo != null && filo.dentro ? filo : null;
  }

  @override
  void initState() {
    super.initState();
    if (widget.visibile) unawaited(_carica());
    _giro = Timer.periodic(_ogniQuanto, (_) => _unGiro());
  }

  @override
  void dispose() {
    _giro?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(SchermataDegliAggiornamenti vecchia) {
    super.didUpdateWidget(vecchia);
    /* Tornando a vedersi — e quando il filo si rialza — si rilegge: l'elenco
     * di dieci minuti fa non e' l'elenco di adesso. */
    if (widget.visibile && !_caricando && (!_letta || !vecchia.visibile)) {
      unawaited(_carica());
    }
  }

  Future<void> _unGiro() async {
    if (!mounted || !widget.visibile || _caricando) return;
    /* La casa si sta riavviando: si riprova, ed e' l'unico caso in cui si
     * riprova **col filo giu'**. Quando torna su, la schermata se ne accorge
     * da sola — che e' esattamente quello che si e' promesso a chi ha premuto
     * «Riavvia»: «l'app si ricollega da sola, non c'e' niente da fare». */
    if (_riavviata) {
      await _carica(forza: true);
      return;
    }
    if (_presa == null) return;
    /* Fermi non si riguarda niente: quando non c'e' niente in corso l'elenco
     * cambia una volta al mese, e un giro ogni sei secondi sarebbe un
     * `get_states` in casa per niente. Si riguarda mentre qualcosa va avanti,
     * che e' quando la schermata deve muoversi. */
    final qualcosaVa =
        _appenaPartiti.isNotEmpty || _fila.any((uno) => uno.inCorso);
    if (!qualcosaVa) return;
    await _carica(forza: true);
  }

  Future<void> _carica({bool forza = false}) async {
    final filo = _presa;
    if (filo == null) {
      if (mounted) {
        setState(() {
          _caricando = false;
          _perche = _riavviata
              ? null
              : inLingua(
                  it: 'La casa non è collegata.',
                  en: 'Your home isn\'t connected.',
                );
        });
      }
      return;
    }
    setState(() {
      _caricando = true;
      _perche = null;
    });
    try {
      final fila = await GliAggiornamenti(filo).elenco(forza: forza);
      if (!mounted) return;
      setState(() {
        _fila = fila;
        _letta = true;
        _riavviata = false;
        /* Chi e' partito davvero lo dice l'elenco: si lascia nell'attesa solo
         * chi c'e' ancora e non risulta ancora in corso. */
        _appenaPartiti.removeWhere(
          (quale) => !fila.any((uno) => uno.entita == quale && !uno.inCorso),
        );
      });
      widget.quandoContati?.call(fila.length);
      unawaited(_iSegni(fila));
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    } finally {
      if (mounted) setState(() => _caricando = false);
    }
  }

  /* I segni di chi aspetta.
   *
   * Non nell'elenco: un elenco con dentro dieci immagini in base64 sarebbe un
   * messaggio da centinaia di kilobyte ogni sei secondi, e da fuori casa
   * passa dal centralino. Qui si chiedono una volta e si tengono; la riga
   * intanto disegna l'iniziale, e quando il segno arriva si mette al suo
   * posto.
   *
   * **A gruppi, e non uno per volta.** Uno per volta vuol dire che il decimo
   * aspetta i nove prima di lui, e che uno che ci mette dieci secondi — un
   * marchio che non risponde, e su una casa vera ce n'e' sempre uno — tiene
   * fermi tutti quelli dopo. In una casa con dieci aggiornamenti si vedeva:
   * i primi arrivavano e gli ultimi restavano con l'iniziale.
   *
   * E quello che **non si e' riusciti** a prendere non si tiene: al giro dopo
   * si riprova. Si tiene solo il «non ce n'e' uno», che e' una risposta. */
  Future<void> _iSegni(List<UnAggiornamento> fila) async {
    final daChiedere = fila
        .where((uno) => uno.logo && !_loghi.containsKey(uno.entita))
        .toList();
    for (var da = 0; da < daChiedere.length; da += _quantiSegniInsieme) {
      final filo = _presa;
      if (filo == null || !mounted) return;
      final sportello = GliAggiornamenti(filo);
      final questi = daChiedere.skip(da).take(_quantiSegniInsieme).toList();
      final presi = await Future.wait(
        questi.map(
          (uno) => sportello
              .logo(uno.entita)
              /* Una caduta non e' un no: si lascia fuori dalla memoria, e la
               * prossima lettura dell'elenco lo richiede. */
              .then<(Uint8List?, bool)>((byte) => (byte, true))
              .onError<Object>((_, _) => (null, false)),
        ),
      );
      if (!mounted) return;
      setState(() {
        for (var quale = 0; quale < questi.length; quale += 1) {
          final (byte, riuscito) = presi[quale];
          if (riuscito) _loghi[questi[quale].entita] = byte;
        }
      });
    }
  }

  /* Cosa cambia: il foglio, dentro l'app.
   *
   * Il foglio si apre **subito**, e il testo lo aspetta li' dentro: fra il
   * tocco e le note c'e' un giro sul filo — Home Assistant le calcola quando
   * gliele si chiede, non stanno negli attributi — e un tasto che per un
   * secondo non fa niente e' un tasto che si preme due volte.
   *
   * Dove Home Assistant non le sa dare (`leNote` falso) non si chiede niente:
   * il foglio si apre, dice che non ci sono, e offre l'indirizzo. E' l'unico
   * posto da cui si esce ancora dall'app, ed e' l'ultima spiaggia.
   */
  Future<void> _leggi(UnAggiornamento quale) async {
    Future<String> leNote() async {
      final filo = _presa;
      if (!quale.leNote) {
        throw inLingua(
          it: 'Questa casa non sa dare le note di questa versione.',
          en: 'This home can\'t provide notes for this version.',
        );
      }
      if (filo == null) {
        throw inLingua(
          it: 'La casa non è collegata.',
          en: 'Your home isn\'t connected.',
        );
      }
      return GliAggiornamenti(filo).note(quale.entita);
    }

    await apriIlChangelog(
      context,
      nome: quale.nome,
      versioni: quale.versioni,
      testo: leNote,
      laVersioneNuova: quale.a,
      riassunto: quale.dettagli,
      fuori: quale.note,
      /* «Installa» viaggia col foglio, ed e' lo stesso tasto della riga: si
       * legge cosa cambia e si installa da li', senza tornare indietro a
       * ritrovare la riga giusta. */
      quandoInstalla: quale.installabile ? () => _installa(quale) : null,
      quandoApreUnLink: _apriDiFuori,
    );
  }

  /* Un indirizzo che si apre fuori dall'app: i link dentro le note, e la
   * pagina di scorta quando le note non arrivano. */
  Future<void> _apriDiFuori(String dove) async {
    final indirizzo = Uri.tryParse(dove);
    if (indirizzo == null) return;
    await launchUrl(indirizzo, mode: LaunchMode.externalApplication);
  }

  Future<void> _installa(UnAggiornamento quale) async {
    /* Quelli che portano giu' il filo si chiedono prima. Gli altri no: una
     * domanda per ogni tocco e' il modo di insegnare a rispondere «si'» senza
     * leggerla. */
    if (quale.stacca && !await _sicuro(_domandaDellInstallazione(quale))) {
      return;
    }
    final filo = _presa;
    if (filo == null) return;
    setState(() {
      _appenaPartiti.add(quale.entita);
      _perche = null;
    });
    try {
      final esito = await GliAggiornamenti(filo).installa(quale.entita);
      if (!mounted) return;
      if (esito.stacca) _diCheStaccando(quale);
    } catch (errore) {
      /* Non ha preso il via: il tasto torna com'era. Senza questo la riga
       * resterebbe spenta su «in corso» per sempre, e l'unico modo di
       * riprovare sarebbe uscire e rientrare. */
      if (!mounted) return;
      setState(() {
        _appenaPartiti.remove(quale.entita);
        _perche = spiegaLErrore(errore);
      });
      return;
    }
    await _carica(forza: true);
  }

  Future<void> _riavvia() async {
    if (!await _sicuro(_domandaDelRiavvio())) return;
    final filo = _presa;
    if (filo == null) return;
    setState(() => _perche = null);
    try {
      await GliAggiornamenti(filo).riavvia();
    } catch (errore) {
      if (!mounted) return;
      setState(() => _perche = spiegaLErrore(errore));
      return;
    }
    if (!mounted) return;
    setState(() => _riavviata = true);
  }

  Future<bool> _sicuro(_Domanda domanda) async {
    final risposta = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(domanda.titolo),
        content: Text(domanda.corpo),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(inLingua(it: 'Annulla', en: 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(domanda.conferma),
          ),
        ],
      ),
    );
    return risposta == true;
  }

  _Domanda _domandaDellInstallazione(UnAggiornamento quale) => _Domanda(
    titolo: inLingua(
      it: 'Aggiornare ${quale.nome}?',
      en: 'Update ${quale.nome}?',
    ),
    corpo: inLingua(
      it:
          'Per aggiornarlo la casa si riavvia, e l\'app resta senza '
          'collegamento per qualche minuto. È normale: si ricollega da sola '
          'appena è tornata su.',
      en:
          'To update it your home restarts, and the app stays disconnected '
          'for a few minutes. That\'s normal: it reconnects on its own as '
          'soon as it\'s back.',
    ),
    conferma: inLingua(it: 'Aggiorna', en: 'Update'),
  );

  _Domanda _domandaDelRiavvio() => _Domanda(
    titolo: inLingua(
      it: 'Riavviare Home Assistant?',
      en: 'Restart Home Assistant?',
    ),
    corpo: inLingua(
      it:
          'Per qualche minuto la casa non risponde: niente luci, niente '
          'tapparelle, niente automazioni. L\'app si ricollega da sola appena '
          'è tornata su.',
      en:
          'For a few minutes your home won\'t answer: no lights, no covers, '
          'no automations. The app reconnects on its own as soon as it\'s '
          'back.',
    ),
    conferma: inLingua(it: 'Riavvia', en: 'Restart'),
  );

  void _diCheStaccando(UnAggiornamento quale) {
    final messaggero = ScaffoldMessenger.maybeOf(context);
    messaggero?.showSnackBar(
      SnackBar(
        content: Text(
          inLingua(
            it:
                '${quale.nome} si sta aggiornando: la casa si riavvia, e l\'app '
                'si ricollega da sola.',
            en:
                '${quale.nome} is updating: your home restarts, and the app '
                'reconnects on its own.',
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_riavviata) return _SiStaRiavviando(quandoTorna: () => _carica());
    if (_perche != null && _fila.isEmpty) {
      return StatoVuoto(
        icona: Icons.cloud_off_rounded,
        titolo: inLingua(it: 'Non si riesce a guardare', en: 'Can\'t look'),
        sotto: _perche!,
        azione: FilledButton.icon(
          onPressed: _caricando ? null : () => _carica(forza: true),
          icon: const Icon(Icons.refresh_rounded),
          label: Text(inLingua(it: 'Riprova', en: 'Try again')),
        ),
      );
    }
    if (!_letta && _caricando) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: () => _carica(forza: true),
      child: QuantoCiSta(
        quanto: _quantoLarga,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            _Riassunto(quanti: _fila.length),
            if (_perche != null) ...[
              const SizedBox(height: 12),
              _Avviso(_perche!),
            ],
            if (_fila.isNotEmpty) ...[
              const SizedBox(height: 18),
              Insegna(
                inLingua(it: 'Da fare', en: 'To do'),
                azione: _caricando
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : null,
              ),
              for (final uno in _fila) ...[
                _Riga(
                  quale: uno,
                  segno: _loghi[uno.entita],
                  appenaPartito: _appenaPartiti.contains(uno.entita),
                  quandoInstalla: () => _installa(uno),
                  quandoLegge: () => _leggi(uno),
                ),
                const SizedBox(height: 10),
              ],
            ],
            const SizedBox(height: 18),
            Insegna(inLingua(it: 'La casa', en: 'The home')),
            _IlRiavvio(quandoPremuto: _presa == null ? null : _riavvia),
          ],
        ),
      ),
    );
  }
}

class _Domanda {
  const _Domanda({
    required this.titolo,
    required this.corpo,
    required this.conferma,
  });
  final String titolo;
  final String corpo;
  final String conferma;
}

/// Il cartello in cima: quanti ne aspettano, o che non ne aspetta nessuno.
///
/// «Tutto aggiornato» e' una frase che vale il posto che occupa: e' la
/// risposta alla domanda per cui si e' aperta questa sezione, e senza di lei
/// una schermata vuota si legge come una schermata rotta.
class _Riassunto extends StatelessWidget {
  const _Riassunto({required this.quanti});

  final int quanti;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final aposto = quanti == 0;
    /* L'ambra del marchio, che per gli aggiornamenti e' il colore giusto: un
     * aggiornamento non e' un guasto, e il rosso — in questa casa — vuol dire
     * «vai a vedere adesso». Verde quando non c'e' niente da fare.
     *
     * Due toni e non uno: il velo del fondo prende l'ambra viva, che stesa
     * chiara resta calda; il bordo e il disegno prendono quella scura, che
     * chiara diventerebbe un grigio qualunque. Un colore solo, per tutte e
     * due le cose, dava un fondo beige spento e un bordo che non si vedeva. */
    final tinta = aposto ? Colori.bene : Colori.ambraScura;
    final viva = aposto ? Colori.bene : Colori.ambra;
    return Scheda(
      colore: viva.withValues(alpha: 0.16),
      bordo: tinta.withValues(alpha: 0.32),
      child: Row(
        children: [
          Cerchietto(
            icona: aposto
                ? Icons.verified_rounded
                : Icons.system_update_rounded,
            lato: 44,
            fondo: viva.withValues(alpha: 0.28),
            colore: tinta,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  aposto
                      ? inLingua(it: 'Tutto aggiornato', en: 'All up to date')
                      : quanti == 1
                      ? inLingua(
                          it: '1 aggiornamento da fare',
                          en: '1 update to do',
                        )
                      : inLingua(
                          it: '$quanti aggiornamenti da fare',
                          en: '$quanti updates to do',
                        ),
                  style: testi.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  aposto
                      ? inLingua(
                          it: 'Home Assistant, gli add-on e gdahome.',
                          en: 'Home Assistant, the add-ons and gdahome.',
                        )
                      : inLingua(
                          it: 'Li dice Home Assistant: qui si fanno.',
                          en: 'Home Assistant says so: here you do them.',
                        ),
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Un aggiornamento: chi e', da che versione a che versione, e i suoi tasti.
///
/// ## Il segno davanti
///
/// Sei righe con sei nomi scritti si leggono una per una. Col segno davanti si
/// riconosce quello che si cerca **senza leggere** — il quadrato di gdahome,
/// la casa di Home Assistant, il marchio dell'add-on — ed e' quello che fa
/// una pagina Aggiornamenti invece di un elenco di stringhe. Il nostro non
/// arriva da nessuna parte: e' l'icona dell'app, che sta gia' nel telefono.
/// Gli altri li manda il ponte, e finche' non sono arrivati al loro posto c'e'
/// l'iniziale — che non e' un buco in attesa, e' una cosa che si legge.
///
/// ## I tasti su una riga
///
/// In quest'app i tasti sono larghi quanto la riga, ed e' la regola giusta per
/// il tasto di una pagina. Qui no: sei schede una sotto l'altra, con sei barre
/// azzurre larghe tutta la pagina, sono un muro — e su uno schermo da computer
/// quella barra diventa lunga un metro per la parola «Installa». Dentro una
/// scheda i tasti stanno su una riga, a destra, ognuno della sua misura.
///
/// Senza misure scritte a mano comunque: e' un `Wrap`, e dove non ci stanno
/// affiancati vanno a capo da soli — un telefono piccolo col carattere grande
/// e' il caso in cui succede.
class _Riga extends StatelessWidget {
  const _Riga({
    required this.quale,
    required this.appenaPartito,
    required this.quandoInstalla,
    required this.quandoLegge,
    this.segno,
  });

  final UnAggiornamento quale;

  /// Il logo, quando e' arrivato. Il nostro non passa di qui: quello e' un
  /// pezzo dell'app.
  final Uint8List? segno;

  final bool appenaPartito;
  final VoidCallback quandoInstalla;

  /// Apre il foglio delle note. Lo fa la schermata, che ha il filo.
  final VoidCallback quandoLegge;

  /// Se c'e' qualcosa da leggere, e quindi se «Cosa cambia» ha senso.
  ///
  /// Due modi: Home Assistant sa dare le note lunghe (`leNote`), e allora si
  /// leggono nel foglio; oppure non le sa ma c'e' un indirizzo, e allora il
  /// foglio lo dice e offre di aprirlo. Senza ne' l'una ne' l'altro il tasto
  /// non c'e': un tasto che apre un foglio vuoto e' peggio di nessun tasto.
  bool get ceDaLeggere => quale.leNote || quale.note.isNotEmpty;

  /// «Installa», della sua misura e non largo quanto la riga.
  ///
  /// Il vestito dell'app mette `Size.fromHeight` a tutti i tasti pieni, e
  /// `Size.fromHeight` e' larga **infinito**: e' cosi' che i tasti di una
  /// pagina si prendono la riga intera. Dentro una scheda quel comportamento
  /// va spento, o sei schede fanno sei barre azzurre una sotto l'altra.
  Widget _ilTasto() => FilledButton(
    style: FilledButton.styleFrom(
      minimumSize: const Size(0, 44),
      padding: const EdgeInsets.symmetric(horizontal: 22),
    ),
    onPressed: quandoInstalla,
    child: Text(inLingua(it: 'Installa', en: 'Install')),
  );

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final vaAvanti = quale.inCorso || appenaPartito;

    /* Un tasto solo sta **sulla riga del nome**; due vanno su una riga loro.
     *
     * «Installa» da solo, su una riga sua, lascia mezza scheda vuota a
     * sinistra — e una scheda mezza vuota si legge come una scheda a cui manca
     * qualcosa. Accanto al nome invece non avanza niente: il nome, la
     * versione e il tasto si leggono in un colpo d'occhio, e la riga breve
     * della versione, quando c'e', passa sotto.
     *
     * Quando c'e' anche «Cosa cambia» i due tasti scendono insieme: sono due
     * cose che si fanno, e stanno dove si guarda dopo aver letto. E dove a
     * destra c'e' gia' il bollino «riavvia la casa» il tasto scende comunque:
     * impilati sarebbero un avvertimento e un tasto attaccati, che e'
     * l'accostamento peggiore che potessero avere. */
    final ilTastoDiFianco =
        !vaAvanti && quale.installabile && !ceDaLeggere && !quale.stacca;

    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _IlSegno(quale: quale, segno: segno),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      quale.nome,
                      style: testi.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (quale.versioni.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      _LeVersioni(quale),
                    ],
                  ],
                ),
              ),
              if ((quale.stacca && !vaAvanti) || ilTastoDiFianco) ...[
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (quale.stacca && !vaAvanti)
                      Bollino(
                        inLingua(
                          it: 'riavvia la casa',
                          en: 'restarts the home',
                        ),
                        colore: Colori.ambraScura,
                        fondo: Colori.ambra.withValues(alpha: 0.18),
                      ),
                    if (quale.stacca && !vaAvanti && ilTastoDiFianco)
                      const SizedBox(height: 8),
                    if (ilTastoDiFianco) _ilTasto(),
                  ],
                ),
              ],
            ],
          ),
          if (quale.dettagli.isNotEmpty) ...[
            const SizedBox(height: 9),
            Text(
              quale.dettagli,
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
          ],
          if (!ilTastoDiFianco) const SizedBox(height: 10),
          if (vaAvanti)
            _InCorso(quanto: quale.quanto)
          else if (ilTastoDiFianco)
            /* Il tasto sta di fianco al nome: qui sotto non c'e' niente. */
            const SizedBox.shrink()
          else if (quale.installabile)
            /* «Cosa cambia» accanto a «Installa», e non sopra: sono le due
             * cose che si fanno da qui, e stanno dove si guarda dopo aver
             * letto — in fondo alla scheda, a destra. Leggere viene prima, e
             * sta a sinistra. */
            Align(
              alignment: Alignment.centerRight,
              child: Wrap(
                alignment: WrapAlignment.end,
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (ceDaLeggere)
                    TextButton(
                      onPressed: quandoLegge,
                      child: Text(
                        inLingua(it: 'Cosa cambia', en: 'What changes'),
                      ),
                    ),
                  _ilTasto(),
                ],
              ),
            )
          else
            /* Dove Home Assistant dice che non si installa chiamando un
             * servizio, un tasto sarebbe una promessa che non si mantiene: si
             * dice dove si fa. */
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.handyman_rounded,
                  size: 15,
                  color: colori.onSurfaceVariant,
                ),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(
                    inLingua(
                      it: 'Questo si aggiorna dal suo apparecchio.',
                      en: 'This one updates on the device itself.',
                    ),
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

/// Da che versione a che versione, in modo che si veda **quale** e' quella
/// nuova.
///
/// Prima era una riga sola in grigio, e le due versioni si somigliano per
/// definizione: `1.4.32.7 → 1.4.32.8` grigio su grigio non si legge, si
/// indovina. Quella di adesso e' quella che conta, e sta in evidenza; quella
/// di prima e' il punto di partenza, e sta indietro. Le cifre a larghezza
/// fissa, che se no il numero balla.
class _LeVersioni extends StatelessWidget {
  const _LeVersioni(this.quale);

  final UnAggiornamento quale;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final base = testi.bodySmall?.copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    if (quale.da.isEmpty || quale.a.isEmpty) {
      return Text(
        quale.versioni,
        style: base?.copyWith(
          color: colori.primary,
          fontWeight: FontWeight.w700,
        ),
      );
    }
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: quale.da,
            style: base?.copyWith(color: colori.onSurfaceVariant),
          ),
          /* Le stesse spaziature di `versioni`: la riga scritta e la riga
           * disegnata devono leggersi uguali, che se no sono due modi di
           * scrivere la stessa cosa. */
          TextSpan(
            text: ' → ',
            style: base?.copyWith(
              color: colori.onSurfaceVariant.withValues(alpha: 0.7),
            ),
          ),
          TextSpan(
            text: quale.a,
            style: base?.copyWith(
              color: colori.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// Il segno di chi si aggiorna: il logo quando c'e', l'iniziale quando no.
///
/// Tre casi, in ordine: **il nostro** — l'icona dell'app, che sta nel telefono
/// e non si chiede a nessuno; **quello che ha mandato il ponte**; e
/// **l'iniziale**, per chi non ha un logo o mentre il suo sta arrivando.
///
/// L'iniziale non e' un ripiego che si vede: e' una lettera dentro un quadrato
/// come gli altri, e una riga senza logo resta una riga fatta bene. Un buco
/// grigio in attesa, invece, si legge come una cosa rotta.
class _IlSegno extends StatelessWidget {
  const _IlSegno({required this.quale, this.segno});

  final UnAggiornamento quale;
  final Uint8List? segno;

  static const double _lato = 42;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;

    if (quale.nostra) {
      return const Marchio(lato: _lato);
    }

    final dentro = segno;
    return Container(
      width: _lato,
      height: _lato,
      decoration: BoxDecoration(
        color: colori.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(_lato * 0.24),
      ),
      alignment: Alignment.center,
      clipBehavior: Clip.antiAlias,
      child: dentro == null
          ? Text(
              _laLettera(quale.nome),
              style: testi.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: colori.onSurfaceVariant,
              ),
            )
          : Padding(
              padding: const EdgeInsets.all(5),
              child: Image.memory(
                dentro,
                /* `contain` e non `cover`: un logo e' fatto per stare intero,
                 * e ritagliarne i bordi vuol dire tagliare la parte che lo fa
                 * riconoscere. */
                fit: BoxFit.contain,
                filterQuality: FilterQuality.medium,
                /* Un'immagine che non si apre — un file storto, un formato che
                 * questo telefono non conosce — torna all'iniziale invece di
                 * lasciare il quadratino rotto di sistema. */
                errorBuilder: (contesto, _, _) => Text(
                  _laLettera(quale.nome),
                  style: testi.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ),
            ),
    );
  }

  /// La prima lettera che si legge. Un nome che comincia con un simbolo o con
  /// uno spazio non da' un quadrato vuoto: si prende la prima lettera vera.
  static String _laLettera(String nome) {
    for (final pezzo in nome.trim().split('')) {
      if (RegExp(r'[A-Za-z0-9]').hasMatch(pezzo)) return pezzo.toUpperCase();
    }
    return '?';
  }
}

/// Sta andando: la barra, e a che punto quando Home Assistant lo dice.
///
/// Dove la percentuale non c'e' — e per meta' degli aggiornamenti non c'e' —
/// la striscia si muove da sola e non promette niente: una barra ferma a zero
/// per due minuti sembra un'app bloccata.
class _InCorso extends StatelessWidget {
  const _InCorso({required this.quanto});

  final int quanto;

  @override
  Widget build(BuildContext context) {
    final testi = Theme.of(context).textTheme;
    final colori = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: quanto >= 0 ? quanto / 100 : null,
            minHeight: 6,
          ),
        ),
        const SizedBox(height: 7),
        Text(
          quanto >= 0
              ? inLingua(it: 'In corso · $quanto%', en: 'Installing · $quanto%')
              : inLingua(it: 'In corso', en: 'Installing'),
          style: testi.labelMedium?.copyWith(color: colori.onSurfaceVariant),
        ),
      ],
    );
  }
}

/// Il riavvio della casa: in fondo, da solo, con la sua domanda.
class _IlRiavvio extends StatelessWidget {
  const _IlRiavvio({required this.quandoPremuto});

  final VoidCallback? quandoPremuto;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scheda(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Cerchietto(
                icona: Icons.restart_alt_rounded,
                lato: 44,
                fondo: colori.surfaceContainerHigh,
                colore: colori.onSurfaceVariant,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      inLingua(
                        it: 'Riavvia Home Assistant',
                        en: 'Restart Home Assistant',
                      ),
                      style: testi.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      inLingua(
                        it:
                            'Quando una cosa non risponde più e non si capisce '
                            'perché. Ci mette qualche minuto.',
                        en:
                            'When something stops answering and nobody knows why. '
                            'It takes a few minutes.',
                      ),
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: quandoPremuto,
            child: Text(inLingua(it: 'Riavvia', en: 'Restart')),
          ),
        ],
      ),
    );
  }
}

/// La casa e' stata mandata a riavviare da qui.
///
/// Il filo cade, e questa e' l'unica schermata dell'app in cui una caduta e'
/// una buona notizia: dirlo cosi' e' la differenza fra un'attesa e un guasto.
class _SiStaRiavviando extends StatelessWidget {
  const _SiStaRiavviando({required this.quandoTorna});

  final VoidCallback quandoTorna;

  @override
  Widget build(BuildContext context) => StatoVuoto(
    icona: Icons.restart_alt_rounded,
    titolo: inLingua(
      it: 'Home Assistant si sta riavviando',
      en: 'Home Assistant is restarting',
    ),
    sotto: inLingua(
      it:
          'Ci mette qualche minuto. L\'app si ricollega da sola appena la casa '
          'è tornata su: non c\'è niente da fare.',
      en:
          'It takes a few minutes. The app reconnects on its own as soon as '
          'your home is back: there\'s nothing to do.',
    ),
    azione: FilledButton.icon(
      onPressed: quandoTorna,
      icon: const Icon(Icons.refresh_rounded),
      label: Text(inLingua(it: 'Guarda adesso', en: 'Look now')),
    ),
  );
}

/// Qualcosa non ha funzionato, ma l'elenco c'e' lo stesso: il guaio si dice
/// sopra le righe invece di cancellarle.
class _Avviso extends StatelessWidget {
  const _Avviso(this.testo);

  final String testo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Scheda(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      colore: colori.errorContainer,
      bordo: colori.error.withValues(alpha: 0.4),
      child: Row(
        children: [
          Icon(Icons.error_outline_rounded, color: colori.onErrorContainer),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              testo,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: colori.onErrorContainer),
            ),
          ),
        ],
      ),
    );
  }
}
