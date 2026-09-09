# Trigger after workflow exists
from pathlib import Path
import re

VERSION = "v8.1-github-main-manual-colors-2026-09-09"

code_path = Path("appscript.gs")
readme_path = Path("README.md")

code = code_path.read_text(encoding="utf-8")

# 1) Version/source-of-truth block at the very top.
if f"VERSION: {VERSION}" not in code:
    version_block = f'''/*
 * ============================================================
 * CHALMERS TIMEEDIT -> GOOGLE CALENDAR
 * VERSION: {VERSION}
 * BUILD DATE: 2026-09-09
 * SOURCE OF TRUTH: GitHub main / appscript.gs
 *
 * COLOR POLICY
 * - New TimeEdit events get their automatic color.
 * - Existing TimeEdit events are never auto-recolored by sync.
 * - Manual Google Calendar colors are preserved.
 * ============================================================
 */

const SCRIPT_VERSION =
  '{VERSION}';


function showScriptVersion() {{

  console.log(
    'SCRIPT VERSION: ' +
    SCRIPT_VERSION
  );
}}


'''
    code = version_block + code

# 2) Always identify the running version in sync logs.
sync_marker = "function syncTimeEdit() {\n\n  validateConfig_();"
if "SCRIPT VERSION: ' +\n    SCRIPT_VERSION" not in code[code.find("function syncTimeEdit()"):code.find("function matchesMyGroup_")]:
    if sync_marker not in code:
        raise RuntimeError("syncTimeEdit marker not found")
    code = code.replace(
        sync_marker,
        "function syncTimeEdit() {\n\n  validateConfig_();\n\n\n  console.log(\n    'SCRIPT VERSION: ' +\n    SCRIPT_VERSION\n  );",
        1,
    )

# 3) A manual color difference must NEVER make an existing event need an update.
needs_color_re = re.compile(
    r"\n\s*const needsColor =\s*\n\s*eventColorDiffers_\(\s*\n\s*calendar,\s*\n\s*event,\s*\n\s*colorId\s*\n\s*\);",
    re.MULTILINE,
)
code, n = needs_color_re.subn(
    "\n\n        /*\n         * V8.1: färg är aldrig ett update-villkor för ett\n         * befintligt TimeEdit-event. Manuella färger bevaras.\n         */\n        const needsColor =\n          false;",
    code,
    count=1,
)
if n != 1 and "const needsColor =\n          false;" not in code:
    raise RuntimeError("needsColor block was not migrated")

# 4) Remove needsColor from needsUpdate.
old_update = """        const needsUpdate =
          needsTitle ||
          needsDescription ||
          needsLocation ||
          needsColor ||
          needsTime;"""
new_update = """        const needsUpdate =
          needsTitle ||
          needsDescription ||
          needsLocation ||
          needsTime;"""
if old_update in code:
    code = code.replace(old_update, new_update, 1)
elif "needsColor ||\n          needsTime" in code:
    raise RuntimeError("needsColor still participates in needsUpdate")

# 5) Existing events must not be recolored after metadata updates.
color_write_re = re.compile(
    r"\n\s*/\*\s*\n\s*\* Färg\.\s*\n\s*\*/\s*\n\s*if \(needsColor\) \{\s*\n\s*applyEventColor_\(\s*\n\s*calendar,\s*\n\s*event,\s*\n\s*colorId\s*\n\s*\);\s*\n\s*\}",
    re.MULTILINE,
)
code, n = color_write_re.subn(
    "\n\n        /*\n         * V8.1: ingen färgskrivning på befintliga events.\n         * Färgen ägs av användaren efter att eventet skapats.\n         */",
    code,
    count=1,
)

# Safety check: in the existing-event section there may be no color-based update or color write.
sync_start = code.index("function syncTimeEdit()")
match_group = code.index("function matchesMyGroup_")
sync_section = code[sync_start:match_group]
existing_marker = "BEFINTLIG BOKNING"
delete_marker = "TA BORT SÅDANT"
if existing_marker not in sync_section or delete_marker not in sync_section:
    raise RuntimeError("Could not locate existing-event section")
existing_section = sync_section[sync_section.index(existing_marker):sync_section.index(delete_marker)]
if "needsColor ||" in existing_section:
    raise RuntimeError("Safety check failed: needsColor still triggers update")
if "applyEventColor_(" in existing_section:
    raise RuntimeError("Safety check failed: existing event still writes color")

# 6) Public GitHub placeholder must be caught by config validation.
old_validation = """    CONFIG.ICAL_URL
      .includes(
        'KLISTRA_IN'
      )"""
new_validation = """    CONFIG.ICAL_URL
      .includes(
        'KLISTRA_IN'
      )

    ||

    CONFIG.ICAL_URL
      .includes(
        'LÄNK_TILL'
      )"""
if old_validation in code and "'LÄNK_TILL'" not in code[code.find("function validateConfig_"):]:
    code = code.replace(old_validation, new_validation, 1)

# Never commit a personal TimeEdit URL.
if "cloud.timeedit.net/chalmers/web/student/" in code:
    raise RuntimeError("Private TimeEdit URL found; refusing to commit")

code_path.write_text(code, encoding="utf-8")

# README: make GitHub/source-of-truth and v8.1 behavior explicit.
readme = readme_path.read_text(encoding="utf-8")
readme_header = f'''# Chalmers TimeEdit → Google Calendar

**Current version:** `{VERSION}`

## GitHub = source of truth

Den aktuella koden ligger i `main/appscript.gs`.

Arbetsflöde:

1. Kopiera hela `appscript.gs` från GitHub `main`.
2. Ersätt hela `Code.gs` i Google Apps Script.
3. Ersätt endast `LÄNK_TILL_Timeedit` med din privata TimeEdit `.ics`-länk.
4. Den privata TimeEdit-länken ska aldrig committas till GitHub.
5. Kör `showScriptVersion()` och kontrollera versionsnumret.

## V8.1: manuella färger

- Nya TimeEdit-events får fortfarande automatisk färg.
- Ett befintligt events färg är **inte** längre ett update-villkor.
- Normal `syncTimeEdit()` skriver därför **inte om färgen** på befintliga events.
- Om titel, tid, beskrivning eller lärare ändras uppdateras den datan, men färgen lämnas orörd.

En ren manuell färgändring ska alltså ge `Uppdaterade: 0` om inget annat har ändrats.

---

'''

# Drop the previous first H1 to avoid two top-level intro headings, keep the historical details below.
readme_body = readme
if readme_body.startswith("# Chalmers TimeEdit → Google Calendar"):
    first_newline = readme_body.find("\n")
    readme_body = readme_body[first_newline + 1:].lstrip("\n")

# Avoid duplicating the v8.1 header if re-run.
if f"**Current version:** `{VERSION}`" not in readme:
    readme = readme_header + readme_body

readme_path.write_text(readme, encoding="utf-8")

print(f"Applied {VERSION}")
