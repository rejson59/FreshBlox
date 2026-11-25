# FreshBlox

Przeglądarkowy salon gier i kreator torów PL/EN. Ta gałąź rozwija kod wydania `86388b9` (lobby 3D, Parkour 500, Portal Arena, Frisbee King, Turbo Kart, konta i społeczność), zamiast zaczynać od pustego `main`.

## Start lokalny

Node **22.18+**, npm. Do Blok Brawl, Parkour i treningowego Turbo Kart **nie potrzebujesz kluczy ani bazy**; launcher, Lobby 3D, Arena, Frisbee i funkcje kont wymagają logowania (Supabase).

```sh
npm ci
npm run dev
```

- `/` — ekran logowania, a po zalogowaniu launcher: hero z wybranym światem, karty światów (Lobby Główne, Parkour, Portal Arena, Frisbee King, Turbo Kart, Blok Brawl), zadania, ranking i karta gracza. Wyszukiwarka i kod pokoju w górnym pasku korzystają z rejestru `src/data/worlds.ts`. Wybór języka pozostaje w tej przeglądarce na urządzeniu.
- `/#duel` — Blok Brawl: pojedynek 1 na 1 na kurczącej się platformie, z botem lub po kodzie pokoju (`BRAWL-XXXX`), dostępny także bez logowania. Strzałki/WASD do ruchu, spacja do dashu.
- `/?world=parkour` lub starszy link `/?room=OBBY-1` — 500 różnych etapów w pięciu światach. Po każdym setnym etapie przejdź przez portal; piąty jest metą. Postęp gościa zapisuje się lokalnie, bez waluty i nagród konta. [ i ] wybierają odblokowane etapy, R przywraca punkt kontrolny; menu zawiera mapę światów.
- `/?room=KART-1` — wyścig z trzema botami (WebGL 2); w sesji gościa bez waluty, XP i sieciowej obecności. Wyszukiwarka kodu w launcherze i linki korzystają z tego samego rejestru (`src/data/worlds.ts`). Lobby, Arena, Frisbee, wiadomości, drużyny, klany i narzędzia administracyjne nadal wymagają logowania.

## Konta i wydanie

Frontend to Vite/React; na Vercelu komenda budowania to `npm run build`, katalog wyjściowy `dist`. Do środowiska kont podaj **publiczne** `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` podczas budowy. Rejestracja wymaga działającej funkcji `api/register-account.js` na tym samym originie (sam Vite jej nie uruchamia). `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` i `FRESHBLOX_FP_SALT` należą do konfiguracji funkcji serwerowej, nie do kodu klienta. Nie umieszczaj sekretów w Git ani w zmiennych `VITE_*`.

`supabase/schema.sql` to odziedziczony opis istniejącej usługi, nie pełny bootstrap: część starszych RPC klanów i wiadomości jest tam opisana tylko komentarzem. Dla stagingu użyj zgodnego schematu bazy **bez danych użytkowników**. Nie odtwarzaj produkcji przez ponowne uruchomienie całego tego pliku.

### FreshCoins / Turbo Kart

1. Na **stagingu** zastosuj `supabase/migrations/202611180001_kart_wallet.sql`, następnie uruchom nową wersję aplikacji. Migracja jest transakcyjna i niezależna od zapisu profilu. Kod nie wykonuje migracji automatycznie.
2. Jedno aktywne podejście na konto. Serwer sprawdza identyfikator biegu, kolejność i czas okrążeń oraz zapisuje stałe nagrody (15 / 15 / 80 monet). Powtórzenie żądania nie powiela nagrody. To sprawdzenia dla **treningu**, nie pełna serwerowa symulacja wyścigu ani system płatniczy.
3. Saldo i zakupy za monety są osobne od synchronizacji lokalnego profilu. Gracz ma prawo odczytać własny portfel, ale nie zapisać salda. Transakcja zakupu używa ceny serwerowej i zachowuje zakupione przedmioty. Przy braku migracji/połączenia klient nie pokazuje sukcesu niepotwierdzonej wypłaty.
4. Test akceptacyjny przed wdrożeniem: zaloguj konto testowe na stagingu, ukończ wyścig, zaloguj się w drugim profilu przeglądarki, porównaj saldo; po zakupie sprawdź również strój i saldo po ponownym logowaniu. W tym wydaniu nie importujemy starych, niezweryfikowanych monet lokalnych.

## Weryfikacja

```sh
npm test                         # modele toru, kody, uprawnienia i transakcje w tymczasowym PostgreSQL (PGlite)
npm run build                    # TypeScript + bundlowanie produkcyjne
npx playwright install chromium  # jednorazowo, dla testów przeglądarkowych
npm run test:e2e                  # landing gościa, Blok Brawl, KART-1, Parkour
```

Testy nie wymagają dostępu do produkcji. Launcher renderuje miniatury światów na żywo (WebGL; bez niego pokazuje gradienty), a silniki gier 3D są ładowane na żądanie. Kod kreatora torów i gry Skyline Rush z poprzedniego katalogu (`src/studio/`) nie ma już wejścia w menu. Podgląd ani testy nie publikują nic na Vercelu ani w Supabase.
