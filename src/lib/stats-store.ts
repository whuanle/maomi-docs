/**
 * 文档统计的对外门面。
 *
 * 实现在 ./analytics/ 下（DuckDB 侧库 + 内存计数批处理），这里只保留路由与页面
 * 依赖的三个函数签名，调用方无需感知存储细节：
 *
 * - recordView / recordLike：记一次阅读 / 点赞，返回最新快照
 * - getStats：读取快照（已合并尚未落库的增量）
 */
export { getStats, recordLike, recordView, type StatsSnapshot } from "./analytics/store";
