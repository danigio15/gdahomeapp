/// I dispositivi: tutto quello che c'e' in casa, diviso per tipo.
///
/// E' la sezione grezza — l'elenco completo, con gli interruttori che
/// funzionano — e resta utile anche dopo che sara' arrivata la plancia: e' dove
/// si cerca *quella* entita' li' quando non ci si ricorda dove sta. Per questo
/// in cima c'e' una casella di ricerca, e i tipi hanno un nome in italiano
/// invece del nome che hanno per Home Assistant.
///
/// E' un corpo e basta: la barra in cima, col titolo e il menu, la mette la
/// home, che e' la stessa per tutte le sezioni.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../casa/entita.dart';
import '../casa/stato_della_casa.dart';
import '../ponte/errori.dart';
import '../vestito/pezzi.dart';

/// I domini che si comandano con un interruttore.
const _accendibili = {'light', 'switch', 'fan', 'input_boolean', 'siren'};

/// Come si chiamano i domini per una persona, e con quale icona.
const _tipi = <String, (String, IconData)>{
  'light': ('Luci', Icons.lightbulb_rounded),
  'switch': ('Interruttori', Icons.power_rounded),
  'sensor': ('Sensori', Icons.speed_rounded),
  'binary_sensor': ('Rilevatori', Icons.sensors_rounded),
  'climate': ('Clima', Icons.thermostat_rounded),
  'cover': ('Tapparelle e porte', Icons.blinds_rounded),
  'media_player': ('Lettori', Icons.speaker_rounded),
  'camera': ('Telecamere', Icons.videocam_rounded),
  'lock': ('Serrature', Icons.lock_rounded),
  'fan': ('Ventole', Icons.mode_fan_off_rounded),
  'alarm_control_panel': ('Antifurto', Icons.shield_rounded),
  'automation': ('Automazioni', Icons.auto_awesome_rounded),
  'script': ('Script', Icons.play_circle_rounded),
  'scene': ('Scene', Icons.movie_rounded),
  'person': ('Persone', Icons.person_rounded),
  'device_tracker': ('Presenze', Icons.location_on_rounded),
  'input_boolean': ('Interruttori virtuali', Icons.toggle_on_rounded),
  'input_number': ('Numeri', Icons.pin_rounded),
  'number': ('Numeri', Icons.pin_rounded),
  'input_select': ('Selettori', Icons.list_rounded),
  'select': ('Selettori', Icons.list_rounded),
  'input_text': ('Testi', Icons.short_text_rounded),
  'input_datetime': ('Orari', Icons.schedule_rounded),
  'counter': ('Contatori', Icons.exposure_plus_1_rounded),
  'timer': ('Timer', Icons.timer_rounded),
  'button': ('Pulsanti', Icons.radio_button_checked_rounded),
  'sun': ('Sole', Icons.wb_sunny_rounded),
  'weather': ('Meteo', Icons.cloud_rounded),
  'zone': ('Zone', Icons.map_rounded),
  'update': ('Aggiornamenti', Icons.system_update_rounded),
  'siren': ('Sirene', Icons.campaign_rounded),
  'vacuum': ('Aspirapolvere', Icons.cleaning_services_rounded),
  'humidifier': ('Umidificatori', Icons.water_drop_rounded),
  'water_heater': ('Scaldabagni', Icons.hot_tub_rounded),
  'remote': ('Telecomandi', Icons.settings_remote_rounded),
  'calendar': ('Calendari', Icons.calendar_month_rounded),
  'todo': ('Liste', Icons.checklist_rounded),
  'event': ('Eventi', Icons.bolt_rounded),
  'image': ('Immagini', Icons.image_rounded),
  'notify': ('Notifiche', Icons.notifications_rounded),
  'tts': ('Voce', Icons.record_voice_over_rounded),
};

(String, IconData) _tipo(String dominio) =>
    _tipi[dominio] ??
    (
      dominio.isEmpty
          ? dominio
          : dominio[0].toUpperCase() +
                dominio.substring(1).replaceAll('_', ' '),
      Icons.category_rounded,
    );

class Dispositivi extends StatefulWidget {
  const Dispositivi({
    super.key,
    required this.collegamento,
    this.visibile = true,
  });

  final Collegamento collegamento;

  /// Se questa sezione e' quella che si guarda. Le entita' si chiedono alla
  /// casa la prima volta che lo e'.
  final bool visibile;

  @override
  State<Dispositivi> createState() => _DispositiviState();
}

class _DispositiviState extends State<Dispositivi> {
  final _cerca = TextEditingController();
  var _ascolti = <StreamSubscription<void>>[];

