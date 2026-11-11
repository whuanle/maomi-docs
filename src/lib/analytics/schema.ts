/**
 * 统计侧库的表结构，集中注册。
 *
 * 启动建表、迁移、后续查询都从这里取，避免 DDL 与代码里的列名各写一份而漂移。
 * 全部是 `IF NOT EXISTS`，重复执行安全。
 */
const DOC_STATS_DDL = `
CREATE TABLE IF NOT EXISTS doc_stats (
  doc_path VARCHAR PRIMARY KEY,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0
)
`;

/**
 * 每日阅读量。累计值在 doc_stats，按天趋势在这张表——DuckDB 里按 (doc_path, day)
 * 做 upsert 很便宜，日后做"最近 7 天/30 天访问趋势"不用改写入路径。
 */
const DOC_DAILY_VIEWS_DDL = `
CREATE TABLE IF NOT EXISTS doc_daily_views (
  doc_path VARCHAR NOT NULL,
  day DATE NOT NULL,
  views BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_path, day)
)
`;

/**
 * 点赞去重表：一个访客对同一篇文档每天只算一次。
 *
 * 点赞是最容易被刷的指标（阅读量还能靠限流压住，点赞一点一个准）。
 * 主键 (doc_path, voter_key, day) 让重复投票在数据库层直接落空，不依赖应用层判断。
 */
const DOC_LIKE_VOTES_DDL = `
CREATE TABLE IF NOT EXISTS doc_like_votes (
  doc_path VARCHAR NOT NULL,
  voter_key VARCHAR NOT NULL,
  day DATE NOT NULL,
  PRIMARY KEY (doc_path, voter_key, day)
)
`;

export const ANALYTICS_DDL: readonly string[] = [DOC_STATS_DDL, DOC_DAILY_VIEWS_DDL, DOC_LIKE_VOTES_DDL];
