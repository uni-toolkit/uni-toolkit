import { execSync } from 'node:child_process';

const packages = process.argv.slice(2);

// build all packages
if (!packages.length) {
  execSync(`pnpm --filter './packages/*' build`, { stdio: 'inherit' });
  process.exit(0);
}

const command = packages.reduce((command, packageName) => {
  return `${command} --filter './packages/${packageName}'`;
}, '');

// build input package(s)
execSync(`pnpm ${command} build`, { stdio: 'inherit' });
process.exit(0);
