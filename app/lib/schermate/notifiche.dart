/// La pagina «Notifiche»: cosa ti dice la casa, e quando.
///
/// **Per casa, e per questo telefono.** Ogni casa ha le sue notifiche, e le
/// impostazioni stanno sul suo ponte: e' lui a decidere se mandare, e un
/// telefono spento non puo' dire «adesso no». In cima si sceglie la casa —
/// sono le stesse case dell'elenco, e sceglierne un'altra vuol dire entrarci.
///
/// Le categorie sono quelle del ponte (`ponte/src/sentinella.js`): Urgenti,
/// Sicurezza, Casa, Persone, Assistente, Manutenzione, piu' le
/// personalizzate, che sono della casa e non del telefono, e «Quando».
///
/// Ogni interruttore si salva appena lo si tocca: sulla casa, e in una copia
/// qui, cosi' la pagina si riapre com'era anche prima che la casa risponda.
library;

import 'dart:async';

import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart';

import '../casa/cassaforte.dart';
import '../casa/collegamento.dart';
import '../casa/entita.dart';
import '../notifiche/modello.dart';
import '../notifiche/notifiche.dart';
import '../notifiche/postino.dart';
import '../parole.dart';
import '../vestito/oggetti.dart';
import '../vestito/pezzi.dart';
import '../vestito/tema.dart';
import 'la_tua_giornata.dart';
import 'notifica_personalizzata.dart';
import 'premium.dart';

part 'notifiche_su_misura.dart';

/// Il disegno, il nome e la riga sotto di ogni evento.
({String disegno, String titolo, String sotto}) comeSiChiama(String evento) =>
    switch (evento) {
      'antifurto' => (
        disegno: 'sicurezza',
        titolo: inLingua(it: 'Antifurto scattato', en: 'Alarm triggered'),
        sotto: inLingua(
          it: 'Subito, con la zona che è scattata',
          en: 'Right away, with the zone that tripped',
        ),
      ),
      'allarmi' => (
        disegno: 'allagamenti',
        titolo: inLingua(it: 'Allagamento, fumo, gas', en: 'Leak, smoke, gas'),
        sotto: inLingua(
          it: 'Dal primo sensore che se ne accorge',
          en: 'From the first sensor that notices',
        ),
      ),
      'campanello' => (
        disegno: 'avvisi',
        titolo: inLingua(it: 'Campanello', en: 'Doorbell'),
        sotto: inLingua(
          it: 'Con la foto della porta e «Apri cancello»',
          en: 'With the door photo and «Open gate»',
        ),
      ),
      'inserimenti' => (
        disegno: 'sicurezza',
        titolo: inLingua(
          it: 'Antifurto inserito o disinserito',
          en: 'Alarm armed or disarmed',
        ),
        sotto: inLingua(
          it: 'Totale, notte, parziale, vacanza, disinserito',
          en: 'Away, night, home, vacation, disarmed',
        ),
      ),
      'uscito' => (
        disegno: 'aperture',
        titolo: inLingua(
          it: 'Uscito senza antifurto',
          en: 'Left without the alarm',
        ),
        sotto: inLingua(
          it: 'L\'ultimo esce e l\'antifurto è spento',
          en: 'The last one leaves and the alarm is off',
        ),
      ),
      'aperture' => (
        disegno: 'varchi',
        titolo: inLingua(
          it: 'Porta o garage aperti',
          en: 'Door or garage open',
        ),
        sotto: inLingua(
          it: 'Di notte, o quando la casa è vuota',
          en: 'At night, or when nobody\'s home',
        ),
      ),
      'movimento' => (
        disegno: 'telecamere',
        titolo: inLingua(
          it: 'Movimento davanti alle telecamere',
          en: 'Motion in front of the cameras',
        ),
        sotto: inLingua(
          it: 'Con la foto · a casa vuota o di notte',
          en: 'With the photo · when away or at night',
        ),
      ),
      'elettrodomestici' => (
        disegno: 'elettrodomestici',
        titolo: inLingua(it: 'Elettrodomestico finito', en: 'Appliance done'),
        sotto: inLingua(
          it: 'Durata, kWh e costo col sole',
          en: 'Duration, kWh and cost with the sun',
        ),
      ),
      'blackout' => (
        disegno: 'ups',
        titolo: inLingua(it: 'Manca la corrente', en: 'Power outage'),
        sotto: inLingua(
          it: 'Dagli UPS: autonomia, e quando torna',
          en: 'From the UPS: runtime, and when it\'s back',
        ),
      ),
      'frigo' => (
        disegno: 'temperatura',
        titolo: inLingua(it: 'Freezer e frigo', en: 'Freezer and fridge'),
        sotto: inLingua(
          it: 'Troppo caldi, o porta rimasta aperta',
          en: 'Too warm, or the door left open',
        ),
      ),
      'pioggia' => (
        disegno: 'irrigazione',
        titolo: inLingua(
          it: 'Pioggia con finestre aperte',
          en: 'Rain with windows open',
        ),
        sotto: inLingua(
          it: 'Mezz\'ora prima, se c\'è una finestra aperta',
          en: 'Half an hour before, if a window is open',
        ),
      ),
      'arrivi' => (
        disegno: 'presenza',
        titolo: inLingua(it: 'Arrivi e uscite', en: 'Arrivals and departures'),
        sotto: inLingua(
          it: 'Solo per le persone che scegli',
          en: 'Only for the people you pick',
        ),
      ),
      'suggerimenti' => (
        disegno: 'azioni',
        titolo: inLingua(it: 'Suggerimenti', en: 'Suggestions'),
        sotto: inLingua(
          it:
              'Luci o clima accesi con la casa vuota, con il tasto per '
              'sistemare',
          en: 'Lights or climate on with nobody home, with a button to fix it',
        ),
      ),
      'riepilogo' => (
        disegno: 'aggiornamenti',
        titolo: inLingua(it: 'Riepilogo serale', en: 'Evening summary'),
        sotto: inLingua(
          it:
              'Una notifica sola: il sole, i soldi, domani, e quello che va '
              'sistemato',
          en:
              'A single notification: the sun, the money, tomorrow, and '
              'what needs fixing',
        ),
      ),
      'viaggi' => (
        disegno: 'ev',
        titolo: inLingua(it: 'Quando partire', en: 'When to leave'),
        sotto: inLingua(
          it:
              'I viaggi pianificati in gdanav, col traffico: arriva anche '
              'nelle ore di silenzio',
          en:
              'Trips planned in gdanav, with traffic: it comes even during '
              'quiet hours',
        ),
      ),
      _ => (disegno: 'avvisi', titolo: evento, sotto: ''),
    };

