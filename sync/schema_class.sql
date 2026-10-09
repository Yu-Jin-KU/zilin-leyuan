-- 教师版：班级 + 成员。班级码（code，8 位）发给家长输入；老师钥匙（key，16 位）只有老师拿着，用来看报告和布置生字。
CREATE TABLE IF NOT EXISTS cls (
  code TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  assign TEXT NOT NULL DEFAULT '{}',
  updated INTEGER NOT NULL,
  created INTEGER NOT NULL
);
-- 成员 id = 家庭码.玩家id，所以同一个孩子在不同设备上不会重复
CREATE TABLE IF NOT EXISTS mem (
  cls TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  prog TEXT NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (cls, id)
);
