import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  copyFileSync,
  chmodSync,
  writeFileSync,
  realpathSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.env.BUILD_TARGET
const environment = process.env.ZENTRA_DESKTOP_ENV
assert(target, 'BUILD_TARGET is required')
assert(
  ['dev', 'production'].includes(environment),
  'Choose a desktop environment',
)
const bundle = join(root, 'src-tauri', 'target', target, 'release', 'bundle')
const artifacts = join(root, 'native-smoke-artifacts')
mkdirSync(artifacts, { recursive: true })

function singleFile(directory, suffix) {
  const files = readdirSync(directory).filter((name) => name.endsWith(suffix))
  assert.equal(files.length, 1, `Expected one ${suffix} file in ${directory}`)
  return join(directory, files[0])
}

export function install() {
  // macOS /var is a symlink to /private/var. The updater correctly refuses
  // to replace a binary through a symlinked ancestor; use a real install path.
  const destination = join(
    realpathSync(tmpdir()),
    `zentra-native-smoke-${environment}`,
  )
  mkdirSync(destination, { recursive: true })
  if (process.platform === 'win32') {
    execFileSync(
      singleFile(join(bundle, 'nsis'), '.exe'),
      ['/S', `/D=${destination}`],
      {
        timeout: 120_000,
        stdio: 'pipe',
      },
    )
    const executable = readdirSync(destination).filter(
      (name) =>
        name.endsWith('.exe') && !name.toLowerCase().includes('uninstall'),
    )
    assert.equal(executable.length, 1, 'Installed app executable is ambiguous')
    return join(destination, executable[0])
  }
  if (process.platform === 'darwin') {
    const mount = join(destination, 'mounted')
    mkdirSync(mount, { recursive: true })
    execFileSync('hdiutil', [
      'attach',
      singleFile(join(bundle, 'dmg'), '.dmg'),
      '-readonly',
      '-nobrowse',
      '-mountpoint',
      mount,
    ])
    let installed
    try {
      const application = singleFile(mount, '.app')
      installed = join(destination, 'Zentra.app')
      execFileSync('ditto', [application, installed])
    } finally {
      execFileSync('hdiutil', ['detach', mount, '-quiet'])
    }
    const executable = execFileSync(
      'plutil',
      [
        '-extract',
        'CFBundleExecutable',
        'raw',
        '-o',
        '-',
        join(installed, 'Contents', 'Info.plist'),
      ],
      { encoding: 'utf8' },
    ).trim()
    return join(installed, 'Contents', 'MacOS', executable)
  }
  const executable = join(destination, 'Zentra.AppImage')
  copyFileSync(singleFile(join(bundle, 'appimage'), '.AppImage'), executable)
  chmodSync(executable, 0o755)
  return executable
}

function verify(report) {
  assert.equal(report.environment, environment)
  assert.equal(report.apiOrigin, new URL(process.env.ZENTRA_API_ORIGIN).origin)
  assert.equal(
    report.identifier,
    environment === 'dev' ? 'app.zntr.calendar.dev' : 'app.zntr.calendar',
  )
  const window = report.window
  assert.equal(window.visible, true)
  assert.equal(window.resizable, false)
  if (process.platform === 'linux') {
    assert.equal(window.maximizable, null)
  } else {
    assert.equal(window.maximizable, false)
  }
  assert(window.workArea, 'No monitor work area was reported')
  assert(window.scaleFactor > 0)
  for (const [dimension, logicalSize] of [
    ['width', 1320],
    ['height', 880],
  ]) {
    const expected = Math.min(
      Math.round(logicalSize * window.scaleFactor),
      window.workArea[dimension],
    )
    assert(
      Math.abs(window.outer[dimension] - expected) <= 2,
      `Outer ${dimension}: expected ${expected}, got ${window.outer[dimension]}`,
    )
    assert(window.inner[dimension] > 0)
    assert(window.inner[dimension] <= window.outer[dimension])
  }
}

async function waitForWindowState(windowId, expected) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const info = execFileSync('xwininfo', ['-id', windowId], {
      encoding: 'utf8',
    })
    if (info.includes(`Map State: ${expected}`)) return
    await new Promise((settled) => setTimeout(settled, 100))
  }
  throw new Error(`Calendar did not reach window state ${expected}`)
}

