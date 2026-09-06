# Epp 3.5 — v26 uuenduse juhend

## GitHubi üleslaadimine

1. Paki ZIP-fail arvutis lahti.
2. Ava GitHubis **epu-tervis → v2-test** haru.
3. Vali **Add file → Upload files**.
4. Lohista lahtipakitud kausta **kogu sisu** üles (mitte ZIP-fail ise).
5. Veendu enne kinnitamist, et loendis on muu hulgas `index.html`, `sw.js`, `css/`, `js/` ja `supabase/`.
6. Kinnita ühe commit'ina ja oota, kuni kõige uuem Pages build on roheline.
7. Ava Epp 3.5 ning tee üks hard refresh. Edaspidi eelistab service worker koodi puhul võrku ja vana vaade ei tohiks enam cache'i kinni jääda.

`index.html` kasutab faile kaustadest `js/` ja `css/`. Juurtasemel olevad koopiad on jäetud samasuguseks, et vana ja uue struktuuri segiajamine ei tekitaks enam erinevat käitumist.

## Mis selles versioonis muutus

- Pealehe Nutrition kuvab jooksva päeva FatSecreti kalorid ja makrod ning õige täituvusprotsendi.
- Toitumine värskendub lehe avamisel, fookusesse naasmisel ja iga viie minuti järel.
- Toitumise vaates on käsitsi värskendamise nupp ning viimase impordi aeg.
- Eesmärgid on 1972 kcal, 147 g valku, 55 g rasva ja 222 g süsivesikuid; vana salvestatud eesmärk uuendatakse ühe korra.
- Progressi 7 päeva toitumine ja sammud kasutavad Supabase'i andmeid, lokaalsed sammud on ainult varuvariant.
- Pealehe raport eemaldati.
- Vee logimise kasutajaliides eemaldati; vana salvestatud veeajalugu jäi alles.
- Pealehe „Viimane trenn“ ja nädala treeningute arv arvestavad nii treeninglogi kui jõusaalikavade seansse.
- Pealehe käsitsi sammude tagantjärele lisamine ja tsükliriba eemaldati.
- Alumise menüü Goals asendati Finance nupuga ning Trainingu alamvalikute kontrast parandati.
- Jõusaalis on neli uut kava.
- Kõik vaated kasutavad referentsiga sama Playfair Display + Inter fondipaari, sooja helehalli tausta, valgeid kaarte, tumedat teksti ning rohelist-mündist aktsendipaletti.
- Finantsides saab LHV väljaminevaid tehinguid importida, kategooriaid muuta ning vähemalt kaks kulu nimetatud grupiks ühendada.
- Rakenduse cache-versioon on `v26` ja koodifailidele kasutatakse network-first laadimist.

## LHV.ai ühendus

GitHubi koodi üleslaadimine lisab vaate, kuid pangatokenit ei tohi GitHubi panna. Ühenduse aktiveerimiseks järgi faili `LHV_SETUP.md`: lisa Supabase'i secret `LHV_REFRESH_TOKEN` ja deploy Edge Function `lhv-sync`.

## Kiirkontroll pärast deploy'd

- Pealeht: kalorid, protsent ja V/R/SV vastavad FatSecretile.
- Aktiivsus: Apple Healthi sammud ja kilomeetrid.
- Nutrition: kuupäeva vahetades kuvatakse valitud päeva andmed.
- Jõusaalikavad: neli uut kava.
- Finantsid: kaks kulu saab valida ja nimetatud grupiks teha.
- Seaded: eesmärgid on 1972 / 147 / 55 / 222.
