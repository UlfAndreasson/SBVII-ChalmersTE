/*
 * ============================================================
 * Chalmers TimeEdit -> Google Calendar
 * ============================================================
 *
 * Personligt schema för SBVII
 *
 * Mitt nummer: 103
 *
 * Gruppfilter:
 * #101-130  -> JA
 * #101-115  -> JA
 * #116-130  -> NEJ
 * #131-160  -> NEJ
 * osv.
 *
 * Ingen gruppangivelse -> JA
 *
 * Titel: Rubrik · Aktivitet · Lokal: XXX · Hus: XXX
 *
 * Position: Lärare / personal
 *
 * Automatisk synk: var 15:e minut
 * ============================================================
 */

const CONFIG = {

  /*
   * VIKTIGT:
   *
   * Lägg här prenumerationslänken från TimeEdit som
   * omfattar HELA terminen, inte "Rullande 4 veckor".
   */
  ICAL_URL:
    'LÄNK_TILL_Timeedit',

  CALENDAR_NAME:
    'SBVII Chalmers TE', 

  TIME_ZONE:
    'Europe/Stockholm',

  /*
   * Din grupp/personnummerindelning.
   */
  MY_NUMBER:
    103,

  /*
   * Automatisk uppdatering.
   */
  SYNC_MINUTES:
    15,

  /*
   * Intern märkning av våra Google-events.
   */
  TAG_NAME:
    'timeeditUid',

  COLOR_TAG_NAME:
    'timeeditColorKeyV3',

  /*
   * Skyddar mot Googles tillfälliga rate-limit.
   *
   * Om t.ex. 70 nya events ska läggas till sker det
   * över flera 15-minuterskörningar.
   */
  MAX_CHANGED_EVENTS_PER_RUN:
    20,

  /*
   * Nya fulla TimeEdit-feeden innehåller Hus.
   *
   * true:
   * Lokal: Jupiter121 · Hus: Jupiter
   *
   * false:
   * Lokal: Jupiter121
   */
  SHOW_HUS_IN_TITLE:
    true,

  /*
   * Kursnamn som vi redan känner till.
   *
   * Används bara som fallback när TimeEdit inte skickar
   * någon specifik Rubrik för bokningen.
   */
  COURSE_NAMES: {

    'SJM005_50_HT26_75126':
      'Terrester navigation och sjömanskap',

    'SJO855_50_HT26_83114':
      'Marina maskinsystem 1',

    'SJO865_25_HT26_83115':
      'Fartygsstabilitet och fartygskonstruktion',

    'MMS250_50_HT26_83118':
      'El- och reglerteknik'
  },

  /*
   * ==========================================================
   * GOOGLE CALENDAR EVENT COLORS
   * ==========================================================
   *
   * 1  = Lavender / Pale Blue
   * 2  = Sage / Pale Green
   * 3  = Grape / Purple
   * 4  = Flamingo / Pale Red
   * 5  = Banana / Yellow
   * 6  = Tangerine / Orange
   * 7  = Peacock / Cyan
   * 8  = Graphite / Gray
   * 9  = Blueberry / Blue
   * 10 = Basil / Green
   * 11 = Tomato / Red
   * BIRCH = custom event label (#A79B8E)
   */

  COLORS: {
    LECTURE_SBVII: 
      '5',

    LECTURE_SHARED_TSJKL:
      '5',

    TICKING:
      '2',

    KARAKTIVITET:
      'BIRCH',

    SIMULERING:
      '7',

    OVNING:
      '1',

    LABORATION:
      '10',

    STUDIEBESOK:
      '9',

    DUGGA:
      '4',

    KURSNAMND:
      'BIRCH',

    OBLIGATORISK:
      '4',

    DEFAULT:
      '5', 

    OTHER_GROUP:
      'BIRCH',
  },

  CUSTOM_LABELS: {
  BIRCH: {
    name: 'Birch',
    backgroundColor: '#A79B8E'
    }
  },

};


/*
 * ============================================================
 * FÄLT SOM TIMEEDIT KAN SKICKA
 * ============================================================
 */

const FIELD_LABELS = [

  'Rubrik',
  'Aktivitet',

  'Lokalnamn',
  'Lokaltyp',
  'Kartlänk',
  'Antal datorer',
  'Hus',
  'Campus',

  'Kurskod',
  'Kursnamn',

  'Klasskod',
  'Klassnamn',

  'Personal'
];


/*
 * ============================================================
 * SETUP
 *
 * Kör endast om du vill:
 *
 * - skapa kalendern
 * - återskapa 15-minuterstriggern
 *
 * Du har redan en trigger, så normalt behöver du INTE
 * köra setup igen.
 * ============================================================
 */

function setup() {

  validateConfig_();

  const calendar =
    getCalendar_();

  calendar
    .setTimeZone(
      CONFIG.TIME_ZONE
    )
    .setDescription(
      'Automatiskt synkroniserat schema från Chalmers TimeEdit'
    )
    .setSelected(true);


  /*
   * Ta bort gammal sync-trigger.
   */
  ScriptApp
    .getProjectTriggers()
    .forEach(trigger => {

      if (
        trigger.getHandlerFunction() ===
        'syncTimeEdit'
      ) {

        ScriptApp.deleteTrigger(
          trigger
        );
      }

    });


  /*
   * Skapa ny.
   */
  ScriptApp
    .newTrigger(
      'syncTimeEdit'
    )
    .timeBased()
    .everyMinutes(
      CONFIG.SYNC_MINUTES
    )
    .create();


  /*
   * Kör direkt.
   */
  syncTimeEdit();
}


/*
 * ============================================================
 * SYNKRONISERING
 * ============================================================
 */

