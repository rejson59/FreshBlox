import { expect, test } from '@playwright/test'

// The launcher (HomeBentoView) sits behind the account gate, so without Supabase credentials the
// guest surface is: the preview notice, the solo deep links and the Blok Brawl arena.

test('guest landing without accounts lists the solo games and nothing from the retired catalog', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Podgląd bez kont' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Turbo Kart' })).toHaveAttribute('href', '/?room=KART-1')
  await expect(page.getByRole('link', { name: 'Parkour' })).toHaveAttribute('href', '/?room=OBBY-1')
  await expect(page.getByRole('button', { name: 'Blok Brawl' })).toBeVisible()
  await expect(page.getByText('Skyline Rush')).toHaveCount(0)
  await expect(page.getByText('Studio Lite')).toHaveCount(0)
  // language preference is remembered in Polish by default and can be switched to English
  await expect(page.getByText('W tym podglądzie usługa kont nie jest skonfigurowana')).toBeVisible()
  await page.addInitScript(() => localStorage.setItem('freshblox.hub.lang', JSON.stringify('en')))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Preview without accounts' })).toBeVisible()
})

test('Blok Brawl button opens the duel arena for a guest and the back button returns to the landing', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Blok Brawl' }).click()
  await expect(page.getByRole('heading', { name: /Zepchnij rywala z platformy/ })).toBeVisible()
  await page.getByRole('button', { name: /Odkrywaj/ }).click()
  await expect(page.getByRole('heading', { name: 'Podgląd bez kont' })).toBeVisible()
  expect(page.url().endsWith('/')).toBeTruthy()
})

test('mobile landing has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Podgląd bez kont' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})

test('KART-1 deep link launches solo practice without login', async ({ page }) => {
  await page.goto('/?room=KART-1')
  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  const fallback = page.getByText(/Ten tor wymaga WebGL/)
  await expect(menu.or(fallback)).toBeVisible({ timeout: 15000 })
  if (await menu.isVisible()) {
    await menu.click()
    await expect(page.getByRole('heading', { name: 'Trening z botami' })).toBeVisible()
  }
  await page.getByRole('button', { name: /Wróć do gier/ }).click()
  await expect(page.getByRole('heading', { name: 'Podgląd bez kont' })).toBeVisible()
})

test('KART-1 countdown ends and the race clock starts', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/?room=KART-1')
  const fallback = page.getByText(/Ten tor wymaga WebGL/)
  const prepare = page.getByText('PRZYGOTUJ SIĘ')
  await expect(prepare.or(fallback)).toBeVisible({timeout: 20000})
  if (await fallback.isVisible()) test.skip(true, 'WebGL is unavailable in this browser')
  await expect(prepare).toBeHidden({timeout: 20000})
  await expect(page.getByText('0:00.0', {exact:true})).toHaveCount(0, {timeout: 10000})
})

test('Turbo Kart: choose an original circuit, vehicle and solo time attack', async ({page}) => {
  test.setTimeout(90_000)
  await page.goto('/?room=KART-1')
  const setup=page.getByRole('button',{name:'Ustawienia wyścigu'})
  const fallback=page.getByText(/Ten tor wymaga WebGL/)
  await expect(setup.or(fallback)).toBeVisible({timeout:20000})
  if(await fallback.isVisible()) test.skip(true,'WebGL is unavailable')
  await setup.click()
  const dialog=page.getByRole('dialog',{name:'Ustawienia wyścigu'})
  await dialog.getByLabel('Tor').selectOption('valley')
  await dialog.getByLabel('Pojazd').selectOption('formula')
  await dialog.getByLabel('Próba czasu (bez botów)').check()
  await dialog.getByRole('button',{name:'Jedź'}).click()
  await expect(page.getByText('NA CZAS',{exact:true})).toBeVisible()
  await expect(page.getByText('PRZYGOTUJ SIĘ')).toBeHidden({timeout:20000})
})