({String disegno, String titolo}) _laCategoria(String categoria) =>
    switch (categoria) {
      'urgenti' => (
        disegno: 'allerte',
        titolo: inLingua(it: 'Urgenti', en: 'Urgent'),
      ),
      'sicurezza' => (
        disegno: 'sicurezza',
        titolo: inLingua(it: 'Sicurezza', en: 'Security'),
      ),
      'casa' => (disegno: 'home', titolo: inLingua(it: 'Casa', en: 'Home')),
      'persone' => (
        disegno: 'persone',
        titolo: inLingua(it: 'Persone', en: 'People'),
      ),
      'assistente' => (
        disegno: 'assistenza',
        titolo: inLingua(it: 'Assistente di casa', en: 'Home assistant'),
      ),
      'manutenzione' => (
        disegno: 'batterie',
        titolo: inLingua(it: 'Manutenzione', en: 'Maintenance'),
      ),
      'viaggi' => (
        disegno: 'agenda',
        titolo: inLingua(it: 'Viaggi', en: 'Trips'),
      ),
      _ => (disegno: 'avvisi', titolo: categoria),
    };

/// Come si dice una condizione, per la riga di una personalizzata.
String condizioneDetta(NotificaPersonalizzata regola) {
  final per = regola.per > 0
      ? inLingua(it: ' per ', en: ' for ') + durataDetta(regola.per)
      : '';
  final valore = regola.valore;
  return switch (regola.condizione) {
        'sotto' => inLingua(it: 'sotto $valore', en: 'below $valore'),
        'uguale' => inLingua(it: 'uguale a $valore', en: 'equal to $valore'),
        'diverso' => inLingua(
          it: 'diverso da $valore',
          en: 'different from $valore',
        ),
        _ => inLingua(it: 'sopra $valore', en: 'above $valore'),
      } +
      per;
}

String durataDetta(int minuti) {
  if (minuti <= 0) return inLingua(it: 'subito', en: 'right away');
  if (minuti < 60) return '$minuti min';
  if (minuti % 60 == 0) return '${minuti ~/ 60} h';
  return '${minuti ~/ 60} h ${minuti % 60} min';
}

class SchermataDelleNotifiche extends StatefulWidget {
  const SchermataDelleNotifiche({
    super.key,
    required this.collegamento,
    this.postino,
    this.cassaforte = const CassaforteDelSistema(),
    this.nuda = false,
    this.visibile = true,
    this.statoIniziale,
    this.nomeDelTelefono,
  });

  final Collegamento collegamento;

  /// Chi riceve le notifiche su questo telefono. `null` dove non c'e' (nel
  /// browser, nelle prove): la pagina si mostra lo stesso, e lo dice.
  final Postino? postino;
  final Cassaforte cassaforte;
  final bool nuda;
  final bool visibile;

  /// Quello che si mostra prima che la casa risponda: per le prove, e per i
  /// disegni della pagina.
  final StatoDelleNotifiche? statoIniziale;

  /// «iPhone» o «telefono»: per la riga «Attive su questo …».
  final String? nomeDelTelefono;

  @override
  State<SchermataDelleNotifiche> createState() => _StatoDellaPagina();
}

class _StatoDellaPagina extends State<SchermataDelleNotifiche> {
  StatoDelleNotifiche? _stato;
  String? _perche;
  String? _letteDi;
  bool _inProva = false;
  StreamSubscription<void>? _ascolto;

  Collegamento get _collegamento => widget.collegamento;

  /// Se la casa e' Premium: lo dice il ponte (`premium` nello stato); un
  /// ponte di prima non lo dice, e allora vale la licenza che l'app conosce.
  /// In Base le elaborate e il riepilogo della sera non ci sono.
  bool get _premium => _stato?.premium ?? _collegamento.licenza.premium;

  /// Il lucchetto toccato: perche', e che si compra solo dalle app.
  void _spiegaIlPremium() => unawaited(
    spiegaIlPremium(
      context,
      perche: PerchePremium.notifiche,
      collegamento: _collegamento,
    ),
  );