function syncTimeEdit() {

  validateConfig_();


  const lock =
    LockService.getScriptLock();


  if (
    !lock.tryLock(30000)
  ) {

    console.log(
      'En annan synkning kör redan.'
    );

    return;
  }


  try {

    const calendar =
      getCalendar_();


    /*
     * Hämta iCal.
     */
    const ics =
      fetchIcs_();


    /*
     * Parse.
     */
    const parsed =
      parseICS_(ics);


    /*
     * ========================================================
     * ALLA GILTIGA TIMEEDIT-BOKNINGAR
     * ========================================================
     */

    const allTimeEditEvents =
      parsed.filter(e => {


        if (
          !e.start ||
          !e.end ||
          !e.uid ||
          e.status === 'CANCELLED'
        ) {

          return false;
        }


        /*
         * Hantera trasig start/sluttid.
         */
        if (
          e.end.getTime() <=
          e.start.getTime()
        ) {


          if (e.allDay) {

            e.end =
              new Date(
                e.start.getTime() +
                24 *
                60 *
                60 *
                1000
              );

            return true;
          }


          console.log(
            'HOPPAR ÖVER ogiltig tid: ' +
            (
              e.summary ||
              e.uid
            )
          );


          return false;
        }


        return true;
      });


    if (
      !allTimeEditEvents.length
    ) {

      throw new Error(
        'Inga giltiga TimeEdit-events hittades.'
      );
    }


    /*
     * ========================================================
     * PERSONLIGT GRUPPFILTER
     *
     * 103 måste ligga INOM angivet intervall.
     * ========================================================
     */

    const timeEditEvents =
      allTimeEditEvents;


    /*
     * ========================================================
     * DATUMINTERVALL
     *
     * OBS:
     * Vi använder ALLA TimeEdit-events här,
     * inte bara grupp 103.
     *
     * Det gör att gamla felaktiga gruppbokningar
     * kan tas bort korrekt.
     * ========================================================
     */

    const firstDate =
      new Date(
        Math.min(
          ...allTimeEditEvents.map(
            e =>
              e.start.getTime()
          )
        )
      );


    const lastDate =
      new Date(
        Math.max(
          ...allTimeEditEvents.map(
            e =>
              e.end.getTime()
          )
        )
      );


    const searchStart =
      new Date(
        firstDate.getTime() -
        24 *
        60 *
        60 *
        1000
      );


    const searchEnd =
      new Date(
        lastDate.getTime() +
        24 *
        60 *
        60 *
        1000
      );


    /*
     * ========================================================
     * BEFINTLIGA GOOGLE EVENTS
     * ========================================================
     */

    const existingEvents =
      calendar.getEvents(
        searchStart,
        searchEnd
      );


    const existingByUid = {};


    existingEvents
      .forEach(event => {


        const uid =
          event.getTag(
            CONFIG.TAG_NAME
          );


        if (uid) {

          existingByUid[uid] =
            event;
        }

      });


    /*
     * UID som SKA finnas efter gruppfiltret.
     */
    const activeUids = {};


    /*
     * Statistik.
     */
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let deleted = 0;
    let deferred = 0;


    /*
     * Antal events vi faktiskt ändrat under
     * just denna körning.
     */
    let changedEvents = 0;


    /*
     * ========================================================
     * SKAPA / UPPDATERA
     * ========================================================
     */

    timeEditEvents
      .forEach(te => {


        activeUids[te.uid] =
          true;


        /*
         * Tolka TimeEdit-datan.
         */
        const details =
          extractDetails_(te);


        /*
         * Titel.
         */
        const title =
          buildTitle_(
            details,
            te
          );


        /*
        * Google Calendar "Position":
        * visa lärare istället för kartlänken.
        */
        const location =
          getTeachers_(
            te,
            details
          );

        /*
         * Beskrivning.
         */
        const description =
          buildDescription_(
            details,
            te
          );


        /*
         * Färg.
         */
        const colorId =
          getEventColor_(
            details,
            te
          );


        let event =
          existingByUid[
            te.uid
          ];


        /*
         * ====================================================
         * NY BOKNING
         * ====================================================
         */

        if (!event) {


          if (
            changedEvents >=
            CONFIG.MAX_CHANGED_EVENTS_PER_RUN
          ) {

            deferred++;

            return;
          }


          if (te.allDay) {


            event =
              calendar
                .createAllDayEvent(
                  title,
                  te.start,
                  te.end,
                  {
                    description:
                      description,

                    location:
                      location
                  }
                );

          }

          else {


            event =
              calendar.createEvent(
                title,
                te.start,
                te.end,
                {
                  description:
                    description,

                  location:
                    location
                }
              );

          }


          /*
           * Intern TimeEdit UID.
           */
          event.setTag(
            CONFIG.TAG_NAME,
            te.uid
          );


          /*
           * Färg.
           */
          applyEventColor_(
            calendar,
            event,
            colorId
          );


          created++;

          changedEvents++;


          console.log(
            'SKAPA: ' +
            title
          );


          return;
        }


        /*
         * ====================================================
         * BEFINTLIG BOKNING
         *
         * Kontrollera ALLT först.
         * Skriv bara om något verkligen ändrats.
         * ====================================================
         */

        const needsTitle =
          event.getTitle() !==
          title;


        const needsDescription =
          (
            event.getDescription() ||
            ''
          ) !==
          (
            description ||
            ''
          );


        const needsLocation =
          (
            event.getLocation() ||
            ''
          ) !==
          (
            location ||
            ''
          );


        const needsColor =
          eventColorDiffers_(
            calendar,
            event,
            colorId
          );

        const needsTime =
          eventTimeDiffers_(
            event,
            te
          );


        const needsUpdate =
          needsTitle ||
          needsDescription ||
          needsLocation ||
          needsColor ||
          needsTime;


        /*
         * Inget har ändrats.
         */
        if (!needsUpdate) {

          unchanged++;

          return;
        }


        /*
         * Vänta till nästa 15-minuterskörning
         * om vi redan gjort många ändringar.
         */
        if (
          changedEvents >=
          CONFIG.MAX_CHANGED_EVENTS_PER_RUN
        ) {

          deferred++;

          return;
        }


        /*
         * Uppdatera ENDAST det som ändrats.
         */

        if (needsTitle) {

          event.setTitle(
            title
          );
        }


        if (needsDescription) {

          event.setDescription(
            description
          );
        }


        if (needsLocation) {

          event.setLocation(
            location
          );
        }


        if (needsTime) {


          if (te.allDay) {

            event.setAllDayDates(
              te.start,
              te.end
            );

          }

          else {

            event.setTime(
              te.start,
              te.end
            );
          }

        }


        /*
         * VIKTIGT:
         * Färg/label appliceras SIST.
         * CalendarApp-skrivningar efter en custom label kan annars
         * återställa eventets gamla legacy-färg.
         */
        if (needsColor) {

          applyEventColor_(
            calendar,
            event,
            colorId
          );
        }


        updated++;

        changedEvents++;


        console.log(
          'UPPDATERA: ' +
          title
        );

      });


    /*
     * ========================================================
     * TA BORT SÅDANT SOM INTE LÄNGRE SKA FINNAS
     *
     * Detta inkluderar:
     *
     * - bokning borttagen från TimeEdit
     * - bokning som tillhör annan grupp än 103
     * ========================================================
     */

    Object
      .keys(
        existingByUid
      )
      .forEach(uid => {


        /*
         * Ska fortfarande finnas.
         */
        if (
          activeUids[uid]
        ) {

          return;
        }


        const event =
          existingByUid[
            uid
          ];


        const start =
          event.getStartTime();


        /*
         * Rör inte events utanför den period
         * som aktuell TimeEdit-feed omfattar.
         */
        if (
          start < firstDate ||
          start > lastDate
        ) {

          return;
        }


        /*
         * Rate-limit protection.
         */
        if (
          changedEvents >=
          CONFIG.MAX_CHANGED_EVENTS_PER_RUN
        ) {

          deferred++;

          return;
        }


        console.log(
          'TA BORT: ' +
          event.getTitle()
        );


        event.deleteEvent();


        deleted++;

        changedEvents++;

      });


    /*
     * ========================================================
     * LOGG
     * ========================================================
     */

    console.log(
      'KLAR' +

      ' | TimeEdit totalt: ' +
      allTimeEditEvents.length +

      ' | För nummer ' +
      CONFIG.MY_NUMBER +
      ': ' +
      timeEditEvents.length +

      ' | Skapade: ' +
      created +

      ' | Uppdaterade: ' +
      updated +

      ' | Oförändrade: ' +
      unchanged +

      ' | Borttagna: ' +
      deleted +

      ' | Väntar till nästa körning: ' +
      deferred
    );

  }

  finally {

    lock.releaseLock();

  }

}


