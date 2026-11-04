package com.gdahome.gdahome.salute

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.gdahome.gdahome.auto.IlNavigatoreInAuto
import io.flutter.FlutterInjector
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.FlutterEngineCache
import io.flutter.embedding.engine.dart.DartExecutor
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugins.GeneratedPluginRegistrant
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * La salute ad app chiusa, su Android (`lib/salute/ad_app_chiusa.dart`).
 *
 * Un giro di WorkManager ogni mezz'ora, solo con la rete: Android lo fa
 * partire anche ad app chiusa e dopo un riavvio, e lo rimanda da se' quando
 * il telefono dorme (Doze) o la batteria e' bassa. A ogni giro si sveglia il
 * Dart, che legge Health Connect e manda alla casa col filo di sempre; il
 * quarto d'ora fra un invio e l'altro lo tiene lui.
 *
 * Il Dart che risponde e':
 * - quello dell'app, se e' acceso (la versione col navigatore in auto lo
 *   tiene nella cache);
 * - altrimenti un motore senza schermo acceso apposta, che parte da
 *   `saluteAdAppChiusa` in `lib/main.dart` e si spegne finito il giro.
 *
 * I due capi parlano sul canale [CANALE] con quattro parole: dal Dart
 * «pronto», «osserva» (accendi il giro) e «spegni»; da qui «sveglia».
 */
class LaSaluteAdAppChiusa(
    context: Context,
    parametri: WorkerParameters,
) : CoroutineWorker(context, parametri) {
    override suspend fun doWork(): Result {
        /* Com'e' andata non cambia niente qui: il giro torna fra mezz'ora
         * comunque. Un «riprova» di WorkManager vorrebbe dire svegliare il
         * telefono di nuovo subito, per una casa che magari e' spenta. */
        withTimeoutOrNull(QUANTO_DURA_UN_GIRO) { sveglia(applicationContext) }
        return Result.success()
    }

    companion object {
        /** Lo stesso nome di `canaleDellaSveglia` in `ad_app_chiusa.dart`. */
        const val CANALE = "gdahome/salute/sveglia"

        private const val LAVORO = "gdahome-salute-ad-app-chiusa"
        private const val DA_DOVE_SI_PARTE = "saluteAdAppChiusa"
        private const val QUANTO_ASPETTA_IL_DART = 20_000L
        private const val QUANTO_ASPETTA_LA_CASA = 45_000L
        private const val QUANTO_DURA_UN_GIRO = 90_000L

        /** Il canale su un motore dell'app: il Dart accende e spegne il giro. */
        fun collega(
            messaggi: BinaryMessenger,
            context: Context,
        ) {
            val app = context.applicationContext
            MethodChannel(messaggi, CANALE).setMethodCallHandler { chiamata, risposta ->
                when (chiamata.method) {
                    "osserva" -> {
                        programma(app)
                        risposta.success(null)
                    }
                    "spegni" -> {
                        ferma(app)
                        risposta.success(null)
                    }
                    "pronto" -> risposta.success(null)
                    else -> risposta.notImplemented()
                }
            }
        }

        /* KEEP: un giro gia' in programma resta com'e'. Riprogrammarlo a ogni
         * apertura dell'app vorrebbe dire rimandarlo ogni volta di mezz'ora. */
        private fun programma(context: Context) {
            runCatching {
                val vincoli =
                    Constraints
                        .Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                val lavoro =
                    PeriodicWorkRequestBuilder<LaSaluteAdAppChiusa>(30, TimeUnit.MINUTES)
                        .setConstraints(vincoli)
                        .build()
                WorkManager
                    .getInstance(context)
                    .enqueueUniquePeriodicWork(LAVORO, ExistingPeriodicWorkPolicy.KEEP, lavoro)
            }
        }

        private fun ferma(context: Context) {
            runCatching { WorkManager.getInstance(context).cancelUniqueWork(LAVORO) }
        }

        private suspend fun sveglia(context: Context): String? =
            withContext(Dispatchers.Main) {
                val dellApp = FlutterEngineCache.getInstance().get(IlNavigatoreInAuto.MOTORE)
                if (dellApp != null) {
                    return@withContext withTimeoutOrNull(QUANTO_ASPETTA_LA_CASA) {
                        chiama(MethodChannel(dellApp.dartExecutor.binaryMessenger, CANALE))
                    }
                }
                senzaSchermo(context)
            }

        /* Un motore apposta, senza schermo. I plugin si registrano a mano,
         * come in `IlPonteDellAuto`: senza, la cassaforte e Health Connect
         * non risponderebbero. Si spegne sempre, anche se qualcosa va storto:
         * un motore dimenticato acceso e' memoria e batteria. */
        private suspend fun senzaSchermo(context: Context): String? {
            val app = context.applicationContext
            val motore = FlutterEngine(app, null, false)
            try {
                GeneratedPluginRegistrant.registerWith(motore)
                val pronto = CompletableDeferred<Unit>()
                val canale = MethodChannel(motore.dartExecutor.binaryMessenger, CANALE)
                canale.setMethodCallHandler { chiamata, risposta ->
                    when (chiamata.method) {
                        "pronto" -> {
                            pronto.complete(Unit)
                            risposta.success(null)
                        }
                        "osserva" -> {
                            programma(app)
                            risposta.success(null)
                        }
                        "spegni" -> {
                            ferma(app)
                            risposta.success(null)
                        }
                        else -> risposta.notImplemented()
                    }
                }
                motore.dartExecutor.executeDartEntrypoint(
                    DartExecutor.DartEntrypoint(
                        FlutterInjector.instance().flutterLoader().findAppBundlePath(),
                        DA_DOVE_SI_PARTE,
                    ),
                )
                withTimeoutOrNull(QUANTO_ASPETTA_IL_DART) { pronto.await() } ?: return null
                return withTimeoutOrNull(QUANTO_ASPETTA_LA_CASA) { chiama(canale) }
            } finally {
                runCatching { motore.destroy() }
            }
        }

        /* «Sveglia», e la risposta del Dart: com'e' andata, in una parola. Su
         * Android la salute si legge anche a telefono bloccato (dopo il primo
         * sblocco): «leggibile» e' sempre si'. */
        private suspend fun chiama(canale: MethodChannel): String? =
            suspendCancellableCoroutine { seguito ->
                canale.invokeMethod(
                    "sveglia",
                    mapOf("leggibile" to true),
                    object : MethodChannel.Result {
                        override fun success(risultato: Any?) {
                            if (seguito.isActive) seguito.resume(risultato as? String)
                        }

                        override fun error(
                            codice: String,
                            messaggio: String?,
                            dettagli: Any?,
                        ) {
                            if (seguito.isActive) seguito.resume(null)
                        }

                        override fun notImplemented() {
                            if (seguito.isActive) seguito.resume(null)
                        }
                    },
                )
            }
    }
}
