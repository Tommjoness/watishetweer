"use strict";

/* Seizoenspagina's: vaste, jaarlijks terugkerende URL's met de echte
   verwachting zodra de dag binnen het verwachtingsvenster valt. Iedere pagina
   is alleen configuratie; het sjabloon en de runtime zijn gedeeld. Teksten met
   {plaatshouders} vult de runtime in. */

const {LOCATIES,BASIS_URL}=require("./seo-locations.config.js");

function plaatsroute(slug){
  const loc=LOCATIES.find(l=>l.slug===slug);
  if(!loc)throw new Error(`Seizoenspagina verwijst naar onbekende plaatsroute: ${slug}`);
  return {naam:loc.naam,lat:loc.lat,lon:loc.lon,href:`/weer/${loc.slug}/`};
}

const SEIZOENSPAGINAS=Object.freeze([
  Object.freeze({
    slug:"witte-kerst",
    naam:"Witte kerst",
    tijdzone:"Europe/Amsterdam",
    vensterDagen:7,
    ochtendUur:9,
    dagen:[{maand:12,dag:25,label:"Eerste kerstdag"},{maand:12,dag:26,label:"Tweede kerstdag"}],
    titel:"Witte kerst {jaar}: kans op sneeuw met kerst",
    beschrijving:"Wordt het een witte kerst in {jaar}? Vanaf {datum} staat hier de verwachting voor sneeuw en temperatuur met kerst, voor De Bilt en grote plaatsen in Nederland.",
    intro:"Wordt het een witte kerst? Zodra kerst binnen de 7-daagse verwachting valt, staat hier de verwachting voor sneeuw op eerste en tweede kerstdag, voor De Bilt en zes grote plaatsen verspreid over Nederland.",
    uitleg:{
      kop:"Wanneer is het een witte kerst?",
      alineas:[
        "Er is officieel sprake van een witte kerst wanneer er in De Bilt op beide kerstdagen een gesloten sneeuwdek wordt gemeten. Sinds 1901 gebeurde dat acht keer; de laatste keer was in 2010."
      ],
      bron:{naam:"KNMI",url:"https://www.knmi.nl/over-het-knmi/nieuws/witte-kerst-steeds-zeldzamer"}
    },
    teksten:{
      ver:"Vanaf {datum} verschijnt hier de verwachting voor eerste kerstdag. De verwachting voor tweede kerstdag volgt op {datum2}.",
      aftellenMeer:"Nog {n} dagen tot {dag}.",
      aftellenGetal:"dagen tot {dag}",
      aftellenMorgen:"Morgen is het {dag}.",
      aftellenVandaag:"Vandaag is het {dag}.",
      allemaal:"Volgens de huidige verwachting ligt er op beide kerstdagen sneeuw in {plaats}. Blijft dat zo, dan is het officieel een witte kerst.",
      nietOp:"Volgens de huidige verwachting wordt het geen officiële witte kerst: in {plaats} ligt op {dag} geen sneeuwdek.",
      totNuToe:"Volgens de huidige verwachting ligt er op {dag} sneeuw in {plaats}. De verwachting voor {volgende} verschijnt op {datum}.",
      dagLater:"{dag}: de verwachting verschijnt op {datum}.",
      toelichting:"Sneeuwdek is de verwachte sneeuwhoogte in de ochtend. Een verwachting een week vooruit kan nog flink veranderen; deze pagina toont steeds de nieuwste. Bron: Open-Meteo.",
      fout:"De verwachting is op dit moment niet beschikbaar. Probeer het later opnieuw, of bekijk het weer voor je eigen plaats."
    },
    plaatsen:[
      {naam:"De Bilt",lat:52.0989,lon:5.1797,officieel:true},
      plaatsroute("amsterdam"),
      plaatsroute("rotterdam"),
      plaatsroute("utrecht"),
      plaatsroute("groningen"),
      plaatsroute("eindhoven"),
      plaatsroute("maastricht")
    ]
  }),
  Object.freeze({
    slug:"oud-en-nieuw",
    naam:"Oud en nieuw",
    soort:"middernacht",
    tijdzone:"Europe/Amsterdam",
    vensterDagen:7,
    /* De nacht loopt door tot 1 januari 02:00: die dag moet ook in het venster vallen. */
    extraDagen:1,
    uren:[22,23,24,25,26],
    middernachtUur:24,
    stootDrempel:50,
    mistZicht:1000,
    dagen:[{maand:12,dag:31,label:"Oudejaarsdag"}],
    titel:"Weer oud en nieuw {jaar}: neerslag, wind en mist rond middernacht",
    beschrijving:"Hoe wordt het weer met oud en nieuw {jaar}? Vanaf {datum} staat hier de verwachting voor neerslag, wind en mist rond middernacht in zeven grote plaatsen in Nederland.",
    intro:"Hoe wordt het weer met oud en nieuw? Zodra de nacht binnen de 7-daagse verwachting valt, staat hier per plaats de verwachting van 22:00 tot 02:00: neerslag, wind, temperatuur en mist, voor zeven grote plaatsen verspreid over Nederland.",
    uitleg:{
      kop:"Waar let je op rond middernacht?",
      alineas:[
        "Rond de jaarwisseling zijn vooral neerslag, wind en zicht van belang. Bij harde windstoten waait vuurwerk sneller af. Bij weinig wind en mist blijft vuurwerkrook langer hangen, waardoor je minder ver kunt zien."
      ]
    },
    teksten:{
      ver:"De verwachting voor de nacht van oud en nieuw verschijnt hier op {datum}, zodra die binnen de 7-daagse verwachting valt.",
      aftellenMeer:"Nog {n} dagen tot {dag}.",
      aftellenGetal:"dagen tot {dag}",
      aftellenMorgen:"Morgen is het {dag}.",
      aftellenVandaag:"Vandaag is het {dag}.",
      aftellenBezig:"De nacht van oud en nieuw is nu bezig.",
      nachtKop:"Rond middernacht",
      droogOveral:"Rond middernacht blijft het volgens de huidige verwachting overal droog.",
      neerslagIn:"Rond middernacht valt er volgens de huidige verwachting neerslag in {plaatsen}.",
      stotenIn:"Windstoten van {kmh} km/u of meer in {plaatsen}.",
      mistIn:"Kans op mist (zicht onder 1 km) in {plaatsen}.",
      dagLater:"{dag}: de verwachting verschijnt op {datum}.",
      toelichting:"Neerslag is opgeteld over 22:00 tot 02:00, met de hoogste kans in één uur. Wind is het gemiddelde met de hoogste windstoot; temperatuur en windrichting gelden voor middernacht. Een verwachting een week vooruit kan nog flink veranderen; deze pagina toont steeds de nieuwste. Bron: Open-Meteo.",
      fout:"De verwachting is op dit moment niet beschikbaar. Probeer het later opnieuw, of bekijk het weer voor je eigen plaats."
    },
    plaatsen:[
      plaatsroute("amsterdam"),
      plaatsroute("rotterdam"),
      plaatsroute("den-haag"),
      plaatsroute("utrecht"),
      plaatsroute("groningen"),
      plaatsroute("eindhoven"),
      plaatsroute("maastricht")
    ]
  }),
  Object.freeze({
    slug:"herfstvakantie",
    naam:"Herfstvakantie",
    soort:"vakantie",
    tijdzone:"Europe/Amsterdam",
    vensterDagen:7,
    /* Adviesdata van het ministerie van OCW per regio (rijksoverheid.nl). Ieder
       jaar een regel erbij; ontbreekt het volgende jaar, dan zegt de pagina dat
       de data nog niet bekend zijn. */
    perioden:{
      2026:[{regio:"noord",van:"2026-10-10",tot:"2026-10-18"},{regio:"midden",van:"2026-10-17",tot:"2026-10-25"},{regio:"zuid",van:"2026-10-17",tot:"2026-10-25"}],
      2027:[{regio:"noord",van:"2027-10-16",tot:"2027-10-24"},{regio:"midden",van:"2027-10-16",tot:"2027-10-24"},{regio:"zuid",van:"2027-10-23",tot:"2027-10-31"}]
    },
    titel:"Weer herfstvakantie {jaar}: regen, zon en temperatuur per dag",
    beschrijving:"Hoe wordt het weer in de herfstvakantie {jaar}? Per dag regen, zon en temperatuur in zeven grote plaatsen, met de vakantiedata voor regio noord, midden en zuid.",
    intro:"Hoe wordt het weer in de herfstvakantie? Zodra vakantiedagen binnen de 7-daagse verwachting vallen, staat hier per dag de verwachting voor regen, zon en temperatuur, voor zeven grote plaatsen verspreid over Nederland.",
    uitleg:{
      kop:"Wanneer is de herfstvakantie?",
      alineas:[
        "De herfstvakantie valt niet overal tegelijk: Nederland is voor de schoolvakanties ingedeeld in regio noord, midden en zuid. Dit zijn de adviesdata van het ministerie van OCW; scholen mogen daarvan afwijken. Kijk bij twijfel in de schoolgids."
      ],
      bron:{naam:"Rijksoverheid",url:"https://www.rijksoverheid.nl/onderwerpen/schoolvakanties/overzicht-schoolvakanties-per-schooljaar"}
    },
    teksten:{
      ver:"Vanaf {datum} staat hier de verwachting voor de eerste vakantiedag.",
      onbekend:"De data van de herfstvakantie {jaar} zijn nog niet bekend.",
      aftellenMeer:"Nog {n} dagen tot de herfstvakantie{regio}.",
      aftellenGetal:"dagen tot de herfstvakantie{regio}",
      aftellenMorgen:"Morgen begint de herfstvakantie{regio}.",
      aftellenVandaag:"Vandaag begint de herfstvakantie{regio}.",
      bezig:"Het is herfstvakantie in regio {regios}.",
      overal:"Het is overal herfstvakantie.",
      begintNog:"In regio {regios} begint de vakantie op {datum}.",
      allesDroog:"Volgens de huidige verwachting blijft het op alle {m} vakantiedagen in de verwachting overwegend droog.",
      deelsDroog:"Volgens de huidige verwachting {zijn} {n} van de {m} vakantiedagen in de verwachting overwegend droog.",
      nietsDroog:"Volgens de huidige verwachting valt er op alle {m} vakantiedagen in de verwachting in een groot deel van het land regen.",
      dagDroog:"Volgens de huidige verwachting blijft het op {dag} overwegend droog.",
      dagNat:"Volgens de huidige verwachting valt er op {dag} in een groot deel van het land regen.",
      later:"De vakantiedagen tot en met {tot} verschijnen hier vanzelf zodra ze binnen de 7-daagse verwachting vallen.",
      toelichting:"Overwegend droog: in minder dan de helft van de plaatsen valt 1 mm regen of meer. Zon is het verwachte aantal uren zonneschijn. Een verwachting een week vooruit kan nog flink veranderen; deze pagina toont steeds de nieuwste. Bron: Open-Meteo.",
      fout:"De verwachting is op dit moment niet beschikbaar. Probeer het later opnieuw, of bekijk het weer voor je eigen plaats."
    },
    plaatsen:[
      plaatsroute("groningen"),
      plaatsroute("zwolle"),
      plaatsroute("amsterdam"),
      plaatsroute("den-haag"),
      plaatsroute("utrecht"),
      plaatsroute("eindhoven"),
      plaatsroute("maastricht")
    ]
  })
]);

function seizoenUrl(pagina){return `${BASIS_URL}/${pagina.slug}/`;}

module.exports={SEIZOENSPAGINAS,seizoenUrl};
