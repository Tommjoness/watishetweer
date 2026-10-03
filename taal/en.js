/*
 * Woordenboek Nederlands → Brits Engels voor watishetweer.nl.
 *
 * Regels voor iedere vertaling:
 *   - hele zinnen of vaste labels, nooit losse woorden die in een zin vallen;
 *   - Brits Engels (colour, centre, metres), 24-uursklok, metrische eenheden;
 *   - getallen via getal(): 0,9 → 0.9 en 1.750 → 1,750;
 *   - patronen dekken de hele tekst (^…$) en geven een complete Engelse zin;
 *   - weerwoorden (Met Office-stijl): neerslag = precipitation, mist = fog,
 *     gevoelstemperatuur = feels like, windstoot = gust.
 * Een nieuwe Nederlandse tekst zonder vertaling laat de taalbewaker falen.
 */
(function (root, maak) {
  const api = maak();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WeatherNowWoordenboekEn = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- Lijsten ---------- */

  const DAG_KORT = { ma: "Mon", di: "Tue", wo: "Wed", do: "Thu", vr: "Fri", za: "Sat", zo: "Sun" };
  const DAG_VOL = { maandag: "Monday", dinsdag: "Tuesday", woensdag: "Wednesday", donderdag: "Thursday", vrijdag: "Friday", zaterdag: "Saturday", zondag: "Sunday" };
  const MAAND_KORT = { jan: "Jan", feb: "Feb", mrt: "Mar", apr: "Apr", mei: "May", jun: "Jun", jul: "Jul", aug: "Aug", sep: "Sep", okt: "Oct", nov: "Nov", dec: "Dec" };
  const MAAND_VOL = { januari: "January", februari: "February", maart: "March", april: "April", mei: "May", juni: "June", juli: "July", augustus: "August", september: "September", oktober: "October", november: "November", december: "December" };
  const RICHTING_VOL = {
    noorden: "north", noordnoordoosten: "north-north-east", noordoosten: "north-east", oostnoordoosten: "east-north-east",
    oosten: "east", oostzuidoosten: "east-south-east", zuidoosten: "south-east", zuidzuidoosten: "south-south-east",
    zuiden: "south", zuidzuidwesten: "south-south-west", zuidwesten: "south-west", westzuidwesten: "west-south-west",
    westen: "west", westnoordwesten: "west-north-west", noordwesten: "north-west", noordnoordwesten: "north-north-west"
  };
  const RICHTING_KORT = { N: "N", NNO: "NNE", NO: "NE", ONO: "ENE", O: "E", OZO: "ESE", ZO: "SE", ZZO: "SSE", Z: "S", ZZW: "SSW", ZW: "SW", WZW: "WSW", W: "W", WNW: "WNW", NW: "NW", NNW: "NNW" };
  /* Beaufort-namen van de app (BFTNAAM) in natuurlijk Engels. */
  const WINDKRACHT = {
    "windstil": "calm", "zwakke wind": "light wind", "matige wind": "moderate wind", "vrij krachtige wind": "fresh wind",
    "krachtige wind": "strong wind", "harde wind": "near gale", "stormachtige wind": "gale",
    "storm": "severe gale", "zware storm": "storm", "zeer zware storm": "violent storm", "orkaan": "hurricane-force wind",
    "vrij krachtig": "fresh", "zeer stormachtig": "very stormy"
  };
  /* Weertypen (WMO-codes, dag en nacht, dagverwachting). Sleutel in kleine letters. */
  const WEER = {
    "onbewolkt": "clear", "vrijwel onbewolkt": "mostly clear", "overwegend zonnig": "mainly sunny", "half bewolkt": "partly cloudy",
    "bewolkt": "cloudy", "geheel bewolkt": "overcast", "vrijwel geheel bewolkt": "nearly overcast", "zwaar bewolkt": "mostly cloudy",
    "veel bewolking": "plenty of cloud", "hoge bewolking": "high cloud", "veel hoge bewolking": "plenty of high cloud",
    "vrijwel helder": "mostly clear", "overwegend helder": "mainly clear", "helder": "clear",
    "mist": "fog", "aanvriezende mist": "freezing fog", "rijpmist": "freezing fog",
    "lichte motregen": "light drizzle", "motregen": "drizzle", "dichte motregen": "heavy drizzle",
    "lichte ijzelmotregen": "light freezing drizzle", "ijzelmotregen": "freezing drizzle", "aanvriezende motregen": "freezing drizzle",
    "lichte regen": "light rain", "regen": "rain", "zware regen": "heavy rain",
    "aanvriezende regen": "freezing rain", "zware aanvriezende regen": "heavy freezing rain", "lichte ijzel": "light freezing rain", "ijzel": "freezing rain",
    "lichte sneeuw": "light snow", "sneeuw": "snow", "zware sneeuw": "heavy snow", "sneeuwkorrels": "snow grains",
    "lichte buien": "light showers", "buien": "showers", "zware buien": "heavy showers",
    "lichte regenbuien": "light rain showers", "regenbuien": "rain showers", "zware regenbuien": "heavy rain showers",
    "lichte sneeuwbuien": "light snow showers", "sneeuwbuien": "snow showers", "zware sneeuwbuien": "heavy snow showers",
    "onweer": "thunderstorms", "onweer met hagel": "thunderstorms with hail", "zwaar onweer met hagel": "severe thunderstorms with hail",
    "onweer mogelijk": "thunder possible", "onweer mogelijk, lokaal hagel": "thunder possible, hail in places",
    "zwaar onweer mogelijk, lokaal hagel": "severe thunderstorms possible, hail in places",
    "droog": "dry", "overwegend droog": "mostly dry", "druppels": "spots of rain", "neerslag": "precipitation",
    "regen mogelijk": "rain possible", "neerslag mogelijk": "precipitation possible", "gladde neerslag": "wintry precipitation",
    "kans op gladheid": "risk of icy roads", "harde wind": "strong winds", "zicht": "visibility", "beperkt zicht": "reduced visibility",
    "mist of zeer slecht zicht": "fog or very poor visibility", "tijdelijk slechter zicht": "temporarily poorer visibility"
  };
  const DAGDEEL = { "in de ochtend": "in the morning", "in de middag": "in the afternoon", "in de avond": "in the evening", "in de nacht": "overnight", "in de vroege ochtend": "in the early morning" };
  const PERIODE = { "Beste": "Best period", "Relatief beste": "Best available period", "Waarschijnlijk beste": "Probably the best period" };
  const DAGNAAM = { "avond": "evening", "nacht": "night", "ochtend": "morning", "vroege ochtend": "early morning" };
  const KANS = { "zeer kleine": "very low", "kleine": "low", "grote": "high", "zeer grote": "very high" };
  const UV = { "laag": "low", "matig": "moderate", "hoog": "high", "zeer hoog": "very high", "extreem": "extreme" };
  const MAANFASE = {
    "nieuwe maan": "new moon", "wassende sikkel": "waxing crescent", "eerste kwartier": "first quarter", "wassende maan": "waxing gibbous",
    "volle maan": "full moon", "afnemende maan": "waning gibbous", "laatste kwartier": "last quarter", "afnemende sikkel": "waning crescent"
  };
  const ZICHTSCORE = { "uitstekend": "excellent", "goed": "good", "redelijk": "fair", "matig": "moderate", "ongunstig": "poor", "slecht": "poor", "zeer slecht": "very poor", "onbekend": "unknown" };
  const LUCHT = {
    "goed": "good", "redelijk": "fair", "matig": "moderate", "slecht": "poor", "zeer slecht": "very poor", "extreem slecht": "extremely poor",
    "ongezond voor gevoelige groepen": "unhealthy for sensitive groups", "ongezond": "unhealthy", "zeer ongezond": "very unhealthy", "gevaarlijk": "hazardous"
  };
  const POLLENNIVEAU = { "geen": "none", "weinig": "low", "matig veel": "moderate", "veel": "high", "zeer veel": "very high" };
  const POLLENSOORT = { "graspollen": "grass pollen", "berkpollen": "birch pollen", "berkenpollen": "birch pollen", "elspollen": "alder pollen", "elzenpollen": "alder pollen", "bijvoetpollen": "mugwort pollen", "ambrosiapollen": "ragweed pollen", "olijfpollen": "olive pollen" };

  /* ---------- Hulpfuncties ---------- */

  function getal(nl) {
    const s = String(nl).trim();
    if (/^[−-]?\d{1,3}(\.\d{3})+$/.test(s)) return s.replace(/\./g, ",");
    return s.replace(/(\d),(\d)/g, "$1.$2");
  }
  /* Behoudt een hoofdletter aan het begin. */
  function alsNl(nl, en) {
    if (en == null) return null;
    return /^[A-ZÀ-Ý]/.test(nl) ? en.charAt(0).toUpperCase() + en.slice(1) : en;
  }
  function uitLijst(lijst, nl) {
    const en = lijst[String(nl).toLowerCase()];
    return en == null ? null : alsNl(nl, en);
  }
  const weer = nl => uitLijst(WEER, nl);
  const richting = nl => RICHTING_VOL[String(nl).toLowerCase()] || null;
  const dagKort = nl => DAG_KORT[nl] || null;
  const dagVol = nl => DAG_VOL[String(nl).toLowerCase()] || null;
  const maand = nl => MAAND_KORT[String(nl).toLowerCase()] || MAAND_VOL[String(nl).toLowerCase()] || null;
  function graden(n) { return getal(n) + (Math.abs(Number(String(n).replace(",", ".").replace("−", "-"))) === 1 ? " degree" : " degrees"); }
  function meervoud(n, een, veel) { return Number(n) === 1 ? een : veel; }
  /* "There is light rain" maar "There are showers". */
  function isAre(w) { return /(showers|thunderstorms|grains)$/.test(w) ? "are" : "is"; }
  /* Provincienamen die in het Engels een eigen vorm hebben. */
  const PROVINCIE = { "Noord-Holland": "North Holland", "Zuid-Holland": "South Holland", "Noord-Brabant": "North Brabant", "Fryslân": "Friesland" };
  /* Plaatsen met een eigen Engelse naam. Plaatsnamen uit het zoeken komen al in het Engels binnen (start-en.js). */
  const PLAATS = { "Den Haag": "The Hague" };
  const plaats = n => PLAATS[n] || n;
  /* "do 12:00" of "12:00" → "Thu 12:00" of "12:00". */
  function tijdstip(s) {
    const m = /^(?:(ma|di|wo|do|vr|za|zo) )?(\d{1,2}:\d{2})$/.exec(s);
    if (!m) return null;
    return m[1] ? dagKort(m[1]) + " " + m[2] : m[2];
  }
  /* "16:00–18:00 · 4,8 mm" (ook met dagen) → Engels. */
  function periode(s) {
    const m = /^((?:(?:ma|di|wo|do|vr|za|zo) )?\d{1,2}:\d{2})–((?:(?:ma|di|wo|do|vr|za|zo) )?\d{1,2}:\d{2}) · ([\d,.]+) mm$/.exec(s);
    if (!m) return null;
    return tijdstip(m[1]) + "–" + tijdstip(m[2]) + " · " + getal(m[3]) + " mm";
  }
  function perioden(s) {
    let staart = "";
    const plus = /; plus (\d+) latere (?:periode|perioden)$/.exec(s);
    if (plus) { staart = `; plus ${plus[1]} later ${meervoud(plus[1], "period", "periods")}`; s = s.slice(0, plus.index); }
    const delen = s.split("; ").map(d => /^daarna /.test(d) ? (periode(d.slice(7)) && "then " + periode(d.slice(7))) : periode(d));
    return delen.every(Boolean) ? delen.join("; ") + staart : null;
  }
  function datum(dag, mnd, jaar) { const m = maand(mnd); return m ? `${dag} ${m}${jaar ? " " + jaar : ""}` : null; }
  function vandaagMorgen(nl) { return { vandaag: "today", morgen: "tomorrow", gisteren: "yesterday", vannacht: "tonight", vanavond: "this evening" }[String(nl).toLowerCase()] || null; }

  /* Landnamen: Nederlandse naam → Brits-Engelse naam via de Unicode-landenlijst
     van de browser (Intl.DisplayNames). Werkt voor ieder land, ook nieuwe. */
  let LANDEN = null;
  function land(nl) {
    if (!LANDEN) {
      LANDEN = new Map();
      try {
        const nlN = new Intl.DisplayNames(["nl"], { type: "region" }), enN = new Intl.DisplayNames(["en-GB"], { type: "region" });
        const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (const a of A) for (const b of A) {
          const code = a + b;
          let n, e;
          try { n = nlN.of(code); e = enN.of(code); } catch (x) { continue; }
          if (n && e && n !== code && e !== code) LANDEN.set(n.toLowerCase(), e);
        }
      } catch (x) { /* geen Intl.DisplayNames: landnamen blijven staan */ }
    }
    return LANDEN.get(String(nl).toLowerCase()) || null;
  }

  /* ---------- Vaste teksten ---------- */

  const exact = {
    /* Navigatie, kop en bediening */
    "Ga naar hoofdinhoud": "Skip to main content",
    /* Grafiekvenster bij een gekozen uur (SVG-tekst, audit F04). */
    "temperatuur": "temperature", "voelt als": "feels like", "wind": "wind", "windstoten": "gusts", "bewolking": "cloud cover", "kans komend uur": "chance next hour", "neerslagkans": "precip. chance",
    "Snel naar weersinformatie": "Jump to weather information",
    "Broodkruimelnavigatie": "Breadcrumb",
    "← Terug naar het weer": "← Back to the weather",
    "Plaats zoeken": "Search for a place",
    "Zoek een plaats": "Search for a place",
    "Plaatsen zoeken…": "Search places…",
    "Zoekresultaten": "Search results",
    "Niets gevonden": "Nothing found",
    "Mijn locatie": "My location",
    "Mijn Locatie": "My Location",
    "Mijn": "My",
    "Gebruik je huidige locatie": "Use your current location",
    "Je locatie": "Your location",
    "Locatie": "Location",
    "Huidige locatie": "Current location",
    "Gedeelde locatie": "Shared location",
    "Locatie bepalen.": "Finding your location.",
    "Ververs": "Refresh",
    "Plaats": "Place",
    /* Provincies en plaatsen met een eigen Engelse naam (plaatsenlijst, kruimelpad). */
    "Noord-Holland": "North Holland",
    "Zuid-Holland": "South Holland",
    "Noord-Brabant": "North Brabant",
    "Fryslân": "Friesland",
    "Den Haag": "The Hague",
    "De komende twee uur is de kans op neerslag zeer groot.": "The chance of precipitation in the next two hours is very high.",
    "De totale zichtscore is hoog; maanlicht maakt de hemel minder donker.": "The overall stargazing score is high; moonlight makes the sky less dark.",
    "Gemiddeld zicht: onbekend": "Average visibility: unknown",
    "Bewaarde plaatsen": "Saved places",
    "Verwijderen": "Remove",
    "Koude lucht.": "Cold air.",
    "IJskoude lucht.": "Bitterly cold air.",
    "Koude, droge lucht.": "Cold, dry air.",
    "IJskoude, droge lucht.": "Bitterly cold, dry air.",
    "IJskoude, vochtige lucht.": "Bitterly cold, humid air.",
    "Deze kalenderdag per uur.": "This calendar day by the hour.",
    "Automatisch; nu Licht. Kies Licht of Donker voor deze browsersessie.": "Automatic; currently Light. Choose Light or Dark for this browser session.",
    "Automatisch; nu Donker. Kies Licht of Donker voor deze browsersessie.": "Automatic; currently Dark. Choose Light or Dark for this browser session.",
    "Gegevens opnieuw ophalen": "Reload the data",
    "Gegevens ophalen.": "Loading data.",
    "Opnieuw proberen": "Try again",
    "Delen": "Share",
    "Link gekopieerd": "Link copied",
    "Kopieer deze link:": "Copy this link:",
    "Voeg deze plaats toe aan je lijst": "Add this place to your list",
    "Bezig": "Loading",
    "Weergave": "Appearance",
    "Weergave kiezen": "Choose appearance",
    "Licht": "Light",
    "Donker": "Dark",
    "Auto": "Auto",
    "Licht of donker": "Light or dark",
    "Automatisch (volgt je systeem)": "Automatic (follows your system)",
    "Automatisch: volgt de licht/donker-instelling van je apparaat": "Automatic: follows your device's light/dark setting",
    "Schakel donkere weergave in": "Switch to dark mode",
    "Uren": "Hours",
    "Nacht": "Night",
    "Lucht": "Air",
    "Zeven dagen": "Seven-day forecast",
    "7 dagen": "7 days",
    "Komende zeven dagen": "Next seven days",
    "De komende zeven dagen": "The next seven days",
    "Alle uren bekijken": "See all hours",
    "Minder uren tonen": "Show fewer hours",
    "Meer nachten bekijken": "See more nights",
    "Minder nachten tonen": "Show fewer nights",
    "Terug naar nu": "Back to now",
    "Meer plaatsen": "More places",
    "Plaatsen in de buurt": "Places nearby",
    "Veeg horizontaal om alle kolommen te zien.": "Swipe sideways to see all columns.",
    "Houd de grafiek vast voor details.": "Press and hold the chart for details.",
    "Kies een dag om die verwachting in de grafiek te bekijken.": "Choose a day to see its forecast in the chart.",
    "Kies een tijdstip in de grafiek voor de details van dat uur.": "Select a time in the chart to see the details for that hour.",
    "Kies een tijdstip in de grafiek voor uurdetails.": "Select a time in the chart to see hourly details.",
    "Technische locatiegegevens": "Technical location details",
    "Uitleg meetwaarden": "About these measurements",
    "Over deze gegevens": "About this data",
    "De weerapp kon niet worden gestart. Controleer je verbinding en laad de pagina opnieuw.": "The weather app could not start. Check your connection and reload the page.",
    "Deze browser deelt geen locatie.": "This browser does not share a location.",
    "Zoeken is niet gelukt. Probeer het opnieuw.": "Search failed. Please try again.",
    "Probeer het opnieuw zodra je weer online bent.": "Please try again once you are back online.",
    "Locatie geweigerd. Zoek hierboven een plaats.": "Location denied. Search for a place above.",
    "Locatie niet beschikbaar. Zoek hierboven een plaats.": "Location unavailable. Search for a place above.",
    "Het bepalen van de locatie duurde te lang. Probeer opnieuw of zoek hierboven een plaats.": "Finding your location took too long. Try again or search for a place above.",
    "Gps geeft niets terug, grovere meting proberen.": "GPS returned nothing; trying a less precise location.",
    "Deze gedeelde locatie is ongeldig. Controleer de link, zoek een plaats of gebruik Mijn locatie.": "This shared location is invalid. Check the link, search for a place or use My location.",
    "Deze gedeelde locatie is ongeldig. Zoek een plaats of gebruik Mijn locatie.": "This shared location is invalid. Search for a place or use My location.",
    "Deze locatie is ongeldig. Zoek een plaats of gebruik Mijn locatie.": "This location is invalid. Search for a place or use My location.",
    "Weergegevens konden niet worden opgehaald.": "The weather data could not be fetched.",
    "Verwachting wordt aangevuld.": "Loading the rest of the forecast.",
    "Verwachting niet beschikbaar": "Forecast unavailable",
    "Weerbeeld niet beschikbaar": "Weather overview unavailable",
    "Niet beschikbaar.": "Not available.",
    "Voor deze locatie niet beschikbaar": "Not available for this location",
    "Geen uurgegevens beschikbaar.": "No hourly data available.",

    /* Kopjes en secties */
    "In het kort": "At a glance",
    "Komende uren": "Next few hours",
    "Komend uur": "Next hour",
    "Het etmaal": "24 hours",
    "Dag": "Day",
    "Dagverwachting": "Daily forecast",
    "Deze dag": "This day",
    "Vandaag": "Today",
    "Morgen": "Tomorrow",
    "Gisteren": "Yesterday",
    "Vanavond": "This evening",
    "Vannacht": "Tonight",
    "Eerstvolgend": "Next",
    "Verwachting": "Forecast",
    "Tijd": "Time",
    "Weer": "Weather",
    "Temperatuur": "Temperature",
    "Gevoel": "Feels like",
    "Neerslag": "Precipitation",
    "Neerslagkans": "Chance of precipitation",
    "Kans": "Chance",
    "Hoeveelheid": "Amount",
    "Wind": "Wind",
    "Wind max": "Max wind",
    "Windstoot": "Gust",
    "Min": "Min",
    "Max": "Max",
    "Minimum": "Minimum",
    "Maximum": "Maximum",
    "Temp.bereik": "Temp. range",
    "Bewolking": "Cloud cover",
    "Luchtvochtigheid": "Humidity",
    "Zicht": "Visibility",
    "Zicht en maan": "Visibility and moon",
    "Zonlicht": "Sunlight",
    "Zonuren": "Sunshine hours",
    "Zonuren morgen": "Sunshine hours tomorrow",
    "UV-piek vandaag": "UV peak today",
    "UV-piek morgen": "UV peak tomorrow",
    "Verwachte UV-piek": "Expected UV peak",
    "Tijd tot zonsondergang": "Time until sunset",
    "Tijd tot zonsopkomst": "Time until sunrise",
    "Zonsondergang": "Sunset",
    "Zonsopkomst": "Sunrise",
    "Pooldag": "Polar day",
    "Poolnacht": "Polar night",
    "Zon gaat niet onder": "Sun does not set",
    "Zon komt niet op": "Sun does not rise",
    "Nachtzicht": "Stargazing",
    "Maan": "Moon",
    "Zichtscore": "Stargazing score",
    "Beoordeling": "Rating",
    "Indicatie": "Estimate",
    "Beste zichtperiode": "Best viewing window",
    "Volgende volledige nacht": "Next full night",
    "Pollen": "Pollen",
    "Europese AQI": "European AQI",
    "AQI (VS-schaal)": "AQI (US scale)",
    "Lucht, pollen en zon": "Air, pollen and sun",
    "Huidige status": "Current status",
    "Opvallend": "Notable",
    "Officiële melding": "Official notice",
    "Officiële weerwaarschuwing": "Official weather warning",
    "Weergrafiek": "Weather chart",
    "Grafiekgegevens": "Chart data",
    "Grafiekgegevens als tabel": "Chart data as a table",
    "Temperatuur en neerslag per uur": "Temperature and precipitation by hour",
    "Uur in de temperatuurgrafiek": "Hour in the temperature chart",
    "Alternatieve gegevensweergave van de huidige weergrafiek.": "Alternative data view of the current weather chart.",
    "Dag- en nachtverloop met temperatuur, spreiding en neerslagkans": "Day and night overview with temperature, range and chance of precipitation",
    "Komende uren met weer, temperatuur, gevoelstemperatuur, neerslagkans, neerslaghoeveelheid en wind in de lokale tijd van de geselecteerde plaats": "The next few hours with weather, temperature, feels-like temperature, chance of precipitation, amount and wind in the local time of the selected place",
    "Temperatuur, neerslagkans en neerslaghoeveelheid per uur voor de uren in de grafiek": "Temperature, chance of precipitation and amount by hour for the hours in the chart",
    "Temperatuur per uur, verticaal scrollbaar": "Temperature by hour, scrolls vertically",
    "Neerslag komend uur": "Precipitation next hour",
    "Neerslagkans komend uur": "Chance of precipitation next hour",
    "Neerslag komende twee uur": "Precipitation next two hours",
    "Neerslag per kwartier": "Precipitation per 15 minutes",
    "Neerslag nu": "Precipitation now",
    "Samenvatting neerslag komende twee uur": "Summary of precipitation over the next two hours",
    "Verwachte neerslag komend uur": "Expected precipitation next hour",
    "Verwachte totale hoeveelheid": "Expected total amount",
    "Hoogste neerslagkans": "Highest chance of precipitation",
    "Neerslagtype": "Type of precipitation",
    "Verwacht begin rond": "Expected to start around",
    "Verwacht droog rond": "Expected to turn dry around",
    "Kwartierwaarden": "15-minute values",
    "kans · verwacht totaal": "chance · expected total",
    "kans · verwachte hoeveelheid": "chance · expected amount",
    "kans · hoeveelheid onzeker": "chance · amount uncertain",
    "verwacht totaal": "expected total",
    "hoeveelheid onzeker": "amount uncertain",
    "De komende 24 uur": "The next 24 hours",
    "De komende 48 uur": "The next 48 hours",
    "Komende 24 uur": "Next 24 hours",
    "Komende 48 uur": "Next 48 hours",
    "In de komende 24 uur": "In the next 24 hours",
    "Temperatuur komende 3 uur": "Temperature next 3 hours",
    "Bronnen": "Sources",
    "Bronnen voor deze weergave": "Sources for this view",
    "Over deze site": "About this site",
    "Privacy & gegevens": "Privacy & data",
    "Vragen of feedback?": "Questions or feedback?",
    "Mail naar": "Email",
    "Mail naar support@watishetweer.nl": "Email support@watishetweer.nl",
    "Weer per plaats": "Weather by place",
    "Populaire plaatsen in Nederland": "Popular places in the Netherlands",
    "Zoek een plaats in de lijst": "Search for a place in the list",
    "Gemiddelden per maand": "Monthly averages",
    "Bekijk per maand": "See by month",
    "Maand": "Month",
    "Overdag (°C)": "Daytime (°C)",
    "'s Nachts (°C)": "Night-time (°C)",
    "Neerslag (mm)": "Precipitation (mm)",
    "Zon (uur)": "Sun (hours)",
    "gemiddelde hoogste temperatuur overdag": "average daytime high",
    "gemiddelde laagste temperatuur 's nachts": "average night-time low",
    "neerslag per maand in millimeter": "precipitation per month in millimetres",
    "uren zonneschijn per maand": "hours of sunshine per month",
    "Weersinformatie is algemeen en probabilistisch. Gebruik deze niet als enige basis voor persoonlijke veiligheid, luchtvaart, scheepvaart of noodplanning; raadpleeg daarvoor officiële meteorologische diensten en autoriteiten.": "Weather information is general and probabilistic. Do not use it as the only basis for personal safety, aviation, shipping or emergency planning; consult official meteorological services and authorities for that.",
    "© OpenStreetMap-bijdragers": "© OpenStreetMap contributors",

    /* Weer nu en tegels */
    "nu": "now",
    "Droog": "Dry",
    "DROOG": "DRY",
    "Geen neerslag verwacht.": "No precipitation expected.",
    "Geen neerslag verwacht": "No precipitation expected",
    "geen neerslag verwacht": "no precipitation expected",
    "Het regent nu.": "It is raining now.",
    "Het sneeuwt nu.": "It is snowing now.",
    "Het onweert nu.": "There is a thunderstorm now.",
    "Het hagelt nu.": "It is hailing now.",
    "Het motregent nu.": "It is drizzling now.",
    "Er valt nu neerslag.": "There is precipitation now.",
    "Nu geen meetbare neerslag gedetecteerd.": "No measurable precipitation detected right now.",
    "Het wordt de komende uren warmer.": "It will get warmer over the coming hours.",
    "Het wordt de komende uren koeler.": "It will get cooler over the coming hours.",
    "Er is niet genoeg data voor een betrouwbare trend.": "There is not enough data for a reliable trend.",
    "Vrijwel windstil.": "Almost calm.",
    "Windrichting niet beschikbaar.": "Wind direction unavailable.",
    "Windgegevens zijn momenteel niet beschikbaar.": "Wind data is currently unavailable.",
    "Windsnelheid niet beschikbaar.": "Wind speed unavailable.",
    "Bewolking niet beschikbaar.": "Cloud cover unavailable.",
    "Luchtvochtigheid niet beschikbaar.": "Humidity unavailable.",
    "Gevoelstemperatuur niet beschikbaar": "Feels-like temperature unavailable",
    "Zoninformatie niet beschikbaar": "Sunrise and sunset times unavailable",
    "Zoninformatie niet beschikbaar.": "Sunrise and sunset times unavailable.",
    "Zonuren niet beschikbaar.": "Sunshine hours unavailable.",
    "Zonuren niet beschikbaar": "Sunshine hours unavailable",
    "UV-gegevens voor vandaag niet beschikbaar.": "UV data for today unavailable.",
    "UV-gegevens voor vandaag worden bijgewerkt.": "UV data for today is being updated.",
    "Nauwelijks UV vandaag.": "Hardly any UV today.",
    "Nauwelijks UV verwacht vandaag.": "Hardly any UV expected today.",
    "Nauwelijks UV verwacht morgen.": "Hardly any UV expected tomorrow.",
    "Naar verwachting veel zon vandaag.": "Plenty of sunshine expected today.",
    "Naar verwachting veel zon morgen.": "Plenty of sunshine expected tomorrow.",
    "Naar verwachting bijna de hele dag zon.": "Sunshine expected for almost the whole day.",
    "Naar verwachting enkele uren zon vandaag.": "A few hours of sunshine expected today.",
    "Naar verwachting meerdere uren zon vandaag.": "Several hours of sunshine expected today.",
    "Naar verwachting weinig zon vandaag.": "Little sunshine expected today.",
    "Een aantal zonuren vandaag": "Some sunshine today",
    "Vandaag redelijk wat zon": "A fair amount of sunshine today",
    "Weinig zon vandaag": "Little sunshine today",
    "De zon gaat binnen de beschikbare verwachting niet onder.": "The sun does not set within the available forecast.",
    "De zon komt binnen de beschikbare verwachting niet op.": "The sun does not rise within the available forecast.",
    "Geen zonsondergang in de beschikbare verwachting.": "No sunset within the available forecast.",
    "zon komt niet onder of niet op": "sun does not set or does not rise",
    "daglichtduur niet beschikbaar": "daylight duration unavailable",
    "geen daglicht": "no daylight",
    "0 uur daglicht": "0 hours of daylight",
    "24 uur daglicht": "24 hours of daylight",
    "Geen pollen verwacht voor dit uur.": "No pollen expected for this hour.",
    "Weinig pollen verwacht voor dit uur.": "Low pollen expected for this hour.",
    "Pollen verwacht voor dit uur.": "Pollen expected for this hour.",
    "Veel pollen verwacht voor dit uur.": "High pollen expected for this hour.",
    "Pollendata voor het huidige uur niet beschikbaar": "Pollen data for the current hour unavailable",
    "Geen pollendata voor deze locatie": "No pollen data for this location",
    "Geen noemenswaardige concentraties": "No significant concentrations",
    "Luchtkwaliteit is voor deze locatie niet beschikbaar.": "Air quality is not available for this location.",
    "Pollenwaarden zijn een verwachting van CAMS; de werkelijke blootstelling kan lokaal verschillen.": "Pollen values are a CAMS forecast; actual exposure can vary locally.",
    "Pollenwaarden zijn een verwachting van CAMS; de werkelijke blootstelling kan lokaal verschillen. Het niveau (weinig tot zeer veel) volgt de pollenschaal van het National Allergy Bureau (AAAAI).": "Pollen values are a CAMS forecast; actual exposure can vary locally. The level (low to very high) follows the pollen scale of the National Allergy Bureau (AAAAI).",
    "Het niveau (weinig tot zeer veel) volgt de pollenschaal van het National Allergy Bureau (AAAAI).": "The level (low to very high) follows the pollen scale of the National Allergy Bureau (AAAAI).",
    "Comfortabele luchtvochtigheid.": "Comfortable humidity.",
    "Normale luchtvochtigheid.": "Normal humidity.",
    "Lage relatieve luchtvochtigheid.": "Low relative humidity.",
    "Hoge relatieve luchtvochtigheid.": "High relative humidity.",
    "Zeer hoge relatieve luchtvochtigheid.": "Very high relative humidity.",
    "Gemiddelde relatieve luchtvochtigheid.": "Average relative humidity.",
    "Aangenaam, niet plakkerig.": "Pleasant, not sticky.",
    "Niet plakkerig.": "Not sticky.",
    "Voelt plakkerig aan.": "Feels sticky.",
    "Voelt wat plakkerig aan.": "Feels a little sticky.",
    "Benauwd en plakkerig.": "Muggy and sticky.",
    "Zeer benauwd en plakkerig.": "Very muggy and sticky.",
    "Droge hitte, niet plakkerig.": "Dry heat, not sticky.",
    "Droge lucht, niet plakkerig.": "Dry air, not sticky.",
    "Fris, niet plakkerig.": "Fresh, not sticky.",
    "Vochtig, maar niet plakkerig.": "Humid, but not sticky.",
    "Zeer vochtig, maar niet plakkerig.": "Very humid, but not sticky.",
    "Koude, vochtige lucht.": "Cold, humid air.",
    "Droge lucht.": "Dry air.",
    "Vochtige lucht.": "Humid air.",
    "Zeer vochtige lucht.": "Very humid air.",
    "De lucht is vochtig.": "The air is humid.",
    "De lucht is vrij droog.": "The air is fairly dry.",
    "voelt doorgaans niet klam.": "usually does not feel clammy.",
    "voelt klam aan.": "feels clammy.",
    "voelt zeer klam aan.": "feels very clammy.",
    "kan wat klam aanvoelen.": "can feel a little clammy.",
    "meestal aangenaam.": "usually pleasant.",
    "Goed zicht.": "Good visibility.",
    "Redelijk zicht.": "Moderate visibility.",
    "Beperkt zicht.": "Reduced visibility.",
    "Goed zicht, tien kilometer of meer.": "Good visibility, ten kilometres or more.",
    "Goed zicht, meer dan tien kilometer.": "Good visibility, more than ten kilometres.",
    "Goed zicht, ongeveer tien kilometer.": "Good visibility, about ten kilometres.",
    "Slecht zicht, minder dan een kilometer.": "Poor visibility, less than a kilometre.",
    "Zeer slecht zicht in de verwachting (minder dan 1 km).": "Very poor visibility in the forecast (less than 1 km).",
    "Geen windstootverwachting voor dit uur.": "No gust forecast for this hour.",
    "Verwachte hoogste windstoot in dit uur.": "Expected strongest gust this hour.",
    "Verwachte hoeveelheid in het komende uur.": "Expected amount in the next hour.",
    "Dit is de neerslagkans voor het komende uur.": "This is the chance of precipitation for the next hour.",
    "Dit is het verwachte totaal in het komende uur.": "This is the expected total for the next hour.",
    "Neerslagkans niet beschikbaar.": "Chance of precipitation unavailable.",
    "neerslagkans niet beschikbaar": "chance of precipitation unavailable",
    "Neerslagkans voor het komende uur niet beschikbaar.": "Chance of precipitation for the next hour unavailable.",
    "Neerslaggegevens niet beschikbaar": "Precipitation data unavailable",
    "Neerslaggegevens niet beschikbaar.": "Precipitation data unavailable.",
    "Neerslagverwachting onzeker.": "Precipitation forecast uncertain.",
    "Geen meetbare hoeveelheid berekend.": "No measurable amount calculated.",
    "geen meetbare hoeveelheid": "no measurable amount",
    "Geen betrouwbare kans beschikbaar": "No reliable chance available",
    "Kans en hoeveelheid spreken elkaar tegen": "Chance and amount contradict each other",
    "Kans en dagsom zijn verschillende modelwaarden en hoeven daarom niet één op één samen te vallen.": "The chance and the daily total are separate model values, so they need not match one to one.",
    "Minimum en maximum gelden voor de volledige kalenderdag.": "Minimum and maximum apply to the full calendar day.",
    /* Verborgen labels in de dagregel (toegankelijke naam). */
    "Maximale wind": "Maximum wind", "Maximale wind onbekend": "Maximum wind unknown", "Minimum onbekend": "Minimum unknown", "Maximum onbekend": "Maximum unknown",
    "Neerslaggegevens onbekend": "Precipitation data unknown", "Droog over de hele dag": "Dry for the whole day", "Droog in de rest van vandaag": "Dry for the rest of today",
    "De totale neerslagverwachting voor vandaag is niet beschikbaar.": "The total precipitation forecast for today is not available.",
    "Voor vandaag wordt er geen neerslag verwacht.": "No precipitation is expected today.",
    "Voor vandaag worden hooguit enkele druppels verwacht.": "At most a few drops are expected today.",
    "Actueel gemeten neerslagintensiteit.": "Currently measured precipitation rate.",
    "Actuele neerslagintensiteit.": "Current precipitation rate.",
    "Kwartierverwachting op basis van weermodellen.": "15-minute forecast based on weather models.",
    "Kwartierwaarden tonen de verwachting per voorafgaand kwartier.": "15-minute values show the forecast for each preceding 15 minutes.",
    "Kwartierdata is voor deze locatie niet beschikbaar.": "15-minute data is not available for this location.",
    "KNMI-neerslagdata voor nu en de komende twee uur.": "KNMI precipitation data for now and the next two hours.",
    "De bronresolutie verschilt per regio. Buiten gebieden met echte 15-minutenmodeldata kan Open-Meteo uurdata interpoleren.": "Source resolution varies by region. Outside areas with true 15-minute model data, Open-Meteo may interpolate hourly data.",
    "Voor Nederlandse locaties gebruikt deze neerslagweergave actuele KNMI-puntdata en de KNMI-nowcast. Temperatuur, wind en de langere verwachting blijven uit de gewone weermodellen komen.": "For locations in the Netherlands, this precipitation view uses current KNMI point data and the KNMI nowcast. Temperature, wind and the longer forecast still come from the usual weather models.",
    "Voor Belgische locaties wordt actuele neerslag aangevuld met KNMI-puntdata. De komende uren volgen de beschikbare kwartier- en modelverwachting.": "For locations in Belgium, current precipitation is supplemented with KNMI point data. The coming hours follow the available 15-minute and model forecast.",
    "De balken tonen neerslag per kwartier, opgebouwd uit KNMI-stappen van vijf minuten.": "The bars show precipitation per 15 minutes, built from five-minute KNMI steps.",
    "Kwartierwaarden zijn sommen over het voorafgaande kwartier en kunnen afhankelijk van de locatie uit uurdata zijn geïnterpoleerd.": "15-minute values are totals over the preceding 15 minutes and, depending on the location, may be interpolated from hourly data.",
    "Eerst de neerslagkans, daarna het verwachte totaal in het komende uur.": "First the chance of precipitation, then the expected total for the next hour.",
    "Meetbare neerslag staat als aaneengesloten perioden onder de temperatuurcurve.": "Measurable precipitation is shown as continuous periods below the temperature curve.",
    "Bij iedere regenperiode staat het tijdvak en de verwachte hoeveelheid.": "Each rain period shows its time span and expected amount.",
    "De belangrijkste regenperioden zijn gelabeld; de overige blijven via de grafiekdetails beschikbaar.": "The main rain periods are labelled; the others remain available in the chart details.",
    "Neerslagkansen blijven via de details beschikbaar.": "Chances of precipitation remain available in the details.",
    "Neerslagpercentages gelden voor het voorafgaande uur; waarden links van de nu-lijn zijn verlopen.": "Precipitation percentages apply to the preceding hour; values left of the “now” line are in the past.",

    /* Neerslagzinnen (volledig) */
    "De komende twee uur wordt er geen neerslag verwacht.": "No precipitation is expected in the next two hours.",
    "Voor de komende twee uur wordt er geen neerslag verwacht.": "No precipitation is expected for the next two hours.",
    "De komende twee uur blijft het droog.": "It will stay dry for the next two hours.",
    "De komende twee uur blijft het waarschijnlijk droog.": "It will probably stay dry for the next two hours.",
    "De komende twee uur is er een kleine kans op neerslag.": "There is a low chance of precipitation in the next two hours.",
    "De komende twee uur is de neerslagkans groot, maar de hoeveelheid onzeker.": "The chance of precipitation in the next two hours is high, but the amount is uncertain.",
    "De komende twee uur valt er neerslag.": "There will be precipitation in the next two hours.",
    "De kans op neerslag in de komende twee uur is zeer klein.": "The chance of precipitation in the next two hours is very low.",
    "De neerslagverwachting voor de komende twee uur is onzeker.": "The precipitation forecast for the next two hours is uncertain.",
    "In de komende twee uur is neerslag mogelijk.": "Precipitation is possible in the next two hours.",
    "In de komende twee uur kunnen enkele druppels vallen.": "A few drops may fall in the next two hours.",
    "Het is nu droog. In de komende twee uur kunnen enkele druppels vallen.": "It is dry now. A few drops may fall in the next two hours.",
    "Het is nu droog. In de komende twee uur wordt neerslag verwacht.": "It is dry now. Precipitation is expected in the next two hours.",
    "Er valt nu neerslag en dat blijft de komende twee uur zo.": "There is precipitation now and it will continue for the next two hours.",
    "Het regent nu en dat houdt de komende twee uur aan.": "It is raining now and will continue for the next two hours.",
    "Voor de komende twee uur is er niet genoeg data voor een betrouwbare inschatting.": "There is not enough data for a reliable estimate for the next two hours.",
    "Voor de komende twee uur ontbreken voldoende gegevens.": "There is not enough data for the next two hours.",
    "Onvoldoende gegevens voor een betrouwbare neerslaginschatting in de komende twee uur.": "Not enough data for a reliable precipitation estimate for the next two hours.",
    "Het komende uur is er een zeer kleine kans op neerslag.": "There is a very low chance of precipitation in the next hour.",
    "Het komende uur is er een kleine kans op neerslag.": "There is a low chance of precipitation in the next hour.",
    "Het komende uur is er een grote kans op neerslag.": "There is a high chance of precipitation in the next hour.",
    "Het komende uur is er een zeer grote kans op neerslag.": "There is a very high chance of precipitation in the next hour.",
    "Het komende uur is neerslag mogelijk.": "Precipitation is possible in the next hour.",
    "Het komende uur wordt neerslag verwacht.": "Precipitation is expected in the next hour.",
    "Het komende uur zijn enkele druppels mogelijk.": "A few drops are possible in the next hour.",
    "Komend uur is de neerslagkans zeer klein.": "The chance of precipitation in the next hour is very low.",
    "Neerslag is mogelijk.": "Precipitation is possible.",
    "Grote kans op neerslag.": "High chance of precipitation.",
    "Kleine kans op neerslag.": "Low chance of precipitation.",
    "Zeer grote kans op neerslag.": "Very high chance of precipitation.",
    "Zeer kleine kans op neerslag.": "Very low chance of precipitation.",
    "Ook later vandaag blijft de neerslagkans groot.": "The chance of precipitation stays high later today too.",
    "Ook later vandaag blijft de neerslagkans zeer groot.": "The chance of precipitation stays very high later today too.",
    "Ook later vandaag blijft neerslag mogelijk.": "Precipitation remains possible later today too.",
    "Ook later vandaag blijft neerslag onwaarschijnlijk.": "Precipitation remains unlikely later today too.",
    "De verwachte hoeveelheid is onzeker.": "The expected amount is uncertain.",
    "Geen betrouwbare aanvullende samenvatting beschikbaar.": "No reliable additional summary available.",
    "Onvoldoende gegevens voor een betrouwbare beoordeling.": "Not enough data for a reliable assessment.",
    "Vannacht blijft de temperatuur ongeveer gelijk.": "Tonight the temperature stays about the same.",

    /* Nachtzicht */
    "Hoe goed je 's nachts de sterren kunt zien, hangt af van bewolking, zicht, mist, neerslag, vocht, wind en maanlicht.": "How well you can see the stars at night depends on cloud, visibility, fog, precipitation, humidity, wind and moonlight.",
    "Globale zichtscore op basis van de huidige verwachting": "Approximate stargazing score based on the current forecast",
    "Voorlopige zichtscore op basis van de huidige verwachting": "Provisional stargazing score based on the current forecast",
    "Zichtscore op basis van de huidige verwachting": "Stargazing score based on the current forecast",
    "Geen betrouwbare zichtscore": "No reliable stargazing score",
    "Geen nachtdata beschikbaar.": "No night data available.",
    "Geen gunstig kijkvenster.": "No favourable viewing window.",
    "Geen gunstig kijkvenster in deze periode.": "No favourable viewing window in this period.",
    "Geen aaneengesloten gunstig modelvenster": "No continuous favourable window in the model",
    "Beste periode van de avond tot de vroege ochtend.": "Best period: evening to early morning.",
    "Beste periode van de nacht tot de vroege ochtend.": "Best period: night to early morning.",
    "Waarschijnlijk beste periode van de nacht tot de vroege ochtend.": "Probably the best period: night to early morning.",
    "Waarschijnlijk beste periode van de avond tot de vroege ochtend.": "Probably the best period: evening to early morning.",
    "Beste periode": "Best period",
    "Beste periode.": "Best period.",
    "Relatief beste periode": "Best available period",
    "Relatief beste periode.": "Best available period.",
    "De omstandigheden zijn redelijk.": "Conditions are fair.",
    "De totale zichtscore is hoog.": "The overall stargazing score is high.",
    "Maan blijft onder de horizon.": "The moon stays below the horizon.",
    "Maan blijft boven de horizon.": "The moon stays above the horizon.",
    "maan blijft onder de horizon": "moon stays below the horizon",
    "maan blijft boven de horizon": "moon stays above the horizon",
    "Onvoldoende data": "Not enough data",
    "Onvoldoende consistente gegevens": "Not enough consistent data",
    "Onzeker": "Uncertain",
    "volgende nacht": "next night",

    /* Waarschuwingen */
    "Officiële weerwaarschuwingen controleren…": "Checking official weather warnings…",
    "Geen officiële waarschuwing.": "Not an official warning.",
    "Geen officiële weerwaarschuwingen voor deze locatie.": "No official weather warnings for this location.",
    "Voor deze locatie kunnen we geen officiële weerwaarschuwingen tonen.": "We cannot show official weather warnings for this location.",
    "Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald.": "Official weather warnings are temporarily unavailable.",
    "Geldt voor een groter gebied, niet per se voor deze plaats.": "Applies to a wider area, not necessarily to this place.",
    "Bekijk deze waarschuwing bij de officiële bron": "View this warning at the official source",
    "Officiële tekst van de National Weather Service": "Official text from the National Weather Service",
    "Officiële titel hierboven ongewijzigd. Bron: National Weather Service.": "Official title above unchanged. Source: National Weather Service.",
    "De Amerikaanse weerdienst heeft voor deze locatie een officiële waarschuwing uitgegeven.": "The US National Weather Service has issued an official warning for this location.",
    "Waakzaamheid voor overstromingen": "Flood watch",
    "Waakzaamheid voor tornado's": "Tornado watch",
    "Waakzaamheid voor zwaar onweer": "Severe thunderstorm watch",
    "Waarschuwing voor extreme hitte": "Extreme heat warning",
    "Waarschuwing voor hitte": "Heat warning",
    "Waarschuwing voor overstromingen": "Flood warning",
    "Waarschuwing voor plotselinge overstromingen": "Flash flood warning",
    "Waarschuwing voor zeer harde wind": "High wind warning",
    "Waarschuwing voor zwaar onweer": "Severe thunderstorm warning",
    "Waarschuwing voor zwaar winterweer": "Winter storm warning",
    "Tornadowaarschuwing": "Tornado warning",
    "Hitteadvies": "Heat advisory",
    "Mistadvies": "Fog advisory",
    "Windadvies": "Wind advisory",
    "Winterweeradvies": "Winter weather advisory",
    "Luchtkwaliteitsadvies": "Air quality advisory",
    "Luchtkwaliteitswaarschuwing": "Air quality warning",

    /* Laden en fouten */
    "Weer vandaag en 7-daagse verwachting | watishetweer.nl": "Weather today and 7-day forecast | watishetweer.nl",
    "Het weer vandaag, morgen en per uur | watishetweer.nl": "The weather today, tomorrow and by the hour | watishetweer.nl",
    "Bekijk het actuele weer, neerslag voor de komende uren, de 7-daagse verwachting, luchtkwaliteit en nachtzicht voor plaatsen wereldwijd.": "See the current weather, precipitation for the coming hours, the 7-day forecast, air quality and stargazing conditions for places worldwide.",
    "Op een later moment": "At a later time",
    "op een later moment": "at a later time",

    /* Statistieken en privacykeuzes in de app */
    "Statistieken op dit apparaat uitzetten": "Turn off statistics on this device",
    "Statistieken op dit apparaat weer toestaan": "Allow statistics on this device again",
    "Google Analytics toestaan": "Allow Google Analytics",
    "Google Analytics uitschakelen": "Turn off Google Analytics",
    "Google Analytics instellen": "Google Analytics settings",
    "Google Analytics is toegestaan.": "Google Analytics is allowed.",
    "Google Analytics is uitgeschakeld.": "Google Analytics is turned off.",
    "Google Analytics staat op dit apparaat uit, omdat je alle statistieken hebt uitgezet.": "Google Analytics is off on this device because you have turned off all statistics.",
    "Op dit apparaat staan alle statistieken uit.": "All statistics are off on this device.",
    "Op dit apparaat staan de statistieken aan.": "Statistics are on for this device.",
    "Er is nog geen keuze opgeslagen.": "No choice has been saved yet.",
    "Lokale gegevens gewist.": "Local data cleared.",
    "Wis lokale gegevens": "Clear local data",
    "Zelf wissen": "Clear it yourself",

    /* Over-pagina */
    "Over watishetweer.nl": "About watishetweer.nl",
    "Wat je hier vindt": "What you will find here",
    "Waar de gegevens vandaan komen": "Where the data comes from",
    "Hoe je verwachtingen moet lezen": "How to read forecasts",
    "Waarschuwingen en veiligheid": "Warnings and safety",
    "Privacy en transparantie": "Privacy and transparency",
    "watishetweer.nl brengt actuele weersinformatie en modelverwachtingen voor plaatsen wereldwijd overzichtelijk samen: in één oogopslag wat het weer nu doet en wat er de komende uren en dagen komt.":
      "watishetweer.nl brings current weather information and model forecasts for places worldwide together in one clear view: at a glance, what the weather is doing now and what is coming over the next hours and days.",
    "De site toont onder meer het actuele weer, neerslag voor de komende uren, een 7-daagse verwachting, wind en windstoten, luchtkwaliteit, zonuren en een indicatie voor nachtzicht. De weergave gebruikt lokale tijd voor de gekozen plaats.":
      "The site shows, among other things, the current weather, precipitation for the coming hours, a 7-day forecast, wind and gusts, air quality, sunshine hours and an indication of stargazing conditions. All times are local to the chosen place.",
    "De concrete bronvermelding staat bij de weerweergave en kan per locatie verschillen. De verwachting komt in de eerste plaats van Open-Meteo; bij een storing daar valt de site terug op Visual Crossing of WeatherAPI.com. Luchtkwaliteit en pollen komen van Open-Meteo, op basis van CAMS-modelgegevens. Voor Nederland en België komt de neerslag voor de komende uren van het KNMI, en voor Nederland de luchtkwaliteitsindex van RIVM/Luchtmeetnet. Officiële waarschuwingen komen van MeteoAlarm of, in de Verenigde Staten, van de National Weather Service. Plaatsnamen komen van Open-Meteo, BigDataCloud en OpenStreetMap.":
      "The exact sources are listed with the weather view and can differ by location. The forecast comes primarily from Open-Meteo; if that service fails, the site falls back to Visual Crossing or WeatherAPI.com. Air quality and pollen come from Open-Meteo, based on CAMS model data. For the Netherlands and Belgium, precipitation for the coming hours comes from the KNMI, and for the Netherlands the air quality index comes from RIVM/Luchtmeetnet. Official warnings come from MeteoAlarm or, in the United States, from the National Weather Service. Place names come from Open-Meteo, BigDataCloud and OpenStreetMap.",
    "Een weersverwachting is geen meting van de toekomst. Modeluitkomsten veranderen wanneer nieuwe waarnemingen en berekeningen beschikbaar komen. Daarom kunnen temperaturen, neerslagkansen, wind en andere verwachtingen bij een volgende verversing wijzigen.":
      "A weather forecast is not a measurement of the future. Model output changes as new observations and calculations become available, so temperatures, chances of precipitation, wind and other forecasts can change at the next refresh.",
    "De site probeert officiële waarschuwingen duidelijk te tonen wanneer daarvoor een ondersteunde bron beschikbaar is. Voor beslissingen waarbij veiligheid een rol speelt, blijft de officiële meteorologische dienst of waarschuwingendienst voor jouw locatie leidend.":
      "The site aims to show official warnings clearly whenever a supported source is available. For decisions that involve safety, the official meteorological or warning service for your location always takes precedence.",
    "watishetweer.nl heeft geen gebruikersaccount of advertentietracking. De site gebruikt privacygerichte bezoekstatistieken. Meer informatie over locatiegebruik en lokale opslag staat op Privacy & gegevens.":
      "watishetweer.nl has no user accounts and no advertising tracking. The site uses privacy-friendly visitor statistics. More about location use and local storage is on Privacy & data.",

    /* Privacypagina */
    "Privacy & gegevens | watishetweer.nl": "Privacy & data | watishetweer.nl",
    "Wie is verantwoordelijk": "Who is responsible",
    "Waarom en hoe lang": "Why and for how long",
    "Wat je browser bewaart": "What your browser stores",
    "Bezoek- en prestatiestatistieken": "Visit and performance statistics",
    "Externe diensten": "External services",
    "Je rechten": "Your rights",
    "Meer informatie": "More information",
    "Google Analytics 4": "Google Analytics 4",
    "Geen account, geen advertenties en geen advertentietracking.": "No account, no adverts and no advertising tracking.",
    "watishetweer.nl heeft geen account of advertentietracking. De site verwerkt locatiegegevens om het weer voor een gekozen plaats te tonen en gebruikt privacygerichte bezoekstatistieken om te begrijpen of de site technisch en praktisch goed werkt.":
      "watishetweer.nl has no accounts and no advertising tracking. The site processes location data to show the weather for a chosen place and uses privacy-friendly visitor statistics to understand whether the site works well, technically and in practice.",
    "watishetweer.nl is een persoonlijke website van Maitri Polwatte Gedera, die verantwoordelijk is voor de verwerking van gegevens op deze site. Vragen over privacy of een verzoek over je gegevens stuur je naar support@watishetweer.nl.":
      "watishetweer.nl is the personal website of Maitri Polwatte Gedera, who is responsible for the processing of data on this site. Send questions about privacy or a request about your data to support@watishetweer.nl.",
    "Je actuele locatie wordt alleen gebruikt als je zelf op Mijn locatie kiest. In je browser en in een deellink staat je positie afgerond op ongeveer honderd meter.":
      "Your current location is only used when you choose My location yourself. In your browser and in a share link, your position is rounded to about a hundred metres.",
    "De statistieken die zonder toestemming draaien, werken zonder cookies. Onze productstatistieken (PostHog, EU) krijgen geen zoektermen, plaatsnamen of coördinaten.":
      "The statistics that run without consent work without cookies. Our product statistics (PostHog, EU) receive no search terms, place names or coordinates.",
    "Google Analytics staat alleen aan als je daar zelf toestemming voor geeft. Dan kan het cookies plaatsen en ziet het welke plaatspagina je opent. Je zet het hieronder altijd weer uit.":
      "Google Analytics is only on if you give consent yourself. It can then set cookies and see which place page you open. You can always turn it off again below.",
    "Weer voor een gekozen plaats (Open-Meteo, KNMI, RIVM/Luchtmeetnet, MeteoAlarm, NWS, reserveleveranciers, plaatsnaamdiensten): de gekozen positie, om het gevraagde weer te tonen. Grondslag: gerechtvaardigd belang, namelijk de dienst leveren waar je zelf om vraagt. Onze server heeft geen database en slaat deze aanvragen niet op.":
      "Weather for a chosen place (Open-Meteo, KNMI, RIVM/Luchtmeetnet, MeteoAlarm, NWS, backup providers, place-name services): the chosen position, to show the weather you asked for. Legal basis: legitimate interest, namely providing the service you request. Our server has no database and does not store these requests.",
    "Statistieken zonder toestemming (PostHog Cloud EU en, als die actief is, Cloudflare Web Analytics): begrijpen of de site technisch en praktisch goed werkt, zonder cookies en zonder profiel. Grondslag: gerechtvaardigd belang. PostHog bewaart de gegevens één jaar.":
      "Statistics without consent (PostHog Cloud EU and, when active, Cloudflare Web Analytics): understanding whether the site works well, technically and in practice, without cookies and without a profile. Legal basis: legitimate interest. PostHog keeps the data for one year.",
    "Google Analytics 4: alleen na jouw toestemming. Grondslag: toestemming, die je hierboven altijd kunt intrekken. Gegevens op gebruikers- en eventniveau hoogstens 14 maanden.":
      "Google Analytics 4: only with your consent. Legal basis: consent, which you can always withdraw above. User-level and event-level data for at most 14 months.",
    "Hosting en beveiliging (Cloudflare): technische gegevens zoals het IP-adres, om de site veilig en bereikbaar te houden. Grondslag: gerechtvaardigd belang. Bewaring volgens de voorwaarden van Cloudflare.":
      "Hosting and security (Cloudflare): technical data such as the IP address, to keep the site secure and available. Legal basis: legitimate interest. Retention according to Cloudflare's terms.",
    "Je eigen browser: plaatsen, instellingen en een weersnapshot blijven op je apparaat tot je ze hieronder of via je browser wist.":
      "Your own browser: places, settings and a weather snapshot stay on your device until you clear them below or through your browser.",
    "Je browser vraagt pas om je actuele locatie nadat je zelf op Mijn locatie kiest. De coördinaten worden gebruikt voor weerdata, een plaatsnaam en, waar beschikbaar, officiële weerwaarschuwingen. In lokale opslag en in de deel-URL wordt de positie afgerond op drie decimalen (ongeveer honderd meter); tijdens de actuele aanvraag kan de browser nauwkeuriger coördinaten gebruiken.":
      "Your browser only asks for your current location after you choose My location yourself. The coordinates are used for weather data, a place name and, where available, official weather warnings. In local storage and in the share URL, the position is rounded to three decimal places (about a hundred metres); during the request itself, the browser may use more precise coordinates.",
    "De laatst gekozen plaats, bewaarde plaatsen, thema-instelling en een recente weersnapshot worden lokaal in je browser opgeslagen zodat de site sneller en ook bij een korte storing bruikbaar blijft. Er is geen eigen gebruikersdatabase waarin deze voorkeuren aan een account worden gekoppeld. De PostHog-koppeling voegt zelf geen cookie of blijvende browseropslag toe. Je GA4-toestemmingskeuze wordt lokaal opgeslagen; alleen na toestemming kan Google Analytics eigen meetcookies plaatsen.":
      "The last chosen place, saved places, theme setting and a recent weather snapshot are stored locally in your browser so the site is faster and stays usable during a brief outage. There is no user database of our own that links these preferences to an account. The PostHog integration itself adds no cookie or persistent browser storage. Your GA4 consent choice is stored locally; only after consent can Google Analytics set its own measurement cookies.",
    "Als Cloudflare Web Analytics voor de site actief is, meet het onder meer paginaweergaven en technische laadprestaties. De Web Analytics-beacon gebruikt voor deze gebruiksmeting geen cookies of localStorage en Cloudflare geeft aan individuele bezoekers niet over websites van klanten heen te volgen. Bij automatische Cloudflare-injectie wordt de meting geladen via de officiële beacon en verstuurd via de eigen /cdn-cgi/rum-route.":
      "When Cloudflare Web Analytics is active for the site, it measures page views and technical loading performance, among other things. The Web Analytics beacon uses no cookies or localStorage for this measurement, and Cloudflare states that it does not track individual visitors across customers' websites. With automatic Cloudflare injection, the measurement is loaded through the official beacon and sent through the site's own /cdn-cgi/rum route.",
    "Daarnaast gebruikt de site PostHog Cloud EU voor een beperkte set productstatistieken. Deze koppeling gebruikt geen PostHog-SDK, cookies of sessionStorage, en alleen localStorage als je de statistieken zelf uitzet (zie hieronder). Per geopende pagina wordt alleen in het werkgeheugen een willekeurige tijdelijke identifier gemaakt; er wordt geen PostHog-personenprofiel aangemaakt. Het PostHog-project staat in de EU-regio en IP-anonimisering is ingeschakeld. PostHog bewaart deze statistieken één jaar.":
      "The site also uses PostHog Cloud EU for a limited set of product statistics. This integration uses no PostHog SDK, cookies or sessionStorage, and uses localStorage only if you turn the statistics off yourself (see below). For each page opened, a random temporary identifier is created in memory only; no PostHog person profile is created. The PostHog project is in the EU region and IP anonymisation is switched on. PostHog keeps these statistics for one year.",
    "PostHog ontvangt een geschoonde paginaweergave, een globale schermgroep (mobiel, tablet of desktop), een grove laadduurgroep en alleen generieke taakuitkomsten. Voorbeelden zijn het laden van de weerweergave, het starten van een plaatszoekactie, het kiezen van een zoekresultaat, het aanklikken van Mijn locatie, het bewaren of openen van een bewaarde plaats, op Delen tikken, het selecteren van een verwachtingsdag, het openen van uren of nachten en het installeren van de site als app. De ingetypte zoekterm, gekozen plaatsnaam, coördinaten, concrete weerwaarden, querystring en URL-hash worden niet meegestuurd. Weerroutes worden vóór verzending samengevat tot de generieke route /weer/:location. De analyticscall stuurt bovendien geen browser-Referer mee.":
      "PostHog receives a cleaned page view, a broad screen group (mobile, tablet or desktop), a rough loading-time group and only generic task outcomes. Examples are loading the weather view, starting a place search, choosing a search result, clicking My location, saving or opening a saved place, tapping Share, selecting a forecast day, opening hours or nights and installing the site as an app. The search term you type, the chosen place name, coordinates, specific weather values, query string and URL hash are not sent. Weather routes are reduced to the generic route /weer/:location before sending. The analytics call also sends no browser Referer.",
    "Daarnaast gaan drie grove kenmerken mee: de herkomstcategorie van het bezoek (zoekmachine, AI-assistent, deze site, een andere site of geen), of de site als app of in de browser is geopend, en bij het laden van het weer of er bewaarde plaatsen zichtbaar zijn (ja of nee). De herkomstcategorie wordt in je browser afgeleid uit het verwijzende adres; dat adres zelf, de domeinnaam en eventuele zoektermen worden niet verstuurd. Welke plaatsen je hebt bewaard, gaat nooit mee. Als de browser Global Privacy Control of Do Not Track actief doorgeeft, wordt deze PostHog-meting niet gestart.":
      "Three broad characteristics are also sent: the referral category of the visit (search engine, AI assistant, this site, another site or none), whether the site was opened as an app or in the browser, and, when the weather loads, whether saved places are visible (yes or no). The referral category is derived in your browser from the referring address; that address itself, the domain name and any search terms are not sent. Which places you have saved is never sent. If the browser actively signals Global Privacy Control or Do Not Track, this PostHog measurement is not started.",
    "Google Analytics 4 (GA4) is optioneel. De Google-tag wordt pas geladen nadat je daar expliciet toestemming voor geeft. Voor die toestemming verstuurt deze site geen GA4-request, cookieless ping of toestemmingsstatus naar Google. Bij weigeren blijft de tag geblokkeerd.":
      "Google Analytics 4 (GA4) is optional. The Google tag is only loaded after you explicitly give consent. Before that consent, this site sends no GA4 request, cookieless ping or consent status to Google. If you decline, the tag stays blocked.",
    "Na toestemming meet GA4 onder meer paginaweergaven, herkomst, apparaatcategorie, sessies, engagement en de automatisch ingeschakelde verbeterde metingen zoals scrolls en uitgaande klikken. De site stuurt de paginaroute zonder querystring of URL-hash, en de paginatitel. Op een plaatspagina staat de plaatsnaam in allebei (bijvoorbeeld /weer/utrecht/ en een titel die met „Utrecht” begint). Anders dan PostHog ontvangt Google Analytics dus wel voor welke plaats een pagina is geopend. Advertentieopslag, advertentiepersonalisatie en Google-signals worden door deze implementatie niet ingeschakeld.":
      "After consent, GA4 measures page views, referral, device category, sessions, engagement and the automatically enabled enhanced measurements such as scrolls and outbound clicks, among other things. The site sends the page route without query string or URL hash, and the page title. On a place page, both contain the place name (for example /weer/utrecht/ and a title that starts with “Utrecht”). Unlike PostHog, Google Analytics therefore does receive which place a page was opened for. Ad storage, ad personalisation and Google signals are not enabled by this implementation.",
    "Na toestemming kan Google Analytics cookies plaatsen om bezoeken en sessies te meten. Google kan bij het ontvangen van een meting ook technische gegevens zoals het IP-adres verwerken volgens de eigen voorwaarden, ook buiten de EU (onder meer in de Verenigde Staten). Gegevens op gebruikers- en eventniveau bewaart Google Analytics hoogstens 14 maanden. Je keuze wordt lokaal in deze browser bewaard zodat de site die bij een volgend bezoek kan respecteren.":
      "After consent, Google Analytics can set cookies to measure visits and sessions. When it receives a measurement, Google may also process technical data such as the IP address under its own terms, including outside the EU (for example in the United States). Google Analytics keeps user-level and event-level data for at most 14 months. Your choice is stored locally in this browser so the site can respect it on your next visit.",
    "Je kunt toestemming hier altijd weer intrekken en Google Analytics uitschakelen. Bij uitschakelen verwijdert de site waar mogelijk de bekende GA-cookies op dit domein. Je kunt sitegegevens daarnaast via je browserinstellingen wissen.":
      "You can always withdraw consent here and turn off Google Analytics. When you turn it off, the site removes the known GA cookies on this domain where possible. You can also clear site data through your browser settings.",
    "Statistieken op dit apparaat uitzetten. Met de knop hieronder zet je op dit apparaat alle statistieken uit: PostHog, de vraag om Google Analytics en Google Analytics zelf. Hetzelfde gebeurt als je de site één keer opent met ?analytics=uit achter het adres; met ?analytics=aan of dezelfde knop zet je ze weer aan. Alleen deze keuze wordt in je browser bewaard, onder de sleutel weerbriefing.analytics.uit.v1, zodat de site haar bij een volgend bezoek respecteert. Er gaat daarbij niets naar PostHog of Google.":
      "Turn off statistics on this device. The button below turns off all statistics on this device: PostHog, the Google Analytics prompt and Google Analytics itself. The same happens if you open the site once with ?analytics=uit after the address; ?analytics=aan or the same button turns them back on. Only this choice is stored in your browser, under the key weerbriefing.analytics.uit.v1, so the site respects it on your next visit. Nothing is sent to PostHog or Google in the process.",
    "Voor weer, luchtkwaliteit, pollen en plaatszoeken gebruikt de site Open-Meteo. Als Open-Meteo niet op tijd antwoordt, vraagt onze server de verwachting op bij Visual Crossing of WeatherAPI.com. Voor Nederland en België haalt onze server de neerslag voor de komende uren op bij het KNMI, en voor Nederland de luchtkwaliteitsindex bij RIVM/Luchtmeetnet. Bij die aanvragen van onze server krijgen deze diensten hooguit de gekozen positie, niet je IP-adres. Voor een actuele GPS-locatie vraagt je browser de plaatsnaam rechtstreeks op bij BigDataCloud; die gratis dienst wordt niet via onze server aangeroepen. Als dat niet lukt, gebruikt de server OpenStreetMap Nominatim als beperkte fallback. Officiële waarschuwingen komen, afhankelijk van de locatie, van MeteoAlarm of de Amerikaanse National Weather Service. Cloudflare verzorgt hosting en beveiliging en, wanneer Web Analytics actief is, de geaggregeerde gebruiksmeting. PostHog verwerkt de hierboven beschreven beperkte productstatistieken in de EU. Alleen na jouw toestemming kan Google Analytics de hierboven beschreven gebruiksmetingen ontvangen. Diensten die je browser rechtstreeks aanroept, zoals Open-Meteo en BigDataCloud, kunnen bij een aanvraag technische gegevens zoals je IP-adres verwerken volgens hun eigen voorwaarden; voor PostHog is in het project IP-anonimisering ingeschakeld.":
      "For weather, air quality, pollen and place search, the site uses Open-Meteo. If Open-Meteo does not respond in time, our server requests the forecast from Visual Crossing or WeatherAPI.com. For the Netherlands and Belgium, our server fetches precipitation for the coming hours from the KNMI, and for the Netherlands the air quality index from RIVM/Luchtmeetnet. For these requests from our server, these services receive at most the chosen position, not your IP address. For a current GPS location, your browser requests the place name directly from BigDataCloud; this free service is not called through our server. If that fails, the server uses OpenStreetMap Nominatim as a limited fallback. Depending on the location, official warnings come from MeteoAlarm or the US National Weather Service. Cloudflare provides hosting and security and, when Web Analytics is active, the aggregated usage measurement. PostHog processes the limited product statistics described above in the EU. Only with your consent can Google Analytics receive the usage measurements described above. Services that your browser calls directly, such as Open-Meteo and BigDataCloud, may process technical data such as your IP address under their own terms when you make a request; IP anonymisation is switched on in the PostHog project.",
    "Je hebt recht op inzage, correctie en verwijdering van gegevens over jou, op beperking van de verwerking en op bezwaar tegen verwerking op basis van gerechtvaardigd belang. Toestemming voor Google Analytics trek je hierboven zelf in. Omdat de site geen account en geen profiel heeft, kunnen wij gegevens meestal niet aan jou als persoon koppelen; wat in je eigen browser staat, wis je met de knop hierboven. Voor een verzoek of vraag mail je naar support@watishetweer.nl; je krijgt binnen een maand antwoord. Ben je het niet eens met hoe met je gegevens wordt omgegaan, dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens.":
      "You have the right to access, correct and delete data about you, to restrict processing and to object to processing based on legitimate interest. You withdraw consent for Google Analytics yourself above. Because the site has no accounts and no profiles, we usually cannot link data to you as a person; you clear what is stored in your own browser with the button above. For a request or question, email support@watishetweer.nl; you will receive a reply within a month. If you disagree with how your data is handled, you can lodge a complaint with the Autoriteit Persoonsgegevens (the Dutch Data Protection Authority).",
    "Dit wist de lokaal opgeslagen plaatsen, instellingen (ook de weergavekeuze Licht of Donker voor deze sessie) en weersnapshot van deze site. Je keuze voor Google Analytics en een eventuele afmelding voor statistieken blijven behouden, zodat wissen niet onbedoeld als nieuwe toestemming, een nieuwe toestemmingsvraag of het weer aanzetten van statistieken werkt. Gebruik de aparte knop hierboven om GA4 toe te staan of uit te schakelen.":
      "This clears the locally stored places, settings (including the Light or Dark display choice for this session) and weather snapshot of this site. Your choice for Google Analytics and any opt-out from statistics are kept, so clearing does not accidentally act as new consent, a new consent prompt or turning statistics back on. Use the separate button above to allow or turn off GA4.",
    "Meer over de site en de manier waarop verwachtingen worden gepresenteerd staat op Over watishetweer.nl. Bronvermelding staat ook onderaan de weerpagina.":
      "More about the site and how forecasts are presented is on About watishetweer.nl. Sources are also listed at the bottom of the weather page.",

    /* Plaatsenoverzicht */
    "Weer per plaats in Nederland | watishetweer.nl": "Weather by place in the Netherlands | watishetweer.nl",
    "Bekijk direct het actuele weer en de verwachting voor populaire plaatsen in Nederland.": "See the current weather and forecast for popular places in the Netherlands.",
    "Kies een plaats voor het actuele weer, neerslag in de komende uren en de 7-daagse verwachting.": "Choose a place for the current weather, precipitation over the coming hours and the 7-day forecast.",
    "Deze plaats staat niet in de lijst. Zoek haar op de weerpagina; daar vind je elke plaats ter wereld.": "This place is not in the list. Search for it on the weather page, where you can find any place in the world.",

    /* Losse eenheden en symbolen */
    "km/u": "km/h",
    "korrels/m³": "grains/m³",
    /* Enkelvoud bij 1 en bij <1: als concentratie-eenheid blijft het Engels "grains/m³". */
    "korrel/m³": "grains/m³",
    "uur": "hours",
    "u": "h",
    "min": "min",
    "kans": "chance"
  };

  /* ---------- Zinspatronen ---------- */

  const G = "(−?-?\\d+(?:[,.]\\d+)?)";       // getal met optionele decimaal (komma of punt)
  const T = "(\\d{1,2}:\\d{2})";            // tijd
  const D = "(ma|di|wo|do|vr|za|zo)";       // dag kort

  const patronen = [
    /* Weertypen, windkracht, fasen, niveaus: los label */
    [/^(.+)$/, (m) => weer(m[1])],
    [/^(.+)$/, (m) => uitLijst(WINDKRACHT, m[1])],
    [/^(.+)$/, (m) => uitLijst(MAANFASE, m[1])],
    [/^(Voorlopig )?(Uitstekend|Goed|Redelijk|Matig|Ongunstig|Slecht|Zeer slecht|Onbekend)$/i, (m) => alsNl(m[0], (m[1] ? "provisionally " : "") + ZICHTSCORE[m[2].toLowerCase()])],
    [/^(Uitstekende|Goede|Redelijke)$/, (m) => ({ Uitstekende: "Excellent", Goede: "Good", Redelijke: "Fair" })[m[1]]],
    [/^(.+)$/, (m) => uitLijst(LUCHT, m[1])],
    [/^(.+)$/, (m) => uitLijst(POLLENSOORT, m[1])],
    [/^(Geen|Weinig|Matig veel|Veel|Zeer veel)$/i, (m) => alsNl(m[1], POLLENNIVEAU[m[1].toLowerCase()])],
    [/^(Laag|Matig|Hoog|Zeer hoog|Extreem)$/i, (m) => alsNl(m[1], UV[m[1].toLowerCase()])],
    [/^(.+)$/, (m) => vandaagMorgen(m[1]) && alsNl(m[1], vandaagMorgen(m[1]))],
    [/^(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|okt|nov|dec)$/, (m) => maand(m[1])],
    [/^(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)$/i, (m) => dagVol(m[1])],
    [/^(ma|di|wo|do|vr|za|zo)$/, (m) => dagKort(m[1])],
    [/^(N|NNO|NO|ONO|O|OZO|ZO|ZZO|Z|ZZW|ZW|WZW|W|WNW|NW|NNW)$/, (m) => RICHTING_KORT[m[1]]],

    [/^(.+)\.$/, (m) => { const w = weer(m[1]); return w && w + "."; }],
    [/^(.+)$/, (m) => land(m[1])],
    [/^(.+), (.+)$/, (m) => { const l = land(m[2]); return l && !/[.!?]/.test(m[1]) && m[1].length < 60 && !/\b(de|het|een|en|van|voor|niet)\b/.test(m[1]) ? `${m[1]}, ${l}` : null; }],
    [/^Weergave kiezen\. Huidige stand: (automatisch|handmatig) \((Licht|Donker)\)\.$/, (m) => `Choose display. Current setting: ${m[1] === "automatisch" ? "automatic" : "manual"} (${m[2] === "Licht" ? "Light" : "Dark"}).`],
    [/^Weergave kiezen\. Huidige stand: (Licht|Donker)\.$/, (m) => `Choose display. Current setting: ${m[1] === "Licht" ? "Light" : "Dark"}.`],
    [/^Handmatig (Licht|Donker) voor deze browsersessie\. Klik om (Licht|Donker) te kiezen\.$/, (m) => `Manually ${m[1] === "Licht" ? "Light" : "Dark"} for this browser session. Click to choose ${m[2] === "Licht" ? "Light" : "Dark"}.`],
    [/^Huidige handmatige keuze: (Licht|Donker) \(deze browsersessie\)\.$/, (m) => `Current manual choice: ${m[1] === "Licht" ? "Light" : "Dark"} (this browser session).`],
    /* Technische locatiegegevens; de hoogte ontbreekt als de bron hem niet levert. */
    [/^(−?-?\d+\.\d+), (−?-?\d+\.\d+)(?: · (\d+) m hoogte)?(?: · modelcel (−?-?\d+\.\d+), (−?-?\d+\.\d+))? · ([A-Za-z_]+\/[A-Za-z_\/-]+)$/, (m) => `${m[1]}, ${m[2]}${m[3] ? ` · ${m[3]} m elevation` : ""}${m[4] ? ` · model cell ${m[4]}, ${m[5]}` : ""} · ${m[6]}`],
    [/^Officiële weerwaarschuwing(?: \((geel|oranje|rood)\))?: (.+)\.$/, (m, hulp) => {
      const kleur = m[1] ? ` (${({ geel: "yellow", oranje: "orange", rood: "red" })[m[1]]})` : "";
      const code = /^Code (geel|oranje|rood): (.+)$/.exec(m[2]);
      const titel = code ? (WAARSCHUWING[code[2].toLowerCase()] && `${({ geel: "yellow", oranje: "orange", rood: "red" })[code[1]]} warning for ${WAARSCHUWING[code[2].toLowerCase()]}`)
        : (WAARSCHUWING[m[2].toLowerCase()] ? alsNl("X", WAARSCHUWING[m[2].toLowerCase()])
          /* Officiële Engelse titel van de weerdienst (MeteoAlarm en-GB, NWS) blijft letterlijk. */
          : (eigennamen.includes(m[2]) || (hulp && hulp.alEngels(m[2])) ? m[2] : null));
      return titel && `Official weather warning${kleur}: ${titel}.`;
    }],

    [new RegExp(`^Als er neerslag valt, berekent het model ongeveer ${G} mm\\.$`), (m) => `If precipitation falls, the model calculates about ${getal(m[1])} mm.`],
    [/^Uitleg van watishetweer\.nl: (.+)$/, (m, hulp) => { const t = hulp.t(m[1]); return t && `Explanation from watishetweer.nl: ${t}`; }],
    [/^(.+) –$/, (m, hulp) => { const t = hulp.t(m[1]); return t && `${t} –`; }],
    [/^(.+) mogelijk$/, (m) => { const w = weer(m[1]); return w && `${w} possible`; }],
    [/^Extreme hitte in de verwachting \((−?-?\d+) °C\)\.$/, (m) => `Extreme heat in the forecast (${getal(m[1])} °C).`],
    [/^Zeer hoge gevoelstemperatuur in de verwachting \((−?-?\d+) °C\)\.$/, (m) => `Very high feels-like temperature in the forecast (${getal(m[1])} °C).`],
    [/^De Amerikaanse hitte-index loopt op tot (\d+) °F, ongeveer (−?-?\d+) °C\.$/, (m) => `The US heat index rises to ${m[1]} °F, about ${getal(m[2])} °C.`],
    [/^Gemiddeld zicht: onbekend$/, () => "Average visibility: unknown"],
    [/^Hoogste neerslagkans in één uur (\d+) procent; (?:hoeveelheid onzeker|amount uncertain)$/, (m) => `Highest hourly chance of precipitation ${m[1]} per cent; amount uncertain`],
    [/^Neerslag vandaag vanaf nu: (\d+) procent\.(?: Minimum en maximum gelden voor de volledige kalenderdag\.)?$/, (m) => `Precipitation for the rest of today: ${m[1]} per cent.${/Minimum/.test(m[0]) ? " Minimum and maximum apply to the full calendar day." : ""}`],
    [/^(Uitstekende|Goede|Redelijke) omstandigheden, maar door (.+) is er geen aaneengesloten gunstig kijkvenster\.$/, (m) => { const r = oorzaken(m[2]); return r && `${({ Uitstekende: "Excellent", Goede: "Good", Redelijke: "Fair" })[m[1]]} conditions, but ${r} ${/ and |, /.test(r) ? "break" : "breaks"} up any continuous favourable viewing window.`; }],
    [/^De omstandigheden zijn redelijk, maar (.+) onderbreekt een langer gunstig kijkvenster\.$/, (m) => { const r = oorzaken(m[1]); return r && `Conditions are fair, but ${r} ${/ and |, /.test(r) ? "interrupt" : "interrupts"} a longer favourable viewing window.`; }],
    [/^De totale zichtscore is hoog, maar (.+) onderbreekt een langer optimaal kijkvenster\.$/, (m) => { const r = oorzaken(m[1]); return r && `The overall stargazing score is high, but ${r} ${/ and |, /.test(r) ? "interrupt" : "interrupts"} a longer ideal viewing window.`; }],
    [/^Toon het weer voor (.+)$/, (m) => `Show the weather for ${plaats(m[1])}`],
    [/^Verwijder (.+) uit bewaarde plaatsen$/, (m) => `Remove ${plaats(m[1])} from saved places`],
    /* Dagomschrijving "Mist; neerslag mogelijk" → "Fog; precipitation possible". */
    [/^(.+); (.+) mogelijk$/, (m) => { const w = weer(m[1]), n = WEER[m[2].toLowerCase()]; return w && n ? `${w}; ${n} possible` : null; }],
    [/^(.+); (zeer kleine|kleine|grote|zeer grote) neerslagkans$/, (m) => { const w = weer(m[1]); return w && `${w}; ${({ "zeer kleine": "very low chance of precipitation", "kleine": "low chance of precipitation", "grote": "precipitation likely", "zeer grote": "precipitation very likely" })[m[2]]}`; }],
    [/^Er (valt|vallen) nu (.+)\.$/, (m) => { const w = WEER[m[2].toLowerCase()]; return w && `There ${isAre(w)} ${w} now.`; }],
    [/^(.+) mogelijk (in de (?:vroege ochtend|ochtend|middag|avond|nacht))$/, (m) => { const w = weer(m[1]); return w && `${w} possible ${DAGDEEL[m[2]]}`; }],
    [/^Naar verwachting (veel|weinig|enkele uren|meerdere uren) zon (vandaag|morgen)\.$/, (m) => `${({ veel: "Plenty of sunshine", weinig: "Little sunshine", "enkele uren": "A few hours of sunshine", "meerdere uren": "Several hours of sunshine" })[m[1]]} expected ${vandaagMorgen(m[2])}.`],
    [/^Naar verwachting bijna de hele dag zon (vandaag|morgen)\.$/, (m) => `Sunshine expected for almost the whole day ${vandaagMorgen(m[1])}.`],
    [/^(Beste|Relatief beste|Waarschijnlijk beste) periode (in de (?:vroege ochtend|ochtend|middag|avond|nacht))\.$/, (m) => `${PERIODE[m[1]]} ${DAGDEEL[m[2]] === "overnight" ? "during the night" : DAGDEEL[m[2]]}.`],
    [/^(Beste|Relatief beste|Waarschijnlijk beste) periode van de (avond|nacht|vroege ochtend) tot de (nacht|ochtend|vroege ochtend)\.$/, (m) => `${PERIODE[m[1]]}: ${DAGNAAM[m[2]]} to ${DAGNAAM[m[3]]}.`],
    [/^(Beste|Relatief beste|Waarschijnlijk beste) periode: (\d{1,2}:\d{2})–(\d{1,2}:\d{2})\.$/, (m) => `${PERIODE[m[1]]}: ${m[2]}–${m[3]}.`],
    [/^(Beste|Relatief beste|Waarschijnlijk beste) periode: nu tot (\d{1,2}:\d{2})\.$/, (m) => `${PERIODE[m[1]]}: now until ${m[2]}.`],
    [/^(Vandaag|Morgen|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag) (\d{1,2}) (januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december), per uur$/,
      (m) => `${({ Vandaag: "Today", Morgen: "Tomorrow" })[m[1]] || dagVol(m[1])} ${m[2]} ${maand(m[3])}, by the hour`],
    /* Daghint bij een gekozen dag (daily-forecast-owner): hoogste uurkans en de
       verwachte neerslag over de hele kalenderdag, met alle hoeveelheidsvormen
       (spoor, <0,05 mm, <0,1 mm, gewone mm). */
    [/^Hoogste kans op neerslag in één uur: (\d+%)\.$/, (m) => `Highest chance of precipitation in any one hour: ${m[1]}.`],
    /* Neerslagnaam in de dagregel, met tijdvak (vandaag: resterende uren). */
    [new RegExp(`^Hoogste neerslagkans in één uur( in de rest van vandaag)? (\\d+) procent(?:; (?:(hoeveelheid onzeker)|verwachte neerslag (over de hele dag|in de rest van vandaag) (spoor|<0,05 mm|<0,1 mm|${G} mm)))?$`), (m) => `Highest hourly chance of precipitation${m[1] ? " for the rest of today" : ""} ${m[2]} per cent${m[3] ? "; amount uncertain" : m[4] ? `; expected precipitation ${m[4] === "over de hele dag" ? "for the whole day" : "for the rest of today"} ${m[5] === "spoor" ? "trace" : m[5].replace(/(\d),(\d)/g, "$1.$2")}` : ""}`],
    [new RegExp(`^De verwachte neerslag (over de hele dag|in de rest van vandaag) is (alleen een spoor|<0,05 mm|${G} mm)\\.$`), (m) => `Expected precipitation ${m[1] === "over de hele dag" ? "for the whole day" : "for the rest of today"} is ${m[2] === "alleen een spoor" ? "only a trace" : m[2].replace(/(\d),(\d)/g, "$1.$2")}.`],
    [new RegExp(`^Verwachte neerslag over de hele dag: (spoor|<0,05 mm|<0,1 mm|${G} mm)\\.$`), (m) => `Expected precipitation for the whole day: ${m[1] === "spoor" ? "trace" : m[1].replace(/(\d),(\d)/g, "$1.$2")}.`],
    [/^Later vandaag loopt de neerslagkans op tot (\d+)%\.$/, (m) => `Later today the chance of precipitation rises to ${m[1]}%.`],
    [/^De komende twee uur is er een (zeer kleine|kleine|grote|zeer grote) kans op (.+)\.$/, (m) => { const w = WEER[m[2].toLowerCase()]; return w && `There is a ${KANS[m[1]]} chance of ${w} in the next two hours.`; }],
    [/^Er is een (zeer kleine|kleine|grote|zeer grote) kans op (.+) in de komende twee uur \(maximaal (\d+)%\)\.$/, (m) => { const w = WEER[m[2].toLowerCase()]; return w && `There is a ${KANS[m[1]]} chance of ${w} in the next two hours (at most ${m[3]}%).`; }],
    [new RegExp(`^De temperatuur blijft de komende uren rond ${G}( ?)°C\\.$`), (m) => `The temperature stays around ${getal(m[1])}${m[2]}°C over the coming hours.`],
    [/^Zonsondergang over (\d+) (minuut|minuten), (vandaag|morgen) om (\d{1,2}:\d{2})\.$/, (m) => `Sunset in ${m[1]} ${meervoud(m[1], "minute", "minutes")}, ${vandaagMorgen(m[3])} at ${m[4]}.`],
    [/^Zonsopkomst over (\d+) (minuut|minuten), (vandaag|morgen) om (\d{1,2}:\d{2})\.$/, (m) => `Sunrise in ${m[1]} ${meervoud(m[1], "minute", "minutes")}, ${vandaagMorgen(m[3])} at ${m[4]}.`],

    /* Dagen en datums */
    [new RegExp(`^${D} (\\d{1,2})$`), (m) => `${dagKort(m[1])} ${m[2]}`],
    [/^(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag) (\d{1,2})$/i, (m) => `${dagVol(m[1])} ${m[2]}`],
    [new RegExp(`^${D} (\\d{1,2}) (jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)$`), (m) => `${dagKort(m[1])} ${m[2]} ${maand(m[3])}`],
    [new RegExp(`^${D} (\\d{1,2}) (jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec) ${T}$`), (m) => `${dagKort(m[1])} ${m[2]} ${maand(m[3])} ${m[4]}`],
    [/^Vandaag (\d{1,2})$/, (m) => `Today ${m[1]}`],
    [/^Vandaag (\d{1,2}) (jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)$/, (m) => `Today ${m[1]} ${maand(m[2])}`],
    [/^(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag) (\d{1,2}) (jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)$/i, (m) => `${dagVol(m[1])} ${m[2]} ${maand(m[3])}`],
    [/^(ma|di|wo|do|vr|za|zo) op (ma|di|wo|do|vr|za|zo)$/i, (m) => `${dagKort(m[1].toLowerCase())} night`],
    [new RegExp(`^${D}–${D}$`), (m) => `${dagKort(m[1])}–${dagKort(m[2])}`],
    [/^(Vandaag|Morgen) om (\d{1,2}:\d{2})\.$/, (m) => `${m[1] === "Vandaag" ? "Today" : "Tomorrow"} at ${m[2]}.`],
    [/^zon (op|onder) (\d{1,2}:\d{2})$/, (m) => `${m[1] === "op" ? "sunrise" : "sunset"} ${m[2]}`],
    [/^maan (op|onder) (\d{1,2}:\d{2})$/, (m) => `${m[1] === "op" ? "moonrise" : "moonset"} ${m[2]}`],
    [/^(\d+) uur daglicht$/, (m) => `${m[1]} ${meervoud(m[1], "hour", "hours")} of daylight`],
    [/^(\d+) uur (\d+) minuten daglicht$/, (m) => `${m[1]} h ${m[2]} min of daylight`],
    [/^Daglengte (\d+) u (\d+) min$/, (m) => `Day length ${m[1]} h ${m[2]} min`],
    [/^(\d+) u (\d+) min$/, (m) => `${m[1]} h ${m[2]} min`],
    [/^(\d+(?:,\d+)?) ?uur$/, (m) => `${getal(m[1])} ${meervoud(m[1], "hour", "hours")}`],
    [/^(\d+) dagen$/, (m) => `${m[1]} days`],
    [/^(\d+) plaatsen gevonden\.$/, (m) => `${m[1]} places found.`],
    [/^1 plaats gevonden\.$/, () => "1 place found."],
    [/^Zonsondergang over (\d+) uur en (\d+) (?:minuut|minuten), (vandaag|morgen) om (\d{1,2}:\d{2})\.$/, (m) => `Sunset in ${m[1]} ${meervoud(m[1], "hour", "hours")} and ${m[2]} ${meervoud(m[2], "minute", "minutes")}, ${vandaagMorgen(m[3])} at ${m[4]}.`],
    [/^Zonsopkomst over (\d+) uur en (\d+) (?:minuut|minuten), (vandaag|morgen) om (\d{1,2}:\d{2})\.$/, (m) => `Sunrise in ${m[1]} ${meervoud(m[1], "hour", "hours")} and ${m[2]} ${meervoud(m[2], "minute", "minutes")}, ${vandaagMorgen(m[3])} at ${m[4]}.`],
    [/^Actieve nacht tot zonsopkomst (\d{1,2}:\d{2})$/, (m) => `Current night, until sunrise at ${m[1]}`],

    /* Temperatuur, gevoel, wind */
    [new RegExp(`^${G}°$`), (m) => getal(m[1]) + "°"],
    [new RegExp(`^nu ${G}°$`), (m) => `now ${getal(m[1])}°`],
    [new RegExp(`^voelt ${G}°$`), (m) => `feels ${getal(m[1])}°`],
    [new RegExp(`^Gevoelstemperatuur ${G}( ?)°C$`), (m) => `Feels like ${getal(m[1])}${m[2]}°C`],
    [new RegExp(`^${G} graden$`), (m) => graden(m[1])],
    [new RegExp(`^${G} graad$`), (m) => graden(m[1])],
    [new RegExp(`^${G} km/u$`), (m) => `${getal(m[1])} km/h`],
    [/^(\d+) Bft$/, (m) => `${m[1]} Bft`],
    [/^(N|NNO|NO|ONO|O|OZO|ZO|ZZO|Z|ZZW|ZW|WZW|W|WNW|NW|NNW) (\d+) Bft$/, (m) => `${RICHTING_KORT[m[1]]} ${m[2]} Bft`],
    /* Grafiekvenster: "16:00 · bewolkt", "kans 16:00–17:00", "12 km/u WZW, 3 Bft". */
    [/^(\d{2}:\d{2}) · (.+)$/, (m) => weer(m[2]) && `${m[1]} · ${weer(m[2])}`],
    [/^kans (\d{2}:\d{2})–(\d{2}:\d{2})$/, (m) => `chance ${m[1]}–${m[2]}`],
    [/^(\d{2}:\d{2}, )?neerslagkans (\d+%)(?:, verwacht (.+))?$/, (m) => `${m[1] || ""}chance of precipitation ${m[2]}${m[3] ? ", expected " + m[3].replace(/(\d),(\d)/g, "$1.$2") : ""}`],
    [/^(\d+) km\/u(?: (N|NNO|NO|ONO|O|OZO|ZO|ZZO|Z|ZZW|ZW|WZW|W|WNW|NW|NNW))?, (\d+) Bft$/, (m) => `${m[1]} km/h${m[2] ? " " + RICHTING_KORT[m[2]] : ""}, ${m[3]} Bft`],
    [/^(Zwakke|Matige|Vrij krachtige|Krachtige|Harde|Stormachtige) wind uit het ([a-z]+) \((\d+) Bft\)\.$/, (m) => richting(m[2]) && `${alsNl("X", WINDKRACHT[m[1].toLowerCase() + " wind"])} from the ${richting(m[2])} (${m[3]} Bft).`],
    [/^(Storm|Zware storm|Zeer zware storm|Orkaan) uit het ([a-z]+) \((\d+) Bft\)\.$/, (m) => richting(m[2]) && `${alsNl("X", WINDKRACHT[m[1].toLowerCase()])} from the ${richting(m[2])} (${m[3]} Bft).`],
    [/^Windstil\.$/, () => "Calm."],
    /* Windtegel zonder bekende richting: "Zwakke wind (2 Bft). Windrichting niet beschikbaar." */
    [/^(Zwakke|Matige|Vrij krachtige|Krachtige|Harde|Stormachtige) wind \((\d+) Bft\)\.$/, (m) => `${alsNl("X", WINDKRACHT[m[1].toLowerCase() + " wind"])} (${m[2]} Bft).`],
    [/^(Storm|Zware storm|Zeer zware storm|Orkaan) \((\d+) Bft\)\.$/, (m) => `${alsNl("X", WINDKRACHT[m[1].toLowerCase()])} (${m[2]} Bft).`],
    [/^De wind komt uit het ([a-z]+)\.$/, (m) => richting(m[1]) && `The wind is from the ${richting(m[1])}.`],
    [/^De wind komt uit het ([a-z]+) en draait naar het ([a-z]+)\.$/, (m) => richting(m[1]) && richting(m[2]) && `The wind is from the ${richting(m[1])}, turning ${richting(m[2])}.`],
    [/^In de komende (\d+) uur is de wind het sterkst, met (\d+) Bft \(([a-z ]+)\)\.$/, (m) => WINDKRACHT[m[3]] && `Over the next ${m[1]} hours, the wind peaks at ${m[2]} Bft (${WINDKRACHT[m[3]]}).`],
    [new RegExp(`^Windstoten kunnen (vandaag|morgen) tussen ${T} en ${T} oplopen tot (\\d+) km/u\\.$`), (m) => `Gusts may reach ${m[4]} km/h ${vandaagMorgen(m[1])} between ${m[2]} and ${m[3]}.`],
    [new RegExp(`^De hoogste windstoot (werd|wordt) (vandaag|morgen|gisteren) tussen ${T} en ${T} (?:verwacht, )?(?:met )?(?:ongeveer )?(\\d+) km/u\\.$`), (m) => `The strongest gust ${m[1] === "werd" ? "was" : "is expected"} ${vandaagMorgen(m[2])} between ${m[3]} and ${m[4]}, at about ${m[5]} km/h.`],

    /* Tegels en uurdetails */
    [/^Bewolking (\d+)%$/, (m) => `Cloud cover ${m[1]}%`],
    [/^(\d+)% kans$/, (m) => `${m[1]}% chance`],
    [/^<(\d+)%$/, (m) => `<${m[1]}%`],
    [/^Grafiekgegevens, (\d+) tijdstippen$/, (m) => `Chart data, ${m[1]} points in time`],
    [/^Toon komende (\d+) uur vanaf nu$/, (m) => `Show the next ${m[1]} hours from now`],
    [/^Temperatuur komende (\d+) uur$/, (m) => `Temperature next ${m[1]} hours`],
    [/^De komende (\d+) uur$/, (m) => `The next ${m[1]} hours`],
    [/^Komende (\d+) uur$/, (m) => `Next ${m[1]} hours`],
    [new RegExp(`^${T}, ${G} graden, (\\d+) procent neerslagkans$`), (m) => `${m[1]}, ${graden(m[2])}, ${m[3]} per cent chance of precipitation`],
    [new RegExp(`^${T}, ${G} graad, (\\d+) procent neerslagkans$`), (m) => `${m[1]}, ${graden(m[2])}, ${m[3]} per cent chance of precipitation`],
    [/^Komend uur: (\d+)% kans\.$/, (m) => `Next hour: ${m[1]}% chance.`],
    [/^Komend uur: Droog\.$/, () => "Next hour: dry."],
    /* De app plakt soms een al vertaalde waarde achter "Komend uur:". */
    [/^Komend uur: (.+)\.$/, (m, h) => { const binnen = h.t(m[1]) ?? (h.alEngels(m[1]) ? m[1] : null); return binnen == null ? null : `Next hour: ${binnen.charAt(0).toLowerCase() + binnen.slice(1)}.`; }],
    [new RegExp(`^Komend uur: (\\d+)% · ${G} mm\\. Eerst de neerslagkans, daarna het verwachte totaal in het komende uur\\.$`), (m) => `Next hour: ${m[1]}% · ${getal(m[2])} mm. First the chance of precipitation, then the expected total for the next hour.`],
    [new RegExp(`^Komend uur: (\\d+)% · ${G} mm\\.$`), (m) => `Next hour: ${m[1]}% · ${getal(m[2])} mm.`],
    [/^Komend uur is de neerslagkans (\d+)%\.$/, (m) => `The chance of precipitation in the next hour is ${m[1]}%.`],
    [new RegExp(`^Hoogste neerslagkans in één uur (\\d+) procent; ${G} mm$`), (m) => `Highest hourly chance of precipitation ${m[1]} per cent; ${getal(m[2])} mm`],
    [/^(\d+(?:[,.]\d+)?) mm$/, (m) => `${getal(m[1])} mm`],
    [/^(\d+)% is de hoogste neerslagkans in één uur in de resterende uren van vandaag\.$/, (m) => `${m[1]}% is the highest hourly chance of precipitation in the remaining hours of today.`],
    [new RegExp(`^(\\d+)% is de hoogste neerslagkans in één uur op ${D} (\\d{1,2})(?: (jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec))?\\.$`), (m) => `${m[1]}% is the highest hourly chance of precipitation on ${dagKort(m[2])} ${m[3]}${m[4] ? " " + maand(m[4]) : ""}.`],
    [new RegExp(`^Neerslag vandaag vanaf nu: (\\d+) procent; ${G} millimeter\\. Minimum en maximum gelden voor de volledige kalenderdag\\.$`), (m) => `Precipitation for the rest of today: ${m[1]} per cent; ${getal(m[2])} millimetres. Minimum and maximum apply to the full calendar day.`],
    [new RegExp(`^Voor vandaag is ${G} uur zon berekend\\.$`), (m) => `${getal(m[1])} ${meervoud(m[1], "hour", "hours")} of sunshine ${meervoud(m[1], "is", "are")} forecast for today.`],
    [new RegExp(`^Verwachte UV-piek (lag )?rond ${T} · (laag|matig|hoog|zeer hoog|extreem)\\.$`), (m) => `Expected UV peak ${m[1] ? "was " : ""}around ${m[2]} · ${UV[m[3]]}.`],
    [new RegExp(`^Verwachte UV-piek vandaag: ${G} \\((laag|matig|hoog|zeer hoog|extreem)\\)(\\.?)$`), (m) => `Expected UV peak today: ${getal(m[1])} (${UV[m[2]]})${m[3]}`],
    [/^Gegevens opgehaald om (\d{1,2}:\d{2}) · minder dan 1 min geleden$/, (m) => `Updated at ${m[1]} · less than a minute ago`],
    [/^Gegevens opgehaald om (\d{1,2}:\d{2}) · (\d+) min geleden$/, (m) => `Updated at ${m[1]} · ${m[2]} min ago`],
    [/^(<?\d+) ?korrels?\/m³$/, (m) => `${m[1]} grains/m³`],
    [/^Gemiddeld zicht: (\d+)\+ km$/, (m) => `Average visibility: ${m[1]}+ km`],
    [new RegExp(`^Gemiddeld zicht: ${G} km$`), (m) => `Average visibility: ${getal(m[1])} km`],
    [new RegExp(`^(Slecht|Beperkt) zicht: ${G} km\\.$`), (m) => `${m[1] === "Slecht" ? "Poor" : "Reduced"} visibility: ${getal(m[2])} km.`],
    [/^(Maanondergang|Maanopkomst) om (\d{1,2}:\d{2})\.$/, (m) => `${m[1] === "Maanondergang" ? "Moonset" : "Moonrise"} at ${m[2]}.`],
    [/^(nieuwe maan|wassende sikkel|eerste kwartier|wassende maan|volle maan|afnemende maan|laatste kwartier|afnemende sikkel), (\d+) procent verlicht$/, (m) => `${MAANFASE[m[1]]}, ${m[2]} per cent illuminated`],
    [/^Beste periode: (\d{1,2}:\d{2})–(\d{1,2}:\d{2})\.$/, (m) => `Best period: ${m[1]}–${m[2]}.`],
    [/^Beste periode: nu tot (\d{1,2}:\d{2})\.$/, (m) => `Best period: now until ${m[1]}.`],
    [/^Geen gunstig kijkvenster door (.+)\.$/, (m) => { const r = oorzaken(m[1]); return r && `No favourable viewing window because of ${r}.`; }],
    [/^Matige omstandigheden, maar door (.+) geen gunstig kijkvenster\.$/, (m) => { const r = oorzaken(m[1]); return r && `Moderate conditions, but no favourable viewing window because of ${r}.`; }],

    /* Kans op weer, dagdelen */
    /* Korte dagomschrijvingen (Zeven dagen, tegels): natuurlijk en ongeveer zo
       lang als het Nederlands, zodat ze niet worden afgekapt. */
    [/^(Zeer kleine|Kleine|Grote|Zeer grote) kans op (.+?)(?: (in de (?:vroege ochtend|ochtend|middag|avond|nacht)))?\.?$/, (m) => {
      const w = WEER[m[2].toLowerCase()];
      if (!w) return null;
      const punt = /\.$/.test(m[0]) ? "." : "";
      const deel = m[3] ? " " + DAGDEEL[m[3]] : "";
      const kans = m[1].toLowerCase();
      const zin = kans === "grote" ? `${alsNl("X", w)} likely${deel}` : kans === "zeer grote" ? `${alsNl("X", w)} very likely${deel}` : `${alsNl("X", KANS[kans])} chance of ${w}${deel}`;
      return zin + punt;
    }],
    [/^(Regen|Neerslag|Onweer) mogelijk (in de (?:vroege ochtend|ochtend|middag|avond|nacht))$/, (m) => `${alsNl("X", WEER[m[1].toLowerCase()])} possible ${DAGDEEL[m[2]]}`],

    /* Weer nu (deelkaart, samenvattingen) */
    [/^Weer in (.+) vandaag$/, (m) => `Weather in ${plaats(m[1])} today`],
    [/^Weer in (.+)$/, (m) => `Weather in ${plaats(m[1])}`],
    [/^Klimaat in (.+)$/, (m) => `Climate in ${m[1]}`],
    [/^Weer (.+) vandaag en per uur \| watishetweer\.nl$/, (m) => `${plaats(m[1])} weather today and by the hour | watishetweer.nl`],
    [/^Weer (.+) vandaag, morgen en per uur$/, (m) => `${plaats(m[1])} weather today, tomorrow and by the hour`],
    [/^Deel het weer voor (.+)$/, (m) => `Share the weather for ${plaats(m[1])}`],
    [/^\+ (.+) bewaren$/, (m) => `+ Save ${plaats(m[1])}`],
    [/^Weer voor (.+) ophalen…$/, (m) => `Fetching the weather for ${plaats(m[1])}…`],
    [/^(.+) · watishetweer\.nl$/, (m) => `${m[1]} · watishetweer.nl`],
    [/^Gemiddelden (\d{4})–(\d{4}), KNMI-station (.+?)(?: \((\d+) km\))?\.$/, (m) => `Averages ${m[1]}–${m[2]}, KNMI station ${m[3]}${m[4] ? ` (${m[4]} km)` : ""}.`],
    [/^In (.+) is (januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december) met gemiddeld (−?-?\d+) °C overdag de warmste maand; in (januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december) is het 's nachts gemiddeld (−?-?\d+) °C\.$/,
      (m) => `In ${m[1]}, ${maand(m[2])} is the warmest month, with an average daytime high of ${getal(m[3])} °C; in ${maand(m[4])}, the average night-time low is ${getal(m[5])} °C.`],
    [/^Per jaar valt er ongeveer ([\d.]+) mm neerslag en schijnt de zon zo'n ([\d.]+) uur\.$/, (m) => `Each year brings about ${getal(m[1])} mm of precipitation and roughly ${getal(m[2])} hours of sunshine.`],
    [/^Bekijk het actuele weer in (.+?), (.+?), met neerslag voor de komende uren en de 7-daagse verwachting\.$/, (m) => `See the current weather in ${plaats(m[1])}, ${PROVINCIE[m[2]] || m[2]}, with precipitation for the coming hours and the 7-day forecast.`],
    [/^Alle tijden volgen de lokale tijd van de gekozen plaats\.$/, () => "All times are local to the chosen place."],

    /* Briefing: neerslag nu en straks */
    [new RegExp(`^Er valt nu neerslag: ${G} mm/u\\.$`), (m) => `Precipitation is falling now: ${getal(m[1])} mm/h.`],
    [new RegExp(`^Rond ${T} wordt het naar verwachting droog\\.$`), (m) => `It is expected to turn dry around ${m[1]}.`],
    [new RegExp(`^Rond ${T} wordt het droog\\.$`), (m) => `It will turn dry around ${m[1]}.`],
    [new RegExp(`^Er valt nu neerslag\\. Rond ${T} wordt het naar verwachting droog\\.$`), (m) => `There is precipitation now. It is expected to turn dry around ${m[1]}.`],
    [new RegExp(`^In de komende twee uur wordt daarna ongeveer ${G} mm verwacht\\.$`), (m) => `After that, about ${getal(m[1])} mm is expected over the next two hours.`],
    [new RegExp(`^Vanaf ongeveer ${T} wordt neerslag verwacht\\.$`), (m) => `Precipitation is expected from about ${m[1]}.`],
    [new RegExp(`^Verwachte hoeveelheid: ongeveer ${G} mm\\.$`), (m) => `Expected amount: about ${getal(m[1])} mm.`],
    [new RegExp(`^In totaal ongeveer ${G} mm\\.$`), (m) => `About ${getal(m[1])} mm in total.`],
    [/^Het is nu droog\.$/, () => "It is dry now."],
    [/^De kans op neerslag in de komende twee uur is zeer klein \(maximaal (\d+)%\)\.$/, (m) => `The chance of precipitation in the next two hours is very low (at most ${m[1]}%).`],
    [/^Er is een (zeer kleine|kleine|grote|zeer grote) kans op neerslag in de komende twee uur \(maximaal (\d+)%\)\.$/, (m) => `There is a ${KANS[m[1]]} chance of precipitation in the next two hours (at most ${m[2]}%).`],
    [/^De komende twee uur is er een (grote|zeer grote) kans op neerslag, maar de (?:verwachte )?hoeveelheid is onzeker\.$/, (m) => `There is a ${KANS[m[1]]} chance of precipitation in the next two hours, but the amount is uncertain.`],
    [/^De komende twee uur is de kans op neerslag zeer groot, maar de (?:verwachte )?hoeveelheid is onzeker\.$/, () => "The chance of precipitation in the next two hours is very high, but the amount is uncertain."],
    [/^Volgens het weermodel valt er nu (.+)\.$/, (m) => { const w = WEER[m[1].toLowerCase()]; return w && `According to the weather model, there ${isAre(w)} ${w} now.`; }],

    /* Briefing: temperatuur */
    [new RegExp(`^Het verwachte maximum (lag|ligt) (vandaag|morgen) rond ${T} op ${G} (graden|graad)\\.$`), (m) => `${m[2] === "morgen" ? "Tomorrow" : "Today"}'s expected high ${m[1] === "lag" ? "was" : "is"} ${graden(m[4])}, around ${m[3]}.`],
    [new RegExp(`^Het verwachte maximum voor morgen is ${G} (graden|graad)\\.$`), (m) => `The expected high for tomorrow is ${graden(m[1])}.`],
    [new RegExp(`^De maximumtemperatuur van vandaag ligt rond ${G} (graden|graad)\\.$`), (m) => `Today's high is around ${graden(m[1])}.`],
    [new RegExp(`^Morgen wordt het ongeveer ${G} (graden|graad)\\.$`), (m) => `Tomorrow it will be about ${graden(m[1])}.`],
    [new RegExp(`^Vannacht koelt het af naar ongeveer ${G} (graden|graad)\\.$`), (m) => `Tonight it cools to about ${graden(m[1])}.`],
    [new RegExp(`^Vannacht daalt de temperatuur naar ongeveer ${G} (graden|graad)\\.$`), (m) => `Tonight the temperature falls to about ${graden(m[1])}.`],
    [new RegExp(`^Vannacht loopt de temperatuur op naar ongeveer ${G} (graden|graad)\\.$`), (m) => `Tonight the temperature rises to about ${graden(m[1])}.`],
    [new RegExp(`^Vannacht blijft de temperatuur rond ${G} (graden|graad)\\.$`), (m) => `Tonight the temperature stays around ${graden(m[1])}.`],
    [new RegExp(`^De minimumtemperatuur vannacht ligt rond ${G} (graden|graad)\\.$`), (m) => `Tonight's low is around ${graden(m[1])}.`],
    [new RegExp(`^De temperatuur blijft tot rond ${T} ongeveer ${G} (graden|graad)\\.$`), (m) => `The temperature stays at about ${graden(m[2])} until around ${m[1]}.`],
    [new RegExp(`^De temperatuur blijft de komende uren rond ${G} (graden|graad)\\.$`), (m) => `The temperature stays around ${graden(m[1])} over the coming hours.`],

    /* Waarschuwingen */
    [/^Code (geel|oranje|rood): (.+)$/, (m) => { const w = WAARSCHUWING[m[2].toLowerCase()]; return w && `${({ geel: "Yellow", oranje: "Orange", rood: "Red" })[m[1]]} warning: ${w}`; }],
    [/^Officiële weerwaarschuwing(?: \((geel|oranje|rood)\))?:$/, (m) => `Official weather warning${m[1] ? ` (${({ geel: "yellow", oranje: "orange", rood: "red" })[m[1]]})` : ""}:`],
    [/^Officiële titel:$/, () => "Official title:"],
    [/^Uitleg van watishetweer\.nl:$/, () => "Explanation from watishetweer.nl:"],
    [/^Officiële titel: (.+?)[.·]? ?·? Bron: (.+?)\.?$/, (m) => `Official title: ${m[1]} · Source: ${m[2]}`],
    [/^Geldig tot (morgen |vandaag )?(\d{1,2}:\d{2})\.$/, (m) => `Valid until ${m[1] ? vandaagMorgen(m[1].trim()) + " " : ""}${m[2]}.`],
    [/^Zware windstoten tot (\d+) km\/u\.$/, (m) => `Severe gusts up to ${m[1]} km/h.`],
    [/^Lokaal zware onweersbuien met hagel\.$/, () => "Severe thunderstorms with hail in places."],
    [/^Zware windstoten in de verwachting \(tot (\d+) km\/u\)\.$/, (m) => `Severe gusts in the forecast (up to ${m[1]} km/h).`],
    [/^Zeer hoge UV-index in de verwachting \((\d+(?:,\d+)?)\)\.$/, (m) => `Very high UV index in the forecast (${getal(m[1])}).`],
    [/^Extreme UV-index in de verwachting \((\d+(?:,\d+)?)\)\.$/, (m) => `Extreme UV index in the forecast (${getal(m[1])}).`],
    [/^Luchtkwaliteit volgens het model is (zeer slecht|slecht|extreem slecht) \(Europese AQI (\d+)\)\.$/, (m) => `Modelled air quality is ${LUCHT[m[1]]} (European AQI ${m[2]}).`],
    [/^Luchtkwaliteit volgens het model is ongezond \(AQI VS (\d+)\)\.$/, (m) => `Modelled air quality is unhealthy (US AQI ${m[1]}).`],
    [/^De Amerikaanse weerdienst heeft voor deze locatie een (.+) uitgegeven\.$/, (m) => { const w = WAARSCHUWING[m[1].toLowerCase()]; return w && `The US National Weather Service has issued ${/^[aeiou]/i.test(w) ? "an" : "a"} ${w.toLowerCase()} for this location.`; }],
    [/^Matig veel graspollen verwacht voor dit uur\.$/, () => "Moderate grass pollen expected for this hour."],
    [/^(Weinig|Matig veel|Veel|Zeer veel) (.+) verwacht voor dit uur\.$/, (m) => { const s = POLLENSOORT[m[2].toLowerCase()]; return s && `${alsNl("X", POLLENNIVEAU[m[1].toLowerCase()])} ${s} expected for this hour.`; }],

    /* Grafiekbeschrijving (schermlezer) */
    [/^Verloop van (\d{1,2}) ([a-z]+) (\d{4}) om (\d{1,2}:\d{2}) tot (\d{1,2}) ([a-z]+) (\d{4}) om (\d{1,2}:\d{2}), temperatuur tussen (−?-?\d+) en (−?-?\d+) (?:graad|graden), hoogste neerslagkans( in één uur op deze dag)? (\d+) procent\.$/,
      (m) => datum(m[1], m[2], m[3]) && datum(m[5], m[6], m[7]) && `Chart from ${datum(m[1], m[2], m[3])} at ${m[4]} to ${datum(m[5], m[6], m[7])} at ${m[8]}, temperature between ${getal(m[9])} and ${getal(m[10])} degrees, highest ${m[11] ? "hourly chance of precipitation on this day" : "chance of precipitation"} ${m[12]} per cent.`],
    [/^Neerslagperioden: (.+)\.$/, (m) => { const p = perioden(m[1]); return p && `Precipitation periods: ${p}.`; }],
    [/^Verwachte meetbare neerslag: (.+)\.$/, (m) => { const p = perioden(m[1]); return p && `Expected measurable precipitation: ${p}.`; }]
  ];

  /* Officiële waarschuwingen: titels (MeteoAlarm NL-teksten en NWS-vertalingen van de app). */
  const WAARSCHUWING = {
    "onweersbuien": "thunderstorms", "zware windstoten": "severe gusts", "windstoten": "gusts", "gladheid": "slippery roads",
    "hitte": "heat", "mist": "fog", "sneeuw": "snow", "regen": "rain", "zware regen": "heavy rain", "storm": "storm",
    "waakzaamheid voor overstromingen": "flood watch", "waarschuwing voor overstromingen": "flood warning",
    "waarschuwing voor plotselinge overstromingen": "flash flood warning", "waakzaamheid voor tornado's": "tornado watch",
    "waakzaamheid voor zwaar onweer": "severe thunderstorm watch", "waarschuwing voor zwaar onweer": "severe thunderstorm warning",
    "waarschuwing voor extreme hitte": "extreme heat warning", "waarschuwing voor hitte": "heat warning",
    "waarschuwing voor zeer harde wind": "high wind warning", "waarschuwing voor zwaar winterweer": "winter storm warning",
    "officiële waarschuwing": "official warning",
    "hitteadvies": "heat advisory", "mistadvies": "fog advisory", "windadvies": "wind advisory", "winterweeradvies": "winter weather advisory",
    "luchtkwaliteitsadvies": "air quality advisory", "luchtkwaliteitswaarschuwing": "air quality warning", "tornadowaarschuwing": "tornado warning"
  };

  /* "neerslag, bewolking en maanlicht" → "precipitation, cloud and moonlight". */
  const OORZAAK = { "neerslag": "precipitation", "bewolking": "cloud", "maanlicht": "moonlight", "mist of zeer slecht zicht": "fog or very poor visibility", "wind": "wind", "vocht": "humidity", "zicht": "visibility", "beperkt zicht": "reduced visibility", "tijdelijk slechter zicht": "temporarily poorer visibility" };
  function oorzaken(s) {
    const delen = s.split(/, | en /);
    const en = delen.map(d => OORZAAK[d]);
    if (!en.every(Boolean)) return null;
    return en.length === 1 ? en[0] : en.slice(0, -1).join(", ") + " and " + en[en.length - 1];
  }

  /* Namen die in iedere taal gelijk blijven (bronnen, merken, diensten). */
  const eigennamen = [
    "Open-Meteo", "Weather Data Provided by Visual Crossing", "WeatherAPI.com", "CAMS", "MeteoAlarm", "National Weather Service",
    "BigDataCloud", "KNMI", "PostHog Cloud EU", "Google Analytics", "Cloudflare", "watishetweer.nl", "Autoriteit Persoonsgegevens",
    "Maitri Polwatte Gedera", "Heavy rain may cause flooding.", "Weather alert", "Official warning text unavailable.",
    /* Officiële NWS-gebeurtenisnamen: de site toont ze bewust in het origineel. */
    ...["Flood Watch", "Flood Warning", "Flood Advisory", "Flash Flood Watch", "Flash Flood Warning", "Flash Flood Emergency", "Coastal Flood Watch", "Coastal Flood Warning", "Coastal Flood Advisory",
      "Tornado Watch", "Tornado Warning", "Severe Thunderstorm Watch", "Severe Thunderstorm Warning", "Special Weather Statement", "Severe Weather Statement",
      "Heat Advisory", "Excessive Heat Watch", "Excessive Heat Warning", "Extreme Heat Watch", "Extreme Heat Warning", "Wind Advisory", "High Wind Watch", "High Wind Warning",
      "Winter Storm Watch", "Winter Storm Warning", "Winter Weather Advisory", "Blizzard Warning", "Ice Storm Warning", "Freeze Watch", "Freeze Warning", "Frost Advisory",
      "Cold Weather Advisory", "Extreme Cold Watch", "Extreme Cold Warning", "Wind Chill Advisory", "Wind Chill Warning", "Dense Fog Advisory", "Dense Smoke Advisory",
      "Air Quality Alert", "Red Flag Warning", "Fire Weather Watch", "Hurricane Watch", "Hurricane Warning", "Tropical Storm Watch", "Tropical Storm Warning",
      "Storm Surge Watch", "Storm Surge Warning", "Gale Warning", "Storm Warning", "Small Craft Advisory", "Beach Hazards Statement", "Rip Current Statement",
      "High Surf Advisory", "High Surf Warning", "Lake Effect Snow Warning", "Hard Freeze Warning", "Dust Storm Warning", "Blowing Dust Advisory"]
  ];

  /* Korte vormen voor smalle kolomkoppen (tabellen, Zeven dagen, Nachtzicht). */
  const koppen = { "Neerslag": "Precip.", "Zichtscore": "Score", "Bewolking": "Cloud", "Windstoot": "Gust", "Gevoel": "Feels" };
  const kopSelector = "th, .row.kop > *";

  return { exact, patronen, lijsten: { WEER, WINDKRACHT, RICHTING_VOL, RICHTING_KORT }, eigennamen, koppen, kopSelector };
});
