import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/casa_conosciuta.dart';
import 'package:gdahome/notifiche/busta.dart';
import 'package:gdahome/notifiche/chiavi_per_l_iphone.dart';

void main() {
  test(
    "all'estensione va solo la chiave delle notifiche, mai quella del filo",
    () async {
      final filo = List.filled(32, 'ab').join();
      final case_ = [
        CasaConosciuta(
          id: 'casa-1',
          nome: 'Casa',
          segno: 's',
          identificativo: 'dm_0123456789abcdef',
          chiave: filo,
        ),
        CasaConosciuta(id: 'casa-2', nome: 'Mare', segno: 's'),
      ];
      final chiavi = await chiaviPerLEstensione(case_);
      expect(chiavi.keys, [
        'dm_0123456789abcdef',
      ], reason: 'senza chiave del filo non c\'e\' niente da lasciare');
      final voce = chiavi['dm_0123456789abcdef']!;
      expect(voce['n'], 'Casa');
      expect(voce['c'], 'casa-1');
      expect(voce['k'], hasLength(64));
      expect(voce['k'], isNot(filo));
      final attesa = await (await chiaveDellaSpinta(
        filo,
        'dm_0123456789abcdef',
      )).extractBytes();
      expect(
        voce['k'],
        attesa.map((b) => b.toRadixString(16).padLeft(2, '0')).join(),
      );
    },
  );
}
