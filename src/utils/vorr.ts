import rawpackage from '../../package.json';

const packageJson = rawpackage as { version: string };

export const VORR_VERSION = packageJson.version;
