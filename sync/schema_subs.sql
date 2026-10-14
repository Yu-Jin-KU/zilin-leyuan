-- 家长自愿留的邮箱（勾了同意才收）：只用来发更新，可随时退订（POST /unsub 直接删行）
CREATE TABLE IF NOT EXISTS subs (
  email TEXT PRIMARY KEY,
  lang TEXT NOT NULL DEFAULT '',
  src TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL
);
