package com.gdahome.gdahome.salute

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger

/*
 * GdAHome Muro: niente salute (Health Connect) sul pannello. L'altra faccia
 * di `src/telefono/.../LaSaluteAdAppChiusa.kt`, con quello che usa
 * `MainActivity`: il nome del motore, e un collegamento che non fa niente.
 */
class LaSaluteAdAppChiusa {
    companion object {
        const val MOTORE_DELL_APP = "gdahome-motore-dell-app"

        @Suppress("UNUSED_PARAMETER")
        fun collega(
            messaggi: BinaryMessenger,
            context: Context,
        ) {}
    }
}
