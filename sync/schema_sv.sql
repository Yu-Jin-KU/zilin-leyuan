-- 2026-10-17 家长问卷：每个家庭码（没有家庭码时用设备随机码）每份问卷各记一次「弹出过 / 填完 / 不参加」，填完的存答案
CREATE TABLE IF NOT EXISTS sv (
  k TEXT NOT NULL,
  n INTEGER NOT NULL,
  kind TEXT NOT NULL,
  a TEXT,
  lang TEXT,
  src TEXT,
  created INTEGER NOT NULL,
  PRIMARY KEY (k, n, kind)
);
