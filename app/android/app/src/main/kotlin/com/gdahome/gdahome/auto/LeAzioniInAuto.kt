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
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.CarColor
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
                    /* Il fulmine, non il logo dell'app. Un'azione rapida non
                     * e' un dispositivo e non deve sembrarlo — questa e'
                     * un'altra schermata — e sei volte lo stesso logo non
                     * distingueva niente da niente. La tinta la mette l'auto,
                     * secondo il tema di adesso. */
                    .setImage(
                        CarIcon.Builder(
                            IconCompat.createWithResource(carContext, R.drawable.auto_azione),
                        ).setTint(CarColor.DEFAULT).build(),
                    )
                    .setOnClickListener {
                        premiEDillo(carContext, azione.id, azione.nome, azione.subito)
                    }
                    .build(),
            )
        }
        return GridTemplate.Builder()
            .setSingleList(elenco.build())
            .setTitle(carContext.getString(R.string.auto_azioni))
            .setHeaderAction(Action.BACK)
            .build()
    }
}
