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
    override fun onCreateScreen(intent: android.content.Intent) = LaCasaInAuto(carContext)
}
