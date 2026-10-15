const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 12)) {
  console.error(`\nEl dashboard necesita Node 24.12 o superior. Estás usando ${process.version}.\nDesde la carpeta dashboard ejecutá:\n\n  nvm install\n  nvm use\n  npm run dev\n`);
  process.exit(1);
}
