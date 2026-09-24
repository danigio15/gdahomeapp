/* Chi c'e' in casa: una lista, e basta.
 *
 * E' la domanda che uno si fa tornando — c'e' gia' qualcuno? — e la risposta
 * sta in due parole per riga. Niente da toccare: queste righe non comandano
 * niente, e una riga che sembra un tasto e non lo e' e' una riga che si preme
 * per sbaglio mentre si guida.
 */
package com.gdahome.gdahome.auto

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import com.gdahome.gdahome.R

class LePersoneInAuto(context: CarContext) : Screen(context) {
    override fun onGetTemplate(): Template {
        val persone = leggiLaFoto(carContext)?.persone.orEmpty()
        val elenco = ItemList.Builder()
        if (persone.isEmpty()) {
            elenco.setNoItemsMessage(carContext.getString(R.string.auto_senza_persone))
        }
        for (persona in persone) {
            elenco.addItem(
                Row.Builder()
                    .setTitle(persona.nome)
                    .addText(
                        carContext.getString(
                            if (persona.inCasa) R.string.auto_in_casa else R.string.auto_fuori,
                        ),
                    )
                    .build(),
            )
        }
        return ListTemplate.Builder()
            .setSingleList(elenco.build())
            .setTitle(carContext.getString(R.string.auto_persone))
            .setHeaderAction(Action.BACK)
            .build()
    }
}
