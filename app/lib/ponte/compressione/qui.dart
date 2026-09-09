/// Nel browser: niente gzip. Non lo si chiede, e non lo si manda.
library;

import 'dart:typed_data';

const bool gzipDisponibile = false;

Uint8List comprimi(List<int> byte) =>
    throw UnsupportedError('nel browser non si comprime');

Uint8List scompatta(List<int> byte, {required int massimo}) =>
    throw UnsupportedError('nel browser il gzip non si apre');
