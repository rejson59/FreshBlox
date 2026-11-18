import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import * as catalog from '../src/data/catalog.ts'

// A real disposable Postgres engine; no Supabase credentials, real users, or network.
test('FreshCoins migration and transactions', async (t) => {
  const db = new PGlite(),
    me = randomUUID(),
    other = randomUUID()
  const sql = (s, p = []) => db.query(s, p).then((r) => r.rows)
  const role = async (user) => {
    await db.exec('RESET ROLE; SET ROLE authenticated')
    await sql("select set_config('request.jwt.claim.sub',$1,false)", [user])
  }
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated, anon;`)
    await sql('insert into auth.users values($1),($2)', [me, other])
    await db.exec(
      await readFile(new URL('../supabase/migrations/202611180001_kart_wallet.sql', import.meta.url), 'utf8'),
    )
    await t.test('server prices match the game catalog; milestone items cannot be bought', async () => {
      const all = [
        catalog.OUTFIT_CATALOG,
        catalog.FACE_CATALOG,
        catalog.HAT_CATALOG,
        catalog.TRAIL_CATALOG,
        catalog.BACK_CATALOG,
        catalog.PET_CATALOG,
      ]
        .flat()
        .filter((i) => i.price > 0 && !i.rewardOnly && i.id !== 'none')
      assert.deepEqual(
        Object.fromEntries(
          (await sql('select item,price from public.fb_coin_prices')).map((p) => [p.item, p.price]),
        ),
        Object.fromEntries(all.map((i) => [i.id, catalog.getCoinPrice(i)])),
      )
    })
    await role(me)
    const [{ token }] = await sql('select fb_kart_begin() as token')
    const lap = (n) => sql('select fb_kart_lap($1,$2) as result', [token, n]).then((rows) => rows[0].result)
    await t.test('ordered checkpoints, time bounds and idempotent credit', async () => {
      await assert.rejects(lap(1))
      await assert.rejects(lap(3))
      for (const n of [1, 2, 3]) {
        await db.exec('RESET ROLE')
        await sql("update fb_coin_wallets set last_lap_at=now()-interval '10 seconds' where user_id=$1", [me])
        await role(me)
        assert.equal((await lap(n)).new_credit, true)
        assert.equal((await lap(n)).new_credit, false)
      }
      assert.equal((await lap(3)).balance, 110)
    })
    await t.test(
      'balance persists across sessions; purchases settle once and survive a new race',
      async () => {
        const buy = () => sql("select fb_coin_buy('fresh-cap') as wallet").then((r) => r[0].wallet)
        await assert.rejects(buy())
        await db.exec('RESET ROLE')
        await sql('update fb_coin_wallets set balance=400 where user_id=$1', [me])
        await role(me)
        const first = await buy()
        assert.equal(first.balance, 40)
        assert.deepEqual(first.owned, ['fresh-cap'])
        assert.deepEqual(await buy(), first)
        await sql('select fb_kart_begin()')
        await assert.rejects(lap(3))
        assert.deepEqual((await sql('select balance,owned from fb_coin_wallets'))[0], first)
      },
    )
    await t.test('wallets are private, read-only for players, and absent from guest play', async () => {
      await role(other)
      assert.deepEqual(await sql('select balance,owned from fb_coin_wallets'), [])
      await assert.rejects(lap(1))
      await assert.rejects(sql('update fb_coin_wallets set balance=1'))
      await db.exec('RESET ROLE; SET ROLE anon')
      await assert.rejects(sql('select fb_kart_begin()'))
    })
  } finally {
    await db.close()
  }
})
