// One More Brain background refresh. Runs outside the web view (no imports, no DOM), every 15+
// minutes on Android and whenever iOS allows. The app schedules the next week of notifications
// itself; this only adds what changed on other devices since the app last ran, a short way ahead,
// so nothing it can't take back (it has no cancel) stays pending for long.

/* global addEventListener, CapacitorKV, CapacitorNotifications */

var AHEAD_MS = 60 * 60 * 1000 // schedule up to an hour ahead
var LATE_MS = 30 * 60 * 1000 // show something missed by up to half an hour right away

function kvGet(key) {
  try {
    var v = CapacitorKV.get(key)
    return v && v.value ? v.value : null
  } catch (e) {
    return null
  }
}

function kvJson(key, fallback) {
  var raw = kvGet(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch (e) {
    return fallback
  }
}

// Same as notificationId() in src/lib/notifications.ts.
function notificationId(key) {
  var h = 0x811c9dc5
  for (var i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 1 || 1
}

// From the app: the API, this phone's schedule key (null: notifications off) and what it scheduled.
addEventListener('sync', function (resolve, reject, args) {
  try {
    if (!args || !args.key) {
      CapacitorKV.remove('omb.key')
      CapacitorKV.remove('omb.known')
      CapacitorKV.remove('omb.posted')
      resolve({ posted: [] })
      return
    }
    CapacitorKV.set('omb.api', args.api)
    CapacitorKV.set('omb.key', args.key)
    CapacitorKV.set('omb.known', JSON.stringify(args.known || []))
    var posted = kvJson('omb.posted', {})
    resolve({ posted: Object.keys(posted) })
  } catch (e) {
    reject(e)
  }
})

addEventListener('refresh', function (resolve, reject) {
  var api = kvGet('omb.api')
  var key = kvGet('omb.key')
  if (!api || !key) {
    resolve()
    return
  }
  fetch(api + '/api/v1/notifications/schedule', { headers: { 'x-schedule-key': key } })
    .then(function (res) {
      if (res.status === 401) {
        // Notifications were turned off for this phone elsewhere.
        CapacitorKV.remove('omb.key')
        return null
      }
      return res.ok ? res.json() : null
    })
    .then(function (schedule) {
      if (!schedule) {
        resolve()
        return
      }
      var now = Date.now()
      var known = {}
      kvJson('omb.known', []).forEach(function (k) {
        known[k] = true
      })
      var posted = kvJson('omb.posted', {})
      // Forget what's long gone.
      Object.keys(posted).forEach(function (k) {
        if (posted[k] < now - 24 * 60 * 60 * 1000) delete posted[k]
      })

      var due = []
      function add(key, at, n) {
        var t = Date.parse(at)
        if (known[key] || posted[key] || t > now + AHEAD_MS || t < now - LATE_MS) return
        n.id = notificationId(key)
        n.scheduleAt = new Date(Math.max(t, now + 2000))
        due.push(n)
        posted[key] = t
      }
      schedule.reminders.forEach(function (r) {
        add(r.key, r.at, {
          title: r.title,
          body: schedule.reminderBody,
          actionTypeId: 'reminder',
          channelId: 'reminders',
        })
      })
      var d = schedule.digest
      if (d) {
        add(d.key, d.at, {
          title: d.title,
          body: d.body,
          largeBody: d.body,
          actionTypeId: d.reviewItemId ? 'digest-review' : 'digest',
          channelId: 'digest',
        })
      }
      if (due.length) CapacitorNotifications.schedule(due)
      CapacitorKV.set('omb.posted', JSON.stringify(posted))
      resolve()
    })
    .catch(function () {
      resolve()
    })
})
