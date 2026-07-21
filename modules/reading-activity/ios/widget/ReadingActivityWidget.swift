import ActivityKit
import WidgetKit
import SwiftUI

// The Live Activity UI — Lock Screen banner + Dynamic Island. This file (and a
// copy of ReadingActivityAttributes.swift) belong to a WIDGET EXTENSION target,
// NOT the app target. See modules/reading-activity/README.md for adding it.
//
// The timer ticks entirely on the OS via `Text(timerInterval:)` — no JS, no push.

@available(iOS 16.2, *)
struct ReadingActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ReadingActivityAttributes.self) { context in
      // ── Lock Screen / banner ────────────────────────────────────────────────
      HStack(spacing: 14) {
        Image(systemName: context.attributes.format == "audiobook" ? "headphones" : "book.fill")
          .font(.title2)
          .foregroundStyle(.orange)
        VStack(alignment: .leading, spacing: 2) {
          Text(context.attributes.title)
            .font(.subheadline).fontWeight(.semibold)
            .lineLimit(1)
          timerText(context.state)
            .font(.system(size: 30, weight: .bold, design: .rounded))
            .monospacedDigit()
        }
        Spacer()
        if context.state.paused {
          Label("Paused", systemImage: "pause.fill")
            .font(.caption).foregroundStyle(.secondary)
        }
      }
      .padding()
      .activityBackgroundTint(Color(red: 0.14, green: 0.12, blue: 0.10).opacity(0.92))
      .activitySystemActionForegroundColor(.white)

    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "book.fill").foregroundStyle(.orange)
        }
        DynamicIslandExpandedRegion(.trailing) {
          if context.state.paused { Image(systemName: "pause.fill").foregroundStyle(.secondary) }
        }
        DynamicIslandExpandedRegion(.center) {
          timerText(context.state)
            .font(.system(size: 34, weight: .bold, design: .rounded))
            .monospacedDigit()
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.attributes.title).font(.caption).foregroundStyle(.secondary).lineLimit(1)
        }
      } compactLeading: {
        Image(systemName: "book.fill").foregroundStyle(.orange)
      } compactTrailing: {
        timerText(context.state)
          .monospacedDigit()
          .frame(width: 52)
      } minimal: {
        Image(systemName: "book.fill").foregroundStyle(.orange)
      }
      .keylineTint(.orange)
    }
  }

  // Running → a self-ticking timer; paused → the frozen elapsed string.
  @ViewBuilder
  private func timerText(_ state: ReadingActivityAttributes.ContentState) -> some View {
    if state.paused {
      Text(formatElapsed(state.pausedElapsed))
    } else {
      Text(timerInterval: state.startedAt...Date.distantFuture, countsDown: false)
    }
  }
}

@available(iOS 16.2, *)
private func formatElapsed(_ seconds: TimeInterval) -> String {
  let total = Int(seconds)
  let h = total / 3600, m = (total % 3600) / 60, s = total % 60
  return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%02d:%02d", m, s)
}
