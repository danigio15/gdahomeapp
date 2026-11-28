/// Le impostazioni del pannello a muro: Wi-Fi, Schermo, Suono, Zigbee e
/// Informazioni, le voci del gruppo «Pannello» del menu (`menu.dart`).
///
/// «Dobbiamo rivedere completamente il menu laterale: anche per poter
/// impostare il Wi-Fi come lo facciamo?» Sul pannello il menu del telefono non
/// serviva a niente, e quello che serve a un tablet a muro non c'era.
///
/// Da dove vengono le cose:
///  - Wi-Fi, schermo, suono, modello: da Android, sul canale `gdahome/pannello`
///    (`android/app/src/muro/.../rete/IlPannello.kt`). «Cambia rete» apre la
///    scelta delle reti di Android, che sul pannello resta apposta.
///  - Zigbee e riavvio: dalla casa (`ponte/pannello`), perche' li fa l'add-on,
///    che il pannello lo tiene con l'ADB: GdAHome OS espone il chip Zigbee in
///    rete, e riavviare vuole i permessi di sistema.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../casa/collegamento.dart';
import '../parole.dart';
import '../vestito/pezzi.dart';
import 'menu.dart';

const _canale = MethodChannel('gdahome/pannello');

/// Cosa dice Android del pannello (`IlPannello.stato`). Tutto puo' mancare:
/// un pannello che non lo sa dire non e' un errore.
class StatoDelPannello {
  const StatoDelPannello(this.detto);

  final Map<String, Object?> detto;

  String? get rete => detto['ssid'] as String?;
  bool get collegato => detto['collegato'] == true;
  int? get segnale => (detto['segnale'] as num?)?.toInt();
  int? get velocita => (detto['velocita'] as num?)?.toInt();
  String? get ip => detto['ip'] as String?;
  int get luminosita => ((detto['luminosita'] as num?) ?? 128).toInt();
  bool get automatica => detto['automatica'] == true;
  bool get puoScrivere => detto['puoScrivere'] == true;
  int get volume => ((detto['volume'] as num?) ?? 0).toInt();
  int get volumeMassimo => ((detto['volumeMassimo'] as num?) ?? 15).toInt();
  String get modello =>
      [detto['produttore'], detto['modello']].whereType<String>().join(' ');
  String? get android => detto['android'] as String?;

  /// Il segnale detto a parole, come lo direbbe una persona.
  String get comeVaIlSegnale {
    final s = segnale;
    if (s == null) return '';
    if (s >= -55) return inLingua(it: 'ottimo', en: 'excellent');
    if (s >= -67) return inLingua(it: 'buono', en: 'good');
    if (s >= -75) return inLingua(it: 'debole', en: 'weak');
    return inLingua(it: 'molto debole', en: 'very weak');
  }
}

class SchermataDelPannello extends StatefulWidget {
  const SchermataDelPannello({
    super.key,
    required this.collegamento,
    required this.parte,
    required this.visibile,
  });

  final Collegamento collegamento;

  /// Quale voce del menu: Wi-Fi, Schermo, Suono, Zigbee o Informazioni.
  final Sezione parte;

  final bool visibile;

  @override
  State<SchermataDelPannello> createState() => _StatoDellaSchermata();
}

class _StatoDellaSchermata extends State<SchermataDelPannello> {
  StatoDelPannello? _stato;
  Map<String, Object?>? _zigbee;
  String _guaio = '';
  bool _lavora = false;
  Timer? _giro;

  @override
  void initState() {
    super.initState();
    if (widget.visibile) _guarda();
  }

  @override
  void didUpdateWidget(SchermataDelPannello prima) {
    super.didUpdateWidget(prima);
    if (widget.visibile && !prima.visibile) _guarda();
    if (!widget.visibile) _giro?.cancel();
  }

  @override
  void dispose() {
    _giro?.cancel();
    super.dispose();
  }

  /// Si guarda all'apertura, e ogni cinque secondi finche' la pagina e'
  /// davanti: il segnale del Wi-Fi cambia, e tornando dalla scelta delle reti
  /// la rete nuova deve comparire da sola.
  Future<void> _guarda() async {
    _giro?.cancel();
    _giro = Timer.periodic(const Duration(seconds: 5), (_) => _leggi());
    await _leggi();
    if (widget.parte == Sezione.zigbeeDelPannello) await _leggiLoZigbee();
  }

  Future<void> _leggi() async {
    try {
      final detto = await _canale.invokeMapMethod<String, Object?>('stato');
      if (!mounted || detto == null) return;
      setState(() => _stato = StatoDelPannello(detto));
    } catch (_) {
      /* Non sul pannello (o un'app di prima): la pagina dice quello che sa. */
    }
  }