/*
 * ============================================================
 * GRUPPFILTER
 * ============================================================
 *
 * Exempel för MY_NUMBER = 103:
 *
 * #101-130 -> TRUE
 * #101-115 -> TRUE
 * #101-108 -> TRUE
 * #109-115 -> FALSE
 * #116-130 -> FALSE
 * #131-160 -> FALSE
 *
 * Ingen #xxx-yyy -> TRUE
 */

function matchesMyGroup_(
  te
) {


  const ranges =
    getGroupRanges_(te);


  /*
   * Ingen gruppspecificering:
   * gäller hela klassen.
   */
  if (
    !ranges.length
  ) {

    return true;
  }


  /*
   * 103 måste finnas i minst ett intervall.
   */
  return ranges.some(
    range =>

      CONFIG.MY_NUMBER >=
      range.from

      &&

      CONFIG.MY_NUMBER <=
      range.to
  );

}


/*
 * ============================================================
 * HÄMTA GRUPPINTERVALL
 * ============================================================
 */

function getGroupRanges_(
  te
) {


  const text =
    [
      te.summary ||
      '',

      te.description ||
      '',

      te.location ||
      ''
    ]
      .join('\n');


  /*
   * Matchar:
   *
   * #101-130
   * #101 - 130
   * Rubrik#101-130
   */
  const regex =
    /#\s*(\d{1,3})\s*-\s*(\d{1,3})/g;


  const ranges = [];

  const seen = {};


  let match;


  while (
    (
      match =
        regex.exec(text)
    ) !== null
  ) {


    const key =
      match[1] +
      '-' +
      match[2];


    if (
      seen[key]
    ) {

      continue;
    }


    seen[key] =
      true;


    ranges.push({

      from:
        Number(
          match[1]
        ),

      to:
        Number(
          match[2]
        )

    });

  }


  return ranges;

}


/*
 * ============================================================
 * FÄRG
 * ============================================================
 */

function getEventColor_(
  details,
  te
) {

    /*
   * Gruppindelad bokning som INTE gäller nummer 103
   * = grå.
   *
   * Bokningar utan #xxx-yyy påverkas inte.
   */
  const ranges =
    getGroupRanges_(te);

  if (
    ranges.length > 0 &&
    !matchesMyGroup_(te)
  ) {
    return CONFIG.COLORS.OTHER_GROUP;
  }

  const activities =
    (
      details.Aktivitet ||
      []
    )
      .map(
        x =>
          x.toLowerCase()
      );


  const classCodes =
    (
      details.Klasskod ||
      []
    )
      .map(
        x =>
          x.toUpperCase()
      );


  const hasActivity =
    word =>
      activities.some(
        a =>
          a.includes(
            word
          )
      );


  /*
   * Prioritet:
   *
   * specialaktiviteter först.
   */


  /*
   * Kåraktivitet = lila.
   */
  if (
    hasActivity(
      'kåraktivitet'
    )
  ) {

    return (
      CONFIG.COLORS
        .KARAKTIVITET
    );
  }


  /*
   * Ticking = ljusgrön.
   */
  if (
    hasActivity(
      'ticking'
    )
  ) {

    return (
      CONFIG.COLORS
        .TICKING
    );
  }


  /*
   * Simulering = cyan.
   */
  if (
    hasActivity(
      'simulering'
    )
  ) {

    return (
      CONFIG.COLORS
        .SIMULERING
    );
  }


  /*
   * Laboration = grön.
   */
  if (
    hasActivity(
      'laboration'
    )
  ) {

    return (
      CONFIG.COLORS
        .LABORATION
    );
  }


  /*
   * Övning = ljusblå.
   */
  if (
    hasActivity(
      'övning'
    )
  ) {

    return (
      CONFIG.COLORS
        .OVNING
    );
  }


  /*
   * Studiebesök = blå.
   */
  if (
    hasActivity(
      'studiebesök'
    )
  ) {

    return (
      CONFIG.COLORS
        .STUDIEBESOK
    );
  }


  /*
   * Dugga = ljusröd.
   */
  if (
    hasActivity(
      'kursadministrerad dugga'
    )
  ) {

    return (
      CONFIG.COLORS
        .DUGGA
    );
  }


  /*
   * Kursnämnd = grå.
   */
  if (
    hasActivity(
      'kursnämndsmöte'
    )
  ) {

    return (
      CONFIG.COLORS
        .KURSNAMND
    );
  }


  /*
   * ==========================================================
   * FÖRELÄSNING
   * ==========================================================
   */

  if (
    hasActivity(
      'föreläsning'
    )
  ) {


    const hasSBVII =
      classCodes.includes(
        'SBVII-1'
      );


    const hasTSJKL =
      classCodes.includes(
        'TSJKL-1'
      );


    /*
     * SBVII + Sjökapten
     * = orange.
     */
    if (
      hasSBVII &&
      hasTSJKL
    ) {

      return (
        CONFIG.COLORS
          .LECTURE_SHARED_TSJKL
      );
    }


    /*
     * Bara SBVII
     * = svagt gul.
     */
    if (hasSBVII) {

      return (
        CONFIG.COLORS
          .LECTURE_SBVII
      );
    }


    return (
      CONFIG.COLORS
        .LECTURE_SBVII
    );

  }


  /*
   * Obligatorisk närvaro som inte redan
   * klassificerats som simulering/lab osv.
   */
  if (
    hasActivity(
      'obligatorisk närvaro'
    )
  ) {

    return (
      CONFIG.COLORS
        .OBLIGATORISK
    );
  }


  /*
   * Default.
   */
  return (
    CONFIG.COLORS
      .DEFAULT
  );

}


/*
 * ============================================================
 * TITEL
 * ============================================================
 *
 * Exempel:
 *
 * COLREGS 1
 * · Föreläsning
 * · Lokal: Omega
 * · Hus: Jupiter
 */

function buildTitle_(
  details,
  te
) {

  const rubrik =
    deriveRubrik_(
      details,
      te
    );

  const activities =
    details.Aktivitet ||
    [];

  /*
   * Använd parsad Lokalnamn först.
   * Om parsern missat det, hämta direkt från rå TimeEdit-data.
   */
  const lokal =
    first_(
      details,
      'Lokalnamn'
    )
    ||
    getRawField_(
      te,
      'Lokalnamn'
    );

  const hus =
    first_(
      details,
      'Hus'
    )
    ||
    getRawField_(
      te,
      'Hus'
    );

  const parts = [];

  if (rubrik) {
    parts.push(rubrik);
  }

  if (activities.length) {

    const activityText =
      activities
        .filter(unique_)
        .join(' / ');

    if (
      activityText &&
      activityText !== rubrik
    ) {
      parts.push(
        activityText
      );
    }
  }

  if (lokal) {
    parts.push(
      'Lokal: ' +
      lokal
    );
  }

  if (
    CONFIG.SHOW_HUS_IN_TITLE &&
    hus
  ) {
    parts.push(
      'Hus: ' +
      hus
    );
  }

  return parts.join(
    ' · '
  );
}