  /* Ogni quanto, al massimo, si ridisegna l'elenco.
   *
   * In una casa vera gli eventi arrivano a raffica — quattro, dieci al
   * secondo — e ognuno faceva rifare l'elenco intero. Scorrendo si sentiva:
   * il dito andava e la lista restava indietro. Il primo cambiamento si
   * disegna subito, che un interruttore appena toccato deve rispondere
   * subito; quelli che arrivano nel frattempo aspettano il giro dopo. */
  static const Duration _respiro = Duration(milliseconds: 300);
  Timer? _fraPoco;
  DateTime _ultimoDisegno = DateTime.fromMillisecondsSinceEpoch(0);

  /* Quali gruppi sono aperti. Lo tiene la schermata, non la tessera: in una
   * lista pigra una tessera che esce di vista viene buttata, e uno stato
   * tenuto li' dentro tornando indietro non ci sarebbe piu'. */
  late final Set<String> _aperti = {..._accendibili};

  StatoDellaCasa? get _casa => widget.collegamento.stato;

  @override
  void initState() {
    super.initState();
    /* Lo stato della casa lo tiene il collegamento: qui ci si limita a
     * ridisegnare quando cambia. Cosi' passando da una schermata all'altra la
     * casa non si rilegge da capo ogni volta. */
    _ascolti = [
      widget.collegamento.cambiamenti.listen((_) => _ridisegna()),
      widget.collegamento.entitaCambiate.listen((_) => _ridisegna()),
    ];
    _cerca.addListener(() => setState(() {}));
    if (widget.visibile) unawaited(widget.collegamento.serveLaCasa());
  }

  /* Solo quando si e' a schermo. Questa sezione resta in piedi anche quando
   * se ne guarda un'altra — la pila delle sezioni tiene tutto vivo,
   * animazioni comprese — e ridisegnare un elenco che nessuno vede, a ogni
   * sensore che cambia, e' fatica buttata. Si aspetta di tornare visibili,
   * e li' si ridisegna. */
  void _ridisegna() {
    if (!mounted || !widget.visibile) return;
    final adesso = DateTime.now();
    final daAllora = adesso.difference(_ultimoDisegno);
    if (daAllora >= _respiro) {
      _fraPoco?.cancel();
      _fraPoco = null;
      _ultimoDisegno = adesso;
      setState(() {});
      return;
    }
    _fraPoco ??= Timer(_respiro - daAllora, () {
      _fraPoco = null;
      if (!mounted || !widget.visibile) return;
      _ultimoDisegno = DateTime.now();
      setState(() {});
    });
  }

  /* Le entita' si chiedono quando si e' a schermo, non prima. */
  @override
  void didUpdateWidget(Dispositivi vecchia) {
    super.didUpdateWidget(vecchia);
    if (widget.visibile && !vecchia.visibile) {
      unawaited(widget.collegamento.serveLaCasa());
      setState(() {});
    }
  }

  @override
  void dispose() {
    _fraPoco?.cancel();
    for (final uno in _ascolti) {
      uno.cancel();
    }
    _cerca.dispose();
    super.dispose();
  }

  Future<void> _inverti(Entita quale) async {
    try {
      await _casa?.comanda('toggle', quale.id);
    } on ErroreDelPonte catch (errore) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(errore.spiegazione)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final casa = _casa;
    if (casa == null || !casa.pieno) {
      /* Nascosti non si gira nessuna rotella: la pila delle sezioni tiene
       * vive le animazioni anche di chi non si vede, e una rotella che gira
       * per sempre in una sezione chiusa e' un fotogramma al secondo buttato. */
      if (!widget.visibile) return const SizedBox.shrink();
      return const Center(child: CircularProgressIndicator());
    }
    if (casa.quante == 0) {
      return const StatoVuoto(
        icona: Icons.inbox_rounded,
        titolo: 'Casa vuota',
        sotto: 'Home Assistant non ha nessuna entità da mostrare.',
      );
    }

    final cercato = _cerca.text.trim().toLowerCase();
    final perDominio = casa.perDominio();
    final domini = perDominio.keys.toList()
      ..sort((a, b) => _tipo(a).$1.compareTo(_tipo(b).$1));

    /* Una lista **piatta**, e pigra: una voce per intestazione e una per
     * riga, e si costruisce solo quello che si vede.
     *
     * Prima ogni gruppo era una tessera che si apriva, con dentro tutte le
     * sue righe in colonna. In una casa da tremila entita' — ce n'e' una, e
     * gli interruttori da soli sono centinaia — aprire un gruppo voleva dire
     * costruire e impaginare centinaia di righe in un colpo solo, dentro una
     * voce sola della lista: la lista pigra non poteva farci niente, perche'
     * quella voce era una. Scorrendo il dito andava e la lista restava
     * indietro. Adesso ogni riga e' una voce sua. */
    final voci = <Object>[];
    for (final dominio in domini) {
      final tutte = perDominio[dominio] ?? const <Entita>[];
      final dentro = cercato.isEmpty
          ? tutte
          : tutte
                .where(
                  (una) =>
                      una.nome.toLowerCase().contains(cercato) ||
                      una.id.toLowerCase().contains(cercato),
                )
                .toList();
      if (dentro.isEmpty) continue;
      final aperto = cercato.isNotEmpty || _aperti.contains(dominio);
      voci.add(_Intestazione(dominio, dentro.length, aperto));
      if (!aperto) continue;
      for (var i = 0; i < dentro.length; i += 1) {
        voci.add(_Voce(dentro[i], i == dentro.length - 1));
      }
    }

    final cerca = Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextField(
        controller: _cerca,
        decoration: InputDecoration(
          hintText: 'Cerca fra ${casa.quante} entità',
          prefixIcon: const Icon(Icons.search_rounded),
          suffixIcon: cercato.isEmpty
              ? null
              : IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: _cerca.clear,
                ),
        ),
      ),
    );

    if (voci.isEmpty) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          cerca,
          const StatoVuoto(
            dentroUnaLista: true,
            icona: Icons.search_off_rounded,
            titolo: 'Niente con questo nome',
            sotto: 'Prova con una parola più corta.',
          ),
        ],
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      itemCount: voci.length + 1,
      itemBuilder: (context, posto) {
        if (posto == 0) return cerca;
        final voce = voci[posto - 1];
        if (voce is _Intestazione) {
          return _Guscio(
            sopra: true,
            sotto: !voce.aperto,
            child: _TestaDelGruppo(
              dominio: voce.dominio,
              quante: voce.quante,
              aperto: voce.aperto,
              premi: () => setState(() {
                if (!_aperti.remove(voce.dominio)) _aperti.add(voce.dominio);
              }),
            ),
          );
        }
        final riga = voce as _Voce;
        /* L'entita' viva, non quella di quando si e' fatto l'ordine: i
         * valori cambiano dieci volte al secondo, l'ordine no. */
        return _Guscio(
          sopra: false,
          sotto: riga.ultima,
          child: _Riga(una: casa[riga.una.id] ?? riga.una, inverti: _inverti),
        );
      },
    );
  }
}