  @override
  void initState() {
    super.initState();
    _stato = widget.statoIniziale;
    _ascolto = _collegamento.cambiamenti.listen((_) => _forseLeggi());
    widget.postino?.addListener(_ridisegna);
    /* Da un ponte di prima il Premium lo dice la licenza dell'app: se cambia,
     * cambiano i lucchetti. */
    _collegamento.licenza.addListener(_ridisegna);
    _forseLeggi();
  }

  @override
  void didUpdateWidget(SchermataDelleNotifiche vecchia) {
    super.didUpdateWidget(vecchia);
    _forseLeggi();
  }

  @override
  void dispose() {
    _ascolto?.cancel();
    widget.postino?.removeListener(_ridisegna);
    _collegamento.licenza.removeListener(_ridisegna);
    super.dispose();
  }

  void _ridisegna() {
    if (mounted) setState(() {});
  }

  /* Si legge quando la pagina si guarda, e quando cambia la casa. */
  void _forseLeggi() {
    if (!widget.visibile) return;
    final casa = _collegamento.casa;
    if (casa == null || _letteDi == casa.id) return;
    final filo = _collegamento.filo;
    if (filo == null || !filo.dentro) {
      unawaited(_dallaCopia(casa.id));
      return;
    }
    _letteDi = casa.id;
    unawaited(_leggi(casa.id));
  }

  Future<void> _dallaCopia(String casa) async {
    final copia = await CopiaDelleNotifiche(widget.cassaforte).leggi(casa);
    if (copia != null && mounted && _stato == null) {
      setState(() => _stato = copia);
    }
  }

  Future<void> _leggi(String casa) async {
    await _dallaCopia(casa);
    final filo = _collegamento.filo;
    if (filo == null) return;
    try {
      final stato = await Notifiche(filo).stato();
      await CopiaDelleNotifiche(widget.cassaforte).scrivi(casa, stato);
      if (!mounted) return;
      setState(() {
        _stato = stato;
        _perche = null;
      });
    } catch (errore) {
      _letteDi = null;
      if (mounted) setState(() => _perche = '$errore');
    }
  }

  /// Cambia le impostazioni: subito a schermo, poi sulla casa.
  Future<void> _imposta(ImpostazioniDelleNotifiche nuove) async {
    final prima = _stato;
    if (prima == null) return;
    setState(() => _stato = prima.con(impostazioni: nuove));
    final filo = _collegamento.filo;
    final casa = _collegamento.casa;
    if (filo == null || casa == null) {
      _dici(
        inLingua(
          it: 'La casa adesso non risponde: riprova fra poco',
          en: 'The home isn\'t answering right now: try again shortly',
        ),
      );
      setState(() => _stato = prima);
      return;
    }
    try {
      final salvate = await Notifiche(filo).imposta(nuove);
      final dopo = (_stato ?? prima).con(impostazioni: salvate);
      await CopiaDelleNotifiche(widget.cassaforte).scrivi(casa.id, dopo);
      if (mounted) setState(() => _stato = dopo);
    } catch (errore) {
      if (!mounted) return;
      setState(() => _stato = prima);
      _dici('$errore');
    }
  }

