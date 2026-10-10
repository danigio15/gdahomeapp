/* gdahome al polso, per Wear OS: la casa e il navigatore.
 *
 * Gli stessi schermi dell'Apple Watch (`ios/Orologio`): in cima la guida di
 * gdanav, poi i comandi rapidi scelti per l'auto, e sotto i dispositivi, le
 * azioni della plancia e com'e' la casa. Tutto passa dal telefono: vedi
 * `IlTelefono.kt`.
 */
package com.gdahome.gdahome.orologio

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.ListHeader
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val ambra = Color(0xFFF59E0B)

class AlPolso : ComponentActivity() {
    private lateinit var telefono: IlTelefono

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val vetrina = intent?.getStringExtra("vetrina").orEmpty()
        telefono = IlTelefono(this, vetrina = vetrina.isNotEmpty())
        setContent { MaterialTheme { Radice(telefono, vetrina) } }
    }

    override fun onResume() {
        super.onResume()
        telefono.accendi()
    }

    override fun onPause() {
        telefono.spegni()
        super.onPause()
    }
}

@Composable
private fun Radice(telefono: IlTelefono, vetrina: String = "") {
    val nav = rememberSwipeDismissableNavController()
    /* Nella vetrina si va dritti alla schermata chiesta. */
    val inVetrina = telefono.foto
    LaunchedEffect(vetrina, inVetrina != null) {
        if (vetrina.isNotEmpty() && inVetrina != null) {
            Vetrina.destinazione(vetrina, inVetrina)?.let { nav.navigate(it) }
        }
    }
    Scaffold(timeText = { TimeText() }) {
        Box(Modifier.fillMaxSize()) {
            val foto = telefono.foto
            when {
                foto == null -> Spiegazione("Apri gdahome", "Apri gdahome sul telefono una volta: da lì in poi la casa la trovi qui.")
                !foto.premium -> Spiegazione("gdahome Premium", "La casa al polso è compresa in gdahome Premium. Si attiva dall'app sul telefono.")
                else -> SwipeDismissableNavHost(navController = nav, startDestination = "casa") {
                    composable("casa") { LaCasa(foto, telefono, nav) }
                    composable("navigatore") { IlNavigatore(foto.guida, telefono) }
                    composable("dispositivi") { Dispositivi(foto, telefono) }
                    composable("azioni") { Azioni(foto, telefono) }
                    composable("come") { ComeStaLaCasa(foto) }
                    composable("conferma/{id}") { voce ->
                        val id = voce.arguments?.getString("id").orEmpty()
                        Conferma(foto.comandi.firstOrNull { it.id == id }, telefono, nav)
                    }
                }
            }
            telefono.avviso?.let { testo ->
                Text(
                    testo,
                    modifier = Modifier.align(Alignment.BottomCenter).padding(horizontal = 24.dp, vertical = 10.dp),
                    textAlign = TextAlign.Center,
                    fontSize = 12.sp,
                    color = ambra,
                )
            }
        }
    }
}

@Composable
private fun Elenco(contenuto: ScalingLazyListScope.() -> Unit) {
    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        content = contenuto,
    )
}

@Composable
private fun Tasto(
    testo: String,
    sotto: String? = null,
    segno: String? = null,
    attivo: Boolean = true,
    acceso: Boolean = false,
    premuto: () -> Unit,
) {
    Chip(
        onClick = premuto,
        enabled = attivo,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(testo, maxLines = 2) },
        secondaryLabel = if (sotto != null) {
            { Text(sotto, maxLines = 1) }
        } else {
            null
        },
        icon = if (segno != null) {
            { Text(segno, fontSize = 18.sp) }
        } else {
            null
        },
        colors = if (acceso) ChipDefaults.primaryChipColors(backgroundColor = ambra, contentColor = Color.Black)
        else ChipDefaults.secondaryChipColors(),
    )
}

