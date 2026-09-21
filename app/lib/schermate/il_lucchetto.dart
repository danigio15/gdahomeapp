/// «Il lucchetto»: dove si accende il volto e l'impronta (#54).
///
/// Sta dentro Sicurezza, ed e' l'unico posto da cui si accende: di serie e'
/// spento, e chi aggiorna l'app non deve trovarsi davanti una richiesta che
/// non ha chiesto.
///
/// ─── Perche' ogni interruttore dice anche cosa NON fa ─────────────────────
///
/// Perche' la domanda che una schermata cosi' si tira dietro e' sempre la
/// stessa: «dove finisce la mia impronta?». La risposta — da nessuna parte,
/// resta nel telefono — sta in fondo, scritta, e non e' un disclaimer: e'
/// l'informazione che decide se uno quell'interruttore lo accende o no.
///
/// E l'altra meta': porte e cancelli **non** passano di qui. Si aprono dalla
/// plancia, e li' la guardia e' il PIN dell'azione — che protegge quel
/// comando da qualunque telefono, anche da uno in mano al padrone di casa.
/// Lasciar credere che questo lucchetto copra anche quelli sarebbe la
/// promessa peggiore che si possa fare in un'app di casa.
library;

import 'package:flutter/material.dart';

import '../casa/il_lucchetto.dart';
import '../casa/impostazioni.dart';
import '../casa/la_guardia.dart';
import '../parole.dart';
import '../vestito/pezzi.dart';
import '../vestito/quanto_e_largo.dart';
import 'riconoscimento.dart';

/// Quanto larga si tiene: e' un elenco di interruttori, e una riga lunga
/// mezzo metro con la levetta in fondo si legge a sinistra e si preme a
/// destra.
const double _quantoLarga = 560;

/// La scheda del lucchetto.
class SchermataDelLucchetto extends StatefulWidget {
  const SchermataDelLucchetto({
    super.key,
    required this.impostazioni,
    required this.guardia,
    this.nuda = false,
  });

  final Impostazioni impostazioni;
  final LaGuardia guardia;

  /// `true` quando la barra del titolo la mette chi ospita.
  final bool nuda;

  @override
  State<SchermataDelLucchetto> createState() => _SchermataDelLucchettoState();
}

class _SchermataDelLucchettoState extends State<SchermataDelLucchetto> {
  CosaSaFareIlTelefono _telefono = CosaSaFareIlTelefono.niente;
  bool _chiesto = false;

  @override
  void initState() {
    super.initState();
    _cosaSaFare();
  }

  Future<void> _cosaSaFare() async {
    final sa = await widget.guardia.cosaSaFare();
    if (!mounted) return;
    setState(() {
      _telefono = sa;
      _chiesto = true;
    });
  }

  IlLucchetto get _lucchetto => widget.impostazioni.lucchetto;

  Future<void> _metti(IlLucchetto nuovo) async {
    await widget.impostazioni.metti(lucchetto: nuovo);
    if (mounted) setState(() {});
  }

  /// Accendere il lucchetto la prima volta lo fa **provare**.
  ///
  /// Un interruttore che si accende e basta e' un interruttore che si scopre
  /// rotto alla prossima apertura dell'app — col telefono in mano e nessuna
  /// voglia di capire perche'. Qui si chiede subito, e se non si passa
  /// l'interruttore torna dov'era.
  Future<void> _accendi(bool acceso, IlLucchetto Function(bool) come) async {
    if (!acceso || _lucchetto.acceso) {
      await _metti(come(acceso));
      return;
    }
    final andata = await widget.guardia.chiedi(perche: perche(null));
    if (!mounted) return;
    if (andata != ComeEAndata.si) {
      /* Non si e' passati: non si accende niente, e si rilegge cosa sa fare il
       * telefono — puo' essere cambiato proprio adesso. */
      await _cosaSaFare();
      return;
    }
    final adesso = come(acceso);
    /* E si accendono i due momenti suggeriti, se nessuno li ha ancora toccati:
     * il campo nasce vuoto — se no un'app appena installata chiederebbe il
     * volto davanti al cruscotto senza che nessuno abbia acceso niente — e
     * questo e' il momento in cui il suggerimento ha senso, perche' e' il
     * momento in cui si e' appena detto «si'». */
    await _metti(
      adesso.prima.isEmpty
          ? adesso.con(prima: IlLucchetto.daAccendereLaPrimaVolta)
          : adesso,
    );
  }