  void _dici(String cosa) {
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(cosa)));
  }

  Future<void> _interruttoreGenerale(bool acceso) async {
    final stato = _stato;
    if (stato == null) return;
    final postino = widget.postino;
    if (acceso && postino != null && postino.acceso && !postino.permesse) {
      final si = await postino.chiediConUnaSpiegazione(context);
      if (!si) return;
    }
    if (acceso && postino != null) await postino.diloAllaCasa(forza: true);
    await _imposta(stato.impostazioni.con(acceso: acceso));
  }

  Future<void> _prova({String? evento}) async {
    final filo = _collegamento.filo;
    if (filo == null) return;
    setState(() => _inProva = true);
    try {
      await Notifiche(filo).prova(evento: evento);
      _dici(
        inLingua(
          it: 'Partita: arriva fra qualche secondo',
          en: 'Sent: it\'ll arrive in a few seconds',
        ),
      );
    } catch (errore) {
      _dici('$errore');
    } finally {
      if (mounted) setState(() => _inProva = false);
    }
  }

  Future<void> _apriLEditor([NotificaPersonalizzata? regola]) async {
    final stato = _stato;
    if (stato == null) return;
    final salvata = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => SchermataDellaNotificaPersonalizzata(
          collegamento: _collegamento,
          stato: stato,
          regola: regola,
        ),
      ),
    );
    if (salvata == true) {
      _letteDi = null;
      _forseLeggi();
    }
  }

  Future<void> _attivaLaPersonalizzata(
    NotificaPersonalizzata regola,
    bool attiva,
  ) async {
    final filo = _collegamento.filo;
    final stato = _stato;
    if (filo == null || stato == null) return;
    final nuova = regola.con(attiva: attiva);
    setState(
      () => _stato = stato.con(
        personalizzate: [
          for (final una in stato.personalizzate)
            una.id == regola.id ? nuova : una,
        ],
      ),
    );
    try {
      await Notifiche(filo).salva(nuova);
    } catch (errore) {
      if (mounted) setState(() => _stato = stato);
      _dici('$errore');
    }
  }

  /// Le entita' chieste alla casa, quando la plancia non le ha ancora lette:
  /// per i nomi in «Quali».
  Future<List<Entita>> _chiediLeEntita() async {
    final filo = _collegamento.filo;
    if (filo == null) return const [];
    final tutte = await filo.risultato({'type': 'get_states'});
    return [
      if (tutte is List)
        for (final una in tutte)
          if (Entita.leggi(una) case final Entita entita) entita,
    ];
  }

  /// Il foglio di una voce: come arriva quella notifica, su questo telefono.
  Future<void> _apriLaVoce(String evento) async {
    final stato = _stato;
    if (stato == null) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => FoglioDellaVoce(
        evento: evento,
        scelta: stato.impostazioni.sceltaDi(evento),
        stileGenerale: _premium ? stato.impostazioni.stile : 'semplici',
        premium: _premium,
        spiegaIlPremium: _spiegaIlPremium,
        entita: _collegamento.stato?.tutte() ?? const [],
        chiediLeEntita: _chiediLeEntita,
        cambia: (scelta) {
          final adesso = _stato?.impostazioni ?? stato.impostazioni;
          unawaited(_imposta(adesso.conScelta(evento, scelta)));
        },
        prova: _collegamento.filo == null || !stato.registrato
            ? null
            : () => _prova(evento: evento),
      ),
    );
  }

  Future<void> _sceglieOra(String adesso, ValueChanged<String> fatto) async {
    final parti = adesso.split(':');
    final scelta = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.tryParse(parti.first) ?? 0,
        minute: int.tryParse(parti.last) ?? 0,
      ),
    );
    if (scelta == null) return;
    String due(int n) => n.toString().padLeft(2, '0');
    fatto('${due(scelta.hour)}:${due(scelta.minute)}');
  }

  void _aiuto() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (contesto) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          child: Text(
            inLingua(
              it:
                  'Le notifiche le decide la casa: guarda i sensori, e quando '
                  'serve ti scrive. Le regole stanno sul suo add-on, e qui '
                  'scegli quali vuoi ricevere su questo telefono. Partono già '
                  'cifrate con la chiave di questo telefono: il centralino, '
                  'Google e Apple vedono solo un blocco chiuso. Con le '
                  'notifiche «elaborate» la scheda col grafico la disegna '
                  'questo telefono, e la foto della telecamera passa dal '
                  'centralino chiusa con la stessa chiave: lui non la può '
                  'aprire, e la cancella appena consegnata o dopo dieci '
                  'minuti. Con le «semplici» non passa nessuna foto.',
              en:
                  'Your home decides the notifications: it watches the '
                  'sensors and writes to you when needed. The rules live on '
                  'its add-on, and here you choose which ones this phone '
                  'gets. They leave already encrypted with this phone\'s key: '
                  'the relay, Google and Apple only see a sealed block. With '
                  '«rich» notifications this phone draws the chart card, and '
                  'the camera photo goes through the relay sealed with the '
                  'same key: it can\'t open it, and deletes it once '
                  'delivered or after ten minutes. With «simple» ones no '
                  'photo travels at all.',
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final corpo = _ilCorpo(context);
    if (widget.nuda) return corpo;
    return Scaffold(
      appBar: AppBar(
        title: Text(inLingua(it: 'Notifiche', en: 'Notifications')),
        actions: [
          IconButton(
            tooltip: inLingua(it: 'Come funzionano', en: 'How they work'),
            icon: const Icon(Icons.help_outline_rounded),
            onPressed: _aiuto,
          ),
        ],
      ),
      body: corpo,
    );
  }

  Widget _ilCorpo(BuildContext context) {
    final stato = _stato;
    if (stato == null) {
      if (_perche != null) {
        return StatoVuoto(
          icona: Icons.notifications_off_rounded,
          titolo: inLingua(
            it: 'Le notifiche non si leggono',
            en: 'Notifications can\'t be read',
          ),
          sotto: inLingua(
            it:
                'Forse gdahome in casa è di una versione di prima: aggiorna '
                'l\'add-on in Home Assistant.',
            en:
                'Maybe gdahome at home is an older version: update the '
                'add-on in Home Assistant.',
          ),
        );
      }
      return const Center(child: CircularProgressIndicator());
    }
    final imp = stato.impostazioni;
    final spente = !imp.acceso;
    final premium = _premium;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        _LeCase(collegamento: _collegamento),
        const SizedBox(height: 14),
        _IlMaestro(
          acceso: imp.acceso,
          stato: stato,
          postino: widget.postino,
          nomeDelTelefono:
              widget.nomeDelTelefono ??
              (defaultTargetPlatform == TargetPlatform.iOS
                  ? 'iPhone'
                  : inLingua(it: 'telefono', en: 'phone')),
          cambia: _interruttoreGenerale,
        ),
        ..._gliAvvisi(context, stato),
        const SizedBox(height: 20),
        _Titolo(
          disegno: 'evidenza',
          testo: inLingua(it: 'Come le vuoi', en: 'How you want them'),
        ),
        _ComeLeVuoi(
          stile: premium ? imp.stile : 'semplici',
          bloccata: premium ? null : _spiegaIlPremium,
          iPhone: defaultTargetPlatform == TargetPlatform.iOS,
          spento: spente,
          cambia: (stile) => _imposta(imp.con(stile: stile)),
        ),
        const SizedBox(height: 20),
        for (final MapEntry(key: categoria, value: eventi)
            in categorieDelleNotifiche.entries) ...[
          _Titolo(
            disegno: _laCategoria(categoria).disegno,
            testo: _laCategoria(categoria).titolo,
            bollino: categoria == 'urgenti'
                ? inLingua(
                    it: 'suonano anche in silenzioso',
                    en: 'they ring even on silent',
                  )
                : null,
          ),
          Scheda(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final (i, evento) in eventi.indexed) ...[
                  if (i > 0) const _Riga(),
                  /* Il riepilogo della sera in Base non c'e': il lucchetto,
                   * e al tocco la spiegazione. */
                  if (evento == 'riepilogo' && !premium)
                    _Interruttore(
                      chiave: const Key('voce-riepilogo-bloccata'),
                      disegno: comeSiChiama(evento).disegno,
                      titolo: comeSiChiama(evento).titolo,
                      sotto: comeSiChiama(evento).sotto,
                      valore: false,
                      spento: spente,
                      cambia: (_) => _spiegaIlPremium(),
                      bloccata: _spiegaIlPremium,
                    )
                  else
                    _Interruttore(
                      disegno: comeSiChiama(evento).disegno,
                      titolo: comeSiChiama(evento).titolo,
                      sotto: comeSiChiama(evento).sotto,
                      valore: imp.evento(evento),
                      spento: spente,
                      cambia: (si) => _imposta(imp.conEvento(evento, si)),
                      etichette: etichetteDellaVoce(
                        imp,
                        evento,
                        premium: premium,
                      ),
                      apri: () => _apriLaVoce(evento),
                    ),
                ],
                if (categoria == 'persone')
                  _LePersone(
                    persone: stato.persone,
                    scelte: imp.persone,
                    cambia: (scelte) => _imposta(imp.con(persone: scelte)),
                  ),
                if (categoria == 'assistente')
                  _Segmenti(
                    scelto: imp.assistente,
                    voci: {
                      'importanti': inLingua(
                        it: 'Solo gli importanti',
                        en: 'Only important ones',
                      ),
                      'tutti': inLingua(it: 'Tutti', en: 'All'),
                    },
                    cambia: (quale) => _imposta(imp.con(assistente: quale)),
                  ),
                if (categoria == 'manutenzione' && premium) ...[
                  _UnOrario(
                    rientro: 62,
                    pezzi: [
                      inLingua(it: 'Ogni sera alle', en: 'Every evening at'),
                    ],
                    ore: [imp.riepilogo],
                    tocca: (_) => _sceglieOra(
                      imp.riepilogo,
                      (ora) => _imposta(imp.con(riepilogo: ora)),
                    ),
                  ),
                  const _Riga(),
                  _LaGiornata(
                    tocca: () =>
                        apriLaTuaGiornata(context, collegamento: _collegamento),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],
        _Titolo(
          disegno: 'mie',
          testo: inLingua(
            it: 'Notifiche personalizzate',
            en: 'Custom notifications',
          ),
        ),
        Scheda(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (final regola in stato.personalizzate) ...[
                _LaPersonalizzata(
                  regola: regola,
                  cambia: regola.modificabile
                      ? (si) => _attivaLaPersonalizzata(regola, si)
                      : null,
                  tocca: regola.modificabile
                      ? () => _apriLEditor(regola)
                      : null,
                ),
                const _Riga(),
              ],
              _Aggiungi(tocca: () => _apriLEditor()),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _Titolo(
          disegno: 'agenda',
          testo: inLingua(it: 'Quando', en: 'When'),
        ),
        Scheda(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _Interruttore(
                icona: Icons.bedtime_rounded,
                titolo: inLingua(it: 'Ore di silenzio', en: 'Quiet hours'),
                sotto: inLingua(
                  it: 'Le urgenti passano comunque',
                  en: 'Urgent ones still get through',
                ),
                valore: imp.silenzio.acceso,
                spento: spente,
                cambia: (si) =>
                    _imposta(imp.con(silenzio: imp.silenzio.con(acceso: si))),
              ),
              _UnOrario(
                rientro: 68,
                pezzi: [
                  inLingua(it: 'dalle', en: 'from'),
                  inLingua(it: 'alle', en: 'to'),
                ],
                ore: [imp.silenzio.dalle, imp.silenzio.alle],
                tocca: (quale) => _sceglieOra(
                  quale == 0 ? imp.silenzio.dalle : imp.silenzio.alle,
                  (ora) => _imposta(
                    imp.con(
                      silenzio: quale == 0
                          ? imp.silenzio.con(dalle: ora)
                          : imp.silenzio.con(alle: ora),
                    ),
                  ),
                ),
              ),
              const _Riga(),
              _Interruttore(
                icona: Icons.directions_walk_rounded,
                titolo: inLingua(
                  it: 'Solo quando sono fuori casa',
                  en: 'Only when I\'m away',
                ),
                sotto: inLingua(
                  it:
                      'In casa le notifiche di Casa e Assistente restano '
                      'zitte',
                  en: 'At home, Home and Assistant notifications stay quiet',
                ),
                valore: imp.soloFuori,
                spento: spente,
                cambia: (si) => _imposta(imp.con(soloFuori: si)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const _LaPromessa(),
        const SizedBox(height: 12),
        Center(
          child: TextButton.icon(
            onPressed: _inProva || !stato.registrato ? null : () => _prova(),
            icon: _inProva
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send_rounded),
            label: Text(
              inLingua(
                it: 'Manda una notifica di prova',
                en: 'Send a test notification',
              ),
            ),
          ),
        ),
      ],
    );
  }

  List<Widget> _gliAvvisi(BuildContext context, StatoDelleNotifiche stato) {
    final avvisi = <(IconData, String)>[
      if (widget.postino == null || !widget.postino!.acceso)
        (
          Icons.info_outline_rounded,
          inLingua(
            it:
                'Questa versione dell\'app è senza notifiche: le impostazioni '
                'si salvano lo stesso, e valgono quando arrivano.',
            en:
                'This build of the app has no notifications: settings are '
                'still saved, and apply once they arrive.',
          ),
        )
      else if (!widget.postino!.permesse)
        (
          Icons.notifications_off_rounded,
          inLingua(
            it: 'Il telefono non lascia mostrare le notifiche di gdahome.',
            en: 'This phone doesn\'t allow gdahome notifications.',
          ),
        ),
      if (!stato.centralino)
        (
          Icons.cloud_off_rounded,
          inLingua(
            it:
                'Le notifiche passano dal centralino, e questa casa adesso '
                'non lo raggiunge: guarda «Da fuori casa» nella pagina di '
                'gdahome in Home Assistant.',
            en:
                'Notifications go through the relay, and this home can\'t '
                'reach it right now: check «Away from home» on the gdahome '
                'page in Home Assistant.',
          ),
        ),
      if (!stato.intestato)
        (
          Icons.person_off_rounded,
          inLingua(
            it:
                'Questo telefono non è intestato a nessun utente di casa, e '
                'la casa non sa cosa può vedere: riabbinalo per ricevere le '
                'notifiche.',
            en:
                'This phone isn\'t assigned to any home user, so the home '
                'doesn\'t know what it may see: pair it again to get '
                'notifications.',
          ),
        ),
    ];
    final colori = Theme.of(context).colorScheme;
    return [
      for (final (icona, testo) in avvisi) ...[
        const SizedBox(height: 10),
        Scheda(
          colore: colori.secondaryContainer,
          child: Row(
            children: [
              Icon(icona, color: colori.onSecondaryContainer),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  testo,
                  style: TextStyle(color: colori.onSecondaryContainer),
                ),
              ),
            ],
          ),
        ),
      ],
    ];
  }
}

/// Le case, in cima: si sceglie per quale.
class _LeCase extends StatelessWidget {
  const _LeCase({required this.collegamento});

  final Collegamento collegamento;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final tutte = collegamento.archivio.aperto
        ? collegamento.archivio.tutte
        : const [];
    final questa = collegamento.casa;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final casa in tutte)
              ChoiceChip(
                avatar: Icon(
                  casa.id == questa?.id
                      ? Icons.home_rounded
                      : Icons.cottage_outlined,
                  size: 18,
                ),
                label: Text(casa.nome),
                selected: casa.id == questa?.id,
                showCheckmark: false,
                selectedColor: colori.primaryContainer,
                onSelected: casa.id == questa?.id
                    ? (_) {}
                    : (_) async {
                        await collegamento.archivio.scegli(casa.id);
                        await collegamento.apri(forza: true);
                      },
              ),
          ],
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Text.rich(
            TextSpan(
              text: inLingua(
                it: 'Ogni casa ha le sue notifiche. Stai scegliendo per ',
                en:
                    'Each home has its own notifications. You\'re choosing '
                    'for ',
              ),
              children: [
                TextSpan(
                  text: questa?.nome ?? '',
                  style: TextStyle(
                    color: colori.onSurface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const TextSpan(text: '.'),
              ],
            ),
            style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
          ),
        ),
      ],
    );
  }
}

