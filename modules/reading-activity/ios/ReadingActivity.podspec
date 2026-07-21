Pod::Spec.new do |s|
  s.name           = 'ReadingActivity'
  s.version        = '0.1.0'
  s.summary        = 'Live reading-session timer (iOS Live Activity) for LOGOS.'
  s.description    = 'Starts/updates/ends an ActivityKit Live Activity that self-counts elapsed reading time on the Lock Screen and Dynamic Island.'
  s.author         = ''
  s.homepage       = 'https://logos.app'
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # Only the app-side sources compile into the app target (the module + the shared
  # ActivityAttributes). The widget UI under ios/widget/ belongs to a separate
  # Widget Extension target — see modules/reading-activity/README.md.
  s.source_files = "*.swift"
end
