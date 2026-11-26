# FreshBlox

Przeglądarkowy salon gier i kreator torów PL/EN. Ta gałąź rozwija kod wydania `86388b9` (lobby 3D, Parkour 500, Portal Arena, Frisbee King, Turbo Kart, konta i społeczność), zamiast zaczynać od pustego `main`.

## Start lokalny

Node **22.18+** (testy importują pliki `.ts` bezpośrednio) i npm. Do Blok Brawl, Parkour i treningowego Turbo Kart **nie potrzebujesz kluczy ani bazy**; launcher, Lobby 3D, Arena, Frisbee i funkcje kont wymagają logowania (Supabase).

```sh
npm ci
npm run dev          # http://localhost:5173 — sama aplikacja (gość / logowanie)
```

Rejestracja kont idzie przez funkcję serverless `api/register-account.js`, której `vite` nie uruchamia. Do pracy nad kontami potrzebny jest drugi terminal:

```sh
cp .env.example .env.local   # uzupełnij wartości (patrz tabela niżej)
npm run dev:api              # http://127.0.0.1:8787 — funkcje z api/
npm run dev                  # /api/* jest proxowane do dev:api (vite.config.ts)
```

Bez `dev:api` żądanie `/api/register-account` trafia w `index.html`, a klient pokazuje „Serwer rejestracji jest chwilowo zajęty” i loguje `non-JSON response` w konsoli — to najczęstsza pomyłka przy pierwszym uruchomieniu.

- `/` — ekran logowania, a po zalogowaniu launcher: hero z wybranym światem, karty światów (Lobby Główne, Parkour, Portal Arena, Frisbee King, Turbo Kart, Blok Brawl), zadania, ranking i karta gracza. Wyszukiwarka i kod pokoju w górnym pasku korzystają z rejestru `src/data/worlds.ts`. Wybór języka pozostaje w tej przeglądarce na urządzeniu.
- `/#duel` — Blok Brawl: pojedynek 1 na 1 na kurczącej się platformie, z botem lub po kodzie pokoju (`BRAWL-XXXX`), dostępny także bez logowania. Strzałki/WASD do ruchu, spacja do dashu.
- `/?world=parkour` lub starszy link `/?room=OBBY-1` — 500 różnych etapów w pięciu światach. Po każdym setnym etapie przejdź przez portal; piąty jest metą. Postęp gościa zapisuje się lokalnie, bez waluty i nagród konta. [ i ] wybierają odblokowane etapy, R przywraca punkt kontrolny; menu zawiera mapę światów.
- `/?room=KART-1` — wyścig z trzema botami (WebGL 2); w sesji gościa bez waluty, XP i sieciowej obecności. Lobby, Arena, Frisbee, wiadomości, drużyny, klany i narzędzia administracyjne nadal wymagają logowania.

## Zmienne środowiskowe

| Zmienna | Gdzie | Znaczenie |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | klient (publiczna) | Adres projektu Supabase. Puste = tryb gościa. |
| `VITE_SUPABASE_ANON_KEY` | klient (publiczna) | Klucz anon; chroni go RLS, nie jest sekretem. |
| `SUPABASE_URL` | serwer | To samo co wyżej, dla funkcji w `api/`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **sekret** | Klucz service-role do Admin API (tworzenie użytkowników, blokady urządzeń). Nigdy w `VITE_*`. |
| `FRESHBLOX_FP_SALT` | **sekret** | Sól HMAC do hashy urządzenia/IP. Wymagana, min. 32 znaki. Brak soli = endpoint odmawia rejestracji (`SERVER_MISCONFIGURED`) zamiast hashować przewidywalną stałą. Zmiana soli unieważnia wszystkie zapisane blokady. |
| `FRESHBLOX_ALLOWED_ORIGINS` | serwer (opcjonalna) | Dodatkowe originy przeglądarkowe dopuszczone do rejestracji, po przecinku. Origin wdrożenia jest zawsze dozwolony. |
| `FRESHBLOX_DEV_API_URL` | dev (opcjonalna) | Cel proxy `/api` w `npm run dev` (domyślnie `http://127.0.0.1:8787`). |

Wygeneruj sól:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Konta i wydanie

Frontend to Vite/React; na Vercelu komenda budowania to `npm run build`, katalog wyjściowy `dist`. Do środowiska kont podaj **publiczne** `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` podczas budowy. Rejestracja wymaga funkcji `api/register-account.js` na tym samym originie. `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` i `FRESHBLOX_FP_SALT` należą do konfiguracji funkcji serwerowej, nie do kodu klienta. Nie umieszczaj sekretów w Git ani w zmiennych `VITE_*`.

