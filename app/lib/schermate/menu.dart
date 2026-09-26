/// Le sezioni dell'app: le voci della barra.
///
/// La home e' la plancia, e basta: quella di DashboardModern, la vera, che
/// gira dentro l'app com'e'. Le sue pagine — le luci, il clima, l'energia —
/// stanno dentro di lei, nella sua barra, e qui non si ripetono.
///
/// Con una sola eccezione, ed e' voluta: la **Configurazione**. Nella plancia
/// si apre da dentro la plancia, e la configurazione della casa e' una cosa
/// dell'app, non di una delle sue schermate: esce da li' e diventa una voce
/// del menu.
///
/// Esce la **porta**, non la Config. La voce del menu apre quella della
/// dashboard — la stessa, com'e', con le sue schede e il suo cercatore — e
/// non una copia rifatta in Flutter: una copia sarebbe un'altra grafica e un
/// altro posto dove le cose stanno, e non sarebbe mai la stessa. Vedi
/// `plancia/premesse.dart`.
///
/// La Config della plancia e' la sua **pagina**, non solo il suo editor:
/// dentro ci stanno anche il Tema, la Tavolozza e la Barra di navigazione, che
/// la dashboard tiene per questo dispositivo e dichiara tali. Quelle non si
/// rifanno: si aprono.
///
/// E **Come va l'app**, che dell'app parla davvero: i fotogrammi, il filo con
/// la casa, il ritardo dei dati, e i due interruttori che pesano sul riquadro
/// — la plancia leggera e la composizione ibrida. Sono cose dell'app, non
/// della plancia, e nella plancia non ci sono perche' non ci possono essere.
///
/// Il resto e' quello che in Home Assistant sta nascosto, e che l'app
/// aggiunge. Le voci che non ci sono ancora restano nell'elenco, spente: si
/// sa dove sta andando l'app, e non ci si chiede se manchi un pezzo.
library;

import '../parole.dart';

/// Le sezioni dell'app: le voci del menu.
enum Sezione {
  plancia('home', pronta: true),
  dispositivi('widget', pronta: true),
  /* Il navigatore: gdanav, dentro l'app (`navigatore_qui/`). Solo sul
   * telefono: vuole il GPS, la voce e l'auto, e nel browser non ce n'e'. Il
   * disegno e' quello dell'auto elettrica della plancia, che e' l'auto per
   * cui gdanav e' fatto.
   *
   * Nella barra non e' una riga come le altre: e' la tessera in testa, viva,
   * con l'auto della plancia (vedi `BarraDelleSezioni.tessera`). */
  navigatore('ev', pronta: true, soloNellApp: true),
  configurazione('impostazioni', pronta: true),
  comeVaLApp('minipc', pronta: true),
  /* Cosa c'e' da aggiornare in casa.
   *
   * «Quando ci saranno gli aggiornamenti, e quindi compaiono in Home
   * Assistant, chi utilizzera' app non vedra' mai aggiornamenti se non accede
   * su HA.» E' il prezzo di un'app che prende il posto di Home Assistant: in
   * Home Assistant quel pallino rosso sta in una pagina che non si apre piu'.
   * Qui e' una voce del menu, col numero addosso. */
  aggiornamenti('aggiornamenti', pronta: true),
  segnalazioni('segnalazioni', pronta: true),
  assistenza('assistenza', pronta: true),
  /* La coda di chi risponde. Non e' una voce come le altre: compare **in una
   * casa sola al mondo**, quella che nelle opzioni del ponte ha la chiave
   * della console. Chi la voce ce l'ha lo decide il ponte, non l'app — vedi
   * `vociDellaBarra`. */
  console('avvisi', pronta: true),
  /* Il cruscotto di chi installa. Come la Console non e' una voce come le
   * altre: compare **solo dove le opzioni del ponte hanno l'interruttore
   * `installatore` acceso**, cioe' sull'Home Assistant di chi monta impianti e
   * non in casa di un cliente. Chi la voce ce l'ha lo decide il ponte, non
   * l'app — vedi `vociDellaBarra`. */
  cruscotto('macchine', pronta: true),
  /* Chi **tiene** il quadro: gli installatori iscritti, le loro chiavi, i
   * limiti. Come le due qui sopra non e' una voce come le altre — compare in
   * una casa sola al mondo, quella che nelle opzioni del ponte ha la chiave
   * della gestione — e chi la voce ce l'ha lo decide il ponte, non l'app.
   *
   * Mancava, e non era rotta: il ponte fabbrica gia' la sua voce nella barra
   * di Home Assistant, e qui non c'era proprio.
   *
   * Il disegno e' quello delle **persone**, e non uno di chiave o di
   * lucchetto: quella pagina non apre niente, tiene l'elenco di chi installa
   * — nomi, limiti, chiavi da dare e da togliere — e la cosa che ci sta
   * dentro sono le persone. Nella barra di Home Assistant la voce ha
   * `mdi:account-key`, che e' la stessa cosa detta con quello che li' c'e'. */
  gestione('persone', pronta: true),
  /* ─── Quelle che ci sono solo nell'app ────────────────────────────────
   *
   * Tre voci vivono **solo su Android e iOS**, e non nella webapp — quattro
   * col Navigatore, che sta piu' su vicino ai Dispositivi. Non e' una
   * dimenticanza: sono cose che vogliono il telefono — la rete Zigbee si apre
   * stando in piedi davanti al dispositivo, col telefono in una mano — e una
   * copia nel browser sarebbe una porta che si apre su meta' di quello che
   * promette. Una porta che non si apre e' peggio di una porta che non c'e'. */
  aiutanti('mie', soloNellApp: true),
  /* Un dispositivo nuovo, abbinato dal telefono (#54).
   *
   * Come la Console e il Cruscotto non e' una voce come le altre: compare
   * **solo dove una rete Zigbee c'e'**, e chi ce l'ha lo dice il ponte, non
   * l'app. In una casa senza ZHA e senza Zigbee2MQTT quella voce aprirebbe
   * una porta che non si apre — vedi `vociDellaBarra`. */
  zigbee('runtime', pronta: true, soloNellApp: true),
  automazioni('azioni', soloNellApp: true);

