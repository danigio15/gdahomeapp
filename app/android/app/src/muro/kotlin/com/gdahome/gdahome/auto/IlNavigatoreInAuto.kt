package com.gdahome.gdahome.auto

import android.content.Context
import io.flutter.embedding.engine.FlutterEngine

/*
 * GdAHome Muro, l'app del pannello: niente auto. E' l'altra faccia di
 * `src/telefono/.../IlNavigatoreInAuto.kt`, con le sole cose che
 * `MainActivity` chiede: sul muro il navigatore non c'e' mai, e il motore e'
 * quello dell'activity, come nella gdahome senza navigatore.
 *
 * Esiste perche' l'app del pannello non porti dentro gdanav (mappe, guida,
 * Android Auto): sul Wi-Fi di un pannello ogni MB e' tempo di installazione.
 */
object IlNavigatoreInAuto {
    const val MOTORE = "gdahome"

    fun acceso(context: Context): Boolean = false

    fun motore(context: Context): FlutterEngine =
        throw IllegalStateException("Sul pannello a muro il navigatore in auto non c'e'.")
}