/*
 * ============================================================
 * BESTÄM RUBRIK
 * ============================================================
 *
 * Nya TimeEdit-feeden har ofta SUMMARY tom.
 *
 * Informationen ligger istället t.ex.:
 *
 * Kurskod: SJM005...
 * Aktivitet: Föreläsning
 * COLREGS 1
 * Lokalnamn: Omega
 *
 * Då blir Rubrik = COLREGS 1.
 */

function deriveRubrik_(
  details,
  te
) {


  /*
   * Explicit Rubrik om sådan finns.
   */
  const explicit =
    first_(
      details,
      'Rubrik'
    );


  if (explicit) {

    return cleanText_(
      explicit
    );
  }


  /*
   * Leta efter första vanliga textraden
   * före Lokalnamn/Klasskod.
   *
   * Detta fångar:
   *
   * COLREGS 1
   * Tick 1
   * #101-130, Besticksprov
   * Rocken
   * Intro & likström
   * osv.
   */
  const sources =
    [
      te.summary ||
      '',

      te.location ||
      ''
    ];


  for (
    const source of
    sources
  ) {


    if (!source) {

      continue;
    }


    const lines =
      normalizeTimeEditText_(
        source
      )
        .split('\n')
        .map(
          cleanText_
        )
        .filter(Boolean);


    for (
      const line of
      lines
    ) {


      /*
       * Efter detta börjar strukturell data,
       * så vi slutar leta Rubrik.
       */
      if (
        /^(Lokalnamn|Klasskod)\s*:/i
          .test(line)
      ) {

        break;
      }


      /*
       * Hoppa över:
       *
       * Kurskod:
       * Aktivitet:
       * osv.
       */
      if (
        isKnownFieldLine_(
          line
        )
      ) {

        continue;
      }


      if (
        isUrl_(
          line
        )
      ) {

        continue;
      }


      if (
        /^ID\s+\d+/i
          .test(line)
      ) {

        continue;
      }


      return cleanRubrik_(
        line
      );

    }

  }


  /*
   * Kursnamn från TimeEdit.
   */
  const kursnamn =
    first_(
      details,
      'Kursnamn'
    );


  if (kursnamn) {

    return cleanText_(
      kursnamn
    );
  }


  /*
   * Kursnamn från vår kontrollerade mapping.
   */
  const mappedCourseName =
    getMappedCourseName_(
      details
    );


  if (
    mappedCourseName
  ) {

    return mappedCourseName;
  }


  /*
   * Sista fallback:
   * Aktivitet.
   */
  const aktivitet =
    first_(
      details,
      'Aktivitet'
    );


  if (aktivitet) {

    return cleanText_(
      aktivitet
    );
  }


  return 'TimeEdit';

}


/*
 * ============================================================
 * KURSNAMN FRÅN KURSKOD
 * ============================================================
 */

function getMappedCourseName_(
  details
) {


  const courseCodes =
    details.Kurskod ||
    [];


  for (
    const code of
    courseCodes
  ) {


    const clean =
      cleanText_(
        code
      );


    if (
      CONFIG.COURSE_NAMES[
        clean
      ]
    ) {

      return (
        CONFIG.COURSE_NAMES[
          clean
        ]
      );
    }

  }


  return '';

}


/*
 * ============================================================
 * BESKRIVNING INNE I EVENTET
 * ============================================================
 */

function buildDescription_(
  details,
  te
) {


  const rubrik =
    deriveRubrik_(
      details,
      te
    );


  const mapLink =
    getMapLink_(
      te,
      details
    );


  const ranges =
    getGroupRanges_(
      te
    );


  const lines = [];


  lines.push(
    'Rubrik: ' +
    rubrik
  );


  addDescriptionField_(
    lines,
    'Aktivitet',
    details.Aktivitet
  );


  addDescriptionField_(
    lines,
    'Lokalnamn',
    details.Lokalnamn
  );


  addDescriptionField_(
    lines,
    'Lokaltyp',
    details.Lokaltyp
  );


  if (mapLink) {

    lines.push(
      'Kartlänk: ' +
      mapLink
    );
  }


  addDescriptionField_(
    lines,
    'Hus',
    details.Hus
  );


  addDescriptionField_(
    lines,
    'Campus',
    details.Campus
  );


  addDescriptionField_(
    lines,
    'Kurskod',
    details.Kurskod
  );


  /*
   * Visa TimeEdit-kursnamn om det finns.
   *
   * Annars mapped course name.
   */
  if (
    details.Kursnamn &&
    details.Kursnamn.length
  ) {

    addDescriptionField_(
      lines,
      'Kursnamn',
      details.Kursnamn
    );

  }

  else {


    const mapped =
      getMappedCourseName_(
        details
      );


    if (mapped) {

      lines.push(
        'Kursnamn: ' +
        mapped
      );
    }

  }


  addDescriptionField_(
    lines,
    'Klasskod',
    details.Klasskod
  );


  addDescriptionField_(
    lines,
    'Klassnamn',
    details.Klassnamn
  );


  /*
   * Gruppinformation.
   */
  if (
    ranges.length
  ) {


    lines.push(
      'Gruppintervall: ' +
      ranges
        .map(
          r =>
            '#' +
            r.from +
            '-' +
            r.to
        )
        .join(', ')
    );


    lines.push(
      'Mitt nummer: ' +
      CONFIG.MY_NUMBER
    );

  }


  /*
   * Övrig TimeEdit-text:
   *
   * t.ex.
   *
   * lärare
   * kommentarer
   * boka via Canvas
   * "Kommer flyttas..."
   */
  const extra =
    extractExtraInfo_(
      te,
      rubrik
    );


  if (
    extra.length
  ) {


    lines.push('');

    lines.push(
      'Övrigt:'
    );


    extra.forEach(
      x =>
        lines.push(
          '• ' +
          x
        )
    );

  }


  lines.push('');


  lines.push(
    'TimeEdit-ID: ' +
    te.uid
  );


  /*
   * Original URL om TimeEdit har en.
   *
   * OBS:
   * kan ibland vara Forms-länk istället för kartlänk.
   */
  if (te.url) {

    lines.push(
      'TimeEdit-URL: ' +
      te.url
    );
  }


  return lines.join(
    '\n'
  );

}


/*
 * ============================================================
 * EXTRAHERA TIMEEDIT-DATA
 * ============================================================
 */

function extractDetails_(
  te
) {


  const details = {};


  const sources =
    [
      te.summary ||
      '',

      te.description ||
      '',

      te.location ||
      ''
    ];


  sources
    .forEach(source => {


      if (!source) {

        return;
      }


      const normalized =
        normalizeTimeEditText_(
          source
        );


      normalized
        .split('\n')
        .forEach(line => {


          const parsed =
            parseKnownFieldLine_(
              line
            );


          if (!parsed) {

            return;
          }


          const value =
            cleanFieldValue_(
              parsed.label,
              parsed.value
            );


          if (value) {

            addDetail_(
              details,
              parsed.label,
              value
            );
          }

        });

    });


  /*
   * Kartlänken har i nya feeden ofta ingen
   * "Kartlänk:"-etikett.
   *
   * Därför plockar vi URL separat.
   */
  const mapLink =
    getMapLink_(
      te,
      details
    );


  if (mapLink) {

    addDetail_(
      details,
      'Kartlänk',
      mapLink
    );
  }


  return details;

}