  Future<Map<String, Object?>?> _allaCasa(Map<String, Object?> cosa) async {
    final filo = widget.collegamento.filo;
    if (filo == null) {
      setState(
        () => _guaio = inLingua(
          it: 'La casa non risponde adesso: riprova fra poco.',
          en: 'The home is not answering right now: try again shortly.',
        ),
      );
      return null;
    }
    try {
      final r = await filo.risultato({'type': 'ponte/pannello', ...cosa});
      return r is Map ? Map<String, Object?>.from(r) : <String, Object?>{};
    } catch (errore) {
      if (mounted) setState(() => _guaio = '$errore');
      return null;
    }
  }

  Future<void> _leggiLoZigbee() async {
    final r = await _allaCasa({'cosa': 'zigbee'});
    if (mounted && r != null) setState(() => _zigbee = r);
  }

  Future<void> _faiAllaCasa(Map<String, Object?> cosa) async {
    setState(() {
      _lavora = true;
      _guaio = '';
    });
    final r = await _allaCasa(cosa);
    if (!mounted) return;
    setState(() {
      _lavora = false;
      if (r != null && cosa['cosa'] != 'riavvia') _zigbee = r;
    });
  }

  @override
  Widget build(BuildContext context) {
    final stato = _stato;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        if (_guaio.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              _guaio,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        switch (widget.parte) {
          Sezione.wifiDelPannello => _ilWifi(stato),
          Sezione.schermoDelPannello => _loSchermo(stato),
          Sezione.suonoDelPannello => _ilSuono(stato),
          Sezione.zigbeeDelPannello => _loZigbee(),
          _ => _leInformazioni(stato),
        },
      ],
    );
  }

  Widget _ilWifi(StatoDelPannello? stato) {
    final rete =
        stato?.rete ??
        (stato?.collegato == true
            ? inLingua(it: 'Wi-Fi collegato', en: 'Wi-Fi connected')
            : inLingua(it: 'Non collegato', en: 'Not connected'));
    final dettagli = [
      if (stato?.segnale != null)
        '${inLingua(it: 'segnale', en: 'signal')} ${stato!.comeVaIlSegnale} (${stato.segnale} dBm)',
      if (stato?.velocita != null) '${stato!.velocita} Mbps',
      if (stato?.ip != null) stato!.ip!,
    ].join(' · ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Insegna('Wi-Fi'),
        Scheda(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          child: ListTile(
            key: const Key('pannello-wifi'),
            leading: const Cerchietto(icona: Icons.wifi_rounded),
            title: Text(rete),
            subtitle: dettagli.isEmpty ? null : Text(dettagli),
            trailing: FilledButton.tonal(
              onPressed: () => _canale.invokeMethod('apriWifi'),
              child: Text(inLingua(it: 'Cambia rete', en: 'Change network')),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          inLingua(
            it: '«Cambia rete» apre la scelta delle reti di Android: scegli la rete, scrivi la password, e torna indietro.',
            en: '“Change network” opens Android\'s network list: pick the network, type the password, and come back.',
          ),
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _loSchermo(StatoDelPannello? stato) {
    final luminosita = stato?.luminosita ?? 128;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Insegna(inLingua(it: 'Schermo', en: 'Screen')),
        Scheda(
          padding: const EdgeInsets.fromLTRB(6, 4, 6, 8),
          child: Column(
            children: [
              ListTile(
                leading: const Cerchietto(icona: Icons.brightness_6_rounded),
                title: Text(inLingua(it: 'Luminosità', en: 'Brightness')),
                subtitle: Slider(
                  key: const Key('pannello-luminosita'),
                  value: luminosita.clamp(1, 255).toDouble(),
                  min: 1,
                  max: 255,
                  onChanged: stato?.automatica == true
                      ? null
                      : (v) => setState(
                          () => _stato = StatoDelPannello({
                            ...?stato?.detto,
                            'luminosita': v.round(),
                          }),
                        ),
                  onChangeEnd: (v) =>
                      _canale.invokeMethod('luminosita', v.round()),
                ),
                trailing: Text('${(luminosita * 100 / 255).round()}%'),
              ),
              SwitchListTile(
                key: const Key('pannello-automatica'),
                secondary: const Cerchietto(
                  icona: Icons.brightness_auto_rounded,
                ),
                title: Text(
                  inLingua(it: 'Luminosità automatica', en: 'Auto brightness'),
                ),
                subtitle: Text(
                  inLingua(
                    it: 'dal sensore di luce del pannello',
                    en: 'from the panel\'s light sensor',
                  ),
                ),
                value: stato?.automatica ?? false,
                onChanged: stato?.puoScrivere == true
                    ? (si) async {
                        await _canale.invokeMethod('automatica', si);
                        await _leggi();
                      }
                    : null,
              ),
            ],
          ),
        ),
        if (stato != null && !stato.puoScrivere)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              inLingua(
                it: 'Per cambiare la luminosità di sistema serve un permesso che l\'add-on dà al prossimo aggiornamento del pannello. Intanto cambia quella di questa schermata.',
                en: 'Changing the system brightness needs a permission the add-on grants at the panel\'s next update. Meanwhile it changes this screen\'s.',
              ),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
      ],
    );
  }

  Widget _ilSuono(StatoDelPannello? stato) {
    final massimo = (stato?.volumeMassimo ?? 15).clamp(1, 100);
    final volume = (stato?.volume ?? 0).clamp(0, massimo);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Insegna(inLingua(it: 'Suono', en: 'Sound')),
        Scheda(
          padding: const EdgeInsets.fromLTRB(6, 4, 6, 8),
          child: ListTile(
            leading: const Cerchietto(icona: Icons.volume_up_rounded),
            title: Text(inLingua(it: 'Volume', en: 'Volume')),
            subtitle: Slider(
              key: const Key('pannello-volume'),
              value: volume.toDouble(),
              min: 0,
              max: massimo.toDouble(),
              divisions: massimo,
              onChanged: (v) => setState(
                () => _stato = StatoDelPannello({
                  ...?stato?.detto,
                  'volume': v.round(),
                }),
              ),
              onChangeEnd: (v) => _canale.invokeMethod('volume', v.round()),
            ),
            trailing: Text('${(volume * 100 / massimo).round()}%'),
          ),
        ),
      ],
    );
  }

  Widget _loZigbee() {
    final z = _zigbee;
    final attivo = z?['attivo'] == true;
    final indirizzo = z?['indirizzo'] as String?;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Insegna(inLingua(it: 'Zigbee del pannello', en: 'Panel Zigbee')),
        Scheda(
          padding: const EdgeInsets.fromLTRB(6, 4, 6, 8),
          child: Column(
            children: [
              SwitchListTile(
                key: const Key('pannello-zigbee'),
                secondary: const Cerchietto(icona: Icons.hub_rounded),
                title: Text(
                  inLingua(
                    it: 'Chip Zigbee come coordinatore',
                    en: 'Zigbee chip as coordinator',
                  ),
                ),
                subtitle: Text(
                  z == null
                      ? inLingua(
                          it: 'Chiedo alla casa…',
                          en: 'Asking the home…',
                        )
                      : attivo && indirizzo != null
                      ? inLingua(
                          it: 'In rete: per ZHA socket://$indirizzo, per Zigbee2MQTT tcp://$indirizzo (adapter: ember)',
                          en: 'On the network: for ZHA socket://$indirizzo, for Zigbee2MQTT tcp://$indirizzo (adapter: ember)',
                        )
                      : inLingua(
                          it: 'Spento: il chip non è usato',
                          en: 'Off: the chip is not used',
                        ),
                ),
                value: attivo,
                onChanged: z == null || _lavora
                    ? null
                    : (si) => _faiAllaCasa({'cosa': 'zigbee', 'attivo': si}),
              ),
              ListTile(
                leading: const Cerchietto(icona: Icons.alt_route_rounded),
                title: Text(inLingua(it: 'Come router', en: 'As a router')),
                subtitle: Text(
                  inLingua(
                    it: 'Per allargare una rete Zigbee che c\'è già il chip va riprogrammato: arriva con un prossimo aggiornamento.',
                    en: 'To extend an existing Zigbee network the chip must be reflashed: it comes with a future update.',
                  ),
                ),
                enabled: false,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _leInformazioni(StatoDelPannello? stato) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Insegna(inLingua(it: 'Il pannello', en: 'The panel')),
        Scheda(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          child: Column(
            children: [
              if (stato != null && stato.modello.isNotEmpty)
                ListTile(
                  leading: const Cerchietto(icona: Icons.tablet_rounded),
                  title: Text(stato.modello),
                  subtitle: Text('Android ${stato.android ?? '?'}'),
                ),
              if (stato?.ip != null)
                ListTile(
                  leading: const Cerchietto(icona: Icons.lan_rounded),
                  title: Text(stato!.ip!),
                  subtitle: Text(inLingua(it: 'indirizzo', en: 'address')),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.tonalIcon(
          key: const Key('pannello-riavvia'),
          icon: const Icon(Icons.restart_alt_rounded),
          label: Text(
            inLingua(it: 'Riavvia il pannello', en: 'Restart the panel'),
          ),
          onPressed: _lavora
              ? null
              : () async {
                  final si = await showDialog<bool>(
                    context: context,
                    builder: (c) => AlertDialog(
                      title: Text(
                        inLingua(
                          it: 'Riavviare il pannello?',
                          en: 'Restart the panel?',
                        ),
                      ),
                      content: Text(
                        inLingua(
                          it: 'Si spegne e si riaccende: torna in un minuto.',
                          en: 'It turns off and on again: back in a minute.',
                        ),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(c, false),
                          child: Text(inLingua(it: 'Annulla', en: 'Cancel')),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.pop(c, true),
                          child: Text(inLingua(it: 'Riavvia', en: 'Restart')),
                        ),
                      ],
                    ),
                  );
                  if (si == true) await _faiAllaCasa({'cosa': 'riavvia'});
                },
        ),
      ],
    );
  }
}
