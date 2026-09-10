/// Più di uno: gli elenchi che hanno anche una scelta.
///
/// La plancia non ha **un'**auto, **un** impianto solare, **una** centrale
/// d'allarme. Ne tiene un elenco, piu' la chiave che dice **qual e' quella
/// scelta** — quella che si vede nella pagina quando non se ne chiede
/// un'altra:
///
///     auto             cd_ev_cars           cd_ev_car_active
///     impianti solari  cd_solari            cd_solare_scelto
///     centrali         cd_centrali          cd_centrale_scelta
///     scaldabagni      cd_scaldabagni       —
///     impianti termici cd_impianti_termici  —
///     continuita'      cd_ups               cd_ups_meta
///
/// E una voce di quegli elenchi non e' «un nome e un'entita'»: e' un nome, una
/// marca, un modello, **la sua mappatura di entita'** e le sue foto. Un'auto
/// tiene dentro le diciassette caselle di `dm.ev_*` che valgono per lei, cosi'
/// cambiando auto cambia tutta la pagina.
///
/// Questo file e' quel modello, e sta a parte perche' vale per tutte e sei:
/// scritto una volta, ognuna ci mette solo i suoi campi.
library;

import 'apparecchio.dart';

/// Come e' fatta una famiglia di cose di cui ce n'e' piu' di una.
class Famiglia {
  const Famiglia({
    required this.chiave,
    required this.laScelta,
    required this.unaCosa,
    required this.leCose,
    this.prefissoDelleCaselle = '',
    this.sceltaPerNumero = true,
  });

  /// Dove sta l'elenco: `cd_ev_cars`.
  final String chiave;

  /// Dove sta quale e' scelta, o vuoto quando la famiglia non ne ha una.
  final String laScelta;

  /// Come si chiama una di queste, al singolare e al plurale.
  final String unaCosa;
  final String leCose;

  /// Il prefisso delle caselle che ogni voce si porta dentro: `dm.ev_`.
  /// Vuoto quando la famiglia non ha caselle sue.
  final String prefissoDelleCaselle;

  /// Come si scrive la scelta: col numero della voce (le auto, che scrivono
  /// `cd_ev_car_active` come indice) o col suo identificativo.
  final bool sceltaPerNumero;

  bool get haUnaScelta => laScelta.isNotEmpty;
  bool get haLeCaselle => prefissoDelleCaselle.isNotEmpty;
}

/// Le famiglie che ci sono, con le chiavi vere della plancia.
const leAuto = Famiglia(
  chiave: 'cd_ev_cars',
  laScelta: 'cd_ev_car_active',
  unaCosa: 'un\'auto',
  leCose: 'Le auto',
  prefissoDelleCaselle: 'dm.ev_',
);

const gliImpiantiSolari = Famiglia(
  chiave: 'cd_solari',
  laScelta: 'cd_solare_scelto',
  unaCosa: 'un impianto',
  leCose: 'Gli impianti solari',
  prefissoDelleCaselle: 'dm.boiler_',
  sceltaPerNumero: false,
);

const leCentrali = Famiglia(
  chiave: 'cd_centrali',
  laScelta: 'cd_centrale_scelta',
  unaCosa: 'una centrale',
  leCose: 'Le centrali d\'allarme',
  sceltaPerNumero: false,
);

const gliScaldabagni = Famiglia(
  chiave: 'cd_scaldabagni',
  laScelta: '',
  unaCosa: 'uno scaldabagno',
  leCose: 'Gli scaldabagni',
);

/* Gli impianti termici qui non ci sono, ed e' voluto.
 *
 * `cd_impianti_termici` sembra una famiglia come le altre e non lo e': non
 * tiene un elenco di macchine, tiene tre si'/no — «cosa c'e' nel locale
 * caldaia». Trattarlo come una famiglia voleva dire scriverci un elenco, e la
 * plancia un elenco li' lo scarta (`normalizzaScelta` torna `null` per un
 * Array): la scelta fatta dal browser spariva al primo salvataggio dall'app.
 * Sta in `casa/plancia/caldo.dart`, con la sua forma.
 */

const laContinuita = Famiglia(
  chiave: 'cd_ups',
  laScelta: '',
  unaCosa: 'un gruppo di continuita\'',
  leCose: 'La continuita\'',
);

/// Una voce: quello che c'e' scritto, la sua mappatura di caselle, le sue foto.
///
/// Non e' un [Apparecchio]: gli apparecchi stanno negli elenchi delle cose di
/// casa e passano dal modello della plancia. Queste sono profili — un'auto, un
/// impianto — e la plancia se li tiene com'e' scritto, senza normalizzarli.
/// Quello che non si conosce si tiene: un profilo scritto da una versione piu'
/// nuova della plancia non deve perdere pezzi passando di qui.
class Voce {
  Voce(this.dentro);

  factory Voce.nuova(String nome) => Voce({'name': nome});

  final Map<String, dynamic> dentro;

  String get nome => '${dentro['name'] ?? ''}';
  String get marca => '${dentro['brand'] ?? ''}';
  String get modello => '${dentro['model'] ?? ''}';

  /// L'identificativo, per le famiglie che scelgono per nome invece che per
  /// numero. Chi non ce l'ha si fa riconoscere dal nome.
  String get id => '${dentro['id'] ?? dentro['uid'] ?? nome}';

  /// La mappatura delle caselle: `{'dm.ev_batteria_auto': 'sensor.…'}`.
  ///
  /// Sta **dentro il profilo**, non nelle sostituzioni della casa: e' quello
  /// che fa cambiare tutta la pagina quando si cambia auto. La plancia la
  /// tiene sotto `ov`, che e' come si chiamava quando le auto erano una sola.
  Map<String, String> get caselle => {
    for (final voce in (dentro['ov'] as Map? ?? const {}).entries)
      '${voce.key}': '${voce.value}',
  };

