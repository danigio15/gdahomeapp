/// Un dispositivo nuovo, abbinato dal telefono (#54).
///
/// «Vorrei poter abbinare un dispositivo zigbee direttamente dall'app.»
///
/// Prima bisognava aprire Home Assistant, trovare l'integrazione, premere
/// «Aggiungi dispositivo», aspettare, e poi tornare nella plancia a dargli un
/// nome e una sezione. Qui sono tre tocchi, uno dietro l'altro, e la schermata
/// dice a ogni passo cosa sta succedendo davvero.
///
/// ─── Perche' una schermata sola e non quattro ─────────────────────────────
///
/// Perche' e' una cosa sola che va avanti: si apre la rete, si aspetta, entra
/// qualcuno, gli si da' un nome. Quattro schermate impilate vorrebbero dire
/// quattro tasti «indietro» che tornano su un passo che non ha piu' senso —
/// indietro da «e' entrato» si torna ad aspettare una cosa gia' successa — e
/// un conto alla rovescia che sopravvive a una pila di pagine.
///
/// Qui il passo e' uno stato, il «indietro» non c'e' perche' non serve, e
/// quello che regola tutto e' il ponte: e' lui che sa se la rete e' aperta,
/// per quanto ancora, e chi e' entrato.
///
/// ─── Il conto alla rovescia e' quello vero ────────────────────────────────
///
/// Non parte un cronometro qui dentro: si chiede al ponte quanti secondi
/// restano, una volta al secondo, e si scrive quello. Un cronometro locale
/// direbbe «2:58» anche a rete gia' richiusa — l'app messa in tasca, il
/// telefono che dorme, il ponte riavviato — e sarebbe la cosa peggiore:
/// qualcuno che preme il tasto di una presa davanti a una porta chiusa.
///
/// ─── E chi c'e' gia' (#128) ───────────────────────────────────────────────
///
/// «Voglio vedere elenco completo dei dispositivi e poterli eliminare, e
/// mostrare la mappa di collegamento.»
///
/// Sotto il tasto per aggiungerne uno c'e' adesso chi c'e' gia': si tocca una
/// riga e si apre la sua scheda — rinomina, togli dalla rete — e in cima c'e'
/// la porta per la mappa.
///
/// Quelle due sono **pagine spinte sopra**, non passi. E' la differenza che
/// conta: i quattro passi vanno in un verso solo e da loro non si torna
/// indietro, mentre da una scheda e da una mappa si torna sempre — ci si e'
/// andati a guardare qualcosa. Un «indietro» che ha senso vuole una pagina;
/// un «indietro» che non ce l'ha non deve esistere.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../casa/collegamento.dart';
import '../casa/segnalazioni.dart' show spiegaLErrore;
import '../casa/zigbee.dart';
import '../parole.dart';
import '../ponte/filo.dart';
import '../vestito/pezzi.dart';
import '../vestito/quanto_e_largo.dart';

/// Quanto larga si tiene questa sezione.
///
/// Stretta. E' una cosa che si fa in piedi, col dispositivo in una mano e il
/// telefono nell'altra: un tasto grande in mezzo, tre righe da leggere, e
/// niente ai lati. Su un computer larga tutta la finestra sarebbe un conto
/// alla rovescia grande come un piatto con sotto due righe perse.
const double _quantoLarga = 520;

/// I passi, che sono quattro e vanno in un verso solo.
enum _Passo {
  /// La rete c'e' ma e' chiusa: si spiega cosa succede e si apre.
  porta,

  /// Aperta: il conto alla rovescia, e si aspetta che entri qualcuno.
  attesa,

  /// E' entrato: si guarda cos'e' e gli si da' un nome.
  nome,

  /// Fatto: cosa e' stato scritto, e cosa si puo' fare adesso.
  fatto,
}

/// L'abbinamento di un dispositivo Zigbee, dall'inizio alla fine.
class SchermataZigbee extends StatefulWidget {
  const SchermataZigbee({
    super.key,
    required this.collegamento,
    required this.visibile,
    this.quandoVaMessoNellaPlancia,
  });

  final Collegamento collegamento;

  /// Come si consegna il dispositivo alla plancia, perche' chieda lei dove va.
  ///
  /// E' un incarico e non una cosa fatta qui: la plancia sta in un'altra
  /// sezione, dentro un riquadro che questa schermata non ha. Chi tiene
  /// tutt'e due — la home — sa come passare dall'una all'altra.
  ///
  /// Nullo vuol dire che non si puo' consegnare — la schermata da sola, in una
  /// prova — e allora il tasto non si disegna invece di non fare niente.
  final void Function(DispositivoEntrato suo)? quandoVaMessoNellaPlancia;

  /// Se e' questa la sezione che si guarda.
  ///
  /// Conta piu' che altrove: mentre si aspetta si chiede al ponte una volta al
  /// secondo, e continuare a chiederlo da un'altra sezione vorrebbe dire un
  /// giro al minuto per sessanta su una cosa che nessuno sta guardando.
  final bool visibile;

  @override
  State<SchermataZigbee> createState() => _SchermataZigbeeState();
}

class _SchermataZigbeeState extends State<SchermataZigbee> {
  final _nome = TextEditingController();
  StreamSubscription<StatoDellaRete>? _ascolto;

  StatoDellaRete _stato = StatoDellaRete.nessuna;
  _Passo _passo = _Passo.porta;