/// L'interruttore generale, nella scheda blu.
class _IlMaestro extends StatelessWidget {
  const _IlMaestro({
    required this.acceso,
    required this.stato,
    required this.postino,
    required this.nomeDelTelefono,
    required this.cambia,
  });

  final bool acceso;
  final StatoDelleNotifiche stato;
  final Postino? postino;
  final String nomeDelTelefono;
  final ValueChanged<bool> cambia;

  @override
  Widget build(BuildContext context) {
    final attive =
        acceso &&
        stato.registrato &&
        (postino == null || !postino!.acceso || postino!.permesse);
    final testi = Theme.of(context).textTheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2563EB), Color(0xFF3B82F6)],
        ),
        boxShadow: Colori.ombra(
          scuro: Theme.of(context).brightness == Brightness.dark,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 12, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.asset(
                    'assets/marchio/gda.png',
                    width: 46,
                    height: 46,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        inLingua(
                          it: 'Notifiche di gdahome',
                          en: 'gdahome notifications',
                        ),
                        style: testi.titleMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        inLingua(
                          it: 'Arrivano anche ad app chiusa',
                          en: 'They arrive even with the app closed',
                        ),
                        style: testi.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: acceso,
                  onChanged: cambia,
                  activeThumbColor: Colori.blu,
                  activeTrackColor: Colors.white,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _Pillola(
                  icona: attive
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  testo: attive
                      ? inLingua(
                          it: 'Attive su questo $nomeDelTelefono',
                          en: 'On for this $nomeDelTelefono',
                        )
                      : inLingua(
                          it: 'Non ancora su questo $nomeDelTelefono',
                          en: 'Not yet on this $nomeDelTelefono',
                        ),
                ),
                _Pillola(
                  icona: Icons.lock_rounded,
                  testo: inLingua(it: 'Cifrate', en: 'Encrypted'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Pillola extends StatelessWidget {
  const _Pillola({required this.icona, required this.testo});
  final IconData icona;
  final String testo;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.18),
      borderRadius: BorderRadius.circular(999),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icona, size: 15, color: Colors.white),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            testo,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

class _Titolo extends StatelessWidget {
  const _Titolo({required this.disegno, required this.testo, this.bollino});
  final String disegno;
  final String testo;
  final String? bollino;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(left: 4, right: 4, bottom: 10),
      child: Row(
        children: [
          Oggetto(disegno, lato: 20),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              testo,
              style: Theme.of(context).textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 8),
          if (bollino != null)
            Expanded(
              child: Align(
                alignment: Alignment.centerRight,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colori.male.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.volume_up_rounded,
                        size: 13,
                        color: Colori.male,
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          bollino!,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: colori.brightness == Brightness.dark
                                    ? const Color(0xFFFDA4AF)
                                    : Colori.male,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Riga extends StatelessWidget {
  const _Riga();
  @override
  Widget build(BuildContext context) =>
      const Divider(height: 1, indent: 62, endIndent: 16);
}

/// Una riga con il suo interruttore. Con [apri], la riga si tocca e apre il
/// foglio della voce; le [etichette] dicono come arriva.
class _Interruttore extends StatelessWidget {
  const _Interruttore({
    this.chiave,
    this.bloccata,
    this.disegno,
    this.icona,
    required this.titolo,
    required this.sotto,
    required this.valore,
    required this.cambia,
    this.spento = false,
    this.etichette = const [],
    this.apri,
  });

  final String? disegno;
  final IconData? icona;
  final String titolo;
  final String sotto;
  final bool valore;
  final bool spento;
  final ValueChanged<bool> cambia;
  final List<(String, Color)> etichette;
  final VoidCallback? apri;
  final Key? chiave;

  /// Una voce di Premium, in una casa Base: il lucchetto e il bollino, e
  /// al tocco la spiegazione.
  final VoidCallback? bloccata;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final apri = bloccata ?? this.apri;
    final riga = Padding(
      key: chiave,
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colori.surfaceContainer,
              borderRadius: BorderRadius.circular(icona != null ? 18 : 10),
            ),
            child: disegno != null
                ? Oggetto(disegno!, lato: 22)
                : Icon(icona, size: 20, color: colori.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (bloccata == null)
                  Text(
                    titolo,
                    style: testi.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  )
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        titolo,
                        style: testi.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const BollinoPremium(),
                    ],
                  ),
                if (sotto.isNotEmpty)
                  Text(
                    sotto,
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                if (etichette.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      for (final (testo, colore) in etichette)
                        _Etichetta(testo: testo, colore: colore),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (apri != null && bloccata == null)
            Icon(
              Icons.chevron_right_rounded,
              color: colori.onSurfaceVariant,
              size: 22,
            ),
          const SizedBox(width: 4),
          if (bloccata != null)
            Icon(Icons.lock_rounded, color: colori.onSurfaceVariant, size: 20)
          else
            Switch(
              value: valore,
              onChanged: spento ? null : cambia,
              activeTrackColor: colori.primary,
              activeThumbColor: colori.onPrimary,
            ),
          if (bloccata != null) const SizedBox(width: 12),
        ],
      ),
    );
    return Opacity(
      opacity: spento ? 0.5 : 1,
      child: apri == null || spento ? riga : InkWell(onTap: apri, child: riga),
    );
  }
}

/// La riga che apre «La tua giornata»: la pagina del riepilogo, quando la
/// si vuole vedere senza aspettare la sera.
class _LaGiornata extends StatelessWidget {
  const _LaGiornata({required this.tocca});
  final VoidCallback tocca;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return InkWell(
      key: const Key('apri-la-giornata'),
      onTap: tocca,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 16, 12),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: colori.surfaceContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Oggetto('solare', lato: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    inLingua(it: 'La tua giornata', en: 'Your day'),
                    style: testi.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    inLingua(
                      it: 'Il sole, i soldi, la casa di oggi: adesso',
                      en: 'Today\'s sun, money and home: right now',
                    ),
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: colori.onSurfaceVariant,
              size: 22,
            ),
          ],
        ),
      ),
    );
  }
}

