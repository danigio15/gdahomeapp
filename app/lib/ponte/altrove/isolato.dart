/// Sul telefono e nelle prove: il lavoro va in un altro isolato.
///
/// **Uno solo, e resta acceso.** Prima se ne apriva uno nuovo per ogni lavoro
/// (`Isolate.run`), e durante l'avvio della plancia sono centinaia di isolati
/// aperti e chiusi in mezzo minuto: ognuno costa la nascita, la copia di
/// quello che si porta dentro, la morte — e tutto quel costo, la parte che si
/// paga da questa parte, si paga sul filo che disegna lo schermo.
///
/// Adesso c'e' un aiutante solo: si sveglia al primo lavoro, li fa in fila, e
/// dopo mezzo minuto che non gli si chiede niente se ne va. Se serve ancora,
/// rinasce.
library;

import 'dart:async';
import 'dart:isolate';
import 'dart:typed_data';

/// Dopo quanto silenzio l'aiutante se ne va a dormire. Tenerlo acceso per
/// sempre vorrebbe dire un filo del sistema fermo li' a non fare niente;
/// spegnerlo subito vorrebbe dire rifarlo a ogni fotogramma.
const Duration _sonnellino = Duration(seconds: 30);

/// Fa [lavoro] nell'aiutante e ne torna il risultato.
///
/// [lavoro] deve portarsi dietro solo cose che si possono spedire — byte,
/// testo, numeri — e il risultato torna copiato. Per questo chi lo usa passa
/// i byte della chiave e non la chiave, e ricostruisce dentro quello che gli
/// serve.
Future<R> altrove<R>(FutureOr<R> Function() lavoro) => _Aiutante.io.fai(lavoro);

/// Byte che tornano da un lavoro fatto altrove, **trasferiti**.
///
/// Un risultato normale torna copiato: un'istantanea di telecamera da
/// duecento kilobyte e' duecento kilobyte allocati qui, sul filo che disegna
/// lo schermo, e poi da buttare. I byte no: chi li ha fatti li perde, questo
/// isolato li trova, e in mezzo non si copia niente.
Future<Uint8List> byteDaAltrove(FutureOr<Uint8List> Function() lavoro) async {
  final venuti = await altrove<TransferableTypedData>(
    () async => TransferableTypedData.fromList([_interi(await lavoro())]),
  );
  return venuti.materialize().asUint8List();
}

/// Byte dati a un lavoro fatto altrove, **trasferiti**.
///
/// Stessa cosa nell'altro verso, e per lo stesso motivo. In cambio, [byte]
/// **non si usa piu'** dopo questa chiamata: sono andati.
Future<R> altroveCoiByte<R>(
  Uint8List byte,
  FutureOr<R> Function(Uint8List) lavoro,
) {
  final andati = TransferableTypedData.fromList([_interi(byte)]);
  return altrove<R>(() => lavoro(andati.materialize().asUint8List()));
}

/// Byte da spedire per intero, e non affacciati su un pezzo di qualcos'altro.
///
/// Una vista — quello che torna spezzando un mucchio — guarda dentro un
/// blocco piu' grande, e spedirla vorrebbe dire portarsi via il blocco sotto
/// insieme ai fratelli che ci guardano ancora. Quando e' una vista si copia,
/// e quando non lo e' — quasi sempre — non si copia niente.
Uint8List _interi(Uint8List byte) =>
    byte.offsetInBytes == 0 && byte.lengthInBytes == byte.buffer.lengthInBytes
    ? byte
    : Uint8List.fromList(byte);

class _Aiutante {
  _Aiutante._();

  static final _Aiutante io = _Aiutante._();

  Future<SendPort>? _acceso;
  ReceivePort? _da;
  Timer? _sonno;
  int _prossimo = 0;
  final _inCorso = <int, Completer<Object?>>{};

  Future<R> fai<R>(FutureOr<R> Function() lavoro) async {
    _sonno?.cancel();
    _sonno = null;
    final verso = await (_acceso ??= _sveglia());
    /* Fra l'attesa qui sopra e la spedizione qui sotto non gira niente
     * d'altro: le microattivita' passano prima dei timer, quindi l'aiutante
     * non puo' addormentarsi proprio adesso. */
    final numero = _prossimo++;
    final aspetta = Completer<Object?>();
    _inCorso[numero] = aspetta;
    verso.send([numero, lavoro]);
    try {
      return await aspetta.future as R;
    } finally {
      _inCorso.remove(numero);
      _forseDormi();
    }
  }

  Future<SendPort> _sveglia() {
    /* Fuori da qualunque zona: nelle prove il tempo e' finto, e un aiutante
     * che nasce dentro il tempo finto non nascerebbe mai. */
    return Zone.root.run(() async {
      final da = ReceivePort();
      _da = da;
      final prima = Completer<SendPort>();
      da.listen((dynamic risposta) {
        if (risposta is SendPort) {
          if (!prima.isCompleted) prima.complete(risposta);
          return;
        }
        final detto = risposta as List<Object?>;
        final chiAspetta = _inCorso[detto[0] as int];
        if (chiAspetta == null || chiAspetta.isCompleted) return;
        final male = detto[2];
        if (male == null) {
          chiAspetta.complete(detto[1]);
        } else {
          chiAspetta.completeError(LavoroAndatoStorto('$male'));
        }
      });
      try {
        await Isolate.spawn(_aiuta, da.sendPort, errorsAreFatal: false);
      } catch (errore) {
        da.close();
        _da = null;
        _acceso = null;
        rethrow;
      }
      return prima.future;
    });
  }

  void _forseDormi() {
    if (_inCorso.isNotEmpty) return;
    _sonno?.cancel();
    /* Anche questo fuori dalle zone: un timer da mezzo minuto dentro una
     * prova col tempo finto resterebbe li' a far fallire la prova. */
    _sonno = Zone.root.run(() => Timer(_sonnellino, _spegni));
  }

  void _spegni() {
    _sonno = null;
    if (_inCorso.isNotEmpty) return;
    final acceso = _acceso;
    _acceso = null;
    final da = _da;
    _da = null;
    acceso?.then((verso) => verso.send(null)).whenComplete(() => da?.close());
  }
}

/// L'aiutante, visto da dentro: prende lavori, li fa, rimanda quello che
/// esce. Un `null` vuol dire «puoi andare».
void _aiuta(SendPort verso) {
  final mio = ReceivePort();
  verso.send(mio.sendPort);
  mio.listen((dynamic messaggio) async {
    if (messaggio == null) {
      mio.close();
      return;
    }
    final detto = messaggio as List<Object?>;
    final numero = detto[0] as int;
    final lavoro = detto[1] as FutureOr<Object?> Function();
    try {
      verso.send([numero, await lavoro(), null]);
    } catch (errore) {
      /* L'errore torna come frase e non come oggetto: chi ha chiesto il
       * lavoro sa gia' cosa vuol dire, e lo rifa' suo. */
      verso.send([numero, null, '$errore']);
    }
  });
}

/// Quello che si vede da questa parte quando un lavoro e' andato storto
/// dall'altra.
class LavoroAndatoStorto implements Exception {
  const LavoroAndatoStorto(this.spiegazione);
  final String spiegazione;
  @override
  String toString() => spiegazione;
}
