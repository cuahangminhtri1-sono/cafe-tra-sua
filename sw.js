/* Service Worker — Quản Lý Cafe · Trà Sữa
   Mục tiêu: mở được app kể cả khi MẤT MẠNG HOÀN TOÀN (cold start),
   nhưng vẫn luôn lấy bản mới nhất khi có mạng.
   - Trang HTML: ưu tiên mạng (timeout 3s) -> hết giờ/không mạng thì lấy bản đã lưu.
   - SDK Firebase (URL có số phiên bản, không đổi): lấy từ bộ nhớ đệm trước cho nhanh.
   - Firestore/API: không đụng vào (Firestore tự lo offline).
*/
var CACHE = 'cafe-pos-v3';

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return c.addAll(['./', './index.html']).catch(function(){});
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if (k !== CACHE) return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function fromNet(req, ms){
  return new Promise(function(resolve, reject){
    var done = false;
    var t = setTimeout(function(){ if (!done){ done = true; reject(new Error('timeout')); } }, ms);
    fetch(req, { cache: 'no-store' }).then(function(res){   // BỎ QUA đệm 10 phút của GitHub Pages -> luôn lấy bản mới nhất
      if (done) return;
      done = true; clearTimeout(t);
      if (res && res.status === 200){
        var cp = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, cp); }).catch(function(){});
      }
      resolve(res);
    }).catch(function(err){
      if (done) return;
      done = true; clearTimeout(t); reject(err);
    });
  });
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;                 // HEAD (kiểm tra bản mới) đi thẳng

  var url;
  try { url = new URL(req.url); } catch(err){ return; }

  var sameOrigin = (url.origin === self.location.origin);
  var isSDK = /gstatic\.com\/firebasejs/.test(req.url);

  // Firestore / API / nơi khác: để trình duyệt tự xử lý
  if (!sameOrigin && !isSDK) return;

  // SDK Firebase: URL cố định theo phiên bản -> đệm trước cho nhanh & chạy offline
  if (isSDK){
    e.respondWith(
      caches.match(req).then(function(hit){
        if (hit) return hit;
        return fetch(req).then(function(res){
          if (res && (res.status === 200 || res.type === 'opaque')){
            var cp = res.clone();
            caches.open(CACHE).then(function(c){ c.put(req, cp); }).catch(function(){});
          }
          return res;
        });
      })
    );
    return;
  }

  // File của app (HTML...): ưu tiên mạng, quá 3 giây hoặc mất mạng -> dùng bản đã lưu
  e.respondWith(
    fromNet(req, 3000).catch(function(){
      return caches.match(req).then(function(hit){
        if (hit) return hit;
        return caches.match('./index.html').then(function(idx){
          if (idx) return idx;
          return new Response('<h1 style="font-family:sans-serif;padding:40px">Không có mạng và chưa lưu được bản offline.<br>Hãy mở lại app một lần khi có mạng.</h1>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        });
      });
    })
  );
});