class _LePersone extends StatelessWidget {
  const _LePersone({
    required this.persone,
    required this.scelte,
    required this.cambia,
  });

  final List<PersonaDiCasa> persone;
  final List<String> scelte;
  final ValueChanged<List<String>> cambia;

  @override
  Widget build(BuildContext context) {
    if (persone.isEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(62, 0, 16, 14),
        child: Text(
          inLingua(
            it: 'In Home Assistant non ci sono persone da seguire.',
            en: 'There are no people to follow in Home Assistant.',
          ),
          style: Theme.of(context).textTheme.bodySmall,
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(62, 0, 16, 14),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final persona in persone)
            FilterChip(
              avatar: CircleAvatar(
                child: Text(
                  persona.nome.isEmpty ? '?' : persona.nome[0].toUpperCase(),
                ),
              ),
              label: Text(persona.nome),
              selected: scelte.contains(persona.id),
              onSelected: (si) => cambia([
                for (final una in scelte)
                  if (una != persona.id) una,
                if (si) persona.id,
              ]),
            ),
        ],
      ),
    );
  }
}

class _Segmenti extends StatelessWidget {
  const _Segmenti({
    required this.scelto,
    required this.voci,
    required this.cambia,
  });

  final String scelto;
  final Map<String, String> voci;
  final ValueChanged<String> cambia;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(62, 0, 16, 14),
    child: SizedBox(
      width: double.infinity,
      child: SegmentedButton<String>(
        showSelectedIcon: false,
        segments: [
          for (final MapEntry(:key, :value) in voci.entries)
            ButtonSegment(value: key, label: Text(value)),
        ],
        selected: {scelto},
        onSelectionChanged: (scelta) => cambia(scelta.first),
      ),
    ),
  );
}

