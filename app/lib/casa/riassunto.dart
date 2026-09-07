/// Quello che la home dice della casa, in cinque righe.
///
/// Chi apre l'app non vuole un elenco di duemila entita': vuole sapere se ha
/// lasciato una luce accesa, se e' rimasta una finestra aperta, che
/// temperatura fa, e se l'allarme e' inserito. Il resto lo cerca solo se lo
/// cerca.
///
/// Qui dentro non c'e' Flutter, ed e' voluto: quello che la home *decide di
/// dire* e' logica, e la logica si prova. Le tessere che la disegnano sono
/// un'altra cosa.
library;

import 'entita.dart';
import 'stato_della_casa.dart';

/// I domini che si accendono e si spengono, e che quindi contano come «acceso».
const _luci = {'light'};
const _prese = {'switch'};

/// Le classi di apertura che, aperte, valgono come «casa non chiusa».
///
/// `garage` e `door` no: una porta di servizio o un box aperti sono cose che
/// si sanno. Una finestra dimenticata aperta e' quella che costa.
const _apertureCheContano = {'window', 'door', 'garage', 'opening'};

/// Da quanto un'entita' deve essere ferma prima di considerarla persa.
const Duration _troppoFerma = Duration(hours: 24);

class TesseraDelRiassunto {
  const TesseraDelRiassunto({
    required this.chiave,
    required this.titolo,
    required this.valore,
    this.dettaglio,
    this.attenzione = false,
  });

  /// Come si chiama, per chi disegna: `luci`, `aperture`, `temperatura`…
  final String chiave;
  final String titolo;
  final String valore;
  final String? dettaglio;

  /// `true` quando e' una cosa che vale la pena guardare adesso.
  final bool attenzione;

  @override
  String toString() => '$chiave: $valore';
}

class Riassunto {
  const Riassunto({
    required this.tessere,
    required this.luciAccese,
    required this.preseAccese,
    required this.apertureAperte,
    required this.temperaturaMedia,
    required this.allarmeInserito,
    required this.mute,
    required this.quante,
  });

  final List<TesseraDelRiassunto> tessere;
  final List<Entita> luciAccese;
  final List<Entita> preseAccese;
  final List<Entita> apertureAperte;
  final double? temperaturaMedia;
  final bool? allarmeInserito;

  /// Quelle che non rispondono: un apparecchio staccato, una batteria finita.
  final List<Entita> mute;

  final int quante;

  bool get tuttoSpento => luciAccese.isEmpty && apertureAperte.isEmpty;

  /// Legge la casa e ne ricava il riassunto.
  static Riassunto di(StatoDellaCasa casa, {DateTime? adesso}) {
    final ora = adesso ?? DateTime.now();
    final tutte = casa.tutte();

    final luci = tutte
        .where((una) => _luci.contains(una.dominio) && una.accesa)
        .toList();
    final prese = tutte
        .where((una) => _prese.contains(una.dominio) && una.accesa)
        .toList();

    final aperture = tutte
        .where(
          (una) =>
              (una.dominio == 'binary_sensor' || una.dominio == 'cover') &&
              _apertureCheContano.contains(una.attributi['device_class']) &&
              una.accesa,
        )
        .toList();

    final gradi = tutte
        .where(
          (una) =>
              una.dominio == 'sensor' &&
              una.attributi['device_class'] == 'temperature' &&
              !una.muta,
        )
        .map((una) => double.tryParse(una.stato))
        .whereType<double>()
        .toList();
    final media = gradi.isEmpty
        ? null
        : gradi.reduce((somma, uno) => somma + uno) / gradi.length;

    final allarmi = tutte
        .where((una) => una.dominio == 'alarm_control_panel')
        .toList();
    final allarme = allarmi.isEmpty
        ? null
        : allarmi.any((una) => una.stato.startsWith('armed'));

    /* «Muta» da sempre non e' interessante: un'entita' che non ha mai
     * risposto e' un'integrazione configurata male, e non e' la home il posto
     * dove dirlo. Quella che risponde da mesi e da ieri no, invece, si'. */
    final mute = tutte
        .where(
          (una) =>
              una.muta &&
              una.cambiataIl != null &&
              ora.difference(una.cambiataIl!) < _troppoFerma,
        )
        .toList();

    return Riassunto(
      tessere: _tessere(
        luci: luci,
        prese: prese,
        aperture: aperture,
        media: media,
        allarme: allarme,
        mute: mute,
      ),
      luciAccese: luci,
      preseAccese: prese,
      apertureAperte: aperture,
      temperaturaMedia: media,
      allarmeInserito: allarme,
      mute: mute,
      quante: tutte.length,
    );
  }

  static List<TesseraDelRiassunto> _tessere({
    required List<Entita> luci,
    required List<Entita> prese,
    required List<Entita> aperture,
    required double? media,
    required bool? allarme,
    required List<Entita> mute,
  }) {
    final tessere = <TesseraDelRiassunto>[];

    /* Le luci ci sono sempre, accese o spente: e' la prima cosa che si guarda,
     * e una tessera che compare e sparisce fa ballare la pagina. */
    tessere.add(
      TesseraDelRiassunto(
        chiave: 'luci',
        titolo: 'Luci',
        valore: luci.isEmpty ? 'tutte spente' : '${luci.length} accese',
        dettaglio: luci.isEmpty ? null : _elenca(luci),
        attenzione: false,
      ),
    );

    if (aperture.isNotEmpty) {
      tessere.add(
        TesseraDelRiassunto(
          chiave: 'aperture',
          titolo: aperture.length == 1 ? 'Un\'apertura' : 'Aperture',
          valore: '${aperture.length} aperte',
          dettaglio: _elenca(aperture),
          attenzione: true,
        ),
      );
    }

    if (media != null) {
      tessere.add(
        TesseraDelRiassunto(
          chiave: 'temperatura',
          titolo: 'Temperatura',
          valore: '${media.toStringAsFixed(1)}°',
          dettaglio: 'media in casa',
        ),
      );
    }

    if (allarme != null) {
      tessere.add(
        TesseraDelRiassunto(
          chiave: 'allarme',
          titolo: 'Antifurto',
          valore: allarme ? 'inserito' : 'disinserito',
        ),
      );
    }

    if (prese.isNotEmpty) {
      tessere.add(
        TesseraDelRiassunto(
          chiave: 'prese',
          titolo: 'Prese',
          valore: '${prese.length} accese',
          dettaglio: _elenca(prese),
        ),
      );
    }

    if (mute.isNotEmpty) {
      tessere.add(
        TesseraDelRiassunto(
          chiave: 'mute',
          titolo: mute.length == 1 ? 'Non risponde' : 'Non rispondono',
          valore: '${mute.length}',
          dettaglio: _elenca(mute),
          attenzione: true,
        ),
      );
    }

    return tessere;
  }

  /// Tre nomi e poi «e altri N»: un elenco piu' lungo su una tessera non si
  /// legge.
  static String _elenca(List<Entita> quali) {
    final nomi = quali.map((una) => una.nome).toList();
    if (nomi.length <= 3) return nomi.join(', ');
    return '${nomi.take(3).join(', ')} e altri ${nomi.length - 3}';
  }
}
