import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/la_finestra.dart';
import 'package:gdahome/casa/lo_schermo.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'il pannello a muro nasconde le barre, e di notte abbassa la luce',
    () async {
      final finestra = <MethodCall>[];
      final sistema = <MethodCall>[];
      final messaggero =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messaggero.setMockMethodCallHandler(canaleDellaFinestra, (c) async {
        finestra.add(c);
        return null;
      });
      messaggero.setMockMethodCallHandler(SystemChannels.platform, (c) async {
        sistema.add(c);
        return null;
      });

      await loSchermoDice('muro:si');
      await loSchermoDice('muro:si');
      expect(
        sistema
            .where((c) => c.method == 'SystemChrome.setEnabledSystemUIMode')
            .length,
        1,
        reason: 'solo quando cambia',
      );
      expect(sistema.last.arguments, 'SystemUiMode.immersiveSticky');

      await loSchermoDice('spento:si');
      expect(finestra.single.method, 'luminosita');
      expect(finestra.single.arguments, 0.0);

      /* Spento il pannello, la luce torna quella del sistema. */
      await loSchermoDice('muro:no');
      expect(sistema.last.arguments, 'SystemUiMode.edgeToEdge');
      expect(finestra.last.arguments, -1.0);
    },
  );
}
