/* gdahome in auto: il servizio, e nient'altro.
 *
 * In auto non si disegna. Android Auto non mostra la nostra plancia — niente
 * WebView, niente Flutter, niente foglio di stile: mostra i suoi modelli, che
 * sono liste, pannelli e griglie, e li disegna lui col carattere e i colori
 * della macchina. E' una limitazione voluta e ci sta: quello che si guarda
 * mentre si guida deve essere leggibile in un colpo d'occhio, e la nostra
 * plancia non lo e'.
 *
 * Quindi qui non c'e' la plancia: c'e' il poco che serve in macchina — quanto
 * sole c'e' adesso, chi e' in casa, e i quattro tasti che uno tocca davvero
 * guidando. Il resto resta sul telefono, dov'e' sempre stato.
 *
 * ── Perche' IOT e non un'altra categoria ────────────────────────────────
 *
 * Perche' e' quello che e'. La categoria `androidx.car.app.category.IOT` esiste
 * apposta per le app che comandano le cose di casa, e dichiararne un'altra per
 * far entrare l'app dove non entrerebbe vorrebbe dire una revisione passata
 * dicendo una cosa falsa — e un account con cui si pubblica messo in gioco per
 * tre tasti.
 */
package com.gdahome.gdahome.auto

import androidx.car.app.CarAppService
import androidx.car.app.Session
import androidx.car.app.SessionInfo
import androidx.car.app.validation.HostValidator
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner

class GdahomeCarAppService : CarAppService() {
    /* Chi puo' collegarsi: in sviluppo tutti, in produzione solo gli ospiti
     * che Android riconosce. La lista la tiene la libreria, e allargarla a
     * mano vorrebbe dire far parlare la nostra app con un ospite che nessuno
     * ha verificato. */
    override fun createHostValidator(): HostValidator =
        if (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            HostValidator.ALLOW_ALL_HOSTS_VALIDATOR
        } else {
            HostValidator.Builder(applicationContext)
                .addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample)
                .build()
        }

    override fun onCreateSession(sessionInfo: SessionInfo): Session = SessioneInAuto()
}

class SessioneInAuto : Session() {
    /* Finita la sessione — si spegne la macchina, si stacca il cavo — il
     * motore Dart non serve piu'. Lasciarlo acceso vorrebbe dire un pezzo di
     * app in piedi in tasca per niente, e la batteria la paga chi guida.
     *
     * Ci si mette **in ascolto**, e non si sovrascrive niente: una `Session`
     * non e' un osservatore del proprio ciclo di vita, e' il suo padrone —
     * `LifecycleOwner` — e un `onDestroy` da sovrascrivere non ce l'ha. La
     * prima stesura di questo file lo dava per scontato, e la costruzione
     * dell'APK si e' fermata proprio qui: «'onDestroy' overrides nothing».
     * Da questa parte il Kotlin non lo compila nessuno — l'SDK di Android in
     * macchina non c'e' — quindi adesso a costruirlo sono le Prove, a ogni
     * spinta, e un errore come quello si vede prima di un rilascio e non
     * dentro. */
    init {
        lifecycle.addObserver(
            object : LifecycleEventObserver {
                override fun onStateChanged(
                    source: LifecycleOwner,
                    event: Lifecycle.Event,
                ) {
                    if (event == Lifecycle.Event.ON_DESTROY) {
                        IlPonteDellAuto.spegni()
                    }
                }
            }
        )
    }

    override fun onCreateScreen(intent: android.content.Intent) = LaCasaInAuto(carContext)
}