/// «Ogni sera alle [20:30]», «dalle [23:00] alle [07:00]».
class _UnOrario extends StatelessWidget {
  const _UnOrario({
    required this.rientro,
    required this.pezzi,
    required this.ore,
    required this.tocca,
  });

  final double rientro;
  final List<String> pezzi;
  final List<String> ore;
  final ValueChanged<int> tocca;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(rientro, 0, 16, 14),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 8,
        runSpacing: 6,
        children: [
          for (final (i, ora) in ore.indexed) ...[
            Text(
              pezzi[i],
              style: testi.bodySmall?.copyWith(color: colori.onSurfaceVariant),
            ),
            Material(
              color: colori.surfaceContainer,
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => tocca(i),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  child: Text(
                    ora,
                    style: testi.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _LaPersonalizzata extends StatelessWidget {
  const _LaPersonalizzata({
    required this.regola,
    required this.cambia,
    required this.tocca,
  });

  final NotificaPersonalizzata regola;
  final ValueChanged<bool>? cambia;
  final VoidCallback? tocca;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return InkWell(
      onTap: tocca,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
        child: Row(
          children: [
            Cerchietto(
              icona: iconaDellEntita(regola.entita),
              lato: 36,
              fondo: colori.surfaceContainer,
              colore: colori.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    regola.titolo,
                    style: testi.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: regola.entita,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontFamilyFallback: const ['Menlo', 'Courier'],
                            fontSize: 12,
                            backgroundColor: colori.surfaceContainer,
                          ),
                        ),
                        TextSpan(text: ' ${condizioneDetta(regola)}'),
                      ],
                    ),
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Switch(
              value: regola.attiva,
              onChanged: cambia,
              activeTrackColor: colori.primary,
              activeThumbColor: colori.onPrimary,
            ),
          ],
        ),
      ),
    );
  }
}

