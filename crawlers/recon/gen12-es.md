# GEN 1.2 / AD 1.3 customs recon - ES (Spain, ENAIRE) - country-specific recon_es

Source: GitHub Actions run 29274747730 ("Crawler live test", job 86900957481), GEN 1.2 recon step (`gen12: ES`), 2026-07-13. This is the country-specific `recon_es` follow-up to the `## ES - Spain - FAILED (needs a country-specific recon)` entry in `gen12-batch1.md`: the new recon walks ENAIRE's static AIP index (`aip.enaire.es/AIP/contenido_AIP/...`) for GEN 1.2 / AD 1.3 instead of deriving a `/eAIP/` sibling path. Quotes are VERBATIM from the recon output (rows truncated at 400 chars, TXT lines at 300 chars by the recon itself). Conventions as in `gen12-batch1.md`: use this file to seed `src/lib/customs-overrides.ts`, but per project policy only after eyeballing the cited live page once.

## What the ENAIRE index recon found

Sections walked (verbatim `--- section` lines, with outcome):

- `https://aip.enaire.es/AIP/contenido_AIP/GEN/LE_GEN_1_2_en.html` - fetched, but **no table/TXT hits**: the served HTML is a shell page (title `ENAIRE AIP GEN 1.2`) whose content is script-assembled (`creaCambios.js`), so the recon's static parser extracted nothing. GEN 1.2 customs procedures text was therefore NOT captured this run.
- `https://aip.enaire.es/AIP/contenido_AIP/GEN/LE_GEN_1_2_en.pdf` - binary PDF, no hits (the recon parses HTML only).
- `https://aip.enaire.es/AIP/contenido_AIP/AD/LE_AD_1_3_en.html` - **SUCCESS**: 4 header tables extracted (74 + 120 + 203 + 4 rows) plus 428 TXT lines. Table 1 is the customs-relevant AD 1.3 index with an explicit `AIR BORDER` column.
- `https://aip.enaire.es/AIP/contenido_AIP/AD/LE_AD_1_3_en.pdf` - binary PDF, no hits.
- `https://aip.enaire.es/AIP/contenido_AIP/AD/LE_Amdt_A_2026_06_AD_1_3.zip` - binary ZIP, no hits (contains `LE_Amdt_A_2026_06_AD_1_3_AD_Restricted_en.csv` per the visible ZIP directory - a possible machine-readable source for a later run).
- `https://aip.enaire.es/AIP/contenido_AIP/AD/LE_Amdt_A_2026_06_AD_1_3_Metadata.txt` - fetched, no hits ("See corresponding metadata along with CSVs").

Per the batch-1 conventions: with GEN 1.2 not extractable, **AD 1.3 is the customs source** for ES. Spain's AD 1.3 is stronger than most: it has a dedicated `AIR BORDER` (Sí/Yes / No) column, which is exactly the border-crossing / customs-designation signal.

## Candidate ICAO -> designation pairs (from AD 1.3 table 1, `AIR BORDER` column)

`AIR BORDER = Sí/Yes` (45 rows) - designated air border crossing points (customs/immigration available; `(Pax)` in the INTL COMMUNITY column marks passenger-only community-traffic approval):

- LECO (A Coruña): air border yes, INTL community Sí/Yes (Pax), IFR-VFR
- LEAB (Albacete): air border yes, INTL community Sí/Yes (Pax), IFR-VFR
- LEAL (Alicante-Elche Miguel Hernández): air border yes, IFR-VFR
- LEAM (Almería): air border yes, IFR-VFR
- LEAS (Asturias): air border yes, IFR-VFR
- LEBZ (Badajoz/Talavera La Real): air border yes, IFR-VFR
- LEBL (Barcelona/Josep Tarradellas Barcelona-El Prat): air border yes, IFR only
- LEBB (Bilbao): air border yes, IFR-VFR
- LEBG (Burgos/Villafría): air border yes, INTL community Sí/Yes (Pax), IFR-VFR
- LECH (Castellón): air border yes, INTL community Sí/Yes (Pax), IFR-VFR
- LERL (Ciudad Real): air border yes, VFR only
- GCFV (Fuerteventura): air border yes, IFR-VFR
- LEGE (Girona): air border yes, IFR-VFR
- GCLP (Gran Canaria): air border yes, IFR-VFR
- LEGR (Granada/Federico García Lorca. Granada-Jaén): air border yes, IFR-VFR
- LEIB (Ibiza): air border yes, IFR-VFR
- LEJR (Jerez): air border yes, IFR-VFR
- GCLA (La Palma): air border yes, IFR-VFR
- GCRR (Lanzarote/César Manrique Lanzarote): air border yes, IFR-VFR
- LELN (León): air border yes, INTL community Sí/Yes (Pax), IFR-VFR
- LEDA (Lleida/Alguaire): air border yes, IFR-VFR
- LERJ (Logroño): air border yes, INTL community Sí/Yes (Pax), IFR-VFR
- LEMD (Madrid/Adolfo Suárez Madrid-Barajas): air border yes, IFR only
- LECU/LEVS (Madrid/Cuatro Vientos): air border yes, INTL community No, VFR only - border crossing without community-AD approval; verify on the live page before seeding
- LETO (Madrid/Torrejón): air border yes, INTL community No, IFR, military exclusive use - NOT a GA customs field
- LEMG (Málaga/Costa del Sol): air border yes, IFR-VFR
- LEMH (Menorca): air border yes, IFR-VFR
- LEMI (Murcia/Aeropuerto de la Región de Murcia): air border yes, IFR-VFR
- LELC (Murcia/San Javier): air border yes, IFR-VFR
- LEPA/LESJ (Palma de Mallorca): air border yes, IFR-VFR
- LEPP (Pamplona): air border yes, INTL community Sí/Yes (Pax), IFR-VFR
- LERS (Reus): air border yes, IFR-VFR
- LESA (Salamanca/Matacán): air border yes, IFR-VFR
- LESO (San Sebastián): air border yes, INTL community Sí/Yes (Pax), IFR-VFR
- LEXJ (Santander/Seve Ballesteros-Santander): air border yes, IFR-VFR
- LEST (Santiago/Rosalía de Castro): air border yes, IFR-VFR
- LEZL (Sevilla): air border yes, IFR-VFR
- GCXO (Tenerife Norte/Ciudad de La Laguna): air border yes, IFR-VFR
- GCTS (Tenerife Sur): air border yes, IFR-VFR
- LETL (Teruel): air border yes, VFR only, no scheduled passenger ops
- LEVC (Valencia): air border yes, IFR-VFR
- LEVD (Valladolid/Villanubla): air border yes, IFR-VFR
- LEVX (Vigo): air border yes, IFR-VFR
- LEVT (Vitoria): air border yes, IFR-VFR
- LEZG (Zaragoza): air border yes, IFR-VFR