async function launch(executable, label, extraEnvironment = {}) {
  let output = ''
  const child = spawn(executable, [], {
    env: { ...process.env, ...extraEnvironment, ZENTRA_SMOKE_TEST: '1' },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    const report = await new Promise((resolveReport, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Frontend IPC startup timed out')),
        60_000,
      )
      const consume = (chunk) => {
        output += chunk.toString()
        const match = output.match(/ZENTRA_DESKTOP_SMOKE (\{[^\r\n]+\})\r?\n/)
        if (match) {
          clearTimeout(timeout)
          try {
            resolveReport(JSON.parse(match[1]))
          } catch (error) {
            reject(error)
          }
        }
      }
      child.stdout.on('data', consume)
      child.stderr.on('data', consume)
      child.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      child.on('exit', (code) => {
        clearTimeout(timeout)
        reject(new Error(`Desktop exited before IPC startup: ${code}`))
      })
    })
    verify(report)
    writeFileSync(
      join(artifacts, `${label}.json`),
      JSON.stringify(report, null, 2),
    )
    const identityDeadline = Date.now() + 90_000
    let identity
    while (Date.now() < identityDeadline) {
      const match = output.match(/ZENTRA_IDENTITY_SMOKE (\{[^\r\n]+\})\r?\n/)
      if (match) {
        identity = JSON.parse(match[1])
        break
      }
      assert.equal(
        child.exitCode,
        null,
        'Application exited while opening sign in',
      )
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    assert(
      identity,
      'Embedded identity document/fullscreen verification timed out',
    )
    writeFileSync(
      join(artifacts, `${label}-identity.json`),
      JSON.stringify(identity, null, 2),
    )
    if (process.platform === 'linux') {
      execFileSync('scrot', ['-o', join(artifacts, `${label}-identity.png`)])
    } else if (process.platform === 'darwin') {
      execFileSync('screencapture', [
        '-x',
        join(artifacts, `${label}-identity.png`),
      ])
    }
    assert.equal(identity.path, '/oauth/sign-in')
    assert.equal(identity.enteredFullscreen, true)
    assert.equal(identity.window.fullscreen, false)
    verify({ ...report, window: identity.window })
    const { inner, scaleFactor } = identity.window
    const position = identity.identityPosition
    const size = identity.identitySize
    const requested = identity.requested
    for (const dimension of ['width', 'height']) {
      assert(
        Math.abs(identity.mainSize[dimension] - inner[dimension]) <= 2,
        `The local calendar view no longer fills the window (${dimension})`,
      )
    }
    assert(
      position.y >= 30 * scaleFactor && position.y <= 100 * scaleFactor,
      `Identity view must start below the toolbar, got y=${position.y}`,
    )
    assert(Math.abs(position.x) <= 2, 'Sign-in view must align with the window')
    assert(
      Math.abs(size.width - requested.viewportWidth * scaleFactor) <= 2,
      'Sign-in view must fill the content width',
    )
    assert(
      Math.abs(
        position.y + size.height - requested.viewportHeight * scaleFactor,
      ) <= 2,
      'Sign-in view is clipped or stacked below the local calendar view',
    )
    // macOS's WKWebView viewport excludes the native title bar even when the
    // native frame getter includes it. It must still occupy the whole content
    // area, not a half-height view from accidental native stacking.
    assert(inner.height - requested.viewportHeight * scaleFactor >= -2)
    assert(
      inner.height - requested.viewportHeight * scaleFactor <= 40 * scaleFactor,
    )
    for (const [actual, expected] of [
      [position.x, requested.x],
      [position.y, requested.y],
      [size.width, requested.width],
      [size.height, requested.height],
    ])
      assert(
        Math.abs(actual - expected * scaleFactor) <= 2,
        'Native identity does not match its DOM slot',
      )
    if (process.platform === 'linux') {
      assert(
        process.env.DBUS_SESSION_BUS_ADDRESS,
        'Run native smoke in a shared D-Bus session',
      )
      const owner = execFileSync(
        'dbus-send',
        [
          '--session',
          '--print-reply',
          '--dest=org.freedesktop.DBus',
          '/org/freedesktop/DBus',
          'org.freedesktop.DBus.GetNameOwner',
          `string:${report.identifier}.SingleInstance`,
        ],
        { encoding: 'utf8', timeout: 5000 },
      )
      writeFileSync(join(artifacts, `${label}-instance-bus.log`), owner)
      const handler = execFileSync(
        'xdg-mime',
        ['query', 'default', `x-scheme-handler/${report.identifier}`],
        { encoding: 'utf8' },
      ).trim()
      assert.equal(
        handler,
        `${report.identifier}-handler.desktop`,
        'Login callback registration is not isolated by environment',
      )
      const entryPath = join(
        process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'),
        'applications',
        handler,
      )
      const registration = readFileSync(entryPath, 'utf8')
      assert(
        registration.includes(executable),
        'Login callback does not use the installed AppImage',
      )
      const otherIdentifier =
        environment === 'dev' ? 'app.zntr.calendar' : 'app.zntr.calendar.dev'
      assert(
        !registration.includes(`x-scheme-handler/${otherIdentifier};`),
        'The other environment shares this login callback handler',
      )
      await new Promise((settled) => setTimeout(settled, 500))
      const title =
        environment === 'dev' ? 'Zentra Calendar Dev' : 'Zentra Calendar'
      const windows = execFileSync('wmctrl', ['-l'], { encoding: 'utf8' })
      const entry = windows.split('\n').find((line) => line.endsWith(title))
      assert(
        entry,
        'Installed calendar window is missing from the window manager',
      )
      const windowId = entry.split(/\s+/)[0]
      execFileSync('wmctrl', [
        '-i',
        '-r',
        windowId,
        '-b',
        'add,maximized_vert,maximized_horz',
      ])
      await new Promise((settled) => setTimeout(settled, 250))
      const state = execFileSync('xprop', ['-id', windowId, '_NET_WM_STATE'], {
        encoding: 'utf8',
      })
      assert(
        !state.includes('_NET_WM_STATE_MAXIMIZED_'),
        'Calendar remained maximized',
      )
      execFileSync('scrot', ['-o', join(artifacts, `${label}.png`)])
      execFileSync('wmctrl', ['-i', '-c', windowId])
      await waitForWindowState(windowId, 'IsUnMapped')
      assert.equal(
        child.exitCode,
        null,
        'Closing the window terminated the app',
      )
      let secondOutput = ''
      const second = spawn(executable, [], {
        env: { ...process.env, ...extraEnvironment, ZENTRA_SMOKE_TEST: '1' },
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      second.stdout.on('data', (chunk) => {
        secondOutput += chunk.toString()
      })
      second.stderr.on('data', (chunk) => {
        secondOutput += chunk.toString()
      })
      try {
        await new Promise((settled, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('Second instance did not exit')),
            15_000,
          )
          second.once('error', (error) => {
            clearTimeout(timeout)
            reject(error)
          })
          second.once('exit', (code) => {
            clearTimeout(timeout)
            if (code === 0) settled()
            else reject(new Error(`Second instance exited with ${code}`))
          })
        })
        await waitForWindowState(windowId, 'IsViewable')
        assert.equal(
          child.exitCode,
          null,
          'Reopening replaced the existing process',
        )
        writeFileSync(
          join(artifacts, `${label}-lifecycle.json`),
          JSON.stringify(
            {
              closeHidesWindow: true,
              reopenRestoresSameWindow: true,
              originalProcess: child.pid,
              windowId,
            },
            null,
            2,
          ),
        )
      } finally {
        writeFileSync(
          join(artifacts, `${label}-second-instance.log`),
          secondOutput,
        )
        if (second.pid && second.exitCode === null) {
          try {
            process.kill(-second.pid, 'SIGTERM')
          } catch {
            /* Already exited. */
          }
        }
      }
    }
    console.log(`Native installation and IPC startup passed: ${label}`)
  } finally {
    writeFileSync(join(artifacts, `${label}.log`), output)
    if (child.pid) {
      try {
        if (process.platform === 'win32') {
          execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            stdio: 'ignore',
          })
        } else {
          process.kill(-child.pid, 'SIGTERM')
        }
      } catch {
        /* The owned child may already have exited. */
      }
    }
  }
}

export const linuxEnvironment = {
  APPIMAGE_EXTRACT_AND_RUN: '1',
  WEBKIT_DISABLE_DMABUF_RENDERER: '1',
  LIBGL_ALWAYS_SOFTWARE: '1',
  GDK_BACKEND: 'x11',
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const executable = install()
  await launch(
    executable,
    'default-display',
    process.platform === 'linux' ? linuxEnvironment : {},
  )
  if (process.platform === 'linux') {
    await launch(executable, 'scaled-display', {
      ...linuxEnvironment,
      GDK_SCALE: '2',
    })
  }
}
