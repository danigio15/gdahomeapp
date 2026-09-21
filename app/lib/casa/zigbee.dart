/// La rete Zigbee di questa casa, vista dall'app (#54).
///
/// «Vorrei poter abbinare un dispositivo zigbee direttamente dall'app.»
///
/// Qui non c'e' nessuna schermata: c'e' il giro sul filo, e basta. Le quattro
/// domande sono quelle che il ponte sa rispondere — che rete c'e', apri,
/// richiudi, chiamalo cosi' — e stanno insieme in un posto solo perche' le
/// schermate sono quattro e nessuna deve reinventarsi il nome di un comando.
///
/// ─── Chi ascolta chi entra ────────────────────────────────────────────────
///
/// Nessuno, da qui. Il pezzo che sente «e' entrato uno nuovo» sta **nel
/// ponte**, e c'e' una ragione precisa: fra l'ordine di aprire e la rete
/// aperta passano dei millesimi, e un dispositivo gia' in attesa entra subito.
/// Se ad ascoltare fosse l'app, quello si perderebbe ogni volta che il
/// telefono e' un attimo piu' lento — e chi guarda vedrebbe il conto alla
/// rovescia scorrere su un dispositivo che e' gia' dentro.
///
/// Il ponte quindi tiene lui l'elenco di chi e' entrato da quando la rete e'
/// stata aperta, e lo mette dentro `stato()`. All'app resta di richiederlo, e
/// per questo c'e' [mentreAspetti]: una domanda al secondo mentre si guarda
/// quella schermata, e nient'altro. Un filo aperto in piu' per una cosa che
/// dura quattro minuti non vale il filo.
///
/// ─── E se il ponte e' vecchio ─────────────────────────────────────────────
///
/// Risponde «non conosco questo comando», e qui diventa «nessuna rete». Non e'
/// un guasto da mostrare: e' una casa dove questa cosa non c'e' ancora, e la
/// voce nel menu semplicemente non compare. Una porta che non si apre e'
/// peggio di una porta che non c'e'.
library;

import 'dart:async';

import '../parole.dart';
import '../ponte/errori.dart';
import '../ponte/filo.dart';

/// Quale rete Zigbee governa questa casa.
enum LaRete {
  /// Nessuna delle due — o un ponte che non sa rispondere.
  nessuna(''),

  /// L'integrazione di Home Assistant.
  zha('zha'),

  /// Il programma a parte, che parla per posta (MQTT).
  z2m('z2m');

  const LaRete(this.comeLaChiamaIlPonte);

  /// Il nome con cui viaggia sul filo.
  final String comeLaChiamaIlPonte;

  /// Come si chiama per chi legge. Non si traduce: sono due nomi propri.
  String get nome => switch (this) {
    LaRete.zha => 'ZHA',
    LaRete.z2m => 'Zigbee2MQTT',
    LaRete.nessuna => '',
  };

  /// Se c'e' una rete che si puo' aprire.
  bool get siApre => this != LaRete.nessuna;

  static LaRete daQuelloCheDice(Object? detto) {
    final quale = detto is String ? detto.trim() : '';
    for (final rete in LaRete.values) {
      if (rete != LaRete.nessuna && rete.comeLaChiamaIlPonte == quale) {
        return rete;
      }
    }
    return LaRete.nessuna;
  }
}

/// Un dispositivo appena entrato, come lo presenta il ponte.
///
/// [marca] e [modello] non sono decorazione: sulla schermata del nome servono
/// a far dire «ah, e' quello» a chi ha appena premuto il tasto di una presa e
/// non sa se e' quella che e' entrata.
class DispositivoEntrato {
  const DispositivoEntrato({
    required this.id,
    required this.nome,
    required this.marca,
    required this.modello,
    required this.tramite,
  });

  factory DispositivoEntrato.daQuelloCheDice(Map<Object?, Object?> detto) =>
      DispositivoEntrato(
        id: _testo(detto['id']),
        nome: _testo(detto['nome']),
        marca: _testo(detto['marca']),
        modello: _testo(detto['modello']),
        tramite: _testo(detto['tramite']),
      );

  /// L'identificativo nel registro di Home Assistant.
  final String id;

  /// Come si chiama adesso: quasi sempre il codice del modello, che e' il
  /// motivo per cui il passo dopo chiede un nome.
  final String nome;

  final String marca;
  final String modello;

  /// Da quale integrazione e' arrivato davvero.
  ///
  /// Un dispositivo entrato mentre la rete Zigbee era aperta puo' comunque
  /// essere un Matter, e dirlo e' meglio che lasciarlo credere.
  final String tramite;

