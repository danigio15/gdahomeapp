/// Il lucchetto: volto e impronta davanti all'app.
///
/// «passiamo a zigbee e riconoscimento biometrico e impronta digitale»
///
/// Un telefono sbloccato e lasciato sul tavolo apre la casa di chi ce l'ha:
/// le luci, le tapparelle, le telecamere, l'elenco di chi c'e' e chi non c'e'.
/// Il codice della casa sta nel portachiavi del telefono, e quello e' al
/// sicuro — ma l'app, una volta abbinata, non richiede niente a nessuno.
///
/// Questo modulo e' la meta' che **decide**: quando si chiede, con cosa, e
/// cosa succede se il telefono non sa farlo. Non tocca nessuno schermo e non
/// chiama nessun sistema, e si prova senza un telefono in mano.
///
/// ─── Cosa non esce di qui ────────────────────────────────────────────────
///
/// Il volto e l'impronta. Non li vede l'app, non li vede gdahome, non li vede
/// la casa: restano nel coprocessore del telefono, e da li' torna **un si' o
/// un no**. Non c'e' niente da mandare da nessuna parte, e infatti in questo
/// file non c'e' nessun giro sulla rete.
///
/// ─── E il PIN delle azioni ───────────────────────────────────────────────
///
/// E' un'altra cosa, e resta dov'e'. Porte e cancelli si aprono dalla plancia,
/// e li' la guardia e' il PIN dell'azione: quello protegge **quel comando**,
/// da qualunque telefono, anche da uno sbloccato dal padrone di casa. Questo
/// lucchetto protegge **l'app**, cioe' che a tenerla in mano sia chi dice di
/// essere. Due domande diverse, due guardie diverse.
library;

/// Con che cosa il telefono sa riconoscere chi lo tiene.
enum ComeRiconosce {
  /// Il volto: Face ID, o il riconoscimento del viso di Android.
  volto,

  /// L'impronta: Touch ID, il lettore sotto lo schermo, quello dietro.
  impronta,
}

/// Quando il lucchetto si chiude di nuovo dopo che l'app e' stata lasciata.
///
/// Un minuto. Piu' corto vorrebbe dire il volto chiesto ogni volta che si
/// risponde a un messaggio col telefono in mano; piu' lungo vorrebbe dire
/// un'app aperta in tasca per mezz'ora. E' anche quello che dice la
/// schermata: «se l'ho lasciata da piu' di un minuto».
const quantoPuoStareFuori = Duration(minutes: 1);

/// I momenti in cui si puo' chiedere una seconda volta.
///
/// Sono tre, e sono tre perche' sono le tre cose che da un telefono trovato
/// aperto si possono fare **e non si disfano**:
///
///  - il cruscotto e la gestione aprono gli impianti di altre persone;
///  - un comando dalla scheda Dispositivi accende e spegne roba vera;
///  - togliere una casa cancella l'abbinamento, e si rifa' solo col QR.
///
/// Quando si accende il lucchetto la prima volta si accendono il primo e il
/// terzo, e resta spento il secondo: accendere una luce si disfa premendo di
/// nuovo, mentre le altre due no. Vedi [daAccendereLaPrimaVolta].
enum PrimaDi {
  /// Aprire il cruscotto di chi installa, o la gestione del quadro.
  ilCruscotto,

  /// Comandare un'entita' dalla scheda Dispositivi.
  iComandi,

  /// Togliere una casa dall'app.
  togliereUnaCasa,
}

/// Come e' messo il lucchetto: cosa e' acceso, e cosa sa fare il telefono.
///
/// E' un valore e non un oggetto vivo: entra nelle decisioni qui sotto, e chi
/// lo tiene e' [Impostazioni]. Cosi' le regole si provano scrivendo un valore
/// invece di montare mezza applicazione.
class IlLucchetto {
  const IlLucchetto({
    this.allAvvio = false,
    this.alRitorno = false,
    this.conIlVolto = true,
    this.conLImpronta = true,
    this.prima = const {},
  });