/*
 * ============================================================
 * NORMALISERA TIMEEDIT-TEXT
 * ============================================================
 *
 * Exempel:
 *
 * Lokalnamn: Omega. Lokaltyp: Hörsal.
 * https://maps...
 * Hus: Jupiter. Campus: Lindholmen
 *
 * blir enklare att parsa rad för rad.
 */

function normalizeTimeEditText_(
  text
) {


  let result =
    (
      text ||
      ''
    )
      .replace(
        /\r/g,
        ''
      );


  FIELD_LABELS
    .forEach(label => {


      const re =
        new RegExp(

          '\\s*\\.?\\s*' +

          escapeRegExp_(
            label
          ) +

          '\\s*:\\s*',

          'gi'
        );


      result =
        result.replace(
          re,
          '\n' +
          label +
          ': '
        );

    });


  return result

    .replace(
      /\n[ \t]+/g,
      '\n'
    )

    .replace(
      /\n{2,}/g,
      '\n'
    )

    .trim();

}


/*
 * ============================================================
 * PARSA KNOWN FIELD
 * ============================================================
 */

function parseKnownFieldLine_(
  line
) {


  const clean =
    cleanText_(
      line
    );


  for (
    const label of
    FIELD_LABELS
  ) {


    const re =
      new RegExp(

        '^' +

        escapeRegExp_(
          label
        ) +

        '\\s*:\\s*(.*)$',

        'i'
      );


    const match =
      clean.match(
        re
      );


    if (match) {

      return {

        label:
          label,

        value:
          match[1]

      };
    }

  }


  return null;

}


/*
 * ============================================================
 * STÄDA FIELD VALUE
 * ============================================================
 */

function cleanFieldValue_(
  label,
  value
) {


  let result =
    cleanText_(
      value ||
      ''
    );


  /*
   * Exempel:
   *
   * Lokaltyp: Hörsal. https://maps...
   *
   * -> Hörsal
   */
  if (
    label !==
    'Kartlänk'
  ) {


    result =
      result.replace(
        /\s*\.?\s*https?:\/\/\S+.*$/i,
        ''
      );

  }


  return result

    .replace(
      /[.;,]\s*$/,
      ''
    )

    .trim();

}


/*
 * ============================================================
 * ÖVRIG INFO
 * ============================================================
 */

function extractExtraInfo_(
  te,
  rubrik
) {


  const result = [];

  const seen = {};


  const sources =
    [
      te.summary ||
      '',

      te.location ||
      '',

      te.description ||
      ''
    ];


  sources
    .forEach(source => {


      if (!source) {

        return;
      }


      normalizeTimeEditText_(
        source
      )
        .split('\n')
        .forEach(line => {


          const value =
            cleanText_(
              line
            );


          if (!value) {

            return;
          }


          if (
            isKnownFieldLine_(
              value
            )
          ) {

            return;
          }


          if (
            isUrl_(
              value
            )
          ) {

            return;
          }


          if (
            /^ID\s+\d+/i
              .test(value)
          ) {

            return;
          }


          /*
           * Rubrik visas redan ovan.
           */
          if (
            cleanRubrik_(
              value
            ) ===
            cleanRubrik_(
              rubrik
            )
          ) {

            return;
          }


          if (
            seen[value]
          ) {

            return;
          }


          seen[value] =
            true;


          result.push(
            value
          );

        });

    });


  return result;

}


/*
 * ============================================================
 * KARTLÄNK
 * ============================================================
 */

function getMapLink_(
  te,
  details
) {


  /*
   * Redan extraherad.
   */
  const existing =
    first_(
      details,
      'Kartlänk'
    );


  if (
    existing &&
    /maps\.chalmers\.se/i
      .test(existing)
  ) {

    return existing;
  }


  /*
   * Leta i hela TimeEdit-datan.
   */
  const text =
    [
      te.location ||
      '',

      te.description ||
      '',

      te.url ||
      ''
    ]
      .join('\n');


  const match =
    text.match(
      /https:\/\/maps\.chalmers\.se\/#?[A-Za-z0-9-]+/i
    );


  if (match) {

    return match[0];
  }


  /*
   * URL-property kan själv vara kartlänken.
   */
  if (
    te.url &&
    /maps\.chalmers\.se/i
      .test(te.url)
  ) {

    return te.url;
  }


  return '';

}


/*
 * ============================================================
 * JÄMFÖR TID
 * ============================================================
 */

function eventTimeDiffers_(
  event,
  te
) {


  if (te.allDay) {


    return (

      !event.isAllDayEvent()

      ||

      !sameDate_(
        event.getAllDayStartDate(),
        te.start
      )

      ||

      !sameDate_(
        event.getAllDayEndDate(),
        te.end
      )

    );
  }


  return (

    event.isAllDayEvent()

    ||

    event
      .getStartTime()
      .getTime() !==
      te.start.getTime()

    ||

    event
      .getEndTime()
      .getTime() !==
      te.end.getTime()

  );

}


/*
 * ============================================================
 * DESCRIPTION FIELD
 * ============================================================
 */

function addDescriptionField_(
  lines,
  label,
  values
) {


  if (
    !values ||
    !values.length
  ) {

    return;
  }


  lines.push(

    label +
    ': ' +

    values
      .filter(
        unique_
      )
      .join(', ')

  );

}


/*
 * ============================================================
 * KNOWN FIELD?
 * ============================================================
 */

function isKnownFieldLine_(
  line
) {


  return FIELD_LABELS
    .some(label =>


      new RegExp(

        '^' +

        escapeRegExp_(
          label
        ) +

        '\\s*:',

        'i'

      )
        .test(
          line
        )

    );

}


/*
 * ============================================================
 * URL?
 * ============================================================
 */

function isUrl_(
  text
) {


  return (
    /^https?:\/\//i
      .test(
        (
          text ||
          ''
        )
          .trim()
      )
  );

}


/*
 * ============================================================
 * STÄDA RUBRIK
 * ============================================================
 */

function cleanRubrik_(
  text
) {


  return cleanText_(
    text ||
    ''
  )
    .replace(
      /[.;,]\s*$/,
      ''
    )
    .trim();

}


/*
 * ============================================================
 * DETALJVÄRDEN
 * ============================================================
 */

function addDetail_(
  object,
  label,
  value
) {


  if (
    !label ||
    !value
  ) {

    return;
  }


  if (
    !object[label]
  ) {

    object[label] = [];
  }


  if (
    !object[label]
      .includes(value)
  ) {

    object[label]
      .push(value);
  }

}


/*
 * ============================================================
 * FÖRSTA VÄRDE
 * ============================================================
 */

function first_(
  details,
  name
) {


  return (

    details[name]

    &&

    details[name].length

  )

    ? details[name][0]

    : '';

}


/*
 * ============================================================
 * UNIQUE
 * ============================================================
 */

function unique_(
  value,
  index,
  array
) {


  return (
    array.indexOf(
      value
    ) ===
    index
  );

}


