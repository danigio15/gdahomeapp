package com.gdahome.gdahome.orologio

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger

/*
 * GdAHome Muro: niente orologio al polso. L'altra faccia di
 * `src/telefono/.../IlTramiteDellOrologio.kt`, con la sola chiamata di
 * `MainActivity`, che qui non fa niente.
 */
object IlTramiteDellOrologio {
    @Suppress("UNUSED_PARAMETER")
    fun collega(messaggi: BinaryMessenger, context: Context) {}
}
