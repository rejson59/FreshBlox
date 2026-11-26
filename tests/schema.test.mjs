import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// The repository ships `supabase/schema.sql` as the only description of the production
// database. Nothing used to verify that it applies cleanly, that it can be applied twice,
// or that it matches the columns the client selects — which is how the private-room and DM
// tables drifted away from src/lib/socialApi.ts without anyone noticing.

const schemaSql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
const alignmentSql = await readFile(
  new URL('../supabase/migrations/202611260001_social_schema_alignment.sql', import.meta.url),
  'utf8',
)
const deviceLockSql = await readFile(
  new URL('../supabase/migrations/202611260002_device_lock_hardware_signal.sql', import.meta.url),
  'utf8',
)

/** A disposable Postgres with the Supabase-provided bits (roles, auth schema, publication). */
async function freshDb() {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb DEFAULT '{}'::jsonb
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE PUBLICATION supabase_realtime;
  `)
  return db
}

const columns = async (db, table) => {
  const { rows } = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  )
  return rows.map((row) => row.column_name).sort()
}

test('schema.sql applies cleanly, twice, and matches every column the client selects', async () => {
  const db = await freshDb()
  try {
    await db.exec(schemaSql)
    // Staging and CI both build the database from scratch more than once.
    await db.exec(schemaSql)
    await db.exec(alignmentSql)
    await db.exec(alignmentSql)
    await db.exec(deviceLockSql)
    await db.exec(deviceLockSql)

    // These are the exact names used by src/lib/socialApi.ts — see listActivePrivateRooms,
    // fetchDirectMessages, sendDirectMessage and fetchUserNotifications.
    const roomColumns = await columns(db, 'fb_private_rooms')
    for (const name of ['room_code', 'world_kind', 'host_id', 'host_username', 'access_mode']) {
      assert.ok(roomColumns.includes(name), `fb_private_rooms.${name} is missing`)
    }
    assert.equal(roomColumns.includes('code'), false, 'legacy column `code` should be gone')
    assert.equal(roomColumns.includes('world'), false, 'legacy column `world` should be gone')

    const dmColumns = await columns(db, 'fb_direct_messages')
    for (const name of ['content', 'room_invite_code', 'room_invite_world', 'read_at', 'sender_username']) {
      assert.ok(dmColumns.includes(name), `fb_direct_messages.${name} is missing`)
    }
    for (const legacy of ['body', 'invite_room', 'invite_world']) {
      assert.equal(dmColumns.includes(legacy), false, `legacy column \`${legacy}\` should be gone`)
    }
  } finally {
    await db.close()
  }
})

test('the world lists accept arena and frisbee rooms and still reject nonsense', async () => {
  const db = await freshDb()
  try {
    await db.exec(schemaSql)
    await db.exec(alignmentSql)
    const host = '11111111-1111-1111-1111-111111111111'
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [host, 'host@example.test'])

    for (const world of ['lobby', 'obby', 'arena', 'frisbee']) {
      await db.query(
        'INSERT INTO public.fb_private_rooms (room_code, host_id, host_username, world_kind) VALUES ($1, $2, $3, $4)',
        [`${world.toUpperCase()}-1`, host, 'Host', world],
      )
    }
    await assert.rejects(
      db.query(
        'INSERT INTO public.fb_private_rooms (room_code, host_id, host_username, world_kind) VALUES ($1, $2, $3, $4)',
        ['WRONG-1', host, 'Host', 'racing'],
      ),
      /check constraint/i,
    )

    await db.query(
      'INSERT INTO public.fb_direct_messages (sender_id, sender_username, recipient_id, content, room_invite_world, room_invite_code) VALUES ($1, $2, $1, $3, $4, $5)',
      [host, 'Host', 'hej, gramy?', 'arena', 'ARENA-1'],
    )
    await assert.rejects(
      db.query(
        'INSERT INTO public.fb_direct_messages (sender_id, sender_username, recipient_id, content, room_invite_world) VALUES ($1, $2, $1, $3, $4)',
        [host, 'Host', 'hej', 'racing'],
      ),
      /check constraint/i,
    )
    await assert.rejects(
      db.query(
        'INSERT INTO public.fb_direct_messages (sender_id, sender_username, recipient_id, content) VALUES ($1, $2, $1, $3)',
        [host, 'Host', ''],
      ),
      /check constraint/i,
    )
  } finally {
    await db.close()
  }
})

test('two identical machines can register: the hardware signature is not unique', async () => {
  const db = await freshDb()
  try {
    await db.exec(schemaSql)
    await db.exec(deviceLockSql)

    const [first, second] = ['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']
    for (const id of [first, second]) {
      await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [id, `${id}@example.test`])
    }

    const insert = (userId, tokenHash, fpHag, coreHash) =>
      db.query(
        `INSERT INTO public.fb_device_registrations (user_id, device_token_hash, fp_ip_hash, core_hw_ip_hash, ip_hash)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, tokenHash, fpHag, coreHash, 'ip-hash'],
      )

    await insert(first, 'token-a', 'fp-a', 'shared-hardware', 'ip-hash')
    // Same hardware signature, different device: allowed (it used to fail with 23505).
    await insert(second, 'token-b', 'fp-b', 'shared-hardware', 'ip-hash')

    const { rows } = await db.query(
      'SELECT count(*)::int AS n FROM public.fb_device_registrations WHERE core_hw_ip_hash = $1',
      ['shared-hardware'],
    )
    assert.equal(rows[0].n, 2)

    // The signals that still block a second registration stay unique.
    await assert.rejects(insert(second, 'token-a', 'fp-c', 'other-hardware', 'ip-hash'), /duplicate key|unique/i)
    await assert.rejects(insert(second, 'token-c', 'fp-a', 'other-hardware', 'ip-hash'), /duplicate key|unique/i)
  } finally {
    await db.close()
  }
})

test('signup creates a profile row, and username helpers answer as the auth flow expects', async () => {
  const db = await freshDb()
  try {
    await db.exec(schemaSql)

    const userId = '44444444-4444-4444-4444-444444444444'
    await db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)`, [
      userId,
      'u_nowygracz_abcd1234@accounts.freshblox.app',
      JSON.stringify({ username: 'NowyGracz' }),
    ])

    const { rows: profiles } = await db.query(
      'SELECT username, fresh_tag, role, xp FROM public.fb_profiles WHERE id = $1',
      [userId],
    )
    assert.equal(profiles.length, 1, 'the on_auth_user_created_fb trigger must create the profile')
    assert.equal(profiles[0].username, 'NowyGracz')
    assert.match(profiles[0].fresh_tag, /^#FB-\d{4}$/)
    assert.equal(profiles[0].role, 'player')

    const available = async (name) =>
      (await db.query('SELECT public.is_freshblox_username_available($1) AS ok', [name])).rows[0].ok
    assert.equal(await available('NowyGracz'), false, 'existing username, any casing')
    assert.equal(await available('nowygracz'), false)
    assert.equal(await available('InnyGracz'), true)
    assert.equal(await available('ab'), false, 'too short')

    const resolve = async (name) =>
      (await db.query('SELECT public.resolve_freshblox_login_email($1) AS email', [name])).rows[0].email
    assert.equal(await resolve('NowyGracz'), 'u_nowygracz_abcd1234@accounts.freshblox.app')
    assert.equal(await resolve('nieistnieje'), null)
  } finally {
    await db.close()
  }
})
