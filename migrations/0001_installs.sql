-- Install scripts getjpm.sh handed out: one row per UTC day, script (install.sh, install.ps1) and
-- path asked for (/, /install.sh, /install.ps1), holding a count and nothing else.
CREATE TABLE IF NOT EXISTS installs (
  day TEXT NOT NULL,
  script TEXT NOT NULL,
  path TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, script, path)
) WITHOUT ROWID;
