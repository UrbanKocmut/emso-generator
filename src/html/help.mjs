export const help = {
    xml: [
        ['Uporaba', 'Prilepite XML, izberite 2 presledka (privzeto), 4 presledke ali tabulator ter pritisnite OBLIKUJ. Ctrl/⌘ + Enter sproži oblikovanje. Izpis kopirate z gumbom KOPIRAJ IZPIS. POČISTI prekliče delo in odstrani vsebino.'],
        ['Ohranjena vsebina', 'Brskalniški razčlenjevalnik preveri veljavnost. Oblikovanje iz izvirnih gradnikov ohrani deklaracijo XML, imenske prostore, vrstni red atributov, komentarje, CDATA in ubežna zaporedja. Poddrevesa z mešano vsebino in xml:space="preserve" ostanejo nespremenjena. Zamaknejo se strukture, ki vsebujejo samo elemente.'],
        ['Omejitve in napake', 'Deklaracije DTD in entitet niso dovoljene. Vnos in izpis sta omejena na 16 MiB znakov. Ob napačnem XML se delni izpis ne prikaže. Preverite zaključne oznake, narekovaje, imenske prostore in zapis &amp;. Uvoz datotek, prenos in strnjevanje niso vključeni.']
    ],
    'jwt-generator': [
        ['Uporaba', 'Izberite HS256 (privzeto), HS384 ali HS512. Vnesite skrivnost kot besedilo UTF-8 ali Base64/base64url; gumb NAKLJUČNA SKRIVNOST BASE64 ustvari ustrezno dolg varen ključ. Najmanjše dekodirane dolžine so 32, 48 in 64 bajtov.'],
        ['Zahtevki', 'Izdajatelj, subjekt in občinstvo so neobvezna besedila. Lokalni datum in čas za izdajo, začetek veljavnosti in potek se pretvorijo v Unix sekunde. Prazna polja se izpustijo. ZDAJ nastavi izdajo, POTEČE ČEZ ENO URO pa potek. Dodatni zahtevki morajo biti objekt JSON, npr. {"role":"test"}, brez iss, sub, aud, iat, nbf in exp; te vnesite v namenska polja.'],
        ['Podpis in zasebnost', 'USTVARI JWT ali Ctrl/⌘ + Enter podpiše žeton z Web Crypto. Glava vsebuje izbrani algoritem in typ: JWT. Preverite predogleda glave in vsebine ter kopirajte žeton. Sprememba vnosa razveljavi prejšnji izpis. POČISTI izbriše tudi skrivnost. Žetoni so podpisani, niso šifrirani; vsebino lahko prebere vsak, ki ima žeton. Skrivnosti in žetoni ostanejo v pomnilniku zavihka.'],
        ['Odpravljanje težav', 'Za Web Crypto uporabite varen izvor HTTPS ali localhost. Pri prekratkem ključu ustvarite novo naključno skrivnost. Neveljaven Base64 ali konflikt zahtevkov popravite pred podpisom. Časi sledijo uri naprave. Za pregled in preverjanje obstoječih žetonov ostaja na voljo ločeno orodje Preverjanje JWT.']
    ],
    'image-resizer': [
        ['Uporaba', 'Izberite ali povlecite več slik JPEG, PNG in WebP. Kartice pokažejo ime, predogled, izvirne mere in stanje. Slike lahko posamično odstranite. Nastavite skupne mere in pritisnite SPREMENI VELIKOST ali Ctrl/⌘ + Enter.'],
        ['Mere in format', 'Privzeto se slika prilega v 1920 × 1080 brez povečanja. Povečanje lahko vključite; odstotni način sprejme 1–400 %. Razmerje stranic se ohrani z zaokrožitvijo na celo slikovno piko. Format izvirnika je privzet; izberete lahko tudi JPEG, PNG ali WebP. Kakovost JPEG in WebP je 90 %. PNG in WebP ohranita prosojnost, JPEG uporabi belo ozadje.'],
        ['Prenosi in omejitve', 'Obdelava poteka zaporedno. Prenesite posamezne uspešne izhode ali ZIP vseh uspešnih slik. Enaka imena dobijo številsko pripono. Napaka ene slike ne odstrani drugih rezultatov; če ZIP ne uspe, ostanejo posamezni prenosi. Največ 50 datotek, 64 MiB na datoteko, skupaj 128 MiB izbranih datotek in 128 MiB rezultatov v zavihku. Vhod je omejen na 40 milijonov slikovnih pik, izhod na 16 milijonov in 8192 pik na stranico.'],
        ['Orientacija in odpravljanje težav', 'Brskalnik upošteva orientacijo slike. Rezultat je statična slika; animacija in izvirni metapodatki se ne ohranijo. Nepodprt izhodni format ali poškodovana slika sproži napako na kartici. Pri prekoračitvi meja zmanjšajte mere ali število datotek. Sprememba nastavitev razveljavi prenose; POČISTI prekliče delo in sprosti slike ter povezave.']
    ],
    overview: [
        ['Orodja za testne podatke in dokumente', 'Izberite generator EMŠO ali davčnih številk, pregled ali ustvarjanje JWT, oblikovanje JSON ali XML, pretvorbo Sparkasse CSV v QIF, urejanje PDF ali spremembo velikosti slik. Vsako orodje ima svoj naslov, ki ga lahko shranite med zaznamke.'],
        ['Primer uporabe', 'Za izmišljeno preizkusno osebo pripravite testni identifikator, uredite vzorčni JSON in sestavite PDF iz svojih dokumentov. Ustvarjeni identifikatorji niso dokaz o vpisu v register.'],
        ['Zasebnost in delo brez povezave', 'Obdelava podatkov in datotek poteka v tem zavihku. Spletno mesto jih ne pošilja v obdelavo strežniku. Statične datoteke aplikacije se lahko shranijo za delo brez povezave. Izbrane datoteke in rezultati se ne shranjujejo trajno. Nastavitve pretvornika se shranijo samo ob vaši izbiri.'],
        ['Pomoč in dostop za agente', 'Spodaj pri vsakem orodju so opisane možnosti in omejitve. Če pri delu uporabite ponudnika umetne inteligence, lahko ta prejme podatke, ki mu jih posredujete ali omogočite prebrati. Njegova pravila obdelave in hrambe so ločena od lokalnega delovanja te strani.']
    ],
    emso: [
        ['Namen in izmišljeni primer', 'Generator je namenjen razvoju in preizkušanju obrazcev. Primer: izmišljena oseba, rojena 15. 6. 1990; izberite datum, ženski spol in količino 3. Rezultati so besedilni nizi s 13 števkami, da začetne ničle ostanejo ohranjene.'],
        ['Možnosti', 'Ustvarite od 1 do 5.000 zapisov (privzeto 10). Datum od leta 1900 do danes lahko pustite prazen; izberete lahko naključni, moški ali ženski spol. Možnost »Samo 18+« izklopi izbiro datuma in ustvari naključne odrasle osebe.'],
        ['Kontrola in resnična registracija', 'Veljavna kontrolna številka potrjuje matematično skladnost zapisa. Ne potrjuje identitete, vpisa v Centralni register prebivalstva ali tega, da številka še ni dodeljena. Sintetični rezultat lahko sovpada z resnično številko; uporabljajte ga v testnih podatkih.'],
        ['Odpravljanje težav', 'Preverite koledarski datum in izključite datum v prihodnosti. Če je datum onemogočen, je vključena izbira 18+. Pri prenosu v preglednico ohranite besedilni tip celice.']
    ],
    vat: [
        ['Namen in izmišljeni primer', 'Za preizkus obrazca ustvarite 3 davčne številke s predpono SI. Primer kontrolno skladnega zapisa je SI15012557; ta primer ni trditev o resničnem davčnem zavezancu.'],
        ['Možnosti', 'Količina je od 1 do 5.000 (privzeto 10), predpona SI je privzeto vključena. Rezultat je niz osmih števk oziroma SI in osem števk. Predpona ne spremeni izračuna kontrolne številke.'],
        ['Kaj je preverjeno', 'Preverjena je osemmestna kontrola po modulu 11. Orodje ne preverja vpisa pri FURS ali v VIES, identitete imetnika ali statusa zavezanca za DDV. Predpona SI sama ne potrjuje registracije za DDV.'],
        ['Odpravljanje težav', 'Če ciljni obrazec zahteva samo osem števk, izklopite predpono. Zavrnitev kontrolno pravilnega rezultata v uradni storitvi je pričakovana: sintetična številka ni dokaz registracije.']
    ],
    json: [
        ['Namen in izmišljeni primer', 'Oblikujte ali strnite besedilo JSON brez izgube izvirnih številskih zapisov. Primer {"n":9007199254740993,"n":-0,"cena":1.2300} ohrani veliko celo število, oba enaka ključa, negativno ničlo in zaključni ničli.'],
        ['Možnosti', 'Izberite 2 presledka, 4 presledke ali tabulator, strnjen izpis in razvrščanje ključev objektov. Enaki ključi pri razvrščanju ohranijo medsebojni vrstni red; vrstni red polj se ne spremeni.'],
        ['Natančnost in omejitve', 'Izvirne številske zapise, ubežna zaporedja in podvojene ključe ohrani oblikovalnik iz besedilnih gradnikov. Drugi programi jih lahko ob razčlenjevanju zaokrožijo ali združijo. Samodejno oblikovanje se nad 2 MiB znakov ustavi do pritiska OBLIKUJ; zelo globoko gnezdenje lahko preseže sklad brskalnika.'],
        ['Odpravljanje težav', 'JSON zahteva dvojne narekovaje, nima komentarjev in ne dovoljuje zadnje vejice. Ob napaki popravite vnos; delni rezultat se ne izpiše. API sprejme največ 16 MiB znakov in vhod/izhod vedno vrača kot besedilo.']
    ],
    jwt: [
        ['Namen in izmišljeni primer', 'Pregled je namenjen razčlenjevanju in preverjanju JWT. Izmišljeni nepodpisani primer eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZW1vIn0. vsebuje algoritem none in zahtevek sub z vrednostjo demo; njegov podpis ostane nepreverjen.'],
        ['Tri ločena preverjanja', 'Struktura preveri tri segmente, glavo in vsebino. Zahtevki exp, nbf in iat se presodijo glede na uro naprave; manjkajoči zahtevki ostanejo označeni. Preverjanje podpisa je ločen korak z vašim ključem. Samo razčlenitev ni potrditev pristnosti.'],
        ['Možnosti in zaupanje ključu', 'Podprte so družine HS, RS, PS in ES s SHA-256/384/512. Za HMAC uporabite skrivnost UTF-8 ali Base64/base64url; za asimetrične algoritme javni ključ SPKI PEM. Ujemanje podpisa z dobavljenim ključem ne dokazuje, da ključ pripada zaupanemu izdajatelju. Izdajatelj, občinstvo in dovoljenja se ne preverjajo proti vaši aplikaciji.'],
        ['Odpravljanje težav', 'Preverite celoten žeton, algoritem, obliko ključa in sistemsko uro. Podprto preverjanje potrebuje Web Crypto. Algoritem none in nepodprte kritične razširitve ne pomenijo veljavnega podpisa. Skrivnost in žeton se obdelata lokalno; ponudnik AI, ki mu omogočite dostop, ima svoja pravila zasebnosti.']
    ],
    qif: [
        ['Namen in izmišljeni primer', 'Pretvorite izvoz prometa Sparkasse, ločen s podpičji. Primer: glava »Datum knjiženja;Naziv prejemnika;V breme;V dobro;Namen« in vrstica »10.09.2026;Izmišljena trgovina;12,34;;Test«. QIF vsebuje !Type:Bank, D10.09.2026, T-12.34, PIzmišljena trgovina, MTest in zaključek ^, vsako polje v svoji vrstici.'],
        ['Glave, zneski in datumi', 'Prva celica glave mora biti Datum knjiženja. Stolpci V breme in V dobro določijo znesek, Naziv prejemnika prejemnika, Namen in reference pa opombo. Decimalna vejica in ločila tisočic se pretvorijo v cente; dobroimetje ima prednost, če sta oba zneska neničelna. Privzeti datum je %d.%m.%Y; podprti gradniki so %d, %m, %Y in %y.'],
        ['Možnosti in kodiranja', 'Vhod: samodejna zaznava, UTF-8, Windows-1250 ali Latinica-1. Izhod: UTF-8 ali Windows-1250. Vrsta računa: Bank, CCard ali Cash. Po izbiri dodajte kode INTE/COMM/REFU/OTHR v opombe ali ustavite pretvorbo ob prvi napaki. Privzeto se napačne transakcije preskočijo z opozorilom.'],
        ['Opozorila in odpravljanje težav', 'Preverite število transakcij in opozorila pred uvozom: uspešna delna pretvorba ni potrditev vseh vrstic. Prazni datumi se preskočijo; manjkajoči ali ničelni zneski in neveljavni datumi sprožijo opozorila. Če so šumniki napačni, izberite vhodno kodiranje. Znaki zunaj Windows-1250 zahtevajo UTF-8. Predogled nad 80.000 znakov je skrajšan, datoteka pa vsebuje celoten rezultat. Orodje ne uvaža transakcij v banko in ne prenaša denarja.']
    ],
    pdf: [
        ['Namen in izmišljeni primer', 'Združite ali preuredite strani lokalnih PDF-jev. Primer: iz vzorčnega dvostranskega dokumenta postavite stran 2 pred stran 1 in jo zavrtite za 90° v desno, nato ustvarite nov dokument. Izvirna datoteka ostane na vaši napravi.'],
        ['Možnosti', 'Dodajte več datotek, premikajte strani z vlečenjem ali puščicami, zavrtite jih po 90° in odstranite nepotrebne strani. Na kartici uporabite Alt+levo/desno za premik. Ime izhodne datoteke lahko spremenite. Agent uporablja iste kartice; številke strani so od 1, zasuk pa 0–3 četrt obrata glede na izvirnik.'],
        ['Omejitve', 'Šifrirani PDF-ji niso podprti. Sestavljanje ustvari nov PDF in ne ohrani veljavnosti obstoječih digitalnih podpisov; orodje podpisov tudi ne preverja. Interaktivni obrazci, zaznamki in posebne funkcije niso zagotovljeni pri kopiranju strani. Velike datoteke potrebujejo dovolj pomnilnika.'],
        ['Odpravljanje težav', 'Če se PDF ne odpre, preverite, ali je veljaven in brez šifriranja. Neuspešen predogled sam po sebi ne pomeni uspešnega ali neuspešnega izvoza; po ustvarjanju preverite preneseni dokument. Počisti sprosti izbrane datoteke in pripravljene prenose. Datoteko shranite ali delite z ločenim dejanjem.']
    ]
};
