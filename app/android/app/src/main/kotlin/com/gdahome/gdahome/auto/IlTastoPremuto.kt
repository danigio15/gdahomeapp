/* Premere qualcosa dall'auto, e dire cosa succede davvero.
 *
 * Lo fanno in due — la griglia dei dispositivi e quella delle azioni rapide —
 * e lo devono fare uguale: il comando si lascia scritto, si sveglia l'app, e
 * il tasto dice la verita' su quando parte. Scritto due volte, prima o poi una
 * delle due promette una cosa che l'altra non fa.
 *
 * «E' partito» detto su una cosa che parte fra mezz'ora e' la bugia peggiore
 * che possa dire un cruscotto: chi guida non ha modo di accorgersene, e magari
 * decide di non tornare indietro a chiudere il cancello.
 */
package com.gdahome.gdahome.auto

import androidx.car.app.CarContext
import androidx.car.app.CarToast
import com.gdahome.gdahome.R

/**
 * Lascia scritto il comando, sveglia l'app, e mostra cosa aspettarsi.
 *
 * [subito] dice se quella cosa parte da sola anche con l'app chiusa e lo
 * schermo spento. Per i dispositivi e' sempre vero — la plancia manda solo
 * quelli che si commutano al buio — per le azioni rapide dipende, e lo dice la
 * fotografia.
 */
fun premiEDillo(carContext: CarContext, id: String, nome: String, subito: Boolean) {
    val scritto = lasciaIlComando(carContext, id)
    /* Scritto il comando, si sveglia l'app: un motore Dart senza schermo, che
     * lo esegue subito. Il telefono resta spento e in mano non compare niente
     * — vedi `IlPonteDellAuto`. */
    if (scritto) IlPonteDellAuto.sveglia(carContext)
    val parole = when {
        !scritto -> R.string.auto_comando_non_parte
        subito -> R.string.auto_comando_fatto
        else -> R.string.auto_comando_partito
    }
    CarToast.makeText(carContext, carContext.getString(parole, nome), CarToast.LENGTH_LONG).show()
}
