/* Il navigatore in auto: gdanav davanti, e la casa a un tasto.
 *
 * E' la gdahome che si pubblica (vedi `colNavigatore` in `build.gradle.kts`):
 * il servizio dell'auto e' questo, e l'app si dichiara di navigazione. Solo
 * costruendo con `GDAHOME_NAVIGATORE=no` — e nei pacchetti di debug — il
 * servizio resta `GdahomeCarAppService`, di categoria IOT, e niente di questo
 * file si accende: il segnale e' `R.bool.navigatore_in_auto`, falso nelle
 * risorse di sempre e vero in quelle di `src/navigatore`.
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
import android.location.Location
import android.os.Handler
import android.os.Looper
import androidx.car.app.AppManager
import androidx.car.app.CarAppService
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Session
import androidx.car.app.SessionInfo
import androidx.car.app.model.Action
import androidx.car.app.model.Alert
import androidx.car.app.model.CarText
import androidx.car.app.validation.HostValidator
import androidx.car.app.versioning.CarAppApiLevels
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
        /* Il tasto con la casa, sulla mappa: i comandi rapidi scelti sul
         * telefono. Dietro, i dispositivi di sempre. */
        GdanavInAuto.casa = { IComandiInAuto(it) }
    }

    override fun onCreateSession(sessionInfo: SessionInfo): Session = SessioneNavigatore()
}

class SessioneNavigatore : SessioneGdanav({ IlNavigatoreInAuto.salito(it) }) {
    private val arrivo = ArrivoACasa { carContext }

    /* Come `SessioneInAuto`: finita la sessione, il motore dei comandi della
     * casa non serve piu'. Quello dell'app no — e' anche del telefono. */
    init {
        lifecycle.addObserver(
            object : LifecycleEventObserver {
                override fun onStateChanged(
                    source: LifecycleOwner,
                    event: Lifecycle.Event,
                ) {
                    when (event) {
                        Lifecycle.Event.ON_START -> arrivo.guarda()
                        Lifecycle.Event.ON_DESTROY -> {
                            arrivo.smetti()
                            IlPonteDellAuto.spegni()
                            IlNavigatoreInAuto.sceso()
                        }
                        else -> {}
                    }
                }
            }
        )
    }
}

/**
 * «Quasi a casa»: a qualche centinaio di metri da Casa — quanti lo si sceglie
 * sul telefono, 500 se non si e' scelto — lo schermo dell'auto propone il
 * comando scelto per l'arrivo (di solito il cancello).
 *
 * Dove si e' e dov'e' Casa li sa gdanav (`PonteAuto.qui`, `PonteAuto.casa()`).
 * Si propone solo **arrivando**: dopo essere stati piu' lontani (almeno un
 * chilometro, o il doppio della distanza scelta), e
 * una volta per arrivo. Partendo da casa, o girando nel quartiere, nessuno
 * vuole un avviso a ogni curva.
 */
class ArrivoACasa(private val auto: () -> CarContext) {
    private val orologio = Handler(Looper.getMainLooper())
    private var lontano = false
    private var attivo = false

    private val giro = object : Runnable {
        override fun run() {
            if (!attivo) return
            runCatching { controlla() }
            orologio.postDelayed(this, OGNI_MS)
        }
    }

    fun guarda() {
        if (attivo) return
        attivo = true
        orologio.post(giro)
    }

    fun smetti() {
        attivo = false
        orologio.removeCallbacks(giro)
    }

    private fun controlla() {
        val qui = PonteAuto.qui ?: return
        val casa = PonteAuto.casa() ?: return
        val metri = FloatArray(1)
        Location.distanceBetween(qui[0], qui[1], casa.lat, casa.lon, metri)
        val distanza = metri[0]
        val carContext = auto()
        val scelti = leggiIComandi(carContext)
        val vicino = scelti.metri
        if (distanza > maxOf(LONTANO_M, vicino * 2)) {
            lontano = true
            return
        }
        if (!lontano || distanza > vicino) return
        lontano = false
        val comando = scelti.arrivo ?: return
        proponi(carContext, comando)
    }

    private fun proponi(carContext: CarContext, comando: ComandoInAuto) {
        if (carContext.carAppApiLevel < CarAppApiLevels.LEVEL_5) {
            /* Un'auto vecchia non sa mostrare un avviso coi tasti: glielo si
             * dice, e il comando resta dietro il tasto con la casa. */
            CarToast.makeText(
                carContext,
                carContext.getString(R.string.auto_quasi_a_casa) + " · " + comando.nome,
                CarToast.LENGTH_LONG,
            ).show()
            return
        }
        val gestore = carContext.getCarService(AppManager::class.java)
        val avviso = Alert.Builder(
            ID_AVVISO,
            CarText.create(carContext.getString(R.string.auto_quasi_a_casa)),
            DURATA_MS,
        )
            .setSubtitle(CarText.create(comando.nome))
            .setIcon(ilSegno(carContext, comando.genere))
            .addAction(
                Action.Builder()
                    .setTitle(carContext.getString(R.string.auto_arrivo_fai))
                    .setOnClickListener {
                        premiEDillo(carContext, comando.id, comando.nome, true)
                        gestore.dismissAlert(ID_AVVISO)
                    }
                    .build(),
            )
            .addAction(
                Action.Builder()
                    .setTitle(carContext.getString(R.string.auto_arrivo_non_ora))
                    .setOnClickListener { gestore.dismissAlert(ID_AVVISO) }
                    .build(),
            )
            .build()
        gestore.showAlert(avviso)
    }

    companion object {
        private const val OGNI_MS = 5_000L
        private const val LONTANO_M = 1_000f
        private const val DURATA_MS = 15_000L
        private const val ID_AVVISO = 4_242
    }
}
