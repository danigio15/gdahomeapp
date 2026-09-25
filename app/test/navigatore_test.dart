/// Le prove del navigatore: gdanav dentro l'app.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/navigatore_qui/qui.dart';
import 'package:gdanav_app/gdanav_app.dart';

void main() {
  /* Chi usa gdahome solo per la casa non deve accendere gdanav: niente GPS,
   * niente colonnine, niente portachiavi di gdanav. La sezione sta nella
   * fila delle sezioni fin dall'avvio, ma finche' non la si apre non fa
   * niente. */
  testWidgets('finche\' non si apre, gdanav resta spento', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: IlNavigatore(
          visibile: false,
          navigatore: GlobalKey<NavigatorState>(),
        ),
      ),
    );
    expect(find.byType(GdanavDentro), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