  @override
  Widget build(BuildContext context) {
    final corpo = _corpo(context);
    if (widget.nuda) return corpo;
    return Scaffold(
      appBar: AppBar(
        title: Text(inLingua(it: 'Il lucchetto', en: 'The lock')),
      ),
      body: corpo,
    );
  }

  Widget _corpo(BuildContext context) {
    if (!_chiesto) return const Center(child: CircularProgressIndicator());
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    if (!_telefono.ceUnaGuardiaDelSistema) {
      return StatoVuoto(
        icona: Icons.lock_open_rounded,
        titolo: inLingua(
          it: 'Questo telefono non ha una guardia',
          en: 'This phone has no lock',
        ),
        sotto: inLingua(
          it:
              'Per mettere un lucchetto all\'app serve che il telefono ne '
              'abbia uno suo: un volto, un\'impronta o almeno un codice di '
              'sblocco. Si accendono dalle impostazioni del telefono.',
          en:
              'To lock the app the phone needs a lock of its own: a face, a '
              'fingerprint or at least a passcode. You turn those on in the '
              'phone\'s settings.',
        ),
        azione: FilledButton.icon(
          onPressed: _cosaSaFare,
          icon: const Icon(Icons.refresh_rounded),
          label: Text(inLingua(it: 'Riguarda', en: 'Look again')),
        ),
      );
    }

    return QuantoCiSta(
      quanto: _quantoLarga,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          Scheda(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            child: Column(
              children: [
                SwitchListTile(
                  value: _lucchetto.allAvvio,
                  onChanged: (acceso) => _accendi(
                    acceso,
                    (quanto) => _lucchetto.con(allAvvio: quanto),
                  ),
                  secondary: const Cerchietto(icona: Icons.lock_rounded),
                  title: Text(
                    inLingua(
                      it: 'Chiedilo quando apro l\'app',
                      en: 'Ask when I open the app',
                    ),
                  ),
                  subtitle: Text(
                    inLingua(
                      it: 'Tutte le case, questa e le altre',
                      en: 'Every home, this one and the others',
                    ),
                  ),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                SwitchListTile(
                  value: _lucchetto.alRitorno,
                  onChanged: (acceso) => _accendi(
                    acceso,
                    (quanto) => _lucchetto.con(alRitorno: quanto),
                  ),
                  secondary: const Cerchietto(icona: Icons.schedule_rounded),
                  title: Text(
                    inLingua(
                      it: 'Anche quando ci torno',
                      en: 'And when I come back to it',
                    ),
                  ),
                  subtitle: Text(
                    inLingua(
                      it: 'Se l\'ho lasciata da più di un minuto',
                      en: 'If I left it more than a minute ago',
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Insegna(inLingua(it: 'Con che cosa', en: 'With what')),
          Scheda(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            child: Column(
              children: [
                _ConCosa(
                  quale: ComeRiconosce.volto,
                  acceso: _lucchetto.conIlVolto,
                  telefono: _telefono,
                  quandoCambia: (acceso) =>
                      _metti(_lucchetto.con(conIlVolto: acceso)),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                _ConCosa(
                  quale: ComeRiconosce.impronta,
                  acceso: _lucchetto.conLImpronta,
                  telefono: _telefono,
                  quandoCambia: (acceso) =>
                      _metti(_lucchetto.con(conLImpronta: acceso)),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
                  child: Text(
                    inLingua(
                      it:
                          'Quello che il telefono non sa fare resta spento. Se '
                          'sono accesi tutti e due, chiede quello che ha '
                          'pronto per primo.',
                      en:
                          'Whatever the phone cannot do stays off. With both '
                          'on, it asks for whichever is ready first.',
                    ),
                    style: testi.bodySmall?.copyWith(
                      color: colori.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Insegna(
            inLingua(
              it: 'E una seconda volta prima di',
              en: 'And a second time before',
            ),
          ),
          Scheda(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            child: Column(
              children: [
                for (final quale in PrimaDi.values) ...[
                  if (quale != PrimaDi.values.first)
                    const Divider(height: 1, indent: 16, endIndent: 16),
                  CheckboxListTile(
                    value: _lucchetto.prima.contains(quale),
                    onChanged: (acceso) => _accendi(
                      acceso ?? false,
                      (quanto) => _lucchetto.davanti(quale, quanto),
                    ),
                    controlAffinity: ListTileControlAffinity.trailing,
                    secondary: Icon(_disegnoDi(quale)),
                    title: Text(_comeSiChiama(quale)),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 18),
          _LaPromessa(),
        ],
      ),
    );
  }
}

/// Un modo di riconoscere: acceso, spento, o grigio perche' non c'e'.
class _ConCosa extends StatelessWidget {
  const _ConCosa({
    required this.quale,
    required this.acceso,
    required this.telefono,
    required this.quandoCambia,
  });

  final ComeRiconosce quale;
  final bool acceso;
  final CosaSaFareIlTelefono telefono;
  final ValueChanged<bool> quandoCambia;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    final ceL = telefono.sa.contains(quale);
    return SwitchListTile(
      /* Grigio e fermo dove il telefono non ce l'ha: acceso su una cosa che
       * non esiste sarebbe una preferenza che non succede, e chi la accende
       * crederebbe di aver fatto qualcosa. */
      value: acceso && ceL,
      onChanged: ceL ? quandoCambia : null,
      secondary: Icon(disegnoDi(quale)),
      title: Text(nomeDi(quale)),
      subtitle: Text(
        ceL
            ? inLingua(it: 'Questo telefono ce l\'ha', en: 'This phone has it')
            : inLingua(
                it: 'Questo telefono non ce l\'ha',
                en: 'This phone does not have it',
              ),
        style: testi.bodySmall?.copyWith(
          color: ceL ? colori.tertiary : colori.onSurfaceVariant,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Quello che il lucchetto promette, e quello che non promette.
class _LaPromessa extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colori.primaryContainer.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_rounded, size: 20, color: colori.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              inLingua(
                it:
                    'A dire sì o no è il telefono: volto e impronta non escono '
                    'di lì, e non arrivano né a gdahome né alla casa. Porte e '
                    'cancelli si aprono dalla plancia, e lì la guardia è il '
                    'PIN dell\'azione.',
                en:
                    'The phone is what says yes or no: face and fingerprint '
                    'never leave it, and reach neither gdahome nor the home. '
                    'Doors and gates open from the dashboard, and there the '
                    'guard is the action PIN.',
              ),
              style: testi.bodySmall?.copyWith(
                color: colori.onSurface,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

IconData _disegnoDi(PrimaDi quale) => switch (quale) {
  PrimaDi.ilCruscotto => Icons.home_work_rounded,
  PrimaDi.iComandi => Icons.power_settings_new_rounded,
  PrimaDi.togliereUnaCasa => Icons.delete_outline_rounded,
};

String _comeSiChiama(PrimaDi quale) => switch (quale) {
  PrimaDi.ilCruscotto => inLingua(
    it: 'Aprire il cruscotto e la gestione',
    en: 'Opening the fleet and the management page',
  ),
  PrimaDi.iComandi => inLingua(
    it: 'Comandare dalla scheda Dispositivi',
    en: 'Controlling from the Devices tab',
  ),
  PrimaDi.togliereUnaCasa => inLingua(
    it: 'Togliere una casa dall\'app',
    en: 'Removing a home from the app',
  ),
};
