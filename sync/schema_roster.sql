-- 教师版名单：老师预先录好孩子名字，家长加入时从名单里选，报告按名单合并多台设备
ALTER TABLE cls ADD COLUMN roster TEXT NOT NULL DEFAULT '[]';
ALTER TABLE mem ADD COLUMN rid TEXT NOT NULL DEFAULT '';