### Jak działa blokada urządzenia

Jedno konto na urządzenie, dowolnie wiele logowań.

1. Przeglądarka buduje dowód: token urządzenia (mirrorowany w `localStorage`, IndexedDB, cookie i CacheStorage) oraz dwa odciski palca (browser + „rdzeń” sprzętowy).
2. `api/register-account.js` hashowuje je HMAC-em z `FRESHBLOX_FP_SALT` i zapisuje w `fb_device_registrations`. Surowe wartości nigdy nie trafiają do bazy.
3. Odrzucenie następuje wyłącznie po dopasowaniu **tokenu urządzenia** albo **odcisku przeglądarki z IP**. Odcisk sprzętowy jest zapisywany, ale nie blokuje: dzielą go identyczne komputery w jednej sieci (rodzeństwo, pracownia szkolna) i wcześniejsza wersja odrzucała w ten sposób osoby, które nigdy nie zakładały konta.
4. Dodatkowo obowiązuje limit 6 nowych kont na 24 h z jednej sieci (po hashu IP). Jeśli odczyt licznika zawiedzie, endpoint zwraca 503 z `Retry-After` zamiast tworzyć konto „w ciemno”.
5. Klient dodatkowo blokuje przycisk rejestracji lokalnie, ale to tylko skrót — źródłem prawdy jest serwer.

Wsparcie dla zablokowanego użytkownika: blokadę usuwa się wpisem w `fb_device_registrations` (np. `delete from fb_device_registrations where user_id = '<uuid>'`). Do tego czasu użytkownik może się zalogować, ale nie założy drugiego konta.

**Odzyskiwanie hasła nie istnieje.** Konta używają syntetycznych adresów `u_<nick>_<hex>@accounts.freshblox.app`, więc standardowy reset hasła Supabase nie ma dokąd wysłać wiadomości. Do czasu dodania kodu odzyskiwania jedyną drogą jest ręczna zmiana hasła przez service-role/panel Supabase. Nie obiecuj użytkownikom resetu mailem.

### FreshCoins / Turbo Kart

1. Na **stagingu** zastosuj `supabase/migrations/202611180001_kart_wallet.sql`, następnie uruchom nową wersję aplikacji. Migracja jest transakcyjna i niezależna od zapisu profilu. Kod nie wykonuje migracji automatycznie.
2. Jedno aktywne podejście na konto. Serwer sprawdza identyfikator biegu, kolejność i czas okrążeń oraz zapisuje stałe nagrody (15 / 15 / 80 monet). Powtórzenie żądania nie powiela nagrody. To sprawdzenia dla **treningu**, nie pełna serwerowa symulacja wyścigu ani system płatniczy.
3. Saldo i zakupy za monety są osobne od synchronizacji lokalnego profilu. Gracz ma prawo odczytać własny portfel, ale nie zapisać salda. Transakcja zakupu używa ceny serwerowej i zachowuje zakupione przedmioty. Przy braku migracji/połączenia klient nie pokazuje sukcesu niepotwierdzonej wypłaty.
4. Test akceptacyjny przed wdrożeniem: zaloguj konto testowe na stagingu, ukończ wyścig, zaloguj się w drugim profilu przeglądarki, porównaj saldo; po zakupie sprawdź również strój i saldo po ponownym logowaniu. W tym wydaniu nie importujemy starych, niezweryfikowanych monet lokalnych.

### Baza danych i migracje

`supabase/schema.sql` to opis istniejącej usługi, nie pełny bootstrap: część RPC klanów, pokoi prywatnych i wiadomości istnieje w produkcyjnej bazie, ale **nie ma jej w repozytorium** (patrz lista na końcu pliku). Nie odtwarzaj produkcji przez ponowne uruchomienie całego pliku na działającej bazie; dla stagingu użyj zgodnego schematu bez danych użytkowników.

Plik jest dziś aplikowalny i idempotentny (dwa razy pod rząd) — pilnuje tego `tests/schema.test.mjs` na PGlite, razem z nazwami kolumn, których używa klient:

