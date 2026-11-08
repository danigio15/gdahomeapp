# Le regole di R8 dell'app, oltre a quelle di Flutter e delle librerie.
#
# WorkManager (la salute ad app chiusa, `salute/LaSaluteAdAppChiusa.kt`) parte
# da solo all'apertura dell'app, con `androidx.startup`, e apre il suo database
# Room creando `WorkDatabase_Impl` per riflessione, col costruttore senza
# argomenti. R8 quel costruttore lo toglieva, perche' nessuno lo chiama per
# nome: la 1.18.12 cadeva appena aperta, prima di qualunque schermata
# («NoSuchMethodException: androidx.work.impl.WorkDatabase_Impl.<init> []»,
# Galaxy Z Fold 8 con Android 17, e l'emulatore di Android 15). Si tengono i
# costruttori dei database Room e dei lavoratori di WorkManager, che si creano
# allo stesso modo.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { <init>(); }
-keep class * extends androidx.work.ListenableWorker {
    <init>(android.content.Context, androidx.work.WorkerParameters);
}
-keep class * extends androidx.work.InputMerger { <init>(); }
