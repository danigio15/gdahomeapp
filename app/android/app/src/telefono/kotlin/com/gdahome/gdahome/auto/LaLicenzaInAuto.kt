/* In auto la casa e' Premium.
 *
 * «Si e' attivato Android Auto anche non avendo il Premium.» Era vero, e il
 * motivo era semplice: la casa in auto — i dispositivi, le azioni rapide,
 * i comandi rapidi del navigatore, il cancello «quasi a casa» — la licenza
 * non la guardava mai. Il navigatore si', e mostrava la sua pagina «serve
 * Premium»; ma da quella pagina un tasto portava alla casa, e la casa si
 * apriva tutta.
 *
 * La licenza la sa il Dart. Il Dart lascia all'auto un biglietto nella
 * cartella privata dell'app — Premium si' o no, e fino a quando — e qui lo
 * si rilegge a ogni schermata e a ogni tasto (`lib/auto/la_licenza.dart`,
 * i due capi dello stesso file). Si sbaglia sempre dalla parte chiusa: un
 * biglietto che manca, storto o scaduto vuol dire Base. Scade con il gettone
 * della casa, quindi un abbonamento finito si chiude anche se l'app sul
 * telefono non si riapre piu'.
 *
 * Chi ha Premium non vede niente di nuovo. Chi non ce l'ha vede una
 * schermata sola, che dice cosa serve e dove si fa: sul telefono, a macchina
 * ferma. Niente tasti per comprare in auto — guidando non si compra.
 */
package com.gdahome.gdahome.auto

import android.content.Context
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Template
import com.gdahome.gdahome.R
import org.json.JSONObject
import java.io.File

object LaLicenzaInAuto {
    /** Lo stesso nome di `nomeDellaLicenza` in `lib/auto/la_licenza.dart`. */
    private const val NOME = "gdahome-auto-licenza.json"

    /** Se la casa in uso e' Premium adesso, per quello che ha detto l'app. */
    fun premium(context: Context, adesso: Long = System.currentTimeMillis()): Boolean =
        vale(
            runCatching {
                val file = File(context.filesDir, NOME)
                if (file.length() > 1024) null else file.readText()
            }.getOrNull(),
            adesso,
        )

    /** Le stesse regole di `laLicenzaVale` in Dart: tutto quello che non e' un biglietto giusto e valido e' «no». */
    fun vale(scritto: String?, adesso: Long): Boolean {
        if (scritto.isNullOrBlank()) return false
        val letto = runCatching { JSONObject(scritto) }.getOrNull() ?: return false
        if (letto.opt("premium") != true) return false
        if (letto.isNull("fino")) return true
        val fino = letto.opt("fino") as? Number ?: return false
        return fino.toLong() > adesso
    }
}

/** La schermata per chi non ha Premium: cosa serve, e dove si fa. */
fun senzaPremium(carContext: CarContext, radice: Boolean = false): Template =
    MessageTemplate.Builder(carContext.getString(R.string.auto_serve_premium))
        .setTitle(carContext.getString(R.string.auto_premium))
        .setHeaderAction(if (radice) Action.APP_ICON else Action.BACK)
        .build()

/** La stessa, come schermata da mettere in cima. */
class CasaSenzaPremium(context: CarContext, private val radice: Boolean = false) : Screen(context) {
    override fun onGetTemplate(): Template = senzaPremium(carContext, radice)
}

/**
 * Un tasto premuto su una schermata rimasta aperta mentre Premium finiva: non
 * parte, e si dice perche'. Torna `true` se si puo' andare avanti.
 */
fun premiumPerIlTasto(carContext: CarContext, nome: String): Boolean {
    if (LaLicenzaInAuto.premium(carContext)) return true
    CarToast.makeText(
        carContext,
        carContext.getString(R.string.auto_comando_serve_premium, nome),
        CarToast.LENGTH_LONG,
    ).show()
    return false
}
