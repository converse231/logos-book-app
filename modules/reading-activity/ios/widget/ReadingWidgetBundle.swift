import WidgetKit
import SwiftUI

// The Widget Extension's entry point. Belongs to the Widget Extension target
// (with @main). If you already have a widget bundle, just add
// ReadingActivityWidget() to its body instead of creating a second @main.

@available(iOS 16.2, *)
@main
struct ReadingWidgetBundle: WidgetBundle {
  var body: some Widget {
    ReadingActivityWidget()
  }
}
