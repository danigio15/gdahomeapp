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
library;

import 'dart:async';

import 'package:flutter/material.dart';

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

  /// Ricomincia da capo, per il prossimo.
  void _unAltro() {
    setState(() {
      _suo = null;
      _perche = null;
      _nome.text = '';
      _passo = _Passo.porta;
    });
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
  });

  final LaRete rete;
  final bool inCorso;
  final VoidCallback quandoApre;

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
            ],
          ),
        ),
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
