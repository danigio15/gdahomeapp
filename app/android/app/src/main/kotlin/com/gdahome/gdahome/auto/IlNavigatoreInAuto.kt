/* Il navigatore in auto: gdanav davanti, e la casa a un tasto.
 *
 * Esiste **solo nella versione col navigatore** (`GDAHOME_NAVIGATORE=si`,
 * vedi `build.gradle.kts`): li' il servizio dell'auto e' questo, e l'app si
 * dichiara di navigazione. Nella gdahome di sempre il servizio resta
 * `GdahomeCarAppService`, di categoria IOT, e niente di questo file si
 * accende — il segnale e' `R.bool.navigatore_in_auto`, falso qui e vero solo
 * nelle risorse di quella versione.
 *
 * ── Un motore solo, per il telefono e per l'auto ────────────────────────
 *
 * Come fa l'app gdanav: il viaggio cominciato sul telefono si vede in auto, e
 * quello scelto in auto parla dal telefono. Due motori vorrebbero dire due
 * navigatori, due GPS e due voci. Quindi il motore dell'app lo tiene questo
 * oggetto, e `MainActivity` lo prende da qui invece di farsene uno suo; se la
 * macchina arriva prima del telefono, il motore parte qui, senza schermo.
 *
 * ── Chi accende gdanav ──────────────────────────────────────────────────
 *
 * Sul telefono gdanav si accende la prima volta che si apre la sezione. In
 * auto quella sezione nessuno la apre: lo chiede questo file, sul canale
 * `gdahome/navigatore`, appena si sale in macchina — e il Dart, se non e'
 * ancora pronto a sentirlo, lo domanda da se' appena parte (`comeSta`).
 */
package com.gdahome.gdahome.auto

import android.content.Context
import android.content.pm.ApplicationInfo
import androidx.car.app.CarAppService
import androidx.car.app.Session
import androidx.car.app.SessionInfo
import androidx.car.app.validation.HostValidator
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.gdahome.gdahome.R
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.FlutterEngineCache
import io.flutter.embedding.engine.dart.DartExecutor
import io.flutter.plugin.common.MethodChannel
import it.gdanav.gdanav_app.auto.GdanavInAuto
import it.gdanav.gdanav_app.auto.PonteAuto
import it.gdanav.gdanav_app.auto.SessioneGdanav

object IlNavigatoreInAuto {
    private const val MOTORE = "gdahome"

    /* Se c'e' una sessione in auto adesso: il Dart lo chiede partendo. */
    @Volatile private var inAuto = false
    private var canale: MethodChannel? = null

    /** Se questa e' la versione col navigatore in auto. */
    fun acceso(context: Context): Boolean = context.resources.getBoolean(R.bool.navigatore_in_auto)

    /** Il motore dell'app, lo stesso per il telefono e per l'auto. */
    fun motore(context: Context): FlutterEngine {
        val cache = FlutterEngineCache.getInstance()
        cache.get(MOTORE)?.let { return it }
        val motore = FlutterEngine(context.applicationContext)
        collega(motore, context)
        motore.dartExecutor.executeDartEntrypoint(DartExecutor.DartEntrypoint.createDefault())
        cache.put(MOTORE, motore)
        return motore
    }

    /** I due fili col Dart: lo schermo dell'auto di gdanav, e il nostro. */
    fun collega(motore: FlutterEngine, context: Context) {
        val messaggi = motore.dartExecutor.binaryMessenger
        PonteAuto.collega(messaggi, context.applicationContext)
        canale = MethodChannel(messaggi, "gdahome/navigatore").also {
            it.setMethodCallHandler { chiamata, risposta ->
                when (chiamata.method) {
                    "comeSta" -> risposta.success(mapOf("inAuto" to inAuto))
                    else -> risposta.notImplemented()
                }
            }
        }
    }

    /** Si e' saliti in macchina: il motore c'e', e gdanav si accende. */
    fun salito(context: Context) {
        inAuto = true
        motore(context)
        canale?.invokeMethod("accendi", null)
    }

    fun sceso() {
        inAuto = false
    }
}

/**
 * Il servizio dell'auto della versione col navigatore: gdanav davanti, con un
 * tasto per la casa di gdahome (gli stessi schermi di `GdahomeCarAppService`).
 */
class NavigatoreCarAppService : CarAppService() {
    override fun createHostValidator(): HostValidator =
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            HostValidator.ALLOW_ALL_HOSTS_VALIDATOR
        } else {
            HostValidator.Builder(applicationContext)
                .addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample)
                .build()
        }

    override fun onCreate() {
        super.onCreate()
        GdanavInAuto.casa = { LaCasaInAuto(it) }
    }

    override fun onCreateSession(sessionInfo: SessionInfo): Session = SessioneNavigatore()
}

class SessioneNavigatore : SessioneGdanav({ IlNavigatoreInAuto.salito(it) }) {
    /* Come `SessioneInAuto`: finita la sessione, il motore dei comandi della
     * casa non serve piu'. Quello dell'app no — e' anche del telefono. */
    init {
        lifecycle.addObserver(
            object : LifecycleEventObserver {
                override fun onStateChanged(
                    source: LifecycleOwner,
                    event: Lifecycle.Event,
                ) {
                    if (event == Lifecycle.Event.ON_DESTROY) {
                        IlPonteDellAuto.spegni()
                        IlNavigatoreInAuto.sceso()
                    }
                }
            }
        )
    }
}
