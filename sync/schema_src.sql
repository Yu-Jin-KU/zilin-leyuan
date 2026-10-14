-- 渠道统计：?from=xxx 推广链接每天带来多少台新设备（每台设备一辈子只报一次，没带 from 的记 (none)）。只有计数，不存任何设备信息
CREATE TABLE IF NOT EXISTS src (
  day TEXT NOT NULL,
  src TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, src)
);