  /// Spento del tutto: e' come nasce l'app, ed e' come restano le case
  /// abbinate prima che questa cosa esistesse.
  ///
  /// **Vuoto anche `prima`**, e non e' un dettaglio: con i tre momenti pieni
  /// di serie, un'app appena installata avrebbe chiesto il volto davanti al
  /// cruscotto senza che nessuno avesse acceso niente. Acceso di nascosto e'
  /// peggio di spento: chi aggiorna l'app si troverebbe davanti una richiesta
  /// che non ha chiesto, su un telefono che magari il volto non ce l'ha
  /// nemmeno registrato.
  static const spento = IlLucchetto();

  /// Cosa si accende quando si accende il lucchetto la prima volta.
  ///
  /// Non e' il valore di serie del campo — quello e' vuoto, apposta — ma il
  /// suggerimento che compare quando si e' appena detto «si'»: le due cose che
  /// da un telefono trovato aperto non si disfano. I comandi no: accendere una
  /// luce si disfa premendo di nuovo.
  static const daAccendereLaPrimaVolta = {
    PrimaDi.ilCruscotto,
    PrimaDi.togliereUnaCasa,
  };

  /// Chiedere all'apertura dell'app.
  final bool allAvvio;

  /// E anche tornandoci, se e' stata lasciata piu' di [quantoPuoStareFuori].
  final bool alRitorno;

  /// Se il volto va bene.
  final bool conIlVolto;

  /// Se l'impronta va bene.
  final bool conLImpronta;

  /// Davanti a quali delle tre cose si chiede una seconda volta.
  final Set<PrimaDi> prima;

  /// Se il lucchetto serve a qualcosa: acceso da qualche parte, e con almeno
  /// un modo per rispondere.
  bool get acceso =>
      (conIlVolto || conLImpronta) &&
      (allAvvio || alRitorno || prima.isNotEmpty);

  IlLucchetto con({
    bool? allAvvio,
    bool? alRitorno,
    bool? conIlVolto,
    bool? conLImpronta,
    Set<PrimaDi>? prima,
  }) => IlLucchetto(
    allAvvio: allAvvio ?? this.allAvvio,
    alRitorno: alRitorno ?? this.alRitorno,
    conIlVolto: conIlVolto ?? this.conIlVolto,
    conLImpronta: conLImpronta ?? this.conLImpronta,
    prima: prima ?? this.prima,
  );

  /// Lo stesso, con quel momento acceso o spento.
  ///
  /// Scritto disteso e non in una riga sola con un ternario e un `..remove`:
  /// la cascata ha la precedenza piu' bassa di tutte, quindi si sarebbe
  /// attaccata al ternario INTERO — accendere un momento lo aggiungeva e poi
  /// lo toglieva, e l'interruttore non si muoveva.
  IlLucchetto davanti(PrimaDi quale, bool acceso) {
    final adesso = {...prima};
    if (acceso) {
      adesso.add(quale);
    } else {
      adesso.remove(quale);
    }
    return con(prima: adesso);
  }

  Map<String, Object?> get comeSiScrive => {
    'avvio': allAvvio,
    'ritorno': alRitorno,
    'volto': conIlVolto,
    'impronta': conLImpronta,
    'prima': [for (final quale in prima) quale.name],
  };

  static IlLucchetto daQuelloCheCEra(Object? letto) {
    if (letto is! Map) return spento;
    final scritti = letto['prima'];
    return IlLucchetto(
      allAvvio: letto['avvio'] == true,
      alRitorno: letto['ritorno'] == true,
      /* Quello che non c'e' scritto vale acceso: sono i due modi di
       * rispondere, e spegnerli tutti e due vorrebbe dire un lucchetto che
       * non si puo' aprire. Chi li vuole spenti li ha spenti per iscritto. */
      conIlVolto: letto['volto'] != false,
      conLImpronta: letto['impronta'] != false,
      prima: {
        if (scritti is List)
          for (final quale in PrimaDi.values)
            if (scritti.contains(quale.name)) quale,
      },
    );
  }
}

/// Quello che il telefono sa fare davvero.
///
/// Non e' una preferenza: e' un fatto del telefono, e cambia sotto il naso —
/// un'impronta cancellata dalle impostazioni del sistema, un volto registrato
/// stasera. Si richiede ogni volta che serve invece di tenerselo a mente.
class CosaSaFareIlTelefono {
  const CosaSaFareIlTelefono({
    required this.sa,
    required this.ceUnaGuardiaDelSistema,
  });

