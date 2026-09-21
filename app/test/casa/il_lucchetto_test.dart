/// Le regole del lucchetto: quando si chiede, e quando no (#54).
///
/// Sono le prove che contano di piu' di tutta questa storia, e il motivo e'
/// uno: **un lucchetto che si chiude e non si apre piu' e' peggio di nessun
/// lucchetto**. Chi si trova l'app che non si apre la disinstalla, e con lei
/// se ne va l'abbinamento con la casa — che si rifa' solo col QR davanti a
/// Home Assistant.
///
/// Meta' delle prove qui sotto sono per quel caso li'.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/il_lucchetto.dart';

void main() {
  const conTutto = CosaSaFareIlTelefono(
    sa: {ComeRiconosce.volto, ComeRiconosce.impronta},
    ceUnaGuardiaDelSistema: true,
  );
  const soloImpronta = CosaSaFareIlTelefono(
    sa: {ComeRiconosce.impronta},
    ceUnaGuardiaDelSistema: true,
  );
  const soloIlCodice = CosaSaFareIlTelefono(
    sa: {},
    ceUnaGuardiaDelSistema: true,
  );

  /* ─── com'è di serie ───────────────────────────────────────────────────── */

  test('di serie è spento, e non chiede niente a nessuno', () {
    /* Acceso di nascosto sarebbe peggio di spento: chi aggiorna l'app si
     * troverebbe davanti una richiesta che non ha chiesto, su un telefono che
     * magari il volto non ce l'ha nemmeno registrato. */
    expect(IlLucchetto.spento.allAvvio, isFalse);
    expect(IlLucchetto.spento.alRitorno, isFalse);
    expect(siDeveChiedere(IlLucchetto.spento, conTutto), isFalse);
  });

  test('e una casa abbinata prima di oggi resta com\'era', () {
    /* Niente scritto nelle impostazioni: si legge come spento, non come
     * acceso. È la stessa regola dei telefoni abbinati prima che esistesse
     * «di chi è questo telefono». */
    expect(IlLucchetto.daQuelloCheCEra(null).allAvvio, isFalse);
    expect(IlLucchetto.daQuelloCheCEra('roba storta').allAvvio, isFalse);
  });

  /* ─── quando si chiede ─────────────────────────────────────────────────── */

  test('acceso all\'avvio, si chiede all\'avvio', () {
    const acceso = IlLucchetto(allAvvio: true);
    expect(siDeveChiedere(acceso, conTutto), isTrue);
  });

  test('al ritorno si chiede solo dopo un minuto', () {
    const acceso = IlLucchetto(alRitorno: true);
    /* Più corto vorrebbe dire il volto chiesto ogni volta che si risponde a un
     * messaggio col telefono in mano. */
    expect(
      siDeveChiedere(acceso, conTutto, lasciataDa: const Duration(seconds: 20)),
      isFalse,
    );
    expect(
      siDeveChiedere(acceso, conTutto, lasciataDa: const Duration(minutes: 1)),
      isTrue,
    );
    expect(
      siDeveChiedere(acceso, conTutto, lasciataDa: const Duration(hours: 3)),
      isTrue,
    );
  });

  test('e acceso solo all\'avvio, tornandoci non si richiede', () {
    const soloAllAvvio = IlLucchetto(allAvvio: true);
    expect(
      siDeveChiedere(
        soloAllAvvio,
        conTutto,
        lasciataDa: const Duration(hours: 3),
      ),
      isFalse,
    );
  });

  /* ─── il caso che conta: non ci si chiude fuori ────────────────────────── */

  test('un telefono che non sa rispondere non fa chiudere l\'app', () {
    /* Chiedere a un telefono che non sa rispondere vorrebbe dire un'app che
     * non si apre più, e la cura sarebbe disinstallarla — portandosi via
     * l'abbinamento. */
    const acceso = IlLucchetto(allAvvio: true, alRitorno: true);
    expect(siDeveChiedere(acceso, CosaSaFareIlTelefono.niente), isFalse);
    expect(
      siDeveChiedere(
        acceso,
        CosaSaFareIlTelefono.niente,
        lasciataDa: const Duration(hours: 5),
      ),
      isFalse,
    );
  });

  test('col solo codice di sblocco si chiede lo stesso', () {
    /* Niente volto e niente impronta, ma una guardia c'è: è la strada di «Usa
     * il codice del telefono», e spegnere il lucchetto lì vorrebbe dire
     * lasciare scoperto un telefono che una guardia ce l'ha. */
    const acceso = IlLucchetto(allAvvio: true);
    expect(siDeveChiedere(acceso, soloIlCodice), isTrue);
    expect(conCosaSiChiede(acceso, soloIlCodice), isEmpty);
  });

  test('col volto spento e solo il volto in casa, resta il codice', () {
    const soloIlVolto = CosaSaFareIlTelefono(
      sa: {ComeRiconosce.volto},
      ceUnaGuardiaDelSistema: true,
    );
    const senzaVolto = IlLucchetto(allAvvio: true, conIlVolto: false);
    expect(conCosaSiChiede(senzaVolto, soloIlVolto), isEmpty);
    /* Si chiede comunque: la guardia del sistema c'è, e la finestra la apre
     * lui col codice. */
    expect(siDeveChiedere(senzaVolto, soloIlVolto), isTrue);
  });

  /* ─── con cosa ─────────────────────────────────────────────────────────── */

  test('si offre solo quello che il telefono ha davvero', () {
    const tuttiEDue = IlLucchetto(allAvvio: true);
    expect(conCosaSiChiede(tuttiEDue, conTutto), {
      ComeRiconosce.volto,
      ComeRiconosce.impronta,
    });
    /* Acceso su una cosa che il telefono non ha: non si offre. Un riquadro
     * col volto su un telefono senza fotocamera frontale è un'istruzione
     * impossibile da seguire. */
    expect(conCosaSiChiede(tuttiEDue, soloImpronta), {ComeRiconosce.impronta});
  });

  test('spegnere un modo lo toglie, anche se il telefono ce l\'ha', () {
    const senzaVolto = IlLucchetto(allAvvio: true, conIlVolto: false);
    expect(conCosaSiChiede(senzaVolto, conTutto), {ComeRiconosce.impronta});
  });

  /* ─── i tre momenti ────────────────────────────────────────────────────── */

  test('appena installata non protegge niente, nemmeno il cruscotto', () {
    /* È il difetto che questa riga tiene fermo: con i tre momenti pieni di
     * serie, un'app appena installata avrebbe chiesto il volto davanti al
     * cruscotto senza che nessuno avesse acceso niente. */
    expect(IlLucchetto.spento.prima, isEmpty);
    expect(
      siDeveChiederePrimaDi(PrimaDi.ilCruscotto, IlLucchetto.spento, conTutto),
      isFalse,
    );
  });

  test('e accendendolo si suggeriscono le due che non si disfano', () {
    /* Non i comandi: accendere una luce si disfa premendo di nuovo, mentre
     * aprire gli impianti di altre persone e cancellare un abbinamento no. */
    expect(IlLucchetto.daAccendereLaPrimaVolta, {
      PrimaDi.ilCruscotto,
      PrimaDi.togliereUnaCasa,
    });
    final acceso = IlLucchetto.spento.con(
      allAvvio: true,
      prima: IlLucchetto.daAccendereLaPrimaVolta,
    );
    expect(
      siDeveChiederePrimaDi(PrimaDi.ilCruscotto, acceso, conTutto),
      isTrue,
    );
    expect(siDeveChiederePrimaDi(PrimaDi.iComandi, acceso, conTutto), isFalse);
  });

  test('accendere un momento lo accende davvero', () {
    /* Scritto in una riga con un ternario e un `..remove` questo non
     * funzionava: la cascata ha la precedenza più bassa di tutte, quindi si
     * attaccava al ternario INTERO — accendere aggiungeva e poi toglieva, e
     * l'interruttore non si muoveva. */
    const spento = IlLucchetto(prima: {});
    final acceso = spento.davanti(PrimaDi.iComandi, true);
    expect(acceso.prima, {PrimaDi.iComandi});
    expect(acceso.davanti(PrimaDi.iComandi, false).prima, isEmpty);
  });

  test('e accenderne uno non tocca gli altri', () {
    const suo = IlLucchetto(prima: {PrimaDi.ilCruscotto});
    final adesso = suo.davanti(PrimaDi.iComandi, true);
    expect(adesso.prima, {PrimaDi.ilCruscotto, PrimaDi.iComandi});
    /* E l'originale non si muove: è un valore, non un oggetto vivo. */
    expect(suo.prima, {PrimaDi.ilCruscotto});
  });

  test('senza guardia non si chiede nemmeno prima delle tre cose', () {
    const suo = IlLucchetto(prima: {PrimaDi.togliereUnaCasa});
    expect(
      siDeveChiederePrimaDi(
        PrimaDi.togliereUnaCasa,
        suo,
        CosaSaFareIlTelefono.niente,
      ),
      isFalse,
    );
  });

  /* ─── come si scrive e come si rilegge ─────────────────────────────────── */

  test('quello che si scrive si rilegge uguale', () {
    const suo = IlLucchetto(
      allAvvio: true,
      alRitorno: true,
      conIlVolto: false,
      prima: {PrimaDi.iComandi},
    );
    final tornato = IlLucchetto.daQuelloCheCEra(suo.comeSiScrive);
    expect(tornato.allAvvio, isTrue);
    expect(tornato.alRitorno, isTrue);
    expect(tornato.conIlVolto, isFalse);
    expect(tornato.conLImpronta, isTrue);
    expect(tornato.prima, {PrimaDi.iComandi});
  });

  test('un momento che non conosciamo si butta, e gli altri restano', () {
    /* Una versione più nuova che ne aggiunge uno, e poi si torna indietro:
     * meglio perderlo che leggere un nome che non vuol dire niente. */
    final tornato = IlLucchetto.daQuelloCheCEra({
      'avvio': true,
      'prima': ['iComandi', 'qualcosaDiNuovo'],
    });
    expect(tornato.prima, {PrimaDi.iComandi});
  });

  test('«acceso» vuol dire che serve a qualcosa', () {
    expect(IlLucchetto.spento.acceso, isFalse);
    expect(const IlLucchetto(allAvvio: true).acceso, isTrue);
    /* Acceso dappertutto ma senza un modo per rispondere: non serve a niente,
     * e la schermata lo deve sapere per non offrirlo. */
    expect(
      const IlLucchetto(
        allAvvio: true,
        conIlVolto: false,
        conLImpronta: false,
        prima: {},
      ).acceso,
      isFalse,
    );
  });
}