| Migracja | Co robi |
| --- | --- |
| `202611180001_kart_wallet.sql` | Portfel FreshCoins, ceny serwerowe, RPC `fb_kart_begin` / `fb_kart_lap` / `fb_coin_buy`. |
| `202611180002_parkour_500.sql` | `parkour_500_best_time_ms` obok starszego `obby_best_time_ms`. |
| `202611260001_social_schema_alignment.sql` | Uzgadnia `fb_private_rooms` / `fb_direct_messages` z `src/lib/socialApi.ts` (`room_code`, `world_kind`, `content`, `room_invite_*`) i dopuszcza światy `arena`/`frisbee`. Na bazie, która już ma te nazwy, jest pustą operacją. |
| `202611260002_device_lock_hardware_signal.sql` | Zdejmuje `UNIQUE` z `core_hw_ip_hash`, żeby identyczne komputery w jednej sieci mogły założyć osobne konta. |
| `202611260003_monotonic_profile_counters.sql` | Liczniki postępu (XP, etapy, wyniki Areny/Frisbee, najlepszy czas) mogą tylko rosnąć — nieaktualny zapis z drugiej karty nie cofa rekordów. Nie dotyczy `fresh_gems` (wydawanie) i `obby_stage` (cofanie do checkpointu). |

### Co jeszcze wymaga decyzji produktowej

Poniższe pola profilu są dziś zapisywane przez klienta przez PostgREST (RLS sprawdza tylko `auth.uid() = id`), więc rankingi i nagrody za kamienie milowe da się podrobić: `xp`, `obby_best_stage`, `arena_wins`, `arena_best_speed`, `parkour_500_best_time_ms`, `badges`, `unlocked_items`, `fresh_gems`. Wzorzec docelowy to portfel: monotoniczne `SECURITY DEFINER` RPC (`greatest(old, new)`, walidacja per pole) i odebranie `UPDATE` na tych kolumnach.

## Weryfikacja

```sh
npm run check                    # typecheck + testy jednostkowe
npm test                         # modele toru, kody, uprawnienia, migracje i transakcje (PGlite)
npm run build                    # TypeScript + bundlowanie produkcyjne
npx playwright install chromium  # jednorazowo, dla testów przeglądarkowych
npm run test:e2e                 # landing gościa, Blok Brawl, KART-1, Parkour
```

Testy nie wymagają dostępu do produkcji. Zakres `tests/`:

- `arcade`, `brawl`, `kart-clearance`, `parkour` — czyste modele gier (fizyka, kody pokoi, trasy).
- `wallet` — migracja portfela na PGlite: ceny zgodne z katalogiem, kolejność okrążeń, idempotentna wypłata, prywatność portfela.
- `schema` — `supabase/schema.sql` aplikowany dwa razy, kolumny używane przez klienta, trigger profilu, pomocnicze RPC, brak `UNIQUE` na odcisku sprzętowym.
- `register-account` — funkcja rejestracji: sól, CORS, limity (fail-closed), blokada urządzenia, rollback konta, duplikat nicku, 413.
- `progress` — czysta arytmetyka profilu: zakupy za klejnoty, paczki, zadania, scalanie postępu gościa, sanityzacja wyszukiwarki.
- `deviceGuard` — stabilność i kształt odcisków palca, fallback bez WebCrypto.

Launcher renderuje miniatury światów na żywo (WebGL; bez niego pokazuje gradienty), a silniki gier 3D są ładowane na żądanie. Kod kreatora torów i gry Skyline Rush z poprzedniego katalogu (`src/studio/`) nie ma już wejścia w menu. Podgląd ani testy nie publikują nic na Vercelu ani w Supabase.

## Mapa kodu

| Ścieżka | Rola |
| --- | --- |
| `src/App.tsx` | Launcher, routing widoków, brama logowania, imprezy, powiadomienia (plik do rozbicia). |
| `src/store/usePlayerStore.ts` | Profil, auth, hydracja z chmury i debounce zapisu, obecność, zakupy. |
| `src/store/profileProgress.ts` | Czyste funkcje profilu (zakupy, zadania, scalanie) — bez Reacta, testowalne. |
| `src/engine/*World.tsx` | Silniki 3D (Three.js) poszczególnych światów. |
| `src/games/brawl/sim.ts` | Deterministyczna symulacja pojedynku — wzorzec dla wydzielania logiki gier. |
| `src/lib/` | Supabase, portfel, blokada urządzenia, multiplayer/impriza, audio, SFX. |
| `api/` | Funkcje serverless Vercel (`register-account`). |
| `supabase/` | `schema.sql` (opis) i `migrations/` (zmiany do zastosowania w kolejności). |
| `tests/` | Testy jednostkowe/migracyjne; `tests/e2e/` — Playwright. |
