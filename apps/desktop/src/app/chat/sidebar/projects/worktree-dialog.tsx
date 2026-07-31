import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SanitizedInput } from '@/components/ui/sanitized-input'
import type { HermesGitBranch } from '@/global'
import { useI18n } from '@/i18n'
import { gitRef } from '@/lib/sanitize'
import { notifyError } from '@/store/notifications'
import {
  $projectTree,
  $worktreeDialog,
  closeWorktreeDialog,
  listRepoBranches,
  projectRootCwd,
  requestStartWorkSession,
  startWorkInRepo,
  switchBranchInRepo
} from '@/store/projects'

import { BaseBranchPicker } from './base-branch-picker'

interface BranchActionCopy {
  branchCreateWorktree: string
  branchOpenExisting: string
  branchSwitchHome: string
}

const branchActionLabel = (branch: HermesGitBranch, copy: BranchActionCopy) => {
  if (branch.checkedOut) {
    return copy.branchOpenExisting
  }

  return branch.isDefault ? copy.branchSwitchHome : copy.branchCreateWorktree
}

/**
 * The "new worktree" dialog — mounted EXACTLY ONCE (in the sidebar, beside
 * ProjectDialog) and driven by the `$worktreeDialog` atom. Every entry point
 * (⌘⇧B, the coding rail's kebab, the sidebar's + button) publishes intent to
 * that atom rather than mounting its own copy; N on-screen composers used to
 * mean N stacked dialogs from a single keypress.
 *
 * Features:
 * - Project picker (retarget the repo before naming the branch)
 * - Branch name input (sanitized as a git ref)
 * - Base branch picker (filterable combobox)
 * - Convert mode: check out an existing branch into a worktree
 */
