# Chalmers TimeEdit → Google Calendar

Detta Apps Script-projekt synkroniserar Chalmers TimeEdit till Google Calendar och skapar även en separat kalender för läsåret 2026/2027.

## Vad scriptet gör

### 1. TimeEdit-synk

Funktionen:

`syncTimeEdit()`

hämtar schemat från Chalmers TimeEdit och synkroniserar det till kalendern:

`SBVII Chalmers TE`

Scriptet:

- hämtar TimeEdit via den konfigurerade `.ics`-länken
- skapar nya bokningar
- uppdaterar ändrade bokningar
- tar bort bokningar som försvunnit ur TimeEdit
- visar lärare i Google Calendars positionsfält
- använder TimeEdit-data som rubrik, aktivitet, lokal, hus, kurskod m.m.
- hanterar gruppintervall som `#101-130`
- använder olika färger beroende på aktivitet
- använder Birch för bokningar som tillhör andra grupper än nummer 103
- begränsar antalet ändringar per körning för att undvika Googles rate-limit

Den automatiska synken körs normalt var 15:e minut via en Apps Script-trigger.

---

## 2. Läsårskalender 2026/2027

Funktionen:

`addAcademicYear2026_2027()`

skapar eller återanvänder en separat kalender:

`Chalmers Läsår 26/27`

och lägger in följande typer av datum:

- höstterminen 2026
- vårterminen 2027
- läsperiod 1–4
- tentamensperiod 1–4
- omtentamensperioder
- tentamensanmälan
- självstudieperioder
- CHARM
- övriga datum som finns i Chalmers läsårsplanering

### Färger i läsårskalendern

Följande får färgen **Birch**:

- `Tentamensperiod ...`
- `Omtentamensperiod ...`

Följande får **inte** Birch:

- `Tentamensanmälan ...`

Övriga läsårsaktiviteter använder kalenderns vanliga färg.

Funktionen är dublettsäker: om den körs igen försöker den återanvända redan skapade aktiviteter i stället för att skapa samma event en gång till.

---

# Var koden körs

Koden körs i **Google Apps Script** dvs https://script.google.com 

Öppna projektet som innehåller filen:

`Code.gs`

Google Apps Script öppnas normalt från:

- Google Drive → Apps Script-projektet, eller
- den Apps Script-länk där projektet skapades

---

# Hur man kör TimeEdit-synken manuellt

1. Öppna Apps Script-projektet.
2. Öppna `Code.gs`.
3. Klicka på **Save**.
4. I funktionsmenyn högst upp, välj:

   `syncTimeEdit`

5. Klicka på **Run**.

I körningsloggen visas resultatet, till exempel:

`KLAR | TimeEdit totalt: ... | Skapade: ... | Uppdaterade: ...`

Normalt behöver detta inte göras manuellt eftersom triggern kör funktionen automatiskt var 15:e minut.

---

# Hur man lägger in läsåret 2026/2027

Detta görs normalt **en gång**.

1. Öppna Apps Script-projektet.
2. Öppna `Code.gs`.
3. Klicka på **Save**.
4. Öppna funktionsmenyn högst upp.
5. Välj:

   `addAcademicYear2026_2027`

6. Klicka på **Run**.
7. Godkänn Google-behörigheter om Google frågar.
8. Öppna Google Calendar.

Efter körningen ska kalendern:

`Chalmers Läsår 26/27`

finnas bland dina kalendrar.

I körningsloggen ska något i stil med detta visas:

`CHALMERS LÄSÅR KLART | Kalender: Chalmers Läsår 26/27 | Skapade: ... | Fanns redan: ... | Birch applicerad: ...`

---

# Setup-funktionen

Funktionen:

`setup()`

används för att:

- skapa TimeEdit-kalendern om den saknas
- sätta tidszon
- ta bort eventuell gammal `syncTimeEdit`-trigger
- skapa en ny trigger som kör `syncTimeEdit()` var 15:e minut
- köra en första synkning direkt

Kör normalt **inte `setup()` igen** om triggern redan fungerar.

Att köra `setup()` igen återskapar triggern.

---

# Automatisk trigger

Den automatiska TimeEdit-synken ska vara konfigurerad ungefär så här:

- funktion: `syncTimeEdit`
- typ: Time-driven
- intervall: var 15:e minut

Triggern kan kontrolleras i Apps Script via:

**Triggers** / klocksymbolen i vänstermenyn.

---

# Viktiga funktioner

| Funktion | Syfte |
|---|---|
| `syncTimeEdit()` | Synkroniserar TimeEdit till `SBVII Chalmers TE` |
| `setup()` | Skapar/återskapar 15-minuterstriggern |
| `addAcademicYear2026_2027()` | Skapar läsårskalendern och lägger in läsårsdatum |
| `debugTimeEdit()` | Skriver ut parserresultat för felsökning |

---

# Viktiga kalendrar

## SBVII Chalmers TE

Automatiskt synkroniserat schema från TimeEdit.

Den här kalendern uppdateras av:

`syncTimeEdit()`

## Chalmers Läsår 26/27

Separat kalender med läsperioder, tentamensperioder, omtentamen, självstudier och övriga läsårsdatum.

Den här kalendern skapas/fylls av:

`addAcademicYear2026_2027()`

Den påverkas inte av den vanliga 15-minuters TimeEdit-synken.

---

# Birch-färg

Scriptet använder Google Calendars nya event-label-system för Birch.

Birch-färgen är:

`#A79B8E`

Den används bland annat för:

- TimeEdit-bokningar som gäller andra gruppintervall än nummer 103
- tentamensperioder i läsårskalendern
- omtentamensperioder i läsårskalendern

---

# Om Google frågar om behörighet

Första gången en funktion använder Calendar API eller skapar en kalender kan Google be om behörighet.

Välj då ditt Google-konto och godkänn de behörigheter som scriptet behöver.

Detta krävs bland annat för att:

- läsa och skriva kalenderhändelser
- skapa kalendrar
- sätta färger/labels
- använda TimeEdit-länken via `UrlFetchApp`

---

# Felsökning

## Läsårskalendern syns inte

Kör:

`addAcademicYear2026_2027()`

och kontrollera körningsloggen.

## TimeEdit uppdateras inte

Kontrollera:

1. att `syncTimeEdit()` kan köras manuellt
2. att `.ics`-länken i `CONFIG.ICAL_URL` fortfarande fungerar
3. att 15-minuterstriggern finns
4. Apps Script → **Executions** för eventuella fel

## Bara en del nya TimeEdit-events dyker upp

Det kan vara normalt.

Scriptet har:

`MAX_CHANGED_EVENTS_PER_RUN: 20`

för att undvika Googles rate-limit. Om många events behöver skapas eller ändras fortsätter nästa 15-minuterskörning.

## Läsårsdatum råkar köras två gånger

`addAcademicYear2026_2027()` är byggd för att kontrollera befintliga events och undvika dubletter.

---

# Normal användning

Efter att allt är installerat är den normala arbetsgången:

- låt `syncTimeEdit()` köra automatiskt var 15:e minut
- kör `addAcademicYear2026_2027()` en gång för läsåret
- kör `setup()` endast om triggern behöver återskapas
- använd `debugTimeEdit()` vid felsökning
