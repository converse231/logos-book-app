package expo.modules.readingactivity

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

// Foreground service that shows an ongoing "reading" notification with a live,
// self-ticking chronometer. Keeping a foreground service also markedly reduces the
// chance the OS kills the app mid-session — reinforcing the crash-recovery in the
// tracker.

class ReadingTimerService : Service() {
  companion object {
    const val ACTION_START = "expo.modules.readingactivity.START"
    const val ACTION_UPDATE = "expo.modules.readingactivity.UPDATE"
    const val EXTRA_TITLE = "title"
    const val EXTRA_FORMAT = "format"
    const val EXTRA_STARTED_AT = "startedAt"
    const val EXTRA_PAUSED = "paused"

    private const val CHANNEL_ID = "reading_session"
    private const val NOTIF_ID = 4211
  }

  private var title: String = "Reading"
  private var format: String = "physical"
  private var startedAtMs: Long = 0L
  private var paused: Boolean = false
  private var pausedElapsedMs: Long = 0L

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        title = intent.getStringExtra(EXTRA_TITLE) ?: "Reading"
        format = intent.getStringExtra(EXTRA_FORMAT) ?: "physical"
        startedAtMs = intent.getLongExtra(EXTRA_STARTED_AT, System.currentTimeMillis())
        paused = false
        pausedElapsedMs = 0L
        ensureChannel()
        startForeground(NOTIF_ID, buildNotification())
      }
      ACTION_UPDATE -> {
        if (intent.hasExtra(EXTRA_PAUSED)) {
          val nextPaused = intent.getBooleanExtra(EXTRA_PAUSED, false)
          if (nextPaused && !paused) {
            pausedElapsedMs = System.currentTimeMillis() - startedAtMs
          } else if (!nextPaused && paused) {
            startedAtMs = System.currentTimeMillis() - pausedElapsedMs
          }
          paused = nextPaused
        }
        notificationManager().notify(NOTIF_ID, buildNotification())
      }
    }
    // Recreated with a fresh START if the OS ever restarts us.
    return START_STICKY
  }

  private fun buildNotification(): Notification {
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(title)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

    if (paused) {
      builder.setUsesChronometer(false)
      builder.setContentText("Paused · " + formatElapsed(pausedElapsedMs))
    } else {
      // The system renders and advances the timer itself from `when`.
      builder.setUsesChronometer(true)
      builder.setShowWhen(true)
      builder.setWhen(startedAtMs)
      builder.setContentText(if (format == "audiobook") "Listening" else "Reading")
    }

    // Tap → reopen the app (deep-linking straight to the tracker can be added later).
    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      builder.setContentIntent(
        PendingIntent.getActivity(
          this, 0, launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
      )
    }

    return builder.build()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Reading session",
        NotificationManager.IMPORTANCE_LOW // silent, no sound/vibration
      ).apply {
        description = "The live timer while a reading session is running."
        setShowBadge(false)
      }
      notificationManager().createNotificationChannel(channel)
    }
  }

  private fun notificationManager(): NotificationManager =
    getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun formatElapsed(ms: Long): String {
    val total = (ms / 1000).toInt()
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%02d:%02d", m, s)
  }
}
