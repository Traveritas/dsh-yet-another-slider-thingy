/**
 * Host 半：空壳。
 *
 * 浏览器端逻辑全在 `./client`（dsh.client 声明）；这里只让 Loader 有一条可加载的
 * 宿主行，客户端模块系统才会把同一包的 client bundle 挂上来。
 */
export function apply() {}
