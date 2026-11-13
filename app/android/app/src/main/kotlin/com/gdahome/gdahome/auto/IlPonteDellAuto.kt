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
import com.gdahome.gdahome.orologio.IlTramiteDellOrologio
import io.flutter.FlutterInjector
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.FlutterEngineCache
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
    fun sveglia(context: Context, guardaLoStato: Boolean = false, finito: ((String?) -> Unit)? = null) {
        /* Com'e' finita lo dice il Dart, al colpetto (`in_auto.dart`): chi lo
         * vuole sapere — l'orologio, che lo scrive al polso — passa [finito].
         * Si chiama una volta sola, anche se qualcosa va storto. */
        var detto = false
        val unaVolta: (String?) -> Unit = { com ->
            if (!detto) {
                detto = true
                finito?.invoke(com)
            }
        }
        /* «Com'e' la casa adesso», per l'orologio (`guardaLaCasaPerIlPolso` in
         * `in_auto.dart`): lo stesso colpetto, con [STATO] accanto. Senza, il
         * Dart esegue il comando lasciato scritto. */
        val parola: String? = if (guardaLoStato) STATO else null
        val risposta = object : MethodChannel.Result {
            override fun success(result: Any?) = unaVolta(result as? String)

            override fun error(errorCode: String, errorMessage: String?, errorDetails: Any?) = unaVolta(null)

            override fun notImplemented() = unaVolta(null)
        }
        val andata = runCatching {
            /* Il motore dell'app, se e' acceso: nella versione col navigatore
             * in auto lo e' da quando si e' saliti (`IlNavigatoreInAuto`), e
             * ha gia' il filo con la casa aperto. Accenderne un secondo voleva
             * dire rifare tutto da capo — la casa, la stretta di mano, il
             * centralino — e, se non bastavano dodici secondi, il comando si
             * perdeva in silenzio dopo che l'auto aveva gia' detto «fatto».
             * Se il messaggio arriva prima che il Dart lo ascolti, il comando
             * resta nel file e lo esegue lui appena parte. */
            val dellApp = FlutterEngineCache.getInstance().get(IlNavigatoreInAuto.MOTORE)
            if (dellApp != null) {
                MethodChannel(dellApp.dartExecutor.binaryMessenger, CANALE)
                    .invokeMethod(GUARDA, parola, risposta)
                return
            }
            val gia = motore
            if (gia != null) {
                /* Il motore c'e' gia' e sta li' ad aspettare: gli si dice di
                 * guardare, e ritrova il file appena scritto. */
                MethodChannel(gia.dartExecutor.binaryMessenger, CANALE)
                    .invokeMethod(GUARDA, parola, risposta)
                return
            }
            val nuovo = FlutterEngine(context.applicationContext)
            /* Il motore appena acceso esegue da se' il comando che trova, e
             * poi dice com'e' finita con `finito` (`inAuto` in `in_auto.dart`). */
            val canale = MethodChannel(nuovo.dartExecutor.binaryMessenger, CANALE)
            canale.setMethodCallHandler { call, result ->
                if (call.method == FINITO) {
                    /* Chi voleva lo stato della casa lo chiede adesso, che il
                     * Dart ascolta: all'avvio ha eseguito solo il comando
                     * lasciato, se c'era. */
                    if (guardaLoStato) canale.invokeMethod(GUARDA, STATO, risposta)
                    else unaVolta(call.arguments as? String)
                }
                result.success(null)
            }
            /* L'orologio. Dopo un comando il Dart corregge la fotografia — la
             * luce che era spenta adesso e' accesa — e lo dice sul canale
             * `gdahome/orologio` (`lib/auto/sul_telefono.dart`), perche' il
             * telefono la porti al polso. Questo motore quel canale non
             * l'aveva: ad app chiusa la fotografia si correggeva sul disco e
             * al polso non arrivava mai — «accende le luci ma non cambia
             * stato», dal Wear OS. Il motore dell'app ce l'ha da sempre
             * (`MainActivity`, `IlNavigatoreInAuto`). */
            IlTramiteDellOrologio.collega(nuovo.dartExecutor.binaryMessenger, context.applicationContext)
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
        if (andata.isFailure) unaVolta(null)
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
    private const val FINITO = "finito"
    private const val STATO = "stato"
}