  /* Chi c'e' gia' nella rete. Si chiede quando si sta sulla porta — e' li'
   * che si vede — e non mentre si aspetta qualcuno che entra: in quel momento
   * la rete ha altro da fare. */
  ChiCEInRete _chiCE = ChiCEInRete.vuoto;
  bool _elencoInCorso = false;

  /// Quello che e' entrato e che si sta sistemando.
  DispositivoEntrato? _suo;

  /// Per quanto era aperta quando si e' cominciato a guardarla.
  ///
  /// L'anello si misura su questo e non su quanto resta adesso: tarandolo su
  /// se stesso resterebbe **fermo a pieno** per tutto il tempo, perche' il
  /// numero sopra e quello sotto sarebbero sempre lo stesso.
  int _erano = 0;

  /// Un tasto premuto e non ancora finito: si spegne, cosi' non lo si preme
  /// due volte mentre il primo tocco e' ancora per strada.
  bool _inCorso = false;

  /// Cosa e' andato storto, detto com'e' arrivato.
  String? _perche;

  Filo? get _presa {
    final filo = widget.collegamento.filo;
    return filo != null && filo.dentro ? filo : null;
  }

  Zigbee? get _zigbee {
    final filo = _presa;
    return filo == null ? null : Zigbee(filo);
  }

  @override
  void initState() {
    super.initState();
    if (widget.visibile) unawaited(_guarda());
  }

  @override
  void didUpdateWidget(SchermataZigbee vecchia) {
    super.didUpdateWidget(vecchia);
    if (widget.visibile && !vecchia.visibile) unawaited(_guarda());
    if (!widget.visibile && vecchia.visibile) _smettiDiAscoltare();
  }

  @override
  void dispose() {
    _smettiDiAscoltare();
    _nome.dispose();
    super.dispose();
  }

  /* ─── il giro ──────────────────────────────────────────────────────────── */

  /// Come sta la rete adesso, una volta.
  ///
  /// Si fa aprendo la sezione, e serve a due cose: sapere che rete c'e', e
  /// raccogliere un'apertura cominciata **prima** — l'app chiusa e riaperta
  /// mentre la rete era ancora aperta torna dov'era, invece di far ricominciare
  /// da capo una cosa che sta gia' andando.
  Future<void> _guarda() async {
    final zigbee = _zigbee;
    if (zigbee == null) return;
    final adesso = await zigbee.stato();
    if (!mounted) return;
    setState(() {
      _stato = adesso;
      if (adesso.aperta && _passo == _Passo.porta) {
        _passo = _Passo.attesa;
        /* Aperta da prima: il quanto non si sa — l'ha aperta un'altra
         * sessione — e allora il massimo e' quello che si vede adesso. */
        _erano = adesso.restano;
      }
    });
    if (_passo == _Passo.attesa) _ascolta();
    if (_passo == _Passo.porta) _chiediLElenco();
  }

  /// Chiede lo stato una volta al secondo, finche' si aspetta.
  void _ascolta() {
    final zigbee = _zigbee;
    if (zigbee == null || _ascolto != null) return;
    _ascolto = zigbee.mentreAspetti().listen(_arrivato);
  }

  void _smettiDiAscoltare() {
    _ascolto?.cancel();
    _ascolto = null;
  }

  /// Quello che dice il ponte, un secondo per volta.
  void _arrivato(StatoDellaRete adesso) {
    if (!mounted) return;
    final primo = adesso.entrati.isEmpty ? null : adesso.entrati.first;
    setState(() {
      _stato = adesso;
      /* E' entrato qualcuno: si passa a dargli un nome, e si smette di
       * aspettare. La casella si riempie col nome che ha adesso — quasi
       * sempre il codice del modello — perche' cancellare e' piu' veloce che
       * scrivere da zero, e perche' fa vedere cosa c'era prima. */
      if (primo != null && _passo == _Passo.attesa) {
        _suo = primo;
        _nome.text = primo.nome;
        _passo = _Passo.nome;
      }
      /* La rete si e' richiusa da sola mentre si aspettava e non e' entrato
       * nessuno: si torna alla porta, che e' da dove si riapre. Restare su un
       * conto alla rovescia fermo a zero sarebbe una schermata che non dice
       * cosa fare. */
      if (!adesso.aperta && primo == null && _passo == _Passo.attesa) {
        _passo = _Passo.porta;
      }
    });
    if (_passo != _Passo.attesa) _smettiDiAscoltare();
  }

  /* ─── i tasti ──────────────────────────────────────────────────────────── */

  /* L'elenco di chi c'e'.
   *
   * Non solleva e non mostra errori: se non si puo' leggere, sotto al tasto
   * non compare niente — che e' esattamente com'era prima che questo elenco
   * esistesse. Un errore rosso su una cosa che nessuno ha chiesto e' peggio
   * di una riga che manca. */
  Future<void> _chiediLElenco() async {
    final filo = _presa;
    if (filo == null || _elencoInCorso) return;
    _elencoInCorso = true;
    try {
      final letto = await Zigbee(filo).elenco();
      if (mounted) setState(() => _chiCE = letto);
    } finally {
      _elencoInCorso = false;
    }
  }

