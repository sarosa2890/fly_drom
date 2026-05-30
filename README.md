# ✈ Live мониторинг самолётов

Реальные данные, без заглушек:
- **Позиции бортов** — [OpenSky Network](https://opensky-network.org)
- **Маршруты / самолёты** — [adsbdb](https://www.adsbdb.com)

## Возможности
- Карта мира с живыми самолётами (иконки повёрнуты по курсу), обновление каждые 12 с.
- Переключение **Карта / Спутник** (контрол справа сверху).
- Клик по борту — тип ВС, регистрация, высота, скорость, маршрут.
- **Поиск по номеру рейса** (`SU2173` или `AFL2173`): авиакомпания, аэропорты вылета/прилёта,
  текущая позиция и **линия полёта** (пройдено сплошной, осталось пунктиром).

## Запуск
```bash
npm start          # или: node server.js
```
Открыть http://localhost:3000

Требуется Node.js ≥ 18 (используется встроенный `fetch`). Зависимостей нет.

## Лимиты и опциональная авторизация
Анонимный доступ OpenSky ограничен. Для более высоких лимитов задайте OAuth2-ключи
(создаются в личном кабинете OpenSky):
```bash
OPENSKY_CLIENT_ID=xxx OPENSKY_CLIENT_SECRET=yyy npm start
```

## API (прокси)
- `GET /api/states?lamin&lomin&lamax&lomax` — живые борта в рамке.
- `GET /api/route?flight=SU2173` — маршрут рейса.
- `GET /api/aircraft?icao24=15202e` — данные борта.
- `GET /api/find?flight=SU2173` — маршрут + текущая позиция + борт.

## Деплой на Vercel
Проект готов к Vercel без изменений: статика — папка `public/`, API — serverless-функции в `api/`
(конфиг `vercel.json`). `server.js` нужен только для локального запуска.

1. Залить на GitHub (см. ниже).
2. На vercel.com → **Add New… → Project** → импортировать репозиторий → **Deploy**.
3. (Опц.) В **Settings → Environment Variables** добавить `OPENSKY_CLIENT_ID` и
   `OPENSKY_CLIENT_SECRET` для повышенных лимитов OpenSky.

## GitHub
```bash
git init
git add .
git commit -m "Live flight monitoring"
git branch -M main
git remote add origin https://github.com/sarosa2890/fly_drom.git
git push -u origin main
```