  /// Niente: un telefono senza lettore, un browser, un tablet senza nulla
  /// registrato.
  static const niente = CosaSaFareIlTelefono(
    sa: {},
    ceUnaGuardiaDelSistema: false,
  );

  /// Con cosa sa riconoscere.
  final Set<ComeRiconosce> sa;

  /// Se almeno una guardia c'e': anche solo il codice di sblocco del telefono.
  ///
  /// Conta, ed e' il motivo per cui e' un campo a parte: dove il volto e
  /// l'impronta non ci sono ma un codice c'e', il lucchetto si puo' mettere
  /// lo stesso — e' quello che chiede la schermata con «Usa il codice del
  /// telefono».
  final bool ceUnaGuardiaDelSistema;

  bool get qualcosaSa => sa.isNotEmpty;
}

/// Se in questo momento bisogna farsi riconoscere.
///
/// `null` in [lasciataDa] vuol dire che l'app si sta aprendo adesso.
/// Altrimenti e' da quanto e' stata lasciata.
bool siDeveChiedere(
  IlLucchetto lucchetto,
  CosaSaFareIlTelefono telefono, {
  Duration? lasciataDa,
}) {
  /* Senza una guardia non si chiede niente. Non e' clemenza: e' che chiedere
   * a un telefono che non sa rispondere vorrebbe dire un'app che non si apre
   * piu', e la cura sarebbe disinstallarla. */
  if (!_puoRispondere(lucchetto, telefono)) return false;
  if (lasciataDa == null) return lucchetto.allAvvio;
  return lucchetto.alRitorno && lasciataDa >= quantoPuoStareFuori;
}

/// Se passare da [prima] a [dopo] allenta un lucchetto acceso.
///
/// Spegnerlo, togliere l'apertura o il ritorno, togliere uno dei momenti:
/// sono le cose che chi ha in mano un telefono trovato aperto farebbe per
/// primo, e per questo si chiedono come si chiede all'apertura. Stringere
/// invece — accendere un momento in piu' — non chiede niente: e' la stessa
/// persona che si e' gia' fatta riconoscere per accenderlo.
bool siAllenta(IlLucchetto prima, IlLucchetto dopo) {
  if (!prima.acceso) return false;
  if (!dopo.acceso) return true;
  if (prima.allAvvio && !dopo.allAvvio) return true;
  if (prima.alRitorno && !dopo.alRitorno) return true;
  return prima.prima.difference(dopo.prima).isNotEmpty;
}

/// Se prima di quella cosa bisogna farsi riconoscere.
bool siDeveChiederePrimaDi(
  PrimaDi quale,
  IlLucchetto lucchetto,
  CosaSaFareIlTelefono telefono,
) => _puoRispondere(lucchetto, telefono) && lucchetto.prima.contains(quale);

/// Con cosa si chiede, adesso: quello che e' acceso **e** che il telefono ha.
///
/// Serve a disegnare — due riquadri o uno — e a dire perche' un interruttore
/// e' grigio. Chiedere davvero e' il sistema a farlo, e sceglie lui quale dei
/// due ha pronto per primo.
Set<ComeRiconosce> conCosaSiChiede(
  IlLucchetto lucchetto,
  CosaSaFareIlTelefono telefono,
) => {
  if (lucchetto.conIlVolto && telefono.sa.contains(ComeRiconosce.volto))
    ComeRiconosce.volto,
  if (lucchetto.conLImpronta && telefono.sa.contains(ComeRiconosce.impronta))
    ComeRiconosce.impronta,
};

/// Se si puo' chiedere qualcosa a cui si sappia rispondere.
///
/// Il volto o l'impronta accesi e presenti; oppure, quando non ce n'e'
/// nessuno, il codice del telefono — che c'e' se c'e' una guardia di sistema.
/// Un lucchetto che nessuno puo' aprire non si mette.
bool _puoRispondere(IlLucchetto lucchetto, CosaSaFareIlTelefono telefono) =>
    conCosaSiChiede(lucchetto, telefono).isNotEmpty ||
    telefono.ceUnaGuardiaDelSistema;
