import ExpoModulesCore
import ActivityKit

// Bridges the JS start/update/end to an ActivityKit Live Activity. The activity's
// widget (a separate Widget Extension target) self-counts from `startedAt`, so
// this module never has to push per-second updates — only state changes
// (pause/resume, page).

public class ReadingActivityModule: Module {
  private var currentActivityID: String?

  public func definition() -> ModuleDefinition {
    Name("ReadingActivity")

    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    Function("start") { (config: [String: Any]) in
      if #available(iOS 16.2, *) {
        self.startActivity(config)
      }
    }

    Function("update") { (patch: [String: Any]) in
      if #available(iOS 16.2, *) {
        self.updateActivity(patch)
      }
    }

    Function("end") {
      if #available(iOS 16.2, *) {
        self.endActivities()
      }
    }

    // Clean up any stray activity if the JS context is torn down.
    OnDestroy {
      if #available(iOS 16.2, *) {
        self.endActivities()
      }
    }
  }

  @available(iOS 16.2, *)
  private func startActivity(_ config: [String: Any]) {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    // One at a time — drop any previous session's activity first.
    endActivities()

    let title = config["title"] as? String ?? "Reading"
    let format = config["format"] as? String ?? "physical"
    let pageCount = config["pageCount"] as? Int
    let startedAtMs = (config["startedAtMs"] as? Double) ?? (Date().timeIntervalSince1970 * 1000)
    let startPage = config["startPage"] as? Int

    let attributes = ReadingActivityAttributes(title: title, pageCount: pageCount, format: format)
    let state = ReadingActivityAttributes.ContentState(
      startedAt: Date(timeIntervalSince1970: startedAtMs / 1000),
      paused: false,
      pausedElapsed: 0,
      currentPage: startPage
    )

    do {
      let activity = try Activity.request(
        attributes: attributes,
        content: .init(state: state, staleDate: nil)
      )
      currentActivityID = activity.id
    } catch {
      // Never let a live-activity failure disturb the reading session.
      currentActivityID = nil
    }
  }

  @available(iOS 16.2, *)
  private func updateActivity(_ patch: [String: Any]) {
    guard let id = currentActivityID,
          let activity = Activity<ReadingActivityAttributes>.activities.first(where: { $0.id == id })
    else { return }

    var state = activity.content.state

    if let paused = patch["paused"] as? Bool {
      if paused && !state.paused {
        // Freeze: capture how much has elapsed so the widget can show a static time.
        state.pausedElapsed = Date().timeIntervalSince(state.startedAt)
      } else if !paused && state.paused {
        // Resume: shift the start back so the running timer picks up where it froze.
        state.startedAt = Date().addingTimeInterval(-state.pausedElapsed)
      }
      state.paused = paused
    }

    if let page = patch["currentPage"] as? Int {
      state.currentPage = page
    }

    let newState = state
    Task {
      await activity.update(.init(state: newState, staleDate: nil))
    }
  }

  @available(iOS 16.2, *)
  private func endActivities() {
    currentActivityID = nil
    Task {
      for activity in Activity<ReadingActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}
