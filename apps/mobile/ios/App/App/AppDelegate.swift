import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        registerNotificationCategories()
        return true
    }

    /// Buttons on reminder and digest notifications. The ids match the server's push payload
    /// (`category` in packages/notify/src/fcm.ts); the app handles them in src/lib/push.ts.
    private func registerNotificationCategories() {
        let ru = Locale.preferredLanguages.first?.hasPrefix("ru") ?? false
        func action(_ id: String, _ en: String, _ russian: String) -> UNNotificationAction {
            UNNotificationAction(identifier: id, title: ru ? russian : en, options: [.foreground])
        }
        let reminder = UNNotificationCategory(
            identifier: "reminder",
            actions: [
                action("done", "Done", "Готово"),
                action("snooze-1h", "Snooze 1 h", "Отложить на 1 ч"),
                action("snooze-tomorrow", "Tomorrow", "Завтра"),
            ],
            intentIdentifiers: [])
        let review = UNNotificationCategory(
            identifier: "digest-review",
            actions: [action("review-got", "Got it", "Помню"), action("review-forgot", "Forgot", "Забыл")],
            intentIdentifiers: [])
        let digest = UNNotificationCategory(identifier: "digest", actions: [], intentIdentifiers: [])
        UNUserNotificationCenter.current().setNotificationCategories([reminder, review, digest])
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
