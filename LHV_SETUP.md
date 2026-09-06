# LHV.ai ühenduse viimane seadistussamm

Epp 3.5 kood hoiab pangatokeni serveris, mitte brauseris.

1. Ava https://api.lhv.ai/api-access ja anna ainult `accounts:read` ning `transactions:read` õigused.
2. Lisa saadud refresh token Supabase Edge Functioni secret'ina nimega `LHV_REFRESH_TOKEN`. Ära lisa tokenit GitHubi ega rakenduse JavaScripti.
3. Deploy funktsioon `supabase/functions/lhv-sync/index.ts` nimega `lhv-sync` ja jäta JWT kontroll sisse.
4. Ava Epp 3.5 Finantsid ning vajuta **Sünkroniseeri LHV**.

Ligipääs on ainult lugemiseks ja selle saab LHV internetipanga aktiivsete sessioonide alt tühistada. Refresh token kehtib 30 päeva, seejärel tuleb ühendus uuesti kinnitada.
