import { expect, test } from '@playwright/test'

test.setTimeout(90_000)

test('Blok Brawl: guest can start a bot duel and get knocked out', async ({ page }) => {
  await page.goto('/#duel')
  await expect(page.getByRole('heading', { name: /Zepchnij rywala z platformy/ })).toBeVisible()

  await page.getByRole('button', { name: 'Zagraj z botem' }).click()
  await expect(page.locator('.brawl-hud')).toBeVisible()
  // software GL can paint the first frames late, so accept any countdown tick
  await expect(page.locator('.brawl-callout')).toHaveText(/^(3|2|1|GOTOWY|READY)$/)

  // walk straight off the south rim — nothing is in the way, so this is deterministic
  await page.keyboard.down('ArrowDown')
  await expect(page.locator('.brawl-callout.ko')).toBeVisible({ timeout: 12_000 })
  await page.keyboard.up('ArrowDown')

  // exactly one knockout was scored — the round resets and keeps playing
  const mine = await page.locator('.brawl-pips').first().locator('i.on').count()
  const theirs = await page.locator('.brawl-pips').last().locator('i.on').count()
  expect(mine + theirs).toBe(1)

  await page.close()
})

test('Blok Brawl: two tabs duel each other over a room code', async ({ page, context }) => {
  await page.goto('/#duel')
  await page.getByRole('button', { name: 'Utwórz pokój' }).click()

  const room = (await page.locator('.brawl-room').innerText()).trim()
  expect(room).toMatch(/^BRAWL-[A-Z0-9]{4}$/)
  await expect(page.locator('.brawl-wait')).toBeVisible()

  const rival = await context.newPage()
  await rival.goto('/#duel')
  await rival.getByLabel('Kod pokoju').fill(room.replace('BRAWL-', ''))
  await rival.getByRole('button', { name: 'Dołącz' }).click()

  // the handshake clears the waiting overlay on both sides and starts the round
  await expect(page.locator('.brawl-wait')).toHaveCount(0, { timeout: 10_000 })
  await expect(rival.locator('.brawl-wait')).toHaveCount(0, { timeout: 10_000 })
  await expect(page.locator('.brawl-round')).toHaveText('RUNDA 1')
  await expect(rival.locator('.brawl-round')).toHaveText('RUNDA 1')

  // both fighters are on the platform and the score is level
  await expect(page.locator('.brawl-pips').first().locator('i.on')).toHaveCount(0)
  await expect(rival.locator('.brawl-pips').first().locator('i.on')).toHaveCount(0)

  await rival.close()
})
