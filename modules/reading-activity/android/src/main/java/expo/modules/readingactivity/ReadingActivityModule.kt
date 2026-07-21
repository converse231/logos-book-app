package expo.modules.readingactivity

import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Bridges JS start/update/end to a foreground service that owns an ongoing
// notification. The notification's chronometer (setUsesChronometer + setWhen)
// ticks on its own from the session start, so JS never pushes per-second updates.

class ReadingActivityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReadingActivity")

    Function("isSupported") { true }

    Function("start") { config: Map<String, Any?> ->
      val ctx = appContext.reactContext ?: return@Function
      val intent = Intent(ctx, ReadingTimerService::class.java).apply {
        action = ReadingTimerService.ACTION_START
        putExtra(ReadingTimerService.EXTRA_TITLE, config["title"] as? String ?: "Reading")
        putExtra(ReadingTimerService.EXTRA_FORMAT, config["format"] as? String ?: "physical")
        putExtra(
          ReadingTimerService.EXTRA_STARTED_AT,
          (config["startedAtMs"] as? Number)?.toLong() ?: System.currentTimeMillis()
        )
      }
      ContextCompat.startForegroundService(ctx, intent)
    }

    Function("update") { patch: Map<String, Any?> ->
      val ctx = appContext.reactContext ?: return@Function
      val intent = Intent(ctx, ReadingTimerService::class.java).apply {
        action = ReadingTimerService.ACTION_UPDATE
        if (patch.containsKey("paused")) {
          putExtra(ReadingTimerService.EXTRA_PAUSED, patch["paused"] as? Boolean ?: false)
        }
      }
      ContextCompat.startForegroundService(ctx, intent)
    }

    Function("end") {
      val ctx = appContext.reactContext ?: return@Function
      ctx.stopService(Intent(ctx, ReadingTimerService::class.java))
    }
  }
}