  const Sezione(this.disegno, {this.pronta = false, this.soloNellApp = false});

  /// Come si chiama, nella lingua di chi guarda.
  ///
  /// E' una domanda e non un campo perche' un campo di un `enum` si decide
  /// quando si compila, e la lingua si sa quando si apre l'app.
  ///
  /// «Configurazione» in inglese e' **Config**, e non «Settings»: quella voce
  /// apre la pagina Config della plancia, e la plancia inglese la chiama
  /// cosi' (`dashboard-en.html`). Due nomi per la stessa stanza sono un nome
  /// di troppo. Per lo stesso motivo «Aiutanti» e «Automazioni» prendono i
  /// nomi che hanno in Home Assistant: Helpers e Automations.
  String get titolo => switch (this) {
    Sezione.plancia => inLingua(it: 'Plancia', en: 'Dashboard'),
    Sezione.dispositivi => inLingua(it: 'Dispositivi', en: 'Devices'),
    /* Il suo nome, e non «Navigatore»: e' un'app che c'e' anche da sola, e
     * chi la conosce la cerca con quel nome. */
    Sezione.navigatore => 'gdanav',
    Sezione.configurazione => inLingua(it: 'Configurazione', en: 'Config'),
    Sezione.comeVaLApp => inLingua(it: 'Come va l\'app', en: 'App health'),
    Sezione.aggiornamenti => inLingua(it: 'Aggiornamenti', en: 'Updates'),
    Sezione.segnalazioni => inLingua(it: 'Segnalazioni', en: 'Reports'),
    Sezione.assistenza => inLingua(it: 'Assistenza', en: 'Support'),
    Sezione.console => inLingua(it: 'Console', en: 'Console'),
    /* Qui basta «Cruscotto»: nell'app ci si e' gia' dentro, e «installatore»
     * non aggiunge niente che il posto non dica gia'. Nella barra laterale di
     * Home Assistant invece la voce si chiama «Cruscotto installatore», perche'
     * li' sta in mezzo ai pannelli di chiunque e deve dire di chi e'.
     *
     * E in inglese non «Dashboard», che e' gia' di Plancia: due nomi per la
     * stessa parola sono peggio di due parole. «Fleet» dice quello che la
     * schermata mostra — tutti gli impianti insieme — in una parola sola. */
    Sezione.cruscotto => inLingua(it: 'Cruscotto', en: 'Fleet'),
    Sezione.gestione => inLingua(it: 'Gestione', en: 'Manage'),
    Sezione.aiutanti => inLingua(it: 'Aiutanti', en: 'Helpers'),
    Sezione.zigbee => inLingua(it: 'Zigbee', en: 'Zigbee'),
    Sezione.automazioni => inLingua(it: 'Automazioni', en: 'Automations'),
  };

  /// In quale gruppo della barra sta.
  GruppoDellaBarra get gruppo => switch (this) {
    Sezione.plancia ||
    Sezione.dispositivi ||
    Sezione.navigatore ||
    Sezione.configurazione ||
    Sezione.aggiornamenti => GruppoDellaBarra.casa,
    Sezione.comeVaLApp ||
    Sezione.segnalazioni ||
    Sezione.assistenza => GruppoDellaBarra.aiuto,
    _ => GruppoDellaBarra.avanzate,
  };

  /// Il disegno della sezione: lo stesso della plancia, per nome. Vedi
  /// `vestito/oggetti.dart`.
  final String disegno;

  /// `false` finche' quel blocco non e' scritto: la voce si vede, spenta.
  final bool pronta;

  /// `true` per le voci che esistono solo su Android e iOS.
  ///
  /// Nella webapp non ci sono proprio: non sono spente, non sono grigie, non
  /// ci sono. Vedi `vociDellaBarra`.
  final bool soloNellApp;
}

/// I gruppi della barra, dall'alto in basso.
///
/// Quattordici voci una sotto l'altra si leggono tutte uguali, e quelle di
/// ogni giorno — la plancia, i dispositivi — stanno in mezzo a quelle di una
/// volta al mese. In tre gruppi si trova prima quello che si cerca: la casa,
/// le cose da installatore, e in fondo l'aiuto, dove lo si va a cercare.
enum GruppoDellaBarra {
  casa,
  avanzate,
  aiuto;

  String get titolo => switch (this) {
    GruppoDellaBarra.casa => inLingua(it: 'Casa', en: 'Home'),
    GruppoDellaBarra.aiuto => inLingua(it: 'Aiuto', en: 'Help'),
    GruppoDellaBarra.avanzate => inLingua(it: 'Avanzate', en: 'Advanced'),
  };
}