`AIR BORDER = No` (24 rows) - NO border crossing / customs: LEAG (Algeciras), LESU (Andorra-La Seu d'Urgell), LERT (Cádiz/Rota, MIL), GECE (Ceuta), LEAO (Ciudad Real/Almagro, MIL), LEBA (Córdoba), GCHI (El Hierro), LEGA (Granada/Armilla, MIL), LEHC (Huesca/Pirineos), GCGM (La Gomera), LELO (Logroño/Agoncillo, MIL), LECV (Madrid/Colmenar Viejo, MIL), LEGT (Madrid/Getafe), LEPO (Mallorca/Pollensa, MIL), LESB (Mallorca/Son Bonet), GEHM (Melilla heliport, MIL), GEML (Melilla - INTL community Sí/Yes but air border No), LERI (Murcia/Alcantarilla, MIL), LELL (Sabadell), LETA (Circuit de Catalunya), LEEC (Sevilla/El Copero, MIL), LEMO (Sevilla/Morón, MIL), GCXM (Tenerife Norte/Los Rodeos, MIL), LEBT (Valencia/Bétera, MIL).

`INFO NO AVBL` (3 rows): GSAI (El Aaiún), LXGB (Gibraltar), GSVO (Villacisneros) - not usable as designations.

All other ES fields in the recon output (tables 2-4: 120-row aerodrome/heliport contact index, 203-row RESTRICTED AERODROMES INDEX, 4-row RESTRICTED HELIPORTS INDEX, plus the CASUAL HELIPORTS INDEX TXT lines) carry only owner/manager/contact data - no customs or air-border column; treat them as no-customs fields.

## Raw recon output (verbatim, complete ES section)

```
===== GEN 1.2 ES =====
   --- section [] https://aip.enaire.es/AIP/contenido_AIP/GEN/LE_GEN_1_2_en.html
   [debug] no hits; html head: <!DOCTYPE html><html lang="es"><head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>ENAIRE AIP GEN 1.2</title> <!-- ESTILOS --> <link href="https://aip.enaire.es/AIP/assets/css/styles_v2.css" rel="stylesheet" type="text/css"> <link rel="stylesheet" href="https://aip.enaire.es/AIP/assets/css/cambios.css"> <link rel="stylesheet" href="https://aip.enaire.es/AIP/assets_dev/css/cabecera.css"> <link rel="stylesheet" href="https://aip.enaire.es/AIP/assets_dev/css/soloInternos.css"> <!-- ESTILOS --> <!-- SCRIPTS --> <!-- SCRIPTS --> <!-- SCRIPTS --><script src='https://aip.enaire.es/AIP/assets/js/creaCambios.js'></script><!-- SCRIPTS --></head> 
   --- section [] https://aip.enaire.es/AIP/contenido_AIP/GEN/LE_GEN_1_2_en.pdf
   [debug] no hits; html head: %PDF-1.4 %���� 1 0 obj <</Creator (Mozilla/5.0 \(Windows NT 10.0; Win64; x64\) AppleWebKit/537.36 \(KHTML, like Gecko\) Chrome/114.0.0.0 Safari/537.36) /Producer (Skia/PDF m114) /CreationDate (D:20250808083514+00'00') /ModDate (D:20250808083514+00'00')>> endobj 3 0 obj <</ca 1 /BM /Normal>> endobj 5 0 obj <</ca 0 /BM /Normal>> endobj 8 0 obj <</Filter /FlateDecode /Length 50973>> stream x��۪e;�%��_���C� q;I=$T7��:�P�n����afS2�%��� ���:���5�����d��L_C���7G��O_�ϖ���{oo�޿��_���j��K�o1��5�������� o�=��b-����o����/o����_��/����'�[{z+564�o_�O��������� �{����VsA/��������ÿ��?�� �ӟ��~��/�-��_��zΤ�o�}mݕ@� o���cz������':��'�oo f<}MD�V���3���뗿�z����gs��n��J��r5���}u�K��s��_��>| ��
   --- section [] https://aip.enaire.es/AIP/contenido_AIP/AD/LE_AD_1_3_en.html
   hdr table 1 (74 rows): AERODROME/HELIPORT ICAO LOCATION INDICATOR (IATA CODE) | AIR BORDER | APPROVED TRAFFIC: INTL COMMUNITY AD | APPROVED TRAFFIC: IFR/VFR | APPROVED TRAFFIC: SCHEDULED = R NON SCHEDULED = NR GENERAL AVIATION = P | SECCIÓN AD
     AERODROME/HELIPORT ICAO LOCATION INDICATOR (IATA CODE) | AIR BORDER | APPROVED TRAFFIC: INTL COMMUNITY AD | APPROVED TRAFFIC: IFR/VFR | APPROVED TRAFFIC: SCHEDULED = R NON SCHEDULED = NR GENERAL AVIATION = P | SECCIÓN AD
     A CORUÑA - LECO (LCG) | Sí/Yes | Sí/Yes (Pax) | IFR-VFR | R-NR-P | AD 2-LECO
     ALBACETE - LEAB (ABC) | Sí/Yes | Sí/Yes (Pax) | IFR-VFR | R-NR-P | AD 2-LEAB
     ALGECIRAS - LEAG (AEI) | No | Sí/Yes (Pax) | VFR | R-NR-P | AD 3-LEAG
     ALICANTE/Alicante-Elche Miguel Hernández - LEAL (ALC) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEAL
     ALMERÍA - LEAM (LEI) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEAM
     ANDORRA-LA SEU D'URGELL - LESU (LEU) | No | No | IFR-VFR | R-NR-P | AD 2-LESU
     ASTURIAS - LEAS (OVD) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEAS
     BADAJOZ/Talavera La Real - LEBZ (BJZ) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEBZ
     BARCELONA/Josep Tarradellas Barcelona-El Prat - LEBL (BCN) | Sí/Yes | Sí/Yes | IFR | R-NR-P | AD 2-LEBL
     BILBAO - LEBB (BIO) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEBB
     BURGOS/Villafría - LEBG (RGS) | Sí/Yes | Sí/Yes (Pax) | IFR-VFR | R-NR-P | AD 2-LEBG
     CÁDIZ/Rota - LERT (ROZ) | No | No | IFR-VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 2-LERT
     CASTELLÓN - LECH (CDT) | Sí/Yes | Sí/Yes (Pax) | IFR-VFR | R-NR-P | AD 2-LECH
     CEUTA - GECE (JCU) | No | No | VFR | R-NR-P | AD 3-GECE
     CIUDAD REAL - LERL (CQM) | Sí/Yes | Sí/Yes | VFR | R-NR-P | AD 2-LERL
     CIUDAD REAL/Almagro - LEAO () | No | No | IFR-VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 3-LEAO
     CÓRDOBA - LEBA (ODB) | No | No | IFR-VFR | R-NR-P | AD 2-LEBA
     EL AAIÚN - GSAI (EUN) | INFO NO AVBL | INFO NO AVBL | INFO NO AVBL | INFO NO AVBL | AD 2-GSAI
     EL HIERRO - GCHI (VDE) | No | No | IFR-VFR | R-NR-P | AD 2-GCHI
     FUERTEVENTURA - GCFV (FUE) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-GCFV
     GIBRALTAR - LXGB (GIB) | INFO NO AVBL | INFO NO AVBL | INFO NO AVBL | INFO NO AVBL | AD 2-LXGB
     GIRONA - LEGE (GRO) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEGE
     GRAN CANARIA - GCLP (LPA) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-GCLP
     GRANADA/Armilla - LEGA () | No | No | VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 2-LEGA
     GRANADA/Federico García Lorca. Granada-Jaén - LEGR (GRX) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEGR
     HUESCA/Pirineos - LEHC (HSK) | No | No | IFR-VFR | NR-P | AD 2-LEHC
     IBIZA - LEIB (IBZ) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEIB
     JEREZ - LEJR (XRY) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEJR
     LA GOMERA - GCGM (GMZ) | No | No | VFR | R-NR-P | AD 2-GCGM
     LA PALMA - GCLA (SPC) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-GCLA
     LANZAROTE/César Manrique Lanzarote - GCRR (ACE) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-GCRR
     LEÓN - LELN (LEN) | Sí/Yes | Sí/Yes (Pax) | IFR-VFR | R-NR-P | AD 2-LELN
     LLEIDA/Alguaire - LEDA (ILD) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEDA
     LOGROÑO - LERJ (RJL) | Sí/Yes | Sí/Yes (Pax) | IFR-VFR | R-NR-P | AD 2-LERJ
     LOGROÑO/Agoncillo - LELO () | No | No | IFR-VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 3-LELO
     MADRID/Adolfo Suárez Madrid-Barajas - LEMD (MAD) | Sí/Yes | Sí/Yes | IFR | R-NR-P | AD 2-LEMD
     MADRID/Colmenar Viejo - LECV () | No | No | IFR-VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 3-LECV
     MADRID/Cuatro Vientos - LECU/LEVS (MCV) | Sí/Yes | No | VFR | NR-P | AD 2-LECU/LEVS
     MADRID/Getafe - LEGT () | No | No | IFR-VFR | Aeronaves que cumplan con los requisitos contenidos en la casilla 2, AD 2-LEGT 1, item 2 // Aircraft complying with the requirements contained in AD 2-LEGT 1, item 2 | AD 2-LEGT
     MADRID/Torrejón - LETO (TOJ) | Sí/Yes | No | IFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 2-LETO
     MÁLAGA/Costa del Sol - LEMG (AGP) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEMG
     MALLORCA/Pollensa - LEPO () | No | No | VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 2-LEPO
     MALLORCA/Son Bonet - LESB (SBO) | No | No | VFR | NR-P No se admiten operaciones de transporte comercial de pasajeros // Passenger commercial air transport operations are not accepted | AD 2-LESB
     MELILLA - GEHM () | No | No | VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 3-GEHM
     MELILLA - GEML (MLN) | No | Sí/Yes | IFR-VFR | R-NR-P | AD 2-GEML
     MENORCA - LEMH (MAH) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEMH
     MURCIA/Aeropuerto de la Región de Murcia - LEMI (RMU) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEMI
     MURCIA/Alcantarilla - LERI () | No | No | IFR-VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 2-LERI
     MURCIA/San Javier - LELC (MJV) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LELC
     PALMA DE MALLORCA - LEPA/LESJ (PMI) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEPA/LESJ
     PAMPLONA - LEPP (PNA) | Sí/Yes | Sí/Yes (Pax) | IFR-VFR | R-NR-P | AD 2-LEPP
     REUS - LERS (REU) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LERS
     SABADELL - LELL (QSA) | No | No | VFR | NR-P | AD 2-LELL
     SALAMANCA/Matacán - LESA (SLM) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LESA
     SAN SEBASTIÁN - LESO (EAS) | Sí/Yes | Sí/Yes (Pax) | IFR-VFR | R-NR-P | AD 2-LESO
     SANTANDER/Seve Ballesteros-Santander - LEXJ (SDR) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEXJ
     SANTIAGO/Rosalía de Castro - LEST (SCQ) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEST
     SERVEIS GENERALS DEL CIRCUIT DE CATALUNYA - LETA () | No | No | VFR | NR-P | AD 3-LETA
     SEVILLA - LEZL (SVQ) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEZL
     SEVILLA/El Copero - LEEC () | No | No | IFR-VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 3-LEEC
     SEVILLA/Morón - LEMO (OZP) | No | No | IFR-VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 2-LEMO
     TENERIFE NORTE/Ciudad de La Laguna - GCXO (TFN) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-GCXO
     TENERIFE NORTE/Los Rodeos - GCXM () | No | No | VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 3-GCXM
     TENERIFE SUR - GCTS (TFS) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-GCTS
     TERUEL - LETL (TEV) | Sí/Yes | Sí/Yes | VFR | NR-P No se admiten operaciones de transporte comercial de pasajeros // Passenger commercial air transport operations are not accepted | AD 2-LETL
     VALENCIA - LEVC (VLC) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEVC
     VALENCIA/Bétera - LEBT () | No | No | IFR-VFR | Aeronaves de uso exclusivo militar // Aircraft of military exclusive use | AD 3-LEBT
     VALLADOLID/Villanubla - LEVD (VLL) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEVD
     VIGO - LEVX (VGO) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEVX
     VILLACISNEROS - GSVO (VIL) | INFO NO AVBL | INFO NO AVBL | INFO NO AVBL | INFO NO AVBL | AD 2-GSVO
     VITORIA - LEVT (VIT) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEVT
     ZARAGOZA - LEZG (ZAZ) | Sí/Yes | Sí/Yes | IFR-VFR | R-NR-P | AD 2-LEZG
     INDEX TO AERODROMES AND HELIPORTS
   hdr table 2 (120 rows): INDICATOR | LOCATION | OWNER / MANAGER / CONTACT DETAILS/REMARKS
     INDICATOR | LOCATION | OWNER / MANAGER / CONTACT DETAILS/REMARKS
     (AD) ABLITAS - LETU | 420028N 0013722W | Ministerio de Defensa
     (AD) AERODEL - LEDE | 375006N 0045345W | Aeronáutica Delgado, S.L.
     (AD) AEROSIDONIA - LECX | 362626N 0055625W | Escuela de vuelo Servidelta S.L TEL: +34-606 977 164 TEL: +34-647 055 693 (Manuel Sevilla Muñoz) Email: clubdeportivoaerosidonia@gmail.com (Manuel Sevilla Muñoz) Email: msevillita@hotmail.com
     (AD) AINSA-COSCOJUELA DE SOBRARBE - LEOJ | 422053N 0001109E | Ayuntamiento de Ainsa-Sobrarbe TEL: +34-654 101 010 (Rafael García García) TEL: +34-974 500 002 (Ayuntamiento de Ainsa-Sobrarbe)
     (AD) AIR MARUGÁN - LEIR | 405438N 0042210W | José Antonio Garvía Benavente TEL: +34-626 401 169 TEL: +34-639 427 194 TEL: +34-652 497 670 TEL: +34-921 068 126 Email: info@airmarugan.com Web: http://www.airmarugan.com TEL: +34-626 401 169 TEL: +34-639 427 194 TEL: +34-652 497 670 TEL: +34-921 068 126 Email: info@airmarugan.com Web: www.airmarugan.com
     (AD) ALGODOR - LETG | 395354N 0035229W | Aero Toledo S.L. TEL: +34-639 164 930 TEL: +34-687 520 293 TEL: +34-925 230 179 Email: aacanopilot@gmail.com
     (AD) ALHAMA DE MURCIA - LELH | 374456N 0011804W | Aeroalhama S.L. TEL: +34-629 690 911 (Persona de contacto // Contact person: Ignacio Gracia Monforte) TEL: +34-680 970 335 (AEROALHAMA S.L.) Email: aeroalhama@gmail.com (AEROALHAMA S.L.) Email: nacho@rotorsun.com (Persona de contacto // Contact person: Ignacio Gracia Monforte)
     (AD) ALIAGUILLA - LEAK | 394531N 0012010W | Delfín García Hernández TEL: +34-609 070 430 (Delfín García Hernández) Email: delfingarciahernandez@gmail.com (Delfín García Hernández)
     (AD) ALMOROX - LAS TABLAS DEL ALBERCHE - LETH | 401242N 0042311W | Silvia Silván Escudero TEL: +34-629 872 565 TEL: +34-653 599 335 Email: silviasilvan@hotmail.com (Silvia Silván Escudero)
     (AD) ALTAREJOS-GUADALCANAL - LEGC | 381018N 0054423W | Jose Carlos March TEL: +34-924 890 215
     (AD) AMPURIABRAVA - LEAP | 421536N 0030635E | Fórmula propiedades SLU TEL: +34-972 450 111 Email: info@skydiveempuriabrava.com
     (AD) AMR-UTRERA - LEUT | 370909N 0054758W | Operaciones MRA (Gestor: Miguel Angel Martinez Bonilla) TEL: +34-660 731 687 TEL: +34-955 868 003 Email: operaciones@martinezridao.com
     (AD) ANTIGUA - FUERTEVENTURA - GCAT | 282328N 0135859W | D. Aridane Urquía Gutiérrez TEL: +34-655 778 511 Email: aerodromoeljarde@hotmail.com
     (AD) ASTORGA - LEAT | 423015N 0060137W | Club deportivo de Astorga TEL: +34-629 014 308 TEL: +34-629 035 000 TEL: +34-679 154 384
     (AD) BEARIZ (OURENSE) - LEBI | 422727N 0082017W | Dirección General de Defensa del Monte. Xunta de Galicia TEL: +34-881 996 391 (Titular: Dirección Xeral de Defensa do Monte - Xunta de Galicia) Email: defensadomonte.mediorural@xunta.gal
     (AD) BEAS DE SEGURA - LEBE | 381616N 0025656W | Ayuntamiento de Beas de Segura. Gestor: Iniciativas Aeroportuarias, S.L TEL: +34-646 954 299 TEL: +34-646 954 303 TEL: +34-953 184 352 Email: aerodromodebeasdesegura@gmail.com (Gestor // Manager: Iniciativas Aeroportuarias, S.L.) Web: https://www.aerodromodebeasdesegura.com TEL: +34-646 954 299 TEL: +34-646 954 303 TEL: +34-953 184 352 Email: aerodro
     (AD) BENABARRE - LENA | 420122N 0002856E | AYUNTAMIENTO DE BENABARRE TEL: +34-629 045 427 TEL: +34-647 625 884 TEL: +34-974 543 000 Email: jmlega@hotmail.com Email: more.just@gmail.com Email: oriol.valle@gmail.com TEL: +34-629 045 427 TEL: +34-647 625 884 TEL: +34-974 543 000 Email: jmlega@hotmail.com Email: oriol.valle@gmail.com
     (AD) BINÉFAR - LEBF | 415115N 0001517E | Aeroclub de Binéfar TEL: +34-608 199 030 TEL: +34-630 970 565 TEL: +34-660 599 586 Email: operaciones@aeroclubbinefar.es
     (AD) BINISSALEM - LEIS | 394056N 0025252E | Patín de Cola Aviación, S.L. TEL: +34-619 720 206 (Pablo Ruiz Escobar) TEL: +34-649 679 498 (Gabriel Gomila Frau) Email: informacion@aviacionenlasaulas.es
     (AD) CALAF-SALLAVINERA - LECF | 414441N 0013328E | Subados SL Email: aerodromcalaf@gmail.com
     (AD) CALDAS DE REIS - LEDD | 423441N 0084150W | Aeródromo de Caldas, S.L.
     (AD) CALZADA DE VALDUNCIEL - LEUN | 410430N 0054341W | Jorge Rugero Gomar TEL: +34-606 355 113 (Jorge Rugero Gomar) Email: jorgerugero@gmail.com (Jorge Rugero Gomar)
     (AD) CAMARENILLA - LERN | 400125N 0040410W | Miguel Cuchet Serrano TEL: +34-670 921 481 (Miguel Cuchet Serrano) Email: miguel@volarenavioneta.es
     (AD/HLP) CAMPILLOS-PARAVIENTOS - LEDP | 395629N 0013210W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (AD) CARCELÉN - LEER | 390759N 0011531W | Consejería De Desarrollo Sostenible De La Junta De Comunidades De Castilla-La Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (AD) CASARRUBIOS - LEMT | 401405N 0040135W | Aerohobby Aviación Deportiva, S.L. TEL: +34-606 921 284 TEL: +34-918 145 109 Email: aerodromo@casarrubios.net Email: oficina@casarrubios.net (Oficina aeródromo)
     (AD) CASAS DE LOS PINOS - LEPI | 391757N 0022242W | Aviomancha, S.A. TEL: +34-685 532 465
     (AD) CASIMIRO PATIÑO - LEPN | 384221N 0070002W | Club de Vuelo Ciudad de Badajoz TEL: +34-670 607 501 (Fernando Sousa Civantos) TEL: +34-924 277 760 (Fernando Sousa Civantos) Email: f.sousa@badacolor.com (Fernando Sousa Civantos)
     (AD) CASTELLÓN - LECN | 400001N 0000136E | AYUNTAMIENTO DE CASTELLÓN TEL: +34-964 282 314 TEL: +34-964 283 521 Email: info@aeroclubcastellon.com Web: https://aeroclubcastellon.com/
     (AD) CERRO LINDO - LEGP | 393538N 0061222W | Cundegan S.L.
     (AD) CHOZAS DE ABAJO - LEZS | 422947N 0054058W | Aeroservicios León S.L. TEL: +34-672 408 213 Email: clubacrobatico@gmail.com
     (AD) CILLAMAYOR - LEUC | 425105N 0041651W | Club de Vuelo Cillamayor TEL: +34-610 243 795 Email: info@piscinasraos.com
     (AD) CORTIJO PUERTO - LEIJ | 385617N 0061559W | Florencio José Crispín Ledo
     (AD) EL CARRASCAL - LEVB | 414929N 0045335W | Agro Aro, S.A TEL: +34-983 302 682 TEL: +34-983 721 539
     (AD) EL CASTAÑO - LECT | 390050N 0042316W | Agropecuaria El Castaño SLU TEL: +34-926 769 026 Email: aiplect@agropec.es
     (AD) EL MANANTÍO - LEEM | 384640N 0065928W | Manantío 2018, S.L. TEL: +34-699 272 269 Email: aeroclubelmanantio@gmail.com Web: https://www.elmanantio.es TEL: +34-699 272 269 Email: aeroclubelmanantio@gmail.com Web: www.elmanantio.es
     (AD) EL MEMBRILLAR - LEML | 392332N 0044414W | Agropecuaria el Membrillar S.A. TEL: +34-639 672 893 (Victor Laso López / Manuel Carrasco López) TEL: +34-915 624 524 (Victor Laso López / Manuel Carrasco López) Email: aeródromo.membrillar@grupo-if.com (Victor Laso López / Manuel Carrasco López)
     (AD) EL MOLINILLO - LELI | 384424N 0062332W | Aeroclub ALA VI TEL: +34-636 454 300 Email: info@aeroclubalavi.es Web: https://aeroclubalavi.es TEL: +34-636 454 300 Email: info@aeroclubalavi.es Web: www.aeroclubalavi.es
     (AD) EL MORAL - LEOA | 382910N 0061549W | Instituto Aeronáutico S.L. TEL: +34-605 265 130 Email: info@institutoaeronautico.es
     (AD) EL SALOBRAL - LEDL | 403617N 0044730W | Recreativos Fortuna S.L. TEL: +34-629 857 428 (Persona de contacto: Francisco Garcinuño Calle) TEL: +34-675 056 713 (Gestor: Eduardo Rubio Moral) Email: formacion@aerotraining.es (Gestor: Eduardo Rubio Moral) Email: gallardo7@gmail.com (Persona de contacto: Francisco Garcinuño Calle)
     (AD) EL TIÉTAR - LETI | 401451N 0044723W | Blue Sky Aviation S.L. TEL: +34-609 055 560 (Gonzalo Mujica Menéndez) Email: gonmuji5@gmail.com (Gonzalo Mujica Menéndez)
     (AD) FUENTE OBEJUNA - LEFU | 381654N 0052400W | ELA Aviación SL TEL: +34-957 585 175 (Persona de contacto / Contact person: José Antonio Fernández Blázquez) Email: admin@elaaviacion.com Email: ela-jose@elaaviacion.com Email: ela-laura@elaaviacion.com
     (AD) FUENTEMILANOS - LEFM | 405319N 0041415W | TEL: +34-669 286 554 TEL: +34-689 760 969 Email: fuentemilanos@fuentemilanos.com
     (AD) GARCÍA - LEAI | 410650N 0004242E | Abdón Pena Valles TEL: +34-639 161 755 Email: apenavalles@gmail.com
     (AD) GUADALUPE - LEGU | 392044N 0051152W | José Plaza Fernández TEL: +34-610 231 107 TEL: +34-620 573 745 Email: plaza@plattea.com
     (AD) HERRERA DE PISUERGA - LERP | 423537N 0041718W | Asociación de Deportes Aéreos y Ultraligeros Herrerense TEL: +34-615 418 294 TEL: +34-649 428 626
     (AD) HIDROPUERTO LUIS MINGORANCE - LEGG | 384645N 0061505W | Aeroclub Sierra de Alange TEL: +34-659 661 630 (Luis Teodoro Lechón Fragoso) Email: luislechon@telefonica.net (Luis Teodoro Lechón Fragoso)
     (AD) HIENDELAENCINA-LAS MINAS - LEEN | 410620N 0025921W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (AD) HOTEL HACIENDA ORÁN - LEOH | 371150N 0055250W | Hacienda Orán S.A.
     (AD) IGUALADA-ÓDENA - LEIG | 413503N 0013910E | Consorci de Gestió Aeródrom Igualada-Ódena (CAIO) TEL: +34-620 911 096 Email: info@caio.aero
     (AD) JUAN ESPADAFOR - LEJE | 370522N 0034718W | Air Alborán S.L. TEL: +34-681 645 163 Email: info@aerodromojuanespadafor.com
     (AD) LA AXARQUÍA - LEAX | 364805N 0040809W | Aeroclub de Málaga TEL: +34-695 169 497 TEL: +34-952 507 377 Email: admon@aeroclubmalaga.com
     (AD) LA CALDERERA - LELA | 384451N 0033059W | Cacerías Azor, S.A. TEL: +34-607 507 499 TEL: +34-670 738 938 TEL: +34-926 360 258 TEL: +34-926 360 649
     (AD) LA CAMINERA - LENE | 384011N 0031812W | SAGEMAR HOTELS, S.A. TEL: +34-926 344 733 (Carlos Camacho) Email: carlos.camacho@salleshotels.com (Carlos Camacho) Email: opsmanager@fincalacaminera.com
     (AD) LA CENTENERA - LENN | 380654N 0040654W | Adrián Merchán Romero TEL: +34-953 24 10 00 Email: amerchan@oapn.es
     (AD/HLP) LA CERDANYA - LECD | 422311N 0015147E | Consell Comarcal de la Cerdanya TEL: +34-677 298 861 Email: operacions@lecd.cat
     (AD) LA CUESTA - LEDC | 383151N 0024957W | Agroperdiz, S.L. TEL: +34-646 76 80 75 Email: runway@fincalacuesta.com (Antonio Escudero)
     (AD) LA GINETA - LEGI | 390621N 0020058W | José Manuel Barajas Martínez Email: jmbarajasm@gmail.com (José Manuel Barajas)
     (AD) LA JULIANA - LEJU | 371743N 0060948W | Luis Iglesias Moñino TEL: +34-607 500 442 TEL: +34-954 184 925 TEL: +34-955 990 447 Email: elyte@aerodromolajuliana.es
     (AD) LA MANCHA - LEMX | 393344N 0031459W | Tomás Fuertes Velero TEL: +34-609 128 537
     (AD) LA MORGAL - LEMR | 432550N 0054959W | Principado de Asturias Lugar La Morgal, s/n, 33690 Llanera, Asturias TEL: +34-985 771 080 Email: idlamorgal@asturias.org REMARKS: Centro Regional de Deportes y Recreación La Morgal (Llanera)
     (AD) LA NAVA-CORRAL DE AYLLÓN - LECA | 412439N 0032654W | ASOCIACIÓN DE VUELO A VELA 1000 KM TEL: +34-640 940 851 Email: info@aerodromodelanava.com
     (AD) LA PERDIZ-TORRE DE JUAN ABAD - LEIZ | 383047N 0032152W | Navalumbria, S.A. TEL: +34-915 645 730 Email: gwenola@lanava.com Web: http://lanava.com/lanava_lapista.html
     (AD) LA RESINERA - LENS | 365551N 0035008W | Dirección General de Política Forestal y Biodiversidad. Consejería de Sostenibilidad, Medio Ambiente y Economía Azul de la Junta de Andalucía. TEL: +34-955 003 737 (Juan Sánchez Ruiz (Director del Centro Operativo Regional)) TEL: +34-958 897 867 (Juan Sánchez Ruiz (Director del Centro Operativo Regional)) Email: juan.sanchez.ruiz@juntadeandalucia.es (Ju
     (AD) LA VID DE BUREBA - LEDB | 423757N 0031843W | Juan Jorge Noriega Gómez
     (AD) LILLO - LELT | 394301N 0031914W | Ayuntamiento de Lillo TEL: +34-925 17 05 33 Email: info@aeroclubdetoledo.com Web: https://www.aeroclubdetoledo.com TEL: +34-925 17 05 33 Email: info@aeroclubdetoledo.com Web: www.aeroclubdetoledo.com
     (AD) LORCA, AGUSTÍN NAVARRO - LEOL | 375538N 0014634W | Pedro Agustín Navarro Oliver TEL: +34-649 400 399 Email: pilotonavarro@hotmail.com
     (AD) LOS ALCORES - LEAH | 371946N 0054325W | Aeródromo Los Alcores, S.L. TEL: +34-652 525 755 (José Luis Rubio Morillas) Email: aerodromolosalcores@gmail.com (José Luis Rubio Morillas)
     (AD) LOS GARRANCHOS - SAN JAVIER - LELG | 375049N 0005246W | Aeroclub Mar Menor TEL: +34-609 610 741 TEL: +34-644 357 766 Email: info@ammflyschool.com
     (AD) LOS MARTINEZ DEL PUERTO - LEMP | 375006N 0010551W | Aeroclub Cierva Codorníu de Murcia TEL: +34-634 011 027 (Miguel Moreno Lozano) Email: ciervacodorniu@gmail.com (Miguel Moreno Lozano)
     (AD) LOS OTEROS - LEOS | 421959N 0052657W | Aeronáutica Deportiva del Noroeste S.L. TEL: +34-662 432 968 Email: aerodromolosoteros@gmail.com
     (AD) LUMBIER - LEUM | 423957N 0011812W | Serflight Servicios S.L. TEL: +34-649 004 069 Email: psanturde@pyrineum.com (Pedro Luis Santurde Lopez) REMARKS:
     (AD) MAFÉ-GIBRALEÓN - LEMF | 372144N 0065519W | Agrícola del Pintado, S.A. TEL: +34-607 322 259 TEL: +34-668 829 501 TEL: +34-672 714 276 (Amelia Mafé) TEL: +34-681 668 584 Email: aeromafe@yahoo.es
     (AD) MANRESA - LEMS | 414552N 0015144E | Airpirineus, SL TEL: +34-930 130 285 Email: contacto@aerodrom-barcelona-bages.com Email: solicitudes@aerodrom-barcelona-bages.com Web: https://aerodrom-barcelona-bages.com TEL: +34-930 130 285 Email: contacto@aerodrom-barcelona-bages.com Email: solicitudes@aerodrom-barcelona-bages.com Web: www.aerodrom-barcelona-bages.com
     (AD) MANUEL SÁNCHEZ DE VALDEPEÑAS - LEVP | 384732N 0032219W | Skydweller S. L TEL: +34-645 267 404 (Javier Martín-Palomino González) Email: javier.martinpalomino@skydweller.aero (Javier Martín-Palomino González)
     (AD) MARTINAMATOS - LEMK | 400558N 0041740W | Antonio Beneytez Martín TEL: +34-687 714 564
     (AD) MASPALOMAS - EL BERRIEL - GCLB | 274657N 0153027W | Canavia Líneas Aéreas SLU TEL: +34-828 903 845 Email: GCLB.maspalomas@gmail.com Web: https://www.gclb.info TEL: +34-828 903 845 Email: GCLB.maspalomas@gmail.com Web: www.gclb.info
     (AD) MATILLA DE LOS CAÑOS - LETC | 413150N 0045530W | ANSARES CASTELLANA TEL: +34-649 914 400 (Pascual Cantos Moreno) TEL: +34-983 090 207 Email: matillagestion@gmail.com Web: https://aerodromobeatrizcantosmatilla.es/ TEL: +34-649 914 400 (Pascual Cantos Moreno) TEL: +34-983 090 207 Email: matillagestion@gmail.com Web: www.aerodromobeatrizcantosmatilla.es
     (AD) MAZARICOS - LEMZ | 425858N 0090019W | Aero Servicios T&J, S.L. TEL: +34-610 550 524 (Oficina) TEL: +34-676 727 261 (Jefe de Operaciones) Email: juan.blanco@naturmaz.com
     (AD) MÉRIDA - ROYANEJOS - LEMY | 385848N 0062043W | Aeroclub de Mérida TEL: +34-625 552 055 TEL: +34-659 611 630 Email: luislechon@telefonica.net
     (AD) MONFORTE DE LEMOS - LENF | 423250N 0073105W | CLUB AEROLEMOS TEL: +34-609 536 646 (José Antonio Guitián Martínez) TEL: +34-666 812 109 Email: aerolemos@gmail.com Email: jaguitian27400@gmail.com (José Antonio Guitián Martínez)
     (AD) MORANTE - LETE | 390213N 0064126W | José Moreno García TEL: +34-924 455 476
     (AD) MUCHAMIEL - LEMU | 382624N 0002826W | AERÓDROMO MUTXAMEL, S.L. TEL: +34-638 555 393 TEL: +34-965 921 979 TEL: +34-965 950 882 TEL: +34-965 956 984 Email: info@aerodromodemutxamel.es Web: https://www.aerodromodemutxamel.es TEL: +34-638 555 393 TEL: +34-965 921 979 TEL: +34-965 950 882 TEL: +34-965 956 984 Email: info@aerodromodemutxamel.es Web: www.aerodromodemutxamel.es
     (AD) MUNICIPAL DE POZO CAÑADA - LEPZ | 384752N 0014539W 384752N 0014538W | Aeroclub San Juan TEL: +34-608 078 220 (Gregorio Núñez Tendero) Email: cdaeroclubsanjuan@gmail.com (Aeroclub San Juan) Email: gregorio@ingetel21.es (Gregorio Núñez Tendero) Web: https://aeroclubsanjuan.weebly.com/aerodromo.html TEL: +34-608 078 220 (Gregorio Núñez Tendero) Email: cdaeroclubsanjuan@gmail.com (Aeroclub San Ju
     (AD) OCAÑA - LEOC | 395615N 0033012W | 425 Rapag infraestructura aérea Ocaña S.L. TEL: +34-696 223 896 (Laura Alarcón Escolano) TEL: +34-925 158 540 (Laura Alarcón Escolano) Email: info-leoc@rapag.es (Laura Alarcón Escolano)
     (AD) ONTUR - LEOT | 383701N 0013130W | Ayuntamiento de Ontur TEL: +34-616 211 818 Web: https://aerodromodeontur.weebly.com/
     (AD) ORGAZ - LEGZ | 394136N 0035605W | D. Antonio Arroyo García-Aranda TEL: +34-629 378 419 (D. Antonio Arroyo García-Aranda) Email: confeccionesarroyo@confeccionesarroyo.com (D. Antonio Arroyo García-Aranda)
     (AD) PETRA - PEP MERCADER - LEPT | 393436N 0030728E | Josep Sansó Roig TEL: +34-601 860 771 (Maria Sansó Femenias) Email: campdevolescruce@yahoo.com
     (AD) POZORRUBIO DE SANTIAGO - LEPC | 394940N 0025710W | JOSÉ LUIS SERRANO ZAMORA TEL: +34-646 177 889 (José Luis Serrano Zamora) TEL: +34-916 291 472 Email: serranozamora@hotmail.com (José Luis Serrano Zamora)
     (AD) QUINTO DE DON PEDRO - LEQP | 391745N 0034957W | Consejería De Desarrollo Sostenible De La Junta De Comunidades De Castilla-La Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (AD) REQUENA - LERE | 392829N 0010204W | MERCANTIL CENTRO DE VUELOS LA FUNDIACION S.L. TEL: +34-607 665 945 Email: admon@aerodromo-requena.com
     (AD) ROBLEDILLO DE MOHERNANDO - LERM | 405155N 0031452W | Aeroclub de Guadalajara TEL: +34-614 128 544 Email: aeroclubguadalajara@hotmail.com Web: https://www.aeroclubdeguadalajara.es TEL: +34-614 128 544 Email: aeroclubguadalajara@hotmail.com Web: www.aeroclubdeguadalajara.es
     (AD) ROSINOS DE LA REQUEJADA - LESI | 420618N 0063143W | Consejería de Fomento y Medio Ambiente de la Junta de Castilla y León
     (AD) ROZAS - LERO | 430657N 0072749W | Real Aeroclub de Lugo. TEL: +34-601 922 019 TEL: +34-982 310 114 (Fran Abelleira) Email: administracion@aerolugo.es
     (AD) SAN ENRIQUE - LESE | 384351N 0041847W | Gubel, SL TEL: +34-914 317 550 (Francisco Javier Guerra García) Email: jguerra@gubel.es (Francisco Javier Guerra García)
     (AD) SAN LUIS - LESL | 395144N 0041507E | Gestionado por Aeroclub de Menorca TEL: +34-971 157 138 TEL: +34-971 361 672 Email: info@aeroclubmenorca.com Web: https://www.aeroclubmenorca.com TEL: +34-971 157 138 TEL: +34-971 361 672 Email: info@aeroclubmenorca.com Web: www.aeroclubmenorca.com
     (AD) SAN TORCUATO - LESN | 422828N 0025221W | AERORIOJA S.L TEL: +34-607 279 680 (Andres Tonelli) Email: andres@aerorioja.com (Andres Tonelli) Web: https://www.aerorioja.com TEL: +34-607 279 680 (Andres Tonelli) Email: andres@aerorioja.com (Andres Tonelli) Web: www.aerorioja.com
     (AD) SANTA CILIA LOS PIRINEOS - LECI | 423411N 0004340W | DIRECION GENERAL DE TURISMO DE LA DIPUTACION DE ARAGON TEL: +34-639 052 376 TEL: +34-974 377 610 Email: info@fly-pyr.es Web: https://www.fly-pyr.es TEL: +34-639 052 376 TEL: +34-974 377 610 Email: info@fly-pyr.es Web: www.fly-pyr.es
     (AD) SANTO TOMÉ DEL PUERTO - LETP | 411215N 0033541W | SENASA/Miguel Becerril Pérez TEL: +34-609 06 48 59 Email: loretovsm@gmail.com
     (AD) SEBASTIÁN ALMAGRO - LEPR | 374301N 0051245W | Sebastián Almagro Castellanos TEL: +34-957 710 460 ((Contactar con OPS)) Email: operaciones@pegasusaviacion.com
     (AD) SIGÜENZA - LESZ | 410241N 0023741W | Aeroclub Seguntino S.L. TEL: +34-607 279 680 TEL: +34-949 393 299 Email: andres@aerorioja.com
     (AD) SON ALBERTÍ - LEJF | 392402N 0025138E | D. Juan Francisco Socias Escudero TEL: +34-607 702 445 (D. Juan Francisco Socias Escudero) Email: bird1958@gmail.com
     (AD) SORIA-GARRAY - LEGY | 414917N 0022836W | Usado for Sale S.L. TEL: +34-616 289 061 (Daniel Vega Pámpano) TEL: +34-633 155 090 (Angel Portilla Acevedo) TEL: +34-662 420 263 (Jose luis olias Arce)
     (AD) SOTOS - LESS | 401215N 0020838W | Aerohobby Cuenca S.L. TEL: +34-662 041 357 (Antonio Jiménez) Email: cuencair@gmail.com Email: hobbycuenca@hotmail.com
     (AD) TARAGUDO - LETD | 404915N 0030535W | Mydair S.L.U. TEL: +34-649 030 863 (Benito Baldominos Baldominos) Email: benitobaldominos@mydair.com
     (AD) TINAJEROS - LETY | 390559N 0014325W | Aeroclub de Albacete C.D.B. TEL: +34-627 445 922 (José Miguel Royo García (Instructor)) TEL: +34-630 925 742 (Francisco Vidal Monteagudo (Presidente Aeroclub)) TEL: +34-666 163 200 (Francisco Vidal Monteagudo (Presidente Aeroclub)) Email: presidente@aeroclubdealbacete.com (Francisco Vidal Monteagudo (Presidente Aeroclub)) Web: https://www.aeroclubdealbace
     (AD) TOMÁS FERNÁNDEZ ESPADA - LETF | 365219N 0053855W | THOMAS HUSTER Y ASOCIADOS. S.L. Crta. de los Higuerones s/n. 11650 Villamartín‎. Cádiz. TEL: +34-617 560 351 Email: thuster@antiguaestacion.com
     (AD) TOROZOS - LETZ | 414702N 0045154W | Salvador Martín de la Concha TEL: +34-983 560 230
     (AD) TOTANA - LETX | 374512N 0012651W | Isidro Benítez Gásquez TEL: +34-636 994 647 (Isidro Benítez Gásquez) TEL: +34-637 332 244 TEL: +34-968 425 422 Email: isidro@aerototana.org (Isidro Benítez Gásquez) Web: https://aerototana.org TEL: +34-636 994 647 (Isidro Benítez Gásquez) TEL: +34-637 332 244 TEL: +34-968 425 422 Email: isidro@aerototana.org (Isidro Benítez Gásquez) Web: www.aerototana.org
     (AD) TREBUJENA - LETJ | 365131N 0060826W | Flight Training Europe, S.L. (FTEJerez) TEL: +34-672 628 986 TEL: +34-956 317 811 Email: atc.trebujena@ftejerez.com
     (AD) VICENTE HUERTA - LEVY | 395718N 0003723W | Titan Firefighting Company S.L. TEL: +34-646 493 128 (Carlos José Gómez Domínguez) TEL: +34-962 654 100 (Carlos José Gómez Domínguez) Email: operaciones@titanfirefighting.com (Carlos José Gómez Domínguez)
     (AD) VILLACASTÍN - LEEV | 404704N 0042746W | Gestor // Manager: Asociación Apoyo Aeronáutica y Aviación Histórica A3H. TEL: +34-606 980 544 (Carlos Bravo Domínguez) TEL: +34-628 228 458 (Carlos Bravo Domínguez) Email: asociaciona3h@gmail.com (Carlos Bravo Domínguez)
     (AD) VILLAFRAMIL - LEVF | 433309N 0070516W | CLUB AEREO DE RIBADEO Email: info@clubaereoribadeo.com Web: http://www.clubaereoribadeo.com Email: info@clubaereoribadeo.com Web: www.clubaereoribadeo.com
     (AD) VILLAFRANCA DE CÓRDOBA - LEVJ | 375612N 0043158W | TEL: +34-658 968 685 (Antonio López Gutiérrez (Gestor)) TEL: +34-744 785 846 (Daniel López Márquez (Coordinador y Gestión aérea aeródromo)) Email: vuelovillafranca@gmail.com
     (AD) VILLAMARCO - LEVL | 422713N 0051712W | Ultraligeros León, S.L. TEL: +34-639 448 889 (Carlos Martínez) Email: info@ulmvillamarco.com (Carlos Martínez) Web: https://www.ulmvillamarco.com TEL: +34-639 448 889 (Carlos Martínez) Email: info@ulmvillamarco.com (Carlos Martínez) Web: www.ulmvillamarco.com
     (AD) VILLANUEVA DE GÁLLEGO - LEWG | 414716N 0005105W | Club de vuelo ULM Villanueva de Gállego TEL: +34-660 208 933 Email: clubulmvillanueva@gmail.com
     (AD) VILLOLDO - LEAV | 421556N 0043850W | Jesus De Las heras Alonso TEL: +34-608 686 045 (Jesús de las Heras Alonso) Email: campovilloldoulm@gmail.com Email: herasalonso@gmail.com (Jesús de las Heras Alonso)
     (AD) VIRGEN DE LA ESTRELLA - LEVE | 382514N 0062125W | Francisco Alejandro Zapata Gordillo TEL: +34-610 460 594 Email: alejandrozago@hotmail.com
     RESTRICTED AERODROMES INDEX
   hdr table 3 (203 rows): INDICATOR | LOCATION | OWNER / MANAGER / CONTACT DETAILS / REMARKS
     INDICATOR | LOCATION | OWNER / MANAGER / CONTACT DETAILS / REMARKS
     (HLP) A MERCA (OURENSE) - LEMQ | 421557N 0075642W | Dirección General de Defensa del Monte. Xunta de Galicia TEL: +34-881 996 391 Email: defensadomonte.mediorural@xunta.gal
     (HLP) ADEJE - GCAD | 280727N 0164434W | HELIDREAM CANARIAS S.L.
     (HLP) AIRBUS HELICOPTERS ESPAÑA - LEBP | 385634N 0015239W | Airbus Helicopters España, S.A. TEL: +34-629 872 468 (Francisco Javier Beltrán del Corral) Email: javier.beltran@airbus.com
     (HLP) ALCAZARÉN - LEAZ | 412218N 0044155W | CASTAIR, S.L.
     (HLP) ALCORISA FORESTAL - LEAF | 405353N 0002347W | Dirección General de Gestión Forestal del Departamento de Medio Ambiente y Turismo del Gobierno de Aragón. Dirección General de Gestión Forestal TEL: +34-976 714 810 Email: gestionforestal@aragon.es
     (HLP) ALHAMA DE ALMERÍA - LELM | 365735N 0023224W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es.
     (HLP) ARTENARA - GCAR | 280121N 0153921W | Titular // Owner: Consejería de Medio Ambiente, Energía, Clima y Conocimiento del Cabildo de Gran Canaria. Gestor // Manager: Airtech Levante S.L. Consejería de Medio Ambiente, Energía, Clima y Conocimiento del Cabildo de Gran Canaria TEL: +34-657 555 205 (Miriam López Gómez) TEL: +34-686 662 269 (María Matilla Cuétara) Email: miriam@urjato.com Email: mma
     (HLP) AUTORIDAD PORTUARIA DE BARCELONA - LEPB | 412151N 0021059E | SkytourBCN
     (HLP) AVINCIS - LEHE | 390416N 0015004W | AVINCIS Email: occ@avincis.com
     (HLP) BAILO FORESTAL - LEBM | 423054N 0004903W | Dirección General de Gestión Forestal del Departamento de Medio Ambiente y Turismo del Gobierno de Aragón. Dirección General de Gestión Forestal TEL: +34-976 714 810 Email: gestionforestal@aragon.es
     (HLP) BASE BRICA DE LOS MORALILLOS (GRANADA) - LEMJ | 371101N 0031024W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) BASE C.I. DE LAS ROZAS - LELR | 403113N 0035258W | Titular // Owner: Dirección General de Emergencias. Gestor // Manager: Airtech Levante S.L. TEL: +34-657 555 205 TEL: +34-961 255 020 Email: juliavidagan@urjato.com (Júlia Vidagañ) Email: miriam@urjato.com (Miriam López) Email: rosacamps@urjato.com (Rosa Camps ) REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) BASE C.I. DE LOZOYUELA - LEZO | 405610N 0033730W | Titular // Owner: Dirección General de Emergencias. Gestor // Manager: Airtech Levante S.L. TEL: +34-657 555 205 TEL: +34-961 255 020 Email: juliavidagan@urjato.com (Júlia Vidagañ) Email: miriam@urjato.com (Miriam López) Email: rosacamps@urjato.com (Rosa Camps) REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) BASE C.I. DE MORATA DE TAJUÑA - LEAJ | 401452N 0032850W | Titular // Owner: Dirección General de Emergencias. Gestor // Manager: Airtech Levante S.L. TEL: +34-657 555 205 TEL: +34-961 255 020 Email: juliavidagan@urjato.com (Júlia Vidagañ) Email: miriam@urjato.com (Miriam López) Email: rosacamps@urjato.com (Rosa Camps) REMARKS: Exclusivamente para emergencias. // Only available for emergencie
     (HLP) BASE C.I. DE NAVAS DEL REY - LEEY | 402314N 0041431W | Titular // Owner: Dirección General de Emergencias. Gestor // Manager: Airtech Levante S.L. TEL: +34-657 555 205 TEL: +34-961 255 020 Email: juliavidagan@urjato.com (Júlia Vidagañ) Email: miriam@urjato.com (Miriam López) Email: rosacamps@urjato.com (Rosa Camps) REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) BASE C.I. DE PRADO DE LOS ESQUILADORES - LEES | 400938N 0015438W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Manchaha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es (Juan José Fernández Ortiz)
     (HLP) BASE C.I. DE PUERTO EL PICO - LEPU | 402026N 0050048W | Dirección General del Medio Natural Consejería de Medio Ambiente. Junta de Castilla León
     (HLP) BASE C.I. DE RABANAL DEL CAMINO - LERB | 422851N 0061619W | Dirección General del Medio Natural de la Consejería de Fomento y Medio Ambiente. Junta de Castilla y León
     (HLP) BASE C.I. DE TABUYO DEL MONTE - LETB | 421745N 0061253W | Dirección General del Medio Natural. Consejería de Fomento y Medio Ambiente. Junta de Castilla y León
     (HLP) BASE C.I. DE VALDEMORILLO - LELD | 403105N 0040506W | Titular // Owner: Dirección General de Emergencias. Gestor // Manager: Airtech Levante S.L. TEL: +34-657 555 205 TEL: +34-961 255 020 Email: juliavidagan@urjato.com (Júlia Vidagañ ) Email: miriam@urjato.com (Miriam López ) Email: rosacamps@urjato.com (Rosa Camps) REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) BASE C.I. SAN MARTÍN DE VALDEIGLESIAS - LEDV | 402128N 0042234W | Titular // Owner: Dirección General de Emergencias. Gestor // Manager: Airtech Levante S.L. TEL: +34-657 555 205 TEL: +34-961 255 020 Email: juliavidagan@urjato.com (Júlia Vidagañ) Email: miriam@urjato.com (Miriam López) Email: rosacamps@urjato.com (Rosa Camps) REMARKS: Exclusivamente para emergencias. // Only available for em
     (HLP) BASE C.I. TALAVERA DE LA REINA - LEEI | 395527N 0044804W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (HLP) BASE CONTRA INCENDIOS DE ALCOBA DE LOS MONTES - LENT | 391601N 0042926W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (HLP) BASE DE BRICA DE CÁRTAMA - LEHR | 364319N 0044212W | Dirección General de Política Forestal y Biodiversidad. Consejería de Sostenibilidad. Medio Ambiente y Economía Azul de la Junta de Andalucía TEL: +34-955 003 737 (Persona de contacto: Juan Sánchez Ruiz ( Director del Centro Operativo Regional)) TEL: +34-958 897 867 (Persona de contacto: Juan Sánchez Ruiz ( Director del Centro Operativo Re
     (HLP) BASE DE EXTINCIÓN DE INCENDIOS DE TÍRIG (CASTELLÓN) - LEIV | 402415N 0000353E | Titular:Agencia Valenciana de Seguridad y Respuesta a las Emergencias (AVSRE) (Castellón) Gestor: Airtech Levante S.L. TEL: +34-961 983 734 TEL: +34-961 983 735 Email: extincionincendios@gva.es
     (HLP) BECERREÁ (LUGO) - LEBK | 425155N 0071115W | Dirección General de Defensa del Monte. Xunta de Galicia TEL: +34-881 996 391 Email: defensadomonte.mediorural@xunta.gal
     (HLP) BERGA - LERG | 420617N 0015129E | Direcció General de Transports i Mobilitat
     (HLP) BIFOR B EL SERRANILLO - LENI | 403928N 0031023W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (HLP) BIFOR B LA ATALAYA - LEAY | 383804N 0034722W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (HLP) BOLTAÑA FORESTAL - LEOF | 422557N 0000533E | Dirección General de Gestión Forestal del Departamento de Medio Ambiente y Turismo del Gobierno de Aragón. Dirección General de Gestión Forestal TEL: +34-976 714 810 Email: gestionforestal@aragon.es
     (HLP) BOMBERS DE CAMPRODÓN - LEDN | 421813N 0022131E | Direcció General de Prevenció Extinció i Salvaments D'Incenis
     (HLP) BREA DE ARAGÓN - LEBY | 413208N 0013617W | Servicio provincial del departamento de Medioambiente y Turismo de Zaragoza TEL: +34-976 392 057 Email: spzma@aragon.es
     (HLP) BURGOHONDO - LEBH | 402444N 0044616W | Ayuntamiento de Burgohondo
     (HLP) C.I. BUSTARVIEJO - LEBU | 405125N 0034432W | Titular // Owner: Dirección General de Emergencias. Gestor // Manager: Airtech Levante S.L. TEL: +34-657 555 205 TEL: +34-961 255 020 Email: juliavidagan@urjato.com (Júlia Vidagañ) Email: miriam@urjato.com (Miriam López) Email: rosacamps@urjato.com (Rosa Camps) REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) C.I. CEBREROS - LEEB | 402802N 0042720W | Consejería de Medio Ambiente de la Junta de Castilla y León Conserjería de Medio Ambiente de la Junta de Castilla y León
     (HLP) C.I. COCA - LEIC | 411324N 0043022W | Junta Castilla León
     (HLP) C.I. CUETO - LEET | 423758N 0063855W | Junta de Castilla y León
     (HLP) C.I. DE CALERA DE LEÓN - LELE | 380650N 0062036W | Servicio de Prevención y Extinción de Incendios Forestales (Plan INFOEX) de la Junta de Extremadura TEL: +34-927 005 807 Email: drones.infoex@juntaex.es
     (HLP) C.I. DE LA GUANCHA - GCLG | 282239N 0163858W | Hispánica de Aviación S.A.
     (HLP) C.I. DE MARROXO - LEXO | 422823N 0073006W | Dirección Xeral de Defensa do Monte - Xunta de Galicia TEL: +34-881 997 223 TEL: +34-981 546 103 Email: extincionincendios.medio-rural@xunta.gal
     (HLP) C.I. DE NAVACERRADA - LENV | 404426N 0040015W | Titular // Owner: Dirección General de Emergencias. Gestor // Manager: Airtech Levante S.L. TEL: +34-657 555 205 TEL: +34-961 255 020 Email: juliavidagan@urjato.com (Júlia Vidagañ) Email: miriam@urjato.com (Miriam López) Email: rosacamps@urjato.com (Rosa Camps) REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) C.I. DE SERRADILLA - LERR | 394911N 0060739W | Servicio de Prevención y Extinción de Incendios Forestales (Plan INFOEX) de la Junta de Extremadura TEL: +34-927 005 807 Email: mediosaereos.infoex@juntaex.es
     (HLP) C.I. GUADRAMIRO - LEGD | 410039N 0062840W | Junta Castilla León
     (HLP) C.I. HERRERA DEL DUQUE - LEDU | 390959N 0050400W | Servicio de Prevención y Extinción de Incendios Forestales (Plan INFOEX) de la Junta de Extremadura TEL: +34-927 005 807 Email: mediosaereos.infoex@juntaex.es
     (HLP) C.I. MANCHITA - LEIT | 384929N 0060140W | Servicio de Prevención y Extinción de Incendios Forestales (Plan INFOEX) de la Junta de Extremadura TEL: +34-927 005 807 Email: mediosaereos.infoex@juntaex.es
     (HLP) C.I. PIEDRALAVES - LEPD | 401839N 0044235W | Consejería de Medio Ambiente de la Junta de Castilla y León Conserjería de Medio Ambiente de la Junta de Castilla y León
     (HLP) C.I. PRADOLUENGO - LENG | 421954N 0031248W | Junta Castilla León
     (HLP) C.I. PUNTAGORDA - GCPU | 284643N 0175943W | Cabildo Insular De La Palma TEL: +34-922 423 100 (Francisco Prieto Prieto) Email: francisco.prieto@cablapalma.es (Francisco Prieto Prieto)
     (HLP) C.I. QUINTANILLA - LEQU | 413742N 0042304W | Junta de Castilla y León
     (HLP) C.I. VIVERO - LEVV | 413622N 0044602W | Junta de Castilla y León
     (HLP) CALAMOCHA FORESTAL - LECJ | 405743N 0011811W | Dirección General de Gestión Forestal del dpt. Medio Ambiente y Turismo del Gobierno de Aragón. TEL: +34-976 714 810 (Dirección General de Gestión Forestal) Email: gestionforestal@aragon.es
     (AD/HLP) CAMPILLOS-PARAVIENTOS - LEDP | 395629N 0013210W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (HLP) CAMPOSAGRADO - LEAD | 424355N 0054335W | Consejería de Fomento y Medio Ambiente. Junta de Castilla y León
     (HLP) CAS CURREDÓ - LECC | 385545N 0012759E | CEOR S.L. Manuel Camacho Mesas TEL: +34-616 424 627 Email: manuelcamacho@mcaminter.com
     (HLP) CASTROMAIOR (A CORUÑA) - LECR | 431023N 0081951W | Dirección General de Defensa del Monte. Xunta de Galicia TEL: +34-881 996 391 Email: defensadomonte.mediorural@xunta.gal
     (HLP) CEDEFO DE ADAMÚZ (CÓRDOBA) - LEUZ | 381010N 0043415W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vi
     (HLP) CEDEFO DE CABEZUDOS (HUELVA) - LEZU | 371020N 0063720W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) CEDEFO DE CARCABUEY (CÓRDOBA) - LECY | 372740N 0041636W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar
     (HLP) CEDEFO DE CAZORLA (JAÉN) - LECZ | 375456N 0030234W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vice
     (HLP) CEDEFO DE GALAROZA (HUELVA) - LEGL | 375526N 0064112W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) CEDEFO DE HUELMA (JAÉN) - LEUE | 374031N 0032808W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) CEDEFO DE MADROÑALEJO (SEVILLA) - LEJB | 373212N 0061744W | Dirección General de Emergencias y Protección Civil y Lucha Contra Incendios Forestales. Agencia de Seguridad y Gestión Integral de Emergencias de Andalucía. Conserjería de Sanidad, Presidencia y Emergencias. Junta de Andalucía. TEL: +34 955 003 737 (César Octaviano Vicente Fernández) Email: cor.direccion.csma @juntadeandalucia.es
     (HLP) CEDEFO DE NAVALCABALLO - LENB | 381814N 0023526W | Dirección General de Política Forestal y Biodiversidad. Consejería de Sostenibilidad, Medio Ambiente y Economía Azul de la Junta de Andalucía. TEL: +34-953 313 075 TEL: +34-955 003 737 Email: copjaen.amaya@juntadeandalucia.es Email: cor.direccion.cagpds@juntadeandalucia.es
     (HLP) CEDEFO DE RONDA (MÁLAGA) - LERD | 364543N 0051024W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) CEDEFO DE SERÓN (ALMERÍA) - LEON | 372104N 0023034W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) CEDEFO DE SIERRA NEVADA (GRANADA) - LEHN | 365254N 0032408W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) CEDEFO DE VELEZ BLANCO (ALMERÍA) - LEVZ | 374228N 0020610W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) CEDEFO DE VILLAVICIOSA (CÓRDOBA) - LEIO | 380431N 0050012W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) CEE - LESR | 425854N 0091414W | Sociedad de Salvamento y Seguridad Marítima (SASEMAR) TEL: +34-917 559 100 Email: servicioaereo@sasemar.es
     (HLP) CENTRE DE GESTIÓ D'EMERGÈNCIES 112 - LECE | 410802N 0011114E | Departament d'Interior
     (HLP) CENTRO COMARCAL DE EMERGENCIAS DE ALBENDEA - LELB | 402831N 0022301W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (HLP) CENTRO COMARCAL VILLAHERMOSA - LEVO | 384504N 0025033W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es (Juan José Fernández Ortiz)
     (HLP) CHUAC DE A CORUÑA - LEUA | 432041N 0082320W | Jose Antonio Fraga Parafita TEL: +34-619 751 104 (José Antonio Fraga Parafita) Email: secretaria.orden.interno.coruna@sergas.es (José Antonio Fraga Parafita)
     (HLP) COLMENAR (MÁLAGA) - LEFC | 365444N 0042124W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) COMPLEX EGARA - LEXE | 413314N 0020359E | Departament d'Interior Email: mossos.heliport.egara@mossos.cat
     (HLP) COP LOS VILLARES - LECK | 375753N 0044821W | Dirección General de Emergencias y Protección Civil y Lucha Contra Incendios Forestales. Agencia de Seguridad y Gestión Integral de Emergencias de Andalucía. Conserjería de Sanidad, Presidencia y Emergencias. Junta de Andalucía. TEL: +34-955 003 737 (Cesar Octaviano Vicente Fernández) Email: cor.dirección.csma@juntadeandalucia.es
     (HLP) COR-COP TOLEDO - LEOP | 395415N 0040019W | Consejería de Desarrollo Sostenible de la Junta de Comunidades de Castilla-la Mancha TEL: +34-925 248 622 (Juan José Fernández Ortiz) Email: uas.incendios@jccm.es
     (HLP) COSTA BRAVA-CENTRO - LEBC | 414823N 0030215E | TURISVOL, SL
     (HLP) COSTA NORTE-PUERTO DE VIVEIRO-CELEIRO - LEPV | 434029N 0073542W | COSELLERIA DE PESCA, MARISQUEO Y AGRICULTURA
     (HLP) DAROCA FORESTAL - LEHD | 410755N 0012512W | Dirección General de Gestión Forestal del Departamento de Medio Ambiente y Turismo del Gobierno de Aragón. TEL: +34-976 714 810 (Dirección General de Gestión Forestal) Email: gestionforestal@aragon.es (Dirección General de Gestión Forestal)
     (HLP) DIRECCIÓN GENERAL DE TRÁFICO - LEDG | 402652N 0033824W | Dirección General de Tráfico
     (HLP) EJEA FORESTAL - LEEJ | 420805N 0011237W | Dirección General de Gestión Forestal del Departamento de Medio Ambiente y Turismo del Gobierno de Aragón. TEL: +34-976 714 810 (Dirección General de Gestión Forestal) Email: gestionforestal@aragon.es (Dirección General de Gestión Forestal)
     (HLP) EL BARCO DE ÁVILA - LEBV | 402119N 0053111W | Junta de Castilla y León. Dirección General del Medio Natural. Consejería de Medio Ambiente
     (HLP) EL BODÓN - LEBD | 402904N 0063438W | Junta de Castilla y León. Consejería de Fomento y Medio Ambiente
     (HLP) EL CABRIL - LEIL | 380434N 0052453W | Empresa Nacional de Residuos Radioactivos (ENRESA) TEL: +34-957 575 100 (Eva Noguero Cubero) Email: enoc@enresa.es (Eva Noguero Cubero)
     (HLP) EL MAÍLLO - LEHL | 403417N 0061324W | Junta de Castilla y León. Consejería de Medio Ambiente
     (HLP) EL MUSEL - LEEL | 433259N 0054143W | Sociedad de Salvamento y Seguridad Marítima (SASEMAR) TEL: +34-917 559 100 Email: servicioaereo@sasemar.es
     (HLP) EL PEDROSO (SEVILLA) - LEEP | 375023N 0054201W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) ELCIEGO - LEGO | 423058N 0023816W | ESTEBAN PONCE DE LEON SAENZ DE NAVARRETE (VINOS DE LOS HEREDEROS DEL MARQUÉS DE RISCAL S.A.) TEL: +34-618 655 850 (Esteban Ponce de León) TEL: +34-945 606 000 (Contacto) Email: eponcedeleon@marquesderiscal.com (Esteban Ponce de León)
     (HLP) ES MERCADAL - LEME | 395805N 0040537E | INSTITUT BALEAR DE LA NATURA (IBANAT) TEL: +34-636 982 657 (Jorge Casado Bragado) Email: jorge.ibanat@gmail.com
     (HLP) FINCA RETUERTA - LEFI | 413701N 0042446W | Abadía Retuerta S.A.
     (HLP) FIRA M2 L’HOSPITALET - LEFR | 412114N 0020744E | BIGAS GRUP HELICOPTERS S.L.
     (HLP) FORTALESA DE SANT JULIÀ DE RAMIS - LEFS | 420151N 0025056E | LUTECAF, SA
     (HLP) GUADALUPE - LEGH | 392740N 0051942W | Servicio de Prevención y Extinción de Incendios Forestales (Plan INFOEX) de la Junta de Extremadura TEL: +34-927 005 807 Email: drones.infoex@juntaex.es
     (HLP) HELI MONTSIÀ-AMPOSTA - LEMN | 403955N 0003349E | HELI-MONTSIA, SA
     (HLP) HELICÓPTEROS SANITARIOS DE MARBELLA - LEMB | 363041N 0045657W | TEL: +34-951 820 050 (HeliAirMarbella)
     (HLP) HELISUPERFICIE CASTOR - LEUG | 402342N 0004236E | Enagás Transporte S.A.U. TEL: +34-620 547 938 (Julián Martínez Gómez) TEL: +34-638 157 053 (Iker Barbarrubio Villasante) Email: ibarbarrubio@enagas.es (Iker Barbarrubio Villasante) Email: jjmartinez@enagas.es (Julián Martínez Gómez)
     (HLP) HOSPITAL ALCORCÓN - LEHA | 402059N 0035018W | Titular // Owner: SUMMA 112. Gestor // Manager: D. Pascual Aparicio Soto. TEL: +34-916 219 900 Email: pascual.aparicio@salud.madrid.org (Pascual Aparicio Soto) REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) HOSPITAL ALVARO CUNQUEIRO (NUEVO HOSPITAL DE VIGO) - LEHV | 421116N 0084251W | SERVICIO GALLEGO DE SALUD (SERGAS) TEL: +34-682 336 568 (José Luis Gutín Galego) Email: jose.luis.gutin.galego@sergas.es Email: solicitudes.heliporto.vigo@sergas.es Email: unidade.supervision.control.vigo@sergas.es
     (HLP) HOSPITAL CAN MISSES - LENM | 385503N 0012510E | Titular: Servei de Salut de les Illes Balears (IBSALUT). Gestor: AIRTECH LEVANTE S.L. TEL: +34-961 255 020 (Titular: Servei de Salut de les Illes Balears (IBSALUT)) Email: dg@ibsalut.caib.es (Titular: Servei de Salut de les Illes Balears (IBSALUT)) Email: miriam@urjato.com (Gestor: AIRTECH LEVANTE S.L.)
     (HLP) HOSPITAL DA MARIÑA - LEUR | 433904N 0072134W | Servizo Galego De Saúde (SERGAS) TEL: +34-982 296 000 (Ramón Ares Rico Xerente del Área Sanitaria de Lugo, A Mariña y Monforte de Lemos) TEL: +34-982 589 900 Email: secretaria.direccion.cos@sergas.es Email: xerencia.eoxi@sergas.es (Ramón Ares Rico)
     (HLP) HOSPITAL DE ALTA RESOLUCIÓN DE LEBRIJA - LEHX | 365437N 0060417W | Servicio Andaluz de Salud TEL: +34-671 592 096 (Álvaro Rivera Cañete) Email: alvaro.rivera.sspa@juntadeandalucia.es
     (HLP) HOSPITAL DE CERDANYA - LENY | 422639N 0015548E | Agrupació Europea de Cooperació Territorial Hospital de la Cerdanya (AECT HC) REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) HOSPITAL DE CRUCES (BARACALDO) - LEHS | 431653N 0025906W | AIRTECH LEVANTE SL TEL: +34-961 255 020 Email: miriam@urjato.com
     (HLP) HOSPITAL DE FORMENTERA - LEFE | 384228N 0012607E | Titular: Servei de Salut de les Illes Balears (IBSALUT). Gestor: AIRTECH LEVANTE S.L. TEL: +34-961 255 020 (Titular // Owner: Servei de Salut de les Illes Balears (IBSALUT)) Email: dg@ibsalut.caib.es (Titular // Owner: Servei de Salut de les Illes Balears (IBSALUT)) Email: miriam@urjato.com (Gestor: AIRTECH LEVANTE S.L.)
     (HLP) HOSPITAL DE IGUALADA - LEHI | 413518N 0013715E | Consorci Sanitari de l'Anoia
     (HLP) HOSPITAL DE JEREZ DE LA FRONTERA - LEHZ | 364157N 0060907W | Servicio Andaluz de Salud TEL: +34-956 032 063 (Jose Maria Mateos Gautier) TEL: +34-956 032 450 (Jose Maria Mateos Gautier) Email: josem.mateos.sspa@juntadeandalucia.es
     (HLP) HOSPITAL DE SANT PAU - LESP | 412453N 0021032E | Fundació de Gestió Sanitària de l'Hospital de la Santa Creu i Sant Pau
     (HLP) HOSPITAL DEL HENARES - LEHH | 402510N 0033156W | Titular // Owner: SUMMA 112. Gestor // Manager: D. Borja Rivero Gordo TEL: +34-659 164 852 TEL: +34-911 912 115 Email: borja.rivero@salud.madrid.org Email: dirgestion.hhen@salud.madrid.org REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) HOSPITAL DEL TAJO - LEHT | 400331N 0033641W | Titular // Owner: SUMMA 112. Gestor // Manager: Juan Antonio Martín Rodríguez. TEL: +34-659 164 852 TEL: +34-911 912 115 Email: borja.rivero@salud.madrid.org Email: dirgestion.hhen@salud.madrid.org REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) HOSPITAL DOCE DE OCTUBRE - LEDO | 402239N 0034149W | Titular // Owner: SUMMA 112 Gestor // Manager: Airtech Levante S.L. TEL: +34-657 555 205 TEL: +34-961 255 020 Email: juliavidagan@urjato.com (Júlia Vidagañ) Email: miriam@urjato.com (Miriam López) Email: rosacamps@urjato.com (Rosa Camps)
     (HLP) HOSPITAL DOCTOR JOSEP TRUETA - LEJT | 415952N 0024917E | Institut Català de la Salut (ICS)
     (HLP) HOSPITAL GENERAL DE CATALUNYA - LEHG | 412825N 0020233E | Hospital Universitari General de Catalunya
     (HLP) HOSPITAL GENERAL DE MANRESA - LEHM | 414314N 0015020E | Hospital Sant Joan de Déu de Manresa
     (HLP) HOSPITAL GENERAL UNIVERSITARIO DOCTOR BALMIS - LEUB | 382150N 0002915W | Conselleria de Sanidad Universal y Salud Pública TEL: +34-961 255 020 (Pablo Senchermés Morales. Gestor: Airtech Levante, S.L. ) TEL: +34-961 928 451 (Hospital. Titular: Conselleria de Sanidad Universal y Salud Pública) TEL: +34-965 933 695 (FRANCISCO SORIANO CANO. Conselleria de Sanidad Universal y Salud Pública) Email
     (HLP) HOSPITAL GERMANS TRIAS I PUJOL - LEJL | 412847N 0021419E | Servei Català de la Salut Ctra. de Canyet, s/n 08916 Badalona (Barcelona) TEL: +34-934 978 800 Email: mjauma.germanstrias@gencat.cat
     (HLP) HOSPITAL INFANTA LEONOR DE VALLECAS - LELV | 402312N 0033657W | Titular // Owner: SUMMA 112. Gestor // Manager: Airtech Levante S.L. TEL: +34-657 555 205 TEL: +34-961 255 020 Email: juliavidagan@urjato.com (Júlia Vidagañ) Email: miriam@urjato.com (Miriam López) Email: rosacamps@urjato.com (Rosa Camps) REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) HOSPITAL LA LÍNEA DE LA CONCEPCIÓN (Cádiz) - LENC | 361031N 0052109W | Servicio Andaluz de Salud TEL: +34-670 94 98 99 (Luís M González Álvarez) TEL: +34-677 90 40 93 (Antonio Fernández Abasolo) Email: antonio.fernandez.abasolo.sspa@juntadeandalucia.es Email: lmaria.gonzalez.sspa@juntadeandalucia.es
     (HLP) HOSPITAL NACIONAL DE PARAPLÉJICOS DE TOLEDO - LEJI | 395232N 0040259W | Servicio de Salud de Castilla La Mancha
     (HLP) HOSPITAL NEUROTRAUMATOLÓGICO DE JAÉN - LEHF | 374745N 0034634W | Servicio Andaluz de Salud TEL: +34-679 880 263 (Belén López Jimenez (Subdirección SSGG)) Email: belen.lopez.jimenez.sspa@juntadeandalucia.es
     (HLP) HOSPITAL REY JUAN CARLOS - LERY | 402026N 0035210W | Titular // Owner: SUMMA 112. Gestor // Manager: D. Rubén Horcajo Pérez. TEL: +34-676 351 660 Email: GDJimenez@hospitalreyjuancarlos.es Email: ruben.horcajo@hgvillalba.es REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) HOSPITAL SANT JOAN DE DÉU - LEJD | 412304N 0020610E | Ordre Hospitalária San Joan de Déu
     (HLP) HOSPITAL SON ESPASES - LEEH | 393633N 0023844E | Titular: Servei de Salut de les Illes Balears (IBSALUT). Gestor: AIRTECH LEVANTE S.L. TEL: +34-961 255 020 (Servei de Salut de les Illes Balears (IBSALUT)) Email: dg@ibsalut.caib.es (Servei de Salut de les Illes Balears (IBSALUT)) Email: miriam@urjato.com (Gestor: AIRTECH LEVANTE S.L. )
     (HLP) HOSPITAL TORTOSA VERGE DE LA CINTA - LETT | 404841N 0003124E | Hospital de Tortosa Verge de la Cinta
     (HLP) HOSPITAL U. NUESTRA SRA. DE CANDELARIA - GCDC | 282655N 0161705W | Servicio Canario de Salud TEL: +34-922 602 245 (Titular: Hospital Universitario Nuestra Señora de Candelaria) TEL: +34-961 255 020 (Gestor: Airtech Levante S.L.) Email: miriam@urjato.com (Gestor: Airtech Levante S.L.) Email: segurihunsc.scs@gobiernodecanarias.org (Titular: Hospital Universitario Nuestra Señora de Candelaria)
     (HLP) HOSPITAL UNIVERSITARI SANT JOAN DE REUS - LEJN | 410841N 0010730E | Reus Serveis Municipals. Gestor: Hospital Universitari Sant Joan de Reus SAM (del grupo Sagessa)
     (HLP) HOSPITAL UNIVERSITARIO CENTRAL DE ASTURIAS EN OVIEDO - LEHU | 432238N 0054935W | GISPASA. Gestión de Infraestructuras Sanitarias del Principado de Asturias
     (HLP) HOSPITAL UNIVERSITARIO CLÍNICO SAN CECILIO GRANADA - LEUS | 370849N 0033619W | Servicio Andaluz de Salud TEL: +34-670 946 961 (Francisco José Rodríguez Gallego) Email: fjose.rodriguez.gallego.sspa@juntadeandalucia.es
     (HLP) HOSPITAL UNIVERSITARIO DE BADAJOZ - LEBN | 385300N 0070008W | Servicio Extremeño de Salud TEL: +34-609 304 061 (Carlos Rafael Fajardo Fuentes) Email: cfajardo@alabeo.es (Carlos Rafael Fajardo Fuentes)
     (HLP) HOSPITAL UNIVERSITARIO DE BELLVITGE - LEHB | 412045N 0020613E | Generalitat de Catalunya
     (HLP) HOSPITAL UNIVERSITARIO DE CÁCERES - LEUH | 392836N 0061940W | Servicio Extremeño de Salud TEL: +34-609 304 061 (Carlos Rafael Fajardo Fuentes) Email: cfajardo@alabeo.es (ESTEL Consulting) REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) HOSPITAL UNIVERSITARIO DE CANARIAS - GCHU | 282722N 0161731W | HO.A. HOSPITALES DEL EXCMO. CABILDO DE TENERIFE (HECIT) TEL: +34-618 798 464 (Horacio Pérez Ortega) TEL: +34-922 678 296 Email: seghuc.scs@gobiernodecanarias.org (Horacio Pérez Ortega)
     (HLP) HOSPITAL UNIVERSITARIO DE SALAMANCA - LEBJ | 405747N 0054032W | Carmen Rodriguez Pajares TEL: +34-923 291 100 Email: gerencia.husa@saludcastillayleon.es REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) HOSPITAL UNIVERSITARIO INSULAR DE GRAN CANARIA - GCHG | 280459N 0152503W | Airtech Levante, S. L. TEL: +34-961 255 020 Email: miriam@urjato.com
     (HLP) HOSPITAL UNIVERSITARIO JOAN XXIII - LEHJ | 410732N 0011417E | Hospital Universitari Joan XXIII de Tarragona
     (HLP) HOSPITAL UNIVERSITARIO LOS ARCOS DEL MAR MENOR - LENR | 374901N 0005131W | Gestor: Gerencia del Área de Salud VIII - Mar Menor. Servicio Murciano de Salud. TEL: +34-609 304 061 (Carlos Rafael Fajardo Fuentes) TEL: +34-968 565 002 (Titular) Email: cfajardo@alabeo.es (Carlos Rafael Fajardo Fuentes) Email: rafael.gomis@carm.es (Titular)
     (HLP) HOSPITAL UNIVERSITARIO PUERTA DE HIERRO - LEPH | 402700N 0035213W | Titular // Owner: SUMMA 112. Gestor // Manager: Jefe de Servicio de Mantenimiento. Alberto López Rosa. TEL: +34-911 917 552 TEL: +34-916 799 306 Email: alberto.lopezrosa@salud.madrid.org Email: caoscritica@hospitalmajadahondasa.es REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) HOSPITAL VALLE DEL GUADALHORCE - LEVG | 364315N 0044018W | Servicio Andaluz de Salud TEL: +34-677 905 425 (Juan Ocaña Molina) Email: Juan.ocana.sspa@juntadeandalucia.es
     (HLP) HOSPITAL VIRGEN DE LA ARRIXACA - LEXA | 375555N 0010950W | Airtech Levante S.L. TEL: +34-961 255 020 (Gestor: Airtech Levante S.L.) TEL: +34-968 369 500 (Titular:: Área de Salud Nº 1 Hospital Clínico Universitario Virgen de la Arrixaca (Centralita Hospital)) TEL: +34-968 369 520 (Área de Salud Nº 1 Hospital Clínico Universitario Virgen de la Arrixaca (Gerencia)) Email: gerencia.area1.sms@car
     (HLP) HOSPITALARIO TEKNON - LETK | 412424N 0020740E | Teknon Healthcare S. L.
     (HLP) HOTEL CAN BONASTRE WINE RESORT MASQUEFA - LEBS | 413027N 0014715E | Societat Immobiliaria d’Inversions Familiars V.S. 96 S.L.
     (HLP) HOTEL REY JUAN CARLOS I - LEJC | 412250N 0020629E | Barcelona Project’s S.A.
     (HLP) HOYOS - LEHY | 401014N 0064227W | Servicio de Prevención y Extinción de Incendios Forestales (Plan INFOEX) de la Junta de Extremadura TEL: +34-927 005 807 Email: mediosaereos.infoex@juntaex.es
     (HLP) IBIAS PARQUE BOMBEROS ASTURIAS - LEBO | 430137N 0065304W | Servicio de Emergencias del Principado de Asturias (SEPA)
     (HLP) ISLA DE LA CARTUJA - LEEX | 372358N 0060038W | EPGASA (Empresa Pública de Gestión de Activos S.A.) TEL: +34-600 948 486 (Teléfono tripulación de guardia // Duty crew telephone) TEL: +34-607 530 685 (Teléfono dirección del helipuerto // Heliport management telephone) Email: occ@groupworldaviation.com (World Aviation)
     (HLP) IURRETA - LEIU | 431055N 0023847W | UNIDAD DE VIGILANCIA Y RESCATE (ERTZAINTZA) TEL: +34-670 499 438 (SECCIÓN AERONÁUTICA) Email: uvr_secretariatecnica@ertzaintza.eus (SECCIÓN AERONÁUTICA)
     (HLP) JAEDO - LERU | 431528N 0041507W | Gobierno de Cantabria
     (HLP) JARANDILLA DE LA VERA - LEJA | 400721N 0053915W | Servicio de Prevención y Extinción de Incendios Forestales (Plan INFOEX) de la Junta de Extremadura TEL: +34-927 005 807 Email: mediosaereos.infoex@juntaex.es
     (HLP) LA ALBERQUILLA - LEQL | 380737N 0015504W | Consejería de Agua, Agricultura y Medio Ambiente de la Región de Murcia TEL: +34-968 358 579 (Persona de contacto: Raúl Arias Puertas)
     (HLP) LA ALMORAIMA - LEAA | 361707N 0052605W | SUBDIRECCIÓN GENERAL DE SILVICULTURA Y MONTES. MINISTERIO DE AGRICULTURA, ALIMENTACIÓN Y MEDIO AMBIENTE
     (AD/HLP) LA CERDANYA - LECD | 422311N 0015147E | Consell Comarcal de la Cerdanya TEL: +34-677 298 861 Email: operacions@lecd.cat
     (HLP) LA MORGAL - LEGM | 432611N 0054951W | Servicio de Emergencias del Principado de Asturias (SEPA)
     (HLP) LAS CASILLAS - LELS | 411619N 0033104W | Consejería del Medio Ambiente.Dirección General de Medio Ambiente. Junta de Castilla y León Conserjería del Medio Ambiente.Dirección General de Medio Ambiente. Junta de Castilla y León
     (HLP) LAZA (OURENSE) - LEZA | 420408N 0072830W | Dirección General de Defensa del Monte. Xunta de Galicia. TEL: +34-881 996 391 Email: defensadomonte.mediorural@xunta.gal
     (HLP) LOMBA (A CORUÑA) - LELK | 425809N 0085208W | Dirección General de Defensa del Monte. Xunta de Galicia TEL: +34-881 996 391 Email: defensadomonte.mediorural@xunta.gal
     (HLP) MAS PASSAMANER - LEPS | 411110N 0010936E | Chateau Resort 'Mas Passamaner'
     (HLP) MEDINA DE POMAR - LEDI | 425708N 0032828W | Dirección General del Medio Natural de la Consejería de Fomento y Medio Ambiente de la Junta de Castilla y León
     (HLP) MILUCE - LELU | 424901N 0014045W | Gobierno de Navarra
     (HLP) NOCTURNO DE L'AEROPORT D'ANDORRA - LA SEU D'URGELL (LLEIDA) - LEAU | 422013N 0012406E | Aeroports Públics de Catalunya, S.L.U. TEL: +34-933 278 368 Email: info@aeroports.cat
     (HLP) NOU HOSPITAL DE MATARÓ - LENH | 413322N 0022548E | Consorci Sanitari del Maresme
     (HLP) NUEVO HOSPITAL DE BURGOS - LENU | 422142N 0034102W | Sociedad Nuevo Hospital de Burgos S.A.
     (HLP) O BARCO (OURENSE) - LEOB | 422603N 0065819W | Dirección General de Defensa del Monte. Xunta de Galicia TEL: +34-881 996 391 Email: defensadomonte.mediorural@xunta.gal
     (HLP) PALMAS PORT - GCPM | 280957N 0152407W | Autoridad Portuaria de las Palmas TEL: +34-928 214 454 (Titular: Autoridad Portuaria de las Palmas) TEL: +34-961 255 020 (Gestor: AIRTECH LEVANTE S.L.) Email: abordon@palmasport.es (Titular: Autoridad Portuaria de las Palmas) Email: miriam@urjato.com (Gestor: AIRTECH LEVANTE S.L.)
     (HLP) PARC DE BOMBERS D'OLOT - LEOO | 421125N 0022828E | Departamento de Interior de la Generalitat de Catalunya
     (HLP) PARC DE BOMBERS DE MAÇANET DE LA SELVA - LEMV | 414646N 0024508E | Dirección General de Prevención, Extinción de Incendios y Salvamento.Departamento de Interior. Generalitat de Catalunya. TEL: +34-935 820 358 (División de la Sala Central de Bomberos) Email: divisio.scb@gencat.cat (División de la Sala Central de Bomberos)
     (HLP) PARC TAULÍ - LERC | 413329N 0020632E | Corporación Sanitaria Parc Taulí REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) PEÑALBA FORESTAL - LEBX | 412948N 0000110W | Dirección General de Gestión Forestal del Departamento de Medio Ambiente y Turismo del Gobierno de Aragón. TEL: +34-976 714 810 Email: gestionforestal@aragon.es (Dirección General de Gestión Forestal)
     (HLP) PINOFRANQUEADO - LEPF | 401837N 0061920W | Servicio de Prevención y Extinción de Incendios Forestales (Plan INFOEX) de la Junta de Extremadura TEL: +34-927 005 807 Email: drones.infoex@juntaex.es
     (HLP) PLASENCIA - LEPL | 395923N 0060802W | Servicio de Prevención y Extinción de Incendios Forestales (Plan INFOEX) de la Junta de Extremadura TEL: +34-927 005 807 Email: drones.infoex@juntaex.es
     (HLP) PLASENCIA FORESTAL - LEFP | 421225N 0003406W | Dirección General de Gestión Forestal del Departamento de Medio Ambiente y Turismo del Gobierno de Aragón. Dirección General de Gestión Forestal TEL: +34-976 714 810 Email: gestionforestal@aragon.es
     (HLP) PORT AVENTURA - LEHP | 410544N 0010917E | Port Aventura Entertainment, S.A.U.
     (HLP) PORT DE TARRAGONA - LEDT | 410520N 0011333E | Autoridad Portuaria de Tarragona
     (HLP) PORTOMARÍN (LUGO) - LEIN | 424848N 0073710W | Dirección General de Defensa del Monte. Xunta de Galicia TEL: +34-881 996 391 Email: defensadomonte.mediorural@xunta.gal
     (HLP) PUERTO LOBO (GRANADA) - LEFO | 371419N 0033206W | Agencia De Seguridad y Gestión Integral de Emergencias de Andalucía (EMA-INFOCA) TEL: +34-670 945 577 TEL: +34-955 003 437 (Cesar Octaviano Vicente Fernández) Email: cesar.vicente@juntadeandalucia.es Email: cor.direccion.csma@juntadeandalucia.es
     (HLP) QUEIMADELOS (PONTEVEDRA) - LEQE | 421256N 0082535W | Dirección Xeral de Defensa do Monte - Xunta de Galicia TEL: +34-881 996 391 Email: defensadomonte.mediorural@xunta.gal
     (HLP) R.A.C.C. - LERA | 412253N 0020626E | Reial Automóbil Club de Catalunya RACC Fundació Email: victor.vigara@racc.es
     (HLP) S. XOÁN DE RÍO (OURENSE) - LEXN | 422303N 0071804W | Dirección General de Defensa del Monte. Xunta de Galicia TEL: +34-881 996 391 Email: defensadomonte.mediorural@xunta.gal
     (HLP) SA COMA - LEOM | 385554N 0012453E | Consejería de Medioambiente, Agricultura y Pesca. Gobierno de las Islas Baleares
     (HLP) SAHECHORES - LEHO | 423712N 0051133W | Junta de Castilla y León
     (HLP) SAN CARLOS - LESF | 362904N 0061107W | Ministerio de Defensa
     (HLP) SAN SEBASTIÁN DE LA GOMERA - GCGO | 280550N 0170608W | Dirección insular de la A.G.E. en La Gomera TEL: +34-922 999 360 (Juan Luis Navarro Mesa) Email: juanluis.navarro@correo.gob.es (Juan Luis Navarro Mesa)
     (HLP) SANT MARTÍ DE SESCORTS - LETM | 420049N 0021917E | Ingeniería de Construciones Rovira, SL TEL: +34-649 002 644 (Whatsapp)
     (HLP) SERVEI D'EVACUACIÓ DEL CIRCUIT DE CATALUNYA - LERV | 413419N 0021543E | CIRCUITS DE CATALUNYA, SL
     (HLP) TERUEL FORESTAL BLANCOS DEL COSCOJAR - LEFB | 401918N 0010324W | Dirección General de Gestión Forestal del Departamento de Medio Ambiente y Turismo del Gobierno de Aragón. TEL: +34-976 714 810 (Dirección General de Gestión Forestal) Email: gestionforestal@aragon.es (Dirección General de Gestión Forestal)
     (HLP) TINEO - LETN | 432008N 0062241W | Servicio de Emergencias del Principado de Asturias (SEPA)
     (HLP) TÍRVIA - LETV | 423107N 0011431E | Direcció General de Transports i Mobilitat
     (HLP) TORRE IBERDROLA - LEDR | 431605N 0025619W | Torre Iberdrola A.I.E TEL: +34-944 354 349 (Contacto) Email: gerencia@torreiberdrola.com Email: jchernando@iberdrola.es
     (HLP) TORRE PICASSO - LETS | 402701N 0034135W | COMUNIDAD DE PROPIETARIOS AZCA A-1 REMARKS: Exclusivamente para emergencias. // Only available for emergencies.
     (HLP) TREMP - LETR | 420952N 0005323E | Titular // Owner: Generalitat de Catalunya, Departament de la Vicepresidència i de Polítiques Digitals i Territori Gestor // Manager: Eliance Helicopters Global Services, S.L. C/ Academia General Básica de Suboficiales s/n (Sistema d’Emergències Mèdiques (SEM)) TEL: +34-932 644 400 (Sistema d’Emergències Mèdiques (SEM)) Email: uma.sem@gencat.cat. (Sistema d’
     (HLP) ULLASTRELL-TERESA VILÀ - LEUL | 413129N 0015817E | HELIPISTES, SL
     (HLP) VALENCIA DE ALCÁNTARA - LEIA | 392716N 0071318W | Servicio de Prevención y Extinción de Incendios Forestales (Plan INFOEX) de la Junta de Extremadura TEL: +34-927 005 807 Email: drones.infoex@juntaex.es
     (HLP) VALL D'HEBRON BARCELONA HOSPITAL CAMPUS - LEVU | 412537N 0020825E | Titular // Owner: Institut Catalá de La Salut (ICS) - Hospital Vall D'Hebron Gestor // Manager: Airtech Levante S.L. TEL: +34-934 893 000 (Institut Catalá de La Salut (ICS) - Hospital Vall D'Hebron) TEL: +34-961 255 020 (Airtech Levante S.L.) Email: miriam@airtechlevante.com (Airtech Levante S.L.)
     (HLP) VALLE DEL TENA - LEPJ | 424259N 0001800W | Heliswiss Iberica S.A. Email: info@heliswiss.es
     (HLP) VIELLA - LEVH | 424150N 0004805E | Conselh Generau d'Aran
     (HLP) VILALLER - LEVR | 422820N 0004245E | Direcció General de Transports i Mobilitat
     (HLP) VILAMAIOR (OURENSE) - LEHK | 415827N 0072357W | Dirección Xeral de Defensa do Monte - Xunta de Galicia TEL: +34-881 996 391 (Titular: Dirección Xeral de Defensa do Monte - Xunta de Galicia) Email: defensadomonte.mediorural@xunta.gal
     (HLP) VILLAELES - LEAE | 423409N 0043429W | Consejería de Fomento y Medio Ambiente.Junta Castilla y León Conserjería de Fomento y Medio Ambiente.Junta Castilla y León
     (HLP) VILLARALBO - LEVI | 413010N 0053948W | Junta de Castilla y León. Consejería de Fomento y Medio Ambiente
     (HLP) VILLARDECIERVOS - LEDS | 415627N 0061649W | Dirección General del Medio Natural de la Consejería de Fomento y Medio Ambiente de la Junta de Castila y León
     (HLP) VINARÒS - LEVN | 403111N 0002324E | JUANA BOVER RÍOS, JUAN & ENRIQUE ADELL BOVER
     (HLP) XURÉS (OURENSE) - LEXU | 415704N 0075727W | Dirección General de Defensa del Monte. Xunta de Galicia TEL: +34-881 996 391 Email: defensadomonte.mediorural@xunta.gal
     RESTRICTED HELIPORTS INDEX
   hdr table 4 (4 rows): INDICATOR | LOCATION | OWNER / MANAGER / CONTACT DETAILS / REMARKS
     INDICATOR | LOCATION | OWNER / MANAGER / CONTACT DETAILS / REMARKS
     (HLP) PARQUE DE BOMBEROS DE ORRIOLS - LEOR | 420756N 0025414E | Dirección General de Emergencias y Seguridad Civil (Generalitat de Catalunya)
     (HLP) PARQUE DE GARRAF-SITGES - LEGS | 411626N 0015453E | Dirección General de Emergencias y Seguridad Civil (Generalitat de Catalunya) Divisió de la Sala Central de Bombers TEL: +34-935 820 358 (Divisió de la Sala Central de Bombers) Email: coordinacio.umaer@gencat.cat Email: divisio.scb@gencat.cat
     CASUAL HELIPORTS INDEX
   TXT A CORUÑA - LECO (LCG)
   TXT AD 2-LECO
   TXT ALBACETE - LEAB (ABC)
   TXT AD 2-LEAB
   TXT ALGECIRAS - LEAG (AEI)
   TXT AD 3-LEAG
   TXT ALICANTE/Alicante-Elche Miguel Hernández - LEAL (ALC)
   TXT AD 2-LEAL
   TXT ALMERÍA - LEAM (LEI)
   TXT AD 2-LEAM
   TXT ANDORRA-LA SEU D'URGELL - LESU (LEU)
   TXT AD 2-LESU
   TXT ASTURIAS - LEAS (OVD)
   TXT AD 2-LEAS
   TXT BADAJOZ/Talavera La Real - LEBZ (BJZ)
   TXT AD 2-LEBZ
   TXT BARCELONA/Josep Tarradellas Barcelona-El Prat - LEBL (BCN)
   TXT AD 2-LEBL
   TXT BILBAO - LEBB (BIO)
   TXT AD 2-LEBB
   TXT BURGOS/Villafría - LEBG (RGS)
   TXT AD 2-LEBG
   TXT CÁDIZ/Rota - LERT (ROZ)
   TXT AD 2-LERT
   TXT CASTELLÓN - LECH (CDT)
   TXT AD 2-LECH
   TXT CIUDAD REAL - LERL (CQM)
   TXT AD 2-LERL
   TXT CIUDAD REAL/Almagro - LEAO ()
   TXT AD 3-LEAO
   TXT CÓRDOBA - LEBA (ODB)
   TXT AD 2-LEBA
   TXT GIRONA - LEGE (GRO)
   TXT AD 2-LEGE
   TXT GRANADA/Armilla - LEGA ()
   TXT AD 2-LEGA
   TXT GRANADA/Federico García Lorca. Granada-Jaén - LEGR (GRX)
   TXT AD 2-LEGR
   TXT HUESCA/Pirineos - LEHC (HSK)
   TXT AD 2-LEHC
   TXT IBIZA - LEIB (IBZ)
   TXT AD 2-LEIB
   TXT JEREZ - LEJR (XRY)
   TXT AD 2-LEJR
   TXT LEÓN - LELN (LEN)
   TXT AD 2-LELN
   TXT LLEIDA/Alguaire - LEDA (ILD)
   TXT AD 2-LEDA
   TXT LOGROÑO - LERJ (RJL)
   TXT AD 2-LERJ
   TXT LOGROÑO/Agoncillo - LELO ()
   TXT AD 3-LELO
   TXT MADRID/Adolfo Suárez Madrid-Barajas - LEMD (MAD)
   TXT AD 2-LEMD
   TXT MADRID/Colmenar Viejo - LECV ()
   TXT AD 3-LECV
   TXT MADRID/Cuatro Vientos - LECU/LEVS (MCV)
   TXT AD 2-LECU/LEVS
   TXT MADRID/Getafe - LEGT ()
   TXT Aeronaves que cumplan con los requisitos contenidos en la casilla 2, AD 2-LEGT 1, item 2 // Aircraft complying with the requirements contained in AD 2-LEGT 1, item 2
   TXT AD 2-LEGT
   TXT MADRID/Torrejón - LETO (TOJ)
   TXT AD 2-LETO
   TXT MÁLAGA/Costa del Sol - LEMG (AGP)
   TXT AD 2-LEMG
   TXT MALLORCA/Pollensa - LEPO ()
   TXT AD 2-LEPO
   TXT MALLORCA/Son Bonet - LESB (SBO)
   TXT AD 2-LESB
   TXT MENORCA - LEMH (MAH)
   TXT AD 2-LEMH
   TXT MURCIA/Aeropuerto de la Región de Murcia - LEMI (RMU)
   TXT AD 2-LEMI
   TXT MURCIA/Alcantarilla - LERI ()
   TXT AD 2-LERI
   TXT MURCIA/San Javier - LELC (MJV)
   TXT AD 2-LELC
   TXT PALMA DE MALLORCA - LEPA/LESJ (PMI)
   TXT AD 2-LEPA/LESJ
   TXT PAMPLONA - LEPP (PNA)
   TXT AD 2-LEPP
   TXT REUS - LERS (REU)
   TXT AD 2-LERS
   TXT SABADELL - LELL (QSA)
   TXT AD 2-LELL
   TXT SALAMANCA/Matacán - LESA (SLM)
   TXT AD 2-LESA
   TXT SAN SEBASTIÁN - LESO (EAS)
   TXT AD 2-LESO
   TXT SANTANDER/Seve Ballesteros-Santander - LEXJ (SDR)
   TXT AD 2-LEXJ
   TXT SANTIAGO/Rosalía de Castro - LEST (SCQ)
   TXT AD 2-LEST
   TXT SERVEIS GENERALS DEL CIRCUIT DE CATALUNYA - LETA ()
   TXT AD 3-LETA
   TXT SEVILLA - LEZL (SVQ)
   TXT AD 2-LEZL
   TXT SEVILLA/El Copero - LEEC ()
   TXT AD 3-LEEC
   TXT SEVILLA/Morón - LEMO (OZP)
   TXT AD 2-LEMO
   TXT TERUEL - LETL (TEV)
   TXT AD 2-LETL
   TXT VALENCIA - LEVC (VLC)
   TXT AD 2-LEVC
   TXT VALENCIA/Bétera - LEBT ()
   TXT AD 3-LEBT
   TXT VALLADOLID/Villanubla - LEVD (VLL)
   TXT AD 2-LEVD
   TXT VIGO - LEVX (VGO)
   TXT AD 2-LEVX
   TXT VITORIA - LEVT (VIT)
   TXT AD 2-LEVT
   TXT ZARAGOZA - LEZG (ZAZ)
   TXT AD 2-LEZG
   TXT (AD) ABLITAS - LETU
   TXT (AD) AERODEL - LEDE
   TXT (AD) AEROSIDONIA - LECX
   TXT (AD) AINSA-COSCOJUELA DE SOBRARBE - LEOJ
   TXT (AD) AIR MARUGÁN - LEIR
   TXT (AD) ALGODOR - LETG
   TXT (AD) ALHAMA DE MURCIA - LELH
   TXT (AD) ALIAGUILLA - LEAK
   TXT (AD) ALMOROX - LAS TABLAS DEL ALBERCHE - LETH
   TXT (AD) ALTAREJOS-GUADALCANAL - LEGC
   TXT (AD) AMPURIABRAVA - LEAP
   TXT (AD) AMR-UTRERA - LEUT
   TXT (AD) ASTORGA - LEAT
   TXT (AD) BEARIZ (OURENSE) - LEBI
   TXT (AD) BEAS DE SEGURA - LEBE
   TXT (AD) BENABARRE - LENA
   TXT (AD) BINÉFAR - LEBF
   TXT (AD) BINISSALEM - LEIS
   TXT (AD) CALAF-SALLAVINERA - LECF
   TXT (AD) CALDAS DE REIS - LEDD
   TXT (AD) CALZADA DE VALDUNCIEL - LEUN
   TXT (AD) CAMARENILLA - LERN
   TXT (AD/HLP) CAMPILLOS-PARAVIENTOS - LEDP
   TXT (AD) CARCELÉN - LEER
   TXT (AD) CASARRUBIOS - LEMT
   TXT (AD) CASAS DE LOS PINOS - LEPI
   TXT (AD) CASIMIRO PATIÑO - LEPN
   TXT (AD) CASTELLÓN - LECN
   TXT (AD) CERRO LINDO - LEGP
   TXT (AD) CHOZAS DE ABAJO - LEZS
   TXT (AD) CILLAMAYOR - LEUC
   TXT (AD) CORTIJO PUERTO - LEIJ
   TXT (AD) EL CARRASCAL - LEVB
   TXT (AD) EL CASTAÑO - LECT
   TXT (AD) EL MANANTÍO - LEEM
   TXT (AD) EL MEMBRILLAR - LEML
   TXT (AD) EL MOLINILLO - LELI
   TXT (AD) EL MORAL - LEOA
   TXT (AD) EL SALOBRAL - LEDL
   TXT (AD) EL TIÉTAR - LETI
   TXT (AD) FUENTE OBEJUNA - LEFU
   TXT (AD) FUENTEMILANOS - LEFM
   TXT (AD) GARCÍA - LEAI
   TXT (AD) GUADALUPE - LEGU
   TXT (AD) HERRERA DE PISUERGA - LERP
   TXT (AD) HIDROPUERTO LUIS MINGORANCE - LEGG
   TXT (AD) HIENDELAENCINA-LAS MINAS - LEEN
   TXT (AD) HOTEL HACIENDA ORÁN - LEOH
   TXT (AD) IGUALADA-ÓDENA - LEIG
   TXT (AD) JUAN ESPADAFOR - LEJE
   TXT (AD) LA AXARQUÍA - LEAX
   TXT (AD) LA CALDERERA - LELA
   TXT (AD) LA CAMINERA - LENE
   TXT (AD) LA CENTENERA - LENN
   TXT (AD/HLP) LA CERDANYA - LECD
   TXT (AD) LA CUESTA - LEDC
   TXT (AD) LA GINETA - LEGI
   TXT (AD) LA JULIANA - LEJU
   TXT (AD) LA MANCHA - LEMX
   TXT (AD) LA MORGAL - LEMR
   TXT (AD) LA NAVA-CORRAL DE AYLLÓN - LECA
   TXT (AD) LA PERDIZ-TORRE DE JUAN ABAD - LEIZ
   TXT (AD) LA RESINERA - LENS
   TXT (AD) LA VID DE BUREBA - LEDB
   TXT (AD) LILLO - LELT
   TXT (AD) LORCA, AGUSTÍN NAVARRO - LEOL
   TXT (AD) LOS ALCORES - LEAH
   TXT (AD) LOS GARRANCHOS - SAN JAVIER - LELG
   TXT (AD) LOS MARTINEZ DEL PUERTO - LEMP
   TXT (AD) LOS OTEROS - LEOS
   TXT (AD) LUMBIER - LEUM
   TXT (AD) MAFÉ-GIBRALEÓN - LEMF
   TXT (AD) MANRESA - LEMS
   TXT (AD) MANUEL SÁNCHEZ DE VALDEPEÑAS - LEVP
   TXT (AD) MARTINAMATOS - LEMK
   TXT (AD) MATILLA DE LOS CAÑOS - LETC
   TXT (AD) MAZARICOS - LEMZ
   TXT (AD) MÉRIDA - ROYANEJOS - LEMY
   TXT (AD) MONFORTE DE LEMOS - LENF
   TXT (AD) MORANTE - LETE
   TXT (AD) MUCHAMIEL - LEMU
   TXT (AD) MUNICIPAL DE POZO CAÑADA - LEPZ
   TXT Precaución durante los cursos de vuelo del Tactical Leadership Programme (TLP) de LEAB.
   TXT (AD) OCAÑA - LEOC
   TXT (AD) ONTUR - LEOT
   TXT (AD) ORGAZ - LEGZ
   TXT (AD) PETRA - PEP MERCADER - LEPT
   TXT (AD) POZORRUBIO DE SANTIAGO - LEPC
   TXT (AD) QUINTO DE DON PEDRO - LEQP
   TXT (AD) REQUENA - LERE
   TXT (AD) ROBLEDILLO DE MOHERNANDO - LERM
   TXT (AD) ROSINOS DE LA REQUEJADA - LESI
   TXT (AD) ROZAS - LERO
   TXT (AD) SAN ENRIQUE - LESE
   TXT (AD) SAN LUIS - LESL
   TXT (AD) SAN TORCUATO - LESN
   TXT (AD) SANTA CILIA LOS PIRINEOS - LECI
   TXT (AD) SANTO TOMÉ DEL PUERTO - LETP
   TXT (AD) SEBASTIÁN ALMAGRO - LEPR
   TXT (AD) SIGÜENZA - LESZ
   TXT (AD) SON ALBERTÍ - LEJF
   TXT (AD) SORIA-GARRAY - LEGY
   TXT (AD) SOTOS - LESS
   TXT (AD) TARAGUDO - LETD
   TXT (AD) TINAJEROS - LETY
   TXT (AD) TOMÁS FERNÁNDEZ ESPADA - LETF
   TXT (AD) TOROZOS - LETZ
   TXT (AD) TOTANA - LETX
   TXT (AD) TREBUJENA - LETJ
   TXT (AD) VICENTE HUERTA - LEVY
   TXT (AD) VILLACASTÍN - LEEV
   TXT (AD) VILLAFRAMIL - LEVF
   TXT (AD) VILLAFRANCA DE CÓRDOBA - LEVJ
   TXT (AD) VILLAMARCO - LEVL
   TXT (AD) VILLANUEVA DE GÁLLEGO - LEWG
   TXT (AD) VILLOLDO - LEAV
   TXT (AD) VIRGEN DE LA ESTRELLA - LEVE
   TXT (HLP) A MERCA (OURENSE) - LEMQ
   TXT (HLP) AIRBUS HELICOPTERS ESPAÑA - LEBP
   TXT (HLP) ALCAZARÉN - LEAZ
   TXT (HLP) ALCORISA FORESTAL - LEAF
   TXT (HLP) ALHAMA DE ALMERÍA - LELM
   TXT (HLP) AUTORIDAD PORTUARIA DE BARCELONA - LEPB
   TXT (HLP) AVINCIS - LEHE
   TXT (HLP) BAILO FORESTAL - LEBM
   TXT (HLP) BASE BRICA DE LOS MORALILLOS (GRANADA) - LEMJ
   TXT (HLP) BASE C.I. DE LAS ROZAS - LELR
   TXT (HLP) BASE C.I. DE LOZOYUELA - LEZO
   TXT (HLP) BASE C.I. DE MORATA DE TAJUÑA - LEAJ
   TXT (HLP) BASE C.I. DE NAVAS DEL REY - LEEY
   TXT (HLP) BASE C.I. DE PRADO DE LOS ESQUILADORES - LEES
   TXT (HLP) BASE C.I. DE PUERTO EL PICO - LEPU
   TXT (HLP) BASE C.I. DE RABANAL DEL CAMINO - LERB
   TXT (HLP) BASE C.I. DE TABUYO DEL MONTE - LETB
   TXT (HLP) BASE C.I. DE VALDEMORILLO - LELD
   TXT (HLP) BASE C.I. SAN MARTÍN DE VALDEIGLESIAS - LEDV
   TXT (HLP) BASE C.I. TALAVERA DE LA REINA - LEEI
   TXT (HLP) BASE CONTRA INCENDIOS DE ALCOBA DE LOS MONTES - LENT
   TXT (HLP) BASE DE BRICA DE CÁRTAMA - LEHR
   TXT (HLP) BASE DE EXTINCIÓN DE INCENDIOS DE TÍRIG (CASTELLÓN) - LEIV
   TXT (HLP) BECERREÁ (LUGO) - LEBK
   TXT (HLP) BERGA - LERG
   TXT (HLP) BIFOR B EL SERRANILLO - LENI
   TXT (HLP) BIFOR B LA ATALAYA - LEAY
   TXT (HLP) BOLTAÑA FORESTAL - LEOF
   TXT (HLP) BOMBERS DE CAMPRODÓN - LEDN
   TXT (HLP) BREA DE ARAGÓN - LEBY
   TXT (HLP) BURGOHONDO - LEBH
   TXT (HLP) C.I. BUSTARVIEJO - LEBU
   TXT (HLP) C.I. CEBREROS - LEEB
   TXT (HLP) C.I. COCA - LEIC
   TXT (HLP) C.I. CUETO - LEET
   TXT (HLP) C.I. DE CALERA DE LEÓN - LELE
   TXT (HLP) C.I. DE MARROXO - LEXO
   TXT (HLP) C.I. DE NAVACERRADA - LENV
   TXT (HLP) C.I. DE SERRADILLA - LERR
   TXT (HLP) C.I. GUADRAMIRO - LEGD
   TXT (HLP) C.I. HERRERA DEL DUQUE - LEDU
   TXT (HLP) C.I. MANCHITA - LEIT
   TXT (HLP) C.I. PIEDRALAVES - LEPD
   TXT (HLP) C.I. PRADOLUENGO - LENG
   TXT (HLP) C.I. QUINTANILLA - LEQU
   TXT (HLP) C.I. VIVERO - LEVV
   TXT (HLP) CALAMOCHA FORESTAL - LECJ
   TXT (AD/HLP) CAMPILLOS-PARAVIENTOS - LEDP
   TXT (HLP) CAMPOSAGRADO - LEAD
   TXT (HLP) CAS CURREDÓ - LECC
   TXT (HLP) CASTROMAIOR (A CORUÑA) - LECR
   TXT (HLP) CEDEFO DE ADAMÚZ (CÓRDOBA) - LEUZ
   TXT (HLP) CEDEFO DE CABEZUDOS (HUELVA) - LEZU
   TXT (HLP) CEDEFO DE CARCABUEY (CÓRDOBA) - LECY
   TXT (HLP) CEDEFO DE CAZORLA (JAÉN) - LECZ
   TXT (HLP) CEDEFO DE GALAROZA (HUELVA) - LEGL
   TXT (HLP) CEDEFO DE HUELMA (JAÉN) - LEUE
   TXT (HLP) CEDEFO DE MADROÑALEJO (SEVILLA) - LEJB
   TXT (HLP) CEDEFO DE NAVALCABALLO - LENB
   TXT (HLP) CEDEFO DE RONDA (MÁLAGA) - LERD
   TXT (HLP) CEDEFO DE SERÓN (ALMERÍA) - LEON
   TXT (HLP) CEDEFO DE SIERRA NEVADA (GRANADA) - LEHN
   TXT (HLP) CEDEFO DE VELEZ BLANCO (ALMERÍA) - LEVZ
   TXT (HLP) CEDEFO DE VILLAVICIOSA (CÓRDOBA) - LEIO
   TXT (HLP) CEE - LESR
   TXT (HLP) CENTRE DE GESTIÓ D'EMERGÈNCIES 112 - LECE
   TXT (HLP) CENTRO COMARCAL DE EMERGENCIAS DE ALBENDEA - LELB
   TXT (HLP) CENTRO COMARCAL VILLAHERMOSA - LEVO
   TXT (HLP) CHUAC DE A CORUÑA - LEUA
   TXT (HLP) COLMENAR (MÁLAGA) - LEFC
   TXT (HLP) COMPLEX EGARA - LEXE
   TXT (HLP) COP LOS VILLARES - LECK
   TXT (HLP) COR-COP TOLEDO - LEOP
   TXT (HLP) COSTA BRAVA-CENTRO - LEBC
   TXT (HLP) COSTA NORTE-PUERTO DE VIVEIRO-CELEIRO - LEPV
   TXT (HLP) DAROCA FORESTAL - LEHD
   TXT (HLP) DIRECCIÓN GENERAL DE TRÁFICO - LEDG
   TXT (HLP) EJEA FORESTAL - LEEJ
   TXT (HLP) EL BARCO DE ÁVILA - LEBV
   TXT (HLP) EL BODÓN - LEBD
   TXT (HLP) EL CABRIL - LEIL
   TXT (HLP) EL MAÍLLO - LEHL
   TXT (HLP) EL MUSEL - LEEL
   TXT (HLP) EL PEDROSO (SEVILLA) - LEEP
   TXT (HLP) ELCIEGO - LEGO
   TXT ESTEBAN PONCE DE LEON SAENZ DE NAVARRETE (VINOS DE LOS HEREDEROS DEL MARQUÉS DE RISCAL S.A.)
   TXT (HLP) ES MERCADAL - LEME
   TXT (HLP) FINCA RETUERTA - LEFI
   TXT (HLP) FIRA M2 L’HOSPITALET - LEFR
   TXT (HLP) FORTALESA DE SANT JULIÀ DE RAMIS - LEFS
   TXT (HLP) GUADALUPE - LEGH
   TXT (HLP) HELI MONTSIÀ-AMPOSTA - LEMN
   TXT (HLP) HELICÓPTEROS SANITARIOS DE MARBELLA - LEMB
   TXT (HLP) HELISUPERFICIE CASTOR - LEUG
   TXT (HLP) HOSPITAL ALCORCÓN - LEHA
   TXT (HLP) HOSPITAL ALVARO CUNQUEIRO (NUEVO HOSPITAL DE VIGO) - LEHV
   TXT (HLP) HOSPITAL CAN MISSES - LENM
   TXT (HLP) HOSPITAL DA MARIÑA - LEUR
   TXT (HLP) HOSPITAL DE ALTA RESOLUCIÓN DE LEBRIJA - LEHX
   TXT (HLP) HOSPITAL DE CERDANYA - LENY
   TXT (HLP) HOSPITAL DE CRUCES (BARACALDO) - LEHS
   TXT (HLP) HOSPITAL DE FORMENTERA - LEFE
   TXT (HLP) HOSPITAL DE IGUALADA - LEHI
   TXT (HLP) HOSPITAL DE JEREZ DE LA FRONTERA - LEHZ
   TXT (HLP) HOSPITAL DE SANT PAU - LESP
   TXT (HLP) HOSPITAL DEL HENARES - LEHH
   TXT (HLP) HOSPITAL DEL TAJO - LEHT
   TXT (HLP) HOSPITAL DOCE DE OCTUBRE - LEDO
   TXT (HLP) HOSPITAL DOCTOR JOSEP TRUETA - LEJT
   TXT (HLP) HOSPITAL GENERAL DE CATALUNYA - LEHG
   TXT (HLP) HOSPITAL GENERAL DE MANRESA - LEHM
   TXT (HLP) HOSPITAL GENERAL UNIVERSITARIO DOCTOR BALMIS - LEUB
   TXT (HLP) HOSPITAL GERMANS TRIAS I PUJOL - LEJL
   TXT (HLP) HOSPITAL INFANTA LEONOR DE VALLECAS - LELV
   TXT (HLP) HOSPITAL LA LÍNEA DE LA CONCEPCIÓN (Cádiz) - LENC
   TXT (HLP) HOSPITAL NACIONAL DE PARAPLÉJICOS DE TOLEDO - LEJI
   TXT (HLP) HOSPITAL NEUROTRAUMATOLÓGICO DE JAÉN - LEHF
   TXT (HLP) HOSPITAL REY JUAN CARLOS - LERY
   TXT (HLP) HOSPITAL SANT JOAN DE DÉU - LEJD
   TXT (HLP) HOSPITAL SON ESPASES - LEEH
   TXT (HLP) HOSPITAL TORTOSA VERGE DE LA CINTA - LETT
   TXT (HLP) HOSPITAL UNIVERSITARI SANT JOAN DE REUS - LEJN
   TXT (HLP) HOSPITAL UNIVERSITARIO CENTRAL DE ASTURIAS EN OVIEDO - LEHU
   TXT (HLP) HOSPITAL UNIVERSITARIO CLÍNICO SAN CECILIO GRANADA - LEUS
   TXT (HLP) HOSPITAL UNIVERSITARIO DE BADAJOZ - LEBN
   TXT (HLP) HOSPITAL UNIVERSITARIO DE BELLVITGE - LEHB
   TXT (HLP) HOSPITAL UNIVERSITARIO DE CÁCERES - LEUH
   TXT (HLP) HOSPITAL UNIVERSITARIO DE SALAMANCA - LEBJ
   TXT (HLP) HOSPITAL UNIVERSITARIO JOAN XXIII - LEHJ
   TXT (HLP) HOSPITAL UNIVERSITARIO LOS ARCOS DEL MAR MENOR - LENR
   TXT (HLP) HOSPITAL UNIVERSITARIO PUERTA DE HIERRO - LEPH
   TXT (HLP) HOSPITAL VALLE DEL GUADALHORCE - LEVG
   TXT (HLP) HOSPITAL VIRGEN DE LA ARRIXACA - LEXA
   TXT (HLP) HOSPITALARIO TEKNON - LETK
   TXT (HLP) HOTEL CAN BONASTRE WINE RESORT MASQUEFA - LEBS
   TXT (HLP) HOTEL REY JUAN CARLOS I - LEJC
   TXT (HLP) HOYOS - LEHY
   TXT (HLP) IBIAS PARQUE BOMBEROS ASTURIAS - LEBO
   TXT (HLP) ISLA DE LA CARTUJA - LEEX
   TXT (HLP) IURRETA - LEIU
   TXT (HLP) JAEDO - LERU
   TXT (HLP) JARANDILLA DE LA VERA - LEJA
   TXT (HLP) LA ALBERQUILLA - LEQL
   TXT (HLP) LA ALMORAIMA - LEAA
   TXT (AD/HLP) LA CERDANYA - LECD
   TXT (HLP) LA MORGAL - LEGM
   TXT (HLP) LAS CASILLAS - LELS
   TXT (HLP) LAZA (OURENSE) - LEZA
   TXT (HLP) LOMBA (A CORUÑA) - LELK
   TXT (HLP) MAS PASSAMANER - LEPS
   TXT (HLP) MEDINA DE POMAR - LEDI
   TXT (HLP) MILUCE - LELU
   TXT (HLP) NOCTURNO DE L'AEROPORT D'ANDORRA - LA SEU D'URGELL (LLEIDA) - LEAU
   TXT (HLP) NOU HOSPITAL DE MATARÓ - LENH
   TXT (HLP) NUEVO HOSPITAL DE BURGOS - LENU
   TXT (HLP) O BARCO (OURENSE) - LEOB
   TXT (HLP) PARC DE BOMBERS D'OLOT - LEOO
   TXT (HLP) PARC DE BOMBERS DE MAÇANET DE LA SELVA - LEMV
   TXT (HLP) PARC TAULÍ - LERC
   TXT (HLP) PEÑALBA FORESTAL - LEBX
   TXT (HLP) PINOFRANQUEADO - LEPF
   TXT (HLP) PLASENCIA - LEPL
   TXT (HLP) PLASENCIA FORESTAL - LEFP
   TXT (HLP) PORT AVENTURA - LEHP
   TXT (HLP) PORT DE TARRAGONA - LEDT
   TXT (HLP) PORTOMARÍN (LUGO) - LEIN
   TXT (HLP) PUERTO LOBO (GRANADA) - LEFO
   TXT (HLP) QUEIMADELOS (PONTEVEDRA) - LEQE
   TXT (HLP) R.A.C.C. - LERA
   TXT (HLP) S. XOÁN DE RÍO (OURENSE) - LEXN
   TXT (HLP) SA COMA - LEOM
   TXT (HLP) SAHECHORES - LEHO
   TXT (HLP) SAN CARLOS - LESF
   TXT (HLP) SANT MARTÍ DE SESCORTS - LETM
   TXT (HLP) SERVEI D'EVACUACIÓ DEL CIRCUIT DE CATALUNYA - LERV
   TXT (HLP) TERUEL FORESTAL BLANCOS DEL COSCOJAR - LEFB
   TXT (HLP) TINEO - LETN
   TXT (HLP) TÍRVIA - LETV
   TXT (HLP) TORRE IBERDROLA - LEDR
   TXT (HLP) TORRE PICASSO - LETS
   TXT (HLP) TREMP - LETR
   TXT (HLP) ULLASTRELL-TERESA VILÀ - LEUL
   TXT (HLP) VALENCIA DE ALCÁNTARA - LEIA
   TXT (HLP) VALL D'HEBRON BARCELONA HOSPITAL CAMPUS - LEVU
   TXT (HLP) VALLE DEL TENA - LEPJ
   TXT (HLP) VIELLA - LEVH
   TXT (HLP) VILALLER - LEVR
   TXT (HLP) VILAMAIOR (OURENSE) - LEHK
   TXT (HLP) VILLAELES - LEAE
   TXT (HLP) VILLARALBO - LEVI
   TXT (HLP) VILLARDECIERVOS - LEDS
   TXT (HLP) VINARÒS - LEVN
   TXT (HLP) XURÉS (OURENSE) - LEXU
   TXT (HLP) PARQUE DE BOMBEROS DE ORRIOLS - LEOR
   TXT (HLP) PARQUE DE GARRAF-SITGES - LEGS
   --- section [] https://aip.enaire.es/AIP/contenido_AIP/AD/LE_AD_1_3_en.pdf
   [debug] no hits; html head: %PDF-1.7 %���� 7008 0 obj <</Filter/FlateDecode/First 1807/Length 1835/N 200/Type/ObjStm>>stream h��ZQo�7�+~���k��+�H�*�(��xH�T�� J�-��3>P[��R݇�������|& �RN��Kn� Iޓ�& Il$�TKI%�T��gI-W����55g�%��k���%�{���H����%�Q?K|�=�_� [���.3@,�ht�"�`��Sa�E�t�"XP�r �W�4���r5s�8d � ?�։�>Q�w� \�PF�d� �^��������9�ܹ"�����2ɵ���Cޑ����孢A�H�T"J�l���\rc<�@��JQ*�-�%�����L��W��pBFd�%V��\d/3%�f�U�B�dC1̔��j�L��*��V^��ڔ�TTʠ������j�8@�<4r�G�@ 8��:S��WGYd ���74�D� �EЄ��;[��d6\k�#ʩ)+ �<\�6㦨��YMظ � |`��9ғf�.H�R8j4��Ra z��1�V�HM�X�H�*� \Uҁ�t*�}���@s:X�u����g��#�� %h����I��W}Z��B�� |��d�g�3���g�� P� �_0�\fy��h�g�d�8�P֝#�u%��:�Zzu�H�J D��X� &P���ޡ
   --- section [] https://aip.enaire.es/AIP/contenido_AIP/AD/LE_Amdt_A_2026_06_AD_1_3.zip
   [debug] no hits; html head: PK�N'Z ArT�%LE_Amdt_A_2026_06_AD_1_3_Metadata.txt��A �0 ��! �>��{�A+5�&�����ս�.�d갑aA�Iz'݅K%6RX6��=��1�0�ύ%����׌�M��ՖGrPKTk�\- LE_Amdt_A_2026_06_AD_1_3_AD_Restricted_en.csvux UT pj�j��j�}͒�H��}�� `uK�R񋈨 �HQC&�I�ԥK��RT3�l��F:m ��k6�׽Աuh���a|�}�}�u���� {.k�-�ID8<ܿ�������I��_���,����w��򬻾����|5-�gW��~Z��Ŵ�]��y�8K��* �����8��,�ŧ| ��� ��|�������������.�N���p�O^�� wvb������ a�u��A�\-����|Y�{�*&g���e@励�g��|�\p?����}1_�ggg�3� \���L�1�dHt�舐���U R��Q�&<��,�q(�( c�d�"Ƣ�;C�iݺ�S�����C�Ε$$�[� ����r��q���s���m>)� ����#�?R��D��hFCalZ�HH�:J��"���;i��c��� \C��?�)#kp���(�O��2³�N��*Ǖ�}3r����E�(0J4g��Bp� 2<8��s�\�
   --- section [] https://aip.enaire.es/AIP/contenido_AIP/AD/LE_Amdt_A_2026_06_AD_1_3_Metadata.txt
   [debug] no hits; html head: Ver metadatos correspondientes junto con los CSVs --------------------------------------------------- See corresponding metadata along with CSVs
```
