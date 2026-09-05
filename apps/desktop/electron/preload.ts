import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('nimroDesktop', {
  getConnection: profile => ipcRenderer.invoke('nimro:connection', profile),
  revalidateConnection: () => ipcRenderer.invoke('nimro:connection:revalidate'),
  touchBackend: profile => ipcRenderer.invoke('nimro:backend:touch', profile),
  getGatewayWsUrl: profile => ipcRenderer.invoke('nimro:gateway:ws-url', profile),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('nimro:window:openSession', sessionId, opts),
  openWindow: () => ipcRenderer.invoke('nimro:window:openInstance'),
  claimAmbientCue: key => ipcRenderer.invoke('nimro:ambient:claim', key),
  wakeIndicator: {
    getState: () => ipcRenderer.invoke('nimro:wake-indicator:get'),
    setState: state => ipcRenderer.send('nimro:wake-indicator:set', state),
    onState: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('nimro:wake-indicator:state', listener)

      return () => ipcRenderer.removeListener('nimro:wake-indicator:state', listener)
    }
  },
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('nimro:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('nimro:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('nimro:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('nimro:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('nimro:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('nimro:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('nimro:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('nimro:pet-overlay:state', listener)

      return () => ipcRenderer.removeListener('nimro:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('nimro:pet-overlay:control', listener)

      return () => ipcRenderer.removeListener('nimro:pet-overlay:control', listener)
    }
  },
  // Quick Entry: the global-hotkey mini composer window. Main owns the OS
  // shortcut + the persisted preference; the quick window only captures text
  // and hands it back, and the primary renderer submits it through the normal
  // prompt path.
  quickEntry: {
    getSettings: () => ipcRenderer.invoke('nimro:quick-entry:settings:get'),
    setSettings: patch => ipcRenderer.invoke('nimro:quick-entry:settings:set', patch),
    submit: payload => ipcRenderer.send('nimro:quick-entry:submit', payload),
    dismiss: () => ipcRenderer.send('nimro:quick-entry:dismiss'),
    // Primary renderer → main → quick window: gateway connection state + the
    // recent-session options the target picker offers. Main caches the latest
    // payload so a freshly spawned quick window starts from truth.
    pushState: payload => ipcRenderer.send('nimro:quick-entry:state', payload),
    // Quick window subscribes to those pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('nimro:quick-entry:state', listener)

      return () => ipcRenderer.removeListener('nimro:quick-entry:state', listener)
    },
    // Main → primary renderer: a submit captured by the quick window.
    onSubmit: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('nimro:quick-entry:submit', listener)

      return () => ipcRenderer.removeListener('nimro:quick-entry:submit', listener)
    },
    // Main → quick window: you were just summoned (reset draft + refocus).
    onShown: callback => {
      const listener = () => callback()
      ipcRenderer.on('nimro:quick-entry:shown', listener)

      return () => ipcRenderer.removeListener('nimro:quick-entry:shown', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('nimro:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('nimro:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('nimro:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('nimro:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('nimro:connection-config:test', payload),
  sshConfigHosts: () => ipcRenderer.invoke('nimro:ssh-config:hosts'),
  sshResolveHost: host => ipcRenderer.invoke('nimro:ssh-config:resolve', host),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('nimro:connection-config:probe', remoteUrl),
  oauthLoginConnectionConfig: remoteUrl => ipcRenderer.invoke('nimro:connection-config:oauth-login', remoteUrl),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('nimro:connection-config:oauth-logout', remoteUrl),
  // Nimro Cloud: one portal login powers discovery + silent per-agent sign-in
  // (cloud-auto-discovery Phase 3).
  cloud: {
    status: () => ipcRenderer.invoke('nimro:cloud:status'),
    login: () => ipcRenderer.invoke('nimro:cloud:login'),
    logout: () => ipcRenderer.invoke('nimro:cloud:logout'),
    discover: org => ipcRenderer.invoke('nimro:cloud:discover', org),
    agentSignIn: dashboardUrl => ipcRenderer.invoke('nimro:cloud:agent-sign-in', dashboardUrl)
  },
  profile: {
    get: () => ipcRenderer.invoke('nimro:profile:get'),
    set: name => ipcRenderer.invoke('nimro:profile:set', name)
  },
  api: request => ipcRenderer.invoke('nimro:api', request),
  notify: payload => ipcRenderer.invoke('nimro:notify', payload),
  requestMicrophoneAccess: () => ipcRenderer.invoke('nimro:requestMicrophoneAccess'),
  readFileDataUrl: filePath => ipcRenderer.invoke('nimro:readFileDataUrl', filePath),
  readFileDataUrlForAttach: filePath => ipcRenderer.invoke('nimro:readFileDataUrlForAttach', filePath),
  dataUrlReadMax: {
    get: () => ipcRenderer.invoke('nimro:data-url-read-max:get'),
    set: maxMb => ipcRenderer.invoke('nimro:data-url-read-max:set', maxMb)
  },
  readFileText: filePath => ipcRenderer.invoke('nimro:readFileText', filePath),
  selectPaths: options => ipcRenderer.invoke('nimro:selectPaths', options),
  writeClipboard: text => ipcRenderer.invoke('nimro:writeClipboard', text),
  readClipboard: () => ipcRenderer.invoke('nimro:readClipboard'),
  saveImageFromUrl: url => ipcRenderer.invoke('nimro:saveImageFromUrl', url),
  saveImageBuffer: (data, ext) => ipcRenderer.invoke('nimro:saveImageBuffer', { data, ext }),
  saveClipboardImage: () => ipcRenderer.invoke('nimro:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('nimro:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('nimro:watchPreviewFile', url),
  watchDirectory: dir => ipcRenderer.invoke('nimro:watchDirectory', dir),
  stopPreviewFileWatch: id => ipcRenderer.invoke('nimro:stopPreviewFileWatch', id),
  setActiveWork: payload => ipcRenderer.send('nimro:active-work', payload),
  setTitleBarTheme: payload => ipcRenderer.send('nimro:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('nimro:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('nimro:translucency', payload),
  setKeepAwake: on => ipcRenderer.send('nimro:keep-awake', on),
  setPreviewShortcutActive: active => ipcRenderer.send('nimro:previewShortcutActive', Boolean(active)),
  openExternal: url => ipcRenderer.invoke('nimro:openExternal', url),
  openPreviewInBrowser: url => ipcRenderer.invoke('nimro:openPreviewInBrowser', url),
  fetchLinkTitle: url => ipcRenderer.invoke('nimro:fetchLinkTitle', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('nimro:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('nimro:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('nimro:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('nimro:setting:defaultProjectDir:pick')
  },
  zoom: {
    // Current zoom of this window, as { level, percent }.
    get: () => ipcRenderer.invoke('nimro:zoom:get'),
    setPercent: percent => ipcRenderer.send('nimro:zoom:set-percent', percent),
    // Fires on every zoom change, including the Ctrl/Cmd +/-/0 shortcuts,
    // so the settings UI can stay in sync with the keyboard.
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('nimro:zoom:changed', listener)

      return () => ipcRenderer.removeListener('nimro:zoom:changed', listener)
    }
  },
  revealLogs: () => ipcRenderer.invoke('nimro:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('nimro:logs:recent'),
  readDir: dirPath => ipcRenderer.invoke('nimro:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('nimro:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('nimro:fs:reveal', targetPath),
  openDir: dirPath => ipcRenderer.invoke('nimro:fs:openDir', dirPath),
  desktopPluginsRoot: () => ipcRenderer.invoke('nimro:fs:desktopPluginsRoot'),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('nimro:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('nimro:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('nimro:fs:trash', targetPath),
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('nimro:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('nimro:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('nimro:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('nimro:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('nimro:git:branchList', repoPath),
    baseBranchList: repoPath => ipcRenderer.invoke('nimro:git:baseBranchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('nimro:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('nimro:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('nimro:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('nimro:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('nimro:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('nimro:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('nimro:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('nimro:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('nimro:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('nimro:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('nimro:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('nimro:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('nimro:git:review:shipInfo', repoPath),
      createPr: repoPath => ipcRenderer.invoke('nimro:git:review:createPr', repoPath)
    }
  },
  terminal: {
    cwd: id => ipcRenderer.invoke('nimro:terminal:cwd', id),
    dispose: id => ipcRenderer.invoke('nimro:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('nimro:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('nimro:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('nimro:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `nimro:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `nimro:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('nimro:close-preview-requested', listener)

    return () => ipcRenderer.removeListener('nimro:close-preview-requested', listener)
  },
  onOpenFolderRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('nimro:open-folder-requested', listener)

    return () => ipcRenderer.removeListener('nimro:open-folder-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('nimro:open-updates', listener)

    return () => ipcRenderer.removeListener('nimro:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nimro:deep-link', listener)

    return () => ipcRenderer.removeListener('nimro:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('nimro:deep-link-ready'),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nimro:window-state-changed', listener)

    return () => ipcRenderer.removeListener('nimro:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('nimro:focus-session', listener)

    return () => ipcRenderer.removeListener('nimro:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nimro:notification-action', listener)

    return () => ipcRenderer.removeListener('nimro:notification-action', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nimro:preview-file-changed', listener)

    return () => ipcRenderer.removeListener('nimro:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nimro:backend-exit', listener)

    return () => ipcRenderer.removeListener('nimro:backend-exit', listener)
  },
  // Soft gateway-mode apply finished tearing down the primary backend. Renderer
  // should wipe session lists + re-dial without a window reload.
  onConnectionApplied: callback => {
    const listener = () => callback()
    ipcRenderer.on('nimro:connection:applied', listener)

    return () => ipcRenderer.removeListener('nimro:connection:applied', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('nimro:power-resume', listener)

    return () => ipcRenderer.removeListener('nimro:power-resume', listener)
  },
  // AC ↔ battery transitions; renderers slow their backstop polls on battery.
  getOnBattery: () => ipcRenderer.invoke('nimro:power-battery:get'),
  onBatteryChanged: callback => {
    const listener = (_event, onBattery) => callback(Boolean(onBattery))
    ipcRenderer.on('nimro:power-battery', listener)

    return () => ipcRenderer.removeListener('nimro:power-battery', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nimro:boot-progress', listener)

    return () => ipcRenderer.removeListener('nimro:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.ts (apps/desktop/electron/bootstrap-runner.ts).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('nimro:bootstrap:get'),
  continueBootstrapLocal: () => ipcRenderer.invoke('nimro:bootstrap:continue-local'),
  resetBootstrap: () => ipcRenderer.invoke('nimro:bootstrap:reset'),
  repairBootstrap: () => ipcRenderer.invoke('nimro:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('nimro:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nimro:bootstrap:event', listener)

    return () => ipcRenderer.removeListener('nimro:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('nimro:version'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('nimro:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('nimro:uninstall:summary'),
    run: mode => ipcRenderer.invoke('nimro:uninstall:run', { mode })
  },
  updates: {
    check: () => ipcRenderer.invoke('nimro:updates:check'),
    apply: opts => ipcRenderer.invoke('nimro:updates:apply', opts),
    getBranch: () => ipcRenderer.invoke('nimro:updates:branch:get'),
    setBranch: name => ipcRenderer.invoke('nimro:updates:branch:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('nimro:updates:progress', listener)

      return () => ipcRenderer.removeListener('nimro:updates:progress', listener)
    }
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('nimro:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('nimro:vscode-theme:search', query)
  },
  // Find-in-page (Ctrl/Cmd+F): delegates to Electron's
  // webContents.findInPage on the IPC sender's window so a Cmd+F pressed
  // in a secondary session window searches THAT window, not the primary.
  // `onFoundInPage` returns the unsubscribe fn; the renderer wires it via
  // `initFindInPageListener` in store/find-in-page.ts and tears it down
  // when the FindBar unmounts.
  findInPage: (query, options) => ipcRenderer.invoke('nimro:find-in-page', query, options),
  stopFindInPage: () => ipcRenderer.invoke('nimro:stop-find-in-page'),
  onFoundInPage: callback => {
    const listener = (_event, result) => callback(result)
    ipcRenderer.on('nimro:found-in-page', listener)

    return () => ipcRenderer.removeListener('nimro:found-in-page', listener)
  }
})