  set caselle(Map<String, String> quali) {
    if (quali.isEmpty) {
      dentro.remove('ov');
    } else {
      dentro['ov'] = quali;
    }
  }

  /// La foto, e quella con la spina attaccata — che le auto hanno tutte e due.
  String get foto => '${dentro['img'] ?? dentro['image'] ?? ''}';
  set foto(String dove) {
    if (dove.trim().isEmpty) {
      dentro.remove('img');
    } else {
      dentro['img'] = dove.trim();
    }
  }

  String get fotoAttaccata => '${dentro['img_plugged'] ?? ''}';
  set fotoAttaccata(String dove) {
    if (dove.trim().isEmpty) {
      dentro.remove('img_plugged');
    } else {
      dentro['img_plugged'] = dove.trim();
    }
  }

  void metti(String campo, Object? valore) {
    if (valore == null || (valore is String && valore.trim().isEmpty)) {
      dentro.remove(campo);
    } else {
      dentro[campo] = valore is String ? valore.trim() : valore;
    }
  }

  /// Marca e modello in una riga.
  String get sotto =>
      [marca, modello].where((uno) => uno.isNotEmpty).join(' · ');
}

/// L'elenco di una famiglia, con la sua scelta.
class Elenco {
  Elenco({required this.famiglia, required this.voci, required this.scelta});

  /// Legge l'elenco e la scelta dalla configurazione.
  factory Elenco.da(
    Famiglia famiglia, {
    required dynamic elenco,
    required dynamic scelta,
  }) {
    final voci = <Voce>[];
    if (elenco is List) {
      for (final una in elenco) {
        if (una is Map) voci.add(Voce(Map<String, dynamic>.from(una)));
      }
    } else if (elenco is Map) {
      /* Una sola, com'era prima che ne potessero stare piu' d'una: vale come
       * elenco di uno, se no chi ha configurato allora la perde. */
      voci.add(Voce(Map<String, dynamic>.from(elenco)));
    }
    return Elenco(
      famiglia: famiglia,
      voci: voci,
      scelta: _leggiLaScelta(famiglia, scelta, voci),
    );
  }

  final Famiglia famiglia;
  final List<Voce> voci;

  /// Quale e' scelta: il numero della voce, o `-1` quando non c'e'.
  int scelta;

  Voce? get quellaScelta =>
      scelta >= 0 && scelta < voci.length ? voci[scelta] : null;

  /// Aggiunge una voce. La prima diventa anche quella scelta: un elenco con
  /// una cosa sola e nessuna scelta e' una pagina vuota per niente.
  void aggiungi(Voce una) {
    voci.add(una);
    if (scelta < 0) scelta = voci.length - 1;
  }

  /// Toglie una voce, e sposta la scelta se serve.
  void togli(int quale) {
    if (quale < 0 || quale >= voci.length) return;
    voci.removeAt(quale);
    if (voci.isEmpty) {
      scelta = -1;
    } else if (scelta == quale) {
      /* Quella scelta e' stata tolta: si sceglie la prima, che e' meglio di
       * una pagina che non mostra niente senza dire perche'. */
      scelta = 0;
    } else if (scelta > quale) {
      scelta -= 1;
    }
  }

  void sposta(int quale, int diQuanto) {
    final dove = quale + diQuanto;
    if (quale < 0 || quale >= voci.length || dove < 0 || dove >= voci.length) {
      return;
    }
    final presa = voci.removeAt(quale);
    voci.insert(dove, presa);
    if (scelta == quale) {
      scelta = dove;
    } else if (scelta == dove) {
      scelta = quale;
    }
  }

  /// Cosa scrivere nella chiave dell'elenco.
  Object get daScrivere => [for (final una in voci) una.dentro];

  /// Cosa scrivere nella chiave della scelta.
  Object? get sceltaDaScrivere {
    if (!famiglia.haUnaScelta) return null;
    if (scelta < 0 || scelta >= voci.length) {
      return famiglia.sceltaPerNumero ? -1 : '';
    }
    return famiglia.sceltaPerNumero ? scelta : voci[scelta].id;
  }
}

int _leggiLaScelta(Famiglia famiglia, dynamic scritta, List<Voce> voci) {
  if (voci.isEmpty) return -1;
  if (!famiglia.haUnaScelta) return 0;
  if (famiglia.sceltaPerNumero) {
    final quale = switch (scritta) {
      final int uno => uno,
      final num uno => uno.toInt(),
      final String uno => int.tryParse(uno) ?? -1,
      _ => -1,
    };
    /* Una scelta che punta a un'auto che non c'e' piu' vale come nessuna
     * scelta, e allora si prende la prima: e' meglio di una pagina vuota. */
    return quale >= 0 && quale < voci.length ? quale : 0;
  }
  final quale = '${scritta ?? ''}';
  if (quale.isEmpty) return 0;
  final dove = voci.indexWhere((una) => una.id == quale);
  return dove >= 0 ? dove : 0;
}

/// Le caselle di una famiglia, prese da quelle di una sezione.
///
/// Un'auto tiene dentro di se' le stesse caselle che la sezione EV ha nel
/// catalogo (`dm.ev_*`): sono le stesse domande, ma la risposta e' di
/// quell'auto e non della casa.
List<String> caselleDellaFamiglia(Famiglia famiglia, Iterable<String> tutte) =>
    famiglia.haLeCaselle
    ? [
        for (final una in tutte)
          if (una.startsWith(famiglia.prefissoDelleCaselle)) una,
      ]
    : const [];
