/// Il menu laterale: da dove si va dappertutto.
///
/// La home e' la plancia, e basta. Quello che si vede aprendo l'app e' la casa
/// come la si e' disegnata in DashboardModern — non un elenco di entita', non
/// delle tessere con dei numeri. Tutto il resto sta qui, dietro il bottone in
/// alto a sinistra:
///
///  - **la casa** su cui si e' aperti, e da dove ci si sta passando. Si preme
///    e si cambia casa;
///  - **la plancia**: la Home e le sue pagine — Stanze, Luci, Clima,
///    Temperatura, Finestre — solo quelle che questa casa ha davvero, come
///    nella barra della plancia web;
///  - **le sezioni**: i dispositivi, che ci sono; gli aiutanti, Zigbee e le
///    automazioni, che arriveranno. Quelle che non ci sono ancora si vedono
///    lo stesso, spente: si sa dove sta andando l'app, e non ci si chiede se
///    manchi un pezzo o se sia nascosto da qualche parte;
///  - **le case**, in fondo, e la riga con la versione.
///
/// L'ordine delle voci e' l'ordine in cui servono: prima quello che si guarda
/// tutti i giorni, poi quello che si tocca una volta e poi mai piu'.
library;

import 'package:flutter/material.dart';

import '../casa/collegamento.dart';
import '../plancia/configurazione.dart';
import '../vestito/marchio.dart';
import '../vestito/pezzi.dart';
import 'da_dove.dart';
import 'firma.dart';

/// Le sezioni dell'app: le voci del menu.
enum Sezione {
  plancia('Home', Icons.dashboard_rounded, pronta: true, dellaPlancia: true),
  stanze(
    'Stanze',
    Icons.meeting_room_rounded,
    pronta: true,
    dellaPlancia: true,
  ),
  luci('Luci', Icons.lightbulb_rounded, pronta: true, dellaPlancia: true),
  clima('Clima', Icons.ac_unit_rounded, pronta: true, dellaPlancia: true),
  temperatura(
    'Temperatura',
    Icons.thermostat_rounded,
    pronta: true,
    dellaPlancia: true,
  ),
  finestre('Finestre', Icons.blinds_rounded, pronta: true, dellaPlancia: true),
  agenda('Agenda', Icons.event_rounded, pronta: true, dellaPlancia: true),
  dispositivi('Dispositivi', Icons.devices_other_rounded, pronta: true),
  aiutanti('Aiutanti', Icons.tune_rounded),
  zigbee('Zigbee', Icons.settings_input_antenna_rounded),
  automazioni('Automazioni', Icons.auto_awesome_rounded);

  const Sezione(
    this.titolo,
    this.icona, {
    this.pronta = false,
    this.dellaPlancia = false,
  });

  final String titolo;
  final IconData icona;

  /// `false` finche' quel blocco non e' scritto: la voce si vede, spenta.
  final bool pronta;

  /// Una pagina della plancia di DashboardModern: compare solo se in quella
  /// casa c'e' qualcosa da mostrarci.
  final bool dellaPlancia;
}

/// Le pagine della plancia che questa casa ha davvero: una sezione senza
/// niente dentro non sta nella barra, come nella plancia web.
List<Sezione> sezioniDellaPlancia(ConfigurazioneDellaPlancia? config) {
  if (config == null || !config.configurata) return const [Sezione.plancia];
  return [
    Sezione.plancia,
    if (config.stanze.isNotEmpty) Sezione.stanze,
    if (config.gruppiDiLuci().isNotEmpty) Sezione.luci,
    if (config.unitaClima.isNotEmpty) Sezione.clima,
    if (config.stanze.any((s) => s.temperatura.isNotEmpty)) Sezione.temperatura,
    if (config.coperture.isNotEmpty) Sezione.finestre,
    if (config.calendari.isNotEmpty || config.liste.isNotEmpty) Sezione.agenda,
  ];
}

/// Quelle che si toccano una volta ogni tanto.
const _daConfigurare = [Sezione.aiutanti, Sezione.zigbee, Sezione.automazioni];

class MenuLaterale extends StatelessWidget {
  const MenuLaterale({
    super.key,
    required this.collegamento,
    required this.aperta,
    required this.vai,
    required this.vaiAlleCase,
  });

  final Collegamento collegamento;

  /// La sezione che si sta guardando adesso: e' quella evidenziata.
  final Sezione aperta;

  final void Function(Sezione dove) vai;
  final VoidCallback vaiAlleCase;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;

