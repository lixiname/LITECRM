const os = require('node:os')
const path = require('node:path')

// Some Windows/libuv combinations fail inside os.userInfo() with ENOMEM even
// when the machine has ample memory. Drizzle Kit only needs a stable user
// identity, so provide it from the process environment for this CLI process.
Object.defineProperty(os, 'userInfo', {
  configurable: true,
  value: () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || 'windows-user',
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: null,
  }),
})

process.argv = [process.execPath, 'drizzle-kit', ...process.argv.slice(2)]
require(path.join(path.dirname(require.resolve('drizzle-kit')), 'bin.cjs'))