  Future<void> _apri() async {
    final zigbee = _zigbee;
    if (zigbee == null || _inCorso) return;
    setState(() {
      _inCorso = true;
      _perche = null;
    });
    try {
      final adesso = await zigbee.apri();
      if (!mounted) return;
      setState(() {
        _stato = adesso;
        _erano = adesso.restano;
        _passo = _Passo.attesa;
      });
      _ascolta();
    } catch (male) {
      if (!mounted) return;
      setState(() => _perche = spiegaLErrore(male));
    } finally {
      if (mounted) setState(() => _inCorso = false);
    }
  }

  Future<void> _chiudi() async {
    final zigbee = _zigbee;
    if (zigbee == null || _inCorso) return;
    setState(() => _inCorso = true);
    _smettiDiAscoltare();
    try {
      final adesso = await zigbee.chiudi();
      if (!mounted) return;
      setState(() {
        _stato = adesso;
        _passo = _Passo.porta;
      });
    } catch (male) {
      if (!mounted) return;
      setState(() => _perche = spiegaLErrore(male));
    } finally {
      if (mounted) setState(() => _inCorso = false);
    }
  }

  Future<void> _chiamalo() async {
    final zigbee = _zigbee;
    final suo = _suo;
    final come = _nome.text.trim();
    if (zigbee == null || suo == null || come.isEmpty || _inCorso) return;
    setState(() {
      _inCorso = true;
      _perche = null;
    });
    try {
      final rifatto = await zigbee.rinomina(suo.id, come);
      if (!mounted) return;
      setState(() {
        _suo = rifatto;
        _passo = _Passo.fatto;
      });
    } catch (male) {
      if (!mounted) return;
      setState(() => _perche = spiegaLErrore(male));
    } finally {
      if (mounted) setState(() => _inCorso = false);
    }
  }

  /// Lo consegna alla plancia, che chiede lei dove va a finire.
  ///
  /// Solo se il dispositivo ha portato dentro almeno un'entita': il foglietto
  /// della plancia decide la sezione da quelle, e aprirlo su un dispositivo
  /// che non ne ha vorrebbe dire un foglietto che non sa cosa proporre — e
  /// che non potrebbe scrivere niente nemmeno se glielo si dicesse a mano.
  void Function()? get _consegna {
    final suo = _suo;
    final consegna = widget.quandoVaMessoNellaPlancia;
    if (suo == null || consegna == null || suo.entita.isEmpty) return null;
    return () => consegna(suo);
  }

  /* Le due pagine che si aprono sopra questa. Tornando indietro l'elenco si
   * richiede: da una scheda si puo' essere tornati dopo aver rinominato o
   * tolto qualcosa, e una riga rimasta com'era sarebbe una bugia. */
  Future<void> _apriLaScheda(NellaRete suo) async {
    final filo = _presa;
    if (filo == null) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => SchedaDelDispositivoZigbee(
          suo: suo,
          zigbee: Zigbee(filo),
          /* Le entita' si chiedono al momento, e non si mettono nell'elenco:
           * sarebbero sei righe per riga per una cosa che si guarda solo
           * aprendo una scheda. Senza, «Mettilo nella plancia» sarebbe un
           * tasto che si preme e non succede niente — il foglietto «Dove lo
           * metto?» la sezione la decide dall'entita'. */
          quandoVaMessoNellaPlancia: widget.quandoVaMessoNellaPlancia == null
              ? null
              : () async {
                  final intero = await Zigbee(filo).dimmi(suo.dispositivo);
                  if (mounted) widget.quandoVaMessoNellaPlancia!(intero);
                },
        ),
      ),
    );
    if (mounted) await _chiediLElenco();
  }

  Future<void> _guardaLaRete() async {
    final filo = _presa;
    if (filo == null) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => LaMappaDellaReteZigbee(zigbee: Zigbee(filo)),
      ),
    );
  }

  /// Ricomincia da capo, per il prossimo.
  void _unAltro() {
    setState(() {
      _suo = null;
      _perche = null;
      _nome.text = '';
      _passo = _Passo.porta;
    });
    /* E si rilegge chi c'e': ne e' appena entrato uno, e tornare su una porta
     * che non lo elenca vorrebbe dire dubitare di averlo abbinato davvero. */
    _chiediLElenco();
  }

  /* ─── il disegno ───────────────────────────────────────────────────────── */

  @override
  Widget build(BuildContext context) {
    if (_presa == null) {
      return StatoVuoto(
        icona: Icons.cloud_off_rounded,
        titolo: inLingua(it: 'La casa non risponde', en: 'The home is silent'),
        sotto: inLingua(
          it:
              'Per aprire la rete serve il filo con la casa. Appena torna, '
              'questa schermata riparte da sola.',
          en:
              'Opening the network needs the connection to the home. This '
              'screen picks up again as soon as it is back.',
        ),
      );
    }
    return QuantoCiSta(
      quanto: _quantoLarga,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          if (_perche != null) ...[
            _Avviso(_perche!),
            const SizedBox(height: 14),
          ],
          switch (_passo) {
            _Passo.porta => _LaPorta(
              rete: _stato.rete,
              inCorso: _inCorso,
              quandoApre: _apri,
              chiCE: _chiCE,
              quandoSiApreLaScheda: _apriLaScheda,
              quandoSiGuardaLaRete: _guardaLaRete,
            ),
            _Passo.attesa => _LAttesa(
              stato: _stato,
              erano: _erano,
              inCorso: _inCorso,
              quandoChiude: _chiudi,
            ),
            _Passo.nome => _IlNome(
              suo: _suo,
              casella: _nome,
              inCorso: _inCorso,
              quandoConferma: _chiamalo,
            ),
            _Passo.fatto => _Fatto(
              suo: _suo,
              quandoUnAltro: _unAltro,
              quandoLoMette: _consegna,
            ),
          },
        ],
      ),
    );
  }
}