/// L'icona di un'entita', dal suo dominio e dal nome.
IconData iconaDellEntita(String entita) {
  if (RegExp('freezer|congelator|frigo|fridge').hasMatch(entita)) {
    return Icons.ac_unit_rounded;
  }
  if (RegExp('cancell|gate').hasMatch(entita)) return Icons.fence_rounded;
  return switch (entita.split('.').first) {
    'sensor' => Icons.sensors_rounded,
    'binary_sensor' => Icons.toggle_on_rounded,
    'light' => Icons.lightbulb_rounded,
    'switch' => Icons.power_settings_new_rounded,
    'climate' => Icons.thermostat_rounded,
    'cover' => Icons.blinds_rounded,
    'lock' => Icons.lock_rounded,
    'person' => Icons.person_rounded,
    _ => Icons.tune_rounded,
  };
}

class _Aggiungi extends StatelessWidget {
  const _Aggiungi({required this.tocca});
  final VoidCallback tocca;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final freccia = Icon(
      Icons.arrow_forward_rounded,
      size: 13,
      color: colori.onSurfaceVariant,
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      child: Row(
        children: [
          OutlinedButton.icon(
            /* Il tema vuole i tasti bordati larghi quanto la riga: questo sta
             * accanto a una scritta, e prende quello che gli serve. */
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
            onPressed: tocca,
            icon: const Icon(Icons.add_rounded),
            label: Text(inLingua(it: 'Aggiungi', en: 'Add')),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 4,
              children: [
                Text(
                  inLingua(it: 'entità', en: 'entity'),
                  style: testi.bodySmall,
                ),
                freccia,
                Text(
                  inLingua(it: 'condizione', en: 'condition'),
                  style: testi.bodySmall,
                ),
                freccia,
                Text(
                  inLingua(it: 'messaggio', en: 'message'),
                  style: testi.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// La promessa, in fondo: chi le puo' leggere.
class _LaPromessa extends StatelessWidget {
  const _LaPromessa();

  @override
  Widget build(BuildContext context) {
    final scuro = Theme.of(context).brightness == Brightness.dark;
    final verde = scuro ? const Color(0xFF86EFAC) : const Color(0xFF166534);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scuro ? const Color(0xFF10321F) : const Color(0xFFDCFCE7),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_rounded, color: verde),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  inLingua(
                    it: 'Cifrate da casa al telefono',
                    en: 'Encrypted from home to phone',
                  ),
                  style: TextStyle(fontWeight: FontWeight.w700, color: verde),
                ),
                const SizedBox(height: 4),
                Text(
                  inLingua(
                    it:
                        'Partono già chiuse dalla tua casa e si aprono solo '
                        'sul tuo telefono: nessuno in mezzo può leggerle, '
                        'nemmeno chi le consegna.',
                    en:
                        'They leave your home already sealed and only open '
                        'on your phone: nobody in between can read them, not '
                        'even whoever delivers them.',
                  ),
                  style: TextStyle(color: verde, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
