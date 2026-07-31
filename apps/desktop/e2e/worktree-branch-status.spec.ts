import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  buildAppEnv,
  createSandbox,
  launchDesktop,
  type MockBackendFixture,
  waitForAppReady,
  writeEnvFile,
  writeMockProviderConfig,
} from './fixtures'
import { startMockServer } from './mock-server'
import { expect, test } from './test'
import { expectVisualSnapshot } from './visual-snapshot'

const BRANCH_NAME = 'e2e-composer-branch'

/**
 * Enough branches that both the base-branch popover and the convert-branch
 * list overflow their default height — that's the condition under which the
 * popover gets clipped by the dialog's own scroll box, which is exactly the
 * regression the visual snapshots here guard.
 */
const EXTRA_BRANCHES = [
  'feature/alpha-one',
  'feature/beta-two',
  'feature/gamma-three',
  'fix/delta-four',
  'fix/epsilon-five',
  'chore/zeta-six',
  'chore/eta-seven',
  'spike/theta-eight',
  'spike/iota-nine',
  'release/kappa-ten',
]

function createGitRepo(root: string): string {
  const repo = path.join(root, 'repo')

  fs.mkdirSync(repo, { recursive: true })
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: repo })
  execFileSync('git', ['config', 'user.email', 'e2e@example.com'], { cwd: repo })
  execFileSync('git', ['config', 'user.name', 'Hermes E2E'], { cwd: repo })
  fs.writeFileSync(path.join(repo, 'README.md'), '# E2E repo\n', 'utf8')
  execFileSync('git', ['add', 'README.md'], { cwd: repo })
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: repo })

  for (const branch of EXTRA_BRANCHES) {
    execFileSync('git', ['branch', branch], { cwd: repo })
  }

  return repo
}

function configureRepoCwd(hermesHome: string, mockUrl: string, repo: string): void {
  writeMockProviderConfig(hermesHome, mockUrl)
  fs.appendFileSync(path.join(hermesHome, 'config.yaml'), `\nterminal:\n  cwd: ${repo}\n`, 'utf8')
  writeEnvFile(hermesHome)
}

let fixture: MockBackendFixture | null = null

/** Dialogs render as `[data-slot="dialog-content"]` (components/ui/dialog.tsx). */
const DIALOG = '[data-slot="dialog-content"]'

/** Open the worktree dialog with the global ⌘⇧B / ctrl+shift+B hotkey. */
async function openWorktreeDialog(): Promise<void> {
  const page = fixture!.page
  await page.keyboard.press('Control+Shift+B')
  await expect(page.locator(DIALOG)).toBeVisible()
}

/** Close whatever dialog is open and wait for it to leave the DOM. */
async function closeDialog(): Promise<void> {
  const page = fixture!.page
  await page.keyboard.press('Escape')
  await expect(page.locator(DIALOG)).toHaveCount(0)
}

test.beforeAll(async () => {
  const sandbox = createSandbox('worktree-branch-status')
  const repo = createGitRepo(sandbox.root)
  const mock = await startMockServer()

  configureRepoCwd(sandbox.hermesHome, mock.url, repo)

  const { app, page } = await launchDesktop(buildAppEnv(sandbox))
  fixture = {
    app,
    page,
    mock,
    mockUrl: mock.url,
    sandbox,
    cleanup: async () => {
      await app.close().catch(() => undefined)
      await mock.close()
      sandbox.cleanup()
    },
  }

  await waitForAppReady(fixture, 120_000)

  // The coding rail (and with it the ⌘⇧B worktree dialog) only mounts once the
  // session has resolved a repo-backed cwd, which happens on the first turn.
  const composer = page.locator('[contenteditable="true"]').first()
  await composer.click()
  await composer.type('create a repo-backed e2e session', { delay: 2 })
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    prompt => (document.querySelector('[data-slot="aui_thread-viewport"]')?.textContent ?? '').includes(prompt),
    'create a repo-backed e2e session',
    { timeout: 15_000 },
  )
  await expect(page.locator('.coding-status-bar')).toContainText('main')
})

test.afterAll(async () => {
  await fixture?.cleanup()
  fixture = null
})

