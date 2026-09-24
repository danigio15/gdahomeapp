/* Il ponte che fa partire un comando a schermo spento.
 *
 * ── Il buco che questo file chiude ──────────────────────────────────────
 *
 * Android Auto tiene su il PROCESSO dell'app — questo servizio gira li' dentro
 * — ma non la parte Flutter: con l'app chiusa il comando lasciato scritto in
 * macchina restava li' e scadeva, e chi aveva premuto «Cancello» guidando
 * doveva poi prendere il telefono e aprire gdahome. Che e' esattamente quello
 * che in macchina non si vuole fare.
 *
 * Qui si accende un motore Flutter SENZA SCHERMO su un secondo ingresso —
 * `inAuto`, in `lib/main.dart` — e quello esegue. Il filo con la casa resta
 * uno solo, ed e' quello di Dart: questo file con la casa non parla, e non ha
 * di che. La regola di sempre — un posto solo che sa entrare in casa — vale
 * anche qui, e anzi e' la ragione per cui si accende un motore invece di
 * riscrivere la stretta di mano in Kotlin.
 *
 * ── Perche' un motore che resta acceso ──────────────────────────────────
 *
 * Accenderne uno per ogni tasto premuto vorrebbe dire far ripartire tutto — la
 * macchina virtuale, i plugin, la cassaforte — per un `call_service`: qualche
 * secondo buono, e in macchina si premono due tasti di fila. Uno solo, acceso
 * alla prima pressione e spento quando Android Auto se ne va, li esegue tutti.
 *
 * Il motore non ha finestre: non compare niente sul telefono, lo schermo resta
 * spento, e chi e' alla guida non si trova l'app aperta in mano all'arrivo.
 */
package com.gdahome.gdahome.auto

import android.content.Context
import io.flutter.FlutterInjector
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.dart.DartExecutor
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugins.GeneratedPluginRegistrant

/* Il nome della funzione Dart da cui si parte. Sta in `lib/main.dart` perche'
 * e' li' che Flutter la cerca quando gliene si passa solo il nome, ed e' una
 * riga sola che chiama `auto/in_auto.dart`. I due nomi devono restare la
 * stessa cosa: sbagliarli non da' nessun errore qui, da' un motore che parte e
 * non fa niente. */
private const val DA_DOVE_SI_PARTE = "inAuto"

object IlPonteDellAuto {
    private var motore: FlutterEngine? = null

    /**
     * Fa eseguire all'app il comando appena lasciato scritto.
     *
     * Non torna niente e non aspetta: quello che succede dall'altra parte lo
     * sa Dart, e in macchina non c'e' niente da mostrare comunque — il tasto
     * ha gia' detto quello che poteva dire. Se qualcosa non va, il comando
     * resta quello che era prima di questo file: parte quando l'app si apre,
     * o scade.
     */
    @Synchronized
    fun sveglia(context: Context) {
        runCatching {
            val gia = motore
            if (gia != null) {
                /* Il motore c'e' gia' e sta li' ad aspettare: gli si dice di
                 * guardare, e ritrova il file appena scritto. */
                MethodChannel(gia.dartExecutor.binaryMessenger, CANALE)
                    .invokeMethod(GUARDA, null)
                return
            }
            val nuovo = FlutterEngine(context.applicationContext)
            /* I plugin vanno registrati a mano: un motore fatto cosi' non li
             * ha. Senza, la cassaforte e la cartella dei file non rispondono —
             * e senza cassaforte non c'e' nessuna casa da aprire. */
            GeneratedPluginRegistrant.registerWith(nuovo)
            nuovo.dartExecutor.executeDartEntrypoint(
                DartExecutor.DartEntrypoint(
                    FlutterInjector.instance().flutterLoader().findAppBundlePath(),
                    DA_DOVE_SI_PARTE,
                ),
            )
            motore = nuovo
        }
    }

    /** Spegne il motore. Lo chiama la sessione dell'auto quando finisce. */
    @Synchronized
    fun spegni() {
        runCatching { motore?.destroy() }
        motore = null
    }

    /* Il canale su cui si dice «guarda di nuovo», e nient'altro: il comando
     * sta gia' nel file, e mandarlo anche di qui vorrebbe dire due strade per
     * la stessa cosa — il giorno che si scostano si esegue quello vecchio.
     *
     * Se il messaggio si perde — il motore acceso un istante fa, che il suo
     * ascoltatore non l'ha ancora messo — non si perde il comando: il file lo
     * toglie solo chi lo legge, quindi resta li' per la pressione dopo o per
     * l'app che si apre. */
    private const val CANALE = "gdahome/auto/guarda"
    private const val GUARDA = "guarda"
}