/*
 * ============================================================
 * GOOGLE-KALENDER
 * ============================================================
 */

function getCalendar_() {


  const calendars =
    CalendarApp
      .getOwnedCalendarsByName(
        CONFIG.CALENDAR_NAME
      );


  if (
    calendars.length
  ) {

    return calendars[0];
  }


  const calendar =
    CalendarApp
      .createCalendar(
        CONFIG.CALENDAR_NAME
      );


  calendar
    .setTimeZone(
      CONFIG.TIME_ZONE
    );


  return calendar;

}


/*
 * ============================================================
 * HÄMTA ICS
 * ============================================================
 */

function fetchIcs_() {


  let url =
    CONFIG.ICAL_URL
      .trim();


  if (
    url.startsWith(
      'webcal://'
    )
  ) {


    url =
      'https://' +

      url.substring(
        'webcal://'.length
      );

  }


  const response =
    UrlFetchApp.fetch(

      url,

      {

        followRedirects:
          true,

        muteHttpExceptions:
          false
      }

    );


  return response
    .getContentText();

}


/*
 * ============================================================
 * ICAL PARSER
 * ============================================================
 */

function parseICS_(
  ics
) {


  /*
   * iCal folded lines.
   */
  const unfolded =
    ics.replace(
      /\r?\n[ \t]/g,
      ''
    );


  const lines =
    unfolded.split(
      /\r?\n/
    );


  const result = [];


  let event =
    null;


  lines
    .forEach(line => {


      if (
        line ===
        'BEGIN:VEVENT'
      ) {


        event = {};

        return;
      }


      if (
        line ===
        'END:VEVENT'
      ) {


        if (event) {


          const start =
            parseICalDate_(
              event.DTSTART
            );


          const end =
            parseICalDate_(
              event.DTEND
            );


          result.push({

            uid:
              value_(
                event.UID
              ),

            start:
              start
                ? start.date
                : null,

            end:
              end
                ? end.date
                : null,

            allDay:
              start
                ? start.allDay
                : false,

            summary:
              decodeICalText_(
                value_(
                  event.SUMMARY
                )
              ),

            description:
              decodeICalText_(
                value_(
                  event.DESCRIPTION
                )
              ),

            location:
              decodeICalText_(
                value_(
                  event.LOCATION
                )
              ),

            url:
              decodeICalText_(
                value_(
                  event.URL
                )
              ),

            status:
              value_(
                event.STATUS
              )

          });

        }


        event =
          null;


        return;
      }


      if (!event) {

        return;
      }


      const colon =
        line.indexOf(
          ':'
        );


      if (
        colon === -1
      ) {

        return;
      }


      const keyPart =
        line.substring(
          0,
          colon
        );


      const propertyValue =
        line.substring(
          colon + 1
        );


      const name =
        keyPart
          .split(';')[0];


      event[name] = {

        key:
          keyPart,

        value:
          propertyValue

      };

    });


  return result;

}


/*
 * ============================================================
 * PROPERTY VALUE
 * ============================================================
 */

function value_(
  property
) {


  return property
    ? property.value
    : '';

}


/*
 * ============================================================
 * DATUM / TID
 * ============================================================
 */

function parseICalDate_(
  property
) {


  if (!property) {

    return null;
  }


  const value =
    property.value;


  /*
   * Heldag.
   */
  if (
    /^\d{8}$/
      .test(value)
  ) {


    return {

      date:
        Utilities.parseDate(
          value,
          CONFIG.TIME_ZONE,
          'yyyyMMdd'
        ),

      allDay:
        true

    };
  }


  /*
   * UTC.
   *
   * Exempel:
   * 20260902T061500Z
   */
  if (
    /^\d{8}T\d{6}Z$/
      .test(value)
  ) {


    return {

      date:
        Utilities.parseDate(
          value,
          'UTC',
          "yyyyMMdd'T'HHmmss'Z'"
        ),

      allDay:
        false

    };
  }


  /*
   * Lokal tid med sekunder.
   */
  if (
    /^\d{8}T\d{6}$/
      .test(value)
  ) {


    return {

      date:
        Utilities.parseDate(
          value,
          CONFIG.TIME_ZONE,
          "yyyyMMdd'T'HHmmss"
        ),

      allDay:
        false

    };
  }


  /*
   * Lokal tid utan sekunder.
   */
  if (
    /^\d{8}T\d{4}$/
      .test(value)
  ) {


    return {

      date:
        Utilities.parseDate(
          value,
          CONFIG.TIME_ZONE,
          "yyyyMMdd'T'HHmm"
        ),

      allDay:
        false

    };
  }


  throw new Error(
    'Okänt TimeEdit-datumformat: ' +
    value
  );

}


/*
 * ============================================================
 * DECODE ICAL TEXT
 * ============================================================
 */

function decodeICalText_(
  text
) {


  if (!text) {

    return '';
  }


  return text

    .replace(
      /\\n/gi,
      '\n'
    )

    .replace(
      /\\,/g,
      ','
    )

    .replace(
      /\\;/g,
      ';'
    )

    .replace(
      /\\\\/g,
      '\\'
    )

    .trim();

}


/*
 * ============================================================
 * CLEAN TEXT
 * ============================================================
 */

function cleanText_(
  text
) {


  if (!text) {

    return '';
  }


  return text

    .replace(
      /[ \t]+/g,
      ' '
    )

    .trim();

}


/*
 * ============================================================
 * REGEX ESCAPE
 * ============================================================
 */

function escapeRegExp_(
  text
) {


  return text.replace(

    /[.*+?^${}()|[\]\\]/g,

    '\\$&'

  );

}


/*
 * ============================================================
 * SAME DATE
 * ============================================================
 */

function sameDate_(
  a,
  b
) {


  if (
    !a ||
    !b
  ) {

    return false;
  }


  return (

    Utilities.formatDate(
      a,
      CONFIG.TIME_ZONE,
      'yyyyMMdd'
    )

    ===

    Utilities.formatDate(
      b,
      CONFIG.TIME_ZONE,
      'yyyyMMdd'
    )

  );

}


/*
 * ============================================================
 * CONFIG CHECK
 * ============================================================
 */

function validateConfig_() {


  if (
    !CONFIG.ICAL_URL

    ||

    CONFIG.ICAL_URL
      .includes(
        'KLISTRA_IN'
      )
  ) {


    throw new Error(
      'Fyll i CONFIG.ICAL_URL med din live-prenumerationslänk från TimeEdit.'
    );

  }

}

/*
 * ============================================================
 * HÄMTA FÄLT DIREKT UR RÅ TIMEEDIT-DATA
 * ============================================================
 */

function getRawField_(
  te,
  fieldName
) {

  const text =
    [
      te.summary || '',
      te.location || '',
      te.description || ''
    ]
      .join('\n');

  const regex =
    new RegExp(
      escapeRegExp_(fieldName) +
      '\\s*:\\s*([^\\.\\n]+)',
      'i'
    );

  const match =
    text.match(regex);

  if (!match) {
    return '';
  }

  return cleanText_(
    match[1]
  );
}