/// Una voce della lista: l'intestazione di un gruppo.
class _Intestazione {
  const _Intestazione(this.dominio, this.quante, this.aperto);
  final String dominio;
  final int quante;
  final bool aperto;
}

/// Una voce della lista: una riga, e se e' l'ultima del suo gruppo.
class _Voce {
  const _Voce(this.una, this.ultima);
  final Entita una;
  final bool ultima;
}

/// Il fondo su cui stanno le voci: un unico foglio per gruppo, arrotondato
/// dove il gruppo comincia e dove finisce.
class _Guscio extends StatelessWidget {
  const _Guscio({
    required this.child,
    required this.sopra,
    required this.sotto,
  });

  final Widget child;
  final bool sopra;
  final bool sotto;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    const raggio = Radius.circular(20);
    return Padding(
      padding: EdgeInsets.only(bottom: sotto ? 10 : 0),
      child: Material(
        color: colori.surfaceContainerLowest,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: sopra ? raggio : Radius.zero,
            bottom: sotto ? raggio : Radius.zero,
          ),
          side: BorderSide(color: colori.outlineVariant),
        ),
        clipBehavior: Clip.antiAlias,
        child: child,
      ),
    );
  }
}

/// L'intestazione di un gruppo: si preme e il gruppo si apre o si chiude.
class _TestaDelGruppo extends StatelessWidget {
  const _TestaDelGruppo({
    required this.dominio,
    required this.quante,
    required this.aperto,
    required this.premi,
  });

  final String dominio;
  final int quante;
  final bool aperto;
  final VoidCallback premi;

  @override
  Widget build(BuildContext context) {
    final (nome, icona) = _tipo(dominio);
    final colori = Theme.of(context).colorScheme;
    return InkWell(
      onTap: premi,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
        child: Row(
          children: [
            Cerchietto(icona: icona, lato: 40),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                nome,
                style: Theme.of(context).textTheme.titleMedium,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Bollino('$quante'),
            const SizedBox(width: 6),
            Icon(
              aperto ? Icons.expand_less_rounded : Icons.expand_more_rounded,
              color: colori.onSurfaceVariant,
            ),
          ],
        ),
      ),
    );
  }
}

class _Riga extends StatelessWidget {
  const _Riga({required this.una, required this.inverti});
  final Entita una;
  final Future<void> Function(Entita) inverti;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final comandabile = _accendibili.contains(una.dominio) && !una.muta;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 12),
      title: Text(una.nome, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        una.id,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: testi.labelSmall?.copyWith(color: colori.onSurfaceVariant),
      ),
      trailing: comandabile
          ? Switch(value: una.accesa, onChanged: (_) => inverti(una))
          : Text(
              una.muta ? '—' : '${una.stato}${una.unita ?? ''}',
              style: testi.bodyLarge?.copyWith(
                color: una.muta ? colori.onSurfaceVariant : colori.onSurface,
                fontWeight: FontWeight.w500,
              ),
            ),
    );
  }
}
