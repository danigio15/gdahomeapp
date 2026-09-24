/* La prima schermata: quanto sole c'e', e dove si va da qui.
 *
 * Un pannello e non una lista. Il modello `Pane` mette in alto due righe
 * grosse — quelle si leggono in un colpo d'occhio, ed e' l'unica cosa che ha
 * senso guardare da fermi a un semaforo — e sotto i tasti per le altre due
 * schermate. Una lista di dodici voci in auto e' una lista che si scorre, e
 * scorrere si fa da fermi.
 *
 * ── Quando la fotografia non c'e' o e' vecchia ──────────────────────────
 *
 * Si dice. Un cruscotto che mostra numeri di mezz'ora fa facendo credere che
 * siano adesso e' peggio di un cruscotto vuoto: chi guarda non ha modo di
 * accorgersene, e magari decide di non passare da casa. Senza fotografia si
 * scrive che l'app non ha ancora mandato niente; con una vecchia si scrive di
 * quando e'.
 */
package com.gdahome.gdahome.auto

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.CarIcon
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Pane
import androidx.car.app.model.PaneTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.core.graphics.drawable.IconCompat
import com.gdahome.gdahome.R
import java.util.concurrent.TimeUnit

class LaCasaInAuto(context: CarContext) : Screen(context) {

    override fun onGetTemplate(): Template {
        val foto = leggiLaFoto(carContext)
            ?: return nienteAncora()

        val pane = Pane.Builder()
        /* Il fotovoltaico: le righe che l'app ha mandato, al massimo tre. In
         * auto la quarta non si legge — si guarda, non si studia. */
        for (misura in foto.fotovoltaico.take(3)) {
            pane.addRow(
                Row.Builder()
                    .setTitle(misura.valore)
                    .addText(misura.nome)
                    .build(),
            )
        }
        if (foto.fotovoltaico.isEmpty()) {
            pane.addRow(
                Row.Builder()
                    .setTitle(carContext.getString(R.string.auto_senza_fotovoltaico))
                    .addText(carContext.getString(R.string.auto_senza_fotovoltaico_sotto))
                    .build(),
            )
        }

        /* Da quanto e' quella fotografia: sotto i numeri, sempre, anche quando
         * e' fresca. Un'ora scritta si controlla; una mancante si indovina. */
        pane.addRow(
            Row.Builder()
                .setTitle(quandoInParole(foto))
                .build(),
        )

        pane.addAction(
            Action.Builder()
                .setTitle(carContext.getString(R.string.auto_persone))
                .setOnClickListener { screenManager.push(LePersoneInAuto(carContext)) }
                .build(),
        )
        pane.addAction(
            Action.Builder()
                .setTitle(carContext.getString(R.string.auto_azioni))
                .setOnClickListener { screenManager.push(LeAzioniInAuto(carContext)) }
                .build(),
        )

        return PaneTemplate.Builder(pane.build())
            .setTitle(foto.casa.ifBlank { carContext.getString(R.string.auto_titolo) })
            .setHeaderAction(Action.APP_ICON)
            .build()
    }

    private fun nienteAncora(): Template =
        MessageTemplate.Builder(carContext.getString(R.string.auto_senza_foto))
            .setTitle(carContext.getString(R.string.auto_titolo))
            .setIcon(CarIcon.Builder(IconCompat.createWithResource(carContext, R.mipmap.ic_launcher)).build())
            .setHeaderAction(Action.APP_ICON)
            .build()

    private fun quandoInParole(foto: FotoDellaCasa): String {
        val adesso = System.currentTimeMillis()
        if (!foto.vecchia(adesso)) return carContext.getString(R.string.auto_adesso)
        if (foto.quando <= 0L) return carContext.getString(R.string.auto_non_si_sa_quando)
        val minuti = TimeUnit.MILLISECONDS.toMinutes(adesso - foto.quando)
        val ore = TimeUnit.MILLISECONDS.toHours(adesso - foto.quando)
        return if (ore >= 1L) {
            carContext.getString(R.string.auto_da_ore, ore)
        } else {
            carContext.getString(R.string.auto_da_minuti, minuti)
        }
    }
}
