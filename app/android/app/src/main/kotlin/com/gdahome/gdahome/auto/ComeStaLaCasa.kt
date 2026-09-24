/* Come sta la casa: il sole, e chi c'e'.
 *
 * Erano le prime due schermate, ed erano la ragione per cui questa app non
 * passava per quello che dice di essere. La categoria e' `IOT`: quello che ci
 * si aspetta aprendola in macchina sono i dispositivi di casa, non un
 * cruscotto dell'energia. Adesso stanno qui, dietro un tasto, dove servono a
 * chi le vuole senza dire che l'app e' quella roba li'.
 *
 * Due schermate diventate una. Erano poche righe in tutte e due — tre numeri
 * di qua, quattro nomi di la' — e tenerle separate voleva dire due tocchi per
 * leggere sei righe. In macchina i tocchi si contano.
 *
 * ── Quando la fotografia e' vecchia ─────────────────────────────────────
 *
 * Si dice, e sta in cima perche' vale per tutto quello che c'e' sotto. Numeri
 * di mezz'ora fa spacciati per adesso sono peggio di nessun numero: chi guarda
 * non ha modo di accorgersene, e magari decide di non passare da casa.
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
import java.util.concurrent.TimeUnit

/* Quante righe si mostrano guidando. Sei: e' quello che l'ospite lascia
 * scorrere in macchina, e una settima non la vedrebbe nessuno. Si tagliano le
 * ultime, non le prime: in cima c'e' da quando e' la fotografia, che qualifica
 * tutto il resto. */
private const val RIGHE_AL_MASSIMO = 6

class ComeStaLaCasa(context: CarContext) : Screen(context) {

    override fun onGetTemplate(): Template {
        val foto = leggiLaFoto(carContext)
        val elenco = ItemList.Builder()
        val righe = mutableListOf<Row>()

        if (foto != null) {
            righe.add(Row.Builder().setTitle(quandoInParole(foto)).build())
            for (misura in foto.fotovoltaico) {
                righe.add(Row.Builder().setTitle(misura.valore).addText(misura.nome).build())
            }
            for (persona in foto.persone) {
                righe.add(
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
        }

        if (righe.isEmpty()) {
            elenco.setNoItemsMessage(
                carContext.getString(
                    if (foto == null) R.string.auto_senza_foto
                    else R.string.auto_senza_niente_da_dire,
                ),
            )
        }
        for (riga in righe.take(RIGHE_AL_MASSIMO)) elenco.addItem(riga)

        return ListTemplate.Builder()
            .setSingleList(elenco.build())
            .setTitle(carContext.getString(R.string.auto_come_sta))
            .setHeaderAction(Action.BACK)
            .build()
    }

    private fun quandoInParole(foto: FotoDellaCasa): String {
        val adesso = System.currentTimeMillis()
        if (!foto.vecchia(adesso)) return carContext.getString(R.string.auto_adesso)
        if (foto.quando <= 0L) return carContext.getString(R.string.auto_non_si_sa_quando)
        val ore = TimeUnit.MILLISECONDS.toHours(adesso - foto.quando)
        return if (ore >= 1L) {
            carContext.getString(R.string.auto_da_ore, ore)
        } else {
            carContext.getString(
                R.string.auto_da_minuti,
                TimeUnit.MILLISECONDS.toMinutes(adesso - foto.quando),
            )
        }
    }
}