    /* Il menu si chiude da solo prima di andare dove gli si e' chiesto: chi
     * riceve la chiamata non deve sapere che c'era un menu davanti. */
    void chiudiE(VoidCallback poi) {
      Navigator.of(context).pop();
      poi();
    }

    return Drawer(
      backgroundColor: colori.surface,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _Intestazione(),
                    const SizedBox(height: 14),
                    _LaCasa(
                      collegamento: collegamento,
                      quandoPremuta: () => chiudiE(vaiAlleCase),
                    ),
                    const SizedBox(height: 18),
                    const Padding(
                      padding: EdgeInsets.only(left: 10),
                      child: Insegna('Plancia'),
                    ),
                    for (final sezione in sezioniDellaPlancia(
                      collegamento.plancia,
                    ))
                      _Voce(
                        icona: sezione.icona,
                        titolo: sezione.titolo,
                        scelta: sezione == aperta,
                        quandoPremuta: () => chiudiE(() => vai(sezione)),
                      ),
                    const SizedBox(height: 18),
                    _Voce(
                      icona: Sezione.dispositivi.icona,
                      titolo: Sezione.dispositivi.titolo,
                      scelta: aperta == Sezione.dispositivi,
                      quandoPremuta: () =>
                          chiudiE(() => vai(Sezione.dispositivi)),
                    ),
                    const SizedBox(height: 18),
                    const Padding(
                      padding: EdgeInsets.only(left: 10),
                      child: Insegna('Configura'),
                    ),
                    for (final sezione in _daConfigurare)
                      _Voce(
                        icona: sezione.icona,
                        titolo: sezione.titolo,
                        scelta: sezione == aperta,
                        nota: sezione.pronta ? null : 'presto',
                        quandoPremuta: () => chiudiE(() => vai(sezione)),
                      ),
                  ],
                ),
              ),
            ),
            Divider(color: colori.outlineVariant),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: _Voce(
                icona: Icons.home_work_outlined,
                titolo: 'Le tue case',
                quandoPremuta: () => chiudiE(vaiAlleCase),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Firma(spazioSopra: 4),
            ),
          ],
        ),
      ),
    );
  }
}

/// Il marchio e il nome, piccoli, in cima.
class _Intestazione extends StatelessWidget {
  const _Intestazione();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 0),
      child: Row(
        children: [
          const Marchio(lato: 34),
          const SizedBox(width: 12),
          Text(
            'gdahome',
            style: Theme.of(context).textTheme.titleMedium
                ?.copyWith(letterSpacing: -0.2),
          ),
        ],
      ),
    );
  }
}

/// La casa su cui si e' aperti, e da dove. Si preme per cambiarla.
class _LaCasa extends StatelessWidget {
  const _LaCasa({required this.collegamento, required this.quandoPremuta});

  final Collegamento collegamento;
  final VoidCallback quandoPremuta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Scheda(
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      quandoPremuta: quandoPremuta,
      child: Row(
        children: [
          Cerchietto(
            icona: Icons.home_rounded,
            lato: 42,
            fondo: colori.primary,
            colore: colori.onPrimary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  collegamento.casa?.nome ?? 'Casa',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: testi.titleMedium,
                ),
                const SizedBox(height: 3),
                DaDoveSiPassa(collegamento, piccolo: true),
              ],
            ),
          ),
          Icon(Icons.unfold_more_rounded, color: colori.onSurfaceVariant),
        ],
      ),
    );
  }
}

/// Una voce del menu: icona, titolo, e un «presto» quando non c'e' ancora.
class _Voce extends StatelessWidget {
  const _Voce({
    required this.icona,
    required this.titolo,
    this.scelta = false,
    this.quandoPremuta,
    this.nota,
  });

  final IconData icona;
  final String titolo;
  final bool scelta;
  final VoidCallback? quandoPremuta;

  /// Quando c'e', la voce e' spenta e questo e' quello che si legge di
  /// fianco: «presto».
  final String? nota;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final spenta = nota != null;
    final colore = scelta
        ? colori.onPrimaryContainer
        : spenta
        ? colori.onSurfaceVariant.withValues(alpha: 0.55)
        : colori.onSurface;
    return Material(
      color: scelta ? colori.primaryContainer : Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: spenta ? null : quandoPremuta,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 13, 12, 13),
          child: Row(
            children: [
              Icon(icona, size: 22, color: colore),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  titolo,
                  style: testi.bodyLarge?.copyWith(
                    color: colore,
                    fontWeight: scelta ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
              if (spenta) Bollino(nota!),
            ],
          ),
        ),
      ),
    );
  }
}