export function WorktreeDialog() {
  const { t } = useI18n()
  const p = t.sidebar.projects
  const state = useStore($worktreeDialog)
  const open = state !== null
  const projectTree = useStore($projectTree)

  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [convertMode, setConvertMode] = useState(false)
  const [branches, setBranches] = useState<HermesGitBranch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [selectedBase, setSelectedBase] = useState('')
  // The repo the dialog targets. Seeded from the resolved intent, then owned
  // here so the project picker can retarget without reopening.
  const [repoPath, setRepoPath] = useState('')
  const [projectOpen, setProjectOpen] = useState(false)

  // Every project that has a working root is a valid retarget option. Deduped
  // by path — an auto project and a user project can share a folder.
  const projectOptions = useMemo(() => {
    const seen = new Set<string>()

    return projectTree.flatMap(node => {
      const path = projectRootCwd(node)

      if (!path || seen.has(path)) {
        return []
      }

      seen.add(path)

      return [{ label: node.label, path }]
    })
  }, [projectTree])

  const activeProjectLabel =
    projectOptions.find(option => option.path === repoPath)?.label ?? repoPath.split('/').pop() ?? repoPath

  // Reset to a fresh state each time the dialog opens, applying the resolved
  // repo + any pre-selected base branch from the caller (e.g. "branch off from
  // main" in the coding row's dropdown menu).
  useEffect(() => {
    if (state) {
      setName('')
      setConvertMode(false)
      setSelectedBase(state.base ?? '')
      setRepoPath(state.repoPath)
      setBranches([])
    }
  }, [state])

  const onOpenChange = (next: boolean) => {
    if (!next && !pending) {
      closeWorktreeDialog()
    }
  }

  const loadBranches = useCallback(async () => {
    if (!repoPath) {
      return
    }

    setBranchesLoading(true)

    try {
      setBranches(await listRepoBranches(repoPath))
    } catch {
      setBranches([])
    } finally {
      setBranchesLoading(false)
    }
  }, [repoPath])

  // Hand the new worktree off to a fresh session, then close.
  const started = (path: string) => {
    requestStartWorkSession(path)
    closeWorktreeDialog()
  }

  const submit = async () => {
    const branch = name.trim()

    if (pending || !repoPath || !branch) {
      return
    }

    setPending(true)

    try {
      const result = await startWorkInRepo(repoPath, { base: selectedBase || undefined, branch, name: branch })

      if (result) {
        started(result.path)
        setName('')
      }
    } catch (err) {
      notifyError(err, p.startWorkFailed)
    } finally {
      setPending(false)
    }
  }

  const convert = async (branch: HermesGitBranch) => {
    if (pending || !repoPath || !branch) {
      return
    }

    setPending(true)

    try {
      let result: null | { branch: string; path: string }

      if (branch.worktreePath) {
        result = { branch: branch.name, path: branch.worktreePath }
      } else if (branch.isDefault) {
        await switchBranchInRepo(repoPath, branch.name)
        result = { branch: branch.name, path: repoPath }
      } else {
        result = await startWorkInRepo(repoPath, { existingBranch: branch.name })
      }

      if (result) {
        started(result.path)
      }
    } catch (err) {
      notifyError(err, p.startWorkFailed)
    } finally {
      setPending(false)
    }
  }

  const enterConvert = () => {
    setConvertMode(true)
    void loadBranches()
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{convertMode ? p.convertBranchTitle : p.newWorktreeTitle}</DialogTitle>
          <DialogDescription>{convertMode ? p.convertBranchDesc : p.newWorktreeDesc}</DialogDescription>
        </DialogHeader>

        {/* Project picker — retarget which repo the worktree is cut from. Only
            worth showing when there's somewhere else to go. */}
        {projectOptions.length > 1 && (
          <Popover onOpenChange={setProjectOpen} open={projectOpen}>
            <PopoverTrigger asChild>
              <Button
                className="group w-full flex justify-start items-center min-w-0 gap-1.5 hover:no-underline hover:text-muted-foreground"
                disabled={pending}
                size="inline"
                variant="text"
              >
                <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="folder" size="0.8rem" />
                <span className="shrink-0">{p.worktreeProjectLabel}</span>
                <span className="truncate text-primary underline-offset-4 decoration-current/20 group-hover:underline">
                  {activeProjectLabel}
                </span>
                <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="chevron-down" size="0.75rem" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="z-(--z-modal-popover) min-w-(--radix-popover-trigger-width) p-0">
              <Command
                filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
              >
                <CommandInput autoFocus placeholder={p.worktreeProjectPlaceholder} />
                <CommandList className="max-h-64">
                  <CommandEmpty>{p.worktreeProjectNone}</CommandEmpty>
                  <CommandGroup>
                    {projectOptions.map(option => (
                      <CommandItem
                        key={option.path}
                        onSelect={() => {
                          setRepoPath(option.path)
                          // The new repo has its own branches — drop the old
                          // list and base so nothing stale carries over.
                          setBranches([])
                          setSelectedBase('')
                          setProjectOpen(false)
                        }}
                        value={`${option.label} ${option.path}`}
                      >
                        <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="repo" size="0.8rem" />
                        <span className="truncate">{option.label}</span>
                        {option.path === repoPath && (
                          <Codicon className="ml-auto shrink-0 text-(--ui-accent)" name="check" size="0.8rem" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {convertMode ? (
          <Command
            className="rounded-md border border-(--ui-stroke-tertiary)"
            filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
          >
            <CommandInput autoFocus disabled={pending} placeholder={p.convertBranchPlaceholder} />
            <CommandList className="max-h-64">
              <CommandEmpty>{branchesLoading ? p.branchesLoading : p.noBranches}</CommandEmpty>
              <CommandGroup>
                {branches.map(branch => (
                  <CommandItem
                    disabled={pending}
                    key={branch.name}
                    onSelect={() => void convert(branch)}
                    value={branch.name}
                  >
                    <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="git-branch" size="0.8rem" />
                    <span className="truncate">{branch.name}</span>
                    <span className="ml-auto shrink-0 text-[0.625rem] text-(--ui-text-tertiary)">
                      {branchActionLabel(branch, p)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <>
            <SanitizedInput
              autoFocus
              disabled={pending}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submit()
                } else if (event.key === 'Escape') {
                  onOpenChange(false)
                }
              }}
              onValueChange={setName}
              placeholder={p.branchPlaceholder}
              sanitize={gitRef}
              value={name}
            />
            <BaseBranchPicker
              disabled={pending}
              // Remount on retarget so the picker reloads the new repo's
              // branches instead of showing the previous project's.
              key={repoPath}
              onValueChange={setSelectedBase}
              repoPath={repoPath}
              value={selectedBase}
            />
          </>
        )}

        {convertMode ? (
          <DialogFooter className="sm:justify-start">
            <Button
              className="px-0 text-(--ui-text-secondary) hover:text-foreground"
              disabled={pending}
              onClick={() => setConvertMode(false)}
              type="button"
              variant="link"
            >
              {t.common.cancel}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="sm:justify-between">
            <Button
              className="px-0 text-(--ui-text-secondary) hover:text-foreground"
              disabled={pending}
              onClick={enterConvert}
              type="button"
              variant="link"
            >
              {p.convertBranchInstead}
            </Button>
            <div className="flex items-center gap-2">
              <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="ghost">
                {t.common.cancel}
              </Button>
              <Button disabled={pending || !name.trim()} onClick={() => void submit()} type="button">
                {p.startWork}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
