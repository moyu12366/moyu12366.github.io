/* ===========================================================
 * sw.js
 * ===========================================================
 * Copyright 2016 @huxpro
 * Licensed under Apache 2.0
 * service worker scripting
 * ========================================================== */

// CACHE_NAMESPACE
// CacheStorage is shared between all sites under same domain.
// A namespace can prevent potential name conflicts and mis-deletion.
const CACHE_NAMESPACE = 'main-'

const CACHE = CACHE_NAMESPACE + 'precache-then-runtime';
const PRECACHE_LIST = [
  "./",
  "./offline.html",
  "./js/jquery.min.js",
  "./js/bootstrap.min.js",
  "./js/hux-blog.min.js",
  "./js/snackbar.js",
  "./img/icon_wechat.png",
  "./img/home-bg.jpg",
  "./img/404-bg.jpg",
  "./css/hux-blog.min.css",
  "./css/bootstrap.min.css"
]
const HOSTNAME_WHITELIST = [
  self.location.hostname,
  "huangxuan.me",
  "yanshuo.io",
  "cdnjs.cloudflare.com",
  "reliable-daifuku-c6a219.netlify.app"
]
const DEPRECATED_CACHES = ['precache-v1', 'runtime', 'main-precache-v1', 'main-runtime']


// The Util Function to hack URLs of intercepted requests
const getCacheBustingUrl = (req) => {
  var now = Date.now();
  url = new URL(req.url)
  url.protocol = self.location.protocol
  url.search += (url.search ? '&' : '?') + 'cache-bust=' + now;
  return url.href
}

const isNavigationReq = (req) => (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept').includes('text/html')))

const endWithExtension = (req) => Boolean(new URL(req.url).pathname.match(/\.\w+$/))

const shouldRedirect = (req) => (isNavigationReq(req) && new URL(req.url).pathname.substr(-1) !== "/" && !endWithExtension(req))

const getRedirectUrl = (req) => {
  url = new URL(req.url)
  url.pathname += "/"
  return url.href
}


/**
 * @Lifecycle Install
 */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      const cachePromises = PRECACHE_LIST.map(url => {
        return fetch(url).then(response => {
          if (response.ok) {
            return cache.put(url, response);
          } else {
            console.log('缓存失败:', url);
            return Promise.resolve();
          }
        }).catch(err => {
          console.log('缓存请求失败:', url, err);
          return Promise.resolve();
        });
      });
      
      return Promise.all(cachePromises)
        .then(self.skipWaiting())
        .catch(err => console.log(err))
    })
  )
});


/**
 * @Lifecycle Activate
 */
self.addEventListener('activate', event => {
  caches.keys().then(cacheNames => Promise.all(
    cacheNames
      .filter(cacheName => DEPRECATED_CACHES.includes(cacheName))
      .map(cacheName => caches.delete(cacheName))
  ))
  console.log('service worker activated.')
  event.waitUntil(self.clients.claim());
});


var fetchHelper = {
  fetchThenCache: function(request){
    const init = { mode: "cors", credentials: "omit" } 
    const fetched = fetch(request, init)
    const fetchedCopy = fetched.then(resp => resp.clone());

    Promise.all([fetchedCopy, caches.open(CACHE)])
      .then(([response, cache]) => response.ok && cache.put(request, response))
      .catch(_ => {/* eat any errors */})
    
    return fetched;
  },

  cacheFirst: function(url){
    return caches.match(url) 
      .then(resp => resp || this.fetchThenCache(url))
      .catch(_ => {/* eat any errors */})
  }
}


/**
 * @Functional Fetch
 */
self.addEventListener('fetch', event => {
  if (HOSTNAME_WHITELIST.indexOf(new URL(event.request.url).hostname) > -1) {

    if (shouldRedirect(event.request)) {
      event.respondWith(Response.redirect(getRedirectUrl(event.request)))
      return;
    }

    if (event.request.url.indexOf('ys.static') > -1){
      event.respondWith(fetchHelper.cacheFirst(event.request.url))
      return;
    }

    const cached = caches.match(event.request);
    const fetched = fetch(getCacheBustingUrl(event.request), { cache: "no-store" });
    const fetchedCopy = fetched.then(resp => resp.clone());
    
    event.respondWith(
      Promise.race([fetched.catch(_ => cached), cached])
        .then(resp => resp || fetched)
        .catch(_ => caches.match('offline.html'))
    );

    event.waitUntil(
      Promise.all([fetchedCopy, caches.open(CACHE)])
        .then(([response, cache]) => response.ok && cache.put(event.request, response))
        .catch(_ => {/* eat any errors */ })
    );

    if (isNavigationReq(event.request)) {
      console.log(`fetch ${event.request.url}`)
      event.waitUntil(revalidateContent(cached, fetchedCopy))
    }
  }
});


/**
 * Broadcasting all clients with MessageChannel API
 */
function sendMessageToAllClients(msg) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      console.log(client);
      client.postMessage(msg)
    })
  })
}

/**
 * Broadcasting all clients async
 */
function sendMessageToClientsAsync(msg) {
  setTimeout(() => {
    sendMessageToAllClients(msg)
  }, 1000)
}

/**
 * 检查内容是否修改
 */
function revalidateContent(cachedResp, fetchedResp) {
  return Promise.all([cachedResp, fetchedResp])
    .then(([cached, fetched]) => {
      const cachedVer = cached.headers.get('last-modified')
      const fetchedVer = fetched.headers.get('last-modified')
      console.log(`"${cachedVer}" vs. "${fetchedVer}"`);
      
      // 【修改处】这里直接 return，不再向前端发送 UPDATE_FOUND 指令，从而彻底禁用刷新弹窗。
      return;

      /* 已屏蔽原本的弹窗触发逻辑
      if (cachedVer !== fetchedVer) {
        sendMessageToClientsAsync({
          'command': 'UPDATE_FOUND',
          'url': fetched.url
        })
      }
      */
    })
    .catch(err => console.log(err))
}