  /// Marca e modello in una riga, saltando quello che non si sa.
  String get comeSiRiconosce =>
      [marca, modello].where((pezzo) => pezzo.isNotEmpty).join(' · ');
}

/// Quello che il ponte dice della rete, adesso.
class StatoDellaRete {
  const StatoDellaRete({
    required this.rete,
    required this.aperta,
    required this.restano,
    required this.entrati,
  });

  factory StatoDellaRete.daQuelloCheDice(Map<Object?, Object?> detto) {
    final elenco = detto['entrati'];
    return StatoDellaRete(
      rete: LaRete.daQuelloCheDice(detto['quale']),
      aperta: detto['aperta'] == true,
      restano: _secondi(detto['restano']),
      entrati: [
        if (elenco is List)
          for (final uno in elenco)
            if (uno is Map<Object?, Object?>)
              DispositivoEntrato.daQuelloCheDice(uno),
      ],
    );
  }

  /// Quando non si sa niente: nessuna rete, niente aperto, nessuno entrato.
  static const nessuna = StatoDellaRete(
    rete: LaRete.nessuna,
    aperta: false,
    restano: 0,
    entrati: [],
  );

  final LaRete rete;

  /// Se in questo momento la rete accoglie dispositivi nuovi.
  final bool aperta;

  /// Quanti secondi manca alla chiusura. Zero a rete chiusa.
  final int restano;

  /// Chi e' entrato da quando la rete e' stata aperta, nell'ordine in cui e'
  /// arrivato. Si svuota a ogni nuova apertura: quello che e' entrato ieri non
  /// e' quello che sta entrando adesso.
  final List<DispositivoEntrato> entrati;
}

/// Quanto spesso si richiede lo stato mentre si aspetta.
///
/// Un secondo. E' la stessa frequenza con cui si muove il conto alla rovescia
/// a schermo — che conta da solo, senza chiedere niente — e chiedere piu'
/// spesso non farebbe entrare prima nessuno.
const ognUnSecondo = Duration(seconds: 1);

/// Il giro al ponte per la rete Zigbee.
class Zigbee {
  const Zigbee(this._filo);

  final Filo _filo;

  /// Che rete c'e', e cosa sta succedendo adesso.
  ///
  /// Non solleva mai: una casa che non risponde e una casa senza Zigbee si
  /// disegnano allo stesso modo — la voce non c'e' — e distinguerle
  /// costerebbe a chi guarda un messaggio d'errore su una cosa che non ha
  /// chiesto.
  Future<StatoDellaRete> stato() async {
    try {
      final detto = await _filo.risultato({'type': 'ponte/zigbee/stato'});
      if (detto is! Map<Object?, Object?>) return StatoDellaRete.nessuna;
      return StatoDellaRete.daQuelloCheDice(detto);
    } catch (_) {
      return StatoDellaRete.nessuna;
    }
  }

  /// Apre la rete. Per quanto lo decide il ponte se non si dice [secondi].
  ///
  /// Questa invece **solleva**, ed e' voluto: chi ha appena premuto «Apri la
  /// rete» ha chiesto qualcosa, e se non e' successo deve saperlo. E' la
  /// differenza fra una domanda che l'app fa per conto suo e un tasto che ha
  /// premuto una persona.
  ///
  /// Lo stato si compone dalla risposta invece di richiederlo: quello che
  /// manca lo si sa gia' — appena aperta non e' entrato nessuno, l'elenco lo
  /// svuota il ponte stesso — e un secondo giro sul filo vorrebbe dire il
  /// conto alla rovescia che comincia in ritardo su quello vero.
  Future<StatoDellaRete> apri({int? secondi}) async {
    final detto = await _filo.risultato({
      'type': 'ponte/zigbee/apri',
      if (secondi != null) 'secondi': secondi,
    });
    final fatto = _andataBene(detto);
    final restano = _secondi(fatto['restano']);
    return StatoDellaRete(
      rete: LaRete.daQuelloCheDice(fatto['quale']),
      aperta: restano > 0,
      restano: restano,
      entrati: const [],
    );
  }

  /// La richiude subito, senza aspettare che scada.
  Future<StatoDellaRete> chiudi() async {
    _andataBene(await _filo.risultato({'type': 'ponte/zigbee/chiudi'}));
    /* Qui il giro in piu' si paga volentieri: la risposta non dice che rete
     * fosse, e chi ha richiuso resta su quella schermata. */
    return stato();
  }