/*
 * ============================================================
 * HÄMTA LÄRARE / PERSONAL
 * ============================================================
 */

function getTeachers_(
  te,
  details
) {

  /*
   * Om Personal någon gång exporteras som eget fält.
   */
  if (
    details.Personal &&
    details.Personal.length
  ) {
    return details.Personal
      .filter(unique_)
      .join(', ');
  }


  /*
   * I Chalmers TimeEdit ligger lärarna normalt som
   * fria rader efter Klasskod.
   */
  const text =
    normalizeTimeEditText_(
      te.location || ''
    );

  const lines =
    text
      .split('\n')
      .map(cleanText_)
      .filter(Boolean);

  const teachers = [];

  let afterClassCode =
    false;

  lines.forEach(line => {

    /*
     * När vi når Klasskod börjar lärardelen snart.
     */
    if (
      /^Klasskod\s*:/i.test(line)
    ) {
      afterClassCode = true;
      return;
    }

    if (!afterClassCode) {
      return;
    }

    /*
     * Hoppa över andra strukturella TimeEdit-fält.
     */
    if (
      isKnownFieldLine_(line)
    ) {
      return;
    }

    if (
      isUrl_(line)
    ) {
      return;
    }

    if (
      /^ID\s+\d+/i.test(line)
    ) {
      return;
    }

    /*
     * Namn brukar bestå av minst förnamn + efternamn.
     */
    if (
      /^[A-ZÅÄÖ][A-Za-zÅÄÖåäöÉéÜüÀ-ÿ.'’-]+(?:\s+[A-ZÅÄÖ][A-Za-zÅÄÖåäöÉéÜüÀ-ÿ.'’-]+)+$/
        .test(line)
    ) {

      if (
        !teachers.includes(line)
      ) {
        teachers.push(line);
      }
    }

  });

  return teachers.join(', ');
}

/*
 * ============================================================
 * CUSTOM GOOGLE CALENDAR COLORS
 * ============================================================
 *
 * Vanliga eventfärger 1-11 använder CalendarApp.setColor().
 *
 * BIRCH använder Google Calendars nya event labels.
 * Google Calendar Birch = #A79B8E.
 *
 * Viktigt:
 * - eventLabelVersion=1 används när labeln skrivs.
 * - legacy colorId behöver inte tas bort; Google ignorerar det
 *   när eventLabelVersion=1 används.
 * - INGEN CalendarApp-skrivning får ske efter att Birch-labeln
 *   satts under samma eventuppdatering. Därför appliceras färgen
 *   sist i syncTimeEdit().
 * ============================================================
 */

let _customLabelCache = {};


/*
 * ============================================================
 * BEHÖVER FÄRGEN ÄNDRAS?
 * ============================================================
 */

function eventColorDiffers_(
  calendar,
  event,
  colorKey
) {

  const calendarId =
    calendar.getId();


  /*
   * Birch verifieras mot den faktiska eventLabelId som Google
   * Calendar API lagrat. Vi litar inte på äldre event-taggar.
   */
  if (
    colorKey === 'BIRCH'
  ) {

    const labelId =
      ensureBirchLabel_(
        calendarId
      );

    const apiEvent =
      getApiEvent_(
        calendarId,
        event
      );

    return (
      apiEvent.eventLabelId || ''
    ) !== labelId;
  }


  /*
   * Om vårt script tidigare satte Birch på eventet måste
   * custom label tas bort innan en vanlig 1-11-färg används.
   *
   * Script Properties används här eftersom de inte skriver till
   * själva Calendar-eventet och därför inte kan slå ut labeln.
   */
  const birchState =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        birchStateKey_(
          calendarId,
          event
        )
      );


  const oldTag =
    event.getTag(
      CONFIG.COLOR_TAG_NAME
    ) || '';


  if (
    birchState ||
    oldTag === 'BIRCH'
  ) {

    return true;
  }


  return (
    event.getColor() || ''
  ) !== colorKey;
}


/*
 * ============================================================
 * APPLICERA FÄRG
 * ============================================================
 */

function applyEventColor_(
  calendar,
  event,
  colorKey
) {

  const calendarId =
    calendar.getId();


  /*
   * ==========================================================
   * BIRCH
   * ==========================================================
   */
  if (
    colorKey === 'BIRCH'
  ) {

    const labelId =
      ensureBirchLabel_(
        calendarId
      );

    const apiEventId =
      findApiEventId_(
        calendarId,
        event
      );

    const path =
      'calendars/' +
      encodeURIComponent(
        calendarId
      ) +
      '/events/' +
      encodeURIComponent(
        apiEventId
      );


    /*
     * PATCH endast eventLabelId.
     * eventLabelVersion=1 gör att label-systemet används och
     * legacy colorId ignoreras av Google Calendar.
     */
    const updated =
      calendarApiRequest_(
        'patch',
        path +
        '?eventLabelVersion=1' +
        '&sendUpdates=none',
        {
          eventLabelId:
            labelId
        }
      );


    if (
      (
        updated.eventLabelId || ''
      ) !== labelId
    ) {

      throw new Error(
        'Google Calendar returnerade ingen giltig Birch-label för: ' +
        event.getTitle()
      );
    }


    /*
     * Verifiera med en separat GET så att vi vet att labeln
     * verkligen ligger kvar efter PATCH.
     */
    const verified =
      calendarApiRequest_(
        'get',
        path
      );


    if (
      (
        verified.eventLabelId || ''
      ) !== labelId
    ) {

      throw new Error(
        'Birch-labeln försvann efter PATCH för: ' +
        event.getTitle()
      );
    }


    /*
     * Spara bara i Script Properties. Detta ändrar INTE eventet.
     * Ingen CalendarApp-write får ske efter detta i samma varv.
     */
    PropertiesService
      .getScriptProperties()
      .setProperty(
        birchStateKey_(
          calendarId,
          event
        ),
        labelId
      );


    console.log(
      'BIRCH OK: ' +
      event.getTitle() +
      ' | label=' +
      labelId +
      ' | color=#A79B8E'
    );


    return;
  }


  /*
   * ==========================================================
   * NORMAL EVENTFÄRG 1-11
   * ==========================================================
   */

  const properties =
    PropertiesService
      .getScriptProperties();


  const stateKey =
    birchStateKey_(
      calendarId,
      event
    );


  const birchState =
    properties.getProperty(
      stateKey
    );


  const oldTag =
    event.getTag(
      CONFIG.COLOR_TAG_NAME
    ) || '';


  /*
   * Om eventet tidigare var Birch tar vi bort custom labeln.
   */
  if (
    birchState ||
    oldTag === 'BIRCH'
  ) {

    const apiEventId =
      findApiEventId_(
        calendarId,
        event
      );


    calendarApiRequest_(
      'patch',
      'calendars/' +
      encodeURIComponent(
        calendarId
      ) +
      '/events/' +
      encodeURIComponent(
        apiEventId
      ) +
      '?eventLabelVersion=1' +
      '&sendUpdates=none',
      {
        eventLabelId: ''
      }
    );


    properties.deleteProperty(
      stateKey
    );
  }


  /*
   * Vanlig Google Calendar eventfärg.
   */
  event.setColor(
    colorKey
  );


  event.setTag(
    CONFIG.COLOR_TAG_NAME,
    colorKey
  );
}


