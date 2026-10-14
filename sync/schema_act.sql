-- 2026-10-14 使用统计 + 意见箱：家庭最早的推广来源、班级成员的使用统计、意见箱
ALTER TABLE fam ADD COLUMN src TEXT;
ALTER TABLE mem ADD COLUMN st TEXT;
CREATE TABLE IF NOT EXISTS fb (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  contact TEXT,
  lang TEXT,
  src TEXT,
  at TEXT,
  created INTEGER NOT NULL
);
