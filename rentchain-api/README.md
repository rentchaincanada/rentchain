# RentChain API

## Troubleshooting

- **Node version**: Requires Node 24.x. If you are on a different version, use nvm-windows or Volta to switch to Node 24.

- **Windows EPERM (esbuild.exe lock) during npm ci**:
  - Close VSCode terminals that may be holding file locks.
  - Kill any running node.exe processes.
  - Exclude this repo folder from Windows Defender real-time scanning.
  - Re-run npm ci.

- **Windows reinstall helper**:
  - Run `npm run reinstall:win` (this runs the Windows-safe clean step and then `npm ci`).

- **Run a single vitest file**:
  - `npx vitest run src/routes/__tests__/screeningCheckoutRedirect.test.ts --reporter=verbose --testTimeout=60000 --hookTimeout=60000 --pool=forks --maxWorkers=1`
