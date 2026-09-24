/* Le azioni rapide: una griglia di sei, e non una di piu'.
 *
 * Sono i tasti che uno tocca davvero guidando — il cancello, il portone, «sto
 * arrivando» — e in auto vanno grossi e pochi. La griglia ne mostra sei per
 * schermata: la settima vorrebbe dire scorrere, e scorrere si fa da fermi.
 *
 * ── Un tasto che non fa niente non ci va ────────────────────────────────
 *
 * Finche' l'app non e' in linea il comando non puo' partire, e la griglia lo
 * dice invece di far finta. Il comando si lascia scritto: quando l'app torna
 * viva lo esegue lei, che e' l'unica che sa parlare con la casa. Premere e non
 * sapere se e' successo qualcosa e' il modo peggiore di comandare un cancello.
 */
package com.gdahome.gdahome.auto

import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.CarIcon
import androidx.car.app.model.GridItem
import androidx.car.app.model.GridTemplate
import androidx.car.app.model.ItemList
import androidx.car.app.model.Template
import androidx.core.graphics.drawable.IconCompat
import com.gdahome.gdahome.R

class LeAzioniInAuto(context: CarContext) : Screen(context) {
    override fun onGetTemplate(): Template {
        val azioni = leggiLaFoto(carContext)?.azioni.orEmpty()
        val elenco = ItemList.Builder()
        if (azioni.isEmpty()) {
            elenco.setNoItemsMessage(carContext.getString(R.string.auto_senza_azioni))
        }
        for (azione in azioni) {
            elenco.addItem(
                GridItem.Builder()
                    .setTitle(azione.nome)
                    .setImage(
                        CarIcon.Builder(
                            IconCompat.createWithResource(carContext, R.mipmap.ic_launcher),
                        ).build(),
                    )
                    .setOnClickListener { chiedi(azione) }
                    .build(),
            )
        }
        return GridTemplate.Builder()
            .setSingleList(elenco.build())
            .setTitle(carContext.getString(R.string.auto_azioni))
            .setHeaderAction(Action.BACK)
            .build()
    }

    private fun chiedi(azione: Azione) {
        val scritto = lasciaIlComando(carContext, azione.id)
        /* Scritto il comando, si sveglia l'app: un motore Dart senza schermo,
         * che lo esegue subito. Il telefono resta spento e in mano non compare
         * niente — vedi `IlPonteDellAuto`. */
        if (scritto) IlPonteDellAuto.sveglia(carContext)
        /* E il tasto dice quello che succede davvero, che non e' lo stesso per
         * tutte: una con una conferma da mostrare, o un menu da far scegliere,
         * qualcuno che guardi ce lo vuole, e quella aspetta l'app. «E' partito»
         * detto su una cosa che parte fra mezz'ora e' la bugia peggiore che
         * possa dire un cruscotto. */
        val parole = when {
            !scritto -> R.string.auto_comando_non_parte
            azione.subito -> R.string.auto_comando_fatto
            else -> R.string.auto_comando_partito
        }
        CarToast.makeText(
            carContext,
            carContext.getString(parole, azione.nome),
            CarToast.LENGTH_LONG,
        ).show()
    }
}
