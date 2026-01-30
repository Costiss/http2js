import rawpackage from '../../package.json';

const packageJson = rawpackage as { version: string };

export const VORR_VERSION = packageJson.version;
export const VORR_USER_AGENT = `vorr/${VORR_VERSION}`;
