import { expect, test } from '@playwright/test'

test('l’accueil présente la direction artistique et la scène 3D immersive', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1').first()).toBeVisible()
  await expect(page.getByRole('link', { name: /réserver/i }).first()).toBeVisible()
  await expect(page.locator('.nail-experience').first()).toBeVisible()
  await expect(page.locator('.public-page-shell')).toHaveAttribute('data-button-style', 'pill')
})

test('le sélecteur applique un thème accessible et mémorisable', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/theme-ready/)
  const darkThemeButton = page.getByRole('button', { name: 'Thème sombre' })
  await darkThemeButton.click()
  await expect(darkThemeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/theme-ready/)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: 'Thème sombre' })).toHaveAttribute('aria-pressed', 'true')
})

test('la page de récupération présente l’OTP sans exposer un destinataire arbitraire', async ({ page }) => {
  const response = await page.goto('/reservation/recuperer')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: /retrouver votre rendez-vous/i })).toBeVisible()
  await expect(page.getByLabel('Référence de réservation')).toBeVisible()
  await expect(page.getByLabel('Numéro utilisé lors de la réservation')).toBeVisible()
  await expect(page.getByRole('button', { name: /recevoir un code/i })).toBeVisible()
})

test('le manifeste contient toutes les routes pages, y compris la récupération, et exclut les API', async ({ request }) => {
  const response = await request.get('/manus-routes.json')
  expect(response.status()).toBe(200)
  const manifest = await response.json() as { routes: Array<{ path: string }> }
  expect(manifest.routes.some((route) => route.path === '/')).toBe(true)
  expect(manifest.routes.some((route) => route.path === '/admin/messages')).toBe(true)
  expect(manifest.routes.some((route) => route.path === '/reservation/recuperer')).toBe(true)
  expect(manifest.routes.every((route) => !route.path.startsWith('/api/'))).toBe(true)
})

test('le catalogue et le contact sont rendus en HTML SSR', async ({ page }) => {
  const catalog = await page.goto('/prestations')
  expect(catalog?.status()).toBe(200)
  await expect(page.locator('h1').first()).toBeVisible()
  const contact = await page.goto('/contact')
  expect(contact?.status()).toBe(200)
  await expect(page.locator('h1').first()).toBeVisible()
})