/*
 * ============================================================
 * SCRIPT-PROPERTY KEY FÖR BIRCH
 * ============================================================
 */

function birchStateKey_(
  calendarId,
  event
) {

  return (
    'timeeditBirch:' +
    calendarId +
    ':' +
    event.getId()
  );
}


/*
 * ============================================================
 * HITTA / SKAPA BIRCH-LABEL
 * ============================================================
 */

function ensureBirchLabel_(
  calendarId
) {

  const cacheKey =
    calendarId +
    ':BIRCH';


  if (
    _customLabelCache[
      cacheKey
    ]
  ) {

    return (
      _customLabelCache[
        cacheKey
      ]
    );
  }


  const wantedColor =
    '#a79b8e';


  const path =
    'calendars/' +
    encodeURIComponent(
      calendarId
    );


  const cal =
    calendarApiRequest_(
      'get',
      path
    );


  if (
    !cal.labelProperties
  ) {

    cal.labelProperties = {};
  }


  if (
    !cal.labelProperties
      .eventLabels
  ) {

    cal.labelProperties
      .eventLabels = [];
  }


  const labels =
    cal.labelProperties
      .eventLabels;


  /*
   * Först återanvänder vi Googles befintliga Birch-färg om den
   * redan finns på just den här kalendern. Namnet kan vara tomt.
   */
  let birch =
    labels.find(
      label =>
        (
          label.backgroundColor || ''
        ).toLowerCase() ===
        wantedColor
    );


  let calendarNeedsUpdate =
    false;


  /*
   * Om ett äldre försök skapade en label med namnet Birch men
   * fel färg använder vi samma UUID och korrigerar färgen.
   */
  if (!birch) {

    birch =
      labels.find(
        label =>
          (
            label.name || ''
          ).toLowerCase() ===
          'birch'
      );


    if (birch) {

      birch.backgroundColor =
        '#A79B8E';

      calendarNeedsUpdate =
        true;
    }
  }


  /*
   * Finns ingen Birch alls skapar vi en egen label.
   */
  if (!birch) {

    birch = {

      id:
        Utilities.getUuid(),

      name:
        'Birch',

      backgroundColor:
        '#A79B8E'
    };


    labels.push(
      birch
    );


    calendarNeedsUpdate =
      true;
  }


  if (
    calendarNeedsUpdate
  ) {

    cal.labelProperties
      .eventLabels =
      labels;


    const updatedCal =
      calendarApiRequest_(
        'put',
        path,
        cal
      );


    const updatedLabels =
      (
        updatedCal.labelProperties &&
        updatedCal.labelProperties.eventLabels
      ) || [];


    const verified =
      updatedLabels.find(
        label =>
          label.id ===
          birch.id
      );


    if (!verified) {

      throw new Error(
        'Birch-labeln kunde inte verifieras på kalendern.'
      );
    }


    if (
      (
        verified.backgroundColor || ''
      ).toLowerCase() !==
      wantedColor
    ) {

      throw new Error(
        'Birch fick fel färg: ' +
        (
          verified.backgroundColor ||
          'SAKNAS'
        )
      );
    }


    birch =
      verified;
  }


  _customLabelCache[
    cacheKey
  ] =
    birch.id;


  console.log(
    'BIRCH LABEL: ' +
    birch.id +
    ' | #A79B8E'
  );


  return birch.id;
}


/*
 * ============================================================
 * HÄMTA GOOGLE EVENT VIA REST API
 * ============================================================
 */

function getApiEvent_(
  calendarId,
  event
) {

  const apiEventId =
    findApiEventId_(
      calendarId,
      event
    );


  return calendarApiRequest_(
    'get',
    'calendars/' +
    encodeURIComponent(
      calendarId
    ) +
    '/events/' +
    encodeURIComponent(
      apiEventId
    )
  );
}


/*
 * ============================================================
 * CalendarApp EVENT-ID -> Calendar API EVENT-ID
 * ============================================================
 *
 * CalendarEvent.getId() är iCalUID.
 * Calendar REST API behöver event.id.
 * ============================================================
 */

function findApiEventId_(
  calendarId,
  event
) {

  const iCalUid =
    event.getId();


  const response =
    calendarApiRequest_(
      'get',
      'calendars/' +
      encodeURIComponent(
        calendarId
      ) +
      '/events' +
      '?iCalUID=' +
      encodeURIComponent(
        iCalUid
      ) +
      '&maxResults=10'
    );


  const items =
    response.items || [];


  if (
    !items.length
  ) {

    throw new Error(
      'Calendar API hittade inte eventet. iCalUID: ' +
      iCalUid
    );
  }


  if (
    items.length === 1
  ) {

    return items[0].id;
  }


  const targetTime =
    event
      .getStartTime()
      .getTime();


  const matching =
    items.find(
      item => {

        if (
          !item.start
        ) {

          return false;
        }


        const startString =
          item.start.dateTime ||
          item.start.date;


        if (
          !startString
        ) {

          return false;
        }


        const itemTime =
          new Date(
            startString
          )
            .getTime();


        return (
          Math.abs(
            itemTime -
            targetTime
          ) < 60000
        );
      }
    );


  return (
    matching ||
    items[0]
  ).id;
}


/*
 * ============================================================
 * GOOGLE CALENDAR REST API
 * ============================================================
 */

function calendarApiRequest_(
  method,
  path,
  body
) {

  const url =
    'https://www.googleapis.com/calendar/v3/' +
    path;


  const options = {

    method:
      method,

    headers: {

      Authorization:
        'Bearer ' +
        ScriptApp
          .getOAuthToken()
    },

    muteHttpExceptions:
      true
  };


  if (
    body !== undefined
  ) {

    options.contentType =
      'application/json';

    options.payload =
      JSON.stringify(
        body
      );
  }


  const response =
    UrlFetchApp.fetch(
      url,
      options
    );


  const status =
    response
      .getResponseCode();


  const responseText =
    response
      .getContentText();


  if (
    status < 200 ||
    status >= 300
  ) {

    throw new Error(
      'Google Calendar API error ' +
      status +
      ': ' +
      responseText
    );
  }


  return responseText
    ? JSON.parse(
        responseText
      )
    : {};
}


/*
 * ============================================================
 * DEBUG
 * ============================================================
 */

function debugTimeEdit() {


  const events =
    parseICS_(
      fetchIcs_()
    );


  events
    .slice(
      0,
      15
    )
    .forEach(event => {


      const details =
        extractDetails_(
          event
        );


      console.log(
        '=========================='
      );


      console.log(
        'TITLE: ' +
        buildTitle_(
          details,
          event
        )
      );


      console.log(
        'MATCHAR ' +
        CONFIG.MY_NUMBER +
        ': ' +
        matchesMyGroup_(
          event
        )
      );


      console.log(
        'COLOR-ID: ' +
        getEventColor_(
          details,
          event
        )
      );


      console.log(
        'LOCATION RAW: ' +
        event.location
      );


      console.log(
        JSON.stringify(
          details,
          null,
          2
        )
      );

    });

}
