import ActivityKit
import Foundation

// The shared shape of the Live Activity. TWO identical copies exist, and they
// must stay identical: modules/reading-activity/ios/ (the app, which requests
// and updates the activity) and targets/reading-widget/ (the widget, which
// renders it). ActivityKit matches them by type name and Codable shape — a field
// added to one copy only means the widget silently stops rendering.
//
// Elapsed time is derived on the native side from `startedAt`, so the widget can
// use SwiftUI `Text(timerInterval:)` and tick on its own with no JS or push.

@available(iOS 16.2, *)
public struct ReadingActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// The widget counts up from here while running.
    public var startedAt: Date
    public var paused: Bool
    /// Elapsed seconds frozen at the moment of pause (shown while paused).
    public var pausedElapsed: TimeInterval
    public var currentPage: Int?

    public init(startedAt: Date, paused: Bool = false, pausedElapsed: TimeInterval = 0, currentPage: Int? = nil) {
      self.startedAt = startedAt
      self.paused = paused
      self.pausedElapsed = pausedElapsed
      self.currentPage = currentPage
    }
  }

  public var title: String
  public var pageCount: Int?
  public var format: String

  public init(title: String, pageCount: Int?, format: String) {
    self.title = title
    self.pageCount = pageCount
    self.format = format
  }
}
