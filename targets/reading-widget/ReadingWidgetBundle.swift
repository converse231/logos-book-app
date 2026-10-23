import WidgetKit
import SwiftUI

// The ReadingWidget extension's entry point (@main). A future home-screen
// widget joins this bundle's body rather than getting a second @main.

@available(iOS 16.2, *)
@main
struct ReadingWidgetBundle: WidgetBundle {
  var body: some Widget {
    ReadingActivityWidget()
  }
}
