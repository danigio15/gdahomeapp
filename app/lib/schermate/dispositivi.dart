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
  const Dispositivi({super.key, required this.collegamento});

  final Collegamento collegamento;

  @override
  State<Dispositivi> createState() => _DispositiviState();
}

class _DispositiviState extends State<Dispositivi> {
  final _cerca = TextEditingController();

  StatoDellaCasa? get _casa => widget.collegamento.stato;

  @override
  void initState() {
    super.initState();
    /* Lo stato della casa lo tiene il collegamento: qui ci si limita a
     * ridisegnare quando cambia. Cosi' passando da una schermata all'altra la
     * casa non si rilegge da capo ogni volta. */
    widget.collegamento.cambiamenti.listen((_) {
      if (mounted) setState(() {});
    });
    _cerca.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
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
      return const Center(child: CircularProgressIndicator());
    }
    if (casa.quante == 0) {
      return const StatoVuoto(
        icona: Icons.inbox_rounded,
        titolo: 'Casa vuota',
        sotto: 'Home Assistant non ha nessuna entita\' da mostrare.',
      );
    }

    final cercato = _cerca.text.trim().toLowerCase();
    final domini = casa.domini().keys.toList()
      ..sort((a, b) => _tipo(a).$1.compareTo(_tipo(b).$1));
    final gruppi = <Widget>[];
    for (final dominio in domini) {
      final dentro = casa
          .delDominio(dominio)
          .where(
            (una) =>
                cercato.isEmpty ||
                una.nome.toLowerCase().contains(cercato) ||
                una.id.toLowerCase().contains(cercato),
          )
          .toList();
      if (dentro.isEmpty) continue;
      gruppi.add(
        _Gruppo(
          dominio: dominio,
          entita: dentro,
          aperto: cercato.isNotEmpty || _accendibili.contains(dominio),
          inverti: _inverti,
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        TextField(
          controller: _cerca,
          decoration: InputDecoration(
            hintText: 'Cerca fra ${casa.quante} entita\'',
            prefixIcon: const Icon(Icons.search_rounded),
            suffixIcon: cercato.isEmpty
                ? null
                : IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: _cerca.clear,
                  ),
          ),
        ),
        const SizedBox(height: 14),
        if (gruppi.isEmpty)
          const StatoVuoto(
            dentroUnaLista: true,
            icona: Icons.search_off_rounded,
            titolo: 'Niente con questo nome',
            sotto: 'Prova con una parola piu\' corta.',
          )
        else
          for (final gruppo in gruppi) ...[gruppo, const SizedBox(height: 10)],
      ],
    );
  }
}

/// Un tipo di entita', con le sue dentro: si apre e si chiude.
class _Gruppo extends StatelessWidget {
  const _Gruppo({
    required this.dominio,
    required this.entita,
    required this.aperto,
    required this.inverti,
  });

  final String dominio;
  final List<Entita> entita;
  final bool aperto;
  final Future<void> Function(Entita) inverti;

  @override
  Widget build(BuildContext context) {
    final (nome, icona) = _tipo(dominio);
    final colori = Theme.of(context).colorScheme;
    return Scheda(
      padding: EdgeInsets.zero,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          key: PageStorageKey(dominio),
          initiallyExpanded: aperto,
          tilePadding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
          childrenPadding: const EdgeInsets.fromLTRB(6, 0, 6, 8),
          leading: Cerchietto(icona: icona, lato: 40),
          title: Text(nome, style: Theme.of(context).textTheme.titleMedium),
          trailing: Bollino('${entita.length}'),
          iconColor: colori.onSurfaceVariant,
          collapsedIconColor: colori.onSurfaceVariant,
          children: [
            for (final una in entita) _Riga(una: una, inverti: inverti),
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