test('worktree dialog renders the base-branch picker over the dialog, not clipped by it', async () => {
  const page = fixture!.page

  await openWorktreeDialog()

  // Open the base-branch combobox. With 11 branches its list is taller than
  // the space left below the trigger, so a popover portalled into the dialog's
  // `overflow-y-auto` box gets visibly cut off — the bug this snapshot catches.
  await page.getByRole('button', { name: /branch off/i }).click()
  await expect(page.getByPlaceholder('Search branches…')).toBeVisible()
  await expect(page.getByRole('option', { name: 'feature/alpha-one' })).toBeVisible()

  await expectVisualSnapshot(page, { name: 'worktree-dialog-base-branch-picker', app: fixture!.app })

  // Independent of pixels: the popover's painted box must not be cropped by the
  // dialog's scroll box. Assert geometry so this regression fails a headless run
  // even before anyone looks at a diff image.
  const clipped = await page.evaluate(() => {
    const popover = document.querySelector('[data-slot="popover-content"]')
    const dialog = document.querySelector('[data-slot="dialog-content"]')

    if (!popover || !dialog) {
      return { reason: 'missing', clipped: true }
    }

    const p = popover.getBoundingClientRect()
    const d = dialog.getBoundingClientRect()
    const scrolls = window.getComputedStyle(dialog).overflowY

    return {
      reason: 'measured',
      // Only a clipping ancestor can crop it. If the dialog scrolls its
      // overflow AND the popover extends past the dialog's box, it's cut.
      clipped: (scrolls === 'auto' || scrolls === 'scroll' || scrolls === 'hidden') &&
        (p.bottom > d.bottom + 1 || p.top < d.top - 1 || p.right > d.right + 1 || p.left < d.left - 1),
    }
  })

  expect(clipped.clipped, `base-branch popover is clipped by the dialog (${clipped.reason})`).toBe(false)

  await page.keyboard.press('Escape')
  await closeDialog()
})

test('worktree dialog convert-an-existing-branch sub-view lists the repo branches', async () => {
  const page = fixture!.page

  await openWorktreeDialog()
  await page.getByRole('button', { name: 'Convert an existing branch' }).click()

  await expect(page.getByPlaceholder('Search branches…')).toBeVisible()
  await expect(page.getByRole('option', { name: /feature\/alpha-one/ })).toBeVisible()

  await expectVisualSnapshot(page, { name: 'worktree-dialog-convert-branch', app: fixture!.app })

  await closeDialog()
})

test('creating a branch with ctrl-shift-b updates the composer git-status branch and leaves no dialog behind', async ({}, testInfo) => {
  const page = fixture!.page
  const codingRow = page.locator('.coding-status-bar')

  await openWorktreeDialog()
  // Exactly one dialog instance — a second (hidden or empty) one here is the
  // "double-open" symptom.
  await expect(page.locator(DIALOG)).toHaveCount(1)

  const branchInput = page.locator('input[placeholder="e.g. my-feature"]').first()
  await expect(branchInput).toBeVisible()
  await branchInput.fill(BRANCH_NAME)
  // Pick a base explicitly so we exercise the same path a user takes (open the
  // picker, choose a branch, submit) rather than the preselected default.
  // Keyboard-driven: the popover is currently clipped by the dialog, so a real
  // mouse click on an option is unreliable until that bug is fixed — this keeps
  // the double-open assertion below independent of the clipping regression.
  await page.getByRole('button', { name: /branch off/i }).click()
  await page.getByPlaceholder('Search branches…').fill('main')
  await expect(page.getByRole('option', { name: 'main' }).first()).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'New worktree' }).click()

  await expect(codingRow).toContainText(BRANCH_NAME, { timeout: 15_000 })

  // The dialog must close and STAY closed — no empty second dialog left over
  // once the new worktree session takes over.
  await expect(page.locator(DIALOG)).toHaveCount(0)
  await page.waitForTimeout(2000)
  await expect(page.locator(DIALOG)).toHaveCount(0)

  await page.screenshot({ path: testInfo.outputPath('composer-branch-after-create.png') })
})

test('ctrl-shift-b opens exactly one worktree dialog when a second composer is on screen', async ({}, testInfo) => {
  const page = fixture!.page

  // ⌘T / ctrl+T stacks a second session tile — a second live composer, and so a
  // second coding rail. Each rail used to mount its own WorktreeDialog and each
  // subscribed to the same global token, so one keypress opened two stacked
  // dialogs (dismissing the front one revealed an identical empty one behind).
  // A single mount in the sidebar makes that structurally impossible.
  await page.keyboard.press('Control+T')
  await expect(page.locator('.coding-status-bar')).toHaveCount(2, { timeout: 20_000 })

  await page.keyboard.press('Control+Shift+B')
  await expect(page.locator(DIALOG).first()).toBeVisible()
  // Settle: let every subscriber's effect flush before counting.
  await page.waitForTimeout(500)

  const count = await page.locator(DIALOG).count()
  await page.screenshot({ path: testInfo.outputPath('worktree-dialog-two-composers.png') })

  expect(count, 'one hotkey press must open exactly one worktree dialog').toBe(1)

  // ...and dismissing it leaves nothing behind.
  await closeDialog()
})