@Composable
private fun Spiegazione(titolo: String, testo: String) {
    Column(
        Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(titolo, fontWeight = FontWeight.Bold, color = ambra)
        Text(testo, textAlign = TextAlign.Center, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
    }
}

@Composable
private fun LaCasa(foto: LaFoto, telefono: IlTelefono, nav: NavHostController) {
    Elenco {
        item { ListHeader { Text(foto.casa.ifEmpty { "Casa" }) } }
        item {
            val g = foto.guida
            Tasto(
                testo = if (g.attiva) "${freccia(g.tipo)}  ${metri(g.distanza)}" else "Navigatore",
                sotto = if (g.attiva) g.istruzione.ifEmpty { g.strada } else "Portami a casa",
                segno = if (g.attiva) null else "🧭",
            ) { nav.navigate("navigatore") }
        }
        if (foto.comandi.isEmpty()) {
            item {
                Text(
                    "Nessun comando scelto. Sul telefono: navigatore, menu, Comandi rapidi in auto.",
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                )
            }
        }
        items(foto.comandi.size) { i ->
            val c = foto.comandi[i]
            Tasto(c.nome, segno = segno(c.disegno), attivo = !telefono.inCorso) {
                if (c.conferma) nav.navigate("conferma/${Uri.encode(c.id)}") else telefono.premi(c.id)
            }
        }
        item { Tasto("Dispositivi", segno = "🏠") { nav.navigate("dispositivi") } }
        item { Tasto("Azioni rapide", segno = "⚡") { nav.navigate("azioni") } }
        item { Tasto("Come sta la casa", segno = "☀️") { nav.navigate("come") } }
    }
}

/* Una serratura chiede «Sei sicuro?», come la plancia: un tocco sbagliato non deve aprire la
 * porta di casa. */
@Composable
private fun Conferma(comando: Comando?, telefono: IlTelefono, nav: NavHostController) {
    Elenco {
        item { ListHeader { Text(comando?.nome ?: "", textAlign = TextAlign.Center) } }
        item { Text("Sei sicuro?", fontSize = 14.sp, textAlign = TextAlign.Center) }
        item {
            Tasto("Sì", segno = "✔", acceso = true, attivo = comando != null) {
                comando?.let { telefono.premi(it.id) }
                nav.popBackStack()
            }
        }
        item { Tasto("No", segno = "✖") { nav.popBackStack() } }
    }
}

@Composable
private fun Dispositivi(foto: LaFoto, telefono: IlTelefono) {
    Elenco {
        item { ListHeader { Text("Dispositivi") } }
        if (foto.dispositivi.isEmpty()) {
            item { Text("Nessun dispositivo da comandare.", fontSize = 12.sp, textAlign = TextAlign.Center) }
        }
        items(foto.dispositivi.size) { i ->
            val d = foto.dispositivi[i]
            Tasto(
                d.nome,
                sotto = d.stato.ifEmpty { null },
                segno = segno(d.genere),
                attivo = !telefono.inCorso,
                acceso = d.acceso,
            ) { telefono.premi(d.id) }
        }
    }
}

@Composable
private fun Azioni(foto: LaFoto, telefono: IlTelefono) {
    Elenco {
        item { ListHeader { Text("Azioni rapide") } }
        if (foto.azioni.isEmpty()) {
            item { Text("Nessuna azione rapida nella plancia.", fontSize = 12.sp, textAlign = TextAlign.Center) }
        }
        items(foto.azioni.size) { i ->
            val a = foto.azioni[i]
            /* «Fatto» su una cosa che parte fra mezz'ora sarebbe una bugia: si
             * dice prima. */
            Tasto(
                a.nome,
                sotto = if (a.subito) null else "Parte quando apri gdahome",
                segno = "⚡",
                attivo = !telefono.inCorso,
            ) { telefono.premi(a.id) }
        }
    }
}

@Composable
private fun ComeStaLaCasa(foto: LaFoto) {
    val quando = remember(foto.quando) {
        val minuti = (System.currentTimeMillis() - foto.quando) / 60_000
        when {
            foto.quando <= 0 -> "Non si sa di quando è"
            minuti <= 30 -> "Aggiornato adesso"
            minuti >= 60 -> "Di ${minuti / 60} ore fa"
            else -> "Di $minuti minuti fa"
        }
    }
    Elenco {
        item { ListHeader { Text("La casa") } }
        item { Text(quando, fontSize = 12.sp) }
        items(foto.misure.size) { i ->
            val m = foto.misure[i]
            Tasto(m.valore, sotto = m.nome, segno = "☀️") {}
        }
        items(foto.persone.size) { i ->
            val p = foto.persone[i]
            Tasto(p.nome, sotto = if (p.inCasa) "In casa" else "Fuori", segno = if (p.inCasa) "🏠" else "🚶", acceso = p.inCasa) {}
        }
    }
}

@Composable
private fun IlNavigatore(g: Guida, telefono: IlTelefono) {
    val ora = remember { SimpleDateFormat("HH:mm", Locale.ITALY) }
    Elenco {
        if (g.attiva) {
            item { Text(freccia(g.tipo), fontSize = 40.sp, color = ambra) }
            item { Text(metri(g.distanza), fontSize = 28.sp, fontWeight = FontWeight.SemiBold) }
            item {
                Text(
                    g.istruzione.ifEmpty { g.strada },
                    fontSize = 13.sp,
                    textAlign = TextAlign.Center,
                    maxLines = 3,
                )
            }
            item {
                val arrivo = if (g.arrivoMs > 0) "🏁 ${ora.format(Date(g.arrivoMs))} · " else ""
                Text("$arrivo${metri(g.restanti)}", fontSize = 12.sp)
            }
            g.limite?.let { limite ->
                item {
                    val v = g.velocita?.let { Math.round(it).toInt() }
                    Text(
                        "Limite $limite" + (v?.let { " · $it km/h" } ?: ""),
                        fontSize = 12.sp,
                        color = if (v != null && v > limite) Color.Red else Color.Unspecified,
                    )
                }
            }
            item { Tasto("Fine guida", segno = "✖", attivo = !telefono.inCorso) { telefono.ferma() } }
        } else {
            item { ListHeader { Text("Navigatore") } }
            if (g.messaggio.isNotEmpty()) {
                item { Text(g.messaggio, fontSize = 12.sp, textAlign = TextAlign.Center) }
            }
            item { Tasto("Portami a casa", segno = "🏠", attivo = g.haCasa && !telefono.inCorso) { telefono.vai("casa") } }
            item { Tasto("Al lavoro", segno = "💼", attivo = g.haLavoro && !telefono.inCorso) { telefono.vai("lavoro") } }
            if (!g.haCasa && !g.haLavoro) {
                item {
                    Text(
                        "Imposta Casa e Lavoro nel navigatore, sul telefono.",
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}