/* ─── i quattro passi ──────────────────────────────────────────────────── */

/// Il passo 1: la rete c'e', e si apre.
class _LaPorta extends StatelessWidget {
  const _LaPorta({
    required this.rete,
    required this.inCorso,
    required this.quandoApre,
    required this.chiCE,
    required this.quandoSiApreLaScheda,
    required this.quandoSiGuardaLaRete,
  });

  final LaRete rete;
  final bool inCorso;
  final VoidCallback quandoApre;

  /// Chi c'e' gia' nella rete. Vuoto finche' il ponte non ha risposto, e
  /// allora sotto al tasto non c'e' niente: com'era prima.
  final ChiCEInRete chiCE;

  final void Function(NellaRete suo) quandoSiApreLaScheda;
  final VoidCallback quandoSiGuardaLaRete;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Scheda(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Cerchietto(icona: Icons.wifi_tethering_rounded, lato: 48),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(rete.nome, style: testi.titleMedium),
                        const SizedBox(height: 2),
                        Text(
                          inLingua(
                            it: 'È la rete che c\'è in questa casa',
                            en: 'This is the network this home has',
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
              const SizedBox(height: 16),
              Text(
                inLingua(
                  it:
                      'Per accoglierne uno nuovo la rete si apre per qualche '
                      'minuto, poi si richiude da sola: nessuno entra mentre '
                      'non guardi.',
                  en:
                      'To take in a new one the network opens for a few '
                      'minutes, then closes by itself: nobody gets in while '
                      'you are not looking.',
                ),
                style: testi.bodyMedium?.copyWith(
                  color: colori.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: inCorso ? null : quandoApre,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(54),
                ),
                child: Text(
                  inLingua(it: 'Apri la rete', en: 'Open the network'),
                ),
              ),
              /* La mappa sta qui e non piu' in basso: e' l'altra cosa che si
               * viene a fare in questa sezione quando qualcosa non va, e
               * cercarla in fondo a una pagina vorrebbe dire non trovarla. */
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: quandoSiGuardaLaRete,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                icon: const Icon(Icons.hub_outlined),
                label: Text(
                  inLingua(it: 'Guarda la rete', en: 'Look at the network'),
                ),
              ),
            ],
          ),
        ),
        if (chiCE.righe.isNotEmpty) ...[
          const SizedBox(height: 18),
          Insegna(
            inLingua(
              it: 'Ce ne sono ${chiCE.righe.length}',
              en: '${chiCE.righe.length} are already here',
            ),
          ),
          Scheda(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (final uno in chiCE.righe)
                  _UnaRigaDellaRete(
                    suo: uno,
                    quandoSiApre: () => quandoSiApreLaScheda(uno),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 18),
        Insegna(inLingua(it: 'Prima di cominciare', en: 'Before you start')),
        Scheda(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          child: Column(
            children: [
              _Punto(
                numero: 1,
                testo: inLingua(
                  it:
                      'Porta il dispositivo vicino a una presa o a una '
                      'lampadina che è già in casa.',
                  en:
                      'Bring the device near a socket or a bulb that is '
                      'already in the home.',
                ),
              ),
              const SizedBox(height: 12),
              _Punto(
                numero: 2,
                testo: inLingua(
                  it: 'Tienilo spento: lo accenderai quando te lo dico io.',
                  en: 'Keep it off: you will switch it on when I say so.',
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Il passo 2: aperta, e si aspetta.
class _LAttesa extends StatelessWidget {
  const _LAttesa({
    required this.stato,
    required this.erano,
    required this.inCorso,
    required this.quandoChiude,
  });

  final StatoDellaRete stato;

  /// Per quanto era aperta all'inizio: e' su questo che si misura l'anello.
  final int erano;
  final bool inCorso;
  final VoidCallback quandoChiude;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _IlConto(restano: stato.restano, erano: erano),
        const SizedBox(height: 20),
        Scheda(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                inLingua(it: 'Adesso tocca a te', en: 'Now it is your turn'),
                style: testi.titleMedium,
              ),
              const SizedBox(height: 14),
              _Punto(
                numero: 1,
                testo: inLingua(
                  it: 'Accendi il dispositivo.',
                  en: 'Switch the device on.',
                ),
              ),
              const SizedBox(height: 12),
              _Punto(
                numero: 2,
                testo: inLingua(
                  it:
                      'Mettilo in abbinamento: quasi sempre si tiene premuto '
                      'il tasto cinque secondi, finché la spia non lampeggia.',
                  en:
                      'Put it in pairing mode: almost always by holding its '
                      'button for five seconds, until the light blinks.',
                ),
              ),
              const SizedBox(height: 12),
              _Punto(
                numero: 3,
                testo: inLingua(
                  it: 'Aspetta qui. Quando entra te lo dico.',
                  en: 'Wait here. I will tell you when it comes in.',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            color: colori.primaryContainer.withValues(alpha: 0.45),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: colori.onPrimaryContainer,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  inLingua(
                    it: 'Sto ascoltando la casa',
                    en: 'I am listening to the home',
                  ),
                  style: testi.bodyMedium?.copyWith(
                    color: colori.onPrimaryContainer,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        OutlinedButton(
          onPressed: inCorso ? null : quandoChiude,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
          ),
          child: Text(
            inLingua(
              it: 'Richiudi la rete adesso',
              en: 'Close the network now',
            ),
          ),
        ),
      ],
    );
  }
}

/// Il conto alla rovescia, con l'anello che si svuota.
class _IlConto extends StatelessWidget {
  const _IlConto({required this.restano, required this.erano});

  final int restano;

  /// Per quanto era aperta all'inizio.
  ///
  /// Per quanto si apra lo decide il ponte, e un anello tarato su un numero
  /// scritto qui davanti a una rete aperta per dieci minuti partirebbe mezzo
  /// vuoto. Zero — non si sa — vale come «pieno»: meglio un anello fermo di
  /// uno che comincia da meta'.
  final int erano;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final minuti = restano ~/ 60;
    final secondi = (restano % 60).toString().padLeft(2, '0');
    final quanto = restano <= 0 || erano <= 0
        ? (restano > 0 ? 1.0 : 0.0)
        : (restano / erano).clamp(0.0, 1.0);
    return Center(
      child: SizedBox(
        width: 208,
        height: 208,
        child: Stack(
          alignment: Alignment.center,
          children: [
            SizedBox.expand(
              child: CircularProgressIndicator(
                value: quanto,
                strokeWidth: 13,
                strokeCap: StrokeCap.round,
                backgroundColor: colori.surfaceContainerHighest,
              ),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$minuti:$secondi',
                  style: testi.displaySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  inLingua(it: 'poi si richiude', en: 'then it closes'),
                  style: testi.labelSmall?.copyWith(
                    color: colori.onSurfaceVariant,
                    letterSpacing: 1.6,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Il passo 3: e' entrato, e gli si da' un nome.
class _IlNome extends StatelessWidget {
  const _IlNome({
    required this.suo,
    required this.casella,
    required this.inCorso,
    required this.quandoConferma,
  });

  final DispositivoEntrato? suo;
  final TextEditingController casella;
  final bool inCorso;
  final VoidCallback quandoConferma;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final entrato = suo;
    final diFabbrica = entrato?.nome ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Column(
            children: [
              Cerchietto(
                icona: Icons.check_rounded,
                lato: 62,
                fondo: colori.tertiaryContainer,
                colore: colori.onTertiaryContainer,
              ),
              const SizedBox(height: 12),
              Text(
                inLingua(it: 'È entrato', en: 'It came in'),
                style: testi.headlineSmall,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        if (entrato != null && entrato.comeSiRiconosce.isNotEmpty) ...[
          Scheda(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Cerchietto(icona: Icons.memory_rounded, lato: 46),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entrato.comeSiRiconosce,
                        style: testi.titleSmall,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (entrato.tramite.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          /* Da quale integrazione e' arrivato davvero: un
                           * dispositivo entrato mentre la rete Zigbee era
                           * aperta puo' comunque essere un Matter, e dirlo e'
                           * meglio che lasciarlo credere. */
                          entrato.tramite,
                          style: testi.bodySmall?.copyWith(
                            color: colori.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],
        Scheda(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: casella,
                autofocus: true,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => quandoConferma(),
                decoration: InputDecoration(
                  labelText: inLingua(
                    it: 'Come lo chiami',
                    en: 'What you call it',
                  ),
                  border: const OutlineInputBorder(),
                ),
              ),
              if (diFabbrica.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  inLingua(
                    it:
                        'Il nome di fabbrica era «$diFabbrica». Questo lo '
                        'vedrai tu in casa, e lo vede anche Home Assistant.',
                    en:
                        'Its factory name was “$diFabbrica”. This one is what '
                        'you will see at home, and Home Assistant too.',
                  ),
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        ListenableBuilder(
          listenable: casella,
          builder: (context, _) => FilledButton(
            onPressed: inCorso || casella.text.trim().isEmpty
                ? null
                : quandoConferma,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(54),
            ),
            child: Text(inLingua(it: 'Chiamalo così', en: 'Call it that')),
          ),
        ),
      ],
    );
  }
}

/// Il passo 4: fatto.
class _Fatto extends StatelessWidget {
  const _Fatto({
    required this.suo,
    required this.quandoUnAltro,
    required this.quandoLoMette,
  });

  final DispositivoEntrato? suo;
  final VoidCallback quandoUnAltro;

  /// Nullo quando alla plancia non si puo' consegnare: allora si dice cosa
  /// fare a mano, invece di un tasto che non fa niente.
  final VoidCallback? quandoLoMette;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final come = suo?.nome ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Column(
            children: [
              Cerchietto(
                icona: Icons.check_rounded,
                lato: 84,
                fondo: colori.tertiaryContainer,
                colore: colori.onTertiaryContainer,
              ),
              const SizedBox(height: 14),
              Text(
                inLingua(it: 'È a posto', en: 'It is set'),
                style: testi.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                come.isEmpty
                    ? inLingua(
                        it:
                            'Il dispositivo è in casa, con il nome che gli '
                            'hai dato.',
                        en:
                            'The device is in the home, with the name you '
                            'gave it.',
                      )
                    : inLingua(
                        it:
                            'Adesso si chiama «$come», e con quel nome lo '
                            'vedono la plancia e Home Assistant.',
                        en:
                            'It is called “$come” now, and that is the name '
                            'the dashboard and Home Assistant use.',
                      ),
                style: testi.bodyMedium?.copyWith(
                  color: colori.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Scheda(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                inLingua(
                  it: 'Gli manca una sezione',
                  en: 'It still needs a section',
                ),
                style: testi.titleSmall,
              ),
              const SizedBox(height: 8),
              Text(
                quandoLoMette == null
                    ? inLingua(
                        it:
                            'In casa c\'è, ma nella plancia non si vede '
                            'ancora: la sezione gliela dai dalla '
                            'Configurazione, quando vuoi.',
                        en:
                            'It is in the home, but the dashboard does not '
                            'show it yet: you give it a section from Config, '
                            'whenever you like.',
                      )
                    : inLingua(
                        it:
                            'In casa c\'è, ma nella plancia non si vede '
                            'ancora. Te lo chiede lei dove metterlo — Luci, '
                            'Prese, Clima — facendoti vedere prima cosa '
                            'scrive.',
                        en:
                            'It is in the home, but the dashboard does not '
                            'show it yet. It will ask you where it goes — '
                            'Lights, Sockets, Climate — showing you first '
                            'what it will write.',
                      ),
                style: testi.bodyMedium?.copyWith(
                  color: colori.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        if (quandoLoMette != null) ...[
          FilledButton(
            onPressed: quandoLoMette,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(54),
            ),
            child: Text(
              inLingua(
                it: 'Adesso mettilo nella plancia',
                en: 'Now put it on the dashboard',
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],
        OutlinedButton(
          onPressed: quandoUnAltro,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
          ),
          child: Text(
            inLingua(it: 'Aggiungine un altro', en: 'Add another one'),
          ),
        ),
      ],
    );
  }
}

/* ─── i pezzi piccoli ──────────────────────────────────────────────────── */

/// Un passo numerato: il cerchietto col numero, e la riga.
class _Punto extends StatelessWidget {
  const _Punto({required this.numero, required this.testo});

  final int numero;
  final String testo;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: colori.primaryContainer,
            shape: BoxShape.circle,
          ),
          child: Text(
            '$numero',
            style: testi.labelMedium?.copyWith(
              color: colori.onPrimaryContainer,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: Text(testo, style: testi.bodyMedium)),
      ],
    );
  }
}

/// Quello che è andato storto, sopra il passo in cui è successo.
class _Avviso extends StatelessWidget {
  const _Avviso(this.perche);

  final String perche;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: colori.errorContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.error_outline_rounded,
            size: 20,
            color: colori.onErrorContainer,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              perche,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: colori.onErrorContainer),
            ),
          ),
        ],
      ),
    );
  }
}

/* ═══ Chi c'e' gia' nella rete (#128) ═══════════════════════════════════════
 *
 * Una riga, una scheda e una mappa. Stanno in fondo a questo file e non in uno
 * loro perche' sono la stessa sezione: chi apre lo Zigbee viene a fare quattro
 * cose — aggiungerne uno, guardare chi c'e', toglierne uno, vedere come e'
 * messa la rete — e tenerle vicine e' quello che le fa sembrare una cosa sola.
 */

/// Una riga dell'elenco: chi e', che mestiere fa, e come sta messo.
class _UnaRigaDellaRete extends StatelessWidget {
  const _UnaRigaDellaRete({required this.suo, required this.quandoSiApre});

  final NellaRete suo;
  final VoidCallback quandoSiApre;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return ListTile(
      onTap: quandoSiApre,
      leading: Cerchietto(
        icona: suo.eLAntenna
            ? Icons.settings_input_antenna_rounded
            : suo.reggeGliAltri
            ? Icons.wifi_tethering_rounded
            : Icons.sensors_rounded,
        lato: 40,
      ),
      title: Text(suo.nome, style: testi.titleSmall),
      subtitle: Text(
        suo.comeSiDice,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
      ),
      /* La batteria si dice, e si dice solo quando la rete lo dice: «non si
       * sa» non diventa «a corrente». */
      trailing: suo.vaABatteria
          ? Icon(
              Icons.battery_std_rounded,
              size: 18,
              color: colori.onSurfaceVariant,
            )
          : const Icon(Icons.chevron_right_rounded),
    );
  }
}

/// La scheda di un apparecchio che nella rete c'e' gia'.
///
/// Tre cose, in ordine di quanto costano se si sbaglia: mettilo nella plancia,
/// rinominalo, toglilo dalla rete. L'ultima sta in fondo, staccata, e chiede
/// conferma.
class SchedaDelDispositivoZigbee extends StatefulWidget {
  const SchedaDelDispositivoZigbee({
    super.key,
    required this.suo,
    required this.zigbee,
    this.quandoVaMessoNellaPlancia,
  });

  final NellaRete suo;
  final Zigbee zigbee;

  /// Nullo quando non si puo' consegnare alla plancia: allora il tasto non si
  /// disegna, invece di esserci e non fare niente.
  final Future<void> Function()? quandoVaMessoNellaPlancia;

  @override
  State<SchedaDelDispositivoZigbee> createState() =>
      _SchedaDelDispositivoZigbeeState();
}

class _SchedaDelDispositivoZigbeeState
    extends State<SchedaDelDispositivoZigbee> {
  late final TextEditingController _nome = TextEditingController(
    text: widget.suo.nome,
  );
  bool _inCorso = false;
  String? _perche;

  @override
  void dispose() {
    _nome.dispose();
    super.dispose();
  }

  Future<void> _rinomina() async {
    final come = _nome.text.trim();
    if (come.isEmpty || come == widget.suo.nome) return;
    setState(() {
      _inCorso = true;
      _perche = null;
    });
    try {
      await widget.zigbee.rinomina(widget.suo.dispositivo, come);
      if (mounted) Navigator.of(context).pop();
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    } finally {
      if (mounted) setState(() => _inCorso = false);
    }
  }

  Future<void> _togli() async {
    final sicuro = await showDialog<bool>(
      context: context,
      builder: (dentro) => AlertDialog(
        title: Text(
          inLingua(
            it: 'Togliere «${widget.suo.nome}» dalla rete?',
            en: 'Remove “${widget.suo.nome}” from the network?',
          ),
        ),
        content: Text(
          /* Si dice cosa succede davvero, e si dice la parte che costa: non
           * «vuoi procedere», ma «per rimetterlo serve tornare qui col
           * dispositivo in mano». */
          widget.suo.reggeGliAltri
              ? inLingua(
                  it:
                      'Questo tiene su la rete per gli altri: togliendolo, '
                      'quello che ci passava dovrà trovarsi un\'altra strada, '
                      'e qualcosa può restare zitto per un po\'. Per '
                      'rimetterlo bisogna riabbinarlo da qui, col dispositivo '
                      'in mano.',
                  en:
                      'This one carries the network for the others: remove '
                      'it and whatever passed through it has to find another '
                      'way, so something may go quiet for a while. Putting it '
                      'back means pairing it again from here, with the device '
                      'in your hand.',
                )
              : inLingua(
                  it:
                      'Sparisce dalla rete e da Home Assistant. Per rimetterlo '
                      'bisogna riabbinarlo da qui, col dispositivo in mano.',
                  en:
                      'It goes from the network and from Home Assistant. '
                      'Putting it back means pairing it again from here, with '
                      'the device in your hand.',
                ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dentro).pop(false),
            child: Text(inLingua(it: 'Lascia stare', en: 'Leave it')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dentro).pop(true),
            child: Text(inLingua(it: 'Toglilo', en: 'Remove it')),
          ),
        ],
      ),
    );
    if (sicuro != true || !mounted) return;
    setState(() {
      _inCorso = true;
      _perche = null;
    });
    try {
      await widget.zigbee.elimina(widget.suo.targa);
      if (mounted) Navigator.of(context).pop();
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    } finally {
      if (mounted) setState(() => _inCorso = false);
    }
  }

  /* Prima si chiedono le entita' — un giro sul filo che puo' andare storto —
   * e solo se arriva si chiude la pagina. Chiudendo prima, un errore si
   * mostrerebbe su una schermata che non c'e' piu'. */
  Future<void> _mettiNellaPlancia() async {
    setState(() {
      _inCorso = true;
      _perche = null;
    });
    try {
      await widget.quandoVaMessoNellaPlancia!();
      if (mounted) Navigator.of(context).pop();
    } catch (errore) {
      if (mounted) setState(() => _perche = spiegaLErrore(errore));
    } finally {
      if (mounted) setState(() => _inCorso = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final suo = widget.suo;
    return Scaffold(
      appBar: AppBar(title: Text(suo.nome)),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: _quantoLarga),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Scheda(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(suo.comeSiDice, style: testi.titleSmall),
                    const SizedBox(height: 6),
                    Text(
                      [
                        if (suo.eLAntenna)
                          inLingua(
                            it: 'È l\'antenna della rete',
                            en: 'It is the network antenna',
                          )
                        else if (suo.reggeGliAltri)
                          inLingua(
                            it: 'Fa da ponte per gli altri',
                            en: 'It relays for the others',
                          )
                        else
                          inLingua(
                            it: 'Sta in fondo a un ramo',
                            en: 'It sits at the end of a branch',
                          ),
                        if (suo.vaABatteria)
                          inLingua(it: 'va a batteria', en: 'battery powered'),
                      ].join(' · '),
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 4),
                    /* La targa in chiaro: e' quello che si incolla in una
                     * segnalazione, e l'unica cosa che le due reti chiamano
                     * allo stesso modo. */
                    SelectableText(
                      suo.targa,
                      style: testi.bodySmall?.copyWith(
                        color: colori.onSurfaceVariant,
                        fontFeatures: const [],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Insegna(inLingua(it: 'Come si chiama', en: 'What it is called')),
              Scheda(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _nome,
                      enabled: !_inCorso,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _rinomina(),
                      decoration: InputDecoration(
                        labelText: inLingua(it: 'Nome', en: 'Name'),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _inCorso ? null : _rinomina,
                      child: Text(
                        inLingua(it: 'Salva il nome', en: 'Save the name'),
                      ),
                    ),
                  ],
                ),
              ),
              if (widget.quandoVaMessoNellaPlancia != null &&
                  suo.dispositivo.isNotEmpty) ...[
                const SizedBox(height: 18),
                OutlinedButton.icon(
                  onPressed: _inCorso ? null : _mettiNellaPlancia,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                  ),
                  icon: const Icon(Icons.dashboard_customize_outlined),
                  label: Text(
                    inLingua(
                      it: 'Mettilo nella plancia',
                      en: 'Put it on the dashboard',
                    ),
                  ),
                ),
              ],
              if (_perche != null) ...[
                const SizedBox(height: 14),
                Text(
                  _perche!,
                  style: testi.bodyMedium?.copyWith(color: colori.error),
                ),
              ],
              const SizedBox(height: 28),
              /* In fondo e staccato: e' l'unica cosa di questa pagina che non
               * si disfa premendo di nuovo. */
              TextButton.icon(
                onPressed: _inCorso ? null : _togli,
                style: TextButton.styleFrom(foregroundColor: colori.error),
                icon: const Icon(Icons.link_off_rounded),
                label: Text(
                  inLingua(
                    it: 'Togli dalla rete',
                    en: 'Remove from the network',
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

/// La mappa della rete: chi parla con chi.
///
/// ─── Perche' c'e' un tasto e non si disegna da sola ──────────────────────
///
/// Perche' chiederla alla rete **non e' una lettura**: e' un giro di domande
/// che il coordinatore fa a ogni ripetitore, uno alla volta, e su una rete di
/// venti cose ci mette fino a un minuto — durante il quale la rete e'
/// occupata e i comandi passano piu' lenti. Una mappa che si rifa' da sola a
/// ogni apertura vorrebbe dire le luci di casa piu' lente ogni volta che
/// qualcuno guarda questa pagina.
///
/// Quindi all'apertura si mostra quello che la rete sa gia', e il giro vero lo
/// fa partire chi lo chiede, sapendo che dura.
///
/// ─── Perche' il disegno arriva gia' fatto ────────────────────────────────
///
/// Lo fa il ponte, e qui si mostra. Disegnarlo in Dart vorrebbe dire la stessa
/// geometria scritta due volte — una qui e una nella plancia, che e'
/// JavaScript — e due mappe che il giorno che una cambia dicono cose diverse.
class LaMappaDellaReteZigbee extends StatefulWidget {
  const LaMappaDellaReteZigbee({super.key, required this.zigbee});

  final Zigbee zigbee;

  @override
  State<LaMappaDellaReteZigbee> createState() => _LaMappaDellaReteZigbeeState();
}

class _LaMappaDellaReteZigbeeState extends State<LaMappaDellaReteZigbee> {
  LaMappaDellaRete _mappa = LaMappaDellaRete.vuota;
  bool _inCorso = false;
  bool _letta = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_letta) {
      _letta = true;
      _chiedi(rifai: false);
    }
  }

  Future<void> _chiedi({required bool rifai}) async {
    if (_inCorso) return;
    setState(() => _inCorso = true);
    /* La veste si legge adesso e non quando si e' costruita la pagina: chi
     * cambia tema col telefono in mano deve vedere la mappa cambiare col
     * resto, non restare con un fondo bianco in una schermata scura. */
    final scuro = Theme.of(context).brightness == Brightness.dark;
    final letta = await widget.zigbee.mappa(rifai: rifai, scuro: scuro);
    if (!mounted) return;
    setState(() {
      _mappa = letta;
      _inCorso = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(inLingua(it: 'La rete', en: 'The network')),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (_mappa.cE)
                Scheda(
                  padding: const EdgeInsets.all(10),
                  /* Si puo' avvicinare e spostare: su un telefono una rete di
                   * venti cose sta in uno schermo solo se si rimpicciolisce
                   * tanto da non leggere piu' i nomi. */
                  child: InteractiveViewer(
                    maxScale: 4,
                    child: SvgPicture.string(
                      _mappa.figura,
                      fit: BoxFit.contain,
                    ),
                  ),
                )
              else if (!_inCorso)
                StatoVuoto(
                  dentroUnaLista: true,
                  icona: Icons.hub_outlined,
                  titolo: inLingua(
                    it: 'La mappa non c\'è ancora',
                    en: 'There is no map yet',
                  ),
                  sotto: _mappa.perche.isNotEmpty
                      ? _mappa.perche
                      : inLingua(
                          it:
                              'La rete non ha ancora guardato con chi parla '
                              'ognuno.',
                          en:
                              'The network has not yet looked at who talks to '
                              'whom.',
                        ),
                ),
              if (_inCorso) ...[
                const SizedBox(height: 24),
                const Center(child: CircularProgressIndicator()),
                const SizedBox(height: 14),
                Text(
                  inLingua(
                    it:
                        'La rete si sta guardando: il coordinatore chiede a '
                        'ogni ripetitore, uno alla volta. Può volerci un '
                        'minuto.',
                    en:
                        'The network is looking at itself: the coordinator '
                        'asks each repeater, one at a time. It can take a '
                        'minute.',
                  ),
                  textAlign: TextAlign.center,
                  style: testi.bodySmall?.copyWith(
                    color: colori.onSurfaceVariant,
                  ),
                ),
              ],
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: _inCorso ? null : () => _chiedi(rifai: true),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
                icon: const Icon(Icons.refresh_rounded),
                label: Text(inLingua(it: 'Rifai il giro', en: 'Look again')),
              ),
              const SizedBox(height: 10),
              Text(
                inLingua(
                  it:
                      'Mentre la rete si guarda i comandi passano più lenti: '
                      'è un giro che si fa quando serve, non a ogni apertura.',
                  en:
                      'While the network looks at itself commands run '
                      'slower: it is a round you do when you need it, not on '
                      'every visit.',
                ),
                style: testi.bodySmall?.copyWith(
                  color: colori.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
