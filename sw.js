/* =====================================================================
   sw.js  ·  DUNG CHUNG cho: So No + Ban hang · TroSafe · Quan Ly Cafe
   Chep 1 ban file nay vao CUNG THU MUC voi index.html cua tung app.

   Nhiem vu:
     1) Co 'fetch' handler  -> app mo duoc khi MAT MANG
     2) HTML luon lay ban MOI NHAT khi co mang (network-first)
     3) KHONG tu skipWaiting -> KHONG bao gio tu tai lai khi dang ban hang.
        Chi skipWaiting khi app gui message 'SKIP_WAITING' (app da co san co che nay).
     4) KHONG dung vao Firebase / Firestore / QR thanh toan -> de trinh duyet tu lo.

   Doi noi dung app? -> chi can upload de index.html, KHONG can sua file nay.
   Muon xoa sach bo nho dem cu -> doi VER "v1" -> "v2" roi upload lai.
   ===================================================================== */
var VER   = "v1";
var CACHE = "mtapp-" + VER;

/* Thu vien tinh (co so phien ban trong URL) -> luu de mo duoc khi mat mang */
var STATIC = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/|cdn\.jsdelivr\.net\/|esm\.sh\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

/* TUYET DOI KHONG dung toi: API Firebase (doc/ghi du lieu) + anh QR thanh toan */
var NEVER = /(googleapis\.com|firebaseio\.com|firebaseapp\.com|google-analytics|googletagmanager|img\.vietqr\.io|api\.qrserver\.com)/;

self.addEventListener("install", function (e) {
  /* KHONG goi skipWaiting o day: de app tu quyet dinh luc nao an toan de doi ban moi */
});

self.addEventListener("message", function (e) {
  if (e && e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) {
      return (k.indexOf("mtapp-") === 0 && k !== CACHE) ? caches.delete(k) : Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;                 /* HEAD (do ban moi) / POST -> khong dung */

  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (NEVER.test(req.url)) return;                  /* Firebase & QR -> de trinh duyet tu lo */

  var same = (url.origin === self.location.origin);

  /* ---------- 1) Trang HTML -> NETWORK-FIRST ----------
     Co mang: luon lay ban moi nhat.  Mat mang: lay ban da luu. */
  if (req.mode === "navigate" || (same && req.destination === "document")) {
    e.respondWith((async function () {
      try {
        var fresh = await fetch(req);
        if (fresh && fresh.ok && fresh.type === "basic") {
          var c = await caches.open(CACHE);
          try { await c.put(req, fresh.clone()); } catch (_) {}
        }
        return fresh;
      } catch (_) {
        var c2  = await caches.open(CACHE);
        var hit = await c2.match(req, { ignoreSearch: true });
        if (hit) return hit;
        hit = await c2.match(self.registration.scope, { ignoreSearch: true });
        if (hit) return hit;
        return new Response(
          "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
          "<body style='background:#0E1613;color:#E8F0EC;font-family:system-ui;text-align:center;padding:60px 20px'>" +
          "<div style='font-size:52px'>\ud83d\udcf6</div>" +
          "<h2 style='color:#45B08F;margin:14px 0 8px'>CH\u01afA C\u00d3 M\u1ea0NG</h2>" +
          "<p style='color:#8FA79C;line-height:1.7'>H\u00e3y m\u1edf app 1 l\u1ea7n khi c\u00f3 m\u1ea1ng<br/>\u0111\u1ec3 l\u01b0u b\u1ea3n offline.</p></body>",
          { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }
    })());
    return;
  }

  /* ---------- 2) Thu vien tinh (Firebase SDK, xlsx...) -> CACHE-FIRST ---------- */
  if (!same && STATIC.test(req.url)) {
    e.respondWith((async function () {
      var c   = await caches.open(CACHE);
      var hit = await c.match(req);
      var net = fetch(req).then(function (r) {
        if (r && (r.ok || r.type === "opaque")) { try { c.put(req, r.clone()); } catch (_) {} }
        return r;
      }).catch(function () { return null; });
      if (hit) return hit;
      var r2 = await net;
      return r2 || new Response("", { status: 504, statusText: "offline" });
    })());
    return;
  }

  /* ---------- 3) File cung thu muc (anh, css roi...) -> NETWORK-FIRST nhe ---------- */
  if (same) {
    e.respondWith((async function () {
      try {
        var r = await fetch(req);
        if (r && r.ok && r.type === "basic") {
          var c = await caches.open(CACHE);
          try { await c.put(req, r.clone()); } catch (_) {}
        }
        return r;
      } catch (_) {
        var c2  = await caches.open(CACHE);
        var hit = await c2.match(req);
        if (hit) return hit;
        throw _;
      }
    })());
  }
  /* con lai (cross-origin la) -> khong dung, trinh duyet tu xu ly */
});