  /// Gli da' il nome che gli ha dato chi lo guarda (il passo 3).
  ///
  /// Il nome va nel registro di Home Assistant, dove lo vedono tutti — la
  /// plancia, le automazioni, l'app — e non in un cassetto dell'app: un
  /// dispositivo che si chiama «Presa lavatrice» qui e «TS0121» in casa
  /// sarebbe lo stesso dispositivo con due nomi, che e' il modo in cui uno
  /// smette di fidarsi di quello che legge.
  Future<DispositivoEntrato> rinomina(String dispositivo, String nome) async {
    final detto = await _filo.risultato({
      'type': 'ponte/zigbee/rinomina',
      'dispositivo': dispositivo,
      'nome': nome,
    });
    final suo = _andataBene(detto)['dispositivo'];
    if (suo is Map<Object?, Object?>) {
      return DispositivoEntrato.daQuelloCheDice(suo);
    }
    /* Fatta, ma senza rimandare la scheda: il nome nuovo lo sappiamo lo
     * stesso, ed e' quello che la schermata dopo scrive. */
    return DispositivoEntrato(
      id: dispositivo,
      nome: nome,
      marca: '',
      modello: '',
      tramite: '',
    );
  }

  /// La risposta, quando dice che e' andata. Altrimenti l'errore che porta.
  ///
  /// Il ponte a un ordine che non puo' eseguire non risponde «no»: risponde
  /// «si'» con dentro `fatto: false` e il motivo. Senza questo controllo un
  /// tasto premuto su una casa senza Zigbee non farebbe niente e non lo
  /// direbbe — che e' il modo peggiore di rifiutare.
  Map<Object?, Object?> _andataBene(Object? detto) {
    if (detto is Map<Object?, Object?>) {
      if (detto['fatto'] == true) return detto;
      final perche = _testo(detto['perche']);
      if (perche.isNotEmpty) throw ComandoRifiutato(perche);
    }
    throw ComandoRifiutato(
      inLingua(
        it: 'la rete Zigbee non ha risposto',
        en: 'the Zigbee network did not answer',
      ),
    );
  }

  /// Lo stato, richiesto finche' chi ascolta non smette.
  ///
  /// Il primo arriva subito e non dopo un secondo: chi apre la schermata deve
  /// vedere qualcosa mentre la apre, non un buco che si riempie dopo.
  ///
  /// Il battito e' un timer, e si spegne **nell'istante** in cui chi ascolta
  /// smette. Scritto come generatore — `yield`, e poi un'attesa — sarebbe
  /// stato piu' corto e sbagliato: un'attesa gia' partita non si annulla, e
  /// quel timer resta appeso fino a che non scade anche se la schermata e'
  /// gia' chiusa. Nelle prove dei widget e' un errore secco; nell'app e' un
  /// giro sul filo per una schermata che nessuno guarda piu'.
  ///
  /// Una richiesta che va storta non chiude il flusso e non si vede: il filo
  /// che cade e torna e' la normalita' di un telefono, e una schermata che si
  /// arrende al primo singhiozzo sarebbe una schermata che si arrende sempre.
  /// A dire che e' finita e' solo chi ascolta, smettendo.
  Stream<StatoDellaRete> mentreAspetti({Duration ogni = ognUnSecondo}) {
    late StreamController<StatoDellaRete> fila;
    Timer? battito;
    /* Una domanda per volta: su una rete lenta il giro puo' durare piu' di un
     * secondo, e senza questa riga si accavallerebbero — la casa riceverebbe
     * domande che nessuno aspetta piu'. */
    var inCorso = false;

    Future<void> unGiro() async {
      if (inCorso || fila.isClosed) return;
      inCorso = true;
      try {
        final adesso = await stato();
        if (!fila.isClosed) fila.add(adesso);
      } finally {
        inCorso = false;
      }
    }

    fila = StreamController<StatoDellaRete>(
      onListen: () {
        unawaited(unGiro());
        battito = Timer.periodic(ogni, (_) => unawaited(unGiro()));
      },
      onCancel: () {
        battito?.cancel();
        battito = null;
      },
    );
    return fila.stream;
  }
}

String _testo(Object? valore) => valore is String ? valore.trim() : '';

int _secondi(Object? valore) {
  if (valore is int) return valore < 0 ? 0 : valore;
  if (valore is num) {
    final quanti = valore.round();
    return quanti < 0 ? 0 : quanti;
  }
  return 0;
}
