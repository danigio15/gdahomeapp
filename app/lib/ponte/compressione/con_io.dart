/// Sul telefono e nelle prove: il gzip di `dart:io`.
library;

import 'dart:io';
import 'dart:typed_data';

const bool gzipDisponibile = true;

/* Il livello: basso apposta. Quello che l'app comprime sono comandi e
 * allegati, e un allegato e' gia' compresso di suo: fra il quattro e il sei
 * c'e' il doppio del tempo per quasi niente. */
final _gzip = GZipCodec(level: 4);

/// I byte, compressi.
Uint8List comprimi(List<int> byte) {
  final fatto = _gzip.encode(byte);
  return fatto is Uint8List ? fatto : Uint8List.fromList(fatto);
}

/// Un gzip, scompattato. Con un tetto: un gzip da venti chilobyte puo'
/// contenere gigabyte di niente, e chi lo manda non sta mandando la casa.
/// Oltre [massimo] si smette e si solleva, senza aspettare la fine.
Uint8List scompatta(List<int> byte, {required int massimo}) {
  final raccolta = _Raccolta(massimo);
  final dentro = gzip.decoder.startChunkedConversion(raccolta);
  dentro.add(byte);
  dentro.close();
  return raccolta.byte;
}

class _Raccolta implements Sink<List<int>> {
  _Raccolta(this.massimo);

  final int massimo;
  final _byte = BytesBuilder();

  @override
  void add(List<int> pezzo) {
    if (_byte.length + pezzo.length > massimo) {
      throw const FormatException('troppo grande una volta aperto');
    }
    _byte.add(pezzo);
  }

  @override
  void close() {}

  Uint8List get byte => _byte.takeBytes();
}
