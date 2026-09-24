/* La prima schermata: i dispositivi di casa, e un tocco per girarli.
 *
 * ── Perche' proprio questa, e per prima ─────────────────────────────────
 *
 * La categoria dichiarata e' `IOT`, e le due cose che Google mette davanti a
 * tutte fra quelle che un'app cosi' puo' fare guidando sono vedere com'e'
 * messo un dispositivo e accenderlo o spegnerlo con un tocco. Qui prima
 * c'erano tre numeri del fotovoltaico e i tasti per altre due schermate:
 * informazioni sulla casa, non dispositivi da guardare e da premere. Erano
 * anche quello che la revisione dell'auto guardava per prima, e non trovava.
 *
 * Una griglia e non una lista, e sei tessere: in macchina il segno grosso si
 * riconosce di sfuggita, la riga di testo no. Quali sei le ha gia' scelte la
 * plancia — davanti le porte e i varchi, che sono quello che si preme
 * arrivando, dietro le luci e le prese rimaste accese — e qui non si riordina
 * niente: chi decide cosa conta e' chi conosce la casa.
 *
 * ── Il segno dice cos'e', non chi l'ha fatto ────────────────────────────
 *
 * Prima ogni tessera portava l'icona dell'app, sei volte la stessa: non
 * distingueva il cancello dalla luce del salone, ed era proprio quello che
 * `IU-1` non vuole vedere. Adesso ogni genere ha il suo disegno, bianco e
 * pieno, e la tinta la mette l'ospite secondo il tema chiaro o scuro
 * dell'auto.
 *
 * ── Il sole e chi c'e' in casa ──────────────────────────────────────────
 *
 * Non spariscono: si spostano dietro il tasto «Casa», in alto. Non sono
 * dispositivi, e tenerle come prime schermate voleva dire un'app che si
 * dichiara IOT e poi mostra un cruscotto dell'energia — cioe' quello che
 * `PC-1` chiama una funzione fuori dal tipo dichiarato.
 */
package com.gdahome.gdahome.auto

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarColor
import androidx.car.app.model.CarIcon
import androidx.car.app.model.GridItem
import androidx.car.app.model.GridTemplate
import androidx.car.app.model.ItemList
import androidx.car.app.model.Template
import androidx.core.graphics.drawable.IconCompat
import com.gdahome.gdahome.R

class LaCasaInAuto(context: CarContext) : Screen(context) {

    override fun onGetTemplate(): Template {
        val foto = leggiLaFoto(carContext)
        val elenco = ItemList.Builder()
        val dispositivi = foto?.dispositivi.orEmpty()
        if (dispositivi.isEmpty()) {
            elenco.setNoItemsMessage(
                carContext.getString(
                    if (foto == null) R.string.auto_senza_foto else R.string.auto_senza_dispositivi,
                ),
            )
        }
        for (uno in dispositivi) {
            elenco.addItem(
                GridItem.Builder()
                    .setTitle(uno.nome)
                    /* Com'e' messo adesso, sotto il nome: e' meta' di quello
                     * per cui questa schermata esiste. La parola arriva gia'
                     * scritta dalla plancia, nella lingua di chi guarda.
                     *
                     * Se manca si mette uno spazio invece di niente: in una
                     * griglia una tessera senza la riga sotto e' piu' bassa
                     * delle altre, e sei tessere di due altezze diverse si
                     * leggono peggio di sei uguali con una riga vuota. */
                    .setText(uno.stato.ifBlank { " " })
                    .setImage(ilSegno(uno.genere))
                    .setOnClickListener { premiEDillo(carContext, uno.id, uno.nome, true) }
                    .build(),
            )
        }
        return GridTemplate.Builder()
            .setSingleList(elenco.build())
            .setTitle(
                foto?.casa?.ifBlank { null } ?: carContext.getString(R.string.auto_dispositivi),
            )
            .setHeaderAction(Action.APP_ICON)
            .setActionStrip(iDueTasti())
            .build()
    }

    /* I due tasti in alto. Due e non tre: la barra in macchina e' stretta, e
     * questa schermata ne ha bisogno di due — quello che fa partire le cose
     * scritte a mano, e quello che racconta la casa. */
    private fun iDueTasti(): ActionStrip =
        ActionStrip.Builder()
            .addAction(
                Action.Builder()
                    .setTitle(carContext.getString(R.string.auto_azioni_breve))
                    .setOnClickListener { screenManager.push(LeAzioniInAuto(carContext)) }
                    .build(),
            )
            .addAction(
                Action.Builder()
                    .setTitle(carContext.getString(R.string.auto_casa_breve))
                    .setOnClickListener { screenManager.push(ComeStaLaCasa(carContext)) }
                    .build(),
            )
            .build()

    private fun ilSegno(genere: String): CarIcon {
        val disegno = when (genere) {
            "porta" -> R.drawable.auto_porta
            "varco" -> R.drawable.auto_varco
            "presa" -> R.drawable.auto_presa
            else -> R.drawable.auto_luce
        }
        return CarIcon.Builder(IconCompat.createWithResource(carContext, disegno))
            /* La tinta la sceglie l'auto: `DEFAULT` vuol dire «quella giusta
             * per il tema di adesso», ed e' il modo in cui una sola icona
             * bianca serve il chiaro e lo scuro senza due disegni da tenere
             * allineati. */
            .setTint(CarColor.DEFAULT)
            .build()
    }
}
