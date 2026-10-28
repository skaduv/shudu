const APP_CACHE_PREFIX = "liquid-sudoku-";

/**
 * 清理本应用的离线资源缓存，并注销当前子路径下的 Service Worker。
 * 不删除 localStorage 或 IndexedDB，避免误删游戏进度和上传题目。
 */
export async function clearAppCache() {
  if (typeof window === "undefined") return;

  if ("caches" in window) {
    const keys = await window.caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(APP_CACHE_PREFIX))
        .map((key) => window.caches.delete(key))
    );
  }

  if ("serviceWorker" in navigator) {
    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
    const appScope = new URL(`${basePath}/`, window.location.origin).href;
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(
      registrations
        .filter((registration) => registration.scope === appScope)
        .map((registration) => registration.unregister())
    );
  }
}
